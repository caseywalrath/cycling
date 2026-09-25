import FitParser from 'fit-file-parser';
import { toLocalDateStr } from './dates.js';

// Normalized Power: 30-second rolling average of the power stream, each rolling
// average raised to the 4th power, averaged, then 4th-rooted. Assumes ~1Hz recording.
// Returns null if there aren't enough samples for a single 30s window.
export const calculateNormalizedPower = (powerSamples) => {
  if (!powerSamples || powerSamples.length < 30) return null;
  let windowSum = 0;
  let rollingCount = 0;
  let fourthPowerSum = 0;
  for (let i = 0; i < powerSamples.length; i++) {
    windowSum += powerSamples[i];
    if (i >= 30) windowSum -= powerSamples[i - 30];
    if (i >= 29) {
      fourthPowerSum += (windowSum / 30) ** 4;
      rollingCount++;
    }
  }
  return Math.round((fourthPowerSum / rollingCount) ** 0.25);
};

// Bests are computed at these durations (seconds). V2 Phase 5 §0.5/§5.1.
export const BEST_DURATIONS = [5, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600, 5400, 7200];

// Cap any single ride's 1Hz series at 8 hours — a corrupt/very long file shouldn't build an
// unbounded array.
const MAX_ONE_HZ_SECONDS = 8 * 60 * 60;

// Build a 1-second-resolution power/HR series from raw records, indexed by second from the
// first record. FIT "smart recording" only writes a new record every few seconds when
// nothing changes, so short gaps (<=10s) are forward-filled from the previous record. A
// longer gap is treated as a stop: power 0, HR null (whatever the rider was doing, we don't
// know their heart rate, but they weren't producing power).
// Returns { power: number[] | null, hr: (number|null)[] }. `power` is null when no record in
// the ride has a power value at all (HR-only file).
export const toOneHzSeries = (records) => {
  if (!records || records.length === 0) return { power: null, hr: [] };
  const withTime = records.filter(r => r.timestamp != null);
  if (withTime.length === 0) return { power: null, hr: [] };

  const hasPower = withTime.some(r => r.power != null);
  const t0 = new Date(withTime[0].timestamp).getTime();

  // Place each record at its rounded offset from t0, keeping only the last record seen for
  // a given second (matches the source data's own ordering).
  const bySecond = new Map();
  withTime.forEach(r => {
    const t = new Date(r.timestamp).getTime();
    const sec = Math.round((t - t0) / 1000);
    if (sec < 0 || sec > MAX_ONE_HZ_SECONDS) return;
    bySecond.set(sec, r);
  });

  const secs = [...bySecond.keys()].sort((a, b) => a - b);
  const lastSec = secs[secs.length - 1];
  // Zero/null-initialized: a gap longer than the forward-fill window (>10s) is a stop, and
  // arrays start that way by default.
  const power = hasPower ? new Array(lastSec + 1).fill(0) : null;
  const hr = new Array(lastSec + 1).fill(null);

  secs.forEach((s, idx) => {
    const rec = bySecond.get(s);
    const recPower = rec.power != null ? rec.power : 0;
    const recHr = rec.heart_rate != null ? rec.heart_rate : null;
    if (power) power[s] = recPower;
    hr[s] = recHr;

    const nextS = idx + 1 < secs.length ? secs[idx + 1] : null;
    if (nextS != null && nextS - s <= 10) {
      // Gap of <=10s to the next record: forward-fill this record's value across it.
      for (let t = s + 1; t < nextS; t++) {
        if (power) power[t] = recPower;
        hr[t] = recHr;
      }
    }
    // A gap of >10s is a stop: the zero/null the arrays already start with is correct.
  });

  return { power, hr };
};

