// FTP history check (Session 27) — drives the real app in a browser at iPhone width.
//
// Seeds a small made-up ride history, then: records FTP changes in Settings → FTP history, checks
// bad input is refused, previews and applies "Re-score my rides", checks the ride page names the
// FTP of the day, undoes the re-score, changes FTP in Profile with an effective date, and checks a
// legacy install seeds a "from the beginning" entry. Prints PASS/FAIL per check; exits 1 on any FAIL.
// Needs today's date to be after 2026-10-13 (the seed's last FTP change).
//
// Usage (dev server must already be running: `npx vite --port 3000`):
//   node tools/ftp-history-check.mjs
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

const power = Array.from({ length: 360 }, (_, i) => (i < 36 ? 120 : (i >= 120 && i < 180) || (i >= 250 && i < 310) ? 204 : 125)); // 60 min @10s
const ride = (id, date, np, tssFtp, over = {}) => ({
  id, date, name: `Ride ${id}`, rideType: 'Indoor', zone: 'sweetspot', rpe: 7, completed: true, duration: 60,
  normalizedPower: np, intensityFactor: np / tssFtp, tss: Math.round((60 * np * (np / tssFtp)) / (tssFtp * 60) * 100),
  source: 'manual', ...over,
});
const seed = {
  schemaVersion: 2, levels: { recovery: 1, endurance: 3, tempo: 3, sweetspot: 5, threshold: 3, vo2max: 3, anaerobic: 1 },
  ftp: 225, intervalsFTP: null, event: { name: '', date: '', distance: 0, targetCTL: 0 },
  userProfile: { maxHR: null, restingHR: null, lthr: 140, weight: null, age: null, sex: 'male' },
  lastWorkedDates: {},
  history: [
    ride(1, '2026-10-08', 176, 225, { stream: { binSeconds: 10, power, hr: power.map(() => null) } }), // logged after FTP fell to 225
    ride(2, '2026-09-14', 170, 240),                                                                       // logged at 240, already right
    ride(3, '2026-08-05', 180, 225),                                                                       // logged late at 225
    ride(4, '2025-06-01', 150, 225),                                                                       // before the first entry
    ride(5, '2026-10-14', 170, 225, { stream: { binSeconds: 10, power, hr: power.map(() => null) } }),     // after the last change, has a power file
  ],
};

