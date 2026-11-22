# Handoff (2026-11-22)

Moved out of `home-lab/browser/sift` into its own project today. History lives in git; the original design plan is
`docs/plan-2026-11-22.md`.

**State:** 0.2.3 is the latest GitHub release (autoplay skips hidden videos, update notice is a header pill). 0.2.4 (same code, no update_url) is submitted to the public AMO listing and waits on Mozilla; the `amo-link` Action adds the link once public. Next unlisted release must be 0.2.5+.

**Next:** nothing open; wait for Mozilla. Gotcha: stop any local test server before release.sh (it locks dist/ on Windows).
git-ignored, owner-only).

**Gotchas learned:** web-ext sign often dies with "fetch failed" while waiting (upload is fine, fetch the file via API).
YouTube 429s this PC after many automated runs. Chromium + `--load-extension` (playwright-core, `--headless=new`) is the
automated test vehicle; headless Zen (`web-ext run --firefox "C:/Program Files/Zen Browser/zen.exe" --arg=-headless`)
only proves it installs. Signed-out YouTube home is empty, so home-feed/topic-chip behaviour needs the owner's browser.
