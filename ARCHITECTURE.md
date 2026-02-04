# Architecture

## File Structure
```
src/
  App.jsx      # Single-file application (~3600 lines)
  main.jsx     # React entry point
  index.css    # Tailwind directives
public/
  pwa-*.png    # PWA icons
vite.config.js # Vite + PWA config
```

## Component Architecture
Single component (`ProgressionTracker`) with modal-based navigation. No component splitting - all UI in one file.

### UI Sections (rendered conditionally)
- **Main View**: Dashboard with metrics cards, progression levels, charts
- **Modals**: Log Ride, History, Settings, Profile, Event, CSV Import, intervals.icu Sync

## State Management
All state via `useState` hooks. No external state library.

### Core State
| State | Purpose |
|-------|---------|
| `levels` | Progression levels per zone (1-10 scale) |
| `displayLevels` | Animated display values for levels |
| `history` | Array of ride objects |
| `currentFTP` | User's FTP setting |
| `intervalsFTP` | eFTP from intervals.icu (with decay) |

### UI State
Modal visibility: `showLogRideModal`, `showHistoryModal`, `showIntervalsSyncModal`, etc.

### Form State
| State | Purpose |
|-------|---------|
| `formData` | Log ride form fields |
| `editingRide` | ID of ride being edited (null = new ride) |

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
STORAGE_KEY     // localStorage key: 'cycling-progression-data-v2'
```

## Data Import Sources
1. **intervals.icu API** - Direct sync via athlete ID + API key
2. **CSV paste** - Manual paste from intervals.icu export

**Important (Session 5)**: Imports do NOT classify rides into zones or update progression levels. Imported rides have `zone: null` and `source: 'imported'`. The user must edit each ride in Ride History to assign a zone, at which point progression is calculated. This is intentional — NP-based auto-classification was unreliable for interval workouts.

## Ride Source Model
Every ride entry has a `source` field:
- `'imported'` — From CSV or intervals.icu API. Has `zone: null`, no progression data.
- `'manual'` — Logged or classified by user. Has a zone, progression levels calculated.
- `null`/missing — Legacy rides from before Session 5. Treated as classified (they have zone data from the old auto-classification logic).

When editing an imported ride, the handler detects the zone change (`wasUnclassified → isNowClassified`) and recalculates progression against the current level for that zone. The ride is re-tagged as `source: 'manual'`.

Recovery zone (`zone: 'recovery'`) is excluded from progression level updates regardless of source.

## Persistence
Single localStorage key stores:
- `levels`, `history`, `ftp`, `intervalsFTP`, `event`, `userProfile`, `vo2maxEstimates`

## Key Functions
| Function | Purpose |
|----------|---------|
| `calculateTSS()` | Training Stress Score from NP and duration |
| `calculateTrainingLoads()` | CTL, ATL, TSB calculations |
| `calculateNewLevel()` | Progression algorithm (expected vs actual RPE) |
| `handleLogWorkout()` | Save new or edited ride |
| `syncFromIntervals()` | Fetch rides from intervals.icu API |
| `importCSVData()` | Parse and import CSV data |
| `calculateEFTPHistory()` | eFTP monthly peaks (11-month rolling window) |
| `getTrainingStatus()` | Training status from TSB% with low-fitness override and transition detection |
| `getCalendarDays()` | Generate month grid day objects (Monday-start, 35 or 42 cells) |

## Charts (Tabbed: Hours, TSS, Elevation, eFTP)

All four charts use Recharts `<AreaChart>` inside `<ResponsiveContainer>` (height 200px).

| Chart | Color | dataKey | Y-axis width | Dot style |
|-------|-------|---------|-------------|-----------|
| Weekly Hours | Orange `#FB923C` | `hours` | 45 | `r: 4` solid fill |
| Weekly TSS | Blue `#3B82F6` | `tss` | 45 | `r: 4` solid fill |
| Weekly Elevation | Green `#22C55E` | `elevation` | 55 | `r: 4` solid fill |
| eFTP Progress | Purple `#A855F7` | `eFTP` | 55 | `r: 4` solid fill |

**eFTP chart specifics:**
- Data: `calculateEFTPHistory()` — one point per calendar month (highest eFTP that month)
- Window: 11 months back from 1st of current month (avoids duplicate month labels on X-axis)
- X-axis: `dataKey="month"` (short name: Jan, Feb, etc.), evenly spaced
- Tooltip (`EFTPTooltip`): month/year label, peak wattage, ride name
- Y-axis domain: `dataMin - 10` to `dataMax + 10`

**Weekly charts** (Hours, TSS, Elevation): X-axis uses `dataKey="label"` with `interval="preserveStartEnd"`. Tooltips show week label, value, and ride count.

## UI Layout (top to bottom, as of Session 8)

1. **Header bar**: App title, FTP/eFTP display, Days to Event, Settings/Profile buttons
2. **Progression Level bars**: One per zone (excludes Recovery), with recent change badges
3. **Charts**: Tabbed — Weekly Hours, Weekly TSS, Elevation, eFTP History
4. **Power Skills card**: Radar chart (3/5 width) + horizontal power bars (2/5 width), requires power curve CSV import
5. **Training Load cards**: CTL / ATL / TSB in a 3-column grid
6. **Training Summary + Training Status** (side-by-side, 2-column grid): Left: `TSS [7d] [14d] [28d]` and `Longest (30d)`. Right: Training Status badge (color-coded pill with TSB% and description). Uses TSB% zones: Transition >+25%, Fresh +5–25%, Grey Zone -10–+5%, Optimal -30–-10%, High Risk <-30%. Low fitness override (CTL<35) shows Building states instead.
7. **Instant Analysis card**: Auto-generated insights + "Copy for Claude" button
8. **Monthly Activity Calendar**: Strava-style month grid (Mon-start). Navigation arrows to scroll months. Ride days show solid blue circle with bike SVG icon; no-ride days show gray outline with day number. Today highlighted with blue border/ring. Adjacent-month days faded.
9. **Fitness Progress bar**: CTL toward target 100
10. **Ride History button**: Full-width, opens History modal
11. **Bottom action bar**: Import | Export | Paste CSV | Import Power (left) — Reset Levels (right, subtle text link)

### Modal system
All secondary views are modals (`fixed inset-0 z-50`). Key modals:
- **Log Ride** (`showLogRideModal`): Also used for editing — `editingRide` state holds the ID
- **Ride History** (`showHistoryModal`): Scrollable list with edit/delete per ride
- **Post-Log Summary** (`showPostLogSummary`): Shows progression change after logging
- **CSV Import** (`showCSVImport`): Paste textarea for intervals.icu CSV
- **Profile** (`showProfileModal`): Weight, HR, age settings
- **Event** (`showEventModal`): Goal event configuration

### Clipboard
`copyForAnalysis()` uses `navigator.clipboard.writeText()` with a `document.execCommand('copy')` fallback for HTTP/LAN contexts. The fallback creates a hidden textarea, selects it, and copies.

### Training loads
`calculateTrainingLoads()` returns `{ ctl, atl, tsb, weeklyTSS, twoWeekTSS, ctl14dAgo }`. The field `twoWeekTSS` is cumulative (includes the 7-day window). Insights derive previous-week TSS as `twoWeekTSS - weeklyTSS` for week-over-week comparison. The `ctl14dAgo` field captures CTL from 14 days ago for Training Status transition detection.
