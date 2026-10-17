import { describe, it, expect } from 'vitest';
import { buildAnalysisText } from './summary.js';
import { getZoneName, zoneForRatio, zoneWattRange } from './zones.js';

// Made-up rides that mirror the situations the export has to get right: a skipped week, a
// partial current week, an FTP change between two rides, and a ride whose averaged blocks sit
// below its zone (a 30/30 session). Saturday 2026-10-17.
const NOW = new Date(2026, 9, 17, 12, 0, 0);
const FTP = 225;
const LOADS = { ctl: 19, atl: 6, tsb: 13, weeklyTSS: 56, twoWeekTSS: 114, ctl14dAgo: 30 };

const seg = (startSec, minutes, avgWatts) => ({ startSec, endSec: startSec + minutes * 60, avgWatts });

const vo2Session = {
  id: 1, date: '2026-10-13', name: 'Short VO2 intervals', rideType: 'Indoor', zone: 'vo2max',
  duration: 60, normalizedPower: 173, intensityFactor: 0.77, tss: 56, rpe: 7, completed: true,
  hrStats: { avg: 107, max: 128 },
  intervalData: { category: 'threshold', label: '3x8.5 @ 193W', segments: [seg(600, 8.5, 193), seg(1800, 8.5, 193), seg(3000, 8.5, 193)] },
  stream: { binSeconds: 10, power: [...Array(330).fill(190), ...Array(30).fill(50)], hr: null },
};

const sweetSpotSession = {
  id: 2, date: '2026-10-08', name: 'Sweet Spot-ish', rideType: 'Indoor', zone: 'sweetspot',
  duration: 60, normalizedPower: 176, intensityFactor: 0.7333, tss: 54, rpe: 7, completed: true,
  intervalData: { category: 'sweetspot', label: '2x10 @ 196W', segments: [seg(600, 10, 196), seg(1500, 10, 196)] },
};

const easySession = {
  id: 3, date: '2026-09-24', name: 'Z2', rideType: 'Indoor', zone: 'endurance',
  duration: 45, normalizedPower: 120, intensityFactor: 0.53, tss: 21, rpe: 3, completed: true,
  intervalData: null,
};

const oldEndurance = {
  id: 4, date: '2026-06-30', name: 'Long Z2', rideType: 'Indoor', zone: 'endurance',
  duration: 120, normalizedPower: 150, intensityFactor: 0.67, tss: 90, rpe: 4, completed: true,
  intervalData: { category: 'endurance', label: '', segments: [] },
};

const outdoor = {
  id: 5, date: '2026-09-17', name: 'Suncrest', rideType: 'Outdoor', zone: null,
  duration: 92, normalizedPower: 192, intensityFactor: 0.85, tss: 106, rpe: 7, distance: 12, elevation: 900,
  intervalData: null,
};

const HISTORY = [vo2Session, sweetSpotSession, easySession, outdoor, oldEndurance];
const BESTS = { last90Days: { 60: { watts: 338, rideName: 'x', date: '2026-09-17' }, 300: { watts: 248, rideName: 'x', date: '2026-09-17' }, 1200: { watts: 226, rideName: 'Suncrest', date: '2026-09-17' } } };

const build = (overrides = {}) => buildAnalysisText({
  history: HISTORY, currentFTP: FTP, currentEftp: { value: 215 }, event: { name: 'Gran Fondo', date: '2026-06-13' },
  loads: LOADS, rampRate: -4.4, bestCurves: BESTS, userProfile: { lthr: 140, maxHR: null, weight: null }, now: NOW, ...overrides,
});

