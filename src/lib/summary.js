import { parseDateLocal, toLocalDateStr, formatDateWithDay } from './dates.js';
import { ZONES, ZONE_BOUNDS, ZONE_COGGAN_LEVEL, getZoneName, zoneWattRange } from './zones.js';
import { timeInZones, aerobicDecoupling, expectedRpe, recentRpeGaps, RPE_BIG_GAP } from './analysis.js';
import { workReps, rideFtpAtTime, ZONE_SET_TOLERANCE } from './progression.js';
import { getTrainingStatus, estimateLthr } from './load.js';
import { EFTP_20MIN_FACTOR } from './eftp.js';
import { ftpOnDate, describeFtpHistory } from './ftpHistory.js';

// "RPE 8 (expected 7, +1)", "RPE 7 (expected 7)", "RPE not rated" (Session 29). The expected value
// is the same one the Log Ride ring and the "Feels harder than usual" alert use.
const rpeText = (w) => {
  if (w.rpe == null) return 'RPE not rated';
  const expected = expectedRpe(w);
  if (expected == null) return `RPE ${w.rpe}`;
  const gap = w.rpe - expected;
  return `RPE ${w.rpe} (expected ${expected}${gap === 0 ? '' : `, ${gap > 0 ? '+' : ''}${gap}`})`;
};

// "RPE vs expected, last 5 rated rides: +0.4 avg, 1 ride +2 or more" (fewer rides early on), or null
// with no rated rides.
const rpeSummaryLine = (history) => {
  const gaps = recentRpeGaps(history);
  if (gaps.length === 0) return null;
  const avg = Math.round((gaps.reduce((sum, g) => sum + g.gap, 0) / gaps.length) * 10) / 10;
  const big = gaps.filter(g => g.gap >= RPE_BIG_GAP).length;
  const label = `last ${gaps.length} rated ${gaps.length === 1 ? 'ride' : 'rides'}`;
  const bigText = big === 0 ? 'none' : `${big} ${big === 1 ? 'ride' : 'rides'}`;
  return `RPE vs expected, ${label}: ${avg > 0 ? '+' : ''}${avg} avg, ${bigText} +${RPE_BIG_GAP} or more`;
};

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

// ---------------------------------------------------------------------------------------------
// "Copy for Claude" text. Rebuilt in Session 26 to answer "what workout should I do today?":
// every calendar week is listed (empty ones too), rides carry their name/IF/HR, interval work is
// shown as in-zone reps at %FTP, and the zone table is printed so the names mean the same thing
// to Claude as they do in the app. Anything the app can't measure prints "n/a" rather than
// disappearing. All zone edges come from ZONE_BOUNDS, so re-anchoring the zones there changes
// this text with it.
// ---------------------------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HARD_ZONES = ['sweetspot', 'threshold', 'vo2max', 'anaerobic'];
const HARD_IF = 0.85; // same "hard day" bar the TrainerDay coaching rules use
const ZONES_WITH_REPS = ['tempo', 'sweetspot', 'threshold', 'vo2max', 'anaerobic'];
const PROGRESSION_WINDOW_DAYS = 90;
const RECENT_RIDES_DAYS = 21;
const RECENT_RIDES_MAX = 10;
const WEEKLY_LOAD_WEEKS = 6;
const MAX_LISTED_REPS = 6; // more reps than this are summarised instead of listed one by one

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const daysSince = (dateStr, today) => Math.round((today - parseDateLocal(dateStr)) / DAY_MS);

const daysAgoText = (n) => (n === 0 ? 'today' : n === 1 ? '1 day ago' : `${n} days ago`);

const shortDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Minutes rounded to the nearest half minute, without a trailing ".0".
const halfMinutes = (seconds) => String(Math.round(seconds / 30) / 2);

// Zone an indoor ride is filed under (outdoor rides have none).
const rideZone = (w) => (w.rideType === 'Outdoor' ? null : (w.zone || w.intervalData?.category || null));

