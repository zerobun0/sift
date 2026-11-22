// Copyright (c) 2026 zerobun. All rights reserved.
//
// Removes unwanted items from YouTube's JSON before the page renders it.
// Rule of thumb throughout: when unsure, keep the item. A filter that hides
// things it should not is far worse than one that misses a few.

import { readItem } from './extract.ts';
import { activeMode } from './settings.ts';
import type { Mode, Reason, Settings, Surface, VideoInfo, Verdict } from './types.ts';

export type CategoryLookup = (videoId: string) => number | undefined;

function channelMatches(list: string[], v: VideoInfo): boolean {
  if (!list.length) return false;
  const name = v.channel?.toLowerCase();
  return list.some((c) => (c.startsWith('UC') ? c === v.channelId : c.toLowerCase() === name));
}

/** Judges one item against the settings. Pure; used by both the JSON filter and the DOM pass. */
export function judge(v: VideoInfo, s: Settings, cat: CategoryLookup, mode: Mode = activeMode(s)): Verdict {
  const keep: Verdict = { reason: null, needsCategory: false };
  if (channelMatches(s.allowChannels, v)) return keep;
  const out = (reason: Reason): Verdict => ({ reason, needsCategory: false });

  if (channelMatches(s.blockChannels, v)) return out('channel');
  if (v.kind === 'short') return mode.hideShorts ? out('short') : keep;
  if (v.kind === 'mix') return mode.hideMixes ? out('mix') : keep;
  if (v.kind === 'playlist') return keep;
  if (v.live && mode.hideLive) return out('live');
  if (v.upcoming && mode.hideUpcoming) return out('upcoming');
  if (v.members && mode.hideMembers) return out('members');
  if (mode.hideWatchedAt > 0 && (v.watched ?? 0) >= mode.hideWatchedAt) return out('watched');
  if (v.seconds !== undefined && !v.live) {
    if (mode.minSec > 0 && v.seconds < mode.minSec) return out('too-short');
    if (mode.maxSec > 0 && v.seconds > mode.maxSec) return out('too-long');
  }
  if (mode.words.length) {
    const t = v.title.toLowerCase();
    if (mode.words.some((w) => t.includes(w))) return out('word');
  }
  if (mode.include.length || mode.exclude.length) {
    const c = cat(v.id);
    if (c === undefined) return { reason: null, needsCategory: true };
    if (mode.include.length && !mode.include.includes(c)) return out('category');
    if (mode.exclude.includes(c)) return out('category');
  }
  return keep;
}

/** List elements that only group items. Dropped when every item inside them was removed. */
const SHELVES = new Set([
  'richSectionRenderer',
  'reelShelfRenderer',
  'shelfRenderer',
  'gridShelfViewModel',
  'horizontalCardListRenderer',
]);

export interface FilterResult {
  shown: VideoInfo[];
  hidden: Array<{ info: VideoInfo; reason: Reason }>;
  /** Kept for now, but a category rule applies and the category is unknown. */
  pending: VideoInfo[];
}

/**
 * Filters `root` in place. Returns what was kept, removed and left pending.
 * Never throws: on any unexpected shape the data is left as it was.
 */
export function filterTree(root: unknown, s: Settings, surface: Surface, cat: CategoryLookup): FilterResult {
  const res: FilterResult = { shown: [], hidden: [], pending: [] };
  if (!s.enabled || !s.surfaces[surface]) {
    collect(root, res.shown);
    return res;
  }
  const mode = activeMode(s);

  // Returns [items seen, items kept] in the subtree.
  const walk = (node: unknown, depth: number): [number, number] => {
    if (depth > 60 || node === null || typeof node !== 'object') return [0, 0];
    let seen = 0;
    let kept = 0;
    if (Array.isArray(node)) {
      let w = 0;
      for (let i = 0; i < node.length; i++) {
        const el = node[i];
        const info = readItem(el);
        if (info !== undefined) {
          seen++;
          const v = info ? judge(info, s, cat, mode) : null;
          if (info && v?.reason) {
            res.hidden.push({ info, reason: v.reason });
            continue;
          }
          if (info) (v?.needsCategory ? res.pending : res.shown).push(info);
          kept++;
          node[w++] = el;
          continue;
        }
        const [s2, k2] = walk(el, depth + 1);
        seen += s2;
        kept += k2;
        if (s2 > 0 && k2 === 0 && isShelf(el)) continue;
        node[w++] = el;
      }
      node.length = w;
      return [seen, kept];
    }
    for (const k in node) {
      const [s2, k2] = walk((node as any)[k], depth + 1);
      seen += s2;
      kept += k2;
    }
    return [seen, kept];
  };

  try {
    walk(root, 0);
  } catch {
    // leave whatever was already processed; never break the page
  }
  return res;
}

function isShelf(el: unknown): boolean {
  if (typeof el !== 'object' || el === null) return false;
  for (const k in el) if (SHELVES.has(k)) return true;
  return false;
}

/** Every item in a tree, unfiltered. */
export function collect(node: unknown, out: VideoInfo[] = [], depth = 0): VideoInfo[] {
  if (depth > 60 || node === null || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const el of node) {
      const info = readItem(el);
      if (info) out.push(info);
      else if (info === undefined) collect(el, out, depth + 1);
    }
    return out;
  }
  for (const k in node) collect((node as any)[k], out, depth + 1);
  return out;
}

/** Which surface an InnerTube request belongs to. */
export function surfaceFor(endpoint: string, browseId: string | undefined, pathname: string): Surface {
  if (endpoint.endsWith('/search')) return 'search';
  if (endpoint.endsWith('/next')) return 'watch';
  if (browseId) {
    if (browseId === 'FEwhat_to_watch') return 'home';
    if (browseId === 'FEsubscriptions') return 'subs';
    if (browseId.startsWith('UC')) return 'channel';
    return 'other';
  }
  return surfaceForPath(pathname);
}

export function surfaceForPath(p: string): Surface {
  if (p === '/' || p === '') return 'home';
  if (p.startsWith('/results')) return 'search';
  if (p.startsWith('/watch')) return 'watch';
  if (p.startsWith('/feed/subscriptions')) return 'subs';
  if (/^\/(@|channel\/|c\/|user\/)/.test(p)) return 'channel';
  return 'other';
}
