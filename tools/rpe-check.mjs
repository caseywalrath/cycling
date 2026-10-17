// RPE check (Session 29) — drives the real app in a browser at iPhone width.
//
// Checks: a new ride starts with no rating ("Not rated", nothing selected); the CR10 hint is
// shown; tapping a number rates and tapping it again clears; the ring marks the typical number
// for the chosen zone; saving unrated stores null and the post-log summary says so; editing an
// unrated ride doesn't turn it into a 5; the Ride page shows the rating against what's typical
// and lets you rate, change and clear it; Copy for Claude writes "RPE n (expected e, +d)", "RPE
// not rated" and the one-line summary. Prints PASS/FAIL per check; exits 1 on any FAIL.
//
// The import check uses tools/.out/synthetic-3x8.tcx, which tools/v2-check.mjs writes (run it once first).
//
// Usage (dev server must already be running: `npx vite --port 3000`):
//   node tools/rpe-check.mjs
// Override PW_MODULE / PW_CHROME / BASE_URL as in tools/v2-check.mjs. Screenshots go to tools/.out.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PW_MODULE = process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs';
const PW_CHROME = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/cycling/';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '.out');
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = await import(PW_MODULE);
const KEY = 'cycling-progression-data-v2';
const checks = [];
const ok = (name, cond, extra = '') => { checks.push([cond ? 'PASS' : 'FAIL', name, extra]); };

const isoDaysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ride = (id, daysAgo, over = {}) => ({
  id, date: isoDaysAgo(daysAgo), name: `Ride ${id}`, rideType: 'Indoor', zone: 'sweetspot', rpe: 6, completed: true,
  duration: 60, normalizedPower: 200, intensityFactor: 0.89, tss: 70, source: 'manual', ...over,
});
const seed = {
  schemaVersion: 2, levels: { recovery: 1, endurance: 3, tempo: 3, sweetspot: 5, threshold: 3, vo2max: 3, anaerobic: 1 },
  ftp: 225, intervalsFTP: null, event: { name: '', date: '', distance: 0, targetCTL: 0 },
  userProfile: { maxHR: null, restingHR: null, lthr: 140, weight: null, age: null, sex: 'male' },
  lastWorkedDates: {},
  history: [
    ride(1, 3, { name: 'Sweet spot', zone: 'sweetspot', rpe: 7 }),                                           // expected 6, +1
    ride(2, 5, { name: 'Long road ride', rideType: 'Outdoor', zone: null, duration: 180, intensityFactor: 0.7, rpe: null }), // unrated
  ],
};

const browser = await chromium.launch({ executablePath: PW_CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE_URL).origin });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(([k, s]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(s)); }, [KEY, seed]);
const stored = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).history, KEY);
const rpeBtn = (n) => page.locator(`[data-rpe="${n}"]`);

// ---- Log Ride sheet, manual entry ----
await page.goto(BASE_URL);
await page.getByRole('button', { name: /log ride/i }).first().click();
await page.getByRole('tab', { name: /enter manually/i }).click();
await page.locator('[data-rpe-value]').waitFor();
ok('a new ride starts "Not rated"', (await page.locator('[data-rpe-value]').innerText()) === 'Not rated');
ok('no number is selected', (await page.locator('[data-rpe][aria-pressed="true"]').count()) === 0);
const hint = await page.locator('[data-rpe-value]').locator('xpath=ancestor::div[1]').innerText();
ok('the scale shows the CR10 anchors and "whole ride" advice', /3 moderate · 5 hard · 7 very hard · 10 maximal/.test(hint) && /whole ride, not the hardest moment/.test(hint), hint);

await page.getByRole('button', { name: /^sweet spot$/i }).first().click();
ok('with Sweet Spot chosen, 6 is ringed as typical', (await rpeBtn(6).getAttribute('class')).includes('ring-blue-400') && (await rpeBtn(7).getAttribute('class')).includes('ring-blue-400') === false);
await page.getByRole('button', { name: /^vo2 ?max$/i }).first().click();
ok('with VO2max chosen, 8 is ringed instead', (await rpeBtn(8).getAttribute('class')).includes('ring-blue-400'));
await rpeBtn(8).click();
ok('tapping 8 rates the ride', (await page.locator('[data-rpe-value]').innerText()) === '8' && (await rpeBtn(8).getAttribute('aria-pressed')) === 'true');
await rpeBtn(8).click();
ok('tapping 8 again clears it', (await page.locator('[data-rpe-value]').innerText()) === 'Not rated');

await page.locator('#ride-duration').fill('60');
await page.locator('#ride-np').fill('190');
await page.locator('[data-rpe-value]').scrollIntoViewIfNeeded();
await page.screenshot({ path: path.join(OUT, 'rpe-log-sheet.png') });
await page.getByRole('button', { name: /^(save|update)( workout| ride)?$/i }).first().click();
await page.waitForTimeout(800);
let history = await stored();
const unrated = history.find(w => w.name === 'Indoor ride');
ok('saving without a rating stores no RPE (null, not 5)', unrated && unrated.rpe === null, JSON.stringify(unrated?.rpe));
ok('the post-log summary says "Not rated"', /Not rated/.test(await page.locator('body').innerText()));
await page.screenshot({ path: path.join(OUT, 'rpe-post-log.png') });
await page.getByRole('button', { name: /^continue$/i }).first().click().catch(() => {});

