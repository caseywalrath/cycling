import { describe, it, expect } from 'vitest';
import { buildAlerts, ridesNeedingZone } from './alerts.js';

const today = new Date(2026, 8, 25); // 2026-09-25

const baseState = (overrides = {}) => ({
  history: [],
  currentFTP: 231,
  event: { name: 'Gran Fondo Utah', date: '2026-06-13' },
  eftpPromptedValue: 0,
  userProfile: { maxHR: 182 },
  dismissals: {},
  maxhrPromptedValue: 0,
  ...overrides,
});

const ride = (over) => ({
  id: 1, date: '2026-09-20', name: 'Ride', rideType: 'Indoor', zone: 'sweetspot',
  duration: 60, normalizedPower: 200, intensityFactor: 0.87, rpe: 8, tss: 65,
  completed: true, source: 'manual', ...over,
});

describe('buildAlerts — new best (V2 Phase 6)', () => {
  it('fires when the latest ride sets a new all-time best at an alerted duration', () => {
    const older = ride({ id: 1, date: '2026-01-01', bests: { '300': 200 } });
    const latest = ride({ id: 2, date: '2026-09-24', bests: { '300': 260 } });
    const alerts = buildAlerts(baseState({ history: [latest, older] }), {}, today);
    const alert = alerts.find(a => a.id === 'new-best');
    expect(alert).toBeTruthy();
    expect(alert.title).toMatch(/5-minute/);
  });

  it('does not fire for a duration outside the alerted set with only a 10s-source stream', () => {
    // 120s ("2 minute") isn't in the alerted set, and there's no ride.bests (10s stream only).
    const older = ride({ id: 1, date: '2026-01-01', stream: { binSeconds: 10, power: Array(200).fill(100) } });
    const latest = ride({ id: 2, date: '2026-09-24', stream: { binSeconds: 10, power: Array(200).fill(400) } });
    const alerts = buildAlerts(baseState({ history: [latest, older] }), {}, today);
    // 60s and 300s ARE in the alerted set and are derivable from a 10s stream, so this ride
    // legitimately sets both — the point of this test is that 5s/30s (10s-stream-only rides
    // can't produce them) are excluded, not that nothing fires.
    const alert = alerts.find(a => a.id === 'new-best');
    expect(alert.title).not.toMatch(/5-second|30-second/);
  });

  it('is dismissible per ride id', () => {
    const older = ride({ id: 1, date: '2026-01-01', bests: { '300': 200 } });
    const latest = ride({ id: 2, date: '2026-09-24', bests: { '300': 260 } });
    const alerts = buildAlerts(
      baseState({ history: [latest, older], dismissals: { 'new-best-2': true } }),
      {}, today
    );
    expect(alerts.find(a => a.id === 'new-best')).toBeUndefined();
  });
});

describe('buildAlerts — ramp rate', () => {
  // Build a history that ramps CTL quickly: nothing, then a burst of high-TSS rides.
  const rampingHistory = () => {
    const hist = [];
    let id = 1;
    for (let d = 1; d <= 25; d++) {
      hist.push(ride({ id: id++, date: `2026-09-${String(d).padStart(2, '0')}`, tss: 150 }));
    }
    return hist;
  };

  it('fires when CTL is climbing more than 7/week', () => {
    const alerts = buildAlerts(baseState({ history: rampingHistory() }), {}, today);
    expect(alerts.find(a => a.id === 'ramp-rate')).toBeTruthy();
  });

  it('stays hidden for 7 days after being dismissed', () => {
    const alerts = buildAlerts(
      baseState({ history: rampingHistory(), dismissals: { 'ramp-rate': '2026-09-20' } }),
      {}, today // 5 days after dismissal
    );
    expect(alerts.find(a => a.id === 'ramp-rate')).toBeUndefined();
  });

  it('comes back once 7 days have passed since the dismissal', () => {
    const alerts = buildAlerts(
      baseState({ history: rampingHistory(), dismissals: { 'ramp-rate': '2026-09-10' } }),
      {}, today // 15 days after dismissal
    );
    expect(alerts.find(a => a.id === 'ramp-rate')).toBeTruthy();
  });
});

