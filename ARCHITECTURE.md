# Architecture

## File Structure
```
src/
  App.jsx              # Main component, ProgressionTracker (~3,400 lines)
  lib/                 # Pure helpers, no React (V2 Phase 1)
    dates.js           #   toLocalDateStr, parseDateLocal, parseDuration, formatDateWithDay, DAYS_OF_WEEK
    zones.js           #   ZONES, DEFAULT_LEVELS, ZONE_EXPECTED_RPE, ZONE_ADJACENCY, ZONE_BOUNDS, zoneForRatio, categoryForRatio, zoneWattRange, zoneRangeLabel (V2 Phase 2)
    rideFiles.js       #   parseFitFile, buildRideFromRecords, parseTcxFile, downsampleRecords, calculateNormalizedPower
    eftp.js            #   EFTP_* constants, bestAveragePower, estimateRideFtp, buildEftpTimeline
    intervals.js       #   interval-detection constants, meanOf, adaptiveWorkThreshold, mergeLapBlocks, buildIntervalLabel, detectIntervals
    progression.js     #   applyDecay
  main.jsx             # React entry point
  index.css            # Tailwind directives
  google-drive-sync.js # Google Drive OAuth & sync module
public/
  pwa-*.png            # PWA icons
.github/
  workflows/
    deploy.yml         # GitHub Actions → GitHub Pages deployment
vite.config.js         # Vite + PWA config (base: /cycling/)
```

## Component Architecture
Single component (`ProgressionTracker`, in `src/App.jsx`) with modal-based navigation. All UI is in that one component; pure helper functions and constants live in `src/lib/` and are imported.

### UI Sections (rendered conditionally)
- **Main View**: Dashboard with metrics cards, progression levels, charts
- **Modals**: Log Ride, History, Post-Log Summary, Profile, Event, Rider Type, Workout Detail, Workout Progression

## State Management
All state via `useState` hooks. No external state library.

### Core State
| State | Purpose |
|-------|---------|
| `levels` | Base progression levels per zone (1-10 scale) — raw, unaffected by decay |
| `displayLevels` | Animated display values for levels (used only during animation) |
| `effectiveLevels` | `useMemo` — `applyDecay(levels, lastWorkedDates)`. Used for display and new workout calculations |
| `lastWorkedDates` | `{ zoneId: 'YYYY-MM-DD' }` — when each zone was last directly trained (decay clock) |
| `history` | Array of ride objects |
| `currentFTP` | User's FTP setting |
| `intervalsFTP` | Legacy eFTP from intervals.icu. Pass-through only: loaded, saved, exported and synced unchanged, never edited (V2 Phase 1) |
| `vo2maxEstimates` | Legacy VO2max estimates. Pass-through only, same as `intervalsFTP` |
| `powerCurveData` | Power curve imported from intervals.icu in the past. Nothing writes it any more; still read by the Power Skills card |
| `eftpTimeline` | `useMemo` — `buildEftpTimeline(history, new Date())` (Session 20). `{ byRideId, current, firstStreamDate }` — see "eFTP Estimation" below |
| `currentEftp` | `eftpTimeline.current`, i.e. `{ value, peakRideName, peakRideDate } \| null` — the live eFTP shown in the header and used by the FTP-update prompt |
| `eftpPromptedValue` | The highest eFTP value already offered to the user via the FTP-update prompt (device-local, `localStorage['eftp-prompted-value']`) — prevents re-prompting for the same or a lower estimate |

### UI State
Modal visibility: `showLogRideModal`, `showHistoryModal`, `showProfileModal`, `showEventModal`, etc.

### Form State
| State | Purpose |
|-------|---------|
| `formData` | Log ride form fields. No `eFTP` field (Session 20) — eFTP is calculated, not entered. Legacy `ride.eFTP` values on existing rides are preserved via `...oldWorkout` in the edit-save path, not through `formData` |
| `editingRide` | ID of ride being edited (null = new ride) |
| `pendingFitDetail` | `{ stream, detection }` from a FIT import, awaiting Save — spread onto the new/edited ride entry in `handleLogWorkout()`, cleared on every Log Ride modal exit path |

