import { describe, it, expect } from 'vitest';
import { weeklyTimeInZones } from './chartData.js';
import { toLocalDateStr } from './dates.js';

// A ride today with 10 minutes at a constant 200W.
const rideToday = () => ({
  id: 1, date: toLocalDateStr(new Date()),
  stream: { binSeconds: 10, power: new Array(60).fill(200), hr: [] },
});
const currentWeek = (rows) => rows[rows.length - 1];

describe('weeklyTimeInZones', () => {
  it('zones a ride against a fixed FTP', () => {
    expect(currentWeek(weeklyTimeInZones([rideToday()], 400, 4)).recovery).toBe(10); // 200W = 50% of 400
    expect(currentWeek(weeklyTimeInZones([rideToday()], 100, 4)).anaerobic).toBe(10); // 200W = 200% of 100
  });

  it("accepts a function and asks it for each ride's own date", () => {
    const asked = [];
    const rows = weeklyTimeInZones([rideToday()], (date) => { asked.push(date); return 400; }, 4);
    expect(asked).toEqual([rideToday().date]);
    expect(currentWeek(rows).recovery).toBe(10);
  });

  it('returns nothing without rides or an FTP', () => {
    expect(weeklyTimeInZones([], 225, 4)).toEqual([]);
    expect(weeklyTimeInZones([rideToday()], 0, 4)).toEqual([]);
  });
});
