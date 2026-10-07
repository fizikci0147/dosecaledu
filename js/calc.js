/*
 * DoseCalc EDU - calculation engine
 * ---------------------------------
 * Pure functions with no DOM access, so the same code runs in the browser
 * (window.DoseCalc) and in Node (unit tests).
 *
 * IMPORTANT: the beam data below is GENERIC, ROUNDED teaching data that
 * resembles a 6 MV photon beam. It is NOT measured data for any real machine
 * and must never be used to treat patients.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DoseCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Teaching beam data (generic 6 MV-like photons)
  // ---------------------------------------------------------------------------
  const DMAX = 1.5; // cm, depth of maximum dose
  const LIMITS = { depthMax: 30, fieldMin: 3, fieldMax: 40, ssdMin: 50, ssdMax: 200 };

  // Percent depth dose, 10x10 cm field, SSD = 100 cm.  [depth cm, PDD %]
  const PDD_TABLE = [
    [0, 35], [0.5, 79], [1, 93], [1.5, 100], [2, 98.4], [3, 94.6], [4, 90.6],
    [5, 86.5], [6, 82.6], [8, 75.0], [10, 67.0], [12, 60.0], [15, 50.8],
    [20, 38.4], [25, 29.1], [30, 22.0],
  ];
  // How much a field size different from 10x10 changes dose at depth.
  // PDD(d, A) = PDD(d, 10x10) * (1 + slope(A) * (d - dmax) / 10)
  const FIELD_SLOPE = [
    [3, -0.048], [4, -0.04], [5, -0.032], [6, -0.025], [8, -0.012], [10, 0],
    [12, 0.01], [15, 0.024], [20, 0.042], [25, 0.054], [30, 0.063], [40, 0.075],
  ];
  // Collimator scatter factor Sc and phantom scatter factor Sp vs equivalent square (cm)
  const SC_TABLE = [
    [3, 0.958], [4, 0.968], [5, 0.975], [6, 0.981], [8, 0.991], [10, 1.0],
    [12, 1.007], [15, 1.016], [20, 1.03], [25, 1.039], [30, 1.045], [40, 1.052],
  ];
  const SP_TABLE = [
    [3, 0.94], [4, 0.955], [5, 0.967], [6, 0.976], [8, 0.989], [10, 1.0],
    [12, 1.008], [15, 1.017], [20, 1.025], [25, 1.031], [30, 1.035], [40, 1.04],
  ];
  const WEDGES = {
    none: { label: 'No wedge', factor: 1.0 },
    15: { label: '15° wedge', factor: 0.93 },
    30: { label: '30° wedge', factor: 0.8 },
    45: { label: '45° wedge', factor: 0.68 },
    60: { label: '60° wedge', factor: 0.55 },
  };
  const TRAYS = {
    none: { label: 'No tray', factor: 1.0 },
    tray: { label: 'Blocking tray', factor: 0.97 },
  };
  const DEFAULT_MACHINE = {
    K: 1.0, // cGy per MU under reference conditions
    calibration: 'SAD', // 'SAD': dmax point is 100 cm from source. 'SSD': skin is 100 cm from source.
    rate: 600, // MU per minute
  };

  // Radioactive sources: half-life in days
  const YEAR = 365.25;
  const ISOTOPES = {
    'Co-60': { name: 'Cobalt-60', halfLifeDays: 5.2714 * YEAR, use: 'External-beam teletherapy units' },
    'Cs-137': { name: 'Caesium-137', halfLifeDays: 30.17 * YEAR, use: 'Older brachytherapy sources' },
    'Ir-192': { name: 'Iridium-192', halfLifeDays: 73.83, use: 'HDR brachytherapy' },
    'I-125': { name: 'Iodine-125', halfLifeDays: 59.4, use: 'Permanent seed implants (e.g. prostate)' },
    'Pd-103': { name: 'Palladium-103', halfLifeDays: 16.99, use: 'Permanent seed implants' },
    'Au-198': { name: 'Gold-198', halfLifeDays: 2.695, use: 'Historic implants' },
    'Ra-226': { name: 'Radium-226', halfLifeDays: 1600 * YEAR, use: 'Historic brachytherapy' },
  };
  const TIME_UNITS_DAYS = { days: 1, weeks: 7, months: YEAR / 12, years: YEAR };
  const CO60_HALF_LIFE_YEARS = 5.2714;

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------
  function interp(table, x, log) {
    const first = table[0];
    const last = table[table.length - 1];
    if (x <= first[0]) return first[1];
    if (x >= last[0]) return last[1];
    let i = 0;
    while (table[i + 1][0] < x) i++;
    const [x0, y0] = table[i];
    const [x1, y1] = table[i + 1];
    const t = (x - x0) / (x1 - x0);
    if (log) return Math.exp(Math.log(y0) + t * (Math.log(y1) - Math.log(y0)));
    return y0 + t * (y1 - y0);
  }

  /** Format a number: at most dp decimals, no trailing zeros. */
  function fmt(x, dp) {
    if (dp === undefined) dp = 2;
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    return String(Number(x.toFixed(dp)));
  }
  /** Format a number with exactly dp decimals. */
  function fix(x, dp) {
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    return x.toFixed(dp);
  }

  // ---------------------------------------------------------------------------
  // Core physics
  // ---------------------------------------------------------------------------
  function equivalentSquare(width, length) {
    return (4 * width * length) / (2 * (width + length)); // 4A/P
  }

  function sc(es) { return interp(SC_TABLE, es); }
  function sp(es) { return interp(SP_TABLE, es); }

  function inverseSquareFactor(d1, d2) { return Math.pow(d1 / d2, 2); }

  function mayneordF(f1, f2, depth, dmax) {
    if (dmax === undefined) dmax = DMAX;
    if (depth <= dmax) return 1;
    return Math.pow((f2 + dmax) / (f2 + depth), 2) * Math.pow((f1 + depth) / (f1 + dmax), 2);
  }

  /** PDD at SSD 100 cm for the 10x10 reference field. */
  function pdd10(depth) {
    if (depth <= DMAX) return interp(PDD_TABLE, depth, false);
    return interp(PDD_TABLE, depth, true);
  }

  function fieldSizeFactor(es, depth) {
    if (depth <= DMAX) return 1;
    return 1 + (interp(FIELD_SLOPE, es) * (depth - DMAX)) / 10;
  }

  /** PDD (%) with the three adjustments shown separately so lessons can explain each one. */
  function pddBreakdown(depth, es, ssd) {
    if (ssd === undefined) ssd = 100;
    const base = pdd10(depth);
    const fs = fieldSizeFactor(es, depth);
    const f = mayneordF(100, ssd, depth, DMAX);
    return { base, fieldFactor: fs, mayneord: f, pdd: Math.min(100, base * fs * f) };
  }
  function pdd(depth, es, ssd) { return pddBreakdown(depth, es, ssd).pdd; }

  /**
   * Tissue-maximum ratio for a field of equivalent square `es` measured AT THE DEPTH of the point.
   * Derived from PDD so the SSD and SAD techniques agree (Khan, Physics of Radiation Therapy):
   *   TMR(d, rd) = PDD(d, skin field)/100 x ((100 + d) / (100 + dmax))^2 x Sp(rdmax) / Sp(rd)
   * where, on an SSD = 100 cm basis, skin field = rd x 100/(100 + d) and rdmax = skin field x (100 + dmax)/100.
   */
  function tmr(depth, es) {
    const skinField = (es * 100) / (100 + depth);
    const fieldAtDmax = (skinField * (100 + DMAX)) / 100;
    const geometry = Math.pow((100 + depth) / (100 + DMAX), 2);
    return (pdd(depth, skinField, 100) / 100) * geometry * (sp(fieldAtDmax) / sp(es));
  }

  // ---------------------------------------------------------------------------
  // Monitor units
  // ---------------------------------------------------------------------------
  function machineOf(input) { return Object.assign({}, DEFAULT_MACHINE, (input && input.machine) || {}); }
  function refDistance(m) { return m.calibration === 'SSD' ? 100 + DMAX : 100; }

  function validate(i, needSSD) {
    const num = (x) => typeof x === 'number' && isFinite(x);
    if (!num(i.dose) || i.dose <= 0) return 'Enter a prescribed dose greater than 0 cGy.';
    if (!num(i.depth) || i.depth < DMAX || i.depth > LIMITS.depthMax)
      return `Depth must be between ${DMAX} cm (dmax) and ${LIMITS.depthMax} cm for this teaching model.`;
    if (!num(i.width) || !num(i.length) || i.width < LIMITS.fieldMin || i.length < LIMITS.fieldMin ||
      i.width > LIMITS.fieldMax || i.length > LIMITS.fieldMax)
      return `Field dimensions must be between ${LIMITS.fieldMin} and ${LIMITS.fieldMax} cm.`;
    if (needSSD && (!num(i.ssd) || i.ssd < LIMITS.ssdMin || i.ssd > LIMITS.ssdMax))
      return `SSD must be between ${LIMITS.ssdMin} and ${LIMITS.ssdMax} cm.`;
    return null;
  }

  function modifiers(i) {
    const wedge = WEDGES[i.wedge || 'none'] || WEDGES.none;
    const tray = TRAYS[i.tray || 'none'] || TRAYS.none;
    return { wedge, tray };
  }

  function summaryPair(mu, perMU, doseDmax, dose, m) {
    return {
      mu, muRounded: Math.round(mu), perMU,
      doseAtDmax: doseDmax,
      hotspotPct: (doseDmax / dose) * 100,
      beamOnMin: mu / m.rate,
    };
  }

  /** Monitor units for a fixed-SSD (SSD technique) single field. */
  function muSSD(input) {
    const err = validate(input, true);
    if (err) return { ok: false, error: err };
    const m = machineOf(input);
    const { dose, depth, width, length, ssd } = input;
    const { wedge, tray } = modifiers(input);

    const area = width * length;
    const perim = 2 * (width + length);
    const es = equivalentSquare(width, length);
    const coll = (es * 100) / ssd;
    const scV = sc(coll);
    const dist = ssd + DMAX;
    const esDmax = (es * dist) / ssd; // the beam keeps diverging below the skin
    const spV = sp(esDmax);
    const pb = pddBreakdown(depth, es, ssd);
    const ref = refDistance(m);
    const isf = Math.pow(ref / dist, 2);
    const wf = wedge.factor;
    const tf = tray.factor;
    const noPDD = m.K * scV * spV * isf * wf * tf; // dose per MU at dmax
    const perMU = noPDD * (pb.pdd / 100);
    const mu = dose / perMU;
    const doseDmax = mu * noPDD;

    const steps = [
      {
        title: '1. Find the equivalent square of the field',
        formula: 'Equivalent square = 4 × Area ÷ Perimeter',
        work: `4 × (${fmt(width)} × ${fmt(length)}) ÷ (2 × (${fmt(width)} + ${fmt(length)})) = ${fmt(4 * area)} ÷ ${fmt(perim)}`,
        result: `${fmt(es, 2)} cm`,
        why: 'Every rectangle is replaced by the square field that scatters radiation the same way. All tables are looked up with this number.',
      },
      {
        title: '2. Collimator scatter factor (Sc)',
        formula: 'Sc = value from table at the collimator field size (the field projected to 100 cm)',
        work: `Collimator field = ${fmt(es, 2)} × 100 ÷ ${fmt(ssd)} = ${fmt(coll, 2)} cm  →  Sc(${fmt(coll, 1)} cm)`,
        result: `Sc = ${fix(scV, 3)}`,
        why: 'A bigger opening lets more scattered radiation escape from the machine head, so more dose per MU.',
      },
      {
        title: '3. Phantom (patient) scatter factor (Sp)',
        formula: 'Sp = value from table at the field size at the depth of dmax',
        work: `Field at dmax = ${fmt(es, 2)} × ${fmt(dist, 1)} ÷ ${fmt(ssd)} = ${fmt(esDmax, 2)} cm  →  Sp(${fmt(esDmax, 1)} cm)`,
        result: `Sp = ${fix(spV, 3)}`,
        why: 'A bigger field puts more tissue in the beam, which scatters extra dose back to the point of interest.',
      },
      {
        title: '4. Percent depth dose (PDD)',
        formula: 'PDD = PDD(10×10, SSD 100) × field-size adjustment × Mayneord F',
        work: `${fmt(pb.base, 1)} × ${fix(pb.fieldFactor, 3)} × ${fix(pb.mayneord, 3)} = ${fmt(pb.pdd, 2)} %`,
        result: `PDD = ${fmt(pb.pdd, 2)} %`,
        why: `At ${fmt(depth)} cm deep, only this percentage of the maximum dose reaches the point. Mayneord F = ${fix(pb.mayneord, 3)} corrects for SSD ≠ 100 cm.`,
      },
      {
        title: '5. Inverse-square factor (ISF)',
        formula: 'ISF = (calibration distance ÷ source-to-dmax distance)²',
        work: `(${fmt(ref, 1)} ÷ (${fmt(ssd)} + ${fmt(DMAX)}))² = (${fmt(ref, 1)} ÷ ${fmt(dist, 1)})²`,
        result: `ISF = ${fix(isf, 4)}`,
        why: 'The machine is calibrated at one distance. If the patient\'s dmax point is farther away, the dose rate drops with the square of the distance.',
      },
      {
        title: '6. Wedge and tray factors',
        formula: 'WF = wedge factor, TF = tray factor',
        work: `${wedge.label}: WF = ${fix(wf, 3)};  ${tray.label}: TF = ${fix(tf, 3)}`,
        result: `WF × TF = ${fix(wf * tf, 3)}`,
        why: 'Wedges and trays absorb some of the beam, so each MU delivers a little less dose.',
      },
      {
        title: '7. Dose delivered per monitor unit at the prescription point',
        formula: 'Dose per MU = K × Sc × Sp × PDD/100 × ISF × WF × TF',
        work: `${fix(m.K, 3)} × ${fix(scV, 3)} × ${fix(spV, 3)} × ${fix(pb.pdd / 100, 4)} × ${fix(isf, 4)} × ${fix(wf, 3)} × ${fix(tf, 3)}`,
        result: `${fix(perMU, 4)} cGy per MU`,
        why: 'K is the machine calibration (cGy per MU in the reference setup). Everything else adjusts it to this patient.',
      },
      {
        title: '8. Monitor units',
        formula: 'MU = Prescribed dose ÷ Dose per MU',
        work: `${fmt(dose)} ÷ ${fix(perMU, 4)} = ${fmt(mu, 2)}`,
        result: `${fmt(mu, 1)} MU  →  deliver ${Math.round(mu)} MU`,
        why: 'Round to the nearest whole MU, which is what the machine delivers.',
      },
    ];

    const factors = [
      { symbol: 'K', name: 'Calibration', value: fix(m.K, 3), note: 'cGy per MU in reference setup' },
      { symbol: 'Sc', name: 'Collimator scatter', value: fix(scV, 3), note: `collimator field ${fmt(coll, 1)} cm` },
      { symbol: 'Sp', name: 'Phantom scatter', value: fix(spV, 3), note: `field ${fmt(esDmax, 1)} cm at dmax` },
      { symbol: 'PDD', name: 'Percent depth dose', value: fmt(pb.pdd, 2) + ' %', note: `depth ${fmt(depth)} cm` },
      { symbol: 'ISF', name: 'Inverse square', value: fix(isf, 4), note: `${fmt(dist, 1)} cm to dmax` },
      { symbol: 'WF', name: 'Wedge', value: fix(wf, 3), note: wedge.label },
      { symbol: 'TF', name: 'Tray', value: fix(tf, 3), note: tray.label },
    ];
    return Object.assign({ ok: true, technique: 'SSD', es, factors, steps }, summaryPair(mu, perMU, doseDmax, dose, m), {
      parts: { scV, spV, pdd: pb.pdd, isf, wf, tf },
    });
  }

  /** Monitor units for an isocentric (SAD) single field, dose prescribed at the isocentre. */
  function muSAD(input) {
    const err = validate(input, false);
    if (err) return { ok: false, error: err };
    const m = machineOf(input);
    const { dose, depth, width, length } = input;
    const { wedge, tray } = modifiers(input);

    const area = width * length;
    const perim = 2 * (width + length);
    const es = equivalentSquare(width, length);
    const scV = sc(es);
    const spV = sp(es);
    const tmrV = tmr(depth, es);
    const calFactor = Math.pow(refDistance(m) / 100, 2);
    const wf = wedge.factor;
    const tf = tray.factor;
    const noTMR = m.K * calFactor * scV * spV * wf * tf;
    const perMU = noTMR * tmrV;
    const mu = dose / perMU;
    const doseDmax = mu * noTMR; // dose at dmax depth on the same ray at the same distance

    const steps = [
      {
        title: '1. Find the equivalent square of the field at the isocentre',
        formula: 'Equivalent square = 4 × Area ÷ Perimeter',
        work: `4 × (${fmt(width)} × ${fmt(length)}) ÷ (2 × (${fmt(width)} + ${fmt(length)})) = ${fmt(4 * area)} ÷ ${fmt(perim)}`,
        result: `${fmt(es, 2)} cm`,
        why: 'In the SAD technique the field size is defined at the isocentre (100 cm), which is where the dose point is.',
      },
      {
        title: '2. Collimator and phantom scatter factors',
        formula: 'Sc and Sp = table values at the equivalent square',
        work: `Sc(${fmt(es, 2)} cm) = ${fix(scV, 3)},  Sp(${fmt(es, 2)} cm) = ${fix(spV, 3)}`,
        result: `Sc × Sp = ${fix(scV * spV, 4)}`,
        why: 'Same idea as the SSD technique: bigger fields give more scatter, so more dose per MU.',
      },
      {
        title: '3. Tissue-maximum ratio (TMR)',
        formula: 'TMR = dose at depth ÷ dose at dmax, with the same distance from the source',
        work: `TMR(depth ${fmt(depth)} cm, ${fmt(es, 2)} cm field)`,
        result: `TMR = ${fix(tmrV, 4)}`,
        why: 'TMR only measures how the beam is attenuated by tissue. Because the distance is fixed, no inverse-square correction is needed.',
      },
      {
        title: '4. Wedge and tray factors',
        formula: 'WF = wedge factor, TF = tray factor',
        work: `${wedge.label}: WF = ${fix(wf, 3)};  ${tray.label}: TF = ${fix(tf, 3)}`,
        result: `WF × TF = ${fix(wf * tf, 3)}`,
        why: 'Accessories absorb some of the beam, so each MU delivers a little less dose.',
      },
    ];
    if (m.calibration === 'SSD') {
      steps.push({
        title: '5. Calibration-distance factor',
        formula: 'Cal. factor = ((100 + dmax) ÷ 100)²',
        work: `((100 + ${fmt(DMAX)}) ÷ 100)² = ${fix(calFactor, 4)}`,
        result: `${fix(calFactor, 4)}`,
        why: 'With an SSD-type calibration the reference point sits 1.5 cm farther from the source than the isocentre, so the dose rate at the isocentre is slightly higher.',
      });
    }
    const n = steps.length;
    steps.push({
      title: `${n + 1}. Dose delivered per monitor unit at the isocentre`,
      formula: 'Dose per MU = K × Sc × Sp × TMR × WF × TF',
      work: `${fix(m.K, 3)} × ${fix(scV, 3)} × ${fix(spV, 3)} × ${fix(tmrV, 4)} × ${fix(wf, 3)} × ${fix(tf, 3)}` +
        (calFactor !== 1 ? ` × ${fix(calFactor, 4)}` : ''),
      result: `${fix(perMU, 4)} cGy per MU`,
      why: 'Everything that changes the dose is multiplied together.',
    });
    steps.push({
      title: `${n + 2}. Monitor units`,
      formula: 'MU = Prescribed dose ÷ Dose per MU',
      work: `${fmt(dose)} ÷ ${fix(perMU, 4)} = ${fmt(mu, 2)}`,
      result: `${fmt(mu, 1)} MU  →  deliver ${Math.round(mu)} MU`,
      why: 'Round to the nearest whole MU.',
    });

    const factors = [
      { symbol: 'K', name: 'Calibration', value: fix(m.K, 3), note: 'cGy per MU in reference setup' },
      { symbol: 'Sc', name: 'Collimator scatter', value: fix(scV, 3), note: `field ${fmt(es, 1)} cm` },
      { symbol: 'Sp', name: 'Phantom scatter', value: fix(spV, 3), note: `field ${fmt(es, 1)} cm` },
      { symbol: 'TMR', name: 'Tissue-max ratio', value: fix(tmrV, 4), note: `depth ${fmt(depth)} cm` },
      { symbol: 'WF', name: 'Wedge', value: fix(wf, 3), note: wedge.label },
      { symbol: 'TF', name: 'Tray', value: fix(tf, 3), note: tray.label },
    ];

    // Cross-check with the equivalent fixed-SSD treatment (SSD = 100 - depth).
    let cross = null;
    const ssdEq = 100 - depth;
    if (ssdEq >= LIMITS.ssdMin) {
      const k = ssdEq / 100;
      const alt = muSSD({ dose, depth, width: width * k, length: length * k, ssd: ssdEq,
        wedge: input.wedge, tray: input.tray, machine: input.machine });
      if (alt.ok) cross = { ssd: ssdEq, mu: alt.mu, diffPct: ((alt.mu - mu) / mu) * 100 };
    }

    return Object.assign({ ok: true, technique: 'SAD', es, factors, steps, cross }, summaryPair(mu, perMU, doseDmax, dose, m), {
      parts: { scV, spV, tmr: tmrV, wf, tf },
    });
  }

  // ---------------------------------------------------------------------------
  // Radiobiology (linear-quadratic model)
  // ---------------------------------------------------------------------------
  function bed(n, d, ab) { return n * d * (1 + d / ab); }
  function eqd2(n, d, ab) { return bed(n, d, ab) / (1 + 2 / ab); }
  /** Dose per fraction in a new schedule of n2 fractions that has the same BED. */
  function equivalentDosePerFraction(bedValue, n2, ab) {
    return (-ab + Math.sqrt(ab * ab + (4 * ab * bedValue) / n2)) / 2;
  }

  // ---------------------------------------------------------------------------
  // Radioactive decay
  // ---------------------------------------------------------------------------
  function remainingFraction(t, halfLife) { return Math.pow(0.5, t / halfLife); }
  function decayConstant(halfLife) { return Math.LN2 / halfLife; }
  function timeToFraction(fraction, halfLife) { return (-Math.log2(fraction)) * halfLife; }

  function co60Time(rateAtReference, elapsedYears, dose) {
    const frac = remainingFraction(elapsedYears, CO60_HALF_LIFE_YEARS);
    const rate = rateAtReference * frac;
    return { fraction: frac, rate, minutes: dose / rate };
  }

  return {
    DMAX, LIMITS, PDD_TABLE, SC_TABLE, SP_TABLE, FIELD_SLOPE, WEDGES, TRAYS, DEFAULT_MACHINE,
    ISOTOPES, TIME_UNITS_DAYS, CO60_HALF_LIFE_YEARS,
    interp, fmt, fix,
    equivalentSquare, sc, sp, inverseSquareFactor, mayneordF,
    pdd10, fieldSizeFactor, pddBreakdown, pdd, tmr,
    muSSD, muSAD,
    bed, eqd2, equivalentDosePerFraction,
    remainingFraction, decayConstant, timeToFraction, co60Time,
  };
});
