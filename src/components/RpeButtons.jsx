import React from 'react';

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// The 1-10 effort picker shared by the Log Ride sheet and the Ride page (Session 29).
// `value` is null when the ride isn't rated; tapping the chosen number again clears it.
// `expected` rings the number that's typical for this ride (see expectedRpe in lib/analysis.js).
export default function RpeButtons({ value, expected = null, onChange }) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-2" role="group" aria-label="Rate of perceived exertion">
        {RPE_VALUES.map((v) => {
          const selected = value === v;
          const typical = expected === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={selected}
              data-rpe={v}
              onClick={() => onChange(selected ? null : v)}
              className={`min-h-[44px] rounded-lg text-base font-semibold tabular-nums border-2 transition-colors ${
                selected ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-700 border-transparent text-gray-200 hover:bg-gray-600'
              } ${typical && !selected ? 'ring-2 ring-blue-400' : ''}`}
            >
              {v}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-1">
        3 moderate · 5 hard · 7 very hard · 10 maximal. Rate the whole ride, not the hardest moment.
        {expected != null ? ' The ringed number is typical for a ride like this.' : ''} Tap your number again to clear it.
      </p>
    </div>
  );
}
