// Copyright (c) 2026 zerobun. All rights reserved.
//
// Reads a feed item out of YouTube's JSON. YouTube uses several shapes for the
// same thing (old "renderers" on search, newer "lockup view models" on home,
// channel pages and the watch sidebar). Everything here is defensive: a field
// that moved yields `undefined`, never an exception, and the item is then shown.

import type { Kind, VideoInfo } from './types.ts';

type Obj = Record<string, any>;

const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);

/** "1:43:14" -> 6194. Anything that is not a clock reading -> undefined. */
export function parseClock(text: unknown): number | undefined {
  if (typeof text !== 'string') return undefined;
  const t = text.trim();
  if (!/^\d{1,3}(:\d{2}){1,2}$/.test(t)) return undefined;
  return t.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
}

/** Text from either {simpleText} or {runs:[{text}]} or {content}. */
export function text(node: unknown): string {
  if (typeof node === 'string') return node;
  if (!isObj(node)) return '';
  if (typeof node.simpleText === 'string') return node.simpleText;
  if (typeof node.content === 'string') return node.content;
  if (Array.isArray(node.runs)) return node.runs.map((r: Obj) => r?.text ?? '').join('');
  return '';
}

/** Depth-limited search for every value stored under `key`. */
export function findAll(node: unknown, key: string, maxDepth = 12, out: unknown[] = []): unknown[] {
  if (maxDepth < 0 || node === null || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const v of node) findAll(v, key, maxDepth - 1, out);
    return out;
  }
  for (const k in node) {
    const v = (node as Obj)[k];
    if (k === key) out.push(v);
    if (v !== null && typeof v === 'object') findAll(v, key, maxDepth - 1, out);
  }
  return out;
}

function firstChannelId(node: unknown): string | undefined {
  for (const id of findAll(node, 'browseId', 14)) {
    if (typeof id === 'string' && id.startsWith('UC')) return id;
  }
  return undefined;
}

