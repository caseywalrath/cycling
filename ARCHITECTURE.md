# Architecture

## File Structure
```
src/
  App.jsx              # Single-file application (~4900 lines)
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
Single component (`ProgressionTracker`) with modal-based navigation. No component splitting - all UI in one file.

### UI Sections (rendered conditionally)
- **Main View**: Dashboard with metrics cards, progression levels, charts
- **Modals**: Log Ride, History, Settings, Profile, Event, CSV Import, intervals.icu Sync, Workout Detail, Workout Progression

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
| `intervalsFTP` | eFTP from intervals.icu (with decay) |

### UI State
Modal visibility: `showLogRideModal`, `showHistoryModal`, `showIntervalsSyncModal`, etc.

### Form State
| State | Purpose |
|-------|---------|
| `formData` | Log ride form fields (eFTP shown in both log and edit, defaults to latest from history) |
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

## Utility Functions (module-level)
```javascript
toLocalDateStr(date)     // YYYY-MM-DD using local timezone (replaces toISOString)
parseDateLocal(dateStr)  // Parse "YYYY-MM-DD" as local midnight (avoids UTC off-by-one)
formatDateWithDay(str)   // "2026-02-05 - Thursday" from YYYY-MM-DD string
getDefaultFormData(hist) // Default form values with latest eFTP from history
applyDecay(levels, lastWorkedDates) // Returns levels with decay applied (14-day grace,
                         //   -0.1/week, VO2max/Anaerobic 1.5x, floor max(1.0, level*0.5))
downsampleRecords(records, binSeconds=10) // FIT records -> { binSeconds, power[], hr[] }, null if no power data
detectIntervals(stream, ftp, laps)  // Step-detection on smoothed power -> { segments, sets, category, label } or null
buildIntervalLabel(sets)            // Sets -> display string, e.g. "4x6 @ 280W"
```

**Important**: Never use `new Date("YYYY-MM-DD")` to parse date strings — it creates midnight UTC, which in US timezones becomes the previous evening. Always use `parseDateLocal()` for ride/event date strings.

## Data Import Sources
1. **intervals.icu API** - Direct sync via athlete ID + API key
2. **CSV paste** - Manual paste from intervals.icu export
3. **FIT file upload (Session 16)** - "Import FIT File" button inside the Log Ride modal only. Parses `.fit` files client-side via the `fit-file-parser` npm package (`parseFitFile()`). Pre-fills Date, Duration, Normalized Power, Distance, Elevation, and Ride Type (Indoor/Outdoor, detected from GPS presence) into `formData`. Unlike the two bulk import sources below, this is not a separate unclassified ride source — it never sets Zone, Ride Name, or RPE, so the ride is saved through the normal `handleLogWorkout` path as `source: 'manual'` once the user fills in the rest and hits Save.

**Important (Session 5)**: CSV/API imports do NOT classify rides into zones or update progression levels. Imported rides have `zone: null` and `source: 'imported'`. The user must edit each ride in Ride History to assign a zone, at which point progression is calculated. This is intentional — NP-based auto-classification was unreliable for interval workouts. FIT file upload (above) is exempt from this because it never attempts zone classification at all.

**Interval detection exception (Session 18)**: FIT import now also pre-selects the Zone field to the category `detectIntervals()` derives from the ride's actual interval structure (power segments vs. FTP). This is a narrow, explicitly agreed exception to the Session 5 rule above — the user still confirms/adjusts the Zone before Save, and it's structural detection, not the rejected NP-based guessing.

## Ride Source Model
Every ride entry has a `source` field:
- `'imported'` — From CSV or intervals.icu API. Has `zone: null`, no progression data.
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

**FIT backfill**: importing a FIT file whose date matches an already-logged ride offers to attach `stream`/`intervalData` to that ride in place, instead of creating a duplicate. TSS, zone, and progression fields on the existing ride are untouched by a backfill.

## Persistence
Single localStorage key (`STORAGE_KEY`) stores all app data in one JSON object:
- `levels`, `history`, `ftp`, `intervalsFTP`, `event`, `userProfile`, `vo2maxEstimates`, `powerCurveData`, `exportedAt`, `lastSyncedAt`, `lastWorkedDates`

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
| `syncFromIntervals()` | Fetch rides from intervals.icu API |
| `importCSVData()` | Parse and import CSV data |
| `calculateEFTPHistory()` | eFTP monthly peaks (11-month rolling window) |
| `parseFitFile(arrayBuffer)` | Parses a `.fit` file into Log Ride form field values (date, duration, NP, distance, elevation, ride type) |
| `calculateNormalizedPower(powerSamples)` | NP from a per-second power stream — 30s rolling average, 4th-power mean, 4th root |
| `calculateMonthlyElevation()` | Monthly elevation totals (11-month rolling window, rides with elevation > 0) |
| `getTrainingStatus()` | Training status from TSB% with low-fitness override and transition detection |
| `getCalendarDays()` | Generate month grid day objects (Monday-start, 35 or 42 cells) |
| `copyForAnalysis()` | Clipboard export: FTP, W/kg, eFTP, training status, loads (7/14/28d TSS), weekly hours (4wk), recent workouts with day-of-week and ride type, interval progressions (last 3 sessions/category, if any) |
| `downsampleRecords(records, binSeconds)` | FIT records → 10s-binned `{ binSeconds, power[], hr[] }` for the Workout Detail chart |
| `detectIntervals(stream, ftp, laps)` | Step-detection (85% FTP threshold, 90s min work, small-gap merging) with a lap-based fallback; groups segments into sets and categorizes by dominant set's %FTP |
| `buildIntervalLabel(sets)` | Sets → display string, e.g. `"4x6 @ 280W"` |

## Charts (Tabbed: Hours, TSS, Elevation, eFTP)

All four charts use Recharts `<AreaChart>` inside `<ResponsiveContainer>` (height 200px).

| Chart | Color | dataKey | Y-axis width | Dot style |
|-------|-------|---------|-------------|-----------|
| Weekly Hours | Orange `#FB923C` | `hours` | 45 | `r: 4` solid fill |
| Weekly TSS | Blue `#3B82F6` | `tss` | 45 | `r: 4` solid fill |
| Monthly Elevation | Green `#22C55E` | `elevation` | 55 | `r: 4` solid fill |
| eFTP Progress | Purple `#A855F7` | `eFTP` | 55 | `r: 4` solid fill |

