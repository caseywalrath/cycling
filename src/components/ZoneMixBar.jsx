import React, { useMemo } from 'react';
import { ZONES } from '../lib/zones.js';
import { formatMinutes } from '../lib/format.js';
import { timeInZones } from '../lib/analysis.js';
import { useAppData } from '../state/AppDataContext.jsx';

// ZoneMixBar — one horizontal bar split into zone colours by time in each zone (from
// timeInZones). Renders nothing when there's no data. Used by the Ride page, RideRow and
// Today's Latest ride. Not to be confused with ZoneBar.jsx (progression levels).
export default function ZoneMixBar({ zoneTotals, className = 'h-1.5' }) {
  if (!zoneTotals) return null;
  const total = Object.values(zoneTotals).reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const parts = ZONES.filter(z => (zoneTotals[z.id] || 0) > 0);
  const label = 'Time in zones: ' + parts.map(z => `${z.name} ${formatMinutes(zoneTotals[z.id] / 60)}`).join(', ');
  return (
    <div role="img" aria-label={label} data-zone-mix-bar className={`flex w-full gap-px rounded-full overflow-hidden ${className}`}>
      {parts.map(z => (
        <div key={z.id} data-zone={z.id} style={{ width: `${(zoneTotals[z.id] / total) * 100}%`, backgroundColor: z.color }} />
      ))}
    </div>
  );
}

// Zones for one ride against the FTP on that ride's date (same rule as the Ride page).
export function useRideZoneTotals(ride) {
  const { ftpOn } = useAppData();
  const ftp = ride ? ftpOn(ride.date) : null;
  return useMemo(() => (ride && ftp ? timeInZones(ride, ftp) : null), [ride, ftp]);
}