// ---- Importing a file never arrives pre-rated, even after a rating was tapped on an abandoned form ----
await page.getByRole('button', { name: /log ride/i }).first().click();
await page.getByRole('tab', { name: /enter manually/i }).click();
await rpeBtn(7).click();
await page.getByRole('button', { name: /^cancel$/i }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /log ride/i }).first().click();
await page.getByRole('tab', { name: /import file/i }).click();
await page.locator('input[type=file][accept*=".tcx"]').first().setInputFiles(path.join(OUT, 'synthetic-3x8.tcx'));
await page.waitForSelector('[data-rpe-value]');
ok('importing a file starts "Not rated" (a 7 tapped earlier does not carry over)', (await page.locator('[data-rpe-value]').innerText()) === 'Not rated');
await page.getByRole('button', { name: /^cancel$/i }).click();
await page.waitForTimeout(500);

// ---- Editing an unrated ride keeps it unrated ----
await page.evaluate(() => { window.location.hash = '#/rides'; });
await page.goto(`${BASE_URL}#/ride/${unrated.id}`);
await page.waitForSelector('[data-ride-rpe]');
ok('Ride page shows "Not rated" for it', (await page.locator('[data-ride-rpe-value]').innerText()) === 'Not rated');
ok('and what is typical (Endurance/zone picked: a number is shown)', /Typical for a ride like this: \d/.test(await page.locator('[data-ride-rpe-expected]').innerText()));
await page.getByRole("button", { name: /^edit ride$/i }).first().click();
await page.waitForSelector('[data-rpe-value]');
ok('editing an unrated ride opens it as "Not rated"', (await page.locator('[data-rpe-value]').innerText()) === 'Not rated');
await page.getByRole('button', { name: /^(save|update)( workout| ride)?$/i }).first().click();
await page.waitForTimeout(600);
history = await stored();
ok('saving the edit leaves it unrated (not turned into a 5)', history.find(w => w.id === unrated.id).rpe === null);
await page.getByRole('button', { name: /^continue$/i }).first().click().catch(() => {});

// ---- Ride page: rate, change, clear ----
await page.goto(`${BASE_URL}#/ride/2`);
await page.waitForSelector('[data-ride-rpe]');
ok('long outdoor ride: typical effort is 5 (IF 0.70 gives 4, +1 for 3 hours)', /Typical for a ride like this: 5/.test(await page.locator('[data-ride-rpe-expected]').innerText()), await page.locator('[data-ride-rpe-expected]').innerText());
ok('the button says "Rate"', (await page.locator('[data-ride-rpe-toggle]').innerText()) === 'Rate');
await page.locator('[data-ride-rpe-toggle]').click();
await rpeBtn(5).scrollIntoViewIfNeeded();
await page.screenshot({ path: path.join(OUT, 'rpe-ride-page-rating.png') });
await rpeBtn(7).click();
ok('picking 7 shows 7/10 and the gap', (await page.locator('[data-ride-rpe-value]').innerText()) === '7/10' && /you rated \+2/.test(await page.locator('[data-ride-rpe-expected]').innerText()));
ok('it is saved to the ride', (await stored()).find(w => w.id === 2).rpe === 7);
await rpeBtn(7).click();
ok('tapping 7 again clears it', (await page.locator('[data-ride-rpe-value]').innerText()) === 'Not rated' && (await stored()).find(w => w.id === 2).rpe === null);
await rpeBtn(5).click();
await page.locator('[data-ride-rpe-toggle]').click();
ok('Done closes the picker, and the button now says "Change"', (await page.locator('[data-rpe]').count()) === 0 && (await page.locator('[data-ride-rpe-toggle]').innerText()) === 'Change');

// ---- Copy for Claude ----
await page.goto(BASE_URL);
await page.getByRole('button', { name: /copy for claude/i }).click();
await page.waitForTimeout(400);
const text = await page.evaluate(() => navigator.clipboard.readText());
ok('export: "RPE 7 (expected 6, +1)" for the sweet spot ride', text.includes('RPE 7 (expected 6, +1)'), text.split('\n').filter(l => /RPE/.test(l)).join(' | '));
ok('export: "RPE 5 (expected 5)" for the long road ride', text.includes('RPE 5 (expected 5)'));
ok('export: an unrated ride says "RPE not rated"', text.includes('RPE not rated'));
ok('export: one summary line', /RPE vs expected, last 2 rated rides: \+0\.5 avg, none \+2 or more/.test(text), text.split('\n').filter(l => /RPE vs/.test(l)).join(' | '));

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
checks.forEach(c => console.log(c.join('  ')));
await browser.close();
process.exit(checks.some(c => c[0] === 'FAIL') ? 1 : 0);
