import React, { useMemo, useState } from 'react';
import { getZoneName, getZoneColor } from '../lib/zones.js';
import { buildAlerts } from '../lib/alerts.js';
import { getDaysUntilEvent, weekComparison, latestRide, copyToClipboard } from '../lib/summary.js';
import { shortDayDate, formatMinutes } from '../lib/format.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { useShell } from '../state/ShellContext.js';
import { navigate } from '../state/useHashRoute.js';
import { Screen, Card, SectionHeader, StatTile, Button, EmptyState, useToast } from '../components/ui/index.js';

// Today tab (V2 Phase 3). Top to bottom: header (wordmark + FTP line), status card,
// alerts, this week, latest ride, event, Copy for Claude. The "＋ Log Ride" button floats
// above the tab bar (rendered by the Shell). This file is the house style later phases copy.

const OUTDOOR_DOT = '#9CA3AF';      // grey: outdoor rides aren't filed under a zone (D5)
const UNCLASSIFIED_DOT = '#4B5563'; // darker grey: indoor ride still waiting for a zone
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
const round1 = (n) => Math.round(n * 10) / 10;

const rideColor = (ride) => {
  if (ride.rideType === 'Outdoor') return OUTDOOR_DOT;
  return ride.zone ? getZoneColor(ride.zone) : UNCLASSIFIED_DOT;
};

const ChevronRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-gray-500 shrink-0">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

const TONE_BORDER = { warn: '#EAB308', good: '#22C55E', info: '#3B82F6' };

