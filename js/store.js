'use strict';
/* All progress lives in localStorage under one key. Never leaves the browser. */
(function () {
  const KEY = 'grevocab.v1';
  const INTERVALS = [1, 3, 7, 14, 30, 60];   // spaced-repetition gaps in days, by box

  const defaults = () => ({
    v: 1,
    created: G.iso(new Date()),
    cur: 1,                 // next day to study
    completed: {},          // { dayNumber: 'yyyy-mm-dd' }
    words: {},              // { word: { b: box, due: iso, m: misses, k: known(1), s: firstSeen iso } }
    quizzes: [],            // history
    sentences: {},          // { word: 'my sentence\nanother' }
    pron: {},               // { word: { ok: bool, n: tries, d: iso } }
    activity: {},           // { iso: count }
    lastBackup: null,
    settings: {
      accent: 'en-US', voiceURI: '', rate: 0.92, slow: 0.55, auto: true, soundFirst: false,
      theme: 'auto', size: 1, quizDay: 5, studyTime: '20:00', quizTime: '19:00', secsPerQ: 75, playSteps: ['word', 'slow', 'meaning', 'example']
    }
  });

  let mem = null, memoryOnly = false, timer = null, dirty = false;

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { memoryOnly = true; return null; }
  }
  function merge(base, saved) {
    const out = Object.assign(base, saved);
    out.settings = Object.assign(base.settings, saved.settings || {});
    return out;
  }

  function init() {
    const saved = read();
    mem = saved ? merge(defaults(), saved) : defaults();
    try { localStorage.setItem(KEY + '.probe', '1'); localStorage.removeItem(KEY + '.probe'); } catch (e) { memoryOnly = true; }
    G.S = mem;
    G.storageOk = !memoryOnly;
    mem.baseUpdated = mem.updated || 0;
    addEventListener('pagehide', flush);
    addEventListener('storage', (e) => { if (e.key === KEY) syncFromStorage(); });
    addEventListener('focus', syncFromStorage);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); else syncFromStorage(); });
  }
  /* Two windows (for example the installed app and a browser tab) share one saved copy.
     Rules so neither can wipe the other's progress:
     1. only write when this window actually changed something (dirty);
     2. before writing, fold in anything another window saved in the meantime;
     3. when another window saves, load its changes here (unless we have unsaved changes). */
  function mergeStates(stored, mine) {
    const out = Object.assign({}, stored, mine);
    out.completed = Object.assign({}, stored.completed, mine.completed);
    out.words = Object.assign({}, stored.words);
    for (const w in mine.words) {
      const a = stored.words && stored.words[w], b = mine.words[w];
      out.words[w] = a ? Object.assign({}, a, b, { m: Math.max(a.m || 0, b.m || 0), k: (a.k || b.k) ? 1 : 0 }) : b;
    }
    const seen = new Set(), q = [];
    [...(stored.quizzes || []), ...(mine.quizzes || [])].forEach(x => { const k = [x.kind, x.ref, x.date, x.score, x.total, x.title].join('|'); if (!seen.has(k)) { seen.add(k); q.push(x); } });
    out.quizzes = q.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
    out.sentences = Object.assign({}, stored.sentences, mine.sentences);
    out.pron = Object.assign({}, stored.pron, mine.pron);
    out.activity = Object.assign({}, stored.activity);
    for (const d in mine.activity) out.activity[d] = Math.max(out.activity[d] || 0, mine.activity[d]);
    out.lastBackup = [stored.lastBackup, mine.lastBackup].filter(Boolean).sort().pop() || null;
    return out;
  }
  function flush() {
    clearTimeout(timer); timer = null;
    if (!dirty) return;
    try {
      const stored = read();
      if (stored && stored.updated && stored.updated !== mem.baseUpdated) { mem = merge(defaults(), mergeStates(stored, mem)); G.S = mem; }
      mem.updated = Date.now(); mem.baseUpdated = mem.updated;
      localStorage.setItem(KEY, JSON.stringify(mem)); G.storageOk = true; dirty = false;
    } catch (e) { G.storageOk = false; }
  }
  function save() { dirty = true; clearTimeout(timer); timer = setTimeout(flush, 250); }

  /* pick up what another window saved */
  function syncFromStorage() {
    if (dirty) return;
    const stored = read();
    if (!stored || !stored.updated || stored.updated === mem.baseUpdated) return;
    mem = merge(defaults(), stored); mem.baseUpdated = stored.updated; G.S = mem;
    mem.cur = nextIncomplete();
    if (G.applyAppearance) G.applyAppearance();
    if (/^#?\/?(today|days|progress|quiz)?$/.test(location.hash) && G.render) G.render();   // never interrupt a running quiz or card session
  }

  /* ---- helpers on the state ---- */
  const W = (w) => mem.words[w] || (mem.words[w] = { b: 0, due: null, m: 0, s: null });
  const touch = () => { const t = G.today(); mem.activity[t] = (mem.activity[t] || 0) + 1; };

  function nextIncomplete() {
    for (let d = 1; d <= 300; d++) if (!mem.completed[d]) return d;
    return 300;
  }
  function markDone(day) {
    const t = G.today();
    mem.completed[day] = t;
    const d = G.days[day - 1];
    d.words.forEach(w => { const s = W(w); if (!s.s) { s.s = t; s.b = 0; s.due = G.addDays(t, 1); } });
    mem.cur = nextIncomplete();
    touch(); save();
  }
  function undoDone(day) {
    delete mem.completed[day];
    mem.cur = nextIncomplete();
    save();
  }
  /* correct/wrong answer feeds the Leitner box */
  function grade(word, correct, opts = {}) {
    const s = W(word); const t = G.today();
    if (s.k) return;
    if (correct) {
      if (!s.due || s.due <= t || opts.force) { s.b = Math.min((s.b || 0) + 1, INTERVALS.length - 1); s.due = G.addDays(t, INTERVALS[s.b]); }
    } else {
      s.b = 0; s.m = (s.m || 0) + 1; s.due = G.addDays(t, 1);
    }
    if (!s.s) s.s = t;
    save();
  }
  function dueWords() {
    const t = G.today();
    return Object.keys(mem.words).filter(w => { const s = mem.words[w]; return !s.k && s.s && s.due && s.due <= t; });
  }
  const learnedWords = () => {
    const out = [];
    Object.keys(mem.completed).map(Number).sort((a, b) => a - b).forEach(d => G.days[d - 1].words.forEach(w => out.push(w)));
    return out;
  };
  function streak() {
    const t = G.today(); let d = mem.activity[t] ? t : G.addDays(t, -1), n = 0;
    while (mem.activity[d]) { n++; d = G.addDays(d, -1); }
    return n;
  }
  function addQuiz(rec) { mem.quizzes.push(rec); if (mem.quizzes.length > 600) mem.quizzes.shift(); touch(); save(); }
  function bestQuiz(kind, ref) {
    const l = mem.quizzes.filter(q => q.kind === kind && String(q.ref) === String(ref));
    if (!l.length) return null;
    return { best: Math.max(...l.map(q => q.score / q.total)), last: l[l.length - 1], tries: l.length };
  }

  /* ---- backup ---- */
  function exportJSON() {
    mem.lastBackup = G.today(); dirty = true; flush();
    return JSON.stringify({ app: 'gre-vocab-3000', exported: new Date().toISOString(), data: mem }, null, 1);
  }
  function importJSON(text) {
    const o = JSON.parse(text);
    if (!o || o.app !== 'gre-vocab-3000' || !o.data || typeof o.data !== 'object') throw new Error('This is not a backup from this app.');
    mem = merge(defaults(), o.data); G.S = mem; dirty = true; mem.baseUpdated = (read() || {}).updated; flush();
  }
  function reset() { mem = defaults(); G.S = mem; dirty = true; mem.baseUpdated = (read() || {}).updated; flush(); }

  G.store = { init, save, flush, W, touch, markDone, undoDone, grade, dueWords, learnedWords, streak, addQuiz, bestQuiz, exportJSON, importJSON, reset, nextIncomplete, INTERVALS };
})();
