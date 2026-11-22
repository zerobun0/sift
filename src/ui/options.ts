// Copyright (c) 2026 zerobun. All rights reserved.

import { ext, loadSettings, saveSettings } from '../core/ext.ts';
import { DEFAULT_MODES, SURFACES, normaliseSettings } from '../core/settings.ts';
import type { Mode, Settings, Surface } from '../core/types.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const SURFACE_LABEL: Record<Surface, string> = {
  home: 'Home feed',
  search: 'Search results',
  watch: 'Up next (beside a video)',
  subs: 'Subscriptions',
  channel: 'Channel pages',
  other: 'Everything else',
};

const HUES = [160, 32, 215, 300, 0, 75, 255, 125];

let settings: Settings;
let saveTimer = 0;
function commit(rerender = false) {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => saveSettings(settings), 200);
  if (rerender) render();
}

function setStatus(id: string, text: string, state: 'ok' | 'error' | '' = '') {
  const el = $(id);
  el.textContent = text;
  el.dataset.state = state;
}

function render() {
  // surfaces
  $('surfaces').replaceChildren(
    ...SURFACES.map((s) => {
      const label = document.createElement('label');
      label.className = 'toggle';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'switch';
      input.checked = settings.surfaces[s];
      input.addEventListener('change', () => {
        settings.surfaces[s] = input.checked;
        commit();
      });
      label.append(SURFACE_LABEL[s], input);
      return label;
    }),
  );

  // modes
  $('modes').replaceChildren(...settings.modes.map(modeRow));
  $<HTMLButtonElement>('add-mode').disabled = settings.modes.length >= 12;

  $<HTMLInputElement>('show-chip').checked = settings.showChip;
  $<HTMLTextAreaElement>('block').value = settings.blockChannels.join('\n');
  $<HTMLTextAreaElement>('allow').value = settings.allowChannels.join('\n');
}

function modeRow(m: Mode): HTMLElement {
  const row = document.createElement('div');
  row.className = 'mode-row';
  row.style.setProperty('--mode-hue', String(m.hue));

  const top = document.createElement('div');
  top.className = 'mode-top';
  const dot = document.createElement('span');
  dot.className = 'dot';
  const name = document.createElement('input');
  name.className = 'field';
  name.value = m.name;
  name.maxLength = 24;
  name.setAttribute('aria-label', 'Mode name');
  name.addEventListener('input', () => {
    m.name = name.value;
    commit();
  });
  const hue = document.createElement('div');
  hue.className = 'swatches';
  hue.setAttribute('role', 'radiogroup');
  hue.setAttribute('aria-label', 'Mode colour');
  for (const h of HUES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.style.setProperty('--sw', String(h));
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(Math.abs(m.hue - h) < 12));
    b.setAttribute('aria-label', `Colour ${h}`);
    b.addEventListener('click', () => {
      m.hue = h;
      row.style.setProperty('--mode-hue', String(h));
      hue.querySelectorAll('.swatch').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      commit();
    });
    hue.append(b);
  }
  const del = document.createElement('button');
  del.className = 'btn ghost';
  del.textContent = 'Remove';
  del.disabled = settings.modes.length <= 1;
  del.addEventListener('click', () => {
    settings.modes = settings.modes.filter((x) => x !== m);
    if (settings.modeId === m.id) settings.modeId = settings.modes[0].id;
    commit(true);
  });
  top.append(dot, name, hue, del);

  const words = document.createElement('label');
  words.className = 'stack words';
  const wordsLabel = document.createElement('span');
  wordsLabel.textContent = 'Hide titles containing (comma separated)';
  const wordsInput = document.createElement('input');
  wordsInput.className = 'field';
  wordsInput.value = m.words.join(', ');
  wordsInput.placeholder = 'e.g. reaction, prank';
  wordsInput.addEventListener('input', () => {
    m.words = wordsInput.value
      .split(',')
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);
    commit();
  });
  words.append(wordsLabel, wordsInput);

  const keep = document.createElement('label');
  keep.className = 'stack words';
  const keepLabel = document.createElement('span');
  keepLabel.textContent = 'Your own topic: only show titles containing (comma separated, empty = off)';
  const keepInput = document.createElement('input');
  keepInput.className = 'field';
  keepInput.value = m.keep.join(', ');
  keepInput.placeholder = 'e.g. camping, bushcraft, tent';
  keepInput.addEventListener('input', () => {
    m.keep = keepInput.value
      .split(',')
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);
    commit();
  });
  keep.append(keepLabel, keepInput);

  row.append(top, keep, words);
  if (m.id === settings.modeId) {
    const active = document.createElement('span');
    active.className = 'mode-active';
    active.textContent = 'Active now · length, categories and hide rules are set from the toolbar popup';
    row.append(active);
  }
  return row;
}