### Interval Tracking State (Session 18)
| State | Purpose |
|-------|---------|
| `showWorkoutDetail` | Ride ID for the Workout Detail modal, or `null` |
| `showProgressionModal` | Workout Progression modal visibility |
| `progressionCategory` | Active zone tab in the Progression modal; `null` = no tab selected (default view: 5 most recent indoor workouts) |
| `progressionMetric` | Trend chart metric: `'minutes'` or `'watts'` |

## Data Flow
```
localStorage ──load──> useState ──render──> UI
                           ↑
User Input ──setState──────┘
                           │
                      ──save──> localStorage
```

## Key Constants
```javascript
ZONES           // Training zone definitions (recovery → anaerobic)
DEFAULT_LEVELS  // Initial progression levels (all 1)
ZONE_EXPECTED_RPE // Auto-assigned RPE by zone (3-9)
ZONE_ADJACENCY  // Zone neighbor map for trickle effect (one-hop, 20% factor each)
STORAGE_KEY     // localStorage key: 'cycling-progression-data-v2'
DAYS_OF_WEEK    // Day name lookup array (Sunday → Saturday)
```

## Zone Definitions (V2 Phase 2)

Before Phase 2, the on-screen zone labels (`getZoneDescription`, in `App.jsx`) and interval
detection (`ZONE_POWER_RATIO_RANGES`, in `src/lib/zones.js`) used two different sets of %FTP
edges, so 79–83% FTP fell in no zone on screen even though detection filed it somewhere.
They're now one table, `ZONE_BOUNDS` in `src/lib/zones.js`, using detection's edges (tuned in
Session 19 — unchanged, so no existing interval gets re-filed):

```javascript
ZONE_BOUNDS = {
  recovery:  [0,    0.55],
  endurance: [0.55, 0.70],
  tempo:     [0.70, 0.81],
  sweetspot: [0.81, 0.94],
  threshold: [0.94, 1.02],
  vo2max:    [1.02, 1.20],
  anaerobic: [1.20, Infinity],
}
zoneForRatio(ratio)          // first zone whose [min, max) contains ratio
categoryForRatio(ratio)      // same exact behavior as before Phase 2 (verified: 2,001 ratios
                              //   from 0.000 to 2.000 in 0.001 steps, 0 mismatches); ratios
                              //   below 0.55 still return 'endurance', since detection never
                              //   files a block as recovery
zoneWattRange(zoneId, ftp)   // { min, max } in watts (max: null for the open-ended top zone)
zoneRangeLabel(zoneId, ftp)  // "Z2: 127-162W" or "277W+" style label shown on the progression
                              //   bars — replaces getZoneDescription()
```

## Utility Functions (`src/lib/`)
```javascript
toLocalDateStr(date)     // YYYY-MM-DD using local timezone (replaces toISOString)
parseDateLocal(dateStr)  // Parse "YYYY-MM-DD" as local midnight (avoids UTC off-by-one)
formatDateWithDay(str)   // "2026-02-05 - Thursday" from YYYY-MM-DD string
getDefaultFormData()     // Default form values for a new ride (no eFTP field, Session 20)
bestAveragePower(stream, seconds) // Best average power over any window of `seconds` in a downsampled stream (null-bins count as 0W); null if stream too short
estimateRideFtp(ride)    // Best 20-min power x 0.95, or best 60-min power if higher; null if ride has no stream/is too short (Session 20)
buildEftpTimeline(history, today) // { byRideId, current, firstStreamDate } — see "eFTP Estimation" below (Session 20)
applyDecay(levels, lastWorkedDates) // Returns levels with decay applied (14-day grace,
                         //   -0.1/week, VO2max/Anaerobic 1.5x, floor max(1.0, level*0.5))
downsampleRecords(records, binSeconds=10) // FIT records -> { binSeconds, power[], hr[] }, null if no power data
detectIntervals(stream, ftp, laps, { indoor }) // Step-detection on smoothed power -> { segments, sets, category, label } or null
adaptiveWorkThreshold(values, ftp)  // 1-D 2-means split of a power trace -> work/rest threshold, or null
mergeLapBlocks(laps)                // Collapse consecutive same-power laps into blocks
buildIntervalLabel(sets)            // Sets -> display string, e.g. "4x6 @ 280W"
```

