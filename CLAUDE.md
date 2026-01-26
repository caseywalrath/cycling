# CLAUDE.md - AI Assistant Guide for Cycling Project

**Last Updated:** 2026-01-26
**Project:** Cycling
**Repository:** caseywalrath/cycling

## Purpose

This file serves as a comprehensive guide for AI assistants (like Claude) working on this codebase. It documents the project structure, development workflows, coding conventions, and key patterns that AI assistants should follow when contributing to this project.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Codebase Structure](#codebase-structure)
3. [Tech Stack](#tech-stack)
4. [Development Workflow](#development-workflow)
5. [Coding Conventions](#coding-conventions)
6. [Testing Strategy](#testing-strategy)
7. [Git Workflow](#git-workflow)
8. [Deployment](#deployment)
9. [Common Tasks](#common-tasks)
10. [Troubleshooting](#troubleshooting)
11. [AI Assistant Guidelines](#ai-assistant-guidelines)

---

## Project Overview

### About
**Status:** ✅ Active Development - PWA Training Tracker

**Gran Fondo Utah Training Tracker** - A Progressive Web App for tracking cycling training with TrainerRoad-style progression levels, TSS calculations, and training load analytics.

**Event Goal:** Gran Fondo Utah - June 13, 2026
**Target User:** Solo cyclist training for Gran Fondo Utah
**FTP:** 235W (configurable in src/App.jsx)

**Key Features:**
- Progression level tracking across 6 training zones
- Training load metrics (CTL, ATL, TSB)
- TSS and Intensity Factor calculations
- Smart training insights and recommendations (11 insight types)
- intervals.icu API integration for workout sync
- CSV import with automatic column mapping
- Event/goal management with countdown and CTL targets
- Ride type (Indoor/Outdoor) and distance tracking
- Export/import workout data (JSON and manual cloud sync)
- Delete workouts with confirmation
- PWA support for iPhone installation
- All data stored locally in browser

### Quick Start
```bash
# Clone the repository
git clone <repository-url>
cd cycling

# Install dependencies
npm install

# Run development server
npm run dev
# Opens at http://localhost:3000
# Access from iPhone via Network URL (e.g., http://192.168.1.x:3000)

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Codebase Structure

### Current Structure
```
cycling/
├── src/
│   ├── App.jsx              # Main application component (~2,300 lines, all logic)
│   ├── main.jsx             # React entry point (10 lines)
│   └── index.css            # Global styles with Tailwind + iOS fixes
├── public/
│   ├── pwa-192x192.png      # PWA icon (192x192)
│   ├── pwa-512x512.png      # PWA icon (512x512)
│   ├── apple-touch-icon.png # iOS home screen icon
│   └── vite.svg             # Favicon
├── index.html               # HTML entry point with PWA meta tags
├── vite.config.js           # Vite + PWA configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── postcss.config.js        # PostCSS configuration
├── package.json             # Dependencies and scripts
├── package-lock.json        # Locked dependency versions
├── .gitignore              # Git ignore rules
├── CLAUDE.md               # This file (AI assistant guide)
├── FEATURES.md             # Feature roadmap and wish list
└── README.md               # User-facing documentation
```

### Key Files

**src/App.jsx** (Main Component - ~2,300 lines)
- Monolithic single-file React component containing all business logic
- 36 useState/useEffect/useRef hooks for state management
- LocalStorage for data persistence (workouts, levels, events, intervals.icu config)
- Four main tabs: Levels, Dashboard, Log, History
- Multiple modal systems for sync, import, FTP, events, and post-log summary

**Key Constants (lines 3-24):**
- `ZONES`: 6 training zone definitions with colors, power ranges, descriptions
- `DEFAULT_LEVELS`: Starting progression levels (all 1.0)
- `STORAGE_KEY`: LocalStorage key for workout data (`cycling-progression-data-v2`)
- `INTERVALS_CONFIG_KEY`: LocalStorage key for intervals.icu credentials
- `FTP`: Functional Threshold Power (235W)
- `START_DATE`: Import filter date (`2024-12-29`)

**Core Calculation Functions:**
- `calculateTSS()`: Training Stress Score (IF² × duration × 100 / 3600)
- `calculateIF()`: Intensity Factor (NP / FTP)
- `calculateTrainingLoads()`: CTL/ATL/TSB with exponential weighted averages
- `calculateNewLevel()`: Progression algorithm (difficulty + RPE based)
- `generateInsights()`: 11 different training recommendation types

**API Integration Functions:**
- `syncFromIntervalsICU()`: Fetches athlete data and workouts from intervals.icu
- `handleCSVImport()`: Parses CSV with auto column detection
- `mapWorkoutTypeToZone()`: Maps activity types to training zones

**Data Management Functions:**
- `exportData()`: Generates timestamped JSON backup
- `importData()`: Imports JSON files with validation
- `handlePasteImport()`: Allows raw JSON paste for restoration
- `copyForAnalysis()`: Exports formatted data for AI analysis
- `handleDeleteWorkout()`: Removes workout with confirmation

**Event Management Functions:**
- `handleSaveEvent()`: Save event configuration to localStorage
- `handleDeleteEvent()`: Delete event with confirmation
- `getDaysUntilEvent()`: Calculate countdown to event date

**FEATURES.md** (Feature Roadmap)
- Comprehensive list of 22+ planned features
- Priority levels (HIGH/MEDIUM/LOW)
- Implementation status tracking
- Notes on completed, in-progress, and planned features

---

## Tech Stack

### Current Stack

#### Frontend
- **Framework:** React 18.3.1
- **Language:** JavaScript (JSX)
- **Styling:** Tailwind CSS 3.4
- **State Management:** React useState hooks (no external library)
- **Data Persistence:** Browser LocalStorage

#### Build & Development
- **Bundler:** Vite 5.4
- **Dev Server:** Vite dev server with HMR
- **Package Manager:** npm
- **PWA:** vite-plugin-pwa 0.20

#### Styling
- **CSS Framework:** Tailwind CSS
- **PostCSS:** Autoprefixer for browser compatibility
- **Custom CSS:** Minimal custom styles in index.css

#### External API Integration
- **intervals.icu**: Optional sync for importing ride history
  - Requires Athlete ID and API Key (stored in localStorage)
  - Fetches: workouts, normalized power, TSS, IF, distance
  - Maps activity types to training zones automatically
  - Duplicate detection prevents re-importing

#### No Backend Server
- This is a pure frontend app
- All data stored in browser LocalStorage
- intervals.icu API calls made directly from browser
- Completely offline-capable once installed (cached data only)

#### Browser APIs Used
- LocalStorage API (data persistence for workouts, levels, events, config)
- Clipboard API (copy for analysis feature)
- File API (import/export workout data - JSON and CSV)
- Service Worker (PWA offline support)
- Fetch API (intervals.icu sync)

---

## Development Workflow

### Setting Up Development Environment

1. **Prerequisites**
   - Node.js (v18+ recommended)
   - Git
   - npm (comes with Node.js)

2. **Environment Variables**
   - **No environment variables required!**
   - All configuration is in source code (FTP, zones, etc.)
   - intervals.icu credentials stored in localStorage (user-provided)

3. **IDE Setup**
   - Recommended: VSCode with extensions:
     - ESLint (code quality)
     - Tailwind CSS IntelliSense (class autocomplete)
     - ES7+ React/Redux/React-Native snippets

### Development Server
```bash
# Start development server
npm run dev
# Opens at http://localhost:3000
# Network URL shown for mobile testing

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter (strict mode, no warnings allowed)
npm run lint
```

### Hot Reload and Watch Mode
- Vite provides instant HMR (Hot Module Replacement)
- React components update without losing state
- CSS changes apply immediately
- Service worker updates require refresh in dev mode

---

## Coding Conventions

### General Principles

1. **Code Style**
   - Use consistent indentation (2 or 4 spaces)
   - Follow language-specific style guides (Airbnb, Standard, etc.)
   - Use Prettier for automatic formatting
   - Use ESLint for code quality

2. **Naming Conventions**
   - **Files:** `kebab-case` for files, `PascalCase` for components
   - **Variables:** `camelCase` for variables and functions
   - **Constants:** `UPPER_SNAKE_CASE` for constants
   - **Classes/Components:** `PascalCase`
   - **Private methods:** Prefix with underscore `_privateMethod`

3. **TypeScript Guidelines** (if using TypeScript)
   - Prefer `interface` over `type` for object shapes
   - Use strict mode
   - Avoid `any` - use `unknown` or proper types
   - Define return types for functions
   - Use generics for reusable code

### Component Structure (if applicable)

```typescript
// Imports
import { useState, useEffect } from 'react';
import type { ComponentProps } from './types';

// Types/Interfaces
interface Props {
  // ...
}

// Component
export function ComponentName({ prop1, prop2 }: Props) {
  // Hooks
  const [state, setState] = useState();

  // Effects
  useEffect(() => {
    // ...
  }, []);

  // Handlers
  const handleEvent = () => {
    // ...
  };

  // Render
  return (
    // JSX
  );
}
```

### File Organization

- **One component per file** (for React/Vue/Svelte)
- **Group related files** in feature folders
- **Co-locate tests** with source files or in parallel structure
- **Barrel exports** for clean imports (`index.ts`)

### Comments and Documentation

- Write self-documenting code
- Add comments for complex logic or non-obvious decisions
- Use JSDoc for public APIs
- Keep comments up-to-date with code changes

```typescript
/**
 * Calculates the distance between two GPS coordinates
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // Implementation
}
```

---

## Testing Strategy

### Current State
- **No automated tests implemented yet**
- Testing is primarily manual via the PWA
- Future: Consider Vitest for unit tests of calculation functions

### Manual Testing Checklist
- [ ] Workout logging updates levels correctly
- [ ] CTL/ATL/TSB calculations match expected values
- [ ] intervals.icu sync imports without duplicates
- [ ] CSV import parses columns correctly
- [ ] Export/import preserves all data
- [ ] PWA installs and works offline
- [ ] Event countdown displays correctly

### Recommended Test Coverage (Future)
```
tests/
├── unit/
│   ├── calculateTSS.test.js
│   ├── calculateTrainingLoads.test.js
│   ├── calculateNewLevel.test.js
│   └── generateInsights.test.js
└── integration/
    └── intervalsICU.test.js
```

---

## Git Workflow

### Branch Strategy

- **Main Branch:** `main` or `master` (production-ready code)
- **Feature Branches:** `feature/description` or `claude/session-id`
- **Bug Fixes:** `fix/description`
- **Hotfixes:** `hotfix/description`

### Commit Messages

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(auth): add user login functionality

Implement JWT-based authentication with email/password login.
Includes form validation and error handling.

Closes #123
```

### Pull Request Process

1. Create feature branch from main
2. Make changes and commit
3. Push branch to remote
4. Create pull request with clear description
5. Address review comments
6. Merge when approved

### AI Assistant Git Rules

When working as an AI assistant:

1. **Always work on designated branches** (e.g., `claude/session-id`)
2. **Commit frequently** with descriptive messages
3. **Push to remote** when task is complete
4. **Never force push** without explicit permission
5. **Don't push directly to main** unless authorized
6. **Create PRs** instead of direct merges

---

## Deployment

### Environments

- **Local Development:** `npm run dev` - http://localhost:3000
- **Production:** Deployed to static hosting (Netlify, Vercel, or GitHub Pages)

### Deployment Process

This is a static PWA with no backend, so deployment is straightforward:

#### Option 1: Netlify (Recommended)
```bash
# Build
npm run build

# Deploy via CLI
npm install -g netlify-cli
netlify deploy --prod

# Or connect GitHub repo for automatic deploys
```

#### Option 2: Vercel
```bash
# Deploy
npm install -g vercel
vercel

# Auto-deploys on git push when connected
```

#### Option 3: GitHub Pages
```bash
# Install gh-pages
npm install -D gh-pages

# Add to package.json:
# "homepage": "https://username.github.io/cycling"
# "scripts": { "deploy": "gh-pages -d dist" }

# Update vite.config.js base to '/cycling/'

# Deploy
npm run deploy
```

### Build Output
- Build command: `npm run build`
- Output directory: `dist/`
- All assets are static (HTML, CSS, JS, images)
- Service worker generated automatically for PWA

### Environment Variables
**No environment variables required!**

This app has:
- No backend API
- No database connections
- No external services
- No secrets or API keys

All configuration is in the source code:
- FTP value in `src/App.jsx` line 22
- Storage key in `src/App.jsx` line 24
- Training zones in `src/App.jsx` lines 3-10

### PWA Installation
After deployment, users can install the PWA:
1. Visit the deployed URL on iPhone Safari
2. Tap Share → Add to Home Screen
3. App icon appears on home screen
4. Works offline after first visit

---

## Common Tasks

### Adding a New Feature

1. Create feature branch
2. Implement feature following conventions
3. Write tests for new functionality
4. Update documentation
5. Create pull request

### Fixing a Bug

1. Reproduce the bug
2. Write failing test
3. Fix the bug
4. Verify test passes
5. Commit with descriptive message

### Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update specific package
npm update package-name

# Update all packages
npm update
```

### Code Review Checklist

- [ ] Code follows project conventions
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No console.logs or debugging code
- [ ] Performance considerations addressed
- [ ] Security best practices followed
- [ ] Accessibility requirements met

---

## Troubleshooting

### Common Issues

#### Build Failures
- **ESLint errors:** Run `npm run lint` to see issues, fix before build
- **Missing dependencies:** Delete `node_modules` and `npm install` fresh
- **Vite cache issues:** Delete `.vite` folder and restart dev server

#### intervals.icu Sync Issues
- **401 Unauthorized:** Check Athlete ID and API Key are correct
- **No workouts imported:** Check START_DATE in App.jsx (line 24)
- **Duplicate workouts:** Sync detects duplicates by date - expected behavior
- **eFTP not showing:** Field path may vary - check console for API response

#### PWA Issues
- **Not installing:** Must be served over HTTPS (except localhost)
- **Stale cache:** Force refresh or clear browser cache
- **iOS issues:** Use Safari only, other browsers don't support PWA

#### Data Issues
- **Lost data:** Check localStorage in DevTools → Application → Local Storage
- **Import fails:** Ensure JSON format matches expected structure
- **CSV parse errors:** Check column headers match expected names

### Getting Help

- Check [FEATURES.md](./FEATURES.md) for known limitations
- Review existing issues in GitHub issue tracker
- Check browser DevTools console for errors
- Consult this CLAUDE.md file for patterns and conventions

---

## AI Assistant Guidelines

### When Working on This Project

#### DO:

✅ **Read First, Code Second**
- Always read existing files before modifying
- Understand the context and patterns
- Check for similar implementations

✅ **Follow Existing Patterns**
- Match the coding style of surrounding code
- Use established patterns and conventions
- Maintain consistency throughout codebase

✅ **Write Tests**
- Add tests for new features
- Update tests when modifying code
- Ensure all tests pass before committing

✅ **Document Changes**
- Update comments and documentation
- Add JSDoc for public APIs
- Update this CLAUDE.md when needed

✅ **Commit Frequently**
- Make small, focused commits
- Write clear commit messages
- Push changes when task is complete

✅ **Ask Questions**
- Use AskUserQuestion tool when unclear
- Clarify requirements before implementing
- Validate assumptions

✅ **Be Security Conscious**
- Validate user input
- Avoid SQL injection, XSS, etc.
- Handle errors gracefully
- Don't expose sensitive data

#### DON'T:

❌ **Over-Engineer**
- Don't add unnecessary abstractions
- Keep solutions simple and focused
- Only implement what's requested

❌ **Make Assumptions**
- Don't guess at requirements
- Don't assume file locations
- Read the actual code

❌ **Skip Tests**
- Don't commit untested code
- Don't ignore failing tests
- Don't remove tests to make them pass

❌ **Ignore Conventions**
- Don't use different naming styles
- Don't bypass established patterns
- Don't create new conventions without discussion

❌ **Commit Without Reading**
- Don't modify files you haven't read
- Don't merge without reviewing changes
- Don't commit commented-out code or debug logs

❌ **Push to Wrong Branch**
- Don't push to main/master directly
- Always use designated feature branches
- Follow git workflow rules

### Task Management

When working on tasks:

1. **Use TodoWrite** for multi-step tasks
2. **Break down complex tasks** into smaller steps
3. **Mark tasks as in_progress** before starting
4. **Complete tasks immediately** when finished
5. **Update status** in real-time

### Code Quality Standards

- **Readability:** Code should be self-documenting
- **Maintainability:** Easy to modify and extend
- **Performance:** Optimize for common use cases
- **Security:** Follow OWASP guidelines
- **Accessibility:** Follow WCAG guidelines
- **Testing:** High coverage on critical paths

### File Operations

- **Use Read tool** to read files (not `cat`)
- **Use Edit tool** to modify files (not `sed`)
- **Use Write tool** to create files (not `echo >`)
- **Use Glob tool** to find files (not `find`)
- **Use Grep tool** to search content (not `grep`)

### When in Doubt

1. **Check this CLAUDE.md file**
2. **Read existing code** for patterns
3. **Search for similar implementations**
4. **Ask the user** for clarification
5. **Default to simplicity** over complexity

---

## Project-Specific Notes

### Domain Knowledge: Cycling

This project implements cycling training concepts inspired by TrainerRoad:

**Training Zones (Power-Based):**
- **Z2 Endurance:** 130-165W - Aerobic base building
- **Z3 Tempo:** 165-185W - Sustainable aerobic power
- **Sweet Spot:** 195-220W - Between tempo and threshold (not a formal zone)
- **Z4 Threshold:** 220-235W - Lactate threshold/FTP work
- **Z5 VO2max:** 235-280W - Maximum aerobic capacity
- **Z6 Anaerobic:** 280W+ - Anaerobic capacity

**Key Metrics:**
- **FTP (Functional Threshold Power):** Maximum sustainable power for ~1 hour (235W for this user)
- **TSS (Training Stress Score):** Quantifies training load based on intensity and duration
- **NP (Normalized Power):** Weighted average power accounting for variability
- **IF (Intensity Factor):** Ratio of NP to FTP (intensity of workout)
- **RPE (Rate of Perceived Exertion):** 1-10 subjective difficulty scale

**Training Load (Performance Management Chart):**
- **CTL (Chronic Training Load):** 42-day exponentially weighted average of daily TSS (fitness)
- **ATL (Acute Training Load):** 7-day exponentially weighted average of daily TSS (fatigue)
- **TSB (Training Stress Balance):** CTL - ATL (form/freshness)

**Progression Level System:**
- Scale of 1-10 for each training zone
- Increases when completing workouts harder than current level
- RPE vs difficulty determines progression rate
- Similar to TrainerRoad's adaptive training

**Event Context:**
- Target event: Gran Fondo Utah (June 13, 2026)
- Long endurance event requiring high CTL (80-100 target)
- Emphasis on sustained power and endurance
- Training should peak ~2 weeks before event

### External APIs and Services

**intervals.icu Integration:**
- **Authentication:** Athlete ID + API Key (Basic Auth)
- **Base URL:** `https://intervals.icu/api/v1`
- **Endpoints Used:**
  - `GET /athlete/{id}` - Fetch athlete profile (includes eFTP)
  - `GET /athlete/{id}/activities` - Fetch workout history
- **Rate Limits:** Not explicitly documented, use responsibly
- **Data Extracted:** date, type, moving_time, icu_training_load (TSS), icu_intensity, distance
- **Zone Mapping:** Activity types mapped to zones (Ride→Z2, Tempo→Z3, etc.)

### Data Models

**Workout Object:**
```javascript
{
  id: string,              // UUID for unique identification
  date: string,            // YYYY-MM-DD format
  zone: string,            // Zone ID (z2, z3, sweetspot, z4, z5, z6)
  workoutLevel: number,    // 1-10 difficulty of workout
  rpe: number,             // 1-10 perceived exertion
  completed: boolean,      // Whether workout was completed
  duration: number,        // Minutes
  normalizedPower: number, // Watts (NP)
  rideType: string,        // 'Outdoor' or 'Indoor'
  distance: number,        // Miles
  notes: string,           // Optional notes
  tss: number,             // Calculated TSS
  intensityFactor: number, // NP / FTP
  previousLevel: number,   // Level before workout
  newLevel: number,        // Level after workout
  change: number           // Level change (+/-)
}
```

**Event Object:**
```javascript
{
  name: string,      // Event name (e.g., "Gran Fondo Utah")
  date: string,      // YYYY-MM-DD format
  distance: number,  // Miles
  targetCTL: number  // Target fitness level (e.g., 80-100)
}
```

**Training Loads Object:**
```javascript
{
  ctl: number,         // 42-day exponential average (fitness)
  atl: number,         // 7-day exponential average (fatigue)
  tsb: number,         // CTL - ATL (form/freshness)
  weeklyTSS: number,   // Current week total
  prevWeeklyTSS: number // Previous week total
}
```

**intervals.icu Config Object:**
```javascript
{
  athleteId: string,  // intervals.icu athlete ID
  apiKey: string      // API key for authentication
}
```

### Business Logic

**Progression Level Algorithm:**
```javascript
// Base progression calculation
difficulty = workoutLevel - currentLevel
baseIncrease = difficulty > 0 ? difficulty * 0.15 : difficulty * 0.05

// RPE adjustment (higher RPE = harder than expected)
rpeAdjustment = (rpe - 5) * 0.02

// Final change (capped 1.0-10.0)
change = completed ? baseIncrease + rpeAdjustment : -0.1
newLevel = clamp(currentLevel + change, 1.0, 10.0)
```

**Training Load Calculations:**
```javascript
// Exponential weighted averages
CTL_DECAY = 2 / (42 + 1)  // 42-day time constant
ATL_DECAY = 2 / (7 + 1)   // 7-day time constant

// Daily update
newCTL = previousCTL + (todayTSS - previousCTL) * CTL_DECAY
newATL = previousATL + (todayTSS - previousATL) * ATL_DECAY
TSB = CTL - ATL
```

**TSS Calculation:**
```javascript
TSS = (IF² × duration_seconds × 100) / 3600
// Where IF = Normalized Power / FTP
```

**TSB Status Ranges:**
- `tsb >= 25`: "Fresh" (green)
- `tsb >= 10`: "Form" (green)
- `tsb >= -10`: "Neutral" (gray)
- `tsb >= -25`: "Tired" (orange)
- `tsb >= -40`: "Fatigued" (orange)
- `tsb < -40`: "Overreached" (red)

---

## Maintenance

### Keeping CLAUDE.md Updated

This file should be updated when:

- Project structure changes
- New technologies are added
- Conventions are established or changed
- Common issues are identified
- New patterns emerge
- Deployment process changes

**Last Review:** 2026-01-26
**Next Review:** When significant changes occur

---

## Additional Resources

- [Project README](./README.md) - User-facing documentation
- [Feature Roadmap](./FEATURES.md) - Planned features and wish list
- [intervals.icu API](https://intervals.icu/api) - External API documentation

---

## Changelog

### 2026-01-26
- **Event/Goal Management:** Full CRUD for event configuration with countdown and CTL targets
- **Ride Type & Distance Tracking:** New fields for Indoor/Outdoor classification and miles
- **Cloud Sync Guide:** Manual sync documentation via Google Drive/Dropbox/iCloud
- **Delete Workout:** With confirmation modal
- **Training Summary Compact:** Single row layout refactor
- **CLAUDE.md Update:** Comprehensive documentation refresh with data models and API details

### 2026-01-23
- **CSV Import:** Full CSV support with validation and automatic zone mapping
- **eFTP Display:** Shows estimated FTP from intervals.icu in header
- **Interactive FTP Modal:** Options to Recalculate, Adjust Zones, or Ignore FTP changes
- **Package Lock:** Added for dependency management

### 2026-01-22
- Initial creation of CLAUDE.md
- **intervals.icu Integration:** API sync for ride history import
- **Full PWA Setup:** Service worker and offline support
- Established basic structure and guidelines

---

**Note to AI Assistants:** This file is a living document. As you work on the project and learn more about its structure and conventions, please update this file to reflect the current state of the codebase. Your contributions to keeping this documentation accurate and helpful are valuable for all future AI assistants working on this project.
