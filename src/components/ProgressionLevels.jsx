import React from 'react';
import { ZONES } from '../lib/zones.js';
import { parseDateLocal } from '../lib/dates.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { navigate } from '../state/useHashRoute.js';
import ZoneBar from './ZoneBar.jsx';

// Progression level bars, one per zone (Recovery excluded). V2 Phase 6 §6.1.1: restyled with
// ZoneBar — the "recent change"/"idle" badges are now their own tap targets (a toast), not a
// hover-only `title`.
export default function ProgressionLevels() {
  const { levels, displayLevels, effectiveLevels, animatingZone, recentChanges, lastWorkedDates, currentFTP } = useAppData();

  return (
    <div className="space-y-1">
      {ZONES.filter((zone) => zone.id !== 'recovery').map((zone) => {
        const recentChange = recentChanges[zone.id];
        const displayValue = animatingZone === zone.id
          ? displayLevels[zone.id]
          : effectiveLevels[zone.id];
        const isDecayed = effectiveLevels[zone.id] < levels[zone.id];
        const lastWorked = lastWorkedDates[zone.id];
        const daysIdle = lastWorked
          ? Math.floor((new Date().setHours(0,0,0,0) - parseDateLocal(lastWorked)) / (1000 * 60 * 60 * 24))
          : null;

        return (
          <ZoneBar
            key={zone.id}
            zone={zone}
            ftp={currentFTP}
            displayValue={displayValue}
            rawLevel={levels[zone.id]}
            isDecayed={isDecayed}
            daysIdle={daysIdle}
            recentChange={recentChange}
            animating={animatingZone === zone.id}
            onOpen={() => navigate(`#/progress/zone/${zone.id}`)}
          />
        );
      })}
    </div>
  );
}
