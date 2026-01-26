import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ZONES = [
  { id: 'endurance', name: 'Endurance', color: '#3B82F6', description: 'Z2: 130-165W' },
  { id: 'tempo', name: 'Tempo', color: '#22C55E', description: 'Z3: 165-185W' },
  { id: 'sweetspot', name: 'Sweet Spot', color: '#EAB308', description: '195-220W' },
  { id: 'threshold', name: 'Threshold', color: '#F97316', description: 'Z4: 220-235W' },
  { id: 'vo2max', name: 'VO2max', color: '#EF4444', description: 'Z5: 235-280W' },
  { id: 'anaerobic', name: 'Anaerobic', color: '#8B5CF6', description: 'Z6: 280W+' },
];

const DEFAULT_LEVELS = {
  endurance: 1,
  tempo: 1,
  sweetspot: 1,
  threshold: 1,
  vo2max: 1,
  anaerobic: 1,
};

const STORAGE_KEY = 'cycling-progression-data-v2';
const INTERVALS_CONFIG_KEY = 'intervals-icu-config';
const FTP = 235;
const START_DATE = '2024-12-29'; // Import rides from this date onwards

export default function ProgressionTracker() {
  const [levels, setLevels] = useState(DEFAULT_LEVELS);
  const [displayLevels, setDisplayLevels] = useState(DEFAULT_LEVELS);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('levels');
  const [showPasteImport, setShowPasteImport] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [importError, setImportError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [showPostLogSummary, setShowPostLogSummary] = useState(false);
  const [lastLoggedWorkout, setLastLoggedWorkout] = useState(null);
  const [recentChanges, setRecentChanges] = useState({});
  const [animatingZone, setAnimatingZone] = useState(null);
  const animationRef = useRef(null);

  // intervals.icu integration state
  const [showIntervalsSyncModal, setShowIntervalsSyncModal] = useState(false);
  const [intervalsConfig, setIntervalsConfig] = useState({
    athleteId: 'i259740',
    apiKey: '4ocowoxwxjf0lknxweavsalps'
  });
  const [syncStatus, setSyncStatus] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

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

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    zone: 'endurance',
    workoutLevel: 2,
    rpe: 5,
    completed: true,
    duration: 60,
    normalizedPower: 150,
    rideType: 'Outdoor', // 'Outdoor' or 'Indoor'
    distance: 0, // miles
    notes: '',
  });

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ levels, history, event }));
  }, [levels, history, event]);

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

  // Animate level changes
  // Calculate zone descriptions dynamically based on current FTP
  const getZoneDescription = (zoneId, ftp) => {
    const zones = {
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
    endurance: { min: 0, max: Math.round(ftp * 0.70) },
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

    const prevWeeklyTSS = sorted
      .filter(w => new Date(w.date) >= twoWeeksAgo && new Date(w.date) < weekAgo)
      .reduce((sum, w) => sum + (w.tss || 0), 0);

    return {
      ctl: Math.round(ctl),
      atl: Math.round(atl),
      tsb: Math.round(ctl - atl),
      weeklyTSS,
      prevWeeklyTSS,
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
      // Get Sunday of that week (week starts on Sunday)
      const sunday = new Date(date);
      sunday.setDate(date.getDate() - date.getDay());
      const weekKey = sunday.toISOString().split('T')[0];

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

  const generateInsights = (loads, history, levels) => {
    const insights = [];
    const { ctl, atl, tsb, weeklyTSS, prevWeeklyTSS } = loads;

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
      // First, fetch athlete data to get current eFTP
      console.log('=== FETCHING ATHLETE DATA FOR eFTP ===');
      const athleteResponse = await fetch(
        `https://intervals.icu/api/v1/athlete/${intervalsConfig.athleteId}`,
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
        `https://intervals.icu/api/v1/athlete/${intervalsConfig.athleteId}/activities?oldest=${START_DATE}`,
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
            `https://intervals.icu/api/v1/athlete/${intervalsConfig.athleteId}/activities/${activitySummary.id}`,
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

          // Map to our zone
          const zone = mapWorkoutTypeToZone(activityData);
          const currentLevel = levels[zone];

          // Estimate workout level from IF
          const intensityFactor = np / currentFTP;
          const workoutLevel = Math.min(10, Math.max(1, intensityFactor * 5));

          // Get RPE if available (wellness data)
          const rpe = activityData.feel || activityData.perceived_exertion || 5; // Default to 5 if not available

          // Calculate new level
          const newLevel = calculateNewLevel(currentLevel, workoutLevel, rpe, true);

          // Extract distance and ride type
          const distanceMeters = activityData.distance || 0;
          const distanceMiles = distanceMeters / 1000 * 0.621371; // Convert meters to miles
          const activityType = activityData.type || 'Ride';
          const rideType = activityType === 'VirtualRide' ? 'Indoor' : 'Outdoor';

          // Create workout entry
          const entry = {
            id: Date.now() + imported, // Unique ID
            date: activityDate,
            zone: zone,
            workoutLevel: parseFloat(workoutLevel.toFixed(1)),
            rpe: rpe,
            completed: true,
            duration: Math.round((activityData.moving_time || activityData.elapsed_time || 0) / 60),
            normalizedPower: Math.round(np),
            rideType: rideType,
            distance: Math.round(distanceMiles * 10) / 10, // Round to 1 decimal
            notes: `Imported from intervals.icu: ${activityData.name || 'Ride'}`,
            previousLevel: currentLevel,
            newLevel: newLevel,
            change: newLevel - currentLevel,
            tss: tss,
            intensityFactor: intensityFactor,
          };

          newWorkouts.push(entry);

          // Update level for next workout calculation
          levels[zone] = newLevel;

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
        setLevels({ ...levels });
        setDisplayLevels({ ...levels });

        // Recalculate recent changes
        const changes = {};
        ZONES.forEach(zone => {
          const lastWorkout = mergedHistory.find(w => w.zone === zone.id);
          if (lastWorkout && lastWorkout.change !== 0) {
            changes[zone.id] = {
              change: lastWorkout.change,
              date: lastWorkout.date,
            };
          }
        });
        setRecentChanges(changes);

        let statusMsg = `✓ Imported ${imported} activities!`;
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

      // Parse header row (tab-separated)
      const headers = lines[0].split('\t');
      setCSVImportStatus(`Found ${lines.length - 1} activities. Processing...`);

      // Find column indices
      const dateIdx = headers.findIndex(h => h.toLowerCase().includes('date'));
      const npIdx = headers.findIndex(h => h.toLowerCase().includes('norm') && h.toLowerCase().includes('power'));
      const intensityIdx = headers.findIndex(h => h.toLowerCase().includes('intensity'));
      const loadIdx = headers.findIndex(h => h.toLowerCase().includes('load'));
      const timeIdx = headers.findIndex(h => h.toLowerCase().includes('moving') && h.toLowerCase().includes('time'));
      const nameIdx = headers.findIndex(h => h.toLowerCase().includes('name'));
      const typeIdx = headers.findIndex(h => h.toLowerCase() === 'type');
      const distanceIdx = headers.findIndex(h => h.toLowerCase().includes('distance'));

      console.log('CSV Column Indices:', { dateIdx, npIdx, intensityIdx, loadIdx, timeIdx, nameIdx, typeIdx, distanceIdx });

      let imported = 0;
      let skipped = 0;
      const newWorkouts = [];
      const tempLevels = { ...levels };

      // Process each data row
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t');

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

        // Map to zone based on NP
        const ranges = getZonePowerRanges(currentFTP);
        let zone = 'endurance';
        if (np >= ranges.anaerobic.min) zone = 'anaerobic';
        else if (np >= ranges.vo2max.min) zone = 'vo2max';
        else if (np >= ranges.threshold.min) zone = 'threshold';
        else if (np >= ranges.sweetspot.min) zone = 'sweetspot';
        else if (np >= ranges.tempo.min) zone = 'tempo';

        const currentLevel = tempLevels[zone];

        // Estimate workout level from IF
        const workoutLevel = Math.min(10, Math.max(1, intensityFactor * 5));

        // Default RPE to 5 (no RPE data in CSV)
        const rpe = 5;

        // Calculate new level
        const newLevel = calculateNewLevel(currentLevel, workoutLevel, rpe, true);

        // Create workout entry
        const entry = {
          id: Date.now() + imported,
          date: activityDate,
          zone: zone,
          workoutLevel: parseFloat(workoutLevel.toFixed(1)),
          rpe: rpe,
          completed: true,
          duration: Math.round(duration),
          normalizedPower: Math.round(np),
          rideType: rideType,
          distance: Math.round(distance * 10) / 10, // Round to 1 decimal
          notes: `${activityName}`,
          previousLevel: currentLevel,
          newLevel: newLevel,
          change: newLevel - currentLevel,
          tss: tss,
          intensityFactor: intensityFactor,
        };

        newWorkouts.push(entry);
        tempLevels[zone] = newLevel;
        imported++;
      }

      if (imported > 0) {
        // Merge with existing history and sort by date
        const mergedHistory = [...newWorkouts, ...history].sort((a, b) =>
          new Date(b.date) - new Date(a.date)
        );

        setHistory(mergedHistory);
        setLevels(tempLevels);
        setDisplayLevels(tempLevels);

        // Recalculate recent changes
        const changes = {};
        ZONES.forEach(zone => {
          const lastWorkout = mergedHistory.find(w => w.zone === zone.id);
          if (lastWorkout && lastWorkout.change !== 0) {
            changes[zone.id] = {
              change: lastWorkout.change,
              date: lastWorkout.date,
            };
          }
        });
        setRecentChanges(changes);

        setCSVImportStatus(`✓ Imported ${imported} activities! Skipped ${skipped} (duplicates or missing data).`);

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
    const currentLevel = levels[zone];
    const newLevel = calculateNewLevel(
      currentLevel,
      formData.workoutLevel,
      formData.rpe,
      formData.completed
    );

    const tss = calculateTSS(formData.normalizedPower, formData.duration);
    const intensityFactor = calculateIF(formData.normalizedPower);

    const entry = {
      ...formData,
      id: Date.now(),
      previousLevel: currentLevel,
      newLevel: newLevel,
      change: newLevel - currentLevel,
      tss,
      intensityFactor,
    };

    // Update recent changes
    setRecentChanges(prev => ({
      ...prev,
      [zone]: {
        change: entry.change,
        date: entry.date,
      },
    }));

    // Set last logged workout for summary modal
    setLastLoggedWorkout(entry);

    // Update history and levels
    setHistory([entry, ...history]);
    setLevels({ ...levels, [zone]: newLevel });

    // Show summary modal
    setShowPostLogSummary(true);

    // Reset form
    setFormData({
      date: new Date().toISOString().split('T')[0],
      zone: 'endurance',
      workoutLevel: 2,
      rpe: 5,
      completed: true,
      duration: 60,
      normalizedPower: 150,
      rideType: 'Outdoor',
      distance: 0,
      notes: '',
    });
  };

  const closePostLogSummary = () => {
    setShowPostLogSummary(false);
    setActiveTab('levels');

    // Trigger animation after modal closes
    if (lastLoggedWorkout) {
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

  const exportData = () => {
    // Include FTP data in export
    const data = JSON.stringify({
      levels,
      history,
      ftp: currentFTP,
      intervalsFTP: intervalsFTP,
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

          alert(`✓ Data imported successfully!\n${parsed.history?.length || 0} workouts restored.`);
        } catch (err) {
          alert('Invalid file format. Please check the file and try again.');
        }
      };
      reader.readAsText(file);
    }
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
- Weekly TSS: ${loads.weeklyTSS}
- Previous Week TSS: ${loads.prevWeeklyTSS}

**Progression Levels:**
- Endurance: ${levels.endurance.toFixed(1)}
- Tempo: ${levels.tempo.toFixed(1)}
- Sweet Spot: ${levels.sweetspot.toFixed(1)}
- Threshold: ${levels.threshold.toFixed(1)}
- VO2max: ${levels.vo2max.toFixed(1)}
- Anaerobic: ${levels.anaerobic.toFixed(1)}

**Recent Workouts:**
${recentWorkouts.map(w => `- ${w.date}: ${getZoneName(w.zone)}, ${w.duration}min, NP ${w.normalizedPower}W, TSS ${w.tss}, RPE ${w.rpe}${w.notes ? ` (${w.notes})` : ''}`).join('\n')}

Please analyze my current training status and provide personalized insights.`;

    navigator.clipboard.writeText(analysisText).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const getZoneName = (zoneId) => {
    const zone = ZONES.find(z => z.id === zoneId);
    return zone ? zone.name : zoneId;
  };

  const getZoneColor = (zoneId) => {
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
        <h1 className="text-xl font-bold mb-1">Casey Rides</h1>
        <p className="text-gray-400 text-sm mb-4">
          FTP: {currentFTP}W
          {intervalsFTP && (
            <span className="ml-2">• eFTP: {intervalsFTP}W</span>
          )}
          {' • Event: June 13, 2026'}
        </p>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-gray-800 rounded-lg p-1">
          {[
            { id: 'levels', label: 'Levels' },
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'log', label: 'Log' },
            { id: 'history', label: 'History' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

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
                  placeholder="i12345"
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

        {/* Levels Tab */}
        {activeTab === 'levels' && (
          <div className="space-y-4">
            {ZONES.map((zone) => (
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
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
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

            {/* Weekly Hours Chart */}
            {(() => {
              const weeklyData = calculateWeeklyHours(history);
              const currentWeekHours = weeklyData.length > 0 ? weeklyData[weeklyData.length - 1].hours : 0;

              // Custom tooltip
              const CustomTooltip = ({ active, payload }) => {
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

              return weeklyData.length > 0 ? (
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium">Weekly Training Hours</h3>
                    <span className="text-sm text-gray-400">
                      This week: <span className="text-orange-400 font-bold">{currentWeekHours}h</span>
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                      />
                      <Tooltip content={<CustomTooltip />} />
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
                </div>
              ) : null;
            })()}

            {/* Event/Goal Management */}
            {event.name && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-medium">Event Goal</h3>
                  <button
                    onClick={() => {
                      setEventFormData(event);
                      setShowEventModal(true);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Edit
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Event:</span>
                    <span className="font-medium">{event.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Date:</span>
                    <span className="font-medium">
                      {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {getDaysUntilEvent() !== null && (
                        <span className="ml-2 text-blue-400">
                          ({getDaysUntilEvent()} days)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Distance:</span>
                    <span className="font-medium">{event.distance} miles</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Target CTL:</span>
                    <span className={`font-medium ${loads.ctl >= event.targetCTL ? 'text-green-400' : 'text-yellow-400'}`}>
                      {event.targetCTL} {loads.ctl >= event.targetCTL && '✓'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {!event.name && (
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm mb-3">No event goal set</p>
                <button
                  onClick={() => {
                    setEventFormData({
                      name: 'Gran Fondo Utah',
                      date: '2026-06-13',
                      distance: 100,
                      targetCTL: 85,
                    });
                    setShowEventModal(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm transition"
                >
                  Add Event
                </button>
              </div>
            )}

            {/* Training Summary */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-medium mb-3">Training Summary</h3>
              {(() => {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const outdoorRides = history.filter(w =>
                  new Date(w.date) >= thirtyDaysAgo &&
                  w.rideType === 'Outdoor' &&
                  w.distance > 0
                );
                const longestRide = outdoorRides.length > 0
                  ? outdoorRides.reduce((max, w) => w.distance > max.distance ? w : max, outdoorRides[0])
                  : null;

                return (
                  <div className="grid grid-cols-4 gap-3 text-xs">
                    <div>
                      <div className="text-gray-400 mb-1">7 Days</div>
                      <div className="text-base font-bold">{loads.weeklyTSS} TSS</div>
                      <div className="text-gray-500">{last7Days.length} rides</div>
                    </div>
                    <div>
                      <div className="text-gray-400 mb-1">28 Days</div>
                      <div className="text-base font-bold">
                        {last28Days.reduce((sum, w) => sum + (w.tss || 0), 0)} TSS
                      </div>
                      <div className="text-gray-500">{last28Days.length} rides</div>
                    </div>
                    {longestRide ? (
                      <>
                        <div>
                          <div className="text-gray-400 mb-1">Longest (30d)</div>
                          <div className="text-base font-bold">{longestRide.duration} min</div>
                          <div className="text-gray-500">Duration</div>
                        </div>
                        <div>
                          <div className="text-gray-400 mb-1">&nbsp;</div>
                          <div className="text-base font-bold">{longestRide.distance} mi</div>
                          <div className="text-gray-500">Distance</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <div className="text-gray-400 mb-1">Longest (30d)</div>
                          <div className="text-base font-bold text-gray-600">--</div>
                          <div className="text-gray-500">Duration</div>
                        </div>
                        <div>
                          <div className="text-gray-400 mb-1">&nbsp;</div>
                          <div className="text-base font-bold text-gray-600">--</div>
                          <div className="text-gray-500">Distance</div>
                        </div>
                      </>
                    )}
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

            {/* Recent Workouts Mini Table */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-medium mb-3">Recent Workouts</h3>
              {history.length === 0 ? (
                <p className="text-gray-400 text-sm">No workouts logged yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="flex justify-between text-sm py-1 border-b border-gray-700 last:border-0">
                      <span className="text-gray-400">{entry.date}</span>
                      <span>{getZoneName(entry.zone)}</span>
                      <span className="text-gray-400">{entry.duration}min</span>
                      <span className="font-mono">{entry.tss} TSS</span>
                      <span className="font-mono text-gray-400">{entry.intensityFactor.toFixed(2)} IF</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CTL Progress */}
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
          </div>
        )}

        {/* Log Tab */}
        {activeTab === 'log' && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="font-bold mb-4">Log Workout</h2>

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
                  onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
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
                  <option value="Outdoor">Outdoor</option>
                  <option value="Indoor">Indoor</option>
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
                  Workout Level: {formData.workoutLevel}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={formData.workoutLevel}
                  onChange={(e) => setFormData({ ...formData, workoutLevel: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Easy</span>
                  <span>Hard</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  RPE: {formData.rpe}
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
                  <span>Maximal</span>
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
              Save Workout
            </button>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="font-bold mb-4">Workout History</h2>
            {history.length === 0 ? (
              <p className="text-gray-400 text-sm">No workouts logged yet.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {history.map((entry) => (
                  <div key={entry.id} className="bg-gray-700 rounded p-3 text-sm relative">
                    <button
                      onClick={() => handleDeleteWorkout(entry.id)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-400 transition text-xs px-2 py-1 rounded hover:bg-gray-600"
                      title="Delete workout"
                    >
                      🗑️
                    </button>
                    <div className="flex justify-between mb-2 pr-8">
                      <span className="font-medium">{getZoneName(entry.zone)}</span>
                      <span className="text-gray-400">{entry.date}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                      <div>
                        <span className="text-gray-400">Duration</span>
                        <div className="font-mono">{entry.duration}min</div>
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
                    <div className="flex justify-between text-xs">
                      <span>Level {entry.workoutLevel} • RPE {entry.rpe}</span>
                      <span className={entry.change > 0 ? 'text-green-400' : entry.change < 0 ? 'text-red-400' : 'text-gray-400'}>
                        {entry.previousLevel.toFixed(1)} → {entry.newLevel.toFixed(1)} ({formatChange(entry.change)})
                      </span>
                    </div>
                    {entry.notes && <p className="text-gray-400 mt-2 text-xs">{entry.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Export/Import */}
        <div className="flex gap-3 text-sm mt-6 flex-wrap">
          <button
            onClick={exportData}
            className="text-gray-400 hover:text-white transition font-medium"
          >
            Export Data
          </button>
          <label className="text-gray-400 hover:text-white transition cursor-pointer font-medium">
            Import File
            <input type="file" accept=".json" onChange={importData} className="hidden" />
          </label>
          <button
            onClick={() => setShowCloudSyncHelp(true)}
            className="text-blue-400 hover:text-blue-300 transition font-medium"
          >
            ☁️ How to Sync?
          </button>
          <button
            onClick={() => setShowPasteImport(true)}
            className="text-gray-500 hover:text-gray-400 transition text-xs"
          >
            Paste JSON
          </button>
          <button
            onClick={() => setShowCSVImport(true)}
            className="text-purple-400 hover:text-purple-300 transition font-medium"
          >
            Import CSV
          </button>
          <button
            onClick={() => setShowIntervalsSyncModal(true)}
            className="text-green-400 hover:text-green-300 transition font-medium"
          >
            Sync from intervals.icu
          </button>
        </div>
      </div>
    </div>
  );
}
