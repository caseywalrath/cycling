import React, { useEffect, useState } from 'react';
import packageJson from '../../package.json';
import { ZONES, zoneRangeLabel } from '../lib/zones.js';
import { toLocalDateStr } from '../lib/dates.js';
import { FTP_HISTORY_START, cleanFtpHistory } from '../lib/ftpHistory.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { navigate } from '../state/useHashRoute.js';
import { Screen, Card, SectionHeader, Button, useConfirm, useToast } from '../components/ui/index.js';

// Settings tab (V2 Phase 4 rebuild). Profile (with a live zone-watt table and LTHR), Event,
// Sync & backup (auto-sync status + manual Sync/Export/Restore), Old imported rides,
// Progression levels (V2 Phase 7: recalculate from rides with preview + Undo, or reset), and About.
const inputClass = 'w-full bg-gray-700 rounded-lg px-3 py-2 text-base min-h-[44px]';
const labelClass = 'block text-sm text-gray-400 mb-1';
// The same box without w-full, for rows that set their own width (a w-* class next to w-full is a coin flip).
const rowInputClass = inputClass.replace('w-full ', '');

const formatSyncTime = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export default function SettingsScreen({ route }) {
  const {
    currentFTP, ftpHistory, userProfile, event, history, lastSyncedAt, isDriveSyncing, driveSyncStatus,
    hasUnsyncedChanges, saveProfile, saveEvent, deleteEvent, resetLevels, exportData,
    readBackupFile, restoreBackup, syncWithDrive, oldImportedRideCount, hideOldImportedRides, showOldImportedRides,
    previewRecalculation, applyRecalculation, undoRecalculation, recalcUndoAvailable,
    saveFtpHistory, previewRescore, applyRescore, undoRescore, rescoreUndoAvailable,
  } = useAppData();
  const confirm = useConfirm();
  const toast = useToast();

  // ---- Profile form (draft; committed on Save) ----
  const [ftpInputValue, setFtpInputValue] = useState(String(currentFTP));
  const [ftpInputError, setFtpInputError] = useState('');
  const [profileDraft, setProfileDraft] = useState(userProfile);
  useEffect(() => { setFtpInputValue(String(currentFTP)); setFtpInputError(''); }, [currentFTP]);
  useEffect(() => { setProfileDraft(userProfile); }, [userProfile]);

  // Session 27: the day a changed FTP took effect (defaults to today), and the FTP-history card's draft rows.
  const todayStr = toLocalDateStr(new Date());
  const [ftpEffectiveFrom, setFtpEffectiveFrom] = useState(todayStr);
  const toFtpDraft = (list) => list.map(e => ({ date: e.date, ftp: String(e.ftp) }));
  const [ftpDraft, setFtpDraft] = useState(() => toFtpDraft(ftpHistory));
  const [ftpHistoryError, setFtpHistoryError] = useState('');
  useEffect(() => { setFtpDraft(toFtpDraft(ftpHistory)); setFtpHistoryError(''); }, [ftpHistory]);

  // Pre-fill from the Today tab's eFTP alert ("Update FTP"), then drop the query.
  useEffect(() => {
    if (route.query.ftp) {
      setFtpInputValue(route.query.ftp);
      setFtpInputError('');
      navigate('#/settings/profile', { replace: true });
    }
  }, [route.query.ftp]);

  // Pre-fill from the Today tab's max-HR alert ("Update profile"), same pattern as eFTP.
  useEffect(() => {
    if (route.query.maxhr) {
      setProfileDraft((prev) => ({ ...prev, maxHR: parseInt(route.query.maxhr, 10) }));
      navigate('#/settings/profile', { replace: true });
    }
  }, [route.query.maxhr]);

  // ---- Event form ----
  const [eventFormData, setEventFormData] = useState(event);
  useEffect(() => { setEventFormData(event); }, [event]);

  // Scroll to a section when the route names one.
  useEffect(() => {
    if (!route.section) return;
    const el = document.getElementById(`settings-${route.section}`);
    if (el) el.scrollIntoView({ block: 'start' });
  }, [route.section]);

  // The FTP box previews the zone table live as the user types, before Save.
  const previewFTP = (() => {
    const n = parseInt(ftpInputValue, 10);
    return Number.isFinite(n) && n >= 100 && n <= 500 ? n : currentFTP;
  })();

  const handleSaveProfile = async () => {
    // v2 Phase 2: validate the typed FTP (100-500). An empty or out-of-range box keeps the
    // previous FTP and shows an inline error.
    const parsedFTP = parseInt(ftpInputValue, 10);
    if (!Number.isFinite(parsedFTP) || parsedFTP < 100 || parsedFTP > 500) {
      setFtpInputError('Enter an FTP between 100 and 500 watts.');
      return;
    }
    let reset = false;
    if (parsedFTP !== currentFTP) {
      reset = await confirm({
        title: 'Reset progression levels?',
        message:
          `Your FTP changed from ${currentFTP}W to ${parsedFTP}W.\n\n` +
          `Would you like to reset your progression levels to 1.0?\n\n` +
          `This is recommended when your FTP changes significantly.`,
        confirmLabel: 'Reset levels to 1.0',
        cancelLabel: 'Keep my levels',
        destructive: true,
      });
    }
    saveProfile({ ftp: parsedFTP, profile: profileDraft, resetLevels: reset, effectiveFrom: ftpEffectiveFrom });
    setFtpEffectiveFrom(todayStr);
    toast(reset ? 'Profile saved. Levels reset to 1.0.' : 'Profile saved', { tone: 'success' });
  };

  // ---- FTP history (Session 27) ----
  const setDraftRow = (i, field, value) => setFtpDraft(rows => rows.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
  const addDraftRow = () => setFtpDraft(rows => [...rows, { date: todayStr, ftp: String(currentFTP) }]);
  const removeDraftRow = (i) => setFtpDraft(rows => rows.filter((_, j) => j !== i));

  // The rows as a cleaned list, or an error message for the first bad row.
  const validateFtpDraft = () => {
    for (const r of ftpDraft) {
      const n = parseInt(r.ftp, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date || '')) return { error: 'Every row needs a date.' };
      if (r.date > todayStr) return { error: 'An FTP change can\'t start in the future.' };
      if (!Number.isFinite(n) || n < 100 || n > 500) return { error: 'Every FTP must be between 100 and 500 watts.' };
    }
    const dates = ftpDraft.map(r => r.date);
    if (new Set(dates).size !== dates.length) return { error: 'Two rows have the same date.' };
    return { list: cleanFtpHistory(ftpDraft.map(r => ({ date: r.date, ftp: parseInt(r.ftp, 10) }))) };
  };

  const draftLatestFtp = (() => {
    const { list } = validateFtpDraft();
    return list && list.length > 0 ? list[list.length - 1].ftp : null;
  })();

  const handleSaveFtpHistory = () => {
    const { list, error } = validateFtpDraft();
    if (error) { setFtpHistoryError(error); return; }
    setFtpHistoryError('');
    saveFtpHistory(list);
    toast(list.length === 0 ? 'FTP history cleared. Rides use your current FTP.' : 'FTP history saved', { tone: 'success' });
  };

  // Re-score stored TSS and IF from the FTP on each ride's day. Shows what Fitness/Fatigue/Form do
  // first; nothing changes unless confirmed, and it can be undone.
  const handleRescore = async () => {
    const preview = previewRescore();
    if (preview.changed === 0) {
      toast('Your rides already match your FTP history.');
      return;
    }
    const rows = [['Fitness (CTL)', 'ctl'], ['Fatigue (ATL)', 'atl'], ['Form (TSB)', 'tsb']];
    const signed = (n) => `${n > 0 ? '+' : ''}${n}`;
    const ok = await confirm({
      title: 'Re-score your rides?',
      message: (
        <div data-rescore-preview>
          <p className="mb-3">
            Recalculates TSS and IF for {preview.changed} ride{preview.changed === 1 ? '' : 's'} using the FTP you had on each ride's day. Rides from before your first FTP entry aren't touched.
          </p>
          <table className="w-full text-base tabular-nums">
            <thead>
              <tr className="text-sm text-gray-500">
                <th className="text-left font-normal pb-1">Today's</th>
                <th className="text-right font-normal pb-1">Now</th>
                <th className="text-right font-normal pb-1">After</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, key]) => (
                <tr key={key} data-rescore-row={key}>
                  <td className="py-0.5">{label}</td>
                  <td className="py-0.5 text-right text-gray-400" data-before>{key === 'tsb' ? signed(preview.before[key]) : preview.before[key]}</td>
                  <td className="py-0.5 text-right font-semibold text-gray-100" data-after>{key === 'tsb' ? signed(preview.after[key]) : preview.after[key]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm text-gray-500">Levels, zones and intervals aren't changed. You can undo this.</p>
        </div>
      ),
      confirmLabel: 'Re-score rides',
    });
    if (ok) {
      applyRescore(preview);
      toast(`✓ Re-scored ${preview.changed} ride${preview.changed === 1 ? '' : 's'}`, { tone: 'success' });
    }
  };

  const handleUndoRescore = () => {
    if (undoRescore()) toast('Ride scores restored to what they were before re-scoring.');
    else toast('Nothing to undo on this device.', { tone: 'error' });
  };

  const handleSaveEvent = () => {
    saveEvent(eventFormData);
    toast('Event saved', { tone: 'success' });
  };

  const handleDeleteEvent = async () => {
    const ok = await confirm({
      title: 'Delete this event?',
      message: `${event.name}${event.date ? ` (${event.date})` : ''} will be removed. Your rides are not affected.`,
      confirmLabel: 'Delete event',
      destructive: true,
    });
    if (ok) {
      deleteEvent();
      toast('Event deleted');
    }
  };

  const handleSync = async () => {
    const result = await syncWithDrive();
    if (result?.status === 'error') toast(result.message, { tone: 'error' });
    else if (result?.message) toast(result.message, { tone: 'success' });
  };

  const handleExport = () => {
    const filename = exportData();
    toast(`Backup saved: ${filename}`, { tone: 'success' });
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let parsed;
    try {
      parsed = await readBackupFile(file);
    } catch (err) {
      toast(err.message, { tone: 'error' });
      return;
    }
    const count = parsed.history?.length || 0;
    const fileDate = parsed.exportedAt ? formatSyncTime(parsed.exportedAt) : null;
    const ok = await confirm({
      title: 'Restore this backup?',
      message:
        `This replaces all rides on this device (${history.length}) with ${count} ride${count === 1 ? '' : 's'} ` +
        `from the backup${fileDate ? ` saved ${fileDate}` : ''}.`,
      confirmLabel: 'Restore backup',
      destructive: true,
    });
    if (!ok) return;
    const restored = restoreBackup(parsed);
    toast(`✓ Data imported successfully! ${restored} workouts restored.`, { tone: 'success' });
  };

  const handleResetLevels = async () => {
    const ok = await confirm({
      title: 'Reset all progression levels to 1.0?',
      message: 'This will NOT delete your workout history.\n\nThis action cannot be undone.',
      confirmLabel: 'Reset levels',
      destructive: true,
    });
    if (ok) {
      resetLevels();
      toast('✓ All progression levels reset to 1.0');
    }
  };

  // V2 Phase 7 §7.4: replay every classified indoor ride through the new model. The preview
  // (before → after per zone) is shown in the ConfirmSheet; nothing changes unless confirmed.
  const handleRecalculate = async () => {
    const preview = previewRecalculation();
    const total = preview.scored + preview.typical + preview.manual;
    if (total === 0) {
      toast('No classified indoor rides to recalculate from yet.');
      return;
    }
    const zones = ZONES.filter(z => z.id !== 'recovery');
    const ok = await confirm({
      title: 'Recalculate levels from your rides?',
      message: (
        <div data-recalc-preview>
          <p className="mb-3">
            Replays your {total} indoor ride{total === 1 ? '' : 's'} with a zone, oldest first, through the new level model.
            {preview.typical > 0 && ` ${preview.typical} older ride${preview.typical === 1 ? ' has' : 's have'} no interval data, so ${preview.typical === 1 ? 'it counts' : 'they count'} as a typical session (level 5).`}
          </p>
          <table className="w-full text-base tabular-nums">
            <thead>
              <tr className="text-sm text-gray-500">
                <th className="text-left font-normal pb-1">Zone</th>
                <th className="text-right font-normal pb-1">Now</th>
                <th className="text-right font-normal pb-1">After</th>
              </tr>
            </thead>
            <tbody>
              {zones.map(z => (
                <tr key={z.id} data-recalc-zone={z.id}>
                  <td className="py-0.5" style={{ color: z.color }}>{z.name}</td>
                  <td className="py-0.5 text-right text-gray-400" data-before>{(preview.before[z.id] ?? 1).toFixed(1)}</td>
                  <td className="py-0.5 text-right font-semibold text-gray-100" data-after>{(preview.after[z.id] ?? 1).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm text-gray-500">Your rides aren't changed. You can undo this until you log your next ride.</p>
        </div>
      ),
      confirmLabel: 'Use these levels',
    });
    if (ok) {
      applyRecalculation(preview);
      toast('✓ Levels recalculated from your rides');
    }
  };

  const handleUndoRecalc = () => {
    if (undoRecalculation()) toast('Levels restored to what they were before recalculating.');
    else toast('Nothing to undo on this device.', { tone: 'error' });
  };

  const oldCount = oldImportedRideCount();
  const historicalCount = history.filter(w => w.historical).length;

  const handleHideOld = async () => {
    const ok = await confirm({
      title: `Stop asking about ${oldCount} old imported ride${oldCount === 1 ? '' : 's'}?`,
      message: 'They\'ll no longer show up in "Needs a zone" or the Today alert. Nothing is deleted, and you can show them again any time.',
      confirmLabel: 'Stop asking',
    });
    if (ok) {
      hideOldImportedRides();
      toast('Old imported rides hidden from "Needs a zone".');
    }
  };

  const handleShowOld = () => {
    showOldImportedRides();
    toast('Old imported rides will show up again.');
  };

  const setProfileField = (field, value) => setProfileDraft({ ...profileDraft, [field]: value });

  const syncStatusLine = driveSyncStatus
    ? driveSyncStatus.message
    : hasUnsyncedChanges
      ? 'Unsynced changes'
      : lastSyncedAt ? `Last synced ${formatSyncTime(lastSyncedAt)}` : 'Not synced yet on this device';
  const syncStatusTone = driveSyncStatus?.status === 'error' ? 'text-red-400' : driveSyncStatus ? 'text-green-400' : hasUnsyncedChanges ? 'text-yellow-400' : 'text-gray-500';

  return (
    <Screen title="Settings">
      {/* Profile */}
      <Card id="settings-profile" className="scroll-mt-4">
        <SectionHeader title="Profile" />
        <div className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="profile-ftp">FTP (watts)</label>
            <input
              id="profile-ftp"
              type="number"
              inputMode="numeric"
              value={ftpInputValue}
              onChange={(e) => { setFtpInputValue(e.target.value); setFtpInputError(''); }}
              className={inputClass}
              placeholder="235"
              min="100"
              max="500"
            />
            {ftpInputError && (
              <p className="text-sm text-red-400 mt-1">{ftpInputError}</p>
            )}
          </div>

          {(() => {
            const typed = parseInt(ftpInputValue, 10);
            const changing = Number.isFinite(typed) && typed >= 100 && typed <= 500 && typed !== currentFTP;
            if (!changing) return null;
            const latest = ftpHistory.length > 0 ? ftpHistory[ftpHistory.length - 1].date : null;
            return (
              <div data-ftp-effective>
                <label className={labelClass} htmlFor="profile-ftp-from">New FTP applies from</label>
                <input
                  id="profile-ftp-from"
                  type="date"
                  value={ftpEffectiveFrom}
                  onChange={(e) => setFtpEffectiveFrom(e.target.value || todayStr)}
                  min={latest && latest !== FTP_HISTORY_START ? latest : undefined}
                  max={todayStr}
                  className={inputClass}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Rides before this date keep being measured against your old FTP ({currentFTP}W). Leave it on today if it changed today.
                </p>
              </div>
            );
          })()}

          {/* Live zone-watt table (V2 Phase 4), from zoneRangeLabel */}
          <div className="bg-gray-900/50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-2">Your training zones at {previewFTP}W</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm tabular-nums">
              {ZONES.map(zone => (
                <div key={zone.id} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: zone.color }} />
                  <span>{zoneRangeLabel(zone.id, previewFTP)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Edges follow TrainerDay's power levels. Sweet Spot (88–94%) is this app's own band, inside
              TrainerDay's Tempo (Z3) and Threshold (Z4).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="profile-maxhr">Max HR (bpm)</label>
              <input id="profile-maxhr" type="number" inputMode="numeric"
                value={profileDraft.maxHR || ''}
                onChange={(e) => setProfileField('maxHR', parseInt(e.target.value) || null)}
                className={inputClass} placeholder="185" min="100" max="220" />
            </div>
            <div>
              <label className={labelClass} htmlFor="profile-resthr">Resting HR (bpm)</label>
              <input id="profile-resthr" type="number" inputMode="numeric"
                value={profileDraft.restingHR || ''}
                onChange={(e) => setProfileField('restingHR', parseInt(e.target.value) || null)}
                className={inputClass} placeholder="55" min="30" max="100" />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="profile-lthr">Threshold HR / LTHR (bpm)</label>
            <input id="profile-lthr" type="number" inputMode="numeric"
              value={profileDraft.lthr || ''}
              onChange={(e) => setProfileField('lthr', parseInt(e.target.value) || null)}
              className={inputClass} placeholder="Leave blank to estimate from Max HR" min="100" max="220" />
            <p className="text-xs text-gray-500 mt-1">Leave blank to estimate from Max HR.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="profile-weight">Weight (lbs)</label>
              <input id="profile-weight" type="number" inputMode="decimal"
                value={profileDraft.weight || ''}
                onChange={(e) => setProfileField('weight', parseFloat(e.target.value) || null)}
                className={inputClass} placeholder="154" min="90" max="330" step="0.1" />
            </div>
            <div>
              <label className={labelClass} htmlFor="profile-age">Age</label>
              <input id="profile-age" type="number" inputMode="numeric"
                value={profileDraft.age || ''}
                onChange={(e) => setProfileField('age', parseInt(e.target.value) || null)}
                className={inputClass} placeholder="40" min="18" max="90" />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="profile-sex">Sex</label>
            <select id="profile-sex" value={profileDraft.sex}
              onChange={(e) => setProfileField('sex', e.target.value)}
              className={inputClass}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <Button variant="primary" block onClick={handleSaveProfile}>Save profile</Button>
        </div>
      </Card>

      {/* FTP history (Session 27) */}
      <Card id="settings-ftp-history" className="scroll-mt-4">
        <SectionHeader title="FTP history" subtitle="So each ride is measured against the FTP you had that day" />
        <div className="space-y-3" data-ftp-history>
          {ftpDraft.length === 0 ? (
            <p className="text-sm text-gray-400">
              Nothing recorded, so every ride is measured against your current FTP ({currentFTP}W). Add each time your FTP changed, with the date it took effect.
            </p>
          ) : (
            <div className="space-y-2">
              {ftpDraft.map((row, i) => (
                <div key={i} className="bg-gray-900/50 rounded-xl p-2" data-ftp-row>
                  <div className="flex items-center gap-2">
                    {row.date === FTP_HISTORY_START ? (
                      <span className="flex-1 min-w-0 px-1 text-base text-gray-300">From the beginning</span>
                    ) : (
                      <input
                        type="date"
                        value={row.date}
                        max={todayStr}
                        onChange={(e) => setDraftRow(i, 'date', e.target.value)}
                        aria-label={`FTP change ${i + 1} date`}
                        className={`${rowInputClass} flex-1 min-w-0`}
                      />
                    )}
                    <input
                      type="number"
                      inputMode="numeric"
                      value={row.ftp}
                      min="100"
                      max="500"
                      onChange={(e) => setDraftRow(i, 'ftp', e.target.value)}
                      aria-label={`FTP change ${i + 1} watts`}
                      className={`${rowInputClass} w-24 shrink-0`}
                    />
                    <span className="text-sm text-gray-400 shrink-0">W</span>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="ghost-destructive" size="sm" onClick={() => removeDraftRow(i)} aria-label={`Remove FTP change ${i + 1}`}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {ftpHistoryError && <p className="text-sm text-red-400">{ftpHistoryError}</p>}
          {draftLatestFtp != null && draftLatestFtp !== currentFTP && (
            <p className="text-sm text-yellow-400">Saving makes your current FTP {draftLatestFtp}W (the latest row).</p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={addDraftRow}>Add a change</Button>
            <Button variant="primary" onClick={handleSaveFtpHistory}>Save FTP history</Button>
          </div>

          {ftpHistory.length > 0 && (
            <div className="pt-3 border-t border-gray-700">
              <p className="text-sm text-gray-400 mb-2">
                New rides are already scored with the FTP of their date. To fix the TSS and IF of rides you logged earlier, re-score them. This changes Fitness, Fatigue and Form, and you see how before anything changes.
              </p>
              <Button variant="secondary" block onClick={handleRescore}>Re-score my rides…</Button>
              {rescoreUndoAvailable && (
                <button type="button" onClick={handleUndoRescore} className="mt-2 text-sm text-blue-400 underline min-h-[44px]">Undo re-score</button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Event */}
      <Card id="settings-event" className="scroll-mt-4">
        <SectionHeader title="Event" subtitle="Your goal event and target fitness" />
        <div className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="event-name">Event Name</label>
            <input id="event-name" type="text" value={eventFormData.name}
              onChange={(e) => setEventFormData({ ...eventFormData, name: e.target.value })}
              className={inputClass} placeholder="My Target Event" />
          </div>
          <div>
            <label className={labelClass} htmlFor="event-date">Date</label>
            <input id="event-date" type="date" value={eventFormData.date}
              onChange={(e) => setEventFormData({ ...eventFormData, date: e.target.value })}
              className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="event-distance">Distance (miles)</label>
              <input id="event-distance" type="number" inputMode="numeric" value={eventFormData.distance}
                onChange={(e) => setEventFormData({ ...eventFormData, distance: parseInt(e.target.value) || 0 })}
                className={inputClass} min="0" step="1" />
            </div>
            <div>
              <label className={labelClass} htmlFor="event-ctl">Target Fitness (CTL)</label>
              <input id="event-ctl" type="number" inputMode="numeric" value={eventFormData.targetCTL}
                onChange={(e) => setEventFormData({ ...eventFormData, targetCTL: parseInt(e.target.value) || 0 })}
                className={inputClass} min="0" step="1" />
            </div>
          </div>
          <p className="text-sm text-gray-500 -mt-2">Recommended target: 80-100 for long endurance events</p>
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" onClick={handleSaveEvent}>Save event</Button>
            {event.name && (
              <Button variant="ghost-destructive" onClick={handleDeleteEvent}>Delete</Button>
            )}
          </div>
        </div>
      </Card>

      {/* Sync & backup */}
      <Card id="settings-data" className="scroll-mt-4">
        <SectionHeader title="Sync & backup" subtitle="Changes sync to Google Drive automatically while you're signed in" />
        <div className="space-y-3">
          <div>
            <Button variant="secondary" block onClick={handleSync} disabled={isDriveSyncing}>
              {isDriveSyncing ? 'Syncing...' : 'Sync with Google Drive'}
            </Button>
            <p className={`text-sm mt-2 ${syncStatusTone}`} role="status" data-sync-status>
              {syncStatusLine}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={handleExport}>Export backup</Button>
            <label className="inline-flex items-center justify-center min-h-[44px] rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-100 text-base font-medium px-4 cursor-pointer transition-colors">
              Import backup
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>
      </Card>

      {/* Old imported rides */}
      {(oldCount > 0 || historicalCount > 0) && (
        <Card>
          <SectionHeader title="Old imported rides" subtitle="Indoor rides from an old import that never got a zone" />
          {oldCount > 0 ? (
            <Button variant="secondary" block onClick={handleHideOld}>
              Stop asking about {oldCount} old imported ride{oldCount === 1 ? '' : 's'}
            </Button>
          ) : (
            <p className="text-sm text-gray-500">No more old imported rides waiting for a zone.</p>
          )}
          {historicalCount > 0 && (
            <button type="button" onClick={handleShowOld} className="min-h-[44px] mt-2 text-base text-blue-400 hover:text-blue-300">
              Show them again ({historicalCount})
            </button>
          )}
        </Card>
      )}

      {/* Reset */}
      <Card id="settings-progression" className="scroll-mt-4">
        <SectionHeader title="Progression levels" subtitle="Rebuild them from your rides, or start every zone again from 1.0. Your rides are kept either way." />
        <div className="flex flex-col gap-2">
          <Button variant="secondary" block onClick={handleRecalculate}>Recalculate levels from my rides</Button>
          {recalcUndoAvailable && (
            <button type="button" onClick={handleUndoRecalc} data-recalc-undo
              className="min-h-[44px] text-base text-blue-400 hover:text-blue-300">
              Undo recalculation
            </button>
          )}
          <Button variant="ghost-destructive" block onClick={handleResetLevels}>Reset progression levels</Button>
        </div>
      </Card>

      {/* About */}
      <Card>
        <SectionHeader title="About" />
        <p className="text-sm text-gray-400">Casey Rides v{packageJson.version}</p>
        <a
          href="https://github.com/caseywalrath/cycling/blob/main/CHANGELOG.md"
          target="_blank"
          rel="noreferrer"
          className="inline-block min-h-[44px] leading-[44px] text-base text-blue-400 hover:text-blue-300"
        >
          What's new (Changelog) →
        </a>
      </Card>
    </Screen>
  );
}
