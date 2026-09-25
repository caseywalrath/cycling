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

  // Layout (tightened after the user's review): badges sit inline next to the zone name instead
  // of on their own row. Each badge and the name keep a 44px-tall tap box, but negative vertical
  // margins stop that box from adding height, so a zone takes ~60px instead of ~110px.
  const badgeBox = 'min-h-[44px] min-w-[44px] -my-3 inline-flex items-center justify-center shrink-0';
  const pill = 'px-1.5 py-0.5 rounded-md text-xs tabular-nums leading-none';

  return (
    <div className="py-1">
      <div className="flex items-center gap-1.5 text-sm">
        <button
          type="button"
          onClick={onOpen}
          className="min-h-[44px] min-w-[44px] -my-3 text-left font-medium"
          aria-label={`${zone.name} level ${displayValue.toFixed(1)}. Open ${zone.name} workout progression`}
        >
          {zone.name}
        </button>
        {recentChange && recentChange.change !== 0 && (
          <button
            type="button"
            onClick={() => toast(
              recentChange.trickle
                ? `Trickle from a nearby zone's workout on ${recentChange.date}.`
                : `Level changed on ${recentChange.date}.`
            )}
            className={badgeBox}
            aria-label={`Recent change ${formatChange(recentChange.change)}`}
          >
            <span className={`${pill} ${
              recentChange.change > 0
                ? recentChange.trickle
                  ? 'bg-green-900/30 text-green-500'
                  : 'bg-green-900/50 text-green-400'
                : 'bg-red-900/50 text-red-400'
            }`}>
              {recentChange.trickle ? '~' : ''}{formatChange(recentChange.change)}
            </span>
          </button>
        )}
        {isDecayed && daysIdle !== null && (
          <button
            type="button"
            onClick={() => toast(`Decayed: ${daysIdle} day${daysIdle === 1 ? '' : 's'} without training this zone.`)}
            className={badgeBox}
            aria-label={`${daysIdle} days idle`}
          >
            <span className={`${pill} bg-gray-700 text-gray-400`}>↓ {daysIdle}d</span>
          </button>
        )}
        <span className="ml-auto text-gray-400 tabular-nums shrink-0">{zoneRangeLabel(zone.id, ftp)}</span>
      </div>
      <button
        type="button"
        onClick={onOpen}
        tabIndex={-1}
        aria-hidden="true"
        className="flex w-full items-center gap-3 min-h-[44px] -my-2.5"
      >
        <div className="flex-1 bg-gray-700 rounded-full h-3.5 overflow-hidden relative">
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
      </button>
    </div>
  );
}
