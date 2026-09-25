import React from 'react';

// SegmentedControl — one choice from a few options (chart tabs, metric toggles).
//   options: [{ value, label, color? }]   color tints the selected segment
export default function SegmentedControl({ options, value, onChange, className = '', ariaLabel }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={`flex bg-gray-900 rounded-xl p-1 gap-1 ${className}`}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`flex-1 min-h-[44px] px-2 rounded-lg text-sm font-medium transition-colors ${
              active ? 'text-white' : 'text-gray-400 hover:text-gray-200'
            } ${active && !opt.color ? 'bg-gray-600' : ''}`}
            style={active && opt.color ? { backgroundColor: opt.color } : undefined}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
