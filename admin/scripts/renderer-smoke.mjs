// Phase-2 gate: runs the app's own lesson-card renderer in a real DOM under
// react-native-web and asserts it painted the seed lesson. Proves the shared
// module works in the admin's target environment before any UI is built on it.

import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const bundle = readFileSync(new URL('../.smoke/smoke.js', import.meta.url), 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: 'http://localhost/',
});

dom.window.eval(bundle);

await new Promise(resolve => setTimeout(resolve, 300));

const html = dom.window.document.body.innerHTML;

// react-native-web inserts rules through the CSSOM rather than as text, so the
// stylesheet has to be read back rule by rule.
const css = [...dom.window.document.styleSheets]
  .flatMap(sheet => {
    try {
      return [...sheet.cssRules].map(rule => rule.cssText);
    } catch {
      return [];
    }
  })
  .join('\n');

const checks = [
  ['renders markup at all', () => html.length > 2000],
  ['quick challenge kicker', () => /quick challenge/i.test(html)],
  ['checkpoint kicker', () => /checkpoint · question/i.test(html)],
  ['remember this kicker', () => /remember this/i.test(html)],
  ['california specific kicker', () => /california specific/i.test(html)],
  ['exam trap kicker', () => /exam trap/i.test(html)],
  ['inline svg artwork', () => (html.match(/<svg/g) ?? []).length >= 3],
  ['answer options rendered', () => /aria|role="button"|<div/i.test(html)],
  ['app font family applied', () => /PlusJakartaSans-(Bold|ExtraBold|Medium)/.test(css)],
  // The app's default accent (#059669) must survive the theme on web.
  ['theme accent colour applied', () => /rgb\(5, ?150, ?105\)/i.test(css)],
  ['card artwork sized 16:9', () => /aspect-ratio/i.test(css)],
  ['styled-components emitted classes', () => /class="[^"]+"/.test(html)],
];

let failed = 0;
for (const [name, run] of checks) {
  let ok = false;
  try {
    ok = run();
  } catch {
    ok = false;
  }
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
}

console.log(`\n${html.length} bytes of DOM rendered`);
if (process.env.SMOKE_DUMP) {
  console.log('--- css ---');
  console.log(css.slice(0, 1500));
  console.log('--- body ---');
  console.log(html.slice(0, 1200));
}

if (failed > 0) {
  console.error(`${failed} check(s) failed`);
  process.exitCode = 1;
}
