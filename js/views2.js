'use strict';
/* Quizzes: hub, start screen, runner, results. */
(function () {
  const h = G.h;
  const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  /* ------------------------------------------------------------ hub */
  G.on('/quiz', () => {
    const S = G.S, t = G.today(), wkName = G.WEEKDAYS[S.settings.quizDay];
    /* weekly windows, newest first */
    const weekRows = [];
    for (let b = 0; b < 6; b++) {
      const win = G.quizWindow(t, S.settings.quizDay, b), ws = G.quiz.weekStatus(win), np = ws.parts.length;
      if (b > 0 && !np) continue;
      const side = [];
      if (ws.pct != null) side.push(h('span.score', ws.pct + '%'));
      for (let i = 1; i <= np; i++) {
        const done = !!G.store.bestQuiz('week', G.quiz.weekRef(win, i, np));
        side.push(h('a.btn.small' + (!done && b === 0 && i === ws.taken + 1 ? '.primary' : ''), { href: '#/quiz/week/' + win.id + (np > 1 ? '?part=' + i : '') },
          np > 1 ? (done ? `Part ${i} again` : `Part ${i}`) : (done ? 'Retake' : 'Take it')));
      }
      const extra = ws.parts.reduce((a, p) => a + p.length, 0) - ws.words;
      weekRows.push(h('li' + (b === 0 ? '.now' : ''),
        h('div.qr-main', h('b', `Quiz of ${G.fmtDate(win.quizDay)}`), h('span', np ? `${ws.words} words · studied ${G.fmtDate(win.start)} to ${G.fmtDate(win.end)}${np > 1 ? ` · ${np} parts` : ''}${extra ? ` · plus ${extra} older words` : ''}` : `No days finished ${G.fmtDate(win.start)} to ${G.fmtDate(win.end)}`)),
        h('div.qr-side.wrap', side)));
    }
    /* units */
    const ready = [], grid = h('div.unitgrid');
    for (let u = 1; u <= 150; u++) {
      const done = G.unitDone(u), b = G.store.bestQuiz('unit', u);
      if (done && !b) ready.push(u);
      grid.append(h('a.ug' + (b ? '.taken' : '') + (done && !b ? '.ready' : ''), { href: '#/quiz/unit/' + u, 'aria-label': `Unit ${u} quiz${b ? ', best ' + Math.round(b.best * 100) + ' percent' : done ? ', ready' : ''}` },
        h('span', String(u)), b ? h('small', Math.round(b.best * 100) + '%') : null));
    }
    const missed = G.quiz.missedWords();
    const learned = G.store.learnedWords();
    const hist = S.quizzes.slice(-8).reverse().map(q => h('li', h('span', `${q.title || q.kind}`), h('span.muted', ` ${G.fmtDate(q.date)}`), h('b.r', `${q.score}/${q.total}`)));
    return G.page('Quizzes',
      h('section.block', h('h2', `${wkName} quiz`), h('p.muted', `Every ${wkName}, you get a quiz on the words from the days you finished since last ${wkName}. It stays open for a week.`), h('ul.qrows', weekRows)),
      h('section.block', h('h2', 'Unit quizzes'), h('p.muted', 'One unit is two days, 20 words. The quiz has the same three parts as the book tests: 8 text completion, 6 sentence equivalence, 6 synonym match.'),
        ready.length ? h('div.row.wrap', ready.slice(-4).map(u => h('a.btn.primary', { href: '#/quiz/unit/' + u }, `Unit ${u} is ready`))) : null, grid),
      h('section.block', h('h2', 'Listening quizzes'), h('p.muted', 'Hear the word or a sentence, then answer. No spelling to lean on.'),
        h('div.row.wrap',
          h('a.btn', { href: '#/quiz/listen/' + Math.max(1, Math.min(300, S.cur - (S.completed[S.cur] ? 0 : 1) || 1)) }, 'Latest day'),
          learned.length >= 4 ? h('a.btn', { href: '#/quiz/listen/all' }, 'Everything I have learned') : null)),
      h('section.block', h('h2', 'Practice the words you miss'), missed.length ? h('p.muted', `${missed.length} words have tripped you up. Drill them.`) : h('p.muted', 'Words you get wrong in quizzes and reviews collect here.'),
        missed.length ? h('a.btn.primary', { href: '#/quiz/missed' }, 'Drill missed words') : null),
      hist.length ? h('section.block', h('h2', 'Recent results'), h('ul.hist', hist)) : null);
  });

  /* ------------------------------------------------------------ start screens */
  function start(cfg) {
    const S = G.S, root = h('section.page');
    const mode = { test: true, timed: false };
    const n = cfg.words.length;
    function intro() {
      const qn = cfg.qkind === 'listen' ? n : n;
      const secs = S.settings.secsPerQ;
      G.fill(root,
        h('h1.page-title', { tabindex: -1 }, cfg.title),
        h('p', cfg.desc),
        cfg.words.length ? null : h('div.note.warn', h('p', cfg.empty || 'There are no words for this quiz yet.')),
        h('div.optbox',
          h('fieldset', h('legend', 'How do you want to take it?'),
            radio('test', 'Test mode', 'No answers until the end, like the real exam.', true),
            radio('practice', 'Practice mode', 'See the answer and the reason after each question.', false)),
          h('label.check', h('input', { type: 'checkbox', onchange: (e) => { mode.timed = e.target.checked; } }), ` Timed: ${secs} seconds per question`)),
        h('div.row.wrap', h('button.btn.primary', { type: 'button', disabled: !n, onclick: begin }, `Start (${qn} question${qn === 1 ? '' : 's'})`),
          h('a.btn', { href: cfg.back || '#/quiz' }, 'Back')));
      function radio(v, t, d, on) {
        return h('label.radio', h('input', { type: 'radio', name: 'mode', checked: on, onchange: () => { mode.test = v === 'test'; } }), h('span', h('b', t), h('small', d)));
      }
    }
    async function begin() {
      root.replaceChildren(h('p.muted', 'Preparing your questions…'));
      const qs = await G.quiz.build(cfg.words, cfg.qkind);
      if (cfg.old) qs.forEach(q => { if (cfg.old.has(q.words[0])) q.old = true; });
      run(root, cfg, qs, mode);
    }
    intro();
    return root;
  }

  G.on('/quiz/unit/:u', ({ u }) => {
    u = Math.max(1, Math.min(150, +u || 1));
    const words = G.quiz.notKnown(G.unitWords(u)), [d1, d2] = G.unitDays(u);
    const done = G.unitDone(u);
    return start({ kind: 'unit', ref: u, title: `Unit ${u} quiz`, words, qkind: 'standard', back: '#/day/' + d2.n,
      desc: `Days ${d1.n} and ${d2.n}: ${words.length} words, in the same three parts as the book tests.` + (done ? '' : ` You have not finished both days yet, but you can still try.`),
      next: u < 150 ? { href: '#/day/' + (d2.n + 1), label: `Continue with day ${d2.n + 1}` } : null });
  });
  G.on('/quiz/week/:id', ({ id }, query) => {
    const win = G.quizWindow(id, G.S.settings.quizDay), ws = G.quiz.weekStatus(win), np = ws.parts.length;
    const part = Math.max(1, Math.min(np || 1, +query.get('part') || 1));
    const words = np ? ws.parts[part - 1] : [];
    const old = ws.old, extra = words.filter(w => old.has(w)).length;
    const name = `${G.WEEKDAYS[G.S.settings.quizDay]} quiz, ${G.fmtDate(win.quizDay)}`;
    return start({ kind: 'week', ref: G.quiz.weekRef(win, part, np), title: np > 1 ? `${name}, part ${part} of ${np}` : name, words, qkind: 'standard', old,
      next: np > 1 && part < np ? { href: '#/quiz/week/' + id + '?part=' + (part + 1), label: `Continue with part ${part + 1}` } : null,
      desc: `${words.length - extra} words from the days you finished between ${G.fmtDate(win.start)} and ${G.fmtDate(win.end)}` + (extra ? `, plus ${extra} older words to fill the quiz` : '') + '. One question for each word, mixed across the three parts.' + (np > 1 ? ` This week is split into ${np} parts so no sitting is too long.` : ''),
      empty: `No days were finished between ${G.fmtDate(win.start)} and ${G.fmtDate(win.end)}.` });
  });
  G.on('/quiz/listen/:n', ({ n }) => {
    let words, title, ref;
    if (n === 'all') {
      const l = G.quiz.notKnown(G.store.learnedWords());
      words = G.shuffle(l).slice(0, 20); title = 'Listening quiz: words I have learned'; ref = 'all';
    } else { n = Math.max(1, Math.min(300, +n || 1)); words = G.quiz.notKnown(G.days[n - 1].words); title = `Listening quiz: day ${n}`; ref = n; }
    return start({ kind: 'listen', ref, title, words, qkind: 'listen', back: n === 'all' ? '#/quiz' : '#/day/' + n,
      desc: 'You will hear each word or sentence and answer without seeing the word first. Turn your sound on.', empty: 'Finish a day first so there are words to hear.' });
  });
  G.on('/quiz/missed', () => start({ kind: 'drill', ref: 'missed', title: 'Missed words drill', words: G.quiz.missedWords(), qkind: 'standard',
    desc: 'The words you have missed most, ordered with the worst first.', empty: 'You have not missed any words yet.' }));

  /* ------------------------------------------------------------ runner */
  function run(root, cfg, qs, mode) {
    const S = G.S;
    let i = 0, finished = false;
    const ans = qs.map(() => null), locked = qs.map(() => false);
    let left = mode.timed ? S.settings.secsPerQ * qs.length : 0, tick = null;
    const timerEl = h('span.timer', mode.timed ? mmss(left) : '');
    const body = h('div.qbody');
    const nav = h('div.qdots', { role: 'navigation', 'aria-label': 'Questions' });
    const bar = h('div.bar', h('i'));
    const key = (e) => {
      if (finished || e.target.tagName === 'INPUT' && e.target.type === 'text') { if (e.key === 'Enter' && e.target.tagName === 'INPUT') next(); return; }
      if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') go(i - 1);
      else if (/^[1-6]$/.test(e.key)) { const b = G.$$('.opt', body)[+e.key - 1]; b && b.click(); }
    };
    document.addEventListener('keydown', key);
    G.onCleanup(() => { document.removeEventListener('keydown', key); clearInterval(tick); });
    if (mode.timed) tick = setInterval(() => { left--; timerEl.textContent = mmss(Math.max(0, left)); timerEl.classList.toggle('low', left < 60); if (left <= 0) { clearInterval(tick); G.toast('Time is up.'); finish(); } }, 1000);

    const part = G.h('span.part');
    root.replaceChildren(
      h('div.qhead', h('span.qcount', ''), part, timerEl), bar, body,
      h('div.qfoot', h('button.btn', { type: 'button', id: 'qprev', onclick: () => go(i - 1) }, 'Back'),
        h('button.btn.primary', { type: 'button', id: 'qnext', onclick: () => next() }, 'Next')), nav);
    const qcount = G.$('.qcount', root);

    function go(k) { if (k < 0 || k >= qs.length) return; i = k; paint(); }
    function next() {
      const q = qs[i];
      if (mode.test === false && !locked[i]) { if (!ans[i] || !ans[i].length || (q.type === 'se' && ans[i].length < 2)) { G.toast(q.type === 'se' ? 'Pick two answers first.' : 'Pick an answer first.'); return; } locked[i] = true; paint(); return; }
      if (i < qs.length - 1) go(i + 1); else confirmFinish();
    }
    function confirmFinish() {
      const un = ans.filter((a, k) => !a || !a.length || (qs[k].type === 'se' && a.length < 2)).length;
      if (un && !confirm(`${un} question${un > 1 ? 's are' : ' is'} unanswered. Finish anyway?`)) return;
      finish();
    }

    function sentenceNode(q, fill) {
      const parts = q.sentence.split('______');
      return h('p.qsent', parts[0], fill ? h('span.gap.filled', fill) : h('span.gap', ' '), parts[1] || '');
    }

    function paint() {
      const q = qs[i];
      qcount.textContent = `Question ${i + 1} of ${qs.length}`;
      part.textContent = G.quiz.PART[q.type][0];
      bar.firstChild.style.width = ((i + 1) / qs.length * 100) + '%';
      body.replaceChildren();
      const lock = locked[i];
      body.append(h('p.qinstr', G.quiz.PART[q.type][1]));
      if (q.old) body.append(h('p.qold', 'From an earlier week'));
      if (q.type === 'tc' || q.type === 'se') body.append(sentenceNode(q));
      if (q.type === 'match') body.append(h('div.qmatch', h('span.qword', q.prompt), G.syl(q.pron), G.speech.btn(q.prompt, { mini: true, label: 'Hear the word' })));
      if (q.speak) body.append(h('div.qlisten', G.speech.btn(q.speak, { big: true, label: 'Play the audio', text: 'Play' }), G.speech.btn(q.speak, { slow: true, label: 'Play slowly', text: 'Slow' })));
      if (q.type === 'spell') {
        const inp = h('input.spell', { type: 'text', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', placeholder: 'Type the word', 'aria-label': 'Type the word you heard', disabled: lock });
        inp.value = ans[i] ? ans[i][0] : '';
        inp.addEventListener('input', () => { ans[i] = [inp.value]; dots(); });
        body.append(inp);
        if (!lock) setTimeout(() => inp.focus({ preventScroll: true }), 50);
      } else {
        const wrap = h('div.opts' + (q.pick === 2 ? '.multi' : ''), { role: q.pick === 2 ? 'group' : 'radiogroup' });
        q.options.forEach((o, k) => {
          const on = ans[i] && ans[i].includes(o);
          let cls = 'opt' + (on ? ' on' : '');
          if (lock) { if (q.answer.includes(o)) cls += ' right'; else if (on) cls += ' wrong'; }
          wrap.append(h('button', { class: cls, type: 'button', role: q.pick === 2 ? 'checkbox' : 'radio', 'aria-checked': String(!!on), disabled: lock,
            onclick: () => {
              let a = ans[i] || [];
              if (q.pick === 1) a = [o];
              else { a = a.includes(o) ? a.filter(x => x !== o) : [...a, o]; if (a.length > 2) a = a.slice(-2); }
              ans[i] = a; paint();
            } }, h('span.k', String(k + 1)), h('span.t', o)));
        });
        body.append(wrap);
      }
      if (lock) {
        const ok = G.quiz.isCorrect(q, ans[i]);
        body.append(h('div.fb' + (ok ? '.ok' : '.bad'), h('b', ok ? 'Correct.' : 'Not quite.'), q.type === 'spell' ? ` The word is “${q.answer[0]}”.` : '', ' ', q.explanation));
      }
      G.$('#qprev').disabled = i === 0;
      G.$('#qnext').textContent = (mode.test === false && !lock) ? 'Check answer' : (i === qs.length - 1 ? 'Finish' : 'Next');
      dots();
      if (q.speak && !lock && !ans[i]) setTimeout(() => G.speech.say(q.speak), 250);
    }
    function dots() {
      nav.replaceChildren(...qs.map((q, k) => {
        const a = ans[k], has = a && a.length && !(q.type === 'se' && a.length < 2);
        return h('button', { class: 'dot' + (k === i ? ' cur' : '') + (has ? ' has' : ''), type: 'button', 'aria-label': `Question ${k + 1}${has ? ', answered' : ''}`, onclick: () => go(k) }, String(k + 1));
      }));
    }

    function finish() {
      if (finished) return; finished = true; clearInterval(tick);
      document.removeEventListener('keydown', key);
      const res = qs.map((q, k) => ({ q, a: ans[k] || [], ok: G.quiz.isCorrect(q, ans[k]) }));
      const score = res.filter(r => r.ok).length;
      const missed = [...new Set(res.filter(r => !r.ok).flatMap(r => r.q.words))];
      res.forEach(r => r.q.words.forEach(w => G.store.grade(w, r.ok)));
      const secs = mode.timed ? S.settings.secsPerQ * qs.length - Math.max(0, left) : null;
      G.store.addQuiz({ kind: cfg.kind, ref: cfg.ref, title: cfg.title, date: G.today(), score, total: qs.length, mode: mode.test ? 'test' : 'practice', missed, secs });
      results(root, cfg, res, score, missed, mode);
    }
    paint();
  }

  /* ------------------------------------------------------------ results */
  function results(root, cfg, res, score, missed, mode) {
    const total = res.length, p = pct(score, total);
    const verdict = p >= 90 ? 'Excellent.' : p >= 75 ? 'Solid work.' : p >= 55 ? 'Getting there. The review below will help.' : 'These words need another pass. Listen to them again, then retry.';
    const parts = {};
    res.forEach(r => { const k = r.q.type; (parts[k] = parts[k] || { n: 0, ok: 0 }); parts[k].n++; if (r.ok) parts[k].ok++; });
    const items = res.map(r => {
      const q = r.q;
      const mine = q.type === 'spell' ? (r.a[0] || '(blank)') : r.a.length ? r.a.join(' and ') : '(no answer)';
      const head = q.type === 'tc' || q.type === 'se' ? G.h('p.rsent', q.sentence.split('______')[0], h('span.gap.filled', q.type === 'se' ? q.answer.join(' / ') : q.answer[0]), q.sentence.split('______')[1])
        : q.type === 'match' ? h('p.rsent', h('b', q.prompt), ' ≈ ', h('b', q.answer[0])) : h('p.rsent', q.type === 'hearSentence' ? q.sentence : h('b', q.answer[0]), q.type === 'hearMeaning' ? h('span', ' = ', q.answer[0]) : null);
      return h('li.ri' + (r.ok ? '.ok' : '.bad'),
        h('div.ri-top', h('span.n', String(q.n)), h('span.mark', r.ok ? 'Right' : 'Wrong'), h('span.pt', G.quiz.PART[q.type][0]), q.words.map(w => G.speech.btn(w, { mini: true, label: 'Hear ' + w }))),
        head,
        r.ok ? null : h('p.mine', 'Your answer: ', h('b', mine)),
        h('p.why', q.explanation), q.type === 'tc' || q.type === 'se' ? h('p.mean', h('b', q.words[0]), ': ', q.meaning) : null);
    });
    const again = missed.length ? h('button.btn.primary', { type: 'button', onclick: async () => {
      root.replaceChildren(h('p.muted', 'Preparing your questions…'));
      const qs = await G.quiz.build(missed, 'standard');
      run(root, { kind: 'drill', ref: 'retry', title: 'Retry: missed words', words: missed, qkind: 'standard' }, qs, mode);
    } }, `Retry the ${missed.length} missed word${missed.length > 1 ? 's' : ''}`) : null;
    const retake = h('button.btn', { type: 'button', onclick: async () => {
      root.replaceChildren(h('p.muted', 'Preparing your questions…'));
      const qs = await G.quiz.build(cfg.words, cfg.qkind);
      run(root, cfg, qs, mode);
    } }, 'Retake with new option order');
    G.fill(root,
      h('h1.page-title', { tabindex: -1 }, cfg.title),
      h('div.result', h('div.big', h('b', String(score)), h('span', ` / ${total}`)), h('div.rtext', h('b', p + '%'), h('p', verdict))),
      h('ul.parts', Object.entries(parts).map(([k, v]) => h('li', h('span', G.quiz.PART[k][0]), h('b', `${v.ok}/${v.n}`)))),
      h('div.row.wrap', again, retake, cfg.next ? h('a.btn', { href: cfg.next.href }, cfg.next.label) : null, h('a.btn', { href: '#/quiz' }, 'All quizzes')),
      missed.length ? h('div.missed', h('h2', 'Words to practise'), h('div.chips', missed.map(w => h('a.chip', { href: '#/pron/' + encodeURIComponent(w) }, w)))) : null,
      h('h2', 'Review every question'), h('ol.review', items));
    window.scrollTo(0, 0);
    const t = G.$('.page-title', root); t && t.focus({ preventScroll: true });
  }
})();
