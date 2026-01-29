# CLAUDE.md - AI Assistant Guide for Cycling Project

**Last Updated:** 2026-01-22
**Project:** Cycling
**Repository:** caseywalrath/cycling

## Purpose

This file serves as a comprehensive guide for AI assistants (like Claude) working on this codebase. It documents the project structure, development workflows, coding conventions, and key patterns that AI assistants should follow when contributing to this project.

---

## REQUIRED: First Steps for Every Session

Before doing anything else, you MUST:

1. **Read `ARCHITECTURE.md`** — contains developer context, component structure, key functions, chart details, and UI layout reference.
2. **Read `CHANGELOG.md`** — contains session-by-session history of all changes. Review to understand what has already been built, recently changed, or intentionally removed.
3. **Notify the user** which branch you are on and that it includes all prior work (see Branch Management in `ARCHITECTURE.md`).

Do not skip these steps. They prevent duplicate work, reverted features, and confusion about the current state of the app.

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
- Smart training insights and recommendations
- Export/import workout data
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
│   ├── App.jsx              # Main application component (all logic here)
│   ├── main.jsx             # React entry point
│   └── index.css            # Global styles with Tailwind directives
├── public/
│   ├── pwa-192x192.png      # PWA icon (192x192)
│   ├── pwa-512x512.png      # PWA icon (512x512)
│   ├── apple-touch-icon.png # iOS home screen icon
│   └── vite.svg             # Favicon
├── index.html               # HTML entry point
├── vite.config.js           # Vite + PWA configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── postcss.config.js        # PostCSS configuration
├── package.json             # Dependencies and scripts
├── .gitignore              # Git ignore rules
├── README.md               # User-facing documentation
└── CLAUDE.md               # This file (AI assistant guide)
```

### Key Files

**src/App.jsx** (Main Component)
- Single-file React component (~600 lines)
- Contains all application logic
- State management with useState
- LocalStorage for data persistence
- Four main tabs: Levels, Dashboard, Log, History

**Key Constants:**
- `ZONES`: Training zone definitions with colors and power ranges
- `FTP`: Functional Threshold Power (235W - line 22)
- `STORAGE_KEY`: LocalStorage key for data persistence

**Core Functions:**
- `calculateTSS()`: Training Stress Score calculation
- `calculateTrainingLoads()`: CTL/ATL/TSB calculations
- `calculateNewLevel()`: Progression level algorithm
- `generateInsights()`: AI-like training recommendations

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

#### No Backend
- This is a pure frontend app
- All data stored in browser LocalStorage
- No database or API calls
- Completely offline-capable once installed

#### Browser APIs Used
- LocalStorage API (data persistence)
- Clipboard API (copy for analysis feature)
- File API (import/export workout data)
- Service Worker (PWA offline support)

---

## Development Workflow

### Setting Up Development Environment

1. **Prerequisites**
   - Node.js (specify version when determined)
   - Git
   - [Other tools as needed]

2. **Environment Variables**
   ```bash
   # Create .env file (update when variables are defined)
   cp .env.example .env
   ```

3. **IDE Setup**
   - Recommended: VSCode with extensions:
     - ESLint
     - Prettier
     - TypeScript
     - [Project-specific extensions]

### Development Server
```bash
# Start development server (update when configured)
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Format code
npm run format
```

### Hot Reload and Watch Mode
*Document any special development mode features here*

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

### Testing Philosophy
- Write tests for critical business logic
- Aim for high coverage on core features
- Test user interactions, not implementation details
- Use test-driven development (TDD) when appropriate

### Test Organization
```
tests/
├── unit/           # Pure function tests, utility tests
├── integration/    # API tests, service tests
└── e2e/            # Full user flow tests
```

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test path/to/test
```

### Writing Tests

```typescript
describe('ComponentName', () => {
  it('should render correctly', () => {
    // Arrange
    const props = { /* ... */ };

    // Act
    const result = render(<ComponentName {...props} />);

    // Assert
    expect(result).toBeDefined();
  });
});
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
*Document common build issues and solutions*

#### Test Failures
*Document common test issues and solutions*

#### Runtime Errors
*Document common runtime issues and solutions*

### Getting Help

- Check documentation in `/docs`
- Review existing issues in issue tracker
- Ask team members for guidance
- Consult this CLAUDE.md file

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
*Document any external services used (Strava, MapBox, etc.)*

### Data Models
*Document key data structures and relationships*

### Business Logic
*Document critical business rules and algorithms*

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

**Last Review:** 2026-01-22
**Next Review:** When significant changes occur

---

## Additional Resources

- [Project README](./README.md) - User-facing documentation
- [Contributing Guide](./CONTRIBUTING.md) - Contribution guidelines
- [Code of Conduct](./CODE_OF_CONDUCT.md) - Community guidelines
- [Architecture Docs](./docs/architecture.md) - System architecture
- [API Docs](./docs/api.md) - API documentation

---

## Changelog

### 2026-01-22
- Initial creation of CLAUDE.md
- Established basic structure and guidelines
- Created template sections for future development

---

**Note to AI Assistants:** This file is a living document. As you work on the project and learn more about its structure and conventions, please update this file to reflect the current state of the codebase. Your contributions to keeping this documentation accurate and helpful are valuable for all future AI assistants working on this project.
