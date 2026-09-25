import React from 'react';
import { ZONES, ZONE_EXPECTED_RPE, getZoneName } from '../lib/zones.js';
import { parseDuration } from '../lib/dates.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { Sheet, Button, useConfirm, useToast } from '../components/ui/index.js';

// Log Ride / Edit Ride, as a bottom sheet. Re-homed from the old Log Ride modal in V2 Phase 3
// with the same fields (Phase 4 redesigns it as "Log Ride v2"). The form state and every
// save rule live in AppDataContext; this sheet only renders the form and decides what to show:
//   - after a file import with a same-day match, a ConfirmSheet offers to attach the file to
//     that ride (this used to be a window.confirm);
//   - read errors show as a toast (used to be alert()).
const inputClass = 'w-full bg-gray-700 rounded-lg px-3 py-2 text-base min-h-[44px]';
const disabledInputClass = 'w-full bg-gray-800 text-gray-600 rounded-lg px-3 py-2 text-base min-h-[44px]';

export default function LogRideSheet({ open, onClose, onSaved, onAttached }) {
  const {
    formData, setFormData, editingRide, pendingFitDetail, setPendingFitDetail,
    saveRide, importRideFile, applyRideImport, attachRideFile, calculateTSS, currentFTP,
  } = useAppData();
  const confirm = useConfirm();
  const toast = useToast();

  if (!open) return null;

  const currentIF = formData.normalizedPower / currentFTP;
  const currentTSS = calculateTSS(formData.normalizedPower, parseDuration(formData.duration));

  // Pre-fills the form from a .FIT or .TCX file, or attaches it to a matching ride.
  const handleFitFileImport = async (event) => {
    const file = event.target.files[0];
    // Reset file input so the same file can be re-imported
    event.target.value = '';
    if (!file) return;
    try {
      const result = await importRideFile(file);
      const existing = result.existingMatch;
      if (existing) {
        const existingName = existing.name || existing.notes || 'Workout';
        const attach = await confirm({
          title: 'Attach to an existing ride?',
          message:
            `A ride on ${result.parsed.date} already exists (${existingName}, ${existing.duration} min).\n\n` +
            `Attach this file's power and heart-rate data to it instead of creating a new ride?`,
          confirmLabel: 'Attach to existing ride',
          cancelLabel: 'Save as a new ride',
        });
        if (attach) {
          const { rideId, detection } = attachRideFile(existing, result);
          onAttached(rideId, detection);
          return;
        }
        // "Save as a new ride" → fall through to the normal new-ride flow below
      }
      applyRideImport(result);
    } catch (err) {
      toast(err.message || 'Could not read this ride file.', { tone: 'error' });
    }
  };

  const handleSave = () => {
    const result = saveRide();
    onSaved(result);
  };

  const isOutdoor = formData.rideType === 'Outdoor';
  const isIndoor = formData.rideType === 'Indoor';

  return (
    <Sheet
      open
      onClose={onClose}
      title={editingRide ? 'Edit Workout' : 'Log Workout'}
      footer={
        <Button variant="primary" block onClick={handleSave}>
          {editingRide ? 'Update Workout' : 'Save Workout'}
        </Button>
      }
    >
      {/* FIT/TCX import — pre-fills Date/Duration/NP/Distance/Elevation/Ride Type below; Name/RPE stay manual */}
      <div className="mb-4">
        <label className="inline-flex items-center gap-2 min-h-[44px] bg-gray-700 hover:bg-gray-600 text-gray-100 text-base px-4 rounded-xl cursor-pointer transition">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
          </svg>
          Import FIT/TCX File
          <input type="file" accept=".fit,.FIT,.tcx,.TCX" onChange={handleFitFileImport} className="hidden" />
        </label>
        {pendingFitDetail && (
          <div className="mt-2 bg-gray-700 rounded-xl pl-3 flex items-start justify-between gap-2">
            <div className="text-sm py-2">
              {pendingFitDetail.detection ? (
                <>
                  <div className="text-yellow-400 font-mono">⚡ Detected: {pendingFitDetail.detection.label}</div>
                  <div className="text-gray-400 text-sm mt-0.5">
                    {getZoneName(pendingFitDetail.detection.category)} interval — will be saved with this ride.
                    Adjust the Zone below if the category looks wrong.
                  </div>
                </>
              ) : (
                <div className="text-gray-400 text-sm">
                  No structured intervals detected — power/HR chart will still be saved.
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPendingFitDetail(null)}
              className="text-gray-400 hover:text-white text-base min-h-[44px] min-w-[44px] flex-shrink-0"
              aria-label="Discard interval data"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Row 1: Ride Name | Date */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Ride Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={inputClass}
            placeholder="e.g., Morning Ride"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Date</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      {/* Row 2: Ride Type | Completed All Intervals */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Ride Type</label>
          <select
            value={formData.rideType}
            onChange={(e) => setFormData({ ...formData, rideType: e.target.value })}
            className={inputClass}
          >
            <option value="Indoor">Indoor</option>
            <option value="Outdoor">Outdoor</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className={`flex items-center gap-2 text-base min-h-[44px] ${isOutdoor ? 'text-gray-600' : ''}`}>
            <input
              type="checkbox"
              checked={isOutdoor ? false : formData.completed}
              onChange={(e) => setFormData({ ...formData, completed: e.target.checked })}
              className="rounded w-5 h-5"
              disabled={isOutdoor}
            />
            Completed all intervals
          </label>
        </div>
      </div>

      {/* Row 3: Primary Zone | Normalized Power */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className={`block text-sm mb-1 ${isOutdoor ? 'text-gray-600' : 'text-gray-400'}`}>Primary Zone</label>
          <select
            value={formData.zone}
            onChange={(e) => setFormData({
              ...formData,
              zone: e.target.value,
              workoutLevel: ZONE_EXPECTED_RPE[e.target.value]
            })}
            className={isOutdoor ? disabledInputClass : inputClass}
            disabled={isOutdoor}
          >
            {ZONES.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Normalized Power (W)</label>
          <input
            type="number"
            inputMode="numeric"
            value={formData.normalizedPower || ''}
            onChange={(e) => setFormData({ ...formData, normalizedPower: parseInt(e.target.value) || 0 })}
            className={inputClass}
            min="50"
            max="500"
          />
        </div>
      </div>

      {/* Row 4: Duration | Distance | Elevation */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Duration (min)</label>
          <input
            type="text"
            value={formData.duration || ''}
            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
            onBlur={(e) => setFormData({ ...formData, duration: parseDuration(e.target.value) || 0 })}
            placeholder="e.g. 71 or 1h11"
            className={inputClass}
          />
        </div>
        <div>
          <label className={`block text-sm mb-1 ${isIndoor ? 'text-gray-600' : 'text-gray-400'}`}>Distance (mi)</label>
          <input
            type="number"
            inputMode="decimal"
            value={isIndoor ? '' : (formData.distance || '')}
            onChange={(e) => setFormData({ ...formData, distance: parseFloat(e.target.value) || 0 })}
            className={isIndoor ? disabledInputClass : inputClass}
            min="0"
            step="0.1"
            max="200"
            disabled={isIndoor}
          />
        </div>
        <div>
          <label className={`block text-sm mb-1 ${isIndoor ? 'text-gray-600' : 'text-gray-400'}`}>Elevation (ft)</label>
          <input
            type="number"
            inputMode="numeric"
            value={isIndoor ? '' : (formData.elevation || '')}
            onChange={(e) => setFormData({ ...formData, elevation: parseInt(e.target.value) || 0 })}
            className={isIndoor ? disabledInputClass : inputClass}
            min="0"
            max="20000"
            disabled={isIndoor}
          />
        </div>
      </div>

      {/* Row 5: RPE Slider (Phase 4 replaces it with tap targets) */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-1">
          RPE: <span className="tabular-nums">{formData.rpe}</span> <span className="text-gray-500 text-xs">(Expected {formData.workoutLevel})</span>
        </label>
        <input
          type="range"
          min="1"
          max="10"
          value={formData.rpe}
          onChange={(e) => setFormData({ ...formData, rpe: parseInt(e.target.value) })}
          className="w-full h-11"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>Easy</span>
          <span>Hard</span>
        </div>
      </div>

      {/* Calculated values preview */}
      <div className="bg-gray-700 rounded-xl p-3 mb-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-400">Estimated TSS: </span>
          <span className="font-mono font-bold tabular-nums">{currentTSS}</span>
        </div>
        <div>
          <span className="text-gray-400">Intensity Factor: </span>
          <span className="font-mono font-bold tabular-nums">{currentIF.toFixed(2)}</span>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="How it felt, weather, etc..."
          className="w-full bg-gray-700 rounded-lg px-3 py-2 text-base h-20"
        />
      </div>
    </Sheet>
  );
}
