import { parseDateLocal, toLocalDateStr, formatDateWithDay } from './dates.js';
import { ZONES, getZoneName } from './zones.js';
import { calculateWeeklyHours } from './chartData.js';

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
// the text format is unchanged.
export const buildAnalysisText = ({ history, currentFTP, currentEftp, event, loads, now = new Date() }) => {
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
${recentWorkouts.map(w => `- ${formatDateWithDay(w.date)}: ${w.rideType || 'Indoor'}${w.rideType !== 'Outdoor' ? `, ${getZoneName(w.zone)}` : ''}${w.rideType === 'Outdoor' && w.distance > 0 ? `, ${w.distance}mi` : ''}${w.rideType === 'Outdoor' && w.elevation > 0 ? `, ${w.elevation}ft gain` : ''}, ${w.duration}min, ${w.normalizedPower != null ? `NP ${w.normalizedPower}W` : 'no power meter'}, TSS ${w.tss}${w.tssSource === 'hr' ? ' (from heart rate)' : ''}${w.rpe != null ? `, RPE ${w.rpe}` : ''}${w.notes ? ` (${w.notes})` : ''}`).join('\n')}${intervalProgressionsSection}`;
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
