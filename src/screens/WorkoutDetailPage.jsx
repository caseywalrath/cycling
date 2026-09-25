import React, { useRef } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area, Line, ReferenceArea, Legend } from 'recharts';
import { formatDateWithDay } from '../lib/dates.js';
import { ZONES, getZoneColor, getZoneName } from '../lib/zones.js';
import { bestsForRide, timeInZones, aerobicDecoupling, decouplingBand, efficiencyFactor } from '../lib/analysis.js';
import { newBestsForRide } from '../lib/records.js';
import { formatMinutes } from '../lib/format.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { useShell } from '../state/ShellContext.js';
import { goBack } from '../state/useHashRoute.js';
import { Page, Button, Card, StatTile, EmptyState, useToast, useConfirm } from '../components/ui/index.js';

// Best-effort durations shown on the Ride page, with their display labels (V2_PLAN.md §5.6).
const BEST_EFFORT_ROWS = [['5', '5s'], ['60', '1m'], ['300', '5m'], ['1200', '20m'], ['3600', '60m']];

// Ride page at #/ride/<id> (V2 Phase 4 rebuild — replaces the old Workout Detail modal look).
// Header (name/date/type-zone pill/interval label), a 3x2 stats grid, the power/HR chart with
// shaded intervals, the interval table, notes, and the action row (Edit / Re-detect / Attach
// ride file / Delete).
export default function WorkoutDetailPage({ rideId }) {
  const { history, currentFTP, redetectRide, importRideFile, attachRideFile, deleteRide } = useAppData();
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

  // V2 Phase 5: a ride can have HR with no power (stream.power === null) — chart HR only.
  const streamLength = detailRide.stream ? (detailRide.stream.power?.length ?? detailRide.stream.hr.length) : 0;
  const chartData = detailRide.stream
    ? Array.from({ length: streamLength }, (_, i) => ({
        min: Math.round((i * detailRide.stream.binSeconds) / 60 * 10) / 10,
        power: detailRide.stream.power ? detailRide.stream.power[i] : null,
        hr: detailRide.stream.hr[i],
      }))
    : [];
  const hasHR = detailRide.stream && detailRide.stream.hr.some(v => v != null);
  const hasPower = detailRide.stream && detailRide.stream.power != null;

  // V2 Phase 5 §5.6: best efforts, time in zones, HR drift and efficiency.
  const { bests, source: bestsSource } = bestsForRide(detailRide);
  const newBests = newBestsForRide(history, detailRide);
  const zoneTotals = currentFTP ? timeInZones(detailRide, currentFTP) : null;
  const totalZoneSeconds = zoneTotals ? Object.values(zoneTotals).reduce((a, b) => a + b, 0) : 0;
  const decoupling = aerobicDecoupling(detailRide);
  const decBand = decouplingBand(decoupling);
  const ef = efficiencyFactor(detailRide);

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
              {hasPower && (
                <YAxis
                  yAxisId="power"
                  stroke="#3B82F6"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(v) => `${v}W`}
                  width={50}
                />
              )}
              {hasHR && (
                <YAxis
                  yAxisId="hr"
                  orientation={hasPower ? 'right' : 'left'}
                  stroke="#EF4444"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(v) => `${v}`}
                  width={hasPower ? 40 : 50}
                />
              )}
              <Tooltip content={<DetailTooltip />} />
              {hasPower && detailRide.intervalData?.segments?.map((seg, i) => (
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
              {hasPower && (
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
              )}
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

      {/* V2 Phase 5: best efforts, time in zones, heart-rate drift, efficiency factor. */}
      {Object.keys(bests).length > 0 && (
        <Card className="mb-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Best efforts</h3>
          <div className="grid grid-cols-5 gap-2 text-center">
            {BEST_EFFORT_ROWS.filter(([d]) => bests[d] != null).map(([d, label]) => (
              <div key={d}>
                <div className="text-xs text-gray-400">{label}</div>
                <div className="text-base font-bold tabular-nums">{bests[d]}W</div>
                {newBests.includes(d) && <div className="text-[10px] text-yellow-400 mt-0.5">★ New best</div>}
              </div>
            ))}
          </div>
          {bestsSource === '10s' && (
            <p className="text-xs text-gray-500 mt-2">Re-attach the ride file for sprint-length bests.</p>
          )}
        </Card>
      )}

      {zoneTotals && totalZoneSeconds > 0 && (
        <Card className="mb-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Time in zones</h3>
          <div className="flex w-full h-3 rounded-full overflow-hidden">
            {ZONES.map(z => {
              const secs = zoneTotals[z.id] || 0;
              if (secs === 0) return null;
              return <div key={z.id} style={{ width: `${(secs / totalZoneSeconds) * 100}%`, backgroundColor: z.color }} />;
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs">
            {ZONES.map(z => {
              const secs = zoneTotals[z.id] || 0;
              if (secs === 0) return null;
              return (
                <div key={z.id} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: z.color }} />
                  <span className="text-gray-400">{z.name}</span>
                  <span className="tabular-nums">{formatMinutes(secs / 60)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {decoupling != null && (
        <Card className="mb-4">
          <h3 className="text-sm font-medium text-gray-300 mb-1">Heart-rate drift</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums">{decoupling}%</span>
            {decBand && <span className="text-sm" style={{ color: decBand.color }}>{decBand.label}</span>}
          </div>
        </Card>
      )}

      {ef != null && (
        <Card className="mb-4">
          <h3 className="text-sm font-medium text-gray-300 mb-1">Efficiency</h3>
          <div className="text-xl font-bold tabular-nums">{ef}</div>
          <p className="text-xs text-gray-500 mt-0.5">Higher over time = fitter</p>
        </Card>
      )}

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
