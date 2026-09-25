import { parseDateLocal, toLocalDateStr } from './dates.js';
import { ZONES } from './zones.js';
import { timeInZones } from './analysis.js';

// Chart data builders for the Progress tab's Hours / TSS / Elevation / eFTP charts.
// Moved verbatim from App.jsx in V2 Phase 3 (only the indentation and `export` changed).

// Calculate weekly hours for chart
export const calculateWeeklyHours = (history) => {
  if (!history || history.length === 0) return [];

  // Get date 20 weeks ago
  const twentyWeeksAgo = new Date();
  twentyWeeksAgo.setHours(0, 0, 0, 0);
  twentyWeeksAgo.setDate(twentyWeeksAgo.getDate() - (20 * 7));

  // Filter to last 20 weeks
  const recentWorkouts = history.filter(w => parseDateLocal(w.date) >= twentyWeeksAgo);

  // Group by week
  const weeklyData = {};
  recentWorkouts.forEach(workout => {
    const date = parseDateLocal(workout.date);
    // Get Monday of that week (week starts on Monday, Strava convention)
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const weekKey = toLocalDateStr(monday);

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = {
        weekStart: weekKey,
        totalMinutes: 0,
        workouts: 0,
      };
    }

    weeklyData[weekKey].totalMinutes += workout.duration || 0;
    weeklyData[weekKey].workouts += 1;
  });

  // Convert to array and sort by date
  const chartData = Object.values(weeklyData)
    .map(week => ({
      weekStart: week.weekStart,
      hours: Math.round((week.totalMinutes / 60) * 10) / 10, // Round to 1 decimal
      totalMinutes: week.totalMinutes,
      workouts: week.workouts,
      // Format label as "Apr 7", "May 12", etc.
      label: parseDateLocal(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }))
    .sort((a, b) => parseDateLocal(a.weekStart) - parseDateLocal(b.weekStart));

  return chartData;
};

export const calculateWeeklyTSS = (history) => {
  if (!history || history.length === 0) return [];

  // Get date 20 weeks ago
  const twentyWeeksAgo = new Date();
  twentyWeeksAgo.setHours(0, 0, 0, 0);
  twentyWeeksAgo.setDate(twentyWeeksAgo.getDate() - (20 * 7));

  // Filter to last 20 weeks
  const recentWorkouts = history.filter(w => parseDateLocal(w.date) >= twentyWeeksAgo);

  // Group by week
  const weeklyData = {};
  recentWorkouts.forEach(workout => {
    const date = parseDateLocal(workout.date);
    // Get Monday of that week (week starts on Monday, Strava convention)
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const weekKey = toLocalDateStr(monday);

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = {
        weekStart: weekKey,
        totalTSS: 0,
        workouts: 0,
      };
    }

    weeklyData[weekKey].totalTSS += workout.tss || 0;
    weeklyData[weekKey].workouts += 1;
  });

  // Convert to array and sort by date
  const chartData = Object.values(weeklyData)
    .map(week => ({
      weekStart: week.weekStart,
      tss: Math.round(week.totalTSS), // Round to integer
      workouts: week.workouts,
      // Format label as "Apr 7", "May 12", etc.
      label: parseDateLocal(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }))
    .sort((a, b) => parseDateLocal(a.weekStart) - parseDateLocal(b.weekStart));

  return chartData;
};

export const calculateMonthlyElevation = (history) => {
  if (!history || history.length === 0) return [];

  // Rolling 11-month window (same as eFTP chart)
  const elevenMonthsAgo = new Date();
  elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);
  elevenMonthsAgo.setDate(1);

  const recentWorkouts = history.filter(w => parseDateLocal(w.date) >= elevenMonthsAgo);

  // Group by calendar month
  const monthMap = {};
  recentWorkouts.forEach(workout => {
    const d = parseDateLocal(workout.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    if (!monthMap[key]) {
      monthMap[key] = { totalElevation: 0, workouts: 0 };
    }
    monthMap[key].totalElevation += workout.elevation || 0;
    if (workout.elevation > 0) monthMap[key].workouts += 1;
  });

  return Object.keys(monthMap).sort().map(key => {
    const entry = monthMap[key];
    const [year, month] = key.split('-').map(Number);
    const d = new Date(year, month - 1);
    return {
      monthKey: key,
      month: d.toLocaleDateString('en-US', { month: 'short' }),
      label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      elevation: Math.round(entry.totalElevation),
      workouts: entry.workouts,
    };
  });
};

