import { describe, it, expect } from 'vitest';
import { detectIntervals } from './intervals.js';

// A synthetic 3x8min @ 250W stream (10s bins) at FTP 231W (250W ≈ 108% FTP, VO2max zone),
// bracketed by warmup/recovery/cooldown at ~130W (~56% FTP).
const buildStream = () => {
  const power = [];
  const push = (w, minutes) => { for (let i = 0; i < (minutes * 60) / 10; i++) power.push(w); };
  push(130, 10);
  for (let i = 0; i < 3; i++) { push(250, 8); if (i < 2) push(120, 4); }
  push(125, 10);
  return { power, hr: power.map(() => null), binSeconds: 10 };
};

describe('detectIntervals — synthetic 3x8', () => {
  it('detects 3 reps at ~250W and labels it "3x8 @ 250W"', () => {
    const result = detectIntervals(buildStream(), 231);
    expect(result).not.toBeNull();
    expect(result.sets).toHaveLength(1);
    expect(result.sets[0].reps).toBe(3);
    expect(result.sets[0].avgWatts).toBe(250);
    expect(result.label).toBe('3x8 @ 250W');
  });

  it('returns null for a steady ride with no structure', () => {
    const power = new Array(600).fill(150); // 100 minutes steady endurance
    const result = detectIntervals({ power, hr: power.map(() => null), binSeconds: 10 }, 231);
    expect(result).toBeNull();
  });

  it('returns null when there is no power stream (HR-only)', () => {
    expect(detectIntervals({ power: null, hr: [120, 130], binSeconds: 10 }, 231)).toBeNull();
  });
});
