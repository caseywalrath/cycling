import { ZONE_ADJACENCY } from './zones.js';
import { parseDateLocal } from './dates.js';

const DECAY_GRACE_DAYS = 14;
const DECAY_RATE_PER_WEEK = 0.1;
const DECAY_MULTIPLIER_EXTENDED = 1.5;

export const applyDecay = (levels, lastWorkedDates) => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const decayed = { ...levels };

  for (const zone in levels) {
    if (zone === 'recovery') continue;
    const lastDate = lastWorkedDates[zone];
    if (!lastDate) continue;

    const daysSince = Math.floor((parseDateLocal(todayStr) - parseDateLocal(lastDate)) / (1000 * 60 * 60 * 24));
    if (daysSince <= DECAY_GRACE_DAYS) continue;

    const decayWeeks = (daysSince - DECAY_GRACE_DAYS) / 7;
    const isExtended = ['vo2max', 'anaerobic'].includes(zone);
    const multiplier = isExtended ? DECAY_MULTIPLIER_EXTENDED : 1;
    const decayAmount = DECAY_RATE_PER_WEEK * multiplier * decayWeeks;
    const newLevel = levels[zone] - decayAmount;
    const floorValue = Math.max(1.0, levels[zone] * 0.5);
    decayed[zone] = Math.max(floorValue, newLevel);
  }

  return decayed;
};
