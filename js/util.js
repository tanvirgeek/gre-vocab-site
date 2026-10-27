'use strict';
/* Shared helpers: DOM builder, dates, random, text. Everything hangs off window.G. */
window.G = window.G || {};

/* h('div.card#id', {onclick: fn, 'aria-label': 'x'}, child, [child...], 'text') */
G.h = function (sel, attrs, ...kids) {
  const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(sel) || [];
  const el = document.createElement(m[1] || 'div');
  (m[2] || '').replace(/([.#])([\w-]+)/g, (_, k, v) => { if (k === '.') el.classList.add(v); else el.id = v; });
  if (attrs != null && (typeof attrs !== 'object' || attrs.nodeType || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') v.split(' ').filter(Boolean).forEach(c => el.classList.add(c));
    else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; } }
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c.nodeType ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
};
/* replaceChildren that ignores null/false (the native one would print "null") */
G.fill = (el, ...kids) => { el.replaceChildren(); kids.flat(Infinity).forEach(k => { if (k != null && k !== false) el.append(k); }); return el; };
G.$ = (s, r = document) => r.querySelector(s);
G.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* ---- dates (local time, ISO yyyy-mm-dd). ?today=YYYY-MM-DD previews another date. ---- */
G.iso = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
G.parseIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
G.today = () => {
  try {
    const q = new URLSearchParams(location.search).get('today');
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) sessionStorage.setItem('grev.today', q);
    const o = sessionStorage.getItem('grev.today');
    if (o) return o;
  } catch (e) { /* ignore */ }
  return G.iso(new Date());
};
G.addDays = (s, n) => { const d = G.parseIso(s); d.setDate(d.getDate() + n); return G.iso(d); };
G.diffDays = (a, b) => Math.round((G.parseIso(b) - G.parseIso(a)) / 864e5);
G.fmtDate = (s, opts) => G.parseIso(s).toLocaleDateString('en-GB', opts || { weekday: 'short', day: 'numeric', month: 'short' });
G.WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* The quiz window: from the latest quiz-weekday on or before `today` back seven days.
   With Friday as the quiz day: window = last Friday .. Thursday, quiz opens Friday, open until next Thursday. */
G.quizWindow = (today, weekday, back = 0) => {
  const d = G.parseIso(today);
  const diff = (d.getDay() - weekday + 7) % 7;
  const quizDay = G.addDays(today, -diff - 7 * back);
  return { id: quizDay, quizDay, start: G.addDays(quizDay, -7), end: G.addDays(quizDay, -1), closes: G.addDays(quizDay, 6) };
};

/* ---- random ---- */
G.shuffle = (a, rnd = Math.random) => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
G.pick = (a, rnd = Math.random) => a[Math.floor(rnd() * a.length)];
G.mulberry = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/* ---- text ---- */
/* shrink very long headwords so they stay on one line */
G.fit = (w) => w.length > 13 ? 0.62 : w.length > 11 ? 0.72 : w.length > 9 ? 0.84 : 1;
G.cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
G.POS = { noun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb' };
G.IRREG = { levy: 'levi', lope: 'lopi|lope', ogle: 'ogli|ogle', pore: 'pori|pore', pry: 'pri|pry', vie: 'vy|vie', hone: 'hon', rend: 'rent|rend', lie: 'ly|lie' };

/* Highlight the headword (and its inflections) inside a sentence. Returns an array of nodes. */
G.hl = (sentence, word) => {
  const w = word.toLowerCase();
  const n = w.length < 5 ? w.length : Math.max(4, w.length - 3);
  const stems = [w.slice(0, n).replace(/[^a-z-]/g, '')];
  if (G.IRREG[w]) stems.push(G.IRREG[w]);
  const re = new RegExp('\\b(?:' + stems.join('|') + ')[a-z]*', 'i');
  const m = re.exec(sentence);
  if (!m) return [sentence];
  return [sentence.slice(0, m.index), G.h('mark.hw', m[0]), sentence.slice(m.index + m[0].length)];
};

/* Syllables from a respelling such as "SANG-gwin": stressed syllable is the upper-case one. */
G.syllables = (pron) => pron.split('-').map(p => ({ t: p.toLowerCase(), stress: /[A-Z]/.test(p) && p === p.toUpperCase() }));

G.levenshtein = (a, b) => {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
};

G.toast = (msg, ms = 2600) => {
  const t = G.$('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(G._toastT); G._toastT = setTimeout(() => t.classList.remove('show'), ms);
};

G.download = (name, text, type = 'application/json') => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = G.h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

G.copyText = async (text) => {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    const ta = G.h('textarea', { style: { position: 'fixed', opacity: 0 } }); ta.value = text; document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* ignore */ }
    ta.remove(); return ok;
  }
};
