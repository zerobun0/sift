// Copyright (c) 2026 zerobun. All rights reserved.

import { CATEGORIES } from '../core/categories.ts';
import { ext, loadSettings, saveSettings } from '../core/ext.ts';
import type { PageStats } from '../core/protocol.ts';
import { activeMode } from '../core/settings.ts';
import { REASON_LABEL } from '../core/reasons.ts';
import type { Mode, Reason, Settings } from '../core/types.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const YT = ['*://www.youtube.com/*'];

const LENGTHS: Array<{ label: string; min: number; max: number }> = [
  { label: 'Any', min: 0, max: 0 },
  { label: 'Under 4 min', min: 0, max: 240 },
  { label: '4-20 min', min: 240, max: 1200 },
  { label: '20-60 min', min: 1200, max: 3600 },
  { label: 'Over 1 h', min: 3600, max: 0 },
];

const HIDES: Array<{ label: string; get: (m: Mode) => boolean; set: (m: Mode, on: boolean) => void }> = [
  { label: 'Shorts', get: (m) => m.hideShorts, set: (m, on) => (m.hideShorts = on) },
  { label: 'Live', get: (m) => m.hideLive, set: (m, on) => (m.hideLive = on) },
  { label: 'Upcoming', get: (m) => m.hideUpcoming, set: (m, on) => (m.hideUpcoming = on) },
  { label: 'Mixes', get: (m) => m.hideMixes, set: (m, on) => (m.hideMixes = on) },
  { label: 'Members-only', get: (m) => m.hideMembers, set: (m, on) => (m.hideMembers = on) },
  { label: 'Watched', get: (m) => m.hideWatchedAt > 0, set: (m, on) => (m.hideWatchedAt = on ? 90 : 0) },
];


const SURFACE_LABEL: Record<string, string> = {
  home: 'Home',
  search: 'Search',
  watch: 'Up next',
  subs: 'Subscriptions',
  channel: 'Channel page',
  other: 'This page',
};

let settings: Settings;
let tabId: number | undefined;
let hasKey = false;
let topics: string[] = [];

function chip(label: string, pressed: boolean, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'chip';
  b.type = 'button';
  b.textContent = label;
  b.setAttribute('aria-pressed', String(pressed));
  b.addEventListener('click', onClick);
  return b;
}

let saveTimer = 0;
function commit() {
  render();
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => saveSettings(settings), 120);
}

function render() {
  const mode = activeMode(settings);
  document.documentElement.style.setProperty('--hue', String(mode.hue));
  document.body.classList.toggle('off', !settings.enabled);
  $<HTMLInputElement>('enabled').checked = settings.enabled;
  $('power-label').textContent = settings.enabled ? 'On' : 'Off';

  // modes
  const modes = $('modes');
  modes.replaceChildren(
    ...settings.modes.map((m) => {
      const b = document.createElement('button');
      b.className = 'mode';
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(m.id === mode.id));
      b.style.setProperty('--mode-hue', String(m.hue));
      b.textContent = m.name;
      b.title = m.name;
      b.addEventListener('click', () => {
        settings.modeId = m.id;
        commit();
      });
      return b;
    }),
  );

  // YouTube's own topics (single choice; tap again to clear)
  const list = [...topics];
  if (mode.topic && !list.some((t) => t.toLowerCase() === mode.topic.toLowerCase())) list.unshift(mode.topic);
  $('topics').replaceChildren(
    ...list.map((t) =>
      chip(t, t.toLowerCase() === mode.topic.toLowerCase(), () => {
        mode.topic = t.toLowerCase() === mode.topic.toLowerCase() ? '' : t;
        commit();
      }),
    ),
  );
  $('topic-note').hidden = list.length > 0;
  $('topic-hint').textContent = mode.topic ? `Home opens on "${mode.topic}"` : 'picked for you on Home';

  // length
  const preset = LENGTHS.findIndex((l) => l.min === mode.minSec && l.max === mode.maxSec);
  const custom = preset < 0;
  $('length').replaceChildren(
    ...LENGTHS.map((l, i) =>
      chip(l.label, i === preset, () => {
        mode.minSec = l.min;
        mode.maxSec = l.max;
        commit();
      }),
    ),
    chip('Custom', custom, () => {
      $('custom-length').hidden = false;
      $<HTMLInputElement>('min').focus();
    }),
  );
  $('custom-length').hidden = !custom && $('custom-length').hidden;
  const minEl = $<HTMLInputElement>('min');
  const maxEl = $<HTMLInputElement>('max');
  if (document.activeElement !== minEl) minEl.value = String(Math.round(mode.minSec / 60));
  if (document.activeElement !== maxEl) maxEl.value = mode.maxSec ? String(Math.round(mode.maxSec / 60)) : '';

  // categories
  $('categories').replaceChildren(
    ...CATEGORIES.map((c) =>
      chip(c.short, mode.include.includes(c.id), () => {
        mode.include = mode.include.includes(c.id) ? mode.include.filter((x) => x !== c.id) : [...mode.include, c.id];
        commit();
      }),
    ),
  );
  $('cat-hint').textContent = mode.include.length ? `${mode.include.length} kept, rest hidden` : 'none picked = all';
  $('key-note').hidden = hasKey || !mode.include.length;

  // hide
  $('hide').replaceChildren(
    ...HIDES.map((h) =>
      chip(h.label, h.get(mode), () => {
        h.set(mode, !h.get(mode));
        commit();
      }),
    ),
  );

  const on = Object.entries(settings.surfaces)
    .filter(([, v]) => v)
    .map(([k]) => SURFACE_LABEL[k]);
  $('where').textContent = on.length ? `Sifting: ${on.join(', ')}` : 'Sifting nowhere (see Settings)';
}

