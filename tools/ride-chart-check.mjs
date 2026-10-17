// Ride page chart check (Session 28) — drives the real app in a browser at iPhone width.
//
// Seeds a long, noisy outdoor ride, a short indoor ERG ride, and an earlier ride to compare
// against, then checks: Auto smoothing (outdoor smoothed with a note, indoor raw with none), the
// Raw / 30s / 5 min choices and that the choice is remembered, the Best efforts bars (new, near,
// below, no reference) and the tap-for-detail line. Prints PASS/FAIL per check; exits 1 on any FAIL.
// Needs today's date to be within 90 days after 2026-10-10.
//
// Usage (dev server must already be running: `npx vite --port 3000`):
//   node tools/ride-chart-check.mjs
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
const SMOOTHING_KEY = 'ride-chart-smoothing';
const checks = [];
const ok = (name, cond, extra = '') => { checks.push([cond ? 'PASS' : 'FAIL', name, extra]); };

// Deterministic "road" noise: 3 hours at 10s bins, a base of ~180W with surges and coasting.
const noise = (i) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
const outdoorPower = Array.from({ length: 1080 }, (_, i) => Math.round(noise(i) < 0.15 ? 0 : 120 + noise(i + 5000) * 200));
const outdoorHr = outdoorPower.map((p, i) => 110 + Math.round(p / 10) + (i % 7));
const ermPower = Array.from({ length: 360 }, (_, i) => (i < 36 ? 120 : (i >= 120 && i < 180) || (i >= 250 && i < 310) ? 204 : 125));

const ride = (id, date, over = {}) => ({
  id, date, name: `Ride ${id}`, rideType: 'Indoor', zone: 'sweetspot', rpe: 6, completed: true, duration: 60,
  normalizedPower: 190, intensityFactor: 0.84, tss: 70, source: 'manual', ...over,
});
const seed = {
  schemaVersion: 2, levels: { recovery: 1, endurance: 3, tempo: 3, sweetspot: 5, threshold: 3, vo2max: 3, anaerobic: 1 },
  ftp: 225, intervalsFTP: null, event: { name: '', date: '', distance: 0, targetCTL: 0 },
  userProfile: { maxHR: null, restingHR: null, lthr: 140, weight: null, age: null, sex: 'male' },
  lastWorkedDates: {},
  history: [
    ride(1, '2026-10-10', {
      name: 'Long road ride', rideType: 'Outdoor', zone: null, duration: 180,
      bests: { 5: 700, 60: 400, 300: 300, 1200: 250, 3600: 220 },
      stream: { binSeconds: 10, power: outdoorPower, hr: outdoorHr },
    }),
    ride(2, '2026-09-20', { name: 'Earlier ride', bests: { 5: 650, 60: 380, 300: 310, 1200: 280 } }),
    ride(3, '2026-10-12', {
      name: 'ERG session', bests: { 60: 210, 300: 205 },
      stream: { binSeconds: 10, power: ermPower, hr: ermPower.map(() => null) },
    }),
  ],
};

