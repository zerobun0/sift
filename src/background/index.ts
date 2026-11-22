// Copyright (c) 2026 zerobun. All rights reserved.
//
// Background (event page in Firefox/Zen, service worker in Chromium). Holds no
// state in variables: everything lives in storage, because it can be stopped
// at any moment.
//
// Category lookups: durable cache first, then the user's own YouTube Data API
// key (1 quota unit per 50 videos, capped well under the free 10,000/day).

import { ext } from '../core/ext.ts';
import { VIDEO_ID, type PageStats, type ToBackground } from '../core/protocol.ts';

const DAILY_UNITS = 8000;
const MAX_CACHE = 100000;

type Cats = Record<string, number>;

async function getCache(): Promise<Cats> {
  const { cats } = await ext.storage.local.get('cats');
  return cats && typeof cats === 'object' ? cats : {};
}

async function addToCache(found: Cats) {
  if (!Object.keys(found).length) return;
  const cache = await getCache();
  Object.assign(cache, found);
  const keys = Object.keys(cache);
  if (keys.length > MAX_CACHE) for (const k of keys.slice(0, keys.length - MAX_CACHE)) delete cache[k];
  await ext.storage.local.set({ cats: cache });
}

async function spendUnit(): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { quota } = await ext.storage.local.get('quota');
  const q = quota?.day === today ? quota : { day: today, units: 0 };
  if (q.units >= DAILY_UNITS) return false;
  q.units++;
  await ext.storage.local.set({ quota: q });
  return true;
}

async function fromApi(ids: string[], key: string): Promise<Cats> {
  const url =
    'https://www.googleapis.com/youtube/v3/videos?part=snippet&fields=items(id,snippet/categoryId)' +
    `&id=${ids.join(',')}&key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);
  const body = await res.json();
  const out: Cats = {};
  for (const it of body?.items ?? []) {
    const n = Number(it?.snippet?.categoryId);
    if (typeof it?.id === 'string' && Number.isInteger(n)) out[it.id] = n;
  }
  return out;
}

async function lookup(ids: string[]): Promise<Cats> {
  const clean = [...new Set(ids.filter((id) => typeof id === 'string' && VIDEO_ID.test(id)))].slice(0, 50);
  const cache = await getCache();
  const found: Cats = {};
  const missing: string[] = [];
  for (const id of clean) (cache[id] !== undefined ? (found[id] = cache[id]) : missing.push(id));
  if (!missing.length) return found;
  const { apiKey } = await ext.storage.local.get('apiKey');
  if (typeof apiKey !== 'string' || !apiKey || !(await spendUnit())) return found;
  try {
    const fresh = await fromApi(missing, apiKey);
    await addToCache(fresh);
    Object.assign(found, fresh);
    await ext.storage.local.set({ apiStatus: { ok: true, at: Date.now() } });
  } catch (err) {
    await ext.storage.local.set({ apiStatus: { ok: false, at: Date.now(), error: String(err) } });
  }
  return found;
}

async function saveStats(tabId: number, stats: PageStats) {
  await ext.storage.session.set({ [`tab:${tabId}`]: { ...stats, at: Date.now() } });
  const text = stats.hidden > 0 ? (stats.hidden > 999 ? '999+' : String(stats.hidden)) : '';
  await ext.action.setBadgeText({ tabId, text });
  await ext.action.setBadgeBackgroundColor({ tabId, color: `hsl(${stats.hue} 55% 42%)` });
  if (ext.action.setBadgeTextColor) await ext.action.setBadgeTextColor({ tabId, color: '#ffffff' });
}

ext.runtime.onMessage.addListener((msg: ToBackground, sender: any) => {
  // Promise-returning listener: both Firefox and Chromium (MV3) accept it.
  switch (msg?.t) {
    case 'lookup':
      return lookup(msg.ids);
    case 'learn':
      return addToCache(
        Object.fromEntries(Object.entries(msg.cats ?? {}).filter(([id, n]) => VIDEO_ID.test(id) && Number.isInteger(n))),
      ).then(() => true);
    case 'stats':
      if (typeof sender?.tab?.id === 'number') return saveStats(sender.tab.id, msg.stats).then(() => true);
      return Promise.resolve(false);
    case 'topics':
      return ext.storage.local.set({ topics: { list: (msg.topics ?? []).slice(0, 30), at: Date.now() } }).then(() => true);
    case 'test-key':
      return fromApi(['dQw4w9WgXcQ'], msg.key).then(
        (r) => ({ ok: r.dQw4w9WgXcQ === 10 }),
        (e) => ({ ok: false, error: String(e) }),
      );
    default:
      return undefined;
  }
});

ext.tabs.onRemoved.addListener((tabId: number) => {
  ext.storage.session.remove(`tab:${tabId}`).catch(() => {});
});
