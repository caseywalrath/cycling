import { calculateTSS } from './load.js';

// FTP history (Session 27): a list of { date: 'YYYY-MM-DD', ftp } entries, each meaning "this
// FTP applied from that date until the next entry". It lets a ride be measured against the FTP
// you had on the day, not the FTP you have today. An empty list means "no history recorded":
// every lookup falls back to the current FTP, exactly as the app behaved before.

// Date of an opening entry that applies "from the beginning". Used when the first FTP change is
// recorded, so rides from before it keep the FTP they were ridden at.
export const FTP_HISTORY_START = '1970-01-01';

const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// Valid entries only (a real date, FTP 100-500 as in Settings), one per date (the last wins),
// oldest first. Safe to call on anything read from storage, a backup or Drive.
export const cleanFtpHistory = (list) => {
  const byDate = new Map();
  (Array.isArray(list) ? list : []).forEach((e) => {
    const ftp = Math.round(Number(e?.ftp));
    if (isDateStr(e?.date) && ftp >= 100 && ftp <= 500) byDate.set(e.date, { date: e.date, ftp });
  });
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
};

// The FTP in effect on `dateStr`: the latest entry on or before it. A date before the first
// entry uses the first entry's FTP. With no entries (or no date) it returns `fallbackFtp`.
// `ftpHistory` must already be clean (state always holds a cleaned list).
export const ftpOnDate = (ftpHistory, dateStr, fallbackFtp) => {
  if (!ftpHistory || ftpHistory.length === 0 || !dateStr) return fallbackFtp;
  let found = null;
  for (const e of ftpHistory) {
    if (e.date <= dateStr) found = e;
    else break;
  }
  return (found || ftpHistory[0]).ftp;
};

// The list after "FTP became `ftp` on `date`". If nothing has been recorded yet, an opening
// entry for `previousFtp` is added first, so earlier rides keep the FTP they had.
export const withFtpChange = (ftpHistory, { date, ftp, previousFtp }) => {
  const base = cleanFtpHistory(ftpHistory);
  const seeded = base.length === 0 && previousFtp
    ? [{ date: FTP_HISTORY_START, ftp: previousFtp }]
    : base;
  return cleanFtpHistory([...seeded, { date, ftp }]);
};

// "230W (start) → 240W from 2026-07-01 → 225W from 2026-10-13", or null for no entries.
export const describeFtpHistory = (ftpHistory) => {
  if (!ftpHistory || ftpHistory.length === 0) return null;
  return ftpHistory
    .map(e => (e.date === FTP_HISTORY_START ? `${e.ftp}W (start)` : `${e.ftp}W from ${e.date}`))
    .join(' → ');
};

// Re-score stored TSS and IF from each ride's power and the FTP on its own date. Only rides on or
// after the first entry are touched (before that, the FTP isn't known), and heart-rate-only
// rides and rides with no power/duration are left alone. Pure: returns
// { history, changed, updates } where updates is { [rideId]: { before, after } } with
// before/after = { tss, intensityFactor }.
export const rescoreRides = (history, ftpHistory, fallbackFtp) => {
  const list = cleanFtpHistory(ftpHistory);
  const updates = {};
  if (list.length === 0) return { history, changed: 0, updates };
  const firstDate = list[0].date;
  const next = history.map((w) => {
    if (!w.date || w.date < firstDate || w.tssSource === 'hr') return w;
    const np = Number(w.normalizedPower);
    const duration = Number(w.duration);
    if (!(np > 0) || !(duration > 0)) return w;
    const ftp = ftpOnDate(list, w.date, fallbackFtp);
    const tss = calculateTSS(np, duration, ftp);
    const intensityFactor = np / ftp;
    const sameIf = Number.isFinite(Number(w.intensityFactor)) && Math.abs(intensityFactor - Number(w.intensityFactor)) <= 0.005;
    if (tss === w.tss && sameIf) return w;
    updates[w.id] = {
      before: { tss: w.tss, intensityFactor: w.intensityFactor ?? null },
      after: { tss, intensityFactor },
    };
    return { ...w, tss, intensityFactor };
  });
  return { history: next, changed: Object.keys(updates).length, updates };
};
