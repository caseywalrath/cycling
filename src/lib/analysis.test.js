import { describe, it, expect } from 'vitest';
import { bestsForRide, timeInZones, aerobicDecoupling, efficiencyFactor, expectedRpe, rpeMismatch } from './analysis.js';

describe('bestsForRide', () => {
  it('prefers ride.bests (1s) when present', () => {
    const ride = { bests: { '300': 250 } };
    expect(bestsForRide(ride)).toEqual({ bests: { '300': 250 }, source: '1s' });
  });
  it('falls back to the 10s stream for durations >= 60s', () => {
    const power = new Array(360).fill(200); // 3600s @10s bins
    const ride = { stream: { power, hr: [], binSeconds: 10 } };
    const { bests, source } = bestsForRide(ride);
    expect(source).toBe('10s');
    expect(bests['300']).toBe(200);
    expect(bests['5']).toBeUndefined(); // too short to trust at 10s resolution
  });
});

describe('timeInZones', () => {
  it('bins seconds per zone, skipping null bins', () => {
    // FTP 200: 100W (50%) = recovery, 150W (75%) = tempo, null = skipped
    const stream = { power: [100, 150, null], hr: [], binSeconds: 10 };
    const totals = timeInZones({ stream }, 200);
    expect(totals.recovery).toBe(10);
    expect(totals.tempo).toBe(10);
    const totalSeconds = Object.values(totals).reduce((a, b) => a + b, 0);
    expect(totalSeconds).toBe(20);
  });
});

// A perfectly steady 70-minute ride: constant power, constant HR.
const steadyRide = () => {
  const bins = (70 * 60) / 10;
  const power = new Array(bins).fill(180);
  const hr = new Array(bins).fill(140);
  return { stream: { power, hr, binSeconds: 10 }, normalizedPower: 180, avgPower: 180, intervalData: null };
};

describe('aerobicDecoupling', () => {
  it('is 0 for a perfectly steady ride', () => {
    expect(aerobicDecoupling(steadyRide())).toBe(0);
  });

  it('is ~9.1% when HR rises 10% in the second half', () => {
    // aerobicDecoupling() drops the first 10 minutes (60 bins @10s) before splitting the
    // remainder in half, so the "second half" it sees starts at 60 + (bins-60)/2.
    const ride = steadyRide();
    const bins = ride.stream.power.length;
    const secondHalfStart = 60 + Math.floor((bins - 60) / 2);
    for (let i = secondHalfStart; i < bins; i++) ride.stream.hr[i] = Math.round(140 * 1.1);
    expect(aerobicDecoupling(ride)).toBeCloseTo(9.1, 1);
  });

  it('is null for a ride with detected intervals (not steady)', () => {
    const ride = steadyRide();
    ride.intervalData = { label: '3x8 @ 250W' };
    expect(aerobicDecoupling(ride)).toBeNull();
  });

  it('is null for a ride shorter than 60 minutes', () => {
    const ride = steadyRide();
    ride.stream.power = ride.stream.power.slice(0, 200);
    ride.stream.hr = ride.stream.hr.slice(0, 200);
    expect(aerobicDecoupling(ride)).toBeNull();
  });
});

describe('efficiencyFactor', () => {
  it('is NP / avg HR for a qualifying easy, long ride', () => {
    const ride = { normalizedPower: 150, intensityFactor: 0.65, duration: 60, hrStats: { avg: 125 } };
    expect(efficiencyFactor(ride)).toBe(Math.round((150 / 125) * 100) / 100);
  });
  it('is null for a hard ride (IF > 0.80)', () => {
    const ride = { normalizedPower: 220, intensityFactor: 0.95, duration: 60, hrStats: { avg: 160 } };
    expect(efficiencyFactor(ride)).toBeNull();
  });
  it('is null for a short ride', () => {
    const ride = { normalizedPower: 150, intensityFactor: 0.65, duration: 20, hrStats: { avg: 125 } };
    expect(efficiencyFactor(ride)).toBeNull();
  });
});

describe('expectedRpe / rpeMismatch', () => {
  it('maps IF bands to an expected RPE', () => {
    expect(expectedRpe(0.5)).toBe(3);
    expect(expectedRpe(0.7)).toBe(4);
    expect(expectedRpe(0.8)).toBe(5);
    expect(expectedRpe(0.9)).toBe(7);
    expect(expectedRpe(1.0)).toBe(8);
    expect(expectedRpe(1.1)).toBe(9);
  });
  it('is reported RPE minus expected', () => {
    expect(rpeMismatch({ rpe: 9, intensityFactor: 0.7 })).toBe(9 - 4);
  });
  it('is null without an rpe', () => {
    expect(rpeMismatch({ intensityFactor: 0.7 })).toBeNull();
  });
});
