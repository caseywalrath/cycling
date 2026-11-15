# Plan: Time-in-zone bars on ride cards (Session 30)

For an implementing agent. Every file path and line number below was checked against the code on
branch `claude/youthful-ramanujan-2bm4qc`. If a line number has drifted, find the quoted code.
Don't guess. **Don't change anything this plan doesn't list.**

## Goal

1. Every ride in the Rides list (`src/components/RideRow.jsx`) and the Today "Latest ride" card
   (`src/screens/TodayScreen.jsx`) shows a thin horizontal bar. It is split into zone colours, in
   proportion to the time spent in each power zone.
2. Both get a four-number stat row with small labels (Time · NP or Distance · Avg HR · TSS) in
   place of the current one-line "1h 0m · TSS 46".
3. The zone name shows as a coloured outlined pill on each list row. Today already shows it.
4. The existing month headings in the Rides list (they already exist, at
   `src/screens/RidesScreen.jsx:112-114`) get that month's total time and TSS on the right.

Out of scope: weekly-hours bars at the top of Rides, time of day, source icons, any change to
how zones/TSS are calculated, any change to saved data.

## Facts from the code (rely on these)

- `timeInZones(ride, ftp)` — `src/lib/analysis.js:31-41`. Returns `{ zoneId: seconds }` for all 7
  zones, or `null` when the ride has no `stream`, no `stream.power` (heart-rate-only rides), or no ftp.
- `ZONES` — `src/lib/zones.js:1-9`, in order recovery → anaerobic, each `{ id, name, color }`.
- `ftpOn(date)` is on the app context: `useAppData()` returns it (`src/state/AppDataContext.jsx:423`,
  exported at line 1212). The Ride page uses it at `src/screens/WorkoutDetailPage.jsx:91-93`:
  ```js
  const rideFtp = ftpOn(detailRide.date);
  const zoneTotals = rideFtp ? timeInZones(detailRide, rideFtp) : null;
  const totalZoneSeconds = zoneTotals ? Object.values(zoneTotals).reduce((a, b) => a + b, 0) : 0;
  ```
- The Ride page draws its bar inline at `src/screens/WorkoutDetailPage.jsx:367-373`.
- The Ride page works out Avg HR inline at `src/screens/WorkoutDetailPage.jsx:68-72`.
- Ride fields: `duration` (minutes), `normalizedPower`, `tss`, `distance` (mi), `elevation` (ft),
  `rideType` ('Outdoor' or indoor), `zone` (null for outdoor and for indoor rides needing one),
  `intervalData?.label`, `stream: { binSeconds, power | null, hr }` (optional).
- Formatters: `formatMinutes`, `shortDayDate` in `src/lib/format.js`.
- **Name clash warning:** `src/components/ZoneBar.jsx` already exists. It is the *progression
  level* bar on the Progress tab. Don't edit it, and don't call the new component `ZoneBar`.
- `rideEdgeColor` (exported from `RideRow.jsx`) is used nowhere else in `src/` or `tools/`.
- `RideRow` keeps its `data-ride-card` attribute (tools may select it).

## Step 1: Shared helpers in `src/lib/analysis.js`

Add, after `timeInZones` (after line 41):

```js
// Average heart rate over a ride's stream, ignoring dropouts. Null when there's no HR.
export const avgHrFromStream = (ride) => {
  const hr = ride?.stream?.hr;
  if (!hr || !hr.length) return null;
  const vals = hr.filter(v => v != null);
  return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
};
```

In `src/screens/WorkoutDetailPage.jsx`, replace lines 68-72 (`const avgHr = detailRide.stream?.hr?.length ? ... : null;`)
with `const avgHr = avgHrFromStream(detailRide);`, and add `avgHrFromStream` to the existing
import from `'../lib/analysis.js'` on line 5. The result must be identical.

Tests in `src/lib/analysis.test.js`: add `avgHrFromStream` to the import on line 2 and a
`describe('avgHrFromStream')` block with these cases: no stream → null; `hr` all null → null;
`[100, null, 110]` → 105; `[100, 101]` → 101 (rounds 100.5 up).

## Step 2: New component `src/components/ZoneMixBar.jsx`

```jsx
import React from 'react';
import { ZONES } from '../lib/zones.js';
import { formatMinutes } from '../lib/format.js';

// ZoneMixBar — one horizontal bar split into zone colours by time in each zone (from
// timeInZones). Renders nothing when there's no data. Used by the Ride page, RideRow and
// Today's Latest ride. Not to be confused with ZoneBar.jsx (progression levels).
export default function ZoneMixBar({ zoneTotals, className = 'h-1.5' }) {
  if (!zoneTotals) return null;
  const total = Object.values(zoneTotals).reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const parts = ZONES.filter(z => (zoneTotals[z.id] || 0) > 0);
  const label = 'Time in zones: ' + parts.map(z => `${z.name} ${formatMinutes(zoneTotals[z.id] / 60)}`).join(', ');
  return (
    <div role="img" aria-label={label} data-zone-mix-bar className={`flex w-full gap-px rounded-full overflow-hidden ${className}`}>
      {parts.map(z => (
        <div key={z.id} data-zone={z.id} style={{ width: `${(zoneTotals[z.id] / total) * 100}%`, backgroundColor: z.color }} />
      ))}
    </div>
  );
}
```

