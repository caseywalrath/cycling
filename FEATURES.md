# Feature Wish List & Roadmap

**Project:** Gran Fondo Utah Training Tracker
**Last Updated:** 2026-01-22
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
**Priority:** HIGH
**Complexity:** Medium-High
**Description:** Sync data across devices (Windows, iPhone) automatically

**Options:**
- **Option A: Simple Backend** (Firebase, Supabase)
  - User authentication
  - Real-time sync across devices
  - Free tier sufficient for single user

- **Option B: Google Drive Integration**
  - Auto-export to Google Drive
  - Auto-import on app launch
  - No backend needed

- **Option C: Manual Cloud Sync**
  - Export to cloud (Dropbox, Google Drive)
  - Import from cloud on other device
  - User manages sync timing

**Why:** Currently data only exists on one device at a time

**Recommendation:** Start with Option C (manual), upgrade to A or B later

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
**Priority:** MEDIUM
**Complexity:** Medium
**Description:** Visual calendar showing past workouts and planned sessions

**Features:**
- Month/week view
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

**Features:**
- CTL/ATL/TSB chart over time (Performance Management Chart)
- Progression level trends by zone
- TSS distribution by zone (pie chart)
- Weekly/monthly training volume
- Power curve (best efforts by duration)
- Fitness trends and projections

**Why:** Better understanding of training progress and patterns

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

### 7. Strava Integration Alternative
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

### 8. Workout Reminders/Notifications
**Priority:** LOW-MEDIUM
**Complexity:** Low
**Description:** Push notifications for scheduled workouts

**Features:**
- Daily workout reminders
- TSB-based recovery alerts ("Take a rest day!")
- Milestone celebrations (CTL targets, level ups)
- Weekly summary notifications

**Implementation:**
- Use PWA notification API
- User configures notification times
- Smart suggestions based on training patterns

---

## Low Priority / Nice to Have

### 9. Social/Sharing Features
**Priority:** LOW
**Complexity:** Medium
**Description:** Share progress and compete with friends

**Features:**
- Export weekly summary as image
- Share progression level achievements
- Compare with other riders (optional)
- Training partner features

**Why:** Motivation and accountability

---

### 10. Weather Integration
**Priority:** LOW
**Complexity:** Low
**Description:** Log weather conditions with rides

**Features:**
- Auto-detect weather from date/location
- Manual weather entry
- Track performance by conditions
- Factor weather into workout difficulty

---

### 11. Equipment Tracking
**Priority:** LOW
**Complexity:** Low
**Description:** Track mileage on bikes and components

**Features:**
- Multiple bikes/wheelsets
- Component wear tracking (chain, tires, etc.)
- Maintenance reminders
- Ride attribution to specific bike

---

### 12. Nutrition/Hydration Tracking
**Priority:** LOW
**Complexity:** Low
**Description:** Log fueling strategy per workout

**Features:**
- Calories consumed during ride
- Hydration tracking
- Pre/post-ride nutrition
- Correlate nutrition with performance

---

### 13. Heart Rate Training
**Priority:** LOW
**Complexity:** Medium
**Description:** Add HR-based training for riders without power

**Features:**
- HR zones (Z1-Z5)
- HR-based TSS calculation (hrTSS)
- Track HR trends over time
- Correlate HR with power (efficiency)

---

### 14. Multi-Sport Support
**Priority:** LOW
**Complexity:** Medium
**Description:** Track running, swimming for cross-training

**Features:**
- Running (pace zones, rTSS)
- Swimming (sTSS)
- Strength training
- Total training load across sports

---

### 15. Advanced FTP Tracking
**Priority:** LOW
**Complexity:** Medium
**Description:** Automatic FTP detection and adjustment

**Features:**
- FTP test protocols
- AI-detected FTP from ride data
- FTP history over time
- Auto-adjust zones when FTP changes

---

### 16. Race Day Features
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

### 17. Performance Optimizations
- Lazy load history (pagination)
- Service worker caching improvements
- Reduce bundle size
- Database migration (LocalStorage → IndexedDB for large datasets)

### 18. Testing
- Unit tests for calculations
- Integration tests for UI
- E2E tests for critical flows

### 19. Code Refactoring
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

**Phase 3: Planning & Structure**
7. Training plan builder
8. Notifications/reminders
9. Advanced analytics

**Phase 4: Integrations**
10. Alternative to Strava sync (Garmin/Wahoo)
11. Weather integration
12. Equipment tracking

**Phase 5: Polish & Nice-to-Haves**
13. Social features
14. Multi-sport support
15. Advanced features (HR training, race tools)

---

## Quick Wins (Easy & Impactful)

These can be implemented quickly for immediate benefit:

1. **Workout Templates** - Low complexity, high value
2. **Export Improvements** - Add filename with date, better formatting
3. **Quick Log** - Tap yesterday's date to auto-fill
4. **Zone Presets** - Save common NP values for each zone
5. **Weekly Summary** - Email/notification with week's stats
6. **Dark/Light Mode Toggle** - Better display options
7. **Keyboard Shortcuts** - Fast navigation (on desktop)
8. **Recent Workouts Widget** - Quick re-log similar workouts

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

**Last Updated:** 2026-01-22
**Next Review:** When starting new development phase