function hasMembersBadge(node: unknown): boolean {
  for (const style of findAll(node, 'style', 10)) {
    if (style === 'BADGE_STYLE_TYPE_MEMBERS_ONLY') return true;
  }
  for (const label of findAll(node, 'label', 10)) {
    if (typeof label === 'string' && /^members (only|first)$/i.test(label)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- renderers

function fromVideoRenderer(r: Obj): VideoInfo | null {
  const id = r.videoId;
  if (typeof id !== 'string') return null;
  const owner = r.ownerText ?? r.shortBylineText ?? r.longBylineText;
  let seconds = parseClock(text(r.lengthText));
  let live = false;
  let upcoming = !!r.upcomingEventData;
  let short = !!r.navigationEndpoint?.reelWatchEndpoint;
  let watched: number | undefined;
  for (const o of Array.isArray(r.thumbnailOverlays) ? r.thumbnailOverlays : []) {
    const ts = o?.thumbnailOverlayTimeStatusRenderer;
    if (ts) {
      if (ts.style === 'LIVE') live = true;
      else if (ts.style === 'SHORTS') short = true;
      else if (ts.style === 'UPCOMING') upcoming = true;
      seconds ??= parseClock(text(ts.text));
    }
    const resume = o?.thumbnailOverlayResumePlaybackRenderer;
    if (resume && typeof resume.percentDurationWatched === 'number') watched = resume.percentDurationWatched;
  }
  for (const b of Array.isArray(r.badges) ? r.badges : []) {
    const style = b?.metadataBadgeRenderer?.style;
    if (style === 'BADGE_STYLE_TYPE_LIVE_NOW') live = true;
  }
  return {
    id,
    kind: short ? 'short' : 'video',
    title: text(r.title),
    channel: text(owner) || undefined,
    channelId: firstChannelId(owner),
    seconds: live || short ? undefined : seconds,
    live,
    upcoming,
    members: hasMembersBadge(r.badges),
    watched,
  };
}

function fromLockup(r: Obj): VideoInfo | null {
  const id = r.contentId;
  if (typeof id !== 'string') return null;
  const md = r.metadata?.lockupMetadataViewModel ?? {};
  const title = text(md.title);
  const type = String(r.contentType ?? '');
  let kind: Kind = type.endsWith('_VIDEO') ? 'video' : 'playlist';

  let seconds: number | undefined;
  let live = false;
  let upcoming = false;
  for (const b of findAll(r.contentImage, 'thumbnailBadgeViewModel', 10) as Obj[]) {
    const t = String(b?.text ?? '');
    const style = String(b?.badgeStyle ?? '');
    if (style.includes('LIVE') || /^(live|station|premiere|live now)$/i.test(t)) live = true;
    else if (/^(upcoming|premiere)/i.test(t)) upcoming = true;
    else if (/^mix$/i.test(t)) kind = 'mix';
    seconds ??= parseClock(t);
  }
  if (kind === 'playlist' && /^mix\b/i.test(title)) kind = 'mix';

  let watched: number | undefined;
  for (const p of findAll(r.contentImage, 'thumbnailOverlayProgressBarViewModel', 10) as Obj[]) {
    if (typeof p?.startPercent === 'number') watched = p.startPercent;
  }

  // Rows: [channel] [views, age] on home and the sidebar; just [views, age] on a channel's own page.
  const rows: Obj[] = md.metadata?.contentMetadataViewModel?.metadataRows ?? [];
  let channel: string | undefined;
  if (rows.length >= 2) channel = text(rows[0]?.metadataParts?.[0]?.text) || undefined;

  return {
    id,
    kind,
    title,
    channel,
    channelId: firstChannelId(md),
    seconds: live ? undefined : seconds,
    live,
    upcoming,
    members: hasMembersBadge(md),
    watched,
  };
}

function fromShortsLockup(r: Obj): VideoInfo | null {
  const id =
    r.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId ??
    (typeof r.entityId === 'string' ? r.entityId.replace(/^shorts-shelf-item-/, '') : undefined);
  if (typeof id !== 'string') return null;
  return {
    id,
    kind: 'short',
    title: text(r.overlayMetadata?.primaryText),
    live: false,
    upcoming: false,
    members: false,
  };
}

function fromReelItem(r: Obj): VideoInfo | null {
  if (typeof r.videoId !== 'string') return null;
  return { id: r.videoId, kind: 'short', title: text(r.headline), live: false, upcoming: false, members: false };
}

function fromRadio(r: Obj): VideoInfo | null {
  const id = r.playlistId;
  if (typeof id !== 'string') return null;
  return { id, kind: 'mix', title: text(r.title), live: false, upcoming: false, members: false };
}

const READERS: Record<string, (r: Obj) => VideoInfo | null> = {
  videoRenderer: fromVideoRenderer,
  compactVideoRenderer: fromVideoRenderer,
  gridVideoRenderer: fromVideoRenderer,
  lockupViewModel: fromLockup,
  shortsLockupViewModel: fromShortsLockup,
  reelItemRenderer: fromReelItem,
  radioRenderer: fromRadio,
  compactRadioRenderer: fromRadio,
};

/** Wrappers that hold exactly one item. */
const WRAPPERS = ['richItemRenderer'];

/**
 * If `el` (one element of a YouTube list) is a single feed item, read it.
 * Returns undefined when `el` is not an item at all (a shelf, a header, a spinner...).
 */
export function readItem(el: unknown): VideoInfo | null | undefined {
  if (!isObj(el)) return undefined;
  let node: Obj = el;
  for (const w of WRAPPERS) {
    if (isObj(node[w])) {
      const content = node[w].content;
      if (!isObj(content)) return undefined;
      node = content;
    }
  }
  for (const key in node) {
    const reader = READERS[key];
    if (reader && isObj(node[key])) {
      try {
        return reader(node[key]);
      } catch {
        return null; // unreadable item: shown, never hidden
      }
    }
  }
  return undefined;
}
