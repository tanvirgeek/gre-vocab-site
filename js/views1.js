'use strict';
/* Today, Days, a single day, the word card, word search. */
(function () {
  const h = G.h;

  /* ---------- pieces ---------- */
  G.syl = (pron) => h('span.syl', { 'aria-label': 'pronounced ' + pron.toLowerCase().replace(/-/g, ' ') },
    G.syllables(pron).map(s => h('span.s' + (s.stress ? '.st' : ''), s.t)));

  function myText(words) {
    const out = [];
    words.forEach(w => { const t = (G.S.sentences[w] || '').split('\n').map(x => x.trim()).filter(Boolean); t.forEach(x => out.push([w, x])); });
    if (!out.length) return '';
    return 'Please check these sentences for naturalness and correct anything that sounds unnatural. Keep my meaning and tell me what you changed.\n\n' +
      out.map(([w, x], i) => `${i + 1}. (${w}) ${x}`).join('\n');
  }
  G.copyBtn = (getWords, label = 'Copy my sentences for review') => h('button.btn.small', { type: 'button', onclick: async () => {
    const t = myText(getWords());
    if (!t) { G.toast('Write at least one sentence first.'); return; }
    G.toast((await G.copyText(t)) ? 'Copied. Paste it into Claude.' : 'Could not copy. Select the text and copy it yourself.');
  } }, G.icon('copy', 16), label);

  /* ---------- the word card ---------- */
  G.wordCard = (f, o = {}) => {
    const S = G.S, st = () => S.words[f.w] || {};
    const body = h('div.wc-body');
    const toggle = h('button.wc-toggle', { type: 'button', 'aria-expanded': String(!!o.open), onclick: () => set(card.classList.contains('open') ? false : true, true) },
      h('span.wc-word', { style: { '--fit': G.fit(f.w) } }, f.w), h('span.wc-pos', f.t), G.syl(f.p));
    const card = h('article.wc' + (o.open ? '.open' : ''), { id: 'w-' + f.w },
      h('div.wc-top', toggle,
        h('div.wc-actions', G.speech.btn(f.w, { label: 'Hear ' + f.w, big: true }), G.speech.btn(f.w, { slow: true, label: 'Hear ' + f.w + ' slowly' }))),
      h('p.wc-mean', f.m), body);
    let built = false;
    function build() {
      built = true;
      const ex = h('ul.ex', f.x.map(s => h('li',
        h('span.ex-btns', G.speech.btn(s, { mini: true, label: 'Hear sentence' }), G.speech.btn(s, { mini: true, slow: true, label: 'Hear sentence slowly' })),
        h('span.ex-text', G.hl(s, f.w)))));
      const chipRow = (label, list) => h('div.rel', h('h4', label), h('div.chips', list.map(x => h('button.chip', { type: 'button', onclick: () => G.speech.say(x) }, x))));
      const ta = h('textarea.mine', { rows: 3, placeholder: 'Write your own sentence with “' + f.w + '”. One sentence per line.', 'aria-label': 'My sentences for ' + f.w,
        oninput: () => { G.S.sentences[f.w] = ta.value; G.store.save(); } });
      ta.value = S.sentences[f.w] || '';
      const known = h('input', { type: 'checkbox', checked: !!st().k, onchange: (e) => { G.store.W(f.w).k = e.target.checked ? 1 : 0; G.store.save(); card.classList.toggle('is-known', e.target.checked); } });
      body.append(
        h('h4.sub', 'Hear it in use'), ex,
        chipRow('Synonyms', f.s), chipRow('Opposites', f.a),
        h('div.rel', h('h4', 'Goes with'), h('ul.colloc', f.c.map(c => h('li', h('button.linkish', { type: 'button', onclick: () => G.speech.say(c) }, c))))),
        h('h4.sub', 'Your sentences'), ta,
        h('div.row.wrap', G.copyBtn(() => [f.w], 'Copy for review'),
          h('a.btn.small', { href: '#/pron/' + encodeURIComponent(f.w) }, G.icon('mic', 16), 'Practice saying it'),
          h('label.check', known, ' I already know this word')));
    }
    function set(open, user) {
      card.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open));
      if (open && !built) build();
      if (open && user && G.S.settings.auto) G.speech.say(f.w, { el: null });
    }
    if (o.open) build();
    if (st().k) card.classList.add('is-known');
    return card;
  };

  /* ---------- Today ---------- */
  G.on('/today', async () => {
    const S = G.S, t = G.today(), cur = S.cur, day = G.days[cur - 1];
    const all = cur === 300 && S.completed[300];
    const f = (await G.getFull(day.words))[0];
    const hero = h('div.hero',
      h('p.hero-day', all ? 'All 300 days done' : `Day ${cur} of 300`),
      h('div.hero-word',
        h('div', h('div.hero-hw', { style: { '--fit': G.fit(f.w) } }, f.w), G.syl(f.p), h('p.hero-pos', f.t + ' · ' + f.m)),
        G.speech.btn(f.w, { big: true, label: 'Hear ' + f.w })),
      h('div.row.wrap', h('a.btn.primary', { href: '#/day/' + cur }, all ? 'Review a day' : `Start day ${cur}`),
        h('a.btn', { href: '#/play/day/' + cur }, G.icon('listen', 18), 'Just listen')));

    const rows = [];
    const due = G.store.dueWords();
    rows.push(h('a.task', { href: '#/review' }, h('span.task-main', h('strong', due.length ? `${due.length} word${due.length > 1 ? 's' : ''} to review` : 'Nothing to review today'),
      h('span', due.length ? 'Words you learned earlier, coming back on schedule.' : 'Finish a day and its words will come back for review tomorrow.')), G.icon('fwd', 18)));

    const readyUnits = [];
    for (let u = 1; u <= 150; u++) if (G.unitDone(u) && !G.store.bestQuiz('unit', u)) readyUnits.push(u);
    if (readyUnits.length) {
      const u = readyUnits[readyUnits.length - 1];
      rows.push(h('a.task.hot', { href: '#/quiz/unit/' + u }, h('span.task-main', h('strong', `Unit ${u} quiz is ready`),
        h('span', '20 words, same three parts as the book.' + (readyUnits.length > 1 ? ` ${readyUnits.length - 1} more waiting.` : ''))), G.icon('fwd', 18)));
    }

    const win = G.quizWindow(t, S.settings.quizDay);
    const wn = G.quiz.weekWords(win).length;
    const wk = G.store.bestQuiz('week', win.id);
    const wkName = G.WEEKDAYS[S.settings.quizDay];
    rows.push(h('a.task' + (wn && !wk ? '.hot' : ''), { href: '#/quiz/week/' + win.id },
      h('span.task-main', h('strong', wn ? (wk ? `${wkName} quiz done: ${Math.round(wk.best * 100)}%` : `${wkName} quiz is open`) : `${wkName} quiz has no words yet`),
        h('span', wn ? `${wn} words from ${G.fmtDate(win.start)} to ${G.fmtDate(win.end)}. Open until ${G.fmtDate(win.closes)}.` : `Days you finish between ${G.fmtDate(win.start)} and ${G.fmtDate(win.end)} are counted. Next quiz: ${G.fmtDate(G.addDays(win.quizDay, 7))}.`)),
      G.icon('fwd', 18)));

    const done = Object.keys(S.completed).length, st = G.store.streak();
    const stats = h('div.stats',
      h('div', h('b', done), ' days done'),
      h('div', h('b', done * 10), ' words learned'),
      h('div', h('b', st), st === 1 ? ' day streak' : ' day streak'));

    const nodes = [hero, h('div.tasks', rows), stats];
    if (S.lastBackup !== t && done > 0) {
      const age = S.lastBackup ? G.diffDays(S.lastBackup, t) : 99;
      if (age >= 7) nodes.push(h('div.note', h('p', S.lastBackup ? `Your last backup was ${age} days ago.` : 'You have not saved a backup yet.',
        ' Progress is stored only in this browser, so a backup file keeps it safe.'), h('a.btn.small', { href: '#/settings' }, 'Back up now')));
    }
    if (!G.speech.supported) nodes.push(h('div.note.warn', h('p', 'This browser cannot speak words aloud. Chrome, Edge and Safari can. Listening features are switched off here.')));
    document.title = 'Today · GRE Vocab 3000';
    return h('section.page.today', h('h1.page-title.sr', { tabindex: -1 }, 'Today'), ...nodes);
  });

  /* ---------- Days overview ---------- */
  G.on('/days', () => {
    const S = G.S, secs = [];
    for (let v = 1; v <= 6; v++) {
      const grid = h('div.daygrid');
      for (let n = (v - 1) * 50 + 1; n <= v * 50; n++) {
        const d = G.days[n - 1];
        grid.append(h('a.dg' + (S.completed[n] ? '.done' : '') + (n === S.cur ? '.cur' : '') + (n % 2 === 0 ? '.unitend' : ''),
          { href: '#/day/' + n, 'aria-label': `Day ${n}${S.completed[n] ? ', done' : ''}` }, String(n)));
      }
      const doneN = Array.from({ length: 50 }, (_, i) => (v - 1) * 50 + i + 1).filter(n => S.completed[n]).length;
      secs.push(h('section.vol', h('h2', `Volume ${v}`, h('small', ` Days ${(v - 1) * 50 + 1}–${v * 50} · ${doneN} done`)), grid));
    }
    return G.page('All 300 days', h('p.muted', 'Ten words a day. A thick edge marks the second day of a unit; the unit quiz comes after it.'), ...secs);
  });

  /* ---------- A day ---------- */
  G.on('/day/:n', async ({ n }) => {
    n = Math.max(1, Math.min(300, parseInt(n, 10) || 1));
    const S = G.S, day = G.days[n - 1];
    const fulls = await G.getFull(day.words);
    const first = n % 2 === 1;
    const nav = h('div.daynav',
      h('a.iconbtn' + (n === 1 ? '.off' : ''), { href: '#/day/' + (n - 1), 'aria-label': 'Previous day' }, G.icon('back', 22)),
      h('button.daypick', { type: 'button', onclick: () => G.go('/days') }, h('b', `Day ${n}`), h('span', `Unit ${day.unit} · ${first ? 'first' : 'second'} half`)),
      h('a.iconbtn' + (n === 300 ? '.off' : ''), { href: '#/day/' + (n + 1), 'aria-label': 'Next day' }, G.icon('fwd', 22)));
    const tools = h('div.row.wrap.tools',
      h('a.btn', { href: '#/play/day/' + n }, G.icon('listen', 18), 'Listen to all ten'),
      h('a.btn', { href: '#/flash/' + n }, 'Flashcards'),
      h('a.btn', { href: '#/quiz/listen/' + n }, 'Listening quiz'));
    const cards = h('div.cards', fulls.map((f, i) => G.wordCard(f, { open: false })));
    const doneBox = h('div.donebox');
    function paintDone() {
      doneBox.replaceChildren();
      const c = S.completed[n];
      if (c) {
        doneBox.append(h('p.donetext', G.icon('check', 18), ` Done on ${G.fmtDate(c)}`),
          h('div.row.wrap',
            n % 2 === 0 ? h('a.btn.primary', { href: '#/quiz/unit/' + day.unit }, `Take the unit ${day.unit} quiz`) : h('a.btn.primary', { href: '#/day/' + (n + 1) }, `Go to day ${n + 1}`),
            h('button.btn.small', { type: 'button', onclick: () => { G.store.undoDone(n); paintDone(); } }, 'Undo')));
      } else {
        doneBox.append(h('button.btn.primary.wide', { type: 'button', onclick: () => {
          G.store.markDone(n); paintDone(); G.toast(`Day ${n} done. These words will come back for review tomorrow.`, 3600);
        } }, `I finished day ${n}`),
        h('p.muted.small', 'Tap a word to open it. Listen first, then say it out loud, then write your own sentence.'));
      }
    }
    paintDone();
    const sentences = h('div.row.wrap', G.copyBtn(() => day.words, 'Copy my sentences from today'));
    const pg = G.page(`Day ${n}`, nav, tools, cards, sentences, doneBox);
    pg.firstChild.classList.add('sr');
    return pg;
  });

  /* ---------- Words: search and browse ---------- */
  G.on('/words', async () => {
    const S = G.S;
    const q = h('input', { type: 'search', placeholder: 'Search a word or meaning', 'aria-label': 'Search words', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
    const vol = h('select', { 'aria-label': 'Volume' }, h('option', { value: '' }, 'All volumes'), [1, 2, 3, 4, 5, 6].map(v => h('option', { value: v }, 'Volume ' + v)));
    const pos = h('select', { 'aria-label': 'Word type' }, h('option', { value: '' }, 'All types'), ['noun', 'verb', 'adjective', 'adverb'].map(p => h('option', { value: p }, p)));
    const stt = h('select', { 'aria-label': 'Status' }, [['', 'Any status'], ['learned', 'Learned'], ['new', 'Not learned yet'], ['known', 'Already known'], ['weak', 'Often missed'], ['shaky', 'Shaky pronunciation']].map(([v, l]) => h('option', { value: v }, l)));
    const list = h('ul.wlist'), count = h('p.muted.small'), more = h('button.btn', { type: 'button' }, 'Show more');
    let res = [], shown = 0;
    function run() {
      const s = q.value.trim().toLowerCase();
      res = G.index.filter(e => {
        if (vol.value && e.v !== +vol.value) return false;
        if (pos.value && e.t !== pos.value) return false;
        const w = S.words[e.w] || {};
        if (stt.value === 'learned' && !w.s) return false;
        if (stt.value === 'new' && w.s) return false;
        if (stt.value === 'known' && !w.k) return false;
        if (stt.value === 'weak' && !(w.m > 0)) return false;
        if (stt.value === 'shaky' && !(S.pron[e.w] && S.pron[e.w].ok === false)) return false;
        if (s && !(e.w.includes(s) || e.m.toLowerCase().includes(s) || e.s.some(x => x.toLowerCase().includes(s)))) return false;
        return true;
      });
      if (s) res.sort((a, b) => (b.w.startsWith(s) - a.w.startsWith(s)) || a.w.localeCompare(b.w)); else res.sort((a, b) => a.w.localeCompare(b.w));
      list.replaceChildren(); shown = 0; page();
    }
    function page() {
      res.slice(shown, shown + 60).forEach(e => list.append(h('li', h('a.wrow', { href: '#/word/' + encodeURIComponent(e.w) },
        h('span.wr-main', h('b', e.w), h('i', ' ' + e.t)), h('span.wr-mean', e.m)),
        G.speech.btn(e.w, { mini: true, label: 'Hear ' + e.w }))));
      shown = Math.min(res.length, shown + 60);
      count.textContent = `${res.length} word${res.length === 1 ? '' : 's'}${shown < res.length ? `, showing ${shown}` : ''}`;
      more.style.display = shown < res.length ? '' : 'none';
    }
    more.onclick = page;
    let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 120); });
    [vol, pos, stt].forEach(x => x.addEventListener('change', run));
    run();
    return G.page('Find a word', h('div.filters', q, h('div.row', vol, pos, stt)), count, list, more);
  });

  G.on('/word/:w', async ({ w }) => {
    const e = G.idx[w]; if (!e) return G.page('Word not found', h('a.btn', { href: '#/words' }, 'Back to search'));
    const [f] = await G.getFull([w]);
    const d = G.days[G.dayOf[w] - 1];
    return G.page(f.w, h('p.muted', h('a', { href: '#/day/' + d.n }, `Day ${d.n}`), ` · Unit ${d.unit} · Volume ${d.vol}`), G.wordCard(f, { open: true }));
  });
})();
