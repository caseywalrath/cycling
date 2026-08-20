# Implementation Plan: Indoor Interval Tracking & Progression

**Status:** Approved design, not yet implemented
**Designed:** Session 17 follow-up (2026-08-20)
**Target:** Phases 1 + 2 in a single build. Phase 3 is future work — do NOT build it.

Read `ARCHITECTURE.md` and `CHANGELOG.md` first, per `CLAUDE.md`. This plan was written
against `src/App.jsx` as of commit `3380a02`. Line numbers below are approximate — always
locate code by the quoted search strings, not by line number.

---

## 1. Goal (what the user wants)

Track indoor interval workouts over time so the user can plan future blocks. Example:
"My last three sweet spot sessions were 2x20, 2x22, and 2x25 at 195W → next time I'll
increase wattage or duration."

Data source: `.fit` files exported from Trainer Day, imported through the existing
"Import FIT File" button in the Log Ride modal. The FIT records contain per-second
power, heart rate, and cadence which the current parser discards — this build keeps them.

Three user-facing deliverables:
1. **FIT import captures interval data** — auto-detects interval structure (e.g. "4x6 @ 280W"),
   shows it for confirmation, and stores it on the ride.
2. **Workout Detail modal** — power + HR timeline chart with detected work intervals shaded,
   opened from Ride History.
3. **Interval Progression modal** — per-category (Sweet Spot, Threshold, VO2max...) session
   history with a trend chart. Opened from a new dashboard button.

Also: **backfill support** — importing a FIT file whose date matches an already-logged ride
attaches interval data to that ride instead of creating a duplicate.

## 2. Hard constraints — do not violate

- Single-file app: all changes go in `src/App.jsx` (module-level helpers at top, component
  logic/JSX inside `ProgressionTracker`). No new components files, no router, no new pages.
- No new npm dependencies. Charting is Recharts only (already installed). FIT parsing is
  `fit-file-parser` (already installed).
- Storage stays in the single localStorage key (`STORAGE_KEY`). NO IndexedDB.
- Do NOT change: progression level math (`calculateNewLevel`), TSS/CTL/ATL/TSB math,
  decay logic, trickle logic, Google Drive sync module, intervals.icu sync, CSV import.
- Do NOT build: intervals.icu interval fetching, workout file export (.zwo/.erg),
  next-workout suggestions. Those are Phase 3 (future).
- UI style: dark theme, Tailwind classes matching existing cards/modals
  (`bg-gray-800` cards, `bg-gray-700` inner rows, `fixed inset-0 ... z-50` modals with
  backdrop-click-to-close + `stopPropagation` on inner content).

## 3. Data model additions

Two new optional fields on ride history entries. Rides without them (manual, CSV, API,
pre-existing) simply have `undefined` — every consumer must null-check.

```js
// Attached to a ride entry in `history`:
intervalData: {
  source: 'auto' | 'manual',        // 'auto' = accepted from detection (even if user tweaked category)
  category: 'sweetspot',            // one of the ZONES ids (see §5 mapping); null if uncategorized
  label: '4x6 @ 280W',              // display string, built by buildIntervalLabel()
  sets: [                           // grouped summary; usually length 1
    { reps: 4, workSeconds: 360, avgWatts: 280, avgHR: 168, restSeconds: 180 }
  ],
  segments: [                       // every detected work segment, in ride order.
    { startSec: 600, endSec: 960, avgWatts: 281, avgHR: 165 },   // REQUIRED for chart shading
    ...
  ],
},
stream: {                           // downsampled ride stream for the detail chart
  binSeconds: 10,
  power: [145, 150, 278, ...],      // one entry per bin, watts (null for missing bins)
  hr: [98, 101, 143, ...],          // same length as power; null entries when no HR data
}
```

