# Architecture

**As of V2 Phase 3 (Session 23).** A four-tab iPhone-first PWA: **Today, Rides, Progress,
Settings**. All data lives in one React context; screens are built from a small UI kit.

## File Structure
```
index.html                   # viewport-fit=cover (safe areas), apple-touch-icon, PWA meta
src/
  main.jsx                   # React entry point
  App.jsx                    # tiny: <AppDataProvider><ToastProvider><ConfirmProvider><Shell/>…
  Shell.jsx                  # picks the screen/page for the hash route; tab bar; ＋ Log Ride
                             #   button; owns the Log Ride sheet and post-log summary sheet
  index.css                  # Tailwind directives, sheet/fade animations, window-scroll setup
  google-drive-sync.js       # Google Drive OAuth & sync module
  state/
    AppDataContext.jsx       # ALL persisted state, load/save effects, derived values, every
                             #   data action; useAppData()
    useHashRoute.js          # hash routing (#/today, #/ride/<id> …), navigate(), goBack(),
                             #   per-tab scroll memory
    ShellContext.js          # useShell(): openLogRide(), openEditRide(id)
  components/
    ui/                      # the UI kit (see "UI kit" below); index.js re-exports everything
    ProgressionLevels.jsx    # zone level bars (Progress tab); tap → Workout Progression page
    TrainingCharts.jsx       # Hours / TSS / Elevation / eFTP charts with a SegmentedControl
    PowerSkillsCard.jsx      # radar + power bars + Rider Type sheet
    ActivityCalendar.jsx     # monthly calendar (Rides tab)
    RideHistoryList.jsx      # ride cards with Chart / Edit / Delete (Rides tab)
    PostLogSummarySheet.jsx  # level before → after, trickle, TSS/IF/RPE
  screens/
    TodayScreen.jsx          # Today tab (the house style: later phases copy it)
    RidesScreen.jsx          # calendar + ride history; ?filter=needs-zone
    ProgressScreen.jsx       # levels, charts, Power Skills, Workout progression row
    SettingsScreen.jsx       # profile, event, sync & backup, reset levels
    WorkoutDetailPage.jsx    # Ride page at #/ride/<id>
    WorkoutProgressionPage.jsx # #/progress/workouts and #/progress/zone/<zoneId>
    LogRideSheet.jsx         # Log / Edit ride form as a bottom sheet
  lib/                       # pure helpers, no React
    dates.js                 #   toLocalDateStr, parseDateLocal, parseDuration, formatDateWithDay, DAYS_OF_WEEK
    zones.js                 #   ZONES, DEFAULT_LEVELS, ZONE_EXPECTED_RPE, ZONE_ADJACENCY, ZONE_BOUNDS,
                             #   zoneForRatio, categoryForRatio, zoneWattRange, zoneRangeLabel, getZoneName, getZoneColor
    rideFiles.js             #   parseFitFile, buildRideFromRecords, parseTcxFile, downsampleRecords,
                             #   calculateNormalizedPower, findMatchingRideForImport
    eftp.js                  #   EFTP_* constants, bestAveragePower, estimateRideFtp, buildEftpTimeline
    intervals.js             #   interval-detection constants, detectIntervals and helpers
    progression.js           #   applyDecay, calculateNewLevel
    load.js                  #   calculateTSS, calculateIF, calculateTrainingLoads, getTrainingStatus
    chartData.js             #   calculateWeeklyHours, calculateWeeklyTSS, calculateMonthlyElevation, calculateEFTPHistory
    summary.js               #   getDaysUntilEvent, weekComparison, latestRide, buildAnalysisText (Copy for Claude), copyToClipboard
    alerts.js                #   buildAlerts, ridesNeedingZone (Today alerts)
    format.js                #   formatChange, getChangeDescription, ordinal, shortDayDate, formatMinutes
tools/
  v2-check.mjs               # regression check (see V2_PLAN.md §0.4); v2-baseline.json
public/                      # PWA icons, apple-touch-icon.png
.github/workflows/deploy.yml # GitHub Actions → GitHub Pages
vite.config.js               # Vite + PWA config (base: /cycling/)
```