**eFTP chart specifics:**
- Data: `calculateEFTPHistory()` — one point per calendar month (highest eFTP that month)
- Window: 11 months back from 1st of current month (avoids duplicate month labels on X-axis)
- X-axis: `dataKey="month"` (short name: Jan, Feb, etc.), evenly spaced
- Tooltip (`EFTPTooltip`): month/year label, peak wattage, ride name
- Y-axis domain: `dataMin - 10` to `dataMax + 10`

**Elevation chart specifics:**
- Data: `calculateMonthlyElevation()` — one point per calendar month (total elevation that month)
- Window: 11 months back from 1st of current month (matches eFTP chart)
- X-axis: `dataKey="month"` (short name: Jan, Feb, etc.), evenly spaced
- Tooltip: month/year label, total elevation, ride count (only rides with elevation > 0)

**Weekly charts** (Hours, TSS): X-axis uses `dataKey="label"` with `interval="preserveStartEnd"`. Tooltips show week label, value, and ride count.

## UI Layout (top to bottom, as of Session 8)

1. **Header bar**: App title, FTP/W·kg/eFTP display, Log Ride (green), Sync (blue), Event, Profile buttons. Sync status message shown below header when active.
2. **Progression Level bars**: One per zone (excludes Recovery), with recent change badges
3. **Charts**: Tabbed — Weekly Hours, Weekly TSS, Elevation, eFTP History
4. **Power Skills card**: Radar chart (3/5 width) + horizontal power bars (2/5 width), requires power curve CSV import. **Rider Type** button (top-right) shows phenotype derived from Sprint/Attack/Climb percentile averages (6 types: Sprinter, Puncheur, Rouleur, Time Trialist, Climber, All-Rounder). Click opens explanation modal.
5. **Training Load cards**: CTL / ATL / TSB in a 3-column grid
6. **Training Summary + Training Status** (side-by-side, 2-column grid): Left: `TSS [7d] [14d] [28d]` and `Longest (30d)`. Right: Training Status badge (color-coded pill with TSB%) and, below it, the **Copy for Claude** button (moved here in Session 17). Uses TSB% zones: Transition >+25%, Fresh +5–25%, Grey Zone -10–+5%, Optimal -30–-10%, High Risk <-30%. Low fitness override (CTL<35) shows Building states instead.
7. **Monthly Activity Calendar**: Strava-style month grid (Mon-start). Navigation arrows to scroll months. Ride days show solid blue circle with bike SVG icon; no-ride days show gray outline with day number. Today highlighted with blue border/ring. Adjacent-month days faded.
8. **Fitness Progress bar**: CTL toward target 100. Shows `Days to Event: X | CTL Target: 80-100`
9. **Ride History button**: Full-width, opens History modal
10. **Workout Progression button** (Session 18): Full-width, directly below Ride History, opens the Interval Progression modal
11. **Bottom action bar**: Import | Export | Paste CSV | Import Power (left) — Reset Levels (right, subtle text link)

### Modal system
All secondary views are modals (`fixed inset-0 z-50`). Clicking the backdrop (outside the modal) closes it (via `onClick` on backdrop + `stopPropagation` on inner content). Key modals:
- **Log Ride** (`showLogRideModal`): Also used for editing — `editingRide` state holds the ID. Outdoor rides grey out Zone/Completed; Indoor greys out Distance/Elevation. Form closes immediately on Save. Since Session 18, a FIT import that detects intervals shows a confirmation panel under the Import FIT File button (`pendingFitDetail`) before Save.
- **Ride History** (`showHistoryModal`): Scrollable list with edit/delete per ride. Since Session 18, entries with `stream`/`intervalData` show a "📊" button (opens Workout Detail) and the detected interval label as a tag.
- **Post-Log Summary** (`showPostLogSummary`): Shows progression change after logging
- **CSV Import** (`showCSVImport`): Paste textarea for intervals.icu CSV
- **Profile** (`showProfileModal`): Weight, HR, age settings
- **Event** (`showEventModal`): Goal event configuration
- **Workout Detail** (`showWorkoutDetail`, Session 18): Power/HR timeline chart (Recharts `ComposedChart`) with detected intervals shaded via `ReferenceArea`, plus an interval table. Opened from Ride History's 📊 button, the Progression modal's session list, or automatically after a FIT backfill.
- **Workout Progression** (`showProgressionModal`, Session 18): Opens with no zone tab selected — that default view lists the 5 most recent indoor workouts with their zones. Selecting a category tab (`progressionCategory`) switches to that zone's interval session history: a work-minutes/avg-watts trend chart and a newest-first session list — the planning view for deciding the next block's duration/wattage.

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
