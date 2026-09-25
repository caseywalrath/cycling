import { EFTP_PROMPT_MARGIN } from './eftp.js';
import { getDaysUntilEvent } from './summary.js';

// Today tab alerts (V2 Phase 3). A pure function so later phases can add alert types
// (Phase 6: new best, ramp rate, harder than usual, max heart rate).
//
//   state:   { history, currentFTP, event, eftpPromptedValue }
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

export const buildAlerts = (state, derived, today = new Date()) => {
  const alerts = [];
  const { history = [], currentFTP, event, eftpPromptedValue = 0 } = state;
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

  return alerts;
};
