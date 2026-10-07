#!/usr/bin/env node
/*
 * Bundles index.html + css + js into ONE self-contained file: dist/dosecalc-edu.html
 * Double-click that file to run the app offline. No dependencies, no server.
 *
 *   node tools/build-single-file.js
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

let html = read('index.html');

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => `<style>\n${read(href)}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  const code = read(src);
  if (/<\/script/i.test(code)) throw new Error(`${src} contains "</script", which cannot be inlined safely`);
  return `<script>\n${code}\n</script>`;
});

const out = path.join(root, 'dist', 'dosecalc-edu.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`Wrote ${path.relative(root, out)} (${(html.length / 1024).toFixed(0)} KB)`);