const browser = await chromium.launch({ executablePath: PW_CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(([k, s]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(s)); }, [KEY, seed]);

const saved = async () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
await page.goto(`${BASE_URL}#/settings`);
await page.waitForSelector('[data-ftp-history]');
ok('FTP history card shows with no rows and no re-score button', (await page.locator('[data-ftp-row]').count()) === 0 && (await page.getByText('Re-score my rides').count()) === 0);

// Add three rows and fill them.
for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Add a change' }).click();
const fill = [['2025-12-26', '230'], ['2026-07-01', '240'], ['2026-10-13', '225']];
for (let i = 0; i < 3; i++) {
  await page.getByLabel(`FTP change ${i + 1} date`).fill(fill[i][0]);
  await page.getByLabel(`FTP change ${i + 1} watts`).fill(fill[i][1]);
}
await page.getByRole('button', { name: 'Save FTP history' }).click();
await page.waitForTimeout(400);
let s = await saved();
ok('FTP history saved (3 entries, latest 225)', s.ftpHistory?.length === 3 && s.ftp === 225, JSON.stringify(s.ftpHistory));

// Bad input is refused.
await page.getByRole('button', { name: 'Add a change' }).click();
await page.getByLabel('FTP change 4 date').fill('2026-10-13');
await page.getByRole('button', { name: 'Save FTP history' }).click();
ok('duplicate date refused with a message', (await page.getByText('Two rows have the same date.').count()) === 1);
await page.getByRole('button', { name: 'Remove FTP change 4' }).click();

// Re-score preview.
await page.getByRole('button', { name: /Re-score my rides/ }).click();
await page.waitForSelector('[data-rescore-preview]');
const before = await page.locator('[data-rescore-row="ctl"] [data-before]').innerText();
const after = await page.locator('[data-rescore-row="ctl"] [data-after]').innerText();
const previewText = await page.locator('[data-rescore-preview]').innerText();
await page.screenshot({ path: `${OUT}/rescore-preview.png` });
ok('preview says 2 rides change (Oct 8 and Aug 5; Oct 14 is already right)', /for 2 rides/.test(previewText), previewText.split('\n')[0]);
ok('preview shows CTL now vs after', before !== undefined && after !== undefined, `CTL ${before} -> ${after}`);
await page.getByRole('button', { name: 'Re-score rides' }).click();
await page.waitForTimeout(400);
s = await saved();
const byId = Object.fromEntries(s.history.map(w => [w.id, w]));
ok('Oct 8 ride re-scored at 240 (IF 0.733, TSS 54)', Math.abs(byId[1].intensityFactor - 176 / 240) < 1e-6 && byId[1].tss === 54, `IF ${byId[1].intensityFactor} TSS ${byId[1].tss}`);
ok('Aug 5 ride re-scored at 240 too', Math.abs(byId[3].intensityFactor - 180 / 240) < 1e-6, `IF ${byId[3].intensityFactor}`);
ok('Sep 14 ride (already at 240) unchanged', byId[2].tss === seed.history[1].tss);
ok('ride before the first entry untouched', byId[4].tss === seed.history[3].tss && byId[4].intensityFactor === seed.history[3].intensityFactor);
ok('Undo re-score link appears', (await page.getByText('Undo re-score').count()) === 1);

// Ride page note.
await page.goto(`${BASE_URL}#/ride/1`);
await page.waitForSelector('[data-ride-ftp-note]', { timeout: 5000 }).catch(() => {});
const note = await page.locator('[data-ride-ftp-note]').allInnerTexts();
ok('ride page names the FTP of the day', note.join('').includes('240W'), note.join('|'));
await page.goto(`${BASE_URL}#/ride/5`);
await page.waitForSelector('text=Time in zones');
ok('a ride after the last change shows its zone bar with no FTP note', (await page.locator('[data-ride-ftp-note]').count()) === 0);

// Undo.
await page.goto(`${BASE_URL}#/settings`);
await page.waitForSelector('[data-ftp-history]');
await page.getByText('Undo re-score').click();
await page.waitForTimeout(400);
s = await saved();
byId[1] = s.history.find(w => w.id === 1);
ok('undo restores the Oct 8 ride', Math.abs(byId[1].intensityFactor - 176 / 225) < 1e-6 && byId[1].tss === seed.history[0].tss, `IF ${byId[1].intensityFactor}`);

// Changing FTP in Profile shows the effective date and records it.
await page.getByLabel('FTP (watts)').fill('232');
await page.waitForSelector('[data-ftp-effective]');
await page.getByLabel('New FTP applies from').fill('2026-10-15');
await page.getByRole('button', { name: 'Save profile' }).click();
await page.getByRole('button', { name: 'Keep my levels' }).click();
await page.waitForTimeout(500);
s = await saved();
ok('FTP change recorded with its effective date', s.ftp === 232 && s.ftpHistory.at(-1).date === '2026-10-15' && s.ftpHistory.at(-1).ftp === 232, JSON.stringify(s.ftpHistory.slice(-2)));
await page.locator('[data-ftp-history]').screenshot({ path: `${OUT}/settings-ftp.png` });

// Legacy user: first-ever change seeds an opening entry.
await page.evaluate((k) => { const d = JSON.parse(localStorage.getItem(k)); delete d.ftpHistory; d.ftp = 240; localStorage.setItem(k, JSON.stringify(d)); }, KEY);
await page.reload();
await page.waitForSelector('[data-ftp-history]');
await page.getByLabel('FTP (watts)').fill('225');
await page.getByLabel('New FTP applies from').fill('2026-10-13');
await page.getByRole('button', { name: 'Save profile' }).click();
await page.getByRole('button', { name: 'Keep my levels' }).click();
await page.waitForTimeout(500);
s = await saved();
ok('first change on a legacy install seeds "from the beginning" at the old FTP', s.ftpHistory?.[0]?.date === '1970-01-01' && s.ftpHistory[0].ftp === 240 && s.ftpHistory[1].ftp === 225, JSON.stringify(s.ftpHistory));

// Backup file round trip includes the history (export reads state, so check the saved copy + page errors).
ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
checks.forEach(c => console.log(c.join('  ')));
await browser.close();
process.exit(checks.some(c => c[0] === 'FAIL') ? 1 : 0);
