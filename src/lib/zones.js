export const ZONES = [
  { id: 'recovery', name: 'Recovery', color: '#6B7280', description: 'Z1: <130W' },
  { id: 'endurance', name: 'Endurance', color: '#3B82F6', description: 'Z2: 130-165W' },
  { id: 'tempo', name: 'Tempo', color: '#22C55E', description: 'Z3: 165-185W' },
  { id: 'sweetspot', name: 'Sweet Spot', color: '#EAB308', description: '195-220W' },
  { id: 'threshold', name: 'Threshold', color: '#F97316', description: 'Z4: 220-235W' },
  { id: 'vo2max', name: 'VO2max', color: '#EF4444', description: 'Z5: 235-280W' },
  { id: 'anaerobic', name: 'Anaerobic', color: '#8B5CF6', description: 'Z6: 280W+' },
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

export const ZONE_EXPECTED_RPE = {
  recovery: 3,
  endurance: 4,
  tempo: 5,
  sweetspot: 6,
  threshold: 7,
  vo2max: 8,
  anaerobic: 9,
};

export const ZONE_ADJACENCY = {
  endurance: [{ zone: 'tempo', factor: 0.2 }],
  tempo:     [{ zone: 'endurance', factor: 0.2 }, { zone: 'sweetspot', factor: 0.2 }],
  sweetspot: [{ zone: 'tempo', factor: 0.2 }, { zone: 'threshold', factor: 0.2 }],
  threshold: [{ zone: 'sweetspot', factor: 0.2 }, { zone: 'vo2max', factor: 0.2 }],
  vo2max:    [{ zone: 'threshold', factor: 0.2 }, { zone: 'anaerobic', factor: 0.2 }],
  anaerobic: [{ zone: 'vo2max', factor: 0.2 }],
};

const ZONE_POWER_RATIO_RANGES = [
  { max: 0.70, zone: 'endurance' },
  { max: 0.81, zone: 'tempo' },
  { max: 0.94, zone: 'sweetspot' },
  { max: 1.02, zone: 'threshold' },
  { max: 1.20, zone: 'vo2max' },
  { max: Infinity, zone: 'anaerobic' },
];

export const categoryForRatio = (ratio) => ZONE_POWER_RATIO_RANGES.find(r => ratio < r.max).zone;
