// V2 regression check — see V2_PLAN.md §0.4.
//
// Seeds the app with a fixed, synthetic 12-month ride history, freezes the clock at
// 2026-09-25 12:00, imports a synthetic .tcx file through the Log Ride sheet, then
// records the numbers that must not change by accident and screenshots every tab and one
// Ride page at iPhone width (390px). Compares against tools/v2-baseline.json and prints
// any diffs. Since V2 Phase 3 it also lists tap targets under 44px and checks for
// horizontal scrolling on each tab (printed and saved to .out/extras.json, not diffed).
//
// Usage (dev server must already be running: `npx vite --port 3000`):
//   node tools/v2-check.mjs                 # compare against baseline
//   node tools/v2-check.mjs --write-baseline  # overwrite the baseline (only when a phase
//                                             # intentionally changes a number)
//
// Playwright is not a project dependency. In Claude Code cloud sessions it is installed
// globally; override the paths below with PW_MODULE / PW_CHROME if yours differ.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PW_MODULE = process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs';
const PW_CHROME = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/cycling/';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '.out');
const BASELINE = path.join(HERE, 'v2-baseline.json');
const WRITE = process.argv.includes('--write-baseline');
const { chromium } = await import(PW_MODULE);
fs.mkdirSync(OUT, { recursive: true });

// ---------- deterministic seed data ----------
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const FTP = 231;
const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const mkStream = segs => {
  const power = [], hr = [];
  segs.forEach(([w, m, h]) => {
    for (let i = 0; i < m * 6; i++) { power.push(Math.round(w + (rnd() - 0.5) * 8)); hr.push(Math.round(h + (i / (m * 6)) * 6)); }
  });
  return { binSeconds: 10, power, hr };
};
const history = [];
let id = 1000;
for (let d = new Date(2025, 9, 1); d <= new Date(2026, 8, 24); d.setDate(d.getDate() + 1)) {
  const dow = d.getDay();
  if (![2, 4, 6, 0].includes(dow) || rnd() < 0.2) continue;
  const date = fmt(d);
  const legacy = d < new Date(2026, 6, 1);
  if (dow === 6 || dow === 0) {
    const dur = Math.round(90 + rnd() * 150), np = Math.round(165 + rnd() * 30);
    history.push({ id: id++, date, name: legacy ? 'Morning Ride' : 'Saturday Outdoor', zone: null, workoutLevel: null,
      rpe: legacy ? null : 6, completed: true, duration: dur, normalizedPower: np, rideType: 'Outdoor',
      distance: Math.round(dur / 60 * 15 * 10) / 10, elevation: Math.round(rnd() * 4000),
      notes: legacy ? 'Imported from CSV' : '', previousLevel: null, newLevel: null, change: 0,
      tss: Math.round(dur / 60 * (np / FTP) ** 2 * 100), intensityFactor: np / FTP,
      source: legacy ? 'imported' : 'manual', ...(legacy ? { eFTP: 215 + Math.round(rnd() * 15) } : {}) });
  } else {
    const zones = ['endurance', 'sweetspot', 'threshold', 'vo2max', 'tempo'];
    const zone = zones[Math.floor(rnd() * zones.length)];
    const w = { endurance: 150, tempo: 175, sweetspot: 205, threshold: 225, vo2max: 265 }[zone];
    const rep = zone === 'vo2max' ? 4 : 12;
    const segs = zone === 'endurance' ? [[150, 60, 130]]
      : [[130, 10, 110], [w, rep, 150], [120, 4, 120], [w, rep, 155], [120, 4, 120], [w, rep, 158], [120, 10, 115]];
    const dur = segs.reduce((s, x) => s + x[1], 0), np = Math.round(w * 0.9);
    const lvl = 1 + rnd() * 4;
    history.push({ id: id++, date, name: `${zone[0].toUpperCase() + zone.slice(1)} ${Math.round(rnd() * 9) + 1}`,
      zone: legacy && rnd() < 0.3 ? null : zone, workoutLevel: 5, rpe: 5 + Math.round(rnd() * 3), completed: true,
      duration: dur, normalizedPower: np, rideType: 'Indoor', distance: 0, elevation: 0, notes: '',
      previousLevel: lvl, newLevel: lvl + 0.3, change: 0.3, tss: Math.round(dur / 60 * (np / FTP) ** 2 * 100),
      intensityFactor: np / FTP, source: legacy ? 'imported' : 'manual', ...(legacy ? { eFTP: 220 } : {}),
      ...(!legacy ? { stream: mkStream(segs), intervalData: null } : {}) });
  }
}
history.sort((a, b) => b.date.localeCompare(a.date));
const payload = {
  levels: { recovery: 1, endurance: 4.2, tempo: 3.1, sweetspot: 5.4, threshold: 3.8, vo2max: 2.6, anaerobic: 1.2 },
  history, ftp: FTP, intervalsFTP: 224,
  event: { name: 'Gran Fondo Utah', date: '2026-06-13', distance: 100, targetCTL: 85 },
  userProfile: { maxHR: 182, restingHR: 52, weight: 172, age: 44, sex: 'male' },
  vo2maxEstimates: [],
  powerCurveData: [[5, 712], [30, 553], [60, 362], [300, 293], [600, 265], [1200, 209], [1800, 203], [3600, 184], [7200, 158]]
    .map(([secs, watts]) => ({ secs, watts })),
  exportedAt: '2026-09-24T12:00:00.000Z', lastSyncedAt: null,
  lastWorkedDates: { endurance: '2026-09-20', tempo: '2026-08-01', sweetspot: '2026-09-18', threshold: '2026-09-11', vo2max: '2026-07-15', anaerobic: '2026-03-01' },
};

