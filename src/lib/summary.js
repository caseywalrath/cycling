import { parseDateLocal, toLocalDateStr, formatDateWithDay } from './dates.js';
import { ZONES, getZoneName } from './zones.js';
import { calculateWeeklyHours } from './chartData.js';
import { timeInZones, aerobicDecoupling } from './analysis.js';

// Whole days from today to the event date (negative once it has passed), or null when no
// event date is set. Moved from App.jsx (getDaysUntilEvent) in V2 Phase 3.
export const getDaysUntilEvent = (event, now = new Date()) => {
  if (!event || !event.date) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const eventDate = parseDateLocal(event.date);
  const diffTime = eventDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Monday of the week containing `date` (local midnight).
export const mondayOf = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

// This week (Monday → today) against last week at the same point (last Monday → the same
// weekday last week). Used by the Today tab's "This week" card.
// Returns { thisWeek: {hours, tss, rides}, lastWeek: {…}, days: [{ dateStr, rides, isFuture, isToday }] }.
export const weekComparison = (history, now = new Date()) => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const monday = mondayOf(today);
  const lastMonday = new Date(monday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const sameDayLastWeek = new Date(today);
  sameDayLastWeek.setDate(sameDayLastWeek.getDate() - 7);

  const totals = (from, to) => {
    const fromStr = toLocalDateStr(from);
    const toStr = toLocalDateStr(to);
    const rides = history.filter(w => w.date && w.date >= fromStr && w.date <= toStr);
    const minutes = rides.reduce((s, w) => s + (w.duration || 0), 0);
    return {
      hours: Math.round((minutes / 60) * 10) / 10,
      tss: rides.reduce((s, w) => s + (w.tss || 0), 0),
      rides: rides.length,
    };
  };

  const todayStr = toLocalDateStr(today);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const dateStr = toLocalDateStr(d);
    days.push({
      dateStr,
      rides: history.filter(w => w.date === dateStr),
      isFuture: dateStr > todayStr,
      isToday: dateStr === todayStr,
    });
  }

  return {
    thisWeek: totals(monday, today),
    lastWeek: totals(lastMonday, sameDayLastWeek),
    days,
  };
};

// The ride with the latest date (ties: the one logged most recently, i.e. earliest in the
// history array, which is newest-first), or null.
export const latestRide = (history) => {
  let best = null;
  for (const w of history) {
    if (!w.date) continue;
    if (!best || w.date > best.date) best = w;
  }
  return best;
};

