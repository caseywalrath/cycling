import React, { useMemo, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { calculateWeeklyHours, calculateWeeklyTSS, calculateMonthlyElevation, weeklyTimeInZones } from '../lib/chartData.js';
import { ZONES } from '../lib/zones.js';
import { formatMinutes } from '../lib/format.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { Card, SegmentedControl } from './ui/index.js';

// Training volume: Hours / TSS / Elevation / Zones. V2 Phase 3 re-homed Hours/TSS/Elevation
// unchanged from the old main page; V2 Phase 6 §6.1.3 adds "Zones" here and moves eFTP out to
// its own standalone card (EftpChart.jsx) since it's no longer part of this control (§6.1).
const CHART_TABS = [
  { value: 'hours', label: 'Hours', color: '#F97316' },
  { value: 'tss', label: 'TSS', color: '#3B82F6' },
  { value: 'elevation', label: 'Elevation', color: '#22C55E' },
  { value: 'zones', label: 'Zones', color: '#8B5CF6' },
];

const ZONE_ORDER = ZONES.filter(z => z.id !== 'recovery');

export default function TrainingCharts() {
  const { history, currentFTP } = useAppData();
  const [weeklyChartView, setWeeklyChartView] = useState('hours'); // 'hours' | 'tss' | 'elevation' | 'zones'

  const weeklyTSSData = calculateWeeklyTSS(history);
  const weeklyHoursData = calculateWeeklyHours(history);
  const monthlyElevationData = calculateMonthlyElevation(history);
  // Memoised: timeInZones() walks every ride's power stream, so this is worth keying on
  // history/currentFTP rather than recomputing on every render (V2_PLAN.md §6.4).
  const zonesData = useMemo(() => weeklyTimeInZones(history, currentFTP, 12), [history, currentFTP]);
  const hasZoneMinutes = zonesData.some(w => ZONE_ORDER.some(z => w[z.id] > 0));

  const currentWeekTSS = weeklyTSSData.length > 0 ? weeklyTSSData[weeklyTSSData.length - 1].tss : 0;
  const currentWeekHours = weeklyHoursData.length > 0 ? weeklyHoursData[weeklyHoursData.length - 1].hours : 0;
  const currentMonthElevation = monthlyElevationData.length > 0
    ? monthlyElevationData[monthlyElevationData.length - 1].elevation
    : 0;

  // Check if any data exists
  const hasData = weeklyTSSData.length > 0 || weeklyHoursData.length > 0 || monthlyElevationData.length > 0;

  if (!hasData) return null;

  // Tooltips
  const TSSTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm">
          <p className="text-gray-300 mb-1">{data.label}</p>
          <p className="text-blue-400 font-bold">{data.tss} TSS</p>
          <p className="text-gray-500 text-xs">{data.workouts} rides</p>
        </div>
      );
    }
    return null;
  };

  const HoursTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const hours = Math.floor(data.totalMinutes / 60);
      const minutes = data.totalMinutes % 60;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm">
          <p className="text-gray-300 mb-1">{data.label}</p>
          <p className="text-orange-400 font-bold">{hours}h {minutes}m</p>
          <p className="text-gray-500 text-xs">{data.workouts} rides</p>
        </div>
      );
    }
    return null;
  };

  const ElevationTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm">
          <p className="text-gray-300 mb-1">{data.label}</p>
          <p className="text-green-400 font-bold">{data.elevation.toLocaleString()} ft</p>
          <p className="text-gray-500 text-xs">{data.workouts} rides</p>
        </div>
      );
    }
    return null;
  };

  const ZonesTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const total = ZONE_ORDER.reduce((s, z) => s + (data[z.id] || 0), 0);
      return (
        <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm">
          <p className="text-gray-300 mb-1">{data.label}</p>
          {ZONE_ORDER.filter(z => data[z.id] > 0).map(z => (
            <p key={z.id} className="text-xs tabular-nums" style={{ color: z.color }}>
              {z.name}: {formatMinutes(data[z.id])}
            </p>
          ))}
          <p className="text-gray-500 text-xs mt-1">{total > 0 ? `${formatMinutes(total)} total` : 'No power data this week'}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <SegmentedControl
        ariaLabel="Chart"
        className="mb-4"
        options={CHART_TABS}
        value={weeklyChartView}
        onChange={setWeeklyChartView}
      />

      {/* Training Hours Chart */}
      {weeklyChartView === 'hours' && weeklyHoursData.length > 0 && (
        <>
          <div className="flex flex-wrap justify-between items-baseline gap-x-3 mb-3">
            <h3 className="font-medium">Weekly Training Hours</h3>
            <span className="text-sm text-gray-400 tabular-nums">
              This week: <span className="text-orange-400 font-bold">{currentWeekHours}h</span>
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weeklyHoursData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FB923C" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#FB923C" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="label"
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `${value}h`}
                width={45}
              />
              <Tooltip content={<HoursTooltip />} />
              <Area
                type="monotone"
                dataKey="hours"
                stroke="#FB923C"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorHours)"
                dot={{ fill: '#FB923C', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#FB923C', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </>
      )}

      {/* TSS Chart */}
      {weeklyChartView === 'tss' && weeklyTSSData.length > 0 && (
        <>
          <div className="flex flex-wrap justify-between items-baseline gap-x-3 mb-3">
            <h3 className="font-medium">Weekly TSS</h3>
            <span className="text-sm text-gray-400 tabular-nums">
              This week: <span className="text-blue-400 font-bold">{currentWeekTSS}</span>
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weeklyTSSData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTSS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="label"
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
                width={45}
              />
              <Tooltip content={<TSSTooltip />} />
              <Area
                type="monotone"
                dataKey="tss"
                stroke="#3B82F6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorTSS)"
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </>
      )}

      {/* Elevation Chart */}
      {weeklyChartView === 'elevation' && monthlyElevationData.length > 0 && (
        <>
          <div className="flex flex-wrap justify-between items-baseline gap-x-3 mb-3">
            <h3 className="font-medium">Monthly Elevation Gained (1 Year)</h3>
            <span className="text-sm text-gray-400 tabular-nums">
              This month: <span className="text-green-400 font-bold">{currentMonthElevation.toLocaleString()} ft</span>
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyElevationData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorElevation" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="month"
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) =>
                  value >= 1000
                    ? `${(value / 1000) % 1 === 0 ? value / 1000 : (value / 1000).toFixed(1)}k`
                    : `${value}`
                }
                width={55}
              />
              <Tooltip content={<ElevationTooltip />} />
              <Area
                type="monotone"
                dataKey="elevation"
                stroke="#22C55E"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorElevation)"
                dot={{ fill: '#22C55E', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#22C55E', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </>
      )}

      {/* Zones Chart (V2 Phase 6) */}
      {weeklyChartView === 'zones' && (
        hasZoneMinutes ? (
          <>
            <h3 className="font-medium mb-3">Time in Zones (12 Weeks)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={zonesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="label" stroke="#9CA3AF" style={{ fontSize: '12px' }} interval="preserveStartEnd" />
                <YAxis
                  stroke="#9CA3AF"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(v) => `${Math.round(v)}m`}
                  width={45}
                />
                <Tooltip content={<ZonesTooltip />} />
                {ZONE_ORDER.map(z => (
                  <Bar key={z.id} dataKey={z.id} stackId="zones" fill={z.color} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 mt-2">Rides with power data only.</p>
          </>
        ) : (
          <div className="text-center text-gray-400 py-8">
            <p>No time-in-zone data available.</p>
            <p className="text-sm mt-2">Import a FIT or TCX file with power data to see this chart.</p>
          </div>
        )
      )}
    </Card>
  );
}
