// Copyright (c) 2026 zerobun. All rights reserved.
//
// The small "N hidden" chip on YouTube pages and its "why" panel. Lives in a
// closed shadow root, so YouTube's CSS cannot reach it and ours cannot leak out.

import { REASON_LABEL } from '../core/reasons.ts';
import type { Reason, VideoInfo } from '../core/types.ts';

export interface HiddenRow {
  info: VideoInfo;
  reason: Reason;
}

const CSS = `
:host { all: initial; }
.wrap { position: fixed; left: 16px; bottom: 16px; z-index: 2147483000; font: 500 13px/1.35 Roboto, 'YouTube Sans', system-ui, sans-serif;
  color-scheme: light dark; --ink: #1d1a16; --ink2: #6b645a; --paper: #fbf8f3; --rule: #e6dfd3; --hue: 160; }
@media (prefers-color-scheme: dark) { .wrap { --ink: #f1ece4; --ink2: #b3aa9c; --paper: #1f1c18; --rule: #3a352e; } }
.pill { display: flex; align-items: center; gap: 8px; border: 1px solid var(--rule); background: var(--paper); color: var(--ink);
  border-radius: 999px; padding: 6px 12px 6px 10px; cursor: pointer; font: inherit; box-shadow: 0 2px 10px rgb(0 0 0 / .12);
  transition: transform .12s cubic-bezier(.2,.7,.2,1); }
.pill:hover { transform: translateY(-1px); }
.pill:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid oklch(60% .17 250); outline-offset: 2px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: oklch(64% .14 var(--hue)); }
.n { font-variant-numeric: tabular-nums; font-weight: 700; }
.panel { position: absolute; left: 0; bottom: calc(100% + 8px); width: min(380px, calc(100vw - 32px)); max-height: 60vh; overflow: auto;
  background: var(--paper); color: var(--ink); border: 1px solid var(--rule); border-radius: 14px; box-shadow: 0 8px 30px rgb(0 0 0 / .18);
  padding: 6px; animation: in .16s cubic-bezier(.2,.7,.2,1); }
@keyframes in { from { opacity: 0; transform: translateY(4px); } }
@media (prefers-reduced-motion: reduce) { .panel { animation: none; } .pill { transition: none; } }
.head { padding: 8px 10px 6px; font-weight: 700; display: flex; justify-content: space-between; gap: 8px; }
.head span { color: var(--ink2); font-weight: 500; }
ul { list-style: none; margin: 0; padding: 0; }
li { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; padding: 8px 10px; border-radius: 10px; }
li:hover { background: color-mix(in oklch, var(--rule) 45%, transparent); }
a { color: var(--ink); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
a:hover { text-decoration: underline; }
.meta { grid-column: 1; color: var(--ink2); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.why { grid-row: 1 / span 2; grid-column: 2; align-self: center; font-size: 11.5px; padding: 2px 8px; border-radius: 999px;
  background: oklch(92% .04 var(--hue)); color: oklch(36% .09 var(--hue)); white-space: nowrap; }
@media (prefers-color-scheme: dark) { .why { background: oklch(32% .05 var(--hue)); color: oklch(86% .08 var(--hue)); } }
.allow { grid-column: 1; justify-self: start; border: 0; background: none; padding: 0; color: var(--ink2); font: inherit; font-size: 12px;
  text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
.allow:hover { color: var(--ink); }
.empty { padding: 10px; color: var(--ink2); }
`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string) => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export function createChip(onAllow: (channel: string, channelId?: string) => void) {
  let host: HTMLElement | null = null;
  let wrap: HTMLElement;
  let pill: HTMLButtonElement;
  let panel: HTMLElement | null = null;
  let rows: HiddenRow[] = [];
  let label = '';

  const ensure = () => {
    if (host) return true;
    if (!document.body) return false;
    host = document.createElement('sift-chip');
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS;
    wrap = el('div', 'wrap');
    pill = el('button', 'pill');
    pill.type = 'button';
    pill.setAttribute('aria-expanded', 'false');
    pill.addEventListener('click', () => (panel ? close() : open()));
    wrap.append(pill);
    root.append(style, wrap);
    document.body.append(host);
    document.addEventListener('keydown', (e) => e.key === 'Escape' && close());
    return true;
  };

  const href = (v: VideoInfo) =>
    v.kind === 'short' ? `/shorts/${v.id}` : v.kind === 'mix' ? `/playlist?list=${v.id}` : `/watch?v=${v.id}`;

  const open = () => {
    close();
    panel = el('div', 'panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Hidden by Sift');
    const head = el('div', 'head', 'Hidden on this page');
    head.append(el('span', '', label));
    panel.append(head);
    if (!rows.length) {
      panel.append(el('div', 'empty', 'Nothing hidden here yet.'));
    } else {
      const ul = el('ul', '');
      for (const r of rows.slice(-200).reverse()) {
        const li = el('li', '');
        const a = el('a', '', r.info.title || r.info.id);
        a.href = href(r.info);
        a.title = r.info.title;
        const s = r.info.seconds;
        const len = s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '';
        li.append(a, el('span', 'why', REASON_LABEL[r.reason]), el('span', 'meta', [r.info.channel, len].filter(Boolean).join(' · ') || r.info.kind));
        if (r.info.channel && r.reason !== 'short') {
          const allow = el('button', 'allow', `Always show ${r.info.channel}`);
          allow.type = 'button';
          allow.addEventListener('click', () => {
            onAllow(r.info.channel!, r.info.channelId);
            allow.textContent = 'Added. Reload to see it';
            allow.disabled = true;
          });
          li.append(allow);
        }
        ul.append(li);
      }
      panel.append(ul);
    }
    wrap.prepend(panel);
    pill.setAttribute('aria-expanded', 'true');
  };

  const close = () => {
    panel?.remove();
    panel = null;
    pill?.setAttribute('aria-expanded', 'false');
  };

  return {
    update(visible: boolean, hue: number, mode: string, hidden: HiddenRow[]) {
      if (!visible) {
        host?.remove();
        host = null;
        panel = null;
        return;
      }
      if (!ensure()) return;
      rows = hidden;
      label = mode;
      wrap.style.setProperty('--hue', String(hue));
      pill.replaceChildren(el('span', 'dot'), `${mode} · `, el('span', 'n', String(hidden.length)), ' hidden');
      pill.setAttribute('aria-label', `Sift, ${mode} mode, ${hidden.length} hidden. Show why.`);
      if (panel) open();
    },
  };
}
