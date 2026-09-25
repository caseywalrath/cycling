import React from 'react';

// Button — every tappable action in the app. Min height 44px (touch target rule).
//   variant: 'primary' (green) | 'secondary' | 'ghost' | 'destructive'
//            ('ghost-destructive': a quiet red text button, e.g. Delete in a list row)
//   size:    'md' (default, 16px text) | 'sm' (14px text, still 44px tall)
//   block:   full width
const VARIANTS = {
  primary: 'bg-green-600 text-white hover:bg-green-500 active:bg-green-700',
  secondary: 'bg-gray-700 text-gray-100 hover:bg-gray-600 active:bg-gray-600',
  ghost: 'bg-transparent text-gray-300 hover:bg-gray-700/60 active:bg-gray-700',
  destructive: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700',
  'ghost-destructive': 'bg-transparent text-red-400 hover:bg-red-900/30 active:bg-red-900/40',
};

// `rounded` overrides the corner radius (default `rounded-xl`). It's a separate prop, not
// part of `className`, because a Tailwind class passed in `className` doesn't reliably win
// over one already baked into the base string (both utilities have equal specificity — the
// one whose rule comes later in the stylesheet wins, not the one later in the class list).
// This is what made the floating ＋ Log Ride button render as a rounded rectangle instead of
// a pill in Phase 3, even though its className included `rounded-full`.
export default function Button({ variant = 'secondary', size = 'md', block = false, rounded = 'rounded-xl', className = '', type = 'button', children, ...rest }) {
  const sizing = size === 'sm' ? 'px-3 text-sm' : 'px-4 text-base';
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 min-h-[44px] ${rounded} font-medium transition-colors select-none disabled:opacity-50 disabled:cursor-not-allowed ${sizing} ${VARIANTS[variant] || VARIANTS.secondary} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