// "Copy for Claude" text. Moved verbatim from App.jsx's copyForAnalysis() in V2 Phase 3;
// the text format is unchanged, apart from the V2 Phase 6 §6.3 additions appended at the
// end (ramp rate, 90-day bests, 30-day HR drift, 4-week time-in-zone share) — every existing
// section and its order stays the same. The new inputs are optional so this still works if a
// caller doesn't pass them.
export const buildAnalysisText = ({ history, currentFTP, currentEftp, event, loads, rampRate, bestCurves, now = new Date() }) => {
  const recentWorkouts = history.slice(0, 7);
  const daysToEvent = getDaysUntilEvent(event, now);

  // 28-day TSS
  const fourWeeksAgo = new Date(now);
  fourWeeksAgo.setHours(0, 0, 0, 0);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const twentyEightDayTSS = history
    .filter(w => parseDateLocal(w.date) >= fourWeeksAgo)
    .reduce((sum, w) => sum + (w.tss || 0), 0);

  // Weekly training hours (last 4 weeks)
  const weeklyHoursData = calculateWeeklyHours(history);
  const last4Weeks = weeklyHoursData.slice(-4);

  // Interval progressions: last 3 sessions per category, oldest -> newest
  const shortDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const intervalCategories = ZONES.filter(z => z.id !== 'recovery');
  const intervalLines = intervalCategories
    .map(z => {
      const sessions = history
        .filter(w => w.intervalData?.category === z.id)
        .slice()
        .sort((a, b) => parseDateLocal(a.date) - parseDateLocal(b.date))
        .slice(-3);
      if (sessions.length === 0) return null;
      return `- ${z.name}: ${sessions.map(w => `${w.intervalData.label} (${shortDate(w.date)})`).join(' → ')}`;
    })
    .filter(Boolean);
  const intervalProgressionsSection = intervalLines.length > 0
    ? `\n\n## Interval Progressions\n${intervalLines.join('\n')}`
    : '';

  // V2 Phase 6 §6.3 additions, appended after every existing section.
  const metricsLines = [];
  if (rampRate != null) {
    metricsLines.push(`- Ramp rate: ${rampRate >= 0 ? '+' : ''}${rampRate} fitness/week`);
  }
  if (bestCurves) {
    const bestLine = (sec, label) => {
      const b = bestCurves.last90Days[sec];
      return b ? `- ${label}: ${b.watts}W (${b.rideName}, ${b.date})` : null;
    };
    const lines = [bestLine('60', '1-min'), bestLine('300', '5-min'), bestLine('1200', '20-min')].filter(Boolean);
    if (lines.length > 0) metricsLines.push('- 90-day bests:', ...lines.map(l => `  ${l.replace(/^- /, '')}`));
  }
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const nowStr = toLocalDateStr(new Date(now));
  const driftVals = history
    .filter(w => w.date >= toLocalDateStr(thirtyDaysAgo) && w.date <= nowStr)
    .map(w => aerobicDecoupling(w))
    .filter(v => v != null);
  if (driftVals.length > 0) {
    const avgDrift = Math.round((driftVals.reduce((a, b) => a + b, 0) / driftVals.length) * 10) / 10;
    metricsLines.push(`- Heart-rate drift (last 30 days, avg): ${avgDrift}%`);
  }
  const fourWeeksAgoForZones = new Date(now);
  fourWeeksAgoForZones.setHours(0, 0, 0, 0);
  fourWeeksAgoForZones.setDate(fourWeeksAgoForZones.getDate() - 28);
  const zoneTotals = {};
  ZONES.forEach(z => { zoneTotals[z.id] = 0; });
  history
    .filter(w => parseDateLocal(w.date) >= fourWeeksAgoForZones)
    .forEach(w => {
      const zones = timeInZones(w, currentFTP);
      if (!zones) return;
      Object.entries(zones).forEach(([z, secs]) => { zoneTotals[z] += secs; });
    });
  const totalZoneSeconds = Object.values(zoneTotals).reduce((a, b) => a + b, 0);
  if (totalZoneSeconds > 0) {
    const shareLines = ZONES.filter(z => zoneTotals[z.id] > 0).map(z =>
      `  - ${z.name}: ${Math.round((zoneTotals[z.id] / totalZoneSeconds) * 100)}%`);
    metricsLines.push('- Time in zone (last 4 weeks, rides with power data):', ...shareLines);
  }
  const additionalMetricsSection = metricsLines.length > 0
    ? `\n\n## Additional Metrics\n${metricsLines.join('\n')}`
    : '';

  return `## Training Status - ${formatDateWithDay(toLocalDateStr(new Date(now)))}

**Athlete Profile:**
- FTP: ${currentFTP}W${currentEftp ? ` | eFTP: ${currentEftp.value}W (est. best 20-min, 90d)` : ''}${daysToEvent !== null ? (daysToEvent < 0 ? ' | Event complete' : ` | Days to Event: ${daysToEvent}`) : ''}

**Training Loads:**
- CTL (Fitness): ${loads.ctl}
- ATL (Fatigue): ${loads.atl}
- TSB (Form): ${loads.tsb}
- 7-Day TSS: ${loads.weeklyTSS}
- 14-Day TSS: ${loads.twoWeekTSS}
- 28-Day TSS: ${twentyEightDayTSS}

**Weekly Training Hours (past 4 weeks):**
${last4Weeks.map(w => `- ${w.label}: ${w.hours}h (${w.workouts} rides)`).join('\n')}

**Recent Workouts:**
${recentWorkouts.map(w => `- ${formatDateWithDay(w.date)}: ${w.rideType || 'Indoor'}${w.rideType !== 'Outdoor' ? `, ${getZoneName(w.zone)}` : ''}${w.rideType === 'Outdoor' && w.distance > 0 ? `, ${w.distance}mi` : ''}${w.rideType === 'Outdoor' && w.elevation > 0 ? `, ${w.elevation}ft gain` : ''}, ${w.duration}min, ${w.normalizedPower != null ? `NP ${w.normalizedPower}W` : 'no power meter'}, TSS ${w.tss}${w.tssSource === 'hr' ? ' (from heart rate)' : ''}${w.rpe != null ? `, RPE ${w.rpe}` : ''}${w.notes ? ` (${w.notes})` : ''}`).join('\n')}${intervalProgressionsSection}${additionalMetricsSection}`;
};

// Clipboard write with a fallback for non-secure (HTTP on LAN) contexts. Moved from
// copyForAnalysis() in V2 Phase 3.
export const copyToClipboard = (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for non-secure contexts (e.g., HTTP on LAN)
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  return Promise.resolve();
};
