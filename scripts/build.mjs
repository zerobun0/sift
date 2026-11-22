// Builds dist/firefox (Firefox + Zen, the main target) and dist/chrome from one source.
// Readable output on purpose (no minifying): AMO reviewers read what ships.
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const pkg = JSON.parse(readFileSync(`${root}/package.json`, 'utf8'));
const watch = process.argv.includes('--watch');

const YT = ['*://www.youtube.com/*'];

function manifest(target) {
  const ff = target === 'firefox';
  const pngs = { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' };
  const icons = ff ? { 48: 'icons/sift.svg', 96: 'icons/sift.svg', 128: 'icons/sift.svg' } : pngs;
  return {
    manifest_version: 3,
    name: 'Sift',
    version: pkg.version,
    description: pkg.description,
    icons,
    action: { default_title: 'Sift', default_popup: 'popup.html', default_icon: icons },
    options_ui: { page: 'options.html', open_in_tab: true },
    permissions: ['storage'],
    host_permissions: YT,
    optional_host_permissions: ['https://www.googleapis.com/*'],
    content_scripts: [
      { matches: YT, js: ['hook.js'], run_at: 'document_start', world: 'MAIN' },
      { matches: YT, js: ['bridge.js'], run_at: 'document_start' },
    ],
    background: ff ? { scripts: ['background.js'] } : { service_worker: 'background.js' },
    ...(ff && {
      browser_specific_settings: {
        gecko: {
          id: 'sift@zerobun.com',
          // 140: data_collection_permissions (AMO 2026 rule). Zen tracks current Firefox.
          strict_min_version: '140.0',
          data_collection_permissions: { required: ['none'] },
          // Self-distributed (GitHub) builds update from updates.json in the repo; AMO-listed builds must not carry this.
          ...(process.env.SIFT_SELF === '1' && { update_url: 'https://raw.githubusercontent.com/zerobun0/sift/main/updates.json' }),
        },
        gecko_android: { strict_min_version: '142.0' },
      },
    }),
  };
}

const entries = {
  hook: 'src/page/hook.ts',
  bridge: 'src/content/bridge.ts',
  background: 'src/background/index.ts',
  popup: 'src/ui/popup.ts',
  options: 'src/ui/options.ts',
  stats: 'src/ui/stats.ts',
};

async function build(target) {
  const out = `${root}/dist/${target}`;
  rmSync(out, { recursive: true, force: true });
  mkdirSync(`${out}/fonts`, { recursive: true });
  const opts = {
    absWorkingDir: root,
    entryPoints: entries,
    outdir: out,
    bundle: true,
    format: 'iife',
    target: target === 'firefox' ? 'firefox128' : 'chrome120',
    minify: false,
    legalComments: 'none',
    logLevel: 'warning',
  };
  for (const f of ['popup.html', 'popup.css', 'options.html', 'options.css', 'base.css', 'stats.html', 'stats.css']) cpSync(`${root}/src/ui/${f}`, `${out}/${f}`);
  cpSync(`${root}/src/icons`, `${out}/icons`, { recursive: true });
  cpSync(
    `${root}/node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2`,
    `${out}/fonts/bricolage-wght.woff2`,
  );
  cpSync(`${root}/node_modules/@fontsource-variable/bricolage-grotesque/LICENSE`, `${out}/fonts/OFL.txt`);
  writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest(target), null, 2));
  if (watch) {
    const ctx = await esbuild.context(opts);
    await ctx.watch();
  } else {
    await esbuild.build(opts);
  }
  console.log(`built dist/${target}`);
}

await build('firefox');
await build('chrome');
