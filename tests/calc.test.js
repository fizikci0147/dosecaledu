'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calc.js');

const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg || ''} expected ${expected} ± ${tol}, got ${actual}`);

test('equivalent square 4A/P', () => {
  near(C.equivalentSquare(10, 10), 10, 1e-9);
  near(C.equivalentSquare(10, 20), 13.3333, 1e-3);
  near(C.equivalentSquare(5, 15), 7.5, 1e-9);
});

test('output factors are 1.000 for the 10x10 reference field', () => {
  near(C.sc(10), 1, 1e-9);
  near(C.sp(10), 1, 1e-9);
  assert.ok(C.sc(4) < 1 && C.sc(30) > 1);
  assert.ok(C.sp(4) < 1 && C.sp(30) > 1);
});

test('PDD: 100% at dmax, 67% at 10 cm, monotonic fall-off beyond dmax', () => {
  near(C.pdd(1.5, 10, 100), 100, 1e-9);
  near(C.pdd(10, 10, 100), 67, 1e-9);
  let prev = 100.0001;
  for (let d = 1.5; d <= 30; d += 0.25) {
    const p = C.pdd(d, 10, 100);
    assert.ok(p <= prev, `PDD should not increase at ${d} cm`);
    prev = p;
  }
});

test('PDD increases with field size and with SSD (physics sanity)', () => {
  assert.ok(C.pdd(10, 20, 100) > C.pdd(10, 10, 100));
  assert.ok(C.pdd(10, 5, 100) < C.pdd(10, 10, 100));
  assert.ok(C.pdd(10, 10, 120) > C.pdd(10, 10, 100));
  assert.ok(C.pdd(10, 10, 80) < C.pdd(10, 10, 100));
});

test('PDD never exceeds 100% anywhere in the supported range', () => {
  for (let ssd = 50; ssd <= 200; ssd += 10)
    for (let es = 3; es <= 40; es += 3)
      for (let d = 1.5; d <= 30; d += 0.5) assert.ok(C.pdd(d, es, ssd) <= 100 + 1e-9);
});

test('inverse square law', () => {
  near(C.inverseSquareFactor(100, 200), 0.25, 1e-12);
  near(C.inverseSquareFactor(100, 120) * 100, 69.444, 1e-3);
});

test('Mayneord F: worked example and identity', () => {
  near(C.mayneordF(100, 100, 10, 1.5), 1, 1e-12);
  // f1 = 80, f2 = 100, d = 10, dmax = 1.5
  const expected = Math.pow(101.5 / 110, 2) * Math.pow(90 / 81.5, 2);
  near(C.mayneordF(80, 100, 10, 1.5), expected, 1e-12);
  near(C.mayneordF(80, 100, 10, 1.5), 1.0383, 1e-3);
  assert.equal(C.mayneordF(80, 100, 1.0, 1.5), 1); // build-up region: no correction
});

test('TMR is 1 at dmax and falls with depth', () => {
  near(C.tmr(1.5, 10), 1, 1e-9);
  // TMR = PDD/100 x inverse-square geometry x Sp(field at dmax) / Sp(field at depth)
  const skin = (10 * 100) / 110;
  const expected = (C.pdd(10, skin, 100) / 100) * Math.pow(110 / 101.5, 2) * (C.sp((skin * 101.5) / 100) / C.sp(10));
  near(C.tmr(10, 10), expected, 1e-12);
  near(C.tmr(10, 10), 0.78, 0.01);
  const tpr = C.tmr(20, 10) / C.tmr(10, 10);
  assert.ok(tpr > 0.64 && tpr < 0.71, `TPR20/10 ${tpr} should look like a 6 MV beam`);
});

test('MU SAD: 200 cGy at 10 cm, 10x10, open field', () => {
  const r = C.muSAD({ dose: 200, depth: 10, width: 10, length: 10 });
  assert.ok(r.ok);
  near(r.mu, 200 / C.tmr(10, 10), 1e-9);
  assert.equal(r.muRounded, 256);
  near(r.perMU, 0.78, 0.01);
  // A single beam gives a much higher dose at dmax than at the prescription depth (K*Sc*Sp*WF*TF = 1 here)
  near(r.doseAtDmax, 200 / C.tmr(10, 10), 1e-6);
  near(r.hotspotPct, (100 / C.tmr(10, 10)), 1e-6);
});

test('MU SAD: wedge and tray reduce dose per MU', () => {
  const open = C.muSAD({ dose: 200, depth: 8, width: 10, length: 10 });
  const wedged = C.muSAD({ dose: 200, depth: 8, width: 10, length: 10, wedge: '45', tray: 'tray' });
  near(wedged.mu / open.mu, 1 / (0.68 * 0.97), 1e-9);
});

test('MU SSD: reference conditions', () => {
  // SAD-type calibration: dmax point 100 cm from the source -> SSD 98.5 gives ISF = 1.
  const r = C.muSSD({ dose: 100, depth: 1.5, width: 10, length: 10, ssd: 98.5 });
  assert.ok(r.ok);
  near(r.parts.isf, 1, 1e-12);
  near(r.mu, 100 / (C.sc(10 * 100 / 98.5) * C.sp(10 * 100 / 98.5)), 1e-9);
});

test('MU SSD: SSD-type calibration gives exactly 1 cGy/MU at SSD 100, dmax, 10x10', () => {
  const r = C.muSSD({ dose: 100, depth: 1.5, width: 10, length: 10, ssd: 100, machine: { calibration: 'SSD' } });
  near(r.parts.isf, 1, 1e-12);
  near(r.mu, 100 / C.sp(10 * 101.5 / 100), 1e-9);
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

test('BED and EQD2 (linear-quadratic)', () => {
  near(C.bed(30, 2, 10), 72, 1e-9);
  near(C.eqd2(30, 2, 10), 60, 1e-9); // 2 Gy fractions: EQD2 = physical dose
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
  const now = C.co60Time(200, 0, 200);
  near(now.minutes, 1, 1e-12);
  const later = C.co60Time(200, C.CO60_HALF_LIFE_YEARS, 200);
  near(later.minutes, 2, 1e-9);
  const oneYear = C.co60Time(100, 1, 200);
  near(oneYear.rate, 100 * Math.pow(0.5, 1 / 5.2714), 1e-9);
});

test('fmt helpers', () => {
  assert.equal(C.fmt(1.5), '1.5');
  assert.equal(C.fmt(2), '2');
  assert.equal(C.fmt(NaN), '—');
  assert.equal(C.fix(1, 3), '1.000');
});