function AlertRow({ alert, onAction }) {
  const border = { borderLeftColor: TONE_BORDER[alert.tone] || TONE_BORDER.info };
  const text = (
    <div className="min-w-0 flex-1">
      <div className="text-base font-medium text-white">{alert.title}</div>
      {alert.body && <div className="text-sm text-gray-400 mt-0.5">{alert.body}</div>}
    </div>
  );
  if (alert.href) {
    return (
      <a
        href={alert.href}
        data-alert={alert.id}
        className="flex items-center gap-3 min-h-[44px] bg-gray-800 rounded-2xl border-l-4 px-4 py-3 hover:bg-gray-700/60 active:bg-gray-700 transition-colors"
        style={border}
      >
        {text}
        <ChevronRight />
      </a>
    );
  }
  return (
    <div data-alert={alert.id} className="bg-gray-800 rounded-2xl border-l-4 px-4 py-3" style={border}>
      {text}
      {alert.actions && (
        <div className="flex gap-2 mt-3">
          {alert.actions.map(a => (
            <Button key={a.id} size="sm" variant={a.primary ? 'primary' : 'ghost'} onClick={() => onAction(alert, a.id)}>
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TodayScreen() {
  const {
    history, currentFTP, userProfile, currentEftp, loads, trainingStatus, event,
    eftpPromptedValue, resolveEftpAlert, buildCopyText,
  } = useAppData();
  const { openLogRide, openEditRide } = useShell();
  const toast = useToast();
  const [copySuccess, setCopySuccess] = useState(false);

  const alerts = useMemo(
    () => buildAlerts({ history, currentFTP, event, eftpPromptedValue }, { currentEftp }, new Date()),
    [history, currentFTP, event, eftpPromptedValue, currentEftp]
  );
  const week = useMemo(() => weekComparison(history), [history]);
  const latest = useMemo(() => latestRide(history), [history]);
  const daysToEvent = getDaysUntilEvent(event);

  const handleAlertAction = (alert, actionId) => {
    if (alert.id === 'eftp') {
      // Either answer counts as "asked" for this value (same rule as the old confirm).
      resolveEftpAlert(alert.value);
      if (actionId === 'update-ftp') navigate(`#/settings/profile?ftp=${alert.value}`);
    }
  };

  const copyForAnalysis = () => {
    copyToClipboard(buildCopyText()).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(() => {
      toast('Copy failed. Your browser may not support clipboard access over HTTP.', { tone: 'error' });
    });
  };

  const openLatest = () => {
    if (!latest) return;
    if (latest.stream) navigate(`#/ride/${latest.id}`);
    else openEditRide(latest.id);
  };

  const wkg = userProfile.weight > 0 ? (currentFTP / (userProfile.weight / 2.20462)).toFixed(1) : null;
  const target = event.targetCTL > 0 ? event.targetCTL : 100;

  const header = (
    <header className="mb-4">
      <h1 className="text-xl font-bold tracking-tight">Casey Rides</h1>
      <p className="text-sm text-gray-400 tabular-nums flex flex-wrap items-center min-h-[28px]" data-ftp-line>
        <span>FTP {currentFTP}W</span>
        {wkg && <span>&nbsp;·&nbsp;{wkg} W/kg</span>}
        {currentEftp && (
          <>
            <span>&nbsp;·&nbsp;</span>
            <button
              type="button"
              className="min-h-[44px] -my-2 underline decoration-dotted decoration-gray-600 underline-offset-4"
              onClick={() => toast(
                `eFTP is your estimated FTP: best 20-minute power × 0.95 in the last 90 days ` +
                `(${currentEftp.peakRideName}, ${currentEftp.peakRideDate}).`
              )}
            >
              eFTP <span className="text-purple-400">{currentEftp.value}W</span>
            </button>
          </>
        )}
      </p>
    </header>
  );

  return (
    <Screen header={header} withFab>
      {/* Status */}
      <Card data-status-card>
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm text-gray-400">Training status</span>
          <span
            data-training-status
            className="inline-block px-3 py-0.5 rounded-full text-sm font-semibold"
            style={{ backgroundColor: trainingStatus.color + '22', color: trainingStatus.color, border: `1px solid ${trainingStatus.color}44` }}
          >
            {trainingStatus.label}
          </span>
        </div>
        <p className="text-base text-gray-300">{trainingStatus.description}</p>
        {loads.ctl >= 35 && (
          <p className="text-xs text-gray-500 mt-1 tabular-nums">
            Form is {((loads.tsb / loads.ctl) * 100).toFixed(0)}% of fitness (TSB%)
          </p>
        )}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <StatTile data-stat="ctl" label="Fitness" sublabel="CTL" value={loads.ctl} valueColor="#60A5FA"
            delta={loads.ctl - loads.ctl14dAgo} deltaLabel="14d" />
          <StatTile data-stat="atl" label="Fatigue" sublabel="ATL" value={loads.atl} valueColor="#FB923C"
            delta={loads.atl - loads.atl14dAgo} deltaLabel="14d" tone="neutral" />
          <StatTile data-stat="tsb" label="Form" sublabel="TSB" value={signed(loads.tsb)}
            delta={loads.tsb - loads.tsb14dAgo} deltaLabel="14d" tone="neutral" />
        </div>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <section aria-label="Alerts" className="space-y-2">
          {alerts.map(a => <AlertRow key={a.id} alert={a} onAction={handleAlertAction} />)}
        </section>
      )}

      {/* This week */}
      <Card>
        <SectionHeader title="This week" subtitle="Monday to today, vs last week at this point" />
        <div className="grid grid-cols-3 gap-2">
          <StatTile data-stat="week-hours" label="Hours" value={week.thisWeek.hours}
            delta={round1(week.thisWeek.hours - week.lastWeek.hours)} />
          <StatTile data-stat="week-tss" label="TSS" value={week.thisWeek.tss}
            delta={week.thisWeek.tss - week.lastWeek.tss} />
          <StatTile data-stat="week-rides" label="Rides" value={week.thisWeek.rides}
            delta={week.thisWeek.rides - week.lastWeek.rides} />
        </div>
        <div className="grid grid-cols-7 mt-4" aria-label="Rides this week">
          {week.days.map((day, i) => {
            const ride = day.rides[0];
            const label = ride
              ? `${shortDayDate(day.dateStr)}: ${day.rides.map(r => r.rideType === 'Outdoor' ? 'Outdoor ride' : getZoneName(r.zone)).join(', ')}`
              : `${shortDayDate(day.dateStr)}: no ride`;
            return (
              <div key={day.dateStr} className="flex flex-col items-center gap-1" title={label} aria-label={label}>
                <div
                  className={`w-7 h-7 rounded-full ${ride ? '' : 'border-2'} ${day.isFuture ? 'border-gray-800' : 'border-gray-700'} ${day.isToday ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-800' : ''}`}
                  style={ride ? { backgroundColor: rideColor(ride) } : undefined}
                />
                <span className={`text-xs ${day.isToday ? 'text-blue-400 font-semibold' : 'text-gray-500'}`}>{DAY_LETTERS[i]}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Latest ride */}
      {latest ? (
        <Card as="button" onClick={openLatest} aria-label={`Latest ride: ${latest.name || 'Workout'}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-base font-semibold">Latest ride</span>
            <ChevronRight />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-base font-medium truncate">{latest.name || latest.notes || 'Workout'}</span>
            {latest.rideType === 'Outdoor' ? (
              <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-700 text-gray-200">Outdoor</span>
            ) : latest.zone ? (
              <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: getZoneColor(latest.zone) + '33', color: getZoneColor(latest.zone) }}>
                {getZoneName(latest.zone)}
              </span>
            ) : (
              <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400">Needs zone</span>
            )}
          </div>
          <div className="text-sm text-gray-400 mt-0.5 tabular-nums">
            {shortDayDate(latest.date)} · {formatMinutes(latest.duration)} · TSS {latest.tss ?? '—'}
          </div>
          {latest.intervalData?.label && (
            <div className="text-sm text-yellow-400 font-mono mt-1">{latest.intervalData.label}</div>
          )}
        </Card>
      ) : (
        <Card>
          <EmptyState message="No rides yet. Log your first ride to get started." actionLabel="Log a ride" onAction={() => openLogRide()} />
        </Card>
      )}

      {/* Event */}
      <Card data-event-card>
        {daysToEvent === null ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-base text-gray-400">No event set</span>
            <Button size="sm" variant="ghost" onClick={() => navigate('#/settings/event')}>Add one</Button>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <span className="text-base font-semibold">{event.name || 'Event'}</span>
              <span className="text-sm text-gray-400">{shortDayDate(event.date)}</span>
            </div>
            {daysToEvent < 0 ? (
              <div className="flex items-center justify-between gap-3 mt-1">
                <span className="text-base text-gray-300">Event complete</span>
                <Button size="sm" variant="ghost" onClick={() => navigate('#/settings/event')}>Set next event</Button>
              </div>
            ) : (
              <div className="text-2xl font-bold tabular-nums mt-1">
                {daysToEvent === 0 ? 'Today!' : `${daysToEvent} day${daysToEvent === 1 ? '' : 's'} to go`}
              </div>
            )}
            <div className="mt-3">
              <div className="flex justify-between text-sm text-gray-400 mb-1 tabular-nums">
                <span>Fitness (CTL) {loads.ctl}</span>
                <span>Target {target}</span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (loads.ctl / target) * 100)}%` }}
                />
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Copy for Claude */}
      <Button variant="secondary" block onClick={copyForAnalysis} className={copySuccess ? '!bg-green-700' : ''}>
        {copySuccess ? 'Copied!' : 'Copy for Claude'}
      </Button>
    </Screen>
  );
}
