// Copyright (c) 2026 zerobun. All rights reserved.

/** Where on YouTube a list of videos is shown. */
export type Surface = 'home' | 'search' | 'watch' | 'subs' | 'channel' | 'other';

export type Kind = 'video' | 'short' | 'mix' | 'playlist';

/** What Sift knows about one feed item, read from YouTube's own data. */
export interface VideoInfo {
  id: string;
  kind: Kind;
  title: string;
  channel?: string;
  channelId?: string;
  /** Length in seconds. Missing for Shorts, live streams and playlists. */
  seconds?: number;
  live: boolean;
  upcoming: boolean;
  members: boolean;
  /** Percent already watched, 0-100. Missing when never started. */
  watched?: number;
}

/** A named set of rules, e.g. "Travel" or "Learn". */
export interface Mode {
  id: string;
  name: string;
  /** Accent hue (0-360) for the mode's chip. */
  hue: number;
  minSec: number;
  /** 0 = no upper limit. */
  maxSec: number;
  /** YouTube category ids to keep. Empty = every category. */
  include: number[];
  /** YouTube category ids to drop. */
  exclude: number[];
  hideShorts: boolean;
  hideLive: boolean;
  hideUpcoming: boolean;
  hideMixes: boolean;
  hideMembers: boolean;
  /** Hide videos watched at least this percent. 0 = off. */
  hideWatchedAt: number;
  /** Hide titles containing any of these (case-insensitive). */
  words: string[];
  /** Your own topic: keep only titles containing one of these. Empty = off. */
  keep: string[];
  /** One of YouTube's own home-feed topic chips to select automatically. '' = none. */
  topic: string;
}

export interface Settings {
  v: 1;
  enabled: boolean;
  modeId: string;
  modes: Mode[];
  /** Channel ids (UC...) or names, lower-cased for names. */
  blockChannels: string[];
  /** Always shown, whatever the mode says. */
  allowChannels: string[];
  surfaces: Record<Surface, boolean>;
  /** Small "N hidden" chip on YouTube pages; click it to see what was hidden and why. */
  showChip: boolean;
}

export type Reason =
  | 'channel'
  | 'short'
  | 'mix'
  | 'live'
  | 'upcoming'
  | 'members'
  | 'watched'
  | 'too-short'
  | 'too-long'
  | 'word'
  | 'keep'
  | 'no-length'
  | 'category';

/** Result of judging one item: why it goes, or null when it stays. */
export interface Verdict {
  reason: Reason | null;
  /** True when a category rule applies but the category is not known yet. */
  needsCategory: boolean;
}
