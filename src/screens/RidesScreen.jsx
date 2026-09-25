import React from 'react';
import { ridesNeedingZone } from '../lib/alerts.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { useShell } from '../state/ShellContext.js';
import { navigate } from '../state/useHashRoute.js';
import { Screen, Card, SectionHeader, Button, EmptyState } from '../components/ui/index.js';
import ActivityCalendar from '../components/ActivityCalendar.jsx';
import RideHistoryList from '../components/RideHistoryList.jsx';

// Rides tab (V2 Phase 3): the monthly calendar on top, the Ride History list below — both
// re-homed as they were (Phase 4 redesigns them). #/rides?filter=needs-zone (from the
// Today alert) shows only imported indoor rides that still need a zone.
export default function RidesScreen({ route }) {
  const { history } = useAppData();
  const { openLogRide } = useShell();
  const needsZone = route.query.filter === 'needs-zone';
  const rides = needsZone ? ridesNeedingZone(history) : history;

  return (
    <Screen title="Rides" withFab>
      <ActivityCalendar />

      <section>
        <SectionHeader
          title="Ride history"
          subtitle={`${history.length} ride${history.length === 1 ? '' : 's'}`}
        />
        {needsZone && (
          <Card className="mb-3">
            <p className="text-base text-gray-300">
              Showing {rides.length} imported indoor ride{rides.length === 1 ? '' : 's'} that need a zone.
              Tap Edit on a ride and pick its zone.
            </p>
            <Button variant="ghost" size="sm" className="mt-2 -ml-3" onClick={() => navigate('#/rides', { replace: true })}>
              Show all rides
            </Button>
          </Card>
        )}
        {history.length === 0 ? (
          <Card>
            <EmptyState message="No workouts logged yet." actionLabel="Log a ride" onAction={openLogRide} />
          </Card>
        ) : rides.length === 0 ? (
          <Card><EmptyState message="Every imported ride has a zone." /></Card>
        ) : (
          <RideHistoryList rides={rides} />
        )}
      </section>
    </Screen>
  );
}