## App Structure

```
<AppDataProvider>          state/AppDataContext.jsx — data + actions (useAppData)
  <ToastProvider>          components/ui/Toast.jsx — useToast()
    <ConfirmProvider>      components/ui/ConfirmSheet.jsx — useConfirm()
      <Shell/>             Shell.jsx — ShellContext (useShell), route → screen/page,
                           TabBar, ＋ Log Ride, LogRideSheet, PostLogSummarySheet
```

**Rule:** data actions never open UI. They change state and **return a result**; the screen
that called them decides what to show (a toast, a ConfirmSheet, a page). E.g.
`importRideFile(file)` resolves `{ parsed, detection, existingMatch }` and `LogRideSheet`
decides whether to ask "Attach to an existing ride?".

## Navigation (`state/useHashRoute.js`)

No router library. `useHashRoute()` parses `location.hash` into
`{ tab, page, id, zone, section, query, key }`.

| Hash | Shows |
|---|---|
| `#/today` (also empty hash) | Today tab |
| `#/rides`, `#/rides?filter=needs-zone` | Rides tab (optionally only rides needing a zone) |
| `#/progress` | Progress tab |
| `#/settings`, `#/settings/profile`, `#/settings/event`, `#/settings/data` | Settings tab, scrolled to that section |
| `#/settings/profile?ftp=240` | Settings with the FTP box pre-filled (Today eFTP alert → "Update FTP") |
| `#/ride/<id>` | Ride page (full screen, no tab bar) |
| `#/progress/workouts`, `#/progress/zone/<zoneId>` | Workout Progression page |

- `navigate(hash, { replace })`. **Tabs switch with `replace`** (no history entry, so Back never
  walks through tabs); **pages are pushed**, so Back returns to the tab.
- Each history entry is tagged with an index in `history.state.idx`. `goBack(fallback)` calls
  `history.back()` when there's an in-app entry to return to, otherwise (the page was opened
  directly, e.g. a reload on `#/ride/123`) goes to the fallback tab.
- **Scroll memory:** on every hashchange the old route's `window.scrollY` is saved by route key;
  tabs restore theirs, pages always open at the top. Tapping the active tab scrolls to top.
- The window is the scroll container (see `index.css`: `overflow-x: hidden` is on `body` only,
  so it propagates to the viewport). Don't put `overflow` on `html` + `body` together; that
  makes `body` the scroller and breaks scroll memory and sticky headers.

## Data Layer (`state/AppDataContext.jsx`)

`useAppData()` returns `{ state…, derived…, actions… }`. All `useState`; no state library.

### Persisted state
| State | Purpose |
|-------|---------|
| `levels` | Base progression levels per zone (1-10) — raw, unaffected by decay |
| `lastWorkedDates` | `{ zoneId: 'YYYY-MM-DD' }` — when each zone was last directly trained (decay clock) |
| `history` | Array of ride objects (newest logged first) |
| `currentFTP` | FTP (saved as `ftp`) |
| `event` | `{ name, date, distance, targetCTL }` |
| `userProfile` | `{ maxHR, restingHR, weight (lb), age, sex }` |
| `intervalsFTP`, `vo2maxEstimates` | **Pass-through** (V2 §0.3): loaded, saved, exported, synced unchanged, never edited |
| `powerCurveData` | Pass-through; still read by Power Skills until Phase 6 |
| `exportedAt`, `lastSyncedAt` | Sync timestamps (see Google Drive Sync) |

### Other state in the provider
| State | Purpose |
|-------|---------|
| `displayLevels`, `animatingZone` | Level-bar animation after the post-log summary closes (`animateLevel`) |
| `recentChanges` | `{ zoneId: { change, date, trickle? } }` badges on the level bars; rebuilt from history on load |
| `lastLoggedWorkout` | The ride just logged (post-log summary data; drives the animation) |
| `formData`, `editingRide`, `pendingFitDetail` | The Log Ride form, the id being edited (null = new ride), and `{ stream, detection }` from a file import awaiting Save |
| `isDriveSyncing`, `driveSyncStatus` | Sync button state; status clears after 5 s |
| `eftpPromptedValue` | Highest eFTP the user has answered (device-local `localStorage['eftp-prompted-value']`) |

