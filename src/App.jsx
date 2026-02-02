import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';

const ZONES = [
  { id: 'recovery', name: 'Recovery', color: '#6B7280', description: 'Z1: <130W' },
  { id: 'endurance', name: 'Endurance', color: '#3B82F6', description: 'Z2: 130-165W' },
  { id: 'tempo', name: 'Tempo', color: '#22C55E', description: 'Z3: 165-185W' },
  { id: 'sweetspot', name: 'Sweet Spot', color: '#EAB308', description: '195-220W' },
  { id: 'threshold', name: 'Threshold', color: '#F97316', description: 'Z4: 220-235W' },
  { id: 'vo2max', name: 'VO2max', color: '#EF4444', description: 'Z5: 235-280W' },
  { id: 'anaerobic', name: 'Anaerobic', color: '#8B5CF6', description: 'Z6: 280W+' },
];

const DEFAULT_LEVELS = {
  recovery: 1,
  endurance: 1,
  tempo: 1,
  sweetspot: 1,
  threshold: 1,
  vo2max: 1,
  anaerobic: 1,
};

// Expected RPE based on zone/ride type
const ZONE_EXPECTED_RPE = {
  recovery: 3,
  endurance: 4,
  tempo: 5,
  sweetspot: 6,
  threshold: 7,
  vo2max: 8,
  anaerobic: 9,
};

const STORAGE_KEY = 'cycling-progression-data-v2';
const INTERVALS_CONFIG_KEY = 'intervals-icu-config';
const FTP = 235;
const START_DATE = '2024-12-29'; // Import rides from this date onwards

