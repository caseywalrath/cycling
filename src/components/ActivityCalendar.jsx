import React, { useMemo, useState } from 'react';
import { ZONES } from '../lib/zones.js';
import { toLocalDateStr, formatDateWithDay } from '../lib/dates.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { useShell } from '../state/ShellContext.js';

// Monthly activity calendar (Monday start). Re-homed from the old main page to the top of the
// Rides tab in V2 Phase 3, without redesign (Phase 4 redesigns it). Day cells and arrows are
// now 44px tap targets.

// Calendar: generate day objects for a month grid (Monday-start)
const getCalendarDays = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Convert to Monday-start: JS getDay() 0=Sun → we want 0=Mon
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days = [];

  // Previous month trailing days
  const prevLastDay = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevLastDay - i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    days.push({ day: d, dateStr: `${py}-${String(pm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: true });
  }

  // Next month leading days
  const totalCells = days.length <= 35 ? 35 : 42;
  let nextDay = 1;
  const nm = month === 11 ? 0 : month + 1;
  const ny = month === 11 ? year + 1 : year;
  while (days.length < totalCells) {
    days.push({ day: nextDay, dateStr: `${ny}-${String(nm + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`, isCurrentMonth: false });
    nextDay++;
  }

  return days;
};

export default function ActivityCalendar() {
  const { history } = useAppData();
  const { openEditRide } = useShell();
  const handleEditRide = openEditRide;

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarPopup, setCalendarPopup] = useState(null); // { dateStr } or null

  // Calendar: set of dates with rides for O(1) lookup
  const rideDatesSet = useMemo(() => {
    const set = new Set();
    history.forEach(ride => { if (ride.date) set.add(ride.date); });
    return set;
  }, [history]);

  // Calendar: rides grouped by date for popup display
  const ridesByDate = useMemo(() => {
    const map = {};
    history.forEach(ride => {
      if (ride.date) {
        if (!map[ride.date]) map[ride.date] = [];
        map[ride.date].push(ride);
      }
    });
    return map;
  }, [history]);

  return (
    <div className="bg-gray-800 rounded-2xl p-4">
      {/* Header: nav arrows + month/year */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => {
            setCalendarPopup(null);
            if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(calendarYear - 1); }
            else { setCalendarMonth(calendarMonth - 1); }
          }}
          className="text-gray-400 hover:text-white min-h-[44px] min-w-[44px] transition"
          aria-label="Previous month"
        >
          &#9664;
        </button>
        <h3 className="font-medium">
          {new Date(calendarYear, calendarMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h3>
        <button
          onClick={() => {
            setCalendarPopup(null);
            if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(calendarYear + 1); }
            else { setCalendarMonth(calendarMonth + 1); }
          }}
          className="text-gray-400 hover:text-white min-h-[44px] min-w-[44px] transition"
          aria-label="Next month"
        >
          &#9654;
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 text-center text-xs text-gray-500 mb-2">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="py-1">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {getCalendarDays(calendarYear, calendarMonth).map((dayObj, i) => {
          const hasRide = rideDatesSet.has(dayObj.dateStr);
          const todayStr = toLocalDateStr(new Date());
          const isToday = dayObj.dateStr === todayStr;

          return (
            <div
              key={i}
              className={`flex items-center justify-center h-11 ${hasRide ? 'cursor-pointer' : ''}`}
              onClick={hasRide ? () => setCalendarPopup(calendarPopup?.dateStr === dayObj.dateStr ? null : { dateStr: dayObj.dateStr }) : undefined}
              role={hasRide ? 'button' : undefined}
              aria-label={hasRide ? `Rides on ${dayObj.dateStr}` : undefined}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors ${hasRide ? 'cursor-pointer' : ''} ${
                  hasRide && dayObj.isCurrentMonth
                    ? 'bg-blue-500 text-white font-bold hover:bg-blue-400'
                    : hasRide && !dayObj.isCurrentMonth
                    ? 'bg-blue-500/40 text-gray-400 hover:bg-blue-500/60'
                    : !hasRide && dayObj.isCurrentMonth
                    ? 'border border-gray-600 text-gray-400'
                    : 'text-gray-700'
                } ${
                  isToday && !hasRide
                    ? 'border-2 border-blue-400 text-blue-400'
                    : isToday && hasRide
                    ? 'ring-2 ring-blue-300'
                    : ''
                } ${
                  calendarPopup?.dateStr === dayObj.dateStr ? 'ring-2 ring-white' : ''
                }`}
              >
                {hasRide ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                    <circle cx="6" cy="17" r="3" />
                    <circle cx="18" cy="17" r="3" />
                    <path d="M6 17L9 7h4l3 10M9 7l3 10 2-6" />
                  </svg>
                ) : (
                  dayObj.day
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ride popup — shown when a ride day is clicked */}
      {calendarPopup && ridesByDate[calendarPopup.dateStr] && (
        <div className="mt-3 border-t border-gray-700 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">{formatDateWithDay(calendarPopup.dateStr)}</span>
            <button
              onClick={() => setCalendarPopup(null)}
              className="text-gray-500 hover:text-gray-300 text-sm min-h-[44px] min-w-[44px] -my-3 -mr-3"
              aria-label="Close"
            >✕</button>
          </div>
          {ridesByDate[calendarPopup.dateStr].map(ride => {
            const zone = ZONES.find(z => z.id === ride.zone);
            return (
              <div key={ride.id} className="flex items-center justify-between py-1.5 border-b border-gray-700/50 last:border-0">
                <div className="min-w-0 pr-2">
                  <div className="text-sm text-white truncate">{ride.name || 'Untitled Ride'}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {ride.rideType || 'Indoor'}
                    {zone ? <span> · <span style={{ color: zone.color }}>{zone.name}</span></span> : <span className="text-yellow-500"> · Unclassified</span>}
                  </div>
                </div>
                <button
                  onClick={() => { setCalendarPopup(null); handleEditRide(ride.id); }}
                  className="flex-shrink-0 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white px-3 min-h-[44px] rounded-xl transition"
                >Edit Ride →</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
