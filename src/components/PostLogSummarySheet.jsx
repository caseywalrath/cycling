import React from 'react';
import { getZoneName, getZoneColor } from '../lib/zones.js';
import { formatChange, getChangeDescription } from '../lib/format.js';
import { Sheet, Button } from './ui/index.js';

// The summary shown after logging a ride: level before → after, trickle bonuses, TSS/IF/RPE.
// Re-homed from the old Post-Log Summary modal to a Sheet in V2 Phase 3; content unchanged.
export default function PostLogSummarySheet({ workout, onClose }) {
  if (!workout) return null;
  const lastLoggedWorkout = workout;

  return (
    <Sheet
      open
      onClose={onClose}
      title={getZoneName(lastLoggedWorkout.zone)}
      closeLabel=""
      footer={<Button variant="primary" block onClick={onClose}>Continue</Button>}
    >
      <div className="text-center">
        <div className="text-4xl mb-2" aria-hidden="true">
          {lastLoggedWorkout.change > 0 ? '📈' : lastLoggedWorkout.change < 0 ? '📉' : '➡️'}
        </div>
        <p className="text-gray-400 text-base mb-4">
          {getChangeDescription(lastLoggedWorkout.change, lastLoggedWorkout.rpe, lastLoggedWorkout.workoutLevel, lastLoggedWorkout.previousLevel)}
        </p>

        {lastLoggedWorkout.previousLevel != null && lastLoggedWorkout.newLevel != null ? (
          <>
            {/* V2 Phase 7: the workout level this ride earned credit for */}
            {lastLoggedWorkout.workoutLevelSource && lastLoggedWorkout.workoutLevel != null && (
              <p className="text-sm text-gray-400 mb-3 tabular-nums">
                This workout: level {Number(lastLoggedWorkout.workoutLevel).toFixed(1)}
                {lastLoggedWorkout.workoutLevelSource === 'structure' ? ' (from your intervals)' : ' (set by you)'}
              </p>
            )}
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="text-right">
                <div className="text-2xl font-mono text-gray-400 tabular-nums">{lastLoggedWorkout.previousLevel.toFixed(1)}</div>
                <div className="text-xs text-gray-500">Before</div>
              </div>
              <div className="text-2xl" aria-hidden="true">→</div>
              <div className="text-left">
                <div className="text-2xl font-mono font-bold tabular-nums" style={{ color: getZoneColor(lastLoggedWorkout.zone) }}>
                  {lastLoggedWorkout.newLevel.toFixed(1)}
                </div>
                <div className="text-xs text-gray-500">After</div>
              </div>
            </div>

            <div
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-4 tabular-nums ${
                lastLoggedWorkout.change > 0
                  ? 'bg-green-900/50 text-green-400'
                  : lastLoggedWorkout.change < 0
                  ? 'bg-red-900/50 text-red-400'
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              {formatChange(lastLoggedWorkout.change)}
            </div>
          </>
        ) : (
          <div className="mb-4 text-gray-400 text-base">
            Recovery rides do not affect progression levels.
          </div>
        )}

        {/* Trickle effects from this workout */}
        {lastLoggedWorkout.trickleEffects && lastLoggedWorkout.trickleEffects.length > 0 && (
          <div className="mb-4 text-left bg-gray-700/30 rounded-xl p-3">
            <div className="text-sm text-gray-400 mb-1">Trickle bonus to adjacent zones:</div>
            {lastLoggedWorkout.trickleEffects.map(({ zone: adjZone, amount }) => (
              <div key={adjZone} className="text-sm text-green-500 flex justify-between gap-2 tabular-nums">
                <span>{getZoneName(adjZone)}</span>
                <span>~+{amount.toFixed(2)} (from {getZoneName(lastLoggedWorkout.zone)} workout)</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-sm bg-gray-700/50 rounded-xl p-3 tabular-nums">
          <div>
            <div className="text-gray-400">TSS</div>
            <div className="font-mono">{lastLoggedWorkout.tss}{lastLoggedWorkout.tssSource === 'hr' ? ' (HR)' : ''}</div>
          </div>
          <div>
            <div className="text-gray-400">IF</div>
            {/* V2 Phase 5: an HR-only ride has no IF (§5.2) — show a dash instead of crashing. */}
            <div className="font-mono">{lastLoggedWorkout.intensityFactor != null ? lastLoggedWorkout.intensityFactor.toFixed(2) : '—'}</div>
          </div>
          <div>
            <div className="text-gray-400">RPE</div>
            <div className="font-mono">{lastLoggedWorkout.rpe}/10</div>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
