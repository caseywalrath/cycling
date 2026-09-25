// Small display formatters. Moved from App.jsx in V2 Phase 3 (unchanged).

export const formatChange = (change) => {
  if (change > 0) return `+${change.toFixed(1)}`;
  if (change < 0) return change.toFixed(1);
  return '0';
};

// eslint-disable-next-line no-unused-vars
export const getChangeDescription = (change, rpe, workoutLevel, currentLevel) => {
  if (change >= 0.7) return 'Breakthrough!';
  if (change >= 0.4) return 'Strong progress';
  if (change >= 0.2) return 'Solid work';
  if (change > 0) return 'Maintained';
  if (change === 0) return 'No change';
  return 'Level adjusted down';
};

// 1 → "1st", 22 → "22nd", 13 → "13th"
export const ordinal = (n) => {
  const v = n % 100;
  const suffix = (v >= 11 && v <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return `${n}${suffix}`;
};

// "Wed, Sep 23" from YYYY-MM-DD (local date, never UTC).
export const shortDayDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

// 95 → "1h 35m", 40 → "40m"
export const formatMinutes = (minutes) => {
  const total = Math.round(minutes || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
