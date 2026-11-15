import React from 'react';
import { getZoneColor, getZoneName } from '../lib/zones.js';
import { shortDayDate, formatMinutes } from '../lib/format.js';
import { avgHrFromStream } from '../lib/analysis.js';
import { navigate } from '../state/useHashRoute.js';
import ZoneMixBar, { useRideZoneTotals } from './ZoneMixBar.jsx';

// RideRow — one ride in the Rides tab list. Layout: name on the left with a coloured outlined
// pill on the right (zone name, "Outdoor", or "Needs zone"); short date and interval label
// (or outdoor elevation) on the second line; a four-number stat row (RideStats); and a thin
// time-in-zone bar (ZoneMixBar) when the ride has power data. Tapping opens the Ride page.
export const rideEdgeColor = (ride) => {
  if (ride.rideType === 'Outdoor') return '#14B8A6'; // teal, matches the calendar dot (D5: no zone)
  return ride.zone ? getZoneColor(ride.zone) : '#4B5563'; // dark grey: indoor, still needs a zone
};

// Time · NP (indoor) or Distance (outdoor) · Avg HR · TSS, each a value over a small label.
export function RideStats({ ride }) {
  const isOutdoor = ride.rideType === 'Outdoor';
  const hr = avgHrFromStream(ride);
  const cells = [
    ['Time', formatMinutes(ride.duration), null],
    isOutdoor
      ? ['Distance', ride.distance > 0 ? ride.distance : '—', ride.distance > 0 ? 'mi' : null]
      : ['NP', ride.normalizedPower || '—', ride.normalizedPower ? 'W' : null],
    ['Avg HR', hr ?? '—', null],
    ['TSS', ride.tss ?? '—', null],
  ];
  return (
    <div className="grid grid-cols-4 gap-2 mt-2" data-ride-stats>
      {cells.map(([label, value, unit]) => (
        <div key={label} className="min-w-0">
          <div className="text-base font-semibold tabular-nums truncate">
            {value}{unit && <span className="text-xs text-gray-400 font-normal ml-0.5">{unit}</span>}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
        </div>
      ))}
    </div>
  );
}

export default function RideRow({ ride }) {
  const isOutdoor = ride.rideType === 'Outdoor';
  const needsZone = !isOutdoor && !ride.zone;
  const zoneTotals = useRideZoneTotals(ride);

  const pill = isOutdoor
    ? { text: 'Outdoor', color: '#14B8A6' }
    : needsZone
      ? { text: 'Needs zone', color: '#EAB308' }
      : { text: getZoneName(ride.zone), color: getZoneColor(ride.zone) };

  const secondRight = ride.intervalData?.label
    ? <span className="font-mono text-yellow-400">{ride.intervalData.label}</span>
    : isOutdoor && ride.elevation > 0
      ? <span>{ride.elevation}ft climbing</span>
      : null;

  return (
    <button
      type="button"
      data-ride-card
      onClick={() => navigate(`#/ride/${ride.id}`)}
      className="w-full block bg-gray-800 rounded-2xl overflow-hidden text-left hover:bg-gray-700/60 active:bg-gray-700 transition-colors min-h-[44px]"
    >
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-medium truncate">{ride.name || ride.notes || 'Workout'}</span>
          <span
            data-ride-pill
            className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border"
            style={{ color: pill.color, borderColor: pill.color + '99' }}
          >
            {pill.text}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2 mt-0.5 text-sm">
          <span className="text-gray-400">{shortDayDate(ride.date)}</span>
          <span className="truncate max-w-[60%] text-right">{secondRight}</span>
        </div>
        <RideStats ride={ride} />
        <ZoneMixBar zoneTotals={zoneTotals} className="h-1.5 mt-3" />
      </div>
    </button>
  );
}
