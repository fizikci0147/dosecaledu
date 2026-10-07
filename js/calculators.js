/* DoseCalc EDU - interactive calculators and explainer widgets.
 * Every widget is registered once and used both inside lessons and on the Calculators page. */
(function () {
  'use strict';
  const DE = window.DoseEdu;
  const C = window.DoseCalc;
  const { h, s, createTool, notice, bigResult, chips, stepsList, factorTable, lineChart } = DE;
  const { fmt, fix } = C;

  const widgets = {};
  const order = [];
  function reg(id, title, summary, group, mount) {
    widgets[id] = { id, title, summary, group, mount };
    order.push(id);
  }

  const allNumbers = (v, keys) => keys.every((k) => typeof v[k] === 'number' && isFinite(v[k]));
  const NEED_NUMBERS = { error: 'Please fill in every box with a number.' };
  const mmss = (minutes) => {
    const total = Math.round(minutes * 60);
    return `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, '0')} s`;
  };

  // ===========================================================================
  // 1. Fractionation and units
  // ===========================================================================
  reg('fractionation', 'Fractionation & units', 'Total dose, dose per fraction and number of fractions. Gy and cGy.', 'Basics', (el) => {
    createTool(el, {
      fields: [
        {
          key: 'solve', type: 'select', label: 'What do you want to find?', value: 'total',
          options: [
            { value: 'total', label: 'Total dose' },
            { value: 'perfx', label: 'Dose per fraction' },
            { value: 'n', label: 'Number of fractions' },
          ],
        },
        { key: 'd', label: 'Dose per fraction', value: 2, unit: 'Gy', min: 0.1, max: 30, step: 0.1, show: (v) => v.solve !== 'perfx' },
        { key: 'n', label: 'Number of fractions', value: 30, unit: 'fractions', min: 1, max: 60, step: 1, show: (v) => v.solve !== 'n' },
        { key: 'T', label: 'Total dose', value: 60, unit: 'Gy', min: 0.1, max: 120, step: 0.5, show: (v) => v.solve !== 'total' },
      ],
      compute(v) {
        const need = v.solve === 'total' ? ['d', 'n'] : v.solve === 'perfx' ? ['T', 'n'] : ['T', 'd'];
        if (!allNumbers(v, need) || need.some((k) => v[k] <= 0)) return NEED_NUMBERS;
        if (v.solve === 'total') {
          const T = v.d * v.n;
          return { label: 'Total dose', gy: T, unit: 'Gy', steps: [
            { title: 'Multiply dose per fraction by the number of fractions', formula: 'Total dose = Dose per fraction × Number of fractions', work: `${fmt(v.d)} Gy × ${fmt(v.n)}`, result: `${fmt(T, 2)} Gy` },
            { title: 'Convert to centigray (1 Gy = 100 cGy)', formula: 'cGy = Gy × 100', work: `${fmt(T, 2)} × 100`, result: `${fmt(T * 100, 1)} cGy` },
          ] };
        }
        if (v.solve === 'perfx') {
          const d = v.T / v.n;
          return { label: 'Dose per fraction', gy: d, unit: 'Gy', steps: [
            { title: 'Divide the total dose by the number of fractions', formula: 'Dose per fraction = Total dose ÷ Number of fractions', work: `${fmt(v.T)} Gy ÷ ${fmt(v.n)}`, result: `${fmt(d, 3)} Gy` },
            { title: 'Convert to centigray', formula: 'cGy = Gy × 100', work: `${fmt(d, 3)} × 100`, result: `${fmt(d * 100, 1)} cGy` },
          ] };
        }
        const n = v.T / v.d;
        return { label: 'Number of fractions', plain: n, steps: [
          { title: 'Divide the total dose by the dose per fraction', formula: 'Number of fractions = Total dose ÷ Dose per fraction', work: `${fmt(v.T)} Gy ÷ ${fmt(v.d)} Gy`, result: `${fmt(n, 2)} fractions` },
        ], note: Number.isInteger(Number(n.toFixed(6))) ? null : 'The answer is not a whole number. In practice you would round to a whole number of fractions and adjust the dose per fraction.' };
      },
      render(r) {
        const main = r.plain !== undefined ? bigResult(r.label, fmt(r.plain, 2), 'fractions') : bigResult(r.label, fmt(r.gy, 2), r.unit);
        const extra = r.gy !== undefined ? chips([{ label: 'in Gy', value: fmt(r.gy, 3) }, { label: 'in cGy', value: fmt(r.gy * 100, 1) }]) : null;
        return h('div', null, main, extra, r.note ? notice('info', r.note) : null, stepsList(r.steps));
      },
    });
  });

  // ===========================================================================
  // 2. Depth-dose explorer
  // ===========================================================================
  reg('pdd-explorer', 'Depth-dose explorer', 'Drag depth, field size and SSD and watch the PDD curve respond.', 'Beam physics', (el) => {
    createTool(el, {
      fields: [
        { key: 'depth', label: 'Depth of the point', value: 10, unit: 'cm', min: 0, max: 30, step: 0.5, slider: true },
        { key: 'size', label: 'Field size (square)', value: 10, unit: 'cm × cm', min: 3, max: 40, step: 1, slider: true },
        { key: 'ssd', label: 'SSD (source-to-skin distance)', value: 100, unit: 'cm', min: 60, max: 150, step: 1, slider: true },
        { key: 'rx', label: 'Dose you want at that depth', value: 200, unit: 'cGy', min: 1, max: 1000, step: 10 },
      ],
      compute(v) {
        if (!allNumbers(v, ['depth', 'size', 'ssd', 'rx'])) return NEED_NUMBERS;
        const d = Math.max(0, Math.min(30, v.depth));
        const pb = C.pddBreakdown(d, v.size, v.ssd);
        return { d, pb };
      },
      render(r, v) {
        const { d, pb } = r;
        const atDmax = v.rx / (pb.pdd / 100);
        const chart = lineChart({
          label: 'Percent depth dose versus depth',
          xmin: 0, xmax: 30, ymin: 0, ymax: 110, xlabel: 'Depth in tissue (cm)', ylabel: 'Dose (% of maximum)',
          series: [
            { fn: (x) => C.pddBreakdown(x, v.size, v.ssd).pdd, cls: 's0', name: 'Your settings' },
            { fn: (x) => C.pddBreakdown(x, 10, 100).pdd, cls: 's2', dashed: true, name: '10×10, SSD 100 (reference)' },
          ],
          vlines: [{ x: C.DMAX, label: 'dmax' }],
          markers: [{ x: d, y: pb.pdd, label: `${fmt(pb.pdd, 1)} %` }],
          readout: (x, y) => `${fmt(x, 1)} cm → ${fmt(y, 1)} %`,
          yfmt: (y) => fmt(y, 0),
        });
        const region = d < C.DMAX ? 'This point is in the build-up region: the dose is still rising toward dmax.'
          : d === C.DMAX ? 'This is dmax, the depth of maximum dose (100 %).'
            : `Beyond dmax the beam is weakened as it passes through tissue, so only ${fmt(pb.pdd, 1)} % of the maximum dose arrives here.`;
        return h('div', null,
          bigResult(`PDD at ${fmt(d, 1)} cm`, fmt(pb.pdd, 1), '%'),
          chips([
            { label: `Dose needed at dmax for ${fmt(v.rx)} cGy at depth`, value: fmt(atDmax, 0) + ' cGy' },
            { label: 'Extra dose at dmax vs. prescription', value: '+' + fmt((atDmax / v.rx - 1) * 100, 0) + ' %' },
          ]),
          notice('info', region),
          chart,
          h('p', { class: 'muted small' }, 'Hover or tap the curve to read values. Try making the field larger, or moving the SSD out to 120 cm, and see the curve rise: more scatter and a flatter inverse-square drop both help.'));
      },
    });
  });

  // ===========================================================================
  // 3. Inverse-square law
  // ===========================================================================
  function isqDiagram(d1, d2) {
    const W = 600;
    const X0 = 30;
    const cy = 116;
    const ppu = 440 / Math.max(d1, d2); // the farther plane always sits at x = 470
    const near = Math.min(d1, d2);
    const far = Math.max(d1, d2);
    const hFar = 90;
    const hNear = (hFar * near) / far;
    const hOf = (d) => (hFar * d) / far;
    const svg = s('svg', { viewBox: `0 0 ${W} 268`, class: 'diagram', role: 'img', 'aria-label': `Beam spreading from the source to a plane at ${fmt(d1)} cm and a plane at ${fmt(d2)} cm` });
    svg.append(s('path', { class: 'beam', d: `M${X0} ${cy} L${X0 + ppu * far} ${cy - hFar} L${X0 + ppu * far} ${cy + hFar} Z` }));
    svg.append(s('circle', { class: 'source', cx: X0, cy, r: 7 }));
    svg.append(s('text', { class: 'dg-text', x: X0, y: cy + 28, 'text-anchor': 'middle' }, 'Source'));
    // nearer plane: label on its left; farther plane: label on its right; distance rows are staggered
    const planes = [
      { d: d1, name: 'd₁', cls: 'p1' },
      { d: d2, name: 'd₂', cls: 'p2' },
    ];
    planes.forEach((p) => {
      const x = X0 + ppu * p.d;
      const hh = hOf(p.d);
      const isNear = p.d < far || (d1 === d2 && p.name === 'd₁');
      const row = isNear ? 230 : 252;
      svg.append(s('line', { class: 'plane ' + p.cls, x1: x, x2: x, y1: cy - hh, y2: cy + hh }));
      svg.append(s('line', { class: 'dim', x1: X0, x2: x, y1: row - 14, y2: row - 14 }));
      svg.append(s('line', { class: 'dim', x1: x, x2: x, y1: row - 20, y2: row - 8 }));
      svg.append(s('text', { class: 'dg-text', x: x, y: row + 4, 'text-anchor': 'end' }, `${p.name} = ${fmt(p.d)} cm`));
      svg.append(s('text', { class: 'dg-note', x: isNear ? x - 8 : x + 8, y: cy - hh - 6, 'text-anchor': isNear ? 'end' : 'start' }, `area ${fmt((p.d / d1) ** 2, 2)}×`));
    });
    return h('div', { class: 'chart-wrap' }, svg);
  }

  reg('inverse-square', 'Inverse-square law', 'How dose rate changes when you move closer to or farther from the source.', 'Beam physics', (el) => {
    createTool(el, {
      fields: [
        { key: 'r1', label: 'Dose rate at the first distance', value: 100, unit: 'cGy/min', min: 0.01, step: 1 },
        { key: 'd1', label: 'First distance (from source)', value: 100, unit: 'cm', min: 1, max: 500, step: 1 },
        { key: 'd2', label: 'New distance (from source)', value: 120, unit: 'cm', min: 1, max: 500, step: 1, slider: true },
      ],
      compute(v) {
        if (!allNumbers(v, ['r1', 'd1', 'd2']) || v.r1 <= 0 || v.d1 <= 0 || v.d2 <= 0) return NEED_NUMBERS;
        const f = C.inverseSquareFactor(v.d1, v.d2);
        return { f, r2: v.r1 * f };
      },
      render(r, v) {
        const steps = [
          { title: 'Compare the distances', formula: 'Factor = (d₁ ÷ d₂)²', work: `(${fmt(v.d1)} ÷ ${fmt(v.d2)})² = ${fix(v.d1 / v.d2, 4)}²`, result: `Factor = ${fix(r.f, 4)}`, why: r.f < 1 ? 'Farther away, so the dose rate goes down.' : r.f > 1 ? 'Closer to the source, so the dose rate goes up.' : 'Same distance, so no change.' },
          { title: 'Apply the factor to the dose rate', formula: 'New dose rate = Old dose rate × Factor', work: `${fmt(v.r1)} × ${fix(r.f, 4)}`, result: `${fmt(r.r2, 2)} cGy/min` },
        ];
        return h('div', null,
          bigResult('Dose rate at the new distance', fmt(r.r2, 2), 'cGy/min'),
          chips([{ label: 'Inverse-square factor', value: fix(r.f, 4) }, { label: 'Change', value: (r.f >= 1 ? '+' : '') + fmt((r.f - 1) * 100, 1) + ' %' }]),
          isqDiagram(v.d1, v.d2),
          h('p', { class: 'muted small' }, 'Why squared? The same radiation spreads over an area that grows with the square of the distance. Twice as far means four times the area, so a quarter of the dose rate.'),
          stepsList(steps));
      },
    });
  });

  // ===========================================================================
  // 4. Mayneord F factor
  // ===========================================================================
  reg('mayneord', 'Mayneord F factor', 'Convert a PDD measured at one SSD to a different SSD.', 'Beam physics', (el) => {
    createTool(el, {
      fields: [
        { key: 'p1', label: 'PDD at the original SSD', value: 65, unit: '%', min: 1, max: 100, step: 0.1 },
        { key: 'f1', label: 'Original SSD (f₁)', value: 80, unit: 'cm', min: 40, max: 250, step: 1 },
        { key: 'f2', label: 'New SSD (f₂)', value: 100, unit: 'cm', min: 40, max: 250, step: 1, slider: true },
        { key: 'depth', label: 'Depth', value: 10, unit: 'cm', min: 0.5, max: 40, step: 0.5 },
        { key: 'dmax', label: 'Depth of maximum dose (dmax)', value: 1.5, unit: 'cm', min: 0.5, max: 4, step: 0.1 },
      ],
      compute(v) {
        if (!allNumbers(v, ['p1', 'f1', 'f2', 'depth', 'dmax'])) return NEED_NUMBERS;
        if (v.depth <= v.dmax) return { error: 'The Mayneord F factor only applies deeper than dmax. Choose a depth greater than dmax.' };
        const F = C.mayneordF(v.f1, v.f2, v.depth, v.dmax);
        return { F, p2: v.p1 * F };
      },
      render(r, v) {
        const a = (v.f2 + v.dmax) / (v.f2 + v.depth);
        const b = (v.f1 + v.depth) / (v.f1 + v.dmax);
        const steps = [
          { title: 'Inverse-square part for the NEW SSD', formula: '((f₂ + dmax) ÷ (f₂ + d))²', work: `((${fmt(v.f2)} + ${fmt(v.dmax)}) ÷ (${fmt(v.f2)} + ${fmt(v.depth)}))² = (${fix(a, 4)})²`, result: fix(a * a, 4), why: 'How much the beam weakens from dmax to the point, because of distance alone, at the new SSD.' },
          { title: 'Inverse-square part for the OLD SSD', formula: '((f₁ + d) ÷ (f₁ + dmax))²', work: `((${fmt(v.f1)} + ${fmt(v.depth)}) ÷ (${fmt(v.f1)} + ${fmt(v.dmax)}))² = (${fix(b, 4)})²`, result: fix(b * b, 4), why: 'The same quantity at the old SSD, inverted so that it cancels out of the measured PDD.' },
          { title: 'Multiply to get F', formula: 'F = ((f₂ + dmax) ÷ (f₂ + d))² × ((f₁ + d) ÷ (f₁ + dmax))²', work: `${fix(a * a, 4)} × ${fix(b * b, 4)}`, result: `F = ${fix(r.F, 4)}` },
          { title: 'Correct the PDD', formula: 'New PDD = Old PDD × F', work: `${fmt(v.p1, 2)} × ${fix(r.F, 4)}`, result: `${fmt(r.p2, 2)} %` },
        ];
        return h('div', null,
          bigResult('PDD at the new SSD', fmt(r.p2, 2), '%'),
          chips([{ label: 'Mayneord F', value: fix(r.F, 4) }, { label: 'Change in PDD', value: (r.F >= 1 ? '+' : '') + fmt((r.F - 1) * 100, 1) + ' %' }]),
          r.p2 > 100 ? notice('warn', 'The result is above 100 %, which cannot happen for a real PDD. Check your inputs.') : null,
          notice('info', r.F > 1 ? 'Larger SSD means a flatter inverse-square drop between dmax and the point, so the PDD goes up.' : r.F < 1 ? 'Smaller SSD means a steeper inverse-square drop, so the PDD goes down.' : 'Same SSD, so nothing changes.'),
          stepsList(steps),
          h('p', { class: 'muted small' }, 'Mayneord F is an approximation: it corrects for the inverse-square law only and ignores small changes in scatter. It works best for moderate SSD changes.'));
      },
    });
  });

  // ===========================================================================
  // 5. Field size: equivalent square, Sc, Sp
  // ===========================================================================
  reg('field-size', 'Field size & output factors', 'Equivalent square, collimator scatter (Sc) and phantom scatter (Sp).', 'Beam physics', (el) => {
    createTool(el, {
      fields: [
        { key: 'w', label: 'Field width', value: 10, unit: 'cm', min: 3, max: 40, step: 0.5, slider: true },
        { key: 'l', label: 'Field length', value: 20, unit: 'cm', min: 3, max: 40, step: 0.5, slider: true },
      ],
      compute(v) {
        if (!allNumbers(v, ['w', 'l'])) return NEED_NUMBERS;
        if (v.w < 3 || v.l < 3 || v.w > 40 || v.l > 40) return { error: 'Field dimensions must be between 3 and 40 cm.' };
        const es = C.equivalentSquare(v.w, v.l);
        return { es, sc: C.sc(es), sp: C.sp(es) };
      },
      render(r, v) {
        const scp = r.sc * r.sp;
        const bar = (label, val) => h('div', { class: 'bar-row' },
          h('div', { class: 'bar-label' }, label),
          h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: `width:${Math.max(2, Math.min(100, ((val - 0.9) / 0.2) * 100))}%` })),
          h('div', { class: 'bar-val' }, fix(val, 3)));
        const steps = [
          { title: 'Equivalent square', formula: '4 × Area ÷ Perimeter', work: `4 × (${fmt(v.w)} × ${fmt(v.l)}) ÷ (2 × (${fmt(v.w)} + ${fmt(v.l)}))`, result: `${fmt(r.es, 2)} cm` },
          { title: 'Look up Sc and Sp at this size', formula: 'Tables: Sc(ES), Sp(ES)', work: `Sc = ${fix(r.sc, 3)},  Sp = ${fix(r.sp, 3)}`, result: `Sc × Sp = ${fix(scp, 4)}`, why: 'Both factors are 1.000 for the 10×10 reference field.' },
        ];
        const chart = lineChart({
          label: 'Total output factor versus equivalent square',
          xmin: 3, xmax: 40, ymin: 0.9, ymax: 1.1, xlabel: 'Equivalent square (cm)', ylabel: 'Output factor',
          series: [
            { fn: (x) => C.sc(x) * C.sp(x), cls: 's0', name: 'Sc × Sp' },
            { fn: (x) => C.sc(x), cls: 's1', name: 'Sc (head scatter)', dashed: true },
            { fn: (x) => C.sp(x), cls: 's2', name: 'Sp (patient scatter)', dashed: true },
          ],
          markers: [{ x: r.es, y: scp, label: `${fix(scp, 3)}` }],
          readout: (x, y) => `${fmt(x, 1)} cm → Sc×Sp ${fix(y, 3)}`,
          yfmt: (y) => fix(y, 2),
        });
        return h('div', null,
          bigResult('Equivalent square', fmt(r.es, 2), 'cm'),
          h('div', { class: 'bars' }, bar('Sc', r.sc), bar('Sp', r.sp), bar('Sc × Sp', scp)),
          notice('info', scp < 1
            ? `Each MU delivers ${fmt((1 - scp) * 100, 1)} % LESS dose than in the 10×10 reference field, so you need more MU for the same dose.`
            : scp > 1 ? `Each MU delivers ${fmt((scp - 1) * 100, 1)} % MORE dose than in the 10×10 reference field, so you need fewer MU for the same dose.`
              : 'This is the reference field size, so the output factors are exactly 1.'),
          chart, stepsList(steps));
      },
    });
  });

  // ===========================================================================
  // 6 & 7. Monitor unit calculators
  // ===========================================================================
  function muFields(tech) {
    const f = [
      { key: 'dose', label: 'Prescribed dose at the point', value: 200, unit: 'cGy', min: 1, max: 1000, step: 10, help: '200 cGy = 2 Gy' },
      { key: 'depth', label: 'Depth of the point', value: 8, unit: 'cm', min: 1.5, max: 30, step: 0.5, slider: true },
      { key: 'width', label: tech === 'SSD' ? 'Field width on the skin' : 'Field width at isocentre', value: 10, unit: 'cm', min: 3, max: 40, step: 0.5 },
      { key: 'length', label: tech === 'SSD' ? 'Field length on the skin' : 'Field length at isocentre', value: 12, unit: 'cm', min: 3, max: 40, step: 0.5 },
    ];
    if (tech === 'SSD') f.push({ key: 'ssd', label: 'SSD (source-to-skin distance)', value: 100, unit: 'cm', min: 50, max: 200, step: 1, slider: true });
    f.push(
      { key: 'wedge', type: 'select', label: 'Wedge', value: 'none', options: Object.entries(C.WEDGES).map(([value, w]) => ({ value, label: `${w.label}${w.factor === 1 ? '' : ' (WF ' + fix(w.factor, 2) + ')'}` })) },
      { key: 'tray', type: 'select', label: 'Blocking tray', value: 'none', options: Object.entries(C.TRAYS).map(([value, t]) => ({ value, label: `${t.label}${t.factor === 1 ? '' : ' (TF ' + fix(t.factor, 2) + ')'}` })) },
      { key: 'adv', type: 'select', label: 'Machine settings', value: 'no', options: [{ value: 'no', label: 'Standard: 1.000 cGy/MU, 600 MU/min' }, { value: 'yes', label: 'Customise…' }] },
      { key: 'K', label: 'Calibration K', value: 1, unit: 'cGy/MU', min: 0.5, max: 1.5, step: 0.001, show: (v) => v.adv === 'yes' },
      { key: 'cal', type: 'select', label: 'Calibration geometry', value: 'SAD', show: (v) => v.adv === 'yes',
        options: [{ value: 'SAD', label: 'dmax point is 100 cm from source' }, { value: 'SSD', label: 'Skin surface is 100 cm from source' }] },
      { key: 'rate', label: 'Dose rate setting', value: 600, unit: 'MU/min', min: 50, max: 2400, step: 50, show: (v) => v.adv === 'yes' });
    return f;
  }

  function muInput(v, tech) {
    const keys = ['dose', 'depth', 'width', 'length'].concat(tech === 'SSD' ? ['ssd'] : []);
    const input = { dose: v.dose, depth: v.depth, width: v.width, length: v.length, wedge: v.wedge, tray: v.tray };
    if (tech === 'SSD') input.ssd = v.ssd;
    if (v.adv === 'yes') {
      if (!allNumbers(v, ['K', 'rate']) || v.K <= 0 || v.rate <= 0) return { error: 'Enter a positive calibration and dose rate.' };
      input.machine = { K: v.K, calibration: v.cal, rate: v.rate };
    }
    if (!allNumbers(v, keys)) return { error: NEED_NUMBERS.error };
    return { input };
  }

  function renderMU(r, v, tech) {
    const seconds = r.beamOnMin * 60;
    return h('div', null,
      bigResult('Monitor units to deliver', fmt(r.muRounded, 0), 'MU'),
      chips([
        { label: 'Exact value', value: fmt(r.mu, 2) },
        { label: 'Dose per MU at the point', value: fix(r.perMU, 4) + ' cGy' },
        { label: 'Beam-on time', value: seconds >= 90 ? mmss(r.beamOnMin) : fmt(seconds, 0) + ' s' },
        { label: 'Dose at dmax (hot spot)', value: fmt(r.doseAtDmax, 0) + ' cGy' },
      ]),
      r.hotspotPct > 130 ? notice('info', `With one beam, the tissue at dmax receives ${fmt(r.doseAtDmax, 0)} cGy, which is ${fmt(r.hotspotPct, 0)} % of the prescription. This is why treatments often combine several beams from different angles.`) : null,
      tech === 'SAD' && r.cross ? notice('info', `Cross-check: treating the same patient at a fixed SSD of ${fmt(r.cross.ssd, 1)} cm would need ${fmt(r.cross.mu, 1)} MU, a difference of ${fmt(Math.abs(r.cross.diffPct), 2)} %. The two techniques should agree closely; tiny differences come from rounding in the tables.`) : null,
      h('h4', { class: 'sub' }, 'The ingredients'),
      factorTable(r.factors),
      stepsList(r.steps),
      h('p', { class: 'muted small' }, 'Teaching model with generic 6 MV-like data (dmax = 1.5 cm). Not for clinical use.'));
  }

  reg('mu-ssd', 'Monitor units: SSD technique', 'Fixed source-to-skin distance. Uses PDD and the inverse-square factor.', 'Monitor units', (el) => {
    createTool(el, {
      fields: muFields('SSD'),
      compute(v) {
        const x = muInput(v, 'SSD');
        if (x.error) return x;
        const r = C.muSSD(x.input);
        return r.ok ? r : { error: r.error };
      },
      render: (r, v) => renderMU(r, v, 'SSD'),
    });
  });

  reg('mu-sad', 'Monitor units: SAD (isocentric) technique', 'Isocentre inside the patient. Uses TMR, no inverse-square factor.', 'Monitor units', (el) => {
    createTool(el, {
      fields: muFields('SAD'),
      compute(v) {
        const x = muInput(v, 'SAD');
        if (x.error) return x;
        const r = C.muSAD(x.input);
        return r.ok ? r : { error: r.error };
      },
      render: (r, v) => renderMU(r, v, 'SAD'),
    });
  });

  function workedExample(title, problem, result) {
    return h('div', { class: 'worked card' },
      h('div', { class: 'worked-tag' }, 'Worked example'),
      h('h3', null, title),
      h('p', { html: problem }),
      bigResult('Answer', fmt(result.muRounded, 0), 'MU'),
      stepsList(result.steps, false));
  }
  reg('worked-ssd', 'Worked example: SSD technique', 'A full calculation, explained one step at a time.', 'Examples', (el) => {
    const r = C.muSSD({ dose: 200, depth: 8, width: 12, length: 15, ssd: 100, tray: 'tray' });
    el.append(workedExample('200 cGy at 8 cm depth, SSD 100 cm',
      'A patient is treated with a single <b>12 × 15 cm</b> field at <b>SSD 100 cm</b>, through a blocking tray. The prescription is <b>200 cGy at 8 cm depth</b>. How many monitor units?', r));
  });
  reg('worked-sad', 'Worked example: SAD technique', 'A full isocentric calculation with a wedge.', 'Examples', (el) => {
    const r = C.muSAD({ dose: 180, depth: 10, width: 8, length: 8, wedge: '45' });
    el.append(workedExample('180 cGy at isocentre, 10 cm deep, 45° wedge',
      'The isocentre is <b>10 cm deep</b>. The field is <b>8 × 8 cm</b> at the isocentre with a <b>45° wedge</b>. The prescription is <b>180 cGy</b>. How many monitor units?', r));
  });

  // ===========================================================================
  // 8. BED and EQD2
  // ===========================================================================
  const AB_OPTIONS = [
    { value: '10', label: 'α/β = 10 Gy: most tumours, early-responding tissue' },
    { value: '3', label: 'α/β = 3 Gy: late-responding normal tissue' },
    { value: '1.5', label: 'α/β = 1.5 Gy: prostate (commonly assumed)' },
    { value: 'custom', label: 'Custom value…' },
  ];
  const abOf = (v) => (v.abPreset === 'custom' ? v.abCustom : parseFloat(v.abPreset));

  reg('bed', 'BED & EQD2 (biological dose)', 'Compare different fractionation schedules on one biological scale.', 'Radiobiology', (el) => {
    createTool(el, {
      fields: [
        { key: 'n', label: 'Number of fractions', value: 20, unit: 'fractions', min: 1, max: 60, step: 1 },
        { key: 'd', label: 'Dose per fraction', value: 2.75, unit: 'Gy', min: 0.1, max: 30, step: 0.05, slider: true },
        { key: 'abPreset', type: 'select', label: 'Tissue (α/β ratio)', value: '10', options: AB_OPTIONS },
        { key: 'abCustom', label: 'Custom α/β', value: 5, unit: 'Gy', min: 0.5, max: 30, step: 0.5, show: (v) => v.abPreset === 'custom' },
      ],
      compute(v) {
        const ab = abOf(v);
        if (!allNumbers(v, ['n', 'd']) || !isFinite(ab) || v.n <= 0 || v.d <= 0 || ab <= 0) return NEED_NUMBERS;
        return { ab, T: v.n * v.d, bed: C.bed(v.n, v.d, ab), eqd2: C.eqd2(v.n, v.d, ab) };
      },
      render(r, v) {
        const steps = [
          { title: 'Total physical dose', formula: 'Total = n × d', work: `${fmt(v.n)} × ${fmt(v.d, 3)}`, result: `${fmt(r.T, 2)} Gy` },
          { title: 'Biologically effective dose', formula: 'BED = n × d × (1 + d ÷ (α/β))', work: `${fmt(v.n)} × ${fmt(v.d, 3)} × (1 + ${fmt(v.d, 3)} ÷ ${fmt(r.ab)})`, result: `BED = ${fmt(r.bed, 2)} Gy${fmt(r.ab)}`, why: 'The bracket is the "fraction-size penalty": the bigger each fraction, the more biological effect per Gy.' },
          { title: 'Equivalent dose in 2 Gy fractions', formula: 'EQD2 = BED ÷ (1 + 2 ÷ (α/β))', work: `${fmt(r.bed, 2)} ÷ (1 + 2 ÷ ${fmt(r.ab)})`, result: `EQD2 = ${fmt(r.eqd2, 2)} Gy`, why: 'EQD2 answers: "what total dose, given in ordinary 2 Gy fractions, would have the same biological effect?"' },
        ];
        const T = r.T;
        const chart = lineChart({
          label: 'BED versus dose per fraction for the same total dose', legendLeft: true,
          xmin: 0.5, xmax: 10, ymin: 0, ymax: Math.ceil((T * (1 + 10 / Math.min(3, r.ab))) / 10) * 10,
          xlabel: 'Dose per fraction (Gy), same total dose', ylabel: 'BED (Gy)',
          series: [
            { fn: (x) => T * (1 + x / 3), cls: 's1', name: 'Late tissue (α/β 3)' },
            { fn: (x) => T * (1 + x / 10), cls: 's0', name: 'Tumour (α/β 10)' },
          ],
          markers: [{ x: Math.min(10, v.d), y: T * (1 + Math.min(10, v.d) / r.ab), label: `${fmt(r.bed, 1)}` }],
          readout: (x, y) => `${fmt(x, 1)} Gy/fx → BED ${fmt(y, 1)}`,
          xfmt: (x) => fmt(x, 1), yfmt: (y) => fmt(y, 0),
        });
        return h('div', null,
          bigResult('Biologically effective dose (BED)', fmt(r.bed, 1), `Gy${fmt(r.ab)}`),
          chips([{ label: 'EQD2', value: fmt(r.eqd2, 1) + ' Gy' }, { label: 'Total physical dose', value: fmt(T, 1) + ' Gy' }, { label: 'α/β used', value: fmt(r.ab) + ' Gy' }]),
          chart,
          h('p', { class: 'muted small' }, 'The chart keeps the total physical dose fixed. Larger fractions raise late-tissue BED much faster than tumour BED. That is the biological reason hypofractionation needs care.'),
          stepsList(steps),
          h('p', { class: 'muted small' }, 'Simple linear-quadratic model. It ignores tumour repopulation during treatment and incomplete repair between fractions.'));
      },
    });
  });

  // ===========================================================================
  // 9. Equivalent regimen converter
  // ===========================================================================
  reg('regimen', 'Fractionation converter', 'Find the dose per fraction that gives the same biological effect in a different number of fractions.', 'Radiobiology', (el) => {
    createTool(el, {
      fields: [
        { type: 'heading', label: 'Schedule you know' },
        { key: 'n1', label: 'Fractions', value: 30, unit: 'fractions', min: 1, max: 60, step: 1 },
        { key: 'd1', label: 'Dose per fraction', value: 2, unit: 'Gy', min: 0.1, max: 30, step: 0.1 },
        { type: 'heading', label: 'Schedule you want' },
        { key: 'n2', label: 'New number of fractions', value: 20, unit: 'fractions', min: 1, max: 60, step: 1 },
        { key: 'abPreset', type: 'select', label: 'Tissue (α/β ratio)', value: '3', options: AB_OPTIONS },
        { key: 'abCustom', label: 'Custom α/β', value: 5, unit: 'Gy', min: 0.5, max: 30, step: 0.5, show: (v) => v.abPreset === 'custom' },
      ],
      compute(v) {
        const ab = abOf(v);
        if (!allNumbers(v, ['n1', 'd1', 'n2']) || !isFinite(ab) || v.n1 <= 0 || v.d1 <= 0 || v.n2 <= 0 || ab <= 0) return NEED_NUMBERS;
        const b = C.bed(v.n1, v.d1, ab);
        const d2 = C.equivalentDosePerFraction(b, v.n2, ab);
        return { ab, b, d2, T1: v.n1 * v.d1, T2: v.n2 * d2 };
      },
      render(r, v) {
        const steps = [
          { title: 'BED of the schedule you know', formula: 'BED = n₁ × d₁ × (1 + d₁ ÷ (α/β))', work: `${fmt(v.n1)} × ${fmt(v.d1, 3)} × (1 + ${fmt(v.d1, 3)} ÷ ${fmt(r.ab)})`, result: `BED = ${fmt(r.b, 2)} Gy${fmt(r.ab)}` },
          { title: 'Find d₂ so the new schedule has the same BED', formula: 'n₂ × d₂ × (1 + d₂ ÷ (α/β)) = BED   →   d₂ = ( −(α/β) + √((α/β)² + 4 × (α/β) × BED ÷ n₂) ) ÷ 2', work: `d₂ = ( −${fmt(r.ab)} + √(${fmt(r.ab)}² + 4 × ${fmt(r.ab)} × ${fmt(r.b, 2)} ÷ ${fmt(v.n2)}) ) ÷ 2`, result: `d₂ = ${fmt(r.d2, 3)} Gy`, why: 'This comes from rearranging the BED equation into a quadratic in d₂ and solving it.' },
          { title: 'Total dose of the new schedule', formula: 'Total = n₂ × d₂', work: `${fmt(v.n2)} × ${fmt(r.d2, 3)}`, result: `${fmt(r.T2, 2)} Gy` },
        ];
        return h('div', null,
          bigResult('Equivalent dose per fraction', fmt(r.d2, 2), 'Gy'),
          chips([{ label: 'New total dose', value: fmt(r.T2, 1) + ' Gy' }, { label: 'Old total dose', value: fmt(r.T1, 1) + ' Gy' }, { label: 'Same BED', value: fmt(r.b, 1) + ' Gy' + fmt(r.ab) }]),
          notice('info', `${fmt(v.n2)} fractions of ${fmt(r.d2, 2)} Gy has the same biological effect (for α/β = ${fmt(r.ab)} Gy) as ${fmt(v.n1)} fractions of ${fmt(v.d1, 2)} Gy. The total physical dose is ${r.T2 < r.T1 ? 'lower' : 'higher'} because the fractions are ${r.d2 > v.d1 ? 'larger' : 'smaller'}.`),
          stepsList(steps),
          h('p', { class: 'muted small' }, 'Real prescriptions are chosen by clinicians using trial evidence, not by this formula alone.'));
      },
    });
  });

  // ===========================================================================
  // 10. Radioactive decay
  // ===========================================================================
  reg('decay', 'Radioactive decay', 'How much activity is left after some time? Half-lives of common clinical sources.', 'Sources', (el) => {
    createTool(el, {
      fields: [
        { key: 'iso', type: 'select', label: 'Radioactive source', value: 'Ir-192',
          options: Object.entries(C.ISOTOPES).map(([k, i]) => ({ value: k, label: `${k} (${i.use})` })).concat([{ value: 'custom', label: 'Custom half-life…' }]) },
        { key: 'hl', label: 'Half-life', value: 30, unit: 'days', min: 0.01, step: 1, show: (v) => v.iso === 'custom' },
        { key: 'a0', label: 'Starting activity', value: 10, unit: 'Ci (any unit)', min: 0.0001, step: 0.5 },
        { key: 't', label: 'Time elapsed', value: 90, min: 0, step: 1 },
        { key: 'unit', type: 'select', label: 'Time unit', value: 'days', options: Object.keys(C.TIME_UNITS_DAYS).map((u) => ({ value: u, label: u })) },
      ],
      compute(v) {
        if (!allNumbers(v, ['a0', 't']) || v.a0 <= 0 || v.t < 0) return NEED_NUMBERS;
        const hl = v.iso === 'custom' ? v.hl : C.ISOTOPES[v.iso].halfLifeDays;
        if (!isFinite(hl) || hl <= 0) return NEED_NUMBERS;
        const tDays = v.t * C.TIME_UNITS_DAYS[v.unit];
        const n = tDays / hl;
        const frac = C.remainingFraction(tDays, hl);
        return { hl, tDays, n, frac, a: v.a0 * frac, lambda: C.decayConstant(hl) };
      },
      render(r, v) {
        const hlText = r.hl >= 365 ? `${fmt(r.hl / 365.25, 2)} years` : `${fmt(r.hl, 2)} days`;
        const steps = [
          { title: 'Count how many half-lives have passed', formula: 'n = elapsed time ÷ half-life', work: `${fmt(r.tDays, 2)} days ÷ ${fmt(r.hl, 2)} days`, result: `n = ${fmt(r.n, 3)} half-lives`, why: 'Everything in decay is measured in half-lives. One half-life: half left. Two: a quarter. Three: an eighth.' },
          { title: 'Fraction remaining', formula: 'Fraction = (½)ⁿ', work: `0.5 ^ ${fmt(r.n, 3)}`, result: `${fix(r.frac, 4)}  (${fmt(r.frac * 100, 2)} %)` },
          { title: 'Activity now', formula: 'A = A₀ × Fraction', work: `${fmt(v.a0)} × ${fix(r.frac, 4)}`, result: `${fmt(r.a, 3)}` },
          { title: 'Decay constant (for reference)', formula: 'λ = 0.693 ÷ half-life', work: `0.693 ÷ ${fmt(r.hl, 2)} days`, result: `λ = ${fmt(r.lambda, 5)} per day`, why: 'The same law written as A = A₀ × e^(−λt). Both forms give identical answers.' },
        ];
        const xmax = Math.min(10, Math.max(5, Math.ceil(r.n * 1.1)));
        const chart = lineChart({
          label: 'Percent of activity remaining versus half-lives elapsed',
          xmin: 0, xmax, ymin: 0, ymax: 105, xlabel: 'Half-lives elapsed', ylabel: 'Activity remaining (%)',
          series: [{ fn: (x) => 100 * Math.pow(0.5, x), cls: 's0' }],
          markers: [{ x: Math.min(xmax, r.n), y: r.frac * 100, label: `${fmt(r.frac * 100, 1)} %` }],
          readout: (x, y) => `${fmt(x, 2)} half-lives → ${fmt(y, 1)} %`, yfmt: (y) => fmt(y, 0), xfmt: (x) => fmt(x, 0),
        });
        return h('div', null,
          bigResult('Activity remaining', fmt(r.a, 3), 'same unit as the start'),
          chips([{ label: 'Fraction left', value: fmt(r.frac * 100, 2) + ' %' }, { label: 'Half-lives elapsed', value: fmt(r.n, 2) }, { label: 'Half-life', value: hlText }]),
          chart, stepsList(steps));
      },
    });
  });

  // ===========================================================================
  // 11. Cobalt-60 treatment time
  // ===========================================================================
  reg('co60', 'Cobalt-60 treatment time', 'Cobalt units have no monitor units: you calculate the beam-on time, and it grows as the source decays.', 'Sources', (el) => {
    createTool(el, {
      fields: [
        { key: 'r0', label: 'Dose rate on the reference date', value: 150, unit: 'cGy/min', min: 1, max: 500, step: 1, help: 'At the prescription point, for this field size and depth.' },
        { key: 'months', label: 'Time since the reference date', value: 18, unit: 'months', min: 0, max: 120, step: 1, slider: true },
        { key: 'dose', label: 'Prescribed dose', value: 200, unit: 'cGy', min: 1, max: 1000, step: 10 },
      ],
      compute(v) {
        if (!allNumbers(v, ['r0', 'months', 'dose']) || v.r0 <= 0 || v.dose <= 0 || v.months < 0) return NEED_NUMBERS;
        const years = v.months / 12;
        return { years, ...C.co60Time(v.r0, years, v.dose), t0: v.dose / v.r0 };
      },
      render(r, v) {
        const T = C.CO60_HALF_LIFE_YEARS;
        const steps = [
          { title: 'Fraction of the original activity left', formula: 'Fraction = (½)^(t ÷ T½)   with T½ = 5.27 years', work: `0.5 ^ (${fmt(r.years, 3)} ÷ ${T})`, result: `${fix(r.fraction, 4)}  (${fmt(r.fraction * 100, 2)} %)`, why: 'Co-60 loses about 1.1 % of its output every month.' },
          { title: 'Dose rate today', formula: 'Rate = Rate on reference date × Fraction', work: `${fmt(v.r0)} × ${fix(r.fraction, 4)}`, result: `${fmt(r.rate, 2)} cGy/min` },
          { title: 'Treatment time', formula: 'Time = Prescribed dose ÷ Dose rate', work: `${fmt(v.dose)} ÷ ${fmt(r.rate, 2)}`, result: `${fmt(r.minutes, 3)} min  =  ${mmss(r.minutes)}`, why: 'A weaker source needs a longer beam-on time to deliver the same dose.' },
        ];
        const xmax = Math.max(10, Math.ceil(r.years * 1.2));
        const chart = lineChart({
          label: 'Cobalt-60 dose rate versus time',
          xmin: 0, xmax, ymin: 0, ymax: Math.ceil(v.r0 * 1.05 / 10) * 10, xlabel: 'Years since reference date', ylabel: 'Dose rate (cGy/min)',
          series: [{ fn: (x) => v.r0 * Math.pow(0.5, x / T), cls: 's0' }],
          markers: [{ x: r.years, y: r.rate, label: `${fmt(r.rate, 1)} cGy/min` }],
          readout: (x, y) => `${fmt(x, 1)} y → ${fmt(y, 1)} cGy/min`, yfmt: (y) => fmt(y, 0), xfmt: (x) => fmt(x, 0),
        });
        return h('div', null,
          bigResult('Treatment time', mmss(r.minutes), ''),
          chips([{ label: 'Dose rate today', value: fmt(r.rate, 1) + ' cGy/min' }, { label: 'Time on reference date', value: mmss(r.t0) }, { label: 'Longer by', value: fmt((r.minutes / r.t0 - 1) * 100, 1) + ' %' }]),
          chart, stepsList(steps));
      },
    });
  });

  DE.widgets = widgets;
  DE.widgetOrder = order;
  DE.mountWidget = function (id, el) {
    const w = widgets[id];
    if (!w) { el.append(notice('warn', `Unknown widget: ${id}`)); return; }
    w.mount(el);
  };
})();
