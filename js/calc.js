/*
 * DoseCalc EDU - calculation engine
 * ---------------------------------
 * Pure functions with no DOM access, so the same code runs in the browser
 * (window.DoseCalc) and in Node (unit tests).
 *
 * IMPORTANT: the beam model below is a GENERIC, SIMPLIFIED teaching model tuned to
 * resemble typical photon beams. It is NOT measured data for any real machine and
 * must never be used to treat patients.
 *
 * The model, in plain words
 *   Depth dose   D(d) = build-up x attenuation x inverse-square x (1 + scatter/primary)
 *   dmax         = the depth where D(d) is largest (found from the curve, not typed in)
 *   PDD          = 100 x D(d) / D(dmax)
 *   Sc           = head-scatter reading in air for this opening / same for 10x10
 *   Sp           = (1 + SPR at dmax for this field) / (1 + SPR at dmax for 10x10)
 *   TMR          = same as PDD but with the source distance held fixed (no inverse-square)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DoseCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Teaching beam model
  // ---------------------------------------------------------------------------
  const DMAX = 1.5; // cm. Nominal dmax of the 6 MV reference beam (10x10, SSD 100); the calibration depth.
  const REF_ENERGY = '6 MV';
  const LIMITS = { depthMax: 30, fieldMin: 3, fieldMax: 40, ssdMin: 50, ssdMax: 200 };

  // Photon beam energies, fitted to typical rounded 10x10 / SSD 100 data:
  //   mu      = attenuation of the primary beam near the surface (per cm)
  //   beta    = how steeply dose builds up over the first centimetres (per cm)
  //   surface = relative dose at the skin for a 10x10 field, before build-up
  const ENERGIES = {
    'Co-60': { label: 'Cobalt-60 (1.25 MeV)', mu: 0.0663, beta: 9.62, surface: 0.45 },
    '4 MV': { label: '4 MV', mu: 0.062, beta: 4.13, surface: 0.38 },
    '6 MV': { label: '6 MV', mu: 0.0564, beta: 2.59, surface: 0.3 },
    '10 MV': { label: '10 MV', mu: 0.0495, beta: 1.46, surface: 0.23 },
    '15 MV': { label: '15 MV', mu: 0.0462, beta: 1.16, surface: 0.18 },
    '18 MV': { label: '18 MV', mu: 0.0446, beta: 0.98, surface: 0.16 },
  };
  // Beam hardening: soft photons are removed first, so the beam penetrates better the deeper it goes.
  // A(d) = (1 + d/L)^(-mu x L)   (becomes e^(-mu d) when L is very large)
  const HARDENING_LENGTH = 60; // cm
  // Electron contamination: bigger fields give more electrons near the skin, so the skin dose rises
  // and the build-up gets steeper. Both change linearly with the field size relative to 10 cm.
  const SURFACE_SLOPE = 0.01; // added to the surface dose per cm of equivalent square
  const BUILDUP_SLOPE = 0.02; // fractional change of beta per cm of equivalent square

  // Phantom (patient) scatter: SPR(d, s) = sigma x (1 - e^(-s/tau)) x (1 - e^(-d/lambda))
  // The scatter-to-primary ratio grows with field size s and depth d, then saturates.
  const SCATTER = { sigma: 0.585, tau: 10, lambda: 8 };
  // Head scatter in air: R(c) = 1 + h x (1 - e^(-c/tau))
  const HEAD = { h: 0.136, tau: 12 };

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
  const exp = Math.exp;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  // ---------------------------------------------------------------------------
  // Field geometry and the two scatter factors
  // ---------------------------------------------------------------------------
  function equivalentSquare(width, length) {
    return (4 * width * length) / (2 * (width + length)); // 4A/P
  }

  // --- Collimator (head) scatter, Sc -----------------------------------------
  const headReading = (c) => 1 + HEAD.h * (1 - exp(-c / HEAD.tau));

  /** Every number needed to show how Sc is calculated for collimator field c (cm). */
  function scBreakdown(c) {
    const reading = headReading(c);
    const ref = headReading(10);
    return {
      c, h: HEAD.h, tau: HEAD.tau,
      grow: 1 - exp(-c / HEAD.tau), growRef: 1 - exp(-10 / HEAD.tau),
      reading, ref, sc: reading / ref,
    };
  }
  function sc(c) { return headReading(c) / headReading(10); }

  // --- Phantom scatter, Sp ----------------------------------------------------
  /** Scatter-to-primary ratio at depth d (cm) for a field of equivalent square s (cm) at that depth. */
  function scatterToPrimary(d, s) {
    return SCATTER.sigma * (1 - exp(-s / SCATTER.tau)) * (1 - exp(-d / SCATTER.lambda));
  }

  /** Every number needed to show how Sp is calculated for a field s (cm) at the depth of dmax. */
  function spBreakdown(s) {
    const depthTerm = 1 - exp(-DMAX / SCATTER.lambda);
    const fieldTerm = 1 - exp(-s / SCATTER.tau);
    const fieldTermRef = 1 - exp(-10 / SCATTER.tau);
    const spr = SCATTER.sigma * fieldTerm * depthTerm;
    const sprRef = SCATTER.sigma * fieldTermRef * depthTerm;
    return {
      s, sigma: SCATTER.sigma, tau: SCATTER.tau, lambda: SCATTER.lambda, dmax: DMAX,
      depthTerm, fieldTerm, fieldTermRef, spr, sprRef, sp: (1 + spr) / (1 + sprRef),
    };
  }
  function sp(s) { return spBreakdown(s).sp; }

  /** Ready-made step-by-step explanation of Sc for a collimator field c (cm). */
  function scStep(c, title) {
    const b = scBreakdown(c);
    return {
      title: title || 'Collimator scatter factor (Sc)',
      formula: `Sc = R(c) ÷ R(10)      where   R(c) = 1 + h × (1 − e^(−c/τ))      [h = ${b.h}, τ = ${b.tau} cm]`,
      work:
        `R(${fmt(c, 2)}) = 1 + ${b.h} × (1 − e^(−${fmt(c, 2)}/${b.tau})) = 1 + ${b.h} × ${fix(b.grow, 4)} = ${fix(b.reading, 4)}\n` +
        `R(10)   = 1 + ${b.h} × (1 − e^(−10/${b.tau})) = 1 + ${b.h} × ${fix(b.growRef, 4)} = ${fix(b.ref, 4)}\n` +
        `Sc = ${fix(b.reading, 4)} ÷ ${fix(b.ref, 4)}`,
      result: `Sc = ${fix(b.sc, 4)}`,
      why: 'R is the radiation reading you would measure in air behind a small build-up cap. A wider opening lets more radiation scattered inside the machine head (filter, collimators) reach the point. The reading is divided by the 10 × 10 cm reading so that Sc = 1 for the reference field.',
    };
  }

  /** Ready-made step-by-step explanation of Sp for a field s (cm) at the depth of dmax. */
  function spStep(s, title) {
    const b = spBreakdown(s);
    return {
      title: title || 'Phantom (patient) scatter factor (Sp)',
      formula: `Sp = (1 + SPR(s)) ÷ (1 + SPR(10))      where   SPR(s) = σ × (1 − e^(−s/τ)) × (1 − e^(−dmax/λ))      [σ = ${b.sigma}, τ = ${b.tau} cm, λ = ${b.lambda} cm]`,
      work:
        `SPR(${fmt(s, 2)}) = ${b.sigma} × (1 − e^(−${fmt(s, 2)}/${b.tau})) × (1 − e^(−${fmt(DMAX)}/${b.lambda})) = ${b.sigma} × ${fix(b.fieldTerm, 4)} × ${fix(b.depthTerm, 4)} = ${fix(b.spr, 4)}\n` +
        `SPR(10)   = ${b.sigma} × (1 − e^(−10/${b.tau})) × ${fix(b.depthTerm, 4)} = ${b.sigma} × ${fix(b.fieldTermRef, 4)} × ${fix(b.depthTerm, 4)} = ${fix(b.sprRef, 4)}\n` +
        `Sp = (1 + ${fix(b.spr, 4)}) ÷ (1 + ${fix(b.sprRef, 4)})`,
      result: `Sp = ${fix(b.sp, 4)}`,
      why: 'SPR is the scatter-to-primary ratio: how much extra dose scattered from the surrounding tissue adds to the dose from the direct (primary) beam at dmax. A bigger field has more tissue around the point, so more scatter. The ratio to the 10 × 10 value makes Sp = 1 for the reference field.',
    };
  }

  // ---------------------------------------------------------------------------
  // Depth dose model, dmax, PDD and TMR
  // ---------------------------------------------------------------------------
  function energyOf(name) { return ENERGIES[name || REF_ENERGY] || ENERGIES[REF_ENERGY]; }

  /** Surface dose and build-up steepness for a field of equivalent square es at the skin. */
  function buildUpParams(es, E) {
    return {
      ds: clamp(E.surface + SURFACE_SLOPE * (es - 10), 0.05, 0.9),
      beta: E.beta * clamp(1 + BUILDUP_SLOPE * (es - 10), 0.4, 3),
    };
  }
  const attenuation = (d, E) => Math.pow(1 + d / HARDENING_LENGTH, -E.mu * HARDENING_LENGTH);

  /**
   * Un-normalised depth dose on the central axis.
   * es = equivalent square of the field at the SKIN, ssd = source-to-skin distance.
   */
  function rawDose(depth, es, ssd, E) {
    const { ds, beta } = buildUpParams(es, E);
    const bu = 1 - (1 - ds) * exp(-beta * depth);
    const att = attenuation(depth, E);
    const isl = Math.pow(ssd / (ssd + depth), 2);
    const fieldAtDepth = (es * (ssd + depth)) / ssd; // the beam diverges
    const spr = scatterToPrimary(depth, fieldAtDepth);
    return { depth, ds, beta, bu, att, isl, fieldAtDepth, spr, gain: 1 + spr, value: bu * att * isl * (1 + spr) };
  }

  /** Depth of the maximum of fn(d): coarse scan, then golden-section refinement. */
  function findPeak(fn) {
    const step = 0.05;
    let best = 0;
    let bd = step;
    for (let d = step; d <= 9; d += step) {
      const v = fn(d);
      if (v > best) { best = v; bd = d; }
    }
    let a = Math.max(0.001, bd - step);
    let b = bd + step;
    const g = (Math.sqrt(5) - 1) / 2;
    let c = b - g * (b - a);
    let e = a + g * (b - a);
    let fc = fn(c);
    let fe = fn(e);
    while (b - a > 1e-4) {
      if (fc > fe) { b = e; e = c; fe = fc; c = b - g * (b - a); fc = fn(c); }
      else { a = c; c = e; fc = fe; e = a + g * (b - a); fe = fn(e); }
    }
    return (a + b) / 2;
  }

  const peakCache = new Map();
  /** Depth of maximum dose (cm) for a given equivalent square at the skin, SSD and energy. */
  function dmaxFor(es, ssd, energy) {
    const key = `${energy || REF_ENERGY}|${es.toFixed(3)}|${ssd.toFixed(2)}`;
    let v = peakCache.get(key);
    if (v === undefined) {
      const E = energyOf(energy);
      v = findPeak((d) => rawDose(d, es, ssd, E).value);
      if (peakCache.size > 4000) peakCache.clear();
      peakCache.set(key, v);
    }
    return v;
  }

  /** PDD (%) with every ingredient exposed so the lessons can explain each one. */
  function pddBreakdown(depth, es, ssd, energy) {
    if (ssd === undefined) ssd = 100;
    const E = energyOf(energy);
    const dmax = dmaxFor(es, ssd, energy);
    const at = rawDose(depth, es, ssd, E);
    const pk = rawDose(dmax, es, ssd, E);
    return { pdd: Math.min(100, (100 * at.value) / pk.value), dmax, at, pk, energy: E };
  }
  function pdd(depth, es, ssd, energy) { return pddBreakdown(depth, es, ssd, energy).pdd; }

  /** Mayneord F factor: approximate way to convert a PDD from SSD f1 to SSD f2. */
  function mayneordF(f1, f2, depth, dmax) {
    if (dmax === undefined) dmax = DMAX;
    if (depth <= dmax) return 1;
    return Math.pow((f2 + dmax) / (f2 + depth), 2) * Math.pow((f1 + depth) / (f1 + dmax), 2);
  }

  function inverseSquareFactor(d1, d2) { return Math.pow(d1 / d2, 2); }

  /**
   * Tissue-maximum ratio for a field of equivalent square `rd` measured AT THE DEPTH of the point.
   * The source distance is the same for the point and the dmax point, so there is no inverse-square
   * term: TMR is the tissue part of the depth-dose model, normalised to its own maximum.
   */
  function tmr(depth, rd, energy) {
    const E = energyOf(energy);
    const { ds, beta } = buildUpParams(rd, E);
    const tissue = (d) => (1 - (1 - ds) * exp(-beta * d)) * attenuation(d, E) * (1 + scatterToPrimary(d, rd));
    return tissue(depth) / tissue(findPeak(tissue));
  }

  /** The full "how is this PDD built" explanation, one step per ingredient. */
  function pddSteps(depth, es, ssd, energy) {
    const b = pddBreakdown(depth, es, ssd, energy);
    const E = b.energy;
    const a = b.at;
    const k = b.pk;
    return [
      {
        title: '1. Field size at this depth',
        formula: 's(d) = s(skin) × (SSD + d) ÷ SSD',
        work: `${fmt(es, 2)} × (${fmt(ssd)} + ${fmt(depth, 2)}) ÷ ${fmt(ssd)}`,
        result: `${fmt(a.fieldAtDepth, 2)} cm`,
        why: 'The beam keeps spreading as it goes deeper, so the field is slightly bigger at depth than on the skin.',
      },
      {
        title: '2. Build-up',
        formula: `B(d) = 1 − (1 − Ds) × e^(−β d)      [Ds and β depend on beam energy and field size]`,
        work: `Surface dose Ds = ${E.surface} + ${SURFACE_SLOPE} × (${fmt(es, 2)} − 10) = ${fix(a.ds, 3)}\n` +
          `Steepness β = ${E.beta} × (1 + ${BUILDUP_SLOPE} × (${fmt(es, 2)} − 10)) = ${fix(a.beta, 3)} per cm\n` +
          `B(${fmt(depth, 2)}) = 1 − (1 − ${fix(a.ds, 3)}) × e^(−${fix(a.beta, 3)} × ${fmt(depth, 2)}) = ${fix(a.bu, 4)}`,
        result: `B = ${fix(a.bu, 4)}`,
        why: 'High-energy photons set electrons in motion that deposit dose further along, so dose starts low at the skin (Ds) and builds up over the first centimetres. Higher energy means a slower build-up and a deeper peak. Bigger fields add more electrons near the skin, so the build-up is steeper and the peak slightly shallower.',
      },
      {
        title: '3. Attenuation (with beam hardening)',
        formula: `A(d) = (1 + d/L)^(−μ × L)      [μ = ${E.mu} per cm, L = ${HARDENING_LENGTH} cm]`,
        work: `(1 + ${fmt(depth, 2)}/${HARDENING_LENGTH})^(−${E.mu} × ${HARDENING_LENGTH})`,
        result: `A = ${fix(a.att, 4)}`,
        why: 'Tissue absorbs and scatters part of the beam. Soft photons go first, so the beam becomes more penetrating with depth (beam hardening). Higher energy means a smaller μ and less loss.',
      },
      {
        title: '4. Inverse square',
        formula: 'ISL(d) = (SSD ÷ (SSD + d))²',
        work: `(${fmt(ssd)} ÷ (${fmt(ssd)} + ${fmt(depth, 2)}))²`,
        result: `ISL = ${fix(a.isl, 4)}`,
        why: 'The beam spreads out from the source, so the dose rate drops with distance. A longer SSD makes this drop gentler.',
      },
      {
        title: '5. Scatter from the patient',
        formula: 'Gain = 1 + SPR(d, s)      with   SPR = σ × (1 − e^(−s/τ)) × (1 − e^(−d/λ))',
        work: `SPR = ${SCATTER.sigma} × (1 − e^(−${fmt(a.fieldAtDepth, 2)}/${SCATTER.tau})) × (1 − e^(−${fmt(depth, 2)}/${SCATTER.lambda})) = ${fix(a.spr, 4)}\nGain = 1 + ${fix(a.spr, 4)}`,
        result: `Gain = ${fix(a.gain, 4)}`,
        why: 'Scattered radiation adds dose. More tissue (a bigger field, a deeper point) means more scatter. This is the same scatter idea that gives Sp.',
      },
      {
        title: '6. Multiply the four ingredients',
        formula: 'D(d) = B × A × ISL × Gain',
        work: `${fix(a.bu, 4)} × ${fix(a.att, 4)} × ${fix(a.isl, 4)} × ${fix(a.gain, 4)}`,
        result: `D(${fmt(depth, 2)} cm) = ${fix(a.value, 5)}`,
      },
      {
        title: '7. Find dmax: the depth where D is largest',
        formula: 'Scan D(d) over depth and take the peak',
        work: `Peak of D at d = ${fmt(b.dmax, 2)} cm  →  D(dmax) = ${fix(k.value, 5)}`,
        result: `dmax = ${fmt(b.dmax, 2)} cm`,
        why: 'Build-up pushes the dose up and attenuation plus inverse square push it down. dmax is where they balance. Because the build-up depends on the field size and the inverse-square drop depends on the SSD, dmax shifts a little with both, and a lot with beam energy.',
      },
      {
        title: '8. Percent depth dose',
        formula: 'PDD = 100 × D(d) ÷ D(dmax)',
        work: `100 × ${fix(a.value, 5)} ÷ ${fix(k.value, 5)}`,
        result: `PDD = ${fmt(b.pdd, 2)} %`,
      },
    ];
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

  const equivalentSquareStep = (width, length, es, why) => ({
    title: '1. Find the equivalent square of the field',
    formula: 'Equivalent square = 4 × Area ÷ Perimeter',
    work: `4 × (${fmt(width)} × ${fmt(length)}) ÷ (2 × (${fmt(width)} + ${fmt(length)})) = ${fmt(4 * width * length)} ÷ ${fmt(2 * (width + length))}`,
    result: `${fmt(es, 2)} cm`,
    why,
  });

  /** Monitor units for a fixed-SSD (SSD technique) single field. */
  function muSSD(input) {
    const err = validate(input, true);
    if (err) return { ok: false, error: err };
    const m = machineOf(input);
    const { dose, depth, width, length, ssd } = input;
    const { wedge, tray } = modifiers(input);

    const es = equivalentSquare(width, length);
    const coll = (es * 100) / ssd; // the field projected to 100 cm (collimator setting)
    const scV = sc(coll);
    const dist = ssd + DMAX;
    const esDmax = (es * dist) / ssd; // the beam keeps diverging below the skin
    const spV = sp(esDmax);
    const pb = pddBreakdown(depth, es, ssd);
    const approx = pdd(depth, es, 100) * mayneordF(100, ssd, depth, DMAX); // Mayneord shortcut, for comparison
    const ref = refDistance(m);
    const isf = Math.pow(ref / dist, 2);
    const wf = wedge.factor;
    const tf = tray.factor;
    const noPDD = m.K * scV * spV * isf * wf * tf; // dose per MU at dmax
    const perMU = noPDD * (pb.pdd / 100);
    const mu = dose / perMU;
    const doseDmax = mu * noPDD;

    const steps = [
      equivalentSquareStep(width, length, es, 'Every rectangle is replaced by the square field that scatters radiation the same way. Both scatter factors are calculated from this number.'),
      Object.assign(scStep(coll, '2. Collimator scatter factor (Sc)'), {
        work: `Collimator field = ${fmt(es, 2)} × 100 ÷ ${fmt(ssd)} = ${fmt(coll, 2)} cm  (the opening, projected to 100 cm)\n` + scStep(coll).work,
      }),
      Object.assign(spStep(esDmax, '3. Phantom (patient) scatter factor (Sp)'), {
        work: `Field at dmax = ${fmt(es, 2)} × ${fmt(dist, 1)} ÷ ${fmt(ssd)} = ${fmt(esDmax, 2)} cm\n` + spStep(esDmax).work,
      }),
      {
        title: '4. Percent depth dose (PDD)',
        formula: 'PDD = 100 × D(depth) ÷ D(dmax)      (open the PDD explorer to see D built step by step)',
        work: `Field on skin ${fmt(es, 2)} cm, SSD ${fmt(ssd)} cm, depth ${fmt(depth)} cm\n` +
          `D(${fmt(depth)} cm) = ${fix(pb.at.bu, 4)} × ${fix(pb.at.att, 4)} × ${fix(pb.at.isl, 4)} × ${fix(pb.at.gain, 4)} = ${fix(pb.at.value, 5)}\n` +
          `D(dmax = ${fmt(pb.dmax, 2)} cm) = ${fix(pb.pk.value, 5)}\n` +
          `PDD = 100 × ${fix(pb.at.value, 5)} ÷ ${fix(pb.pk.value, 5)}`,
        result: `PDD = ${fmt(pb.pdd, 2)} %`,
        why: `At ${fmt(depth)} cm deep only this percentage of the maximum dose arrives. Check: converting the SSD-100 PDD with the Mayneord F factor gives ${fmt(approx, 2)} %, a close match.`,
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
      parts: { scV, spV, pdd: pb.pdd, isf, wf, tf, dmax: pb.dmax },
    });
  }

  /** Monitor units for an isocentric (SAD) single field, dose prescribed at the isocentre. */
  function muSAD(input) {
    const err = validate(input, false);
    if (err) return { ok: false, error: err };
    const m = machineOf(input);
    const { dose, depth, width, length } = input;
    const { wedge, tray } = modifiers(input);

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
      equivalentSquareStep(width, length, es, 'In the SAD technique the field size is defined at the isocentre (100 cm), which is where the dose point is.'),
      Object.assign(scStep(es, '2. Collimator scatter factor (Sc)'), {
        why: scStep(es).why + ' At the isocentre the collimator field and the field in the patient are the same size.',
      }),
      spStep(es, '3. Phantom (patient) scatter factor (Sp)'),
      {
        title: '4. Tissue-maximum ratio (TMR)',
        formula: 'TMR = T(depth) ÷ T(dmax)      where   T = build-up × attenuation × (1 + SPR)      (no inverse square)',
        work: `Field at the point = ${fmt(es, 2)} cm, depth = ${fmt(depth)} cm\nTMR(${fmt(depth)} cm, ${fmt(es, 2)} cm)`,
        result: `TMR = ${fix(tmrV, 4)}`,
        why: 'TMR only measures how the tissue weakens the beam. Because the source distance is the same for both points, no inverse-square correction is needed.',
      },
      {
        title: '5. Wedge and tray factors',
        formula: 'WF = wedge factor, TF = tray factor',
        work: `${wedge.label}: WF = ${fix(wf, 3)};  ${tray.label}: TF = ${fix(tf, 3)}`,
        result: `WF × TF = ${fix(wf * tf, 3)}`,
        why: 'Accessories absorb some of the beam, so each MU delivers a little less dose.',
      },
    ];
    if (m.calibration === 'SSD') {
      steps.push({
        title: '6. Calibration-distance factor',
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
    DMAX, REF_ENERGY, LIMITS, ENERGIES, SCATTER, HEAD, SURFACE_SLOPE, BUILDUP_SLOPE, HARDENING_LENGTH, WEDGES, TRAYS, DEFAULT_MACHINE,
    ISOTOPES, TIME_UNITS_DAYS, CO60_HALF_LIFE_YEARS,
    fmt, fix,
    equivalentSquare,
    scBreakdown, sc, scStep, scatterToPrimary, spBreakdown, sp, spStep,
    dmaxFor, pddBreakdown, pdd, pddSteps, mayneordF, inverseSquareFactor, tmr,
    muSSD, muSAD,
    bed, eqd2, equivalentDosePerFraction,
    remainingFraction, decayConstant, timeToFraction, co60Time,
  };
});
