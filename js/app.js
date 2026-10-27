'use strict';
/* Router and boot. Views register themselves with G.on(). */
(function () {
  const h = G.h;
  const routes = [];
  G.on = (pat, fn) => {
    const keys = [];
    const re = new RegExp('^' + pat.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ re, keys, fn });
  };
  G.go = (path) => { if (location.hash === '#' + path) render(); else location.hash = path; };
  G.cleanup = null;
  G.onCleanup = (fn) => { const prev = G.cleanup; G.cleanup = () => { prev && prev(); fn(); }; };

  G.page = (title, ...kids) => {
    document.title = title + ' · GRE Vocab 3000';
    return h('section.page', h('h1.page-title', { tabindex: -1 }, title), ...kids);
  };

  const TAB = { today: 'today', days: 'days', day: 'days', listen: 'listen', play: 'listen', pron: 'listen', quiz: 'quiz', progress: 'progress' };

  async function render() {
    const hash = location.hash.slice(1) || '/today';
    const [path, qs] = hash.split('?');
    const main = G.$('#app');
    if (G.cleanup) { try { G.cleanup(); } catch (e) { /* ignore */ } G.cleanup = null; }
    G.speech.stop();
    for (const r of routes) {
      const m = r.re.exec(path);
      if (!m) continue;
      const params = {}; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      main.setAttribute('aria-busy', 'true');
      try {
        const node = await r.fn(params, new URLSearchParams(qs || ''));
        main.replaceChildren(node);
      } catch (e) {
        console.error(e);
        main.replaceChildren(h('section.page', h('h1.page-title', 'Could not load this page'),
          h('p', 'The word data did not load. Check your connection and try again.'),
          h('button.btn.primary', { onclick: render }, 'Try again')));
      }
      main.removeAttribute('aria-busy');
      const seg = path.split('/')[1];
      G.$$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === TAB[seg]));
      window.scrollTo(0, 0);
      const t = G.$('.page-title', main); if (t && !G.noFocus) t.focus({ preventScroll: true });
      return;
    }
    G.go('/today');
  }
  G.render = render;

  function applyAppearance() {
    const s = G.S.settings, r = document.documentElement;
    if (s.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', s.theme);
    r.style.setProperty('--scale', s.size);
    const dark = s.theme === 'dark' || (s.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    const m = G.$('meta[name=theme-color]'); if (m) m.setAttribute('content', dark ? '#0d1a1a' : '#0b6b56');
  }
  G.applyAppearance = applyAppearance;

  async function boot() {
    G.store.init();
    applyAppearance();
    try { await G.loadCore(); } catch (e) {
      G.$('#app').replaceChildren(h('section.page', h('h1.page-title', 'Word data did not load'),
        h('p', 'Open this site through its web address (GitHub Pages or a local server), not by double-clicking the file.'),
        h('button.btn.primary', { onclick: () => location.reload() }, 'Reload')));
      return;
    }
    G.S.cur = G.store.nextIncomplete();
    addEventListener('hashchange', render);
    render();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
    if (!G.storageOk) G.toast('This browser blocks saving. Progress will be lost when you close the tab.', 7000);
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
