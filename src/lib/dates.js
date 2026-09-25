export const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Return local YYYY-MM-DD string for a Date object (avoids UTC offset bugs from toISOString)
export const toLocalDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Parse "YYYY-MM-DD" as local midnight (not UTC midnight).
// new Date("YYYY-MM-DD") parses as midnight UTC, which in US timezones
// becomes the previous evening — causing off-by-one day bugs.
export const parseDateLocal = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const parseDuration = (input) => {
  const str = String(input ?? '').trim();
  const hMatch = str.match(/^(\d+)h(\d+)?$/i);
  if (hMatch) return (parseInt(hMatch[1]) || 0) * 60 + (parseInt(hMatch[2]) || 0);
  const colonMatch = str.match(/^(\d+):(\d+)$/);
  if (colonMatch) return parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);
  return parseInt(str) || 0;
};
export const formatDateWithDay = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = DAYS_OF_WEEK[new Date(y, m - 1, d).getDay()];
  return `${dateStr} - ${day}`;
};
