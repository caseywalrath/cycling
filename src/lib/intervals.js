import { categoryForRatio } from './zones.js';

// Interval detection constants (indoor ERG power is near-square-wave, so a simple
// threshold + run-length approach works well). See INTERVAL_TRACKING_PLAN.md §4.
export const WORK_THRESHOLD = 0.85; // fraction of FTP that counts as "work" (fixed fallback / upper bound)
export const MIN_WORK_RATIO = 0.60; // a work interval must average at least this fraction of FTP
export const WORK_REST_SEPARATION = 1.15; // work level must sit this far above the easy level to count as structure
export const MIN_WORK_SECONDS = 90; // shorter runs are discarded (micro-intervals are a known v1 limitation)
export const GAP_MERGE_BINS = 2; // merge work runs separated by a gap this small (handles power dropouts)
export const LAP_MERGE_TOLERANCE = 0.07; // consecutive laps within ±7% watts are treated as one block
export const MAX_SINGLE_SEGMENT_COVERAGE = 0.85; // one "interval" covering more of the ride than this = steady ride
export const MIN_SOLO_WORK_RATIO = 0.76; // a lone work block below this %FTP is steady riding, not an interval

export const meanOf = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

// Find the power level that separates "work" from "recovery" in THIS ride, rather than
// assuming work always happens above 85% FTP. Indoor ERG workouts are near-square waves,
// so the power histogram is strongly bimodal and a 1-D 2-means (Lloyd's algorithm) settles
// on the recovery watts and the interval watts. This is what lets a 2x30 @ 182W tempo
// session (below 85% of a 235W FTP) be detected at all.
// Returns null when the ride has no meaningful two-level structure — a steady ride, or a
// ride whose "hard" level is too easy to count as an interval.
export const adaptiveWorkThreshold = (values, ftp) => {
  const vals = values.filter(v => v != null).sort((a, b) => a - b);
  if (vals.length < 6) return null;

  const pct = (f) => vals[Math.floor(f * (vals.length - 1))];
  let lo = pct(0.10);
  let hi = pct(0.90);
  if (hi - lo < 1) return null; // completely flat trace

  for (let iter = 0; iter < 25; iter++) {
    const mid = (lo + hi) / 2;
    const low = vals.filter(v => v < mid);
    const high = vals.filter(v => v >= mid);
    if (low.length === 0 || high.length === 0) return null;
    const nextLo = meanOf(low);
    const nextHi = meanOf(high);
    const settled = Math.abs(nextLo - lo) < 0.5 && Math.abs(nextHi - hi) < 0.5;
    lo = nextLo;
    hi = nextHi;
    if (settled) break;
  }

  if (hi < MIN_WORK_RATIO * ftp) return null; // the "hard" level is just easy riding
  if (hi < lo * WORK_REST_SEPARATION) return null; // no real separation — steady ride
  return (lo + hi) / 2;
};

// Collapse a FIT lap list into blocks, merging consecutive laps that sit at the same power
// level (±LAP_MERGE_TOLERANCE). Trainer apps and head units often chop one long interval
// into several laps (auto-lap by time or distance) — without merging, a 2x30 recorded as
// eight 8-minute laps would be reported as "6x8 + 2x6".
export const mergeLapBlocks = (laps) => {
  const blocks = [];
  let cursor = 0;
  laps.forEach(l => {
    const seconds = l.total_timer_time || 0;
    const watts = l.avg_power != null ? l.avg_power : null;
    const hr = l.avg_heart_rate != null ? l.avg_heart_rate : null;
    const prev = blocks[blocks.length - 1];
    const sameLevel = prev && watts != null && prev.avgWatts != null &&
      Math.abs(watts - prev.avgWatts) <= prev.avgWatts * LAP_MERGE_TOLERANCE;

    if (sameLevel) {
      const total = prev.seconds + seconds;
      prev.avgWatts = (prev.avgWatts * prev.seconds + watts * seconds) / total;
      prev.avgHR = (hr != null && prev.avgHR != null)
        ? (prev.avgHR * prev.seconds + hr * seconds) / total
        : prev.avgHR;
      prev.seconds = total;
      prev.endSec = cursor + seconds;
    } else {
      blocks.push({ startSec: cursor, endSec: cursor + seconds, seconds, avgWatts: watts, avgHR: hr });
    }
    cursor += seconds;
  });
  return blocks;
};

