import { EFTP_PROMPT_MARGIN } from './eftp.js';
import { getDaysUntilEvent, latestRide } from './summary.js';
import { dailyLoadSeries, rampRate as computeRampRate } from './load.js';
import { newBestsForRide, observedMaxHr } from './records.js';
import { rpeMismatch } from './analysis.js';
import { parseDateLocal } from './dates.js';

// Today tab alerts. A pure function so later phases can add alert types.
//
//   state:   { history, currentFTP, event, eftpPromptedValue, userProfile, dismissals,
//              maxhrPromptedValue }
//   derived: { currentEftp }
//   today:   Date
//
// Returns an array of alerts, most important first:
//   { id, tone: 'info'|'good'|'warn', title, body?, href?, actions?: [{ id, label, primary? }] }
// `href` makes the whole row tappable; `actions` are buttons handled by the Today screen.

// Indoor rides from the old CSV/intervals.icu imports that were never given a zone
// (and, from Phase 4, not marked historical).
export const ridesNeedingZone = (history) =>
  history.filter(w => w.rideType !== 'Outdoor' && w.zone == null && w.source === 'imported' && !w.historical);

// Device-local localStorage keys (V2 Phase 6, §6.2). Not part of STORAGE_KEY/Drive sync —
// like EFTP_PROMPT_KEY, these are per-device dismiss state, not user data.
export const ALERT_DISMISSALS_KEY = 'alert-dismissals';
export const MAXHR_PROMPT_KEY = 'maxhr-prompted-value';

// "New best" durations worth alerting on (§6.2): the four always-available ones, plus 5s/30s
// when the ride has full 1-second bests (a 10-second stream is too coarse to trust for those).
const NEW_BEST_ALERT_DURATIONS = ['60', '300', '1200', '3600'];
const NEW_BEST_SHORT_DURATIONS = ['5', '30'];
const DURATION_LABEL = { '5': '5-second', '30': '30-second', '60': '1-minute', '300': '5-minute', '1200': '20-minute', '3600': '60-minute' };

const daysBetween = (a, b) => Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));