describe('buildAnalysisText', () => {
  it('lists every calendar week, including empty ones, and marks the current week partial', () => {
    const text = build();
    expect(text).toContain('- Sep 28: 0.0h, 0 TSS (0 rides)');
    expect(text).toContain('- Oct 12 (partial, Mon-Sat): 1.0h, 56 TSS (1 ride)');
    expect(text.match(/^- (Sep|Oct) \d+/gm)).toHaveLength(6);
  });

  it('says how long since the last ride and the last hard ride', () => {
    const text = build();
    expect(text).toContain('Last ride: 4 days ago (Oct 13)');
    expect(text).toMatch(/Last hard ride[^:]*: 4 days ago/);
  });

  it('counts a ride at IF 0.85 or more as hard even without a zone', () => {
    const text = build({ history: [outdoor] });
    expect(text).toMatch(/Last hard ride[^:]*: 30 days ago/);
  });

  it('words eFTP as a floor derived from the best 20 minutes', () => {
    const text = build();
    expect(text).toContain('eFTP 215W (95% of best 20-min 226W in 90d; a floor, not a max-effort test)');
  });

  it('prints n/a instead of dropping lines it cannot fill', () => {
    const text = build({ userProfile: {}, bestCurves: null, currentEftp: null });
    expect(text).toContain('**HR drift (30d):** n/a');
    expect(text).toContain('LTHR n/a | Max HR n/a | Weight n/a');
    expect(text).toContain('eFTP n/a');
    expect(text).toContain('**Bests (90d):** n/a');
  });

  it('prints the zone table in watts from the zone bounds', () => {
    const text = build();
    const { min, max } = zoneWattRange('sweetspot', FTP);
    expect(text).toContain(`- Sweet Spot: `);
    expect(text).toContain(`(${min}-${max}W) [top of Z3 and start of Z4]`);
    expect(text).toContain('- Threshold: 95-106% (');
    expect(text).toContain('TrainerDay has no sweet-spot level');
  });

  it('shows days since each zone was last trained', () => {
    const text = build();
    expect(text).toContain('Sweet Spot 9');
    expect(text).toContain('VO2max 4');
    expect(text).toContain('Tempo never');
  });

  it('shows name, IF, average HR and the FTP a ride was scored at', () => {
    const text = build();
    expect(text).toContain('Indoor "Short VO2 intervals"');
    expect(text).toContain('IF 0.77');
    expect(text).toContain('avg HR 107');
    expect(text).toContain('IF 0.73 (scored at FTP 240W)');
    expect(text).not.toContain('900ft');
  });

  it('describes in-zone reps at %FTP, and leaves out a ride whose blocks are below its zone', () => {
    const text = build();
    expect(text).toContain('Main set: 2 reps (10, 10 min) @ 87% (196W avg), 20 min in zone');
    // The VO2max-labelled ride averages 86% FTP, below that zone's floor: no main set line.
    const vo2Line = text.split('\n').findIndex(l => l.includes('Short VO2 intervals'));
    expect(text.split('\n')[vo2Line + 1]).not.toContain('Main set');
  });

  it('says "none in 90 days" for a zone with no recent session, with the last date', () => {
    const text = build();
    expect(text).toContain('- Endurance: none in 90 days (last Jun 30)');
    expect(text).toContain('- Anaerobic: none in 90 days');
  });

  it('keeps recovery out of the time-in-zone shares', () => {
    const text = build();
    const zone = getZoneName(zoneForRatio(190 / FTP));
    expect(text).toContain(`${zone} 55 min (100%)`);
    expect(text).toContain('Recovery/coasting, not counted: 5 min');
  });

  describe('with an FTP history', () => {
    const FTP_HISTORY = [
      { date: '2025-12-26', ftp: 230 },
      { date: '2026-07-01', ftp: 240 },
      { date: '2026-10-13', ftp: 225 },
    ];
    // The Oct 8 ride was logged after FTP dropped to 225, so its stored IF is NP / 225.
    const loggedLate = { ...sweetSpotSession, intensityFactor: 176 / 225 };
    const withHistory = (history = [vo2Session, loggedLate, easySession]) => build({ history, ftpHistory: FTP_HISTORY });

    it('lists the FTP history in the athlete section', () => {
      expect(withHistory()).toContain('- FTP history: 230W from 2025-12-26 → 240W from 2026-07-01 → 225W from 2026-10-13.');
      expect(build()).not.toContain('FTP history');
    });

    it("shows IF at the ride's own FTP, not the FTP it was logged at", () => {
      const text = withHistory();
      expect(text).toContain('IF 0.73 (FTP then 240W)'); // 176 / 240, not the stored 0.78
      expect(text).not.toContain('IF 0.78');
      // A ride on or after the latest change needs no note.
      expect(text).toMatch(/Short VO2 intervals", VO2max, 60min, NP 173W, IF 0\.77, TSS/);
    });

    it('re-checks in-zone work at the ride\'s own FTP: 196W was tempo-level at 240W, so no main set', () => {
      const text = withHistory();
      expect(text).not.toContain('Main set: 2 reps (10, 10 min) @ 87%');
      expect(text).toContain('- Sweet Spot: Oct 8 none in zone (ride was 2x10 @ 196W)');
    });

    it('names the FTP a main set is a percentage of when it is not the current FTP', () => {
      const hard = { ...sweetSpotSession, intensityFactor: 176 / 225, intervalData: { category: 'sweetspot', label: '2x10 @ 212W', segments: [seg(600, 10, 212), seg(1500, 10, 212)] } };
      const text = withHistory([hard]);
      expect(text).toContain('Main set: 2 reps (10, 10 min) @ 88% of 240W FTP (212W avg), 20 min in zone');
    });

    it('does not change anything for a ride on today\'s FTP', () => {
      const text = withHistory([vo2Session]);
      expect(text).not.toContain('FTP then');
      expect(text).not.toContain('of 225W FTP');
    });
  });

  it('omits an event that has already happened', () => {
    expect(build()).not.toContain('Next event');
    expect(build({ event: { name: 'Fondo', date: '2026-10-20' } })).toContain('Next event: Fondo, 3 days away');
  });

  it('works with no rides at all', () => {
    const text = build({ history: [], loads: { ctl: 0, atl: 0, tsb: 0, weeklyTSS: 0, twoWeekTSS: 0, ctl14dAgo: 0 }, rampRate: null, currentEftp: null, bestCurves: null });
    expect(text).toContain('Last ride: none on record');
    expect(text).toContain('- none');
    expect(text).toContain('- Sep 28: 0.0h, 0 TSS (0 rides)');
  });
});
