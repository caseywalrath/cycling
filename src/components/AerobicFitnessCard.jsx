import React, { useMemo } from 'react';
import { ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { parseDateLocal, toLocalDateStr } from '../lib/dates.js';
import { mondayOf } from '../lib/summary.js';
import { efficiencyFactor, aerobicDecoupling, decouplingBand } from '../lib/analysis.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { Card } from './ui/index.js';

const INDOOR_COLOR = '#3B82F6';
const OUTDOOR_COLOR = '#14B8A6';
const epochDays = (dateStr) => Math.floor(parseDateLocal(dateStr).getTime() / 86400000);
const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Aerobic fitness (V2 Phase 6 §6.1.6): efficiency factor per qualifying ride over the last 6
// months as dots (indoor blue, outdoor teal), plus a 6-week rolling median line. Below it, the
// average heart-rate drift of qualifying rides in the last 30 days, with its band sentence.
export default function AerobicFitnessCard() {
  const { history } = useAppData();

  const { scatterData, lineData, avgDrift, band } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const points = [];
    const weekMap = {};
    const driftVals = [];

    history.forEach((w) => {
      const d = parseDateLocal(w.date);
      const ef = efficiencyFactor(w);
      if (ef != null && d >= sixMonthsAgo && d <= today) {
        points.push({ x: epochDays(w.date), y: ef, rideType: w.rideType, date: w.date, name: w.name || 'Workout' });
        const wk = toLocalDateStr(mondayOf(d));
        (weekMap[wk] ||= []).push(ef);
      }
      if (d >= thirtyDaysAgo && d <= today) {
        const drift = aerobicDecoupling(w);
        if (drift != null) driftVals.push(drift);
      }
    });

    const weeks = Object.keys(weekMap).sort();
    const line = weeks.map((wk, i) => {
      const windowWeeks = weeks.slice(Math.max(0, i - 5), i + 1);
      const vals = windowWeeks.flatMap(w => weekMap[w]);
      return { x: epochDays(wk), y: Math.round(median(vals) * 100) / 100 };
    });

    const avg = driftVals.length ? Math.round((driftVals.reduce((a, b) => a + b, 0) / driftVals.length) * 10) / 10 : null;

    return { scatterData: points, lineData: line, avgDrift: avg, band: decouplingBand(avg) };
  }, [history]);

  if (scatterData.length === 0) return null;

  const dateFromEpoch = (x) => new Date(x * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const EfTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload.find(p => p.dataKey === 'y' && p.payload.rideType)?.payload || payload[0].payload;
    if (p.rideType) {
      return (
        <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm">
          <p className="text-gray-300 mb-1">{p.name}, {dateFromEpoch(p.x)}</p>
          <p className="font-bold tabular-nums" style={{ color: p.rideType === 'Outdoor' ? OUTDOOR_COLOR : INDOOR_COLOR }}>EF {p.y.toFixed(2)}</p>
        </div>
      );
    }
    return (
      <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm">
        <p className="text-gray-300 mb-1">Week of {dateFromEpoch(p.x)}</p>
        <p className="text-gray-200 tabular-nums">6-week median EF: {p.y.toFixed(2)}</p>
      </div>
    );
  };

  return (
    <Card>
      <h3 className="font-medium mb-1">Aerobic Fitness</h3>
      <div className="flex items-center gap-4 text-xs text-gray-400 mb-2">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: INDOOR_COLOR }} />Indoor</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: OUTDOOR_COLOR }} />Outdoor</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 inline-block" style={{ background: '#9CA3AF' }} />6-week median</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tickFormatter={dateFromEpoch} stroke="#9CA3AF" style={{ fontSize: '12px' }} />
          <YAxis dataKey="y" type="number" domain={['dataMin - 0.1', 'dataMax + 0.1']} stroke="#9CA3AF" style={{ fontSize: '12px' }} width={40} />
          <Tooltip content={<EfTooltip />} />
          <Scatter
            data={scatterData}
            fill={INDOOR_COLOR}
            shape={(props) => {
              const color = props.payload.rideType === 'Outdoor' ? OUTDOOR_COLOR : INDOOR_COLOR;
              return <circle cx={props.cx} cy={props.cy} r={4} fill={color} />;
            }}
          />
          <Line data={lineData} dataKey="y" stroke="#9CA3AF" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-3 pt-3 border-t border-gray-700">
        {avgDrift != null ? (
          <p className="text-sm">
            <span className="text-gray-400">Heart-rate drift (last 30 days): </span>
            <span className="font-semibold tabular-nums" style={{ color: band.color }}>{avgDrift}% — {band.label}</span>
          </p>
        ) : (
          <p className="text-sm text-gray-500">Not enough long, steady rides in the last 30 days to measure heart-rate drift.</p>
        )}
      </div>
    </Card>
  );
}
