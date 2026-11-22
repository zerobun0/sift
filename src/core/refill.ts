// Copyright (c) 2026 zerobun. All rights reserved.
//
// Refill: when filtering leaves a feed page nearly empty, YouTube shows grey
// placeholders and may stop loading. Sift then asks for the next page itself
// (the same request YouTube makes when you scroll) and appends what passes.

import { findAll, readItem } from './extract.ts';

const isObj = (x: unknown): x is Record<string, any> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** The list of feed items that ends in a "load more" entry, or null. */
export function continuationList(data: unknown): unknown[] | null {
  if (!isObj(data)) return null;
  const candidates: unknown[][] = [];
  for (const a of data.onResponseReceivedActions ?? data.onResponseReceivedCommands ?? []) {
    const items = a?.appendContinuationItemsAction?.continuationItems ?? a?.reloadContinuationItemsCommand?.continuationItems;
    if (Array.isArray(items)) candidates.push(items);
  }
  for (const c of findAll(data, 'richGridRenderer', 14) as any[]) if (Array.isArray(c?.contents)) candidates.push(c.contents);
  for (const list of candidates) {
    const last = list[list.length - 1];
    if (isObj(last) && last.continuationItemRenderer) return list;
  }
  return null;
}

/** The token that loads the next page, from a list's last entry. */
export function nextToken(list: unknown[]): string | undefined {
  const last = list[list.length - 1];
  if (!isObj(last) || !last.continuationItemRenderer) return undefined;
  const t = findAll(last.continuationItemRenderer, 'token', 8).find((x) => typeof x === 'string');
  return t as string | undefined;
}

/** Feed items in a list, counting the ones inside shelves too. */
export function countItems(list: unknown[]): number {
  let n = 0;
  const walk = (node: unknown, depth: number) => {
    if (depth > 30 || node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const el of node) {
        if (readItem(el) !== undefined) n++;
        else walk(el, depth + 1);
      }
      return;
    }
    for (const k in node) walk((node as any)[k], depth + 1);
  };
  walk(list, 0);
  return n;
}

/** Appends `next`'s items in place of `list`'s trailing "load more" entry. */
export function appendPage(list: unknown[], next: unknown[] | null): void {
  list.pop();
  if (next) list.push(...next);
}

export const REFILL_TARGET = 12;
export const REFILL_MAX_PAGES = 6;