**Important**: Never use `new Date("YYYY-MM-DD")` to parse date strings — it creates midnight UTC, which in US timezones becomes the previous evening. Always use `parseDateLocal()` for ride/event date strings.

## eFTP Estimation (Session 20)

Replaced the intervals.icu-dependent eFTP with one calculated from the app's own FIT-imported
power streams (`ride.stream`). See `EFTP_ESTIMATE_PLAN.md` for the original design.

- **Per-ride estimate** (`estimateRideFtp`): `round(max(0.95 * best20min, best60min ?? 0))`,
  from the ride's own `stream`. Requires at least 20 minutes of stream data; `null` otherwise.
  Null (empty) bins count as 0W — a dropout can only lower the estimate.
- **Rolling current eFTP** (`buildEftpTimeline`): the highest per-ride estimate among rides
  dated in the last `EFTP_WINDOW_DAYS` (90) days. Rises with a new best effort, falls away
  after 90 days without one. Also returns `firstStreamDate` — the earliest ride date with an
  estimate — used to hand off the eFTP Progress chart from legacy to calculated values.
- **Constants**: `EFTP_WINDOW_DAYS` (90), `EFTP_20MIN_FACTOR` (0.95), `EFTP_PROMPT_MARGIN` (10W),
  `EFTP_PROMPT_KEY` (`'eftp-prompted-value'`, device-local `localStorage` key, not part of
  `STORAGE_KEY` or Drive sync).
- **FTP-update prompt**: fires when `currentEftp.value >= currentFTP + EFTP_PROMPT_MARGIN` and
  the value hasn't already been prompted (`eftpPromptedValue`, persisted to
  `EFTP_PROMPT_KEY` before the `confirm()` dialog, so Cancel/OK both count as "asked" and a
  re-render can't double-prompt). Effect depends only on `currentEftp?.value`, not `currentFTP`
  — manually editing FTP never triggers it. Never prompts to lower FTP.
- **Legacy `ride.eFTP`** (from CSV import or the old intervals.icu API sync) is never deleted
  or rewritten. It still feeds the eFTP Progress chart for months before the first FIT-based
  estimate exists (see chart specifics below), but nothing writes it any more (the CSV importer was removed in V2 Phase 1).
- **Known limitation**: the estimate is only as good as the hardest effort in the last 90 days.
  ERG/sweet-spot/threshold work (e.g. 2x20 @ 95% FTP) produces an eFTP *below* true FTP
  (0.95 x 0.95 ~= 90%). A real 20-minute test or a long hard climb gives the most accurate
  reading. This is why the prompt only ever offers to raise FTP.

## Data Import Sources
The intervals.icu API sync, CSV paste import and power-curve CSV import were removed in V2 Phase 1 (the API key had been hard-coded and published). Rides already imported from them keep all their fields. On load, the app deletes the old saved `intervals-icu-config` key from localStorage.

1. **FIT file upload (Session 16)** - "Import FIT File" button inside the Log Ride modal only. Parses `.fit` files client-side via the `fit-file-parser` npm package (`parseFitFile()`). Pre-fills Date, Duration, Normalized Power, Distance, Elevation, and Ride Type (Indoor/Outdoor, detected from GPS presence) into `formData`. Unlike the old bulk imports, this is not a separate unclassified ride source — it never sets Zone, Ride Name, or RPE, so the ride is saved through the normal `handleLogWorkout` path as `source: 'manual'` once the user fills in the rest and hits Save.
   **TCX (Session 21)**: the same button (now "Import FIT/TCX File") also accepts `.tcx`. `parseTcxFile(text)` reads the XML with the browser's built-in `DOMParser` (no dependency), maps each `<Trackpoint>` to FIT record field names (`timestamp`, `power`, `heart_rate`, `altitude`, `position_lat/long`, `distance`) and laps to `{ total_timer_time, avg_power, avg_heart_rate }`, then goes through the same `buildRideFromRecords()` as FIT — so stream, interval detection, backfill, eFTP and charts are identical. A trackpoint with no `<Watts>` counts as **0W** (TrainerDay omits power while coasting rather than writing 0). TCX has no NP field, so NP is always calculated from the power samples.

