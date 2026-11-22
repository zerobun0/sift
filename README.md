<p align="center"><img src="src/icons/icon-128.png" width="72" alt=""></p>

<h1 align="center">Sift</h1>

<p align="center">Your YouTube feed, minus the stuff you didn't come for.<br>
For Zen and Firefox.</p>

<p align="center"><img src="docs/media/demo.gif" width="760" alt="A YouTube search full of Shorts and short clips, then the same search with Sift on, then the panel that lists what was hidden and why"></p>

Sift hides videos before YouTube draws them, so there is no flicker and no
empty holes in the grid. You decide what "the stuff you didn't come for" is:

- **Length.** Only 20-60 minute videos tonight? One click.
- **Shorts, live, upcoming, members-only, mixes, already watched.**
- **YouTube's own topics.** The chips YouTube builds for you on the home page
  (Camping, Podcasts, whatever it has learned you like) show up in Sift. Pick one
  and Home opens on it every time.
- **Categories.** Travel, Education, Music and the other twelve YouTube uses.
- **Your own words.** Hide titles containing "reaction", or keep only titles
  containing "bushcraft".
- **Channels.** Never show these, always show those.

Put a set of these together and it's a **mode**. Sift comes with Everyday, Travel,
Learn and Chill, and you can make your own and switch between them from the toolbar.

## What you see

| | |
|---|---|
| <img src="docs/media/popup.png" width="300" alt="The Sift popup: hidden count, modes, YouTube topics, length, categories"> | **The popup.** How many videos were hidden on this page and why, your modes, and the knobs for the current mode. |
| <img src="docs/media/why-panel.png" width="420" alt="A list of hidden videos with the reason next to each"> | **Why was that hidden?** The small chip in the corner of YouTube opens a list of everything Sift took out, with the reason. One click lets a channel through. |
| <img src="docs/media/stats.png" width="420" alt="Stats page: videos offered, hidden, share sifted out, by day and by reason"> | **Stats.** What YouTube offered, what you kept, what you actually opened. Counted only in your browser. |

## Install

- **Firefox / Zen:** from addons.mozilla.org (link here once the listing is live), or grab the
  signed `.xpi` from [Releases](../../releases) and drag it onto a browser window.
- Needs Firefox 140 or newer. Zen follows current Firefox, so any recent Zen works.

### The API key is optional

Everything above works without one, **except category filtering**. YouTube doesn't
put a video's category in the feed, so without a key Sift only knows the
categories of videos you have opened. With your own free key it asks YouTube
directly, once per video. The key stays in your browser and is only ever sent to
YouTube. Settings explains how to get one in about five minutes.

## Privacy

No account, no analytics, no server of ours. Settings, history and the category
cache live in your browser's extension storage. The only network request Sift
makes itself is to YouTube's API, with your key, if you add one.

## Building it

```
npm install
npm run check     # types, tests, build, Mozilla's linter
npm run build     # dist/firefox (main) and dist/chrome
```

Load `dist/firefox/manifest.json` from `about:debugging` to try a change. The
tests run against real YouTube page data saved in `test/fixtures`; when YouTube
changes its format, save a fresh page there and the tests show what broke.

How it works, briefly: a script runs in the YouTube page before YouTube's own
code, catches the feed data as it arrives (the first page and every request
after it) and removes what your rules say to remove. Anything it doesn't
recognise is left alone, so a YouTube change can make Sift miss things but
never hide your whole feed.

## License

Copyright (c) 2026 zerobun. All rights reserved. The source is public so you can
read it and see exactly what the extension does; it is not open source. See
[LICENSE](LICENSE). The bundled font, Bricolage Grotesque, is under the SIL Open
Font License.
