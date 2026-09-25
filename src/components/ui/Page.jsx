import React from 'react';
import { goBack } from '../../state/useHashRoute.js';

// Page — a full-screen pushed page (e.g. #/ride/<id>) with a sticky header:
// "‹ Back" (history.back(), or `backTo` when opened directly), title, optional right action.
// The tab bar is hidden while a page is showing.
export default function Page({ title, right, backTo = '#/today', children }) {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header
        className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur border-b border-gray-800"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-2xl mx-auto px-2 h-14 grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <button
            type="button"
            onClick={() => goBack(backTo)}
            className="min-h-[44px] min-w-[44px] px-2 text-base text-blue-400 hover:text-blue-300"
          >
            ‹ Back
          </button>
          <h1 className="text-base font-semibold text-center truncate">{title}</h1>
          <div className="min-w-[44px] flex justify-end">{right}</div>
        </div>
      </header>
      <main
        className="max-w-2xl mx-auto px-4 pt-4"
        style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>
    </div>
  );
}
