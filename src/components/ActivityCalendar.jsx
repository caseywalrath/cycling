import React, { useMemo, useState } from 'react';
import { ZONES, getZoneColor, getZoneName } from '../lib/zones.js';
import { toLocalDateStr, formatDateWithDay } from '../lib/dates.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { useShell } from '../state/ShellContext.js';
import { navigate } from '../state/useHashRoute.js';
import { Sheet, Button } from './ui/index.js';

// Monthly activity calendar (Monday start) — V2 Phase 4 redesign.
//   - each ride day is a dot coloured by zone (outdoor = teal, unclassified indoor = grey);
//     a day with more than one ride is a two-tone dot;
//   - an 8th column shows that week's total TSS;
//   - tapping a single-ride day opens the Ride page; a multi-ride day opens a small sheet
//     listing that day's rides; tapping an empty past/today date opens Log Ride with that
//     date filled in.

const OUTDOOR_DOT = '#14B8A6';       // teal — outdoor rides aren't filed under a zone (D5)
const UNCLASSIFIED_DOT = '#6B7280';  // grey — indoor ride still waiting for a zone

const rideDotColor = (ride) => {
  if (ride.rideType === 'Outdoor') return OUTDOOR_DOT;
  return ride.zone ? getZoneColor(ride.zone) : UNCLASSIFIED_DOT;
};

// Generate day objects for a month grid (Monday-start), grouped into weeks of 7.
const getCalendarWeeks = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days = [];
  const prevLastDay = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevLastDay - i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    days.push({ day: d, dateStr: `${py}-${String(pm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: true });
  }
  const totalCells = days.length <= 35 ? 35 : 42;
  let nextDay = 1;
  const nm = month === 11 ? 0 : month + 1;
  const ny = month === 11 ? year + 1 : year;
  while (days.length < totalCells) {
    days.push({ day: nextDay, dateStr: `${ny}-${String(nm + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`, isCurrentMonth: false });
    nextDay++;
  }

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
};

// Dot for a day: solid for 0 or 1 colour, a two-tone split for more than one.
function DayDot({ colors }) {
  if (colors.length === 0) return null;
  if (colors.length === 1) {
    return <div className="w-4 h-4 rounded-full" style={{ backgroundColor: colors[0] }} />;
  }
  return (
    <div
      className="w-4 h-4 rounded-full"
      style={{ background: `linear-gradient(90deg, ${colors[0]} 50%, ${colors[1]} 50%)` }}
    />
  );
}

export default function ActivityCalendar() {
  const { history } = useAppData();
  const { openLogRide } = useShell();

  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [daySheet, setDaySheet] = useState(null); // { dateStr } or null

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

  const tssByDate = useMemo(() => {
    const map = {};
    history.forEach(ride => {
      if (ride.date) map[ride.date] = (map[ride.date] || 0) + (ride.tss || 0);
    });
    return map;
  }, [history]);

  const weeks = getCalendarWeeks(calendarYear, calendarMonth);
  const todayStr = toLocalDateStr(new Date());

  const handleDayTap = (dateStr) => {
    const rides = ridesByDate[dateStr];
    if (rides && rides.length === 1) {
      navigate(`#/ride/${rides[0].id}`);
    } else if (rides && rides.length > 1) {
      setDaySheet({ dateStr });
    } else if (dateStr <= todayStr) {
      // Empty past or today date: "Log a ride on <date>".
      openLogRide(dateStr);
    }
  };

  const sheetRides = daySheet ? (ridesByDate[daySheet.dateStr] || []) : [];

  return (
    <div className="bg-gray-800 rounded-2xl py-4 px-2">
      {/* Header: nav arrows + month/year */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => {
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
            if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(calendarYear + 1); }
            else { setCalendarMonth(calendarMonth + 1); }
          }}
          className="text-gray-400 hover:text-white min-h-[44px] min-w-[44px] transition"
          aria-label="Next month"
        >
          &#9654;
        </button>
      </div>

      {/* Day-of-week headers, plus the week-TSS column */}
      <div className="grid text-center text-xs text-gray-500 mb-1" style={{ gridTemplateColumns: 'repeat(7, 1fr) 28px' }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="py-1">{d}</div>
        ))}
        <div className="py-1 text-gray-600" aria-hidden="true">TSS</div>
      </div>

      {/* Week rows: 7 day cells + 1 week-TSS cell */}
      <div>
        {weeks.map((week, wi) => {
          const weekTss = week.reduce((sum, day) => sum + (tssByDate[day.dateStr] || 0), 0);
          return (
            <div key={wi} className="grid items-center" style={{ gridTemplateColumns: 'repeat(7, 1fr) 28px' }}>
              {week.map((dayObj) => {
                const rides = ridesByDate[dayObj.dateStr];
                const hasRide = !!rides;
                const isToday = dayObj.dateStr === todayStr;
                const colors = hasRide ? [...new Set(rides.map(rideDotColor))].slice(0, 2) : [];
                const isPastOrToday = dayObj.dateStr <= todayStr;
                const tappable = hasRide || isPastOrToday;
                return (
                  <div
                    key={dayObj.dateStr}
                    className={`flex items-center justify-center h-11 ${tappable ? 'cursor-pointer' : ''}`}
                    onClick={tappable ? () => handleDayTap(dayObj.dateStr) : undefined}
                    role={tappable ? 'button' : undefined}
                    aria-label={hasRide
                      ? `${rides.length} ride${rides.length === 1 ? '' : 's'} on ${dayObj.dateStr}`
                      : tappable ? `Log a ride on ${dayObj.dateStr}` : undefined}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors ${
                        !hasRide && dayObj.isCurrentMonth ? 'border border-gray-600 text-gray-400' : ''
                      } ${!hasRide && !dayObj.isCurrentMonth ? 'text-gray-700' : ''} ${
                        isToday && !hasRide ? 'border-2 border-blue-400 text-blue-400' : ''
                      } ${isToday && hasRide ? 'ring-2 ring-blue-300' : ''} ${!dayObj.isCurrentMonth && hasRide ? 'opacity-50' : ''}`}
                    >
                      {hasRide ? <DayDot colors={colors} /> : dayObj.day}
                    </div>
                  </div>
                );
              })}
              <div className="text-center text-xs text-gray-500 tabular-nums" data-week-tss>
                {weekTss > 0 ? weekTss : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* Day sheet — shown when a multi-ride day is tapped */}
      <Sheet open={!!daySheet} onClose={() => setDaySheet(null)} title={daySheet ? formatDateWithDay(daySheet.dateStr) : ''}>
        {sheetRides.map(ride => {
          const zone = ZONES.find(z => z.id === ride.zone);
          return (
            <button
              key={ride.id}
              type="button"
              onClick={() => { setDaySheet(null); navigate(`#/ride/${ride.id}`); }}
              className="w-full flex items-center justify-between py-2.5 border-b border-gray-700/50 last:border-0 text-left min-h-[44px]"
            >
              <div className="min-w-0 pr-2">
                <div className="text-base text-white truncate">{ride.name || 'Untitled Ride'}</div>
                <div className="text-sm text-gray-400 mt-0.5">
                  {ride.rideType || 'Indoor'}
                  {ride.rideType === 'Outdoor' ? null : zone
                    ? <span> · <span style={{ color: zone.color }}>{getZoneName(ride.zone)}</span></span>
                    : <span className="text-yellow-500"> · Needs a zone</span>}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0">View →</Button>
            </button>
          );
        })}
      </Sheet>
    </div>
  );
}
