/* DoseCalc EDU - lesson content.
 * A block is either an HTML string, or { widget: 'id' } to mount an interactive widget. */
(function () {
  'use strict';
  const DE = window.DoseEdu;
  const { fr } = DE;

  const formula = (html, caption) =>
    `<div class="formula">${html}${caption ? `<div class="formula-cap">${caption}</div>` : ''}</div>`;
  const callout = (kind, title, html) =>
    `<div class="callout ${kind}"><div class="callout-title">${title}</div><div>${html}</div></div>`;
  const symbols = (rows) =>
    `<dl class="symbols">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;

  const lessons = [
    // -----------------------------------------------------------------------
    {
      id: 'dose-basics', title: 'Dose, Gray and fractions', minutes: 6, level: 'Beginner',
      summary: 'What "dose" means, the units we use, and how a treatment is split into sessions.',
      goals: ['Explain what absorbed dose is', 'Convert between Gy and cGy', 'Calculate total dose from dose per fraction and fractions'],
      blocks: [
        '<h3>The big idea</h3><p>Radiation therapy treats cancer by depositing energy in tissue. <b>Dose</b> tells us <em>how much</em> energy each kilogram of tissue absorbs. Too little and the tumour survives; too much and healthy tissue is harmed. Dose calculation is the craft of getting that number right.</p>',
        formula('1 Gray (Gy) = 1 joule of energy absorbed per 1 kilogram of tissue', 'The SI unit of absorbed dose'),
        '<p>In the clinic you will hear two units all the time:</p><ul><li><b>Gray (Gy)</b>: the standard unit. A typical course is 40 to 70 Gy.</li><li><b>Centigray (cGy)</b>: one hundredth of a Gray. Machine and monitor-unit calculations use cGy because the numbers are handier.</li></ul>',
        formula('1 Gy = 100 cGy', 'So 2 Gy = 200 cGy, and 250 cGy = 2.5 Gy'),
        '<h3>Why not deliver everything at once?</h3><p>Treatment is split into many small sessions called <b>fractions</b>. Between sessions healthy tissue repairs itself more effectively than most tumours do, so splitting the dose protects normal tissue while still controlling the cancer. A standard schedule is about <b>2 Gy per fraction, once a day, five days a week</b>.</p>',
        formula('Total dose = Dose per fraction × Number of fractions', 'Example: 2 Gy × 30 fractions = 60 Gy'),
        callout('tip', 'Vocabulary', '<b>Conventional fractionation</b>: about 2 Gy per fraction. <b>Hypofractionation</b>: fewer, larger fractions (for example 2.75 Gy × 20). <b>Prescription</b>: the written plan stating the dose, the number of fractions, and where the dose is specified.'),
        '<h3>Try it</h3><p>Change the question type and the numbers. Notice that the answer is always shown in both Gy and cGy.</p>',
        { widget: 'fractionation' },
      ],
      keyPoints: ['Dose = energy absorbed per unit mass. 1 Gy = 1 J/kg = 100 cGy.', 'Total dose = dose per fraction × number of fractions.', 'Fractionation spares healthy tissue because it repairs between sessions.'],
      quiz: [
        { q: 'A prescription says 250 cGy per fraction. How many Gray is that?', options: ['0.25 Gy', '2.5 Gy', '25 Gy', '250 Gy'], answer: 1, why: '1 Gy = 100 cGy, so 250 cGy ÷ 100 = 2.5 Gy.' },
        { q: 'A patient gets 3 Gy per fraction for 15 fractions. What is the total dose?', options: ['18 Gy', '45 Gy', '5 Gy', '450 Gy'], answer: 1, why: 'Total = 3 Gy × 15 = 45 Gy.' },
        { q: 'Why is radiation delivered in many fractions rather than all at once?', options: ['The machine cannot deliver high doses', 'Healthy tissue repairs between fractions better than most tumours', 'It makes the tumour absorb more energy', 'Patients can only lie still for a short time'], answer: 1, why: 'Fractionation takes advantage of the difference in repair between normal tissue and tumour.' },
      ],
    },
    // -----------------------------------------------------------------------
    {
      id: 'pdd', title: 'Depth dose: how dose changes with depth', minutes: 8, level: 'Beginner',
      summary: 'Why a photon beam delivers less dose the deeper it goes, and how Percent Depth Dose (PDD) measures that.',
      goals: ['Describe build-up and dmax', 'Define PDD and use it', 'Know what changes the PDD curve'],
      blocks: [
        '<h3>The shape of a photon beam in tissue</h3><p>A high-energy photon beam does <em>not</em> deposit its maximum dose at the skin. Instead:</p><ol><li><b>Build-up region:</b> dose rises over the first centimetre or two as electrons set in motion by the photons build up. This spares the skin.</li><li><b>dmax:</b> the depth of maximum dose. For a 6 MV beam it is about <b>1.5 cm</b>.</li><li><b>Fall-off:</b> deeper than dmax the beam is gradually absorbed and also spreads out, so the dose drops.</li></ol>',
        '<h3>Percent Depth Dose (PDD)</h3><p>PDD answers one question: <em>"What percentage of the maximum dose reaches this depth?"</em></p>',
        formula(`PDD(d) = ${fr('Dose at depth d', 'Dose at dmax')} × 100 %`, 'Measured along the central axis, with the same field size and the same source-to-skin distance (SSD)'),
        callout('example', 'Example', 'At 10 cm depth a 6 MV beam has PDD ≈ 67 %. To deliver <b>200 cGy at 10 cm</b> we need <b>200 ÷ 0.67 ≈ 299 cGy at dmax</b>. The tissue near the surface gets about 50 % more than the tumour does. That is why real treatments combine several beams from different directions.'),
        '<h3>What changes the PDD?</h3><ul><li><b>Beam energy:</b> higher energy penetrates deeper, so higher PDD.</li><li><b>Field size:</b> larger fields produce more scatter, so higher PDD at depth.</li><li><b>SSD:</b> a longer SSD makes the inverse-square drop flatter, so higher PDD.</li></ul>',
        '<h3>Explore it</h3><p>Move the sliders. The dashed line is the 10×10 cm, SSD 100 cm reference curve, so you can see exactly what each change does.</p>',
        { widget: 'pdd-explorer' },
      ],
      keyPoints: ['Dose peaks at dmax (about 1.5 cm for 6 MV) and falls beyond it.', 'PDD = dose at depth ÷ dose at dmax × 100 %.', 'Larger field, larger SSD or higher energy all increase PDD.'],
      quiz: [
        { q: 'What does "PDD = 67 % at 10 cm" mean?', options: ['67 % of the dose at dmax reaches 10 cm', '67 cGy is delivered at 10 cm', 'The beam is 67 % attenuated at the skin', 'The dose at 10 cm is 67 % of the prescription'], answer: 0, why: 'PDD compares the dose at depth with the maximum dose (at dmax) on the same beam axis.' },
        { q: 'You want 200 cGy at a depth where PDD is 80 %. What dose is delivered at dmax by that single beam?', options: ['160 cGy', '200 cGy', '250 cGy', '280 cGy'], answer: 2, why: 'Dose at dmax = 200 ÷ 0.80 = 250 cGy.' },
        { q: 'Which change increases PDD at a given depth?', options: ['Increasing the SSD', 'Decreasing the field size', 'Decreasing the beam energy', 'Making the patient thicker'], answer: 0, why: 'A longer SSD flattens the inverse-square fall-off between dmax and the point, so the PDD rises.' },
      ],
    },
    // -----------------------------------------------------------------------
    {
      id: 'inverse-square', title: 'Inverse-square law and changing SSD', minutes: 8, level: 'Beginner',
      summary: 'Why dose rate falls with distance, and how to correct PDD when the SSD changes.',
      goals: ['Apply the inverse-square law', 'Estimate dose changes from small setup errors', 'Use the Mayneord F factor'],
      blocks: [
        '<h3>Light from a bulb</h3><p>Radiation leaves the machine from (almost) a single point and spreads out like light from a bulb. At twice the distance the same radiation is spread over <b>four times</b> the area, so each patch of area gets <b>a quarter</b> as much.</p>',
        formula(`Dose rate₂ = Dose rate₁ × (${fr('d₁', 'd₂')})²`, 'd₁ and d₂ are distances from the <em>source</em>'),
        callout('example', 'Example', 'A beam delivers 100 cGy/min at 100 cm. At 120 cm: 100 × (100 ÷ 120)² = <b>69.4 cGy/min</b>.'),
        callout('tip', 'A useful rule of thumb', 'Near 100 cm, each <b>1 cm</b> of distance error changes the dose by about <b>2 %</b>. (Because (100/101)² ≈ 0.98.) Accurate setup matters.'),
        { widget: 'inverse-square' },
        '<h3>When the SSD changes: Mayneord F</h3><p>PDD tables are measured at one SSD (often 100 cm). If you treat at a different SSD, the inverse-square part of the fall-off changes. The <b>Mayneord F factor</b> corrects for that:</p>',
        formula(`F = (${fr('f₂ + d<sub>max</sub>', 'f₂ + d')})² × (${fr('f₁ + d', 'f₁ + d<sub>max</sub>')})²      and      PDD₂ = PDD₁ × F`, 'f₁ = original SSD, f₂ = new SSD, d = depth, dmax = depth of maximum dose'),
        { widget: 'mayneord' },
      ],
      keyPoints: ['Dose rate ∝ 1 / distance².', 'Double the distance = one quarter of the dose rate.', 'At 100 cm, 1 cm of error ≈ 2 % dose error.', 'Mayneord F converts PDD from one SSD to another.'],
      quiz: [
        { q: 'A patient is moved from 100 cm to 200 cm from the source. The dose rate becomes…', options: ['1/2', '1/4', '1/8', '1/16'], answer: 1, why: '(100 ÷ 200)² = (1/2)² = 1/4.' },
        { q: 'At about 100 cm from the source, a patient is accidentally set up 2 cm too close. The dose rate is roughly…', options: ['0.2 % higher', '2 % higher', '4 % higher', '20 % higher'], answer: 2, why: '(100 ÷ 98)² ≈ 1.041, so about 4 % higher.' },
        { q: 'What does the Mayneord F factor do?', options: ['Corrects PDD for a different SSD', 'Corrects dose for a wedge', 'Converts Gy to cGy', 'Corrects for the half-life of cobalt'], answer: 0, why: 'F adjusts a PDD measured at one SSD so it can be used at another.' },
      ],
    },
    // -----------------------------------------------------------------------
    {
      id: 'field-size', title: 'Field size: equivalent square, Sc and Sp', minutes: 8, level: 'Intermediate',
      summary: 'Why the same MU gives different dose in small and large fields, and how to handle rectangles.',
      goals: ['Convert a rectangle to an equivalent square', 'Explain Sc and Sp', 'Predict whether a field needs more or fewer MU'],
      blocks: [
        '<h3>Bigger field, more dose per MU</h3><p>When the opening is larger, more radiation scatters around. This increases the dose for the same number of monitor units. We measure this relative to the <b>10 × 10 cm reference field</b>, where the factor is exactly 1.000. Two effects add up:</p><ul><li><b>Sc (collimator scatter factor):</b> scatter produced in the machine head (flattening filter, collimators). Depends on the collimator opening.</li><li><b>Sp (phantom scatter factor):</b> scatter produced inside the patient. Depends on the irradiated field size at depth.</li></ul>',
        formula('Total output factor = Sc × Sp', 'Both equal 1.000 for a 10 × 10 cm field'),
        '<h3>Rectangles: the equivalent square</h3><p>Tables are for square fields. A rectangle of the same scatter behaviour is represented by its <b>equivalent square</b>:</p>',
        formula(`Equivalent square = ${fr('4 × Area', 'Perimeter')} = ${fr('2 × width × length', 'width + length')}`),
        callout('example', 'Example', 'A 10 × 20 cm field: Area = 200, Perimeter = 60, so 4 × 200 ÷ 60 = <b>13.3 cm</b>. It scatters like a 13.3 × 13.3 cm square, not like a 15 × 15.'),
        { widget: 'field-size' },
        callout('tip', 'Rule of thumb', '<b>Small field → output factor below 1 → more MU needed.</b> Large field → output factor above 1 → fewer MU needed.'),
      ],
      keyPoints: ['Reference field is 10 × 10 cm, where Sc = Sp = 1.', 'Equivalent square = 4A ÷ P.', 'Smaller fields give less dose per MU, so need more MU.'],
      quiz: [
        { q: 'What is the equivalent square of an 8 × 12 cm field?', options: ['9.6 cm', '10.0 cm', '8.0 cm', '20.0 cm'], answer: 0, why: '4 × (8 × 12) ÷ (2 × (8 + 12)) = 384 ÷ 40 = 9.6 cm.' },
        { q: 'Compared with the 10 × 10 reference field, a 4 × 4 cm field delivers per MU…', options: ['More dose, so fewer MU', 'Less dose, so more MU', 'The same dose', 'Depends only on depth'], answer: 1, why: 'Less scatter in small fields means lower output factors, so more MU are required for the same dose.' },
        { q: 'Collimator scatter factor Sc mainly describes scatter from…', options: ['The patient', 'The machine head', 'The treatment couch', 'The wedge only'], answer: 1, why: 'Sc is the output change caused by the machine head; Sp is the scatter inside the patient or phantom.' },
      ],
    },
    // -----------------------------------------------------------------------
    {
      id: 'mu-ssd', title: 'Monitor units: the SSD technique', minutes: 12, level: 'Intermediate',
      summary: 'The core calculation: how many monitor units does the machine need to deliver the prescribed dose?',
      goals: ['Explain what a monitor unit is', 'Build the MU formula from its parts', 'Calculate MU for a fixed-SSD field'],
      blocks: [
        '<h3>What is a monitor unit?</h3><p>A linear accelerator does not count minutes. It counts <b>monitor units (MU)</b> on a built-in ionisation chamber. The machine is <b>calibrated</b> so that under reference conditions 1 MU gives a known dose. In this app the reference condition is <b>1.000 cGy per MU</b>, at dmax, with a 10 × 10 cm field and the dmax point 100 cm from the source.</p>',
        '<h3>The key idea</h3><p>Real patients are never in reference conditions. So we correct the reference dose per MU for <em>every</em> difference, then divide the prescription by the result:</p>',
        formula(`MU = ${fr('Prescribed dose', 'Dose delivered per MU at that point')}`),
        '<p>In the <b>SSD technique</b> the skin surface is placed at a fixed distance (SSD) from the source and the dose depth is below it. The dose delivered per MU is:</p>',
        formula(`MU = ${fr('Prescribed dose', 'K × Sc × Sp × <span class="frac inline"><span>PDD</span><span>100</span></span> × ISF × WF × TF')}`),
        symbols([
          ['K', 'Calibration: cGy per MU in the reference setup (1.000 here).'],
          ['Sc', 'Collimator scatter factor. Bigger opening, more dose.'],
          ['Sp', 'Phantom scatter factor. Bigger field in the patient, more dose.'],
          ['PDD', 'Percent depth dose. How much of the maximum dose reaches the prescription depth.'],
          ['ISF', 'Inverse-square factor = (calibration distance ÷ source-to-dmax distance)². Corrects for distance.'],
          ['WF', 'Wedge factor. A wedge absorbs part of the beam.'],
          ['TF', 'Tray factor. A blocking tray absorbs a little too.'],
        ]),
        callout('tip', 'Read it like a sentence', 'Start with 1 cGy per MU. Multiply by how much the field size boosts it (Sc, Sp). Multiply by how much of it survives to the depth (PDD). Multiply by how much distance weakens it (ISF). Multiply by what the wedge and tray absorb (WF, TF). That is the dose per MU. Divide the prescription by it.'),
        '<h3>A complete worked example</h3><p>Open the box below to see every step with the actual numbers.</p>',
        { widget: 'worked-ssd' },
        '<h3>Now try your own</h3><p>Change any input and watch the MU, the factor table and the steps update. Try adding a wedge, or moving the SSD.</p>',
        { widget: 'mu-ssd' },
      ],
      keyPoints: ['MU = prescribed dose ÷ dose per MU.', 'Dose per MU = K × Sc × Sp × PDD/100 × ISF × WF × TF.', 'Anything that weakens the beam (depth, distance, wedge) increases MU; anything that boosts it (bigger field) decreases MU.'],
      quiz: [
        { q: 'The dose per MU at the prescription point is 0.80 cGy/MU. How many MU deliver 200 cGy?', options: ['160 MU', '250 MU', '200 MU', '400 MU'], answer: 1, why: 'MU = 200 ÷ 0.80 = 250.' },
        { q: 'All else equal, you add a 45° wedge (wedge factor 0.68). What happens to the MU?', options: ['They decrease', 'They stay the same', 'They increase by about 47 %', 'They increase by 68 %'], answer: 2, why: 'MU scales with 1 ÷ WF = 1 ÷ 0.68 ≈ 1.47, so about 47 % more MU.' },
        { q: 'All else equal, the patient is set up at a longer SSD. What happens to the MU needed?', options: ['They increase', 'They decrease', 'They stay the same', 'Cannot tell'], answer: 0, why: 'The inverse-square factor drops more than the PDD rises, so each MU delivers less dose at the point: more MU are needed.' },
      ],
    },
    // -----------------------------------------------------------------------
    {
      id: 'mu-sad', title: 'The isocentric (SAD) technique and TMR', minutes: 12, level: 'Intermediate',
      summary: 'Treating from many angles around one point, and the tissue-maximum ratio that makes the maths simpler.',
      goals: ['Describe the SAD technique', 'Define TMR and explain how it differs from PDD', 'Calculate MU for an isocentric field'],
      blocks: [
        '<h3>One point, many angles</h3><p>In the <b>isocentric (SAD) technique</b> the machine rotates around a fixed point, the <b>isocentre</b>, which is placed inside the patient (usually in the tumour). The <b>source-to-axis distance (SAD)</b> is always 100 cm. Because the patient does not move between beams, setups are faster and more accurate.</p>',
        '<p>The skin distance now changes with every gantry angle, so PDD is awkward. Instead we use the <b>tissue-maximum ratio</b>:</p>',
        formula(`TMR(d) = ${fr('Dose at depth d', 'Dose at dmax <em>at the same distance from the source</em>')}`),
        callout('tip', 'PDD vs TMR: the one difference that matters', 'PDD compares two points at <em>different</em> distances from the source, so it contains an inverse-square effect. TMR compares two points at the <em>same</em> distance, so it measures tissue absorption only. That is why the SAD formula has <b>no inverse-square factor</b>.'),
        '<p>The monitor-unit formula is the same idea as before, with TMR in place of PDD and no ISF:</p>',
        formula(`MU = ${fr('Prescribed dose', 'K × Sc × Sp × TMR × WF × TF')}`),
        { widget: 'worked-sad' },
        '<h3>Calculate your own</h3><p>The result box includes a <b>cross-check</b>: the same patient treated at a fixed SSD. The two techniques should agree to within a fraction of a percent. That agreement is how medical physicists verify their data.</p>',
        { widget: 'mu-sad' },
      ],
      keyPoints: ['SAD technique: isocentre inside the patient, source-to-axis distance fixed at 100 cm.', 'TMR = dose at depth ÷ dose at dmax, same distance from source.', 'MU = dose ÷ (K × Sc × Sp × TMR × WF × TF). No ISF at the isocentre.'],
      quiz: [
        { q: 'What is the main practical advantage of the SAD technique?', options: ['Higher beam energy', 'The patient does not need to be moved when the gantry rotates to a new beam angle', 'It needs no calibration', 'It removes scatter'], answer: 1, why: 'With the isocentre fixed in the patient, you only rotate the gantry between beams.' },
        { q: 'Why does the SAD monitor-unit formula not contain an inverse-square factor?', options: ['Because radiation does not obey the inverse-square law', 'Because TMR compares points at the same distance from the source, and the isocentre is always at the same distance', 'Because wedges cancel it', 'Because MU are measured in minutes'], answer: 1, why: 'The isocentre is always 100 cm from the source, and TMR already removes the distance effect.' },
        { q: 'What is the TMR at dmax?', options: ['0', '0.5', '1.000', '100'], answer: 2, why: 'At dmax the dose compared with itself is 1.000.' },
      ],
    },
    // -----------------------------------------------------------------------
    {
      id: 'bed', title: 'Comparing schedules: BED and EQD2', minutes: 10, level: 'Advanced',
      summary: 'How radiobiologists compare different fractionation schedules using the linear-quadratic model.',
      goals: ['Explain why 60 Gy in 30 and 60 Gy in 10 are not equivalent', 'Calculate BED and EQD2', 'Convert between schedules'],
      blocks: [
        '<h3>Not all Grays are equal</h3><p>Delivering 60 Gy in <b>30 fractions</b> is very different from 60 Gy in <b>10 fractions</b>: the larger fractions do more biological damage, especially to tissues that repair well between fractions. To compare schedules we need a biological scale.</p>',
        '<h3>The linear-quadratic model</h3><p>Each tissue has an <b>α/β ratio</b> (in Gy) that describes how sensitive it is to fraction size. Low α/β means <em>very</em> sensitive to large fractions.</p><ul><li><b>α/β ≈ 10 Gy:</b> most tumours and early-responding tissues.</li><li><b>α/β ≈ 3 Gy:</b> late-responding normal tissues (spinal cord, connective tissue).</li><li><b>α/β ≈ 1.5 Gy:</b> prostate cancer is commonly assumed to be this low.</li></ul>',
        formula(`BED = n × d × (1 + ${fr('d', 'α/β')})`, 'n = number of fractions, d = dose per fraction in Gy. The result is in Gy with the α/β as a subscript, for example Gy₁₀'),
        formula(`EQD2 = ${fr('BED', '1 + 2 ÷ (α/β)')}`, 'The total dose that, given in 2 Gy fractions, has the same biological effect'),
        callout('example', 'Example', '55 Gy in 20 fractions (d = 2.75 Gy), tumour α/β = 10: BED = 55 × (1 + 2.75 ÷ 10) = <b>70.1 Gy₁₀</b>. EQD2 = 70.1 ÷ 1.2 = <b>58.4 Gy</b>. So this schedule is biologically like 58.4 Gy in 2 Gy fractions.'),
        { widget: 'bed' },
        '<h3>Switching schedules</h3><p>Suppose a schedule of 30 × 2 Gy is to be shortened to 20 fractions. What dose per fraction keeps the same biological effect on late-responding tissue (α/β = 3)? We make the BEDs equal and solve for the new dose per fraction.</p>',
        { widget: 'regimen' },
        callout('warn', 'Limits of the model', 'This is the simplest version of the model. It ignores tumour repopulation during long treatments and incomplete repair between fractions, and it is less reliable for very large fractions. Clinicians decide schedules using clinical trial evidence. BED is a tool for comparison, not a prescription.'),
      ],
      keyPoints: ['BED = n × d × (1 + d/(α/β)).', 'EQD2 = BED ÷ (1 + 2/(α/β)).', 'Larger fractions increase late-tissue BED faster than tumour BED.', 'Equal BED means equal biological effect for that tissue.'],
      quiz: [
        { q: 'What is the BED (α/β = 10) of 5 fractions of 5 Gy?', options: ['25 Gy₁₀', '37.5 Gy₁₀', '50 Gy₁₀', '62.5 Gy₁₀'], answer: 1, why: 'BED = 5 × 5 × (1 + 5 ÷ 10) = 25 × 1.5 = 37.5.' },
        { q: 'EQD2 expresses a schedule as an equivalent total dose delivered in fractions of…', options: ['1 Gy', '2 Gy', '5 Gy', '10 Gy'], answer: 1, why: 'The "2" in EQD2 stands for 2 Gy per fraction.' },
        { q: 'For the same total physical dose, increasing the dose per fraction raises BED for late-responding tissue (low α/β)…', options: ['Less than for tumours', 'The same as for tumours', 'More than for tumours', 'Not at all'], answer: 2, why: 'With a low α/β the fraction-size term d ÷ (α/β) is larger, so the BED rises more steeply.' },
      ],
    },
    // -----------------------------------------------------------------------
    {
      id: 'decay', title: 'Radioactive decay and cobalt-60 timing', minutes: 9, level: 'Intermediate',
      summary: 'How radioactive sources lose strength, and how to calculate beam-on time for a cobalt unit.',
      goals: ['Apply the half-life rule', 'Use the decay formula', 'Calculate cobalt-60 treatment time'],
      blocks: [
        '<h3>Half-life</h3><p>Radioactive sources lose activity over time. The <b>half-life</b> is the time it takes for the activity to fall to <b>half</b>. After 2 half-lives a quarter remains; after 3, an eighth; and so on.</p>',
        formula(`A = A₀ × (½)<sup>t ÷ T½</sup>      or equivalently      A = A₀ × e<sup>−λt</sup>,   λ = ${fr('0.693', 'T½')}`, 'A₀ = starting activity, t = time elapsed, T½ = half-life'),
        '<p>Common clinical sources and where they are used:</p>',
        `<table class="mini"><thead><tr><th>Source</th><th>Half-life</th><th>Used for</th></tr></thead><tbody>
          <tr><td>Co-60</td><td>5.27 years</td><td>Teletherapy units</td></tr>
          <tr><td>Cs-137</td><td>30.2 years</td><td>Older brachytherapy</td></tr>
          <tr><td>Ir-192</td><td>73.8 days</td><td>HDR brachytherapy (source replaced every ~3 months)</td></tr>
          <tr><td>I-125</td><td>59.4 days</td><td>Permanent prostate seeds</td></tr>
          <tr><td>Pd-103</td><td>17.0 days</td><td>Permanent seeds</td></tr></tbody></table>`,
        { widget: 'decay' },
        '<h3>Cobalt-60 treatment time</h3><p>A cobalt machine has no monitor chamber calibrated in MU. Instead the physicist measures the <b>dose rate</b> (cGy per minute), and the therapist sets a <b>time</b>:</p>',
        formula(`Time = ${fr('Prescribed dose', 'Dose rate today')}      with      Dose rate today = Dose rate on reference date × (½)<sup>t ÷ 5.27 years</sup>`),
        callout('tip', 'Why monthly?', 'Co-60 loses about <b>1.1 % of its output per month</b>. So the beam-on time for the same dose creeps up each month, and cobalt units need regular recalculation (and eventually a source change).'),
        { widget: 'co60' },
      ],
      keyPoints: ['After each half-life, half the activity remains.', 'A = A₀ × (½)^(t/T½).', 'Cobalt time = dose ÷ dose rate, and the dose rate falls about 1.1 % per month.'],
      quiz: [
        { q: 'After 3 half-lives, what fraction of the original activity remains?', options: ['1/2', '1/4', '1/8', '1/16'], answer: 2, why: '(½)³ = 1/8 = 12.5 %.' },
        { q: 'A 10 Ci Ir-192 source (half-life ≈ 74 days) is used for 148 days. How much activity is left?', options: ['5 Ci', '2.5 Ci', '1.25 Ci', '0 Ci'], answer: 1, why: '148 days is 2 half-lives. 10 × (½)² = 2.5 Ci.' },
        { q: 'As a cobalt-60 source decays, the treatment time needed for the same dose…', options: ['Decreases', 'Stays the same', 'Increases', 'Becomes zero'], answer: 2, why: 'Dose rate falls, and time = dose ÷ dose rate, so time rises.' },
      ],
    },
  ];

  DE.lessons = lessons;
})();
