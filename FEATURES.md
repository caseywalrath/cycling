# Feature Wish List & Roadmap

**Project:** Gran Fondo Utah Training Tracker
**Last Updated:** 2026-02-09
**Status:** Active Development

This document tracks feature requests, enhancements, and ideas for future development. Items are organized by priority and complexity.

---

## Current State

✅ **Working Features:**
- Progression level tracking (6 zones)
- Training load metrics (CTL, ATL, TSB)
- Manual workout logging
- Smart insights and recommendations
- Export/Import data (JSON)
- PWA support for iPhone
- Local data persistence
- Weekly Hours/TSS/Elevation/eFTP charts (tabbed)
- Power Skills radar chart with power curve import
- Rider Type designation (6 phenotypes from power curve data)
- Training Status badge (TSB%-based with 5 tiers)
- Monthly activity calendar (Strava-style)

❌ **Known Limitations:**
- intervals.icu sync doesn't work with Strava-sourced activities
- No cross-device sync
- Manual entry only

---

## High Priority Features

### 1. Historical Data Import
**Priority:** HIGH
**Complexity:** Medium
**Description:** Import historical workout data to populate training history

**Options:**
- CSV import from Strava export
- Manual bulk entry tool (input multiple rides at once)
- FIT file upload and parsing
- Direct Garmin Connect sync (non-Strava)

**Why:** User has ~149 rides since Dec 29, 2024 that need importing for accurate CTL/ATL calculations

**Implementation Notes:**
- Add CSV parser for common export formats
- Map CSV columns to our workout format
- Batch import with progress indicator
- Duplicate detection

---

### 2. Cloud Backup/Sync
**Priority:** ✅ COMPLETED (Manual) → HIGH (Automation)
**Complexity:** Medium-High
**Status:** ✅ Option C implemented (2026-01-26) - Manual sync works great!
**Description:** Sync data across devices (Windows, iPhone)

**Current Implementation (Option C - Manual Cloud Sync):**
- ✅ Enhanced export with timestamped filenames (`casey-rides-backup-2026-01-26.json`)
- ✅ Includes FTP and eFTP data in export/import
- ✅ Success messages on import with workout count
- ✅ "☁️ How to Sync?" modal with step-by-step instructions
- ✅ Works with Google Drive, Dropbox, iCloud Drive, or any cloud storage
- ✅ No API keys or backend required
- ✅ User maintains full control over sync timing

**Future Automation Options:**
- **Option A: Simple Backend** (Firebase, Supabase)
  - User authentication
  - Real-time sync across devices
  - Auto-sync on app launch and after each workout
  - Free tier sufficient for single user
  - Complexity: High, requires backend setup

- **Option B: Google Drive API Integration**
  - Auto-export to Google Drive after each workout
  - Auto-import on app launch
  - OAuth authentication with Google account
  - No backend needed
  - Complexity: Medium, requires Google API setup

**Why:** Manual sync enables cross-device use; automation would improve convenience

**Recommendation:** Option C works well; consider Option B for automation if needed later

---

### 3. Workout Templates/Library
**Priority:** MEDIUM
**Complexity:** Low
**Description:** Pre-built workouts for each training zone

**Features:**
- Library of TrainerRoad-style workouts
- Templates: "Endurance Ride", "Sweet Spot Intervals", "VO2max Session"
- Save custom workouts as templates
- One-tap logging from template
- Suggested workout based on current levels and TSB

**Examples:**
```
Endurance:
- Z2: 60-120min @ 130-165W
- Long steady ride

Sweet Spot:
- Warmup: 10min easy
- 3x10min @ 195-220W (5min recovery)
- Cooldown: 10min easy
```

**Why:** Makes logging faster and more consistent

---

### 4. Calendar View
**Priority:** ✅ COMPLETED (Basic) → LOW (Enhancements)
**Complexity:** Medium
**Status:** ✅ Basic monthly calendar implemented (2026-02-03)
**Description:** Visual calendar showing past workouts and planned sessions

**Current Implementation:**
- ✅ Monthly grid view (Monday-start weeks)
- ✅ Navigation arrows to scroll between months
- ✅ Ride days show solid blue circle with bike SVG icon
- ✅ No-ride days show gray outline with day number
- ✅ Today highlighted with blue border/ring
- ✅ Adjacent-month days faded for context
- ✅ O(1) ride date lookup via useMemo Set

**Future Enhancements:**
- Color-coded by zone
- TSS displayed on each day
- Weekly TSS totals
- Click day to log workout
- Plan future workouts