const isHardRide = (w) => HARD_ZONES.includes(rideZone(w)) || Number(w.intensityFactor) >= HARD_IF;

// In-zone work of one ride, from the same filter progression levels use (workReps): only efforts
// at or above the zone's floor, short pauses merged. null when the ride has no in-zone reps.
const inZoneWork = (w, zoneId, ftp) => {
  if (!w.intervalData || !ZONE_BOUNDS[zoneId] || !(ftp > 0)) return null;
  const reps = workReps(w.intervalData, ftp, ZONE_BOUNDS[zoneId][0] - ZONE_SET_TOLERANCE);
  const lengths = [];
  let totalSec = 0;
  let wattSec = 0;
  reps.forEach(({ count, seconds, ratio }) => {
    for (let i = 0; i < count; i++) lengths.push(seconds);
    totalSec += count * seconds;
    wattSec += count * seconds * ratio;
  });
  if (totalSec === 0) return null;
  return { lengths, totalSec, ratio: wattSec / totalSec };
};

// "2 reps (10, 10 min) @ 87% (196W avg), 20 min in zone". `ofFtp` names the FTP the percentage is
// of when it is not today's: "@ 85% of 240W FTP (204W avg)".
const describeWork = (work, ftp, ofFtp = null) => {
  const n = work.lengths.length;
  const reps = n <= MAX_LISTED_REPS
    ? `${plural(n, 'rep')} (${work.lengths.map(halfMinutes).join(', ')} min)`
    : `${n} reps (~${halfMinutes(work.totalSec / n)} min each, longest ${halfMinutes(Math.max(...work.lengths))})`;
  return `${reps} @ ${Math.round(work.ratio * 100)}%${ofFtp ? ` of ${ofFtp}W FTP` : ''} (${Math.round(work.ratio * ftp)}W avg), ${halfMinutes(work.totalSec)} min in zone`;
};

// "4x9 @ 96%" when the reps are about the same length, else "3 reps, 31 min @ 90%".
const compactWork = (work) => {
  const n = work.lengths.length;
  const mean = work.totalSec / n;
  const even = work.lengths.every(s => Math.abs(s - mean) <= 60);
  const pct = Math.round(work.ratio * 100);
  return even ? `${n}x${halfMinutes(mean)} @ ${pct}%` : `${plural(n, 'rep')}, ${halfMinutes(work.totalSec)} min @ ${pct}%`;
};

// Every Monday-start week for the last `weeks` weeks, including weeks with no rides. The
// current week is marked partial until its Sunday.
const weeklyLoad = (history, today, weeks = WEEKLY_LOAD_WEEKS) => {
  const thisMonday = mondayOf(today);
  const todayStr = toLocalDateStr(today);
  const rows = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisMonday);
    start.setDate(start.getDate() - 7 * i);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const startStr = toLocalDateStr(start);
    const endStr = toLocalDateStr(end);
    const rides = history.filter(w => w.date && w.date >= startStr && w.date <= endStr);
    rows.push({
      start: startStr,
      hours: rides.reduce((s, w) => s + (w.duration || 0), 0) / 60,
      tss: Math.round(rides.reduce((s, w) => s + (w.tss || 0), 0)),
      rides: rides.length,
      partial: todayStr < endStr,
    });
  }
  return rows;
};

const eftpText = (currentEftp, best20) => {
  if (!currentEftp) return 'eFTP n/a (no power file with 20+ minutes in the last 90d)';
  const pct = Math.round(EFTP_20MIN_FACTOR * 100);
  const floor = 'a floor, not a max-effort test';
  if (best20 && Math.round(EFTP_20MIN_FACTOR * best20) === currentEftp.value) {
    return `eFTP ${currentEftp.value}W (${pct}% of best 20-min ${Math.round(best20)}W in 90d; ${floor})`;
  }
  return `eFTP ${currentEftp.value}W (from best 20/60-min power in 90d; ${floor})`;
};

