'use strict';
/* Listening: text-to-speech through the browser's own voices (Web Speech API), plus
   recording and optional speech recognition for the pronunciation lab. */
(function () {
  const synth = window.speechSynthesis;
  const supported = !!(synth && window.SpeechSynthesisUtterance);
  let voices = [], token = 0, current = null;

  function loadVoices() { if (supported) voices = synth.getVoices() || []; }
  if (supported) { loadVoices(); synth.addEventListener && synth.addEventListener('voiceschanged', () => { loadVoices(); G.speech.onVoices && G.speech.onVoices(); }); }

  const norm = (l) => (l || '').replace('_', '-').toLowerCase();
  function englishVoices() { return voices.filter(v => norm(v.lang).startsWith('en')); }

  function pickVoice() {
    const s = G.S.settings;
    if (s.voiceURI) { const v = voices.find(v => v.voiceURI === s.voiceURI); if (v) return v; }
    const want = norm(s.accent);
    const exact = voices.filter(v => norm(v.lang) === want);
    const rank = (v) => (/natural|neural|enhanced|premium/i.test(v.name) ? 0 : /google/i.test(v.name) ? 1 : v.localService ? 2 : 3);
    if (exact.length) return exact.sort((a, b) => rank(a) - rank(b))[0];
    const en = englishVoices();
    return en.sort((a, b) => rank(a) - rank(b))[0] || null;
  }

  function stop() {
    token++;
    if (supported) { try { synth.cancel(); } catch (e) { /* ignore */ } }
    if (current) { current.classList.remove('speaking'); current = null; }
    document.body.classList.remove('is-speaking');
  }

  /* say(text, {slow:true, rate:0.8, el:buttonToAnimate}) -> Promise resolved when finished or cancelled */
  function say(text, o = {}) {
    if (!supported) { G.speech.warn(); return Promise.resolve(false); }
    stop();
    const my = token;
    return new Promise(res => {
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = G.S.settings.accent;
      u.rate = o.rate || (o.slow ? G.S.settings.slow : G.S.settings.rate);
      u.pitch = 1;
      let done = false;
      const finish = (ok) => {
        if (done) return; done = true; clearTimeout(guard);
        if (current === o.el && o.el) { o.el.classList.remove('speaking'); current = null; }
        if (my === token) document.body.classList.remove('is-speaking');
        res(ok);
      };
      u.onend = () => finish(true);
      u.onerror = () => finish(false);
      /* some mobile browsers never fire onend; guard with a timer */
      const guard = setTimeout(() => finish(true), Math.max(2500, text.length * 150 / u.rate + 1500));
      if (o.el) { o.el.classList.add('speaking'); current = o.el; }
      document.body.classList.add('is-speaking');
      try { synth.speak(u); } catch (e) { finish(false); }
      /* cancelled by a newer call */
      const poll = setInterval(() => { if (my !== token) { clearInterval(poll); finish(false); } else if (done) clearInterval(poll); }, 120);
    });
  }

  /* wait that ends early if audio was stopped */
  function wait(ms) {
    const my = token;
    return new Promise(res => { const t0 = Date.now(); const i = setInterval(() => { if (my !== token || Date.now() - t0 >= ms) { clearInterval(i); res(); } }, 60); });
  }

  let warned = false;
  function warn() {
    if (warned) return; warned = true;
    G.toast('This browser has no speech voices. Try Chrome or Safari, or install an English voice in your device settings.', 5200);
  }

  /* a round listen button; text may be a function */
  function btn(text, o = {}) {
    const label = o.label || (o.slow ? 'Hear slowly' : 'Hear it');
    const b = G.h('button.listen' + (o.slow ? '.slow' : '') + (o.big ? '.big' : '') + (o.mini ? '.mini' : ''), {
      type: 'button', 'aria-label': label, title: label,
      onclick: (e) => { e.stopPropagation(); const t = typeof text === 'function' ? text() : text; if (b.classList.contains('speaking')) { stop(); return; } say(t, { slow: o.slow, el: b }); }
    }, o.slow ? G.icon('turtle') : G.icon('speaker'), o.text ? G.h('span', o.text) : null);
    return b;
  }

  /* ---------- recording ---------- */
  const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream); const chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise(res => { rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); res(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); }; });
    rec.start();
    return { stop: () => { if (rec.state !== 'inactive') rec.stop(); return done; } };
  }

  /* a small "record yourself and compare" widget */
  function recorderBox(modelText, o = {}) {
    if (!canRecord) return G.h('p.muted.small', 'Recording needs a microphone and a secure (https) page.');
    let url = null, active = null, audio = null;
    const status = G.h('span.rec-status', '');
    const mine = G.h('button.btn.small', { type: 'button', disabled: true, onclick: () => { stop(); audio && audio.play(); } }, G.icon('play'), 'Play mine');
    const cmp = G.h('button.btn.small', { type: 'button', disabled: true, onclick: async () => {
      stop(); await say(modelText, { slow: o.slow, rate: o.rate }); await wait(350); audio && audio.play();
    } }, 'Compare');
    const rec = G.h('button.btn.small.rec', { type: 'button', onclick: async () => {
      stop();
      if (active) {
        const blob = await active.stop(); active = null; rec.classList.remove('on'); rec.lastChild.textContent = 'Record again'; status.textContent = '';
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(blob); audio = new Audio(url);
        mine.disabled = false; cmp.disabled = false; o.onRecorded && o.onRecorded();
        return;
      }
      try { active = await startRecording(); rec.classList.add('on'); rec.lastChild.textContent = 'Stop'; status.textContent = 'Recording… say it now'; }
      catch (e) { status.textContent = 'Microphone is blocked. Allow it in the browser address bar, then try again.'; }
    } }, G.icon('mic'), G.h('span', 'Record'));
    return G.h('div.recbox', rec, mine, cmp, status);
  }

  /* ---------- recognition (Chrome / Edge / Safari) ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function recognize(lang) {
    return new Promise((res, rej) => {
      const r = new SR(); r.lang = lang || G.S.settings.accent; r.interimResults = false; r.maxAlternatives = 5;
      r.onresult = e => res(Array.from(e.results[0]).map(a => a.transcript.trim().toLowerCase()));
      r.onerror = e => rej(new Error(e.error)); r.onnomatch = () => res([]);
      r.onend = () => res([]);
      r.start();
    });
  }

  G.speech = { supported, say, stop, wait, btn, warn, englishVoices, pickVoice, canRecord, recorderBox, canRecognize: !!SR, recognize,
    get voices() { return voices; }, onVoices: null };

  /* ---------- tiny inline icons ---------- */
  const P = {
    speaker: '<path d="M3 9v6h4l5 4V5L7 9H3z"/><path d="M15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    turtle: '<path d="M4.5 16.5a7.5 6.5 0 0115 0z"/><circle cx="20.2" cy="13.6" r="2"/><path d="M6.5 16.5v2.6M16.5 16.5v2.6M3 14.5l1.7 1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    play: '<path d="M7 4.5v15l13-7.5z"/>',
    pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
    prev: '<path d="M6 5h2.5v14H6zM20 5v14L9.5 12z"/>',
    next: '<path d="M15.5 5H18v14h-2.5zM4 5v14l10.5-7z"/>',
    back: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    fwd: '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    gear: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    search: '<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M16 16l5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    today: '<rect x="4" y="5" width="16" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 10h16M9 3v4M15 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    days: '<path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    listen: '<path d="M4 14v-2a8 8 0 0116 0v2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="3" y="13" width="4" height="7" rx="2"/><rect x="17" y="13" width="4" height="7" rx="2"/>',
    quiz: '<rect x="5" y="3" width="14" height="18" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 9h6M9 13h6M9 17h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    chart: '<path d="M5 20V10M12 20V4M19 20v-7" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    flag: '<path d="M6 21V4M6 5h11l-2 4 2 4H6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" fill="none" stroke="currentColor" stroke-width="2"/>'
  };
  G.icon = (name, size = 20) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
    s.setAttribute('fill', 'currentColor'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'ic');
    s.innerHTML = P[name] || '';
    return s;
  };
})();
