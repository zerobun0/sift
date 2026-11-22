// Copyright (c) 2026 zerobun. All rights reserved.
//
// Runs in YouTube's own JS world at document_start, before any page script.
// 1. Catches the first page's data (window.ytInitialData) as YouTube assigns it.
// 2. Wraps fetch() so every later feed page (scrolling, navigation) is filtered too.
// 3. Learns each watched video's category for free from the player data.
// Everything fails open: on any error the original data goes through untouched.

import { filterTree, judge, surfaceFor, surfaceForPath } from '../core/filter.ts';
import { categoryIdFromName } from '../core/categories.ts';
import { normaliseSettings } from '../core/settings.ts';
import { EV_TO_EXT, EV_TO_PAGE, LS_CATS, LS_SETTINGS, type ExtToPage, type PageStats, type PageToExt } from '../core/protocol.ts';
import type { Reason, Settings, Surface, VideoInfo } from '../core/types.ts';
import { activeMode } from '../core/settings.ts';
import { readTopics } from '../core/topics.ts';
import { REFILL_MAX_PAGES, REFILL_TARGET, appendPage, continuationList, countItems, nextToken } from '../core/refill.ts';
import { createChip, type HiddenRow } from './chip.ts';

const readLS = (k: string): unknown => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
};

let settings: Settings = normaliseSettings(readLS(LS_SETTINGS));
const cats: Record<string, number> = (readLS(LS_CATS) as Record<string, number>) ?? {};
const MAX_CATS = 40000;

const send = (m: PageToExt) => document.dispatchEvent(new CustomEvent(EV_TO_EXT, { detail: JSON.stringify(m) }));
const chip = createChip((channel, channelId) => send({ t: 'allow', channel: channelId ?? channel }));

// ------------------------------------------------------------ page state

type State = 'shown' | 'removed' | 'css';
interface Seen {
  info: VideoInfo;
  state: State;
  reason?: Reason;
}
let surface: Surface = surfaceForPath(location.pathname);
const seen = new Map<string, Seen>();
const cssHidden = new Map<string, Reason>();

function resetPage() {
  seen.clear();
  cssHidden.clear();
  renderCss();
  pushStats();
}

const lookup = (id: string) => cats[id];

function process(data: unknown, where: Surface) {
  surface = where;
  const r = filterTree(data, settings, where, lookup);
  const reasons: Record<string, number> = {};
  for (const h of r.hidden) reasons[h.reason] = (reasons[h.reason] ?? 0) + 1;
  if (where !== 'other') send({ t: 'tally', shown: r.shown.length + r.pending.length, reasons });
  for (const h of r.hidden) seen.set(h.info.id, { info: h.info, state: 'removed', reason: h.reason });
  for (const v of r.shown) seen.set(v.id, { info: v, state: 'shown' });
  for (const v of r.pending) seen.set(v.id, { info: v, state: 'shown' });
  if (r.pending.length) requestCats(r.pending.map((v) => v.id));
  if (where === 'home') {
    const topics = readTopics(data);
    if (topics.length) send({ t: 'topics', topics });
    applyTopic();
  }
  pushStats();
}

// ------------------------------------------- YouTube's own topic chips

const CHIP = 'yt-chip-cloud-chip-renderer, chip-view-model, yt-chip-view-model';
let topicDone = '';
let topicTimer = 0;

function findChip(key: string): HTMLElement | null {
  const scope = document.querySelector('ytd-browse[page-subtype="home"]');
  if (!scope) return null;
  for (const el of scope.querySelectorAll<HTMLElement>(CHIP)) {
    if ((el.textContent ?? '').trim().toLowerCase() === key) return el;
  }
  return null;
}

const chipSelected = (el: HTMLElement) =>
  el.getAttribute('aria-selected') === 'true' ||
  el.hasAttribute('selected') ||
  !!el.querySelector('[aria-selected="true"], [aria-pressed="true"]');

/** If the active mode names a topic, select that chip on the home feed (once per visit; a manual pick wins). */
function applyTopic() {
  const key = activeMode(settings).topic.toLowerCase();
  if (!key || !settings.enabled || !settings.surfaces.home || surfaceForPath(location.pathname) !== 'home') return;
  if (topicDone === key) return;
  clearTimeout(topicTimer);
  let tries = 0;
  const tick = () => {
    const el = findChip(key);
    if (el) {
      topicDone = key;
      if (!chipSelected(el)) (el.querySelector<HTMLElement>('button, [role="tab"], a') ?? el).click();
      return;
    }
    if (++tries < 40) topicTimer = window.setTimeout(tick, 250);
  };
  tick();
}

