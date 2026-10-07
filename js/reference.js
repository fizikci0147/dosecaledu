/* DoseCalc EDU - formula sheet and glossary */
(function () {
  'use strict';
  const DE = window.DoseEdu;
  const { h, fr } = DE;

  const formulas = [
    { name: 'Total dose', f: 'Total = d × n', says: 'Dose per fraction times number of fractions.', units: '1 Gy = 100 cGy' },
    { name: 'Percent depth dose', f: `PDD = ${fr('D<sub>d</sub>', 'D<sub>max</sub>')} × 100 %`, says: 'Share of the maximum dose that reaches depth d (fixed SSD).' },
    { name: 'Inverse-square law', f: `I₂ = I₁ × (${fr('d₁', 'd₂')})²`, says: 'Dose rate falls with the square of the distance from the source.' },
    { name: 'Mayneord F factor', f: `F = (${fr('f₂ + d<sub>m</sub>', 'f₂ + d')})² × (${fr('f₁ + d', 'f₁ + d<sub>m</sub>')})²`, says: 'Multiply PDD at SSD f₁ by F to get PDD at SSD f₂.' },
    { name: 'Equivalent square', f: `ES = ${fr('4 × A', 'P')} = ${fr('2 w l', 'w + l')}`, says: 'The square field that scatters like a rectangle w × l.' },
    { name: 'Collimator scatter, Sc', f: `S<sub>c</sub> = ${fr('R(c)', 'R(10)')}`, says: 'R(c) = 1 + h (1 − e^(−c/τ)) is the in-air reading for opening c. h = 0.136, τ = 12 cm.' },
    { name: 'Phantom scatter, Sp', f: `S<sub>p</sub> = ${fr('1 + SPR(s)', '1 + SPR(10)')}`, says: 'SPR(s) = σ (1 − e^(−s/τ)) (1 − e^(−dmax/λ)). σ = 0.585, τ = 10 cm, λ = 8 cm.' },
    { name: 'Output factor', f: 'S<sub>c,p</sub> = S<sub>c</sub> × S<sub>p</sub>', says: 'Dose per MU relative to the 10 × 10 cm reference field.' },
    { name: 'Depth-dose model', f: 'D(d) = B(d) × A(d) × ISL(d) × (1 + SPR)', says: 'Build-up × attenuation × inverse square × scatter. PDD = 100 × D(d) ÷ D(dmax).' },
    { name: 'TMR', f: `TMR = ${fr('D<sub>d</sub>', 'D<sub>ref at dmax</sub>')}`, says: 'Same source distance for both points: measures tissue absorption only.' },
    { name: 'Monitor units, SSD', f: `MU = ${fr('D', 'K × S<sub>c</sub> × S<sub>p</sub> × PDD/100 × ISF × WF × TF')}`, says: 'Prescribed dose divided by the dose per MU at the point.' },
    { name: 'Monitor units, SAD', f: `MU = ${fr('D', 'K × S<sub>c</sub> × S<sub>p</sub> × TMR × WF × TF')}`, says: 'No inverse-square factor: the isocentre is always at the same distance.' },
    { name: 'Inverse-square factor', f: `ISF = (${fr('calibration distance', 'SSD + d<sub>max</sub>')})²`, says: 'Distance correction from the calibration point to the dmax point.' },
    { name: 'BED', f: `BED = n × d × (1 + ${fr('d', 'α/β')})`, says: 'Biological effect of a fractionated course (Gy with α/β subscript).' },
    { name: 'EQD2', f: `EQD2 = ${fr('BED', '1 + 2/(α/β)')}`, says: 'Equivalent total dose in 2 Gy fractions.' },
    { name: 'Radioactive decay', f: `A = A₀ × (½)<sup>t/T½</sup> = A₀ e<sup>−λt</sup>`, says: 'λ = 0.693 ÷ half-life.' },
    { name: 'Cobalt-60 time', f: `t = ${fr('Dose', 'Dose rate today')}`, says: 'Dose rate today = reference rate × (½)^(t/5.27 y).' },
  ];

  const glossary = [
    ['Absorbed dose', 'Energy absorbed per unit mass of tissue. Unit: gray (Gy).'],
    ['Gray (Gy)', 'One joule of absorbed energy per kilogram. 1 Gy = 100 cGy.'],
    ['Centigray (cGy)', 'One hundredth of a gray. The unit used in monitor-unit calculations.'],
    ['Fraction', 'One treatment session.'],
    ['Fractionation', 'Splitting the total dose into many fractions to spare normal tissue.'],
    ['Hypofractionation', 'Fewer, larger fractions (more than about 2.5 Gy per fraction).'],
    ['Prescription', 'The plan: dose, number of fractions, and the point or volume where the dose is specified.'],
    ['Linear accelerator (linac)', 'The machine that generates high-energy x-rays (photons) or electrons for treatment.'],
    ['Monitor unit (MU)', 'The linac\'s dose counter, calibrated so that a known dose is delivered per MU in reference conditions.'],
    ['Calibration (K)', 'Dose per MU at the reference point, usually set to 1 cGy/MU.'],
    ['Reference field', 'The 10 × 10 cm field in which output factors are defined as 1.000.'],
    ['dmax', 'Depth of maximum dose. About 1.5 cm for a 6 MV photon beam.'],
    ['Build-up region', 'The first centimetre or so where dose rises toward dmax. It spares the skin.'],
    ['PDD', 'Percent depth dose: dose at depth as a percentage of the dose at dmax, for fixed SSD and field size.'],
    ['SSD', 'Source-to-skin distance.'],
    ['SAD', 'Source-to-axis distance. The fixed distance from the source to the isocentre (100 cm).'],
    ['Isocentre', 'The point in space about which the gantry rotates. Placed inside the patient in SAD treatments.'],
    ['TMR', 'Tissue-maximum ratio: dose at depth divided by dose at dmax at the same distance from the source.'],
    ['Inverse-square law', 'Intensity from a point source is proportional to 1 divided by distance squared.'],
    ['ISF', 'Inverse-square factor: the distance correction applied in an SSD calculation.'],
    ['Mayneord F factor', 'Approximate correction to convert PDD from one SSD to another.'],
    ['Equivalent square', 'The square field with the same scatter behaviour as a given rectangle: 4A/P.'],
    ['Sc', 'Collimator scatter factor. Output change caused by the machine head as the field opens.'],
    ['Sp', 'Phantom scatter factor. Output change caused by scatter within the patient as the field size grows.'],
    ['Output factor', 'Dose per MU relative to the reference field: Sc × Sp.'],
    ['SPR (scatter-to-primary ratio)', 'Dose from scattered radiation divided by dose from the direct (primary) beam at a point. It grows with field size and depth.'],
    ['Beam hardening', 'The beam becomes more penetrating with depth because soft photons are removed first.'],
    ['Electron contamination', 'Electrons produced in the machine head and air. They raise the skin dose and make the build-up steeper, more so for large fields.'],
    ['Wedge factor (WF)', 'Fraction of the dose that remains with a wedge in the beam.'],
    ['Tray factor (TF)', 'Fraction of the dose that remains with a blocking tray in the beam.'],
    ['Central axis', 'The line from the source through the centre of the field.'],
    ['BED', 'Biologically effective dose: a way to compare fractionation schedules.'],
    ['EQD2', 'The total dose in 2 Gy fractions that has the same biological effect.'],
    ['α/β ratio', 'A tissue property (in Gy) describing sensitivity to fraction size. Low values mean high sensitivity to large fractions.'],
    ['Half-life', 'Time for a radioactive source\'s activity to fall by half.'],
    ['Activity', 'Number of decays per second of a source. Unit: becquerel (Bq); older unit: curie (Ci).'],
    ['Teletherapy', 'Treatment with a source at a distance from the patient, such as a linac or cobalt unit.'],
    ['Brachytherapy', 'Treatment with sealed radioactive sources placed in or next to the tumour.'],
  ];

  function mountReference(root) {
    const input = h('input', { type: 'search', placeholder: 'Search the glossary…', 'aria-label': 'Search the glossary' });
    const list = h('dl', { class: 'glossary' });
    function renderGlossary() {
      const q = input.value.trim().toLowerCase();
      const rows = glossary.filter(([t, d]) => !q || t.toLowerCase().includes(q) || d.toLowerCase().includes(q));
      list.replaceChildren(...(rows.length ? rows.map(([t, d]) => h('div', null, h('dt', null, t), h('dd', null, d))) : [h('p', { class: 'muted' }, 'No matching terms.')]));
    }
    input.addEventListener('input', renderGlossary);
    renderGlossary();

    root.append(
      h('h2', null, 'Formula sheet'),
      h('p', { class: 'muted' }, 'Every formula used in the lessons, in one place.'),
      h('div', { class: 'formula-grid' }, formulas.map((f) =>
        h('div', { class: 'card fcard' },
          h('div', { class: 'fname' }, f.name),
          h('div', { class: 'formula small', html: f.f }),
          h('p', { class: 'muted' }, f.says),
          f.units ? h('p', { class: 'muted small' }, f.units) : null))),
      h('h2', { class: 'spaced' }, 'Glossary'),
      h('div', { class: 'search' }, input),
      list);
  }
  DE.mountReference = mountReference;
})();
