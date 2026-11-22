# Sift

Sift your YouTube feed: by length, by YouTube's own category, by the topic chips
YouTube makes for you, and by named **modes** (Everyday, Travel, Learn, Chill...).
Zen / Firefox first; a Chromium build comes from the same code.

Proprietary, all rights reserved (see `LICENSE`). Every line is written here; no
code is copied from other extensions (BlockTube, SponsorBlock, ...), so it stays ours.

## How it works

- **Filters before YouTube draws anything.** `src/page/hook.ts` runs in YouTube's own
  page at `document_start`, catches `ytInitialData` as it is assigned and wraps
  `fetch()` for `/youtubei/v1/browse|search|next`. Unwanted items are removed from the
  JSON, so there is no flicker and no gaps. Shelves left empty are dropped; page
  structure (tabs, spinners) is never touched.
- **Fails open.** Unknown shapes, unknown categories, errors: the video is shown.
- **Categories** (YouTube's 15) are not in feed data. Order: local cache ->
  free from every watch page you open -> your own YouTube Data API key
  (Settings; 1 quota unit per 50 videos, capped at 8,000/day). A video whose
  category arrives after render is hidden with a CSS `:has()` rule, no DOM scanning.
- **YouTube topics:** the chips at the top of your home feed (Camping, Podcasts, ...)
  are read and listed in the popup. A mode can pick one; Sift selects that chip on
  Home for you (once per visit; your own click wins).
- **Never bundle a key.** The owner's key lives only in `.env.youtube` (git-ignored)
  and in the browser's extension storage after pasting it in Settings.

## Layout

| Path | What |
|---|---|
| `src/core/` | Pure logic, unit-tested: item reading (`extract.ts`), rules (`filter.ts`), settings, topics, categories |
| `src/page/hook.ts` | Runs in YouTube's page world: data hooks, CSS hiding, topic chip |
| `src/content/bridge.ts` | Content script: settings in, lookups out; validates everything |
| `src/background/index.ts` | Category cache + API lookups, toolbar badge |
| `src/ui/` | Popup + settings page (hand-made CSS, OKLCH tokens, light/dark, reduced motion) |
| `test/` | `node --test` on real YouTube JSON saved in `test/fixtures` (2026-11-22) |

## Commands

```
npm install
npm run check      # typecheck + tests + build + web-ext lint
npm run build      # dist/firefox (Zen/Firefox) and dist/chrome
npm run package    # artifacts/sift-<version>.zip for AMO
```

Try it in Zen: `about:debugging#/runtime/this-firefox` -> Load Temporary Add-on ->
`dist/firefox/manifest.json` (stays until Zen restarts). A permanent install needs an
AMO-signed build (`web-ext sign --channel unlisted`, keys in `../.env.amo`).

When YouTube changes its JSON: save a new page's `ytInitialData` into
`test/fixtures/`, run `npm test`, fix `src/core/extract.ts`.