// ------------------------------------------------------- category lookups

const wanted = new Set<string>();
let flushTimer = 0;
function requestCats(ids: string[]) {
  for (const id of ids) if (cats[id] === undefined) wanted.add(id);
  if (!wanted.size || flushTimer) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = 0;
    const batch = [...wanted].slice(0, 50);
    batch.forEach((id) => wanted.delete(id));
    send({ t: 'lookup', ids: batch });
    if (wanted.size) requestCats([]);
  }, 250);
}

let saveTimer = 0;
function storeCats(found: Record<string, number>) {
  let changed = false;
  for (const [id, c] of Object.entries(found)) {
    if (typeof c === 'number' && cats[id] !== c) {
      cats[id] = c;
      changed = true;
    }
  }
  if (!changed) return;
  if (!saveTimer)
    saveTimer = window.setTimeout(() => {
      saveTimer = 0;
      const keys = Object.keys(cats);
      if (keys.length > MAX_CATS) for (const k of keys.slice(0, keys.length - MAX_CATS)) delete cats[k];
      try {
        localStorage.setItem(LS_CATS, JSON.stringify(cats));
      } catch {
        /* storage full or blocked: the background keeps the durable copy */
      }
    }, 1000);
  rejudge();
}

// ------------------------------------------- re-judging what is on screen

/** After new categories or new settings: hide/unhide rendered cards via CSS, count what a reload would bring back. */
function rejudge() {
  const active = settings.enabled && settings.surfaces[surface];
  const mode = activeMode(settings);
  const ask: string[] = [];
  cssHidden.clear();
  for (const s of seen.values()) {
    const v = active ? judge(s.info, settings, lookup, mode) : { reason: null, needsCategory: false };
    if (v.needsCategory) ask.push(s.info.id);
    if (s.state !== 'removed' && v.reason) cssHidden.set(s.info.id, v.reason);
  }
  renderCss();
  if (ask.length) requestCats(ask);
  pushStats();
}

const CARD = [
  'ytd-rich-item-renderer',
  'ytd-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-reel-item-renderer',
  'ytm-shorts-lockup-view-model-v2',
  'ytm-shorts-lockup-view-model',
  'yt-lockup-view-model',
].join(',');

let styleEl: HTMLStyleElement | null = null;
function renderCss() {
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'sift-hide';
    (document.head ?? document.documentElement).appendChild(styleEl);
  }
  const ids = [...cssHidden.keys()];
  // :has() lets the rule match cards YouTube renders later, with no DOM scanning.
  styleEl.textContent = ids.length
    ? `:is(${CARD}):has(a[href*="${ids.join('"], a[href*="')}"]){display:none!important}`
    : '';
}

let statsTimer = 0;
function pushStats() {
  if (statsTimer) return;
  statsTimer = window.setTimeout(() => {
    statsTimer = 0;
    const byReason: PageStats['byReason'] = {};
    let hidden = 0;
    let shown = 0;
    let pending = 0;
    let reloadable = 0;
    const mode = activeMode(settings);
    const active = settings.enabled && settings.surfaces[surface];
    for (const s of seen.values()) {
      const reason = s.state === 'removed' ? s.reason : cssHidden.get(s.info.id);
      if (reason) {
        hidden++;
        byReason[reason] = (byReason[reason] ?? 0) + 1;
        if (s.state === 'removed' && (!active || !judge(s.info, settings, lookup, mode).reason)) reloadable++;
      } else {
        shown++;
        if (active && judge(s.info, settings, lookup, mode).needsCategory) pending++;
      }
    }
    send({ t: 'stats', stats: { surface, mode: mode.name, hue: mode.hue, shown, hidden, pending, byReason, reloadable } });
    const rows: HiddenRow[] = [];
    for (const s of seen.values()) {
      const reason = s.state === 'removed' ? s.reason : cssHidden.get(s.info.id);
      if (reason) rows.push({ info: s.info, reason });
    }
    chip.update(settings.enabled && settings.showChip && active, mode.hue, mode.name, rows);
  }, 200);
}

// ------------------------------------------------ messages from the bridge

