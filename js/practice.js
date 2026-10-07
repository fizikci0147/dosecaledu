/* DoseCalc EDU - practice problem generators and the Practice page.
 * Every problem states the numbers it needs, so no look-up tables are required. */
(function () {
  'use strict';
  const DE = window.DoseEdu;
  const C = window.DoseCalc;
  const { h, store, notice } = DE;
  const { fmt, fix } = C;

  const rnd = (a, b, step) => {
    step = step || 1;
    return Number((a + step * Math.floor(Math.random() * Math.round((b - a) / step + 1))).toFixed(6));
  };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const step = (t, c) => ({ t, c });

  // ---------------------------------------------------------------------------
  // Problem generators. Each returns { q, unit, answer, dp, hint, steps }
  // ---------------------------------------------------------------------------
  const topics = [
    {
      id: 'frac', title: 'Fractionation & units',
      gen(level) {
        if (level === 1) {
          const d = pick([1.8, 2, 2, 2.5, 3, 4]);
          const n = pick([5, 10, 15, 20, 25, 30]);
          const T = d * n;
          return { q: `A patient is prescribed <b>${fmt(d)} Gy per fraction</b> for <b>${n} fractions</b>. What is the total dose in <b>Gy</b>?`, unit: 'Gy', answer: T, dp: 2,
            hint: 'Total dose = dose per fraction × number of fractions.',
            steps: [step('Multiply dose per fraction by the number of fractions', `${fmt(d)} × ${n} = ${fmt(T, 2)} Gy`)] };
        }
        if (level === 2) {
          const n = pick([5, 10, 15, 20, 25, 30]);
          const d = pick([2, 2.5, 3, 4, 5, 6]);
          const T = d * n;
          if (Math.random() < 0.5) {
            return { q: `The total dose is <b>${fmt(T)} Gy</b> given in <b>${n} fractions</b>. What is the dose per fraction in <b>cGy</b>?`, unit: 'cGy', answer: d * 100, dp: 1,
              hint: 'Divide the total by the number of fractions, then multiply by 100 to convert Gy to cGy.',
              steps: [step('Dose per fraction in Gy', `${fmt(T)} ÷ ${n} = ${fmt(d, 2)} Gy`), step('Convert to cGy (1 Gy = 100 cGy)', `${fmt(d, 2)} × 100 = ${fmt(d * 100)} cGy`)] };
          }
          return { q: `A course delivers <b>${fmt(T)} Gy</b> in fractions of <b>${fmt(d)} Gy</b>. How many <b>fractions</b> is that?`, unit: 'fractions', answer: n, dp: 0,
            hint: 'Number of fractions = total dose ÷ dose per fraction.',
            steps: [step('Divide total by dose per fraction', `${fmt(T)} ÷ ${fmt(d)} = ${n}`)] };
        }
        const n1 = pick([25, 28, 30]);
        const d1 = 2;
        const n2 = pick([3, 5, 8, 10]);
        const d2 = pick([2, 2.5, 3]);
        const total = n1 * d1 + n2 * d2;
        return { q: `Phase 1: <b>${n1} fractions of ${d1} Gy</b>. Then a boost: <b>${n2} fractions of ${fmt(d2)} Gy</b>. What is the total dose in <b>cGy</b>?`, unit: 'cGy', answer: total * 100, dp: 0,
          hint: 'Work out each phase separately, add them, then convert to cGy.',
          steps: [step('Phase 1', `${n1} × ${d1} = ${n1 * d1} Gy`), step('Boost', `${n2} × ${fmt(d2)} = ${fmt(n2 * d2)} Gy`), step('Add', `${n1 * d1} + ${fmt(n2 * d2)} = ${fmt(total)} Gy`), step('Convert to cGy', `${fmt(total)} × 100 = ${fmt(total * 100)} cGy`)] };
      },
    },
    {
      id: 'pdd', title: 'Percent depth dose',
      gen(level) {
        const p = rnd(55, 92, 1);
        if (level === 1) {
          const dm = pick([200, 250, 300, 400]);
          const a = (dm * p) / 100;
          return { q: `The dose at dmax is <b>${dm} cGy</b> and the PDD at the point of interest is <b>${p} %</b>. What is the dose at that point?`, unit: 'cGy', answer: a, dp: 1,
            hint: 'Dose at depth = dose at dmax × PDD ÷ 100.',
            steps: [step('Convert the percentage', `${p} % = ${fix(p / 100, 2)}`), step('Multiply', `${dm} × ${fix(p / 100, 2)} = ${fmt(a, 1)} cGy`)] };
        }
        if (level === 2) {
          const rx = pick([180, 200, 250, 300]);
          const a = rx / (p / 100);
          return { q: `A single beam must deliver <b>${rx} cGy</b> at a depth where the PDD is <b>${p} %</b>. What dose is delivered at <b>dmax</b>?`, unit: 'cGy', answer: a, dp: 1,
            hint: 'Dose at dmax = dose at depth ÷ (PDD ÷ 100).',
            steps: [step('Convert the percentage', `${p} % = ${fix(p / 100, 2)}`), step('Divide the prescription', `${rx} ÷ ${fix(p / 100, 2)} = ${fmt(a, 1)} cGy`)] };
        }
        const pp = pick([60, 62.5, 65, 70, 75, 80]);
        const pct = (100 / pp - 1) * 100;
        return { q: `For a single beam the PDD at the prescription depth is <b>${fmt(pp)} %</b>. By what percentage is the dose at <b>dmax higher</b> than the prescription dose?`, unit: '%', answer: pct, dp: 1,
          hint: 'Dose at dmax ÷ prescription = 100 ÷ PDD. Then subtract 1 and express as a percentage.',
          steps: [step('Dose at dmax relative to prescription', `100 ÷ ${fmt(pp)} = ${fix(100 / pp, 3)}`), step('Excess over the prescription', `(${fix(100 / pp, 3)} − 1) × 100 = ${fmt(pct, 1)} %`)] };
      },
    },
    {
      id: 'isq', title: 'Inverse-square law',
      gen(level) {
        let r1; let d1; let d2;
        if (level === 1) { r1 = pick([100, 200, 400]); d1 = 100; d2 = pick([50, 200, 300]); }
        else if (level === 2) { r1 = rnd(80, 300, 10); d1 = pick([80, 100]); d2 = rnd(60, 160, 10); if (d2 === d1) d2 += 20; }
        if (level === 3) {
          r1 = rnd(100, 300, 10); d1 = 100; const r2 = Math.round(r1 * pick([0.25, 0.36, 0.64, 0.81]) * 10) / 10;
          const ans = d1 * Math.sqrt(r1 / r2);
          return { q: `The dose rate is <b>${fmt(r1)} cGy/min</b> at <b>100 cm</b>. At what distance (cm) is the dose rate <b>${fmt(r2, 1)} cGy/min</b>?`, unit: 'cm', answer: ans, dp: 1,
            hint: 'Rearrange: d₂ = d₁ × √(rate₁ ÷ rate₂).',
            steps: [step('Rearrange the inverse-square law', 'rate₂ = rate₁ × (d₁ ÷ d₂)²   →   d₂ = d₁ × √(rate₁ ÷ rate₂)'), step('Substitute', `d₂ = 100 × √(${fmt(r1)} ÷ ${fmt(r2, 1)}) = 100 × √${fix(r1 / r2, 4)}`), step('Evaluate', `d₂ = ${fmt(ans, 1)} cm`)] };
        }
        const f = (d1 / d2) ** 2;
        return { q: `The dose rate is <b>${fmt(r1)} cGy/min</b> at <b>${d1} cm</b> from the source. What is the dose rate at <b>${d2} cm</b>?`, unit: 'cGy/min', answer: r1 * f, dp: 1,
          hint: 'New rate = old rate × (old distance ÷ new distance)².',
          steps: [step('Distance ratio', `${d1} ÷ ${d2} = ${fix(d1 / d2, 4)}`), step('Square it', `${fix(d1 / d2, 4)}² = ${fix(f, 4)}`), step('Apply to the dose rate', `${fmt(r1)} × ${fix(f, 4)} = ${fmt(r1 * f, 1)} cGy/min`)] };
      },
    },
    {
      id: 'eqsq', title: 'Equivalent square',
      gen(level) {
        if (level === 3) {
          const w = pick([6, 8, 10, 12]);
          const es = w + pick([1, 2, 3]);
          const l = (es * w) / (2 * w - es);
          return { q: `A field has an equivalent square of <b>${es} cm</b> and a width of <b>${w} cm</b>. What is its <b>length</b>?`, unit: 'cm', answer: l, dp: 2,
            hint: 'Start from ES = 2wl ÷ (w + l) and solve for l.',
            steps: [step('Start from the formula', `ES = 2 × w × l ÷ (w + l)`), step('Solve for l', `l = ES × w ÷ (2w − ES)`), step('Substitute', `l = ${es} × ${w} ÷ (2 × ${w} − ${es}) = ${es * w} ÷ ${2 * w - es} = ${fmt(l, 2)} cm`)] };
        }
        const w = level === 1 ? pick([4, 5, 6, 8, 10]) : rnd(5, 18, 0.5);
        const l = level === 1 ? w * pick([2, 3]) : rnd(8, 30, 0.5);
        const es = (4 * w * l) / (2 * (w + l));
        return { q: `What is the equivalent square (in cm) of a <b>${fmt(w)} × ${fmt(l)} cm</b> field?`, unit: 'cm', answer: es, dp: 2,
          hint: 'Equivalent square = 4 × area ÷ perimeter.',
          steps: [step('Area', `${fmt(w)} × ${fmt(l)} = ${fmt(w * l, 2)} cm²`), step('Perimeter', `2 × (${fmt(w)} + ${fmt(l)}) = ${fmt(2 * (w + l), 2)} cm`), step('4 × Area ÷ Perimeter', `4 × ${fmt(w * l, 2)} ÷ ${fmt(2 * (w + l), 2)} = ${fmt(es, 2)} cm`)] };
      },
    },
    {
      id: 'mayneord', title: 'Mayneord F factor',
      gen(level) {
        const dmax = level === 3 ? pick([2.5, 3.0]) : 1.5;
        const f1 = level === 3 ? pick([80, 100, 90]) : pick([80, 90]);
        const f2 = level === 3 ? pick([110, 120, 130]) : 100;
        const d = pick([5, 8, 10, 12, 15]);
        const p1 = rnd(50, 80, 1);
        const a = (f2 + dmax) / (f2 + d);
        const b = (f1 + d) / (f1 + dmax);
        const F = a * a * b * b;
        const ans = p1 * F;
        return { q: `The PDD at <b>${d} cm</b> depth measured at <b>SSD ${f1} cm</b> is <b>${p1} %</b> (dmax = ${fmt(dmax)} cm). Use the Mayneord F factor to find the PDD at <b>SSD ${f2} cm</b>.`, unit: '%', answer: ans, dp: 1,
          hint: 'F = ((f₂ + dmax) ÷ (f₂ + d))² × ((f₁ + d) ÷ (f₁ + dmax))². Then PDD₂ = PDD₁ × F.',
          steps: [
            step('New-SSD part', `((${f2} + ${fmt(dmax)}) ÷ (${f2} + ${d}))² = (${fix(a, 4)})² = ${fix(a * a, 4)}`),
            step('Old-SSD part', `((${f1} + ${d}) ÷ (${f1} + ${fmt(dmax)}))² = (${fix(b, 4)})² = ${fix(b * b, 4)}`),
            step('Multiply for F', `${fix(a * a, 4)} × ${fix(b * b, 4)} = ${fix(F, 4)}`),
            step('Correct the PDD', `${p1} × ${fix(F, 4)} = ${fmt(ans, 1)} %`)] };
      },
    },
    {
      id: 'musad', title: 'Monitor units (SAD)',
      gen(level) {
        const dose = pick([180, 200, 250, 300]);
        const tmr = rnd(0.55, 0.92, 0.01);
        const K = 1;
        if (level === 1) {
          const mu = dose / (K * tmr);
          return { q: `Isocentric technique. The prescription is <b>${dose} cGy</b>. K = 1.000 cGy/MU, Sc = Sp = 1.000, and the TMR is <b>${fix(tmr, 2)}</b>. How many MU?`, unit: 'MU', answer: mu, dp: 1,
            hint: 'MU = dose ÷ (K × Sc × Sp × TMR). Here K, Sc and Sp are all 1.',
            steps: [step('Dose per MU', `1 × 1 × 1 × ${fix(tmr, 2)} = ${fix(tmr, 2)} cGy/MU`), step('MU = dose ÷ dose per MU', `${dose} ÷ ${fix(tmr, 2)} = ${fmt(mu, 1)} MU`)] };
        }
        const sc = rnd(0.97, 1.04, 0.005);
        const sp = rnd(0.97, 1.04, 0.005);
        if (level === 2) {
          const per = K * sc * sp * tmr;
          const mu = dose / per;
          return { q: `Isocentric technique. Prescription <b>${dose} cGy</b>. K = 1.000, Sc = <b>${fix(sc, 3)}</b>, Sp = <b>${fix(sp, 3)}</b>, TMR = <b>${fix(tmr, 2)}</b>. How many MU?`, unit: 'MU', answer: mu, dp: 1,
            hint: 'Multiply K, Sc, Sp and TMR to get the dose per MU, then divide the prescription by it.',
            steps: [step('Dose per MU', `1.000 × ${fix(sc, 3)} × ${fix(sp, 3)} × ${fix(tmr, 2)} = ${fix(per, 4)} cGy/MU`), step('MU', `${dose} ÷ ${fix(per, 4)} = ${fmt(mu, 1)} MU`)] };
        }
        const wf = pick([0.93, 0.8, 0.68, 0.55]);
        const tf = 0.97;
        const per = K * sc * sp * tmr * wf * tf;
        const mu = dose / per;
        return { q: `Isocentric technique with a wedge and tray. Prescription <b>${dose} cGy</b>. K = 1.000, Sc = <b>${fix(sc, 3)}</b>, Sp = <b>${fix(sp, 3)}</b>, TMR = <b>${fix(tmr, 2)}</b>, wedge factor <b>${fix(wf, 2)}</b>, tray factor <b>0.97</b>. How many MU?`, unit: 'MU', answer: mu, dp: 1,
          hint: 'Include every factor: K × Sc × Sp × TMR × WF × TF.',
          steps: [step('Dose per MU', `1.000 × ${fix(sc, 3)} × ${fix(sp, 3)} × ${fix(tmr, 2)} × ${fix(wf, 2)} × 0.97 = ${fix(per, 4)} cGy/MU`), step('MU', `${dose} ÷ ${fix(per, 4)} = ${fmt(mu, 1)} MU`)] };
      },
    },
    {
      id: 'mussd', title: 'Monitor units (SSD)',
      gen(level) {
        const dose = pick([180, 200, 250, 300]);
        const pddv = rnd(58, 90, 1);
        if (level === 1) {
          const mu = dose / (pddv / 100);
          return { q: `Fixed-SSD technique. Prescription <b>${dose} cGy</b>. K = 1.000 cGy/MU, Sc = Sp = 1.000, ISF = 1.000, and the PDD is <b>${pddv} %</b>. How many MU?`, unit: 'MU', answer: mu, dp: 1,
            hint: 'MU = dose ÷ (K × Sc × Sp × PDD/100 × ISF). Only PDD differs from 1 here.',
            steps: [step('Dose per MU', `1 × 1 × 1 × ${fix(pddv / 100, 2)} × 1 = ${fix(pddv / 100, 2)} cGy/MU`), step('MU', `${dose} ÷ ${fix(pddv / 100, 2)} = ${fmt(mu, 1)} MU`)] };
        }
        const sc = rnd(0.97, 1.04, 0.005);
        const sp = rnd(0.97, 1.04, 0.005);
        if (level === 2) {
          const per = sc * sp * (pddv / 100);
          const mu = dose / per;
          return { q: `Fixed-SSD technique. Prescription <b>${dose} cGy</b>. K = 1.000, Sc = <b>${fix(sc, 3)}</b>, Sp = <b>${fix(sp, 3)}</b>, PDD = <b>${pddv} %</b>, ISF = 1.000. How many MU?`, unit: 'MU', answer: mu, dp: 1,
            hint: 'Dose per MU = K × Sc × Sp × PDD/100. Then MU = dose ÷ that.',
            steps: [step('Dose per MU', `1.000 × ${fix(sc, 3)} × ${fix(sp, 3)} × ${fix(pddv / 100, 2)} = ${fix(per, 4)} cGy/MU`), step('MU', `${dose} ÷ ${fix(per, 4)} = ${fmt(mu, 1)} MU`)] };
        }
        const ssd = pick([90, 95, 100, 105, 110]);
        const isf = (100 / (ssd + 1.5)) ** 2;
        const tf = 0.97;
        const per = sc * sp * (pddv / 100) * isf * tf;
        const mu = dose / per;
        return { q: `Fixed-SSD technique. Prescription <b>${dose} cGy</b>. The machine is calibrated to 1.000 cGy/MU with the dmax point <b>100 cm</b> from the source; dmax = 1.5 cm. Treatment SSD = <b>${ssd} cm</b>. Sc = <b>${fix(sc, 3)}</b>, Sp = <b>${fix(sp, 3)}</b>, PDD = <b>${pddv} %</b>, tray factor <b>0.97</b>. How many MU?`, unit: 'MU', answer: mu, dp: 1,
          hint: 'First find the inverse-square factor: ISF = (100 ÷ (SSD + dmax))². Then multiply every factor.',
          steps: [step('Source-to-dmax distance', `${ssd} + 1.5 = ${fmt(ssd + 1.5, 1)} cm`), step('Inverse-square factor', `(100 ÷ ${fmt(ssd + 1.5, 1)})² = ${fix(isf, 4)}`), step('Dose per MU', `${fix(sc, 3)} × ${fix(sp, 3)} × ${fix(pddv / 100, 2)} × ${fix(isf, 4)} × 0.97 = ${fix(per, 4)} cGy/MU`), step('MU', `${dose} ÷ ${fix(per, 4)} = ${fmt(mu, 1)} MU`)] };
      },
    },
    {
      id: 'bed', title: 'BED & EQD2',
      gen(level) {
        if (level === 1) {
          const n = pick([5, 10, 15, 20]);
          const d = pick([2, 2.5, 3, 4, 5]);
          const b = C.bed(n, d, 10);
          return { q: `What is the <b>BED</b> (Gy₁₀, α/β = 10 Gy) of <b>${n} fractions of ${fmt(d)} Gy</b>?`, unit: 'Gy', answer: b, dp: 2,
            hint: 'BED = n × d × (1 + d ÷ (α/β)).',
            steps: [step('Total dose', `${n} × ${fmt(d)} = ${fmt(n * d)} Gy`), step('Fraction-size factor', `1 + ${fmt(d)} ÷ 10 = ${fix(1 + d / 10, 3)}`), step('BED', `${fmt(n * d)} × ${fix(1 + d / 10, 3)} = ${fmt(b, 2)} Gy₁₀`)] };
        }
        if (level === 2) {
          const n = pick([15, 20, 25]);
          const d = pick([2.5, 2.75, 3, 3.5]);
          const ab = pick([3, 10]);
          const b = C.bed(n, d, ab);
          const e = C.eqd2(n, d, ab);
          return { q: `What is the <b>EQD2</b> of <b>${n} fractions of ${fmt(d)} Gy</b> for a tissue with <b>α/β = ${ab} Gy</b>?`, unit: 'Gy', answer: e, dp: 2,
            hint: 'First BED = n × d × (1 + d/(α/β)). Then EQD2 = BED ÷ (1 + 2/(α/β)).',
            steps: [step('BED', `${n} × ${fmt(d)} × (1 + ${fmt(d)} ÷ ${ab}) = ${fmt(b, 3)} Gy`), step('Divisor for 2 Gy fractions', `1 + 2 ÷ ${ab} = ${fix(1 + 2 / ab, 4)}`), step('EQD2', `${fmt(b, 3)} ÷ ${fix(1 + 2 / ab, 4)} = ${fmt(e, 2)} Gy`)] };
        }
        const n1 = pick([25, 30, 33]);
        const d1 = 2;
        const n2 = pick([15, 20]);
        const ab = 3;
        const b = C.bed(n1, d1, ab);
        const d2 = C.equivalentDosePerFraction(b, n2, ab);
        return { q: `A schedule of <b>${n1} × ${d1} Gy</b> is to be replaced by <b>${n2} fractions</b> with the same BED for late-responding tissue (<b>α/β = 3 Gy</b>). What dose per fraction (Gy) is needed?`, unit: 'Gy', answer: d2, dp: 3,
          hint: 'Find BED of the first schedule. Then solve n₂ × d₂ × (1 + d₂/3) = BED: d₂ = (−3 + √(9 + 12 × BED ÷ n₂)) ÷ 2.',
          steps: [step('BED of the original schedule', `${n1} × ${d1} × (1 + ${d1} ÷ 3) = ${fmt(b, 3)} Gy₃`), step('Quadratic for d₂', `d₂² + 3 × d₂ − 3 × ${fmt(b, 3)} ÷ ${n2} = 0`), step('Solve', `d₂ = (−3 + √(9 + 12 × ${fmt(b, 3)} ÷ ${n2})) ÷ 2 = ${fmt(d2, 3)} Gy`)] };
      },
    },
    {
      id: 'decay', title: 'Radioactive decay',
      gen(level) {
        if (level === 1) {
          const nh = pick([1, 2, 3]);
          const hl = pick([60, 74, 30]);
          const a0 = pick([8, 10, 16, 20, 40]);
          const a = a0 * 0.5 ** nh;
          return { q: `A source has a half-life of <b>${hl} days</b> and an activity of <b>${a0} Ci</b>. What is its activity after <b>${hl * nh} days</b>?`, unit: 'Ci', answer: a, dp: 3,
            hint: 'Count how many half-lives have passed, then halve the activity that many times.',
            steps: [step('Half-lives elapsed', `${hl * nh} ÷ ${hl} = ${nh}`), step('Fraction remaining', `(½)^${nh} = ${fmt(0.5 ** nh, 4)}`), step('Activity', `${a0} × ${fmt(0.5 ** nh, 4)} = ${fmt(a, 3)} Ci`)] };
        }
        if (level === 2) {
          const iso = pick(['Ir-192', 'I-125', 'Pd-103']);
          const hl = C.ISOTOPES[iso].halfLifeDays;
          const t = pick([10, 20, 30, 45, 60, 90]);
          const a0 = pick([10, 12, 20, 50]);
          const n = t / hl;
          const a = a0 * 0.5 ** n;
          return { q: `${iso} has a half-life of <b>${fmt(hl, 2)} days</b>. A source starts at <b>${a0} units</b>. What is the activity after <b>${t} days</b>?`, unit: 'units', answer: a, dp: 3,
            hint: 'Activity = starting activity × (½)^(time ÷ half-life).',
            steps: [step('Half-lives elapsed', `${t} ÷ ${fmt(hl, 2)} = ${fmt(n, 4)}`), step('Fraction remaining', `0.5 ^ ${fmt(n, 4)} = ${fmt(0.5 ** n, 4)}`), step('Activity', `${a0} × ${fmt(0.5 ** n, 4)} = ${fmt(a, 3)}`)] };
        }
        const hl = pick([60, 74]);
        const pct = pick([10, 20, 25, 40]);
        const t = hl * Math.log2(100 / pct);
        return { q: `A source has a half-life of <b>${hl} days</b>. After how many <b>days</b> will only <b>${pct} %</b> of its activity remain?`, unit: 'days', answer: t, dp: 1,
          hint: 'Solve (½)^n = fraction for n using logarithms: n = log₂(1 ÷ fraction). Then multiply by the half-life.',
          steps: [step('Fraction remaining', `${pct} % = ${fmt(pct / 100, 3)}`), step('Half-lives needed', `n = log₂(1 ÷ ${fmt(pct / 100, 3)}) = ln(${fmt(100 / pct, 3)}) ÷ ln 2 = ${fmt(Math.log2(100 / pct), 4)}`), step('Convert to days', `${fmt(Math.log2(100 / pct), 4)} × ${hl} = ${fmt(t, 1)} days`)] };
      },
    },
    {
      id: 'co60', title: 'Cobalt-60 time',
      gen(level) {
        if (level === 1) {
          const rate = pick([80, 100, 120, 150, 200]);
          const dose = pick([180, 200, 250, 300]);
          const t = dose / rate;
          return { q: `A cobalt unit delivers <b>${rate} cGy/min</b> at the prescription point. How many <b>minutes</b> are needed to deliver <b>${dose} cGy</b>?`, unit: 'min', answer: t, dp: 2,
            hint: 'Time = dose ÷ dose rate.',
            steps: [step('Divide dose by dose rate', `${dose} ÷ ${rate} = ${fmt(t, 3)} min`)] };
        }
        const rate0 = pick([100, 120, 150, 180]);
        const months = level === 2 ? pick([12, 24, 36]) : pick([7, 18, 30, 45]);
        const dose = pick([180, 200, 250]);
        const frac = 0.5 ** (months / 12 / C.CO60_HALF_LIFE_YEARS);
        const rate = rate0 * frac;
        const t = dose / rate;
        return { q: `A Co-60 source gave <b>${rate0} cGy/min</b> at the prescription point when installed. <b>${months} months</b> later (half-life 5.27 years), how many <b>minutes</b> are needed for <b>${dose} cGy</b>?`, unit: 'min', answer: t, dp: 2,
          hint: 'Find the dose rate today with the half-life rule, then time = dose ÷ rate.',
          steps: [step('Years elapsed', `${months} ÷ 12 = ${fmt(months / 12, 4)} years`), step('Fraction remaining', `0.5 ^ (${fmt(months / 12, 4)} ÷ 5.27) = ${fix(frac, 4)}`), step('Dose rate today', `${rate0} × ${fix(frac, 4)} = ${fmt(rate, 2)} cGy/min`), step('Time', `${dose} ÷ ${fmt(rate, 2)} = ${fmt(t, 3)} min`)] };
      },
    },
  ];

  const LEVELS = ['Beginner', 'Intermediate', 'Challenge'];

  // ---------------------------------------------------------------------------
  // Answer checking
  // ---------------------------------------------------------------------------
  function parseAnswer(text) {
    if (typeof text !== 'string') return NaN;
    const t = text.trim().replace(',', '.');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return NaN;
    return parseFloat(t);
  }
  function isCorrect(given, answer) {
    return Math.abs(given - answer) <= Math.max(Math.abs(answer) * 0.01, 0.005);
  }

  // ---------------------------------------------------------------------------
  // Page
  // ---------------------------------------------------------------------------
  function mountPractice(root) {
    const saved = store.get('practice', {});
    const state = { topic: 'mixed', level: 1, problem: null, topicOfProblem: null, solved: false, streak: 0 };
    const stats = saved.stats || {};
    const save = () => store.set('practice', { stats, best: saved.best || 0 });

    const topicRow = h('div', { class: 'pills', role: 'group', 'aria-label': 'Topic' });
    const levelRow = h('div', { class: 'seg', role: 'group', 'aria-label': 'Difficulty' });
    const card = h('div', { class: 'card problem' });
    const scoreEl = h('div', { class: 'scoreboard' });

    function totals() {
      const all = Object.values(stats);
      return { right: all.reduce((a, b) => a + b.right, 0), total: all.reduce((a, b) => a + b.total, 0) };
    }
    function renderScore() {
      const t = totals();
      scoreEl.replaceChildren(
        h('div', { class: 'score-item' }, h('b', null, String(state.streak)), h('span', null, 'streak')),
        h('div', { class: 'score-item' }, h('b', null, String(saved.best || 0)), h('span', null, 'best streak')),
        h('div', { class: 'score-item' }, h('b', null, `${t.right}/${t.total}`), h('span', null, 'correct overall')),
        h('div', { class: 'score-item' }, h('b', null, t.total ? `${Math.round((t.right / t.total) * 100)}%` : '–'), h('span', null, 'accuracy')));
    }
    function renderPills() {
      const items = [{ id: 'mixed', title: 'Mixed' }].concat(topics);
      topicRow.replaceChildren(...items.map((t) => {
        const st = stats[t.id];
        return h('button', { type: 'button', class: 'pill' + (state.topic === t.id ? ' active' : ''), 'aria-pressed': String(state.topic === t.id),
          onclick: () => { state.topic = t.id; renderPills(); next(); } },
        t.title, st && st.total ? h('small', null, ` ${st.right}/${st.total}`) : null);
      }));
      levelRow.replaceChildren(...LEVELS.map((l, i) => h('button', { type: 'button', class: 'seg-btn' + (state.level === i + 1 ? ' active' : ''), 'aria-pressed': String(state.level === i + 1),
        onclick: () => { state.level = i + 1; renderPills(); next(); } }, l)));
    }

    function next() {
      const pool = state.topic === 'mixed' ? topics : topics.filter((t) => t.id === state.topic);
      const topic = pick(pool);
      state.topicOfProblem = topic;
      state.problem = topic.gen(state.level);
      state.solved = false;
      state.tries = 0;
      renderProblem();
    }

    function record(ok) {
      const id = state.topicOfProblem.id;
      stats[id] = stats[id] || { right: 0, total: 0 };
      stats[id].total += 1;
      if (ok) stats[id].right += 1;
      if (ok) { state.streak += 1; saved.best = Math.max(saved.best || 0, state.streak); } else state.streak = 0;
      save();
      renderScore();
      renderPills();
    }

    function renderProblem() {
      const p = state.problem;
      const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
      const solutionBox = h('div', { class: 'solution-box' });
      const input = h('input', { type: 'text', inputmode: 'decimal', id: 'answer', autocomplete: 'off', placeholder: 'Your answer', 'aria-label': `Your answer in ${p.unit}` });
      const checkBtn = h('button', { type: 'submit', class: 'btn primary' }, 'Check answer');
      const hintBtn = h('button', { type: 'button', class: 'btn' }, 'Hint');
      const showBtn = h('button', { type: 'button', class: 'btn' }, 'Show solution');
      const nextBtn = h('button', { type: 'button', class: 'btn', onclick: next }, 'Next problem →');

      function showSolution() {
        solutionBox.replaceChildren(
          h('h4', null, 'Step-by-step solution'),
          h('ol', { class: 'steps' }, p.steps.map((s) => h('li', null, h('div', { class: 'step-title' }, s.t), h('div', { class: 'step-work' }, s.c)))),
          h('p', { class: 'step-result' }, `Answer: ${fmt(p.answer, p.dp)} ${p.unit}`));
      }
      hintBtn.addEventListener('click', () => {
        feedback.className = 'feedback hint';
        feedback.replaceChildren(h('b', null, 'Hint: '), p.hint);
      });
      showBtn.addEventListener('click', () => {
        if (!state.solved) { state.solved = true; record(false); }
        showSolution();
        feedback.className = 'feedback no';
        feedback.replaceChildren('Solution shown. This one counts as missed. Try the next one!');
        input.disabled = true;
        checkBtn.disabled = true;
      });
      const form = h('form', { class: 'answer-row', onsubmit: (e) => {
        e.preventDefault();
        if (state.solved) return;
        const v = parseAnswer(input.value);
        if (!isFinite(v)) {
          feedback.className = 'feedback no';
          feedback.replaceChildren('Please type a number, for example 12.5');
          return;
        }
        if (isCorrect(v, p.answer)) {
          state.solved = true;
          record(state.tries === 0);
          feedback.className = 'feedback ok';
          feedback.replaceChildren(h('b', null, 'Correct! '), `${fmt(p.answer, p.dp)} ${p.unit}.` + (state.tries ? ' (Not counted as first-try.)' : ''));
          showSolution();
          input.disabled = true;
          checkBtn.disabled = true;
          nextBtn.classList.add('primary');
          nextBtn.focus();
        } else {
          state.tries += 1;
          if (state.tries === 1) { record(false); }
          feedback.className = 'feedback no';
          feedback.replaceChildren(h('b', null, 'Not quite. '), 'Check your units and rounding, then try again. Use the hint if you are stuck.');
        }
      } }, input, h('span', { class: 'unit-tag' }, p.unit), checkBtn);

      card.replaceChildren(
        h('div', { class: 'problem-meta' }, h('span', { class: 'tag' }, state.topicOfProblem.title), h('span', { class: 'tag soft' }, LEVELS[state.level - 1])),
        h('p', { class: 'question', html: p.q }),
        form,
        h('div', { class: 'btn-row' }, hintBtn, showBtn, nextBtn),
        feedback, solutionBox,
        h('p', { class: 'muted small' }, 'Answers within 1 % are accepted, so small rounding differences are fine.'));
      input.focus({ preventScroll: true });
    }

    root.append(
      h('div', { class: 'practice-head' },
        h('div', null, h('h2', null, 'Practice'), h('p', { class: 'muted' }, 'Unlimited randomised problems. Every question gives you all the numbers you need.')),
        scoreEl),
      h('div', { class: 'controls' }, h('div', null, h('div', { class: 'ctl-label' }, 'Topic'), topicRow), h('div', null, h('div', { class: 'ctl-label' }, 'Difficulty'), levelRow)),
      card,
      h('div', { class: 'right-aligned' }, h('button', { type: 'button', class: 'btn ghost small', onclick: () => {
        if (window.confirm('Reset all practice statistics and lesson progress on this device?')) {
          store.reset();
          window.location.reload();
        }
      } }, 'Reset my progress')));
    renderScore();
    renderPills();
    next();
  }

  DE.mountPractice = mountPractice;
  DE.practiceTopics = topics;
  DE.practiceInternals = { parseAnswer, isCorrect };
})();