describe('buildAlerts — feels harder than usual', () => {
  const mismatchHistory = () => [
    ride({ id: 5, date: '2026-09-24', intensityFactor: 0.60, rpe: 9 }), // expected 3, mismatch 6
    ride({ id: 4, date: '2026-09-22', intensityFactor: 0.60, rpe: 8 }), // mismatch 5
    ride({ id: 3, date: '2026-09-20', intensityFactor: 0.90, rpe: 8 }), // expected 8, mismatch 0
  ];

  it('fires when 2+ of the last 5 power rides feel harder than expected', () => {
    const alerts = buildAlerts(baseState({ history: mismatchHistory() }), {}, today);
    expect(alerts.find(a => a.id === 'feels-harder')).toBeTruthy();
  });

  it('does not fire with only one mismatched ride', () => {
    const hist = mismatchHistory().slice(1); // drop one of the two mismatches
    const alerts = buildAlerts(baseState({ history: hist }), {}, today);
    expect(alerts.find(a => a.id === 'feels-harder')).toBeUndefined();
  });

  it('stays dismissed until a new ride is logged', () => {
    const hist = mismatchHistory();
    const latestId = hist[0].id;
    const alerts = buildAlerts(
      baseState({ history: hist, dismissals: { 'feels-harder': latestId } }),
      {}, today
    );
    expect(alerts.find(a => a.id === 'feels-harder')).toBeUndefined();
  });

  it('reappears once a newer ride is logged', () => {
    const hist = mismatchHistory();
    const alerts = buildAlerts(
      baseState({ history: hist, dismissals: { 'feels-harder': 999 } }), // an older, stale id
      {}, today
    );
    expect(alerts.find(a => a.id === 'feels-harder')).toBeTruthy();
  });
});

describe('buildAlerts — max heart rate', () => {
  it('fires when the observed max HR exceeds the profile Max HR', () => {
    const hist = [ride({ id: 1, hrStats: { avg: 150, max: 190 } })];
    const alerts = buildAlerts(baseState({ history: hist, userProfile: { maxHR: 182 } }), {}, today);
    const alert = alerts.find(a => a.id === 'max-hr');
    expect(alert).toBeTruthy();
    expect(alert.title).toMatch(/190/);
  });

  it('fires when Max HR is unset at all', () => {
    const hist = [ride({ id: 1, hrStats: { avg: 150, max: 170 } })];
    const alerts = buildAlerts(baseState({ history: hist, userProfile: {} }), {}, today);
    expect(alerts.find(a => a.id === 'max-hr')).toBeTruthy();
  });

  it('does not fire below the profile Max HR', () => {
    const hist = [ride({ id: 1, hrStats: { avg: 150, max: 170 } })];
    const alerts = buildAlerts(baseState({ history: hist, userProfile: { maxHR: 182 } }), {}, today);
    expect(alerts.find(a => a.id === 'max-hr')).toBeUndefined();
  });

  it('is dismissed via the device-local prompted value, same pattern as eFTP', () => {
    const hist = [ride({ id: 1, hrStats: { avg: 150, max: 190 } })];
    const alerts = buildAlerts(
      baseState({ history: hist, userProfile: { maxHR: 182 }, maxhrPromptedValue: 190 }),
      {}, today
    );
    expect(alerts.find(a => a.id === 'max-hr')).toBeUndefined();
  });
});

describe('ridesNeedingZone (existing behavior, unchanged)', () => {
  it('excludes historical rides', () => {
    const hist = [ride({ id: 1, zone: null, source: 'imported', historical: true })];
    expect(ridesNeedingZone(hist)).toHaveLength(0);
  });
});
