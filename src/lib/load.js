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

// CTL (42-day), ATL (7-day) and TSB, plus 7/14-day TSS and the loads 14 days ago.
// Moved verbatim from App.jsx (V2 Phase 3). `today` defaults to now, as before.
// V2 Phase 3 adds atl14dAgo and tsb14dAgo (used for the Today tab's 14-day deltas);
// every field that existed before is calculated exactly as it was.
export const calculateTrainingLoads = (history, now = new Date()) => {
  if (history.length === 0) return { ctl: 0, atl: 0, tsb: 0, weeklyTSS: 0, prevWeeklyTSS: 0, twoWeekTSS: 0, ctl14dAgo: 0, atl14dAgo: 0, tsb14dAgo: 0 };

  const sorted = [...history].sort((a, b) => parseDateLocal(a.date) - parseDateLocal(b.date));
  const today = new Date(now);
  today.setHours(0, 0, 0, 0); // midnight local — consistent with parseDateLocal

  const dailyTSS = {};
  sorted.forEach(workout => {
    const date = workout.date;
    if (!dailyTSS[date]) dailyTSS[date] = 0;
    dailyTSS[date] += workout.tss || 0;
  });

  let ctl = 0;
  let atl = 0;
  let ctl14dAgo = 0;
  let atl14dAgo = 0;
  const ctlDecay = 2 / (42 + 1);
  const atlDecay = 2 / (7 + 1);

  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const fourteenDaysAgoStr = toLocalDateStr(fourteenDaysAgo);

  const currentDate = parseDateLocal(sorted[0].date); // midnight local
  while (currentDate <= today) {
    const dateStr = toLocalDateStr(currentDate);
    const dayTSS = dailyTSS[dateStr] || 0;

    ctl = ctl * (1 - ctlDecay) + dayTSS * ctlDecay;
    atl = atl * (1 - atlDecay) + dayTSS * atlDecay;

    if (dateStr === fourteenDaysAgoStr) {
      ctl14dAgo = ctl;
      atl14dAgo = atl;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

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
    ctl: Math.round(ctl),
    atl: Math.round(atl),
    tsb: Math.round(ctl - atl),
    weeklyTSS,
    twoWeekTSS,
    ctl14dAgo: Math.round(ctl14dAgo),
    atl14dAgo: Math.round(atl14dAgo),
    tsb14dAgo: Math.round(ctl14dAgo - atl14dAgo),
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
