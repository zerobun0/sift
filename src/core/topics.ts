// Copyright (c) 2026 zerobun. All rights reserved.
//
// YouTube's own topic chips ("All", "Camping", "Podcasts", ...) at the top of the
// home feed. They are personal (YouTube picks them from your history), and
// choosing one makes YouTube itself fetch a feed on that topic, which no local
// classifier can beat. Sift reads their labels so a mode can ask for one.

import { text } from './extract.ts';

/** Chips that are not topics. */
const NOT_TOPICS = new Set(['all']);

/** Chip labels from a feed page's header, in YouTube's order. Empty when there are none. */
export function readTopics(data: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (label: string) => {
    const t = label.trim();
    const k = t.toLowerCase();
    if (t && t.length <= 40 && !NOT_TOPICS.has(k) && !seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  };
  const walk = (node: any, depth: number, inBar: boolean) => {
    if (depth > 40 || node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const v of node) walk(v, depth + 1, inBar);
      return;
    }
    for (const k in node) {
      const v = node[k];
      if (inBar && k === 'chipViewModel' && v) add(text(v.text));
      else if (inBar && k === 'chipCloudChipRenderer' && v) add(text(v.text));
      else walk(v, depth + 1, inBar || k === 'chipBarViewModel' || k === 'feedFilterChipBarRenderer');
    }
  };
  try {
    walk(data, 0, false);
  } catch {
    return [];
  }
  return out.slice(0, 30);
}
