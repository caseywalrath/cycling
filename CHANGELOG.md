# Changelog

## Session 1 - Initial Development (January 2026)

### Project Setup
- Converted cycling tracker artifact to Progressive Web App (PWA)
- React 18 + Vite + Tailwind CSS
- PWA config for iPhone installation, app icons
- GitHub repository initialized

### Core Features
- TrainerRoad-style progression level tracking
- TSS calculations, CTL/ATL/TSB training load analytics
- Workout logging with zone tracking
- Training insights and recommendations

### intervals.icu Integration
- CSV import (228+ rows), API sync with duplicate detection
- Smart zone mapping from power data
- Data import: Power (NP), TSS, IF, duration, workout type, RPE
- Ride ID capture and storage
- eFTP detection with FTP comparison (10W+ threshold)

### Data Management
- Export/Import with timestamps: `casey-rides-backup-YYYY-MM-DD.json`
- Complete state backup: levels, history, FTP, eFTP, event, profile

### Event/Goal Management
- Event creation: name, date, distance, target CTL
- Dynamic countdown, progress indicators
- Moved to header button (cleaner UI)

### Ride Tracking
- Ride type: Outdoor/Indoor with auto-import from CSV
- Distance tracking (miles), elevation (feet, converted from meters)
- Longest ride display (30 days, outdoor only)
- Visual flags: 🏔️ Big Climb (>2999 ft), 🛣️ Long Ride (>3 hours)
- Ride deletion with confirmation

### Dashboard
- Training Summary: single-row with CTL/ATL/TSB cards
- Charts: Hours (orange), TSS (blue), Elevation (green) - tabbed interface
- Elevation (14d) column in summary

### History
- Reorganized: title first, date second
- Inline intervals.icu ID display
- 6-column grid: Duration | Distance | Elevation | NP | TSS | IF
- eFTP display when available

### Profile & Settings
- Moved to header button
- Manual FTP entry
- Weight in pounds (90-330 lbs range)
- Reset Levels button (resets to 1.0, preserves history)

### Instant Analysis
- Longest ride, weekly hours tracking with volume warnings
- Ride frequency changes, indoor/outdoor composition
- Consecutive training days warning
- Big climbs detection (>3000 ft), climbing intensity (ft/mile)
- Weekly elevation gain comparison

### UI/UX
- RPE fields: "Expected RPE" and "Actual RPE"
- Standardized bottom buttons (neutral gray)
- Header: "Days to Event: X" format

### Removed Features
- VO2max Fitness card and analysis (data structures kept)
- intervals.icu sync button (CSV import only)
- Event Goal card from Dashboard (moved to header)

---

## Session 2 - UI Consolidation & eFTP Enhancement

- Major UI restructure: eliminated Levels/Dashboard/Log/History tabs
- Implemented modal system: Log Ride (green header button), History (Recent Workouts link)
- Complete eFTP implementation:
  - Header display (purple, next to FTP)
  - FTP update prompting when |FTP - eFTP| > 10W
  - Progression reset prompt on FTP change
  - eFTP chart (purple tab, one-year rolling history)
- Main view: progression bars always visible, dashboard content below
- Files: App.jsx, Header, Dashboard, Chart components

---

## Session 3 - eFTP Chart Refinement & UI Consolidation Fix

- Removed dots from eFTP chart (line-only display for cleaner long-term view)
- Re-implemented UI consolidation after incorrect branch commit: removed tab navigation, modal-based system
- Fixed regression that reverted to old tab-based UI
- Maintained: progression bars at top, dashboard content below, Log Ride & History as modals
- Files: `src/App.jsx`

---

## Session 4 - Ride Editing & Zone Refinement

- Critical: Session hung mid-task; rebased onto correct branch
- Added Recovery zone (Z1, <55% FTP, gray color) above Endurance
- Added Ride Name field at top of Log Ride form
- Made rides editable: Edit button (✏️) next to Delete in history
- Auto-assigned Expected RPE by zone (Recovery=3, Endurance=4, Tempo=5, Sweet Spot=6, Threshold=7, VO2max=8, Anaerobic=9)
- Changed default ride type from Outdoor to Indoor
- Created ARCHITECTURE.md documentation
- Files: `src/App.jsx`, `ARCHITECTURE.md`

---

## Session 5 - Decouple Progression Levels from Imported Rides

