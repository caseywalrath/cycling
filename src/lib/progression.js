import { parseDateLocal } from './dates.js';
import { ZONE_BOUNDS, ZONE_EXPECTED_RPE } from './zones.js';

// Apply decay to progression levels based on days since last worked per zone.
// Grace period: 14 days of inactivity, then -0.1/week (VO2max/Anaerobic decay 1.5x faster).
// Floor: never below max(1.0, level * 0.5).
// Recovery zone excluded. Zones with no lastWorkedDate are not decayed (first-time grace).
// `asOf` (optional, V2 Phase 7): the date to measure idle days against, as a Date or
// 'YYYY-MM-DD' string. Defaults to today; the history replay passes each ride's date.
export const applyDecay = (levels, lastWorkedDates, asOf = null) => {
  const HIGH_DECAY_ZONES = ['vo2max', 'anaerobic'];
  const today = asOf == null ? new Date() : (typeof asOf === 'string' ? parseDateLocal(asOf) : new Date(asOf));
  today.setHours(0, 0, 0, 0);

  const decayed = { ...levels };

  Object.keys(levels).forEach(zone => {
    if (zone === 'recovery') return;
    const lastWorked = lastWorkedDates[zone];
    if (!lastWorked) return; // No recorded date — no decay (infinite grace until first workout)

    const lastDate = parseDateLocal(lastWorked);
    const daysIdle = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

    if (daysIdle <= 14) return; // Grace period

    const weeksOverdue = (daysIdle - 14) / 7;
    const multiplier = HIGH_DECAY_ZONES.includes(zone) ? 1.5 : 1.0;
    const decay = weeksOverdue * 0.1 * multiplier;

    const floor = Math.max(1.0, levels[zone] * 0.5);
    decayed[zone] = Math.max(floor, levels[zone] - decay);
  });

  return decayed;
};

// Old progression algorithm (expected vs actual RPE). Moved verbatim from App.jsx in V2 Phase 3.
// V2 Phase 7 (stage A): renamed; still what Log Ride uses until the new calculateNewLevel below
// is signed off and wired in.
export const calculateNewLevelLegacy = (currentLevel, workoutLevel, rpe, completed) => {
  if (!completed) {
    if (workoutLevel <= currentLevel) {
      return Math.max(1, currentLevel - 0.5);
    }
    return currentLevel;
  }

  const difficulty = workoutLevel - currentLevel;

  if (difficulty <= -2) {
    return currentLevel;
  } else if (difficulty <= 0) {
    if (rpe <= 5) {
      return Math.min(10, currentLevel + 0.1);
    }
    return currentLevel;
  } else if (difficulty <= 1) {
    if (rpe <= 6) {
      return Math.min(10, currentLevel + 0.5);
    } else if (rpe <= 8) {
      return Math.min(10, currentLevel + 0.3);
    } else {
      return Math.min(10, currentLevel + 0.1);
    }
  } else if (difficulty <= 2) {
    if (rpe <= 7) {
      return Math.min(10, currentLevel + 0.7);
    } else if (rpe <= 9) {
      return Math.min(10, currentLevel + 0.4);
    } else {
      return Math.min(10, currentLevel + 0.2);
    }
  } else {
    if (rpe <= 8) {
      return Math.min(10, currentLevel + 1.0);
    } else {
      return Math.min(10, currentLevel + 0.5);
    }
  }
};

// ---------------------------------------------------------------------------------------------
// V2 Phase 7: workout level from the ride's real structure, and a level update driven by it.
// DRAFT constants (stage A): tuned against the user's history, awaiting sign-off (V2_PLAN §7.3).
// ---------------------------------------------------------------------------------------------

// A workout exactly at a zone's reference session earns this level.
export const LEVEL_AT_REFERENCE = 5;

// Reference session per zone (DRAFT). `workScore` is the sum over every rep of (rep minutes)²,
// i.e. total work minutes × average rep length, so long unbroken efforts count for more than the
// same minutes chopped up. `ratio` is the %FTP (as a fraction) the reference is ridden at.
//   tempo      2x25 @ 76%   → 2·25² = 1250
//   sweetspot  3x12 @ 89%   → 3·12² =  432   (2x20 ≈ 6.5, 3x20 ≈ 7.5)
//   threshold  3x10 @ 98%   → 3·10² =  300   (2x20 ≈ 7.4)
//   vo2max     5x4  @ 111%  → 5·4²  =   80   (5x5 ≈ 6.1)
//   anaerobic  8x1  @ 130%  → 8·1²  =    8
export const STRUCTURE_REFERENCE = {
  tempo:     { workScore: 1250, ratio: 0.76 },
  sweetspot: { workScore: 432,  ratio: 0.89 },
  threshold: { workScore: 300,  ratio: 0.98 },
  vo2max:    { workScore: 80,   ratio: 1.11 },
  anaerobic: { workScore: 8,    ratio: 1.30 },
};