### Derived (memoised)
`effectiveLevels` (`applyDecay`), `eftpTimeline` / `currentEftp` (`buildEftpTimeline`), `loads`
(`calculateTrainingLoads`), `trainingStatus` (`getTrainingStatus`). They depend on `history` /
`levels` plus a "today" key that refreshes when the app returns to the foreground, so a
PWA left open overnight doesn't show yesterday's numbers.

### Actions
| Action | Does | Returns |
|---|---|---|
| `saveRide()` | The old `handleLogWorkout`, logic unchanged: new ride (progression, trickle, `lastWorkedDates` for the primary zone, `recentChanges`, `lastLoggedWorkout`) or edit of `editingRide` (re-classification recalculates progression) | `{ kind: 'new' \| 'edit', entry }` |
| `startEditRide(id)` / `closeRideForm()` | Fill the form for editing / close without saving (edit: reset form; new: keep typing, drop `pendingFitDetail`) | `true/false` / – |
| `deleteRide(id)` | Remove a ride (caller confirms first) | `true/false` |
| `importRideFile(file)` | Parse .fit/.tcx, detect intervals, find a same-day match (`findMatchingRideForImport`) | Promise `{ parsed, detection, existingMatch }` |
| `applyRideImport(result)` | Pre-fill the form + `pendingFitDetail` | – |
| `attachRideFile(existing, result)` | FIT backfill onto an existing ride (stream + intervalData only) | `{ rideId, detection }` |
| `redetectRide(id)`, `redetectCandidates()`, `redetectAll()` | Re-run interval detection on saved streams | `{ ok, message }` / rides / `{ ok, message }` |
| `saveProfile({ ftp, profile, resetLevels })` | Save Settings → Profile (caller validates FTP 100–500 and asks about resetting levels) | – |
| `saveEvent(data)`, `deleteEvent()` | Event | – |
| `resetLevels()` | All zones to 1.0, clears `lastWorkedDates` | – |
| `exportData()` | Download the backup file | filename |
| `readBackupFile(file)` / `restoreBackup(parsed)` | Read a backup / replace local data with it (caller confirms in between) | parsed / ride count |
| `syncWithDrive()` | The old `handleDriveSync` | sync result |
| `resolveEftpAlert(value)` | Store the answered eFTP value (Dismiss or Update FTP) | – |
| `buildCopyText()` | Copy for Claude text | string |
| `closePostLogSummary()` | Start the level-bar animation for `lastLoggedWorkout` | – |
| `markDataChanged()` | `exportedAt = now` — called by every mutation | – |

## Design System

Every screen uses the UI kit; later phases must too, rather than hand-rolling styles.

- **Dark theme:** page `bg-gray-900`, cards `bg-gray-800` (`Card`: `rounded-2xl p-4`), inset
  tiles `bg-gray-900/50 rounded-xl`, primary text white, secondary `text-gray-400`.
- **Zone colours** always come from `ZONES` (`getZoneColor`). Outdoor rides are grey on Today's
  week dots; indoor rides without a zone are dark grey.
- **Type:** body text 15–16px (`text-base`); section titles `text-base font-semibold`; tab
  titles `text-2xl font-bold`; small print `text-sm`/`text-xs` only for secondary info.
- **All inputs `text-base` (16px)** — iOS zooms the page into any smaller input.
- **Touch targets ≥ 44px** (`Button`, `Chip`, `SegmentedControl`, `TabBar` all enforce it;
  `tools/v2-check.mjs` lists anything smaller).
- **Numbers use tabular figures** (`tabular-nums`).
- **No hover-only information:** every tooltip must work on tap (Recharts tooltips do; the
  Power Skills bars open theirs on tap).
