import { describe, it, expect } from 'vitest';
import { zoneForRatio, zoneWattRange, zoneRangeLabel, categoryForRatio, ZONE_BOUNDS } from './zones.js';

describe('zoneForRatio', () => {
  it('finds the zone whose [min, max) contains the ratio', () => {
    expect(zoneForRatio(0.3)).toBe('recovery');
    expect(zoneForRatio(0.6)).toBe('endurance');
    expect(zoneForRatio(0.8)).toBe('tempo');
    expect(zoneForRatio(0.9)).toBe('sweetspot');
    expect(zoneForRatio(0.98)).toBe('threshold');
    expect(zoneForRatio(1.1)).toBe('vo2max');
    expect(zoneForRatio(1.5)).toBe('anaerobic');
  });
  it('is boundary-correct ([min, max))', () => {
    expect(zoneForRatio(ZONE_BOUNDS.endurance[0])).toBe('endurance');
    expect(zoneForRatio(ZONE_BOUNDS.endurance[1] - 0.0001)).toBe('endurance');
    expect(zoneForRatio(ZONE_BOUNDS.endurance[1])).toBe('tempo');
  });
  it('uses the Coggan/TrainerDay edges, with Sweet Spot carved out as 88-94%', () => {
    expect(zoneForRatio(0.75)).toBe('endurance'); // Coggan Z2 runs to 75%
    expect(zoneForRatio(0.76)).toBe('tempo');
    expect(zoneForRatio(0.87)).toBe('tempo');
    expect(zoneForRatio(0.88)).toBe('sweetspot'); // 88% is where the plan's sweet spot starts
    expect(zoneForRatio(0.94)).toBe('sweetspot');
    expect(zoneForRatio(0.95)).toBe('threshold');
    expect(zoneForRatio(1.05)).toBe('threshold'); // Coggan Z4 runs to 105%
    expect(zoneForRatio(1.06)).toBe('vo2max');
    expect(zoneForRatio(1.2)).toBe('vo2max'); // Coggan Z5 runs to 120%
    expect(zoneForRatio(1.21)).toBe('anaerobic');
  });
  it('leaves no gaps: each zone starts exactly where the one before it ends', () => {
    const ids = ['recovery', 'endurance', 'tempo', 'sweetspot', 'threshold', 'vo2max', 'anaerobic'];
    for (let i = 1; i < ids.length; i++) expect(ZONE_BOUNDS[ids[i]][0]).toBe(ZONE_BOUNDS[ids[i - 1]][1]);
    expect(ZONE_BOUNDS.anaerobic[1]).toBe(Infinity);
  });
  it('treats negative ratios as recovery', () => {
    expect(zoneForRatio(-0.1)).toBe('recovery');
  });
});

describe('categoryForRatio', () => {
  it('never returns recovery — ratios below 0.55 default to endurance', () => {
    expect(categoryForRatio(0.3)).toBe('endurance');
    expect(categoryForRatio(0.5)).toBe('endurance');
  });
  it('matches zoneForRatio at and above 0.55', () => {
    expect(categoryForRatio(0.6)).toBe('endurance');
    expect(categoryForRatio(0.9)).toBe('sweetspot');
  });
});

describe('zoneWattRange / zoneRangeLabel', () => {
  it('computes watt ranges at a given FTP', () => {
    expect(zoneWattRange('endurance', 231)).toEqual({ min: 127, max: 176 });
    expect(zoneWattRange('sweetspot', 225)).toEqual({ min: 198, max: 214 });
    expect(zoneWattRange('anaerobic', 231).max).toBeNull();
  });
  it('formats labels with the right Z-prefix', () => {
    expect(zoneRangeLabel('endurance', 231)).toBe('Z2: 127-176W');
    expect(zoneRangeLabel('sweetspot', 231)).toBe('203-219W');
    expect(zoneRangeLabel('anaerobic', 231)).toBe('Z6: 280W+');
  });
});
