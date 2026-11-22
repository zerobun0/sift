# Sift - project context for Claude

Proprietary YouTube feed filter extension (all rights reserved, public source on github.com/zerobun0/sift).
**Zen/Firefox first**, Chrome build on GitHub only (no Chrome Web Store). Owner: zerobun.

Start of every chat: read `TODO.md` then `HANDOFF.md`. End: update both, commit, push.

## Rules
- Write every line ourselves. Never copy code from BlockTube, SponsorBlock or any other extension.
- Never bundle or commit an API key. `.env.youtube` (owner's YouTube Data API key) and `.env.amo` (Mozilla signing
  key) are git-ignored, owner-only ACL. Users paste their own YouTube key in Settings; it's optional (categories only).
- Fail open: unknown data = show the video. Never break YouTube's page structure.
- Popup must stay <= 600 px tall (Firefox limit). UI: hand-made, OKLCH tokens in `src/ui/base.css`, light/dark,
  reduced motion; no browser-default controls.
- Every release carries install steps for BOTH browsers (`scripts/release-notes.md` template).
- Don't hammer YouTube with automated tests: it rate-limits (429 + challenge) this PC.

## Commands
- `npm run check` = typecheck + 20 tests (real YouTube JSON in `test/fixtures`) + build + `web-ext lint`.
- Try in Zen: `about:debugging` -> Load Temporary Add-on -> `dist/firefox/manifest.json`.
- Release: write `CHANGES` ("- " lines), bump `version` in package.json, `sh scripts/release.sh`
  (signs unlisted on AMO with update_url, Chrome zip, updates.json, GitHub release). If signing ends "fetch failed",
  the upload went through: `node scripts/fetch-signed.mjs artifacts/sift-<v>.xpi`.
- AMO version numbers are single-use across channels. Public (listed) AMO builds must NOT contain update_url
  (build without `SIFT_SELF=1`), metadata in `amo-metadata.json`, upload source with `git archive`.

## Architecture (short)
- `src/page/hook.ts` runs in YouTube's page world at document_start: traps `ytInitialData`/`ytInitialPlayerResponse`,
  wraps `fetch` for `/youtubei/v1/browse|search|next|player`, filters JSON before render, refills thin feeds
  (`src/core/refill.ts`), clicks YouTube topic chips, renders the "N hidden" chip (`chip.ts`, closed shadow root),
  hides late category answers with one `:has()` CSS rule.
- `src/content/bridge.ts` isolated world: settings in (mirrored to localStorage for sync reads), lookups/stats out; validates all.
- `src/background/index.ts`: category cache + YouTube API (8,000 units/day cap), badge, 90-day local history,
  Chrome-only update check (GitHub latest release, 12 h).
- `src/core/*`: pure logic, tested. Item readers for videoRenderer/compact/grid, lockupViewModel, shortsLockupViewModel,
  reel, radio. When YouTube changes shapes: save a fresh page into `test/fixtures`, fix `extract.ts`.
- `.github/workflows/ci.yml` (check on push), `amo-link.yml` (daily: adds the AMO link to README once the listing is public).
