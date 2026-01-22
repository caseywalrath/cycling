# CLAUDE.md - AI Assistant Guide for Cycling Project

**Last Updated:** 2026-01-22
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
**Status:** 🚧 New Project - In Development

This repository is for the Cycling project. As the project develops, this section should be updated with:
- Project description and goals
- Target audience/users
- Key features and functionality
- Business context and requirements

### Quick Start
```bash
# Clone the repository
git clone <repository-url>
cd cycling

# Install dependencies (update when package.json exists)
npm install

# Run development server (update when scripts are defined)
npm run dev

# Run tests (update when test framework is configured)
npm test
```

---

## Codebase Structure

### Current State
The repository is currently empty. As the project develops, document the directory structure here.

### Expected Structure (Template)
```
cycling/
├── src/                    # Source code
│   ├── components/         # Reusable UI components
│   ├── pages/             # Page components/routes
│   ├── services/          # Business logic and API calls
│   ├── utils/             # Utility functions
│   ├── hooks/             # Custom React hooks (if React)
│   ├── types/             # TypeScript type definitions
│   ├── styles/            # Global styles and themes
│   └── config/            # Configuration files
├── public/                # Static assets
├── tests/                 # Test files
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── e2e/              # End-to-end tests
├── docs/                  # Documentation
├── scripts/               # Build and utility scripts
└── [config files]         # Root-level configuration
```

### Key Directories
*Update this section as the project structure emerges*

---

## Tech Stack

### Current Stack
*To be determined - Update as technologies are chosen*

### Recommended Stack Options

#### Frontend
- **Framework:** React, Vue, Angular, or Svelte
- **Language:** TypeScript (strongly recommended)
- **Styling:** Tailwind CSS, CSS Modules, Styled Components, or SASS
- **State Management:** Redux, Zustand, Jotai, or React Context

#### Backend (if applicable)
- **Runtime:** Node.js, Deno, or Bun
- **Framework:** Express, Fastify, NestJS, or Next.js API routes
- **Database:** PostgreSQL, MongoDB, or SQLite
- **ORM:** Prisma, Drizzle, or TypeORM

#### Testing
- **Unit/Integration:** Jest, Vitest, or Mocha
- **E2E:** Playwright, Cypress, or Puppeteer
- **Assertions:** Testing Library, Chai

#### Build Tools
- **Bundler:** Vite, Webpack, or esbuild
- **Package Manager:** npm, yarn, or pnpm

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

- **Development:** Local development environment
- **Staging:** Pre-production testing (if applicable)
- **Production:** Live production environment

### Deployment Process
*Update when deployment pipeline is configured*

```bash
# Build production bundle
npm run build

# Run production server
npm run start
```

### Environment Variables
*Document required environment variables here*

| Variable | Description | Required |
|----------|-------------|----------|
| `API_URL` | Backend API URL | Yes |
| `DATABASE_URL` | Database connection string | Yes |
| ... | ... | ... |

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

This project is related to cycling. Relevant domain concepts may include:

- **Activities/Rides:** GPS tracking, routes, distance, elevation
- **Performance Metrics:** Speed, cadence, heart rate, power
- **Equipment:** Bikes, components, maintenance
- **Routes:** Maps, elevation profiles, waypoints
- **Social Features:** Challenges, leaderboards, clubs
- **Training:** Workouts, plans, goals

*Update this section with actual project-specific domain knowledge*

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
