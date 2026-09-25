import React from 'react';
import { shortDayDate, formatMinutes } from '../lib/format.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { navigate } from '../state/useHashRoute.js';
import { Card, SectionHeader } from './ui/index.js';

const BEST_ROWS = [
  { sec: '5', label: '5 sec' },
  { sec: '60', label: '1 min' },
  { sec: '300', label: '5 min' },
  { sec: '1200', label: '20 min' },
  { sec: '3600', label: '60 min' },
];

const round1 = (n) => Math.round(n * 10) / 10;

const Delta = ({ value }) => {
  if (value == null || Number.isNaN(value)) return null;
  const up = value > 0;
  const flat = value === 0;
  return (
    <span className={`text-xs tabular-nums ml-1 ${flat ? 'text-gray-500' : up ? 'text-green-400' : 'text-red-400'}`}>
      {flat ? '–' : up ? '▲' : '▼'} {Math.abs(round1(value))}
    </span>
  );
};

// Records (V2 Phase 6 §6.1.7): personal best table (5s/1m/5m/20m/60m, all-time + 90-day, with
// W/kg), longest ride / most climbing / biggest TSS (each tappable to its ride), and
// year-to-date vs last year. Fed from bestCurves (personalBests) and rideRecords (records()),
// both memoised in AppDataContext.
export default function RecordsCard() {
  const { bestCurves, rideRecords, userProfile } = useAppData();
  const weightKg = userProfile.weight > 0 ? userProfile.weight / 2.20462 : null;

  const openRide = (rideId) => rideId != null && navigate(`#/ride/${rideId}`);

  const { longestByDuration, longestByDistance, mostElevation, highestTss, ytd, lastYtd } = rideRecords;

  const RecordRow = ({ label, ride, value }) => ride ? (
    <button
      type="button"
      onClick={() => openRide(ride.id)}
      className="flex items-center justify-between gap-2 w-full min-h-[44px] text-left py-1"
    >
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm text-right truncate">
        <span className="font-semibold tabular-nums">{value}</span>
        <span className="text-gray-500 ml-2">{ride.name || 'Workout'}, {shortDayDate(ride.date)}</span>
      </span>
    </button>
  ) : null;

  return (
    <Card>
      <SectionHeader title="Records" />

      {/* Personal bests table */}
      <div className="mb-4">
        <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 mb-1 px-1">
          <span></span>
          <span className="text-right">All-time</span>
          <span className="text-right">90 days</span>
        </div>
        {BEST_ROWS.map(({ sec, label }) => {
          const at = bestCurves.allTime[sec];
          const l90 = bestCurves.last90Days[sec];
          if (!at && !l90) return null;
          const wkg = (w) => weightKg && w ? ` (${(w / weightKg).toFixed(1)})` : '';
          return (
            <div key={sec} className="grid grid-cols-3 gap-2 items-center text-sm py-1 border-t border-gray-700/50 px-1">
              <span className="text-gray-300">{label}</span>
              <span className="text-right tabular-nums">{at ? `${at.watts}W${wkg(at.watts)}` : '—'}</span>
              <span className="text-right tabular-nums">{l90 ? `${l90.watts}W${wkg(l90.watts)}` : '—'}</span>
            </div>
          );
        })}
        {weightKg && <p className="text-xs text-gray-500 mt-1 px-1">W/kg in parentheses</p>}
      </div>

      {/* Longest / most climbing / highest TSS */}
      <div className="space-y-0.5 mb-4 pt-2 border-t border-gray-700">
        <RecordRow label="Longest ride" ride={longestByDuration} value={longestByDuration ? formatMinutes(longestByDuration.duration) : null} />
        <RecordRow label="Most climbing" ride={mostElevation} value={mostElevation?.elevation ? `${Math.round(mostElevation.elevation).toLocaleString()} ft` : null} />
        <RecordRow label="Highest TSS" ride={highestTss} value={highestTss ? highestTss.tss : null} />
      </div>

      {/* Year-to-date vs last year */}
      <div className="pt-2 border-t border-gray-700">
        <p className="text-xs text-gray-500 mb-2">Year to date vs. same point last year</p>
        <div className="grid grid-cols-2 gap-y-1.5 text-sm tabular-nums">
          <span className="text-gray-400">Distance</span>
          <span className="text-right">{Math.round(ytd.distance).toLocaleString()} mi<Delta value={ytd.distance - lastYtd.distance} /></span>
          <span className="text-gray-400">Hours</span>
          <span className="text-right">{round1(ytd.hours)}h<Delta value={round1(ytd.hours - lastYtd.hours)} /></span>
          <span className="text-gray-400">Climbing</span>
          <span className="text-right">{Math.round(ytd.elevation).toLocaleString()} ft<Delta value={ytd.elevation - lastYtd.elevation} /></span>
          <span className="text-gray-400">Rides</span>
          <span className="text-right">{ytd.rides}<Delta value={ytd.rides - lastYtd.rides} /></span>
        </div>
      </div>
    </Card>
  );
}
