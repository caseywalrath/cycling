import { describe, it, expect } from 'vitest';
import {
  workoutLevelFromStructure, calculateNewLevel, applyDecay, rideFtpAtTime,
} from './progression.js';

const FTP = 250;

// Synthetic indoor interval ride: `sets` as [reps, minutes, fraction of FTP].
const intervalRide = (zone, sets, extra = {}) => ({
  rideType: 'Indoor',
  zone,
  intervalData: {
    category: zone,
    sets: sets.map(([reps, min, pct]) => ({ reps, workSeconds: min * 60, avgWatts: Math.round(FTP * pct), restSeconds: 300 })),
  },
  ...extra,
});
const enduranceRide = (duration, intensityFactor) => ({ rideType: 'Indoor', zone: 'endurance', duration, intensityFactor });
const L = (ride) => workoutLevelFromStructure(ride, FTP);

describe('workoutLevelFromStructure', () => {
  it('hits the sweet spot calibration points (3x12 ≈ 5, 2x20 ≈ 6.5, 3x20 ≈ 7.5 at 89%)', () => {
    expect(L(intervalRide('sweetspot', [[3, 12, 0.89]]))).toBeCloseTo(5, 0);
    expect(L(intervalRide('sweetspot', [[2, 20, 0.89]]))).toBeGreaterThanOrEqual(6.2);
    expect(L(intervalRide('sweetspot', [[2, 20, 0.89]]))).toBeLessThanOrEqual(6.8);
    expect(L(intervalRide('sweetspot', [[3, 20, 0.89]]))).toBeGreaterThanOrEqual(7.2);
    expect(L(intervalRide('sweetspot', [[3, 20, 0.89]]))).toBeLessThanOrEqual(7.8);
  });

  it('is monotonic in work time: more reps or longer reps never lower the level', () => {
    for (const zone of ['tempo', 'sweetspot', 'threshold', 'vo2max', 'anaerobic']) {
      const pct = { tempo: 0.76, sweetspot: 0.89, threshold: 0.98, vo2max: 1.1, anaerobic: 1.3 }[zone];
      let prev = 0;
      for (let reps = 1; reps <= 8; reps++) {
        const l = L(intervalRide(zone, [[reps, 4, pct]]));
        expect(l).toBeGreaterThanOrEqual(prev);
        prev = l;
      }
      prev = 0;
      for (let min = 1; min <= 40; min += 3) {
        const l = L(intervalRide(zone, [[3, min, pct]]));
        expect(l).toBeGreaterThanOrEqual(prev);
        prev = l;
      }
    }
  });

  it('is monotonic in intensity: harder within (and above) the zone never lowers the level', () => {
    let prev = 0;
    for (let pct = 0.79; pct <= 1.05; pct += 0.01) {
      const l = L(intervalRide('sweetspot', [[2, 20, pct]]));
      expect(l).toBeGreaterThanOrEqual(prev);
      prev = l;
    }
  });

  it('adding an extra effort never lowers the level, even an easier one', () => {
    const base = L(intervalRide('sweetspot', [[3, 12, 0.9]]));
    expect(L(intervalRide('sweetspot', [[3, 12, 0.9], [1, 2, 0.8]]))).toBeGreaterThanOrEqual(base);
  });

  it('is logarithmic: doubling the session adds a fixed step, it does not double the level', () => {
    const a = L(intervalRide('threshold', [[2, 10, 0.98]]));
    const b = L(intervalRide('threshold', [[4, 10, 0.98]]));
    const c = L(intervalRide('threshold', [[8, 10, 0.98]]));
    expect(b - a).toBeCloseTo(c - b, 0);
    expect(b).toBeLessThan(2 * a);
  });

  it('is bounded 1–10', () => {
    expect(L(intervalRide('sweetspot', [[1, 2, 0.8]]))).toBe(1);
    expect(L(intervalRide('sweetspot', [[6, 45, 0.94]]))).toBe(10);
    expect(L(enduranceRide(10, 0.5))).toBe(1);
    expect(L(enduranceRide(900, 0.7))).toBe(10);
    for (let i = 0; i < 200; i++) {
      const l = L(intervalRide('vo2max', [[1 + (i % 10), 0.5 + (i % 17), 0.9 + (i % 23) / 40]]));
      if (l != null) {
        expect(l).toBeGreaterThanOrEqual(1);
        expect(l).toBeLessThanOrEqual(10);
      }
    }
  });

  it('levels endurance rides from duration at IF, monotonic in both', () => {
    expect(L(enduranceRide(120, 0.65))).toBe(5);
    expect(L(enduranceRide(180, 0.65))).toBeGreaterThan(L(enduranceRide(120, 0.65)));
    expect(L(enduranceRide(120, 0.68))).toBeGreaterThan(L(enduranceRide(120, 0.62)));
    // Endurance with detected surges still uses the whole ride
    const withSurges = { ...enduranceRide(120, 0.65), intervalData: { category: 'endurance', sets: [{ reps: 1, workSeconds: 120, avgWatts: 200 }] } };
    expect(L(withSurges)).toBe(5);
  });

  it('merges efforts split by a short pause into one rep (segments)', () => {
    const seg = (start, min, w) => ({ startSec: start, endSec: start + min * 60, avgWatts: w });
    const split = {
      rideType: 'Indoor', zone: 'sweetspot',
      intervalData: { category: 'sweetspot', sets: [], segments: [seg(600, 12, 222), seg(600 + 12 * 60 + 30, 8, 222), seg(2400, 20, 222)] },
    };
    const clean = {
      rideType: 'Indoor', zone: 'sweetspot',
      intervalData: { category: 'sweetspot', sets: [], segments: [seg(600, 20, 222), seg(2400, 20, 222)] },
    };
    expect(L(split)).toBe(L(clean));
    expect(L(clean)).toBe(L(intervalRide('sweetspot', [[2, 20, 222 / FTP]])));
  });

  it('returns null when there is nothing to score', () => {
    expect(L({ ...intervalRide('sweetspot', [[3, 12, 0.9]]), rideType: 'Outdoor' })).toBeNull();
    expect(L(intervalRide('recovery', [[1, 30, 0.5]]))).toBeNull();
    expect(L({ rideType: 'Indoor', zone: 'sweetspot', duration: 60, intensityFactor: 0.75 })).toBeNull();
    expect(L(intervalRide('vo2max', [[5, 3, 0.8]]))).toBeNull(); // nothing ridden in VO2max
    expect(workoutLevelFromStructure(intervalRide('sweetspot', [[3, 12, 0.9]]), 0)).toBeNull();
  });
});

