'use strict';
/* Quiz generation. Reads the per-word tc/se items and builds the same three GRE-style parts
   used in the book (text completion, sentence equivalence, synonym match), plus listening items.
   Options are reshuffled on every attempt. */
(function () {
  const low = (s) => s.toLowerCase();
  const single = (s) => !/\s/.test(s);

  function related(a, b) {
    const sa = new Set([a.w, ...a.s.map(low)]);
    if (sa.has(b.w)) return true;
    return [b.w, ...b.s.map(low)].some(x => sa.has(x));
  }
  const stemClash = (a, b) => a.slice(0, 5) === b.slice(0, 5);

  /* same-part-of-speech words that are neither synonyms nor look-alikes; quiz words first, then the whole list */
  function candidates(w, subject, n, exclude = new Set()) {
    const e = G.idx[w];
    const ok = (x) => x && x.w !== w && x.t === e.t && !exclude.has(x.w) && !related(e, x) && !stemClash(w, x.w);
    const a = G.shuffle(subject.map(s => G.idx[s]).filter(ok));
    const b = G.shuffle(G.index.filter(ok)).slice(0, 60);
    const seen = new Set(), out = [];
    for (const x of [...a, ...b]) { if (!seen.has(x.w)) { seen.add(x.w); out.push(x); if (out.length >= n) break; } }
    return out;
  }

  function mkTC(f, subject) {
    const d = candidates(f.w, subject, 4);
    return { type: 'tc', words: [f.w], sentence: f.tc[0], options: G.shuffle([f.w, ...d.map(x => x.w)]), answer: [f.w], pick: 1,
      explanation: f.tc[1], meaning: f.m };
  }

  function mkSE(f, subject) {
    const used = new Set([f.w, f.se[1], ...f.s.map(low)]);
    const pairs = [];
    for (const d of candidates(f.w, subject, 14)) {
      const syn = G.shuffle(d.s.filter(x => single(x) && !used.has(low(x)) && !f.s.map(low).includes(low(x))));
      if (!syn.length) continue;
      pairs.push([d.w, syn[0]]); used.add(d.w); used.add(low(syn[0]));
      if (pairs.length === 2) break;
    }
    if (pairs.length < 2) return mkTC(f, subject);
    return { type: 'se', words: [f.w], sentence: f.se[0], options: G.shuffle([f.w, f.se[1], ...pairs.flat()]), answer: [f.w, f.se[1]], pick: 2,
      explanation: f.se[2], meaning: f.m };
  }

  function mkMatch(f, subject) {
    const syns = f.s.filter(single);
    const correct = G.pick(syns.length ? syns : f.s);
    const bad = new Set([f.w, ...f.s.map(low)]);
    const opts = [correct];
    const ants = (f.a || []).filter(x => single(x) && !bad.has(low(x)));
    if (ants.length) { opts.push(G.pick(ants)); bad.add(low(opts[1])); }
    for (const d of candidates(f.w, subject, 12)) {
      if (opts.length >= 5) break;
      const syn = G.shuffle(d.s.filter(x => single(x) && !bad.has(low(x))))[0];
      if (syn) { opts.push(syn); bad.add(low(syn)); }
    }
    return { type: 'match', words: [f.w], pron: f.p, prompt: f.w, options: G.shuffle(opts), answer: [correct], pick: 1,
      explanation: `${G.cap(f.w)} means “${f.m}”. “${correct}” is a close synonym.`, meaning: f.m };
  }

  function mkHearMeaning(f, subject) {
    const d = candidates(f.w, subject, 3);
    return { type: 'hearMeaning', words: [f.w], speak: f.w, options: G.shuffle([f.m, ...d.map(x => x.m)]), answer: [f.m], pick: 1,
      explanation: `${G.cap(f.w)} (${f.p.toLowerCase()}): ${f.m}.`, meaning: f.m };
  }
  function mkSpell(f) {
    return { type: 'spell', words: [f.w], speak: f.w, options: [], answer: [f.w], pick: 1,
      explanation: `You are listening for “${f.w}” (${f.p.toLowerCase()}), meaning ${f.m}.`, meaning: f.m };
  }
  function mkHearSentence(f) {
    const key = f.p.toLowerCase().replace(/-/g, '');
    const near = G.index.filter(x => x.w !== f.w && !stemClash(f.w, x.w))
      .map(x => [G.levenshtein(key, x.p.toLowerCase().replace(/-/g, '')), x.w]).sort((a, b) => a[0] - b[0]).slice(0, 12).map(x => x[1]);
    const opts = [f.w, ...G.shuffle(near).slice(0, 3)];
    const sentence = G.pick(f.x);
    return { type: 'hearSentence', words: [f.w], speak: sentence, sentence, options: G.shuffle(opts), answer: [f.w], pick: 1,
      explanation: `The sentence was: “${sentence}”`, meaning: f.m };
  }

  /* Decide which part each word goes to. Adverbs can only be matched, so they go there first. */
  function assign(fulls) {
    const n = fulls.length;
    const adv = fulls.filter(f => f.t === 'adverb');
    const rest = G.shuffle(fulls.filter(f => f.t !== 'adverb'));
    const nMatch = Math.max(Math.round(n * 0.3), adv.length), nSe = Math.round(n * 0.3);
    const m = [...adv, ...rest.splice(0, Math.max(0, nMatch - adv.length))];
    const s = rest.splice(0, nSe);
    return { tc: rest, se: s, match: m };
  }

  /* kind: 'standard' | 'listen' */
  async function build(words, kind = 'standard') {
    const fulls = await G.getFull(words);
    const subject = words;
    let qs = [];
    if (kind === 'listen') {
      const three = [mkHearMeaning, mkSpell, mkHearSentence];
      G.shuffle(fulls).forEach((f, i) => { const fn = three[i % 3]; qs.push(fn(f, subject)); });
    } else {
      const g = assign(fulls);
      g.tc.forEach(f => qs.push(mkTC(f, subject)));
      g.se.forEach(f => qs.push(mkSE(f, subject)));
      g.match.forEach(f => qs.push(mkMatch(f, subject)));
      const order = { tc: 0, se: 1, match: 2 };       // keep the book's three parts together
      qs.sort((a, b) => order[a.type] - order[b.type]);
    }
    qs.forEach((q, i) => { q.n = i + 1; });
    return qs;
  }

  function isCorrect(q, resp) {
    if (!resp || !resp.length) return false;
    if (q.type === 'spell') return resp[0].trim().toLowerCase().replace(/[^a-z-]/g, '') === q.answer[0];
    if (q.type === 'se') return resp.length === 2 && q.answer.every(a => resp.includes(a));
    return resp.length === 1 && resp[0] === q.answer[0];
  }

  const PART = {
    tc: ['Text completion', 'Pick the word that best completes the sentence.'],
    se: ['Sentence equivalence', 'Pick the two words that complete the sentence and give it the same meaning.'],
    match: ['Synonym match', 'Pick the word closest in meaning to the one shown.'],
    hearMeaning: ['Hear the word', 'Listen, then pick the meaning.'],
    spell: ['Hear and spell', 'Listen, then type the word you heard.'],
    hearSentence: ['Hear the sentence', 'Listen to the sentence, then pick the word that was in it.']
  };

  /* ---- word sets for each kind of quiz ---- */
  const notKnown = (ws) => ws.filter(w => !(G.S.words[w] && G.S.words[w].k));

  function weekWords(win) {
    const ws = [];
    G.days.forEach(d => { const c = G.S.completed[d.n]; if (c && c >= win.start && c <= win.end) d.words.forEach(w => ws.push(w)); });
    return notKnown(ws);
  }
  /* Plan for one week's quiz.
     - more than 50 words: split into equal parts of at most 50 (stable per week)
     - fewer than 20 words: topped up to 20 with older words (missed first, then due, then any learned) */
  const PART_MAX = 50, PART_MIN = 20;
  function weekPlan(win) {
    const real = weekWords(win);
    if (!real.length) return { real, parts: [], old: new Set() };
    let list = real.slice(); const old = new Set();
    if (list.length < PART_MIN) {
      const have = new Set(list), t = G.today();
      const pool = G.store.learnedWords().filter(w => !have.has(w) && !(G.S.words[w] || {}).k);
      const rank = (w) => { const x = G.S.words[w] || {}; return x.m > 0 ? 0 : (x.due && x.due <= t) ? 1 : 2; };
      const rnd = G.mulberry(+win.id.replace(/-/g, '') % 2147483647);
      G.shuffle(pool, rnd).sort((a, b) => rank(a) - rank(b)).slice(0, PART_MIN - list.length).forEach(w => { list.push(w); old.add(w); });
    }
    const n = Math.ceil(list.length / PART_MAX), size = Math.ceil(list.length / n);
    const sh = G.shuffle(list.slice().sort(), G.mulberry(+win.id.replace(/-/g, '') % 2147483647));
    return { real, old, parts: Array.from({ length: n }, (_, i) => sh.slice(i * size, (i + 1) * size)) };
  }
  const weekRef = (win, part, total) => total > 1 ? `${win.id}#${part}` : win.id;
  /* combined result over all parts: pct stays null until every part has been taken */
  function weekStatus(win) {
    const plan = weekPlan(win), parts = plan.parts;
    const recs = parts.map((_, i) => G.store.bestQuiz('week', weekRef(win, i + 1, parts.length)));
    const taken = recs.filter(Boolean).length;
    let pct = null;
    if (parts.length && taken === parts.length) pct = Math.round(100 * recs.reduce((a, r, i) => a + r.best * parts[i].length, 0) / parts.reduce((a, p) => a + p.length, 0));
    return { parts, old: plan.old, taken, pct, words: plan.real.length };
  }
  const missedWords = () => Object.keys(G.S.words).filter(w => G.S.words[w].m > 0 && !G.S.words[w].k)
    .sort((a, b) => G.S.words[b].m - G.S.words[a].m).slice(0, 20);

  G.quiz = { build, isCorrect, PART, weekWords, weekPlan, weekRef, weekStatus, missedWords, notKnown };
})();
