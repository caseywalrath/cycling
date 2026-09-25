import React from 'react';
import { ZONES, zoneRangeLabel } from '../lib/zones.js';
import { parseDateLocal } from '../lib/dates.js';
import { formatChange } from '../lib/format.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { navigate } from '../state/useHashRoute.js';

// Progression level bars, one per zone (Recovery excluded). Re-homed from the old main page
// in V2 Phase 3 without redesign (Phase 6 restyles it). Each bar is now a button that opens
// that zone's Workout Progression page.
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
          <button
            key={zone.id}
            type="button"
            onClick={() => navigate(`#/progress/zone/${zone.id}`)}
            className="block w-full text-left rounded-xl px-2 py-2 -mx-2 hover:bg-gray-800 active:bg-gray-800 transition-colors"
            aria-label={`${zone.name} level ${displayValue.toFixed(1)}. Open ${zone.name} workout progression`}
          >
            <div className="flex justify-between text-sm mb-1 gap-2">
              <span className="font-medium flex items-center gap-2 flex-wrap">
                {zone.name}
                {recentChange && recentChange.change !== 0 && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded tabular-nums ${
                      recentChange.change > 0
                        ? recentChange.trickle
                          ? 'bg-green-900/30 text-green-500'
                          : 'bg-green-900/50 text-green-400'
                        : 'bg-red-900/50 text-red-400'
                    }`}
                    title={recentChange.trickle
                      ? `Trickle from adjacent zone: ${recentChange.date}`
                      : `Last change: ${recentChange.date}`}
                  >
                    {recentChange.trickle ? '~' : ''}{formatChange(recentChange.change)}
                  </span>
                )}
                {isDecayed && daysIdle !== null && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400"
                    title={`Decayed due to ${daysIdle} days without training this zone`}
                  >
                    ↓ {daysIdle}d idle
                  </span>
                )}
              </span>
              <span className="text-gray-400 tabular-nums shrink-0">{zoneRangeLabel(zone.id, currentFTP)}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-700 rounded-full h-5 overflow-hidden relative">
                {/* Ghost bar: shows raw (pre-decay) level when decayed */}
                {isDecayed && (
                  <div
                    className="absolute top-0 left-0 h-full rounded-full opacity-20"
                    style={{
                      width: `${(levels[zone.id] / 10) * 100}%`,
                      backgroundColor: zone.color,
                    }}
                  />
                )}
                <div
                  className={`h-full rounded-full ${animatingZone === zone.id ? '' : 'transition-all duration-500'}`}
                  style={{
                    width: `${(displayValue / 10) * 100}%`,
                    backgroundColor: zone.color,
                  }}
                />
              </div>
              <span
                className={`w-10 text-right font-mono font-bold text-sm tabular-nums ${animatingZone === zone.id ? 'animate-pulse' : ''}`}
                style={{ color: zone.color }}
              >
                {displayValue.toFixed(1)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
