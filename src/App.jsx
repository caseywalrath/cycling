import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ComposedChart, Line, ReferenceArea, Legend } from 'recharts';
import GoogleDriveSync from './google-drive-sync.js';
import { ZONES, DEFAULT_LEVELS, ZONE_EXPECTED_RPE, ZONE_ADJACENCY } from './lib/zones.js';
import { toLocalDateStr, parseDateLocal, parseDuration, formatDateWithDay } from './lib/dates.js';
import { parseFitFile, parseTcxFile } from './lib/rideFiles.js';
import { EFTP_PROMPT_MARGIN, EFTP_PROMPT_KEY, buildEftpTimeline } from './lib/eftp.js';
import { detectIntervals } from './lib/intervals.js';
import { applyDecay } from './lib/progression.js';

const STORAGE_KEY = 'cycling-progression-data-v2';
const FTP = 235;

export default function ProgressionTracker() {
  const [levels, setLevels] = useState(DEFAULT_LEVELS);
  const [displayLevels, setDisplayLevels] = useState(DEFAULT_LEVELS);
  const [history, setHistory] = useState([]);
  const [showLogRideModal, setShowLogRideModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showPostLogSummary, setShowPostLogSummary] = useState(false);
  const [lastLoggedWorkout, setLastLoggedWorkout] = useState(null);
  const [recentChanges, setRecentChanges] = useState({});
  const [animatingZone, setAnimatingZone] = useState(null);
  // lastWorkedDates: { zoneId: 'YYYY-MM-DD' } — tracks when each zone was last directly trained
  const [lastWorkedDates, setLastWorkedDates] = useState({});
  const [weeklyChartView, setWeeklyChartView] = useState('hours'); // 'hours', 'tss', or 'elevation'
  const animationRef = useRef(null);
  const isInitialMount = useRef(true);


  // Power curve data state
  const [powerCurveData, setPowerCurveData] = useState(null);
  const [showPhenotypeModal, setShowPhenotypeModal] = useState(false);

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarPopup, setCalendarPopup] = useState(null); // { dateStr } or null


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
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventFormData, setEventFormData] = useState(event);

  // User profile for VO2max calculations
  const [userProfile, setUserProfile] = useState({
    maxHR: null,
    restingHR: null,
    weight: null, // kg
    age: null,
    sex: 'male', // 'male' or 'female'
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileModalOriginalFTP, setProfileModalOriginalFTP] = useState(null);

  // VO2max estimates storage (pass-through from old intervals.icu imports)
  const [vo2maxEstimates, setVo2maxEstimates] = useState([]);

  const getDefaultFormData = () => {
    return {
      name: '',
      date: toLocalDateStr(new Date()),
      zone: 'endurance',
      workoutLevel: ZONE_EXPECTED_RPE['endurance'],
      rpe: 5,
      completed: true,
      duration: 60,
      normalizedPower: 150,
      rideType: 'Indoor',
      distance: 0,
      elevation: 0,
      notes: '',
    };
  };
  const [formData, setFormData] = useState(getDefaultFormData());

  // State for editing rides
  const [editingRide, setEditingRide] = useState(null);

  // Interval tracking state (see INTERVAL_TRACKING_PLAN.md)
  const [pendingFitDetail, setPendingFitDetail] = useState(null); // { stream, detection } from FIT import, awaiting save
  const [showWorkoutDetail, setShowWorkoutDetail] = useState(null); // ride id or null
  const [showProgressionModal, setShowProgressionModal] = useState(false);
  const [progressionCategory, setProgressionCategory] = useState(null); // null = no zone selected (default view)
  const [progressionMetric, setProgressionMetric] = useState('minutes'); // 'minutes' | 'watts'

  // Effective levels = base levels with decay applied (for display and new workout calculations)
  const effectiveLevels = useMemo(() => applyDecay(levels, lastWorkedDates), [levels, lastWorkedDates]);

  // eFTP estimated from FIT power streams (see EFTP_ESTIMATE_PLAN.md). Recomputed whenever
  // history changes; `today` is intentionally fixed at render time, not a dependency.
  const eftpTimeline = useMemo(() => buildEftpTimeline(history, new Date()), [history]);
  const currentEftp = eftpTimeline.current; // { value, peakRideName, peakRideDate } | null

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const loadedLevels = parsed.levels || DEFAULT_LEVELS;
        setLevels(loadedLevels);
        setDisplayLevels(loadedLevels);
        setHistory(parsed.history || []);

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
          setEventFormData(parsed.event);
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
      alert('⚠️ Could not save your data — browser storage may be full. Please export a backup (Export Data) soon so nothing is lost.');
    }
  }, [levels, history, currentFTP, intervalsFTP, event, userProfile, vo2maxEstimates, powerCurveData, exportedAt, lastSyncedAt, lastWorkedDates]);


  // Prompt to raise FTP when the calculated eFTP is meaningfully higher — see
  // EFTP_ESTIMATE_PLAN.md §6. Prompts once per new, higher estimate (never on a plain
  // app launch of an already-seen value, never to lower FTP).
  const [eftpPromptedValue, setEftpPromptedValue] = useState(() => {
    try { return parseInt(localStorage.getItem(EFTP_PROMPT_KEY), 10) || 0; } catch { return 0; }
  });

  useEffect(() => {
    const est = currentEftp?.value;
    if (!est) return;
    if (est < currentFTP + EFTP_PROMPT_MARGIN) return; // only offer increases
    if (est <= eftpPromptedValue) return; // already asked about this (or higher)
    setEftpPromptedValue(est);
    try { localStorage.setItem(EFTP_PROMPT_KEY, String(est)); } catch { /* ignore */ }
    const shouldUpdate = window.confirm(
      `Your estimated FTP is ${est}W (best 20-min effort: ${currentEftp.peakRideName}, ` +
      `${currentEftp.peakRideDate}). That's ${est - currentFTP}W above your current FTP (${currentFTP}W).\n\n` +
      `Would you like to update your FTP in Profile settings?`
    );
    if (shouldUpdate) {
      setProfileModalOriginalFTP(currentFTP);
      setShowProfileModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEftp?.value]); // intentionally not currentFTP: changing FTP by hand must not trigger a prompt

  // Mark data as changed (updates exportedAt timestamp for sync conflict resolution)
  const markDataChanged = () => {
    setExportedAt(new Date().toISOString());
  };

  // Calculate zone descriptions dynamically based on current FTP
  const getZoneDescription = (zoneId, ftp) => {
    const zones = {
      recovery: { min: 0, max: Math.round(ftp * 0.55), label: 'Z1' },
      endurance: { min: Math.round(ftp * 0.55), max: Math.round(ftp * 0.70), label: 'Z2' },
      tempo: { min: Math.round(ftp * 0.70), max: Math.round(ftp * 0.79), label: 'Z3' },
      sweetspot: { min: Math.round(ftp * 0.83), max: Math.round(ftp * 0.94), label: '' },
      threshold: { min: Math.round(ftp * 0.94), max: ftp, label: 'Z4' },
      vo2max: { min: ftp, max: Math.round(ftp * 1.19), label: 'Z5' },
      anaerobic: { min: Math.round(ftp * 1.19), max: null, label: 'Z6' },
    };

    const zone = zones[zoneId];
    if (!zone) return '';

    if (zone.max === null) {
      return `${zone.label}: ${zone.min}W+`;
    }
    return `${zone.label ? zone.label + ': ' : ''}${zone.min}-${zone.max}W`;
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

  const calculateTSS = (normalizedPower, durationMinutes) => {
    const intensityFactor = normalizedPower / currentFTP;
    const tss = (durationMinutes * normalizedPower * intensityFactor) / (currentFTP * 60) * 100;
    return Math.round(tss);
  };

  const calculateIF = (normalizedPower) => {
    return normalizedPower / currentFTP;
  };

  const calculateTrainingLoads = () => {
    if (history.length === 0) return { ctl: 0, atl: 0, tsb: 0, weeklyTSS: 0, prevWeeklyTSS: 0, ctl14dAgo: 0 };

    const sorted = [...history].sort((a, b) => parseDateLocal(a.date) - parseDateLocal(b.date));
    const today = new Date();
    today.setHours(0, 0, 0, 0); // midnight local — consistent with parseDateLocal

    const dailyTSS = {};
    sorted.forEach(workout => {
      const date = workout.date;
      if (!dailyTSS[date]) dailyTSS[date] = 0;
      dailyTSS[date] += workout.tss || 0;
    });

    let ctl = 0;
    let atl = 0;
    let ctl14dAgo = 0;
    const ctlDecay = 2 / (42 + 1);
    const atlDecay = 2 / (7 + 1);

    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const fourteenDaysAgoStr = toLocalDateStr(fourteenDaysAgo);

    const currentDate = parseDateLocal(sorted[0].date); // midnight local
    while (currentDate <= today) {
      const dateStr = toLocalDateStr(currentDate);
      const dayTSS = dailyTSS[dateStr] || 0;

      ctl = ctl * (1 - ctlDecay) + dayTSS * ctlDecay;
      atl = atl * (1 - atlDecay) + dayTSS * atlDecay;

      if (dateStr === fourteenDaysAgoStr) {
        ctl14dAgo = ctl;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const weeklyTSS = sorted
      .filter(w => parseDateLocal(w.date) >= weekAgo)
      .reduce((sum, w) => sum + (w.tss || 0), 0);

    const twoWeekTSS = sorted
      .filter(w => parseDateLocal(w.date) >= twoWeeksAgo)
      .reduce((sum, w) => sum + (w.tss || 0), 0);

    return {
      ctl: Math.round(ctl),
      atl: Math.round(atl),
      tsb: Math.round(ctl - atl),
      weeklyTSS,
      twoWeekTSS,
      ctl14dAgo: Math.round(ctl14dAgo),
    };
  };

  // Calculate weekly hours for chart
  const calculateWeeklyHours = (history) => {
    if (!history || history.length === 0) return [];

    // Get date 20 weeks ago
    const twentyWeeksAgo = new Date();
    twentyWeeksAgo.setHours(0, 0, 0, 0);
    twentyWeeksAgo.setDate(twentyWeeksAgo.getDate() - (20 * 7));

    // Filter to last 20 weeks
    const recentWorkouts = history.filter(w => parseDateLocal(w.date) >= twentyWeeksAgo);

    // Group by week
    const weeklyData = {};
    recentWorkouts.forEach(workout => {
      const date = parseDateLocal(workout.date);
      // Get Monday of that week (week starts on Monday, Strava convention)
      const monday = new Date(date);
      monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      const weekKey = toLocalDateStr(monday);

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = {
          weekStart: weekKey,
          totalMinutes: 0,
          workouts: 0,
        };
      }

      weeklyData[weekKey].totalMinutes += workout.duration || 0;
      weeklyData[weekKey].workouts += 1;
    });

    // Convert to array and sort by date
    const chartData = Object.values(weeklyData)
      .map(week => ({
        weekStart: week.weekStart,
        hours: Math.round((week.totalMinutes / 60) * 10) / 10, // Round to 1 decimal
        totalMinutes: week.totalMinutes,
        workouts: week.workouts,
        // Format label as "Apr 7", "May 12", etc.
        label: parseDateLocal(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      }))
      .sort((a, b) => parseDateLocal(a.weekStart) - parseDateLocal(b.weekStart));

    return chartData;
  };

  const calculateWeeklyTSS = (history) => {
    if (!history || history.length === 0) return [];

    // Get date 20 weeks ago
    const twentyWeeksAgo = new Date();
    twentyWeeksAgo.setHours(0, 0, 0, 0);
    twentyWeeksAgo.setDate(twentyWeeksAgo.getDate() - (20 * 7));

    // Filter to last 20 weeks
    const recentWorkouts = history.filter(w => parseDateLocal(w.date) >= twentyWeeksAgo);

    // Group by week
    const weeklyData = {};
    recentWorkouts.forEach(workout => {
      const date = parseDateLocal(workout.date);
      // Get Monday of that week (week starts on Monday, Strava convention)
      const monday = new Date(date);
      monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      const weekKey = toLocalDateStr(monday);

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = {
          weekStart: weekKey,
          totalTSS: 0,
          workouts: 0,
        };
      }

      weeklyData[weekKey].totalTSS += workout.tss || 0;
      weeklyData[weekKey].workouts += 1;
    });

    // Convert to array and sort by date
    const chartData = Object.values(weeklyData)
      .map(week => ({
        weekStart: week.weekStart,
        tss: Math.round(week.totalTSS), // Round to integer
        workouts: week.workouts,
        // Format label as "Apr 7", "May 12", etc.
        label: parseDateLocal(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      }))
      .sort((a, b) => parseDateLocal(a.weekStart) - parseDateLocal(b.weekStart));

    return chartData;
  };

  const calculateMonthlyElevation = (history) => {
    if (!history || history.length === 0) return [];

    // Rolling 11-month window (same as eFTP chart)
    const elevenMonthsAgo = new Date();
    elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);
    elevenMonthsAgo.setDate(1);

    const recentWorkouts = history.filter(w => parseDateLocal(w.date) >= elevenMonthsAgo);

    // Group by calendar month
    const monthMap = {};
    recentWorkouts.forEach(workout => {
      const d = parseDateLocal(workout.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      if (!monthMap[key]) {
        monthMap[key] = { totalElevation: 0, workouts: 0 };
      }
      monthMap[key].totalElevation += workout.elevation || 0;
      if (workout.elevation > 0) monthMap[key].workouts += 1;
    });

    return Object.keys(monthMap).sort().map(key => {
      const entry = monthMap[key];
      const [year, month] = key.split('-').map(Number);
      const d = new Date(year, month - 1);
      return {
        monthKey: key,
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        elevation: Math.round(entry.totalElevation),
        workouts: entry.workouts,
      };
    });
  };

  // Calculate eFTP history for rolling one-year chart. Combines the app's own calculated
  // estimates (FIT era) with legacy intervals.icu-imported values (pre-FIT era) so the chart
  // keeps working across the transition — see EFTP_ESTIMATE_PLAN.md §4.
  const calculateEFTPHistory = (history, eftpTimeline) => {
    if (!history || history.length === 0) return [];

    const { byRideId, firstStreamDate } = eftpTimeline || { byRideId: {}, firstStreamDate: null };

    // Rolling 11-month window so each month name appears only once on X-axis
    const elevenMonthsAgo = new Date();
    elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);
    elevenMonthsAgo.setDate(1); // start of that month

    const rides = history
      .filter(w => parseDateLocal(w.date) >= elevenMonthsAgo)
      .sort((a, b) => parseDateLocal(a.date) - parseDateLocal(b.date));

    // Group by calendar month → per month, prefer the highest estimated value; only fall
    // back to legacy imported values (and only for rides before the first FIT stream).
    const monthMap = {};
    rides.forEach(w => {
      const rideInfo = byRideId[w.id];
      const estimated = rideInfo && rideInfo.eftp != null ? rideInfo.eftp : null;
      const isLegacyEligible = w.eFTP && (firstStreamDate == null || w.date < firstStreamDate);

      let value = null;
      let source = null;
      let rideName = null;
      let peakDate = null;
      if (estimated != null) {
        value = estimated;
        source = 'estimated';
        rideName = rideInfo.peakRideName;
        peakDate = rideInfo.peakRideDate;
      } else if (isLegacyEligible) {
        value = w.eFTP;
        source = 'imported';
        rideName = w.name || 'Workout';
        peakDate = w.date;
      } else {
        return;
      }

      const d = parseDateLocal(w.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthMap[key];
      // An estimated value always wins over an imported one for the same month, regardless
      // of watts, and the highest value wins within the same source.
      const shouldReplace = !existing
        || (source === 'estimated' && existing.source !== 'estimated')
        || (source === existing.source && value > existing.eFTP);
      if (shouldReplace) {
        monthMap[key] = { eFTP: value, rideName, peakDate, source };
      }
    });

    // Build sorted array with month labels
    const eftpData = Object.keys(monthMap).sort().map(key => {
      const entry = monthMap[key];
      const [year, month] = key.split('-').map(Number);
      const d = new Date(year, month - 1);
      return {
        monthKey: key,
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        eFTP: entry.eFTP,
        rideName: entry.rideName,
        source: entry.source,
        peakDate: entry.peakDate,
      };
    });

    return eftpData;
  };


  const calculateNewLevel = (currentLevel, workoutLevel, rpe, completed) => {
    if (!completed) {
      if (workoutLevel <= currentLevel) {
        return Math.max(1, currentLevel - 0.5);
      }
      return currentLevel;
    }

    const difficulty = workoutLevel - currentLevel;

    if (difficulty <= -2) {
      return currentLevel;
    } else if (difficulty <= 0) {
      if (rpe <= 5) {
        return Math.min(10, currentLevel + 0.1);
      }
      return currentLevel;
    } else if (difficulty <= 1) {
      if (rpe <= 6) {
        return Math.min(10, currentLevel + 0.5);
      } else if (rpe <= 8) {
        return Math.min(10, currentLevel + 0.3);
      } else {
        return Math.min(10, currentLevel + 0.1);
      }
    } else if (difficulty <= 2) {
      if (rpe <= 7) {
        return Math.min(10, currentLevel + 0.7);
      } else if (rpe <= 9) {
        return Math.min(10, currentLevel + 0.4);
      } else {
        return Math.min(10, currentLevel + 0.2);
      }
    } else {
      if (rpe <= 8) {
        return Math.min(10, currentLevel + 1.0);
      } else {
        return Math.min(10, currentLevel + 0.5);
      }
    }
  };





  const handleLogWorkout = () => {
    const isOutdoor = formData.rideType === 'Outdoor';
    const zone = isOutdoor ? null : formData.zone;
    const completed = isOutdoor ? true : formData.completed;
    const distance = isOutdoor ? formData.distance : 0;
    const elevation = isOutdoor ? formData.elevation : 0;
    const duration = parseDuration(formData.duration);
    const tss = calculateTSS(formData.normalizedPower, duration);
    const intensityFactor = calculateIF(formData.normalizedPower);

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
        name: formData.name,
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
                category: (zone && zone !== 'recovery') ? zone : pendingFitDetail.detection.category }
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
      setShowLogRideModal(false);
      setShowHistoryModal(true);
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
        name: formData.name,
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
                category: (zone && zone !== 'recovery') ? zone : pendingFitDetail.detection.category }
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

      // Set last logged workout for summary modal
      setLastLoggedWorkout(entry);

      // Update history and levels
      setHistory([entry, ...history]);
      setLevels(updatedLevels);
      markDataChanged();
      setPendingFitDetail(null);

      // Close modal and show summary
      setShowLogRideModal(false);
      setShowPostLogSummary(true);

      // Reset form
      setFormData(getDefaultFormData());
      setEditingRide(null);
    }
  };

  const closePostLogSummary = () => {
    setShowPostLogSummary(false);
    setShowLogRideModal(false);

    // Trigger animation after modal closes (only for rides with progression)
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

  // Event management handlers
  const handleSaveEvent = () => {
    setEvent(eventFormData);
    markDataChanged();
    setShowEventModal(false);
  };

  const handleDeleteEvent = () => {
    const confirmed = window.confirm('Are you sure you want to delete this event?');
    if (confirmed) {
      setEvent({
        name: '',
        date: '',
        distance: 0,
        targetCTL: 0,
      });
      markDataChanged();
      setShowEventModal(false);
    }
  };

  // Calculate days until event
  const getDaysUntilEvent = () => {
    if (!event.date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = parseDateLocal(event.date);
    const diffTime = eventDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Delete workout handler
  const handleDeleteWorkout = (workoutId) => {
    const workout = history.find(w => w.id === workoutId);
    if (!workout) return;

    const confirmed = window.confirm(
      `Delete this workout?\n\n` +
      `Date: ${workout.date}\n` +
      `Zone: ${getZoneName(workout.zone)}\n` +
      `Duration: ${workout.duration} min\n` +
      `TSS: ${workout.tss}\n\n` +
      `This action cannot be undone.`
    );

    if (confirmed) {
      setHistory(history.filter(w => w.id !== workoutId));
      markDataChanged();
    }
  };

  // Edit workout handler
  const handleEditRide = (workoutId) => {
    const workout = history.find(w => w.id === workoutId);
    if (!workout) return;

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
    setShowHistoryModal(false);
    setShowLogRideModal(true);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingRide(null);
    setFormData(getDefaultFormData());
    setShowLogRideModal(false);
    setPendingFitDetail(null);
  };

  // Closes the Log Ride modal (new-workout path) and discards any pending FIT
  // stream/detection so it can't leak into a later, unrelated manual save.
  const closeLogRideModal = () => {
    setShowLogRideModal(false);
    setPendingFitDetail(null);
  };

  const exportData = () => {
    const now = new Date().toISOString();
    // Include all user data in export
    const data = JSON.stringify({
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
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
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

          alert(`✓ Data imported successfully!\n${parsed.history?.length || 0} workouts restored.`);
        } catch (err) {
          alert('Invalid file format. Please check the file and try again.');
        }
      };
      reader.readAsText(file);
    }
  };


  // Pre-fills Log Ride form fields from a .FIT or .TCX file. Does not touch Zone, Ride
  // Name, or RPE — the user still classifies and confirms those before saving.
  // Also detects interval structure (power/HR streams + set/rep detection) and, if the
  // FIT file's date matches an already-logged ride, offers to backfill that ride instead
  // of creating a duplicate.
  const handleFitFileImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const isTcx = file.name.toLowerCase().endsWith('.tcx');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = isTcx ? parseTcxFile(e.target.result) : await parseFitFile(e.target.result);
        const existing = history.find(w => w.date === parsed.date);

        if (existing) {
          const existingName = existing.name || existing.notes || 'Workout';
          const attach = window.confirm(
            `A ride on ${parsed.date} already exists (${existingName}, ${existing.duration}min). ` +
            `Attach interval data to it instead of creating a new ride?`
          );
          if (attach) {
            const detection = currentFTP
              ? detectIntervals(parsed.stream, currentFTP, parsed.laps, { indoor: parsed.rideType !== 'Outdoor' })
              : null;
            setHistory(prev => prev.map(w => w.id === existing.id ? {
              ...w,
              stream: parsed.stream,
              intervalData: detection ? { ...detection, source: 'auto' } : null,
            } : w));
            markDataChanged();
            setShowLogRideModal(false);
            setPendingFitDetail(null);
            setShowWorkoutDetail(existing.id);
            alert(detection
              ? `✓ Interval data attached: ${detection.label}`
              : `✓ Power/HR data attached (no structured intervals detected).`);
            event.target.value = '';
            return;
          }
          // Cancel → fall through to normal new-ride flow below
        }

        const detection = currentFTP
          ? detectIntervals(parsed.stream, currentFTP, parsed.laps, { indoor: parsed.rideType !== 'Outdoor' })
          : null;
        setFormData(prev => ({ ...prev, ...parsed, ...(detection ? { zone: detection.category } : {}) }));
        setPendingFitDetail({ stream: parsed.stream, detection });
      } catch (err) {
        alert(err.message || 'Could not read this ride file.');
      }
    };
    if (isTcx) reader.readAsText(file); else reader.readAsArrayBuffer(file);
    // Reset file input so the same file can be re-imported
    event.target.value = '';
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
      category: (ride.zone && ride.zone !== 'recovery') ? ride.zone : detection.category,
    };
  };

  const handleRedetectRide = (rideId) => {
    const ride = history.find(w => w.id === rideId);
    if (!ride || !ride.stream) return;
    if (!currentFTP) {
      alert('Set your FTP in Profile before detecting intervals.');
      return;
    }
    const intervalData = redetectForRide(ride);
    if (!intervalData) {
      alert(ride.intervalData
        ? 'No intervals found this time — the existing interval data was kept.'
        : 'No structured intervals found in this ride.');
      return;
    }
    setHistory(prev => prev.map(w => w.id === rideId ? { ...w, intervalData } : w));
    markDataChanged();
    alert(`✓ Detected: ${intervalData.label}`);
  };

  // Bulk version: re-scan every ride that has a saved power stream. Rides whose interval
  // data was set manually are left alone.
  const handleRedetectAll = () => {
    if (!currentFTP) {
      alert('Set your FTP in Profile before detecting intervals.');
      return;
    }
    const candidates = history.filter(w => w.stream && w.intervalData?.source !== 'manual');
    if (candidates.length === 0) {
      alert('No rides with saved power data yet. Import a FIT or TCX file from the Log Ride screen first.');
      return;
    }
    if (!window.confirm(
      `Re-scan ${candidates.length} ride${candidates.length === 1 ? '' : 's'} for intervals?\n\n` +
      `This re-runs detection on the power data already saved with each ride. ` +
      `Automatically detected labels and categories may change; manually set ones are left alone.`
    )) return;

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
    alert(`✓ Scanned ${candidates.length} ride${candidates.length === 1 ? '' : 's'}: ` +
      `intervals found in ${found}, ${changed} updated.`);
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
        if (remoteData.event) {
          setEvent(remoteData.event);
          setEventFormData(remoteData.event);
        }
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

    } catch (error) {
      console.error('Drive sync error:', error);
      setDriveSyncStatus({
        status: 'error',
        message: 'Sync failed: ' + error.message
      });
    } finally {
      setIsDriveSyncing(false);
    }
  };


  const copyForAnalysis = () => {
    const loads = calculateTrainingLoads();
    const recentWorkouts = history.slice(0, 7);
    const daysToEvent = getDaysUntilEvent();
    const status = getTrainingStatus(loads.ctl, loads.atl, loads.tsb, loads.ctl14dAgo);

    // 28-day TSS
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setHours(0, 0, 0, 0);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const twentyEightDayTSS = history
      .filter(w => parseDateLocal(w.date) >= fourWeeksAgo)
      .reduce((sum, w) => sum + (w.tss || 0), 0);

    // Weekly training hours (last 4 weeks)
    const weeklyHoursData = calculateWeeklyHours(history);
    const last4Weeks = weeklyHoursData.slice(-4);

    // Interval progressions: last 3 sessions per category, oldest -> newest
    const shortDate = (dateStr) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    const intervalCategories = ZONES.filter(z => z.id !== 'recovery');
    const intervalLines = intervalCategories
      .map(z => {
        const sessions = history
          .filter(w => w.intervalData?.category === z.id)
          .slice()
          .sort((a, b) => parseDateLocal(a.date) - parseDateLocal(b.date))
          .slice(-3);
        if (sessions.length === 0) return null;
        return `- ${z.name}: ${sessions.map(w => `${w.intervalData.label} (${shortDate(w.date)})`).join(' → ')}`;
      })
      .filter(Boolean);
    const intervalProgressionsSection = intervalLines.length > 0
      ? `\n\n## Interval Progressions\n${intervalLines.join('\n')}`
      : '';

    const analysisText = `## Training Status - ${formatDateWithDay(toLocalDateStr(new Date()))}

**Athlete Profile:**
- FTP: ${currentFTP}W${currentEftp ? ` | eFTP: ${currentEftp.value}W (est. best 20-min, 90d)` : ''}${daysToEvent !== null ? ` | Days to Event: ${daysToEvent}` : ''}

**Training Loads:**
- CTL (Fitness): ${loads.ctl}
- ATL (Fatigue): ${loads.atl}
- TSB (Form): ${loads.tsb}
- 7-Day TSS: ${loads.weeklyTSS}
- 14-Day TSS: ${loads.twoWeekTSS}
- 28-Day TSS: ${twentyEightDayTSS}

**Weekly Training Hours (past 4 weeks):**
${last4Weeks.map(w => `- ${w.label}: ${w.hours}h (${w.workouts} rides)`).join('\n')}

**Recent Workouts:**
${recentWorkouts.map(w => `- ${formatDateWithDay(w.date)}: ${w.rideType || 'Indoor'}${w.rideType !== 'Outdoor' ? `, ${getZoneName(w.zone)}` : ''}${w.rideType === 'Outdoor' && w.distance > 0 ? `, ${w.distance}mi` : ''}${w.rideType === 'Outdoor' && w.elevation > 0 ? `, ${w.elevation}ft gain` : ''}, ${w.duration}min, NP ${w.normalizedPower}W, TSS ${w.tss}${w.rpe != null ? `, RPE ${w.rpe}` : ''}${w.notes ? ` (${w.notes})` : ''}`).join('\n')}${intervalProgressionsSection}`;

    const copyToClipboard = (text) => {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
      }
      // Fallback for non-secure contexts (e.g., HTTP on LAN)
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return Promise.resolve();
    };

    copyToClipboard(analysisText).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(() => {
      alert('Copy failed. Your browser may not support clipboard access over HTTP.');
    });
  };

  const getZoneName = (zoneId) => {
    if (!zoneId) return 'Unclassified';
    const zone = ZONES.find(z => z.id === zoneId);
    return zone ? zone.name : zoneId;
  };

  const getZoneColor = (zoneId) => {
    if (!zoneId) return '#888';
    const zone = ZONES.find(z => z.id === zoneId);
    return zone ? zone.color : '#888';
  };

  const formatChange = (change) => {
    if (change > 0) return `+${change.toFixed(1)}`;
    if (change < 0) return change.toFixed(1);
    return '0';
  };

  const getTSBStatus = (tsb) => {
    if (tsb > 25) return { label: 'Very Fresh', color: '#22C55E' };
    if (tsb > 5) return { label: 'Fresh', color: '#86EFAC' };
    if (tsb > -10) return { label: 'Neutral', color: '#EAB308' };
    if (tsb > -25) return { label: 'Tired', color: '#F97316' };
    return { label: 'Very Tired', color: '#EF4444' };
  };

  const getTrainingStatus = (ctl, atl, tsb, ctl14dAgo) => {
    // Low fitness override: CTL < 35 makes TSB% erratic
    if (ctl < 35) {
      if (atl > ctl * 1.5) return { label: 'Building (Heavy Load)', color: '#F97316', description: 'Early base building with significant load' };
      if (atl > ctl) return { label: 'Building', color: '#3B82F6', description: 'Building early fitness' };
      return { label: 'Building (Fresh)', color: '#86EFAC', description: 'Building fitness, well-rested' };
    }

    const tsbPct = (tsb / ctl) * 100;

    // Transition detection: high positive TSB% OR CTL declining >10% over 14 days with positive TSB
    const ctlDecline = ctl14dAgo > 0 ? ((ctl14dAgo - ctl) / ctl14dAgo) * 100 : 0;
    if (tsbPct > 25 || (ctlDecline > 10 && tsb > 0)) {
      return { label: 'Transition', color: '#9CA3AF', description: 'Extended rest or detraining' };
    }
    if (tsbPct >= 5) return { label: 'Fresh', color: '#3B82F6', description: 'Well-rested, good for testing or events' };
    if (tsbPct >= -10) return { label: 'Grey Zone', color: '#EAB308', description: 'Maintenance — not strongly building or recovering' };
    if (tsbPct >= -30) return { label: 'Optimal', color: '#22C55E', description: 'Productive overload, fitness improving' };
    return { label: 'High Risk', color: '#EF4444', description: 'Significant overreach — monitor fatigue' };
  };

  const getChangeDescription = (change, rpe, workoutLevel, currentLevel) => {
    if (change >= 0.7) return 'Breakthrough!';
    if (change >= 0.4) return 'Strong progress';
    if (change >= 0.2) return 'Solid work';
    if (change > 0) return 'Maintained';
    if (change === 0) return 'No change';
    return 'Level adjusted down';
  };

  const loads = calculateTrainingLoads();
  const tsbStatus = getTSBStatus(loads.tsb);
  const trainingStatus = getTrainingStatus(loads.ctl, loads.atl, loads.tsb, loads.ctl14dAgo);
  const currentIF = formData.normalizedPower / currentFTP;
  const currentTSS = calculateTSS(formData.normalizedPower, parseDuration(formData.duration));

  const last7Days = history.filter(w => {
    const weekAgo = new Date();
    weekAgo.setHours(0, 0, 0, 0);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return parseDateLocal(w.date) >= weekAgo;
  });

  const last28Days = history.filter(w => {
    const monthAgo = new Date();
    monthAgo.setHours(0, 0, 0, 0);
    monthAgo.setDate(monthAgo.getDate() - 28);
    return parseDateLocal(w.date) >= monthAgo;
  });

  // Calendar: set of dates with rides for O(1) lookup
  const rideDatesSet = useMemo(() => {
    const set = new Set();
    history.forEach(ride => { if (ride.date) set.add(ride.date); });
    return set;
  }, [history]);

  // Calendar: rides grouped by date for popup display
  const ridesByDate = useMemo(() => {
    const map = {};
    history.forEach(ride => {
      if (ride.date) {
        if (!map[ride.date]) map[ride.date] = [];
        map[ride.date].push(ride);
      }
    });
    return map;
  }, [history]);

  // Calendar: generate day objects for a month grid (Monday-start)
  const getCalendarDays = (year, month) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Convert to Monday-start: JS getDay() 0=Sun → we want 0=Mon
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days = [];

    // Previous month trailing days
    const prevLastDay = new Date(year, month, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevLastDay - i;
      const pm = month === 0 ? 11 : month - 1;
      const py = month === 0 ? year - 1 : year;
      days.push({ day: d, dateStr: `${py}-${String(pm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: true });
    }

    // Next month leading days
    const totalCells = days.length <= 35 ? 35 : 42;
    let nextDay = 1;
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    while (days.length < totalCells) {
      days.push({ day: nextDay, dateStr: `${ny}-${String(nm + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`, isCurrentMonth: false });
      nextDay++;
    }

    return days;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header with Profile, Event, and Log Ride buttons */}
        <div className="flex justify-between items-start mb-1">
          <h1 className="text-xl font-bold">Casey Rides</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowLogRideModal(true)}
              className="text-sm px-3 py-1 rounded bg-green-600 hover:bg-green-700 transition font-medium"
            >
              Log Ride
            </button>
            <button
              onClick={handleDriveSync}
              disabled={isDriveSyncing}
              className={`text-sm px-3 py-1 rounded transition font-medium ${
                isDriveSyncing
                  ? 'bg-gray-600 cursor-wait text-gray-400'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isDriveSyncing ? 'Syncing...' : 'Sync'}
            </button>
            <button
              onClick={() => {
                setEventFormData(event);
                setShowEventModal(true);
              }}
              className="text-sm px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 transition"
            >
              Event
            </button>
            <button
              onClick={() => {
                setProfileModalOriginalFTP(currentFTP);
                setShowProfileModal(true);
              }}
              className="text-sm px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 transition"
            >
              Profile
            </button>
          </div>
        </div>
        {driveSyncStatus && (
          <div className={`text-sm mb-2 ${
            driveSyncStatus.status === 'error' ? 'text-red-400' : 'text-green-400'
          }`}>
            {driveSyncStatus.message}
          </div>
        )}
        <p className="text-gray-400 text-sm mb-4">
          FTP: {currentFTP}W
          {userProfile.weight > 0 && (
            <span> • {(currentFTP / (userProfile.weight / 2.20462)).toFixed(1)} W/kg</span>
          )}
          {currentEftp && (
            <span title={`Estimated from best 20-min power in the last 90 days (${currentEftp.peakRideName}, ${currentEftp.peakRideDate})`}>
              {' '}• eFTP: <span className="text-purple-400">{currentEftp.value}W</span>
            </span>
          )}
        </p>

        {/* Post-Log Summary Modal */}
        {showPostLogSummary && lastLoggedWorkout && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={closePostLogSummary}>
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
              <div className="text-4xl mb-3">
                {lastLoggedWorkout.change > 0 ? '📈' : lastLoggedWorkout.change < 0 ? '📉' : '➡️'}
              </div>
              <h2 className="font-bold text-xl mb-1">{getZoneName(lastLoggedWorkout.zone)}</h2>
              <p className="text-gray-400 text-sm mb-4">
                {getChangeDescription(lastLoggedWorkout.change, lastLoggedWorkout.rpe, lastLoggedWorkout.workoutLevel, lastLoggedWorkout.previousLevel)}
              </p>

              {lastLoggedWorkout.previousLevel != null && lastLoggedWorkout.newLevel != null ? (
                <>
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="text-right">
                      <div className="text-2xl font-mono text-gray-400">{lastLoggedWorkout.previousLevel.toFixed(1)}</div>
                      <div className="text-xs text-gray-500">Before</div>
                    </div>
                    <div className="text-2xl">→</div>
                    <div className="text-left">
                      <div className="text-2xl font-mono font-bold" style={{ color: getZoneColor(lastLoggedWorkout.zone) }}>
                        {lastLoggedWorkout.newLevel.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500">After</div>
                    </div>
                  </div>

                  <div
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-4 ${
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
                <div className="mb-4 text-gray-400 text-sm">
                  Recovery rides do not affect progression levels.
                </div>
              )}

              {/* Trickle effects from this workout */}
              {lastLoggedWorkout.trickleEffects && lastLoggedWorkout.trickleEffects.length > 0 && (
                <div className="mb-4 text-left bg-gray-700/30 rounded p-2">
                  <div className="text-xs text-gray-400 mb-1">Trickle bonus to adjacent zones:</div>
                  {lastLoggedWorkout.trickleEffects.map(({ zone: adjZone, amount }) => (
                    <div key={adjZone} className="text-xs text-green-500 flex justify-between">
                      <span>{getZoneName(adjZone)}</span>
                      <span>~+{amount.toFixed(2)} (from {getZoneName(lastLoggedWorkout.zone)} workout)</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-xs mb-4 bg-gray-700/50 rounded p-2">
                <div>
                  <div className="text-gray-400">TSS</div>
                  <div className="font-mono">{lastLoggedWorkout.tss}</div>
                </div>
                <div>
                  <div className="text-gray-400">IF</div>
                  <div className="font-mono">{lastLoggedWorkout.intensityFactor.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-400">RPE</div>
                  <div className="font-mono">{lastLoggedWorkout.rpe}/10</div>
                </div>
              </div>

              <button
                onClick={closePostLogSummary}
                className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition"
              >
                Continue
              </button>
            </div>
          </div>
        )}






        {/* Event Management Modal */}
        {showEventModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowEventModal(false)}>
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <h2 className="font-bold mb-4 text-lg">Event/Goal Management</h2>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Event Name</label>
                  <input
                    type="text"
                    value={eventFormData.name}
                    onChange={(e) => setEventFormData({ ...eventFormData, name: e.target.value })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                    placeholder="My Target Event"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={eventFormData.date}
                    onChange={(e) => setEventFormData({ ...eventFormData, date: e.target.value })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Distance (miles)</label>
                  <input
                    type="number"
                    value={eventFormData.distance}
                    onChange={(e) => setEventFormData({ ...eventFormData, distance: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                    min="0"
                    step="1"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Target CTL</label>
                  <input
                    type="number"
                    value={eventFormData.targetCTL}
                    onChange={(e) => setEventFormData({ ...eventFormData, targetCTL: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                    min="0"
                    step="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Recommended: 80-100 for long endurance events</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveEvent}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition"
                >
                  Save
                </button>
                {event.name && (
                  <button
                    onClick={handleDeleteEvent}
                    className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-medium transition"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={() => setShowEventModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Profile Settings Modal */}
        {/* Profile Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => { setShowProfileModal(false); }}>
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <h2 className="font-bold mb-4 text-lg">Profile Settings</h2>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">FTP (watts)</label>
                  <input
                    type="number"
                    value={currentFTP}
                    onChange={(e) => setCurrentFTP(parseInt(e.target.value) || 235)}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                    placeholder="235"
                    min="100"
                    max="500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Max HR (bpm)</label>
                    <input
                      type="number"
                      value={userProfile.maxHR || ''}
                      onChange={(e) => setUserProfile({ ...userProfile, maxHR: parseInt(e.target.value) || null })}
                      className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                      placeholder="185"
                      min="100"
                      max="220"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Resting HR (bpm)</label>
                    <input
                      type="number"
                      value={userProfile.restingHR || ''}
                      onChange={(e) => setUserProfile({ ...userProfile, restingHR: parseInt(e.target.value) || null })}
                      className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                      placeholder="55"
                      min="30"
                      max="100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Weight (lbs)</label>
                    <input
                      type="number"
                      value={userProfile.weight || ''}
                      onChange={(e) => setUserProfile({ ...userProfile, weight: parseFloat(e.target.value) || null })}
                      className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                      placeholder="154"
                      min="90"
                      max="330"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Age</label>
                    <input
                      type="number"
                      value={userProfile.age || ''}
                      onChange={(e) => setUserProfile({ ...userProfile, age: parseInt(e.target.value) || null })}
                      className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                      placeholder="40"
                      min="18"
                      max="90"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Sex</label>
                  <select
                    value={userProfile.sex}
                    onChange={(e) => setUserProfile({ ...userProfile, sex: e.target.value })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    // Check if FTP changed
                    if (profileModalOriginalFTP !== null && currentFTP !== profileModalOriginalFTP) {
                      const shouldReset = window.confirm(
                        `Your FTP changed from ${profileModalOriginalFTP}W to ${currentFTP}W.\n\n` +
                        `Would you like to reset your progression levels to 1.0?\n\n` +
                        `This is recommended when your FTP changes significantly.`
                      );
                      if (shouldReset) {
                        const resetLevels = {
                          endurance: 1.0,
                          tempo: 1.0,
                          sweetspot: 1.0,
                          threshold: 1.0,
                          vo2max: 1.0,
                          anaerobic: 1.0,
                        };
                        setLevels(resetLevels);
                        setDisplayLevels(resetLevels);
                        setLastWorkedDates({});
                      }
                    }
                    markDataChanged();
                    setShowProfileModal(false);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    // Revert FTP change on cancel
                    if (profileModalOriginalFTP !== null) {
                      setCurrentFTP(profileModalOriginalFTP);
                    }
                    setShowProfileModal(false);
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Progression Levels */}
        <div className="space-y-4">
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
              <div key={zone.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium flex items-center gap-2">
                    {zone.name}
                    {recentChange && recentChange.change !== 0 && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
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
                  <span className="text-gray-400">{getZoneDescription(zone.id, currentFTP)}</span>
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
                    className={`w-10 text-right font-mono font-bold text-sm ${animatingZone === zone.id ? 'animate-pulse' : ''}`}
                    style={{ color: zone.color }}
                  >
                    {displayValue.toFixed(1)}
                  </span>
                </div>
              </div>
              );
            })}


            {/* Consolidated Weekly Charts */}
            {(() => {
              const weeklyTSSData = calculateWeeklyTSS(history);
              const weeklyHoursData = calculateWeeklyHours(history);
              const monthlyElevationData = calculateMonthlyElevation(history);
              const eftpHistoryData = calculateEFTPHistory(history, eftpTimeline);

              const currentWeekTSS = weeklyTSSData.length > 0 ? weeklyTSSData[weeklyTSSData.length - 1].tss : 0;
              const currentWeekHours = weeklyHoursData.length > 0 ? weeklyHoursData[weeklyHoursData.length - 1].hours : 0;
              const currentMonthElevation = monthlyElevationData.length > 0
                ? monthlyElevationData[monthlyElevationData.length - 1].elevation
                : 0;
              // "Latest" mirrors the page header's currentEftp so there's one current number,
              // not the last chart month's peak.
              const latestEFTP = currentEftp ? currentEftp.value : null;

              // Check if any data exists
              const hasData = weeklyTSSData.length > 0 || weeklyHoursData.length > 0 || monthlyElevationData.length > 0 || eftpHistoryData.length > 0;

              if (!hasData) return null;

              // Tooltips
              const TSSTooltip = ({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm">
                      <p className="text-gray-300 mb-1">{data.label}</p>
                      <p className="text-blue-400 font-bold">{data.tss} TSS</p>
                      <p className="text-gray-500 text-xs">{data.workouts} rides</p>
                    </div>
                  );
                }
                return null;
              };

              const HoursTooltip = ({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  const hours = Math.floor(data.totalMinutes / 60);
                  const minutes = data.totalMinutes % 60;
                  return (
                    <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm">
                      <p className="text-gray-300 mb-1">{data.label}</p>
                      <p className="text-orange-400 font-bold">{hours}h {minutes}m</p>
                      <p className="text-gray-500 text-xs">{data.workouts} rides</p>
                    </div>
                  );
                }
                return null;
              };

              const ElevationTooltip = ({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm">
                      <p className="text-gray-300 mb-1">{data.label}</p>
                      <p className="text-green-400 font-bold">{data.elevation.toLocaleString()} ft</p>
                      <p className="text-gray-500 text-xs">{data.workouts} rides</p>
                    </div>
                  );
                }
                return null;
              };

              const EFTPTooltip = ({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm">
                      <p className="text-gray-300 mb-1">{data.label}</p>
                      <p className="text-purple-400 font-bold">{data.eFTP}W</p>
                      <p className="text-gray-500 text-xs">
                        {data.source === 'estimated'
                          ? `Best 20-min effort: ${data.rideName} (${parseDateLocal(data.peakDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
                          : 'Imported from intervals.icu'}
                      </p>
                    </div>
                  );
                }
                return null;
              };

              return (
                <div className="bg-gray-800 rounded-lg p-4">
                  {/* Tab Buttons */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setWeeklyChartView('hours')}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        weeklyChartView === 'hours'
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Hours
                    </button>
                    <button
                      onClick={() => setWeeklyChartView('tss')}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        weeklyChartView === 'tss'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      TSS
                    </button>
                    <button
                      onClick={() => setWeeklyChartView('elevation')}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        weeklyChartView === 'elevation'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Elevation
                    </button>
                    <button
                      onClick={() => setWeeklyChartView('eftp')}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        weeklyChartView === 'eftp'
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      eFTP
                    </button>
                  </div>

                  {/* Training Hours Chart */}
                  {weeklyChartView === 'hours' && weeklyHoursData.length > 0 && (
                    <>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium">Weekly Training Hours</h3>
                        <span className="text-sm text-gray-400">
                          This week: <span className="text-orange-400 font-bold">{currentWeekHours}h</span>
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={weeklyHoursData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#FB923C" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#FB923C" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis
                            dataKey="label"
                            stroke="#9CA3AF"
                            style={{ fontSize: '12px' }}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            stroke="#9CA3AF"
                            style={{ fontSize: '12px' }}
                            tickFormatter={(value) => `${value}h`}
                            width={45}
                          />
                          <Tooltip content={<HoursTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="hours"
                            stroke="#FB923C"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorHours)"
                            dot={{ fill: '#FB923C', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, fill: '#FB923C', stroke: '#fff', strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </>
                  )}

                  {/* TSS Chart */}
                  {weeklyChartView === 'tss' && weeklyTSSData.length > 0 && (
                    <>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium">Weekly TSS</h3>
                        <span className="text-sm text-gray-400">
                          This week: <span className="text-blue-400 font-bold">{currentWeekTSS}</span>
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={weeklyTSSData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorTSS" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis
                            dataKey="label"
                            stroke="#9CA3AF"
                            style={{ fontSize: '12px' }}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            stroke="#9CA3AF"
                            style={{ fontSize: '12px' }}
                            width={45}
                          />
                          <Tooltip content={<TSSTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="tss"
                            stroke="#3B82F6"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorTSS)"
                            dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </>
                  )}

                  {/* Elevation Chart */}
                  {weeklyChartView === 'elevation' && monthlyElevationData.length > 0 && (
                    <>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium">Monthly Elevation Gained (1 Year)</h3>
                        <span className="text-sm text-gray-400">
                          This month: <span className="text-green-400 font-bold">{currentMonthElevation.toLocaleString()} ft</span>
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={monthlyElevationData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorElevation" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22C55E" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#22C55E" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis
                            dataKey="month"
                            stroke="#9CA3AF"
                            style={{ fontSize: '12px' }}
                          />
                          <YAxis
                            stroke="#9CA3AF"
                            style={{ fontSize: '12px' }}
                            tickFormatter={(value) =>
                              value >= 1000
                                ? `${(value / 1000) % 1 === 0 ? value / 1000 : (value / 1000).toFixed(1)}k`
                                : `${value}`
                            }
                            width={55}
                          />
                          <Tooltip content={<ElevationTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="elevation"
                            stroke="#22C55E"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorElevation)"
                            dot={{ fill: '#22C55E', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, fill: '#22C55E', stroke: '#fff', strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </>
                  )}

                  {/* eFTP Chart */}
                  {weeklyChartView === 'eftp' && eftpHistoryData.length > 0 && (
                    <>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium">eFTP Progress (1 Year)</h3>
                        <span className="text-sm text-gray-400">
                          Latest: <span className="text-purple-400 font-bold">{latestEFTP != null ? `${latestEFTP}W` : '—'}</span>
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={eftpHistoryData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorEFTP" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#A855F7" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#A855F7" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis
                            dataKey="month"
                            stroke="#9CA3AF"
                            style={{ fontSize: '12px' }}
                          />
                          <YAxis
                            stroke="#9CA3AF"
                            style={{ fontSize: '12px' }}
                            tickFormatter={(value) => `${value}W`}
                            domain={['dataMin - 10', 'dataMax + 10']}
                            width={55}
                          />
                          <Tooltip content={<EFTPTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="eFTP"
                            stroke="#A855F7"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorEFTP)"
                            dot={(props) => {
                              const isImported = props.payload?.source === 'imported';
                              return (
                                <circle
                                  key={props.index}
                                  cx={props.cx}
                                  cy={props.cy}
                                  r={4}
                                  fill={isImported ? '#1F2937' : '#A855F7'}
                                  stroke="#A855F7"
                                  strokeWidth={2}
                                />
                              );
                            }}
                            activeDot={{ r: 6, fill: '#A855F7', stroke: '#fff', strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </>
                  )}

                  {weeklyChartView === 'eftp' && eftpHistoryData.length === 0 && (
                    <div className="text-center text-gray-400 py-8">
                      <p>No eFTP data available.</p>
                      <p className="text-sm mt-2">Import a FIT or TCX file that includes a 20-minute or longer effort.</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Power Skills Radar Chart */}
            {powerCurveData && powerCurveData.length > 0 && (() => {
              // Population reference: intervals.icu age-40 cohort
              // Each entry: secs, label, skill, refWatts (user's known watts), refPct (population percentile)
              // 30s and 10m interpolated from adjacent known data points; 30m interpolated from 20m and 60m
              const POWER_SKILLS = [
                { secs: 5, label: '5s', skill: 'Sprint', refWatts: 712, refPct: 44.9 },
                { secs: 30, label: '30s', skill: 'Sprint', refWatts: 553, refPct: 42.6 },
                { secs: 60, label: '1m', skill: 'Sprint', refWatts: 362, refPct: 39.8 },
                { secs: 300, label: '5m', skill: 'Attack', refWatts: 293, refPct: 53.9 },
                { secs: 600, label: '10m', skill: 'Attack', refWatts: 265, refPct: 44.0 },
                { secs: 1200, label: '20m', skill: 'Attack', refWatts: 209, refPct: 24.2 },
                { secs: 1800, label: '30m', skill: 'Climb', refWatts: 203, refPct: 24.6 },
                { secs: 3600, label: '1h', skill: 'Climb', refWatts: 184, refPct: 25.8 },
                { secs: 7200, label: '2h', skill: 'Climb', refWatts: 158, refPct: 24.2 },
              ];

              // Find closest match in power curve data for each target duration
              const findWatts = (targetSecs) => {
                let closest = powerCurveData[0];
                let minDiff = Math.abs(powerCurveData[0].secs - targetSecs);
                for (const point of powerCurveData) {
                  const diff = Math.abs(point.secs - targetSecs);
                  if (diff < minDiff) {
                    minDiff = diff;
                    closest = point;
                  }
                }
                return closest.watts;
              };

              // Estimate percentile by proportional scaling from reference data point
              const radarData = POWER_SKILLS.map(s => {
                const watts = findWatts(s.secs);
                const percentile = Math.min(100, Math.round(s.refPct * (watts / s.refWatts) * 10) / 10);
                return {
                  label: s.label,
                  skill: s.skill,
                  watts,
                  percentile,
                };
              });

              // Dynamic domain: round max percentile up to nearest 10 so polygon fills the chart
              const maxPct = Math.max(...radarData.map(d => d.percentile));
              const domainMax = Math.ceil(maxPct / 10) * 10;
              const maxWatts = Math.max(...radarData.map(d => d.watts));

              // Custom tooltip for radar
              const RadarTooltip = ({ active, payload }) => {
                if (active && payload && payload.length > 0) {
                  const d = payload[0].payload;
                  const color = d.skill === 'Sprint' ? '#60A5FA' : d.skill === 'Attack' ? '#4ADE80' : '#FB923C';
                  return (
                    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-lg">
                      <p style={{ color }} className="font-semibold text-sm">{d.label} — {d.skill}</p>
                      <p className="text-gray-300 text-sm">{d.watts}W</p>
                      <p className="text-gray-400 text-xs">Top {d.percentile}%</p>
                    </div>
                  );
                }
                return null;
              };

              // --- Phenotype determination ---
              const sprintAvg = radarData.filter(d => d.skill === 'Sprint').reduce((s, d) => s + d.percentile, 0) / 3;
              const attackAvg = radarData.filter(d => d.skill === 'Attack').reduce((s, d) => s + d.percentile, 0) / 3;
              const climbAvg = radarData.filter(d => d.skill === 'Climb').reduce((s, d) => s + d.percentile, 0) / 3;
              const overallAvg = (sprintAvg + attackAvg + climbAvg) / 3;
              const maxCat = Math.max(sprintAvg, attackAvg, climbAvg);
              const minCat = Math.min(sprintAvg, attackAvg, climbAvg);
              const spread = maxCat - minCat;

              // Short-burst dominance: weight the 5s and 30s points more heavily
              const shortBurstAvg = (radarData[0].percentile * 1.5 + radarData[1].percentile * 1.25 + radarData[2].percentile * 0.75) / 3.5;
              // Sustained power: 20m, 30m, 1h
              const sustainedAvg = (radarData.find(d => d.label === '20m').percentile + radarData.find(d => d.label === '30m').percentile + radarData.find(d => d.label === '1h').percentile) / 3;
              // Long endurance: 1h, 2h
              const enduranceAvg = (radarData.find(d => d.label === '1h').percentile + radarData.find(d => d.label === '2h').percentile) / 2;

              let phenotype, phenoColor, phenoExplanation;

              if (spread < 8) {
                phenotype = 'All-Rounder';
                phenoColor = '#A855F7'; // purple
                phenoExplanation = `You're an All-Rounder because your power is evenly distributed across all effort durations. Your Sprint (${sprintAvg.toFixed(0)}%), Attack (${attackAvg.toFixed(0)}%), and Climb (${climbAvg.toFixed(0)}%) scores are all within ${spread.toFixed(0)} percentage points — no single weakness, no single dominance. You can compete across varied terrain and race situations.`;
              } else if (shortBurstAvg > attackAvg && shortBurstAvg > climbAvg && sprintAvg >= attackAvg * 1.15) {
                phenotype = 'Sprinter';
                phenoColor = '#60A5FA'; // blue
                phenoExplanation = `You're a Sprinter because you excel in short, explosive efforts. Your short-burst power (5s–1m) ranks in the top ${sprintAvg.toFixed(0)}%, significantly above your Attack (${attackAvg.toFixed(0)}%) and Climb (${climbAvg.toFixed(0)}%) scores. You generate your highest relative power in efforts under 1 minute.`;
              } else if (sprintAvg > climbAvg && attackAvg > climbAvg && sprintAvg >= attackAvg * 0.9) {
                phenotype = 'Puncheur';
                phenoColor = '#4ADE80'; // green
                phenoExplanation = `You're a Puncheur because you're strong in repeated, punchy surges. Your Sprint (${sprintAvg.toFixed(0)}%) and Attack (${attackAvg.toFixed(0)}%) power are both well above your Climb endurance (${climbAvg.toFixed(0)}%). You thrive on short, steep climbs and rolling terrain where quick bursts of power make the difference.`;
              } else if (attackAvg >= sprintAvg && attackAvg >= climbAvg && sustainedAvg > enduranceAvg) {
                phenotype = 'Rouleur';
                phenoColor = '#FB923C'; // orange
                phenoExplanation = `You're a Rouleur because you're powerful and consistent over flat and rolling terrain. Your Attack power (${attackAvg.toFixed(0)}%) leads your profile, with strong 5–20 minute sustained efforts (${sustainedAvg.toFixed(0)}%). You excel at setting tempo, driving breakaways, and maintaining high power when others fade.`;
              } else if (climbAvg >= sprintAvg && sustainedAvg >= attackAvg * 0.95 && enduranceAvg > sprintAvg) {
                phenotype = 'Time Trialist';
                phenoColor = '#F472B6'; // pink
                phenoExplanation = `You're a Time Trialist because you excel at steady, sustained solo efforts. Your sustained power across 20–60 minutes (${sustainedAvg.toFixed(0)}%) and endurance (${enduranceAvg.toFixed(0)}%) are your defining strengths. You don't rely on sprints or surges — instead you maintain a smooth, controlled effort over long durations.`;
              } else if (climbAvg >= attackAvg && climbAvg > sprintAvg) {
                phenotype = 'Climber';
                phenoColor = '#FB923C'; // orange
                phenoExplanation = `You're a Climber because you thrive when the road tilts upward. Your Climb power (${climbAvg.toFixed(0)}%) leads your profile, well above Sprint (${sprintAvg.toFixed(0)}%). Your endurance at 30m–2h durations (${enduranceAvg.toFixed(0)}%) shows you can sustain high intensity on long ascents where power-to-weight matters most.`;
              } else {
                phenotype = 'All-Rounder';
                phenoColor = '#A855F7';
                phenoExplanation = `You're an All-Rounder with a balanced power profile. Sprint (${sprintAvg.toFixed(0)}%), Attack (${attackAvg.toFixed(0)}%), Climb (${climbAvg.toFixed(0)}%) — you don't have a single standout specialty, but your versatility lets you compete across different race situations and terrain types.`;
              }

              return (
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-medium">Power Skills</h3>
                    <button
                      onClick={() => setShowPhenotypeModal(true)}
                      className="w-2/5 px-3 py-2 rounded-md text-base font-medium transition-colors text-center"
                      style={{ backgroundColor: phenoColor + '22', color: phenoColor, border: `1px solid ${phenoColor}44` }}
                    >
                      Rider Type: {phenotype}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    <span className="text-blue-400">Sprint</span> · <span className="text-green-400">Attack</span> · <span className="text-orange-400">Climb</span>
                    <span className="ml-2 text-gray-500">— vs. intervals.icu age 40</span>
                  </p>
                  <div className="flex">
                    {/* Radar chart - 3/5 width */}
                    <div className="w-3/5">
                      <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                          <PolarGrid stroke="#374151" />
                          <PolarAngleAxis
                            dataKey="label"
                            tick={({ x, y, payload, index }) => {
                              const d = radarData[index];
                              const color = d.skill === 'Sprint' ? '#60A5FA' : d.skill === 'Attack' ? '#4ADE80' : '#FB923C';
                              return (
                                <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={12} fontWeight="600">
                                  {payload.value}
                                </text>
                              );
                            }}
                          />
                          <PolarRadiusAxis domain={[0, domainMax]} tick={false} axisLine={false} />
                          <Tooltip content={<RadarTooltip />} />
                          <Radar
                            dataKey="percentile"
                            stroke="#A855F7"
                            fill="#A855F7"
                            fillOpacity={0.35}
                            strokeWidth={2}
                            dot={{ fill: '#A855F7', r: 3 }}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Horizontal power bars - 2/5 width */}
                    <div className="w-2/5 flex flex-col justify-center gap-1.5 pl-2">
                      {radarData.map((d, i) => {
                        const color = d.skill === 'Sprint' ? '#60A5FA' : d.skill === 'Attack' ? '#4ADE80' : '#FB923C';
                        const barPct = maxWatts > 0 ? (d.watts / maxWatts) * 100 : 0;
                        return (
                          <div key={i} className="group relative flex items-center gap-2">
                            <span className="text-xs w-7 text-right shrink-0" style={{ color }}>{d.label}</span>
                            <div className="flex-1 bg-gray-700 rounded-full h-3 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${barPct}%`, backgroundColor: color }}
                              />
                            </div>
                            {/* Hover tooltip */}
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block z-10">
                              <div className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap">
                                <p className="font-semibold text-xs" style={{ color }}>{d.label} — {d.skill}</p>
                                <p className="text-gray-300 text-xs">{d.watts}W</p>
                                <p className="text-gray-400 text-xs">Top {d.percentile}%</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Phenotype Modal */}
                  {showPhenotypeModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowPhenotypeModal(false)}>
                      <div className="bg-gray-800 rounded-lg p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                          <h2 className="font-bold text-lg" style={{ color: phenoColor }}>Rider Type: {phenotype}</h2>
                          <button
                            onClick={() => setShowPhenotypeModal(false)}
                            className="text-gray-400 hover:text-white text-xl"
                          >
                            ×
                          </button>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed mb-4">{phenoExplanation}</p>
                        <div className="bg-gray-700 rounded p-3 mb-4">
                          <p className="text-xs text-gray-400 mb-2">Category Scores (avg percentile)</p>
                          <div className="flex justify-between text-sm">
                            <span><span className="text-blue-400">Sprint:</span> {sprintAvg.toFixed(1)}%</span>
                            <span><span className="text-green-400">Attack:</span> {attackAvg.toFixed(1)}%</span>
                            <span><span className="text-orange-400">Climb:</span> {climbAvg.toFixed(1)}%</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">Your rider type is determined by comparing your relative power across Sprint (5s–1m), Attack (5–20m), and Climb (30m–2h) durations. As your training evolves, your rider type may shift.</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Training Load Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">CTL (Fitness)</div>
                <div className="text-2xl font-bold text-blue-400">{loads.ctl}</div>
                <div className="text-xs text-gray-500">42-day avg</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">ATL (Fatigue)</div>
                <div className="text-2xl font-bold text-orange-400">{loads.atl}</div>
                <div className="text-xs text-gray-500">7-day avg</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">TSB (Form)</div>
                <div className="text-2xl font-bold" style={{ color: tsbStatus.color }}>
                  {loads.tsb > 0 ? '+' : ''}{loads.tsb}
                </div>
                <div className="text-xs" style={{ color: tsbStatus.color }}>{tsbStatus.label}</div>
              </div>
            </div>

            {/* Fitness Progress */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-medium mb-2">Fitness Progress</h3>
              {(() => {
                const target = event.targetCTL > 0 ? event.targetCTL : 100;
                const daysToEvent = getDaysUntilEvent();
                return (
                  <>
                    <div className="text-xs text-gray-400 mb-2">
                      {daysToEvent !== null ? `Days to Event: ${daysToEvent} | ` : ''}
                      Target CTL: {target}
                    </div>
                    <div className="w-full">
                      <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (loads.ctl / target) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0</span>
                        <span>Current: {loads.ctl}</span>
                        <span>{target}</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Training Summary + Training Status (side by side) */}
            <div className="grid grid-cols-2 gap-3">
              {/* Training Summary */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-medium mb-3">Training Summary</h3>
                {(() => {
                  const thirtyDaysAgo = new Date();
                  thirtyDaysAgo.setHours(0, 0, 0, 0);
                  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                  const fourteenDaysAgo = new Date();
                  fourteenDaysAgo.setHours(0, 0, 0, 0);
                  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
                  const outdoorRides = history.filter(w =>
                    parseDateLocal(w.date) >= thirtyDaysAgo &&
                    w.rideType === 'Outdoor' &&
                    w.distance > 0
                  );
                  const longestRide = outdoorRides.length > 0
                    ? outdoorRides.reduce((max, w) => w.distance > max.distance ? w : max, outdoorRides[0])
                    : null;

                  return (
                    <div className="space-y-3 text-xs">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-gray-400">TSS</span>
                        <span className="font-bold text-base">{loads.weeklyTSS}</span>
                        <span className="text-gray-500">7d</span>
                        <span className="font-bold text-base">{loads.twoWeekTSS}</span>
                        <span className="text-gray-500">14d</span>
                        <span className="font-bold text-base">{last28Days.reduce((sum, w) => sum + (w.tss || 0), 0)}</span>
                        <span className="text-gray-500">28d</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-gray-400">Longest (30d)</span>
                        {longestRide ? (
                          <>
                            <span className="font-bold text-base">{longestRide.duration} min</span>
                            <span className="text-gray-500">•</span>
                            <span className="font-bold text-base">{longestRide.distance} mi</span>
                          </>
                        ) : (
                          <span className="text-gray-600 font-bold text-base">--</span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Training Status */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-medium mb-3">Training Status</h3>
                <div className="flex flex-col items-center justify-center h-[calc(100%-2rem)]">
                  <span
                    className="inline-block px-3 py-1 rounded-full text-sm font-semibold mb-2"
                    style={{ backgroundColor: trainingStatus.color + '22', color: trainingStatus.color, border: `1px solid ${trainingStatus.color}44` }}
                  >
                    {trainingStatus.label}
                  </span>
                  {loads.ctl >= 35 && (
                    <span className="text-xs text-gray-400">
                      TSB% {loads.ctl > 0 ? ((loads.tsb / loads.ctl) * 100).toFixed(0) : 0}%
                    </span>
                  )}
                  <button
                    onClick={copyForAnalysis}
                    className={`mt-3 text-xs px-3 py-1 rounded transition ${
                      copySuccess
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {copySuccess ? 'Copied!' : 'Copy for Claude'}
                  </button>
                </div>
              </div>
            </div>

            {/* Monthly Activity Calendar */}
            <div className="bg-gray-800 rounded-lg p-4">
              {/* Header: nav arrows + month/year */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => {
                    setCalendarPopup(null);
                    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(calendarYear - 1); }
                    else { setCalendarMonth(calendarMonth - 1); }
                  }}
                  className="text-gray-400 hover:text-white px-2 py-1 transition"
                >
                  &#9664;
                </button>
                <h3 className="font-medium">
                  {new Date(calendarYear, calendarMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <button
                  onClick={() => {
                    setCalendarPopup(null);
                    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(calendarYear + 1); }
                    else { setCalendarMonth(calendarMonth + 1); }
                  }}
                  className="text-gray-400 hover:text-white px-2 py-1 transition"
                >
                  &#9654;
                </button>
              </div>

              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 text-center text-xs text-gray-500 mb-2">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <div key={i} className="py-1">{d}</div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 gap-1">
                {getCalendarDays(calendarYear, calendarMonth).map((dayObj, i) => {
                  const hasRide = rideDatesSet.has(dayObj.dateStr);
                  const todayStr = toLocalDateStr(new Date());
                  const isToday = dayObj.dateStr === todayStr;

                  return (
                    <div key={i} className="flex items-center justify-center py-0.5">
                      <div
                        onClick={hasRide ? () => setCalendarPopup(calendarPopup?.dateStr === dayObj.dateStr ? null : { dateStr: dayObj.dateStr }) : undefined}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors ${hasRide ? 'cursor-pointer' : ''} ${
                          hasRide && dayObj.isCurrentMonth
                            ? 'bg-blue-500 text-white font-bold hover:bg-blue-400'
                            : hasRide && !dayObj.isCurrentMonth
                            ? 'bg-blue-500/40 text-gray-400 hover:bg-blue-500/60'
                            : !hasRide && dayObj.isCurrentMonth
                            ? 'border border-gray-600 text-gray-400'
                            : 'text-gray-700'
                        } ${
                          isToday && !hasRide
                            ? 'border-2 border-blue-400 text-blue-400'
                            : isToday && hasRide
                            ? 'ring-2 ring-blue-300'
                            : ''
                        } ${
                          calendarPopup?.dateStr === dayObj.dateStr ? 'ring-2 ring-white' : ''
                        }`}
                      >
                        {hasRide ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                            <circle cx="6" cy="17" r="3" />
                            <circle cx="18" cy="17" r="3" />
                            <path d="M6 17L9 7h4l3 10M9 7l3 10 2-6" />
                          </svg>
                        ) : (
                          dayObj.day
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ride popup — shown when a ride day is clicked */}
              {calendarPopup && ridesByDate[calendarPopup.dateStr] && (
                <div className="mt-3 border-t border-gray-700 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">{formatDateWithDay(calendarPopup.dateStr)}</span>
                    <button
                      onClick={() => setCalendarPopup(null)}
                      className="text-gray-500 hover:text-gray-300 text-xs leading-none px-1"
                      aria-label="Close"
                    >✕</button>
                  </div>
                  {ridesByDate[calendarPopup.dateStr].map(ride => {
                    const zone = ZONES.find(z => z.id === ride.zone);
                    return (
                      <div key={ride.id} className="flex items-center justify-between py-1.5 border-b border-gray-700/50 last:border-0">
                        <div className="min-w-0 pr-2">
                          <div className="text-sm text-white truncate">{ride.name || 'Untitled Ride'}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {ride.rideType || 'Indoor'}
                            {zone ? <span> · <span style={{ color: zone.color }}>{zone.name}</span></span> : <span className="text-yellow-500"> · Unclassified</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => { setCalendarPopup(null); handleEditRide(ride.id); }}
                          className="flex-shrink-0 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-2 py-1 rounded transition"
                        >Edit Ride →</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Ride History Button */}
            <div className="pt-4 border-t border-gray-700">
              <button
                onClick={() => setShowHistoryModal(true)}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-4 py-2 rounded text-sm transition border border-gray-600 hover:border-gray-500"
              >
                Ride History
              </button>
            </div>

            {/* Workout Progression Button */}
            <div className="pt-2">
              <button
                onClick={() => { setProgressionCategory(null); setShowProgressionModal(true); }}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-4 py-2 rounded text-sm transition border border-gray-600 hover:border-gray-500"
              >
                📈 Workout Progression
              </button>
            </div>
        </div>

        {/* Log Ride Modal */}
        {showLogRideModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => editingRide ? handleCancelEdit() : closeLogRideModal()}>
            <div className="bg-gray-800 rounded-lg p-4 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold">{editingRide ? 'Edit Workout' : 'Log Workout'}</h2>
                <button
                  onClick={() => editingRide ? handleCancelEdit() : closeLogRideModal()}
                  className="text-gray-400 hover:text-white text-xl"
                >
                  ×
                </button>
              </div>

            {/* FIT file import — pre-fills Date/Duration/NP/Distance/Elevation/Ride Type below; Zone/Name/RPE stay manual */}
            <div className="mb-4">
              <label className="inline-block bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm px-3 py-2 rounded cursor-pointer transition">
                📁 Import FIT/TCX File
                <input type="file" accept=".fit,.FIT,.tcx,.TCX" onChange={handleFitFileImport} className="hidden" />
              </label>
              {pendingFitDetail && (
                <div className="mt-2 bg-gray-700 rounded p-2 flex items-start justify-between gap-2">
                  <div className="text-sm">
                    {pendingFitDetail.detection ? (
                      <>
                        <div className="text-yellow-400 font-mono">⚡ Detected: {pendingFitDetail.detection.label}</div>
                        <div className="text-gray-400 text-xs mt-0.5">
                          {getZoneName(pendingFitDetail.detection.category)} interval — will be saved with this ride.
                          Adjust the Zone above if the category looks wrong.
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-400 text-xs">
                        No structured intervals detected — power/HR chart will still be saved.
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setPendingFitDetail(null)}
                    className="text-gray-400 hover:text-white text-sm flex-shrink-0"
                    title="Discard interval data"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Row 1: Ride Name | Date */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Ride Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                  placeholder="e.g., Morning Ride"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-gray-700 rounded px-2 py-2 text-sm"
                />
              </div>
            </div>

            {/* Row 2: Ride Type | Completed All Intervals */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Ride Type</label>
                <select
                  value={formData.rideType}
                  onChange={(e) => setFormData({ ...formData, rideType: e.target.value })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                >
                  <option value="Indoor">Indoor</option>
                  <option value="Outdoor">Outdoor</option>
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className={`flex items-center gap-2 text-sm ${formData.rideType === 'Outdoor' ? 'text-gray-600' : ''}`}>
                  <input
                    type="checkbox"
                    checked={formData.rideType === 'Outdoor' ? false : formData.completed}
                    onChange={(e) => setFormData({ ...formData, completed: e.target.checked })}
                    className="rounded"
                    disabled={formData.rideType === 'Outdoor'}
                  />
                  Completed all intervals
                </label>
              </div>
            </div>

            {/* Row 3: Primary Zone | Normalized Power */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={`block text-sm mb-1 ${formData.rideType === 'Outdoor' ? 'text-gray-600' : 'text-gray-400'}`}>Primary Zone</label>
                <select
                  value={formData.zone}
                  onChange={(e) => setFormData({
                    ...formData,
                    zone: e.target.value,
                    workoutLevel: ZONE_EXPECTED_RPE[e.target.value]
                  })}
                  className={`w-full rounded px-3 py-2 text-sm ${formData.rideType === 'Outdoor' ? 'bg-gray-800 text-gray-600' : 'bg-gray-700'}`}
                  disabled={formData.rideType === 'Outdoor'}
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
                  value={formData.normalizedPower || ''}
                  onChange={(e) => setFormData({ ...formData, normalizedPower: parseInt(e.target.value) || 0 })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                  min="50"
                  max="500"
                />
              </div>
            </div>

            {/* Row 4: Duration | Distance | Elevation */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Duration (min)</label>
                <input
                  type="text"
                  value={formData.duration || ''}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  onBlur={(e) => setFormData({ ...formData, duration: parseDuration(e.target.value) || 0 })}
                  placeholder="e.g. 71 or 1h11"
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className={`block text-sm mb-1 ${formData.rideType === 'Indoor' ? 'text-gray-600' : 'text-gray-400'}`}>Distance (mi)</label>
                <input
                  type="number"
                  value={formData.rideType === 'Indoor' ? '' : (formData.distance || '')}
                  onChange={(e) => setFormData({ ...formData, distance: parseFloat(e.target.value) || 0 })}
                  className={`w-full rounded px-3 py-2 text-sm ${formData.rideType === 'Indoor' ? 'bg-gray-800 text-gray-600' : 'bg-gray-700'}`}
                  min="0"
                  step="0.1"
                  max="200"
                  disabled={formData.rideType === 'Indoor'}
                />
              </div>
              <div>
                <label className={`block text-sm mb-1 ${formData.rideType === 'Indoor' ? 'text-gray-600' : 'text-gray-400'}`}>Elevation (ft)</label>
                <input
                  type="number"
                  value={formData.rideType === 'Indoor' ? '' : (formData.elevation || '')}
                  onChange={(e) => setFormData({ ...formData, elevation: parseInt(e.target.value) || 0 })}
                  className={`w-full rounded px-3 py-2 text-sm ${formData.rideType === 'Indoor' ? 'bg-gray-800 text-gray-600' : 'bg-gray-700'}`}
                  min="0"
                  max="20000"
                  disabled={formData.rideType === 'Indoor'}
                />
              </div>
            </div>

            {/* Row 5: RPE Slider */}
            <div className="mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  RPE: {formData.rpe} <span className="text-gray-500 text-xs">(Expected {formData.workoutLevel})</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={formData.rpe}
                  onChange={(e) => setFormData({ ...formData, rpe: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Easy</span>
                  <span>Hard</span>
                </div>
              </div>
            </div>

            {/* Calculated values preview */}
            <div className="bg-gray-700 rounded p-3 mb-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Estimated TSS: </span>
                <span className="font-mono font-bold">{currentTSS}</span>
              </div>
              <div>
                <span className="text-gray-400">Intensity Factor: </span>
                <span className="font-mono font-bold">{currentIF.toFixed(2)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="How it felt, weather, etc..."
                className="w-full bg-gray-700 rounded px-3 py-2 text-sm h-20"
              />
            </div>

            <button
              onClick={handleLogWorkout}
              className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-medium transition"
            >
              {editingRide ? 'Update Workout' : 'Save Workout'}
            </button>
            </div>
          </div>
        )}

        {/* History Modal */}
        {showHistoryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowHistoryModal(false)}>
            <div className="bg-gray-800 rounded-lg p-4 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold">Ride History</h2>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="text-gray-400 hover:text-white text-xl"
                >
                  ×
                </button>
              </div>
            {history.length === 0 ? (
              <p className="text-gray-400 text-sm">No workouts logged yet.</p>
            ) : (
              <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                {history.map((entry) => (
                  <div key={entry.id} className="bg-gray-700 rounded p-3 text-sm relative">
                    <div className="absolute top-2 right-2 flex gap-1">
                      {(entry.stream || entry.intervalData) && (
                        <button
                          onClick={() => { setShowHistoryModal(false); setShowWorkoutDetail(entry.id); }}
                          className="text-gray-400 hover:text-yellow-400 transition text-xs px-2 py-1 rounded hover:bg-gray-600"
                          title="View workout detail"
                        >
                          📊
                        </button>
                      )}
                      <button
                        onClick={() => handleEditRide(entry.id)}
                        className="text-gray-400 hover:text-blue-400 transition text-xs px-2 py-1 rounded hover:bg-gray-600"
                        title="Edit workout"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteWorkout(entry.id)}
                        className="text-gray-400 hover:text-red-400 transition text-xs px-2 py-1 rounded hover:bg-gray-600"
                        title="Delete workout"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Title row: Name - Indoor/Outdoor - Zone (if indoor) • ID • Flags */}
                    <div className="flex justify-between items-start mb-2 pr-16">
                      <div className="flex-1">
                        <div className="font-medium">
                          {entry.name || entry.notes || 'Workout'} - {entry.rideType || 'Indoor'}{entry.rideType !== 'Outdoor' && entry.zone ? ` - ${getZoneName(entry.zone)}` : entry.rideType !== 'Outdoor' && !entry.zone ? ' - Unclassified' : ''}
                          {entry.intervalData?.label && (
                            <span className="text-yellow-400 text-xs ml-2 font-mono">{entry.intervalData.label}</span>
                          )}
                          {entry.elevation > 2999 && (
                            <span className="ml-2" title="Big Climb">🏔️</span>
                          )}
                          {entry.duration > 180 && (
                            <span className="ml-2" title="Long Ride">🛣️</span>
                          )}
                        </div>
                        <div className="text-gray-400 text-xs">{formatDateWithDay(entry.date)}</div>
                      </div>
                    </div>

                    {/* Stats grid with Distance and Elevation */}
                    <div className="grid grid-cols-6 gap-2 text-xs mb-2">
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
                    <div className="flex justify-between text-xs">
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
                        <span className={entry.change > 0 ? 'text-green-400' : entry.change < 0 ? 'text-red-400' : 'text-gray-400'}>
                          {entry.previousLevel.toFixed(1)} → {entry.newLevel.toFixed(1)} ({formatChange(entry.change)})
                        </span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        )}

        {/* Workout Detail Modal */}
        {showWorkoutDetail !== null && (() => {
          const detailRide = history.find(w => w.id === showWorkoutDetail);
          if (!detailRide) return null;
          const chartData = detailRide.stream
            ? detailRide.stream.power.map((p, i) => ({
                min: Math.round((i * detailRide.stream.binSeconds) / 60 * 10) / 10,
                power: p,
                hr: detailRide.stream.hr[i],
              }))
            : [];
          const hasHR = detailRide.stream && detailRide.stream.hr.some(v => v != null);

          const DetailTooltip = ({ active, payload, label }) => {
            if (active && payload && payload.length) {
              const powerEntry = payload.find(p => p.dataKey === 'power');
              const hrEntry = payload.find(p => p.dataKey === 'hr');
              return (
                <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm">
                  <p className="text-gray-300 mb-1">{label} min</p>
                  {powerEntry?.value != null && <p className="text-blue-400 font-bold">{powerEntry.value}W</p>}
                  {hrEntry?.value != null && <p className="text-red-400 font-bold">{hrEntry.value} bpm</p>}
                </div>
              );
            }
            return null;
          };

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowWorkoutDetail(null)}>
              <div className="bg-gray-800 rounded-lg p-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="font-bold">{detailRide.name || detailRide.notes || 'Workout'}</h2>
                    <div className="text-gray-400 text-xs">{formatDateWithDay(detailRide.date)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {detailRide.stream && (
                      <button
                        onClick={() => handleRedetectRide(detailRide.id)}
                        className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-2.5 py-1.5 rounded transition"
                        title="Re-run interval detection on this ride's saved power data"
                      >
                        🔍 Re-detect
                      </button>
                    )}
                    <button
                      onClick={() => setShowWorkoutDetail(null)}
                      className="text-gray-400 hover:text-white text-xl"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Summary row */}
                <div className="grid grid-cols-5 gap-2 text-xs mb-4 bg-gray-700 rounded p-3">
                  <div>
                    <span className="text-gray-400">Duration</span>
                    <div className="font-mono">{detailRide.duration}min</div>
                  </div>
                  <div>
                    <span className="text-gray-400">NP</span>
                    <div className="font-mono">{detailRide.normalizedPower}W</div>
                  </div>
                  <div>
                    <span className="text-gray-400">TSS</span>
                    <div className="font-mono">{detailRide.tss}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">IF</span>
                    <div className="font-mono">{detailRide.intensityFactor?.toFixed(2) ?? '—'}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Intervals</span>
                    <div className="font-mono text-yellow-400">{detailRide.intervalData?.label || '—'}</div>
                  </div>
                </div>

                {/* Power/HR chart */}
                {detailRide.stream ? (
                  <div className="mb-4">
                    <ResponsiveContainer width="100%" height={220}>
                      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="min"
                          type="number"
                          domain={['dataMin', 'dataMax']}
                          stroke="#9CA3AF"
                          style={{ fontSize: '12px' }}
                          tickFormatter={(v) => `${Math.round(v)}`}
                          label={{ value: 'min', position: 'insideBottomRight', offset: -5, fill: '#9CA3AF', fontSize: 11 }}
                        />
                        <YAxis
                          yAxisId="power"
                          stroke="#3B82F6"
                          style={{ fontSize: '12px' }}
                          tickFormatter={(v) => `${v}W`}
                          width={50}
                        />
                        {hasHR && (
                          <YAxis
                            yAxisId="hr"
                            orientation="right"
                            stroke="#EF4444"
                            style={{ fontSize: '12px' }}
                            tickFormatter={(v) => `${v}`}
                            width={40}
                          />
                        )}
                        <Tooltip content={<DetailTooltip />} />
                        {detailRide.intervalData?.segments?.map((seg, i) => (
                          <ReferenceArea
                            key={i}
                            yAxisId="power"
                            x1={seg.startSec / 60}
                            x2={seg.endSec / 60}
                            fill="#EAB308"
                            fillOpacity={0.12}
                            strokeOpacity={0}
                          />
                        ))}
                        <Area
                          yAxisId="power"
                          type="stepAfter"
                          dataKey="power"
                          name="Power"
                          stroke="#3B82F6"
                          fill="#3B82F6"
                          fillOpacity={0.25}
                          dot={false}
                          connectNulls
                        />
                        {hasHR && (
                          <Line
                            yAxisId="hr"
                            type="monotone"
                            dataKey="hr"
                            name="Heart Rate"
                            stroke="#EF4444"
                            dot={false}
                            strokeWidth={1.5}
                            connectNulls
                          />
                        )}
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm mb-4">No power/HR stream saved for this ride.</p>
                )}

                {/* Interval table */}
                {detailRide.intervalData?.segments?.length > 0 && (
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-gray-300 mb-2">Detected Intervals</h3>
                    {detailRide.intervalData.segments.map((seg, i) => (
                      <div key={i} className="bg-gray-700 rounded px-3 py-2 flex justify-between text-xs font-mono">
                        <span className="text-gray-400">#{i + 1}</span>
                        <span>{Math.floor((seg.endSec - seg.startSec) / 60)}:{String((seg.endSec - seg.startSec) % 60).padStart(2, '0')}</span>
                        <span className="text-blue-400">{seg.avgWatts}W</span>
                        <span className="text-red-400">{seg.avgHR != null ? `${seg.avgHR} bpm` : '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Interval Progression Modal */}
        {showProgressionModal && (() => {
          const progressionZones = ZONES.filter(z => z.id !== 'recovery');
          const activeZone = ZONES.find(z => z.id === progressionCategory);

          const sessionsAsc = history
            .filter(w => w.intervalData?.category === progressionCategory)
            .slice()
            .sort((a, b) => parseDateLocal(a.date) - parseDateLocal(b.date));
          const sessionsDesc = sessionsAsc.slice().reverse();

          // Default view (no zone selected yet): most recent indoor workouts, any zone.
          const recentIndoor = history
            .filter(w => w.rideType !== 'Outdoor')
            .slice()
            .sort((a, b) => parseDateLocal(b.date) - parseDateLocal(a.date))
            .slice(0, 5);

          const dominantSet = (sets) => sets.reduce((best, s) =>
            (s.reps * s.workSeconds) > (best.reps * best.workSeconds) ? s : best, sets[0]);

          const workMinutes = (w) => w.intervalData.sets.reduce((s, x) => s + x.reps * x.workSeconds, 0) / 60;
          const avgWatts = (w) => {
            const sets = w.intervalData.sets;
            const totalSec = sets.reduce((s, x) => s + x.reps * x.workSeconds, 0);
            if (totalSec === 0) return 0;
            return Math.round(sets.reduce((s, x) => s + x.avgWatts * x.reps * x.workSeconds, 0) / totalSec);
          };

          const trendData = sessionsAsc.map(w => {
            const [, m, d] = w.date.split('-').map(Number);
            return {
              dateLabel: `${m}/${d}`,
              minutes: Math.round(workMinutes(w) * 10) / 10,
              watts: avgWatts(w),
              label: w.intervalData.label,
            };
          });

          const TrendTooltip = ({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm">
                  <p className="text-gray-300 mb-1">{data.dateLabel}</p>
                  <p className="font-bold" style={{ color: activeZone?.color }}>
                    {progressionMetric === 'minutes' ? `${data.minutes} min` : `${data.watts}W`}
                  </p>
                  <p className="text-gray-500 text-xs font-mono">{data.label}</p>
                </div>
              );
            }
            return null;
          };

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowProgressionModal(false)}>
              <div className="bg-gray-800 rounded-lg p-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-bold">Workout Progression</h2>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleRedetectAll}
                      className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-2.5 py-1.5 rounded transition"
                      title="Re-run interval detection on every ride that has saved power data"
                    >
                      🔍 Re-scan intervals
                    </button>
                    <button
                      onClick={() => setShowProgressionModal(false)}
                      className="text-gray-400 hover:text-white text-xl"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Category tabs */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {progressionZones.map(z => {
                    const count = history.filter(w => w.intervalData?.category === z.id).length;
                    const active = progressionCategory === z.id;
                    return (
                      <button
                        key={z.id}
                        onClick={() => setProgressionCategory(z.id)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          active ? 'text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                        style={active ? { backgroundColor: z.color } : {}}
                      >
                        {z.name} {count > 0 && <span className="opacity-75">({count})</span>}
                      </button>
                    );
                  })}
                </div>

                {progressionCategory === null ? (
                  recentIndoor.length === 0 ? (
                    <p className="text-gray-400 text-sm">
                      No indoor workouts logged yet. Log or import one to start tracking interval progressions.
                    </p>
                  ) : (
                    <>
                      <p className="text-gray-400 text-xs mb-2">Select a zone above to see its progression trend. Most recent indoor workouts:</p>
                      <div className="space-y-2">
                        {recentIndoor.map(w => {
                          const hasDetail = w.stream || w.intervalData;
                          const zoneColor = ZONES.find(z => z.id === w.zone)?.color;
                          return (
                            <div
                              key={w.id}
                              onClick={hasDetail ? () => { setShowProgressionModal(false); setShowWorkoutDetail(w.id); } : undefined}
                              className={`bg-gray-700 rounded p-3 text-sm transition ${hasDetail ? 'hover:bg-gray-600 cursor-pointer' : ''}`}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-medium">{w.name || w.notes || 'Workout'}</span>
                                <span className="text-gray-400 text-xs">{formatDateWithDay(w.date)}</span>
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-xs" style={zoneColor ? { color: zoneColor } : {}}>
                                  {getZoneName(w.zone)}
                                </span>
                                {w.intervalData?.label && (
                                  <span className="font-mono text-yellow-400 text-xs">{w.intervalData.label}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )
                ) : sessionsAsc.length === 0 ? (
                  <p className="text-gray-400 text-sm">
                    No tracked {activeZone?.name} workouts yet. Import a FIT or TCX file from the Log Ride screen to start tracking interval progressions.
                  </p>
                ) : (
                  <>
                    {sessionsAsc.length >= 2 && (
                      <div className="mb-4">
                        <div className="flex gap-2 mb-2">
                          <button
                            onClick={() => setProgressionMetric('minutes')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                              progressionMetric === 'minutes' ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                            }`}
                          >
                            Work Minutes
                          </button>
                          <button
                            onClick={() => setProgressionMetric('watts')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                              progressionMetric === 'watts' ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                            }`}
                          >
                            Avg Watts
                          </button>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorProgression" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={activeZone?.color} stopOpacity={0.8}/>
                                <stop offset="95%" stopColor={activeZone?.color} stopOpacity={0.1}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="dateLabel" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                            <YAxis
                              stroke="#9CA3AF"
                              style={{ fontSize: '12px' }}
                              tickFormatter={(v) => progressionMetric === 'minutes' ? `${v}m` : `${v}W`}
                              width={45}
                            />
                            <Tooltip content={<TrendTooltip />} />
                            <Area
                              type="monotone"
                              dataKey={progressionMetric}
                              stroke={activeZone?.color}
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#colorProgression)"
                              dot={{ fill: activeZone?.color, strokeWidth: 2, r: 4 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Session list, newest first */}
                    <div className="space-y-2">
                      {sessionsDesc.map(w => {
                        const dom = dominantSet(w.intervalData.sets);
                        return (
                          <div
                            key={w.id}
                            onClick={() => { setShowProgressionModal(false); setShowWorkoutDetail(w.id); }}
                            className="bg-gray-700 hover:bg-gray-600 rounded p-3 text-sm cursor-pointer transition"
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400 text-xs">{formatDateWithDay(w.date)}</span>
                              <span className="text-gray-400 text-xs">{Math.round(workMinutes(w))} min work</span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <span className="font-mono text-yellow-400">{w.intervalData.label}</span>
                              <span className="text-red-400 text-xs">{dom.avgHR != null ? `${dom.avgHR} bpm` : '—'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* Import/Export/Reset */}
        <div className="flex justify-between text-sm mt-6">
          <div className="flex gap-3">
            <label className="text-gray-400 hover:text-gray-300 transition cursor-pointer">
              Import
              <input type="file" accept=".json" onChange={importData} className="hidden" />
            </label>
            <button
              onClick={exportData}
              className="text-gray-400 hover:text-gray-300 transition"
            >
              Export
            </button>
          </div>
          <button
            onClick={() => {
              if (window.confirm('Reset all progression levels to 1.0?\n\nThis will NOT delete your workout history.\n\nThis action cannot be undone.')) {
                const resetLevels = {
                  endurance: 1.0,
                  tempo: 1.0,
                  sweetspot: 1.0,
                  threshold: 1.0,
                  vo2max: 1.0,
                  anaerobic: 1.0,
                };
                setLevels(resetLevels);
                setDisplayLevels(resetLevels);
                setLastWorkedDates({});
                markDataChanged();
                alert('✓ All progression levels reset to 1.0');
              }
            }}
            className="text-gray-500 hover:text-red-400 transition"
          >
            Reset Levels
          </button>
        </div>

      </div>
    </div>
  );
}
