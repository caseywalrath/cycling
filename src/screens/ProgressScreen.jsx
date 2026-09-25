import React from 'react';
import { navigate } from '../state/useHashRoute.js';
import { Screen, Card, SectionHeader } from '../components/ui/index.js';
import ProgressionLevels from '../components/ProgressionLevels.jsx';
import TrainingCharts from '../components/TrainingCharts.jsx';
import PowerSkillsCard from '../components/PowerSkillsCard.jsx';

// Progress tab (V2 Phase 3): progression level bars, the Hours/TSS/Elevation/eFTP charts,
// Power Skills and a row into Workout Progression — re-homed as they were. Phase 6
// redesigns this tab.
export default function ProgressScreen() {
  return (
    <Screen title="Progress">
      <Card>
        <SectionHeader title="Progression levels" subtitle="Tap a zone to see its workouts" />
        <ProgressionLevels />
      </Card>

      <TrainingCharts />

      <PowerSkillsCard />

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
