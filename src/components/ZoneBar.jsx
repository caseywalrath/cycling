import React from 'react';
import { zoneRangeLabel } from '../lib/zones.js';
import { formatChange } from '../lib/format.js';
import { useToast } from './ui/index.js';

// One zone's progression level bar (V2 Phase 6 §6.1.1 — restyled from the Phase 3 re-home).
// Tapping the name/bar opens that zone's Workout Progression page; the "recent change" and
// "idle" badges are their own tap targets that explain themselves with a toast, replacing the
// old hover-only `title` (a phone has no hover).
export default function ZoneBar({ zone, ftp, displayValue, rawLevel, isDecayed, daysIdle, recentChange, animating, onOpen }) {
  const toast = useToast();
  const hasBadges = (recentChange && recentChange.change !== 0) || (isDecayed && daysIdle !== null);

  return (
    <div className="rounded-xl -mx-2 px-2 py-1.5">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left rounded-xl hover:bg-gray-800 active:bg-gray-800 transition-colors -m-1 p-1"
        aria-label={`${zone.name} level ${displayValue.toFixed(1)}. Open ${zone.name} workout progression`}
      >
        <div className="flex justify-between text-sm mb-1 gap-2">
          <span className="font-medium">{zone.name}</span>
          <span className="text-gray-400 tabular-nums shrink-0">{zoneRangeLabel(zone.id, ftp)}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-700 rounded-full h-5 overflow-hidden relative">
            {/* Ghost bar: shows raw (pre-decay) level when decayed */}
            {isDecayed && (
              <div
                className="absolute top-0 left-0 h-full rounded-full opacity-20"
                style={{ width: `${(rawLevel / 10) * 100}%`, backgroundColor: zone.color }}
              />
            )}
            <div
              className={`h-full rounded-full ${animating ? '' : 'transition-all duration-500'}`}
              style={{ width: `${(displayValue / 10) * 100}%`, backgroundColor: zone.color }}
            />
          </div>
          <span
            className={`w-10 text-right font-mono font-bold text-sm tabular-nums ${animating ? 'animate-pulse' : ''}`}
            style={{ color: zone.color }}
          >
            {displayValue.toFixed(1)}
          </span>
        </div>
      </button>

      {hasBadges && (
        <div className="flex flex-wrap gap-2 mt-1">
          {recentChange && recentChange.change !== 0 && (
            <button
              type="button"
              onClick={() => toast(
                recentChange.trickle
                  ? `Trickle from a nearby zone's workout on ${recentChange.date}.`
                  : `Level changed on ${recentChange.date}.`
              )}
              className={`min-h-[44px] inline-flex items-center px-2.5 rounded-lg text-xs tabular-nums ${
                recentChange.change > 0
                  ? recentChange.trickle
                    ? 'bg-green-900/30 text-green-500'
                    : 'bg-green-900/50 text-green-400'
                  : 'bg-red-900/50 text-red-400'
              }`}
            >
              {recentChange.trickle ? '~' : ''}{formatChange(recentChange.change)}
            </button>
          )}
          {isDecayed && daysIdle !== null && (
            <button
              type="button"
              onClick={() => toast(`Decayed: ${daysIdle} day${daysIdle === 1 ? '' : 's'} without training this zone.`)}
              className="min-h-[44px] inline-flex items-center px-2.5 rounded-lg text-xs bg-gray-700 text-gray-400"
            >
              ↓ {daysIdle}d idle
            </button>
          )}
        </div>
      )}
    </div>
  );
}