// Best average power over any window of `seconds`, from a 1Hz power array (a plain sliding-
// window sum, same approach as bestAveragePower() at 10s bins). Returns null if there aren't
// enough seconds to fill one window, or if there's no power at all.
const bestAverageOneHz = (power, seconds) => {
  if (!power || power.length < seconds) return null;
  let windowSum = 0;
  let best = -Infinity;
  for (let i = 0; i < power.length; i++) {
    windowSum += power[i] || 0;
    if (i >= seconds) windowSum -= power[i - seconds] || 0;
    if (i >= seconds - 1) best = Math.max(best, windowSum / seconds);
  }
  return best === -Infinity ? null : Math.round(best);
};

// For each duration in BEST_DURATIONS that fits inside the ride, the best average power over
// any window of that length, from the 1Hz series. Durations longer than the ride are omitted.
export const bestsFromOneHz = (power) => {
  if (!power || power.length === 0) return {};
  const bests = {};
  BEST_DURATIONS.forEach(d => {
    const b = bestAverageOneHz(power, d);
    if (b != null) bests[String(d)] = b;
  });
  return bests;
};

// { avg, max } in bpm from a 1Hz (or any) HR array, or null if there's no HR data at all.
export const hrStatsFromSeries = (hr) => {
  if (!hr || hr.length === 0) return null;
  const vals = hr.filter(v => v != null);
  if (vals.length === 0) return null;
  return {
    avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    max: Math.max(...vals),
  };
};

// Mean of the 1Hz power series including zeros (coasting/stopped counts against the average,
// same as a head unit's "avg power"). Null when there's no power at all.
export const avgPowerFromSeries = (power) => {
  if (!power || power.length === 0) return null;
  return Math.round(power.reduce((a, b) => a + (b || 0), 0) / power.length);
};

// Parse a .FIT file (ArrayBuffer) into Log Ride form field values.
// Only pre-fills the fields a FIT file can actually tell us (date, duration,
// power, distance, elevation, indoor/outdoor) — Zone, Ride Name, and RPE are
// left for the user, same as the "Ride Source Model" rule for CSV/API imports.
export const parseFitFile = (arrayBuffer) => {
  // Check the FIT header's ".FIT" signature (bytes 8-11) before handing the file to
  // the parser. Non-FIT files (wrong file picked, renamed, etc.) can make the parser
  // loop forever trying to recover a header it can never find — this fails fast instead.
  const bytes = new Uint8Array(arrayBuffer);
  const signature = bytes.length >= 12 ? String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) : '';
  if (signature !== '.FIT') {
    return Promise.reject(new Error("This doesn't look like a valid FIT file. Please choose a .fit file exported from your bike computer or training app."));
  }

  const parser = new FitParser({ force: true });
  return new Promise((resolve, reject) => {
    parser.parse(arrayBuffer, (error, data) => {
      if (error) {
        reject(new Error('Could not read this FIT file. It may be corrupted or in an unsupported format.'));
        return;
      }
      const session = data.sessions && data.sessions[0];
      if (!session) {
        reject(new Error('No ride data found in this FIT file.'));
        return;
      }
      resolve(buildRideFromRecords({
        records: data.records || [],
        startTime: session.start_time,
        timerSeconds: session.total_timer_time,
        distanceMeters: session.total_distance,
        ascentMeters: session.total_ascent,
        normalizedPower: session.normalized_power,
        avgPower: session.avg_power,
        laps: data.laps || [],
      }));
    });
  });
};

