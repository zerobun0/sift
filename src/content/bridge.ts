// Copyright (c) 2026 zerobun. All rights reserved.
//
// Content script (isolated world). Carries settings into the page hook and
// category lookups out to the background. It trusts nothing the page sends:
// ids are checked and capped before anything is forwarded.

import { ext, loadSettings } from '../core/ext.ts';
import { EV_TO_EXT, EV_TO_PAGE, LS_SETTINGS, VIDEO_ID, type ExtToPage, type PageToExt } from '../core/protocol.ts';
import { normaliseSettings } from '../core/settings.ts';
import type { Settings } from '../core/types.ts';

const toPage = (m: ExtToPage) => document.dispatchEvent(new CustomEvent(EV_TO_PAGE, { detail: JSON.stringify(m) }));

function mirror(s: Settings) {
  try {
    // The hook reads this synchronously on the next page load, before YouTube's first data arrives.
    localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
  } catch {
    /* blocked storage: the hook falls back to defaults and gets the event below */
  }
  toPage({ t: 'settings', settings: s });
}

async function pushSettings() {
  try {
    mirror(await loadSettings());
  } catch {
    /* extension reloaded underneath us */
  }
}

ext.storage.onChanged.addListener((changes: any, area: string) => {
  if (area === 'local' && changes.settings) mirror(normaliseSettings(changes.settings.newValue));
});

const cleanCats = (c: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (typeof c !== 'object' || c === null) return out;
  for (const [id, n] of Object.entries(c).slice(0, 50)) if (VIDEO_ID.test(id) && Number.isInteger(n)) out[id] = n as number;
  return out;
};

document.addEventListener(EV_TO_EXT, async (e) => {
  let m: PageToExt;
  try {
    m = JSON.parse(String((e as CustomEvent).detail));
  } catch {
    return;
  }
  try {
    if (m.t === 'hello') {
      await pushSettings();
    } else if (m.t === 'lookup') {
      const ids = (Array.isArray(m.ids) ? m.ids : []).filter((id) => typeof id === 'string' && VIDEO_ID.test(id)).slice(0, 50);
      if (!ids.length) return;
      const found = await ext.runtime.sendMessage({ t: 'lookup', ids });
      if (found && typeof found === 'object') toPage({ t: 'cats', cats: cleanCats(found) });
    } else if (m.t === 'learn') {
      await ext.runtime.sendMessage({ t: 'learn', cats: cleanCats(m.cats) });
    } else if (m.t === 'topics') {
      const topics = (Array.isArray(m.topics) ? m.topics : []).filter((t) => typeof t === 'string').map((t) => t.slice(0, 40)).slice(0, 30);
      if (topics.length) await ext.runtime.sendMessage({ t: 'topics', topics });
    } else if (m.t === 'stats') {
      await ext.runtime.sendMessage({ t: 'stats', stats: m.stats });
    }
  } catch {
    /* background asleep or extension updated: nothing to do, the page keeps working */
  }
});

pushSettings();
