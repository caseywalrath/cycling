import React, { useEffect } from 'react';
import { navigate } from '../state/useHashRoute.js';
import { Screen, Card, SectionHeader } from '../components/ui/index.js';
import ProgressionLevels from '../components/ProgressionLevels.jsx';
import FitnessChart from '../components/FitnessChart.jsx';
import TrainingCharts from '../components/TrainingCharts.jsx';
import PowerCurveChart from '../components/PowerCurveChart.jsx';
import PowerSkillsCard from '../components/PowerSkillsCard.jsx';
import EftpChart from '../components/EftpChart.jsx';
import AerobicFitnessCard from '../components/AerobicFitnessCard.jsx';
import RecordsCard from '../components/RecordsCard.jsx';

// Progress tab (V2 Phase 6 §6.1 redesign). Top to bottom: progression levels, the Fitness
// chart, training volume (Hours/TSS/Elevation/Zones), the power curve + Power Skills, eFTP,
// aerobic fitness, records, and a row into Workout Progression. Every heavy computation here
// (dailyLoadSeries, personalBests, records(), observedMaxHr) is memoised in AppDataContext,
// keyed on history/currentFTP, so switching to this tab stays under 300ms even with 150+
// rides (V2_PLAN.md §6.4) — data-progress-screen marks the tab for the regression check's
// timing measurement.
export default function ProgressScreen() {
  // V2_PLAN.md §6.4: the regression check times the tab switch with performance.now() from a
  // mark it sets right before tapping the Progress tab, read back here after paint. Wrapped in
  // try/catch: window.__navStart only exists during that check, never in normal use.
  useEffect(() => {
    try {
      if (window.__navStart != null) window.__progressReadyMs = performance.now() - window.__navStart;
    } catch { /* not running under the regression check */ }
  }, []);

  return (
    <Screen title="Progress">
      <div data-progress-screen />
      <Card>
        <SectionHeader title="Progression levels" subtitle="Tap a zone to see its workouts" />
        <ProgressionLevels />
      </Card>

      <FitnessChart />

      <TrainingCharts />

      <PowerCurveChart />

      <PowerSkillsCard />

      <EftpChart />

      <AerobicFitnessCard />

      <RecordsCard />

      <Card as="button" onClick={() => navigate('#/progress/workouts')} className="flex items-center justify-between gap-3 min-h-[56px]">
        <span>
          <span className="block text-base font-semibold">Workout progression</span>
          <span className="block text-sm text-gray-400">Interval sessions by zone, with trends</span>
        </span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-gray-500 shrink-0">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Card>
    </Screen>
  );
}
