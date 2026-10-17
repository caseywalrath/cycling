import { describe, it, expect } from 'vitest';
import { smoothingSeconds, describeSmoothing, smoothSeries, rideChartPoints } from './rideChart.js';

describe('smoothingSeconds', () => {
  it('uses a fixed window for 30s / 1 min / 5 min and none for raw', () => {
    const ride = { rideSeconds: 3600, indoor: false };
    expect(smoothingSeconds('raw', ride)).toBe(0);
    expect(smoothingSeconds('30', ride)).toBe(30);
    expect(smoothingSeconds('60', ride)).toBe(60);
    expect(smoothingSeconds('300', ride)).toBe(300);
  });

  it('keeps indoor rides up to 90 minutes raw, and lightly smooths longer ones', () => {
    expect(smoothingSeconds('auto', { rideSeconds: 60 * 60, indoor: true })).toBe(0);
    expect(smoothingSeconds('auto', { rideSeconds: 90 * 60, indoor: true })).toBe(0);
    expect(smoothingSeconds('auto', { rideSeconds: 120 * 60, indoor: true })).toBe(30);
  });

  it('grows the window with an outdoor ride, to about 100 points across the chart', () => {
    const outdoor = (min) => smoothingSeconds('auto', { rideSeconds: min * 60, indoor: false });
    expect(outdoor(20)).toBe(30);
    expect(outdoor(60)).toBe(60);
    expect(outdoor(92)).toBe(60);
    expect(outdoor(180)).toBe(120);
    expect(outdoor(300)).toBe(180);
    expect(outdoor(900)).toBe(300);
  });
});

describe('describeSmoothing', () => {
  it('names the window, and nothing for raw', () => {
    expect(describeSmoothing(30)).toBe('30-s average');
    expect(describeSmoothing(60)).toBe('1-min average');
    expect(describeSmoothing(300)).toBe('5-min average');
    expect(describeSmoothing(0)).toBeNull();
  });
});

describe('smoothSeries', () => {
  it('returns the series untouched for a window of one bin', () => {
    const values = [100, 300, 100];
    expect(smoothSeries(values, 1)).toBe(values);
  });

  it('averages around each bin and narrows the window at the ends', () => {
    expect(smoothSeries([100, 400, 100, 400, 100], 3)).toEqual([250, 200, 300, 200, 250]);
  });

  it('keeps a gap a gap and skips gaps when averaging their neighbours', () => {
    expect(smoothSeries([100, null, 300], 3)).toEqual([100, null, 300]);
    expect(smoothSeries([100, 200, null, 400], 3)).toEqual([150, 150, null, 400]);
  });

  it('preserves the average of a steady effort and flattens a spike', () => {
    const spike = [200, 200, 200, 800, 200, 200, 200];
    const smooth = smoothSeries(spike, 3);
    expect(smooth[0]).toBe(200);
    expect(smooth[3]).toBe(400);
    expect(Math.max(...smooth)).toBeLessThan(800);
  });
});

describe('rideChartPoints', () => {
  const stream = { binSeconds: 10, power: [100, 400, 100, 400], hr: [120, 130, 140, null] };

  it('lists minutes, power and heart rate per bin', () => {
    expect(rideChartPoints(stream, 0)).toEqual([
      { min: 0, power: 100, hr: 120 },
      { min: 0.2, power: 400, hr: 130 },
      { min: 0.3, power: 100, hr: 140 },
      { min: 0.5, power: 400, hr: null },
    ]);
  });

  it('smooths power and heart rate with the same window', () => {
    const points = rideChartPoints(stream, 30);
    expect(points.map(p => p.power)).toEqual([250, 200, 300, 250]);
    expect(points.map(p => p.hr)).toEqual([125, 130, 135, null]);
  });

  it('handles a heart-rate-only ride and no stream', () => {
    const hrOnly = rideChartPoints({ binSeconds: 10, power: null, hr: [120, 140] }, 0);
    expect(hrOnly.map(p => p.power)).toEqual([null, null]);
    expect(rideChartPoints(null, 30)).toEqual([]);
  });
});