// Build a compact label like "4x6 @ 280W" (single set) or "3x8 @ 250W + 4x1 @ 320W" (multiple).
export const buildIntervalLabel = (sets) => {
  return sets.map(s => {
    const minutes = Math.round((s.workSeconds / 60) * 2) / 2; // nearest 0.5 min
    const minStr = Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1);
    return `${s.reps}x${minStr} @ ${s.avgWatts}W`;
  }).join(' + ');
};

// Detect interval structure from a downsampled power/HR stream. Returns
// { segments, sets, category, label } or null if no work intervals were found
// (e.g. a steady endurance ride — this is a normal, expected outcome).
//
// `indoor` enables the adaptive (ride-relative) work threshold. Indoor ERG power is a
// clean square wave, so we can trust the ride's own two power levels and detect intervals
// that sit below 85% FTP (tempo, endurance, sweet spot). Outdoor power is far noisier, so
// outdoor rides keep the conservative fixed 85%-FTP threshold to avoid inventing
// "intervals" out of rolling terrain.
export const detectIntervals = (stream, ftp, laps = null, { indoor = true } = {}) => {
  if (!stream || !stream.power || !ftp) return null;
  const { power, hr, binSeconds } = stream;
  const n = power.length;
  if (n === 0) return null;

  // 1. Smooth power with a 3-bin (30s @ 10s bins) centered rolling average, skipping nulls.
  const smoothed = power.map((_, i) => {
    const lo = Math.max(0, i - 1);
    const hi = Math.min(n - 1, i + 1);
    const vals = power.slice(lo, hi + 1).filter(v => v != null);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });

  // 2. Pick the work threshold. The adaptive value can only ever LOWER the bar, never raise
  // it above the fixed 85% FTP — so every workout detected before this change still is.
  const adaptive = indoor ? adaptiveWorkThreshold(smoothed, ftp) : null;
  const workThreshold = adaptive != null
    ? Math.min(WORK_THRESHOLD * ftp, adaptive)
    : WORK_THRESHOLD * ftp;
  const minWorkWatts = MIN_WORK_RATIO * ftp;

  // 3. Find contiguous "work" runs (smoothed power >= threshold), merging small gaps.
  const isWork = smoothed.map(v => v != null && v >= workThreshold);
  const rawRuns = [];
  let runStart = null;
  for (let i = 0; i < n; i++) {
    if (isWork[i]) {
      if (runStart == null) runStart = i;
    } else if (runStart != null) {
      rawRuns.push([runStart, i - 1]);
      runStart = null;
    }
  }
  if (runStart != null) rawRuns.push([runStart, n - 1]);

  const mergedRuns = [];
  rawRuns.forEach(([s, e]) => {
    const prev = mergedRuns[mergedRuns.length - 1];
    if (prev && s - prev[1] - 1 <= GAP_MERGE_BINS) {
      prev[1] = e;
    } else {
      mergedRuns.push([s, e]);
    }
  });

  const minBins = Math.ceil(MIN_WORK_SECONDS / binSeconds);
  const runs = mergedRuns.filter(([s, e]) => (e - s + 1) >= minBins);
  if (runs.length === 0) return null;

  const avgOf = (arr, s, e) => {
    const vals = arr.slice(s, e + 1).filter(v => v != null);
    if (vals.length === 0) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  // A run only counts as an interval if it is genuinely harder than easy riding — the
  // adaptive threshold is relative, so this absolute floor stops a warmup/cooldown split
  // from being reported as "2x20 @ 120W".
  let segments = runs
    .map(([s, e]) => ({
      startSec: s * binSeconds,
      endSec: (e + 1) * binSeconds,
      avgWatts: avgOf(power, s, e),
      avgHR: avgOf(hr, s, e),
    }))
    .filter(seg => seg.avgWatts != null && seg.avgWatts >= minWorkWatts);
  if (segments.length === 0) return null;

  // 5. Lap hint: trainer apps usually record one lap per workout step, which gives exact
  // interval boundaries. Consecutive laps at the same power are merged first (a 30-minute
  // step recorded as four 8-minute auto-laps is one interval, not four). Prefer laps when
  // they find more intervals than step detection, or when they agree with it on total work
  // time — in the tie case lap boundaries are the more accurate of the two.
  if (laps && laps.length >= 3) {
    const lapSegments = mergeLapBlocks(laps)
      .filter(b => b.avgWatts != null && b.avgWatts >= workThreshold
        && b.avgWatts >= minWorkWatts && b.seconds >= MIN_WORK_SECONDS)
      .map(b => ({
        startSec: Math.round(b.startSec),
        endSec: Math.round(b.endSec),
        avgWatts: Math.round(b.avgWatts),
        avgHR: b.avgHR != null ? Math.round(b.avgHR) : null,
      }));

    const totalWork = (segs) => segs.reduce((sum, s) => sum + (s.endSec - s.startSec), 0);
    const lapWorkSec = totalWork(lapSegments);
    const stepWorkSec = totalWork(segments);
    const agreesOnWorkTime = stepWorkSec > 0 &&
      Math.abs(lapWorkSec - stepWorkSec) <= stepWorkSec * 0.25;

    if (lapSegments.length > segments.length ||
        (lapSegments.length === segments.length && agreesOnWorkTime)) {
      if (lapSegments.length > 0) segments = lapSegments;
    }
  }

  // A lone work block is only an interval session if it's genuinely hard and clearly
  // bookended by easier riding. Otherwise it's a steady ride with a warmup, and calling it
  // "1x70 @ 162W" would pollute the progression history.
  const rideSeconds = n * binSeconds;
  if (segments.length === 1) {
    const solo = segments[0];
    const coversRide = (solo.endSec - solo.startSec) > MAX_SINGLE_SEGMENT_COVERAGE * rideSeconds;
    if (coversRide || solo.avgWatts < MIN_SOLO_WORK_RATIO * ftp) return null;
  }

  // 6. Group segments into sets: same set if duration within ±15% and avgWatts within ±5%.
  const sets = [];
  segments.forEach((seg, idx) => {
    const duration = seg.endSec - seg.startSec;
    const prevGap = idx > 0 ? seg.startSec - segments[idx - 1].endSec : null;
    let set = sets.find(s =>
      Math.abs(s._avgDuration - duration) <= s._avgDuration * 0.15 &&
      Math.abs(s.avgWatts - seg.avgWatts) <= s.avgWatts * 0.05
    );
    if (!set) {
      set = { reps: 0, _durations: [], _watts: [], _hrs: [], _gaps: [], _avgDuration: duration, avgWatts: seg.avgWatts };
      sets.push(set);
    }
    set.reps++;
    set._durations.push(duration);
    set._watts.push(seg.avgWatts);
    if (seg.avgHR != null) set._hrs.push(seg.avgHR);
    if (prevGap != null) set._gaps.push(prevGap);
    set._avgDuration = set._durations.reduce((a, b) => a + b, 0) / set._durations.length;
    set.avgWatts = Math.round(set._watts.reduce((a, b) => a + b, 0) / set._watts.length);
  });

  const median = (arr) => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const roundTo = (val, nearest) => val == null ? null : Math.round(val / nearest) * nearest;

  const finalSets = sets.map(s => ({
    reps: s.reps,
    workSeconds: roundTo(median(s._durations), 30),
    avgWatts: s.avgWatts,
    avgHR: s._hrs.length ? Math.round(s._hrs.reduce((a, b) => a + b, 0) / s._hrs.length) : null,
    restSeconds: s.reps > 1 ? roundTo(median(s._gaps), 15) : null,
  }));

  // 7. Category from the dominant set (most total work time).
  const dominant = finalSets.reduce((best, s) =>
    (s.reps * s.workSeconds) > (best.reps * best.workSeconds) ? s : best, finalSets[0]);
  const category = categoryForRatio(dominant.avgWatts / ftp);

  return {
    segments,
    sets: finalSets,
    category,
    label: buildIntervalLabel(finalSets),
  };
};
