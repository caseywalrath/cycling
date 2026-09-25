# Architecture

**As of V2 Phase 5 (Session 24).** A four-tab iPhone-first PWA: **Today, Rides, Progress,
Settings**. All data lives in one React context; screens are built from a small UI kit. Rides,
the Ride page, Log Ride and Settings have their Phase 4 design (filters/search, a redesigned
calendar, an import summary + manual-entry Log Ride, and Google Drive auto-sync). Phase 5 adds a
metrics engine — full-resolution power/HR data at import, heart-rate TSS, and per-ride/
across-rides analysis — with the Ride page now showing best efforts, time in zones, heart-rate
drift and efficiency. Progress still has its Phase 3 look; Phase 6 redesigns it and wires these
new metrics into charts and alerts.

## Testing (`npm test`)

Phase 5 adds **vitest** (the only new dependency the whole V2 plan allows) as the project's test
runner: `npm test` runs `vitest run`. Tests live next to the code they test, as `*.test.js`, and
cover the pure `src/lib/` functions only (no React component tests) — `dates.test.js`,
`zones.test.js`, `rideFiles.test.js`, `eftp.test.js`, `intervals.test.js`, `load.test.js`,
`analysis.test.js`, `records.test.js`. This is separate from `tools/v2-check.mjs`, the
Playwright-based regression check (§0.4 in `V2_PLAN.md`), which drives the real app in a browser.

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
    ActivityCalendar.jsx     # monthly calendar (Rides tab): zone-coloured ride dots, week-TSS
                             #   column, day taps (V2 Phase 4)
    RideRow.jsx              # one ride row in the Rides list (V2 Phase 4; replaces RideHistoryList)
    PostLogSummarySheet.jsx  # level before → after, trickle, TSS/IF/RPE
  screens/
    TodayScreen.jsx          # Today tab (the house style: later phases copy it)
    RidesScreen.jsx          # calendar, filter chips + search, ride list grouped by month
                             #   (V2 Phase 4); ?filter=needs-zone
    ProgressScreen.jsx       # levels, charts, Power Skills, Workout progression row
    SettingsScreen.jsx       # profile (+ zone table, LTHR), event, sync & backup, old imported
                             #   rides, reset levels, about (V2 Phase 4)
    WorkoutDetailPage.jsx    # Ride page at #/ride/<id> (V2 Phase 4 rebuild)
    WorkoutProgressionPage.jsx # #/progress/workouts and #/progress/zone/<zoneId>
    LogRideSheet.jsx         # Log Ride v2: Import file / Enter manually (V2 Phase 4)
  lib/                       # pure helpers, no React
    dates.js                 #   toLocalDateStr, parseDateLocal, parseDuration, formatDateWithDay, DAYS_OF_WEEK
    zones.js                 #   ZONES, DEFAULT_LEVELS, ZONE_EXPECTED_RPE, ZONE_ADJACENCY, ZONE_BOUNDS,
                             #   zoneForRatio, categoryForRatio, zoneWattRange, zoneRangeLabel, getZoneName, getZoneColor
    rideFiles.js             #   parseFitFile, buildRideFromRecords, parseTcxFile, downsampleRecords,
                             #   calculateNormalizedPower, findMatchingRideForImport,
                             #   toOneHzSeries, bestsFromOneHz, hrStatsFromSeries, avgPowerFromSeries (Phase 5)
    eftp.js                  #   EFTP_* constants, bestAveragePower, estimateRideFtp, buildEftpTimeline
    intervals.js             #   interval-detection constants, detectIntervals and helpers
    progression.js           #   applyDecay, calculateNewLevel
    load.js                  #   calculateTSS, calculateIF, calculateTrainingLoads, getTrainingStatus,
                             #   estimateLthr, hrTss, dailyLoadSeries, rampRate (Phase 5)
    analysis.js              #   Phase 5: per-ride analysis — bestsForRide, timeInZones,
                             #   aerobicDecoupling, decouplingBand, efficiencyFactor, expectedRpe, rpeMismatch
    records.js                #   Phase 5: across-rides analysis — powerCurve, personalBests,
                             #   newBestsForRide, records, observedMaxHr
    chartData.js             #   calculateWeeklyHours, calculateWeeklyTSS, calculateMonthlyElevation, calculateEFTPHistory
    summary.js               #   getDaysUntilEvent, weekComparison, latestRide, buildAnalysisText (Copy for Claude), copyToClipboard
    alerts.js                #   buildAlerts, ridesNeedingZone (Today alerts)
    format.js                #   formatChange, getChangeDescription, ordinal, shortDayDate, formatMinutes
    *.test.js                #   Phase 5: vitest unit tests, next to the code they test
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
| `userProfile` | `{ maxHR, restingHR, lthr, weight (lb), age, sex }` — `lthr` (Threshold HR) is optional, added V2 Phase 4, read by Phase 5's heart-rate TSS |
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
| `hasUnsyncedChanges` | V2 Phase 4: true once a data change hasn't auto-synced yet (no valid Google token when the 3s debounce fired). Shown as a badge on the Settings tab; cleared on the next successful sync (auto or manual) |

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
| `oldImportedRideCount()` | Count of indoor, `source: 'imported'`, `zone == null`, not-yet-`historical` rides | number |
| `hideOldImportedRides()` | Sets `historical: true` on those rides — V2 Phase 4's Settings "Stop asking" (caller confirms first) | – |
| `showOldImportedRides()` | Clears `historical` on every ride that has it — "Show them again" | – |
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
| `Button` | `variant`: `primary` (green), `secondary`, `ghost`, `destructive`, `ghost-destructive`; `size`: `md`/`sm`; `block`; `rounded` (default `rounded-xl`, pass `rounded-full` for a pill — a class in `className` alone can't reliably override the base radius). Min height 44px |
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

### Rides (`screens/RidesScreen.jsx`, V2 Phase 4 rebuild)
1. **`ActivityCalendar`**: Monday-start month grid. Each ride day is a dot coloured by zone
   (`rideDotColor`/`getZoneColor`); outdoor is teal (`#14B8A6`), an indoor ride still waiting for
   a zone is grey (`#6B7280`), and a day with more than one ride is a two-tone split dot
   (`DayDot`). An 8th column (`data-week-tss`) shows that week's total TSS, summed straight from
   `history` regardless of which month is on screen. Tapping a single-ride day opens the Ride
   page; a multi-ride day opens a small `Sheet` listing that day's rides; tapping an empty past
   or today date calls `openLogRide(dateStr)` (Shell/`ShellContext`) to open Log Ride with that
   date already filled in. A future empty date isn't tappable.
2. **Filter chips** (`Chip`): All · Indoor · Outdoor · Needs zone (`ridesNeedingZone`, excludes
   `historical` rides), plus a search box matching ride name/notes.
3. **Ride list** (`RideRow`, replaces the old `RideHistoryList` cards): a 4px zone-coloured left
   edge, name, short date, duration · TSS, and a second line — the interval label (indoor) or
   distance/elevation (outdoor), or "Needs a zone" in yellow. Tapping a row opens the Ride page.
   Grouped by calendar month with a sticky month header, most recent first, loaded 3 months at a
   time with a "Show older rides" button so 150+ rides stay fast to render.

### Progress (`screens/ProgressScreen.jsx`)
Progression level bars (tap a zone → `#/progress/zone/<id>`), the chart card (SegmentedControl:
Hours · TSS · Elevation · eFTP), Power Skills (Rider Type opens a Sheet), and a "Workout
progression" row → `#/progress/workouts`. Still its Phase 3 look; Phase 6 redesigns it.

### Settings (`screens/SettingsScreen.jsx`, V2 Phase 4 rebuild)
Cards, each with its own Save: **Profile** (FTP validated 100–500 with an inline error and a live
zone-watt table underneath it, from `zoneRangeLabel`, updating as the FTP box is typed; if FTP
changed, a ConfirmSheet asks whether to reset levels; Max HR, Resting HR, an optional **Threshold
HR / LTHR** field — "leave blank to estimate from Max HR", read by Phase 5 — Weight, Age, Sex are
a draft saved together with the FTP), **Event** (Save; Delete with a ConfirmSheet), **Sync &
backup** (Sync with Google Drive; status line shows a sync result, "Unsynced changes"
(`hasUnsyncedChanges`), or "Last synced …"; Export backup, Import backup → ConfirmSheet "This
replaces all rides on this device (N) with M rides from the backup saved <date>"), **Old imported
rides** (only shown when there are any: "Stop asking about N old imported rides", confirmed, sets
`historical: true`; a "Show them again" link reverses it — see `ridesNeedingZone`), **Progression
levels** (Reset, confirmed), **About** (app version from `package.json`, a link to the
CHANGELOG).

### Pages and sheets
- **Ride page** (`WorkoutDetailPage`, `#/ride/<id>`, V2 Phase 4 rebuild, Phase 5 metrics added):
  header (name, date, type/zone pill, interval label); a 3×2 `StatTile` stats grid (Duration,
  Distance, Elevation, NP, TSS, IF), plus Avg HR when the ride has a stream with heart rate; the
  power/HR chart with shaded intervals (rides with a stream only — HR-only rides, `stream.power
  === null`, draw the HR line alone with no power axis); the interval table; notes; and an
  action row — **Edit ride**, **Attach ride file** (runs the FIT/TCX backfill for *this* ride
  directly, no date guessing — calls `importRideFile` then `attachRideFile`), and **Delete**
  (destructive ConfirmSheet, then back to Rides). Header right action: **Re-detect** (rides with
  a stream; result as a toast). **Phase 5 metrics** (each shown only when the ride has the data
  for it — see "Metrics engine" below): a **best efforts** table (5s/1m/5m/20m/60m, `★ New best`
  badges from `newBestsForRide`, a footnote when the bests come from the coarser 10s stream
  instead of 1Hz data); a **time in zones** stacked bar with minutes per zone
  (`timeInZones`, needs a power stream and the current FTP); **heart-rate drift**
  (`aerobicDecoupling` + `decouplingBand`, steady rides only); **efficiency** (`efficiencyFactor`,
  "Higher over time = fitter").
- **Workout Progression** (`WorkoutProgressionPage`): zone Chips, Work Minutes / Avg Watts
  SegmentedControl, trend chart, session list (tap → Ride page); header action **Re-scan**
  (ConfirmSheet first). No zone selected: the 5 most recent indoor workouts.
- **Log Ride v2** (`LogRideSheet`, V2 Phase 4 rebuild): two entry modes for a new ride, chosen
  with a `SegmentedControl` — **Import file** (default) and **Enter manually**. No invented
  defaults: `getDefaultFormData()` starts duration, normalized power and zone empty/unset; Save
  stays disabled until duration > 0, normalized power > 0, and an indoor ride has a zone
  (outdoor rides never need one, D5). Import mode shows a read-only summary card (date, type,
  duration, distance/elevation, NP, estimated TSS/IF, detected interval label) with an "Edit
  numbers" link that reveals the same editable fields Enter-manually mode uses. A same-day/
  duration match (`findMatchingRideForImport`) shows an inline **Attach this file to it** / **Save
  as a new ride** card in the sheet itself (replacing a ConfirmSheet popup for this one case) —
  attaching runs the backfill and opens the Ride page with a toast; declining falls through to
  the normal import summary. Fields common to both modes: Ride name (defaults to "Indoor
  ride"/"Outdoor ride" at save time if left blank), Zone `Chip`s (indoor only, pre-selected by
  detection), Completed all intervals (indoor only), Effort (RPE) as ten 44px tap targets (two
  rows of 5) with the zone's expected effort ringed, and Notes. Editing an existing ride always
  shows the full manual field set (attaching a file to an already-logged ride is done from the
  Ride page's "Attach ride file" instead); saving returns to wherever the sheet was opened from
  (Ride page or the Rides list), never to a fixed screen.
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
downsampleRecords(records, binSeconds=10) // FIT records -> { binSeconds, power[]|null, hr[] }, null if no power AND no HR
detectIntervals(stream, ftp, laps, { indoor }) // -> { segments, sets, category, label } or null
calculateTrainingLoads(history, now) // { ctl, atl, tsb, weeklyTSS, twoWeekTSS, ctl14dAgo, atl14dAgo, tsb14dAgo }
getTrainingStatus(ctl, atl, tsb, ctl14dAgo) // { label, color, description }
weekComparison(history, now) // { thisWeek, lastWeek, days } for the Today "This week" card
buildAlerts(state, derived, today) // Today alerts (lib/alerts.js)

// V2 Phase 5 — see "Metrics Engine" above for details
toOneHzSeries(records)   // { power: number[]|null, hr: (number|null)[] }, 1-second resolution
bestsFromOneHz(power), hrStatsFromSeries(hr), avgPowerFromSeries(power) // lib/rideFiles.js
estimateLthr(profile), hrTss(durationMin, avgHr, restingHr, lthr)       // lib/load.js
dailyLoadSeries(history, today), rampRate(series)                       // lib/load.js
bestsForRide(ride), timeInZones(ride, ftp), aerobicDecoupling(ride)     // lib/analysis.js
efficiencyFactor(ride), expectedRpe(if), rpeMismatch(ride)              // lib/analysis.js
powerCurve(history, {from,to}), personalBests(history)                 // lib/records.js
newBestsForRide(history, ride), records(history), observedMaxHr(history) // lib/records.js
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

**`historical` (V2 Phase 4, optional, default false/absent)**: set on an indoor `source:
'imported'`, zone-less ride by Settings → Old imported rides → "Stop asking about N old imported
rides" (`hideOldImportedRides()`). It excludes the ride from `ridesNeedingZone()` — so it no
longer appears in the Rides tab's "Needs zone" filter or counts toward the Today "N rides need a
zone" alert — without deleting or reclassifying anything. "Show them again"
(`showOldImportedRides()`) clears it. Every other read of a ride's zone/classification is
unaffected.

## Interval Data (Session 18)
Two optional fields on ride history entries, both `undefined` on rides that predate this feature — every consumer null-checks:
```javascript
stream: { binSeconds: 10, power: [145, 150, ...] | null, hr: [98, 101, ...] } // downsampled per-ride
  // stream, ~8-12KB/ride. power is null (V2 Phase 5) for a ride with heart rate but no power.
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

## Metrics Engine (V2 Phase 5)

**New optional ride fields** (all `undefined`/absent on rides saved before Phase 5 — every
consumer null-checks; nothing is ever backfilled onto an existing ride's other fields):

```javascript
bests: { "5": 620, "15": 480, "30": 410, "60": 340, "120": 290, "300": 250, "600": 230, ... }
  // best average power (W) per duration in seconds, from the ride's full 1-second data.
  // Keys for durations longer than the ride are omitted. Set at import (both save paths and
  // the "Attach ride file" backfill) by rideFiles.js's toOneHzSeries()+bestsFromOneHz().
hrStats: { avg: 142, max: 176 }   // from the same 1-second data; null if the ride has no HR
avgPower: 187                     // mean of the 1-second power series INCLUDING zeros/coasting
tssSource: 'hr'                   // present only for a heart-rate-TSS ride; absent means 'power'
```

**Full-resolution (1Hz) data at import** (`toOneHzSeries()` in `lib/rideFiles.js`): a FIT/TCX
file's raw per-record data is placed at 1-second resolution (rounded offset from the first
record). A gap of ≤10s between two records forward-fills the earlier one's power/HR across it
(FIT "smart recording" only writes a new record every few seconds when nothing changes); a
gap of >10s is treated as a stop — power 0, HR unknown (`null`) for the whole gap. This is
**separate from** the existing `stream` field (`downsampleRecords()`, still 10-second bins, used
for the Ride page chart and `detectIntervals()`) — `bests`/`hrStats`/`avgPower` are the only
things computed at 1Hz; everything else still works from the coarser stream.

**Heart-rate-only rides** (a file with HR but no power at all — an outdoor ride with a strap and
no power meter): `downsampleRecords()` now returns a stream with `power: null` (instead of
`null` for the whole stream) whenever there's power **or** HR, so these rides still get a chart.
Every reader of `stream.power` across the codebase is null-safe: `bestAveragePower`,
`detectIntervals` and `estimateRideFtp` all return `null` (never `0`, which could otherwise look
like a real, terrible number) for an HR-only stream; the Ride page chart draws the HR line alone
with no power axis; `toOneHzSeries()` returns `power: null` the same way.

**Heart-rate TSS** (`lib/load.js`): when the just-imported file has HR but no power,
`computeRideMetrics()` in `AppDataContext` saves the ride with `tss` from `hrTss()` and
`tssSource: 'hr'` instead of the usual power-based TSS, and leaves `normalizedPower`/
`intensityFactor` `null` (there's nothing to compute them from). Manual entry is unchanged —
always power-based. `estimateLthr(profile)` uses `profile.lthr` if the user set one (Settings →
Profile → Threshold HR), else estimates it as `0.89 × maxHR`, else `null`. `hrTss(durationMin,
avgHr, restingHr, lthr)` returns `null` if any input is missing or `lthr <= restingHr`, otherwise
`round(durationMin/60 × hrIF² × 100)` where `hrIF = (avgHr - restingHr) / (lthr - restingHr)` —
the same 100-at-threshold-effort scale as power-based TSS. The Log Ride sheet's import summary
shows "TSS 64 (from heart rate)" for these rides, and Save no longer requires NP > 0 for them.

**Training load history** (`lib/load.js`): `dailyLoadSeries(history, today)` returns one
`{ date, tss, ctl, atl, tsb }` entry per calendar day from the first ride to today, using the
same 42-day CTL / 7-day ATL exponential smoothing as before — moved out of
`calculateTrainingLoads()` so a future Fitness chart (Phase 6) can plot the whole history without
re-deriving the math. `calculateTrainingLoads()` is rebuilt on top of it with **identical
output** (verified by both a unit test and the regression check). `rampRate(series)` is CTL
today minus CTL 7 days ago, one decimal — `null` without at least a week of series.

**Per-ride analysis** (`lib/analysis.js`) — each returns `null` when the ride lacks the data it
needs, rather than a misleading number:
- `bestsForRide(ride)` → `{ bests, source }`. Prefers the ride's own `bests` (1-second
  resolution, `source: '1s'`); falls back to the saved 10-second `stream` for durations ≥60s on
  older rides (`source: '10s'`) — the Ride page shows a footnote to re-attach the file for
  sprint-length bests in that case.
- `timeInZones(ride, ftp)` → seconds per zone, binned from `stream.power` via `zoneForRatio`;
  null power bins are skipped, not counted as 0W.
- `aerobicDecoupling(ride)` → % heart-rate drift between the first and second half of a steady
  ride (drops the first 10 minutes, needs ≥60 min, no detected intervals, and VI ≤ 1.15).
  `decouplingBand(pct)` gives the sentence + color: <5% "Solid aerobic base" (green), 5–8% "Some
  drift" (amber), >8% "Drifting: base needs work" (red).
- `efficiencyFactor(ride)` → NP / avg HR, only for an easy, long ride (IF ≤0.80, ≥45 min).
- `expectedRpe(intensityFactor)` / `rpeMismatch(ride)` → the RPE a rider would be expected to
  report at a given IF, and how far the ride's actual RPE was from it (used by a Phase 6 alert).

**Across-rides analysis** (`lib/records.js`):
- `powerCurve(history, { from, to })` → per duration, the best power across the (optionally
  date-bounded) rides in `history`, with which ride and date set it.
- `personalBests(history)` → `{ allTime, last90Days }` power curves.
- `newBestsForRide(history, ride)` → durations where `ride` set a new all-time or 90-day best
  (drives the Ride page's "★ New best" badges, and a Phase 6 Today alert).
- `records(history)` → longest ride (by duration and by distance), most elevation, highest TSS,
  and year-to-date totals (distance/hours/elevation/rides) vs. the same date last year.
- `observedMaxHr(history)` → the highest HR ever seen, preferring `hrStats.max` and falling back
  to the stream for older rides (feeds a Phase 6 "update your Max HR?" alert).

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
- **UI**: Settings → Sync & backup → "Sync with Google Drive"; status line shows the result (clears after 5 s), "Unsynced changes", or "Last synced …"
- **State**: `isDriveSyncing`, `driveSyncStatus`, `exportedAt`, `lastSyncedAt`, `hasUnsyncedChanges` (all in `AppDataContext`)
- **`markDataChanged()`**: Called on every data mutation to update `exportedAt` — the single source of truth for sync conflict resolution
- **Auto-sync (V2 Phase 4, D3)**: after any data change, `AppDataContext` waits 3s (a debounced
  `setTimeout`, reset on every further change, so a burst of edits triggers one sync, not one per
  keystroke). When it fires: if `GoogleDriveSync.hasValidToken()`, it calls `syncWithDrive()`
  silently and clears `hasUnsyncedChanges`; otherwise it sets `hasUnsyncedChanges = true`, shown
  as a red badge on the Settings tab (`TabBar`'s `badges` prop). **A sign-in popup is never opened
  automatically** — `hasValidToken()` is checked first, so the only code path that can start a new
  OAuth flow (via `authenticate()`'s `requestAccessToken`) is a user tapping "Sync with Google
  Drive" in Settings.
- **`tokenExpiresAt`**: set in `google-drive-sync.js` wherever `accessToken` is set, to
  `Date.now() + expires_in * 1000`. **`hasValidToken()`** is true with a token and more than 60s
  left. `authenticate()` now treats an expired token as absent (before Phase 4 it reused a stale
  token forever and failed on the next Drive API call) instead of skipping straight to
  `requestAccessToken`.
- On app open, the app never pulls automatically; a valid token surviving a reload is the only
  case auto-sync can push without a tap, and pulling only ever happens from a user-initiated Sync.

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
