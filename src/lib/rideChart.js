// Ride page chart smoothing (Session 28). Display only: the saved stream is never changed, and
// NP, bests, zones and interval detection keep reading the raw 10-second bins.

export const RIDE_CHART_SMOOTHING_KEY = 'ride-chart-smoothing'; // device-local localStorage key

// What the selector offers. `auto` picks a window from the ride; the rest are seconds (0 = raw).
export const SMOOTHING_CHOICES = ['auto', 'raw', '30', '60', '300'];

// Auto's window sizes, in seconds. A long ride is squeezed into a phone-width chart, so the window
// grows with the ride until the chart holds about AUTO_TARGET_POINTS points.
const AUTO_STEPS = [30, 60, 120, 180, 300];
const AUTO_TARGET_POINTS = 100;
const INDOOR_RAW_MAX_MIN = 90; // indoor rides up to this long stay raw so ERG steps stay crisp
const INDOOR_LONG_SECONDS = 30;

// Smoothing window in seconds for a choice: 0 = show every bin. `rideSeconds` is the length of the
// stream; `indoor` is true for indoor rides.
export const smoothingSeconds = (choice, { rideSeconds, indoor }) => {
  if (choice === 'raw') return 0;
  if (choice === '30' || choice === '60' || choice === '300') return Number(choice);
  if (indoor) return rideSeconds / 60 <= INDOOR_RAW_MAX_MIN ? 0 : INDOOR_LONG_SECONDS;
  const wanted = rideSeconds / AUTO_TARGET_POINTS;
  return AUTO_STEPS.find(s => s >= wanted) ?? AUTO_STEPS[AUTO_STEPS.length - 1];
};

// "30-s average" / "1-min average" / "5-min average".
export const describeSmoothing = (seconds) => {
  if (!seconds) return null;
  return seconds < 60 ? `${seconds}-s average` : `${seconds / 60}-min average`;
};

// Centered rolling average over `windowBins` bins. A bin with no reading stays empty (a gap stays
// a gap); empty bins inside a window are skipped, and the window narrows at the ends of the ride.
export const smoothSeries = (values, windowBins) => {
  if (!values || windowBins <= 1) return values;
  const n = values.length;
  const sums = new Array(n + 1).fill(0);
  const counts = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    const has = values[i] != null;
    sums[i + 1] = sums[i] + (has ? values[i] : 0);
    counts[i + 1] = counts[i] + (has ? 1 : 0);
  }
  const before = Math.floor(windowBins / 2);
  const after = windowBins - 1 - before;
  return values.map((v, i) => {
    if (v == null) return null;
    const from = Math.max(0, i - before);
    const to = Math.min(n, i + after + 1);
    return Math.round((sums[to] - sums[from]) / (counts[to] - counts[from]));
  });
};

// Points for the Ride page chart: { min, power, hr } per bin, smoothed over `seconds`.
export const rideChartPoints = (stream, seconds = 0) => {
  if (!stream) return [];
  const length = stream.power?.length ?? stream.hr?.length ?? 0;
  const windowBins = Math.max(1, Math.round(seconds / stream.binSeconds));
  const power = stream.power ? smoothSeries(stream.power, windowBins) : null;
  const hr = stream.hr ? smoothSeries(stream.hr, windowBins) : [];
  return Array.from({ length }, (_, i) => ({
    min: Math.round((i * stream.binSeconds) / 60 * 10) / 10,
    power: power ? power[i] : null,
    hr: hr[i] ?? null,
  }));
};

export const readSmoothingChoice = () => {
  try {
    const saved = localStorage.getItem(RIDE_CHART_SMOOTHING_KEY);
    return SMOOTHING_CHOICES.includes(saved) ? saved : 'auto';
  } catch {
    return 'auto';
  }
};

export const writeSmoothingChoice = (choice) => {
  try { localStorage.setItem(RIDE_CHART_SMOOTHING_KEY, choice); } catch { /* storage unavailable */ }
};
