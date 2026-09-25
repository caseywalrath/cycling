# Implementation Plan: Estimate eFTP From the App's Own Ride Data

**Status:** Planned, not yet built
**Designed:** 2026-09-25 (session on branch `claude/eftp-metric-analysis-9qd058`)
**Written against:** `src/App.jsx` at commit `ac69866`. Line numbers are approximate. Always
find code by the quoted search strings, not by line number.

Read `CLAUDE.md`, `ARCHITECTURE.md` and `CHANGELOG.md` first. The user is a beginner, so the
final chat summary must be in plain language and must end with the `git pull` instructions
from `CLAUDE.md`.

---

## 1. Goal

Today "eFTP" is a number stored on each ride (`ride.eFTP`). It came from intervals.icu (the
API sync, which can no longer be reached, or the "Paste CSV" import). The app shows the most
recent stored value. Nothing new feeds it any more, so it is frozen. It also copies itself
forward, and it causes a popup that nags on every app launch.

Replace it with an eFTP that the app **calculates from the power data it already stores**
from FIT imports (`ride.stream`). No intervals.icu dependency.

User-facing results:
1. Header shows a live eFTP calculated from recent rides (or nothing if there's no recent
   qualifying ride).
2. The **eFTP Progress chart keeps working** and shows calculated values from the FIT era
   onward. Older months keep their imported intervals.icu values. The user has said values
   may change; the chart must not break or go blank.
3. The FTP popup appears **only once per new, higher estimate**. It never appears again after
   Cancel and never appears on a plain app launch.
4. The manual eFTP input field goes away (it caused the copying-forward bug).

## 2. Hard constraints

- Single-file app: all code goes in `src/App.jsx`. Pure helpers go at module level, near
  `detectIntervals()`; state and effects go inside `ProgressionTracker`.
- No new npm dependencies. The chart stays Recharts.
- **Never delete or rewrite existing `ride.eFTP` values.** They are the chart's history for
  months before FIT imports existed. There is no data migration.
- Do not change the `STORAGE_KEY` save/load shape, export/import, or the Google Drive sync
  payload. The only new stored value is a device-local key (§6).
- Do not touch the VO2max analyzer (`intervalsConfig`, the "analyze" fetch around line 1222–1260).
- Commit messages use conventional commits. Update `ARCHITECTURE.md` and `CHANGELOG.md`
  (new "Session 20" entry at the top).

## 3. The estimation model

### 3.1 Per-ride estimate

A ride has an estimate only if it has `ride.stream` with at least 20 minutes of bins.

```
best20 = best average power over any 20-minute window of the stream
best60 = best average power over any 60-minute window (null if the ride is shorter)
rideEstimate = round( max(0.95 × best20, best60 ?? 0) )
```

- The stream comes from `downsampleRecords()` and looks like `{ binSeconds: 10, power: [..], hr: [..] }`.
  `power[i]` can be `null` when there are no samples in that bin (pauses or dropouts).
  **Treat `null` as 0.** This is conservative: a gap can only lower the estimate, never raise it.
- Window size in bins = `Math.round(seconds / stream.binSeconds)`. Do not hard-code 10.
- Use a single-pass sliding-window sum (O(n)), the same style as `calculateNormalizedPower()`.
- Indoor and outdoor rides both count. A hard 20-minute outdoor climb is a legitimate effort.

Constants at module level:
```js
const EFTP_WINDOW_DAYS = 90;      // rolling look-back for the current estimate
const EFTP_20MIN_FACTOR = 0.95;   // classic 20-minute test conversion
const EFTP_PROMPT_MARGIN = 10;    // watts above FTP before offering an update
const EFTP_PROMPT_KEY = 'eftp-prompted-value'; // device-local localStorage key
```

### 3.2 Rolling eFTP at a date

`eFTP(D)` = the highest `rideEstimate` among rides dated in `(D − 90 days, D]`, or `null` if
there are none. Record which ride set the peak (its name and date) for tooltips.

This works like intervals.icu's eFTP: the estimate rises with new best efforts and
falls away if no hard effort happens for 90 days.

### 3.3 New helpers (module level, pure, no React)

```js
bestAveragePower(stream, seconds)      // → watts (number) or null if stream too short
estimateRideFtp(ride)                  // → watts or null (§3.1)
buildEftpTimeline(history, today)      // → see below
```

