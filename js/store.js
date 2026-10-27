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

  let mem = null, memoryOnly = false, timer = null;

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
    addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  }
  function flush() {
    clearTimeout(timer); timer = null;
    try { localStorage.setItem(KEY, JSON.stringify(mem)); G.storageOk = true; } catch (e) { G.storageOk = false; }
  }
  function save() { clearTimeout(timer); timer = setTimeout(flush, 250); }

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
    mem.lastBackup = G.today(); flush();
    return JSON.stringify({ app: 'gre-vocab-3000', exported: new Date().toISOString(), data: mem }, null, 1);
  }
  function importJSON(text) {
    const o = JSON.parse(text);
    if (!o || o.app !== 'gre-vocab-3000' || !o.data || typeof o.data !== 'object') throw new Error('This is not a backup from this app.');
    mem = merge(defaults(), o.data); G.S = mem; flush();
  }
  function reset() { mem = defaults(); G.S = mem; flush(); }

  G.store = { init, save, flush, W, touch, markDone, undoDone, grade, dueWords, learnedWords, streak, addQuiz, bestQuiz, exportJSON, importJSON, reset, nextIncomplete, INTERVALS };
})();