const zoneTableLines = (ftp) => ZONES.map(z => {
  const [lo, hi] = ZONE_BOUNDS[z.id];
  const { min, max } = zoneWattRange(z.id, ftp);
  const level = ZONE_COGGAN_LEVEL[z.id];
  if (lo === 0) return `- ${z.name}: under ${Math.round(hi * 100)}% (under ${max}W) [${level}]`;
  if (max === null) return `- ${z.name}: ${Math.round(lo * 100)}%+ (${min}W+) [${level}]`;
  return `- ${z.name}: ${Math.round(lo * 100)}-${Math.round(hi * 100)}% (${min}-${max}W) [${level}]`;
});

export const buildAnalysisText = ({ history, currentFTP, currentEftp, event, loads, rampRate, bestCurves, userProfile, ftpHistory = [], now = new Date() }) => {
  const today = startOfDay(now);
  // The FTP a ride is measured against: the FTP on its own date when a history is recorded.
  const ftpFor = (w) => ftpOnDate(ftpHistory, w.date, currentFTP);
  const todayStr = toLocalDateStr(today);
  const daysToEvent = getDaysUntilEvent(event, now);
  const status = getTrainingStatus(loads.ctl, loads.atl, loads.tsb, loads.ctl14dAgo);
  const rides = history.filter(w => w.date);
  const newestFirst = [...rides].sort((a, b) => b.date.localeCompare(a.date));
  const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;

  // --- Header: status, load, how long since riding ---
  const lastRide = newestFirst[0] || null;
  const lastHard = newestFirst.find(isHardRide) || null;
  const sinceText = (w) => (w ? `${daysAgoText(daysSince(w.date, today))} (${shortDate(w.date)})` : 'none on record');
  const statusLine = `Status: ${status.label} | CTL ${loads.ctl} | ATL ${loads.atl} | TSB ${signed(loads.tsb)}${rampRate != null ? ` | Ramp ${signed(rampRate)}/wk` : ''} | 7-day TSS ${loads.weeklyTSS}`;
  const sinceLine = `Last ride: ${sinceText(lastRide)} | Last hard ride (sweet spot or above, or IF ${HARD_IF}+): ${sinceText(lastHard)}`;

  // --- Athlete ---
  const lthr = estimateLthr(userProfile);
  const hrBits = [
    `LTHR ${lthr ? `${lthr}${userProfile?.lthr ? '' : ' (estimated from max HR)'}` : 'n/a'}`,
    `Max HR ${userProfile?.maxHR || 'n/a'}`,
    `Weight ${userProfile?.weight ? `${userProfile.weight} lb` : 'n/a'}`,
  ];
  const best20 = bestCurves?.last90Days?.['1200']?.watts;
  const athleteLines = [
    `- FTP ${currentFTP}W | ${eftpText(currentEftp, best20)}`,
    `- ${hrBits.join(' | ')}`,
  ];
  const ftpHistoryText = describeFtpHistory(ftpHistory);
  if (ftpHistoryText) athleteLines.push(`- FTP history: ${ftpHistoryText}. Each ride below is measured against the FTP of its own day.`);
  if (daysToEvent !== null && daysToEvent >= 0) {
    athleteLines.push(`- Next event: ${event.name || 'Event'}, ${daysToEvent === 0 ? 'today' : plural(daysToEvent, 'day') + ' away'}`);
  }

  // --- Days since each zone was last trained (indoor rides filed under the zone) ---
  const zoneDays = ZONES.filter(z => z.id !== 'recovery').map(z => {
    const last = newestFirst.find(w => rideZone(w) === z.id);
    return `${z.name} ${last ? daysSince(last.date, today) : 'never'}`;
  });

  // --- Weekly load ---
  const weekLines = weeklyLoad(rides, today).map(wk => {
    const partial = wk.partial ? ` (partial, Mon${today.getDay() === 1 ? ' only' : `-${DAY_ABBR[today.getDay()]}`})` : '';
    return `- ${shortDate(wk.start)}${partial}: ${wk.hours.toFixed(1)}h, ${wk.tss} TSS (${plural(wk.rides, 'ride')})`;
  });

  const rpeLine = rpeSummaryLine(rides);

  // --- Recent rides ---
  const recentCutoff = toLocalDateStr(new Date(today.getTime() - RECENT_RIDES_DAYS * DAY_MS));
  const recent = newestFirst.filter(w => w.date >= recentCutoff).slice(0, RECENT_RIDES_MAX);
  const recentLines = recent.flatMap(w => {
    const indoor = w.rideType !== 'Outdoor';
    const zone = rideZone(w);
    // With an FTP history, the ride is measured against its own day's FTP and IF is worked out
    // from NP to match. Without one, IF is as stored, and the note says which FTP it was scored at.
    const rideFtp = ftpFor(w);
    const hasHistory = ftpHistory.length > 0;
    const ftpDiffers = hasHistory && rideFtp !== currentFTP;
    const savedFtp = rideFtpAtTime(w);
    const ifValue = hasHistory && w.normalizedPower > 0 && rideFtp > 0 ? w.normalizedPower / rideFtp : Number(w.intensityFactor);
    const ftpNote = ftpDiffers
      ? ` (FTP then ${rideFtp}W)`
      : (!hasHistory && savedFtp && Math.abs(savedFtp - currentFTP) >= 3 ? ` (scored at FTP ${Math.round(savedFtp)}W)` : '');
    const parts = [
      `${w.rideType || 'Indoor'}${w.name ? ` "${w.name}"` : ''}`,
      indoor ? getZoneName(w.zone) : null,
      `${w.duration}min`,
      w.normalizedPower != null ? `NP ${w.normalizedPower}W` : 'no power meter',
      w.intensityFactor != null ? `IF ${ifValue.toFixed(2)}${ftpNote}` : null,
      `TSS ${w.tss}${w.tssSource === 'hr' ? ' (from heart rate)' : ''}`,
      w.hrStats?.avg != null ? `avg HR ${Math.round(w.hrStats.avg)}` : null,
      rpeText(w),
      indoor ? (w.completed === false ? 'did NOT finish all intervals' : 'completed') : null,
    ].filter(Boolean);
    const line = `- ${formatDateWithDay(w.date)}: ${parts.join(', ')}${w.notes ? ` (${w.notes})` : ''}`;
    const work = ZONES_WITH_REPS.includes(zone) ? inZoneWork(w, zone, rideFtp) : null;
    return work ? [line, `  Main set: ${describeWork(work, rideFtp, ftpDiffers ? rideFtp : null)}`] : [line];
  });

  // --- Interval progression: in-zone reps at %FTP, last 3 per zone, oldest first ---
  const progressionCutoff = toLocalDateStr(new Date(today.getTime() - PROGRESSION_WINDOW_DAYS * DAY_MS));
  const progressionLines = ZONES.filter(z => z.id !== 'recovery').map(z => {
    const sessions = rides.filter(w => w.intervalData?.category === z.id);
    const inWindow = sessions
      .filter(w => w.date >= progressionCutoff)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-3);
    if (inWindow.length === 0) {
      const lastEver = sessions.map(w => w.date).sort().pop();
      return `- ${z.name}: none in ${PROGRESSION_WINDOW_DAYS} days${lastEver ? ` (last ${shortDate(lastEver)})` : ''}`;
    }
    const items = inWindow.map(w => {
      if (z.id === 'endurance') return `${shortDate(w.date)} ${w.duration}min${w.intensityFactor != null ? ` @ IF ${Number(w.intensityFactor).toFixed(2)}` : ''}`;
      const work = inZoneWork(w, z.id, ftpFor(w));
      return `${shortDate(w.date)} ${work ? compactWork(work) : `none in zone${w.intervalData?.label ? ` (ride was ${w.intervalData.label})` : ''}`}`;
    });
    return `- ${z.name}: ${items.join(' → ')}`;
  });

  // --- Time in zone, last 4 weeks, minutes; recovery (coasting) kept out of the shares ---
  const fourWeeksAgoStr = toLocalDateStr(new Date(today.getTime() - 28 * DAY_MS));
  const zoneSeconds = {};
  ZONES.forEach(z => { zoneSeconds[z.id] = 0; });
  rides.filter(w => w.date >= fourWeeksAgoStr).forEach(w => {
    const zones = timeInZones(w, ftpFor(w));
    if (zones) Object.entries(zones).forEach(([id, secs]) => { zoneSeconds[id] += secs; });
  });
  const trainedSeconds = ZONES.filter(z => z.id !== 'recovery').reduce((s, z) => s + zoneSeconds[z.id], 0);
  const zoneTimeLines = trainedSeconds > 0
    ? [
        ZONES.filter(z => z.id !== 'recovery' && zoneSeconds[z.id] > 0)
          .map(z => `${z.name} ${Math.round(zoneSeconds[z.id] / 60)} min (${Math.round((zoneSeconds[z.id] / trainedSeconds) * 100)}%)`)
          .join(' | '),
        `Recovery/coasting, not counted: ${Math.round(zoneSeconds.recovery / 60)} min`,
      ]
    : ['n/a (no rides with a power file in the last 4 weeks)'];

  // --- Bests and heart-rate drift ---
  const bestBits = [['60', '1-min'], ['300', '5-min'], ['1200', '20-min']]
    .map(([sec, label]) => {
      const b = bestCurves?.last90Days?.[sec];
      if (!b) return null;
      return `${label} ${b.watts}W${sec === '1200' ? ` (${b.rideName}, ${b.date})` : ''}`;
    })
    .filter(Boolean);
  const thirtyDaysAgoStr = toLocalDateStr(new Date(today.getTime() - 30 * DAY_MS));
  const driftVals = rides
    .filter(w => w.date >= thirtyDaysAgoStr && w.date <= todayStr)
    .map(w => aerobicDecoupling(w))
    .filter(v => v != null);
  const driftText = driftVals.length > 0
    ? `${Math.round((driftVals.reduce((a, b) => a + b, 0) / driftVals.length) * 10) / 10}% avg over ${plural(driftVals.length, 'ride')}`
    : 'n/a (no steady 60+ min rides with heart rate and power)';

  return `## Training Status - ${formatDateWithDay(todayStr)}
${statusLine}
${sinceLine}

**Athlete**
${athleteLines.join('\n')}

**Zones @ ${currentFTP}W** (% of FTP; [Z#] = TrainerDay/Coggan power level)
${zoneTableLines(currentFTP).join('\n')}
TrainerDay has no sweet-spot level; its "SS" workouts target this app's Sweet Spot band. Other edges match TrainerDay.

**Days since each zone was last trained (indoor rides)**
- ${zoneDays.join(' | ')}

**Weekly load** (Monday start, last ${WEEKLY_LOAD_WEEKS} weeks, empty weeks included)
${weekLines.join('\n')}

**Recent rides** (last ${RECENT_RIDES_DAYS} days)
${recentLines.length > 0 ? recentLines.join('\n') : '- none'}${rpeLine ? `\n${rpeLine}` : ''}

**Interval progression** (in-zone reps only, last 3 per zone, oldest first)
${progressionLines.join('\n')}

**Time in zone** (last 4 weeks)
${zoneTimeLines.map(l => `- ${l}`).join('\n')}

**Bests (90d):** ${bestBits.length > 0 ? bestBits.join(' | ') : 'n/a'}
**HR drift (30d):** ${driftText}`;
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
