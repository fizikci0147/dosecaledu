/* DoseCalc EDU - UI helpers: DOM builder, forms, step-by-step renderer, SVG charts, progress storage */
(function () {
  'use strict';
  const DE = (window.DoseEdu = window.DoseEdu || {});
  const C = window.DoseCalc;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // ---------------------------------------------------------------------------
  // DOM builders
  // ---------------------------------------------------------------------------
  function applyAttrs(el, attrs) {
    if (!attrs) return;
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  function append(el, kids) {
    for (const c of kids.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    applyAttrs(el, attrs);
    append(el, kids);
    return el;
  }
  function s(tag, attrs, ...kids) {
    const el = document.createElementNS(SVG_NS, tag);
    applyAttrs(el, attrs);
    append(el, kids);
    return el;
  }

  /** Stacked fraction used in formulas, e.g. fr('Dose', 'K × Sc') */
  function fr(num, den) {
    return `<span class="frac"><span>${num}</span><span>${den}</span></span>`;
  }

  // ---------------------------------------------------------------------------
  // Progress storage (localStorage with in-memory fallback)
  // ---------------------------------------------------------------------------
  const KEY = 'dosecaledu:v1';
  let memory = {};
  const store = {
    load() {
      try {
        const raw = window.localStorage.getItem(KEY);
        if (raw) memory = JSON.parse(raw) || {};
      } catch (e) { /* storage unavailable: keep memory only */ }
      return memory;
    },
    save() {
      try { window.localStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) { /* ignore */ }
    },
    get(key, fallback) { return memory[key] === undefined ? fallback : memory[key]; },
    set(key, value) { memory[key] = value; this.save(); },
    reset() { memory = {}; this.save(); },
  };
  store.load();

  // ---------------------------------------------------------------------------
  // Forms
  // ---------------------------------------------------------------------------
  let uid = 0;
  function buildForm(fields, onChange) {
    const values = {};
    const rows = [];
    const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault(), novalidate: true });

    function visibility() {
      for (const r of rows) r.el.hidden = r.show ? !r.show(values) : false;
    }
    function changed() { visibility(); onChange(); }

    for (const f of fields) {
      if (f.type === 'heading') {
        const el = h('h4', { class: 'form-heading' }, f.label);
        rows.push({ el, show: f.show });
        form.append(el);
        continue;
      }
      const id = 'fld' + ++uid;
      values[f.key] = f.value;
      let control;
      let body;
      if (f.type === 'select') {
        control = h('select', { id }, f.options.map((o) => h('option', { value: o.value }, o.label)));
        control.value = String(f.value);
        control.addEventListener('change', () => {
          values[f.key] = control.value;
          changed();
        });
        values[f.key] = control.value;
        body = [control];
      } else {
        control = h('input', {
          id, type: 'number', value: f.value, min: f.min, max: f.max,
          step: f.step || 'any', inputmode: 'decimal',
        });
        const range = f.slider
          ? h('input', { type: 'range', min: f.min, max: f.max, step: f.step || 'any', value: f.value, 'aria-label': `${f.label} slider` })
          : null;
        control.addEventListener('input', () => {
          const v = parseFloat(control.value);
          values[f.key] = v;
          if (range && isFinite(v)) range.value = v;
          changed();
        });
        if (range) {
          range.addEventListener('input', () => {
            control.value = range.value;
            values[f.key] = parseFloat(range.value);
            changed();
          });
        }
        body = [h('div', { class: 'input-wrap' }, control, f.unit ? h('span', { class: 'unit' }, f.unit) : null), range];
      }
      const el = h('div', { class: 'field' },
        h('label', { for: id }, f.label),
        body,
        f.help ? h('div', { class: 'help' }, f.help) : null);
      rows.push({ el, show: f.show });
      form.append(el);
    }
    visibility();
    return { form, values, update: visibility };
  }

  /**
   * Standard "form on the left, live result on the right" tool.
   * spec: { fields, compute(values) -> result | {error}, render(result, values) -> Node }
   */
  function createTool(root, spec) {
    const out = h('div', { class: 'tool-out', 'aria-live': 'polite' });
    const { form, values } = buildForm(spec.fields, refresh);
    function refresh() {
      let node;
      try {
        const res = spec.compute(values);
        node = res && res.error ? notice('warn', res.error) : spec.render(res, values);
      } catch (e) {
        node = notice('warn', 'Something went wrong with these numbers. Please check each box.');
        console.error(e);
      }
      out.replaceChildren(node);
    }
    root.append(h('div', { class: 'tool' }, h('div', { class: 'tool-in card' }, form), out));
    refresh();
    return { values, refresh };
  }

  function notice(kind, text) {
    return h('div', { class: 'notice ' + kind, role: kind === 'warn' ? 'alert' : null }, text);
  }

  // ---------------------------------------------------------------------------
  // Result building blocks
  // ---------------------------------------------------------------------------
  function bigResult(label, value, unit) {
    return h('div', { class: 'big-result' },
      h('div', { class: 'br-label' }, label),
      h('div', { class: 'br-value' }, value, unit ? h('span', { class: 'br-unit' }, ' ' + unit) : null));
  }
  function chips(items) {
    return h('div', { class: 'chips' }, items.map((i) =>
      h('div', { class: 'chip' }, h('div', { class: 'chip-v' }, i.value), h('div', { class: 'chip-l' }, i.label))));
  }
  function stepsList(steps, open, summary) {
    return h('details', { class: 'work', open: open === false ? null : true },
      h('summary', null, summary || 'Show your work, step by step'),
      h('ol', { class: 'steps' }, steps.map((st) =>
        h('li', null,
          h('div', { class: 'step-title' }, st.title),
          st.formula ? h('div', { class: 'step-formula' }, st.formula) : null,
          st.work ? h('div', { class: 'step-work' }, st.work) : null,
          st.result ? h('div', { class: 'step-result' }, st.result) : null,
          st.why ? h('p', { class: 'step-why' }, st.why) : null))));
  }
  function factorTable(factors) {
    return h('table', { class: 'factors' },
      h('thead', null, h('tr', null, h('th', null, 'Symbol'), h('th', null, 'Factor'), h('th', null, 'Value'), h('th', null, 'Why'))),
      h('tbody', null, factors.map((f) =>
        h('tr', null, h('td', { class: 'sym' }, f.symbol), h('td', null, f.name), h('td', { class: 'num' }, f.value), h('td', { class: 'muted' }, f.note)))));
  }

  // ---------------------------------------------------------------------------
  // SVG line chart with hover read-out
  // ---------------------------------------------------------------------------
  function niceTicks(min, max, count) {
    const span = max - min;
    const raw = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
    const ticks = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(10)));
    return ticks;
  }

  /**
   * o: { width, height, xmin, xmax, ymin, ymax, xlabel, ylabel, label,
   *      series:[{fn|points, cls, name, dashed}], markers:[{x,y,label}], vlines:[{x,label}],
   *      readout(x, y) -> text, xfmt, yfmt }
   */
  function lineChart(o) {
    const W = o.width || 640;
    const H = o.height || 340;
    const m = { l: 58, r: 20, t: 18, b: 48 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const sx = (x) => m.l + ((x - o.xmin) / (o.xmax - o.xmin)) * iw;
    const sy = (y) => m.t + ih - ((y - o.ymin) / (o.ymax - o.ymin)) * ih;
    const xfmt = o.xfmt || ((v) => C.fmt(v, 2));
    const yfmt = o.yfmt || ((v) => C.fmt(v, 2));

    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': o.label || 'Chart' });
    for (const y of niceTicks(o.ymin, o.ymax, 5)) {
      svg.append(s('line', { class: 'grid', x1: m.l, x2: W - m.r, y1: sy(y), y2: sy(y) }));
      svg.append(s('text', { class: 'tick', x: m.l - 8, y: sy(y) + 4, 'text-anchor': 'end' }, yfmt(y)));
    }
    for (const x of niceTicks(o.xmin, o.xmax, 7)) {
      svg.append(s('line', { class: 'grid v', x1: sx(x), x2: sx(x), y1: m.t, y2: m.t + ih }));
      svg.append(s('text', { class: 'tick', x: sx(x), y: m.t + ih + 18, 'text-anchor': 'middle' }, xfmt(x)));
    }
    svg.append(s('line', { class: 'axis', x1: m.l, x2: W - m.r, y1: m.t + ih, y2: m.t + ih }));
    svg.append(s('line', { class: 'axis', x1: m.l, x2: m.l, y1: m.t, y2: m.t + ih }));
    if (o.xlabel) svg.append(s('text', { class: 'axis-label', x: m.l + iw / 2, y: H - 8, 'text-anchor': 'middle' }, o.xlabel));
    if (o.ylabel) svg.append(s('text', { class: 'axis-label', transform: `translate(14 ${m.t + ih / 2}) rotate(-90)`, 'text-anchor': 'middle' }, o.ylabel));

    for (const v of o.vlines || []) {
      svg.append(s('line', { class: 'vline', x1: sx(v.x), x2: sx(v.x), y1: m.t, y2: m.t + ih }));
      svg.append(s('text', { class: 'vline-label', x: sx(v.x) + 5, y: m.t + 13 }, v.label));
    }
    const sample = (ser) => {
      if (ser.points) return ser.points;
      const pts = [];
      const n = 300;
      for (let i = 0; i <= n; i++) {
        const x = o.xmin + ((o.xmax - o.xmin) * i) / n;
        pts.push([x, ser.fn(x)]);
      }
      return pts;
    };
    (o.series || []).forEach((ser, i) => {
      const pts = sample(ser).filter((p) => isFinite(p[1]));
      const d = pts.map((p, j) => `${j ? 'L' : 'M'}${sx(p[0]).toFixed(1)} ${sy(Math.max(o.ymin, Math.min(o.ymax, p[1]))).toFixed(1)}`).join(' ');
      svg.append(s('path', { class: `line ${ser.cls || 's' + i}${ser.dashed ? ' dashed' : ''}`, d }));
    });
    for (const mk of o.markers || []) {
      svg.append(s('line', { class: 'drop', x1: sx(mk.x), x2: sx(mk.x), y1: sy(mk.y), y2: m.t + ih }));
      svg.append(s('line', { class: 'drop', x1: m.l, x2: sx(mk.x), y1: sy(mk.y), y2: sy(mk.y) }));
      svg.append(s('circle', { class: 'marker', cx: sx(mk.x), cy: sy(mk.y), r: 6 }));
      if (mk.label) {
        const right = sx(mk.x) < W * 0.62;
        svg.append(s('text', { class: 'marker-label', x: sx(mk.x) + (right ? 12 : -12), y: sy(mk.y) - 10, 'text-anchor': right ? 'start' : 'end' }, mk.label));
      }
    }
    (o.series || []).forEach((ser, i) => {
      if (!ser.name) return;
      const y = m.t + 14 + i * 16;
      const lx = o.legendLeft ? m.l + 14 : W - m.r - 150;
      svg.append(s('line', { class: `line ${ser.cls || 's' + i}${ser.dashed ? ' dashed' : ''}`, x1: lx, x2: lx + 22, y1: y - 4, y2: y - 4 }));
      svg.append(s('text', { class: 'legend', x: lx + 28, y }, ser.name));
    });

    // hover / touch read-out on the first series
    const first = (o.series || [])[0];
    if (first && (first.fn || o.readout)) {
      const cross = s('g', { class: 'cross', visibility: 'hidden' },
        s('line', { class: 'cross-line', y1: m.t, y2: m.t + ih }),
        s('circle', { class: 'cross-dot', r: 4.5 }),
        s('text', { class: 'cross-text' }));
      svg.append(cross);
      const cl = cross.children[0];
      const cd = cross.children[1];
      const ct = cross.children[2];
      const overlay = s('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' });
      const move = (ev) => {
        const r = svg.getBoundingClientRect();
        const px = ((ev.clientX - r.left) / r.width) * W;
        const x = Math.max(o.xmin, Math.min(o.xmax, o.xmin + ((px - m.l) / iw) * (o.xmax - o.xmin)));
        const y = first.fn ? first.fn(x) : NaN;
        if (!isFinite(y)) return;
        cl.setAttribute('x1', sx(x)); cl.setAttribute('x2', sx(x));
        cd.setAttribute('cx', sx(x)); cd.setAttribute('cy', sy(y));
        const right = sx(x) < W * 0.6;
        ct.setAttribute('x', sx(x) + (right ? 10 : -10));
        ct.setAttribute('y', Math.max(m.t + 12, sy(y) - 10));
        ct.setAttribute('text-anchor', right ? 'start' : 'end');
        ct.textContent = o.readout ? o.readout(x, y) : `${xfmt(x)} → ${yfmt(y)}`;
        cross.setAttribute('visibility', 'visible');
      };
      overlay.addEventListener('pointermove', move);
      overlay.addEventListener('pointerdown', move);
      overlay.addEventListener('pointerleave', () => cross.setAttribute('visibility', 'hidden'));
      svg.append(overlay);
    }
    return h('div', { class: 'chart-wrap' }, svg);
  }

  // ---------------------------------------------------------------------------
  // Quiz block (multiple choice with explanations)
  // ---------------------------------------------------------------------------
  function quizBlock(questions, quizKey, onDone) {
    const saved = store.get('quiz', {});
    const wrap = h('div', { class: 'quiz card' }, h('h3', null, 'Check your understanding'));
    const answered = {};
    function report() {
      const n = Object.keys(answered).length;
      if (n === questions.length) {
        const right = Object.values(answered).filter(Boolean).length;
        const all = store.get('quiz', {});
        all[quizKey] = { right, total: questions.length };
        store.set('quiz', all);
        if (onDone) onDone(right, questions.length);
      }
    }
    questions.forEach((q, qi) => {
      const fb = h('div', { class: 'quiz-fb', 'aria-live': 'polite' });
      const opts = h('div', { class: 'opts', role: 'group', 'aria-label': `Question ${qi + 1}` });
      q.options.forEach((text, oi) => {
        const b = h('button', { type: 'button', class: 'opt' }, text);
        b.addEventListener('click', () => {
          if (answered[qi] !== undefined) return;
          const ok = oi === q.answer;
          answered[qi] = ok;
          [...opts.children].forEach((btn, bi) => {
            btn.disabled = true;
            if (bi === q.answer) btn.classList.add('right');
            else if (bi === oi) btn.classList.add('wrong');
          });
          fb.className = 'quiz-fb ' + (ok ? 'ok' : 'no');
          fb.replaceChildren(h('strong', null, ok ? 'Correct. ' : 'Not quite. '), h('span', { html: q.why }));
          report();
        });
        opts.append(b);
      });
      wrap.append(h('div', { class: 'q' }, h('p', { class: 'q-text', html: `<b>${qi + 1}.</b> ${q.q}` }), opts, fb));
    });
    if (saved[quizKey]) wrap.append(h('p', { class: 'muted small' }, `Last score: ${saved[quizKey].right}/${saved[quizKey].total}`));
    return wrap;
  }

  Object.assign(DE, { h, s, fr, store, buildForm, createTool, notice, bigResult, chips, stepsList, factorTable, lineChart, quizBlock });
})();
