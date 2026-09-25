import { describe, it, expect } from 'vitest';
import { estimateLthr, hrTss, dailyLoadSeries, calculateTrainingLoads, rampRate } from './load.js';

describe('estimateLthr', () => {
  it('prefers an explicit LTHR', () => {
    expect(estimateLthr({ lthr: 165, maxHR: 182 })).toBe(165);
  });
  it('falls back to 0.89 x max HR', () => {
    expect(estimateLthr({ maxHR: 182 })).toBe(Math.round(0.89 * 182));
  });
  it('is null with neither', () => {
    expect(estimateLthr({})).toBeNull();
    expect(estimateLthr(null)).toBeNull();
  });
});

describe('hrTss', () => {
  it('matches the worked example: hrTss(60, 150, 50, 160) = 83', () => {
    expect(hrTss(60, 150, 50, 160)).toBe(83);
  });
  it('is null when any input is missing', () => {
    expect(hrTss(60, null, 50, 160)).toBeNull();
    expect(hrTss(null, 150, 50, 160)).toBeNull();
  });
  it('is null when lthr is not above resting HR', () => {
    expect(hrTss(60, 150, 160, 160)).toBeNull();
    expect(hrTss(60, 150, 170, 160)).toBeNull();
  });
});

// A small synthetic history spanning ~60 days, some rest days included.
const buildHistory = () => {
  const history = [];
  let id = 1;
  for (let i = 0; i < 60; i++) {
    if (i % 3 === 0) continue; // rest day
    const d = new Date(2026, 6, 1 + i);
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    history.push({ id: id++, date: `${y}-${m}-${day}`, tss: 40 + (i % 5) * 10 });
  }
  return history;
};

describe('dailyLoadSeries vs calculateTrainingLoads', () => {
  it("the series' last entry matches calculateTrainingLoads on the same data", () => {
    const history = buildHistory();
    const today = new Date(2026, 7, 30, 12, 0, 0);
    const series = dailyLoadSeries(history, today);
    const loads = calculateTrainingLoads(history, today);
    const last = series[series.length - 1];
    expect(Math.round(last.ctl)).toBe(loads.ctl);
    expect(Math.round(last.atl)).toBe(loads.atl);
    expect(Math.round(last.ctl - last.atl)).toBe(loads.tsb);
  });

  it('covers every calendar day from the first ride to today', () => {
    const history = buildHistory();
    const today = new Date(2026, 7, 30, 12, 0, 0);
    const series = dailyLoadSeries(history, today);
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    expect(series[0].date).toBe(sorted[0].date);
    expect(series[series.length - 1].date).toBe('2026-08-30');
  });

  it('returns [] for empty history', () => {
    expect(dailyLoadSeries([], new Date())).toEqual([]);
  });
});

describe('rampRate', () => {
  it('is CTL today minus CTL 7 days ago, one decimal', () => {
    const history = buildHistory();
    const today = new Date(2026, 7, 30, 12, 0, 0);
    const series = dailyLoadSeries(history, today);
    const rate = rampRate(series);
    const expected = Math.round((series[series.length - 1].ctl - series[series.length - 8].ctl) * 10) / 10;
    expect(rate).toBe(expected);
  });
  it('is null without at least a week of series', () => {
    expect(rampRate([{ date: '2026-01-01', ctl: 5, atl: 5, tsb: 0, tss: 0 }])).toBeNull();
  });
});
