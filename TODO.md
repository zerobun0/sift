# Sift TODO

Legend: ✅ done · 🔄 in progress · ⬜ not started · ⛔ blocked (waiting on owner) · ⏸️ on hold

## Open
- **REL-023 ⛔ Release 0.2.3** (code in 14cda55; package.json = 0.2.3 and CHANGES written, uncommitted). Waiting on the owner to approve the publish:
  1) commit "0.2.3", push, then `sh scripts/release.sh` (unlisted signed xpi + Chrome zip + GitHub release).
  2) Public AMO: bump to 0.2.4 (version numbers are single-use), `npm run build` WITHOUT SIFT_SELF, then
  `npx web-ext sign --channel listed --amo-metadata amo-metadata.json --upload-source-code <git archive zip> --source-dir dist/firefox`.
  Done = GitHub release v0.2.3 live + 0.2.4 listed submitted.
- **AMO-1 🔄 Public Firefox Add-ons listing**: 0.2.1 submitted (listed, same code as 0.2.0), waiting on Mozilla review.
  The `amo-link` GitHub Action adds the link to README + release notes by itself once it's public. Done = link in README.
  From then on: submit each new version to AMO listed too (own version number, build without SIFT_SELF).

## Done
- ✅ SUG-1 autoplay follows Sift rules + SUG-3 update notice as header pill, 0 px extra (14cda55). SUG-2 dropped by owner.
- ✅ 0.2.2 (adddcd6): Chrome "update available" popup notice; README + release notes: install/update steps for both browsers.
- ✅ 0.2.0 (93fb0cd): why-hidden chip + panel, stats page, own topic words, refill thin feeds, no-length rule, opened = watch page only, optional-key wording, self-updating xpi, README media.
- ✅ 0.1.0 (45f2f21): filter-before-render core, length/Shorts/live/upcoming/members/watched/mixes, categories (API key + learning), modes, YouTube topic chips, popup + settings.