document.addEventListener(EV_TO_PAGE, (e) => {
  let m: ExtToPage;
  try {
    m = JSON.parse(String((e as CustomEvent).detail));
  } catch {
    return;
  }
  if (m.t === 'settings') {
    settings = normaliseSettings(m.settings);
    rejudge();
    applyTopic();
  } else if (m.t === 'cats') {
    storeCats(m.cats);
  }
});

// ------------------------------------------------------- learn categories

function learnFromPlayer(p: any) {
  const id = p?.videoDetails?.videoId;
  const c = categoryIdFromName(p?.microformat?.playerMicroformatRenderer?.category);
  // Count as opened only on the watch page itself (hover previews also fetch player data).
  if (typeof id === 'string' && c !== undefined && new URLSearchParams(location.search).get('v') === id)
    send({ t: 'opened', id, cat: c });
  if (typeof id === 'string' && c !== undefined && cats[id] !== c) {
    storeCats({ [id]: c });
    send({ t: 'learn', cats: { [id]: c } });
  }
}

// ------------------------------------------- 1. the first page's own data

function trap(name: string, onSet: (v: any) => void) {
  let value: unknown;
  try {
    Object.defineProperty(window, name, {
      configurable: true,
      get: () => value,
      set: (v) => {
        try {
          onSet(v);
        } catch {
          /* fail open */
        }
        value = v;
      },
    });
  } catch {
    /* already defined by someone else: skip */
  }
}

trap('ytInitialData', (v) => process(v, surfaceForPath(location.pathname)));
trap('ytInitialPlayerResponse', learnFromPlayer);

// --------------------------------------------- 2. every later feed request

const FEED = /\/youtubei\/v1\/(browse|search|next|player)(\?|$)/;
const nativeFetch = window.fetch;

async function browseIdOf(input: RequestInfo | URL, init?: RequestInit): Promise<string | undefined> {
  try {
    let body: unknown = init?.body;
    if (body === undefined && input instanceof Request) body = await input.clone().text();
    if (typeof body !== 'string') return undefined;
    const id = JSON.parse(body)?.browseId;
    return typeof id === 'string' ? id : undefined;
  } catch {
    return undefined;
  }
}

/** Filtering left this page thin: fetch following pages ourselves until it looks full again. */
async function refill(data: unknown, where: Surface, url: string, bodyText: string, headers: Headers) {
  if (!settings.enabled || !settings.surfaces[where]) return;
  const list = continuationList(data);
  if (!list) return;
  for (let page = 0; page < REFILL_MAX_PAGES && countItems(list) < REFILL_TARGET; page++) {
    const token = nextToken(list);
    if (!token) return;
    try {
      const body = JSON.parse(bodyText);
      delete body.browseId;
      delete body.params;
      delete body.query;
      body.continuation = token;
      const r = await nativeFetch(url, { method: 'POST', headers, body: JSON.stringify(body), credentials: 'include' });
      if (!r.ok) return;
      const next = await r.json();
      process(next, where);
      appendPage(list, continuationList(next));
    } catch {
      return;
    }
  }
}

window.fetch = async function (this: unknown, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
  const m = FEED.exec(url);
  if (!m) return nativeFetch.call(this, input, init);
  const endpoint = '/youtubei/v1/' + m[1];
  const browseId = m[1] === 'browse' ? await browseIdOf(input, init) : undefined;
  let bodyText: string | undefined;
  try {
    bodyText = typeof init?.body === 'string' ? init.body : input instanceof Request ? await input.clone().text() : undefined;
  } catch {
    bodyText = undefined;
  }
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  const res = await nativeFetch.call(this, input, init);
  if (!res.ok) return res;
  if (m[1] === 'player') {
    res
      .clone()
      .json()
      .then(learnFromPlayer)
      .catch(() => {});
    return res;
  }
  try {
    const data = await res.clone().json();
    const where = surfaceFor(endpoint, browseId, location.pathname);
    process(data, where);
    if (bodyText && m[1] !== 'next') await refill(data, where, url, bodyText, headers);
    const out = new Response(JSON.stringify(data), { status: res.status, statusText: res.statusText, headers: res.headers });
    Object.defineProperty(out, 'url', { value: res.url });
    return out;
  } catch {
    return res;
  }
};

// YouTube is a single-page app: a new page starts with this event.
document.addEventListener('yt-navigate-start', () => {
  topicDone = '';
  resetPage();
});
document.addEventListener('yt-navigate-finish', () => {
  surface = surfaceForPath(location.pathname);
  applyTopic();
  pushStats();
});

send({ t: 'hello' });