**Why:** Better visualization of training patterns and load distribution

---

## Medium Priority Features

### 5. Advanced Analytics
**Priority:** MEDIUM
**Complexity:** Medium
**Description:** Enhanced data visualization and trends
**Status:** ✅ Weekly Hours Chart COMPLETED (2026-01-26)

**Features:**
- ✅ **Weekly Hours Chart (Strava-style)** - COMPLETED!
  - Area chart showing weekly training hours over last 20 weeks
  - X-axis: Week labels (e.g., "Apr 7", "May 12")
  - Y-axis: Hours (0h, 3h, 6h, etc.)
  - Orange gradient fill with data point markers
  - Current week summary in header
  - Located in Dashboard tab after CTL/ATL/TSB cards
  - Interactive tooltips showing exact hours/minutes and ride count
  - Responsive design with 200px height
  - Built with Recharts library

- CTL/ATL/TSB chart over time (Performance Management Chart)
- Progression level trends by zone
- TSS distribution by zone (pie chart)
- Power curve (best efforts by duration)
- Fitness trends and projections

**Implementation Details:**
- ✅ Using Recharts (AreaChart, ResponsiveContainer, custom Tooltip)
- ✅ Groups workouts by week (Sunday-Saturday)
- ✅ Calculates total duration per week in hours
- ✅ Displays last 20 weeks (expanded from initial 16-week plan)
- ✅ Responsive design with ResponsiveContainer
- ✅ Custom gradient fill (#FB923C orange)
- ✅ Interactive hover states with enlarged active dots
- ✅ Custom tooltip component showing hours/minutes and ride count

**Visual Reference:**
```
Weekly Hours Chart
─────────────────────
This week: 2h 11m

6h 7m │               ╱╲
      │              ╱  ╲
3h 3m │     ╱╲  ╱╲  ╱    ╲
      │  ╱╲╱  ╲╱  ╲╱
0h    │───────────────────
        APR  MAY  JUN
```

**Why:** Visual feedback on training volume trends, motivation, consistency tracking

---

### 6. Training Plan Builder
**Priority:** MEDIUM
**Complexity:** High
**Description:** Structured training plans leading to Gran Fondo Utah

**Features:**
- Pre-built plan templates (Base, Build, Peak, Taper)
- Custom plan creation
- Adaptive scheduling based on actual performance
- Week-by-week progression
- Integration with calendar view
- TSS targets per week

**Example Plan:**
```
Weeks 1-8: Base (CTL 40→65)
- 3x endurance, 1x tempo, 1x sweet spot per week
Weeks 9-16: Build (CTL 65→85)
- 2x endurance, 2x threshold/VO2max per week
Weeks 17-18: Peak (CTL 85→90)
- 1x endurance, 2x race intensity
Weeks 19-20: Taper (CTL 90→80, TSB +15)
```

**Why:** Structured approach to Gran Fondo preparation

---

### 7. Dynamic FTP Tracking from intervals.icu
**Priority:** MEDIUM
**Complexity:** Medium
**Status:** ⚠️ PARTIALLY IMPLEMENTED - eFTP display working, detection needs API investigation
**Description:** Pull current eFTP from intervals.icu and detect changes

**Current State (2026-01-26):**
- ✅ eFTP displays in header next to manual FTP
- ✅ FTP increase modal with 3 options (Recalculate/Adjust/Ignore)
- ✅ Modal handlers implemented and working
- ⚠️ eFTP field path unclear - API returns undefined for expected fields
- 🔍 Forum suggests `sportSettings.Ride.mmp_model.ftp` but needs verification

**Features:**
- Fetch current eFTP (estimated FTP) from intervals.icu
- Detect when FTP increases by 10W or more
- Congratulate user on FTP gains
- Prompt to recalculate progression levels for new FTP
- Option to auto-adjust zones or manually confirm
- Track FTP history over time

**Implementation Notes:**
```javascript
// Current approach (needs verification):
// eFTP should be at sportSettings.Ride.mmp_model.ftp
const sportSettings = athleteData.sportSettings || athleteData.settings;
const settings = sportSettings?.Ride || sportSettings;
const eFTPValue = settings?.mmp_model?.ftp;

// Issue: Field returns undefined despite intervals.icu showing 241W eFTP
// May need to examine full API response or contact intervals.icu support
// Reference: https://forum.intervals.icu/t/api-recommended-way-to-get-eftp/99469
```

**Why:**
- Keeps app in sync with training progress
- Automatic detection of fitness improvements
- Zones stay accurate as FTP changes
- Motivating to see FTP gains recognized

**UI Flow:**
1. Sync button pulls eFTP alongside activities
2. If FTP increased by 10W+: "🎉 Congrats! Your FTP increased from 235W to 245W!"
3. Offer options:
   - "Recalculate Levels" (reset all to 1.0 with new zones)
   - "Adjust Zones Only" (keep progression levels, update power ranges)
   - "Ignore" (manual FTP management)

**Next Steps:**
- Examine full athlete API response object structure
- Test with different intervals.icu accounts
- Consider manual FTP entry as workaround
- Contact intervals.icu support if needed

---

### 8. Workout Creator (.mrc File Builder)
**Priority:** MEDIUM
**Complexity:** Medium
**Description:** Create simple interval-based workouts in .mrc format

**Features:**
- Visual workout builder interface
- Define intervals with power targets and duration
- Preview workout structure
- Export as .mrc file for Zwift/TrainerRoad/etc.
- Save custom workouts to library
- Templates for common workout types

**Workout Structure:**
```
[COURSE HEADER]
FTP=235
MINUTES PERCENT

[COURSE DATA]
0    50      # Warmup
10   50
10   100     # First interval
15   100
15   50      # Recovery
20   50
```

**Example Workouts to Template:**
- Sweet Spot: 3x10min @ 90% (5min recovery)
- VO2max: 5x3min @ 120% (3min recovery)
- Threshold: 2x20min @ 95% (10min recovery)
- Over-Unders: 3x8min alternating 95%/105% every 2min

**Why:**
- Create custom workouts for Zwift/indoor training
- Share workouts with others
- Build structured training blocks
- Export workouts designed in the app

---

### 9. Outdoor Ride Tracking Strategies
**Priority:** MEDIUM
**Complexity:** Low-Medium
**Description:** Better methods for tracking outdoor rides with varied effort

**Challenges:**
- Outdoor rides don't follow set intervals
- Power varies with terrain, traffic, wind
- Hard to assign single "workout level"
- Multiple zones hit in one ride

**Proposed Solutions:**

**Option A: Time-in-Zone Analysis**
- Import power file or manually enter time in each zone
- Calculate "dominant zone" (most time spent)
- TSS already accounts for variability via NP
- Assign workout level based on IF and duration

**Option B: Segment-Based Logging**
- Break ride into segments (e.g., climbing section, intervals, endurance)
- Log each segment separately with its zone
- Aggregate TSS and progression across segments

**Option C: Ride Type Classification**
- Pre-defined ride types: "Long Endurance", "Hilly Ride", "Group Ride", "Mixed Tempo"
- Each type maps to primary zone and estimated workout level
- User selects type, enters duration/NP/TSS
- System suggests zone and level based on IF

**Option D: Workout Level from IF**
- Current approach (already implemented)
- IF < 0.65: Endurance, Level 1-3
- IF 0.65-0.75: Tempo/Sweet Spot, Level 3-5
- IF 0.75-0.85: Threshold, Level 5-7
- IF 0.85-0.95: VO2max, Level 7-9
- IF > 0.95: Anaerobic, Level 9-10
- Adjust based on RPE

**Recommendation:**
- Enhance Option D (current approach) with Option C (ride types)
- Add "Ride Type" dropdown in Log tab
- Preset ride types suggest zone, user can override
- Keep it simple - outdoor rides focus on TSS/IF, indoor workouts focus on progression

**UI Enhancement:**
```
Log Outdoor Ride:
- Ride Type: [Dropdown] Long Endurance / Hilly Mixed / Group Ride / Tempo Intervals
- Duration: 120 min
- NP: 165W
- IF: 0.70 (auto-calculated)
- Suggested Zone: Tempo
- Suggested Level: 4.5
- RPE: 6
```

**Why:**
- Most real-world rides are outdoors
- Need flexibility for varied efforts
- Should still contribute to progression tracking
- TSS is more important than specific zone assignment

---

### 10. Dynamic Event/Goal Management
**Priority:** MEDIUM
**Complexity:** Low
**Description:** Make event information configurable instead of hardcoded

**Features:**
- Editable event name (currently "Gran Fondo Utah")
- Configurable event date (currently June 13, 2026)
- Multiple events/goals support
- Show days until event
- Show countdown to taper start
- Event-specific training targets (target CTL, TSB on race day)
- Archive past events
- Set primary/active event

**Current State:**
- Event hardcoded in header: "Event: June 13, 2026"
- Single event assumption throughout app

**Proposed UI:**
```
Settings/Events Tab:
- Primary Event: [Gran Fondo Utah]
- Event Date: [June 13, 2026]
- Target CTL: [80-100]
- Target TSB: [+10 to +20]
- Taper Start: [Auto-calculated or manual]

Header Display:
- Event: Gran Fondo Utah (142 days) • CTL Target: 85
```

**Why:**
- Support multiple training goals
- Reuse app for future events
- Better countdown visibility
- Motivating to see progress toward goal date

**Implementation:**
- Add event object to localStorage
- Settings UI for event management
- Dynamic header display
- Calculate days until event
- Integrate with training plan recommendations

---

### 11. Automated Cloud Sync
**Priority:** MEDIUM
**Complexity:** Medium
**Description:** Automatic backup and sync using Google Drive API
**Depends On:** ✅ Manual Cloud Sync (Feature #2 - completed)

**Features:**
- Auto-export to Google Drive after each workout logged
- Auto-import on app launch (sync latest backup)
- OAuth authentication with Google account
- Background sync without user intervention
- Conflict resolution (choose latest or merge)
- Sync status indicator in header
- Manual sync button as backup option

**Implementation:**
```javascript
// Google Drive API integration
1. Set up Google OAuth 2.0 (get client ID)
2. Request drive.file scope (only app-created files)
3. After workout logged: uploadToGoogleDrive()
4. On app load: downloadFromGoogleDrive()
5. Compare timestamps, sync if newer data available
```

**Technical Details:**
- Use Google Drive API REST endpoints
- Store backups in app-specific folder
- Keep last 10 backups (auto-cleanup old ones)
- Sync only when changes detected (compare hash)
- Show sync status: "Last synced: 2 minutes ago"

**Why:**
- Eliminates manual export/import steps
- Always up-to-date across all devices
- Automatic backups prevent data loss
- Seamless cross-platform experience

**Tradeoffs:**
- Requires Google account (most users have one)
- Initial setup with OAuth (one-time)
- Slightly more complex than manual sync
- Depends on Google Drive availability

**Recommendation:** Implement when multiple devices become common use case

---

### 12. Strava Integration Alternative
**Priority:** MEDIUM
**Complexity:** High
**Description:** Work around Strava API limitations

**Options:**
- Garmin Connect direct integration
- Wahoo Cloud integration
- Upload FIT files directly
- Chrome extension to scrape Strava data

**Why:** intervals.icu can't share Strava data via API

**Best Option:** Direct device sync (Garmin/Wahoo) bypasses Strava

---

## Low Priority / Nice to Have

### 13. Weather Integration
**Priority:** LOW
**Complexity:** Low
**Description:** Log weather conditions with rides

**Features:**
- Auto-detect weather from date/location
- Manual weather entry
- Track performance by conditions
- Factor weather into workout difficulty

---

### 14. Equipment Tracking
**Priority:** LOW
**Complexity:** Low
**Description:** Track mileage on bikes and components

**Features:**
- Multiple bikes/wheelsets
- Component wear tracking (chain, tires, etc.)
- Maintenance reminders
- Ride attribution to specific bike

---

### 15. Nutrition/Hydration Tracking
**Priority:** LOW
**Complexity:** Low
**Description:** Log fueling strategy per workout

**Features:**
- Calories consumed during ride
- Hydration tracking
- Pre/post-ride nutrition
- Correlate nutrition with performance

---

### 16. Heart Rate Training
**Priority:** LOW
**Complexity:** Medium
**Description:** Add HR-based training for riders without power

**Features:**
- HR zones (Z1-Z5)
- HR-based TSS calculation (hrTSS)
- Track HR trends over time
- Correlate HR with power (efficiency)

---

### 17. Multi-Sport Support
**Priority:** LOW
**Complexity:** Medium
**Description:** Track running, swimming for cross-training

**Features:**
- Running (pace zones, rTSS)
- Swimming (sTSS)
- Strength training
- Total training load across sports

---

### 18. Advanced FTP Tracking
**Priority:** LOW
**Complexity:** Medium
**Description:** Automatic FTP detection and adjustment

**Features:**
- FTP test protocols
- AI-detected FTP from ride data
- FTP history over time
- Auto-adjust zones when FTP changes

---

### 19. Race Day Features
**Priority:** LOW
**Complexity:** Low
**Description:** Tools for event day

**Features:**
- Pre-race checklist
- Race day fueling calculator
- Pacing strategy based on CTL/TSB
- Post-race analysis

---

## Technical Improvements

### 20. Performance Optimizations
- Lazy load history (pagination)
- Service worker caching improvements
- Reduce bundle size
- Database migration (LocalStorage → IndexedDB for large datasets)

### 21. Testing
- Unit tests for calculations
- Integration tests for UI
- E2E tests for critical flows

### 22. Code Refactoring
- Break App.jsx into smaller components
- Add TypeScript for type safety
- State management library (Zustand/Redux)
- Component library for consistency

---

## Feature Implementation Order (Recommended)

**Phase 1: Data Foundation** (First priority)
1. CSV Import for historical data
2. Improved export/import UX
3. Manual cloud sync (Google Drive/Dropbox)

**Phase 2: Core Enhancements**
4. Workout templates/library
5. Calendar view
6. Basic analytics charts
7. Dynamic FTP tracking from intervals.icu

**Phase 3: Planning & Structure**
8. Training plan builder
9. Advanced analytics
10. Workout creator (.mrc files)

**Phase 4: Integrations**
11. Alternative to Strava sync (Garmin/Wahoo)
12. Outdoor ride tracking strategies
13. Weather integration
14. Equipment tracking

**Phase 5: Polish & Nice-to-Haves**
15. Multi-sport support
16. Advanced features (HR training, race tools)
17. Nutrition/hydration tracking

---

## Quick Wins (Easy & Impactful)

These can be implemented quickly for immediate benefit:

1. **Workout Templates** - Low complexity, high value
2. **Export Improvements** - Add filename with date, better formatting
3. **Quick Log** - Tap yesterday's date to auto-fill
4. **Zone Presets** - Save common NP values for each zone
5. **Weekly Summary** - View/export week's stats summary
6. **Dark/Light Mode Toggle** - Better display options
7. **Zone Distribution Bar (4-week)** - Single compact horizontal stacked bar showing how training time broke down by power zone over the last 28 days. Complements the Power Skills radar — the radar shows capabilities, this shows how you're actually training. Low complexity, uses existing ride history zone data.
8. **Keyboard Shortcuts** - Fast navigation (on desktop)
9. **Recent Workouts Widget** - Quick re-log similar workouts
10. **Rider Type Designation** ✅ COMPLETED (2026-02-09)

    **Status:** Implemented as color-coded button in Power Skills card header.

    **Implementation:**
    - ✅ Algorithm compares avg percentile across Sprint (5s–1m), Attack (5–20m), Climb (30m–2h)
    - ✅ 6 types: Sprinter, Puncheur, Rouleur, Time Trialist, Climber, All-Rounder
    - ✅ Color-coded button (w-2/5, matches power bars width)
    - ✅ Click opens modal with plain-text explanation, category scores, methodology
11. **Training Status** ✅ COMPLETED (2026-02-03)

    **Status:** Implemented as color-coded badge in Training Status card (side-by-side with Training Summary).

    **Implementation:**
    - ✅ TSB% calculation: `(TSB / CTL) × 100`
    - ✅ 5 status tiers with colors: Transition (gray), Fresh (blue), Grey Zone (yellow), Optimal (green), High Risk (red)
    - ✅ Low fitness override (CTL < 35): Shows "Building" / "Building (Heavy Load)" / "Building (Fresh)"
    - ✅ Transition detection via CTL decline >10% over 14 days (tracks `ctl14dAgo`)
    - ✅ Displays TSB% value when CTL ≥ 35
    - ✅ Short description text for each status

    **Future Refinements:**
    - Instant Analysis integration for High Risk / Transition guidance
    - RPE-based fatigue modifier
    - HRV validation if wellness data becomes available

---

## User-Requested Features

*Add user requests here as they come in*

### From Initial Development:
- ✅ intervals.icu sync (attempted, blocked by Strava API)
- ⏳ Historical data import (HIGH priority)
- ⏳ Cross-device sync (HIGH priority)

---

## Notes

- Focus on features that provide immediate training value
- Maintain simplicity - avoid feature creep
- Prioritize data integrity and backup capabilities
- Gran Fondo Utah is June 13, 2026 - features supporting event prep are higher priority
- Keep the app fast and lightweight (PWA performance)

---

## How to Propose New Features

When adding to this list:
1. Add to appropriate priority section
2. Include: Priority, Complexity, Description, Why
3. Consider: Does this support Gran Fondo training goals?
4. Estimate: Development time and user value
5. Dependencies: What must be built first?

---

**Last Updated:** 2026-02-09
**Next Review:** When starting new development phase