**Important (Session 5)**: the old CSV/API imports did NOT classify rides into zones or update progression levels. Imported rides have `zone: null` and `source: 'imported'`. The user must edit each ride in Ride History to assign a zone, at which point progression is calculated. This is intentional — NP-based auto-classification was unreliable for interval workouts. FIT file upload (above) is exempt from this because it never attempts zone classification at all.

**Interval detection exception (Session 18)**: FIT import now also pre-selects the Zone field to the category `detectIntervals()` derives from the ride's actual interval structure (power segments vs. FTP). This is a narrow, explicitly agreed exception to the Session 5 rule above — the user still confirms/adjusts the Zone before Save, and it's structural detection, not the rejected NP-based guessing.

## Ride Source Model
Every ride entry has a `source` field:
- `'imported'` — From the old CSV or intervals.icu API imports (removed in V2 Phase 1). Has `zone: null`, no progression data.
- `'manual'` — Logged or classified by user. Has a zone, progression levels calculated.
- `null`/missing — Legacy rides from before Session 5. Treated as classified (they have zone data from the old auto-classification logic).

When editing an imported ride, the handler detects the zone change (`wasUnclassified → isNowClassified`) and recalculates progression against the current level for that zone. The ride is re-tagged as `source: 'manual'`.

Recovery zone (`zone: 'recovery'`) is excluded from progression level updates regardless of source.

## Interval Data (Session 18)
Two optional fields on ride history entries, both `undefined` on rides that predate this feature — every consumer null-checks:
```javascript
stream: { binSeconds: 10, power: [145, 150, ...], hr: [98, 101, ...] } // downsampled per-ride stream, ~8-12KB/ride
intervalData: {
  source: 'auto' | 'manual',
  category: 'sweetspot',  // one of the ZONES ids
  label: '4x6 @ 280W',
  sets: [{ reps, workSeconds, avgWatts, avgHR, restSeconds }],
  segments: [{ startSec, endSec, avgWatts, avgHR }], // every detected work segment, chart shading source
}
```
Both fields live inside the same `history` entries and round-trip through the existing localStorage/Export/Import/Google Drive sync paths with no separate storage — no IndexedDB, no new storage key. `detectIntervals()` produces `intervalData` from a FIT-derived `stream`; a ride can have a `stream` with `intervalData: null` (steady ride, no intervals found).

**Outdoor rides and `intervalData.category` (V2 Phase 2, D5)**: an outdoor ride is never filed under a training zone — `zone` is always `null` for outdoor rides, and as of Phase 2 `intervalData.category` is always `null` for them too. Before Phase 2, `category` fell back to the *detected* zone whenever no zone was picked, which is exactly the outdoor case, so outdoor rides like a Draper or West Valley ride could show up under a Workout Progression zone tab (e.g. VO2max) even though they were never classified there. Every path that builds or updates `intervalData` now sets `category: null` for outdoor rides: both Log Ride save paths (`handleLogWorkout`), `redetectForRide` (used by 🔍 Re-detect and 🔍 Re-scan intervals), and the FIT/TCX backfill ("attach to existing ride") path. Importing an outdoor file also no longer pre-selects a zone on the Log Ride form. Workout Progression already filters rides with `intervalData?.category === zone`, so a `null` category is enough to exclude a ride — no separate outdoor check was needed there. A one-off migration in the load effect clears `category` to `null` on any already-saved ride with `rideType === 'Outdoor'` and a set category, so previously-misfiled rides self-correct the first time the app opens after this update; `label`, `sets` and `segments` are untouched, so the Ride page still shows the detected efforts.

