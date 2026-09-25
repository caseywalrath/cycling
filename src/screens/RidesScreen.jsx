import React, { useMemo, useState } from 'react';
import { ridesNeedingZone } from '../lib/alerts.js';
import { parseDateLocal } from '../lib/dates.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { useShell } from '../state/ShellContext.js';
import { navigate } from '../state/useHashRoute.js';
import { Screen, Card, SectionHeader, Button, Chip, EmptyState } from '../components/ui/index.js';
import ActivityCalendar from '../components/ActivityCalendar.jsx';
import RideRow from '../components/RideRow.jsx';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'indoor', label: 'Indoor' },
  { id: 'outdoor', label: 'Outdoor' },
  { id: 'needs-zone', label: 'Needs zone' },
];

const MONTHS_PER_PAGE = 3;

const monthKey = (dateStr) => dateStr.slice(0, 7); // "YYYY-MM"
const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

// Rides tab (V2 Phase 4): calendar, filter chips + search, then the ride list grouped by
// month with sticky headers, loaded a few months at a time so 150+ rides stay fast.
export default function RidesScreen({ route }) {
  const { history } = useAppData();
  const { openLogRide } = useShell();
  const [filter, setFilter] = useState(route.query.filter === 'needs-zone' ? 'needs-zone' : 'all');
  const [search, setSearch] = useState('');
  const [visibleMonths, setVisibleMonths] = useState(MONTHS_PER_PAGE);

  const byFilter = useMemo(() => {
    if (filter === 'needs-zone') return ridesNeedingZone(history);
    if (filter === 'indoor') return history.filter(w => w.rideType !== 'Outdoor');
    if (filter === 'outdoor') return history.filter(w => w.rideType === 'Outdoor');
    return history;
  }, [history, filter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return byFilter;
    return byFilter.filter(w =>
      (w.name || '').toLowerCase().includes(q) || (w.notes || '').toLowerCase().includes(q)
    );
  }, [byFilter, search]);

  // Group by calendar month, most recent month first; each group's rides newest-first.
  const groups = useMemo(() => {
    const map = new Map();
    for (const ride of filtered) {
      if (!ride.date) continue;
      const key = monthKey(ride.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ride);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, rides]) => [key, [...rides].sort((a, b) => parseDateLocal(b.date) - parseDateLocal(a.date))]);
  }, [filtered]);

  const shown = groups.slice(0, visibleMonths);
  const hasMore = groups.length > visibleMonths;

  return (
    <Screen title="Rides" withFab>
      <ActivityCalendar />

      <section>
        <SectionHeader
          title="Ride history"
          subtitle={`${filtered.length} of ${history.length} ride${history.length === 1 ? '' : 's'}`}
        />

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" role="group" aria-label="Filter rides">
          {FILTERS.map(f => (
            <Chip key={f.id} selected={filter === f.id} onClick={() => { setFilter(f.id); setVisibleMonths(MONTHS_PER_PAGE); navigate('#/rides', { replace: true }); }}>
              {f.label}
            </Chip>
          ))}
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search rides by name or notes"
          aria-label="Search rides"
          className="w-full bg-gray-800 rounded-xl px-4 py-2 text-base min-h-[44px] mt-3 mb-1 placeholder:text-gray-500"
        />

        {filter === 'needs-zone' && (
          <Card className="my-3">
            <p className="text-base text-gray-300">
              {filtered.length === 0
                ? 'Every imported ride has a zone (or has been marked as historical in Settings).'
                : `Showing ${filtered.length} imported indoor ride${filtered.length === 1 ? '' : 's'} that need a zone. Tap a ride and pick its zone.`}
            </p>
          </Card>
        )}

        <div className="mt-3">
          {history.length === 0 ? (
            <Card><EmptyState message="No workouts logged yet." actionLabel="Log a ride" onAction={() => openLogRide()} /></Card>
          ) : filtered.length === 0 ? (
            <Card><EmptyState message="No rides match this filter." /></Card>
          ) : (
            <div className="space-y-4">
              {shown.map(([key, rides]) => (
                <div key={key}>
                  <div className="sticky z-10 py-1.5 text-sm font-semibold text-gray-400 bg-gray-900/95 backdrop-blur" style={{ top: 'env(safe-area-inset-top)' }}>
                    {monthLabel(key)}
                  </div>
                  <div className="space-y-2">
                    {rides.map(ride => <RideRow key={ride.id} ride={ride} />)}
                  </div>
                </div>
              ))}
              {hasMore && (
                <Button variant="secondary" block onClick={() => setVisibleMonths(v => v + MONTHS_PER_PAGE)}>
                  Show older rides
                </Button>
              )}
            </div>
          )}
        </div>
      </section>
    </Screen>
  );
}