// Levels gained each time the work score doubles (log scale: doubling a session ≠ doubling L).
export const WORK_SCORE_SLOPE = 1.7;

// Levels gained for riding one full zone-width harder than the reference (e.g. SS 81→94%).
export const INTENSITY_SLOPE = 3;

// The intensity term (per set) is capped at ± this many levels, so a mislabelled ride can't run away.
export const INTENSITY_CAP = 2;

// Zone width used for the intensity term when the zone has no upper bound (anaerobic).
export const OPEN_ZONE_WIDTH = 0.3;

// Efforts this far (fraction of FTP) below the zone's lower bound still count as the zone's work.
export const ZONE_SET_TOLERANCE = 0.03;

// Endurance is levelled from the whole ride (duration at IF), not from detected surges:
// a ride of `minutes` at IF `ratio` earns LEVEL_AT_REFERENCE.
export const ENDURANCE_REFERENCE = { minutes: 120, ratio: 0.65 };

// Endurance levels gained per doubling of ride duration (60 min ≈ 3, 4 h ≈ 7 at IF 0.65).
export const ENDURANCE_TIME_SLOPE = 2;

// Endurance levels per full zone-width of IF (smaller: whole-ride IF includes warm-up/cool-down).
export const ENDURANCE_INTENSITY_SLOPE = 2;

const clampLevel = (x) => Math.min(10, Math.max(1, x));
const round1 = (x) => Math.round(x * 10) / 10;

const zoneWidth = (zone) => {
  const [lo, hi] = ZONE_BOUNDS[zone];
  return hi === Infinity ? OPEN_ZONE_WIDTH : hi - lo;
};

const intensityTerm = (zone, ratio, refRatio, slope) => {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  const t = ((ratio - refRatio) / zoneWidth(zone)) * slope;
  return Math.max(-INTENSITY_CAP, Math.min(INTENSITY_CAP, t));
};

// The FTP a ride was scored against when it was saved (NP / IF), or null.
export const rideFtpAtTime = (ride) => {
  const np = Number(ride?.normalizedPower);
  const iF = Number(ride?.intensityFactor);
  return np > 0 && iF > 0 ? np / iF : null;
};

// Pauses this short (seconds) between two in-zone efforts are treated as one continuous rep,
// so a 2x20 split by a brief soft-pedal or power dropout still scores as a 2x20.
export const REP_MERGE_GAP_SECONDS = 60;

// The in-zone work reps of a ride as [{ count, seconds, ratio }]. Uses the individual efforts
// (`segments`, with short pauses merged) when present, otherwise the grouped `sets`.
const workReps = (intervalData, ftp, minRatio) => {
  const segs = (intervalData?.segments || [])
    .filter(g => g && g.endSec > g.startSec && g.avgWatts > 0)
    .sort((a, b) => a.startSec - b.startSec);
  if (segs.length > 0) {
    const reps = [];
    let cur = null;
    for (const g of segs) {
      if (g.avgWatts / ftp < minRatio) { cur = null; continue; }
      const sec = g.endSec - g.startSec;
      if (cur && g.startSec - cur.endSec <= REP_MERGE_GAP_SECONDS) {
        cur.seconds += sec; cur.wattSeconds += sec * g.avgWatts; cur.endSec = g.endSec;
      } else {
        cur = { seconds: sec, wattSeconds: sec * g.avgWatts, endSec: g.endSec };
        reps.push(cur);
      }
    }
    return reps.map(r => ({ count: 1, seconds: r.seconds, ratio: r.wattSeconds / r.seconds / ftp }));
  }
  return (intervalData?.sets || [])
    .filter(s => s && s.workSeconds > 0 && s.avgWatts > 0 && s.avgWatts / ftp >= minRatio)
    .map(s => ({ count: Math.max(1, Number(s.reps) || 1), seconds: s.workSeconds, ratio: s.avgWatts / ftp }));
};

