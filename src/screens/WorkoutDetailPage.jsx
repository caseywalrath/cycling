import React, { useRef } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area, Line, ReferenceArea, Legend } from 'recharts';
import { formatDateWithDay } from '../lib/dates.js';
import { getZoneColor, getZoneName } from '../lib/zones.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { useShell } from '../state/ShellContext.js';
import { goBack } from '../state/useHashRoute.js';
import { Page, Button, StatTile, EmptyState, useToast, useConfirm } from '../components/ui/index.js';

// Ride page at #/ride/<id> (V2 Phase 4 rebuild — replaces the old Workout Detail modal look).
// Header (name/date/type-zone pill/interval label), a 3x2 stats grid, the power/HR chart with
// shaded intervals, the interval table, notes, and the action row (Edit / Re-detect / Attach
// ride file / Delete).
export default function WorkoutDetailPage({ rideId }) {
  const { history, redetectRide, importRideFile, attachRideFile, deleteRide } = useAppData();
  const { openEditRide } = useShell();
  const toast = useToast();
  const confirm = useConfirm();
  const attachInputRef = useRef(null);
  const detailRide = history.find(w => String(w.id) === String(rideId));

  if (!detailRide) {
    return (
      <Page title="Ride" backTo="#/rides">
        <EmptyState message="This ride isn't in your history any more." />
      </Page>
    );
  }

  const isOutdoor = detailRide.rideType === 'Outdoor';
  const avgHr = detailRide.stream?.hr?.length
    ? (() => {
        const vals = detailRide.stream.hr.filter(v => v != null);
        return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
      })()
    : null;

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

  const handleRedetect = () => {
    const res = redetectRide(detailRide.id);
    toast(res.message, { tone: res.ok ? 'success' : 'info' });
  };

  const handleAttachFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const result = await importRideFile(file);
      const { detection } = attachRideFile(detailRide, result);
      toast(detection ? `✓ Interval data attached: ${detection.label}` : '✓ Power/HR data attached (no structured intervals detected).', { tone: 'success' });
    } catch (err) {
      toast(err.message || 'Could not read this ride file.', { tone: 'error' });
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete this ride?',
      message: `${detailRide.name || detailRide.notes || 'Workout'}\nDate: ${detailRide.date}\nDuration: ${detailRide.duration} min\n\nThis action cannot be undone.`,
      confirmLabel: 'Delete ride',
      destructive: true,
    });
    if (!ok) return;
    deleteRide(detailRide.id);
    toast('Ride deleted');
    goBack('#/rides');
  };

  return (
    <Page
      title="Ride"
      backTo="#/rides"
      right={detailRide.stream ? (
        <Button variant="ghost" size="sm" onClick={handleRedetect} aria-label="Re-detect intervals">
          Re-detect
        </Button>
      ) : null}
    >
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold truncate">{detailRide.name || detailRide.notes || 'Workout'}</h2>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <span className="text-sm text-gray-400">{formatDateWithDay(detailRide.date)}</span>
          {isOutdoor ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-700 text-gray-200">Outdoor</span>
          ) : detailRide.zone ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: getZoneColor(detailRide.zone) + '33', color: getZoneColor(detailRide.zone) }}>
              {getZoneName(detailRide.zone)}
            </span>
          ) : (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400">Needs zone</span>
          )}
          {detailRide.intervalData?.label && (
            <span className="text-sm text-yellow-400 font-mono">{detailRide.intervalData.label}</span>
          )}
        </div>
      </div>

      {/* Stats grid: 3 columns x 2 rows, plus Avg HR when known */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatTile label="Duration" value={detailRide.duration} unit="min" />
        <StatTile label="Distance" value={detailRide.distance > 0 ? detailRide.distance : '—'} unit={detailRide.distance > 0 ? 'mi' : undefined} />
        <StatTile label="Elevation" value={detailRide.elevation > 0 ? detailRide.elevation : '—'} unit={detailRide.elevation > 0 ? 'ft' : undefined} />
        <StatTile label="NP" value={detailRide.normalizedPower ?? '—'} unit={detailRide.normalizedPower ? 'W' : undefined} />
        <StatTile label="TSS" value={detailRide.tss ?? '—'} />
        <StatTile label="IF" value={detailRide.intensityFactor != null ? detailRide.intensityFactor.toFixed(2) : '—'} />
        {avgHr != null && <StatTile label="Avg HR" value={avgHr} unit="bpm" />}
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
        <div className="space-y-1 mb-4">
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

      {/* Phase 5: best efforts table, time-in-zones bar, heart-rate drift, efficiency factor go here. */}

      {/* Notes */}
      {detailRide.notes && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-300 mb-1">Notes</h3>
          <p className="text-base text-gray-300 whitespace-pre-line bg-gray-800 rounded-xl p-3">{detailRide.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 mt-6">
        <Button variant="secondary" block onClick={() => openEditRide(detailRide.id)}>Edit ride</Button>
        <label className="inline-flex w-full items-center justify-center min-h-[44px] rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-100 text-base font-medium px-4 cursor-pointer transition-colors">
          Attach ride file (.fit or .tcx)
          <input ref={attachInputRef} type="file" accept=".fit,.FIT,.tcx,.TCX" onChange={handleAttachFile} className="hidden" />
        </label>
        <Button variant="ghost-destructive" block onClick={handleDelete}>Delete ride</Button>
      </div>
    </Page>
  );
}
