# Sift TODO

Legend: ✅ done · 🔄 in progress · ⬜ not started · ⛔ blocked (waiting on owner) · ⏸️ on hold

## Open
- **AMO-1 🔄 Public Firefox Add-ons listing**: 0.2.4 submitted listed 2026-11-22 (same code as 0.2.3; replaces 0.2.1 in the queue), waiting on Mozilla review.
  The `amo-link` GitHub Action adds the link to README + release notes by itself once it's public. Done = link in README.
  From then on: submit each new version to AMO listed too (own version number, build without SIFT_SELF).

## Done
- ✅ 0.2.3 GitHub release (autoplay follows Sift rules, update pill, README) + 0.2.4 listed AMO submission (257c285 and later).
- ✅ SUG-1 autoplay follows Sift rules + SUG-3 update notice as header pill, 0 px extra (14cda55). SUG-2 dropped by owner.
- ✅ 0.2.2 (adddcd6): Chrome "update available" popup notice; README + release notes: install/update steps for both browsers.
- ✅ 0.2.0 (93fb0cd): why-hidden chip + panel, stats page, own topic words, refill thin feeds, no-length rule, opened = watch page only, optional-key wording, self-updating xpi, README media.
- ✅ 0.1.0 (45f2f21): filter-before-render core, length/Shorts/live/upcoming/members/watched/mixes, categories (API key + learning), modes, YouTube topic chips, popup + settings.
