import { describe, it, expect } from 'vitest';
import { parseDuration, toLocalDateStr, parseDateLocal, formatDateWithDay } from './dates.js';

describe('parseDuration', () => {
  it('parses plain minutes', () => {
    expect(parseDuration('45')).toBe(45);
  });
  it('parses "1h15" style', () => {
    expect(parseDuration('1h15')).toBe(75);
  });
  it('parses "1h" with no minutes', () => {
    expect(parseDuration('2h')).toBe(120);
  });
  it('parses "H:MM" style', () => {
    expect(parseDuration('1:30')).toBe(90);
  });
  it('returns 0 for empty/garbage input', () => {
    expect(parseDuration('')).toBe(0);
    expect(parseDuration(undefined)).toBe(0);
  });
});

describe('toLocalDateStr / parseDateLocal', () => {
  it('round-trips a local date without a UTC offset bug', () => {
    const d = new Date(2026, 8, 25); // Sep 25, 2026, local midnight
    const str = toLocalDateStr(d);
    expect(str).toBe('2026-09-25');
    const parsed = parseDateLocal(str);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(8);
    expect(parsed.getDate()).toBe(25);
  });
});

describe('formatDateWithDay', () => {
  it('appends the weekday', () => {
    expect(formatDateWithDay('2026-09-25')).toBe('2026-09-25 - Friday');
  });
});