**FIT backfill**: importing a FIT file whose date matches an already-logged ride offers to attach `stream`/`intervalData` to that ride in place, instead of creating a duplicate. TSS, zone, and progression fields on the existing ride are untouched by a backfill. **Matching by duration, not just date (V2 Phase 2)**: `findMatchingRideForImport()` picks, among rides logged on the same date as the imported file, the one whose stored `duration` is closest to the file's — and only within 25% (a ride with `duration` 0/unset always qualifies, since there's nothing to compare). If no same-day ride qualifies (e.g. two rides logged that day and neither is a close-enough match), the file becomes a new ride without asking, instead of guessing.

## Persistence
Single localStorage key (`STORAGE_KEY`) stores all app data in one JSON object:
- `levels`, `history`, `ftp`, `intervalsFTP`, `event`, `userProfile`, `vo2maxEstimates`, `powerCurveData`, `exportedAt`, `lastSyncedAt`, `lastWorkedDates`
- The Export file writes the same fields (plus `syncVersion`, `deviceId`). `vo2maxEstimates` was missing from Export before V2 Phase 1.

**Load/save architecture**: One load effect (runs once on mount with `try/catch`) and one save effect (skips initial mount via `isInitialMount` ref to prevent overwriting localStorage with empty defaults before state is populated; the `setItem` call itself is wrapped in `try/catch` since Session 18 — a quota error alerts the user to export a backup instead of silently failing). FTP is included in the main save — no separate FTP effects.

## Google Drive Sync
- **Module**: `src/google-drive-sync.js` — standalone OAuth + Drive API logic using Google Identity Services
- **Auth**: OAuth 2.0 implicit grant via `drive.file` scope (only accesses files created by the app)
- **Backup file**: `casey-rides-backup.json` in user's Google Drive root
- **Conflict resolution**: "Last write wins" based on `exportedAt` timestamp
- **Sync flow**: Authenticate → find/download remote → compare `exportedAt` → push (local newer) or pull (remote newer) or skip (equal)
- **State**: `isDriveSyncing`, `driveSyncStatus`, `exportedAt`, `lastSyncedAt`
- **`markDataChanged()`**: Called on every data mutation to update `exportedAt` — the single source of truth for sync conflict resolution

