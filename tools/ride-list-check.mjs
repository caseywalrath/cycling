// Ride list and Today check (Session 30) — drives the real app in a browser at iPhone width.
//
// Seeds four rides (an indoor sweet-spot ride with power and heart rate, an outdoor ride with
// power, an indoor heart-rate-only ride, and a manual ride with no stream), then checks: the
// time-in-zone bar on each ride card (present only where there is a power stream) and that its
// segments match timeInZones proportions; the zone pills; the stat row (NP / Distance, Avg HR,
// TSS); the month heading totals; the Today "Latest ride" card; no horizontal scroll; no page
// errors. Prints PASS/FAIL per check; exits 1 on any FAIL.
// The expected zone split and Avg HR are computed with the app's own timeInZones and
// avgHrFromStream (imported from src/lib/analysis.js), at the seed FTP of 225W.
//
// Usage (dev server must already be running: `npx vite --port 3000`):
//   node tools/ride-list-check.mjs
// Override PW_MODULE / PW_CHROME / BASE_URL as in tools/v2-check.mjs. Screenshots go to tools/.out.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { timeInZones, avgHrFromStream } from '../src/lib/analysis.js';
import { ZONES } from '../src/lib/zones.js';
import { formatMinutes } from '../src/lib/format.js';

const PW_MODULE = process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs';
const PW_CHROME = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/cycling/';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '.out');
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = await import(PW_MODULE);
const KEY = 'cycling-progression-data-v2';
const FTP = 225;
const checks = [];
const ok = (name, cond, extra = '') => { checks.push([cond ? 'PASS' : 'FAIL', name, extra]); };

// ---------- seed ----------
// Deterministic watts: 30-bin (5 min) blocks cycling through recovery to anaerobic, with two dropouts.
const blockWatts = [90, 120, 150, 190, 210, 240, 270, 300];
const sweetPower = Array.from({ length: 360 }, (_, i) => (i === 45 || i === 200 ? null : blockWatts[Math.floor(i / 30) % blockWatts.length]));
const sweetHr = Array.from({ length: 360 }, (_, i) => (i === 45 || i === 200 ? null : 130 + (i % 40)));
const outdoorPower = Array.from({ length: 720 }, (_, i) => 100 + ((i * 37) % 180));
const outdoorHr = Array.from({ length: 720 }, (_, i) => 110 + (i % 20));
const hrOnlyHr = Array.from({ length: 300 }, (_, i) => 120 + (i % 25));

const ride = (id, date, over = {}) => ({
  id, date, name: `Ride ${id}`, rideType: 'Indoor', zone: 'sweetspot', rpe: 6, completed: true, duration: 60,
  normalizedPower: 190, intensityFactor: 0.84, tss: 70, source: 'manual', ...over,
});
const rides = [
  ride(1, '2026-11-12', { name: 'Sweet spot builder', duration: 60, normalizedPower: 205, intensityFactor: 0.91, tss: 70,
    stream: { binSeconds: 10, power: sweetPower, hr: sweetHr } }),
  ride(2, '2026-11-10', { name: 'Outdoor loop', rideType: 'Outdoor', zone: null, duration: 120, normalizedPower: 200,
    intensityFactor: 0.89, tss: 95, distance: 42.5, elevation: 1800,
    stream: { binSeconds: 10, power: outdoorPower, hr: outdoorHr } }),
  ride(3, '2026-10-20', { name: 'HR only ride', zone: null, duration: 50, normalizedPower: null, intensityFactor: null, tss: 40,
    stream: { binSeconds: 10, power: null, hr: hrOnlyHr } }),
  ride(4, '2026-10-05', { name: 'Manual endurance', zone: 'endurance', duration: 45, normalizedPower: 160, intensityFactor: 0.7, tss: 50 }),
];
const seed = {
  schemaVersion: 2, levels: { recovery: 1, endurance: 3, tempo: 3, sweetspot: 5, threshold: 3, vo2max: 3, anaerobic: 1 },
  ftp: FTP, intervalsFTP: null, event: { name: '', date: '', distance: 0, targetCTL: 0 },
  userProfile: { maxHR: null, restingHR: null, lthr: 140, weight: null, age: null, sex: 'male' },
  lastWorkedDates: {},
  history: rides,
};

// ---------- expected values, from the app's own functions ----------
const sweet = rides[0], outdoor = rides[1], hrOnly = rides[2], manual = rides[3];
const sweetZones = timeInZones(sweet, FTP);
const sweetTotal = Object.values(sweetZones).reduce((a, b) => a + b, 0);
const nonZeroZones = ZONES.filter(z => sweetZones[z.id] > 0).map(z => z.id);
const expectedWidths = Object.fromEntries(nonZeroZones.map(id => [id, (sweetZones[id] / sweetTotal) * 100]));
const monthKey = (d) => d.slice(0, 7);
const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};
const expectedMonth = {};
rides.forEach(r => {
  const k = monthLabel(monthKey(r.date));
  expectedMonth[k] ??= { minutes: 0, tss: 0 };
  expectedMonth[k].minutes += r.duration || 0;
  expectedMonth[k].tss += r.tss || 0;
});
const expectedMonthText = Object.fromEntries(Object.entries(expectedMonth).map(([k, v]) =>
  [k, `${formatMinutes(v.minutes)} · TSS ${Math.round(v.tss)}`]));

