import React from 'react';

// TabBar — fixed bottom bar with the four tabs. Height 56px + the home-indicator safe area.
// `badges` is { tabId: number } (Settings uses it for unsynced changes from Phase 4).
const Icon = ({ id }) => {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  switch (id) {
    case 'today':
      return (<svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
    case 'rides':
      return (<svg {...common}><circle cx="5" cy="16.5" r="3.5" /><circle cx="19" cy="16.5" r="3.5" /><path d="M5 16.5L9 9h6.5M9 9l3 7.5L15.5 9 19 16.5M7.5 7.5h3" /></svg>);
    case 'progress':
      return (<svg {...common}><path d="M5 20v-5M11 20v-8M17 20V9" strokeWidth="3" /><path d="M3 9l5-4 4 3 8-6M16 2h4v4" strokeWidth="1.6" /></svg>);
    case 'settings':
      return (<svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>);
    default:
      return null;
  }
};

export const TAB_ITEMS = [
  { id: 'today', label: 'Today' },
  { id: 'rides', label: 'Rides' },
  { id: 'progress', label: 'Progress' },
  { id: 'settings', label: 'Settings' },
];

export default function TabBar({ active, onSelect, badges = {} }) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-gray-900/95 backdrop-blur border-t border-gray-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Main"
    >
      <div className="max-w-2xl mx-auto grid grid-cols-4 h-14">
        {TAB_ITEMS.map(tab => {
          const isActive = tab.id === active;
          const badge = badges[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon id={tab.id} />
              <span className="text-[11px] font-medium leading-none">{tab.label}</span>
              {badge > 0 && (
                <span className="absolute top-1.5 left-1/2 ml-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold leading-[18px] text-center tabular-nums">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
