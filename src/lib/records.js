// Across-rides analysis — V2 Phase 5 §5.5. Pure functions over `history`.
import { parseDateLocal, toLocalDateStr } from './dates.js';
import { bestsForRide } from './analysis.js';
import { BEST_DURATIONS } from './rideFiles.js';

// Per duration, the best power any ride in the (optionally date-bounded) history set,
// together with which ride and date set it. `{ from, to }` are inclusive YYYY-MM-DD strings;
// omit either to leave that side unbounded.
export const powerCurve = (history, { from, to } = {}) => {
  const curve = {};
  if (!history) return curve;
  const fromMs = from ? parseDateLocal(from).getTime() : -Infinity;
  const toMs = to ? parseDateLocal(to).getTime() : Infinity;

  history.forEach(ride => {
    const rideMs = parseDateLocal(ride.date).getTime();
    if (rideMs < fromMs || rideMs > toMs) return;
    const { bests } = bestsForRide(ride);
    Object.entries(bests).forEach(([duration, watts]) => {
      if (!curve[duration] || watts > curve[duration].watts) {
        curve[duration] = { watts, rideId: ride.id, rideName: ride.name || 'Workout', date: ride.date };
      }
    });
  });
  return curve;
};

// All-time and last-90-days power curves.
export const personalBests = (history, today = new Date()) => {
  const todayStr = toLocalDateStr(today);
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  return {
    allTime: powerCurve(history, {}),
    last90Days: powerCurve(history, { from: toLocalDateStr(ninetyDaysAgo), to: todayStr }),
  };
};

// Durations where `ride` set a new all-time or 90-day best, from the history that includes it
// (used for the "New best!" alert — V2_PLAN.md §6.2). Excludes `ride` itself when checking
// what the *previous* best was, so re-saving the same ride doesn't self-congratulate.
export const newBestsForRide = (history, ride) => {
  if (!ride) return [];
  const { bests: rideBests } = bestsForRide(ride);
  if (Object.keys(rideBests).length === 0) return [];

  const others = history.filter(w => w.id !== ride.id);
  const priorBests = personalBests(others, parseDateLocal(ride.date));

  const isNewBest = (duration) => {
    const watts = rideBests[duration];
    if (watts == null) return false;
    const priorAllTime = priorBests.allTime[duration]?.watts ?? 0;
    const prior90 = priorBests.last90Days[duration]?.watts ?? 0;
    return watts > priorAllTime || watts > prior90;
  };

  return BEST_DURATIONS.map(String).filter(isNewBest);
};

// Longest ride/most climbing/highest TSS, and year-to-date totals vs the same date last year.
export const records = (history, today = new Date()) => {
  if (!history || history.length === 0) {
    return {
      longestByDuration: null, longestByDistance: null, mostElevation: null, highestTss: null,
      ytd: { distance: 0, hours: 0, elevation: 0, rides: 0 },
      lastYtd: { distance: 0, hours: 0, elevation: 0, rides: 0 },
    };
  }

  const byMax = (key) => history.reduce((best, w) =>
    (w[key] || 0) > (best?.[key] || 0) ? w : best, null);

  const longestByDuration = byMax('duration');
  const longestByDistance = byMax('distance');
  const mostElevation = byMax('elevation');
  const highestTss = byMax('tss');

  const year = today.getFullYear();
  const startOfYear = `${year}-01-01`;
  const todayStr = toLocalDateStr(today);
  const lastYear = year - 1;
  const startOfLastYear = `${lastYear}-01-01`;
  // Same day-of-year cutoff last year, so a partial-year comparison is fair.
  const lastYearToDate = new Date(lastYear, today.getMonth(), today.getDate());
  const lastYearToDateStr = toLocalDateStr(lastYearToDate);

  const totals = (rides) => rides.reduce((acc, w) => ({
    distance: acc.distance + (w.distance || 0),
    hours: acc.hours + (w.duration || 0) / 60,
    elevation: acc.elevation + (w.elevation || 0),
    rides: acc.rides + 1,
  }), { distance: 0, hours: 0, elevation: 0, rides: 0 });

  const ytd = totals(history.filter(w => w.date >= startOfYear && w.date <= todayStr));
  const lastYtd = totals(history.filter(w => w.date >= startOfLastYear && w.date <= lastYearToDateStr));

  return { longestByDuration, longestByDistance, mostElevation, highestTss, ytd, lastYtd };
};

// Highest observed max heart rate across history: prefers the saved hrStats.max (1s
// resolution), falling back to the downsampled stream's max for older rides.
export const observedMaxHr = (history) => {
  if (!history || history.length === 0) return null;
  let max = null;
  history.forEach(ride => {
    let rideMax = ride.hrStats?.max ?? null;
    if (rideMax == null && ride.stream?.hr) {
      const vals = ride.stream.hr.filter(v => v != null);
      if (vals.length) rideMax = Math.max(...vals);
    }
    if (rideMax != null && (max == null || rideMax > max)) max = rideMax;
  });
  return max;
};
