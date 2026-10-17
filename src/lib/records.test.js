import { describe, it, expect } from 'vitest';
import { powerCurve, personalBests, newBestsForRide, bestEffortComparison, records, observedMaxHr } from './records.js';

const ride = (id, date, bests) => ({ id, date, name: `Ride ${id}`, bests });

describe('powerCurve', () => {
  it('takes the max per duration across rides', () => {
    const history = [ride(1, '2026-01-01', { '300': 200 }), ride(2, '2026-01-02', { '300': 250 })];
    const curve = powerCurve(history, {});
    expect(curve['300'].watts).toBe(250);
    expect(curve['300'].rideId).toBe(2);
  });
  it('respects the from/to date bounds', () => {
    const history = [ride(1, '2026-01-01', { '300': 200 }), ride(2, '2026-06-01', { '300': 250 })];
    const curve = powerCurve(history, { from: '2026-05-01', to: '2026-12-31' });
    expect(curve['300'].watts).toBe(250);
  });
});

describe('newBestsForRide', () => {
  it('flags a duration the ride newly leads', () => {
    const history = [ride(1, '2026-01-01', { '300': 200 }), ride(2, '2026-02-01', { '300': 260 })];
    const newest = history[1];
    expect(newBestsForRide(history, newest)).toContain('300');
  });
  it('does not flag a duration that does not beat the prior best', () => {
    const history = [ride(1, '2026-01-01', { '300': 300 }), ride(2, '2026-02-01', { '300': 260 })];
    expect(newBestsForRide(history, history[1])).not.toContain('300');
  });
});

describe('bestEffortComparison', () => {
  const prior = ride(1, '2026-09-01', { '300': 300, '1200': 250 });

  it('compares with the prior 90-day best and leaves the ride itself out', () => {
    const now = ride(2, '2026-09-20', { '300': 285, '1200': 200 });
    const result = bestEffortComparison([prior, now], now);
    expect(result['300']).toMatchObject({ watts: 285, ref: 300, refDate: '2026-09-01', status: 'near' });
    expect(result['300'].ratio).toBeCloseTo(0.95, 6);
    expect(result['1200'].status).toBe('below');
    expect(result['1200'].ratio).toBeCloseTo(0.8, 6);
  });

  it('calls a beaten best "new", in step with newBestsForRide', () => {
    const now = ride(2, '2026-09-20', { '300': 310, '1200': 200 });
    const result = bestEffortComparison([prior, now], now);
    expect(result['300'].status).toBe('new');
    expect(result['300'].ratio).toBeGreaterThan(1);
    expect(newBestsForRide([prior, now], now)).toEqual(['300']);
  });

  it('only looks back 90 days from the ride, and has no ref when nothing came before', () => {
    const old = ride(1, '2026-01-01', { '300': 400 });
    const now = ride(2, '2026-09-20', { '300': 250 });
    expect(bestEffortComparison([old, now], now)['300']).toMatchObject({ ref: null, ratio: null });
    const first = ride(3, '2026-09-20', { '300': 250 });
    expect(bestEffortComparison([first], first)['300'].status).toBe('new');
  });

  it('returns nothing for a ride without bests', () => {
    expect(bestEffortComparison([prior], { id: 9, date: '2026-09-20' })).toEqual({});
    expect(bestEffortComparison([prior], null)).toEqual({});
  });
});

describe('records', () => {
  it('finds the longest ride and highest TSS', () => {
    const history = [
      { id: 1, date: '2026-01-01', duration: 60, distance: 10, elevation: 100, tss: 50 },
      { id: 2, date: '2026-01-02', duration: 180, distance: 40, elevation: 2000, tss: 120 },
    ];
    const r = records(history, new Date(2026, 0, 3));
    expect(r.longestByDuration.id).toBe(2);
    expect(r.highestTss.id).toBe(2);
    expect(r.mostElevation.id).toBe(2);
  });
});

describe('observedMaxHr', () => {
  it('prefers hrStats.max, falls back to stream', () => {
    const history = [
      { hrStats: { max: 170 } },
      { stream: { hr: [150, 180, null] } },
    ];
    expect(observedMaxHr(history)).toBe(180);
  });
  it('is null with no HR data at all', () => {
    expect(observedMaxHr([{ tss: 1 }])).toBeNull();
  });
});

describe('personalBests', () => {
  it('separates all-time from the last 90 days', () => {
    const today = new Date(2026, 8, 25);
    const history = [ride(1, '2026-01-01', { '60': 400 }), ride(2, '2026-09-20', { '60': 300 })];
    const { allTime, last90Days } = personalBests(history, today);
    expect(allTime['60'].watts).toBe(400);
    expect(last90Days['60'].watts).toBe(300);
  });
});
