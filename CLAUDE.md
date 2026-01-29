# CLAUDE.md - AI Assistant Behavior Guide

**Last Updated:** 2026-01-29

---

## REQUIRED: First Steps for Every Session

Before doing anything else, you MUST:

1. **Read `ARCHITECTURE.md`** — the authoritative reference for app structure, components, state, functions, charts, and UI layout.
2. **Read `CHANGELOG.md`** — session-by-session history of all changes. Review to understand what has already been built, recently changed, or intentionally removed.
3. **Notify the user** which branch you are on and that it includes all prior work (see Branch Management below).

Do not skip these steps. They prevent duplicate work, reverted features, and confusion about the current state of the app.

---

## Developer Context

**User Experience Level**: Beginner/non-coder
- Limited experience with Git, GitHub, and project development
- Uses VS Code primarily for running `npm run dev` and pulling from Git
- Interfaces with Claude through web/chat, not terminal-based development
- Requires clear, step-by-step instructions with explicit file paths

---

## Communication Guidelines

- Use plain language, avoid jargon where possible
- Always specify full file paths (e.g., `src/App.jsx` not "the main file")
- Explain *where* code changes are happening before making them
- Verify branch state before implementing features
- Show git commands explicitly: `git status`, `git pull`, `git checkout branch-name`
- Explain deployment implications (what happens when code is pushed)
- Confirm which branch should be used as base before starting work
- Use specific line numbers when referencing code locations

---

## Branch Management

Each Claude Code session is assigned a new `claude/` branch (e.g., `claude/fix-progression-levels-jyD2G`). These branches are **sequential, not parallel** — each one builds on top of the previous session's work. They are session bookmarks, not independent feature branches.

**At session start**: Always notify the user what branch you are working on and why a new branch was created. Example: "This session is on branch `claude/review-changelog-SDb6v`. It was created automatically for this session and includes all prior work."

**After every set of changes**: End with explicit pull instructions so the user can sync locally in VS Code:
```
git fetch origin <branch-name>
git checkout <branch-name>
git pull origin <branch-name>
```
If the user is already on the branch, remind them that only `git pull origin <branch-name>` is needed.

---

## Common Issues to Prevent

- Wrong branch base → old UI deploying (see CHANGELOG.md Session 4)
- Features reverting due to unclear git state
- Changes made to wrong files
- User confusion about what version is "live"
- User not knowing a new branch was created or how to pull it

---

## Git Workflow

- Always work on designated `claude/` branches
- Commit frequently with descriptive messages using conventional commits (`feat`, `fix`, `docs`, `refactor`, etc.)
- Push to remote when task is complete
- Never force push without explicit permission
- Don't push directly to main unless authorized

---

## Project Quick Reference

- **App**: Gran Fondo Utah Training Tracker (PWA)
- **Event**: Gran Fondo Utah — June 13, 2026
- **Stack**: React 18 + Vite + Tailwind CSS, no backend, localStorage only
- **Main file**: `src/App.jsx` (single-file app, ~3600 lines)
- **Dev server**: `npm run dev` → http://localhost:3000
- **Build**: `npm run build` → `dist/`
- **No env vars required** — all config is in source code

For full app structure, state, functions, charts, and UI layout, see **ARCHITECTURE.md**.
