import { describe, it, expect } from 'vitest';
import {
  FTP_HISTORY_START, cleanFtpHistory, ftpOnDate, withFtpChange, describeFtpHistory, rescoreRides,
} from './ftpHistory.js';

const HISTORY = cleanFtpHistory([
  { date: '2026-10-13', ftp: 225 },
  { date: '2025-12-26', ftp: 230 },
  { date: '2026-07-01', ftp: 240 },
]);

describe('cleanFtpHistory', () => {
  it('sorts oldest first and keeps the last entry for a date', () => {
    expect(HISTORY.map(e => e.ftp)).toEqual([230, 240, 225]);
    expect(cleanFtpHistory([{ date: '2026-01-01', ftp: 200 }, { date: '2026-01-01', ftp: 210 }])).toEqual([{ date: '2026-01-01', ftp: 210 }]);
  });
  it('drops bad dates and out-of-range or non-numeric FTPs, and survives non-lists', () => {
    expect(cleanFtpHistory([{ date: 'yesterday', ftp: 200 }, { date: '2026-01-01', ftp: 50 }, { date: '2026-01-02', ftp: 'x' }, null])).toEqual([]);
    expect(cleanFtpHistory(undefined)).toEqual([]);
    expect(cleanFtpHistory('nope')).toEqual([]);
  });
});

describe('ftpOnDate', () => {
  it('returns the latest entry on or before the date', () => {
    expect(ftpOnDate(HISTORY, '2026-10-08', 225)).toBe(240);
    expect(ftpOnDate(HISTORY, '2026-10-13', 225)).toBe(225);
    expect(ftpOnDate(HISTORY, '2026-07-01', 225)).toBe(240);
    expect(ftpOnDate(HISTORY, '2026-06-30', 225)).toBe(230);
    expect(ftpOnDate(HISTORY, '2027-03-01', 225)).toBe(225);
  });
  it('uses the first entry for a date before it', () => {
    expect(ftpOnDate(HISTORY, '2025-01-01', 999)).toBe(230);
  });
  it('falls back to the current FTP with no history or no date', () => {
    expect(ftpOnDate([], '2026-10-08', 225)).toBe(225);
    expect(ftpOnDate(undefined, '2026-10-08', 225)).toBe(225);
    expect(ftpOnDate(HISTORY, undefined, 225)).toBe(225);
  });
});

describe('withFtpChange', () => {
  it('seeds an opening entry for the previous FTP when nothing is recorded yet', () => {
    const next = withFtpChange([], { date: '2026-10-13', ftp: 225, previousFtp: 240 });
    expect(next).toEqual([{ date: FTP_HISTORY_START, ftp: 240 }, { date: '2026-10-13', ftp: 225 }]);
    expect(ftpOnDate(next, '2026-10-08', 225)).toBe(240);
  });
  it('just adds the entry when history exists, and replaces a same-day entry', () => {
    const next = withFtpChange(HISTORY, { date: '2026-11-01', ftp: 230, previousFtp: 225 });
    expect(next).toHaveLength(4);
    expect(withFtpChange(next, { date: '2026-11-01', ftp: 232, previousFtp: 230 }).at(-1)).toEqual({ date: '2026-11-01', ftp: 232 });
  });
});

describe('describeFtpHistory', () => {
  it('lists entries in order, naming the opening entry "start"', () => {
    expect(describeFtpHistory(HISTORY)).toBe('230W from 2025-12-26 → 240W from 2026-07-01 → 225W from 2026-10-13');
    expect(describeFtpHistory([{ date: FTP_HISTORY_START, ftp: 240 }, { date: '2026-10-13', ftp: 225 }])).toBe('240W (start) → 225W from 2026-10-13');
    expect(describeFtpHistory([])).toBeNull();
  });
});

describe('rescoreRides', () => {
  // Logged at today's FTP (225): NP 176 for 60 min -> IF 0.782, TSS 61.
  const ride = (over) => ({ id: 1, date: '2026-10-08', duration: 60, normalizedPower: 176, intensityFactor: 176 / 225, tss: 61, ...over });

  it('re-scores a ride against the FTP on its own date', () => {
    const { history, changed, updates } = rescoreRides([ride()], HISTORY, 225);
    expect(changed).toBe(1);
    expect(history[0].intensityFactor).toBeCloseTo(176 / 240, 6);
    expect(history[0].tss).toBe(Math.round((60 * 176 * (176 / 240)) / (240 * 60) * 100)); // 54
    expect(updates[1].before.tss).toBe(61);
  });

  it('leaves a ride that is already right, and does not touch inputs', () => {
    const right = ride({ intensityFactor: 176 / 240, tss: 54 });
    const original = JSON.stringify([right]);
    const { history, changed } = rescoreRides([right], HISTORY, 225);
    expect(changed).toBe(0);
    expect(history[0]).toBe(right);
    expect(JSON.stringify([right])).toBe(original);
  });

  it('skips rides before the first entry, heart-rate rides, and rides without power or duration', () => {
    const rides = [
      ride({ id: 1, date: '2025-06-01' }),
      ride({ id: 2, tssSource: 'hr' }),
      ride({ id: 3, normalizedPower: null }),
      ride({ id: 4, duration: 0 }),
    ];
    expect(rescoreRides(rides, HISTORY, 225).changed).toBe(0);
  });

  it('re-scores everything from the beginning when the list opens with a start entry', () => {
    const list = withFtpChange([], { date: '2026-10-13', ftp: 225, previousFtp: 240 });
    const { history } = rescoreRides([ride({ date: '2024-02-01' })], list, 225);
    expect(history[0].intervalData).toBeUndefined();
    expect(history[0].intensityFactor).toBeCloseTo(176 / 240, 6);
  });

  it('does nothing with no history', () => {
    const rides = [ride()];
    const result = rescoreRides(rides, [], 225);
    expect(result.changed).toBe(0);
    expect(result.history).toBe(rides);
  });
});
