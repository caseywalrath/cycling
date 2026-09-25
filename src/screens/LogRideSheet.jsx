import React, { useEffect, useState } from 'react';
import { ZONES, ZONE_EXPECTED_RPE, getZoneColor, getZoneName } from '../lib/zones.js';
import { parseDuration } from '../lib/dates.js';
import { shortDayDate } from '../lib/format.js';
import { estimateLthr, hrTss } from '../lib/load.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { Sheet, Button, Chip, SegmentedControl, useToast } from '../components/ui/index.js';

// Log Ride v2 (V2 Plan §4.3). Two entry modes for a new ride — Import file (default) and
// Enter manually — chosen at the top; editing an existing ride always shows the full manual
// form (attaching a file to an already-logged ride is now done from the Ride page's "Attach
// ride file" action instead, with no date guessing). Save stays disabled until the ride is
// valid: duration > 0, NP > 0, and an indoor ride has a zone. No invented defaults.
const inputClass = 'w-full bg-gray-700 rounded-lg px-3 py-2 text-base min-h-[44px]';
const labelClass = 'block text-sm text-gray-400 mb-1';

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function LogRideSheet({ open, onClose, onSaved, onAttached }) {
  const {
    formData, setFormData, editingRide, pendingFitDetail, setPendingFitDetail,
    saveRide, importRideFile, applyRideImport, attachRideFile, calculateTSS, currentFTP,
    userProfile,
  } = useAppData();
  const toast = useToast();

  const [mode, setMode] = useState('import'); // 'import' | 'manual' — ignored while editing
  const [pendingImport, setPendingImport] = useState(null); // { parsed, detection, existingMatch }
  const [showNumbers, setShowNumbers] = useState(false);

  // Reset the sheet's own UI state (not the form — that's AppDataContext's job) each time it
  // opens, so a stale attach card or "Edit numbers" toggle never leaks into the next open.
  useEffect(() => {
    if (open) {
      setMode('import');
      setPendingImport(null);
      setShowNumbers(false);
    }
  }, [open]);

  if (!open) return null;

  const isEdit = !!editingRide;
  const isOutdoor = formData.rideType === 'Outdoor';
  const isIndoor = !isOutdoor;
  const duration = parseDuration(formData.duration);
  const normalizedPower = Number(formData.normalizedPower) || 0;
  // V2 Phase 5 §5.2: a file with heart rate but no power gets HR-based TSS instead, and no
  // NP/IF — Save must not require an NP the file doesn't have.
  const isHrOnlyImport = !!pendingFitDetail && pendingFitDetail.stream && pendingFitDetail.stream.power == null;
  const hrOnlyTss = isHrOnlyImport
    ? hrTss(duration, formData.hrStats?.avg ?? null, userProfile.restingHR, estimateLthr(userProfile))
    : null;
  const canSave = duration > 0
    && (isHrOnlyImport ? hrOnlyTss != null : normalizedPower > 0)
    && (isOutdoor || !!formData.zone);
  const currentIF = currentFTP ? normalizedPower / currentFTP : 0;
  const currentTSS = isHrOnlyImport ? hrOnlyTss : calculateTSS(normalizedPower, duration);

  const switchToManual = () => {
    setMode('manual');
    setPendingImport(null);
    setPendingFitDetail(null);
    setFormData(prev => ({ ...prev, duration: '', normalizedPower: '', zone: null, workoutLevel: null }));
  };

  const handleFileInput = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const result = await importRideFile(file);
      if (result.existingMatch) {
        setPendingImport(result);
      } else {
        applyRideImport(result);
        setShowNumbers(false);
      }
    } catch (err) {
      toast(err.message || 'Could not read this ride file.', { tone: 'error' });
    }
  };

  const handleAttach = () => {
    const { rideId, detection } = attachRideFile(pendingImport.existingMatch, pendingImport);
    setPendingImport(null);
    onAttached(rideId, detection);
  };

  const handleSaveAsNew = () => {
    applyRideImport(pendingImport);
    setPendingImport(null);
    setShowNumbers(false);
  };

  const handleSave = () => {
    if (!canSave) return;
    const result = saveRide();
    onSaved(result);
  };

  const setZone = (zoneId) => setFormData({ ...formData, zone: zoneId, workoutLevel: ZONE_EXPECTED_RPE[zoneId] });

  const importedSummary = !isEdit && mode === 'import' && pendingFitDetail && !pendingImport;
  const showManualFields = isEdit || mode === 'manual' || (importedSummary && showNumbers);

  return (
    <Sheet
      open
      onClose={onClose}
      title={isEdit ? 'Edit ride' : 'Log ride'}
      footer={
        <Button variant="primary" block disabled={!canSave} onClick={handleSave}>
          {isEdit ? 'Update ride' : 'Save ride'}
        </Button>
      }
    >
      {/* Mode selector — new rides only */}
      {!isEdit && (
        <SegmentedControl
          ariaLabel="Entry mode"
          className="mb-4"
          value={mode}
          onChange={(v) => (v === 'manual' ? switchToManual() : setMode(v))}
          options={[
            { value: 'import', label: 'Import file' },
            { value: 'manual', label: 'Enter manually' },
          ]}
        />
      )}

      {/* Import mode */}
      {!isEdit && mode === 'import' && (
        <div className="mb-4">
          {pendingImport ? (
            /* Inline "attach to existing ride?" card — replaces the old window.confirm. */
            <div className="bg-gray-700 rounded-xl p-3">
              <p className="text-base text-gray-200">
                You already logged <strong>{pendingImport.existingMatch.name || pendingImport.existingMatch.notes || 'a ride'}</strong> on{' '}
                {shortDayDate(pendingImport.existingMatch.date)} ({pendingImport.existingMatch.duration} min).
              </p>
              <div className="flex flex-col gap-2 mt-3">
                <Button variant="primary" block onClick={handleAttach}>Attach this file to it</Button>
                <Button variant="secondary" block onClick={handleSaveAsNew}>Save as a new ride</Button>
              </div>
            </div>
          ) : importedSummary ? (
            <div>
              <div className="bg-gray-700 rounded-xl p-3 text-sm space-y-1.5">
                <div className="flex justify-between"><span className="text-gray-400">Date</span><span className="tabular-nums">{shortDayDate(formData.date)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Type</span><span>{formData.rideType}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Duration</span><span className="tabular-nums">{formData.duration} min</span></div>
                {isOutdoor && (
                  <>
                    <div className="flex justify-between"><span className="text-gray-400">Distance</span><span className="tabular-nums">{formData.distance} mi</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Elevation</span><span className="tabular-nums">{formData.elevation} ft</span></div>
                  </>
                )}
                {isHrOnlyImport ? (
                  <>
                    {formData.hrStats?.avg != null && (
                      <div className="flex justify-between"><span className="text-gray-400">Avg heart rate</span><span className="tabular-nums">{formData.hrStats.avg} bpm</span></div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">TSS</span>
                      <span className="tabular-nums">{currentTSS != null ? `${currentTSS} (from heart rate)` : 'Add resting HR in Settings to estimate'}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between"><span className="text-gray-400">Normalized Power</span><span className="tabular-nums">{formData.normalizedPower}W</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Estimated TSS</span><span className="tabular-nums">{currentTSS}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Intensity Factor</span><span className="tabular-nums">{currentIF.toFixed(2)}</span></div>
                  </>
                )}
                {pendingFitDetail.detection ? (
                  <div className="flex justify-between pt-1.5 border-t border-gray-600">
                    <span className="text-gray-400">Detected</span>
                    <span className="font-mono text-yellow-400">{pendingFitDetail.detection.label}</span>
                  </div>
                ) : (
                  <div className="text-gray-400 pt-1.5 border-t border-gray-600">No structured intervals detected.</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowNumbers(v => !v)}
                className="min-h-[44px] mt-1 text-base text-blue-400 hover:text-blue-300"
              >
                {showNumbers ? 'Hide numbers' : 'Edit numbers'}
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 min-h-[56px] bg-gray-700 hover:bg-gray-600 text-gray-100 text-base font-medium rounded-xl cursor-pointer transition">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
              </svg>
              Import ride file (.fit or .tcx)
              <input type="file" accept=".fit,.FIT,.tcx,.TCX" onChange={handleFileInput} className="hidden" />
            </label>
          )}
        </div>
      )}

      {/* Manual numeric fields — manual mode, edit mode, or "Edit numbers" on an import */}
      {showManualFields && !pendingImport && (
        <div className="mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="ride-date">Date</label>
              <input id="ride-date" type="date" value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="ride-type">Ride type</label>
              <select id="ride-type" value={formData.rideType}
                onChange={(e) => setFormData({ ...formData, rideType: e.target.value })} className={inputClass}>
                <option value="Indoor">Indoor</option>
                <option value="Outdoor">Outdoor</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="ride-duration">Duration (min)</label>
              <input id="ride-duration" type="text" inputMode="numeric" value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                onBlur={(e) => setFormData({ ...formData, duration: e.target.value === '' ? '' : parseDuration(e.target.value) })}
                placeholder="e.g. 60 or 1h15" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="ride-np">Normalized Power (W)</label>
              <input id="ride-np" type="number" inputMode="numeric" value={formData.normalizedPower}
                onChange={(e) => setFormData({ ...formData, normalizedPower: e.target.value })}
                placeholder="e.g. 180" min="0" max="600" className={inputClass} />
            </div>
          </div>
          {isOutdoor && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="ride-distance">Distance (mi)</label>
                <input id="ride-distance" type="number" inputMode="decimal" value={formData.distance || ''}
                  onChange={(e) => setFormData({ ...formData, distance: parseFloat(e.target.value) || 0 })}
                  min="0" step="0.1" max="300" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="ride-elevation">Elevation (ft)</label>
                <input id="ride-elevation" type="number" inputMode="numeric" value={formData.elevation || ''}
                  onChange={(e) => setFormData({ ...formData, elevation: parseInt(e.target.value) || 0 })}
                  min="0" max="30000" className={inputClass} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fields common to both modes */}
      {!pendingImport && (
        <div className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="ride-name">Ride name</label>
            <input id="ride-name" type="text" value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={isOutdoor ? 'Outdoor ride' : 'Indoor ride'} className={inputClass} />
          </div>

          {isIndoor && (
            <div>
              <label className={labelClass}>Zone</label>
              <div className="flex flex-wrap gap-2">
                {ZONES.map((zone) => (
                  <Chip key={zone.id} selected={formData.zone === zone.id} color={getZoneColor(zone.id)} onClick={() => setZone(zone.id)}>
                    {zone.name}
                  </Chip>
                ))}
              </div>
              {pendingFitDetail?.detection && formData.zone !== pendingFitDetail.detection.category && (
                <p className="text-xs text-gray-500 mt-1">Detected as {getZoneName(pendingFitDetail.detection.category)}.</p>
              )}
            </div>
          )}

          {isIndoor && (
            <label className="flex items-center gap-2 text-base min-h-[44px]">
              <input type="checkbox" checked={formData.completed}
                onChange={(e) => setFormData({ ...formData, completed: e.target.checked })}
                className="rounded w-5 h-5" />
              Completed all intervals
            </label>
          )}

          <div>
            <label className={labelClass}>
              Effort (RPE): <span className="tabular-nums text-gray-300">{formData.rpe}</span>
            </label>
            <div className="grid grid-cols-5 gap-2" role="group" aria-label="Rate of perceived exertion">
              {RPE_VALUES.map((v) => {
                const expected = isIndoor && formData.zone && ZONE_EXPECTED_RPE[formData.zone] === v;
                const selected = formData.rpe === v;
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFormData({ ...formData, rpe: v })}
                    className={`min-h-[44px] rounded-lg text-base font-semibold tabular-nums border-2 transition-colors ${
                      selected ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-700 border-transparent text-gray-200 hover:bg-gray-600'
                    } ${expected && !selected ? 'ring-2 ring-blue-400' : ''}`}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Easy</span>
              <span>Hard</span>
            </div>
          </div>

          {/* Calculated values preview (manual mode; the import summary already shows these) */}
          {!importedSummary && (
            <div className="bg-gray-700 rounded-xl p-3 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Estimated TSS: </span>
                <span className="font-mono font-bold tabular-nums">{currentTSS}</span>
              </div>
              <div>
                <span className="text-gray-400">Intensity Factor: </span>
                <span className="font-mono font-bold tabular-nums">{currentIF.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div>
            <label className={labelClass} htmlFor="ride-notes">Notes (optional)</label>
            <textarea id="ride-notes" value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="How it felt, weather, etc..." className="w-full bg-gray-700 rounded-lg px-3 py-2 text-base h-20" />
          </div>
        </div>
      )}
    </Sheet>
  );
}