// Shared by the FIT and TCX readers: turns per-second records (FIT field names) plus
// ride-level totals into Log Ride form values, power stream, and laps.
export const buildRideFromRecords = ({ records, startTime, timerSeconds, distanceMeters, ascentMeters, normalizedPower, avgPower, laps }) => {
  const powerSamples = records.map(r => r.power).filter(p => p != null);
  const hasGPS = records.some(r => r.position_lat != null || r.position_long != null);

  let elevation = 0;
  if (ascentMeters != null) {
    elevation = Math.round(ascentMeters * 3.28084); // meters to feet
  } else {
    const altitudes = records
      .map(r => r.altitude != null ? r.altitude : r.enhanced_altitude)
      .filter(a => a != null);
    let climbed = 0;
    for (let i = 1; i < altitudes.length; i++) {
      const delta = altitudes[i] - altitudes[i - 1];
      if (delta > 0) climbed += delta;
    }
    elevation = Math.round(climbed * 3.28084); // meters to feet
  }

  const np = normalizedPower
    || calculateNormalizedPower(powerSamples)
    || avgPower
    || 0;

  // V2 Phase 5: full-resolution (1Hz) bests, HR stats and true average power, computed once
  // at import time and saved onto the ride (§0.5, §5.1).
  const oneHz = toOneHzSeries(records);

  return {
    date: toLocalDateStr(startTime),
    duration: Math.round((timerSeconds || 0) / 60),
    distance: Math.round((distanceMeters || 0) / 1000 * 0.621371 * 10) / 10, // meters to miles
    elevation,
    rideType: hasGPS ? 'Outdoor' : 'Indoor',
    normalizedPower: Math.round(np),
    stream: downsampleRecords(records),
    laps,
    bests: bestsFromOneHz(oneHz.power),
    hrStats: hrStatsFromSeries(oneHz.hr),
    avgPower: avgPowerFromSeries(oneHz.power),
  };
};

// Parse a .TCX file (XML text) into the same shape parseFitFile() returns. Trackpoints
// are mapped to FIT record field names so everything downstream is shared.
// A trackpoint with no <Watts> is treated as 0W: TrainerDay (and other exporters) omit
// the power value while coasting rather than writing 0, so skipping those points would
// overstate NP/TSS. Any power at all in the file is required, as with FIT.
export const parseTcxFile = (text) => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0 ||
      doc.getElementsByTagNameNS('*', 'TrainingCenterDatabase').length === 0) {
    throw new Error("This doesn't look like a valid TCX file. Please choose a .tcx file exported from your bike computer or training app.");
  }

  const child = (el, name) => el.getElementsByTagNameNS('*', name)[0] || null;
  const num = (el, name) => {
    const c = child(el, name);
    if (!c) return null;
    const v = parseFloat(c.textContent);
    return Number.isFinite(v) ? v : null;
  };
  // <HeartRateBpm><Value>…</Value></HeartRateBpm>
  const nestedValue = (el, name) => {
    const c = child(el, name);
    return c ? num(c, 'Value') : null;
  };

  const trackpoints = Array.from(doc.getElementsByTagNameNS('*', 'Trackpoint'));
  const hasAnyPower = trackpoints.some(tp => child(tp, 'Watts'));
  if (trackpoints.length === 0) throw new Error('No ride data found in this TCX file.');

  const records = trackpoints
    .map(tp => {
      const time = child(tp, 'Time');
      if (!time) return null;
      const watts = num(tp, 'Watts');
      return {
        timestamp: new Date(time.textContent.trim()),
        power: hasAnyPower ? (watts ?? 0) : null,
        heart_rate: nestedValue(tp, 'HeartRateBpm'),
        altitude: num(tp, 'AltitudeMeters'),
        position_lat: num(tp, 'LatitudeDegrees'),
        position_long: num(tp, 'LongitudeDegrees'),
        distance: num(tp, 'DistanceMeters'),
      };
    })
    .filter(r => r && !Number.isNaN(r.timestamp.getTime()));
  if (records.length === 0) throw new Error('No ride data found in this TCX file.');

  const lapEls = Array.from(doc.getElementsByTagNameNS('*', 'Lap'));
  const laps = lapEls.map(lap => ({
    total_timer_time: num(lap, 'TotalTimeSeconds') || 0,
    avg_power: num(lap, 'AvgWatts'),
    avg_heart_rate: nestedValue(lap, 'AverageHeartRateBpm'),
  }));

  const lapSeconds = laps.reduce((s, l) => s + l.total_timer_time, 0);
  const lapDistance = lapEls.reduce((s, lap) => {
    const direct = Array.from(lap.children).find(c => c.localName === 'DistanceMeters');
    return s + (direct ? parseFloat(direct.textContent) || 0 : 0);
  }, 0);
  const lastDistance = [...records].reverse().find(r => r.distance != null)?.distance;
  const first = records[0].timestamp;
  const last = records[records.length - 1].timestamp;

  return buildRideFromRecords({
    records,
    startTime: first,
    timerSeconds: lapSeconds || (last - first) / 1000,
    distanceMeters: lapDistance || lastDistance || 0,
    ascentMeters: null,
    normalizedPower: null,
    avgPower: null,
    laps,
  });
};