export const buildAlerts = (state, derived, today = new Date()) => {
  const alerts = [];
  const {
    history = [], currentFTP, event, eftpPromptedValue = 0, userProfile = {},
    dismissals = {}, maxhrPromptedValue = 0,
  } = state;
  const { currentEftp } = derived;

  // eFTP above FTP — replaces the old window.confirm prompt. Same rule and the same
  // device-local dedupe value (EFTP_PROMPT_KEY) as before: only offers an increase, and only
  // for an estimate higher than the last one the user answered.
  const est = currentEftp?.value;
  if (est && est >= currentFTP + EFTP_PROMPT_MARGIN && est > eftpPromptedValue) {
    alerts.push({
      id: 'eftp',
      tone: 'good',
      title: `Your estimated FTP is ${est}W`,
      body: `That's ${est - currentFTP}W above your current FTP (${currentFTP}W). ` +
        `Best 20-min effort: ${currentEftp.peakRideName}, ${currentEftp.peakRideDate}.`,
      value: est,
      actions: [
        { id: 'update-ftp', label: 'Update FTP', primary: true },
        { id: 'dismiss', label: 'Dismiss' },
      ],
    });
  }

  const needZone = ridesNeedingZone(history).length;
  if (needZone > 0) {
    alerts.push({
      id: 'needs-zone',
      tone: 'warn',
      title: `${needZone} ride${needZone === 1 ? ' needs' : 's need'} a zone`,
      body: 'Imported indoor rides count toward progression once you pick their zone.',
      href: '#/rides?filter=needs-zone',
    });
  }

  const days = getDaysUntilEvent(event, today);
  if (days !== null && days < 0) {
    alerts.push({
      id: 'event-complete',
      tone: 'info',
      title: `${event.name || 'Your event'} is complete`,
      body: 'Set your next goal event.',
      href: '#/settings/event',
    });
  }

  // ---- V2 Phase 6 §6.2 ----

  // New best: the latest ride set a new all-time/90-day best at a duration worth calling
  // out. Dedupe per ride id — dismissible, and doesn't come back for the same ride.
  const latest = latestRide(history);
  if (latest) {
    const newBests = newBestsForRide(history, latest);
    const hasShort = !!(latest.bests && Object.keys(latest.bests).length > 0);
    const wanted = hasShort ? [...NEW_BEST_SHORT_DURATIONS, ...NEW_BEST_ALERT_DURATIONS] : NEW_BEST_ALERT_DURATIONS;
    const qualifying = newBests.filter(d => wanted.includes(d));
    const dismissKey = `new-best-${latest.id}`;
    if (qualifying.length > 0 && !dismissals[dismissKey]) {
      const labels = qualifying.map(d => DURATION_LABEL[d] || `${d}s`);
      alerts.push({
        id: 'new-best',
        tone: 'good',
        title: qualifying.length === 1 ? `New best: ${labels[0]} power!` : `New bests: ${labels.join(', ')} power!`,
        body: `Set on ${latest.name || 'your latest ride'}, ${latest.date}.`,
        rideId: latest.id,
        actions: [
          { id: 'view', label: 'View ride', primary: true },
          { id: 'dismiss', label: 'Dismiss' },
        ],
      });
    }
  }

  // Ramp rate: fitness climbing fast. Dismiss hides it for 7 days regardless of the value.
  const series = dailyLoadSeries(history, today);
  const ramp = computeRampRate(series);
  if (ramp != null && ramp > 7) {
    const dismissedAt = dismissals['ramp-rate'];
    const stillDismissed = dismissedAt && daysBetween(today, parseDateLocal(dismissedAt)) < 7;
    if (!stillDismissed) {
      alerts.push({
        id: 'ramp-rate',
        tone: 'warn',
        title: `Fitness is climbing fast (+${ramp}/week)`,
        body: 'Watch for fatigue.',
        actions: [{ id: 'dismiss', label: 'Dismiss' }],
      });
    }
  }

  // Feels harder than usual: 2+ of the last 5 power rides felt harder than their intensity
  // suggests. Dismiss hides it until a new ride is logged.
  const powerRides = history
    .filter(w => w.intensityFactor != null && w.rpe != null)
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5);
  const mismatchCount = powerRides.filter(w => {
    const m = rpeMismatch(w);
    return m != null && m >= 2;
  }).length;
  if (mismatchCount >= 2) {
    const latestId = latest ? latest.id : null;
    if (dismissals['feels-harder'] !== latestId) {
      alerts.push({
        id: 'feels-harder',
        tone: 'warn',
        title: 'Feels harder than usual',
        body: 'Several recent rides felt tougher than their power/HR numbers suggest — could be fatigue, heat, or life stress.',
        actions: [{ id: 'dismiss', label: 'Dismiss' }],
      });
    }
  }

  // Max heart rate: the highest heart rate ever recorded is above (or there's no) profile
  // Max HR. Same device-local dedupe pattern as the eFTP alert.
  const maxHrSeen = observedMaxHr(history);
  if (maxHrSeen != null && (userProfile.maxHR == null || maxHrSeen > userProfile.maxHR) && maxHrSeen > maxhrPromptedValue) {
    alerts.push({
      id: 'max-hr',
      tone: 'info',
      title: `Highest heart rate seen: ${maxHrSeen}`,
      body: userProfile.maxHR ? `That's above your profile's Max HR (${userProfile.maxHR}).` : 'Add your Max HR to Settings for more accurate numbers.',
      value: maxHrSeen,
      actions: [
        { id: 'update-maxhr', label: 'Update profile', primary: true },
        { id: 'dismiss', label: 'Dismiss' },
      ],
    });
  }

  return alerts;
};

// Persist a dismissal into the device-local `alert-dismissals` JSON map. `value` is whatever
// the specific alert needs to remember (a ride id, a date string, true, …).
export const readDismissals = () => {
  try {
    const raw = localStorage.getItem(ALERT_DISMISSALS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const writeDismissal = (key, value) => {
  try {
    const current = readDismissals();
    const next = { ...current, [key]: value };
    localStorage.setItem(ALERT_DISMISSALS_KEY, JSON.stringify(next));
    return next;
  } catch {
    return readDismissals();
  }
};
