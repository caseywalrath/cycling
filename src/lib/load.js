import { parseDateLocal, toLocalDateStr } from './dates.js';

// Training Stress Score from Normalized Power and duration, against the given FTP.
// Moved verbatim from App.jsx (V2 Phase 3); FTP is now a parameter instead of a closure.
export const calculateTSS = (normalizedPower, durationMinutes, ftp) => {
  const intensityFactor = normalizedPower / ftp;
  const tss = (durationMinutes * normalizedPower * intensityFactor) / (ftp * 60) * 100;
  return Math.round(tss);
};

export const calculateIF = (normalizedPower, ftp) => {
  return normalizedPower / ftp;
};

// V2 Phase 5 §5.2: heart-rate-based TSS for rides with no power meter.
//
// Estimated Threshold Heart Rate: the profile's own LTHR if the user entered one, else an
// estimate from Max HR (a common rule of thumb — LTHR is typically ~89% of max HR). Null when
// neither is available.
export const estimateLthr = (profile) => {
  if (!profile) return null;
  if (profile.lthr) return profile.lthr;
  if (profile.maxHR) return Math.round(0.89 * profile.maxHR);
  return null;
};

// TRIMP-style "hrTSS": scaled so a steady ride right at LTHR for an hour scores ~100, matching
// power-based TSS's own definition. Returns null if any input is missing, or if lthr isn't
// above restingHR (the ratio would be undefined or nonsensical).
export const hrTss = (durationMin, avgHr, restingHr, lthr) => {
  if (durationMin == null || avgHr == null || restingHr == null || lthr == null) return null;
  if (lthr <= restingHr) return null;
  const hrIF = (avgHr - restingHr) / (lthr - restingHr);
  return Math.round((durationMin / 60) * hrIF * hrIF * 100);
};

