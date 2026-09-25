import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ZONES, getZoneName } from '../lib/zones.js';
import { parseDateLocal, formatDateWithDay } from '../lib/dates.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { navigate } from '../state/useHashRoute.js';
import { Page, Button, Chip, SegmentedControl, useConfirm, useToast } from '../components/ui/index.js';

// Workout Progression at #/progress/workouts (no zone picked: the 5 most recent indoor
// workouts) and #/progress/zone/<zoneId> (that zone's interval sessions: trend chart + list).
// The old Workout Progression modal as a Page (V2 Phase 3); content unchanged. Zone tabs are
// Chips, the metric toggle is a SegmentedControl, and Re-scan asks with a ConfirmSheet.
export default function WorkoutProgressionPage({ zone }) {
  const { history, redetectCandidates, redetectAll } = useAppData();
  const confirm = useConfirm();
  const toast = useToast();
  const [progressionMetric, setProgressionMetric] = useState('minutes'); // 'minutes' | 'watts'
  const progressionCategory = ZONES.some(z => z.id === zone) ? zone : null;
  const setProgressionCategory = (id) => navigate(`#/progress/zone/${id}`, { replace: true });
  const openRide = (id) => navigate(`#/ride/${id}`);

  const handleRedetectAll = async () => {
    const count = redetectCandidates().length;
    if (count > 0) {
      const ok = await confirm({
        title: `Re-scan ${count} ride${count === 1 ? '' : 's'} for intervals?`,
        message: 'This re-runs detection on the power data already saved with each ride. ' +
          'Automatically detected labels and categories may change; manually set ones are left alone.',
        confirmLabel: 'Re-scan',
      });
      if (!ok) return;
    }
    const res = redetectAll();
    toast(res.message, { tone: res.ok ? 'success' : 'info' });
  };

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
    <Page
      title="Workout Progression"
      backTo="#/progress"
      right={<Button variant="ghost" size="sm" onClick={handleRedetectAll} aria-label="Re-scan all rides for intervals">Re-scan</Button>}
    >
      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {progressionZones.map(z => {
          const count = history.filter(w => w.intervalData?.category === z.id).length;
          const active = progressionCategory === z.id;
          return (
            <Chip key={z.id} selected={active} color={z.color} onClick={() => setProgressionCategory(z.id)}>
              {z.name} {count > 0 && <span className="opacity-75 tabular-nums">({count})</span>}
            </Chip>
          );
        })}
      </div>

      {progressionCategory === null ? (
        recentIndoor.length === 0 ? (
          <p className="text-gray-400 text-base">
            No indoor workouts logged yet. Log or import one to start tracking interval progressions.
          </p>
        ) : (
          <>
            <p className="text-gray-400 text-sm mb-2">Select a zone above to see its progression trend. Most recent indoor workouts:</p>
            <div className="space-y-2">
              {recentIndoor.map(w => {
                const hasDetail = w.stream || w.intervalData;
                const zoneColor = ZONES.find(z => z.id === w.zone)?.color;
                const Tag = hasDetail ? 'button' : 'div';
                return (
                  <Tag
                    key={w.id}
                    {...(hasDetail ? { type: 'button', onClick: () => openRide(w.id) } : {})}
                    className={`block w-full text-left bg-gray-800 rounded-xl p-3 text-sm transition ${hasDetail ? 'hover:bg-gray-700 cursor-pointer' : ''}`}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-medium truncate">{w.name || w.notes || 'Workout'}</span>
                      <span className="text-gray-400 text-xs shrink-0">{formatDateWithDay(w.date)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs" style={zoneColor ? { color: zoneColor } : {}}>
                        {getZoneName(w.zone)}
                      </span>
                      {w.intervalData?.label && (
                        <span className="font-mono text-yellow-400 text-xs">{w.intervalData.label}</span>
                      )}
                    </div>
                  </Tag>
                );
              })}
            </div>
          </>
        )
      ) : sessionsAsc.length === 0 ? (
        <p className="text-gray-400 text-base">
          No tracked {activeZone?.name} workouts yet. Import a FIT or TCX file from Log Ride to start tracking interval progressions.
        </p>
      ) : (
        <>
          {sessionsAsc.length >= 2 && (
            <div className="mb-4 bg-gray-800 rounded-2xl p-4">
              <SegmentedControl
                ariaLabel="Trend metric"
                className="mb-3"
                options={[{ value: 'minutes', label: 'Work Minutes' }, { value: 'watts', label: 'Avg Watts' }]}
                value={progressionMetric}
                onChange={setProgressionMetric}
              />
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
                <button
                  key={w.id}
                  type="button"
                  onClick={() => openRide(w.id)}
                  className="block w-full text-left bg-gray-800 hover:bg-gray-700 rounded-xl p-3 text-sm cursor-pointer transition"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-xs">{formatDateWithDay(w.date)}</span>
                    <span className="text-gray-400 text-xs tabular-nums">{Math.round(workMinutes(w))} min work</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="font-mono text-yellow-400">{w.intervalData.label}</span>
                    <span className="text-red-400 text-xs tabular-nums">{dom.avgHR != null ? `${dom.avgHR} bpm` : '—'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </Page>
  );
}
