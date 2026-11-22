// Copyright (c) 2026 zerobun. All rights reserved.
// One handle for the WebExtension API: `browser` in Firefox/Zen, `chrome` in Chromium (both promise-based in MV3).

declare const browser: any;
declare const chrome: any;

export const ext: any = typeof browser !== 'undefined' ? browser : chrome;

import { normaliseSettings } from './settings.ts';
import type { Settings } from './types.ts';

export async function loadSettings(): Promise<Settings> {
  const { settings } = await ext.storage.local.get('settings');
  return normaliseSettings(settings);
}

export async function saveSettings(s: Settings): Promise<void> {
  await ext.storage.local.set({ settings: normaliseSettings(s) });
}
