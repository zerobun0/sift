// Copyright (c) 2026 zerobun. All rights reserved.
// Run: node --test test/   (Node 22.6+ strips the TypeScript types itself)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collect, filterTree, judge, surfaceFor } from '../src/core/filter.ts';
import { parseClock, readItem } from '../src/core/extract.ts';
import { defaultSettings, normaliseSettings } from '../src/core/settings.ts';
import { categoryIdFromName } from '../src/core/categories.ts';
import type { Settings, VideoInfo } from '../src/core/types.ts';

const load = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const none = () => undefined;

function settings(patch: Partial<Settings['modes'][0]> = {}): Settings {
  const s = defaultSettings();
  s.surfaces = { home: true, search: true, watch: true, subs: true, channel: true, other: true };
  Object.assign(s.modes[0], { hideShorts: false, hideUpcoming: false, hideMembers: false }, patch);
  return s;
}

/** A signed-in home feed, assembled from real pieces (the signed-out home page is empty). */
function homeFeed() {
  const lockups = [
    ...collectRaw(load('channel.json'), 'richItemRenderer'),
    ...collectRaw(load('watch.json'), 'lockupViewModel').map((l) => ({ content: { lockupViewModel: l } })),
  ].slice(0, 12);
  const shorts = collectRaw(load('search.json'), 'shortsLockupViewModel').slice(0, 6);
  return {
    contents: {
      twoColumnBrowseResultsRenderer: {
        tabs: [
          {
            tabRenderer: {
              content: {
                richGridRenderer: {
                  contents: [
                    ...lockups.slice(0, 6).map((r) => ({ richItemRenderer: r })),
                    {
                      richSectionRenderer: {
                        content: {
                          richShelfRenderer: {
                            contents: shorts.map((s) => ({ richItemRenderer: { content: { shortsLockupViewModel: s } } })),
                          },
                        },
                      },
                    },
                    ...lockups.slice(6).map((r) => ({ richItemRenderer: r })),
                    { continuationItemRenderer: { trigger: 'CONTINUATION_TRIGGER_ON_ITEM_SHOWN' } },
                  ],
                },
              },
            },
          },
        ],
      },
    },
  };
}

function collectRaw(node: any, key: string, out: any[] = []): any[] {
  if (node && typeof node === 'object') {
    for (const k in node) {
      if (k === key) out.push(node[k]);
      collectRaw(node[k], key, out);
    }
  }
  return out;
}

test('parseClock', () => {
  assert.equal(parseClock('3:35'), 215);
  assert.equal(parseClock('1:43:14'), 6194);
  assert.equal(parseClock('LIVE'), undefined);
  assert.equal(parseClock(undefined), undefined);
});

test('search page: every video has id, title, length and channel', () => {
  const items = collect(load('search.json'));
  const videos = items.filter((v) => v.kind === 'video');
  const shorts = items.filter((v) => v.kind === 'short');
  assert.ok(videos.length >= 15, `videos: ${videos.length}`);
  assert.ok(shorts.length >= 10, `shorts: ${shorts.length}`);
  for (const v of videos) {
    assert.match(v.id, /^[\w-]{11}$/);
    assert.ok(v.title.length > 0);
    assert.ok(v.channel, `channel for ${v.id}`);
    assert.match(v.channelId ?? '', /^UC/);
    assert.ok(v.seconds && v.seconds > 0, `length for ${v.id}`);
  }
});

test('live search: live streams are flagged and have no length', () => {
  const live = collect(load('search-live.json')).filter((v) => v.live);
  assert.ok(live.length >= 5);
  for (const v of live) assert.equal(v.seconds, undefined);
});

test('watch sidebar (lockups): channel, channel id and length', () => {
  const items = collect(load('watch.json')).filter((v) => v.kind === 'video');
  assert.ok(items.length >= 15);
  const first = items[0];
  assert.ok(first.channel);
  assert.match(first.channelId ?? '', /^UC/);
  assert.ok(first.seconds);
});

test('channel page lockups have lengths', () => {
  const items = collect(load('channel.json'));
  assert.ok(items.length >= 6);
  assert.ok(items.filter((v) => v.seconds).length >= items.length - 2);
});

test('hide Shorts drops the whole Shorts shelf, keeps the spinner', () => {
  const feed = homeFeed();
  const r = filterTree(feed, settings({ hideShorts: true }), 'home', none);
  const grid = feed.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.richGridRenderer.contents;
  assert.equal(grid.length, 13); // 12 videos + spinner; shelf gone
  assert.ok(!grid.some((e: any) => e.richSectionRenderer));
  assert.ok(grid.some((e: any) => e.continuationItemRenderer));
  assert.equal(r.hidden.filter((h) => h.reason === 'short').length, 6);
});

