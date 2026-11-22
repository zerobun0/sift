// Copyright (c) 2026 zerobun. All rights reserved.

/** YouTube's own video categories (the ones a creator can pick on upload). */
export const CATEGORIES: ReadonlyArray<{ id: number; name: string; short: string }> = [
  { id: 1, name: 'Film & Animation', short: 'Film' },
  { id: 2, name: 'Autos & Vehicles', short: 'Autos' },
  { id: 10, name: 'Music', short: 'Music' },
  { id: 15, name: 'Pets & Animals', short: 'Animals' },
  { id: 17, name: 'Sports', short: 'Sports' },
  { id: 19, name: 'Travel & Events', short: 'Travel' },
  { id: 20, name: 'Gaming', short: 'Gaming' },
  { id: 22, name: 'People & Blogs', short: 'Vlogs' },
  { id: 23, name: 'Comedy', short: 'Comedy' },
  { id: 24, name: 'Entertainment', short: 'Entertainment' },
  { id: 25, name: 'News & Politics', short: 'News' },
  { id: 26, name: 'Howto & Style', short: 'How-to' },
  { id: 27, name: 'Education', short: 'Education' },
  { id: 28, name: 'Science & Technology', short: 'Science & Tech' },
  { id: 29, name: 'Nonprofits & Activism', short: 'Causes' },
];

const BY_NAME = new Map(CATEGORIES.map((c) => [c.name.toLowerCase(), c.id]));
// The watch page spells two of them differently from the Data API.
BY_NAME.set('science & technology', 28);
BY_NAME.set('science and technology', 28);
BY_NAME.set('howto & style', 26);
BY_NAME.set('travel & events', 19);

/** Category id from the name shown in a watch page's microformat, or undefined. */
export function categoryIdFromName(name: unknown): number | undefined {
  if (typeof name !== 'string') return undefined;
  return BY_NAME.get(name.trim().toLowerCase());
}

export function categoryName(id: number): string {
  return CATEGORIES.find((c) => c.id === id)?.short ?? `#${id}`;
}
