import { describe, it, expect } from 'vitest';
import { bestAveragePower, estimateRideFtp } from './eftp.js';

const stream = (power, hr, binSeconds = 10) => ({ power, hr, binSeconds });

describe('bestAveragePower', () => {
  it('finds the best window of the given length', () => {
    const power = [100, 100, 100, 300, 300, 100, 100];
    expect(bestAveragePower(stream(power, []), 20)).toBe(300); // 2 bins @10s = 20s window, best is [300,300]
  });
  it('returns null when the stream is too short', () => {
    expect(bestAveragePower(stream([100, 100], []), 60)).toBeNull();
  });
  it('returns null (not 0) when the stream has no power (HR-only)', () => {
    expect(bestAveragePower(stream(null, [120, 130]), 60)).toBeNull();
  });
});

describe('estimateRideFtp', () => {
  it('estimates from best 20-minute power x 0.95', () => {
    const power = new Array(120).fill(300); // 120 bins @10s = 1200s = 20 min
    const ride = { stream: stream(power, []) };
    expect(estimateRideFtp(ride)).toBe(Math.round(300 * 0.95));
  });
  it('returns null, never 0, for an HR-only ride', () => {
    const ride = { stream: stream(null, new Array(200).fill(140)) };
    expect(estimateRideFtp(ride)).toBeNull();
  });
  it('returns null for a ride with no stream at all', () => {
    expect(estimateRideFtp({ stream: null })).toBeNull();
    expect(estimateRideFtp({})).toBeNull();
  });
});
