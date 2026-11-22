// Copyright (c) 2026 zerobun. All rights reserved.
import type { Reason } from './types.ts';

export const REASON_LABEL: Record<Reason, string> = {
  channel: 'blocked channel',
  short: 'Shorts',
  mix: 'mixes',
  live: 'live',
  upcoming: 'upcoming',
  members: 'members-only',
  watched: 'watched',
  'too-short': 'too short',
  'too-long': 'too long',
  word: 'title words',
  keep: 'not your topic words',
  'no-length': 'no set length (live, course, playlist)',
  category: 'category',
};
