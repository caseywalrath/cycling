import React from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area, Line, ReferenceArea, Legend } from 'recharts';
import { formatDateWithDay } from '../lib/dates.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { useShell } from '../state/ShellContext.js';
import { Page, Button, EmptyState, useToast } from '../components/ui/index.js';

// Ride page at #/ride/<id>. The old Workout Detail modal as a full-screen Page (V2 Phase 3):
// summary row, power/HR chart with shaded intervals, interval table — unchanged. Header
// right action: Re-detect (rides with a stream). Phase 4 rebuilds this page.
export default function WorkoutDetailPage({ rideId }) {
  const { history, redetectRide } = useAppData();
  const { openEditRide } = useShell();
  const toast = useToast();
  const detailRide = history.find(w => String(w.id) === String(rideId));

  if (!detailRide) {
    return (
      <Page title="Ride" backTo="#/rides">
        <EmptyState message="This ride isn't in your history any more." />
      </Page>
    );
  }

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
    <Page
      title={detailRide.name || detailRide.notes || 'Workout'}
      backTo="#/rides"
      right={detailRide.stream ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const res = redetectRide(detailRide.id);
            toast(res.message, { tone: res.ok ? 'success' : 'info' });
          }}
          aria-label="Re-detect intervals"
        >
          Re-detect
        </Button>
      ) : null}
    >
      <div className="text-gray-400 text-sm mb-3">{formatDateWithDay(detailRide.date)}</div>

      {/* Summary row */}
      <div className="grid grid-cols-5 gap-2 text-xs mb-4 bg-gray-800 rounded-2xl p-3 tabular-nums">
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
            <div key={i} className="bg-gray-800 rounded-xl px-3 py-2 flex justify-between text-sm font-mono tabular-nums">
              <span className="text-gray-400">#{i + 1}</span>
              <span>{Math.floor((seg.endSec - seg.startSec) / 60)}:{String((seg.endSec - seg.startSec) % 60).padStart(2, '0')}</span>
              <span className="text-blue-400">{seg.avgWatts}W</span>
              <span className="text-red-400">{seg.avgHR != null ? `${seg.avgHR} bpm` : '—'}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Button variant="secondary" block onClick={() => openEditRide(detailRide.id)}>Edit ride</Button>
      </div>
    </Page>
  );
}
