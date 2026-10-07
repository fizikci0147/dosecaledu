'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calc.js');

const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg || ''} expected ${expected} ± ${tol}, got ${actual}`);

// ---------------------------------------------------------------------------
// Geometry and scatter factors
// ---------------------------------------------------------------------------
test('equivalent square 4A/P', () => {
  near(C.equivalentSquare(10, 10), 10, 1e-9);
  near(C.equivalentSquare(10, 20), 13.3333, 1e-3);
  near(C.equivalentSquare(5, 15), 7.5, 1e-9);
});

test('Sc and Sp are exactly 1.000 for the 10x10 reference field and grow with field size', () => {
  near(C.sc(10), 1, 1e-12);
  near(C.sp(10), 1, 1e-12);
  let prevC = 0;
  let prevP = 0;
  for (let s = 3; s <= 40; s += 0.5) {
    assert.ok(C.sc(s) > prevC, `Sc must rise with field size at ${s}`);
    assert.ok(C.sp(s) > prevP, `Sp must rise with field size at ${s}`);
    prevC = C.sc(s);
    prevP = C.sp(s);
  }
  assert.ok(C.sc(4) < 1 && C.sc(30) > 1);
  assert.ok(C.sp(4) < 1 && C.sp(30) > 1);
});

test('Sc and Sp stay in realistic ranges (small fields ~0.96-0.98, large ~1.03-1.05)', () => {
  near(C.sc(4), 0.964, 0.01);
  near(C.sc(30), 1.045, 0.01);
  near(C.sp(4), 0.972, 0.01);
  near(C.sp(30), 1.03, 0.01);
});

test('Sc is computed from the in-air head-scatter reading: Sc = R(c) / R(10)', () => {
  const b = C.scBreakdown(20);
  near(b.reading, 1 + C.HEAD.h * (1 - Math.exp(-20 / C.HEAD.tau)), 1e-12);
  near(b.ref, 1 + C.HEAD.h * (1 - Math.exp(-10 / C.HEAD.tau)), 1e-12);
  near(b.sc, b.reading / b.ref, 1e-12);
  near(b.sc, C.sc(20), 1e-12);
});

test('Sp is computed from the scatter-to-primary ratio at dmax: Sp = (1+SPR)/(1+SPR10)', () => {
  const b = C.spBreakdown(20);
  near(b.spr, C.scatterToPrimary(C.DMAX, 20), 1e-12);
  near(b.sprRef, C.scatterToPrimary(C.DMAX, 10), 1e-12);
  near(b.sp, (1 + b.spr) / (1 + b.sprRef), 1e-12);
  near(b.sp, C.sp(20), 1e-12);
});

test('Sc / Sp explanation steps show the same numbers the engine uses', () => {
  const scs = C.scStep(20);
  const sps = C.spStep(20);
  assert.ok(scs.result.includes(C.fix(C.sc(20), 4)));
  assert.ok(sps.result.includes(C.fix(C.sp(20), 4)));
  assert.ok(scs.work.includes(C.fix(C.scBreakdown(20).reading, 4)));
  assert.ok(sps.work.includes(C.fix(C.spBreakdown(20).spr, 4)));
});

// ---------------------------------------------------------------------------
// Depth dose, dmax
// ---------------------------------------------------------------------------
test('PDD: 6 MV reference beam matches typical values', () => {
  near(C.pdd(1.5, 10, 100), 100, 0.05);
  near(C.pdd(5, 10, 100), 86.5, 1);
  near(C.pdd(10, 10, 100), 67, 0.3);
  near(C.pdd(20, 10, 100), 38.4, 0.5);
  near(C.pdd(30, 10, 100), 22, 1);
});

test('PDD is 100% at its own dmax and never exceeds 100% anywhere', () => {
  for (const E of Object.keys(C.ENERGIES))
    for (const es of [3, 5, 10, 20, 40])
      for (const ssd of [50, 80, 100, 150, 200]) {
        const dm = C.dmaxFor(es, ssd, E);
        near(C.pdd(dm, es, ssd, E), 100, 0.01, `${E} es=${es} ssd=${ssd}`);
        for (let d = 0; d <= 30; d += 0.25) assert.ok(C.pdd(d, es, ssd, E) <= 100 + 1e-9);
      }
});

test('PDD rises to dmax then falls monotonically', () => {
  for (const E of Object.keys(C.ENERGIES)) {
    const dm = C.dmaxFor(10, 100, E);
    let prev = -1;
    for (let d = 0; d <= dm; d += 0.02) { const v = C.pdd(d, 10, 100, E); assert.ok(v >= prev - 1e-3, `${E} build-up not monotonic at ${d}`); prev = v; }
    prev = C.pdd(dm, 10, 100, E);
    for (let d = dm; d <= 30; d += 0.05) { const v = C.pdd(d, 10, 100, E); assert.ok(v <= prev + 1e-3, `${E} fall-off not monotonic at ${d}`); prev = v; }
  }
});

test('PDD curve is smooth: curvature changes gradually (no kinks) for all energies', () => {
  // For a smooth curve neighbouring second differences are almost equal. A curve interpolated linearly
  // between table points has zero curvature inside each interval and a jump at every table point.
  const h = 0.25;
  const second = (d, E) => C.pdd(d - h, 10, 100, E) - 2 * C.pdd(d, 10, 100, E) + C.pdd(d + h, 10, 100, E);
  for (const E of Object.keys(C.ENERGIES)) {
    const dm = C.dmaxFor(10, 100, E);
    let worst = 0;
    for (let d = dm + 1; d <= 29; d += h) worst = Math.max(worst, Math.abs(second(d + h, E) - second(d, E)));
    assert.ok(worst < 0.06, `${E}: curvature jumps by ${worst.toFixed(4)}`);
  }
});

test('dmax is found from the curve and moves with energy, field size and SSD', () => {
  const byEnergy = Object.keys(C.ENERGIES).map((E) => C.dmaxFor(10, 100, E));
  for (let i = 1; i < byEnergy.length; i++) assert.ok(byEnergy[i] > byEnergy[i - 1], 'dmax increases with beam energy');
  near(C.dmaxFor(10, 100, 'Co-60'), 0.5, 0.05);
  near(C.dmaxFor(10, 100, '6 MV'), 1.5, 0.05);
  near(C.dmaxFor(10, 100, '18 MV'), 3.3, 0.1);
  assert.ok(C.dmaxFor(30, 100) < C.dmaxFor(10, 100) - 0.15, 'larger field: shallower dmax');
  assert.ok(C.dmaxFor(5, 100) >= C.dmaxFor(30, 100), 'dmax never deepens as the field grows');
  assert.ok(C.dmaxFor(10, 60) < C.dmaxFor(10, 150) - 0.1, 'longer SSD: slightly deeper dmax');
});

test('Beam quality: TPR20/10-like ratio rises with energy', () => {
  let prev = 0;
  for (const E of Object.keys(C.ENERGIES)) {
    const r = (C.pdd(20, 10, 100, E) / C.pdd(10, 10, 100, E)) * Math.pow(120 / 110, 2);
    assert.ok(r > prev, `${E} beam quality ${r}`);
    prev = r;
  }
  near(C.tmr(20, 10) / C.tmr(10, 10), 0.675, 0.03); // 6 MV
});

test('PDD increases with field size, SSD and energy (physics sanity)', () => {
  assert.ok(C.pdd(10, 20, 100) > C.pdd(10, 10, 100));
  assert.ok(C.pdd(10, 5, 100) < C.pdd(10, 10, 100));
  assert.ok(C.pdd(10, 10, 120) > C.pdd(10, 10, 100));
  assert.ok(C.pdd(10, 10, 80) < C.pdd(10, 10, 100));
  assert.ok(C.pdd(10, 10, 100, '15 MV') > C.pdd(10, 10, 100, '6 MV'));
});

test('PDD steps reproduce the engine number', () => {
  const steps = C.pddSteps(10, 10, 100);
  assert.equal(steps.length, 8);
  assert.ok(steps[steps.length - 1].result.includes(C.fmt(C.pdd(10, 10, 100), 2)));
  assert.ok(steps[6].result.includes(C.fmt(C.dmaxFor(10, 100), 2)));
});

test('inverse square law', () => {
  near(C.inverseSquareFactor(100, 200), 0.25, 1e-12);
  near(C.inverseSquareFactor(100, 120) * 100, 69.444, 1e-3);
});

test('Mayneord F: worked example, identity, and agreement with the full model (within 1.5%)', () => {
  near(C.mayneordF(100, 100, 10, 1.5), 1, 1e-12);
  const expected = Math.pow(101.5 / 110, 2) * Math.pow(90 / 81.5, 2);
  near(C.mayneordF(80, 100, 10, 1.5), expected, 1e-12);
  near(C.mayneordF(80, 100, 10, 1.5), 1.0383, 1e-3);
  assert.equal(C.mayneordF(80, 100, 1.0, 1.5), 1);
  for (const [f1, f2] of [[80, 100], [100, 120], [100, 80], [100, 150]])
    for (const d of [5, 10, 15, 20]) {
      const approx = C.pdd(d, 10, f1) * C.mayneordF(f1, f2, d, C.DMAX);
      near(approx / C.pdd(d, 10, f2), 1, 0.015, `f1=${f1} f2=${f2} d=${d}`);
    }
});

// ---------------------------------------------------------------------------
// TMR and monitor units
// ---------------------------------------------------------------------------
test('TMR is ~1 at dmax and falls with depth; grows with field size', () => {
  near(C.tmr(1.5, 10), 1, 0.01);
  near(C.tmr(10, 10), 0.777, 0.01);
  let prev = 1.01;
  for (let d = 2; d <= 30; d += 1) { const t = C.tmr(d, 10); assert.ok(t < prev); prev = t; }
  assert.ok(C.tmr(10, 20) > C.tmr(10, 10) && C.tmr(10, 5) < C.tmr(10, 10));
});

test('MU SAD: 200 cGy at 10 cm, 10x10, open field', () => {
  const r = C.muSAD({ dose: 200, depth: 10, width: 10, length: 10 });
  assert.ok(r.ok);
  near(r.mu, 200 / C.tmr(10, 10), 1e-9);
  assert.equal(r.muRounded, Math.round(200 / C.tmr(10, 10)));
  near(r.perMU, 0.777, 0.01);
  near(r.doseAtDmax, 200 / C.tmr(10, 10), 1e-6); // K*Sc*Sp*WF*TF = 1
  near(r.hotspotPct, 100 / C.tmr(10, 10), 1e-6);
});

test('MU SAD: wedge and tray reduce dose per MU', () => {
  const open = C.muSAD({ dose: 200, depth: 8, width: 10, length: 10 });
  const wedged = C.muSAD({ dose: 200, depth: 8, width: 10, length: 10, wedge: '45', tray: 'tray' });
  near(wedged.mu / open.mu, 1 / (0.68 * 0.97), 1e-9);
});

test('MU SSD: dose per MU is the product of the shown factors', () => {
  const r = C.muSSD({ dose: 200, depth: 8, width: 12, length: 15, ssd: 100, tray: 'tray' });
  assert.ok(r.ok);
  const p = r.parts;
  near(r.perMU, p.scV * p.spV * (p.pdd / 100) * p.isf * p.wf * p.tf, 1e-12);
  near(r.mu, 200 / r.perMU, 1e-9);
  assert.ok(r.steps.some((s) => s.title.includes('Collimator scatter') && s.work.includes('R(')));
  assert.ok(r.steps.some((s) => s.title.includes('Phantom') && s.work.includes('SPR(')));
});

test('MU SSD: dmax point 100 cm from the source (SSD 98.5) gives ISF = 1', () => {
  const r = C.muSSD({ dose: 100, depth: 1.5, width: 10, length: 10, ssd: 98.5 });
  near(r.parts.isf, 1, 1e-12);
});

test('MU SSD: SSD-type calibration gives ISF = 1 at SSD 100', () => {
  const r = C.muSSD({ dose: 100, depth: 1.5, width: 10, length: 10, ssd: 100, machine: { calibration: 'SSD' } });
  near(r.parts.isf, 1, 1e-12);
});

test('SSD and SAD techniques agree for the same patient geometry (within 1%)', () => {
  for (const depth of [3, 5, 8, 10, 12, 15, 20])
    for (const size of [6, 10, 15, 20]) {
      const sad = C.muSAD({ dose: 200, depth, width: size, length: size });
      assert.ok(sad.cross, 'cross-check present');
      assert.ok(Math.abs(sad.cross.diffPct) < 1, `depth ${depth}, field ${size}: ${sad.cross.diffPct.toFixed(2)} %`);
    }
});

test('bigger field => fewer MU (more scatter per MU)', () => {
  const small = C.muSAD({ dose: 200, depth: 10, width: 5, length: 5 });
  const large = C.muSAD({ dose: 200, depth: 10, width: 25, length: 25 });
  assert.ok(small.mu > large.mu);
});

test('input validation', () => {
  assert.equal(C.muSAD({ dose: 0, depth: 10, width: 10, length: 10 }).ok, false);
  assert.equal(C.muSAD({ dose: 200, depth: 0.5, width: 10, length: 10 }).ok, false);
  assert.equal(C.muSAD({ dose: 200, depth: 10, width: 1, length: 10 }).ok, false);
  assert.equal(C.muSSD({ dose: 200, depth: 10, width: 10, length: 10, ssd: NaN }).ok, false);
  assert.equal(C.muSAD({ dose: NaN, depth: 10, width: 10, length: 10 }).ok, false);
});

// ---------------------------------------------------------------------------
// Radiobiology and decay
// ---------------------------------------------------------------------------
test('BED and EQD2 (linear-quadratic)', () => {
  near(C.bed(30, 2, 10), 72, 1e-9);
  near(C.eqd2(30, 2, 10), 60, 1e-9);
  near(C.eqd2(20, 2.75, 10), 58.4375, 1e-9);
  near(C.bed(20, 2.75, 10), 70.125, 1e-9);
});

test('equivalent dose per fraction solves BED equality', () => {
  const b = C.bed(30, 2, 3);
  const d2 = C.equivalentDosePerFraction(b, 20, 3);
  near(d2, 2.6533, 1e-3);
  near(C.bed(20, d2, 3), b, 1e-9);
});

test('radioactive decay', () => {
  near(C.remainingFraction(73.83, 73.83), 0.5, 1e-12);
  near(C.remainingFraction(2 * 73.83, 73.83), 0.25, 1e-12);
  near(C.decayConstant(10), 0.0693147, 1e-6);
  near(C.timeToFraction(0.25, 10), 20, 1e-9);
});

test('Co-60 treatment time grows as the source decays', () => {
  near(C.co60Time(200, 0, 200).minutes, 1, 1e-12);
  near(C.co60Time(200, C.CO60_HALF_LIFE_YEARS, 200).minutes, 2, 1e-9);
  near(C.co60Time(100, 1, 200).rate, 100 * Math.pow(0.5, 1 / 5.2714), 1e-9);
});

test('fmt helpers', () => {
  assert.equal(C.fmt(1.5), '1.5');
  assert.equal(C.fmt(2), '2');
  assert.equal(C.fmt(NaN), '—');
  assert.equal(C.fix(1, 3), '1.000');
});