Use it on the Ride page: in `src/screens/WorkoutDetailPage.jsx`, replace the inline bar at lines 367-373
(the `<div className="flex w-full h-3 rounded-full overflow-hidden">…</div>`) with
`<ZoneMixBar zoneTotals={zoneTotals} className="h-3" />` and import it. Leave the card, the
heading, the FTP note and the legend below it (lines 374-386) unchanged. (`gap-px` adds a 1px gap
between colours, which is the only visual change on the Ride page.)

## Step 3: A hook so each card gets its zones cheaply

Add to `src/components/ZoneMixBar.jsx`:

```jsx
import { useMemo } from 'react';            // merge into the React import
import { timeInZones } from '../lib/analysis.js';
import { useAppData } from '../state/AppDataContext.jsx';

// Zones for one ride against the FTP on that ride's date (same rule as the Ride page).
export function useRideZoneTotals(ride) {
  const { ftpOn } = useAppData();
  const ftp = ride ? ftpOn(ride.date) : null;
  return useMemo(() => (ride && ftp ? timeInZones(ride, ftp) : null), [ride, ftp]);
}
```

`ftpOn` is a new function on every render, so it must **not** go in the `useMemo` dependencies.
Depend on `ride` and the number `ftp` only, as written.

## Step 4: Shared stat row: `RideStats` in `src/components/RideRow.jsx`

Export a small component from `RideRow.jsx` (Today imports it too):

```jsx
// Time · NP (indoor) or Distance (outdoor) · Avg HR · TSS, each a value over a small label.
export function RideStats({ ride }) {
  const isOutdoor = ride.rideType === 'Outdoor';
  const hr = avgHrFromStream(ride);
  const cells = [
    ['Time', formatMinutes(ride.duration), null],
    isOutdoor
      ? ['Distance', ride.distance > 0 ? ride.distance : '—', ride.distance > 0 ? 'mi' : null]
      : ['NP', ride.normalizedPower || '—', ride.normalizedPower ? 'W' : null],
    ['Avg HR', hr ?? '—', null],
    ['TSS', ride.tss ?? '—', null],
  ];
  return (
    <div className="grid grid-cols-4 gap-2 mt-2" data-ride-stats>
      {cells.map(([label, value, unit]) => (
        <div key={label} className="min-w-0">
          <div className="text-base font-semibold tabular-nums truncate">
            {value}{unit && <span className="text-xs text-gray-400 font-normal ml-0.5">{unit}</span>}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
        </div>
      ))}
    </div>
  );
}
```

Imports needed in `RideRow.jsx`: `avgHrFromStream` from `'../lib/analysis.js'`.

## Step 5: Rework `RideRow` (`src/components/RideRow.jsx`)

The current component is lines 14-45. Replace it with this layout (keep the `<button>`, its
`data-ride-card`, its `onClick`, and its classes except as noted):

1. **Remove** the 4px left edge `<div className="w-1 …">` (line 33). The pill and bar now carry the
   colour. Keep `export const rideEdgeColor` (lines 9-12) as is: it's harmless and removing it is
   out of scope. Change the button's `flex items-stretch gap-3` to `block`, and give the inner
   content `px-4 py-3` (it was `py-3 pr-3`).
2. **Line 1:** name (`text-base font-medium truncate`, same text as now:
   `ride.name || ride.notes || 'Workout'`) on the left; a pill on the right:
   - Outdoor: text "Outdoor", colour `#14B8A6`
   - Indoor with zone: `getZoneName(ride.zone)`, colour `getZoneColor(ride.zone)`
   - Indoor without zone: text "Needs zone", colour `#EAB308`

   Pill classes: `shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border`, with
   `style={{ color: c, borderColor: c + '99' }}` (outlined, no fill: matches the screenshot).
   Add `data-ride-pill`.
3. **Line 2** (`text-sm mt-0.5`, flex justify-between): `shortDayDate(ride.date)` in grey on the
   left. On the right, the interval label (`font-mono text-yellow-400 truncate`) if
   `ride.intervalData?.label`, else for outdoor rides `${ride.elevation}ft climbing` when
   `elevation > 0`, else nothing. Drop the old "Needs a zone" and zone-name fallbacks, because the pill shows those now.
4. `<RideStats ride={ride} />`
5. `const zoneTotals = useRideZoneTotals(ride);` at the top of the component, and at the bottom
   `<ZoneMixBar zoneTotals={zoneTotals} className="h-1.5 mt-3" />`. Rides without power data
   simply show no bar. **Don't** draw a placeholder bar.

Update the file's header comment (lines 6-8) to describe the new layout.

## Step 6: Today → Latest ride (`src/screens/TodayScreen.jsx:224-249`)

- Keep the card, the "Latest ride" heading row, and the name + pill row (lines 225-242) unchanged.
- Replace the grey line at lines 243-245 (`{shortDayDate(latest.date)} · {formatMinutes(latest.duration)} · TSS …`)
  with `<div className="text-sm text-gray-400 mt-0.5">{shortDayDate(latest.date)}</div>`.
