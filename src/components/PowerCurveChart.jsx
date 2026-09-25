import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BEST_DURATIONS } from '../lib/rideFiles.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { Card } from './ui/index.js';

const TICKS = [5, 30, 60, 300, 1200, 3600, 7200];
const TICK_LABEL = { 5: '5s', 30: '30s', 60: '1m', 300: '5m', 1200: '20m', 3600: '1h', 7200: '2h' };
const durationLabel = (sec) => TICK_LABEL[sec] || (sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.round(sec / 60)}m` : `${Math.round(sec / 3600)}h`);

// Power curve (V2 Phase 6 §6.1.4): log-scale x-axis (duration), two lines — last 90 days
// (solid) and all-time (faint) — from personalBests() (Phase 5 records.js), memoised in
// AppDataContext as `bestCurves`. Tapping/hovering a point shows watts, W/kg and which ride
// set it.
export default function PowerCurveChart() {
  const { bestCurves, userProfile } = useAppData();
  const weightKg = userProfile.weight > 0 ? userProfile.weight / 2.20462 : null;

  const data = useMemo(() => BEST_DURATIONS.map(sec => {
    const at = bestCurves.allTime[String(sec)];
    const l90 = bestCurves.last90Days[String(sec)];
    return {
      sec,
      label: durationLabel(sec),
      allTime: at ? at.watts : null,
      last90: l90 ? l90.watts : null,
      allTimeInfo: at || null,
      last90Info: l90 || null,
    };
  }), [bestCurves]);

  const hasAny = data.some(d => d.allTime != null);
  if (!hasAny) return null;

  const CurveTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    const info = d.last90Info || d.allTimeInfo;
    const watts = d.last90 ?? d.allTime;
    const isRecent = d.last90Info != null;
    return (
      <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm">
        <p className="text-gray-300 mb-1">{d.label} power</p>
        <p className="font-bold text-purple-400 tabular-nums">
          {watts}W{weightKg ? ` · ${(watts / weightKg).toFixed(1)} W/kg` : ''}
        </p>
        {info && (
          <p className="text-gray-500 text-xs">
            {isRecent ? 'Last 90 days: ' : 'All-time: '}{info.rideName}, {info.date}
          </p>
        )}
      </div>
    );
  };

  return (
    <Card data-chart="power-curve">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="font-medium">Power Curve</h3>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-400 mb-2">
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 inline-block" style={{ background: '#A855F7' }} />Last 90 days</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 inline-block opacity-40" style={{ background: '#A855F7' }} />All-time</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 10, right: 14, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="sec"
            type="number"
            scale="log"
            domain={[5, 7200]}
            ticks={TICKS}
            tickFormatter={(v) => TICK_LABEL[v] || v}
            stroke="#9CA3AF"
            style={{ fontSize: '12px' }}
          />
          <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} tickFormatter={(v) => `${v}W`} width={55} />
          <Tooltip content={<CurveTooltip />} />
          <Line type="monotone" dataKey="allTime" stroke="#A855F7" strokeOpacity={0.4} strokeWidth={2} dot={{ r: 3, fill: '#A855F7', fillOpacity: 0.4 }} connectNulls />
          <Line type="monotone" dataKey="last90" stroke="#A855F7" strokeWidth={2} dot={{ r: 4, fill: '#A855F7' }} activeDot={{ r: 6 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