## Key Functions
| Function | Purpose |
|----------|---------|
| `calculateTSS()` | Training Stress Score from NP and duration |
| `calculateTrainingLoads()` | CTL, ATL, TSB calculations |
| `calculateNewLevel()` | Progression algorithm (expected vs actual RPE) |
| `handleLogWorkout()` | Save new or edited ride — applies trickle to adjacent zones, updates `lastWorkedDates` |
| `handleDriveSync()` | Google Drive sync (push/pull based on exportedAt) |
| `markDataChanged()` | Update exportedAt timestamp on any data mutation |
| `calculateEFTPHistory(history, eftpTimeline)` | eFTP monthly peaks (11-month rolling window). Per month, prefers the highest calculated (`eftpTimeline`) estimate; falls back to legacy `ride.eFTP` only for months before `firstStreamDate` (Session 20) |
| `parseFitFile(arrayBuffer)` | Parses a `.fit` file into Log Ride form field values (date, duration, NP, distance, elevation, ride type) |
| `parseTcxFile(text)` | Parses a `.tcx` file into the same shape as `parseFitFile()`; missing `<Watts>` = 0W (Session 21) |
| `buildRideFromRecords({...})` | Shared FIT/TCX step: records + ride totals → form values, `stream`, `laps` (elevation from ascent or summed altitude gains, NP fallback chain, GPS → Outdoor) |
| `findMatchingRideForImport(rides, parsed)` | (V2 Phase 2) Among same-day rides, the one whose `duration` is closest to the imported file's, within 25% (a ride with `duration` 0 always qualifies). `null` if none qualify — the file becomes a new ride, not a guessed attachment |
| `calculateNormalizedPower(powerSamples)` | NP from a per-second power stream — 30s rolling average, 4th-power mean, 4th root |
| `calculateMonthlyElevation()` | Monthly elevation totals (11-month rolling window, rides with elevation > 0) |
| `getTrainingStatus()` | Training status from TSB% with low-fitness override and transition detection |
| `getCalendarDays()` | Generate month grid day objects (Monday-start, 35 or 42 cells) |
| `copyForAnalysis()` | Clipboard export: FTP, W/kg, eFTP, training status, loads (7/14/28d TSS), weekly hours (4wk), recent workouts with day-of-week and ride type, interval progressions (last 3 sessions/category, if any) |
| `downsampleRecords(records, binSeconds)` | FIT records → 10s-binned `{ binSeconds, power[], hr[] }` for the Workout Detail chart |
| `detectIntervals(stream, ftp, laps, {indoor})` | Step-detection on smoothed power with an **adaptive** work threshold (Session 19); 90s min work, small-gap merging, lap-block preference; groups segments into sets and categorizes by dominant set's %FTP |
| `adaptiveWorkThreshold(values, ftp)` | 1-D 2-means (Lloyd's) split of a power trace into easy/work levels → midpoint threshold, or `null` when the ride has no two-level structure |
| `mergeLapBlocks(laps)` | Collapses consecutive laps within ±7% avg power into single blocks (undoes auto-lap chopping of long intervals) |
| `redetectForRide(ride)` / `handleRedetectRide(id)` / `handleRedetectAll()` | Re-run detection against a ride's already-saved `stream` — no FIT re-import needed |
| `buildIntervalLabel(sets)` | Sets → display string, e.g. `"4x6 @ 280W"` |

### Interval detection thresholds (Session 19)
| Constant | Value | Role |
|----------|-------|------|
| `WORK_THRESHOLD` | 0.85 | Fixed %FTP work threshold. Now an **upper bound** — the adaptive threshold may only lower it, never raise it, so nothing that used to be detected stops being detected. Used as-is for outdoor rides. |
| `MIN_WORK_RATIO` | 0.60 | A segment must average at least this %FTP to count as work at all (floor for the adaptive threshold). |
| `WORK_REST_SEPARATION` | 1.15 | The ride's work level must sit this far above its easy level, otherwise the ride is treated as steady and the adaptive threshold is rejected. |
| `MIN_SOLO_WORK_RATIO` | 0.76 | A *single* work block below this %FTP is steady riding, not an interval. |
| `MAX_SINGLE_SEGMENT_COVERAGE` | 0.85 | A single block covering more than this share of the ride = steady ride → `null`. |
| `LAP_MERGE_TOLERANCE` | 0.07 | Consecutive laps within ±7% watts merge into one block before classification. |

**Indoor vs outdoor**: the adaptive threshold only runs for indoor rides (`{ indoor: true }`, derived from `rideType`). Indoor ERG power is a near-square wave, so the ride's own two power levels are trustworthy; outdoor power from rolling terrain is not, and would generate phantom intervals — outdoor rides keep the conservative fixed 85%-FTP threshold.

## Charts (Tabbed: Hours, TSS, Elevation, eFTP)

All four charts use Recharts `<AreaChart>` inside `<ResponsiveContainer>` (height 200px).

| Chart | Color | dataKey | Y-axis width | Dot style |
|-------|-------|---------|-------------|-----------|
| Weekly Hours | Orange `#FB923C` | `hours` | 45 | `r: 4` solid fill |
| Weekly TSS | Blue `#3B82F6` | `tss` | 45 | `r: 4` solid fill |
| Monthly Elevation | Green `#22C55E` | `elevation` | 55 | `r: 4` solid fill |
| eFTP Progress | Purple `#A855F7` | `eFTP` | 55 | `r: 4`, hollow (`fill: '#1F2937'`) for legacy/imported months, solid for calculated months |

**eFTP chart specifics (updated Session 20):**
- Data: `calculateEFTPHistory(history, eftpTimeline)` — one point per calendar month, each
  tagged `source: 'estimated' | 'imported'`
- Window: 11 months back from 1st of current month (avoids duplicate month labels on X-axis)
- X-axis: `dataKey="month"` (short name: Jan, Feb, etc.), evenly spaced
- Tooltip (`EFTPTooltip`): month/year label, peak wattage, and either the peak ride's name +
  date (estimated) or "Imported from intervals.icu" (legacy)
- Dots are hollow for `source: 'imported'` months, solid purple for `source: 'estimated'`
  months — visually marks the handover from intervals.icu-imported values to the app's own
  calculated values, at `firstStreamDate`
- "Latest" in the chart header shows `currentEftp.value` (or `—`), matching the page header,
  not necessarily the same as the last plotted month's value
- Y-axis domain: `dataMin - 10` to `dataMax + 10`
- Empty-state hint: "Import a FIT file that includes a 20-minute or longer effort."

**Elevation chart specifics:**
- Data: `calculateMonthlyElevation()` — one point per calendar month (total elevation that month)
- Window: 11 months back from 1st of current month (matches eFTP chart)
- X-axis: `dataKey="month"` (short name: Jan, Feb, etc.), evenly spaced
- Tooltip: month/year label, total elevation, ride count (only rides with elevation > 0)

**Weekly charts** (Hours, TSS): X-axis uses `dataKey="label"` with `interval="preserveStartEnd"`. Tooltips show week label, value, and ride count.

## UI Layout (top to bottom, as of Session 8)

1. **Header bar**: App title, FTP/W·kg/eFTP display (eFTP now the calculated `currentEftp.value`, Session 20; hidden when null), Log Ride (green), Sync (blue), Event, Profile buttons. Sync status message shown below header when active.
2. **Progression Level bars**: One per zone (excludes Recovery), with recent change badges
3. **Charts**: Tabbed — Weekly Hours, Weekly TSS, Elevation, eFTP History
4. **Power Skills card**: Radar chart (3/5 width) + horizontal power bars (2/5 width). Shown only when saved `powerCurveData` exists (from an old intervals.icu import; the importer was removed in V2 Phase 1). Tooltips show "Xth percentile" (V2 Phase 2 — was "Top X%", which read backwards since a higher number is better). **Rider Type** button (top-right) shows phenotype derived from Sprint/Attack/Climb percentile averages (6 types: Sprinter, Puncheur, Rouleur, Time Trialist, Climber, All-Rounder). Click opens explanation modal.
5. **Training Load cards**: CTL / ATL / TSB in a 3-column grid
6. **Training Summary + Training Status** (side-by-side, 2-column grid): Left: `TSS [7d] [14d] [28d]` and `Longest (30d)`. Right: Training Status badge (color-coded pill with TSB%) and, below it, the **Copy for Claude** button (moved here in Session 17). Uses TSB% zones: Transition >+25%, Fresh +5–25%, Grey Zone -10–+5%, Optimal -30–-10%, High Risk <-30%. Low fitness override (CTL<35) shows Building states instead.
7. **Monthly Activity Calendar**: Strava-style month grid (Mon-start). Navigation arrows to scroll months. Ride days show solid blue circle with bike SVG icon; no-ride days show gray outline with day number. Today highlighted with blue border/ring. Adjacent-month days faded.
8. **Fitness Progress bar**: CTL toward target 100. Shows `Days to Event: X | CTL Target: 80-100`, or `Event complete | CTL Target: 80-100` once the event date has passed (V2 Phase 2, D4 — this used to show a negative day count, e.g. "Days to Event: -104"). No countdown text at all when no event date is set. Same rule applies to the Copy for Claude text.
9. **Ride History button**: Full-width, opens History modal
10. **Workout Progression button** (Session 18): Full-width, directly below Ride History, opens the Interval Progression modal
11. **Bottom action bar**: Import | Export (left) — Reset Levels (right, subtle text link)

### Modal system
All secondary views are modals (`fixed inset-0 z-50`). Clicking the backdrop (outside the modal) closes it (via `onClick` on backdrop + `stopPropagation` on inner content). Key modals:
- **Log Ride** (`showLogRideModal`): Also used for editing — `editingRide` state holds the ID. Outdoor rides grey out Zone/Completed; Indoor greys out Distance/Elevation. Form closes immediately on Save. Since Session 18, a FIT import that detects intervals shows a confirmation panel under the Import FIT File button (`pendingFitDetail`) before Save.
- **Ride History** (`showHistoryModal`): Scrollable list with edit/delete per ride. Since Session 18, entries with `stream`/`intervalData` show a "📊" button (opens Workout Detail) and the detected interval label as a tag. Since V2 Phase 2, that interval label sits on its own line under the date instead of appended to the title, so a long ride name no longer runs under the 📊 ✏️ 🗑️ buttons at 390px — a minimal fix, since this card is redesigned in Phase 4.
- **Post-Log Summary** (`showPostLogSummary`): Shows progression change after logging
- **Profile** (`showProfileModal`): Weight, HR, age settings. FTP box (V2 Phase 2): typing updates a local text value (`ftpInputValue`) only, not `currentFTP` directly, so clearing the box to retype no longer snaps it to 235 on every keystroke. Save validates 100–500; outside that range (including empty) keeps the previous FTP, shows an inline error below the field, and leaves the modal open. "Reset progression levels?" (shown when FTP changes) and the bottom-bar "Reset Levels" link both build their reset object from `{ ...DEFAULT_LEVELS }` (was missing `recovery` before Phase 2).
- **Event** (`showEventModal`): Goal event configuration
- **Workout Detail** (`showWorkoutDetail`, Session 18): Power/HR timeline chart (Recharts `ComposedChart`) with detected intervals shaded via `ReferenceArea`, plus an interval table. Opened from Ride History's 📊 button, the Progression modal's session list, or automatically after a FIT backfill. Header carries a **🔍 Re-detect** button (Session 19) that re-runs detection on the ride's saved stream.
- **Workout Progression** (`showProgressionModal`, Session 18): Header carries a **🔍 Re-scan intervals** button (Session 19) that re-runs detection across every ride with a saved stream (skipping `intervalData.source === 'manual'`). Opens with no zone tab selected — that default view lists the 5 most recent indoor workouts with their zones. Selecting a category tab (`progressionCategory`) switches to that zone's interval session history: a work-minutes/avg-watts trend chart and a newest-first session list — the planning view for deciding the next block's duration/wattage.

### Clipboard
`copyForAnalysis()` uses `navigator.clipboard.writeText()` with a `document.execCommand('copy')` fallback for HTTP/LAN contexts. The fallback creates a hidden textarea, selects it, and copies.

### Training loads
`calculateTrainingLoads()` returns `{ ctl, atl, tsb, weeklyTSS, twoWeekTSS, ctl14dAgo }`. The field `twoWeekTSS` is cumulative (includes the 7-day window): previous-week TSS is derived as `twoWeekTSS - weeklyTSS` for week-over-week comparison. The `ctl14dAgo` field captures CTL from 14 days ago for Training Status transition detection.

## Deployment

- **Hosting**: GitHub Pages at `https://caseywalrath.github.io/cycling/`
- **Base path**: `base: '/cycling/'` in `vite.config.js` (all asset URLs prefixed with `/cycling/`)
- **CI/CD**: GitHub Actions workflow (`.github/workflows/deploy.yml`) triggers on push to `main`
  - Runs `npm ci` → `npm run build` → uploads `dist/` → deploys to Pages
  - Uses `actions/configure-pages@v4` for proper Pages environment setup
- **PWA**: `scope` and `start_url` set to `/cycling/` in manifest
- **Branch model**: `main` is the deploy branch; `claude/` session branches merge into `main` via PR
