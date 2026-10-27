'use strict';
/* Review cards, flashcards, hands-free player, listening hub, pronunciation lab. */
(function () {
  const h = G.h;

  /* ------------------------------------------------------------ cards */
  async function cards(root, words, o) {
    const S = G.S;
    const fulls = await G.getFull(words);
    const queue = fulls.map(f => ({ f, tries: 0 }));
    const total = queue.length; let seen = 0, got = 0, shown = false;
    const stage = h('div.cardstage'), count = h('span.qcount');
    const bar = h('div.bar', h('i'));
    root.replaceChildren(h('div.qhead', count, h('span.part', o.label)), bar, stage);

    function front() {
      shown = false;
      const c = queue[0], f = c.f;
      count.textContent = `${Math.min(seen + 1, total)} of ${total}`;
      bar.firstChild.style.width = (seen / total * 100) + '%';
      const hidden = S.settings.soundFirst;
      stage.replaceChildren(h('div.fc',
        hidden ? h('p.fc-hint', 'Listen. Say it out loud. What does it mean?') : h('div.fc-word', f.w),
        hidden ? null : G.syl(f.p),
        h('div.row.center', G.speech.btn(f.w, { big: true, text: 'Hear', label: 'Hear ' + f.w }), G.speech.btn(f.w, { slow: true, text: 'Slow', label: 'Hear slowly' })),
        h('button.btn.wide', { type: 'button', onclick: back }, hidden ? 'Show the word and meaning' : 'Show the meaning')));
      if (S.settings.auto) setTimeout(() => G.speech.say(f.w), 200);
    }
    function back() {
      shown = true;
      const c = queue[0], f = c.f, ex = f.x[0];
      stage.replaceChildren(h('div.fc.back',
        h('div.fc-word', f.w), G.syl(f.p), h('p.fc-pos', f.t),
        h('p.fc-mean', f.m),
        h('ul.ex.fc-exs', f.x.map(x => h('li', h('span.ex-btns', G.speech.btn(x, { mini: true, label: 'Hear sentence' }), G.speech.btn(x, { mini: true, slow: true, label: 'Hear sentence slowly' })), h('span.ex-text', G.hl(x, f.w))))),
        h('p.fc-syn', h('b', 'Synonyms: '), f.s.join(', ')),
        h('p.fc-syn', h('b', 'Opposites: '), f.a.join(', ')),
        h('p.fc-syn', h('b', 'Goes with: '), f.c.join(' · ')),
        h('div.row.wrap.center',
          h('button.btn.bad', { type: 'button', onclick: () => grade(false) }, 'Missed it'),
          h('button.btn.primary', { type: 'button', onclick: () => grade(true) }, 'Got it'))));
    }
    function grade(ok) {
      const c = queue.shift();
      if (o.srs) G.store.grade(c.f.w, ok, { force: false });
      if (ok) { got++; seen++; }
      else { c.tries++; if (c.tries < 3) queue.push(c); else seen++; }
      if (!ok && o.srs) { /* stays in queue for this session */ }
      if (!queue.length) return done();
      front();
    }
    function done() {
      if (o.srs) G.store.touch(), G.store.save();
      bar.firstChild.style.width = '100%';
      stage.replaceChildren(h('div.fc.end', h('h2', 'Finished'), h('p', `${got} of ${total} came back without a miss.`),
        h('div.row.wrap.center', h('a.btn.primary', { href: o.after || '#/today' }, o.afterLabel || 'Back to today'),
          o.srs ? h('a.btn', { href: '#/quiz/missed' }, 'Drill missed words') : null)));
    }
    front();
  }

  G.on('/review', async () => {
    const due = G.shuffle(G.store.dueWords()).slice(0, 30);
    const root = h('section.page');
    document.title = 'Review · GRE Vocab 3000';
    if (!due.length) {
      const next = Object.values(G.S.words).filter(w => w.due && !w.k).map(w => w.due).sort()[0];
      root.append(h('h1.page-title', { tabindex: -1 }, 'Review'), h('p', 'Nothing is due right now.'),
        next ? h('p.muted', 'Next words come back on ' + G.fmtDate(next) + '.') : h('p.muted', 'Finish a day and its words will come back tomorrow, then after 3, 7, 14 and 30 days. Words you miss come back sooner.'),
        h('a.btn.primary', { href: '#/today' }, 'Back to today'));
      return root;
    }
    await cards(root, due, { srs: true, label: 'Review' });
    return root;
  });
  G.on('/flash/:n', async ({ n }) => {
    n = Math.max(1, Math.min(300, +n || 1));
    const root = h('section.page');
    document.title = `Flashcards, day ${n} · GRE Vocab 3000`;
    await cards(root, G.shuffle(G.days[n - 1].words), { srs: false, label: `Day ${n} flashcards`, after: '#/day/' + n, afterLabel: `Back to day ${n}` });
    return root;
  });

  /* ------------------------------------------------------------ hands-free player */
  async function player(title, words, back) {
    const S = G.S;
    const fulls = await G.getFull(words);
    let idx = 0, playing = false, run = 0, loop = false, step = '';
    const steps = new Set(S.settings.playSteps);
    const view = h('div.pl-view'), prog = h('p.muted.small.center'), cap = h('p.pl-cap');
    const playBtn = h('button.iconbtn.big', { type: 'button', 'aria-label': 'Play', onclick: () => playing ? pause() : play() }, G.icon('play', 28));
    function paint() {
      const f = fulls[idx];
      view.replaceChildren(h('div.hero-hw', { style: { '--fit': G.fit(f.w) } }, f.w), G.syl(f.p), h('p.hero-pos', f.t + ' · ' + f.m), h('p.pl-ex', G.hl(f.x[0], f.w)));
      prog.textContent = `Word ${idx + 1} of ${fulls.length}`;
      playBtn.replaceChildren(G.icon(playing ? 'pause' : 'play', 28)); playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    }
    async function doStep(f, s) {
      cap.textContent = { word: 'The word', slow: 'Slowly', meaning: 'Meaning', example: 'In a sentence' }[s];
      if (s === 'word') return G.speech.say(f.w);
      if (s === 'slow') return G.speech.say(f.w, { slow: true });
      if (s === 'meaning') return G.speech.say(f.m);
      if (s === 'example') return G.speech.say(f.x[0]);
    }
    async function play() {
      const my = ++run; playing = true; paint();
      const order = ['word', 'slow', 'meaning', 'example'].filter(s => steps.has(s));
      while (playing && my === run) {
        const f = fulls[idx]; paint();
        for (const s of order) { if (my !== run) return; await doStep(f, s); if (my !== run) return; await G.speech.wait(450); }
        if (my !== run) return;
        await G.speech.wait(500);
        if (idx < fulls.length - 1) idx++; else if (loop) idx = 0; else { playing = false; cap.textContent = 'Finished'; paint(); return; }
      }
    }
    function pause() { run++; playing = false; G.speech.stop(); paint(); }
    function jump(d) { const was = playing; run++; G.speech.stop(); idx = (idx + d + fulls.length) % fulls.length; playing = false; paint(); if (was) play(); }
    G.onCleanup(() => { run++; playing = false; });
    const opt = (s, label) => h('label.check', h('input', { type: 'checkbox', checked: steps.has(s), onchange: (e) => { e.target.checked ? steps.add(s) : steps.delete(s); S.settings.playSteps = [...steps]; G.store.save(); } }), ' ' + label);
    paint();
    document.title = title + ' · GRE Vocab 3000';
    return h('section.page.player', h('h1.page-title', { tabindex: -1 }, title), view, cap, prog,
      h('div.pl-controls', h('button.iconbtn', { type: 'button', 'aria-label': 'Previous word', onclick: () => jump(-1) }, G.icon('prev', 22)), playBtn,
        h('button.iconbtn', { type: 'button', 'aria-label': 'Next word', onclick: () => jump(1) }, G.icon('next', 22))),
      h('fieldset.optbox', h('legend', 'What to play for each word'), opt('word', 'The word'), opt('slow', 'The word, slowly'), opt('meaning', 'The meaning'), opt('example', 'An example sentence'),
        h('label.check', h('input', { type: 'checkbox', onchange: (e) => { loop = e.target.checked; } }), ' Repeat when finished')),
      h('div.row.wrap', h('a.btn', { href: back }, 'Back')));
  }
  G.on('/play/day/:n', ({ n }) => { n = Math.max(1, Math.min(300, +n || 1)); return player(`Listen: day ${n}`, G.days[n - 1].words, '#/day/' + n); });
  G.on('/play/learned', () => { const l = G.shuffle(G.quiz.notKnown(G.store.learnedWords())).slice(0, 40); return l.length ? player('Listen: words I have learned', l, '#/listen') : G.page('Nothing to play yet', h('p', 'Finish a day first.'), h('a.btn', { href: '#/listen' }, 'Back')); });

  /* ------------------------------------------------------------ listening hub */
  G.on('/listen', () => {
    const S = G.S, cur = S.cur;
    const pick = h('select', { 'aria-label': 'Choose a day' }, Array.from({ length: 300 }, (_, i) => h('option', { value: i + 1, selected: i + 1 === cur }, 'Day ' + (i + 1))));
    const shaky = Object.keys(S.pron).filter(w => S.pron[w].ok === false);
    const doneDays = Object.keys(S.completed).length;
    const vc = G.speech.supported ? G.speech.pickVoice() : null;
    return G.page('Listen and speak',
      G.speech.supported ? h('p.muted', vc ? `Voice: ${vc.name} (${vc.lang}). Change it in settings.` : 'Using your device’s default voice. You can pick another in settings.') : h('div.note.warn', h('p', 'This browser has no speech voices. Use Chrome, Edge or Safari for the listening tools.')),
      h('section.block', h('h2', 'Hands-free'), h('p.muted', 'The word, the word slowly, its meaning and a sentence, one after another. Good for walking or commuting.'),
        h('div.row.wrap', pick, h('button.btn.primary', { type: 'button', onclick: () => G.go('/play/day/' + pick.value) }, 'Play this day'),
          doneDays ? h('a.btn', { href: '#/play/learned' }, 'Mix of everything learned') : null)),
      h('section.block', h('h2', 'Pronunciation lab'), h('p.muted', 'Hear a word, say it, record yourself, compare, and mark whether it sounds right. Start with a day:'),
        h('div.row.wrap', h('button.btn.primary', { type: 'button', onclick: () => G.go('/pron/' + encodeURIComponent(G.days[+pick.value - 1].words[0])) }, 'Practise this day’s words'),
          h('a.btn', { href: '#/words' }, 'Find a word'))),
      shaky.length ? h('section.block', h('h2', 'Still shaky'), h('p.muted', 'You marked these as not yet right.'),
        h('div.chips', shaky.slice(0, 30).map(w => h('a.chip', { href: '#/pron/' + encodeURIComponent(w) }, w)))) : null,
      h('section.block', h('h2', 'Listening quizzes'), h('p.muted', 'Hear it first, answer without seeing the word.'),
        h('div.row.wrap', h('button.btn', { type: 'button', onclick: () => G.go('/quiz/listen/' + pick.value) }, 'Quiz on this day'), h('a.btn', { href: '#/quiz/listen/all' }, 'Everything learned'))));
  });

  /* ------------------------------------------------------------ pronunciation lab */
  G.on('/pron/:w', async ({ w }) => {
    const e = G.idx[w]; if (!e) return G.page('Word not found', h('a.btn', { href: '#/listen' }, 'Back'));
    const [f] = await G.getFull([w]);
    const S = G.S, day = G.days[G.dayOf[w] - 1], list = day.words, at = list.indexOf(w);
    const status = h('p.pstatus'); const paintStatus = () => {
      const p = S.pron[w]; status.textContent = !p ? 'Not rated yet.' : p.ok ? `Marked as sounding right (${p.n} ${p.n === 1 ? 'try' : 'tries'}).` : `Marked as still shaky (${p.n} ${p.n === 1 ? 'try' : 'tries'}).`;
      status.className = 'pstatus' + (p ? (p.ok ? ' ok' : ' bad') : '');
    };
    const rate = (ok) => { const p = S.pron[w] || { n: 0 }; S.pron[w] = { ok, n: p.n + 1, d: G.today() }; G.store.touch(); G.store.save(); paintStatus(); G.toast(ok ? 'Marked as sounding right.' : 'Marked as still shaky. It will show in Listen and speak.'); };
    const heard = h('p.heard');
    const check = G.speech.canRecognize ? h('button.btn.small', { type: 'button', onclick: async () => {
      heard.textContent = 'Listening… say the word.'; G.speech.stop();
      try {
        const alts = await G.speech.recognize();
        const clean = alts.map(a => a.replace(/[^a-z ]/g, '').trim());
        if (!clean.length) heard.textContent = 'Nothing was heard. Try again, closer to the microphone.';
        else if (clean.includes(w)) heard.textContent = `Heard “${clean[0]}”. That matches.`;
        else heard.textContent = `Heard “${clean[0]}”${clean[1] ? ' or “' + clean[1] + '”' : ''}, not “${w}”. Stress the capital part of ${f.p}.`;
      } catch (err) { heard.textContent = 'Could not use the microphone for this check.'; }
    } }, 'Check what the computer hears') : null;
    const breakDown = async (btn) => {
      const syl = G.syllables(f.p);
      for (const s of syl) { await G.speech.say(s.t, { rate: 0.5 }); await G.speech.wait(250); }
      await G.speech.wait(200); await G.speech.say(f.w, { slow: true }); await G.speech.wait(200); await G.speech.say(f.w);
    };
    const nav = h('div.row.between',
      h('a.btn.small' + (at <= 0 ? '.off' : ''), { href: at > 0 ? '#/pron/' + encodeURIComponent(list[at - 1]) : '#', 'aria-disabled': at <= 0 }, G.icon('back', 16), at > 0 ? list[at - 1] : 'Start'),
      h('span.muted.small', `Day ${day.n}, word ${at + 1} of ${list.length}`),
      h('a.btn.small' + (at >= list.length - 1 ? '.off' : ''), { href: at < list.length - 1 ? '#/pron/' + encodeURIComponent(list[at + 1]) : '#', 'aria-disabled': at >= list.length - 1 }, at < list.length - 1 ? list[at + 1] : 'End', G.icon('fwd', 16)));
    paintStatus();
    const sents = f.x.map((s, i) => h('li', h('div.row', G.speech.btn(s, { mini: true, label: 'Hear sentence' }), G.speech.btn(s, { mini: true, slow: true, label: 'Hear sentence slowly' }), h('span.ex-text', G.hl(s, f.w))), G.speech.recorderBox(s)));
    return G.page('Say “' + f.w + '”', nav,
      h('div.lab-word', h('div.hero-hw', { style: { '--fit': G.fit(f.w) } }, f.w), G.syl(f.p), h('p.hero-pos', f.t + ' · ' + f.m),
        h('p.muted.small', 'Capital letters in the respelling show the stressed syllable: say it louder and a little longer.')),
      h('section.block', h('h2', 'Hear it'), h('div.row.wrap',
        G.speech.btn(f.w, { big: true, text: 'Normal' }), G.speech.btn(f.w, { slow: true, big: true, text: 'Slow' }),
        h('button.btn', { type: 'button', onclick: breakDown }, 'Break it down'))),
      h('section.block', h('h2', 'Say it'), h('p.muted', 'Record yourself, then compare with the model voice.'), G.speech.recorderBox(f.w, { slow: false }),
        check ? h('div', check, heard) : null),
      h('section.block', h('h2', 'How did it sound?'), h('div.row.wrap', h('button.btn.primary', { type: 'button', onclick: () => rate(true) }, 'Sounds right'), h('button.btn', { type: 'button', onclick: () => rate(false) }, 'Still shaky')), status),
      h('section.block', h('h2', 'Say it in a sentence'), h('p.muted', 'Listen to the whole sentence, then say it at the same speed.'), h('ul.shadow', sents)),
      h('div.row.wrap', h('a.btn', { href: '#/day/' + day.n }, `Back to day ${day.n}`), at < list.length - 1 ? h('a.btn.primary', { href: '#/pron/' + encodeURIComponent(list[at + 1]) }, 'Next word') : null));
  });
})();
