import React from 'react';
import { getZoneColor, getZoneName } from '../lib/zones.js';
import { shortDayDate, formatMinutes } from '../lib/format.js';
import { navigate } from '../state/useHashRoute.js';

// RideRow — one ride in the Rides tab list (V2 Phase 4). A 4px zone-coloured left edge, name,
// short date, duration · TSS, and a second line: interval label (indoor) or distance/elevation
// (outdoor). Tapping opens the Ride page.
export const rideEdgeColor = (ride) => {
  if (ride.rideType === 'Outdoor') return '#14B8A6'; // teal, matches the calendar dot (D5: no zone)
  return ride.zone ? getZoneColor(ride.zone) : '#4B5563'; // dark grey: indoor, still needs a zone
};

export default function RideRow({ ride }) {
  const isOutdoor = ride.rideType === 'Outdoor';
  const needsZone = !isOutdoor && !ride.zone;

  const secondLine = ride.intervalData?.label
    ? <span className="font-mono text-yellow-400">{ride.intervalData.label}</span>
    : isOutdoor
      ? <span>{ride.distance > 0 ? `${ride.distance}mi` : '—'} · {ride.elevation > 0 ? `${ride.elevation}ft` : '—'} elevation</span>
      : needsZone
        ? <span className="text-yellow-500">Needs a zone</span>
        : <span>{getZoneName(ride.zone)}</span>;

  return (
    <button
      type="button"
      data-ride-card
      onClick={() => navigate(`#/ride/${ride.id}`)}
      className="w-full flex items-stretch gap-3 bg-gray-800 rounded-2xl overflow-hidden text-left hover:bg-gray-700/60 active:bg-gray-700 transition-colors min-h-[44px]"
    >
      <div className="w-1 shrink-0" style={{ backgroundColor: rideEdgeColor(ride) }} aria-hidden="true" />
      <div className="flex-1 min-w-0 py-3 pr-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-base font-medium truncate">{ride.name || ride.notes || 'Workout'}</span>
          <span className="shrink-0 text-sm text-gray-400 tabular-nums">{formatMinutes(ride.duration)} · TSS {ride.tss ?? '—'}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 mt-0.5 text-sm">
          <span className="text-gray-400">{shortDayDate(ride.date)}</span>
          <span className="truncate max-w-[60%] text-right">{secondLine}</span>
        </div>
      </div>
    </button>
  );
}
