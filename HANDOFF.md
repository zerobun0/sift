# Handoff (2026-11-22)

Moved out of `home-lab/browser/sift` into its own project today. History lives in git; the original design plan is
`docs/plan-2026-11-22.md`.

**State:** 0.2.2 is the latest GitHub release (signed .xpi self-updates in Zen/Firefox; Chrome zip shows an update
notice). Owner runs it in Zen and is happy with it. Public AMO listing (0.2.1) is in Mozilla review; the `amo-link`
Action finishes that step alone.

**Next:** release 0.2.3 (autoplay fix + header update pill, code in 14cda55) and submit it listed to AMO as 0.2.4; steps in TODO.md REL-023. Then done. Keys: `.env.youtube`, `.env.amo` (both here,
git-ignored, owner-only).

**Gotchas learned:** web-ext sign often dies with "fetch failed" while waiting (upload is fine, fetch the file via API).
YouTube 429s this PC after many automated runs. Chromium + `--load-extension` (playwright-core, `--headless=new`) is the
automated test vehicle; headless Zen (`web-ext run --firefox "C:/Program Files/Zen Browser/zen.exe" --arg=-headless`)
only proves it installs. Signed-out YouTube home is empty, so home-feed/topic-chip behaviour needs the owner's browser.
