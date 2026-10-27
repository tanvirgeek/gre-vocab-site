'use strict';
/* Loads the word data. days.json + index.json up front (small); the six volume files on demand. */
(function () {
  const vols = {};     // vol -> promise
  G.full = {};         // word -> full entry
  G.idx = {};          // word -> light entry {w,t,v,p,m,s}
  G.days = [];         // [{n, unit, vol, words}]
  G.dayOf = {};        // word -> day number

  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return r.json();
  }
  G.loadCore = async function () {
    const [d, ix] = await Promise.all([getJSON('data/days.json'), getJSON('data/index.json')]);
    G.days = d.days.map(([n, unit, vol, words]) => ({ n, unit, vol, words }));
    G.days.forEach(d => d.words.forEach(w => { G.dayOf[w] = d.n; }));
    G.index = ix;
    ix.forEach(e => { G.idx[e.w] = e; });
  };
  G.loadVol = function (v) {
    if (!vols[v]) {
      vols[v] = getJSON(`data/vol${v}.json`).then(list => {
        list.forEach(e => { G.full[e.w] = e; });
      }).catch(err => { delete vols[v]; throw err; });
    }
    return vols[v];
  };
  /* make sure the full entries for these words are available, return them */
  G.getFull = async function (words) {
    const need = new Set(words.filter(w => !G.full[w]).map(w => G.idx[w].v));
    await Promise.all([...need].map(G.loadVol));
    return words.map(w => G.full[w]);
  };
  G.unitDays = (unit) => [G.days[(unit - 1) * 2], G.days[(unit - 1) * 2 + 1]];
  G.unitWords = (unit) => G.unitDays(unit).flatMap(d => d.words);
  G.unitDone = (unit) => G.unitDays(unit).every(d => G.S.completed[d.n]);
})();