export default function ProgressionTracker() {
  const [levels, setLevels] = useState(DEFAULT_LEVELS);
  const [displayLevels, setDisplayLevels] = useState(DEFAULT_LEVELS);
  const [history, setHistory] = useState([]);
  const [showLogRideModal, setShowLogRideModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showPasteImport, setShowPasteImport] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [importError, setImportError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [showPostLogSummary, setShowPostLogSummary] = useState(false);
  const [lastLoggedWorkout, setLastLoggedWorkout] = useState(null);
  const [recentChanges, setRecentChanges] = useState({});
  const [animatingZone, setAnimatingZone] = useState(null);
  const [weeklyChartView, setWeeklyChartView] = useState('hours'); // 'hours', 'tss', or 'elevation'
  const animationRef = useRef(null);

  // intervals.icu integration state
  const [showIntervalsSyncModal, setShowIntervalsSyncModal] = useState(false);
  const [intervalsConfig, setIntervalsConfig] = useState({
    athleteId: 'i259740',
    apiKey: '4ocowoxwxjf0lknxweavsalps'
  });
  const [syncStatus, setSyncStatus] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Power curve data state
  const [powerCurveData, setPowerCurveData] = useState(null);

  // CSV import state
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [csvContent, setCSVContent] = useState('');
  const [csvImportStatus, setCSVImportStatus] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // FTP modal state
  const [showFTPModal, setShowFTPModal] = useState(false);
  const [detectedFTP, setDetectedFTP] = useState(null);
  const [currentFTP, setCurrentFTP] = useState(FTP);
  const [intervalsFTP, setIntervalsFTP] = useState(null); // eFTP from intervals.icu

  // Cloud sync instructions modal
  const [showCloudSyncHelp, setShowCloudSyncHelp] = useState(false);

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

  // VO2max estimates storage
  const [vo2maxEstimates, setVo2maxEstimates] = useState([]);
  const [analyzingActivity, setAnalyzingActivity] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    zone: 'endurance',
    workoutLevel: ZONE_EXPECTED_RPE['endurance'], // Auto-set based on zone
    rpe: 5,
    completed: true,
    duration: 60,
    normalizedPower: 150,
    rideType: 'Indoor', // 'Indoor' or 'Outdoor'
    distance: 0, // miles
    elevation: 0, // feet
    notes: '',
  });

  // State for editing rides
  const [editingRide, setEditingRide] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const loadedLevels = parsed.levels || DEFAULT_LEVELS;
      setLevels(loadedLevels);
      setDisplayLevels(loadedLevels);
      setHistory(parsed.history || []);

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
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      levels,
      history,
      event,
      userProfile,
      vo2maxEstimates,
      powerCurveData
    }));
  }, [levels, history, event, userProfile, vo2maxEstimates, powerCurveData]);

  // Load intervals.icu config from localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem(INTERVALS_CONFIG_KEY);
    if (savedConfig) {
      setIntervalsConfig(JSON.parse(savedConfig));
    }
  }, []);

  // Load FTP from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.ftp) {
        setCurrentFTP(parsed.ftp);
      }
      if (parsed.intervalsFTP) {
        setIntervalsFTP(parsed.intervalsFTP);
      }
    }
  }, []);

  // Save FTP and intervalsFTP to localStorage when they change
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      parsed.ftp = currentFTP;
      parsed.intervalsFTP = intervalsFTP;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ levels, history, ftp: currentFTP, intervalsFTP }));
    }
  }, [currentFTP, intervalsFTP]);

  // Check FTP vs eFTP difference and prompt user if > 10
  useEffect(() => {
    const latestEFTP = history.find(w => w.eFTP)?.eFTP;
    if (latestEFTP && Math.abs(currentFTP - latestEFTP) > 10) {
      const difference = latestEFTP - currentFTP;
      const direction = difference > 0 ? 'higher' : 'lower';
      const shouldUpdate = window.confirm(
        `Your estimated FTP (${latestEFTP}W) is ${Math.abs(difference)}W ${direction} than your current FTP (${currentFTP}W).\n\n` +
        `Would you like to update your FTP in Profile settings?`
      );
      if (shouldUpdate) {
        setProfileModalOriginalFTP(currentFTP);
        setShowProfileModal(true);
      }
    }
  }, [history]); // Only check when history changes (new rides imported/logged)

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

  // Get zone power ranges for mapping activities
  const getZonePowerRanges = (ftp) => ({
    recovery: { min: 0, max: Math.round(ftp * 0.55) },
    endurance: { min: Math.round(ftp * 0.55), max: Math.round(ftp * 0.70) },
    tempo: { min: Math.round(ftp * 0.70), max: Math.round(ftp * 0.79) },
    sweetspot: { min: Math.round(ftp * 0.83), max: Math.round(ftp * 0.94) },
    threshold: { min: Math.round(ftp * 0.94), max: ftp },
    vo2max: { min: ftp, max: Math.round(ftp * 1.19) },
    anaerobic: { min: Math.round(ftp * 1.19), max: Infinity },
  });

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
    if (history.length === 0) return { ctl: 0, atl: 0, tsb: 0, weeklyTSS: 0, prevWeeklyTSS: 0 };

    const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
    const today = new Date();
    const oldestDate = new Date(sorted[0].date);

    const dailyTSS = {};
    sorted.forEach(workout => {
      const date = workout.date;
      if (!dailyTSS[date]) dailyTSS[date] = 0;
      dailyTSS[date] += workout.tss || 0;
    });

    let ctl = 0;
    let atl = 0;
    const ctlDecay = 2 / (42 + 1);
    const atlDecay = 2 / (7 + 1);

    const currentDate = new Date(oldestDate);
    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayTSS = dailyTSS[dateStr] || 0;

      ctl = ctl * (1 - ctlDecay) + dayTSS * ctlDecay;
      atl = atl * (1 - atlDecay) + dayTSS * atlDecay;

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const weeklyTSS = sorted
      .filter(w => new Date(w.date) >= weekAgo)
      .reduce((sum, w) => sum + (w.tss || 0), 0);

    const twoWeekTSS = sorted
      .filter(w => new Date(w.date) >= twoWeeksAgo)
      .reduce((sum, w) => sum + (w.tss || 0), 0);

    return {
      ctl: Math.round(ctl),
      atl: Math.round(atl),
      tsb: Math.round(ctl - atl),
      weeklyTSS,
      twoWeekTSS,
    };
  };

  // Calculate weekly hours for chart
  const calculateWeeklyHours = (history) => {
    if (!history || history.length === 0) return [];

    // Get date 20 weeks ago
    const twentyWeeksAgo = new Date();
    twentyWeeksAgo.setDate(twentyWeeksAgo.getDate() - (20 * 7));

    // Filter to last 20 weeks
    const recentWorkouts = history.filter(w => new Date(w.date) >= twentyWeeksAgo);

    // Group by week
    const weeklyData = {};
    recentWorkouts.forEach(workout => {
      const date = new Date(workout.date);
      // Get Monday of that week (week starts on Monday, Strava convention)
      const monday = new Date(date);
      monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      const weekKey = monday.toISOString().split('T')[0];

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
        label: new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      }))
      .sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart));

    return chartData;
  };

  const calculateWeeklyTSS = (history) => {
    if (!history || history.length === 0) return [];

    // Get date 20 weeks ago
    const twentyWeeksAgo = new Date();
    twentyWeeksAgo.setDate(twentyWeeksAgo.getDate() - (20 * 7));

    // Filter to last 20 weeks
    const recentWorkouts = history.filter(w => new Date(w.date) >= twentyWeeksAgo);

    // Group by week
    const weeklyData = {};
    recentWorkouts.forEach(workout => {
      const date = new Date(workout.date);
      // Get Monday of that week (week starts on Monday, Strava convention)
      const monday = new Date(date);
      monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      const weekKey = monday.toISOString().split('T')[0];

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
        label: new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      }))
      .sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart));

    return chartData;
  };

  const calculateWeeklyElevation = (history) => {
    if (!history || history.length === 0) return [];

    // Get date 20 weeks ago
    const twentyWeeksAgo = new Date();
    twentyWeeksAgo.setDate(twentyWeeksAgo.getDate() - (20 * 7));

    // Filter to last 20 weeks
    const recentWorkouts = history.filter(w => new Date(w.date) >= twentyWeeksAgo);

    // Group by week
    const weeklyData = {};
    recentWorkouts.forEach(workout => {
      const date = new Date(workout.date);
      // Get Monday of that week (week starts on Monday, Strava convention)
      const monday = new Date(date);
      monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      const weekKey = monday.toISOString().split('T')[0];

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = {
          weekStart: weekKey,
          totalElevation: 0,
          workouts: 0,
        };
      }

      weeklyData[weekKey].totalElevation += workout.elevation || 0;
      weeklyData[weekKey].workouts += 1;
    });

    // Convert to array and sort by date
    const chartData = Object.values(weeklyData)
      .map(week => ({
        weekStart: week.weekStart,
        elevation: Math.round(week.totalElevation), // Round to integer
        workouts: week.workouts,
        // Format label as "Apr 7", "May 12", etc.
        label: new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      }))
      .sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart));

    return chartData;
  };

  // Calculate eFTP history for rolling one-year chart
  const calculateEFTPHistory = (history) => {
    if (!history || history.length === 0) return [];

    // Rolling 11-month window so each month name appears only once on X-axis
    const elevenMonthsAgo = new Date();
    elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);
    elevenMonthsAgo.setDate(1); // start of that month

    // Filter to workouts with eFTP in the window
    const rides = history
      .filter(w => w.eFTP && new Date(w.date) >= elevenMonthsAgo)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (rides.length === 0) return [];

    // Group by calendar month → find max eFTP per month
    const monthMap = {};
    rides.forEach(w => {
      const d = new Date(w.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap[key] || w.eFTP > monthMap[key].eFTP) {
        monthMap[key] = {
          eFTP: w.eFTP,
          rideName: w.name || 'Workout',
          date: w.date,
        };
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
      };
    });

    return eftpData;
  };

  // VO2max Calculation Functions
  const estimateVO2FromPower = (powerWatts, weightKg) => {
    // ACSM metabolic equation for cycling
    // VO2 (ml/kg/min) ≈ (10.8 × watts / weight) + 7
    return (10.8 * powerWatts / weightKg) + 7;
  };

  const estimateVO2max = (powerWatts, hrBpm, weightKg, restingHR, maxHR) => {
    // Calculate HR reserve percentage
    const hrReserve = maxHR - restingHR;
    const hrReservePct = (hrBpm - restingHR) / hrReserve;

    // Estimate current VO2 from power
    const currentVO2 = estimateVO2FromPower(powerWatts, weightKg);

    // Extrapolate to VO2max using HR reserve method
    const restingVO2 = 3.5; // ml/kg/min
    const vo2ReserveCurrent = currentVO2 - restingVO2;
    const vo2ReserveMax = vo2ReserveCurrent / hrReservePct;
    const vo2max = vo2ReserveMax + restingVO2;

    return vo2max;
  };

  const findStableSegments = (hrStream, powerStream, maxHR) => {
    if (!hrStream || !powerStream || hrStream.length < 300) {
      return [];
    }

    const segments = [];
    const windowSize = 300; // 5 minutes in seconds

    for (let start = 300; start < hrStream.length - windowSize; start += 60) {
      const end = start + windowSize;
      const hrSegment = hrStream.slice(start, end);
      const powerSegment = powerStream.slice(start, end);

      // Calculate statistics
      const hrMean = hrSegment.reduce((a, b) => a + b, 0) / hrSegment.length;
      const powerMean = powerSegment.reduce((a, b) => a + b, 0) / powerSegment.length;

      const hrStd = Math.sqrt(
        hrSegment.reduce((sum, val) => sum + Math.pow(val - hrMean, 2), 0) / hrSegment.length
      );
      const powerStd = Math.sqrt(
        powerSegment.reduce((sum, val) => sum + Math.pow(val - powerMean, 2), 0) / powerSegment.length
      );

      // Check stability and intensity criteria
      if (
        hrStd < 5 &&
        powerStd < 10 &&
        hrMean > 0.60 * maxHR &&
        hrMean < 0.85 * maxHR &&
        powerMean > 100
      ) {
        segments.push({
          hr: hrMean,
          power: powerMean,
          duration: windowSize,
          hrPct: hrMean / maxHR,
        });
      }
    }

    return segments;
  };

  const calculateFitnessAge = (vo2max, actualAge, sex) => {
    // Reference VO2max values by age and sex
    const maleRef = {
      20: 51, 25: 50, 30: 48, 35: 47, 40: 45, 45: 44,
      50: 42, 55: 40, 60: 38, 65: 36, 70: 34
    };
    const femaleRef = {
      20: 44, 25: 43, 30: 41, 35: 40, 40: 38, 45: 37,
      50: 35, 55: 33, 60: 32, 65: 30, 70: 28
    };

    const ref = sex === 'male' ? maleRef : femaleRef;
    const ages = Object.keys(ref).map(Number).sort((a, b) => a - b);

    // Find age where vo2max matches reference
    for (const age of ages) {
      if (vo2max >= ref[age]) {
        return age;
      }
    }
    return 70; // cap at 70
  };

  const calculatePercentile = (vo2max, age, sex) => {
    // Simplified percentile calculation using population norms
    // Mean and SD for age/sex groups (approximate values)
    let mean, sd;

    if (sex === 'male') {
      if (age < 30) {
        mean = 48; sd = 7;
      } else if (age < 40) {
        mean = 46; sd = 7;
      } else if (age < 50) {
        mean = 42; sd = 7;
      } else if (age < 60) {
        mean = 38; sd = 6;
      } else {
        mean = 34; sd = 6;
      }
    } else {
      if (age < 30) {
        mean = 41; sd = 6;
      } else if (age < 40) {
        mean = 39; sd = 6;
      } else if (age < 50) {
        mean = 35; sd = 6;
      } else if (age < 60) {
        mean = 32; sd = 5;
      } else {
        mean = 28; sd = 5;
      }
    }

    // Calculate z-score and convert to percentile
    const zScore = (vo2max - mean) / sd;
    // Approximate percentile from z-score (simplified)
    let percentile = 50 + (zScore * 19); // rough approximation
    percentile = Math.max(1, Math.min(99, percentile)); // clamp to 1-99

    return Math.round(percentile);
  };

  const classifyVO2max = (percentile) => {
    if (percentile >= 95) return { label: 'Superior', color: '#10B981' };
    if (percentile >= 80) return { label: 'Excellent', color: '#3B82F6' };
    if (percentile >= 60) return { label: 'Good', color: '#22C55E' };
    if (percentile >= 40) return { label: 'Fair', color: '#F59E0B' };
    return { label: 'Poor', color: '#EF4444' };
  };

  // Analyze activity for VO2max
  const analyzeActivityForVO2max = async (activityIdOrPrompt, activityDate) => {
    // Check if profile is complete
    if (!userProfile.maxHR || !userProfile.restingHR || !userProfile.weight) {
      alert('Please complete your user profile first (Max HR, Resting HR, Weight)');
      setProfileModalOriginalFTP(currentFTP);
      setShowProfileModal(true);
      return;
    }

    let activityId = activityIdOrPrompt;

    // If no activity ID provided, prompt user to enter it manually
    if (!activityId) {
      const manualId = prompt(
        'This ride was imported before the VO2max feature was added.\n\n' +
        'To analyze it, please:\n' +
        '1. Go to intervals.icu\n' +
        '2. Find this ride by date: ' + activityDate + '\n' +
        '3. Copy the activity ID from the URL (e.g., "i55751783" or just "55751783")\n' +
        '4. Paste it below:\n'
      );

      if (!manualId) return; // User cancelled
      activityId = manualId.trim();
    }

    // Check if intervals.icu is configured
    if (!intervalsConfig.athleteId || !intervalsConfig.apiKey) {
      alert('Please configure intervals.icu sync first.\n\nGo to Settings and click "Sync from intervals.icu" to set up your athlete ID and API key.');
      setShowIntervalsSyncModal(true);
      return;
    }

    setAnalyzingActivity(activityId);

    try {
      // Strip "i" prefix from athlete ID if present (API uses numeric IDs)
      const athleteId = intervalsConfig.athleteId.replace(/^i/, '');
      console.log('Fetching streams for activity:', activityId, 'athlete:', athleteId);

      // Fetch activity streams from intervals.icu using athlete-specific endpoint
      const response = await fetch(
        `https://intervals.icu/api/v1/athlete/${athleteId}/activities/${activityId}/streams?types=watts,heartrate`,
        {
          headers: {
            'Authorization': `Basic ${btoa(`API_KEY:${intervalsConfig.apiKey}`)}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('intervals.icu API error:', response.status, errorText);
        throw new Error(`Failed to fetch activity streams (${response.status}): ${errorText.substring(0, 100)}`);
      }

      const streams = await response.json();

      // Check if we have both HR and power data
      if (!streams.heartrate || !streams.watts) {
        alert('This activity is missing heart rate or power data. VO2max requires both.');
        setAnalyzingActivity(null);
        return;
      }

      // Find stable segments
      const segments = findStableSegments(
        streams.heartrate,
        streams.watts,
        userProfile.maxHR
      );

      if (segments.length === 0) {
        alert('No stable aerobic segments found. Try a longer endurance ride with steady effort.');
        setAnalyzingActivity(null);
        return;
      }

      // Calculate VO2max from each segment
      const estimates = [];
      const weights = [];

      segments.forEach(seg => {
        // Convert weight from lbs to kg for VO2max calculation
        const weightKg = userProfile.weight / 2.20462;

        const vo2maxEst = estimateVO2max(
          seg.power,
          seg.hr,
          weightKg,
          userProfile.restingHR,
          userProfile.maxHR
        );

        // Weight by segment quality (prefer mid-range HR ~75%)
        const hrQuality = 1 - Math.abs(seg.hrPct - 0.75) * 2;
        const durationWeight = Math.min(seg.duration / 600, 1.0);

        estimates.push(vo2maxEst);
        weights.push(hrQuality * durationWeight);
      });

      // Calculate weighted average
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      const weightedSum = estimates.reduce((sum, est, i) => sum + est * weights[i], 0);
      const finalVO2max = Math.round(weightedSum / totalWeight);

      // Calculate fitness metrics
      const fitnessAge = calculateFitnessAge(finalVO2max, userProfile.age, userProfile.sex);
      const percentile = calculatePercentile(finalVO2max, userProfile.age, userProfile.sex);
      const classification = classifyVO2max(percentile);

      // Store the estimate
      const newEstimate = {
        id: Date.now(),
        activityId,
        date: activityDate,
        vo2max: finalVO2max,
        fitnessAge,
        percentile,
        classification: classification.label,
        segmentsUsed: segments.length,
        timestamp: new Date().toISOString(),
      };

      setVo2maxEstimates([newEstimate, ...vo2maxEstimates]);

      // Show success message
      alert(
        `VO2max Estimated: ${finalVO2max} ml/kg/min\n` +
        `Classification: ${classification.label} (${percentile}th percentile)\n` +
        `Fitness Age: ${fitnessAge} (you're ${userProfile.age})\n` +
        `Based on ${segments.length} stable segment${segments.length > 1 ? 's' : ''}`
      );

    } catch (error) {
      console.error('VO2max analysis error:', error);
      alert('Failed to analyze activity: ' + error.message);
    } finally {
      setAnalyzingActivity(null);
    }
  };

  const generateInsights = (loads, history, levels) => {
    const insights = [];
    const { ctl, atl, tsb, weeklyTSS, twoWeekTSS } = loads;
    const prevWeeklyTSS = twoWeekTSS - weeklyTSS;

    if (tsb < -25) {
      insights.push({
        type: 'warning',
        message: 'TSB below -25: High fatigue accumulation. Consider extra recovery or reducing intensity.',
      });
    } else if (tsb < -15) {
      insights.push({
        type: 'caution',
        message: 'TSB below -15: Significant fatigue. Monitor for signs of overreaching.',
      });
    } else if (tsb > 25) {
      insights.push({
        type: 'info',
        message: 'TSB above +25: Very fresh but fitness may be declining. Consider adding training stimulus.',
      });
    } else if (tsb >= 5 && tsb <= 20) {
      insights.push({
        type: 'positive',
        message: 'TSB in optimal fresh range (+5 to +20): Good form for hard efforts or events.',
      });
    }

    if (atl > ctl + 20) {
      insights.push({
        type: 'warning',
        message: 'ATL exceeds CTL by 20+: Acute load spike. Risk of burnout if sustained.',
      });
    } else if (atl > ctl + 10) {
      insights.push({
        type: 'caution',
        message: 'ATL exceeds CTL by 10+: Building load aggressively. Ensure adequate recovery.',
      });
    }

    if (prevWeeklyTSS > 0) {
      const weekChange = ((weeklyTSS - prevWeeklyTSS) / prevWeeklyTSS) * 100;
      if (weekChange < -40) {
        insights.push({
          type: 'info',
          message: `Weekly TSS down ${Math.abs(Math.round(weekChange))}% from last week. Recovery week or missed sessions?`,
        });
      } else if (weekChange > 30) {
        insights.push({
          type: 'caution',
          message: `Weekly TSS up ${Math.round(weekChange)}% from last week. Large jump—monitor fatigue.`,
        });
      }
    }

    if (ctl < 30) {
      insights.push({
        type: 'info',
        message: 'CTL below 30: Early base building phase. Focus on consistency.',
      });
    } else if (ctl >= 70 && ctl < 85) {
      insights.push({
        type: 'positive',
        message: 'CTL 70-85: Solid fitness base. On track for event readiness.',
      });
    } else if (ctl >= 85) {
      insights.push({
        type: 'positive',
        message: 'CTL 85+: Strong fitness. Maintain and begin considering taper timing.',
      });
    }

    const last14Days = history.filter(w => {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      return new Date(w.date) >= twoWeeksAgo;
    });
    if (last14Days.length < 4) {
      insights.push({
        type: 'caution',
        message: `Only ${last14Days.length} workouts in last 14 days. Consistency is key for adaptation.`,
      });
    }

    const zoneWorkouts = {};
    const last28Days = history.filter(w => {
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      return new Date(w.date) >= fourWeeksAgo;
    });
    last28Days.forEach(w => {
      zoneWorkouts[w.zone] = (zoneWorkouts[w.zone] || 0) + 1;
    });

    if (last28Days.length >= 8) {
      if (!zoneWorkouts['endurance'] || zoneWorkouts['endurance'] < 2) {
        insights.push({
          type: 'caution',
          message: 'Low endurance work in last 28 days. Z2 base supports all other adaptations.',
        });
      }
      if ((zoneWorkouts['vo2max'] || 0) + (zoneWorkouts['anaerobic'] || 0) > last28Days.length * 0.5) {
        insights.push({
          type: 'caution',
          message: 'High-intensity work exceeds 50% of sessions. Risk of burnout without adequate base.',
        });
      }
    }

    const levelValues = Object.values(levels);
    const avgLevel = levelValues.reduce((a, b) => a + b, 0) / levelValues.length;
    if (levels.threshold < avgLevel - 1.5) {
      insights.push({
        type: 'info',
        message: 'Threshold level lagging behind other zones. Consider adding FTP-focused work.',
      });
    }
    if (levels.endurance < 2 && ctl > 40) {
      insights.push({
        type: 'info',
        message: 'Endurance level low relative to fitness. Longer Z2 rides would help.',
      });
    }

    // Longest ride analysis
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentOutdoorRides = history.filter(w =>
      new Date(w.date) >= thirtyDaysAgo &&
      w.rideType === 'Outdoor' &&
      w.distance > 0
    );
    if (recentOutdoorRides.length > 0) {
      const longestRide = recentOutdoorRides.reduce((max, w) => w.distance > max.distance ? w : max, recentOutdoorRides[0]);
      if (longestRide.distance >= 50) {
        insights.push({
          type: 'positive',
          message: `Longest ride in last 30 days: ${longestRide.distance}mi. Strong endurance building.`,
        });
      } else if (longestRide.distance < 30 && ctl > 50) {
        insights.push({
          type: 'info',
          message: `Longest ride: ${longestRide.distance}mi. Consider adding longer rides for event prep.`,
        });
      }
    }

    // Weekly hours analysis
    const last7DaysWorkouts = history.filter(w => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(w.date) >= weekAgo;
    });
    const prev7DaysWorkouts = history.filter(w => {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(w.date) >= twoWeeksAgo && new Date(w.date) < weekAgo;
    });

    const thisWeekHours = last7DaysWorkouts.reduce((sum, w) => sum + w.duration, 0) / 60;
    const prevWeekHours = prev7DaysWorkouts.reduce((sum, w) => sum + w.duration, 0) / 60;

    if (thisWeekHours >= 8) {
      insights.push({
        type: 'positive',
        message: `${thisWeekHours.toFixed(1)} hours this week. Solid training volume.`,
      });
    } else if (thisWeekHours < 5 && ctl > 40) {
      insights.push({
        type: 'caution',
        message: `${thisWeekHours.toFixed(1)} hours this week. Volume low for current fitness level.`,
      });
    }

    // Ride frequency comparison
    if (prev7DaysWorkouts.length > 0) {
      const rideCountChange = last7DaysWorkouts.length - prev7DaysWorkouts.length;
      if (rideCountChange >= 2) {
        insights.push({
          type: 'positive',
          message: `${last7DaysWorkouts.length} rides this week (up from ${prev7DaysWorkouts.length}). Great consistency increase.`,
        });
      } else if (rideCountChange <= -2 && last7DaysWorkouts.length < 3) {
        insights.push({
          type: 'caution',
          message: `${last7DaysWorkouts.length} rides this week (down from ${prev7DaysWorkouts.length}). Consistency matters.`,
        });
      }
    }

    // Indoor vs outdoor composition
    if (last14Days.length >= 5) {
      const indoorCount = last14Days.filter(w => w.rideType === 'Indoor').length;
      const outdoorCount = last14Days.filter(w => w.rideType === 'Outdoor').length;
      const indoorPct = (indoorCount / last14Days.length) * 100;

      if (indoorPct >= 75) {
        insights.push({
          type: 'info',
          message: `${Math.round(indoorPct)}% indoor rides recently. Consider outdoor variety for skill work.`,
        });
      } else if (outdoorCount >= 8) {
        insights.push({
          type: 'positive',
          message: `${outdoorCount} outdoor rides in last 14 days. Great outdoor engagement.`,
        });
      }
    }

    // Consecutive days pattern
    if (history.length >= 7) {
      const sortedRecent = [...history].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 7);
      let consecutiveDays = 1;
      let maxConsecutive = 1;

      for (let i = 0; i < sortedRecent.length - 1; i++) {
        const current = new Date(sortedRecent[i].date);
        const next = new Date(sortedRecent[i + 1].date);
        const daysDiff = Math.round((current - next) / (1000 * 60 * 60 * 24));

        if (daysDiff === 1) {
          consecutiveDays++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveDays);
        } else {
          consecutiveDays = 1;
        }
      }

      if (maxConsecutive >= 4) {
        insights.push({
          type: 'caution',
          message: `${maxConsecutive} consecutive training days detected. Recovery days prevent overtraining.`,
        });
      }
    }

    // Elevation gain analysis
    const last7DaysElevation = last7DaysWorkouts.reduce((sum, w) => sum + (w.elevation || 0), 0);
    const prev7DaysElevation = prev7DaysWorkouts.reduce((sum, w) => sum + (w.elevation || 0), 0);

    // Big climbs detection
    const bigClimbs = last14Days.filter(w => w.elevation > 2999);
    if (bigClimbs.length > 0) {
      insights.push({
        type: 'positive',
        message: `${bigClimbs.length} big climb${bigClimbs.length > 1 ? 's' : ''} (>3000ft) in last 14 days. Building climbing strength.`,
      });
    }

    // Long rides detection
    const longRides = last14Days.filter(w => w.duration > 180);
    if (longRides.length > 0) {
      insights.push({
        type: 'positive',
        message: `${longRides.length} long ride${longRides.length > 1 ? 's' : ''} (>3hrs) in last 14 days. Building endurance capacity.`,
      });
    }

    // Weekly elevation comparison
    if (last7DaysElevation > 0 && prev7DaysElevation > 0) {
      const elevationChange = ((last7DaysElevation - prev7DaysElevation) / prev7DaysElevation) * 100;
      if (elevationChange > 50) {
        insights.push({
          type: 'info',
          message: `Elevation gain up ${Math.round(elevationChange)}% this week (${last7DaysElevation.toLocaleString()}ft vs ${prev7DaysElevation.toLocaleString()}ft). Big climbing week.`,
        });
      } else if (elevationChange < -50) {
        insights.push({
          type: 'info',
          message: `Elevation gain down ${Math.abs(Math.round(elevationChange))}% this week (${last7DaysElevation.toLocaleString()}ft vs ${prev7DaysElevation.toLocaleString()}ft). Flatter week.`,
        });
      }
    } else if (last7DaysElevation >= 5000) {
      insights.push({
        type: 'positive',
        message: `${last7DaysElevation.toLocaleString()}ft of climbing this week. Strong vertical work.`,
      });
    }

    // Climbing intensity analysis
    if (recentOutdoorRides.length >= 3) {
      const avgElevationPerMile = recentOutdoorRides.reduce((sum, w) => {
        return sum + (w.distance > 0 ? (w.elevation || 0) / w.distance : 0);
      }, 0) / recentOutdoorRides.length;

      if (avgElevationPerMile >= 100) {
        insights.push({
          type: 'positive',
          message: `Averaging ${Math.round(avgElevationPerMile)}ft/mi in recent rides. Hilly/mountainous terrain building strength.`,
        });
      } else if (avgElevationPerMile < 30 && ctl > 50) {
        insights.push({
          type: 'info',
          message: `Averaging ${Math.round(avgElevationPerMile)}ft/mi recently. Consider adding climbing for Gran Fondo prep.`,
        });
      }
    }

    return insights;
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

  // FTP modal handlers
  const handleRecalculateLevels = () => {
    // Reset all progression levels to 1.0
    setLevels(DEFAULT_LEVELS);
    setDisplayLevels(DEFAULT_LEVELS);

    // Update FTP
    setCurrentFTP(detectedFTP);

    // Close modal
    setShowFTPModal(false);

    // Show success message
    setSyncStatus(`✓ FTP updated to ${detectedFTP}W and all progression levels reset to 1.0`);
  };

  const handleAdjustZonesOnly = () => {
    // Update FTP only, keep progression levels
    setCurrentFTP(detectedFTP);

    // Close modal
    setShowFTPModal(false);

    // Show success message
    setSyncStatus(`✓ FTP updated to ${detectedFTP}W. Progression levels maintained.`);
  };

  const handleIgnoreFTP = () => {
    // Just close the modal without any changes
    setShowFTPModal(false);
    setSyncStatus('FTP change ignored. Continuing with current settings.');
  };

  // Map intervals.icu workout type to our zone
  const mapWorkoutTypeToZone = (activity) => {
    // intervals.icu uses type field and average_watts
    const avgWatts = activity.average_watts || activity.icu_average_watts || 0;
    const workoutType = (activity.type || '').toLowerCase();
    const description = (activity.description || '').toLowerCase();

    // Map by power zones if we have power data
    if (avgWatts > 0) {
      const ranges = getZonePowerRanges(currentFTP);
      if (avgWatts >= ranges.anaerobic.min) return 'anaerobic';
      if (avgWatts >= ranges.vo2max.min) return 'vo2max';
      if (avgWatts >= ranges.threshold.min) return 'threshold';
      if (avgWatts >= ranges.sweetspot.min) return 'sweetspot';
      if (avgWatts >= ranges.tempo.min) return 'tempo';
      return 'endurance';
    }

    // Fallback to workout type keywords
    if (workoutType.includes('vo2') || description.includes('vo2')) return 'vo2max';
    if (workoutType.includes('threshold') || description.includes('ftp')) return 'threshold';
    if (workoutType.includes('sweet') || workoutType.includes('ss')) return 'sweetspot';
    if (workoutType.includes('tempo')) return 'tempo';
    if (workoutType.includes('sprint') || workoutType.includes('anaerobic')) return 'anaerobic';

    // Default to endurance for rides
    return 'endurance';
  };

  // Sync workouts from intervals.icu
  const syncFromIntervalsICU = async () => {
    if (!intervalsConfig.athleteId || !intervalsConfig.apiKey) {
      setSyncStatus('Please enter your Athlete ID and API Key');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('Checking current FTP...');

    try {
      // Strip "i" prefix from athlete ID if present (API uses numeric IDs)
      const athleteId = intervalsConfig.athleteId.replace(/^i/, '');

      // First, fetch athlete data to get current eFTP
      console.log('=== FETCHING ATHLETE DATA FOR eFTP ===');
      const athleteResponse = await fetch(
        `https://intervals.icu/api/v1/athlete/${athleteId}`,
        {
          headers: {
            'Authorization': `Basic ${btoa(`API_KEY:${intervalsConfig.apiKey}`)}`,
          },
        }
      );

      console.log('Athlete response status:', athleteResponse.status, athleteResponse.ok);

      if (athleteResponse.ok) {
        const athleteData = await athleteResponse.json();
        console.log('Athlete data:', athleteData);
        console.log('All athlete data field names:', Object.keys(athleteData));

        // eFTP is stored in sportSettings.settings.mmp_model.ftp
        const sportSettings = athleteData.sportSettings || athleteData.settings;
        const settings = sportSettings?.Ride || sportSettings;
        const eFTPSupported = settings?.eFTPSupported;
        const eFTPValue = settings?.mmp_model?.ftp;
        const manualFTP = settings?.ftp;

        console.log('FTP-related fields:', {
          eFTPSupported: eFTPSupported,
          eFTP: eFTPValue,
          manualFTP: manualFTP,
          mmp_model: settings?.mmp_model,
          currentFTP: currentFTP
        });

        // Use eFTP if available and supported, otherwise fall back to manual FTP or current
        const fetchedFTP = eFTPValue || manualFTP || currentFTP;
        console.log('Fetched FTP:', fetchedFTP);

        // Store intervals.icu FTP
        setIntervalsFTP(fetchedFTP);
        console.log('Set intervalsFTP to:', fetchedFTP);

        // Check if FTP has increased by 10W or more
        if (fetchedFTP >= currentFTP + 10) {
          console.log('FTP Increase Detected:', { old: currentFTP, new: fetchedFTP });
          setDetectedFTP(fetchedFTP);
          setShowFTPModal(true);
          setSyncStatus(`🎉 FTP increase detected: ${currentFTP}W → ${fetchedFTP}W`);
        }
      } else {
        console.error('Failed to fetch athlete data:', athleteResponse.status, athleteResponse.statusText);
      }

      setSyncStatus('Fetching activities from intervals.icu...');

      // Fetch activities from intervals.icu API
      const response = await fetch(
        `https://intervals.icu/api/v1/athlete/${athleteId}/activities?oldest=${START_DATE}`,
        {
          headers: {
            'Authorization': `Basic ${btoa(`API_KEY:${intervalsConfig.apiKey}`)}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const activities = await response.json();
      setSyncStatus(`Found ${activities.length} activities. Fetching detailed data...`);

      // Debug: Log first activity to understand structure
      if (activities.length > 0) {
        console.log('Sample activity summary:', activities[0]);
        console.log('Available fields:', Object.keys(activities[0]));
      }

      // Filter to only cycling activities and map to our format
      let imported = 0;
      let skippedNoPower = 0;
      let skippedDuplicate = 0;
      let fetchErrors = 0;
      const newWorkouts = [];
      const skipReasons = [];

      // Process activities in smaller batches to avoid overwhelming the API
      for (let i = 0; i < activities.length; i++) {
        const activitySummary = activities[i];

        // Update progress every 10 activities
        if (i > 0 && i % 10 === 0) {
          setSyncStatus(`Processing activity ${i + 1} of ${activities.length}...`);
        }

        try {
          // Fetch detailed activity data which includes power metrics
          const detailResponse = await fetch(
            `https://intervals.icu/api/v1/athlete/${athleteId}/activities/${activitySummary.id}`,
            {
              headers: {
                'Authorization': `Basic ${btoa(`API_KEY:${intervalsConfig.apiKey}`)}`,
              },
            }
          );

          if (!detailResponse.ok) {
            fetchErrors++;
            if (skipReasons.length < 5) {
              skipReasons.push(`Activity ${activitySummary.id} - fetch failed (${detailResponse.status})`);
            }
            continue;
          }

          const activity = await detailResponse.json();

          // CRITICAL: intervals.icu wraps the detailed activity in an array
          // We need to extract the first element
          const activityData = Array.isArray(activity) ? activity[0] : activity;

          // Log first detailed activity for debugging
          if (i === 0) {
            console.log('=== DETAILED ACTIVITY SAMPLE ===');
            console.log('Raw response:', activity);
            console.log('Extracted activity:', activityData);
            console.log('Available fields:', Object.keys(activityData || {}));
            console.log('Power-related fields:');
            console.log('  icu_np:', activityData?.icu_np);
            console.log('  normalized_power:', activityData?.normalized_power);
            console.log('  average_watts:', activityData?.average_watts);
            console.log('  avg_watts:', activityData?.avg_watts);
            console.log('  power:', activityData?.power);
            console.log('  watts_avg:', activityData?.watts_avg);
            console.log('  np:', activityData?.np);
            console.log('  icu_average_watts:', activityData?.icu_average_watts);
            console.log('================================');
          }

          // Try MANY field name variations for power data
          const np = activityData?.icu_np ||
                     activityData?.normalized_power ||
                     activityData?.average_watts ||
                     activityData?.avg_watts ||
                     activityData?.watts_avg ||
                     activityData?.icu_average_watts ||
                     activityData?.np ||
                     activityData?.power?.np ||
                     activityData?.power?.avg ||
                     activityData?.power?.average ||
                     0;

          // If no power data, skip
          if (!np || np === 0) {
            skippedNoPower++;
            if (skipReasons.length < 3) {
              const activityName = activityData?.name || activityData?.id || 'Unnamed';
              const availableFields = Object.keys(activityData || {}).slice(0, 10).join(', ');
              skipReasons.push(`"${activityName}" - no power. Available fields: ${availableFields}...`);
            }
            // Log first failed activity completely for debugging
            if (skippedNoPower === 1) {
              console.log('=== FIRST ACTIVITY WITH NO POWER ===');
              console.log('Activity name:', activityData?.name);
              console.log('Activity ID:', activityData?.id);
              console.log('All fields:', Object.keys(activityData || {}));
              console.log('Full object:', activityData);
              console.log('====================================');
            }
            continue;
          }

          // Check for duplicates (same date)
          const activityDate = activityData.start_date_local.split('T')[0];
          const isDuplicate = history.some(w => w.date === activityDate && Math.abs(w.normalizedPower - np) < 5);

          if (isDuplicate) {
            skippedDuplicate++;
            continue;
          }

          // Get TSS (intervals.icu already calculates this!)
          const tss = activityData.icu_training_load || activityData.training_load || activityData.tss ||
                      calculateTSS(np, Math.round((activityData.moving_time || activityData.elapsed_time || 0) / 60));

          // Imported rides are NOT auto-classified into zones.
          // Zone classification and progression levels are only set via manual ride logging.

          const intensityFactor = np / currentFTP;

          // Extract distance and ride type
          const distanceMeters = activityData.distance || 0;
          const distanceMiles = distanceMeters / 1000 * 0.621371; // Convert meters to miles
          const activityType = activityData.type || 'Ride';
          const rideType = activityType === 'VirtualRide' ? 'Indoor' : 'Outdoor';

          // Extract elevation gain (meters to feet)
          const elevationMeters = activityData.total_elevation_gain ||
                                  activityData.elevation_gain ||
                                  activityData.ascent ||
                                  activityData.icu_elevation_gain ||
                                  0;
          const elevationFeet = Math.round(elevationMeters * 3.28084); // Convert meters to feet

          // Get eFTP if available
          const activityEFTP = activityData.icu_ftp || activityData.ftp || null;

          // Create workout entry without zone classification
          const entry = {
            id: Date.now() + imported, // Unique ID
            intervalsId: activitySummary.id, // intervals.icu activity ID for VO2max analysis
            date: activityDate,
            zone: null, // No auto-classification — user must classify manually
            workoutLevel: null,
            rpe: null,
            completed: true,
            duration: Math.round((activityData.moving_time || activityData.elapsed_time || 0) / 60),
            normalizedPower: Math.round(np),
            rideType: rideType,
            distance: Math.round(distanceMiles * 10) / 10, // Round to 1 decimal
            elevation: elevationFeet,
            eFTP: activityEFTP,
            name: activityData.name || 'Imported Ride',
            notes: 'Imported from intervals.icu',
            previousLevel: null,
            newLevel: null,
            change: 0,
            tss: tss,
            intensityFactor: intensityFactor,
            source: 'imported',
          };

          newWorkouts.push(entry);

          imported++;

        } catch (error) {
          console.error(`Error fetching activity ${activitySummary.id}:`, error);
          fetchErrors++;
          if (skipReasons.length < 5) {
            skipReasons.push(`Activity ${activitySummary.id} - error: ${error.message}`);
          }
        }
      }

      if (imported > 0) {
        // Merge with existing history and sort by date
        const mergedHistory = [...newWorkouts, ...history].sort((a, b) =>
          new Date(b.date) - new Date(a.date)
        );

        setHistory(mergedHistory);

        let statusMsg = `✓ Imported ${imported} activities! Classify rides in Ride History to update progression levels.`;
        if (skippedNoPower > 0 || skippedDuplicate > 0 || fetchErrors > 0) {
          statusMsg += ` Skipped: ${skippedNoPower} without power, ${skippedDuplicate} duplicates, ${fetchErrors} fetch errors.`;
        }
        setSyncStatus(statusMsg);
      } else {
        const totalSkipped = skippedNoPower + skippedDuplicate + fetchErrors;
        let statusMsg = `No activities imported. Skipped ${totalSkipped} total:\n`;
        statusMsg += `- ${skippedNoPower} missing power data\n`;
        statusMsg += `- ${skippedDuplicate} duplicates\n`;
        statusMsg += `- ${fetchErrors} fetch errors\n`;
        if (skipReasons.length > 0) {
          statusMsg += `\nFirst few issues:\n${skipReasons.join('\n')}`;
        }
        statusMsg += `\n\nCheck console for detailed logs.`;
        setSyncStatus(statusMsg);
        console.log('Sync completed with no imports.');
      }

      // Save config for next time
      localStorage.setItem(INTERVALS_CONFIG_KEY, JSON.stringify(intervalsConfig));

    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus(`Error: ${error.message}. Check your credentials and try again.`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper function to parse CSV line (handles both comma-separated with quotes and tab-separated)
  const parseCSVLine = (line, delimiter = ',') => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"' && inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        // Toggle quote state
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        // End of field
        result.push(current);
        current = '';
      } else {
        // Regular character
        current += char;
      }
    }

    // Push last field
    result.push(current);
    return result;
  };

  // Parse and import CSV from intervals.icu
  const handleCSVImport = () => {
    setCSVImportStatus('');
    setIsImporting(true);

    try {
      // Split by lines
      const lines = csvContent.trim().split('\n');

      if (lines.length < 2) {
        setCSVImportStatus('Error: CSV appears empty or invalid');
        setIsImporting(false);
        return;
      }

      // Detect delimiter (comma or tab)
      const delimiter = lines[0].includes('\t') ? '\t' : ',';

      // Parse header row
      const headers = parseCSVLine(lines[0], delimiter);
      setCSVImportStatus(`Found ${lines.length - 1} activities. Processing...`);

      // Find column indices (case-insensitive)
      const dateIdx = headers.findIndex(h => h.toLowerCase().includes('date'));
      const npIdx = headers.findIndex(h => h.toLowerCase().includes('norm') && h.toLowerCase().includes('power'));
      const intensityIdx = headers.findIndex(h => h.toLowerCase().includes('intensity'));
      const loadIdx = headers.findIndex(h => h.toLowerCase().includes('load'));
      const timeIdx = headers.findIndex(h => h.toLowerCase().includes('moving') && h.toLowerCase().includes('time'));
      const nameIdx = headers.findIndex(h => h.toLowerCase().includes('name'));
      const typeIdx = headers.findIndex(h => h.toLowerCase() === 'type');
      const distanceIdx = headers.findIndex(h => h.toLowerCase().includes('distance'));
      const idIdx = headers.findIndex(h => h.toLowerCase() === 'id');
      const elevationIdx = headers.findIndex(h =>
        (h.toLowerCase().includes('elevation') && h.toLowerCase().includes('gain')) ||
        h.toLowerCase() === 'climbing'
      );
      const eftpIdx = headers.findIndex(h =>
        h.toLowerCase() === 'eftp' && !h.toLowerCase().includes('activity')
      );

      console.log('CSV Column Indices:', { dateIdx, npIdx, intensityIdx, loadIdx, timeIdx, nameIdx, typeIdx, distanceIdx, idIdx, elevationIdx, eftpIdx });
      console.log('Detected delimiter:', delimiter === '\t' ? 'tab' : 'comma');
      console.log('Headers:', headers);

      let imported = 0;
      let skipped = 0;
      const newWorkouts = [];

      // Process each data row
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i], delimiter);

        // Skip if missing critical data
        if (!cols[dateIdx] || !cols[npIdx] || !cols[loadIdx]) {
          skipped++;
          continue;
        }

        const np = parseInt(cols[npIdx]);
        const tss = parseInt(cols[loadIdx]);
        const duration = parseInt(cols[timeIdx]) / 60; // Convert seconds to minutes
        const intensityFactor = parseFloat(cols[intensityIdx]) / 100; // Convert percentage to decimal
        const activityDate = cols[dateIdx].split('T')[0]; // Extract date part
        const activityName = cols[nameIdx] || 'Imported Ride';
        const activityType = cols[typeIdx] || 'Ride';
        const distance = distanceIdx >= 0 ? parseFloat(cols[distanceIdx]) / 1000 * 0.621371 : 0; // Convert meters to miles
        const activityId = idIdx >= 0 && cols[idIdx] ? cols[idIdx].trim() : null; // Capture intervals.icu activity ID if available

        // Map intervals.icu type to ride type ('Ride' = Outdoor, 'VirtualRide' = Indoor)
        const rideType = activityType === 'VirtualRide' ? 'Indoor' : 'Outdoor';

        // Skip if no power data
        if (!np || np === 0) {
          skipped++;
          continue;
        }

        // Check for duplicates
        const isDuplicate = history.some(w => w.date === activityDate && Math.abs(w.normalizedPower - np) < 5);
        if (isDuplicate) {
          skipped++;
          continue;
        }

        // Imported rides are NOT auto-classified into zones.
        // Zone classification and progression levels are only set via manual ride logging.

        // Create workout entry without zone classification
        const entry = {
          id: Date.now() + imported,
          date: activityDate,
          zone: null, // No auto-classification — user must classify manually
          workoutLevel: null,
          rpe: null,
          completed: true,
          duration: Math.round(duration),
          normalizedPower: Math.round(np),
          rideType: rideType,
          distance: Math.round(distance * 10) / 10, // Round to 1 decimal
          name: activityName,
          notes: 'Imported from CSV',
          previousLevel: null,
          newLevel: null,
          change: 0,
          tss: tss,
          intensityFactor: intensityFactor,
          intervalsId: activityId, // intervals.icu activity ID for VO2max analysis
          elevation: elevationIdx >= 0 && cols[elevationIdx] ? Math.round(parseFloat(cols[elevationIdx]) * 3.28084) : 0, // Convert meters to feet
          eFTP: eftpIdx >= 0 && cols[eftpIdx] ? parseInt(cols[eftpIdx]) : null, // Continuous eFTP with decay from intervals.icu
          source: 'imported',
        };

        newWorkouts.push(entry);
        imported++;
      }

      if (imported > 0) {
        // Merge with existing history and sort by date
        const mergedHistory = [...newWorkouts, ...history].sort((a, b) =>
          new Date(b.date) - new Date(a.date)
        );

        setHistory(mergedHistory);

        setCSVImportStatus(`✓ Imported ${imported} activities! Skipped ${skipped} (duplicates or missing data). Classify rides in Ride History to update progression levels.`);

        // Clear CSV content after successful import
        setTimeout(() => {
          setCSVContent('');
          setShowCSVImport(false);
        }, 3000);
      } else {
        setCSVImportStatus(`No activities imported. All ${skipped} were duplicates or missing data.`);
      }

    } catch (error) {
      console.error('CSV import error:', error);
      setCSVImportStatus(`Error: ${error.message}. Please check CSV format.`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleLogWorkout = () => {
    const zone = formData.zone;
    const tss = calculateTSS(formData.normalizedPower, formData.duration);
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
        // Recalculate progression for the newly assigned zone
        previousLevel = levels[zone];
        newLevel = calculateNewLevel(previousLevel, formData.workoutLevel, formData.rpe, formData.completed);
        change = newLevel - previousLevel;
      }

      const entry = {
        ...oldWorkout, // Preserve any extra fields like intervalsId, eFTP
        ...formData,
        name: formData.name,
        id: editingRide,
        previousLevel,
        newLevel,
        change,
        tss,
        intensityFactor,
        source: 'manual', // Editing always marks as manually classified
      };

      // Update history with edited entry
      setHistory(history.map(w => w.id === editingRide ? entry : w));

      // Update progression levels if zone was assigned/changed
      if (isNowClassified && (wasUnclassified || zone !== oldWorkout.zone)) {
        setLevels(prev => ({ ...prev, [zone]: newLevel }));
        setDisplayLevels(prev => ({ ...prev, [zone]: newLevel }));
        setRecentChanges(prev => ({
          ...prev,
          [zone]: { change, date: formData.date },
        }));
      }

      // Reset form
      setFormData({
        name: '',
        date: new Date().toISOString().split('T')[0],
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
      });
      setEditingRide(null);
      setShowLogRideModal(false);
      setShowHistoryModal(true);
    } else {
      // Creating new workout
      // Recovery zone does not affect progression levels
      const affectsProgression = zone !== 'recovery';
      const currentLevel = affectsProgression ? levels[zone] : null;
      const newLevel = affectsProgression
        ? calculateNewLevel(currentLevel, formData.workoutLevel, formData.rpe, formData.completed)
        : null;

      const entry = {
        ...formData,
        name: formData.name,
        id: Date.now(),
        previousLevel: currentLevel,
        newLevel: newLevel,
        change: affectsProgression ? newLevel - currentLevel : 0,
        tss,
        intensityFactor,
        source: 'manual',
      };

      // Update recent changes (only for non-recovery zones)
      if (affectsProgression) {
        setRecentChanges(prev => ({
          ...prev,
          [zone]: {
            change: entry.change,
            date: entry.date,
          },
        }));
      }

      // Set last logged workout for summary modal
      setLastLoggedWorkout(entry);

      // Update history and levels
      setHistory([entry, ...history]);
      if (affectsProgression) {
        setLevels({ ...levels, [zone]: newLevel });
      }

      // Show summary modal
      setShowPostLogSummary(true);

      // Reset form
      setFormData({
        name: '',
        date: new Date().toISOString().split('T')[0],
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
      });
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
      setShowEventModal(false);
    }
  };

  // Calculate days until event
  const getDaysUntilEvent = () => {
    if (!event.date) return null;
    const today = new Date();
    const eventDate = new Date(event.date);
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
    setFormData({
      name: '',
      date: new Date().toISOString().split('T')[0],
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
    });
    setShowLogRideModal(false);
  };

  const exportData = () => {
    // Include all user data in export
    const data = JSON.stringify({
      levels,
      history,
      ftp: currentFTP,
      intervalsFTP: intervalsFTP,
      event,
      userProfile,
      powerCurveData,
      exportedAt: new Date().toISOString()
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Better filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
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

          alert(`✓ Data imported successfully!\n${parsed.history?.length || 0} workouts restored.`);
        } catch (err) {
          alert('Invalid file format. Please check the file and try again.');
        }
      };
      reader.readAsText(file);
    }
  };

  const importPowerCurve = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result.trim();
        const lines = text.split('\n');
        const data = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          // Split by tab or comma
          const parts = line.split(/[\t,]+/);
          if (parts.length < 2) continue;
          const secs = parseInt(parts[0]);
          const watts = parseInt(parts[1]);
          // Skip header row or invalid data
          if (isNaN(secs) || isNaN(watts)) continue;
          data.push({ secs, watts });
        }
        if (data.length === 0) {
          alert('No valid power curve data found. Expected two columns: seconds and watts.');
          return;
        }
        setPowerCurveData(data);
        alert(`✓ Power curve imported: ${data.length} data points loaded.`);
      } catch (err) {
        alert('Error reading power curve file. Please check the format.');
      }
    };
    reader.readAsText(file);
    // Reset file input so the same file can be re-imported
    event.target.value = '';
  };

  const handlePasteImport = () => {
    setImportError('');
    try {
      const parsed = JSON.parse(pasteContent);
      if (parsed.levels) {
        setLevels(parsed.levels);
        setDisplayLevels(parsed.levels);
      }
      if (parsed.history) {
        setHistory(parsed.history);
        // Calculate recent changes from imported history
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
      // Import FTP data if available
      if (parsed.ftp) setCurrentFTP(parsed.ftp);
      if (parsed.intervalsFTP) setIntervalsFTP(parsed.intervalsFTP);
      // Import VO2max data if available
      if (parsed.userProfile) setUserProfile(parsed.userProfile);
      if (parsed.vo2maxEstimates) setVo2maxEstimates(parsed.vo2maxEstimates);

      setShowPasteImport(false);
      setPasteContent('');
    } catch (err) {
      setImportError('Invalid JSON format. Please check and try again.');
    }
  };

  const copyForAnalysis = () => {
    const loads = calculateTrainingLoads();
    const recentWorkouts = history.slice(0, 7);

    const analysisText = `## Training Status - ${new Date().toISOString().split('T')[0]}

**Training Loads:**
- CTL (Fitness): ${loads.ctl}
- ATL (Fatigue): ${loads.atl}
- TSB (Form): ${loads.tsb}
- 7-Day TSS: ${loads.weeklyTSS}
- 14-Day TSS: ${loads.twoWeekTSS}

**Progression Levels:**
- Endurance: ${levels.endurance.toFixed(1)}
- Tempo: ${levels.tempo.toFixed(1)}
- Sweet Spot: ${levels.sweetspot.toFixed(1)}
- Threshold: ${levels.threshold.toFixed(1)}
- VO2max: ${levels.vo2max.toFixed(1)}
- Anaerobic: ${levels.anaerobic.toFixed(1)}

**Recent Workouts:**
${recentWorkouts.map(w => `- ${w.date}: ${getZoneName(w.zone)}, ${w.duration}min, NP ${w.normalizedPower}W, TSS ${w.tss}${w.rpe != null ? `, RPE ${w.rpe}` : ''}${w.notes ? ` (${w.notes})` : ''}`).join('\n')}

Please analyze my current training status and provide personalized insights.`;

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

  const getInsightStyle = (type) => {
    switch (type) {
      case 'warning':
        return { bg: 'bg-red-900/50', border: 'border-red-500', icon: '⚠️' };
      case 'caution':
        return { bg: 'bg-yellow-900/50', border: 'border-yellow-500', icon: '⚡' };
      case 'positive':
        return { bg: 'bg-green-900/50', border: 'border-green-500', icon: '✓' };
      case 'info':
      default:
        return { bg: 'bg-blue-900/50', border: 'border-blue-500', icon: 'ℹ' };
    }
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
  const insights = generateInsights(loads, history, levels);
  const currentIF = formData.normalizedPower / currentFTP;
  const currentTSS = calculateTSS(formData.normalizedPower, formData.duration);

  const last7Days = history.filter(w => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(w.date) >= weekAgo;
  });

  const last28Days = history.filter(w => {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 28);
    return new Date(w.date) >= monthAgo;
  });

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
        <p className="text-gray-400 text-sm mb-4">
          FTP: {currentFTP}W
          {(() => {
            // Get most recent eFTP from history
            const latestEFTP = history.find(w => w.eFTP)?.eFTP;
            if (latestEFTP) {
              return <span> • eFTP: <span className="text-purple-400">{latestEFTP}W</span></span>;
            }
            return null;
          })()}
          {(() => {
            const daysToEvent = getDaysUntilEvent();
            return daysToEvent !== null ? ` • Days to Event: ${daysToEvent}` : '';
          })()}
        </p>

        {/* Post-Log Summary Modal */}
        {showPostLogSummary && lastLoggedWorkout && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm text-center">
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

        {/* Paste Import Modal */}
        {showPasteImport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-4 w-full max-w-lg">
              <h2 className="font-bold mb-3">Import Data</h2>
              <p className="text-sm text-gray-400 mb-3">Paste your JSON data below:</p>
              <textarea
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                placeholder='{"levels": {...}, "history": [...]}'
                className="w-full bg-gray-700 rounded px-3 py-2 text-sm h-48 font-mono mb-3"
              />
              {importError && (
                <p className="text-red-400 text-sm mb-3">{importError}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handlePasteImport}
                  className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-medium transition"
                >
                  Import
                </button>
                <button
                  onClick={() => {
                    setShowPasteImport(false);
                    setPasteContent('');
                    setImportError('');
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CSV Import Modal */}
        {showCSVImport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-4 w-full max-w-lg">
              <h2 className="font-bold mb-3 text-lg">Import CSV from intervals.icu</h2>
              <p className="text-sm text-gray-400 mb-3">
                Paste your CSV export from intervals.icu below (tab-separated format):
              </p>
              <textarea
                value={csvContent}
                onChange={(e) => setCSVContent(e.target.value)}
                placeholder="id	Type	Date	Distance	Moving Time	Name	Avg HR	Norm Power	Intensity	Load..."
                className="w-full bg-gray-700 rounded px-3 py-2 text-sm h-48 font-mono mb-3"
              />
              {csvImportStatus && (
                <div className={`p-3 rounded mb-3 text-sm ${
                  csvImportStatus.startsWith('✓')
                    ? 'bg-green-900/50 text-green-400'
                    : csvImportStatus.startsWith('Error')
                    ? 'bg-red-900/50 text-red-400'
                    : 'bg-blue-900/50 text-blue-400'
                }`}>
                  {csvImportStatus}
                </div>
              )}
              <div className="bg-gray-700/50 rounded p-3 mb-4 text-xs text-gray-400">
                <p className="mb-2"><strong>Expected columns (tab-separated):</strong></p>
                <p className="font-mono">Date, Norm Power, Intensity, Load, Moving Time, Name</p>
                <p className="mt-2">From intervals.icu: Activities → Export → CSV</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCSVImport}
                  disabled={isImporting || !csvContent.trim()}
                  className={`flex-1 px-4 py-2 rounded font-medium transition ${
                    isImporting || !csvContent.trim()
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {isImporting ? 'Importing...' : 'Import CSV'}
                </button>
                <button
                  onClick={() => {
                    setShowCSVImport(false);
                    setCSVContent('');
                    setCSVImportStatus('');
                  }}
                  disabled={isImporting}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded font-medium transition disabled:cursor-not-allowed"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FTP Increase Detection Modal */}
        {showFTPModal && detectedFTP && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <div className="text-center mb-4">
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="font-bold text-2xl mb-2">FTP Increase Detected!</h2>
                <p className="text-gray-400 mb-4">
                  Your FTP has increased from <span className="font-bold text-blue-400">{currentFTP}W</span> to{' '}
                  <span className="font-bold text-green-400">{detectedFTP}W</span>
                </p>
                <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
                  <div className="text-4xl font-bold text-green-400 mb-1">
                    +{detectedFTP - currentFTP}W
                  </div>
                  <div className="text-sm text-gray-400">Awesome progress!</div>
                </div>
              </div>

              <p className="text-sm text-gray-300 mb-4">
                How would you like to update your training zones?
              </p>

              <div className="space-y-3">
                <button
                  onClick={handleRecalculateLevels}
                  className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded-lg font-medium transition text-left"
                >
                  <div className="font-bold mb-1">🔄 Recalculate Levels</div>
                  <div className="text-xs text-blue-200">
                    Reset all progression levels to 1.0 and update power zones
                  </div>
                </button>

                <button
                  onClick={handleAdjustZonesOnly}
                  className="w-full bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg font-medium transition text-left"
                >
                  <div className="font-bold mb-1">⚙️ Adjust Zones Only</div>
                  <div className="text-xs text-green-200">
                    Update power zones but keep your progression levels
                  </div>
                </button>

                <button
                  onClick={handleIgnoreFTP}
                  className="w-full bg-gray-600 hover:bg-gray-500 px-4 py-3 rounded-lg font-medium transition text-left"
                >
                  <div className="font-bold mb-1">❌ Ignore for Now</div>
                  <div className="text-xs text-gray-300">
                    Keep current FTP and zones unchanged
                  </div>
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-400 text-center">
                  💡 Tip: Choose "Recalculate" if you want a fresh start, or "Adjust Zones Only" to maintain your current progression.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cloud Sync Instructions Modal */}
        {showCloudSyncHelp && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-xl">☁️ Cloud Sync Guide</h2>
                <button
                  onClick={() => setShowCloudSyncHelp(false)}
                  className="text-gray-400 hover:text-white text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <p className="text-gray-300 mb-4">
                Sync your training data across Windows and iPhone using Google Drive or Dropbox.
              </p>

              <div className="space-y-4">
                {/* Step 1 */}
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="font-bold text-blue-400 mb-2">Step 1: Export on Current Device</div>
                  <p className="text-sm text-gray-300 mb-2">
                    Click <span className="font-mono bg-gray-900 px-1 rounded">Export Data</span> below.
                    This downloads a file named <span className="font-mono bg-gray-900 px-1 rounded">casey-rides-backup-{new Date().toISOString().split('T')[0]}.json</span>
                  </p>
                </div>

                {/* Step 2 */}
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="font-bold text-green-400 mb-2">Step 2: Save to Cloud</div>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• <span className="font-bold">Google Drive:</span> Upload file to a dedicated folder</li>
                    <li>• <span className="font-bold">Dropbox:</span> Move file to your Dropbox folder</li>
                    <li>• <span className="font-bold">iCloud:</span> Save to iCloud Drive (Mac/iPhone)</li>
                  </ul>
                </div>

                {/* Step 3 */}
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="font-bold text-purple-400 mb-2">Step 3: Import on Other Device</div>
                  <p className="text-sm text-gray-300 mb-2">
                    On your other device:
                  </p>
                  <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
                    <li>Download the backup file from cloud storage</li>
                    <li>Click <span className="font-mono bg-gray-900 px-1 rounded">Import File</span> below</li>
                    <li>Select the downloaded .json file</li>
                    <li>Your data syncs instantly!</li>
                  </ol>
                </div>

                {/* Best Practices */}
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <div className="font-bold text-blue-300 mb-2">💡 Best Practices</div>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Export after every session to keep cloud backup current</li>
                    <li>• Use consistent folder name like "Casey Rides Backups"</li>
                    <li>• Keep last 3-5 backups in case you need to restore</li>
                    <li>• Filename includes date for easy version tracking</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={() => setShowCloudSyncHelp(false)}
                className="w-full mt-4 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition"
              >
                Got it!
              </button>
            </div>
          </div>
        )}

        {/* intervals.icu Sync Modal */}
        {showIntervalsSyncModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-4 w-full max-w-lg">
              <h2 className="font-bold mb-3 text-lg">Sync from intervals.icu</h2>
              <p className="text-sm text-gray-400 mb-4">
                Import your rides from intervals.icu starting from December 29, 2024
              </p>

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1">
                  Athlete ID
                  <span className="text-xs ml-2">(e.g., i12345)</span>
                </label>
                <input
                  type="text"
                  value={intervalsConfig.athleteId}
                  onChange={(e) => setIntervalsConfig({ ...intervalsConfig, athleteId: e.target.value })}
                  placeholder="i12345 or 12345"
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                  disabled={isSyncing}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1">
                  API Key
                  <span className="text-xs ml-2">(Settings → Developer)</span>
                </label>
                <input
                  type="password"
                  value={intervalsConfig.apiKey}
                  onChange={(e) => setIntervalsConfig({ ...intervalsConfig, apiKey: e.target.value })}
                  placeholder="Your API key"
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm font-mono"
                  disabled={isSyncing}
                />
              </div>

              {syncStatus && (
                <div className={`p-3 rounded mb-4 text-sm ${
                  syncStatus.startsWith('✓')
                    ? 'bg-green-900/50 text-green-400'
                    : syncStatus.startsWith('Error')
                    ? 'bg-red-900/50 text-red-400'
                    : 'bg-blue-900/50 text-blue-400'
                }`}>
                  {syncStatus}
                </div>
              )}

              <div className="bg-gray-700/50 rounded p-3 mb-4 text-xs text-gray-400">
                <p className="mb-2"><strong>What will be imported:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Rides from December 29, 2024 onwards</li>
                  <li>Power data (NP), TSS, Intensity Factor</li>
                  <li>Duration and workout type</li>
                  <li>Automatic zone mapping based on power</li>
                  <li>RPE if available</li>
                </ul>
                <p className="mt-2 text-gray-500">Duplicates will be skipped automatically.</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={syncFromIntervalsICU}
                  disabled={isSyncing}
                  className={`flex-1 px-4 py-2 rounded font-medium transition ${
                    isSyncing
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </button>
                <button
                  onClick={() => {
                    setShowIntervalsSyncModal(false);
                    setSyncStatus('');
                  }}
                  disabled={isSyncing}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded font-medium transition disabled:cursor-not-allowed"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Event Management Modal */}
        {showEventModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h2 className="font-bold mb-4 text-lg">Event/Goal Management</h2>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Event Name</label>
                  <input
                    type="text"
                    value={eventFormData.name}
                    onChange={(e) => setEventFormData({ ...eventFormData, name: e.target.value })}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                    placeholder="Gran Fondo Utah"
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
                  <p className="text-xs text-gray-500 mt-1">Recommended: 80-100 for Gran Fondo</p>
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
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
                      }
                    }
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
            {ZONES.filter((zone) => zone.id !== 'recovery').map((zone) => (
              <div key={zone.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium flex items-center gap-2">
                    {zone.name}
                    {recentChanges[zone.id] && recentChanges[zone.id].change !== 0 && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          recentChanges[zone.id].change > 0
                            ? 'bg-green-900/50 text-green-400'
                            : 'bg-red-900/50 text-red-400'
                        }`}
                        title={`Last change: ${recentChanges[zone.id].date}`}
                      >
                        {formatChange(recentChanges[zone.id].change)}
                      </span>
                    )}
                  </span>
                  <span className="text-gray-400">{getZoneDescription(zone.id, currentFTP)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-700 rounded-full h-5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${animatingZone === zone.id ? '' : 'transition-all duration-500'}`}
                      style={{
                        width: `${(displayLevels[zone.id] / 10) * 100}%`,
                        backgroundColor: zone.color,
                      }}
                    />
                  </div>
                  <span
                    className={`w-10 text-right font-mono font-bold text-sm ${animatingZone === zone.id ? 'animate-pulse' : ''}`}
                    style={{ color: zone.color }}
                  >
                    {displayLevels[zone.id].toFixed(1)}
                  </span>
                </div>
              </div>
            ))}


            {/* Consolidated Weekly Charts */}
            {(() => {
              const weeklyTSSData = calculateWeeklyTSS(history);
              const weeklyHoursData = calculateWeeklyHours(history);
              const weeklyElevationData = calculateWeeklyElevation(history);
              const eftpHistoryData = calculateEFTPHistory(history);

              const currentWeekTSS = weeklyTSSData.length > 0 ? weeklyTSSData[weeklyTSSData.length - 1].tss : 0;
              const currentWeekHours = weeklyHoursData.length > 0 ? weeklyHoursData[weeklyHoursData.length - 1].hours : 0;
              const currentWeekElevation = weeklyElevationData.length > 0
                ? weeklyElevationData[weeklyElevationData.length - 1].elevation
                : 0;
              const latestEFTP = eftpHistoryData.length > 0
                ? eftpHistoryData[eftpHistoryData.length - 1].eFTP
                : null;

              // Check if any data exists
              const hasData = weeklyTSSData.length > 0 || weeklyHoursData.length > 0 || weeklyElevationData.length > 0 || eftpHistoryData.length > 0;

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
                      <p className="text-gray-500 text-xs">{data.rideName}</p>
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
                  {weeklyChartView === 'elevation' && weeklyElevationData.length > 0 && (
                    <>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium">Weekly Elevation Gained</h3>
                        <span className="text-sm text-gray-400">
                          This week: <span className="text-green-400 font-bold">{currentWeekElevation.toLocaleString()} ft</span>
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={weeklyElevationData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorElevation" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22C55E" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#22C55E" stopOpacity={0.1}/>
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
                            tickFormatter={(value) => `${value.toLocaleString()}ft`}
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
                          Latest: <span className="text-purple-400 font-bold">{latestEFTP}W</span>
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
                            dot={{ fill: '#A855F7', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, fill: '#A855F7', stroke: '#fff', strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </>
                  )}

                  {weeklyChartView === 'eftp' && eftpHistoryData.length === 0 && (
                    <div className="text-center text-gray-400 py-8">
                      <p>No eFTP data available.</p>
                      <p className="text-sm mt-2">Import rides with eFTP data from intervals.icu CSV.</p>
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

              return (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="font-medium mb-1">Power Skills</h3>
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

            {/* Training Summary */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-medium mb-3">Training Summary</h3>
              {(() => {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const fourteenDaysAgo = new Date();
                fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
                const outdoorRides = history.filter(w =>
                  new Date(w.date) >= thirtyDaysAgo &&
                  w.rideType === 'Outdoor' &&
                  w.distance > 0
                );
                const longestRide = outdoorRides.length > 0
                  ? outdoorRides.reduce((max, w) => w.distance > max.distance ? w : max, outdoorRides[0])
                  : null;

                // Calculate 14-day elevation
                const last14Days = history.filter(w => {
                  return new Date(w.date) >= fourteenDaysAgo;
                });
                const elevation14d = last14Days.reduce((sum, w) => sum + (w.elevation || 0), 0);

                return (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-baseline gap-4">
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

            {/* Instant Analysis */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-medium">Instant Analysis</h3>
                <button
                  onClick={copyForAnalysis}
                  className={`text-xs px-3 py-1 rounded transition ${
                    copySuccess
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {copySuccess ? 'Copied!' : 'Copy for Claude'}
                </button>
              </div>
              {insights.length === 0 ? (
                <p className="text-gray-400 text-sm">Log more workouts to generate insights.</p>
              ) : (
                <div className="space-y-2">
                  {insights.map((insight, idx) => {
                    const style = getInsightStyle(insight.type);
                    return (
                      <div
                        key={idx}
                        className={`${style.bg} border-l-2 ${style.border} px-3 py-2 text-sm rounded-r`}
                      >
                        <span className="mr-2">{style.icon}</span>
                        {insight.message}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Fitness Progress */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-medium mb-2">Fitness Progress</h3>
              <div className="w-full">
                <div className="flex justify-between text-xs text-gray-400 mb-2">
                  <span>CTL Target: 80-100 by June</span>
                </div>
                <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (loads.ctl / 100) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0</span>
                  <span>Current: {loads.ctl}</span>
                  <span>100</span>
                </div>
              </div>
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
        </div>

        {/* Log Ride Modal */}
        {showLogRideModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-4 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold">{editingRide ? 'Edit Workout' : 'Log Workout'}</h2>
                <button
                  onClick={() => editingRide ? handleCancelEdit() : setShowLogRideModal(false)}
                  className="text-gray-400 hover:text-white text-xl"
                >
                  ×
                </button>
              </div>

            {/* Ride Name */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Ride Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                placeholder="e.g., Morning Endurance Ride"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1 flex justify-between items-center">
                  Date
                  <button
                    onClick={() => {
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      setFormData({ ...formData, date: yesterday.toISOString().split('T')[0] });
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Yesterday
                  </button>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Primary Zone</label>
                <select
                  value={formData.zone}
                  onChange={(e) => setFormData({
                    ...formData,
                    zone: e.target.value,
                    workoutLevel: ZONE_EXPECTED_RPE[e.target.value]
                  })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                >
                  {ZONES.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                  min="1"
                  max="600"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Normalized Power (W)</label>
                <input
                  type="number"
                  value={formData.normalizedPower}
                  onChange={(e) => setFormData({ ...formData, normalizedPower: parseInt(e.target.value) || 0 })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                  min="50"
                  max="500"
                />
              </div>
            </div>

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
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Distance (miles)
                  {formData.rideType === 'Indoor' && <span className="text-gray-500 ml-1 text-xs">(optional)</span>}
                </label>
                <input
                  type="number"
                  value={formData.distance}
                  onChange={(e) => setFormData({ ...formData, distance: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                  min="0"
                  step="0.1"
                  max="200"
                />
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

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Expected RPE (from zone)
                </label>
                <div className="bg-gray-600 rounded px-3 py-2 text-sm font-mono">
                  {formData.workoutLevel}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Actual RPE: {formData.rpe}
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

            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.completed}
                  onChange={(e) => setFormData({ ...formData, completed: e.target.checked })}
                  className="rounded"
                />
                Completed all intervals
              </label>
            </div>

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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-4 w-full max-w-md max-h-[90vh] overflow-y-auto">
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

                    {/* Title row: Name - Zone Classification • ID • Flags */}
                    <div className="flex justify-between items-start mb-2 pr-16">
                      <div className="flex-1">
                        <div className="font-medium">
                          {entry.name || entry.notes || 'Workout'} - {getZoneName(entry.zone)}
                          {entry.intervalsId && (
                            <span className="text-gray-500 text-xs font-mono ml-2">
                              • {entry.intervalsId}
                            </span>
                          )}
                          {entry.elevation > 2999 && (
                            <span className="ml-2" title="Big Climb">🏔️</span>
                          )}
                          {entry.duration > 180 && (
                            <span className="ml-2" title="Long Ride">🛣️</span>
                          )}
                        </div>
                        <div className="text-gray-400 text-xs">{entry.date}</div>
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
                        {entry.eFTP && <span className="text-gray-400 ml-2">• eFTP {entry.eFTP}W</span>}
                        {!entry.zone && <span className="text-yellow-400 ml-1">• Needs classification</span>}
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
            <button
              onClick={() => setShowCSVImport(true)}
              className="text-gray-400 hover:text-gray-300 transition"
            >
              Paste CSV
            </button>
            <label className="text-gray-400 hover:text-gray-300 transition cursor-pointer">
              Import Power
              <input type="file" accept=".csv,.tsv,.txt" onChange={importPowerCurve} className="hidden" />
            </label>
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
