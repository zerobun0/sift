// Copyright (c) 2026 zerobun. All rights reserved.
//
// Messages between the page hook (runs in YouTube's own JS world), the bridge
// (content script) and the background. Page <-> bridge travel as JSON strings in
// CustomEvents, so nothing crosses the world boundary as a live object.

import type { Reason, Settings, Surface } from './types.ts';

export const LS_SETTINGS = 'sift.settings';
export const LS_CATS = 'sift.cats';
export const EV_TO_EXT = 'sift:to-ext';
export const EV_TO_PAGE = 'sift:to-page';

export interface PageStats {
  surface: Surface;
  mode: string;
  hue: number;
  shown: number;
  hidden: number;
  pending: number;
  byReason: Partial<Record<Reason, number>>;
  /** Removed before render, but the current rules would now show them: a reload brings them back. */
  reloadable: number;
}

export type PageToExt =
  | { t: 'lookup'; ids: string[] }
  | { t: 'learn'; cats: Record<string, number> }
  | { t: 'stats'; stats: PageStats }
  | { t: 'topics'; topics: string[] }
  | { t: 'tally'; shown: number; reasons: Record<string, number> }
  | { t: 'opened'; id: string; cat: number }
  | { t: 'allow'; channel: string }
  | { t: 'hello' };

export type ExtToPage = { t: 'settings'; settings: Settings } | { t: 'cats'; cats: Record<string, number> };

export type ToBackground =
  | { t: 'lookup'; ids: string[] }
  | { t: 'learn'; cats: Record<string, number> }
  | { t: 'stats'; stats: PageStats }
  | { t: 'topics'; topics: string[] }
  | { t: 'tally'; shown: number; reasons: Record<string, number> }
  | { t: 'opened'; id: string; cat: number }
  | { t: 'test-key'; key: string }
  | { t: 'check-update' };

export const VIDEO_ID = /^[\w-]{11}$/;
