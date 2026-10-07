# DoseCalc EDU

Learn radiation therapy dose calculations step by step.

Interactive lessons, calculators that **show their working**, and unlimited randomised practice problems. It runs entirely in the browser, with no installation, no accounts and no internet needed.

> **Educational use only.** The beam data is generic, rounded teaching data resembling a 6 MV photon beam. It is *not* measured data for any real machine. Never use this app to calculate treatment for a real patient.

## How to run it

**Easiest: one file.** Download [`dist/dosecalc-edu.html`](dist/dosecalc-edu.html) and double-click it. It opens in your browser and works offline. You can email it, put it on a USB stick or share it with classmates.

**Or open the project folder.** Double-click `index.html`. Same app, split into separate files.

**Or put it online (free), using GitHub Pages.**
1. On GitHub open the repository, then **Settings → Pages**.
2. Under *Build and deployment* choose **Deploy from a branch**, pick your main branch and the **/ (root)** folder, then **Save**.
3. After a minute the app is live at `https://<your-username>.github.io/dosecaledu/`.

(GitHub Pages on a *private* repository needs a paid GitHub plan. Make the repository public to use it for free.)

## What is inside

| Section | What you get |
| --- | --- |
| **Learn** | 8 short lessons, each with plain-English explanations, formulas, interactive widgets, key points and a quiz |
| **Calculators** | 11 calculators. Each one shows every step with your numbers substituted in |
| **Practice** | Randomised problems across 10 topics and 3 difficulty levels, with hints and full worked solutions |
| **Formulas** | A one-page formula sheet and a searchable glossary |

### Lessons

1. Dose, Gray and fractions
2. Depth dose (PDD)
3. Inverse-square law and changing SSD (Mayneord F)
4. Field size: equivalent square, Sc and Sp
5. Monitor units: the SSD technique
6. The isocentric (SAD) technique and TMR
7. Comparing schedules: BED and EQD2
8. Radioactive decay and cobalt-60 timing

Progress, quiz scores and practice statistics are saved in your own browser (`localStorage`). Nothing is sent anywhere.

## Conventions used for the calculations

- **Calibration:** 1.000 cGy per MU at dmax (1.5 cm), 10 × 10 cm field, with the dmax point 100 cm from the source. An SSD-type calibration (skin at 100 cm) can be selected under *Machine settings*.
- **SSD technique:** `MU = D ÷ (K · Sc · Sp · PDD/100 · ISF · WF · TF)`
- **SAD technique:** `MU = D ÷ (K · Sc · Sp · TMR · WF · TF)`
- **TMR is derived from PDD** (`TMR = PDD/100 × ((100+d)/(100+dmax))² × Sp(r_dmax)/Sp(r_d)`), so the two techniques agree. The SAD calculator shows a cross-check against the equivalent SSD treatment.
- **BED / EQD2:** simple linear-quadratic model (no repopulation term).

## Development

No build step is needed to run the app. Node 18+ is only used for tests and for bundling.

```bash
npm test          # unit tests for the calculation engine (node:test, no dependencies)
npm run build     # regenerate dist/dosecalc-edu.html from the source files
npm start         # optional: serve the folder locally on http://localhost:3000
```

```
index.html            page shell
css/styles.css        design tokens, light + dark theme, responsive layout
js/calc.js            calculation engine and teaching beam data (pure functions, unit-tested)
js/ui.js              DOM helpers, forms, SVG charts, quiz block, progress storage
js/calculators.js     the 11 calculators / interactive widgets
js/lessons.js         lesson content
js/practice.js        practice problem generators and page
js/reference.js       formula sheet and glossary
js/app.js             router, home page, lesson pages, theme
tests/calc.test.js    engine tests
tools/build-single-file.js   bundles everything into dist/dosecalc-edu.html
```

Remember to run `npm run build` and commit `dist/dosecalc-edu.html` after changing any source file. CI fails if the bundled file is out of date.

### Using your own beam data

All tables (PDD, Sc, Sp, wedge and tray factors, isotope half-lives) live at the top of `js/calc.js`. Replace the numbers to explore another machine. Remember that the app is for learning, not for patient treatment.