// V2 Phase 5 §5.3: one CTL/ATL/TSB entry per calendar day, from the first ride in `history`
// through `today` (inclusive). Moved out of calculateTrainingLoads() so Phase 6's Fitness
// chart can plot the whole history without re-deriving the math. Uses the same constants as
// before (42-day CTL, 7-day ATL, the standard 2/(n+1) exponential smoothing). Values are left
// unrounded here; callers round for display.
export const dailyLoadSeries = (history, today = new Date()) => {
  if (!history || history.length === 0) return [];

  const sorted = [...history].sort((a, b) => parseDateLocal(a.date) - parseDateLocal(b.date));
  const end = new Date(today);
  end.setHours(0, 0, 0, 0); // midnight local — consistent with parseDateLocal

  const dailyTSS = {};
  sorted.forEach(workout => {
    const date = workout.date;
    if (!dailyTSS[date]) dailyTSS[date] = 0;
    dailyTSS[date] += workout.tss || 0;
  });

  const ctlDecay = 2 / (42 + 1);
  const atlDecay = 2 / (7 + 1);

  let ctl = 0;
  let atl = 0;
  const series = [];
  const currentDate = parseDateLocal(sorted[0].date); // midnight local
  while (currentDate <= end) {
    const dateStr = toLocalDateStr(currentDate);
    const tss = dailyTSS[dateStr] || 0;

    ctl = ctl * (1 - ctlDecay) + tss * ctlDecay;
    atl = atl * (1 - atlDecay) + tss * atlDecay;

    series.push({ date: dateStr, tss, ctl, atl, tsb: ctl - atl });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return series;
};

// CTL today minus CTL 7 days ago, one decimal. Null if there isn't a week of series to
// compare (e.g. brand-new history).
export const rampRate = (series) => {
  if (!series || series.length < 8) return null;
  const today = series[series.length - 1];
  const weekAgo = series[series.length - 8];
  if (!today || !weekAgo) return null;
  return Math.round((today.ctl - weekAgo.ctl) * 10) / 10;
};

// CTL (42-day), ATL (7-day) and TSB, plus 7/14-day TSS and the loads 14 days ago.
// Moved verbatim from App.jsx (V2 Phase 3). `today` defaults to now, as before.
// V2 Phase 3 adds atl14dAgo and tsb14dAgo (used for the Today tab's 14-day deltas);
// every field that existed before is calculated exactly as it was.
// V2 Phase 5: rebuilt on top of dailyLoadSeries() — same math, same output.
export const calculateTrainingLoads = (history, now = new Date()) => {
  if (history.length === 0) return { ctl: 0, atl: 0, tsb: 0, weeklyTSS: 0, prevWeeklyTSS: 0, twoWeekTSS: 0, ctl14dAgo: 0, atl14dAgo: 0, tsb14dAgo: 0 };

  const sorted = [...history].sort((a, b) => parseDateLocal(a.date) - parseDateLocal(b.date));
  const today = new Date(now);
  today.setHours(0, 0, 0, 0); // midnight local — consistent with parseDateLocal

  const series = dailyLoadSeries(history, today);
  const last = series[series.length - 1];

  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const fourteenDaysAgoStr = toLocalDateStr(fourteenDaysAgo);
  const at14 = series.find(e => e.date === fourteenDaysAgoStr);
  const rawCtl14dAgo = at14 ? at14.ctl : 0;
  const rawAtl14dAgo = at14 ? at14.atl : 0;

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const weeklyTSS = sorted
    .filter(w => parseDateLocal(w.date) >= weekAgo)
    .reduce((sum, w) => sum + (w.tss || 0), 0);

  const twoWeekTSS = sorted
    .filter(w => parseDateLocal(w.date) >= twoWeeksAgo)
    .reduce((sum, w) => sum + (w.tss || 0), 0);

  return {
    ctl: Math.round(last.ctl),
    atl: Math.round(last.atl),
    tsb: Math.round(last.ctl - last.atl),
    weeklyTSS,
    twoWeekTSS,
    ctl14dAgo: Math.round(rawCtl14dAgo),
    atl14dAgo: Math.round(rawAtl14dAgo),
    tsb14dAgo: Math.round(rawCtl14dAgo - rawAtl14dAgo),
  };
};

// Training status from TSB% with a low-fitness override and transition detection.
// Moved verbatim from App.jsx (V2 Phase 3). The old getTSBStatus(), which disagreed with
// this (e.g. "Fresh" next to "Transition"), was deleted; this is the one status now.
export const getTrainingStatus = (ctl, atl, tsb, ctl14dAgo) => {
  // Low fitness override: CTL < 35 makes TSB% erratic
  if (ctl < 35) {
    if (atl > ctl * 1.5) return { label: 'Building (Heavy Load)', color: '#F97316', description: 'Early base building with significant load' };
    if (atl > ctl) return { label: 'Building', color: '#3B82F6', description: 'Building early fitness' };
    return { label: 'Building (Fresh)', color: '#86EFAC', description: 'Building fitness, well-rested' };
  }

  const tsbPct = (tsb / ctl) * 100;

  // Transition detection: high positive TSB% OR CTL declining >10% over 14 days with positive TSB
  const ctlDecline = ctl14dAgo > 0 ? ((ctl14dAgo - ctl) / ctl14dAgo) * 100 : 0;
  if (tsbPct > 25 || (ctlDecline > 10 && tsb > 0)) {
    return { label: 'Transition', color: '#9CA3AF', description: 'Extended rest or detraining' };
  }
  if (tsbPct >= 5) return { label: 'Fresh', color: '#3B82F6', description: 'Well-rested, good for testing or events' };
  if (tsbPct >= -10) return { label: 'Grey Zone', color: '#EAB308', description: 'Maintenance — not strongly building or recovering' };
  if (tsbPct >= -30) return { label: 'Optimal', color: '#22C55E', description: 'Productive overload, fitness improving' };
  return { label: 'High Risk', color: '#EF4444', description: 'Significant overreach — monitor fatigue' };
};
