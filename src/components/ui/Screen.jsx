import React from 'react';

// Screen — the wrapper for each tab's content. Makes room for the status bar at the top
// (safe area) and for the tab bar (56px) + home indicator at the bottom, plus the floating
// "＋ Log Ride" button when `withFab` is set. Centred column, max-w-2xl, 16px side gutters.
export const TAB_BAR_HEIGHT = 56;

export default function Screen({ title, subtitle, right, withFab = false, children, header }) {
  return (
    <main
      className="max-w-2xl mx-auto px-4 text-white"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
        paddingBottom: `calc(${TAB_BAR_HEIGHT + 24 + (withFab ? 64 : 0)}px + env(safe-area-inset-bottom))`,
      }}
    >
      {header || (title && (
        <div className="flex items-end justify-between gap-3 mb-4 min-h-[44px]">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      ))}
      <div className="space-y-4">{children}</div>
    </main>
  );
}
