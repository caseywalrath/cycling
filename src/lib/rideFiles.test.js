import { describe, it, expect } from 'vitest';
import { calculateNormalizedPower, toOneHzSeries, bestsFromOneHz, hrStatsFromSeries, avgPowerFromSeries, downsampleRecords, buildRideFromRecords } from './rideFiles.js';

describe('calculateNormalizedPower', () => {
  it('is exactly the average for a perfectly constant power series', () => {
    const samples = new Array(60).fill(200);
    expect(calculateNormalizedPower(samples)).toBe(200);
  });
  it('returns null with fewer than 30 samples', () => {
    expect(calculateNormalizedPower(new Array(10).fill(200))).toBeNull();
  });
});

// Build a records array of one-per-second samples starting at a fixed time.
const secRecords = (specs) => {
  // specs: [{ t: secondsFromStart, power, hr }]
  const t0 = Date.UTC(2026, 0, 1, 0, 0, 0);
  return specs.map(({ t, power = null, hr = null }) => ({
    timestamp: new Date(t0 + t * 1000),
    power,
    heart_rate: hr,
  }));
};

describe('toOneHzSeries', () => {
  it('forward-fills a 3-second gap', () => {
    // records at t=0 (100W) and t=3 (140W) — the 3s gap in between is forward-filled from t=0.
    const records = secRecords([{ t: 0, power: 100 }, { t: 3, power: 140 }]);
    const { power } = toOneHzSeries(records);
    expect(power).toEqual([100, 100, 100, 140]);
  });

  it('zero-fills a 30-second gap (a stop)', () => {
    const records = secRecords([{ t: 0, power: 100 }, { t: 30, power: 140 }]);
    const { power } = toOneHzSeries(records);
    expect(power[0]).toBe(100);
    // Seconds 1..29 are a stop: zero-filled, not forward-filled.
    for (let i = 1; i < 30; i++) expect(power[i]).toBe(0);
    expect(power[30]).toBe(140);
  });

  it('returns power: null when no record has power (HR-only)', () => {
    const records = secRecords([{ t: 0, hr: 120 }, { t: 1, hr: 122 }, { t: 2, hr: 125 }]);
    const { power, hr } = toOneHzSeries(records);
    expect(power).toBeNull();
    expect(hr).toEqual([120, 122, 125]);
  });

  it('returns null hr where heart rate is unknown, including during a stop', () => {
    const records = secRecords([{ t: 0, power: 100, hr: 130 }, { t: 20, power: 100, hr: 130 }]);
    const { hr } = toOneHzSeries(records);
    expect(hr[0]).toBe(130);
    expect(hr[10]).toBeNull(); // inside the >10s gap — a stop
    expect(hr[20]).toBe(130);
  });
});

describe('bestsFromOneHz — synthetic 3x8 @ 250W', () => {
  // 10 min warmup @130W, then 3x(8min@250W, 4min@120W recovery), then 10min cooldown @125W.
  const buildSeries = () => {
    const power = [];
    const push = (w, minutes) => { for (let i = 0; i < minutes * 60; i++) power.push(w); };
    push(130, 10);
    for (let i = 0; i < 3; i++) { push(250, 8); if (i < 2) push(120, 4); }
    push(125, 10);
    return power;
  };

  it('gives "300": 250 (best 5-minute power)', () => {
    const bests = bestsFromOneHz(buildSeries());
    expect(bests['300']).toBe(250);
  });

  it('a 10-minute window cannot be all at 250W (each work block is only 8 min)', () => {
    const bests = bestsFromOneHz(buildSeries());
    expect(bests['600']).toBeLessThan(250);
  });

  it('omits durations longer than the whole series', () => {
    const bests = bestsFromOneHz(buildSeries());
    expect(bests['7200']).toBeUndefined();
  });
});

describe('hrStatsFromSeries / avgPowerFromSeries', () => {
  it('computes avg/max HR, or null with no data', () => {
    expect(hrStatsFromSeries([100, null, 120, 140])).toEqual({ avg: 120, max: 140 });
    expect(hrStatsFromSeries([null, null])).toBeNull();
    expect(hrStatsFromSeries(null)).toBeNull();
  });
  it('computes avg power including zeros, or null with no power', () => {
    expect(avgPowerFromSeries([100, 0, 200])).toBe(100);
    expect(avgPowerFromSeries(null)).toBeNull();
  });
});

describe('downsampleRecords — HR-only stream', () => {
  it('returns a stream with power: null when there is HR but no power at all', () => {
    const records = secRecords(Array.from({ length: 40 }, (_, i) => ({ t: i, hr: 120 + i })));
    const stream = downsampleRecords(records, 10);
    expect(stream).not.toBeNull();
    expect(stream.power).toBeNull();
    expect(stream.hr.length).toBeGreaterThan(0);
    expect(stream.hr.every(v => v != null)).toBe(true);
  });
  it('returns null when there is neither power nor HR', () => {
    const records = secRecords(Array.from({ length: 10 }, (_, i) => ({ t: i })));
    expect(downsampleRecords(records, 10)).toBeNull();
  });
});

describe('buildRideFromRecords — HR-only ride', () => {
  it('saves hrStats, no bests, and stream.power === null', () => {
    const records = secRecords(Array.from({ length: 3600 }, (_, i) => ({ t: i, hr: 130 + (i % 10) })));
    const ride = buildRideFromRecords({
      records, startTime: records[0].timestamp, timerSeconds: 3600,
      distanceMeters: 20000, ascentMeters: 100, normalizedPower: null, avgPower: null, laps: [],
    });
    expect(ride.stream.power).toBeNull();
    expect(ride.hrStats).not.toBeNull();
    expect(ride.avgPower).toBeNull();
    expect(Object.keys(ride.bests)).toHaveLength(0);
  });
});
