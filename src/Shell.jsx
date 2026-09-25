import React, { useState } from 'react';
import { useAppData } from './state/AppDataContext.jsx';
import { useHashRoute, navigate } from './state/useHashRoute.js';
import { ShellContext } from './state/ShellContext.js';
import { TabBar, Button, useToast } from './components/ui/index.js';
import TodayScreen from './screens/TodayScreen.jsx';
import RidesScreen from './screens/RidesScreen.jsx';
import ProgressScreen from './screens/ProgressScreen.jsx';
import SettingsScreen from './screens/SettingsScreen.jsx';
import WorkoutDetailPage from './screens/WorkoutDetailPage.jsx';
import WorkoutProgressionPage from './screens/WorkoutProgressionPage.jsx';
import LogRideSheet from './screens/LogRideSheet.jsx';
import PostLogSummarySheet from './components/PostLogSummarySheet.jsx';

// The app shell (V2 Phase 3): picks the screen or page for the current hash route, draws the
// tab bar and the floating "＋ Log Ride" button, and owns the two app-wide sheets (Log Ride
// and the post-log summary).
export default function Shell() {
  const route = useHashRoute();
  const { startEditRide, closeRideForm, closePostLogSummary, setFormData, hasUnsyncedChanges } = useAppData();
  const toast = useToast();
  const [logOpen, setLogOpen] = useState(false);
  const [postLogWorkout, setPostLogWorkout] = useState(null);

  const shell = {
    // date: optional YYYY-MM-DD, from the Rides tab's "Log a ride on <date>".
    openLogRide: (date) => {
      if (date) setFormData(prev => ({ ...prev, date }));
      setLogOpen(true);
    },
    openEditRide: (id) => { if (startEditRide(id)) setLogOpen(true); },
  };

  const closeLogSheet = () => {
    closeRideForm();
    setLogOpen(false);
  };

  const handleSaved = (result) => {
    setLogOpen(false);
    if (result.kind === 'new') setPostLogWorkout(result.entry);
    else toast('Ride updated', { tone: 'success' });
  };

  const handleAttached = (rideId, detection) => {
    setLogOpen(false);
    navigate(`#/ride/${rideId}`);
    toast(detection
      ? `✓ Interval data attached: ${detection.label}`
      : '✓ Power/HR data attached (no structured intervals detected).', { tone: 'success' });
  };

  const closePostLog = () => {
    setPostLogWorkout(null);
    closePostLogSummary(); // animates the level bar
  };

  const selectTab = (tab) => {
    if (tab === route.tab && !route.page && !route.section && Object.keys(route.query).length === 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate(`#/${tab}`, { replace: !route.page });
    }
  };

  let content;
  if (route.page === 'ride') content = <WorkoutDetailPage rideId={route.id} />;
  else if (route.page === 'progression') content = <WorkoutProgressionPage zone={route.zone} />;
  else if (route.tab === 'rides') content = <RidesScreen route={route} />;
  else if (route.tab === 'progress') content = <ProgressScreen />;
  else if (route.tab === 'settings') content = <SettingsScreen route={route} />;
  else content = <TodayScreen />;

  const showFab = !route.page && (route.tab === 'today' || route.tab === 'rides');

  return (
    <ShellContext.Provider value={shell}>
      <div className="min-h-screen bg-gray-900 text-white">
        {content}

        {showFab && (
          <div
            className="fixed inset-x-0 z-30 pointer-events-none"
            style={{ bottom: 'calc(56px + env(safe-area-inset-bottom) + 12px)' }}
          >
            <div className="max-w-2xl mx-auto px-4 flex justify-end">
              <Button
                variant="primary"
                rounded="rounded-full"
                className="pointer-events-auto min-h-[48px] px-5 shadow-lg shadow-black/50"
                onClick={() => shell.openLogRide()}
                data-log-ride
              >
                ＋ Log Ride
              </Button>
            </div>
          </div>
        )}

        {!route.page && <TabBar active={route.tab} onSelect={selectTab} badges={{ settings: hasUnsyncedChanges ? 1 : 0 }} />}

        <LogRideSheet open={logOpen} onClose={closeLogSheet} onSaved={handleSaved} onAttached={handleAttached} />
        <PostLogSummarySheet workout={postLogWorkout} onClose={closePostLog} />
      </div>
    </ShellContext.Provider>
  );
}