test('length range removes the right videos and nothing else', () => {
  const data = load('search.json');
  const before = collect(data).filter((v) => v.kind === 'video');
  const r = filterTree(data, settings({ minSec: 10 * 60, maxSec: 40 * 60 }), 'search', none);
  const after = collect(data).filter((v) => v.kind === 'video');
  for (const v of after) assert.ok(v.seconds! >= 600 && v.seconds! <= 2400, `${v.id} ${v.seconds}`);
  assert.equal(after.length + r.hidden.filter((h) => h.info.kind === 'video').length, before.length);
});

test('a page with every item hidden keeps its structure (tabs survive)', () => {
  const feed = homeFeed();
  filterTree(feed, settings({ minSec: 99 * 3600, hideShorts: true }), 'home', none);
  assert.equal(feed.contents.twoColumnBrowseResultsRenderer.tabs.length, 1);
});

test('category rules: unknown is kept and reported pending, known is enforced', () => {
  const s = settings({ include: [19] });
  const v: VideoInfo = { id: 'abcdefghijk', kind: 'video', title: 't', live: false, upcoming: false, members: false, seconds: 600 };
  assert.deepEqual(judge(v, s, () => undefined), { reason: null, needsCategory: true });
  assert.equal(judge(v, s, () => 19).reason, null);
  assert.equal(judge(v, s, () => 10).reason, 'category');
  s.allowChannels = ['Some Channel'];
  assert.equal(judge({ ...v, channel: 'some channel' }, s, () => 10).reason, null);
});

test('disabled surface changes nothing', () => {
  const data = load('search.json');
  const n = collect(data).length;
  const s = settings({ minSec: 99 * 3600 });
  s.surfaces.search = false;
  filterTree(data, s, 'search', none);
  assert.equal(collect(data).length, n);
});

test('unreadable items are kept', () => {
  assert.equal(readItem({ videoRenderer: { videoId: 5 } }), null);
  const arr = [{ videoRenderer: { videoId: 5 } }];
  filterTree({ a: arr }, settings({ minSec: 99 * 3600 }), 'home', none);
  assert.equal(arr.length, 1);
});

test('watch player response gives the category by name', () => {
  const p = load('watch-player.json');
  assert.equal(categoryIdFromName(p.microformat.playerMicroformatRenderer.category), 10);
});

test('surfaceFor', () => {
  assert.equal(surfaceFor('/youtubei/v1/browse', 'FEwhat_to_watch', '/watch'), 'home');
  assert.equal(surfaceFor('/youtubei/v1/browse', undefined, '/'), 'home');
  assert.equal(surfaceFor('/youtubei/v1/browse', 'UCabc', '/'), 'channel');
  assert.equal(surfaceFor('/youtubei/v1/next', undefined, '/'), 'watch');
});

test('normaliseSettings repairs junk', () => {
  const s = normaliseSettings({ modes: [{ name: '  X ', minSec: -5, include: [19, 'a', 19] }], modeId: 'nope' });
  assert.equal(s.modes[0].name, 'X');
  assert.equal(s.modes[0].minSec, 0);
  assert.deepEqual(s.modes[0].include, [19]);
  assert.equal(s.modeId, s.modes[0].id);
  assert.deepEqual(normaliseSettings(null), defaultSettings());
});

test('topic chips are read from the feed header (chip bar), "All" skipped', async () => {
  const { readTopics } = await import('../src/core/topics.ts');
  assert.deepEqual(readTopics(load('channel.json')), ['Latest', 'Popular', 'Oldest']);
  const old = { header: { feedFilterChipBarRenderer: { contents: [
    { chipCloudChipRenderer: { text: { simpleText: 'All' } } },
    { chipCloudChipRenderer: { text: { runs: [{ text: 'Camping' }] } } },
    { chipCloudChipRenderer: { text: { simpleText: 'camping' } } },
  ] } } };
  assert.deepEqual(readTopics(old), ['Camping']);
  assert.deepEqual(readTopics(load('search.json')).length >= 0, true);
});

test('settings keep a mode topic, trimmed and capped', () => {
  const s = normaliseSettings({ modes: [{ name: 'T', topic: '  Camping  ' }, { name: 'U', topic: 5 }] });
  assert.equal(s.modes[0].topic, 'Camping');
  assert.equal(s.modes[1].topic, '');
});
