import React, { useEffect, useState } from 'react';
import { useAppData } from '../state/AppDataContext.jsx';
import { navigate } from '../state/useHashRoute.js';
import { Screen, Card, SectionHeader, Button, useConfirm, useToast } from '../components/ui/index.js';

// Settings tab (V2 Phase 3). The old Profile and Event modals as inline forms with Save
// buttons, plus Sync, Import/Export and Reset Levels (were header buttons and bottom links).
// Re-homed without redesign; Phase 4 rebuilds this tab (zone table, LTHR, auto-sync, About).
// #/settings/profile, #/settings/event and #/settings/data scroll to that section;
// #/settings/profile?ftp=240 (from the Today eFTP alert) pre-fills the FTP box.
const inputClass = 'w-full bg-gray-700 rounded-lg px-3 py-2 text-base min-h-[44px]';
const labelClass = 'block text-sm text-gray-400 mb-1';

const formatSyncTime = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export default function SettingsScreen({ route }) {
  const {
    currentFTP, userProfile, event, history, lastSyncedAt, isDriveSyncing, driveSyncStatus,
    saveProfile, saveEvent, deleteEvent, resetLevels, exportData, readBackupFile, restoreBackup, syncWithDrive,
  } = useAppData();
  const confirm = useConfirm();
  const toast = useToast();

  // ---- Profile form (draft; committed on Save) ----
  const [ftpInputValue, setFtpInputValue] = useState(String(currentFTP));
  const [ftpInputError, setFtpInputError] = useState('');
  const [profileDraft, setProfileDraft] = useState(userProfile);
  useEffect(() => { setFtpInputValue(String(currentFTP)); setFtpInputError(''); }, [currentFTP]);
  useEffect(() => { setProfileDraft(userProfile); }, [userProfile]);

  // Pre-fill from the Today tab's eFTP alert ("Update FTP"), then drop the query.
  useEffect(() => {
    if (route.query.ftp) {
      setFtpInputValue(route.query.ftp);
      setFtpInputError('');
      navigate('#/settings/profile', { replace: true });
    }
  }, [route.query.ftp]);

  // ---- Event form ----
  const [eventFormData, setEventFormData] = useState(event);
  useEffect(() => { setEventFormData(event); }, [event]);

  // Scroll to a section when the route names one.
  useEffect(() => {
    if (!route.section) return;
    const el = document.getElementById(`settings-${route.section}`);
    if (el) el.scrollIntoView({ block: 'start' });
  }, [route.section]);

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
    saveProfile({ ftp: parsedFTP, profile: profileDraft, resetLevels: reset });
    toast(reset ? 'Profile saved. Levels reset to 1.0.' : 'Profile saved', { tone: 'success' });
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

  const setProfileField = (field, value) => setProfileDraft({ ...profileDraft, [field]: value });

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
        <SectionHeader title="Sync & backup" />
        <div className="space-y-3">
          <div>
            <Button variant="secondary" block onClick={handleSync} disabled={isDriveSyncing}>
              {isDriveSyncing ? 'Syncing...' : 'Sync with Google Drive'}
            </Button>
            <p className={`text-sm mt-2 ${driveSyncStatus?.status === 'error' ? 'text-red-400' : driveSyncStatus ? 'text-green-400' : 'text-gray-500'}`} role="status">
              {driveSyncStatus
                ? driveSyncStatus.message
                : lastSyncedAt ? `Last synced ${formatSyncTime(lastSyncedAt)}` : 'Not synced yet on this device'}
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

      {/* Reset */}
      <Card>
        <SectionHeader title="Progression levels" subtitle="Start every zone again from 1.0. Your rides are kept." />
        <Button variant="ghost-destructive" block onClick={handleResetLevels}>Reset progression levels</Button>
      </Card>
    </Screen>
  );
}