- **No emoji as the only label of a control.** Emoji may decorate text, never replace it.
- **Plain words first, jargon second:** "Fitness (CTL)", "Form (TSB)".
- **iPhone first:** designed at 390px; desktop gets the same centred `max-w-2xl` column.
- **Safe areas:** `index.html` has `viewport-fit=cover` (without it iOS reports every
  `env(safe-area-inset-*)` as 0). `Screen` pads the top for the status bar and the bottom for
  the tab bar + home indicator; `Page`, `Sheet` and `TabBar` pad themselves.
- **Feedback:** informational messages are `Toast`s; questions are `ConfirmSheet`s
  (`destructive` for delete/reset/restore). Never `window.alert`/`window.confirm` — the only
  exception is the storage-full warning in the save effect, which must stay an `alert` because
  it fires when the UI may be broken.

## UI Kit (`src/components/ui/`)

| Component | Notes |
|---|---|
| `Screen` | Tab wrapper: `max-w-2xl mx-auto px-4`, top padding `env(safe-area-inset-top)` + 12px, bottom padding tab bar (56px) + safe area (+64px with `withFab`). Props: `title`, `subtitle`, `right`, or a custom `header` |
| `TabBar` | Fixed bottom, 4 tabs with inline-SVG icons + labels, 56px + safe area, active tab blue. `badges={{ settings: n }}` for Phase 4 |
| `Page` | Full-screen pushed page, sticky header: "‹ Back" (`goBack(backTo)`), title, optional `right` action |
| `Sheet` | Bottom sheet: slides up, rounded top, drag handle, max 92vh, own scroll, optional sticky `footer`, closes on backdrop or the Cancel link (`closeLabel`, "" hides it). Locks page scroll while open |
| `Card`, `SectionHeader` | Surface + section title (`subtitle`, `right`). `Card as="button"` for a whole-card tap |
| `StatTile` | `label`, `sublabel`, `value`, `unit`, `delta` (▲ green / ▼ red; `tone="neutral"` for grey), `deltaLabel`, `valueColor`. Value has `data-value` |
| `SegmentedControl` | `options=[{ value, label, color? }]`, `value`, `onChange` |
| `Button` | `variant`: `primary` (green), `secondary`, `ghost`, `destructive`, `ghost-destructive`; `size`: `md`/`sm`; `block`. Min height 44px |
| `Chip` | Selectable pill; `color` tints it when selected |
| `Toast` + `useToast()` | `toast(message, { tone: 'info' \| 'success' \| 'error', duration })`, top of screen, tap to dismiss |
| `ConfirmSheet` + `useConfirm()` | `await confirm({ title, message, confirmLabel, cancelLabel, destructive })` → `true/false` |
| `EmptyState` | `icon`, `message`, optional `actionLabel` + `onAction` |

## Screens

### Today (`screens/TodayScreen.jsx`)
1. **Header:** "Casey Rides" wordmark (Today only; other tabs show their name), and beneath it
   `FTP 231W · 3.0 W/kg · eFTP 197W` (`data-ftp-line`). Tapping eFTP shows a toast explaining it.
2. **Status card:** `getTrainingStatus` pill + description (+ "Form is X% of fitness (TSB%)"
   when CTL ≥ 35), then three `StatTile`s — Fitness (CTL), Fatigue (ATL), Form (TSB, signed) —
   each with its change over 14 days (`ctl14dAgo`, `atl14dAgo`, `tsb14dAgo`). The old
   `getTSBStatus` (which could say "Fresh" next to "Transition") is deleted.
3. **Alerts** (`buildAlerts(state, derived, today)` in `lib/alerts.js`; only when present):
   - *eFTP above FTP* (`currentEftp.value ≥ FTP + 10` and above `eftpPromptedValue`):
     **Update FTP** (stores the value, opens `#/settings/profile?ftp=<eFTP>`) / **Dismiss**
     (stores the value). Nothing is stored just by showing it. Replaces the old `window.confirm`.
   - *N rides need a zone* (`ridesNeedingZone`: indoor, `zone == null`, `source === 'imported'`,
     not `historical`) → `#/rides?filter=needs-zone`.
   - *Event complete* (event date passed) → `#/settings/event`.