- Keep the interval label block (lines 246-248).
- After it add `<RideStats ride={latest} />` and `<ZoneMixBar zoneTotals={latestZones} className="h-1.5 mt-3" />`.
- Hooks must not be conditional: next to `const latest = useMemo(...)` (line 91) add
  `const latestZones = useRideZoneTotals(latest);` (the hook handles `latest == null`).
- Imports: `RideStats` from `'../components/RideRow.jsx'`; `ZoneMixBar, { useRideZoneTotals }`
  from `'../components/ZoneMixBar.jsx'`. If `formatMinutes` is then unused in this file, remove
  it from the import on line 5 (check with grep first; lint runs with `--max-warnings 0`).
- Card tap behaviour (`openLatest`, lines 122-126) is unchanged.

## Step 7: Month heading totals (`src/screens/RidesScreen.jsx:112-114`)

Change the heading `<div>` to `flex items-baseline justify-between`, keep `monthLabel(key)` on the
left, and add on the right:

```jsx
<span className="text-xs font-normal tabular-nums" data-month-total>
  {formatMinutes(rides.reduce((s, r) => s + (r.duration || 0), 0))} · TSS {Math.round(rides.reduce((s, r) => s + (r.tss || 0), 0))}
</span>
```

This totals the rides shown under that heading, so it follows the active filter and search, which is
intended. Import `formatMinutes` from `'../lib/format.js'`.

## Step 8: Checks (all must be done, and reported honestly)

Setup: `npm install` (there is no `node_modules` yet). Chromium is at `/opt/pw-browsers/chromium`.
The tools' default `PW_CHROME` path doesn't exist in this container, so prefix tool runs with
`PW_CHROME=/opt/pw-browsers/chromium`. Start the dev server in the background: `npx vite --port 3000`.

1. `npm test`: all pass (previous count 173, plus the new `avgHrFromStream` tests).
2. `npm run lint`: no warnings.
3. `npm run build`: succeeds.
4. Existing tools: `tools/v2-check.mjs`, `tools/ftp-history-check.mjs`, `tools/ride-chart-check.mjs`,
   `tools/rpe-check.mjs`. Report each result. `v2-check` may show differences on the Today/Rides
   text. List each difference and explain it. **Don't run `--write-baseline`.** The reviewer decides.
5. New `tools/ride-list-check.mjs`, modelled on `tools/ride-chart-check.mjs` (same seed shape and
   localStorage key `cycling-progression-data-v2`, viewport 390×844, PASS/FAIL lines, exit 1 on
   any FAIL, screenshots to `tools/.out`). Seed: an indoor sweet-spot ride with a power+HR stream,
   an outdoor ride with a power stream, an indoor ride with `stream: { binSeconds: 10, power: null, hr: [...] }`,
   and a manual ride with no stream. Check:
   - On `#/rides`, the stream rides have a `[data-zone-mix-bar]`, and the HR-only and manual rides don't.
   - The segment widths of the sweet-spot ride's bar match `timeInZones` proportions (within 1%).
   - Pills read "Sweet Spot" / "Outdoor" / "Needs zone" as seeded.
   - `[data-ride-stats]` shows NP for indoor, Distance for outdoor, Avg HR "—" for the manual ride.
   - `[data-month-total]` equals the summed duration and TSS of that month's seeded rides.
   - Today's Latest ride card contains a `[data-zone-mix-bar]` when the latest ride has power.
   - No horizontal scroll on `#/rides` or `#/today` (`scrollWidth <= clientWidth`).
   - No page errors.
   Look at the screenshots yourself and describe them in the report.

## Step 9: Docs and commit

- `ARCHITECTURE.md`: update the Today "Latest ride" item (around line 305), the Rides "Ride list"
  item (around lines 324-326, and mention month totals), the Ride page "time in zones" note
  (around line 415, which now uses `ZoneMixBar`), and add `ZoneMixBar.jsx` to the file tree next to
  `RideRow.jsx` (around line 58), with the "not ZoneBar" note.
- `CHANGELOG.md`: add a "Session 30 - Zone Bars on Ride Cards" entry at the top, in the same
  style as Session 29: "What you'll see on your iPhone", "Not changed", "Under the hood",
  "Checks" (real numbers), and "Anything skipped?". Use plain language, because the user is not a coder.
- Commit with conventional messages (`feat:`, `test:`, `docs:`) on `claude/youthful-ramanujan-2bm4qc`
  and push with `git push -u origin claude/youthful-ramanujan-2bm4qc`. Don't merge, don't open a PR.
- Delete this plan file in the docs commit, or leave it for the reviewer to delete. Say which one you did.

## For the reviewer

Check against this plan and the real code:
- `useRideZoneTotals` dependencies (no `ftpOn` in deps, no conditional hook in Today).
- The Ride page bar and Avg HR are unchanged in value.
- Heart-rate-only and manual rides show no bar and don't crash.
- Lint is clean, all tests and tools pass, and every v2-check difference is explained.
- Tap targets stay ≥44px, and there is no horizontal scroll at 390px.
