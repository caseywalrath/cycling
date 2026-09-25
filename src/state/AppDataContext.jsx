import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import GoogleDriveSync from '../google-drive-sync.js';
import { ZONES, DEFAULT_LEVELS, ZONE_EXPECTED_RPE, ZONE_ADJACENCY } from '../lib/zones.js';
import { toLocalDateStr, parseDuration } from '../lib/dates.js';
import { parseFitFile, parseTcxFile, findMatchingRideForImport } from '../lib/rideFiles.js';
import { EFTP_PROMPT_KEY, buildEftpTimeline } from '../lib/eftp.js';
import { detectIntervals } from '../lib/intervals.js';
import { applyDecay, calculateNewLevel } from '../lib/progression.js';
import { calculateTSS as tssFor, calculateIF as ifFor, calculateTrainingLoads, getTrainingStatus } from '../lib/load.js';
import { buildAnalysisText } from '../lib/summary.js';

// All persisted app data and every action that changes it (V2 Phase 3).
//
// Moved out of the old single ProgressionTracker component. The load effect, save effect,
// markDataChanged() and the bodies of the data actions are the old code, moved verbatim.
// The only change is that actions no longer open modals or call alert()/confirm(): they
// return a result, and the screen that called them decides what to show (a Toast, a
// ConfirmSheet, a page).

export const STORAGE_KEY = 'cycling-progression-data-v2';
// V2 Phase 3: written to localStorage, Export files and the Drive backup. Files without it
// (every backup made before Phase 3) load exactly as before.
export const SCHEMA_VERSION = 2;
const FTP = 235;

// V2 Phase 4: no invented defaults for a fresh manual entry — duration, NP and zone start
// empty/unset, and the Log Ride sheet's Save button stays disabled until they're filled in.
// A file import overwrites duration/normalizedPower from the file, and pre-selects a zone
// for indoor rides when interval detection found one (unchanged from Phase 2/3).
export const getDefaultFormData = () => {
  return {
    name: '',
    date: toLocalDateStr(new Date()),
    zone: null,
    workoutLevel: null,
    rpe: 5,
    completed: true,
    duration: '',
    normalizedPower: '',
    rideType: 'Indoor',
    distance: 0,
    elevation: 0,
    notes: '',
  };
};

const AppDataContext = createContext(null);

export function useAppData() {
  const value = useContext(AppDataContext);
  if (!value) throw new Error('useAppData() must be used inside <AppDataProvider>');
  return value;
}

