/* DoseCalc EDU - app shell: hash router, pages, progress, theme */
(function () {
  'use strict';
  const DE = window.DoseEdu;
  const { h, store, notice, quizBlock } = DE;
  const view = document.getElementById('view');

  // ---------------------------------------------------------------------------
  // Progress
  // ---------------------------------------------------------------------------
  const done = () => store.get('done', {});
  function markDone(id, value) {
    const d = done();
    if (value === false) delete d[id]; else d[id] = true;
    store.set('done', d);
  }
  const doneCount = () => DE.lessons.filter((l) => done()[l.id]).length;

  // ---------------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------------
  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
  }
  function currentTheme() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  applyTheme(store.get('theme', null));
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    store.set('theme', next);
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const levelClass = (l) => 'lvl lvl-' + l.toLowerCase();
  function ring(done, total) {
    const pct = total ? done / total : 0;
    const r = 26;
    const c = 2 * Math.PI * r;
    const svg = DE.s('svg', { viewBox: '0 0 64 64', class: 'ring', role: 'img', 'aria-label': `${done} of ${total} lessons complete` },
      DE.s('circle', { class: 'ring-bg', cx: 32, cy: 32, r }),
      DE.s('circle', { class: 'ring-fg', cx: 32, cy: 32, r, 'stroke-dasharray': `${(c * pct).toFixed(1)} ${c.toFixed(1)}`, transform: 'rotate(-90 32 32)' }),
      DE.s('text', { x: 32, y: 37, 'text-anchor': 'middle', class: 'ring-text' }, `${done}/${total}`));
    return svg;
  }
  const link = (href, cls, ...kids) => h('a', { href, class: cls }, ...kids);

  function lessonCard(l, i) {
    const isDone = !!done()[l.id];
    return link(`#/learn/${l.id}`, 'card lesson-card' + (isDone ? ' complete' : ''),
      h('div', { class: 'lc-num', 'aria-hidden': 'true' }, isDone ? '✓' : String(i + 1)),
      h('div', { class: 'lc-body' },
        h('div', { class: 'lc-title' }, l.title),
        h('p', { class: 'muted' }, l.summary),
        h('div', { class: 'lc-meta' }, h('span', { class: levelClass(l.level) }, l.level), h('span', { class: 'muted small' }, `${l.minutes} min`))));
  }

  // ---------------------------------------------------------------------------
  // Pages
  // ---------------------------------------------------------------------------
  function pageHome() {
    const total = DE.lessons.length;
    const n = doneCount();
    const first = DE.lessons.find((l) => !done()[l.id]) || DE.lessons[0];
    return h('div', { class: 'home' },
      h('section', { class: 'hero' },
        h('div', { class: 'hero-text' },
          h('p', { class: 'eyebrow' }, 'Radiation therapy physics, made clear'),
          h('h1', null, 'Learn dose calculations, one step at a time.'),
          h('p', { class: 'lead' }, 'From "what is a Gray?" to monitor units, TMR and biological dose. Every formula is explained in plain English, and every calculator shows its work.'),
          h('div', { class: 'cta' },
            link(`#/learn/${first.id}`, 'btn primary big', n ? 'Continue learning →' : 'Start with lesson 1 →'),
            link('#/tools', 'btn big', 'Open the calculators'),
            link('#/practice', 'btn big', 'Practise'))),
        h('div', { class: 'hero-progress card' }, ring(n, total), h('div', null, h('b', null, 'Your progress'), h('p', { class: 'muted small' }, n === total ? 'All lessons complete. Well done!' : `${total - n} lesson${total - n === 1 ? '' : 's'} to go`)))),
      h('section', { class: 'how' },
        h('h2', null, 'How this works'),
        h('div', { class: 'grid3' },
          h('div', { class: 'card feature' }, h('div', { class: 'f-icon', 'aria-hidden': 'true' }, '1'), h('h3', null, 'Learn'), h('p', { class: 'muted' }, 'Short lessons build each idea from the one before. Interactive diagrams let you change the numbers and see what happens.')),
          h('div', { class: 'card feature' }, h('div', { class: 'f-icon', 'aria-hidden': 'true' }, '2'), h('h3', null, 'See the working'), h('p', { class: 'muted' }, 'Calculators never just give an answer. Open "Show your work" to see each step with your numbers substituted in.')),
          h('div', { class: 'card feature' }, h('div', { class: 'f-icon', 'aria-hidden': 'true' }, '3'), h('h3', null, 'Practise'), h('p', { class: 'muted' }, 'Unlimited randomised problems at three difficulty levels, with hints and full worked solutions.')))),
      h('section', null,
        h('h2', null, 'Your learning path'),
        h('div', { class: 'path' }, DE.lessons.map(lessonCard))),
      h('section', { class: 'disclaimer card' },
        h('b', null, 'Educational use only. '),
        'The beam data in this app is generic, rounded teaching data resembling a 6 MV photon beam. It is not measured data for any real machine. Never use this app to calculate treatment for a real patient. Clinical calculations must use commissioned machine data and validated, independently checked systems.'));
  }

  function pageLearnIndex() {
    return h('div', null,
      h('h2', null, 'Lessons'),
      h('p', { class: 'muted' }, 'Work through them in order. Each ends with a short quiz.'),
      h('div', { class: 'path' }, DE.lessons.map(lessonCard)));
  }

  function pageLesson(id) {
    const i = DE.lessons.findIndex((l) => l.id === id);
    if (i < 0) return notice('warn', 'Lesson not found.');
    const l = DE.lessons[i];
    const prev = DE.lessons[i - 1];
    const nextL = DE.lessons[i + 1];
    const completeBtn = h('button', { type: 'button', class: 'btn primary' });
    function paintComplete() {
      const isDone = !!done()[l.id];
      completeBtn.textContent = isDone ? '✓ Completed (click to undo)' : 'Mark lesson complete';
      completeBtn.classList.toggle('primary', !isDone);
    }
    completeBtn.addEventListener('click', () => { markDone(l.id, !done()[l.id]); paintComplete(); });
    paintComplete();

    const body = h('div', { class: 'prose lesson-body' });
    let proseChunk = [];
    const flush = () => { if (proseChunk.length) { body.append(h('div', { html: proseChunk.join('') })); proseChunk = []; } };
    for (const b of l.blocks) {
      if (typeof b === 'string') proseChunk.push(b);
      else if (b.widget) {
        flush();
        const w = DE.widgets[b.widget];
        const holder = h('section', { class: 'widget', 'aria-label': w ? w.title : 'Interactive' }, h('div', { class: 'widget-tag' }, w && w.group === 'Examples' ? 'Worked example' : 'Try it yourself'));
        DE.mountWidget(b.widget, holder);
        body.append(holder);
      }
    }
    flush();

    return h('article', { class: 'lesson' },
      h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, link('#/learn', null, 'Lessons'), ' / ', `Lesson ${i + 1}`),
      h('header', { class: 'lesson-head' },
        h('div', { class: 'lc-meta' }, h('span', { class: levelClass(l.level) }, l.level), h('span', { class: 'muted small' }, `${l.minutes} min · Lesson ${i + 1} of ${DE.lessons.length}`)),
        h('h1', null, l.title),
        h('p', { class: 'lead' }, l.summary),
        h('div', { class: 'goals card' }, h('b', null, 'By the end you will be able to:'), h('ul', null, l.goals.map((g) => h('li', null, g))))),
      body,
      h('section', { class: 'keypoints card' }, h('h3', null, 'Key points'), h('ul', null, l.keyPoints.map((k) => h('li', null, k)))),
      quizBlock(l.quiz, l.id),
      h('div', { class: 'lesson-nav' },
        prev ? link(`#/learn/${prev.id}`, 'btn', '← ' + prev.title) : h('span'),
        completeBtn,
        nextL ? link(`#/learn/${nextL.id}`, 'btn primary', nextL.title + ' →') : link('#/practice', 'btn primary', 'Go practise →')));
  }

  function pageTools(id) {
    if (id) {
      const w = DE.widgets[id];
      if (!w) return notice('warn', 'Calculator not found.');
      const holder = h('div', { class: 'widget solo' });
      DE.mountWidget(id, holder);
      return h('div', null,
        h('nav', { class: 'crumbs' }, link('#/tools', null, 'Calculators'), ' / ', w.title),
        h('h2', null, w.title), h('p', { class: 'muted' }, w.summary), holder);
    }
    const groups = {};
    for (const wid of DE.widgetOrder) {
      const w = DE.widgets[wid];
      if (w.group === 'Examples') continue;
      (groups[w.group] = groups[w.group] || []).push(w);
    }
    return h('div', null,
      h('h2', null, 'Calculators'),
      h('p', { class: 'muted' }, 'Every calculator shows its working. Pick one to open it.'),
      Object.entries(groups).map(([g, ws]) => h('section', null,
        h('h3', { class: 'group' }, g),
        h('div', { class: 'grid2' }, ws.map((w) => link(`#/tools/${w.id}`, 'card tool-card', h('div', { class: 'lc-title' }, w.title), h('p', { class: 'muted' }, w.summary)))))));
  }

  function pagePractice() {
    const root = h('div', null);
    DE.mountPractice(root);
    return root;
  }
  function pageReference() {
    const root = h('div', null);
    DE.mountReference(root);
    return root;
  }

  // ---------------------------------------------------------------------------
  // Router
  // ---------------------------------------------------------------------------
  const NAV = { learn: 'nav-learn', tools: 'nav-tools', practice: 'nav-practice', reference: 'nav-reference' };
  function route() {
    const parts = (window.location.hash || '#/').replace(/^#\/?/, '').split('/').filter(Boolean);
    const [section, arg] = parts;
    let node;
    let title = 'DoseCalc EDU';
    try {
      switch (section) {
        case undefined: node = pageHome(); break;
        case 'learn': node = arg ? pageLesson(arg) : pageLearnIndex(); {
          const l = DE.lessons.find((x) => x.id === arg);
          title = (l ? l.title : 'Lessons') + ' · DoseCalc EDU';
        } break;
        case 'tools': node = pageTools(arg); title = 'Calculators · DoseCalc EDU'; break;
        case 'practice': node = pagePractice(); title = 'Practice · DoseCalc EDU'; break;
        case 'reference': node = pageReference(); title = 'Formulas & glossary · DoseCalc EDU'; break;
        default: node = notice('warn', 'Page not found. Use the menu above.');
      }
    } catch (e) {
      console.error(e);
      node = notice('warn', 'Sorry, this page failed to load. Please reload.');
    }
    view.replaceChildren(node);
    document.title = title;
    for (const [k, id] of Object.entries(NAV)) {
      const a = document.getElementById(id);
      if (a) { a.classList.toggle('active', k === section); if (k === section) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
    }
    window.scrollTo(0, 0);
    view.focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', route);
  route();
})();
