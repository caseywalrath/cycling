import { parseDateLocal } from './dates.js';

// eFTP estimation constants. See EFTP_ESTIMATE_PLAN.md.
export const EFTP_WINDOW_DAYS = 90;      // rolling look-back for the current estimate
export const EFTP_20MIN_FACTOR = 0.95;   // classic 20-minute test conversion
export const EFTP_PROMPT_MARGIN = 10;    // watts above FTP before offering an update
export const EFTP_PROMPT_KEY = 'eftp-prompted-value'; // device-local localStorage key

// Best average power over a window of `seconds`, from a downsampled power stream.
// A single-pass sliding-window sum, the same style as calculateNormalizedPower().
// Null (empty) bins count as 0W — a dropout can only lower the estimate, never raise it.
// Returns null if the stream doesn't have enough bins to fill one window.
export const bestAveragePower = (stream, seconds) => {
  if (!stream || !stream.power || stream.power.length === 0) return null;
  const windowBins = Math.round(seconds / stream.binSeconds);
  if (windowBins < 1 || stream.power.length < windowBins) return null;

  let windowSum = 0;
  let best = -Infinity;
  for (let i = 0; i < stream.power.length; i++) {
    windowSum += stream.power[i] || 0;
    if (i >= windowBins) windowSum -= stream.power[i - windowBins] || 0;
    if (i >= windowBins - 1) best = Math.max(best, windowSum / windowBins);
  }
  return best === -Infinity ? null : best;
};

// Estimate a single ride's FTP from its own power stream: best 20-minute power x 0.95,
// or best 60-minute power if the ride is long enough and that's higher. Returns null if
// the ride has no stream or is shorter than 20 minutes.
export const estimateRideFtp = (ride) => {
  const stream = ride && ride.stream;
  const best20 = bestAveragePower(stream, 20 * 60);
  if (best20 == null) return null;
  const best60 = bestAveragePower(stream, 60 * 60);
  return Math.round(Math.max(EFTP_20MIN_FACTOR * best20, best60 || 0));
};

// Build a timeline of per-ride eFTP estimates and the rolling current eFTP across history.
// eFTP(D) = the highest rideEstimate among rides dated in (D - EFTP_WINDOW_DAYS, D].
export const buildEftpTimeline = (history, today) => {
  const byRideId = {};
  let firstStreamDate = null;

  if (!history || history.length === 0) {
    return { byRideId, current: null, firstStreamDate };
  }

  const sorted = [...history].sort((a, b) => parseDateLocal(a.date) - parseDateLocal(b.date));
  const windowMs = EFTP_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const estimatedRides = sorted
    .map(ride => ({ ride, rideEstimate: estimateRideFtp(ride) }))
    .filter(r => r.rideEstimate != null);

  estimatedRides.forEach(({ ride }) => {
    if (firstStreamDate == null || ride.date < firstStreamDate) firstStreamDate = ride.date;
  });

  const eftpAt = (dateMs) => {
    let peak = null;
    estimatedRides.forEach(({ ride, rideEstimate }) => {
      const rideMs = parseDateLocal(ride.date).getTime();
      if (rideMs > dateMs || rideMs <= dateMs - windowMs) return;
      if (!peak || rideEstimate > peak.value) {
        peak = { value: rideEstimate, peakRideName: ride.name || 'Workout', peakRideDate: ride.date };
      }
    });
    return peak;
  };

  sorted.forEach(ride => {
    const rideEstimate = estimateRideFtp(ride);
    const rideMs = parseDateLocal(ride.date).getTime();
    const peak = eftpAt(rideMs);
    byRideId[ride.id] = {
      rideEstimate,
      eftp: peak ? peak.value : null,
      peakRideName: peak ? peak.peakRideName : null,
      peakRideDate: peak ? peak.peakRideDate : null,
    };
  });

  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const currentPeak = eftpAt(todayMs);
  const current = currentPeak
    ? { value: currentPeak.value, peakRideName: currentPeak.peakRideName, peakRideDate: currentPeak.peakRideDate }
    : null;

  return { byRideId, current, firstStreamDate };
};
