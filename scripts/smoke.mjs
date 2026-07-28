#!/usr/bin/env node
/**
 * Route sweep against the real static build in a real browser.
 *
 * Typechecks and unit tests say the code is coherent; they say nothing about
 * whether a page actually renders. This loads every route the site ships, plus
 * every game, and fails on anything a user would notice: an uncaught error, a
 * console error, a page that renders nothing, or a layout that scrolls sideways
 * on a phone. It is the last gate before a deploy.
 *
 *   node scripts/smoke.mjs           # expects SMOKE_BASE to point at a served build
 */

import { chromium } from 'playwright-core';

const BASE = (process.env.SMOKE_BASE || 'http://localhost:3211/Soltrend').replace(/\/$/, '');
const EXECUTABLE = process.env.CHROMIUM_PATH || undefined;

/** Every route in the app, plus each built-in game. */
const ROUTES = [
  '/', '/arcade', '/creator', '/daily', '/discover', '/duel', '/floor', '/forge',
  '/leaderboard', '/live', '/market', '/profile', '/rewards', '/studio',
  '/studio/games', '/vault', '/verify', '/worlds', '/play/ugc',
  ...['dice', 'limbo', 'crash', 'mines', 'plinko', 'coinflip', 'wheel', 'towers', 'goldmine']
    .map((g) => `/play/${g}`),
  // The studio's builders are the highest-traffic authoring surface.
  ...['slot', 'towers', 'board', 'ascent', 'nexus', 'node'].map((k) => `/studio?make=${k}`),
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

/** Console noise that is not ours and cannot be fixed from here. */
const IGNORED = [
  /favicon/i,
  /Download the React DevTools/i,
  /WebGL|THREE\.WebGLRenderer|Could not create a WebGL context/i, // headless GPU
];

const failures = [];

function record(route, viewport, message) {
  failures.push(`${route} [${viewport}] — ${message}`);
}

const browser = await chromium.launch({
  executablePath: EXECUTABLE,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  // Past the age gate, so the sweep reaches the pages behind it.
  await context.addInitScript(() => {
    try {
      localStorage.setItem('soltrend-casino-v2', JSON.stringify({ state: { ageOk: true }, version: 0 }));
    } catch {
      /* storage disabled — the gate click below still handles it */
    }
  });

  for (const route of ROUTES) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`uncaught: ${String(e).split('\n')[0]}`));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const text = m.text();
      if (IGNORED.some((re) => re.test(text))) return;
      // Chrome logs a bare "Failed to load resource" with no URL, which is not
      // actionable; the response handler below reports the same thing with one.
      if (/Failed to load resource/i.test(text)) return;
      errors.push(`console: ${text.slice(0, 200)}`);
    });
    page.on('response', (r) => {
      if (r.status() < 400) return;
      if (IGNORED.some((re) => re.test(r.url()))) return;
      errors.push(`HTTP ${r.status()} for ${r.url()}`);
    });

    const [path, query] = route.split('?');
    const url = `${BASE}${path === '/' ? '/' : `${path}/`}${query ? `?${query}` : ''}`;

    try {
      const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
      if (res && res.status() >= 400) record(route, viewport.name, `HTTP ${res.status()}`);

      const gate = page.locator('button:has-text("I am 18 or older")').first();
      if (await gate.count()) await gate.click({ timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(1_200);

      // The page has to have actually rendered something.
      const textLength = await page.evaluate(() => document.body.innerText.trim().length);
      if (textLength < 40) record(route, viewport.name, `rendered almost nothing (${textLength} chars)`);

      // Nothing may push the page sideways — the commonest mobile defect. This
      // asks the question the user would: can the page be scrolled right? A
      // wide card inside a scroll rail is intentional and does not count.
      const sideways = await page.evaluate(() => {
        const before = window.scrollX;
        window.scrollTo(99_999, window.scrollY);
        const after = window.scrollX;
        window.scrollTo(before, window.scrollY);
        return after;
      });
      if (sideways > 1) record(route, viewport.name, `page scrolls ${sideways}px sideways`);

      for (const e of errors) record(route, viewport.name, e);
    } catch (err) {
      record(route, viewport.name, `navigation failed: ${String(err).split('\n')[0]}`);
    }
    await page.close();
  }
  await context.close();
}

await browser.close();

const checked = ROUTES.length * VIEWPORTS.length;
if (failures.length) {
  console.error(`\nSmoke sweep FAILED — ${failures.length} problem(s) across ${checked} page loads:\n`);
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}
console.error(`Smoke sweep passed — ${checked} page loads, no errors, no overflow.`);