// ---------- browser ----------
const browser = await chromium.launch({ executablePath: PW_CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(([k, s]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(s)); }, [KEY, seed]);

const card = (name) => page.locator('[data-ride-card]', { hasText: name });
const noHorizontalScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

// ---------- Rides list ----------
await page.goto(`${BASE_URL}#/rides`);
await page.waitForSelector('[data-ride-card]');
await page.waitForTimeout(500);
ok('Rides list shows all four seeded rides', (await page.locator('[data-ride-card]').count()) === 4);

const barCount = async (name) => card(name).locator('[data-zone-mix-bar]').count();
ok('sweet-spot ride (power stream) has a zone-mix bar', (await barCount('Sweet spot builder')) === 1);
ok('outdoor ride (power stream) has a zone-mix bar', (await barCount('Outdoor loop')) === 1);
ok('HR-only ride has no zone-mix bar', (await barCount('HR only ride')) === 0);
ok('manual ride (no stream) has no zone-mix bar', (await barCount('Manual endurance')) === 0);

// Segment widths on the sweet-spot ride vs timeInZones.
const segs = await card('Sweet spot builder').locator('[data-zone-mix-bar] > [data-zone]')
  .evaluateAll(els => els.map(e => ({ zone: e.dataset.zone, width: parseFloat(e.style.width) })));
ok('sweet-spot bar has one segment per zone with time (and at least three)',
  JSON.stringify(segs.map(s => s.zone)) === JSON.stringify(nonZeroZones) && segs.length >= 3,
  segs.map(s => s.zone).join(','));
const widthDiffs = segs.map(s => Math.abs(s.width - expectedWidths[s.zone]));
ok('sweet-spot segment widths match timeInZones proportions (within 1%)',
  widthDiffs.every(d => d < 1),
  segs.map(s => `${s.zone} ${s.width.toFixed(2)}% vs ${expectedWidths[s.zone].toFixed(2)}%`).join('; '));

const pillText = async (name) => (await card(name).locator('[data-ride-pill]').textContent()).trim();
ok('pill reads "Sweet Spot" on the sweet-spot ride', (await pillText('Sweet spot builder')) === 'Sweet Spot');
ok('pill reads "Outdoor" on the outdoor ride', (await pillText('Outdoor loop')) === 'Outdoor');
ok('pill reads "Needs zone" on the indoor HR-only ride', (await pillText('HR only ride')) === 'Needs zone');

const statsOf = async (name) => card(name).locator('[data-ride-stats]').evaluate(el =>
  [...el.children].map(c => ({ label: c.children[1].textContent.trim(), value: c.children[0].textContent.trim() })));
const sweetStats = await statsOf('Sweet spot builder');
const outdoorStats = await statsOf('Outdoor loop');
const manualStats = await statsOf('Manual endurance');
const hrOnlyStats = await statsOf('HR only ride');
const labels = (s) => s.map(x => x.label).join(',');
ok('indoor ride stat row is Time · NP · Avg HR · TSS', labels(sweetStats) === 'Time,NP,Avg HR,TSS', labels(sweetStats));
ok('outdoor ride stat row is Time · Distance · Avg HR · TSS', labels(outdoorStats) === 'Time,Distance,Avg HR,TSS', labels(outdoorStats));
ok('NP shows the ride NP (205W) on the sweet-spot ride', sweetStats.find(x => x.label === 'NP')?.value === '205W', JSON.stringify(sweetStats));
ok('Distance shows 42.5 mi on the outdoor ride', outdoorStats.find(x => x.label === 'Distance')?.value === '42.5mi', JSON.stringify(outdoorStats));
ok('Avg HR on the manual ride is "—"', manualStats.find(x => x.label === 'Avg HR')?.value === '—', JSON.stringify(manualStats));
ok('Avg HR on the sweet-spot ride matches avgHrFromStream',
  sweetStats.find(x => x.label === 'Avg HR')?.value === String(avgHrFromStream(sweet)),
  `${sweetStats.find(x => x.label === 'Avg HR')?.value} vs ${avgHrFromStream(sweet)}`);
ok('Avg HR on the HR-only ride matches avgHrFromStream',
  hrOnlyStats.find(x => x.label === 'Avg HR')?.value === String(avgHrFromStream(hrOnly)),
  `${hrOnlyStats.find(x => x.label === 'Avg HR')?.value} vs ${avgHrFromStream(hrOnly)}`);

// Month heading totals.
const monthTotals = await page.$$eval('[data-month-total]', els => els.map(e => ({
  label: e.parentElement.textContent.replace(e.textContent, '').trim(),
  total: e.textContent.replace(/\s+/g, ' ').trim(),
})));
const gotMonths = Object.fromEntries(monthTotals.map(m => [m.label, m.total]));
ok('each month heading shows its summed time and TSS', JSON.stringify(gotMonths) === JSON.stringify(expectedMonthText),
  JSON.stringify(gotMonths) + ' vs ' + JSON.stringify(expectedMonthText));

ok('no horizontal scroll on #/rides', await noHorizontalScroll());
await page.screenshot({ path: path.join(OUT, 'rides-390.png') });
await page.screenshot({ path: path.join(OUT, 'rides-390-full.png'), fullPage: true });

// ---------- Today ----------
await page.goto(`${BASE_URL}#/today`);
const latest = page.locator('[aria-label^="Latest ride"]');
await latest.waitFor();
await page.waitForTimeout(500);
ok('Latest ride card is the sweet-spot ride', (await latest.getAttribute('aria-label')) === 'Latest ride: Sweet spot builder');
ok('Latest ride card contains a zone-mix bar (ride has power)', (await latest.locator('[data-zone-mix-bar]').count()) === 1);
ok('Latest ride card contains the stat row', (await latest.locator('[data-ride-stats]').count()) === 1);
ok('no horizontal scroll on #/today', await noHorizontalScroll());
await page.screenshot({ path: path.join(OUT, 'today-390.png') });
await page.screenshot({ path: path.join(OUT, 'today-390-full.png'), fullPage: true });

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
checks.forEach(c => console.log(c.join('  ')));
await browser.close();
process.exit(checks.some(c => c[0] === 'FAIL') ? 1 : 0);