- **Breaking change to import behavior**: CSV and intervals.icu API imports no longer auto-classify rides into training zones or update progression levels
- Imported rides stored with `zone: null`, `source: 'imported'` — user must manually classify via Edit (✏️) in Ride History
- Manual ride logging now tagged with `source: 'manual'`; only manual rides affect progression levels
- Recovery zone excluded from progression level calculations
- Edit ride handler recalculates progression when user assigns a zone to an unclassified import
- History modal shows "Needs classification" (yellow) for unclassified rides; level progression column shows "—"
- Post-log summary modal handles Recovery zone gracefully (no before/after display)
- JSON export/import preserves `source` field on all ride entries automatically
- **Rationale**: Normalized Power is a whole-ride metric that cannot distinguish interval types (e.g., VO2max intervals with recovery spin yield Sweet Spot NP). User-selected zone classification is the only reliable method.
- Files: `src/App.jsx`

### Additional UI Changes (Session 5 continued)
- Removed Recovery zone from Progression Levels bar display
- Bottom action bar: reordered to Import | Export | Paste CSV; removed "How to Sync?" and "Paste JSON"
- Training Summary: removed Elevation (14d) column; renamed "Longest (30d)" to "Longest Ride (30 Days)"
- Training loads: replaced "Previous Week TSS" (days 8-14) with cumulative "14-Day TSS" (days 0-14); Training Summary card now shows 7/14/28 day columns
- "Copy for Claude" clipboard fix: added fallback for non-secure contexts (HTTP on LAN)
- Replaced Recent Workouts card with full-width "Ride History" button below Instant Analysis
- Increased Ride History modal scroll height from fixed 384px to 70% viewport height
- Training Summary compacted into two inline rows: `TSS 140 7d 302 14d 693 28d` and `Longest (30d) 121 min • 30.3 mi`
- Reset Levels moved from full-width button to small text link in bottom-right corner of action bar
- Files: `src/App.jsx`

---

## Session 6 - eFTP Chart & Dashboard Chart Improvements

- **eFTP chart simplified to monthly peaks**: Shows one data point per month (highest eFTP that month) instead of every ride. Tooltip shows month/year, peak wattage, and ride name.
- **Monthly X-axis labels**: eFTP chart uses evenly spaced month labels (Jan, Feb, Mar, etc.) instead of per-ride dates. 11-month rolling window avoids duplicate month names.
- **eFTP tooltip shows ride name**: Third line displays ride name field (e.g., "VO2Max", "Z2") instead of user comments/notes.
- **Purple dots restored on eFTP chart**: Matches dot style of Hours, TSS, and Elevation charts (`r: 4`, `activeDot r: 6`).
- **Y-axis label width increased across all charts**: Prevents clipping of labels (especially 5-digit elevation numbers). Hours/TSS: `width={45}`, Elevation/eFTP: `width={55}`.
- **Branch notification docs**: Added required Claude Code behavior to ARCHITECTURE.md — notify user of branch name at session start, end every change with pull instructions.
- Files: `src/App.jsx`, `ARCHITECTURE.md`

---

## Session 7 - Documentation Restructure

- **CLAUDE.md rewritten**: Replaced generic template content with project-specific behavioral guide. Now contains: session-start requirements, developer context, communication guidelines, branch management rules, common issues to prevent, git workflow, and project quick reference.
- **ARCHITECTURE.md cleaned up**: Removed behavioral/process sections (Developer Context, Communication Guidelines, Branch Management, Common Issues). Now purely structural/technical: file structure, component architecture, state management, data flow, key functions, charts, UI layout.
- **Clear separation of concerns**: ARCHITECTURE.md is the authoritative reference for *what the app is*. CLAUDE.md is the guide for *how Claude should behave*.
- Files: `CLAUDE.md`, `ARCHITECTURE.md`, `CHANGELOG.md`

---

## Session 8 - Training Status & Calendar (2026-02-03)

### UI Layout Reorder
- Moved Charts and Power Skills card **above** CTL/ATL/TSB training load cards (visual-first flow)
- Moved Fitness Progress bar **above** Ride History button

### Training Status Card (NEW)
- Added `getTrainingStatus()` function with TSB%-based status calculation
- 5 status tiers: Transition (gray), Fresh (blue), Grey Zone (yellow), Optimal (green), High Risk (red)
- Low fitness override (CTL < 35): Shows "Building" / "Building (Heavy Load)" / "Building (Fresh)" instead of erratic percentage-based categories
- Transition detection: triggers on TSB% > +25% OR CTL declining >10% over 14 days
- Added `ctl14dAgo` field to `calculateTrainingLoads()` for 14-day CTL tracking
- Displayed as color-coded pill badge with TSB% value and description
- Placed side-by-side with Training Summary in 2-column grid