`buildEftpTimeline` returns:
```js
{
  byRideId: { [rideId]: { rideEstimate, eftp, peakRideName, peakRideDate } },
  // rideEstimate: this ride's own estimate (null if no stream)
  // eftp: rolling eFTP evaluated at this ride's date (null if none in window)
  current: { value, peakRideName, peakRideDate } | null,   // rolling eFTP at `today`
  firstStreamDate: 'YYYY-MM-DD' | null,  // earliest ride date that has a rideEstimate
}
```
Use `parseDateLocal()` for all date math (the app has timezone fixes that depend on it).
Sort a copy of history by date, and never mutate `history`.

Inside the component:
```js
const eftpTimeline = useMemo(() => buildEftpTimeline(history, new Date()), [history]);
const currentEftp = eftpTimeline.current; // may be null
```

## 4. eFTP Progress chart (the part that must not break)

### 4.1 How it works today

`calculateEFTPHistory(history)` (around line 1020) takes rides from the last 11 months that
have `w.eFTP`, takes the **highest value per calendar month**, and returns
`[{ monthKey, month, label, eFTP, rideName }]`. The chart (search `{/* eFTP Chart */}`) is an
`AreaChart` with `dataKey="eFTP"`, x-axis `month`, and `EFTPTooltip`, which reads `label`,
`eFTP` and `rideName`. "Latest" in the chart header is the last month's value. There's an
empty state when the array is empty. `hasData` (search `const hasData =`) also depends on
the array's length.

### 4.2 Change

Change `calculateEFTPHistory` to `calculateEFTPHistory(history, eftpTimeline)`. Keep the same
output fields and add two:

```js
{ monthKey, month, label, eFTP, rideName, source /* 'estimated' | 'imported' */, peakDate }
```

For each ride in the 11-month window, work out its value:
1. **Estimated:** `eftpTimeline.byRideId[id].eftp` if it's not null. `rideName`/`peakDate`
   come from the peak ride, not the ride being evaluated.
2. **Imported (legacy):** otherwise `ride.eFTP`, **only if** `firstStreamDate` is null or
   `ride.date < firstStreamDate`. Once FIT-based data exists, stored `eFTP` values on later
   rides are ignored. Those are almost all copied-forward values from the old form
   default (the 243W problem), and counting them would draw a false flat line.

Per month: **if the month has any estimated value, use the highest estimated value and ignore
imported values in that month.** Otherwise use the highest imported value. This gives a clean
handover: older months come from intervals.icu and FIT-era months are calculated.

Keep `dataKey="eFTP"`, the x-axis, the y-axis `domain={['dataMin - 10', 'dataMax + 10']}` and the
gradient unchanged. That way the chart can't break structurally.

### 4.3 Chart display changes

- **Dots:** estimated months keep the solid purple dot. Imported months get a hollow dot
  (fill `#1F2937`, stroke `#A855F7`). Use a `dot` render function that reads `props.payload.source`.
  In Recharts 3 the function **must return an SVG element with a `key`** (use `props.index`) and
  must return an element (not `null`) for every point. Keep `activeDot` as is.
- **Tooltip:** add a line under the watts:
  - estimated → `Best 20-min effort: {rideName} ({short date of peakDate})`
  - imported → `Imported from intervals.icu`