// ---------- synthetic TCX: indoor 3x8 @ 250W, no GPS, 1-second trackpoints ----------
const tcxSegs = [[130, 10, 115], [250, 8, 160], [120, 4, 125], [250, 8, 165], [120, 4, 125], [250, 8, 168], [125, 12, 120]];
let t = Date.UTC(2026, 8, 23, 13, 0, 0);
const tps = [];
tcxSegs.forEach(([w, m, h]) => {
  for (let i = 0; i < m * 60; i++) {
    tps.push(`<Trackpoint><Time>${new Date(t).toISOString()}</Time><HeartRateBpm><Value>${h + Math.round(i / 60)}</Value></HeartRateBpm><Extensions><ns3:TPX><ns3:Watts>${w + (i % 5) - 2}</ns3:Watts></ns3:TPX></Extensions></Trackpoint>`);
    t += 1000;
  }
});
const totalSec = tcxSegs.reduce((s, x) => s + x[1] * 60, 0);
const tcx = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
<Activities><Activity Sport="Biking"><Id>2026-09-23T13:00:00Z</Id><Lap StartTime="2026-09-23T13:00:00Z"><TotalTimeSeconds>${totalSec}</TotalTimeSeconds><DistanceMeters>0</DistanceMeters><Track>
${tps.join('\n')}
</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
const tcxPath = path.join(OUT, 'synthetic-3x8.tcx');
fs.writeFileSync(tcxPath, tcx);

// ---------- run ----------
const browser = await chromium.launch({ executablePath: PW_CHROME });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date(2026, 8, 25, 12, 0, 0));
const errors = [], dialogs = [];
page.on('pageerror', e => errors.push(String(e)));
// External scripts (Google sign-in) can't load in a sandbox; only count errors from the app itself.
page.on('console', m => { if (m.type() === 'error' && (m.location()?.url || BASE_URL).startsWith(new URL(BASE_URL).origin)) errors.push(m.text()); });
page.on('dialog', async d => { dialogs.push(d.message().slice(0, 160)); await d.dismiss(); });

await page.goto(BASE_URL);
await page.evaluate(d => {
  localStorage.clear();
  localStorage.setItem('cycling-progression-data-v2', JSON.stringify(d));
  localStorage.setItem('eftp-prompted-value', '999');
}, payload);
await page.reload();
await page.waitForTimeout(1500);

// ---------- helpers (V2 Phase 3: four tabs, hash routing) ----------
const text = sel => page.evaluate(s => {
  const el = document.querySelector(s);
  return el ? el.textContent.replace(/ /g, ' ').replace(/\s+/g, ' ').trim() : null;
}, sel);

// Tap targets smaller than 44px (visible buttons, links, file-picker labels, form fields).
const smallTapTargets = () => page.evaluate(() => {
  const els = [...document.querySelectorAll('button, a[href], [role="button"], label:has(input[type=file]), input:not([type=hidden]):not([type=file]), select, textarea')];
  const out = [];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || style.visibility === 'hidden' || style.display === 'none') continue;
    if (el.type === 'checkbox' && el.closest('label')) continue; // the whole label is the target
    if (r.height < 43.5 || r.width < 43.5) {
      const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 40);
      out.push(`${el.tagName.toLowerCase()} "${name}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }
  return [...new Set(out)];
});

const hasHorizontalScroll = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

// Full-length screenshot, plus one at phone height scrolled to the bottom (to check the tab
// bar and the ＋ Log Ride button don't cover the last content).
const shootTab = async (name) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const h = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
  await page.setViewportSize({ width: 390, height: Math.min(h, 8000) });
  await page.waitForTimeout(1800); // let Recharts finish its draw-in animation
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${name}-bottom.png`) });
  await page.evaluate(() => window.scrollTo(0, 0));
};

const extras = { tapTargetsUnder44: {}, horizontalScroll: {} };
const goTab = async (tab) => {
  await page.evaluate(h => { window.location.hash = h; }, `#/${tab}`);
  await page.waitForTimeout(700);
};

