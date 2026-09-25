import React from 'react';

// Chip — a selectable filter / zone pill. `color` tints it when selected.
export default function Chip({ selected = false, color, onClick, children, className = '', ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex items-center gap-1 min-h-[44px] px-4 rounded-full text-sm font-medium transition-colors border ${
        selected
          ? `text-white ${color ? 'border-transparent' : 'bg-gray-600 border-gray-500'}`
          : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
      } ${className}`}
      style={selected && color ? { backgroundColor: color } : undefined}
      {...rest}
    >
      {children}
    </button>
  );
}
