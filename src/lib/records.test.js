import { describe, it, expect } from 'vitest';
import { powerCurve, personalBests, newBestsForRide, records, observedMaxHr } from './records.js';

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