// Downsample a FIT records array into fixed-width time bins for the Workout Detail
// chart. Each bin holds the average of the non-null power/HR samples inside it.
// Returns null when there's no usable power OR heart-rate data (nothing to chart).
// V2 Phase 5: a ride with heart rate but no power (e.g. an outdoor ride with a HR strap and
// no power meter) still gets a stream, with `power: null` rather than an all-zero array — see
// V2_PLAN.md §5.1. Every reader of `stream.power` must be null-safe.
export const downsampleRecords = (records, binSeconds = 10) => {
  if (!records || records.length === 0) return null;
  const withPower = records.some(r => r.power != null);
  const withHR = records.some(r => r.heart_rate != null);
  if (!withPower && !withHR) return null;

  const t0 = records[0].timestamp ? new Date(records[0].timestamp).getTime() : null;
  if (t0 == null) return null;

  const powerSums = [];
  const powerCounts = [];
  const hrSums = [];
  const hrCounts = [];

  records.forEach(r => {
    if (!r.timestamp) return;
    const t = new Date(r.timestamp).getTime();
    const bin = Math.floor((t - t0) / 1000 / binSeconds);
    if (bin < 0) return;
    if (r.power != null) {
      powerSums[bin] = (powerSums[bin] || 0) + r.power;
      powerCounts[bin] = (powerCounts[bin] || 0) + 1;
    }
    if (r.heart_rate != null) {
      hrSums[bin] = (hrSums[bin] || 0) + r.heart_rate;
      hrCounts[bin] = (hrCounts[bin] || 0) + 1;
    }
  });

  const binCount = Math.max(powerSums.length, hrSums.length);
  const power = withPower ? [] : null;
  const hr = [];
  for (let i = 0; i < binCount; i++) {
    if (power) power.push(powerCounts[i] ? Math.round(powerSums[i] / powerCounts[i]) : null);
    hr.push(hrCounts[i] ? Math.round(hrSums[i] / hrCounts[i]) : null);
  }

  return { binSeconds, power, hr };
};

// Moved from App.jsx in V2 Phase 3 (unchanged).
// Among rides logged on the same date as an imported file, pick the one whose duration is
// closest to the file's, and only if that's within 25% (or the ride's stored duration is
// 0, i.e. unset). Otherwise there's no confident match, and the file becomes a new ride
// without asking — a same-day match by date alone was pairing files with the wrong ride
// when two rides were logged on the same day.
export const findMatchingRideForImport = (rides, parsed) => {
  const sameDay = rides.filter(w => w.date === parsed.date);
  if (sameDay.length === 0) return null;
  let best = null;
  let bestDiff = Infinity;
  for (const ride of sameDay) {
    let diff;
    let qualifies;
    if (!ride.duration || ride.duration === 0) {
      // Unset duration always qualifies, but a real close-duration match still wins.
      diff = Infinity;
      qualifies = true;
    } else {
      diff = Math.abs(ride.duration - parsed.duration) / ride.duration;
      qualifies = diff <= 0.25;
    }
    if (qualifies && diff <= bestDiff) {
      best = ride;
      bestDiff = diff;
    }
  }
  return best;
};
