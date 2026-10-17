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
// Single source of truth for zone boundaries (fraction of FTP), used by interval detection, the
// labels on screen, time-in-zone, the progression levels and Copy for Claude.
//
// Session 26: anchored to TrainerDay, which uses Coggan's power levels (Z1 under 55%, Z2 56-75,
// Z3 76-90, Z4 91-105, Z5 106-120, Z6 121+). The one-point gaps in that table (75 to 76, and so
// on) are closed so every ratio lands in exactly one zone. Coggan has no sweet-spot level, so
// Sweet Spot is the app's own band, 88-94%, cut out of the top of Z3 and the bottom of Z4 (the
// same band TrainerRoad and the offseason plan call sweet spot). Tempo therefore stops at 88%
// and Threshold starts at 95%. See ZONE_COGGAN_LEVEL below.
// [min, max) - the last zone's max is Infinity.
export const ZONE_BOUNDS = {
  recovery:  [0,    0.55],
  endurance: [0.55, 0.76],
  tempo:     [0.76, 0.88],
  sweetspot: [0.88, 0.95],
  threshold: [0.95, 1.06],
  vo2max:    [1.06, 1.21],
  anaerobic: [1.21, Infinity],
};

// Which TrainerDay / Coggan level each app zone sits in (for the Settings footnote and the
// Copy for Claude zone table). Sweet Spot straddles two.
export const ZONE_COGGAN_LEVEL = {
  recovery: 'Z1',
  endurance: 'Z2',
  tempo: 'Z3',
  sweetspot: 'top of Z3 and start of Z4',
  threshold: 'Z4',
  vo2max: 'Z5',
  anaerobic: 'Z6',
};

// Zone widths (fraction of FTP) the progression levels use to scale intensity. These are the
// widths of the pre-Session-26 zones, kept fixed so moving the zone edges above did not move the
// levels (Phase 7 calibrated INTENSITY_SLOPE against them). Anaerobic is open-ended, so it uses
// OPEN_ZONE_WIDTH in progression.js. Not tied to ZONE_BOUNDS on purpose.
export const ZONE_LEVEL_WIDTH = {
  endurance: 0.15,
  tempo: 0.11,
  sweetspot: 0.13,
  threshold: 0.08,
  vo2max: 0.18,
};

// First zone (in ZONES order) whose [min, max) contains ratio.
export const zoneForRatio = (ratio) => {
  if (!Number.isFinite(ratio)) return ratio === Infinity ? 'anaerobic' : null;
  if (ratio < 0) return 'recovery';
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

// Display helpers, moved from App.jsx in V2 Phase 3 (unchanged).
export const getZoneName = (zoneId) => {
  if (!zoneId) return 'Unclassified';
  const zone = ZONES.find(z => z.id === zoneId);
  return zone ? zone.name : zoneId;
};

export const getZoneColor = (zoneId) => {
  if (!zoneId) return '#888';
  const zone = ZONES.find(z => z.id === zoneId);
  return zone ? zone.color : '#888';
};