const lines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

async function main() {
  settings = await loadSettings();
  render();
  $('version').textContent = `Sift ${ext.runtime.getManifest().version}`;

  const { apiKey } = await ext.storage.local.get('apiKey');
  const keyEl = $<HTMLInputElement>('api-key');
  if (apiKey) {
    keyEl.value = apiKey;
    setStatus('key-status', 'Key saved.', 'ok');
  }

  $('save-key').addEventListener('click', async () => {
    const btn = $<HTMLButtonElement>('save-key');
    const key = keyEl.value.trim();
    if (!key) {
      await ext.storage.local.remove('apiKey');
      setStatus('key-status', 'Key removed. Category filters will only use what Sift already knows.');
      return;
    }
    btn.dataset.state = 'loading';
    btn.disabled = true;
    setStatus('key-status', 'Testing with one lookup...');
    try {
      const granted = await ext.permissions.request({ origins: ['https://www.googleapis.com/*'] }).catch(() => true);
      if (!granted) throw new Error('Sift needs permission to reach googleapis.com to use the key.');
      const r = await ext.runtime.sendMessage({ t: 'test-key', key });
      if (!r?.ok) throw new Error(r?.error ? `YouTube said no: ${r.error}` : 'The key did not work.');
      await ext.storage.local.set({ apiKey: key });
      keyEl.removeAttribute('aria-invalid');
      btn.dataset.state = 'success';
      setStatus('key-status', 'Works. Saved.', 'ok');
    } catch (e) {
      keyEl.setAttribute('aria-invalid', 'true');
      btn.dataset.state = 'error';
      setStatus('key-status', `${(e as Error).message} Check the key and its API restriction.`, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  $('show-chip').addEventListener('change', (e) => {
    settings.showChip = (e.target as HTMLInputElement).checked;
    commit();
  });
  $('add-mode').addEventListener('click', () => {
    const base = structuredClone(DEFAULT_MODES[0]);
    const n = settings.modes.length + 1;
    settings.modes.push({ ...base, id: `mode-${Date.now().toString(36)}`, name: `Mode ${n}`, hue: HUES[(n - 1) % HUES.length] });
    commit(true);
  });

  $('block').addEventListener('input', (e) => {
    settings.blockChannels = lines((e.target as HTMLTextAreaElement).value);
    commit();
  });
  $('allow').addEventListener('input', (e) => {
    settings.allowChannels = lines((e.target as HTMLTextAreaElement).value);
    commit();
  });

  $('export').addEventListener('click', () => {
    const area = $<HTMLTextAreaElement>('backup');
    area.value = JSON.stringify(settings, null, 1);
    area.select();
    setStatus('backup-status', 'Selected. Copy it somewhere safe.');
  });
  $('import').addEventListener('click', () => {
    try {
      const parsed = JSON.parse($<HTMLTextAreaElement>('backup').value);
      settings = normaliseSettings(parsed);
      commit(true);
      setStatus('backup-status', 'Loaded.', 'ok');
    } catch {
      setStatus('backup-status', 'That is not a Sift settings copy (not valid JSON).', 'error');
    }
  });

  ext.storage.onChanged.addListener((changes: any, area: string) => {
    // The popup changed something (e.g. switched mode): show it, unless the user is typing here.
    if (area === 'local' && changes.settings && !document.activeElement?.matches('input, textarea')) {
      settings = normaliseSettings(changes.settings.newValue);
      render();
    }
  });
}

main();
