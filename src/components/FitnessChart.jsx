import React, { useMemo, useState } from 'react';
import { ComposedChart, Line, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { parseDateLocal } from '../lib/dates.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { Card, SegmentedControl } from './ui/index.js';

const WINDOWS = [
  { value: 90, label: '90d' },
  { value: 180, label: '180d' },
  { value: 365, label: '1y' },
];

const FitnessTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm">
      <p className="text-gray-300 mb-1">{d.label}</p>
      <p className="text-blue-400 tabular-nums">Fitness (CTL): {d.ctl}</p>
      <p className="text-orange-400 tabular-nums">Fatigue (ATL): {d.atl}</p>
      <p className={`tabular-nums ${d.tsb >= 0 ? 'text-green-400' : 'text-red-400'}`}>Form (TSB): {d.tsb > 0 ? '+' : ''}{d.tsb}</p>
    </div>
  );
};

// Fitness chart (V2 Phase 6 §6.1.2): CTL/ATL as lines, TSB as bars around zero, one shared
// y-axis (all three are the same TSS-point units — no dual axis). Uses the memoised
// `fitnessSeries`/`rampRate` from AppDataContext (dailyLoadSeries/rampRate, V2 Phase 5).
export default function FitnessChart() {
  const { fitnessSeries, rampRate } = useAppData();
  const [days, setDays] = useState(180);

  const data = useMemo(() => {
    return fitnessSeries.slice(-days).map((d) => ({
      date: d.date,
      label: parseDateLocal(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      ctl: Math.round(d.ctl * 10) / 10,
      atl: Math.round(d.atl * 10) / 10,
      tsb: Math.round(d.tsb * 10) / 10,
    }));
  }, [fitnessSeries, days]);

  if (data.length === 0) return null;

  return (
    <Card data-chart="fitness">
      <div className="flex flex-wrap justify-between items-baseline gap-x-3 mb-3">
        <h3 className="font-medium">Fitness</h3>
        {rampRate != null && (
          <span className="text-sm text-gray-400 tabular-nums">
            {rampRate >= 0 ? '+' : ''}{rampRate} fitness / week
          </span>
        )}
      </div>
      <SegmentedControl ariaLabel="Fitness chart range" className="mb-3" options={WINDOWS} value={days} onChange={setDays} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 mb-2">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#3B82F6' }} />Fitness (CTL)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#FB923C' }} />Fatigue (ATL)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#22C55E' }} />Form (TSB)</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="label" stroke="#9CA3AF" style={{ fontSize: '12px' }} interval="preserveStartEnd" minTickGap={40} />
          <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} width={40} />
          <ReferenceLine y={0} stroke="#4B5563" />
          <Tooltip content={<FitnessTooltip />} />
          <Bar dataKey="tsb" barSize={days > 180 ? 2 : 4} radius={[1, 1, 1, 1]}>
            {data.map((d, i) => <Cell key={i} fill={d.tsb >= 0 ? '#22C55E' : '#EF4444'} />)}
          </Bar>
          <Line type="monotone" dataKey="ctl" stroke="#3B82F6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="atl" stroke="#FB923C" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
