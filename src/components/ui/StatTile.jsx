import React from 'react';

// StatTile — label, value, optional unit and optional delta.
//   delta:      number; shown as ▲ (green) / ▼ (red), or grey with tone="neutral"
//   deltaLabel: e.g. "14d"
//   sublabel:   small grey text under the label (e.g. the jargon name "CTL")
export default function StatTile({ label, sublabel, value, unit, delta, deltaLabel, tone = 'normal', valueColor, className = '', ...rest }) {
  let deltaEl = null;
  if (delta != null && Number.isFinite(delta)) {
    const up = delta > 0;
    const flat = delta === 0;
    const color = flat || tone === 'neutral' ? 'text-gray-400' : up ? 'text-green-400' : 'text-red-400';
    deltaEl = (
      <div className={`text-xs tabular-nums mt-1 ${color}`} data-delta>
        {flat ? '–' : up ? '▲' : '▼'} {Math.abs(delta)}{deltaLabel ? <span className="text-gray-500"> {deltaLabel}</span> : null}
      </div>
    );
  }
  return (
    <div className={`bg-gray-900/50 rounded-xl p-3 min-w-0 ${className}`} {...rest}>
      <div className="text-xs text-gray-400 truncate">
        {label}{sublabel && <span className="text-gray-500"> · {sublabel}</span>}
      </div>
      <div className="text-2xl font-bold tabular-nums leading-tight mt-0.5" style={valueColor ? { color: valueColor } : undefined} data-value>
        {value}{unit && <span className="text-sm font-medium text-gray-400 ml-0.5">{unit}</span>}
      </div>
      {deltaEl}
    </div>
  );
}
