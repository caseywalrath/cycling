import { describe, it, expect } from 'vitest';
import { zoneForRatio, zoneWattRange, zoneRangeLabel, categoryForRatio, ZONE_BOUNDS } from './zones.js';

describe('zoneForRatio', () => {
  it('finds the zone whose [min, max) contains the ratio', () => {
    expect(zoneForRatio(0.3)).toBe('recovery');
    expect(zoneForRatio(0.6)).toBe('endurance');
    expect(zoneForRatio(0.75)).toBe('tempo');
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
    expect(zoneWattRange('endurance', 231)).toEqual({ min: 127, max: 162 });
    expect(zoneWattRange('anaerobic', 231).max).toBeNull();
  });
  it('formats labels with the right Z-prefix', () => {
    expect(zoneRangeLabel('endurance', 231)).toBe('Z2: 127-162W');
    expect(zoneRangeLabel('sweetspot', 231)).toBe('187-217W');
    expect(zoneRangeLabel('anaerobic', 231)).toBe('Z6: 277W+');
  });
});
