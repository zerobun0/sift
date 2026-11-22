// Copyright (c) 2026 zerobun. All rights reserved.

import { categoryName } from '../core/categories.ts';
import { ext, loadSettings } from '../core/ext.ts';
import { REASON_LABEL } from '../core/reasons.ts';
import { activeMode } from '../core/settings.ts';
import type { Reason } from '../core/types.ts';

interface Day {
  shown: number;
  reasons: Record<string, number>;
  cats: Record<string, number>;
  opened: string[];
}

const $ = (id: string) => document.getElementById(id)!;
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const fmt = (n: number) => n.toLocaleString('en-GB');

function el(tag: string, cls = '', text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function hbars(target: HTMLElement, rows: Array<[string, number]>, empty: string) {
  if (!rows.length) return target.replaceChildren(el('p', 'empty-note', empty));
  const max = Math.max(...rows.map((r) => r[1]));
  target.replaceChildren(
    ...rows.map(([label, n]) => {
      const row = el('div', 'hbar');
      const track = el('div', 'track');
      const fill = el('div', 'fill');
      fill.style.width = `${(n / max) * 100}%`;
      track.append(fill);
      row.title = `${label}: ${fmt(n)}`;
      row.append(el('span', '', label), track, el('span', 'v', fmt(n)));
      return row;
    }),
  );
}

async function main() {
  const s = await loadSettings();
  document.documentElement.style.setProperty('--hue', String(activeMode(s).hue));
  const { history } = await ext.storage.local.get('history');
  const h: Record<string, Day> = history ?? {};

  const days: string[] = [];
  for (let i = 13; i >= 0; i--) days.push(new Date(Date.now() - i * 864e5).toLocaleDateString('en-CA'));
  const list = days.map((d) => h[d] ?? { shown: 0, reasons: {}, cats: {}, opened: [] });

  const shown = list.reduce((a, d) => a + d.shown, 0);
  const hidden = list.reduce((a, d) => a + sum(d.reasons), 0);
  const opened = list.reduce((a, d) => a + d.opened.length, 0);
  const offered = shown + hidden;
  const figs: Array<[string, string]> = [
    [fmt(offered), 'videos YouTube offered'],
    [fmt(hidden), 'hidden by Sift'],
    [offered ? `${Math.round((hidden / offered) * 100)}%` : '-', 'of your feed sifted out'],
    [fmt(opened), 'videos you opened'],
  ];
  $('figures').replaceChildren(
    ...figs.map(([v, l]) => {
      const f = el('div', 'figure');
      f.append(el('b', '', v), el('span', '', l));
      return f;
    }),
  );

  // Each day: shown (accent) + hidden (grey), one scale for both.
  const max = Math.max(1, ...list.map((d) => d.shown + sum(d.reasons)));
  const daysEl = $('days');
  daysEl.setAttribute('aria-label', 'Shown and hidden videos per day, last 14 days');
  const tip = $('tip');
  daysEl.replaceChildren(
    ...list.map((d, i) => {
      const gone = sum(d.reasons);
      const col = el('div', 'day');
      col.tabIndex = 0;
      const k = el('i', 'kept');
      k.style.height = `${(d.shown / max) * 100}%`;
      const g = el('i', 'gone');
      g.style.height = `${(gone / max) * 100}%`;
      col.append(k, g);
      const label = new Date(days[i]).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      const say = () => (tip.textContent = `${label}: ${fmt(d.shown)} shown, ${fmt(gone)} hidden, ${fmt(d.opened.length)} opened`);
      col.addEventListener('mouseenter', say);
      col.addEventListener('focus', say);
      col.title = `${label}: ${d.shown} shown, ${gone} hidden`;
      return col;
    }),
  );
  const labels = el('div', 'day-labels');
  labels.append(...days.map((d, i) => el('span', '', i % 2 ? '' : String(new Date(d).getDate()))));
  daysEl.after(labels);

  const reasons: Record<string, number> = {};
  const cats: Record<string, number> = {};
  for (const d of list) {
    for (const [k, n] of Object.entries(d.reasons)) reasons[k] = (reasons[k] ?? 0) + n;
    for (const [k, n] of Object.entries(d.cats)) cats[k] = (cats[k] ?? 0) + n;
  }
  hbars(
    $('reasons'),
    Object.entries(reasons)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => [REASON_LABEL[k as Reason] ?? k, n]),
    'Nothing hidden yet. Browse YouTube for a bit.',
  );
  hbars(
    $('cats'),
    Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => [categoryName(Number(k)), n]),
    'Open a few videos and their categories show here.',
  );

  $('clear').addEventListener('click', async () => {
    await ext.storage.local.remove('history');
    $('clear-status').textContent = 'Cleared.';
    setTimeout(() => location.reload(), 600);
  });
}

main();