function renderStats(stats: PageStats | undefined, onYouTube: boolean) {
  const count = $('hidden-count');
  const reasons = $('reasons');
  const reload = $<HTMLButtonElement>('reload');
  if (!onYouTube || !stats) {
    count.textContent = '-';
    $('hidden-label').textContent = onYouTube ? 'Waiting for the page' : 'Open YouTube to sift it';
    $('page-line').textContent = onYouTube ? 'Reload the tab if this stays empty' : 'Your settings apply everywhere on it';
    reasons.hidden = true;
    reload.hidden = true;
    return;
  }
  count.textContent = String(stats.hidden);
  $('hidden-label').textContent = stats.hidden === 1 ? 'video hidden here' : 'videos hidden here';
  const total = stats.hidden + stats.shown;
  $('page-line').textContent = `${SURFACE_LABEL[stats.surface] ?? 'Page'} · ${stats.shown} of ${total} shown${
    stats.pending ? ` · ${stats.pending} checking` : ''
  }`;

  const parts = (Object.entries(stats.byReason) as Array<[Reason, number]>).sort((a, b) => b[1] - a[1]);
  reasons.hidden = !parts.length;
  if (parts.length) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    for (const [, n] of parts) {
      const s = document.createElement('span');
      s.style.width = `${(n / stats.hidden) * 100}%`;
      bar.append(s);
    }
    const legend = document.createElement('div');
    legend.className = 'legend';
    for (const [r, n] of parts.slice(0, 4)) {
      const el = document.createElement('span');
      const b = document.createElement('b');
      b.className = 'num';
      b.textContent = String(n);
      el.append(b, ` ${REASON_LABEL[r]}`);
      legend.append(el);
    }
    reasons.replaceChildren(bar, legend);
  }
  reload.hidden = !stats.reloadable;
  reload.textContent = `Bring back ${stats.reloadable} · reload page`;
}

async function main() {
  settings = await loadSettings();
  const stored = await ext.storage.local.get(['apiKey', 'topics']);
  hasKey = !!stored.apiKey;
  topics = Array.isArray(stored.topics?.list) ? stored.topics.list : [];
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  const granted = await ext.permissions.contains({ origins: YT }).catch(() => true);
  render();

  const key = tabId !== undefined ? `tab:${tabId}` : '';
  const stats = key ? (await ext.storage.session.get(key))[key] : undefined;
  // Without the `tabs` permission the URL is hidden, so "on YouTube" = the page hook has reported in.
  const onYouTube = !!stats || /youtube\.com/.test(tab?.url ?? '');
  renderStats(stats, onYouTube);

  if (!granted) {
    const reload = $<HTMLButtonElement>('reload');
    reload.hidden = false;
    reload.classList.add('primary');
    reload.textContent = 'Allow Sift on YouTube';
    reload.onclick = async () => {
      if (await ext.permissions.request({ origins: YT })) location.reload();
    };
  } else {
    $('reload').addEventListener('click', async () => {
      if (tabId !== undefined) await ext.tabs.reload(tabId);
      window.close();
    });
  }

  ext.storage.onChanged.addListener((changes: any, area: string) => {
    if (area === 'session' && key && changes[key]) renderStats(changes[key].newValue, true);
  });

  $<HTMLInputElement>('enabled').addEventListener('change', (e) => {
    settings.enabled = (e.target as HTMLInputElement).checked;
    commit();
  });
  const minutes = (el: HTMLInputElement) => Math.max(0, Math.min(1440, Number(el.value) || 0)) * 60;
  $('min').addEventListener('input', (e) => {
    activeMode(settings).minSec = minutes(e.target as HTMLInputElement);
    commit();
  });
  $('max').addEventListener('input', (e) => {
    activeMode(settings).maxSec = minutes(e.target as HTMLInputElement);
    commit();
  });
  const openOptions = () => {
    ext.runtime.openOptionsPage();
    window.close();
  };
  $('settings').addEventListener('click', openOptions);
  $('stats').addEventListener('click', () => {
    ext.tabs.create({ url: ext.runtime.getURL('stats.html') });
    window.close();
  });
  $('open-key').addEventListener('click', openOptions);
}

main();
