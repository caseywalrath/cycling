// Per-ride analysis — V2 Phase 5 §5.4. Pure functions; each returns null when the ride
// doesn't have the data it needs, rather than a misleading number.
import { bestAveragePower } from './eftp.js';
import { zoneForRatio, ZONES } from './zones.js';

// Durations (seconds) bestsForRide() will compute from a stream when the ride has no
// pre-computed `ride.bests` (older rides, or a ride attached before Phase 5). 10s bins are
// too coarse to trust for anything shorter than a minute.
const STREAM_BEST_DURATIONS = [60, 120, 300, 600, 1200, 1800, 3600, 5400, 7200];

// { bests, source }. `ride.bests` (1-second resolution, computed at import — V2 Phase 5 §5.1)
// is preferred; source is '1s'. Older rides fall back to the saved 10-second stream, source
// '10s', and only for durations >= 60s.
export const bestsForRide = (ride) => {
  if (!ride) return { bests: {}, source: null };
  if (ride.bests && Object.keys(ride.bests).length > 0) {
    return { bests: ride.bests, source: '1s' };
  }
  if (!ride.stream || !ride.stream.power) return { bests: {}, source: null };
  const bests = {};
  STREAM_BEST_DURATIONS.forEach(d => {
    const b = bestAveragePower(ride.stream, d);
    if (b != null) bests[String(d)] = Math.round(b);
  });
  return { bests, source: '10s' };
};

// Seconds spent in each zone, from the ride's power stream binned at stream.binSeconds. Null
// bins (dropouts) are skipped rather than counted as 0W. Returns null when there's no power
// stream to bin.
export const timeInZones = (ride, ftp) => {
  if (!ride || !ride.stream || !ride.stream.power || !ftp) return null;
  const totals = {};
  ZONES.forEach(z => { totals[z.id] = 0; });
  ride.stream.power.forEach(p => {
    if (p == null) return;
    const zone = zoneForRatio(p / ftp);
    totals[zone] = (totals[zone] || 0) + ride.stream.binSeconds;
  });
  return totals;
};

const meanOf = (arr) => {
  const vals = arr.filter(v => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
};

// Aerobic (heart-rate) decoupling: how much the power-to-heart-rate ratio (efficiency factor)
// falls off between the first and second half of a steady effort. Only meaningful for a
// long, genuinely steady ride, so this only returns a value when:
//  - the ride has both power and HR in its stream;
//  - it's at least 60 minutes;
//  - it has no detected intervals (a steady ride, not a workout with hard efforts mixed in);
//  - its variability index (NP / avg power) is <= 1.15 (confirms "steady" beyond just having
//    no detected intervals).
// The first 10 minutes (warm-up, HR still climbing to its steady level) are dropped, then the
// remainder is split into two equal-time halves. Result: (EF1 - EF2) / EF1, as a percentage,
// one decimal. A positive number means HR drifted up relative to power (efficiency fell).
export const aerobicDecoupling = (ride) => {
  if (!ride || !ride.stream || !ride.stream.power || !ride.stream.hr) return null;
  if (ride.intervalData) return null; // not a steady ride
  const { power, hr, binSeconds } = ride.stream;
  const durationMin = (power.length * binSeconds) / 60;
  if (durationMin < 60) return null;

  const avgPower = ride.avgPower ?? meanOf(power);
  const np = ride.normalizedPower;
  if (avgPower == null || !np || avgPower === 0) return null;
  const vi = np / avgPower;
  if (vi > 1.15) return null;

  const dropBins = Math.round((10 * 60) / binSeconds);
  const workingPower = power.slice(dropBins);
  const workingHr = hr.slice(dropBins);
  if (workingPower.length < 2) return null;

  const mid = Math.floor(workingPower.length / 2);
  const ef1 = efFromBins(workingPower.slice(0, mid), workingHr.slice(0, mid));
  const ef2 = efFromBins(workingPower.slice(mid), workingHr.slice(mid));
  if (ef1 == null || ef2 == null || ef1 === 0) return null;

  return Math.round(((ef1 - ef2) / ef1) * 1000) / 10;
};

const efFromBins = (powerBins, hrBins) => {
  const pairs = powerBins.map((p, i) => [p, hrBins[i]]).filter(([p, h]) => p != null && h != null);
  if (pairs.length === 0) return null;
  const avgP = pairs.reduce((s, [p]) => s + p, 0) / pairs.length;
  const avgH = pairs.reduce((s, [, h]) => s + h, 0) / pairs.length;
  if (!avgH) return null;
  return avgP / avgH;
};

// Bands shown alongside an aerobicDecoupling() result (V2_PLAN.md §5.4).
export const decouplingBand = (pct) => {
  if (pct == null) return null;
  if (pct < 5) return { label: 'Solid aerobic base', color: '#22C55E' };
  if (pct <= 8) return { label: 'Some drift', color: '#EAB308' };
  return { label: 'Drifting: base needs work', color: '#EF4444' };
};

// Efficiency factor: normalized power / average heart rate. Only meaningful for a genuinely
// aerobic effort — IF <= 0.80 and at least 45 minutes — so a hard interval session (where HR
// lags power) doesn't produce a misleading number.
export const efficiencyFactor = (ride) => {
  if (!ride || !ride.normalizedPower) return null;
  if (ride.intensityFactor == null || ride.intensityFactor > 0.80) return null;
  if (!ride.duration || ride.duration < 45) return null;
  const avgHr = ride.hrStats?.avg ?? (ride.stream?.hr ? meanOf(ride.stream.hr) : null);
  if (!avgHr) return null;
  return Math.round((ride.normalizedPower / avgHr) * 100) / 100;
};

// The RPE a rider would be expected to report for a given intensity factor — used to flag
// rides that felt harder (or easier) than the numbers suggest.
export const expectedRpe = (intensityFactor) => {
  if (intensityFactor == null) return null;
  if (intensityFactor < 0.65) return 3;
  if (intensityFactor < 0.75) return 4;
  if (intensityFactor < 0.85) return 5;
  if (intensityFactor < 0.95) return 7;
  if (intensityFactor < 1.05) return 8;
  return 9;
};

// Reported RPE minus expected RPE, or null if either is missing.
export const rpeMismatch = (ride) => {
  if (!ride || ride.rpe == null) return null;
  const expected = expectedRpe(ride.intensityFactor);
  if (expected == null) return null;
  return ride.rpe - expected;
};