4. **This week:** Monday → today vs last Monday → same weekday (`weekComparison`): hours, TSS,
   rides with ▲/▼, and a 7-dot Mon–Sun row coloured by zone (grey outdoor), today ringed.
5. **Latest ride** (`latestRide`: latest date): name, zone/Outdoor/Needs-zone pill, date,
   duration, TSS, interval label. Tap → `#/ride/<id>` if it has a stream, else the edit sheet.
6. **Event:** name, date, "36 days to go" / "Today!" / "Event complete" (+ Set next event), and
   the Fitness (CTL) → target bar (moved here from the old Fitness Progress card). No date:
   "No event set · Add one".
7. **Copy for Claude** (secondary button; text format unchanged, `buildAnalysisText`).
8. **＋ Log Ride** floats above the tab bar on Today and Rides (rendered by `Shell`).

### Rides (`screens/RidesScreen.jsx`)
Monthly calendar (unchanged look; day cells are 44px; tapping a ride day lists that day's rides
with "Edit Ride →"), then **Ride history** (`RideHistoryList`, the old History modal cards, with
labelled Chart / Edit / Delete buttons; Delete asks with a destructive ConfirmSheet). With
`?filter=needs-zone` only the rides needing a zone are listed, with a "Show all rides" link.

### Progress (`screens/ProgressScreen.jsx`)
Progression level bars (tap a zone → `#/progress/zone/<id>`), the chart card (SegmentedControl:
Hours · TSS · Elevation · eFTP), Power Skills (Rider Type opens a Sheet), and a "Workout
progression" row → `#/progress/workouts`.