- **"Latest" label in the chart header:** show `currentEftp.value` so it matches the page
  header. If `currentEftp` is null, show `—` and keep the chart visible.
  (Today "Latest" is the last month's peak. Switching it avoids two different "current" numbers.)
- **Empty-state text** (search `No eFTP data available.`): change the hint to
  `Import a FIT file that includes a 20-minute or longer effort.`
- Check that `hasData` and the tab button still work with the new signature. Update every
  call site of `calculateEFTPHistory` (grep for it).

### 4.4 What the user will see

- Months before the first FIT-imported ride look the same as today (hollow dots).
- From the first FIT ride onward, points are recalculated. They may be **lower** than the old
  intervals.icu numbers if the rides were steady or below threshold (see §8), and they drop if
  no hard effort was ridden for 90 days. This is expected and the user has approved it.
- If a month in the FIT era has no FIT rides and the rolling window has expired, that month has
  no point. Recharts connects neighbouring points, the same way the chart handles months with no
  rides today.

## 5. Other places eFTP appears

Grep `eFTP` and `EFTP` in `src/App.jsx` and deal with every match. Expected list:

| Where (search string) | Change |
|---|---|
| `const getDefaultFormData` | Remove the `latestEFTP` lookup and the `eFTP:` field. **This fixes the copy-forward bug.** |
| `{/* Row 5: eFTP \| RPE Slider */}` | Remove the eFTP input. Row 5 becomes RPE only: drop `grid-cols-2`/`gap-4` so the slider is full width. Update the comment. |
| Edit-ride population (`eFTP: workout.eFTP \|\| ''`, around line 2182) | Remove the line. |
| Edit save (`eFTP: formData.eFTP ? parseInt(formData.eFTP) : null,` in the `...oldWorkout, ...formData` block) | **Remove the line.** This is required so `...oldWorkout` keeps any legacy `eFTP` on the ride. If it stays, every edit would erase the ride's legacy value. |
| New-ride save (the same `eFTP: formData.eFTP ...` line in the create branch, around line 1964) | Remove it. New rides have no `eFTP` field. |
| Page header (`// Get most recent eFTP from history`) | Show `currentEftp.value`. Add a `title` attribute: `Estimated from best 20-min power in the last 90 days ({peakRideName}, {date})`. Hide it if `currentEftp` is null. |
| Ride History row (`{/* Level changes and eFTP */}`) | If `byRideId[entry.id].rideEstimate` exists → `• FTP est. {x}W`. Otherwise, if `entry.eFTP` exists → `• eFTP {x}W` (legacy). Otherwise nothing. |
| `copyForAnalysis` (`const latestEFTP = history.find`) and its output line (`eFTP: ${latestEFTP}W`) | Use `currentEftp?.value` and label it `eFTP: {x}W (est. best 20-min, 90d)`. |
| FTP-vs-eFTP effect (`// Check FTP vs eFTP difference`) | Replace completely (§6). |
| CSV import (`h.toLowerCase() === 'eftp'`) | **Keep.** It still writes legacy `ride.eFTP`. That's harmless because of the rule in §4.2. |

## 6. The FTP update prompt

Replace the existing `useEffect` (search `// Check FTP vs eFTP difference and prompt user if > 10`):

```js
const [eftpPromptedValue, setEftpPromptedValue] = useState(() => {
  try { return parseInt(localStorage.getItem(EFTP_PROMPT_KEY), 10) || 0; } catch { return 0; }
});

useEffect(() => {
  const est = currentEftp?.value;
  if (!est) return;
  if (est < currentFTP + EFTP_PROMPT_MARGIN) return;   // only offer increases
  if (est <= eftpPromptedValue) return;                 // already asked about this (or higher)
  setEftpPromptedValue(est);
  try { localStorage.setItem(EFTP_PROMPT_KEY, String(est)); } catch { /* ignore */ }
  const shouldUpdate = window.confirm(
    `Your estimated FTP is ${est}W (best 20-min effort: ${currentEftp.peakRideName}, ` +
    `${currentEftp.peakRideDate}). That's ${est - currentFTP}W above your current FTP (${currentFTP}W).\n\n` +
    `Would you like to update your FTP in Profile settings?`
  );
  if (shouldUpdate) {
    setProfileModalOriginalFTP(currentFTP);
    setShowProfileModal(true);
  }
}, [currentEftp?.value]); // intentionally not currentFTP: changing FTP by hand must not trigger a prompt
```

Why it's built this way:
- The value is stored and read back **before** the confirm. So Cancel and OK both count as
  "asked", and a re-render during the dialog can't show it twice.
- The initial value is read synchronously in the `useState` initializer. So on an app launch it
  is already loaded when history arrives from localStorage, and an estimate that was already
  prompted stays quiet.
- Device-local on purpose (not in the `STORAGE_KEY` blob or Drive sync): at worst a second
  device prompts once. This avoids touching five save/load/export/sync code paths.
- Never prompts to *lower* FTP. A submaximal training block would otherwise nag the user
  to reduce FTP.
- If the file has an `eslint-disable-next-line react-hooks/exhaustive-deps` convention, follow
  it. Check that `npm run lint` produces no new warnings compared with the baseline (§9).

## 7. Optional cleanup of the dead intervals.icu sync (separate commit)

Do this after §3–§6 work, in its own `refactor:` commit so it can be reverted separately. Nothing
opens the sync window (`setShowIntervalsSyncModal(true)` is never called), so these
are unreachable:

- `syncFromIntervalsICU` and the `{/* intervals.icu Sync Modal */}` JSX, plus `showIntervalsSyncModal` state.
- The FTP-increase modal (`{showFTPModal && detectedFTP && (`), with `showFTPModal`,
  `detectedFTP`, `handleIgnoreFTP`, and the modal's other handlers (`handleRecalculateLevels`
  and whatever the other button calls). Before deleting each one, **grep to confirm** it's
  only used by that modal.
- `mapWorkoutTypeToZone`, if grep shows the sync function was its only caller.
- `intervalsFTP` state: remove the `useState`, the save-effect field **and** its entry in the
  save effect's dependency array, and the load/import/Drive-pull lines that call
  `setIntervalsFTP`. Old saved data that still has an `intervalsFTP` key is simply ignored.
  Also remove it from the export and Drive-push payloads.

**Keep:** `intervalsConfig`, `INTERVALS_CONFIG_KEY` and its load effect, the VO2max
stream-analysis fetch, the "Paste CSV" import, and all `intervalsId` fields.

Run `npm run build` after this commit as well.

## 8. Known limitation (put in CHANGELOG and tell the user)

The estimate is only as good as the hardest effort in the last 90 days. ERG workouts at
sweet spot or threshold (for example 2×20 at 95% FTP) produce an eFTP **below** true FTP
(0.95 × 0.95 ≈ 90%). That's why the prompt only offers increases. The header value is a
"proven recently" number, not a test result. A real 20-minute test or a long hard climb
gives the most accurate reading.

## 9. Verification (all required before pushing)

1. **Baseline first:** run `npm run lint` and `npm run build` on the untouched branch and
   write down the result, so any new warnings are obvious.
2. **Helper unit checks:** copy the three pure helpers into a scratch Node script (outside
   the repo) and assert:
   - steady 250W for 25 min → `rideEstimate` 238
   - 2×20 min at 220W with 5 min at 120W between → 209
   - 60 min steady at 230W → 230 (the `best60` branch wins over 0.95 × 230 = 218.5)
   - 15-minute ride → `null`
   - 25 min at 250W with a run of `null` bins in the middle → lower than 238, and not NaN
   - `binSeconds: 5` stream → same watts as the equivalent 10s stream
   - rolling: ride A (day 0, est 240) and ride B (day 30, est 220) → eFTP at day 30 = 240;
     at day 95 = 220 (A has expired); at day 125 = null
   - `firstStreamDate` is the earliest date with an estimate, not the earliest ride
3. **In-browser check** (use the `run` skill / Playwright with pre-installed Chromium): seed
   localStorage `STORAGE_KEY` with a history that has
   - 4+ months of rides with legacy `eFTP` values and no streams (months −10 … −5)
   - several rides with synthetic `stream`s in months −3 … 0, including one with a 20-minute
     effort at about 260W
   - a few manual rides after the first stream ride with a stale `eFTP: 243`
   - `ftp: 231`

   Then confirm:
   - the eFTP tab renders with no console errors; there are hollow dots for older months and
     solid dots from month −3; the stale 243 values don't appear in FIT-era months
   - the tooltip shows the peak-ride line / "Imported from intervals.icu"
   - the header, chart "Latest" and Copy for Claude all show the same number (247 for a 260W effort)
   - the prompt appears once (catch it with `page.on('dialog')`); after a reload it does
     **not** appear again; manually editing FTP does not trigger it
   - editing a legacy ride and saving keeps its `eFTP` (check localStorage)
   - Log Ride form: no eFTP field, and the RPE slider is full width on a 390px-wide viewport
   - with a history that has **no** streams, the chart matches today's behaviour (all hollow dots),
     and the header shows no eFTP

   Take screenshots of the chart at desktop and 390px widths and save them to the scratchpad.
4. `npm run lint` shows no new warnings and `npm run build` succeeds, both after §3–§6 and after §7.

## 10. Commits

1. `feat: estimate eFTP from FIT power streams` (§3–§6)
2. `refactor: remove unreachable intervals.icu sync and FTP-increase modal` (§7)
3. `docs: update ARCHITECTURE and CHANGELOG for eFTP estimation` (mark this plan
   **Status: Implemented in Session 20**)

Push to the session's `claude/` branch. Do not open a PR unless asked.