// Calculate eFTP history for rolling one-year chart. Combines the app's own calculated
// estimates (FIT era) with legacy intervals.icu-imported values (pre-FIT era) so the chart
// keeps working across the transition — see EFTP_ESTIMATE_PLAN.md §4.
export const calculateEFTPHistory = (history, eftpTimeline) => {
  if (!history || history.length === 0) return [];

  const { byRideId, firstStreamDate } = eftpTimeline || { byRideId: {}, firstStreamDate: null };

  // Rolling 11-month window so each month name appears only once on X-axis
  const elevenMonthsAgo = new Date();
  elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);
  elevenMonthsAgo.setDate(1); // start of that month

  const rides = history
    .filter(w => parseDateLocal(w.date) >= elevenMonthsAgo)
    .sort((a, b) => parseDateLocal(a.date) - parseDateLocal(b.date));

  // Group by calendar month → per month, prefer the highest estimated value; only fall
  // back to legacy imported values (and only for rides before the first FIT stream).
  const monthMap = {};
  rides.forEach(w => {
    const rideInfo = byRideId[w.id];
    const estimated = rideInfo && rideInfo.eftp != null ? rideInfo.eftp : null;
    const isLegacyEligible = w.eFTP && (firstStreamDate == null || w.date < firstStreamDate);

    let value = null;
    let source = null;
    let rideName = null;
    let peakDate = null;
    if (estimated != null) {
      value = estimated;
      source = 'estimated';
      rideName = rideInfo.peakRideName;
      peakDate = rideInfo.peakRideDate;
    } else if (isLegacyEligible) {
      value = w.eFTP;
      source = 'imported';
      rideName = w.name || 'Workout';
      peakDate = w.date;
    } else {
      return;
    }

    const d = parseDateLocal(w.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthMap[key];
    // An estimated value always wins over an imported one for the same month, regardless
    // of watts, and the highest value wins within the same source.
    const shouldReplace = !existing
      || (source === 'estimated' && existing.source !== 'estimated')
      || (source === existing.source && value > existing.eFTP);
    if (shouldReplace) {
      monthMap[key] = { eFTP: value, rideName, peakDate, source };
    }
  });

  // Build sorted array with month labels
  const eftpData = Object.keys(monthMap).sort().map(key => {
    const entry = monthMap[key];
    const [year, month] = key.split('-').map(Number);
    const d = new Date(year, month - 1);
    return {
      monthKey: key,
      month: d.toLocaleDateString('en-US', { month: 'short' }),
      label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      eFTP: entry.eFTP,
      rideName: entry.rideName,
      source: entry.source,
      peakDate: entry.peakDate,
    };
  });

  return eftpData;
};

// V2 Phase 6 §6.1.3 — weekly time-in-zones for the Progress tab's "Zones" training-volume
// chart: minutes per zone, summed per Monday-start week, over the last `weeks` weeks.
// Rides with power data only (timeInZones needs a stream + FTP); a ride without one is
// silently skipped, exactly like the note shown under the chart.
export const weeklyTimeInZones = (history, ftp, weeks = 12) => {
  if (!history || history.length === 0 || !ftp) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startMonday = new Date(today);
  startMonday.setDate(startMonday.getDate() - ((startMonday.getDay() + 6) % 7) - (weeks - 1) * 7);

  const buckets = {};
  for (let i = 0; i < weeks; i++) {
    const monday = new Date(startMonday);
    monday.setDate(monday.getDate() + i * 7);
    const key = toLocalDateStr(monday);
    const totals = {};
    ZONES.forEach(z => { totals[z.id] = 0; });
    buckets[key] = { weekStart: key, label: monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), ...totals, rides: 0 };
  }

  history.forEach(w => {
    if (!w.stream || !w.stream.power) return;
    const rideDate = parseDateLocal(w.date);
    if (rideDate < startMonday || rideDate > today) return;
    const monday = new Date(rideDate);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const key = toLocalDateStr(monday);
    const bucket = buckets[key];
    if (!bucket) return;
    const zoneSeconds = timeInZones(w, ftp);
    if (!zoneSeconds) return;
    let any = false;
    Object.entries(zoneSeconds).forEach(([zoneId, seconds]) => {
      if (seconds > 0) {
        bucket[zoneId] += Math.round((seconds / 60) * 10) / 10;
        any = true;
      }
    });
    if (any) bucket.rides += 1;
  });

  return Object.keys(buckets).sort().map(k => buckets[k]);
};
