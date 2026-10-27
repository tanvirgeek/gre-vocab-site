'use strict';
/* Progress and settings. */
(function () {
  const h = G.h;
  let installEvt = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });

  /* ------------------------------------------------------------ progress */
  G.on('/progress', () => {
    const S = G.S, done = Object.keys(S.completed).length;
    const qs = S.quizzes, avg = qs.length ? Math.round(100 * qs.reduce((a, q) => a + q.score / q.total, 0) / qs.length) : null;
    const tiles = h('dl.tiles',
      h('div', h('dt', 'Days finished'), h('dd', `${done} of 300`)),
      h('div', h('dt', 'Words learned'), h('dd', String(done * 10))),
      h('div', h('dt', 'Day streak'), h('dd', String(G.store.streak()))),
      h('div', h('dt', 'Quizzes taken'), h('dd', String(qs.length))),
      h('div', h('dt', 'Average score'), h('dd', avg == null ? 'none yet' : avg + '%')));

    const grid = h('div.heat', Array.from({ length: 300 }, (_, i) => h('a.hc' + (S.completed[i + 1] ? '.on' : ''), { href: '#/day/' + (i + 1), title: `Day ${i + 1}`, 'aria-label': `Day ${i + 1}${S.completed[i + 1] ? ' done' : ''}` })));

    const last = qs.slice(-24);
    let chart = h('p.muted', 'Take a quiz and your scores appear here.');
    if (last.length) {
      const W = 320, Hh = 110, bw = W / 24;
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${Hh + 16}`); svg.setAttribute('class', 'bars'); svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Scores of your last quizzes, oldest to newest');
      [50, 75, 100].forEach(v => { const l = document.createElementNS(ns, 'line'); l.setAttribute('x1', 0); l.setAttribute('x2', W); const y = Hh - v / 100 * Hh; l.setAttribute('y1', y); l.setAttribute('y2', y); l.setAttribute('class', 'grid'); svg.append(l); });
      last.forEach((q, i) => {
        const p = q.score / q.total, r = document.createElementNS(ns, 'rect');
        r.setAttribute('x', i * bw + 2); r.setAttribute('width', bw - 4); r.setAttribute('y', Hh - p * Hh); r.setAttribute('height', Math.max(2, p * Hh)); r.setAttribute('rx', 2);
        r.setAttribute('class', 'bar-' + (q.kind === 'week' ? 'week' : q.kind === 'unit' ? 'unit' : 'other'));
        const t = document.createElementNS(ns, 'title'); t.textContent = `${q.title}: ${q.score}/${q.total} on ${q.date}`; r.append(t); svg.append(r);
      });
      chart = h('div', svg, h('p.legend', h('i.lg.unit'), ' Unit ', h('i.lg.week'), ' Weekly ', h('i.lg.other'), ' Other'));
    }

    const boxes = [0, 0, 0, 0, 0, 0], names = ['New', '1 day', '3 days', '7 days', '14 days', '30+ days'];
    Object.values(S.words).forEach(w => { if (w.s && !w.k) boxes[Math.min(5, w.b || 0)]++; });
    const maxB = Math.max(1, ...boxes);
    const boxEl = h('ul.boxes', boxes.map((n, i) => h('li', h('span', names[i]), h('span.track', h('i', { style: { width: (n / maxB * 100) + '%' } })), h('b', String(n)))));

    const weak = Object.keys(S.words).filter(w => S.words[w].m > 0 && !S.words[w].k).sort((a, b) => S.words[b].m - S.words[a].m).slice(0, 15);
    const pr = Object.values(S.pron);
    return G.page('Progress', tiles,
      h('section.block', h('h2', 'Your 300 days'), grid),
      h('section.block', h('h2', 'Recent quiz scores'), chart),
      h('section.block', h('h2', 'How well the words are sticking'), h('p.muted', 'Words move to the right each time you remember them after a longer wait.'), boxEl),
      h('section.block', h('h2', 'Words that trip you up'),
        weak.length ? h('ul.wlist', weak.map(w => h('li', h('a.wrow', { href: '#/word/' + encodeURIComponent(w) }, h('span.wr-main', h('b', w)), h('span.wr-mean', `Missed ${S.words[w].m} time${S.words[w].m > 1 ? 's' : ''}`)), G.speech.btn(w, { mini: true, label: 'Hear ' + w })))) : h('p.muted', 'None yet.')),
      h('section.block', h('h2', 'Pronunciation'), h('p', `${pr.filter(p => p.ok).length} words marked as sounding right, ${pr.filter(p => p.ok === false).length} still shaky.`),
        h('a.btn', { href: '#/listen' }, 'Open the pronunciation lab')));
  });

  /* ------------------------------------------------------------ settings */
  function ics() {
    const S = G.S, t = G.today(), url = location.origin + location.pathname;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const dt = (iso, hm) => iso.replace(/-/g, '') + 'T' + hm.replace(':', '') + '00';
    const qd = S.settings.quizDay, days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const d0 = G.parseIso(t); const add = (qd - d0.getDay() + 7) % 7; const firstQuiz = G.addDays(t, add);
    const ev = (uid, start, rule, sum, desc) => ['BEGIN:VEVENT', `UID:${uid}@gre-vocab-3000`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, 'DURATION:PT25M', `RRULE:${rule}`, `SUMMARY:${sum}`, `DESCRIPTION:${desc}\\n${url}`,
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${sum}`, 'END:VALARM', 'END:VEVENT'].join('\r\n');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GRE Vocab 3000//EN', 'CALSCALE:GREGORIAN',
      ev('daily', dt(t, S.settings.studyTime), 'FREQ=DAILY', 'GRE vocab: today’s 10 words', 'Open the app, listen to the ten words, say them out loud, write your sentences.'),
      ev('weekly', dt(firstQuiz, S.settings.quizTime), `FREQ=WEEKLY;BYDAY=${days[qd]}`, `GRE vocab: ${G.WEEKDAYS[qd]} quiz`, 'Take the weekly quiz on the words you finished since last week.'),
      'END:VCALENDAR'].join('\r\n');
  }

  G.on('/settings', () => {
    const S = G.S, st = S.settings;
    const save = () => { G.store.save(); G.applyAppearance(); };
    const sel = (opts, cur, fn, label) => h('select', { 'aria-label': label, onchange: (e) => fn(e.target.value) }, opts.map(([v, l]) => h('option', { value: v, selected: String(v) === String(cur) }, l)));
    const range = (min, max, step, val, fn, label) => { const o = h('output', String(val)); const i = h('input', { type: 'range', min, max, step, value: val, 'aria-label': label, oninput: (e) => { o.textContent = e.target.value; fn(+e.target.value); } }); return h('div.range', i, o); };
    const row = (label, ctl, hint) => h('div.srow', h('label', h('span.sl', label), hint ? h('small', hint) : null), ctl);
    const tog = (key, onchange) => h('input', { type: 'checkbox', checked: !!st[key], onchange: (e) => { st[key] = e.target.checked; save(); onchange && onchange(); } });

    /* voice */
    const voiceSel = h('select', { 'aria-label': 'Voice', onchange: (e) => { st.voiceURI = e.target.value; save(); } });
    const fillVoices = () => {
      const vs = G.speech.englishVoices();
      G.fill(voiceSel, h('option', { value: '' }, 'Automatic (best for the accent)'), vs.map(v => h('option', { value: v.voiceURI, selected: v.voiceURI === st.voiceURI }, `${v.name} (${v.lang})`)));
    };
    fillVoices(); G.speech.onVoices = fillVoices; G.onCleanup(() => { G.speech.onVoices = null; });
    const sample = 'The sanguine student kept practicing, and her pronunciation steadily improved.';

    const importIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { G.store.importJSON(await f.text()); G.applyAppearance(); G.toast('Backup restored.'); G.render(); } catch (err) { G.toast('Could not restore: ' + err.message, 5000); }
    } });
    const backupInfo = h('p.muted.small', S.lastBackup ? `Last backup: ${G.fmtDate(S.lastBackup, { day: 'numeric', month: 'short', year: 'numeric' })}` : 'No backup yet.');

    const ios = /iphone|ipad/i.test(navigator.userAgent);
    return G.page('Settings',
      h('section.block', h('h2', 'Voice and listening'),
        !G.speech.supported ? h('div.note.warn', h('p', 'This browser has no speech voices.')) : null,
        row('Accent', sel([['en-US', 'American'], ['en-GB', 'British'], ['en-IN', 'Indian'], ['en-AU', 'Australian']], st.accent, v => { st.accent = v; st.voiceURI = ''; save(); fillVoices(); }, 'Accent')),
        row('Voice', voiceSel, 'Natural or Enhanced voices sound best. Install them in your device’s speech settings.'),
        row('Normal speed', range(0.6, 1.3, 0.05, st.rate, v => { st.rate = v; save(); }, 'Normal speed')),
        row('Slow speed', range(0.3, 0.9, 0.05, st.slow, v => { st.slow = v; save(); }, 'Slow speed')),
        h('div.row.wrap', G.speech.btn(sample, { big: true, text: 'Test voice' }), G.speech.btn(sample, { slow: true, big: true, text: 'Test slow' })),
        row('Say the word when I open a card', tog('auto')),
        row('Cards start with sound only', tog('soundFirst'), 'Hides the spelling until you tap Show.')),
      h('section.block', h('h2', 'Look'),
        row('Theme', sel([['auto', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']], st.theme, v => { st.theme = v; save(); }, 'Theme')),
        row('Text size', range(0.9, 1.4, 0.05, st.size, v => { st.size = v; save(); }, 'Text size'))),
      h('section.block', h('h2', 'Quizzes'),
        row('Weekly quiz day', sel(G.WEEKDAYS.map((d, i) => [i, d]), st.quizDay, v => { st.quizDay = +v; save(); }, 'Weekly quiz day'), 'It covers the days you finished from one of these to the next.'),
        row('Seconds per question in timed mode', range(30, 120, 5, st.secsPerQ, v => { st.secsPerQ = v; save(); }, 'Seconds per question'))),
      h('section.block', h('h2', 'Calendar reminders'),
        h('p.muted', 'Download a calendar file with a daily study reminder and a weekly quiz reminder. Open it to add both to Google, Apple or Outlook calendar.'),
        row('Daily study time', h('input', { type: 'time', value: st.studyTime, onchange: (e) => { st.studyTime = e.target.value || '20:00'; save(); } })),
        row('Quiz time', h('input', { type: 'time', value: st.quizTime, onchange: (e) => { st.quizTime = e.target.value || '19:00'; save(); } })),
        h('button.btn', { type: 'button', onclick: () => G.download('gre-vocab-reminders.ics', ics(), 'text/calendar') }, 'Download calendar file')),
      h('section.block', h('h2', 'Your data'),
        h('p.muted', 'Everything is saved in this browser only. It does not sync between devices. Save a backup file now and then, and use it to move to a new phone or browser.'),
        h('div.row.wrap', h('button.btn.primary', { type: 'button', onclick: () => { G.download(`gre-vocab-backup-${G.today()}.json`, G.store.exportJSON()); G.toast('Backup saved to your downloads.'); G.render(); } }, 'Save a backup'),
          h('button.btn', { type: 'button', onclick: () => importIn.click() }, 'Restore from a backup'), importIn),
        backupInfo,
        h('button.btn.small.bad', { type: 'button', onclick: () => { if (prompt('This erases all progress in this browser. Type RESET to confirm.') === 'RESET') { G.store.reset(); G.applyAppearance(); G.toast('Progress erased.'); G.go('/today'); } } }, 'Erase all progress')),
      h('section.block', h('h2', 'Install and offline'),
        h('p.muted', ios ? 'On iPhone: tap the Share button in Safari, then Add to Home Screen. Installed, the app works offline and your progress is much less likely to be cleared.' : 'Install the app to open it like any other and use it without internet.'),
        installEvt ? h('button.btn', { type: 'button', onclick: async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; } }, 'Install the app') : null,
        h('p.muted.small', G.storageOk ? 'Saving is working in this browser.' : 'This browser is blocking saving. Turn off private browsing.')));
  });
})();