const browser = await chromium.launch({ executablePath: PW_CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(([k, s]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(s)); }, [KEY, seed]);

const settle = () => page.waitForTimeout(1800); // let the chart finish drawing
const note = () => page.locator('[data-smoothing-note]');
const tab = (name) => page.getByRole('tab', { name, exact: true });

// Outdoor ride, Auto.
await page.goto(`${BASE_URL}#/ride/1`);
await page.waitForSelector('[data-best-effort]');
ok('Auto is selected by default', (await tab('Auto').getAttribute('aria-selected')) === 'true');
ok('long outdoor ride is smoothed with a 2-min average and says so', /2-min average/.test(await note().innerText()), await note().innerText());
await settle();
await page.locator('.recharts-responsive-container').first().screenshot({ path: path.join(OUT, 'chart-outdoor-auto.png') });
// How jagged the power line is: total up-and-down travel along the drawn curve, sampled evenly.
const jagged = async () => page.locator('.recharts-area-curve').first().evaluate((el) => {
  const len = el.getTotalLength();
  let total = 0, last = null;
  for (let i = 0; i <= 600; i++) { const y = el.getPointAtLength((len * i) / 600).y; if (last != null) total += Math.abs(y - last); last = y; }
  return Math.round(total);
});
const smoothJag = await jagged();

await tab('Raw').click();
ok('Raw removes the note', (await note().count()) === 0);
await settle();
await page.locator('.recharts-responsive-container').first().screenshot({ path: path.join(OUT, 'chart-outdoor-raw.png') });
const rawJag = await jagged();
ok('Raw line is much more jagged than Auto (at least twice the up-and-down travel)', rawJag > smoothJag * 2, `raw ${rawJag}px vs auto ${smoothJag}px`);

await tab('5 min').click();
ok('5 min shows a 5-min average note', /5-min average/.test(await note().innerText()));
await page.reload();
await page.waitForSelector('[data-best-effort]');
ok('the choice is remembered after a reload', (await tab('5 min').getAttribute('aria-selected')) === 'true');
ok('it is kept in the device-local key', (await page.evaluate((k) => localStorage.getItem(k), SMOOTHING_KEY)) === '300');
await page.evaluate((k) => localStorage.setItem(k, 'auto'), SMOOTHING_KEY);

// Best efforts bars on the outdoor ride.
await page.reload();
await page.waitForSelector('[data-best-effort]');
const status = async (d) => page.locator(`[data-best-effort="${d}"]`).getAttribute('data-status');
const barWidth = async (d) => page.locator(`[data-best-effort="${d}"] [data-best-bar] > div`).evaluate(el => el.style.width).catch(() => null);
ok('5s and 1m beat the prior 90-day best (new)', (await status('5')) === 'new' && (await status('60')) === 'new');
ok('5m is within 5% of the best (near), bar about 97%', (await status('300')) === 'near' && Math.abs(parseFloat(await barWidth('300')) - 96.77) < 0.1, await barWidth('300'));
ok('20m is below (grey), bar about 89%', (await status('1200')) === 'below' && Math.abs(parseFloat(await barWidth('1200')) - 89.29) < 0.1, await barWidth('1200'));
ok('60m has nothing earlier to compare with: no bar', (await page.locator('[data-best-effort="3600"] [data-best-bar]').count()) === 0);
ok('a new best still shows the star', (await page.locator('[data-best-effort="60"]').innerText()).includes('New best'));
ok('detail line is hidden until a bar is tapped', (await page.locator('[data-best-detail]').count()) === 0);
await page.locator('[data-best-effort="300"]').click();
const detail = await page.locator('[data-best-detail]').innerText();
ok('tapping 5m explains it: 97% of 310W on Sep 20', /97% of your 90-day best of 310W \(Sep 20\)/.test(detail), detail);
await page.locator('[data-best-effort="60"]').click();
ok('tapping 1m says new best, 5% above 380W', /new best, 5% above your 90-day best of 380W/.test(await page.locator('[data-best-detail]').innerText()), await page.locator('[data-best-detail]').innerText());
await page.locator('[data-best-effort="60"]').click();
ok('tapping again hides the detail', (await page.locator('[data-best-detail]').count()) === 0);
await page.locator('[data-best-effort]').first().scrollIntoViewIfNeeded();
await page.screenshot({ path: path.join(OUT, 'ride-best-efforts.png') });

// Indoor ride, Auto: raw, no note.
await page.goto(`${BASE_URL}#/ride/3`);
await page.waitForSelector('[data-best-effort]');
ok('short indoor ride stays raw under Auto: no note', (await note().count()) === 0);
await tab('30s').click();
ok('30s on the indoor ride shows a 30-s note', /30-s average/.test(await note().innerText()));
await settle();
await page.locator('.recharts-responsive-container').first().screenshot({ path: path.join(OUT, 'chart-indoor-30s.png') });

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
checks.forEach(c => console.log(c.join('  ')));
await browser.close();
process.exit(checks.some(c => c[0] === 'FAIL') ? 1 : 0);