Size budget: a 2-hour ride at 10s bins = 720 bins ≈ 8–12 KB of JSON. Acceptable in
localStorage and in the Google Drive backup (streams ride along automatically because
`history` is already included in both the save effect and `handleDriveSync`'s `localData`).

**Persistence: zero changes needed.** The load effect (search: `const saved = localStorage.getItem(STORAGE_KEY)`)
and save effect already round-trip the whole `history` array. One defensive addition:
wrap the `localStorage.setItem(STORAGE_KEY, ...)` call in the save effect in `try/catch`;
on error (quota exceeded), `console.error` and `alert` telling the user storage is full
and to export a backup. Do not silently drop data.

## 4. New module-level helper functions

Add these near `parseFitFile` (top of `src/App.jsx`, before the component). All pure.

### `downsampleRecords(records, binSeconds = 10)`
Input: the FIT `data.records` array (objects with `timestamp`, `power`, `heart_rate`).
- Establish t0 = first record's timestamp. Bin index = `floor((t - t0) / 1000 / binSeconds)`.
- Each bin's power/hr = average of non-null samples in that bin, rounded; `null` if none.
- Return `{ binSeconds, power: [...], hr: [...] }`. If no records have power, return `null`.

### `detectIntervals(stream, ftp, laps = null)`
Input: the downsampled stream, current FTP (number), and optionally FIT `data.laps`.
Output: `{ segments, sets, category, label }` or `null` if nothing detected.

Algorithm (indoor ERG power is near-square-wave, so keep it simple):
1. Smooth: 3-bin (30s) centered rolling average of `stream.power` (skip null bins).
2. Work threshold: `WORK_THRESHOLD = 0.85` → a bin is "work" if smoothed power ≥ `0.85 * ftp`.
3. Find contiguous work runs. Merge two runs separated by a gap ≤ 2 bins (20s) — handles
   momentary power dropouts. Discard runs shorter than `MIN_WORK_SECONDS = 90` (define as
   a named module constant; note in a comment that micro-intervals like 30/30s are a known
   limitation of v1).
4. Each surviving run → a segment: `{ startSec, endSec, avgWatts, avgHR }` (averages of raw,
   not smoothed, non-null bin values over the run; avgHR null if no HR).
5. **Lap hint:** if `laps` has ≥ 3 entries, also compute lap-based segments (laps whose
   avg power ≥ threshold, using each lap's `total_timer_time`/`avg_power` fields when present).
   If lap-based segmentation yields more segments than step detection AND all lap segments
   are ≥ MIN_WORK_SECONDS, prefer it. Otherwise use step detection. Keep this logic small.
6. Group segments into sets: two segments belong to the same set if durations are within
   ±15% AND avgWatts within ±5%. For each set: `reps`, `workSeconds` (median duration,
   rounded to nearest 30s), `avgWatts` (mean, rounded), `avgHR` (mean of non-null, rounded,
   else null), `restSeconds` (median gap between consecutive segments of that set, rounded
   to nearest 15s; null for single-rep sets).
7. Category from the dominant set's `avgWatts / ftp` (dominant = most total work time):
   - `< 0.76` → `'endurance'`
   - `0.76–0.87` → `'tempo'`
   - `0.88–0.94` → `'sweetspot'`
   - `0.95–1.05` → `'threshold'`
   - `1.06–1.20` → `'vo2max'`
   - `> 1.20` → `'anaerobic'`
8. Label via `buildIntervalLabel(sets)`.
Return `null` when there are zero segments (e.g. recovery/endurance ride with no work
blocks) — that is a normal outcome, not an error.

### `buildIntervalLabel(sets)`
- One set: `"4x6 @ 280W"` (minutes rounded to nearest 0.5, trailing `.0` dropped;
  `1x20 @ 195W` stays as `1x20`, do not special-case).
- Multiple sets: join with ` + ` → `"3x8 @ 250W + 4x1 @ 320W"`.

### Unit sanity check (do this before wiring UI)
Temporarily test `detectIntervals` in isolation: build a synthetic stream in a scratch
node script (e.g. 10min @ 140W warmup, then 4 × [6min @ 280W work + 3min @ 130W rest],
then cooldown; ftp 235) and assert it returns 4 segments, one set `{reps:4}`, category
`'vo2max'`. Also test: all-endurance stream → returns null; stream with nulls in gaps.
Delete the scratch script afterwards (or keep under a `scripts/` folder if it seems useful).

## 5. Changes to `parseFitFile` and the FIT import flow

### `parseFitFile` (search: `const parseFitFile = (arrayBuffer)`)
Keep the existing returned fields exactly as they are (other code depends on them).
Add to the resolved object:
- `stream`: result of `downsampleRecords(records)` (may be null),
- `laps`: `data.laps || []`.
Do NOT run detection inside `parseFitFile` — it needs `currentFTP`, which is component
state. Detection runs in the handler.

### `handleFitFileImport` (search: `const handleFitFileImport = (event)`)
After `parsed = await parseFitFile(...)` succeeds:

1. **Backfill check (new):** look for an existing ride with the same `date`:
   `history.find(w => w.date === parsed.date)`. If found, `confirm()` with:
   `"A ride on <date> already exists (<name or 'Workout'>, <duration>min). Attach interval data to it instead of creating a new ride?"`
   - **OK →** run detection (`detectIntervals(parsed.stream, currentFTP, parsed.laps)`),
     update that entry via `setHistory(history.map(...))` setting `stream` and
     `intervalData` (leave every other field untouched — do NOT recalc TSS/zone/levels),
     call `markDataChanged()`, close the Log Ride modal, open the Workout Detail modal
     for that ride so the user sees the result, and `alert` a short success message
     including the detected label (or "no intervals detected" — still attach the stream).
   - **Cancel →** fall through to the normal new-ride flow below.
2. **Normal flow:** as today, `setFormData(prev => ({...prev, ...parsed-summary-fields}))`,
   but additionally stash the detail in new state:
   `setPendingFitDetail({ stream, detection })` where
   `detection = detectIntervals(parsed.stream, currentFTP, parsed.laps)`.
   If `detection` is non-null and `formData.zone` is empty, also pre-select the zone:
   `zone: detection.category` (the user confirms it in the form as usual — this is the
   agreed exception to the Session 5 "no auto-classification" rule, because it derives
   from actual interval structure, not NP guessing).

### New component state
```js
const [pendingFitDetail, setPendingFitDetail] = useState(null); // { stream, detection } from FIT import, awaiting save
const [showWorkoutDetail, setShowWorkoutDetail] = useState(null); // ride id or null
const [showProgressionModal, setShowProgressionModal] = useState(false);
const [progressionCategory, setProgressionCategory] = useState('sweetspot');
const [progressionMetric, setProgressionMetric] = useState('minutes'); // 'minutes' | 'watts'
```

### Detection confirmation UI (inside the Log Ride modal)
When `pendingFitDetail?.detection` exists and the modal is open, render a small panel
directly under the "Import FIT File" button (search: `📁 Import FIT File`):
- Line 1: `⚡ Detected: 4x6 @ 280W` and the category name (use `getZoneName`).
- Line 2 (small, gray): "Interval data will be saved with this ride. Adjust the Zone above if the category looks wrong."
- An `✕` button that clears `setPendingFitDetail(null)` (user opts out of storing detail).
If `pendingFitDetail` exists but `detection` is null: show "No structured intervals
detected — power/HR chart will still be saved."

### `handleLogWorkout` (search: `const handleLogWorkout = ()`)
In BOTH the editing branch and the new-ride branch, when `pendingFitDetail` is set,
spread onto the entry:
```js
...(pendingFitDetail ? {
  stream: pendingFitDetail.stream,
  intervalData: pendingFitDetail.detection
    ? { ...pendingFitDetail.detection, source: 'auto',
        // if the user changed the Zone away from the detected category, respect it:
        category: (zone && zone !== 'recovery') ? zone : pendingFitDetail.detection.category }
    : null,
} : {})
```
Then `setPendingFitDetail(null)` in every exit path of the modal: after save, on Cancel,
and on backdrop close (find the modal's close handlers).

## 6. Workout Detail modal (new)

Rendered when `showWorkoutDetail !== null`; `const detailRide = history.find(w => w.id === showWorkoutDetail)`.
Follow the exact modal pattern of Ride History (search: `{showHistoryModal && (` for the
template): backdrop click closes, inner `stopPropagation`, `max-w-md` is too narrow for a
chart — use `max-w-2xl`.

Contents top-to-bottom:
1. Header: ride name + date (`formatDateWithDay`), close ×.
2. Summary row: duration, NP, TSS, IF, and `intervalData.label` if present.
3. **Chart** (only if `detailRide.stream`): Recharts `ComposedChart` in a
   `ResponsiveContainer` height 220.
   - Add to the existing recharts import (search: `from 'recharts'`): `ComposedChart`,
     `Line`, `ReferenceArea`, `Legend` (only what you actually use).
   - X data: build `chartData = stream.power.map((p, i) => ({ min: (i * stream.binSeconds) / 60, power: p, hr: stream.hr[i] }))`.
     XAxis `dataKey="min"` type="number", tick formatter → whole minutes.
   - Power: `<Area type="stepAfter" dataKey="power" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.25} dot={false} />`, left YAxis (watts).
   - HR: `<Line type="monotone" dataKey="hr" stroke="#EF4444" dot={false} strokeWidth={1.5} />`,
     right YAxis (`yAxisId="hr"`, orientation="right", bpm). Omit the line entirely when
     every hr value is null.
   - Interval shading: one `<ReferenceArea>` per `intervalData.segments` entry,
     `x1={startSec/60} x2={endSec/60}`, `fill="#EAB308"` `fillOpacity={0.12}`,
     `strokeOpacity={0}`.
   - Tooltip: show minute, power W, HR bpm. Match dark tooltip styling used by existing
     chart tooltips (search: `EFTPTooltip` for the pattern).
4. **Interval table** (only if `intervalData?.segments?.length`): compact rows —
   `#`, duration (m:ss), avg W, avg HR (— if null). Use `bg-gray-700 rounded` rows like
   Ride History entries.

**Entry points:**
- In each Ride History entry (search: `title="Edit workout"` for the button cluster), add a
  `📊` button BEFORE the edit button, rendered only when `entry.stream || entry.intervalData`,
  onClick: `setShowHistoryModal(false); setShowWorkoutDetail(entry.id);`.
- After a successful backfill attach (§5), open it directly.
- Also show `intervalData.label` as a small yellow-ish tag in the Ride History entry title
  row when present (e.g. `<span className="text-yellow-400 text-xs ml-2">{entry.intervalData.label}</span>`).

## 7. Interval Progression modal (new)

**Dashboard entry point:** directly below the Ride History button (search:
`{/* Ride History Button */}`), add a full-width button styled the same, labeled
`Workout Progression` (`📈` optional), onClick `setShowProgressionModal(true)`.

**Modal** (same pattern, `max-w-2xl`):
1. Header: "Workout Progression", close ×.
2. **Category tabs:** one pill button per ZONES entry excluding `recovery` (reuse the
   chart-tab pill pattern — search: `Weekly Hours` near the chart tab buttons for styling).
   Active = `progressionCategory`. Show a count badge of sessions per category.
3. **Sessions** = `history.filter(w => w.intervalData?.category === progressionCategory)`
   sorted by date ascending (`parseDateLocal` for comparison — NEVER `new Date(str)`).
4. **Trend chart** (only if ≥ 2 sessions): `AreaChart` height 200, X = session date
   (short label `M/D`), Y = metric toggle:
   - `minutes`: total work = `sets.reduce((s, x) => s + x.reps * x.workSeconds, 0) / 60`
   - `watts`: work-time-weighted avg watts across sets.
   Toggle = two small pill buttons above the chart ("Work Minutes" / "Avg Watts") bound to
   `progressionMetric`. Area color: use the category's `ZONES` color for the stroke/fill
   (look up `ZONES.find(z => z.id === progressionCategory).color`). Tooltip shows date,
   the metric value, and the session's `label`.
5. **Session list** (newest first, this is the planning payoff): one `bg-gray-700` row per
   session — date (`formatDateWithDay`), `label` (prominent, font-mono), avg HR of the
   dominant set, total work minutes. Row click → `setShowProgressionModal(false); setShowWorkoutDetail(id);`.
6. Empty state (0 sessions in category): "No tracked <name> workouts yet. Import a FIT
   file from the Log Ride screen to start tracking interval progressions."

## 8. Copy for Claude addition

In `copyForAnalysis` (search: `const copyForAnalysis`), after the Recent Workouts block,
append a section listing up to the last 3 sessions per category that has any:

```
## Interval Progressions
- Sweet Spot: 2x20 @ 195W (Jul 30) → 2x22 @ 195W (Aug 6) → 2x25 @ 195W (Aug 13)
- VO2max: 4x5 @ 270W (Aug 2) → 4x6 @ 275W (Aug 12)
```
Oldest → newest, joined with ` → `. Skip the whole section if no ride has `intervalData`.

## 9. Implementation order (commit after each step builds clean)

1. `feat: capture downsampled power/HR streams and detect intervals from FIT files`
   — §4 helpers + §5 parse/import/save changes + confirmation panel + storage try/catch.
   Verify with the §4 synthetic test AND `npm run build`.
2. `feat: workout detail modal with power/HR chart and interval shading` — §6.
3. `feat: interval progression modal and dashboard button` — §7.
4. `feat: include interval progressions in Copy for Claude export` — §8.
5. `docs: architecture and changelog for interval tracking` — §10.

After each step: `npm run build` must pass. There are no automated tests in this repo.
For manual verification the user will import a real Trainer Day FIT file; you can
sanity-check the UI renders by building, but the FIT flow itself is user-verified.

## 10. Documentation updates (required, same commit series)

- `ARCHITECTURE.md`: add `intervalData`/`stream` to a ride-entry description (extend the
  "Ride Source Model" section or add a short "Interval Data" section); add the new
  functions to Key Functions; add the two modals to the Modal system list; add the
  Workout Progression button to the UI Layout list; note the FIT backfill behavior.
- `CHANGELOG.md`: new session entry at the TOP (follow the existing format — check how
  Session 17 is written) describing the feature, the detection algorithm constants
  (85% FTP threshold, 90s min work, 10s bins), and the backfill flow.
- This file (`INTERVAL_TRACKING_PLAN.md`): update the Status line to
  `Implemented in Session <N>` — do not delete the file.

## 11. Edge cases checklist (handle all)

- FIT with no power records → `stream` null → skip detection, import summary fields only
  (current behavior preserved).
- FIT with power but no HR → `hr` all nulls → chart omits HR line; `avgHR` null → render `—`.
- Detection finds nothing (steady ride) → `intervalData` null, `stream` still saved →
  detail modal shows chart without shading/table.
- Old rides with no `stream`/`intervalData` → no 📊 button, excluded from progression modal.
- FTP of 0/undefined → skip detection entirely (guard in the handler; `currentFTP` should
  always be set, but don't divide by it unguarded).
- Backfill target ride already has `intervalData` → the confirm() flow simply overwrites
  (re-import = refresh); no extra prompt needed.
- Same-date FIT but user declines backfill → normal new-ride path must still work.
- User cancels/edits then closes Log Ride modal → `pendingFitDetail` must be cleared
  everywhere the modal closes, or the next manual ride would silently absorb stale data.

## 12. Git workflow

Per `CLAUDE.md`: work on the session's assigned `claude/` branch, conventional commits
as listed in §9, push with `git push -u origin <branch>` when done, and end by giving the
user the fetch/checkout/pull instructions for that branch. Do not open a PR unless asked.
