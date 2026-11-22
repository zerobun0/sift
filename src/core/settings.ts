// Copyright (c) 2026 zerobun. All rights reserved.

import type { Mode, Settings, Surface } from './types.ts';

const base: Omit<Mode, 'id' | 'name' | 'hue'> = {
  minSec: 0,
  maxSec: 0,
  include: [],
  exclude: [],
  hideShorts: true,
  hideLive: false,
  hideUpcoming: true,
  hideMixes: false,
  hideMembers: true,
  hideWatchedAt: 0,
  words: [],
  keep: [],
  topic: '',
};

export const DEFAULT_MODES: Mode[] = [
  { ...base, id: 'everyday', name: 'Everyday', hue: 160 },
  { ...base, id: 'travel', name: 'Travel', hue: 32, minSec: 8 * 60, maxSec: 60 * 60, include: [19, 22, 15] },
  { ...base, id: 'learn', name: 'Learn', hue: 215, minSec: 5 * 60, include: [27, 28, 26, 25], hideMixes: true },
  { ...base, id: 'chill', name: 'Chill', hue: 300, include: [23, 24, 10, 20, 1], hideShorts: false },
];

export const SURFACES: Surface[] = ['home', 'search', 'watch', 'subs', 'channel', 'other'];

export function defaultSettings(): Settings {
  return {
    v: 1,
    enabled: true,
    modeId: 'everyday',
    modes: structuredClone(DEFAULT_MODES),
    blockChannels: [],
    allowChannels: [],
    surfaces: { home: true, search: true, watch: true, subs: false, channel: false, other: false },
    showChip: true,
  };
}

const num = (x: unknown, lo: number, hi: number, dflt: number) =>
  typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : dflt;
const bool = (x: unknown, dflt: boolean) => (typeof x === 'boolean' ? x : dflt);
const ids = (x: unknown) => (Array.isArray(x) ? [...new Set(x.filter((n) => Number.isInteger(n) && n > 0))] : []);
const strs = (x: unknown) =>
  Array.isArray(x) ? [...new Set(x.filter((s) => typeof s === 'string').map((s) => s.trim()).filter(Boolean))] : [];

function normaliseMode(m: any, i: number): Mode {
  const d = DEFAULT_MODES[i] ?? { ...base, id: `mode-${i}`, name: 'Mode', hue: 160 };
  return {
    id: typeof m?.id === 'string' && m.id ? m.id.slice(0, 40) : d.id,
    name: typeof m?.name === 'string' && m.name.trim() ? m.name.trim().slice(0, 24) : d.name,
    hue: num(m?.hue, 0, 360, d.hue),
    minSec: num(m?.minSec, 0, 24 * 3600, 0),
    maxSec: num(m?.maxSec, 0, 24 * 3600, 0),
    include: ids(m?.include),
    exclude: ids(m?.exclude),
    hideShorts: bool(m?.hideShorts, d.hideShorts),
    hideLive: bool(m?.hideLive, d.hideLive),
    hideUpcoming: bool(m?.hideUpcoming, d.hideUpcoming),
    hideMixes: bool(m?.hideMixes, d.hideMixes),
    hideMembers: bool(m?.hideMembers, d.hideMembers),
    hideWatchedAt: num(m?.hideWatchedAt, 0, 100, 0),
    words: strs(m?.words).map((w) => w.toLowerCase()),
    keep: strs(m?.keep).map((w) => w.toLowerCase()),
    topic: typeof m?.topic === 'string' ? m.topic.trim().slice(0, 40) : '',
  };
}

/** Accepts anything (old versions, hand-edited JSON) and returns valid settings. */
export function normaliseSettings(raw: unknown): Settings {
  const d = defaultSettings();
  if (typeof raw !== 'object' || raw === null) return d;
  const r = raw as any;
  const modes = Array.isArray(r.modes) && r.modes.length ? r.modes.slice(0, 12).map(normaliseMode) : d.modes;
  const modeId = modes.some((m: Mode) => m.id === r.modeId) ? r.modeId : modes[0].id;
  const surfaces = { ...d.surfaces };
  for (const s of SURFACES) surfaces[s] = bool(r.surfaces?.[s], d.surfaces[s]);
  return {
    v: 1,
    enabled: bool(r.enabled, true),
    modeId,
    modes,
    blockChannels: strs(r.blockChannels),
    allowChannels: strs(r.allowChannels),
    surfaces,
    showChip: bool(r.showChip, true),
  };
}

export function activeMode(s: Settings): Mode {
  return s.modes.find((m) => m.id === s.modeId) ?? s.modes[0];
}
