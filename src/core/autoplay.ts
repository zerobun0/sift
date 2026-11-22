// Copyright (c) 2026 zerobun. All rights reserved.
//
// The watch page names its "Up next" video in two places outside the sidebar list:
// contents.twoColumnWatchNextResults.autoplay (what autoplay opens) and
// playerOverlays.playerOverlayRenderer.autoplay (the countdown card). When that video is
// one Sift hid, point both at the first video Sift kept. With nothing to swap in,
// drop them so autoplay stops instead of opening a hidden video.
// Unknown video (not in the sidebar) = left alone (fail open).

import type { VideoInfo } from './types.ts';

export type AutoplayResult = 'none' | 'kept' | 'swapped' | 'removed';

const text = (s: string) => ({ simpleText: s });

export function fixAutoplay(data: unknown, isHidden: (id: string) => boolean, replacement: VideoInfo | undefined): AutoplayResult {
  try {
    const d = data as any;
    const twoCol = d?.contents?.twoColumnWatchNextResults;
    const overlay = d?.playerOverlays?.playerOverlayRenderer;
    const sets: any[] | undefined = twoCol?.autoplay?.autoplay?.sets;
    const card = overlay?.autoplay?.playerOverlayAutoplayRenderer;
    const id: unknown = sets?.[0]?.autoplayVideo?.watchEndpoint?.videoId ?? card?.videoId;
    if (typeof id !== 'string') return 'none';
    if (!isHidden(id)) return 'kept';

    if (!replacement || replacement.kind !== 'video') {
      if (twoCol?.autoplay) delete twoCol.autoplay;
      if (overlay?.autoplay) delete overlay.autoplay;
      return 'removed';
    }
    const v = replacement;
    const url = '/watch?v=' + v.id;
    const endpoint = {
      commandMetadata: { webCommandMetadata: { url, webPageType: 'WEB_PAGE_TYPE_WATCH', rootVe: 3832 } },
      watchEndpoint: { videoId: v.id },
    };
    for (const s of sets ?? []) {
      if (s?.autoplayVideo) s.autoplayVideo = { ...endpoint };
      if (s?.nextButtonVideo) s.nextButtonVideo = { ...endpoint };
      if (s?.previousButtonVideo) delete s.previousButtonVideo;
    }
    if (card) {
      card.videoId = v.id;
      card.videoTitle = text(v.title);
      if (v.channel) card.byline = { runs: [{ text: v.channel }] };
      delete card.publishedTimeText;
      delete card.shortViewCountText;
      delete card.thumbnailOverlays;
      card.background = { thumbnails: [{ url: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, width: 480, height: 360 }] };
      const next = card.nextButton?.buttonRenderer;
      if (next) next.navigationEndpoint = { ...endpoint };
    }
    return 'swapped';
  } catch {
    return 'none';
  }
}
