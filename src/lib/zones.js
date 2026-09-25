export const ZONES = [
  { id: 'recovery', name: 'Recovery', color: '#6B7280' },
  { id: 'endurance', name: 'Endurance', color: '#3B82F6' },
  { id: 'tempo', name: 'Tempo', color: '#22C55E' },
  { id: 'sweetspot', name: 'Sweet Spot', color: '#EAB308' },
  { id: 'threshold', name: 'Threshold', color: '#F97316' },
  { id: 'vo2max', name: 'VO2max', color: '#EF4444' },
  { id: 'anaerobic', name: 'Anaerobic', color: '#8B5CF6' },
];

export const DEFAULT_LEVELS = {
  recovery: 1,
  endurance: 1,
  tempo: 1,
  sweetspot: 1,
  threshold: 1,
  vo2max: 1,
  anaerobic: 1,
};

// Expected RPE based on zone/ride type
export const ZONE_EXPECTED_RPE = {
  recovery: 3,
  endurance: 4,
  tempo: 5,
  sweetspot: 6,
  threshold: 7,
  vo2max: 8,
  anaerobic: 9,
};

// Zone adjacency map for trickle effect: a workout in one zone gives a small bonus to neighbors
export const ZONE_ADJACENCY = {
  endurance: [{ zone: 'tempo', factor: 0.2 }],
  tempo:     [{ zone: 'endurance', factor: 0.2 }, { zone: 'sweetspot', factor: 0.2 }],
  sweetspot: [{ zone: 'tempo', factor: 0.2 }, { zone: 'threshold', factor: 0.2 }],
  threshold: [{ zone: 'sweetspot', factor: 0.2 }, { zone: 'vo2max', factor: 0.2 }],
  vo2max:    [{ zone: 'threshold', factor: 0.2 }, { zone: 'anaerobic', factor: 0.2 }],
  anaerobic: [{ zone: 'vo2max', factor: 0.2 }],
};
// V2 Phase 2: single source of truth for zone boundaries (fraction of FTP), replacing the
// old ZONE_POWER_RATIO_RANGES (interval detection) and the separate, disagreeing
// getZoneDescription() table (labels shown on screen). These edges are detection's, tuned in
// Session 19 - unchanged, so no existing interval gets re-filed into a different zone.
// [min, max) - the last zone's max is Infinity.
export const ZONE_BOUNDS = {
  recovery:  [0,    0.55],
  endurance: [0.55, 0.70],
  tempo:     [0.70, 0.81],
  sweetspot: [0.81, 0.94],
  threshold: [0.94, 1.02],
  vo2max:    [1.02, 1.20],
  anaerobic: [1.20, Infinity],
};

// First zone (in ZONES order) whose [min, max) contains ratio.
export const zoneForRatio = (ratio) => {
  for (const zone of ZONES) {
    const [min, max] = ZONE_BOUNDS[zone.id];
    if (ratio >= min && ratio < max) return zone.id;
  }
  return 'anaerobic';
};

// Interval detection never files a block as recovery (it only ever compares work segments
// against the endurance-and-up boundaries), so ratios below 0.55 keep returning 'endurance',
// matching the old categoryForRatio() exactly.
export const categoryForRatio = (ratio) => (ratio < ZONE_BOUNDS.endurance[0] ? 'endurance' : zoneForRatio(ratio));

export const zoneWattRange = (zoneId, ftp) => {
  const [lo, hi] = ZONE_BOUNDS[zoneId];
  return {
    min: Math.round(lo * ftp),
    max: hi === Infinity ? null : Math.round(hi * ftp),
  };
};

// "Z2:"-style prefixes, matching Session-era zone naming. Sweet spot has no prefix.
const ZONE_LABEL_PREFIX = {
  recovery: 'Z1',
  endurance: 'Z2',
  tempo: 'Z3',
  sweetspot: '',
  threshold: 'Z4',
  vo2max: 'Z5',
  anaerobic: 'Z6',
};

// e.g. "127-162W" or "277W+"
export const zoneRangeLabel = (zoneId, ftp) => {
  const { min, max } = zoneWattRange(zoneId, ftp);
  const prefix = ZONE_LABEL_PREFIX[zoneId];
  const range = max === null ? `${min}W+` : `${min}-${max}W`;
  return prefix ? `${prefix}: ${range}` : range;
};
