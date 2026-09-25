import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { parseDateLocal } from '../lib/dates.js';
import { calculateEFTPHistory } from '../lib/chartData.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { Card } from './ui/index.js';

// eFTP Progress chart (V2 Phase 6 §6.1.5): unchanged from the old code, but now its own
// standalone card instead of a tab inside the training-volume SegmentedControl (that control
// is now Hours/TSS/Elevation/Zones — see TrainingCharts.jsx).
export default function EftpChart() {
  const { history, eftpTimeline, currentEftp } = useAppData();
  const eftpHistoryData = calculateEFTPHistory(history, eftpTimeline);
  const latestEFTP = currentEftp ? currentEftp.value : null;

  const EFTPTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm">
          <p className="text-gray-300 mb-1">{data.label}</p>
          <p className="text-purple-400 font-bold">{data.eFTP}W</p>
          <p className="text-gray-500 text-xs">
            {data.source === 'estimated'
              ? `Best 20-min effort: ${data.rideName} (${parseDateLocal(data.peakDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
              : 'Imported from intervals.icu'}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card data-chart="eftp">
      <div className="flex flex-wrap justify-between items-baseline gap-x-3 mb-3">
        <h3 className="font-medium">eFTP Progress (1 Year)</h3>
        <span className="text-sm text-gray-400 tabular-nums">
          Latest: <span className="text-purple-400 font-bold">{latestEFTP != null ? `${latestEFTP}W` : '—'}</span>
        </span>
      </div>
      {eftpHistoryData.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={eftpHistoryData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorEFTP" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#A855F7" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#A855F7" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
            <YAxis
              stroke="#9CA3AF"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => `${value}W`}
              domain={['dataMin - 10', 'dataMax + 10']}
              width={55}
            />
            <Tooltip content={<EFTPTooltip />} />
            <Area
              type="monotone"
              dataKey="eFTP"
              stroke="#A855F7"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorEFTP)"
              dot={(props) => {
                const isImported = props.payload?.source === 'imported';
                return (
                  <circle
                    key={props.index}
                    cx={props.cx}
                    cy={props.cy}
                    r={4}
                    fill={isImported ? '#1F2937' : '#A855F7'}
                    stroke="#A855F7"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 6, fill: '#A855F7', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-center text-gray-400 py-8">
          <p>No eFTP data available.</p>
          <p className="text-sm mt-2">Import a FIT or TCX file that includes a 20-minute or longer effort.</p>
        </div>
      )}
    </Card>
  );
}
