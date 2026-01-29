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
