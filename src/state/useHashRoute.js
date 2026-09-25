import { useEffect, useLayoutEffect, useState } from 'react';

// Tab + page routing via location.hash (V2 Phase 3). No router library.
//
//   #/today (default) · #/rides · #/progress · #/settings        tabs
//   #/rides?filter=needs-zone                                      tab with a query
//   #/settings/profile · #/settings/event · #/settings/data       tab, scrolled to a section
//   #/ride/<id>                                                    Ride page (full screen)
//   #/progress/workouts · #/progress/zone/<zoneId>                 Workout Progression page
//
// Tabs switch with location.replace (no history entry, so Back never walks through tabs);
// pages are pushed, so the page's "‹ Back" button and history.back() return to the tab.
// Each tab's scroll position is remembered while the app is open.

export const TABS = ['today', 'rides', 'progress', 'settings'];

export const parseHash = (hash) => {
  const raw = (hash || '').replace(/^#\/?/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const query = Object.fromEntries(new URLSearchParams(queryPart));
  const [first, second, third] = parts;

  if (first === 'ride' && second) {
    return { tab: 'rides', page: 'ride', id: second, query, key: `ride/${second}` };
  }
  if (first === 'progress' && second === 'zone' && third) {
    return { tab: 'progress', page: 'progression', zone: third, query, key: 'progress/workouts' };
  }
  if (first === 'progress' && second === 'workouts') {
    return { tab: 'progress', page: 'progression', zone: null, query, key: 'progress/workouts' };
  }
  const tab = TABS.includes(first) ? first : 'today';
  return { tab, page: null, section: second || null, query, key: tab };
};

// ---- history index, so "Back" knows whether there is an in-app page to go back to ----
let currentIdx = 0;
let pendingReplace = false;
const scrollPositions = new Map();
let currentKey = null;

const ensureIdx = () => {
  const state = window.history.state;
  if (state && typeof state.idx === 'number') {
    currentIdx = state.idx;
  } else {
    // A new entry (hash link or location.hash = …) or a replaced one.
    currentIdx = pendingReplace ? currentIdx : currentIdx + 1;
    window.history.replaceState({ ...(state || {}), idx: currentIdx }, '');
  }
  pendingReplace = false;
};

if (typeof window !== 'undefined') {
  const state = window.history.state;
  if (!state || typeof state.idx !== 'number') {
    window.history.replaceState({ ...(state || {}), idx: 0 }, '');
    currentIdx = 0;
  } else {
    currentIdx = state.idx;
  }
  currentKey = parseHash(window.location.hash).key;
}

export const navigate = (to, { replace = false } = {}) => {
  const hash = to.startsWith('#') ? to : `#${to.startsWith('/') ? '' : '/'}${to}`;
  if (hash === window.location.hash) return;
  if (replace) {
    pendingReplace = true;
    window.location.replace(hash);
  } else {
    window.location.hash = hash;
  }
};

export const canGoBack = () => currentIdx > 0;

// "‹ Back" on a page: history.back() when there's an in-app entry to return to, otherwise
// (the page was opened directly) go to its parent tab.
export const goBack = (fallback = '#/today') => {
  if (canGoBack()) window.history.back();
  else navigate(fallback, { replace: true });
};

export function useHashRoute() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => {
      if (currentKey) scrollPositions.set(currentKey, window.scrollY);
      ensureIdx();
      const next = parseHash(window.location.hash);
      currentKey = next.key;
      setRoute(next);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  // Restore the tab's scroll position (pages always open at the top).
  useLayoutEffect(() => {
    const y = route.page ? 0 : (scrollPositions.get(route.key) || 0);
    window.scrollTo(0, y);
  }, [route.key]);

  return route;
}