### Monthly Activity Calendar (NEW)
- Strava-style month grid (Monday-start weeks)
- Navigation arrows to scroll between months, defaults to current month
- Ride days: solid blue circle with inline SVG bike icon
- No-ride days: gray outline circle with day number
- Today: blue border/ring highlight
- Adjacent-month days: faded for context
- Added `calendarMonth` / `calendarYear` state for navigation
- Added `rideDatesSet` (useMemo) for O(1) ride date lookup
- Added `getCalendarDays()` helper for grid generation (handles 5/6-row months, year boundaries)
- Placed between Instant Analysis and Fitness Progress

### Documentation
- Updated FEATURES.md: marked Calendar View (#4) and Training Status (#11) as ✅ COMPLETED
- Updated ARCHITECTURE.md: new UI layout order, added `getTrainingStatus()` and `getCalendarDays()` to key functions, documented `ctl14dAgo` field

### Files Changed
- `src/App.jsx` — all feature code
- `ARCHITECTURE.md` — UI layout, key functions, training loads
- `FEATURES.md` — completion status updates

---

## Session 9 - Google Drive Sync (2026-02-07)

### Google Drive Sync (NEW)
- **New module**: `src/google-drive-sync.js` — standalone Google Drive OAuth + sync logic
- **OAuth**: Google Identity Services (GIS) implicit grant, `drive.file` scope
- **Backup file**: `casey-rides-backup.json` stored in user's Google Drive root
- **Conflict resolution**: "Last write wins" using `exportedAt` timestamp
- **Sync behavior**: Push if local newer, pull if remote newer, skip if equal, create if no remote file
- **Error handling**: 401 (token expiry with auto-retry), 429 (rate limit), offline detection
- **UI**: Blue "Sync to Google Drive" button at bottom of app with status message

### Data Change Tracking
- Added `exportedAt` state — updated on every data mutation via `markDataChanged()`
- Added `lastSyncedAt` state — updated after successful sync
- `markDataChanged()` wired into: ride log/edit/delete, CSV import, intervals.icu sync, level reset, power curve import, event save/delete, profile save, file/paste import
- Both fields persisted to localStorage and included in JSON export

### Export/Import Updates
- Export now includes `syncVersion`, `deviceId`, `lastSyncedAt` fields
- Import calls `markDataChanged()` to update exportedAt timestamp

### UI Refinements
- Moved Sync button from bottom of app to **header bar**, next to Log Ride
- Renamed from "Sync to Google Drive" to **"Sync"**, matching Log Ride button size/style (blue)
- Sync status message displays below header when active (auto-clears after 5s)
- Added empty-data safeguard: if local has 0 rides but remote has data, forces pull regardless of timestamps
- Added console logging throughout sync flow for diagnostics

### Files Changed
- `src/google-drive-sync.js` — new file (Google Drive sync module)
- `index.html` — added Google Identity Services script tag
- `src/App.jsx` — sync state, handleDriveSync, markDataChanged, Sync button in header
- `ARCHITECTURE.md` — file structure, persistence, sync docs, UI layout
- `CHANGELOG.md` — this entry

---

## Session 10 - localStorage Fix & eFTP Editing (2026-02-07)

### Critical Bug Fix: localStorage Data Loss
- **Root cause**: Save `useEffect` ran on initial mount before load effect's `setState` calls took effect, overwriting localStorage with empty defaults. React's `StrictMode` (double-firing effects) compounded the issue.
- **Fix**: Replaced broken `dataLoadedRef` guard with `isInitialMount` skip-first-render pattern — save effect skips its first execution entirely, only fires after state is populated.
- **FTP persistence fix**: Main save effect was missing `ftp`/`intervalsFTP` fields, silently dropping FTP on every write. Separate FTP load/save effects created additional race conditions. Consolidated all data into single load/save effects.
- **Error handling**: Added `try/catch` around all `JSON.parse` calls in load effects to prevent silent failures on corrupted data.

### eFTP Editable via Ride History
- Added optional eFTP (W) input field to the edit ride form (only visible when editing, not when logging new rides)
- Pre-populates with existing eFTP value from imports; allows manual entry for rides without eFTP
- Stored as integer or `null` (empty field saves as null, not shown in history)

### App Rename
- Browser tab title, PWA manifest `name`/`short_name`, and Apple mobile web app title updated from "Gran Fondo Utah Training" to "Casey Rides"

### Files Changed
- `src/App.jsx` — localStorage fix, eFTP edit field, formData updates
- `index.html` — title rename
- `vite.config.js` — PWA manifest name rename