describe('calculateNewLevel', () => {
  it('fixes the old ceiling case: Sweet Spot 7.5, 3x20 at 92%, RPE 6 now gains', () => {
    const workout = L(intervalRide('sweetspot', [[3, 20, 0.92]]));
    expect(workout).toBeGreaterThan(7.5);
    expect(calculateNewLevel(7.5, workout, 6, true, 'sweetspot')).toBeGreaterThan(7.5);
  });

  it('moves toward L; lower RPE (at or below expected) moves further', () => {
    const easy = calculateNewLevel(3, 7, 5, true, 'sweetspot');
    const expected = calculateNewLevel(3, 7, 6, true, 'sweetspot');
    const hard = calculateNewLevel(3, 7, 8, true, 'sweetspot');
    const brutal = calculateNewLevel(3, 7, 10, true, 'sweetspot');
    expect(easy).toBe(expected);
    expect(expected).toBeGreaterThan(hard);
    expect(hard).toBeGreaterThan(brutal);
    expect(brutal).toBeGreaterThan(3);
    expect(expected).toBeLessThanOrEqual(7);
  });

  it('a harder workout at the same RPE never gains less', () => {
    for (const P of [1, 2.5, 4, 5.5, 7.5, 9, 9.9]) {
      for (const rpe of [3, 5, 6, 7, 8, 9, 10]) {
        let prev = -Infinity;
        for (let W = 1; W <= 10; W += 0.1) {
          const next = calculateNewLevel(P, W, rpe, true, 'sweetspot');
          expect(next).toBeGreaterThanOrEqual(prev);
          prev = next;
        }
      }
    }
  });

  it('gives only a small maintenance gain (or none) when L ≤ current', () => {
    expect(calculateNewLevel(6, 5.5, 6, true, 'sweetspot')).toBeCloseTo(6.1, 5);
    expect(calculateNewLevel(6, 5.5, 8, true, 'sweetspot')).toBe(6);
    expect(calculateNewLevel(6, 3, 5, true, 'sweetspot')).toBe(6);
  });

  it('not completed keeps the old rule (−0.5 if L ≤ current, else unchanged)', () => {
    expect(calculateNewLevel(5, 4, 8, false, 'sweetspot')).toBe(4.5);
    expect(calculateNewLevel(5, 7, 8, false, 'sweetspot')).toBe(5);
    expect(calculateNewLevel(1.2, 1, 8, false, 'sweetspot')).toBe(1);
  });

  it('is bounded 1–10 with no ceiling below 10', () => {
    expect(calculateNewLevel(9.9, 10, 1, true, 'vo2max')).toBeLessThanOrEqual(10);
    expect(calculateNewLevel(10, 10, 1, true, 'vo2max')).toBe(10);
    let level = 1;
    for (let i = 0; i < 40; i++) level = calculateNewLevel(level, 10, 5, true, 'threshold');
    expect(level).toBeGreaterThan(9.5);
  });
});

describe('applyDecay asOf', () => {
  it('measures idle time against the given date', () => {
    const levels = { sweetspot: 5 };
    const lwd = { sweetspot: '2026-01-01' };
    expect(applyDecay(levels, lwd, '2026-01-10').sweetspot).toBe(5);
    expect(applyDecay(levels, lwd, '2026-01-22').sweetspot).toBeCloseTo(4.9, 5);
  });
});

describe('rideFtpAtTime', () => {
  it('recovers the FTP a ride was scored with from NP / IF', () => {
    expect(rideFtpAtTime({ normalizedPower: 200, intensityFactor: 0.8 })).toBe(250);
    expect(rideFtpAtTime({ normalizedPower: 200 })).toBeNull();
  });
});