// A key that changes when the calendar day changes (checked when the app comes back to the
// foreground), so derived values that depend on "today" don't go stale overnight.
const useTodayKey = () => {
  const [key, setKey] = useState(() => toLocalDateStr(new Date()));
  useEffect(() => {
    const check = () => setKey(toLocalDateStr(new Date()));
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  return key;
};

export function AppDataProvider({ children }) {
  // ---------------- persisted state ----------------
  const [levels, setLevels] = useState(DEFAULT_LEVELS);
  const [displayLevels, setDisplayLevels] = useState(DEFAULT_LEVELS);
  const [history, setHistory] = useState([]);
  const [lastLoggedWorkout, setLastLoggedWorkout] = useState(null);
  const [recentChanges, setRecentChanges] = useState({});
  const [animatingZone, setAnimatingZone] = useState(null);
  // lastWorkedDates: { zoneId: 'YYYY-MM-DD' } — tracks when each zone was last directly trained
  const [lastWorkedDates, setLastWorkedDates] = useState({});
  const animationRef = useRef(null);
  const isInitialMount = useRef(true);

  // Power curve data (pass-through from old intervals.icu imports; read by Power Skills)
  const [powerCurveData, setPowerCurveData] = useState(null);

  const [currentFTP, setCurrentFTP] = useState(FTP);
  const [intervalsFTP, setIntervalsFTP] = useState(null); // pass-through from old intervals.icu imports

  // Google Drive sync state
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [driveSyncStatus, setDriveSyncStatus] = useState(null);
  const [exportedAt, setExportedAt] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  // Event/Goal management
  const [event, setEvent] = useState({
    name: 'Gran Fondo Utah',
    date: '2026-06-13',
    distance: 100, // miles
    targetCTL: 85,
  });

  // User profile
  const [userProfile, setUserProfile] = useState({
    maxHR: null,
    restingHR: null,
    lthr: null, // Threshold HR (bpm), optional — V2 Phase 4, used by Phase 5's heart-rate TSS
    weight: null, // lb
    age: null,
    sex: 'male', // 'male' or 'female'
  });

  // V2 Phase 4: true once a data change hasn't been auto-synced yet (no valid Google token at
  // the time the 3s debounce fired). Shown as a badge on the Settings tab.
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const autoSyncTimer = useRef(null);

  // VO2max estimates storage (pass-through from old intervals.icu imports)
  const [vo2maxEstimates, setVo2maxEstimates] = useState([]);

  // ---------------- Log Ride form + edit state ----------------
  const [formData, setFormData] = useState(getDefaultFormData());
  // State for editing rides
  const [editingRide, setEditingRide] = useState(null);
  // Interval tracking state (see INTERVAL_TRACKING_PLAN.md)
  const [pendingFitDetail, setPendingFitDetail] = useState(null); // { stream, detection } from FIT import, awaiting save

  // ---------------- derived ----------------
  const todayKey = useTodayKey();

  // Effective levels = base levels with decay applied (for display and new workout calculations)
  const effectiveLevels = useMemo(() => applyDecay(levels, lastWorkedDates), [levels, lastWorkedDates, todayKey]);

  // eFTP estimated from FIT power streams (see EFTP_ESTIMATE_PLAN.md).
  const eftpTimeline = useMemo(() => buildEftpTimeline(history, new Date()), [history, todayKey]);
  const currentEftp = eftpTimeline.current; // { value, peakRideName, peakRideDate } | null

  const loads = useMemo(() => calculateTrainingLoads(history), [history, todayKey]);
  const trainingStatus = useMemo(
    () => getTrainingStatus(loads.ctl, loads.atl, loads.tsb, loads.ctl14dAgo),
    [loads]
  );

  // ---------------- load / save ----------------
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const loadedLevels = parsed.levels || DEFAULT_LEVELS;
        setLevels(loadedLevels);
        setDisplayLevels(loadedLevels);
        // v2 Phase 2 migration: outdoor rides were sometimes saved with a detected zone
        // category leaking into intervalData (e.g. filed as VO2max). Outdoor rides don't
        // belong to a training zone (D5), so clear it once, here, on load.
        const loadedHistory = (parsed.history || []).map(w =>
          (w.rideType === 'Outdoor' && w.intervalData && w.intervalData.category != null)
            ? { ...w, intervalData: { ...w.intervalData, category: null } }
            : w
        );
        setHistory(loadedHistory);

        // Load FTP
        if (parsed.ftp) {
          setCurrentFTP(parsed.ftp);
        }
        if (parsed.intervalsFTP) {
          setIntervalsFTP(parsed.intervalsFTP);
        }

        // Load event if available
        if (parsed.event) {
          setEvent(parsed.event);
        }

        // Load user profile if available
        if (parsed.userProfile) {
          setUserProfile(parsed.userProfile);
        }

        // Load VO2max estimates if available
        if (parsed.vo2maxEstimates) {
          setVo2maxEstimates(parsed.vo2maxEstimates);
        }

        // Load power curve data if available
        if (parsed.powerCurveData) {
          setPowerCurveData(parsed.powerCurveData);
        }

        // Load sync timestamps if available
        if (parsed.exportedAt) {
          setExportedAt(parsed.exportedAt);
        }
        if (parsed.lastSyncedAt) {
          setLastSyncedAt(parsed.lastSyncedAt);
        }

        // Load lastWorkedDates for decay tracking
        if (parsed.lastWorkedDates) {
          setLastWorkedDates(parsed.lastWorkedDates);
        }

        // Calculate recent changes from history
        if (parsed.history && parsed.history.length > 0) {
          const changes = {};
          ZONES.forEach(zone => {
            const lastWorkout = parsed.history.find(w => w.zone === zone.id);
            if (lastWorkout && lastWorkout.change !== 0) {
              changes[zone.id] = {
                change: lastWorkout.change,
                date: lastWorkout.date,
              };
            }
          });
          setRecentChanges(changes);
        }

        // v2: remove saved intervals.icu credentials (feature removed)
        try {
          localStorage.removeItem('intervals-icu-config');
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      console.error('Failed to load saved data from localStorage:', e);
    }
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        levels,
        history,
        ftp: currentFTP,
        intervalsFTP,
        event,
        userProfile,
        vo2maxEstimates,
        powerCurveData,
        exportedAt,
        lastSyncedAt,
        lastWorkedDates,
      }));
    } catch (e) {
      console.error('Failed to save data to localStorage:', e);
      // Must stay a plain alert (V2 plan §4.6): it fires when the UI may be broken.
      alert('⚠️ Could not save your data — browser storage may be full. Please export a backup (Export Data) soon so nothing is lost.');
    }
  }, [levels, history, currentFTP, intervalsFTP, event, userProfile, vo2maxEstimates, powerCurveData, exportedAt, lastSyncedAt, lastWorkedDates]);

  // ---------------- Google Drive auto-sync (V2 Phase 4, D3) ----------------
  // After any data change, wait 3s so a burst of edits (e.g. typing in a form, or an import
  // followed by a save) triggers one sync, not one per change. Then, only if a Google
  // sign-in is still valid, push silently — this never opens a sign-in popup on its own.
  // Without a valid token, mark the change as unsynced; the Settings tab shows a badge and
  // its Sync button (a user tap) can start a new sign-in.
  const isAutoSyncInitialMount = useRef(true);
  useEffect(() => {
    if (isAutoSyncInitialMount.current) {
      isAutoSyncInitialMount.current = false;
      return undefined;
    }
    clearTimeout(autoSyncTimer.current);
    autoSyncTimer.current = setTimeout(() => {
      if (GoogleDriveSync.hasValidToken()) {
        // handleDriveSync() itself calls GoogleDriveSync.sync(), which calls authenticate()
        // internally — but since we've just confirmed a valid token is present, that call
        // resolves immediately from the cached token and never opens a popup.
        handleDriveSync().then((result) => {
          if (result?.status !== 'error') setHasUnsyncedChanges(false);
        });
      } else {
        setHasUnsyncedChanges(true);
      }
    }, 3000);
    return () => clearTimeout(autoSyncTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels, history, currentFTP, intervalsFTP, event, userProfile, vo2maxEstimates, powerCurveData, lastWorkedDates]);

  // ---------------- eFTP alert (replaces the old window.confirm prompt) ----------------
  // The highest eFTP value the user has already answered (device-local). The Today tab shows
  // the "raise your FTP?" alert only for a higher estimate; the value is stored when the
  // alert is dismissed or accepted, not when it's shown.
  const [eftpPromptedValue, setEftpPromptedValue] = useState(() => {
    try { return parseInt(localStorage.getItem(EFTP_PROMPT_KEY), 10) || 0; } catch { return 0; }
  });

  const resolveEftpAlert = (value) => {
    setEftpPromptedValue(value);
    try { localStorage.setItem(EFTP_PROMPT_KEY, String(value)); } catch { /* ignore */ }
  };

  // Mark data as changed (updates exportedAt timestamp for sync conflict resolution)
  const markDataChanged = () => {
    setExportedAt(new Date().toISOString());
  };

  const animateLevel = (zone, fromLevel, toLevel, duration = 800) => {
    setAnimatingZone(zone);
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);

      const currentLevel = fromLevel + (toLevel - fromLevel) * eased;

      setDisplayLevels(prev => ({
        ...prev,
        [zone]: currentLevel,
      }));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setAnimatingZone(null);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  const calculateTSS = (normalizedPower, durationMinutes) => tssFor(normalizedPower, durationMinutes, currentFTP);
  const calculateIF = (normalizedPower) => ifFor(normalizedPower, currentFTP);

  // ---------------- rides ----------------

  // Save the Log Ride form as a new ride, or as the edit of `editingRide`.
  // Logic moved verbatim from handleLogWorkout(). Returns { kind: 'new' | 'edit', entry }.
  const handleLogWorkout = () => {
    const isOutdoor = formData.rideType === 'Outdoor';
    const zone = isOutdoor ? null : formData.zone;
    const completed = isOutdoor ? true : formData.completed;
    const distance = isOutdoor ? formData.distance : 0;
    const elevation = isOutdoor ? formData.elevation : 0;
    const duration = parseDuration(formData.duration);
    // V2 Phase 4: normalizedPower can be a string while the user is typing in a manual-entry
    // field with no invented default; coerce once here for TSS/IF and the saved value.
    const normalizedPower = Number(formData.normalizedPower) || 0;
    const tss = calculateTSS(normalizedPower, duration);
    const intensityFactor = calculateIF(normalizedPower);
    // V2 Phase 4: "Name" defaults to "Indoor ride" / "Outdoor ride" when left blank.
    const name = formData.name || (isOutdoor ? 'Outdoor ride' : 'Indoor ride');

    if (editingRide) {
      // Editing existing workout
      const oldWorkout = history.find(w => w.id === editingRide);
      const wasUnclassified = oldWorkout.zone === null || oldWorkout.source === 'imported';
      const isNowClassified = zone !== null && zone !== 'recovery';

      // If user is classifying an imported ride (or re-classifying), calculate progression
      let previousLevel = oldWorkout.previousLevel;
      let newLevel = oldWorkout.newLevel;
      let change = oldWorkout.change;

      if (isNowClassified && (wasUnclassified || zone !== oldWorkout.zone)) {
        // Recalculate progression for the newly assigned zone using effective (decayed) level
        previousLevel = effectiveLevels[zone];
        newLevel = calculateNewLevel(previousLevel, formData.workoutLevel, formData.rpe, completed);
        change = newLevel - previousLevel;
      }

      const entry = {
        ...oldWorkout, // Preserve any extra fields like intervalsId
        ...formData,
        zone,
        completed,
        distance,
        elevation,
        duration,
        normalizedPower,
        name,
        id: editingRide,
        previousLevel,
        newLevel,
        change,
        tss,
        intensityFactor,
        source: 'manual', // Editing always marks as manually classified
        ...(pendingFitDetail ? {
          stream: pendingFitDetail.stream,
          intervalData: pendingFitDetail.detection
            ? { ...pendingFitDetail.detection, source: 'auto',
                category: isOutdoor ? null : (zone && zone !== 'recovery') ? zone : pendingFitDetail.detection.category }
            : null,
        } : {}),
      };

      // Update history with edited entry
      setHistory(history.map(w => w.id === editingRide ? entry : w));
      markDataChanged();
      setPendingFitDetail(null);

      // Update progression levels if zone was assigned/changed
      if (isNowClassified && (wasUnclassified || zone !== oldWorkout.zone)) {
        setLevels(prev => ({ ...prev, [zone]: newLevel }));
        setDisplayLevels(prev => ({ ...prev, [zone]: newLevel }));
        setRecentChanges(prev => ({
          ...prev,
          [zone]: { change, date: formData.date },
        }));
        // Update lastWorkedDates when zone is assigned/changed via edit
        setLastWorkedDates(prev => ({ ...prev, [zone]: formData.date }));
      }

      // Reset form
      setFormData(getDefaultFormData());
      setEditingRide(null);
      return { kind: 'edit', entry };
    } else {
      // Creating new workout
      // Recovery zone and outdoor rides do not affect progression levels
      const affectsProgression = zone !== null && zone !== 'recovery';
      // Use effectiveLevels (decay-adjusted) as the starting point for progression
      const currentLevel = affectsProgression ? effectiveLevels[zone] : null;
      const newLevel = affectsProgression
        ? calculateNewLevel(currentLevel, formData.workoutLevel, formData.rpe, completed)
        : null;
      const primaryChange = affectsProgression ? newLevel - currentLevel : 0;

      // Compute trickle effects for adjacent zones (only when primary change is positive)
      const trickleEffects = [];
      if (affectsProgression && primaryChange > 0 && ZONE_ADJACENCY[zone]) {
        ZONE_ADJACENCY[zone].forEach(({ zone: adjZone, factor }) => {
          // Don't trickle if adjacent zone is already at or above the primary zone's new level
          if (effectiveLevels[adjZone] >= newLevel) return;
          const trickleAmount = primaryChange * factor;
          trickleEffects.push({ zone: adjZone, amount: trickleAmount });
        });
      }

      const entry = {
        ...formData,
        zone,
        completed,
        distance,
        elevation,
        duration,
        normalizedPower,
        name,
        id: Date.now(),
        previousLevel: currentLevel,
        newLevel: newLevel,
        change: primaryChange,
        tss,
        intensityFactor,
        source: 'manual',
        trickleEffects, // Stored for post-log summary display
        ...(pendingFitDetail ? {
          stream: pendingFitDetail.stream,
          intervalData: pendingFitDetail.detection
            ? { ...pendingFitDetail.detection, source: 'auto',
                category: isOutdoor ? null : (zone && zone !== 'recovery') ? zone : pendingFitDetail.detection.category }
            : null,
        } : {}),
      };

      // Apply all level updates (primary + trickle) in a single setLevels call
      const updatedLevels = { ...levels };
      if (affectsProgression) {
        updatedLevels[zone] = newLevel;
      }
      trickleEffects.forEach(({ zone: adjZone, amount }) => {
        updatedLevels[adjZone] = Math.min(10, levels[adjZone] + amount);
      });

      // Update recent changes — primary zone + trickled zones
      if (affectsProgression) {
        const changesUpdate = {
          [zone]: { change: primaryChange, date: formData.date },
        };
        trickleEffects.forEach(({ zone: adjZone, amount }) => {
          changesUpdate[adjZone] = { change: amount, date: formData.date, trickle: true };
        });
        setRecentChanges(prev => ({ ...prev, ...changesUpdate }));
      }

      // Update lastWorkedDates for the primary zone only (trickle doesn't reset decay clock)
      if (affectsProgression) {
        setLastWorkedDates(prev => ({ ...prev, [zone]: formData.date }));
      }

      // Set last logged workout for summary sheet
      setLastLoggedWorkout(entry);

      // Update history and levels
      setHistory([entry, ...history]);
      setLevels(updatedLevels);
      markDataChanged();
      setPendingFitDetail(null);

      // Reset form
      setFormData(getDefaultFormData());
      setEditingRide(null);
      return { kind: 'new', entry };
    }
  };

  // Called when the post-log summary closes: animates the level bar (only for rides with progression).
  const closePostLogSummary = () => {
    if (lastLoggedWorkout && lastLoggedWorkout.previousLevel != null && lastLoggedWorkout.newLevel != null) {
      setTimeout(() => {
        animateLevel(
          lastLoggedWorkout.zone,
          lastLoggedWorkout.previousLevel,
          lastLoggedWorkout.newLevel
        );
      }, 100);
    }
  };

  // Fill the form from an existing ride and enter edit mode. Returns false if the ride is gone.
  const handleEditRide = (workoutId) => {
    const workout = history.find(w => w.id === workoutId);
    if (!workout) return false;

    // Populate form with workout data
    // For imported (unclassified) rides, default zone to 'endurance' so the user can select
    const editZone = workout.zone || 'endurance';
    setFormData({
      name: workout.name || workout.notes || '',
      date: workout.date,
      zone: editZone,
      workoutLevel: workout.workoutLevel || ZONE_EXPECTED_RPE[editZone],
      rpe: workout.rpe != null ? workout.rpe : 5,
      completed: workout.completed !== false,
      duration: workout.duration,
      normalizedPower: workout.normalizedPower,
      rideType: workout.rideType || 'Indoor',
      distance: workout.distance || 0,
      elevation: workout.elevation || 0,
      notes: workout.notes || '',
    });

    setEditingRide(workoutId);
    setPendingFitDetail(null);
    return true;
  };

  // Every way of closing the Log Ride sheet without saving. Same rules as before: cancelling
  // an edit resets the form; closing a new ride keeps what was typed but always discards a
  // pending FIT stream/detection so it can't leak into a later, unrelated manual save.
  const closeRideForm = () => {
    if (editingRide) {
      setEditingRide(null);
      setFormData(getDefaultFormData());
    }
    setPendingFitDetail(null);
  };

  // Delete a ride (the caller confirms first). Returns true if it was deleted.
  const handleDeleteWorkout = (workoutId) => {
    const workout = history.find(w => w.id === workoutId);
    if (!workout) return false;
    setHistory(history.filter(w => w.id !== workoutId));
    markDataChanged();
    return true;
  };

  // Read a .FIT or .TCX file. Resolves { parsed, detection, existingMatch }: the Log Ride
  // sheet decides whether to offer attaching it to `existingMatch` (same day, similar
  // duration — see findMatchingRideForImport) or to pre-fill the form (applyRideImport).
  const importRideFile = (file) => new Promise((resolve, reject) => {
    const isTcx = file.name.toLowerCase().endsWith('.tcx');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = isTcx ? parseTcxFile(e.target.result) : await parseFitFile(e.target.result);
        const existingMatch = findMatchingRideForImport(history, parsed);
        const detection = currentFTP
          ? detectIntervals(parsed.stream, currentFTP, parsed.laps, { indoor: parsed.rideType !== 'Outdoor' })
          : null;
        resolve({ parsed, detection, existingMatch });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Could not read this ride file.'));
    if (isTcx) reader.readAsText(file); else reader.readAsArrayBuffer(file);
  });

  // Pre-fills Log Ride form fields from a parsed file. Does not touch Ride Name or RPE — the
  // user still classifies and confirms those before saving.
  const applyRideImport = ({ parsed, detection }) => {
    setFormData(prev => ({
      ...prev,
      ...parsed,
      // Only pre-select a zone for indoor rides; outdoor rides are never filed under one (D5).
      ...(detection && parsed.rideType !== 'Outdoor' ? { zone: detection.category } : {}),
    }));
    setPendingFitDetail({ stream: parsed.stream, detection });
  };

  // FIT backfill: attach a parsed file's stream + detected intervals to an existing ride.
  // TSS, zone and progression fields are untouched. Returns { rideId, detection }.
  const attachRideFile = (existing, { parsed, detection }) => {
    setHistory(prev => prev.map(w => w.id === existing.id ? {
      ...w,
      stream: parsed.stream,
      intervalData: detection
        ? { ...detection, source: 'auto', category: existing.rideType === 'Outdoor' ? null : detection.category }
        : null,
    } : w));
    markDataChanged();
    setPendingFitDetail(null);
    return { rideId: existing.id, detection };
  };

  // Re-run interval detection against a ride's already-saved power stream. Rides imported
  // under older/stricter detection rules can pick up improvements without re-importing the
  // FIT file. Lap data isn't stored per ride, so this uses step detection only — usually
  // identical, occasionally a little less precise on interval boundaries.
  const redetectForRide = (ride) => {
    if (!ride || !ride.stream || !currentFTP) return null;
    const detection = detectIntervals(ride.stream, currentFTP, null, { indoor: ride.rideType !== 'Outdoor' });
    if (!detection) return null;
    return {
      ...detection,
      source: 'auto',
      // Same rule as the FIT import path: a zone the user picked wins over the detected one.
      // Outdoor rides are never filed under a zone (D5).
      category: ride.rideType === 'Outdoor' ? null : (ride.zone && ride.zone !== 'recovery') ? ride.zone : detection.category,
    };
  };

  // Returns { ok, message } for a toast.
  const handleRedetectRide = (rideId) => {
    const ride = history.find(w => w.id === rideId);
    if (!ride || !ride.stream) return { ok: false, message: 'This ride has no saved power data.' };
    if (!currentFTP) {
      return { ok: false, message: 'Set your FTP in Settings before detecting intervals.' };
    }
    const intervalData = redetectForRide(ride);
    if (!intervalData) {
      return {
        ok: false,
        message: ride.intervalData
          ? 'No intervals found this time — the existing interval data was kept.'
          : 'No structured intervals found in this ride.',
      };
    }
    setHistory(prev => prev.map(w => w.id === rideId ? { ...w, intervalData } : w));
    markDataChanged();
    return { ok: true, message: `✓ Detected: ${intervalData.label}` };
  };

  // Rides the bulk re-scan would touch (the caller confirms with this count first).
  const redetectCandidates = () => history.filter(w => w.stream && w.intervalData?.source !== 'manual');

  // Bulk version: re-scan every ride that has a saved power stream. Rides whose interval
  // data was set manually are left alone. Returns { ok, message }.
  const handleRedetectAll = () => {
    if (!currentFTP) {
      return { ok: false, message: 'Set your FTP in Settings before detecting intervals.' };
    }
    const candidates = redetectCandidates();
    if (candidates.length === 0) {
      return { ok: false, message: 'No rides with saved power data yet. Import a FIT or TCX file from Log Ride first.' };
    }

    let found = 0;
    let changed = 0;
    const updated = history.map(w => {
      if (!w.stream || w.intervalData?.source === 'manual') return w;
      const intervalData = redetectForRide(w);
      if (!intervalData) return w;
      found++;
      if (w.intervalData?.label !== intervalData.label || w.intervalData?.category !== intervalData.category) changed++;
      return { ...w, intervalData };
    });

    setHistory(updated);
    markDataChanged();
    return {
      ok: true,
      message: `✓ Scanned ${candidates.length} ride${candidates.length === 1 ? '' : 's'}: ` +
        `intervals found in ${found}, ${changed} updated.`,
    };
  };

  // ---------------- event / profile / levels ----------------
  const handleSaveEvent = (eventFormData) => {
    setEvent(eventFormData);
    markDataChanged();
  };

  // The caller confirms first.
  const handleDeleteEvent = () => {
    setEvent({
      name: '',
      date: '',
      distance: 0,
      targetCTL: 0,
    });
    markDataChanged();
  };

  // Save the Settings → Profile form. The caller validates the FTP (100–500) and asks
  // whether to reset levels when it changed.
  const saveProfile = ({ ftp, profile, resetLevels }) => {
    if (resetLevels) {
      const resetLevelsObj = { ...DEFAULT_LEVELS };
      setLevels(resetLevelsObj);
      setDisplayLevels(resetLevelsObj);
      setLastWorkedDates({});
    }
    if (profile) setUserProfile(profile);
    setCurrentFTP(ftp);
    markDataChanged();
  };

  // Settings → Reset progression levels (the caller confirms first).
  const resetLevels = () => {
    const resetLevelsObj = { ...DEFAULT_LEVELS };
    setLevels(resetLevelsObj);
    setDisplayLevels(resetLevelsObj);
    setLastWorkedDates({});
    markDataChanged();
  };

  // Settings → "Old imported rides" (V2 Phase 4). Old CSV/API imports that were never given a
  // zone clutter the "needs zone" alert and list forever if the user genuinely doesn't have
  // the data to classify them. This sets `historical: true` on them so they're excluded from
  // ridesNeedingZone() and the Today alert count, without deleting anything. "Show them again"
  // reverses it. The caller confirms before calling hideOldImportedRides.
  const oldImportedRideCount = () =>
    history.filter(w => w.rideType !== 'Outdoor' && w.zone == null && w.source === 'imported' && !w.historical).length;

  const hideOldImportedRides = () => {
    setHistory(prev => prev.map(w =>
      (w.rideType !== 'Outdoor' && w.zone == null && w.source === 'imported' && !w.historical)
        ? { ...w, historical: true }
        : w
    ));
    markDataChanged();
  };

  const showOldImportedRides = () => {
    setHistory(prev => prev.map(w => w.historical ? { ...w, historical: false } : w));
    markDataChanged();
  };

  // ---------------- export / import / sync ----------------
  const exportData = () => {
    const now = new Date().toISOString();
    // Include all user data in export
    const data = JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      syncVersion: 1,
      deviceId: null,
      lastSyncedAt: lastSyncedAt || null,
      exportedAt: now,
      levels,
      history,
      ftp: currentFTP,
      intervalsFTP: intervalsFTP,
      event,
      userProfile,
      vo2maxEstimates,
      powerCurveData,
      lastWorkedDates,
    }, null, 2);
    setExportedAt(now);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Better filename with timestamp
    const timestamp = toLocalDateStr(new Date()); // YYYY-MM-DD
    a.download = `casey-rides-backup-${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url); // Clean up
    return a.download;
  };

  // Read a backup file. Resolves the parsed object (the caller shows what it contains and
  // confirms before restoreBackup). Rejects with a friendly message on a bad file.
  const readBackupFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
        resolve(parsed);
      } catch (err) {
        reject(new Error('Invalid file format. Please check the file and try again.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read this file.'));
    reader.readAsText(file);
  });

  // Replace local data with a parsed backup. Body moved verbatim from importData().
  // Returns the number of rides restored.
  const restoreBackup = (parsed) => {
    if (parsed.levels) {
      setLevels(parsed.levels);
      setDisplayLevels(parsed.levels);
    }
    if (parsed.history) setHistory(parsed.history);
    // Import FTP data if available
    if (parsed.ftp) setCurrentFTP(parsed.ftp);
    if (parsed.intervalsFTP) setIntervalsFTP(parsed.intervalsFTP);
    // Import user profile and event if available
    if (parsed.userProfile) setUserProfile(parsed.userProfile);
    if (parsed.event) setEvent(parsed.event);
    if (parsed.vo2maxEstimates) setVo2maxEstimates(parsed.vo2maxEstimates);
    if (parsed.powerCurveData) setPowerCurveData(parsed.powerCurveData);
    if (parsed.lastWorkedDates) setLastWorkedDates(parsed.lastWorkedDates);
    markDataChanged();
    return parsed.history?.length || 0;
  };

  const handleDriveSync = async () => {
    setIsDriveSyncing(true);
    setDriveSyncStatus(null);

    try {
      GoogleDriveSync.init();

      // Prepare current local data for sync
      // Pass exportedAt as-is (null if no local changes yet).
      // The sync module treats null as epoch 0, so remote data always wins over a fresh/empty app.
      console.log('[handleDriveSync] exportedAt:', exportedAt, '| history length:', history.length);
      const localData = {
        schemaVersion: SCHEMA_VERSION,
        syncVersion: 1,
        exportedAt: exportedAt,
        lastSyncedAt: lastSyncedAt,
        levels,
        history,
        ftp: currentFTP,
        intervalsFTP,
        event,
        userProfile,
        vo2maxEstimates,
        powerCurveData,
        lastWorkedDates,
      };

      // Perform sync
      const result = await GoogleDriveSync.sync(localData, (remoteData) => {
        // Pull callback: update local state with remote data
        console.log('[handleDriveSync] Pull callback fired! Remote rides:', (remoteData.history || []).length);
        if (remoteData.levels) {
          setLevels(remoteData.levels);
          setDisplayLevels(remoteData.levels);
        }
        if (remoteData.history) setHistory(remoteData.history);
        if (remoteData.ftp) setCurrentFTP(remoteData.ftp);
        if (remoteData.intervalsFTP) setIntervalsFTP(remoteData.intervalsFTP);
        if (remoteData.event) setEvent(remoteData.event);
        if (remoteData.userProfile) setUserProfile(remoteData.userProfile);
        if (remoteData.vo2maxEstimates) setVo2maxEstimates(remoteData.vo2maxEstimates);
        if (remoteData.powerCurveData) setPowerCurveData(remoteData.powerCurveData);
        if (remoteData.exportedAt) setExportedAt(remoteData.exportedAt);
        if (remoteData.lastSyncedAt) setLastSyncedAt(remoteData.lastSyncedAt);
        if (remoteData.lastWorkedDates) setLastWorkedDates(remoteData.lastWorkedDates);
      });

      setDriveSyncStatus(result);

      // If we pushed data, update sync timestamps
      if (result.action === 'push') {
        const now = new Date().toISOString();
        setLastSyncedAt(now);
        // If exportedAt was null (first-ever sync), set it so future syncs compare correctly
        if (!exportedAt) {
          setExportedAt(now);
        }
      }

      // Clear status after 5 seconds
      setTimeout(() => setDriveSyncStatus(null), 5000);
      return result;
    } catch (error) {
      console.error('Drive sync error:', error);
      const failure = {
        status: 'error',
        message: 'Sync failed: ' + error.message
      };
      setDriveSyncStatus(failure);
      return failure;
    } finally {
      setIsDriveSyncing(false);
    }
  };

  // "Copy for Claude" text (the Today screen copies it to the clipboard).
  const buildCopyText = () => buildAnalysisText({ history, currentFTP, currentEftp, event, loads });

  const value = {
    // state
    levels, displayLevels, animatingZone, history, recentChanges, lastWorkedDates,
    currentFTP, intervalsFTP, event, userProfile, vo2maxEstimates, powerCurveData,
    exportedAt, lastSyncedAt, isDriveSyncing, driveSyncStatus, eftpPromptedValue,
    lastLoggedWorkout, hasUnsyncedChanges,
    // Log Ride form
    formData, setFormData, editingRide, pendingFitDetail, setPendingFitDetail,
    // derived
    effectiveLevels, eftpTimeline, currentEftp, loads, trainingStatus,
    calculateTSS, calculateIF,
    // actions
    saveRide: handleLogWorkout,
    closePostLogSummary,
    startEditRide: handleEditRide,
    closeRideForm,
    deleteRide: handleDeleteWorkout,
    importRideFile, applyRideImport, attachRideFile,
    redetectRide: handleRedetectRide, redetectCandidates, redetectAll: handleRedetectAll,
    saveEvent: handleSaveEvent, deleteEvent: handleDeleteEvent,
    saveProfile, resetLevels,
    oldImportedRideCount, hideOldImportedRides, showOldImportedRides,
    exportData, readBackupFile, restoreBackup,
    syncWithDrive: handleDriveSync,
    resolveEftpAlert,
    buildCopyText,
    markDataChanged,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