// Workout level (1.0–10.0, one decimal) for an indoor ride, from what was actually ridden.
// Returns null when it can't be calculated (outdoor, recovery/unclassified, no usable structure
// or FTP); the caller then uses a manual or legacy level.
//   - Endurance: ride duration (minutes) at its IF.
//   - Other zones: the ride's interval efforts in (or above) the zone. Work score = Σ over reps
//     of (rep minutes)² × an intensity factor (see below).
export const workoutLevelFromStructure = (ride, ftp) => {
  if (!ride || ride.rideType === 'Outdoor') return null;
  const zone = ride.zone || ride.intervalData?.category || null;
  if (!zone || zone === 'recovery' || !ZONE_BOUNDS[zone]) return null;

  if (zone === 'endurance') {
    const minutes = Number(ride.duration);
    if (!(minutes > 0)) return null;
    let ratio = Number(ride.intensityFactor);
    if (!(ratio > 0) && ftp > 0 && Number(ride.normalizedPower) > 0) ratio = ride.normalizedPower / ftp;
    const L = LEVEL_AT_REFERENCE
      + ENDURANCE_TIME_SLOPE * Math.log2(minutes / ENDURANCE_REFERENCE.minutes)
      + intensityTerm(zone, ratio, ENDURANCE_REFERENCE.ratio, ENDURANCE_INTENSITY_SLOPE);
    return round1(clampLevel(L));
  }

  const ref = STRUCTURE_REFERENCE[zone];
  if (!ref || !(ftp > 0)) return null;
  const reps = workReps(ride.intervalData, ftp, ZONE_BOUNDS[zone][0] - ZONE_SET_TOLERANCE);
  if (reps.length === 0) return null; // nothing ridden in the zone: no structure to score

  // Each rep scores (minutes)², scaled by how hard it was ridden relative to the reference
  // (one zone-width harder = INTENSITY_SLOPE levels). Every rep adds to the score, and more
  // watts in any rep never lowers it, so the level is monotonic in work time and intensity.
  let score = 0;
  for (const { count, seconds, ratio } of reps) {
    const min = seconds / 60;
    const levels = intensityTerm(zone, ratio, ref.ratio, INTENSITY_SLOPE);
    score += count * min * min * Math.pow(2, levels / WORK_SCORE_SLOPE);
  }
  const L = LEVEL_AT_REFERENCE + WORK_SCORE_SLOPE * Math.log2(score / ref.workScore);
  return round1(clampLevel(L));
};

// Share of the gap (L − current) closed by one completed ride, by RPE relative to the zone's
// expected RPE: at or below expected moves most, each point above expected moves less.
export const GAP_FRACTION_BY_RPE_OVER = [0.5, 0.35, 0.2, 0.1];

// Largest single-ride gain (keeps one big day from jumping several levels; not a ceiling).
export const MAX_GAIN_PER_RIDE = 2;

// Maintenance: a completed ride within this many levels below current, at or below expected
// RPE, adds MAINTENANCE_GAIN.
export const MAINTENANCE_BAND = 1;
export const MAINTENANCE_GAIN = 0.1;

// Not completed and L ≤ current: level drops by this much (unchanged from the old rule).
export const INCOMPLETE_PENALTY = 0.5;

// New level after a ride. `zone` picks the expected RPE (ZONE_EXPECTED_RPE); the only ceiling is 10.
export const calculateNewLevel = (currentLevel, workoutLevel, rpe, completed, zone) => {
  const P = Number(currentLevel) || 1;
  const L = Number(workoutLevel);
  if (!Number.isFinite(L)) return P;

  if (!completed) {
    return L <= P ? Math.max(1, P - INCOMPLETE_PENALTY) : P;
  }

  const expected = ZONE_EXPECTED_RPE[zone] ?? 6;
  const over = Math.max(0, Math.round((Number(rpe) || expected) - expected));
  const fraction = GAP_FRACTION_BY_RPE_OVER[Math.min(over, GAP_FRACTION_BY_RPE_OVER.length - 1)];

  const maintenance = over === 0 && L >= P - MAINTENANCE_BAND ? MAINTENANCE_GAIN : 0;
  const progress = L > P ? Math.min(MAX_GAIN_PER_RIDE, (L - P) * fraction) : 0;

  return Math.min(10, P + Math.max(maintenance, progress));
};