// ---------- numbers (read from the Today tab) ----------
await goTab('today');
const numbers = {
  ftpLine: await text('[data-ftp-line]'),
  ctl: await text('[data-stat="ctl"] [data-value]'),
  atl: await text('[data-stat="atl"] [data-value]'),
  tsb: await text('[data-stat="tsb"] [data-value]'),
  trainingStatus: await text('[data-training-status]'),
  rideCount: history.length,
};

// ---------- each tab: screenshots, tap targets, horizontal scroll ----------
for (const tab of ['today', 'rides', 'progress', 'settings']) {
  await goTab(tab);
  extras.tapTargetsUnder44[tab] = await smallTapTargets();
  extras.horizontalScroll[tab] = await hasHorizontalScroll();
  await shootTab(tab);
}
await goTab('today');

// Open the Log Ride sheet (＋ Log Ride on Today) and screenshot both entry modes (V2 Phase 4:
// "Import file" is the default; "Enter manually" starts every field empty) before importing
// and saving the synthetic TCX.
let imported = null;
let importedId = null;
try {
  await page.getByRole('button', { name: /log ride/i }).first().click();
  await page.waitForTimeout(500);
  extras.tapTargetsUnder44.logRideSheetImportMode = await smallTapTargets();
  await page.screenshot({ path: path.join(OUT, 'log-ride-import-mode.png') });

  await page.getByRole('tab', { name: /enter manually/i }).click();
  await page.waitForTimeout(300);
  extras.tapTargetsUnder44.logRideSheetManualMode = await smallTapTargets();
  await page.screenshot({ path: path.join(OUT, 'log-ride-manual-mode.png') });

  await page.getByRole('tab', { name: /import file/i }).click();
  await page.waitForTimeout(300);
  await page.locator('input[type=file][accept*=".tcx"]').first().setInputFiles(tcxPath);
  await page.waitForTimeout(1500);
  extras.tapTargetsUnder44.logRideSheet = await smallTapTargets();
  await page.screenshot({ path: path.join(OUT, 'log-ride-after-import.png') });
  await page.getByRole('button', { name: /^(save|update)( workout| ride)?$/i }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'post-log-summary.png') });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cycling-progression-data-v2')).history);
  const r = saved.find(w => w.date === '2026-09-23');
  importedId = r ? r.id : null;
  imported = r ? {
    duration: r.duration, normalizedPower: r.normalizedPower, tss: r.tss, rideType: r.rideType, zone: r.zone,
    streamBins: r.stream?.power?.length ?? null, hrBins: r.stream?.hr?.filter(v => v != null).length ?? null,
    intervalLabel: r.intervalData?.label ?? null, intervalCategory: r.intervalData?.category ?? null,
    // V2 Phase 5: full-resolution bests/HR stats saved at import (§5.1). best 5-minute power
    // should be ~250 (the synthetic file's 3x8 @ 250W work intervals).
    best300: r.bests?.['300'] ?? null, hrStats: r.hrStats ?? null,
  } : 'NOT SAVED';
} catch (e) {
  imported = `IMPORT FLOW FAILED: ${e.message.split('\n')[0]}`;
}

// One Ride page: the ride just imported.
if (importedId != null) {
  await page.getByRole('button', { name: /^continue$/i }).first().click().catch(() => {});
  await page.waitForTimeout(400);
  await page.evaluate(h => { window.location.hash = h; }, `#/ride/${importedId}`);
  await page.waitForTimeout(1200);
  extras.tapTargetsUnder44.ridePage = await smallTapTargets();
  extras.horizontalScroll.ridePage = await hasHorizontalScroll();
  await shootTab('ride-page');
}

const result = {
  numbers,
  importedTcx: imported,
  pageErrors: errors,
  dialogs,
};
fs.writeFileSync(path.join(OUT, 'extras.json'), JSON.stringify(extras, null, 2));
fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
await browser.close();

console.log(JSON.stringify(result, null, 2));
console.log('\nLayout checks (not part of the baseline):');
console.log(JSON.stringify(extras, null, 2));
if (WRITE) {
  fs.writeFileSync(BASELINE, JSON.stringify(result, null, 2) + '\n');
  console.log(`\nBaseline written to ${BASELINE}`);
} else if (fs.existsSync(BASELINE)) {
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const diffs = [];
  const walk = (a, b, p) => {
    if (typeof a === 'object' && a && typeof b === 'object' && b) {
      new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => walk(a[k], b[k], p ? `${p}.${k}` : k));
    } else if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`${p}: baseline=${JSON.stringify(a)} now=${JSON.stringify(b)}`);
  };
  walk(base, result, '');
  console.log(diffs.length ? `\n${diffs.length} DIFFERENCE(S) vs baseline:\n  ${diffs.join('\n  ')}` : '\nNo differences vs baseline.');
}
console.log(`Screenshots: ${OUT}`);