### Settings (`screens/SettingsScreen.jsx`)
Cards, each with its own Save: **Profile** (FTP validated 100–500 with an inline error; if FTP
changed, a ConfirmSheet asks whether to reset levels; other fields are a draft saved with the
FTP), **Event** (Save; Delete with a ConfirmSheet), **Sync & backup** (Sync with Google Drive +
status line, Export backup, Import backup → ConfirmSheet "This replaces all rides on this device
(N) with M rides from the backup saved <date>"), **Progression levels** (Reset, confirmed).

### Pages and sheets
- **Ride page** (`WorkoutDetailPage`, `#/ride/<id>`): the old Workout Detail modal full screen —
  summary row, power/HR chart with shaded intervals, interval table, Edit ride button; header
  action **Re-detect** (rides with a stream; result as a toast).
- **Workout Progression** (`WorkoutProgressionPage`): zone Chips, Work Minutes / Avg Watts
  SegmentedControl, trend chart, session list (tap → Ride page); header action **Re-scan**
  (ConfirmSheet first). No zone selected: the 5 most recent indoor workouts.
- **Log Ride** (`LogRideSheet`): the old form, same fields, 16px inputs, sticky Save button.
  Import FIT/TCX pre-fills it; with a same-day match (`findMatchingRideForImport`) a ConfirmSheet
  offers **Attach to existing ride** (→ backfill, then the Ride page + toast) or **Save as a new
  ride**. Outdoor greys out Zone/Completed; Indoor greys out Distance/Elevation.
- **Post-log summary** (`PostLogSummarySheet`): shown after a new ride is saved; Continue
  closes it and animates the level bar.

## Key Constants
```javascript
ZONES             // Training zone definitions (recovery → anaerobic), with colours
DEFAULT_LEVELS    // Initial progression levels (all 1)
ZONE_EXPECTED_RPE // Auto-assigned expected RPE / workout level by zone (3-9)
ZONE_ADJACENCY    // Zone neighbour map for the trickle effect (one hop, 20% each)
STORAGE_KEY       // 'cycling-progression-data-v2' (state/AppDataContext.jsx)
SCHEMA_VERSION    // 2 (state/AppDataContext.jsx), written to every saved object
EFTP_PROMPT_KEY   // 'eftp-prompted-value' (device-local)
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
shortDayDate(str)        // "Wed, Sep 23"
getDefaultFormData()     // Default Log Ride form values (state/AppDataContext.jsx)
bestAveragePower(stream, seconds) // Best average power over any window of `seconds` in a downsampled stream
estimateRideFtp(ride)    // Best 20-min power x 0.95, or best 60-min power if higher; null if no stream/too short
buildEftpTimeline(history, today) // { byRideId, current, firstStreamDate }
applyDecay(levels, lastWorkedDates) // 14-day grace, -0.1/week (VO2max/Anaerobic 1.5x), floor max(1.0, level*0.5)
calculateNewLevel(current, workoutLevel, rpe, completed) // progression step (Phase 7 replaces it)
downsampleRecords(records, binSeconds=10) // FIT records -> { binSeconds, power[], hr[] }, null if no power data
detectIntervals(stream, ftp, laps, { indoor }) // -> { segments, sets, category, label } or null
calculateTrainingLoads(history, now) // { ctl, atl, tsb, weeklyTSS, twoWeekTSS, ctl14dAgo, atl14dAgo, tsb14dAgo }
getTrainingStatus(ctl, atl, tsb, ctl14dAgo) // { label, color, description }
weekComparison(history, now) // { thisWeek, lastWeek, days } for the Today "This week" card
buildAlerts(state, derived, today) // Today alerts (lib/alerts.js)
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
- **FTP-update alert** (V2 Phase 3; was a `window.confirm` from an effect): the Today tab shows
  an alert when `currentEftp.value >= currentFTP + EFTP_PROMPT_MARGIN` and the value is above
  `eftpPromptedValue`. The value is stored in `EFTP_PROMPT_KEY` when the user taps **Dismiss** or
  **Update FTP** — not when it is shown — so the alert stays until answered and never returns for
  the same (or a lower) estimate. Never offers to lower FTP.
- **Legacy `ride.eFTP`** (from CSV import or the old intervals.icu API sync) is never deleted
  or rewritten. It still feeds the eFTP Progress chart for months before the first FIT-based
  estimate exists (see chart specifics below), but nothing writes it any more (the CSV importer was removed in V2 Phase 1).
- **Known limitation**: the estimate is only as good as the hardest effort in the last 90 days.
  ERG/sweet-spot/threshold work (e.g. 2x20 @ 95% FTP) produces an eFTP *below* true FTP
  (0.95 x 0.95 ~= 90%). A real 20-minute test or a long hard climb gives the most accurate
  reading. This is why the prompt only ever offers to raise FTP.

## Data Import Sources
The intervals.icu API sync, CSV paste import and power-curve CSV import were removed in V2 Phase 1 (the API key had been hard-coded and published). Rides already imported from them keep all their fields. On load, the app deletes the old saved `intervals-icu-config` key from localStorage.

1. **FIT file upload (Session 16)** - "Import FIT/TCX File" button in the Log Ride sheet only. Parses `.fit` files client-side via the `fit-file-parser` npm package (`parseFitFile()`). Pre-fills Date, Duration, Normalized Power, Distance, Elevation, and Ride Type (Indoor/Outdoor, detected from GPS presence) into `formData`. Unlike the old bulk imports, this is not a separate unclassified ride source — it never sets Zone, Ride Name, or RPE, so the ride is saved through the normal `saveRide()` (formerly `handleLogWorkout`) path as `source: 'manual'` once the user fills in the rest and hits Save.
   **TCX (Session 21)**: the same button (now "Import FIT/TCX File") also accepts `.tcx`. `parseTcxFile(text)` reads the XML with the browser's built-in `DOMParser` (no dependency), maps each `<Trackpoint>` to FIT record field names (`timestamp`, `power`, `heart_rate`, `altitude`, `position_lat/long`, `distance`) and laps to `{ total_timer_time, avg_power, avg_heart_rate }`, then goes through the same `buildRideFromRecords()` as FIT — so stream, interval detection, backfill, eFTP and charts are identical. A trackpoint with no `<Watts>` counts as **0W** (TrainerDay omits power while coasting rather than writing 0). TCX has no NP field, so NP is always calculated from the power samples.

**Important (Session 5)**: the old CSV/API imports did NOT classify rides into zones or update progression levels. Imported rides have `zone: null` and `source: 'imported'`. The user must edit each ride (Rides tab, or via the Today "rides need a zone" alert) to assign a zone, at which point progression is calculated. This is intentional — NP-based auto-classification was unreliable for interval workouts. FIT file upload (above) is exempt from this because it never attempts zone classification at all.

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

**Outdoor rides and `intervalData.category` (V2 Phase 2, D5)**: an outdoor ride is never filed under a training zone — `zone` is always `null` for outdoor rides, and as of Phase 2 `intervalData.category` is always `null` for them too. Before Phase 2, `category` fell back to the *detected* zone whenever no zone was picked, which is exactly the outdoor case, so outdoor rides like a Draper or West Valley ride could show up under a Workout Progression zone tab (e.g. VO2max) even though they were never classified there. Every path that builds or updates `intervalData` now sets `category: null` for outdoor rides: both Log Ride save paths (`saveRide`, formerly `handleLogWorkout`), `redetectForRide` (used by Re-detect on the Ride page and Re-scan on Workout Progression), and the FIT/TCX backfill ("attach to existing ride") path. Importing an outdoor file also no longer pre-selects a zone on the Log Ride form. Workout Progression already filters rides with `intervalData?.category === zone`, so a `null` category is enough to exclude a ride — no separate outdoor check was needed there. A one-off migration in the load effect clears `category` to `null` on any already-saved ride with `rideType === 'Outdoor'` and a set category, so previously-misfiled rides self-correct the first time the app opens after this update; `label`, `sets` and `segments` are untouched, so the Ride page still shows the detected efforts.

**FIT backfill**: importing a FIT file whose date matches an already-logged ride offers to attach `stream`/`intervalData` to that ride in place, instead of creating a duplicate. TSS, zone, and progression fields on the existing ride are untouched by a backfill. **Matching by duration, not just date (V2 Phase 2)**: `findMatchingRideForImport()` picks, among rides logged on the same date as the imported file, the one whose stored `duration` is closest to the file's — and only within 25% (a ride with `duration` 0/unset always qualifies, since there's nothing to compare). If no same-day ride qualifies (e.g. two rides logged that day and neither is a close-enough match), the file becomes a new ride without asking, instead of guessing.

## Persistence
Single localStorage key (`STORAGE_KEY`) stores all app data in one JSON object:
- `schemaVersion` (2, since V2 Phase 3), `levels`, `history`, `ftp`, `intervalsFTP`, `event`, `userProfile`, `vo2maxEstimates`, `powerCurveData`, `exportedAt`, `lastSyncedAt`, `lastWorkedDates`
- The Export file and the Google Drive backup write the same fields (plus `syncVersion`; Export also `deviceId`). Files without `schemaVersion` (every backup made before Phase 3) load exactly as before — the loader never looks at it.
- Device-local keys, not synced: `eftp-prompted-value`.

**Load/save architecture** (in `AppDataProvider`): one load effect (runs once on mount with `try/catch`; also runs the Phase 2 outdoor-category migration and removes the old `intervals-icu-config` key) and one save effect (skips initial mount via the `isInitialMount` ref so defaults never overwrite saved data; the `setItem` call is wrapped in `try/catch` — a quota error shows the one remaining `alert()` asking the user to export a backup). Restoring a backup asks first (ConfirmSheet) and then applies the same field-by-field restore as before.

## Google Drive Sync
- **Module**: `src/google-drive-sync.js` — standalone OAuth + Drive API logic using Google Identity Services
- **Auth**: OAuth 2.0 implicit grant via `drive.file` scope (only accesses files created by the app)
- **Backup file**: `casey-rides-backup.json` in user's Google Drive root
- **Conflict resolution**: "Last write wins" based on `exportedAt` timestamp
- **Sync flow**: Authenticate → find/download remote → compare `exportedAt` → push (local newer) or pull (remote newer) or skip (equal)
- **UI**: Settings → Sync & backup → "Sync with Google Drive"; status line shows the result (clears after 5 s) or "Last synced …"
- **State**: `isDriveSyncing`, `driveSyncStatus`, `exportedAt`, `lastSyncedAt` (all in `AppDataContext`)
- **`markDataChanged()`**: Called on every data mutation to update `exportedAt` — the single source of truth for sync conflict resolution

## Key Functions
| Function | Where | Purpose |
|----------|-------|---------|
| `calculateTSS(np, minutes, ftp)` | `lib/load.js` | Training Stress Score from NP and duration |
| `calculateTrainingLoads(history)` | `lib/load.js` | CTL, ATL, TSB (+ 14-day-ago values) |
| `getTrainingStatus(...)` | `lib/load.js` | The one training status (TSB% zones, low-fitness override, transition detection) |
| `calculateNewLevel()` | `lib/progression.js` | Progression algorithm (expected vs actual RPE) |
| `saveRide()` (was `handleLogWorkout`) | `AppDataContext` | Save new or edited ride — trickle to adjacent zones, `lastWorkedDates` |
| `syncWithDrive()` (was `handleDriveSync`) | `AppDataContext` | Google Drive sync (push/pull based on `exportedAt`) |
| `markDataChanged()` | `AppDataContext` | Update `exportedAt` on any data mutation |
| `calculateEFTPHistory(history, eftpTimeline)` | `lib/chartData.js` | eFTP monthly peaks (11-month window); prefers calculated estimates, legacy `ride.eFTP` only before `firstStreamDate` |
| `calculateWeeklyHours/TSS`, `calculateMonthlyElevation` | `lib/chartData.js` | Chart data (20 weeks / 11 months) |
| `parseFitFile(arrayBuffer)`, `parseTcxFile(text)` | `lib/rideFiles.js` | File → Log Ride form values + stream + laps |
| `findMatchingRideForImport(rides, parsed)` | `lib/rideFiles.js` | Same-day ride with duration within 25% (unset duration always qualifies), else `null` |
| `buildAnalysisText(...)` | `lib/summary.js` | Copy for Claude text: FTP, W/kg, eFTP, event countdown, loads (7/14/28d TSS), weekly hours (4wk), recent workouts, interval progressions |
| `getDaysUntilEvent(event)` | `lib/summary.js` | Whole days to the event (negative once passed), `null` without a date |
| `buildAlerts(state, derived, today)` | `lib/alerts.js` | Today alerts |
| `redetectRide(id)` / `redetectAll()` | `AppDataContext` | Re-run detection against saved streams — no file re-import needed |

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

## Charts (Progress tab: Hours, TSS, Elevation, eFTP)

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

### Clipboard
`copyToClipboard()` (`lib/summary.js`) uses `navigator.clipboard.writeText()` with a `document.execCommand('copy')` fallback for HTTP/LAN contexts. A failure shows a toast.

### Training loads
`calculateTrainingLoads()` returns `{ ctl, atl, tsb, weeklyTSS, twoWeekTSS, ctl14dAgo, atl14dAgo, tsb14dAgo }`. `twoWeekTSS` is cumulative (includes the 7-day window). `ctl14dAgo` feeds Training Status transition detection; the three 14-day-ago values feed the Today tile deltas. All values are rounded; `tsb14dAgo = round(ctl14dAgo_raw - atl14dAgo_raw)`.

## Deployment

- **Hosting**: GitHub Pages at `https://caseywalrath.github.io/cycling/`
- **Base path**: `base: '/cycling/'` in `vite.config.js` (all asset URLs prefixed with `/cycling/`)
- **CI/CD**: GitHub Actions workflow (`.github/workflows/deploy.yml`) triggers on push to `main`
  - Runs `npm ci` → `npm run build` → uploads `dist/` → deploys to Pages
  - Uses `actions/configure-pages@v4` for proper Pages environment setup
- **PWA**: `scope` and `start_url` set to `/cycling/` in manifest
- **Branch model**: `main` is the deploy branch; `claude/` session branches merge into `main` via PR
