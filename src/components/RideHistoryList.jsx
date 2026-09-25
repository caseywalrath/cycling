import React from 'react';
import { getZoneName } from '../lib/zones.js';
import { formatDateWithDay } from '../lib/dates.js';
import { formatChange } from '../lib/format.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { useShell } from '../state/ShellContext.js';
import { navigate } from '../state/useHashRoute.js';
import { Button, useConfirm, useToast } from './ui/index.js';

// Ride History list. Re-homed from the old Ride History modal to the Rides tab in V2 Phase 3.
// The card content is unchanged; the 📊 ✏️ 🗑️ icon buttons became a row of labelled 44px
// buttons (Chart / Edit / Delete), Edit opens the Log Ride sheet and Delete asks with a
// ConfirmSheet. Phase 4 replaces these cards with RideRow.
export default function RideHistoryList({ rides }) {
  const { eftpTimeline, deleteRide } = useAppData();
  const { openEditRide } = useShell();
  const confirm = useConfirm();
  const toast = useToast();

  const handleDelete = async (entry) => {
    const ok = await confirm({
      title: 'Delete this ride?',
      message:
        `${entry.name || entry.notes || 'Workout'}\n` +
        `Date: ${entry.date}\n` +
        `Zone: ${getZoneName(entry.zone)}\n` +
        `Duration: ${entry.duration} min\n` +
        `TSS: ${entry.tss}\n\n` +
        `This action cannot be undone.`,
      confirmLabel: 'Delete ride',
      destructive: true,
    });
    if (ok && deleteRide(entry.id)) toast('Ride deleted');
  };

  return (
    <div className="space-y-3">
      {rides.map((entry) => (
        <div key={entry.id} data-ride-card className="bg-gray-800 rounded-2xl p-3 text-sm">
          {/* Title row: Name - Indoor/Outdoor - Zone (if indoor) • Flags */}
          <div className="mb-2">
            <div className="font-medium text-base">
              {entry.name || entry.notes || 'Workout'} - {entry.rideType || 'Indoor'}{entry.rideType !== 'Outdoor' && entry.zone ? ` - ${getZoneName(entry.zone)}` : entry.rideType !== 'Outdoor' && !entry.zone ? ' - Unclassified' : ''}
              {entry.elevation > 2999 && (
                <span className="ml-2" title="Big Climb" aria-label="Big climb">🏔️</span>
              )}
              {entry.duration > 180 && (
                <span className="ml-2" title="Long Ride" aria-label="Long ride">🛣️</span>
              )}
            </div>
            <div className="text-gray-400 text-xs">{formatDateWithDay(entry.date)}</div>
            {entry.intervalData?.label && (
              <div className="text-yellow-400 text-xs font-mono mt-1">{entry.intervalData.label}</div>
            )}
          </div>

          {/* Stats grid with Distance and Elevation */}
          <div className="grid grid-cols-6 gap-2 text-xs mb-2 tabular-nums">
            <div>
              <span className="text-gray-400">Duration</span>
              <div className="font-mono">{entry.duration}min</div>
            </div>
            <div>
              <span className="text-gray-400">Distance</span>
              <div className="font-mono">{entry.distance > 0 ? `${entry.distance}mi` : '—'}</div>
            </div>
            <div>
              <span className="text-gray-400">Elevation</span>
              <div className="font-mono">{entry.elevation > 0 ? `${entry.elevation}ft` : '—'}</div>
            </div>
            <div>
              <span className="text-gray-400">NP</span>
              <div className="font-mono">{entry.normalizedPower}W</div>
            </div>
            <div>
              <span className="text-gray-400">TSS</span>
              <div className="font-mono">{entry.tss}</div>
            </div>
            <div>
              <span className="text-gray-400">IF</span>
              <div className="font-mono">{entry.intensityFactor?.toFixed(2)}</div>
            </div>
          </div>

          {/* Level changes and eFTP */}
          <div className="flex justify-between gap-2 text-xs tabular-nums">
            <span>
              {entry.workoutLevel != null ? `Level ${entry.workoutLevel}` : ''}
              {entry.rpe != null ? ` • RPE ${entry.rpe}` : ''}
              {eftpTimeline.byRideId[entry.id]?.rideEstimate ? (
                <span className="text-gray-400 ml-2">• FTP est. {eftpTimeline.byRideId[entry.id].rideEstimate}W</span>
              ) : entry.eFTP ? (
                <span className="text-gray-400 ml-2">• eFTP {entry.eFTP}W</span>
              ) : null}
              {!entry.zone && entry.rideType !== 'Outdoor' && <span className="text-yellow-400 ml-1">• Needs classification</span>}
            </span>
            {entry.previousLevel != null && entry.newLevel != null ? (
              <span className={`shrink-0 ${entry.change > 0 ? 'text-green-400' : entry.change < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {entry.previousLevel.toFixed(1)} → {entry.newLevel.toFixed(1)} ({formatChange(entry.change)})
              </span>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-2 -mb-1 border-t border-gray-700/60 pt-2">
            {(entry.stream || entry.intervalData) && (
              <Button variant="ghost" size="sm" onClick={() => navigate(`#/ride/${entry.id}`)} aria-label="View ride chart">
                Chart
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => openEditRide(entry.id)} aria-label="Edit ride">
              Edit
            </Button>
            <Button variant="ghost-destructive" size="sm" className="ml-auto" onClick={() => handleDelete(entry)} aria-label="Delete ride">
              Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
