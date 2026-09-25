import { parseDateLocal } from './dates.js';

// Apply decay to progression levels based on days since last worked per zone.
// Grace period: 14 days of inactivity, then -0.1/week (VO2max/Anaerobic decay 1.5x faster).
// Floor: never below max(1.0, level * 0.5).
// Recovery zone excluded. Zones with no lastWorkedDate are not decayed (first-time grace).
export const applyDecay = (levels, lastWorkedDates) => {
  const HIGH_DECAY_ZONES = ['vo2max', 'anaerobic'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const decayed = { ...levels };

  Object.keys(levels).forEach(zone => {
    if (zone === 'recovery') return;
    const lastWorked = lastWorkedDates[zone];
    if (!lastWorked) return; // No recorded date — no decay (infinite grace until first workout)

    const lastDate = parseDateLocal(lastWorked);
    const daysIdle = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

    if (daysIdle <= 14) return; // Grace period

    const weeksOverdue = (daysIdle - 14) / 7;
    const multiplier = HIGH_DECAY_ZONES.includes(zone) ? 1.5 : 1.0;
    const decay = weeksOverdue * 0.1 * multiplier;

    const floor = Math.max(1.0, levels[zone] * 0.5);
    decayed[zone] = Math.max(floor, levels[zone] - decay);
  });

  return decayed;
};

// Progression algorithm (expected vs actual RPE). Moved verbatim from App.jsx in V2 Phase 3.
// Phase 7 replaces it.
export const calculateNewLevel = (currentLevel, workoutLevel, rpe, completed) => {
  if (!completed) {
    if (workoutLevel <= currentLevel) {
      return Math.max(1, currentLevel - 0.5);
    }
    return currentLevel;
  }

  const difficulty = workoutLevel - currentLevel;

  if (difficulty <= -2) {
    return currentLevel;
  } else if (difficulty <= 0) {
    if (rpe <= 5) {
      return Math.min(10, currentLevel + 0.1);
    }
    return currentLevel;
  } else if (difficulty <= 1) {
    if (rpe <= 6) {
      return Math.min(10, currentLevel + 0.5);
    } else if (rpe <= 8) {
      return Math.min(10, currentLevel + 0.3);
    } else {
      return Math.min(10, currentLevel + 0.1);
    }
  } else if (difficulty <= 2) {
    if (rpe <= 7) {
      return Math.min(10, currentLevel + 0.7);
    } else if (rpe <= 9) {
      return Math.min(10, currentLevel + 0.4);
    } else {
      return Math.min(10, currentLevel + 0.2);
    }
  } else {
    if (rpe <= 8) {
      return Math.min(10, currentLevel + 1.0);
    } else {
      return Math.min(10, currentLevel + 0.5);
    }
  }
};
