# Implementation Plan: Casey Rides 2.0

**Status:** Planned, not started
**Designed:** 2026-09-25 (session on branch `claude/eftp-metric-analysis-9qd058`)
**Written against:** `src/App.jsx` at commit `6354d97` (5,353 lines). Line numbers are
approximate and go stale after the first phase. **Always find code by the quoted search
strings, not by line number.**

---

## How to use this plan

The work is split into **7 phases**. Each phase is one Claude Code session, and ends in a
working, deployable app. Do not start a phase until the previous one is merged or pulled.

To run a phase, start a new session with the recommended model and say:

> Implement Phase N of V2_PLAN.md, following CLAUDE.md. Complete every verification step
> in that phase before pushing.

| Phase | What | Model | Why this model |
|---|---|---|---|
| 1 | Remove dead code and the leaked API key; move pure helpers into `src/lib/` | **Haiku** | Deleting listed blocks and moving functions verbatim. Tightly bounded, with a build + regression check to catch mistakes |
| 2 | Bug fixes and one shared zone definition | **Sonnet** | Small, well-specified logic changes |
| 3 | App shell: bottom tabs, safe areas, UI kit, data layer, Today tab | **Opus** | Delicate: moves all state and save logic out of one component, and sets the visual design every later phase copies |
| 4 | Rides tab, Ride page, Log Ride v2, Settings tab, Drive auto-sync | **Sonnet** | Builds screens from the Phase 3 kit to a written spec |
| 5 | Metrics engine: full-resolution bests, heart-rate TSS, zones, drift, efficiency, records; tests | **Sonnet** | Pure math with tests |
| 6 | Progress tab and Today alerts using the Phase 5 metrics | **Sonnet** (load the `dataviz` skill) | Chart screens to spec |
| 7 | Progression level rebuild | **Opus** | Model design, calibration against real history, migration judgement |

### Rules for every phase

1. **First steps from `CLAUDE.md`:** read `ARCHITECTURE.md` and `CHANGELOG.md`, and tell the
   user which branch you're on.
2. **Start from a green baseline.** Run `npm install` if `node_modules` is missing, then
   `npm run build`, then the regression check (§0.4). Everything must pass *before* you
   change anything. If it doesn't, stop and report.
3. **Stay in scope.** Do only the phase you were asked to do. If you find a problem that
   belongs to a later phase, note it in the CHANGELOG entry; don't fix it.
4. **No data loss, ever.** Never delete or rewrite fields on existing rides unless the
   phase says so. Old saved data and old backup files must still load (§0.3).
5. **Commits:** conventional commits (`feat`, `fix`, `refactor`, `docs`, `chore`, `test`),
   several small commits per phase rather than one big one. Never force push.
6. **Docs:** update `ARCHITECTURE.md` (it must describe the app as it now is) and add a new
   CHANGELOG session entry at the top. Set this file's **Status** line to say which phases
   are done.
7. **End-of-phase report to the user.** Plain language (the user is a beginner). Include:
   - what changed, as the user will see it on their iPhone;
   - anything skipped and why;
   - regression check results;
   - the `git pull` instructions from `CLAUDE.md`;
   - and a final line in exactly this form:

   > **Next: Phase N+1 — <name>. Best model: <Haiku | Sonnet | Opus>.** Start a new session
   > and say: "Implement Phase N+1 of V2_PLAN.md, following CLAUDE.md."

   After Phase 7, instead say that the V2 plan is complete.

### Orchestrated mode (optional: one Opus session runs every phase)

Instead of starting 7 sessions by hand, the user can start **one Opus session** and say:

> Run V2_PLAN.md in orchestrated mode, following CLAUDE.md.

The Opus session is the **orchestrator**. It runs each phase through a **sub-agent** (the
Agent tool) with the phase's model from the table above (`model: "haiku" | "sonnet" |
"opus"`). Everything else in this plan still applies, with these changes.

**Order and branch**
- Run phases **strictly in order, one at a time**, never in parallel. Each phase depends on
  the previous one, and the regression check needs the one dev server on port 3000.
- All phases go on the **session's single `claude/` branch**. Do not create a branch per
  phase.
- Phases already marked done in this file's **Status** line are skipped. That lets a
  stopped run resume in a new session.

**What each sub-agent gets.** Sub-agents start with no memory, so their prompt must be
complete:
- "Implement Phase N of `V2_PLAN.md`, following `CLAUDE.md` and the 'Rules for every
  phase'";
- the branch name;
- a summary of anything earlier phases reported as deferred or changed;
- instructions to commit (conventional commits) but **not push** and **not** write the
  user-facing end-of-phase report;
- instructions to return: a list of commits, the regression check output, any baseline
  changes with reasons, anything skipped, and known issues.

**The orchestrator verifies every phase itself. Never trust a sub-agent's "all passed".**
1. Run `npm run build` (and `npm test` from Phase 5 on).
2. Start the dev server and run `node tools/v2-check.mjs` yourself. Any diff must be one the
   phase expects.
3. Read the screenshots in `tools/.out/`.
4. Read the phase's diff (`git diff <start>..HEAD`) against the phase spec.
5. On failure, send the problem back to the same sub-agent (SendMessage) or fix it directly.
   Re-verify, then continue.
6. Push the branch (`git push -u origin <branch>`, retry on network errors as `CLAUDE.md`
   says). One push per phase gives the user a restore point.
7. Update the **Status** line and the checklist below, and commit that.
8. Stop the dev server before starting the next phase.

**Reports**
- Each phase's plain-language summary goes in its CHANGELOG entry. The phase rules already
  require this; the orchestrator makes sure it's written for a beginner.
- The user gets a short progress message after each phase (one or two lines) and a full
  report at each pause and at the end. That report includes the `git pull` instructions and
  a "What's new in 2.0" list at the end.
- The "Next: Phase N+1 … Best model" line is not needed between phases. It goes in the
  report only when the run stops early.

**Required pauses.** Stop and wait for the user:
- **After Phase 3.** Ask the user to pull or deploy and try the new layout on their iPhone.
  Every later phase copies Phase 3's design, so changes are cheapest here. Continue only
  when the user says so, and apply any requested layout changes (with an Opus sub-agent)
  before Phase 4.
- **Start of Phase 7.** Ask for the exported backup (§7.3). Keep it in the scratchpad and
  never commit it.
- **During Phase 7.** Show the calibration table and get agreement before the constants
  are final.
- **Any time a phase can't be made to pass** after two fix attempts. Report what's failing
  and stop. Do not skip ahead.

**Progress checklist** (the orchestrator ticks these as it goes; manual runs may too)

- [ ] Phase 1 — dead code and helpers (Haiku)
- [ ] Phase 2 — bug fixes and zones (Sonnet)
- [ ] Phase 3 — shell, kit, Today (Opus) → **pause for user review**
- [ ] Phase 4 — Rides, Ride page, Log Ride, Settings (Sonnet)
- [ ] Phase 5 — metrics engine (Sonnet)
- [ ] Phase 6 — Progress tab and alerts (Sonnet)
- [ ] Phase 7 — progression rebuild (Opus) → **needs user's backup and sign-off**

---

## 0. Shared reference

### 0.1 Decisions already made by the user (do not relitigate)

| # | Decision |
|---|---|
| D1 | Progression levels are **rebuilt** on real workout structure (Phase 7), keeping each zone's current level as the starting point. |
| D2 | **Remove everything intervals.icu**: API sync, CSV paste, the VO2max estimator that depends on it, the FTP-increase modal, the power-curve CSV import. Keep all data already saved from it. |
| D3 | Google Drive sync: push **automatically** after changes when a Google sign-in is still valid; otherwise a Sync button in Settings shows an "unsynced changes" state. Never open a sign-in popup automatically. |
| D4 | Event: show "No event set" when there isn't one, and "Event complete" once it has passed. Never show negative days. |
| D5 | Outdoor rides do **not** change progression levels, and are **not** filed under a training zone in Workout Progression. They **do** count toward power bests, eFTP, training load and all new charts. |
| D6 | iPhone first. The layout is designed for 390px width in the home-screen app; desktop just gets a centred column (max width `max-w-2xl`). |

### 0.2 Hard constraints

- **Stack stays:** React 18, Vite, Tailwind, Recharts, `fit-file-parser`, no backend,
  localStorage. The only new dependency allowed in the whole plan is **`vitest`**
  (devDependency, Phase 5). No router library, no state library, no icon library, no UI kit.
- **Deployment unchanged:** GitHub Pages at `/cycling/`, PWA config in `vite.config.js`.
- **Storage key unchanged:** `STORAGE_KEY = 'cycling-progression-data-v2'`. New top-level
  fields may be added (§0.3); none may be removed or renamed.
- **Dates:** always `parseDateLocal()` / `toLocalDateStr()`, never `new Date("YYYY-MM-DD")`
  (see ARCHITECTURE.md).
- **Language in the UI:** plain words first, jargon second. E.g. "Fitness (CTL)", "Form (TSB)".

### 0.3 Saved data compatibility

The saved JSON (localStorage, Export file and Google Drive backup share one shape) is:

```
{ levels, history, ftp, intervalsFTP, event, userProfile, vo2maxEstimates, powerCurveData,
  exportedAt, lastSyncedAt, lastWorkedDates }
```

- `intervalsFTP`, `vo2maxEstimates` and `powerCurveData` are **pass-through** after Phase 1.
  Load them, keep them in state or a ref, and write them back unchanged. Nothing edits them
  any more, but a user's old backup must round-trip without losing them. `powerCurveData`
  is still *read* by Power Skills until Phase 6 replaces it.
- Phase 3 adds `schemaVersion: 2` to the saved object. The loader must accept files with no
  `schemaVersion`, i.e. every existing backup.
- New optional ride fields added by later phases are listed in §0.5. Every consumer must
  null-check them, because old rides won't have them.

### 0.4 Regression check: `tools/v2-check.mjs`

This check was written and run when this plan was created. Its baseline is
`tools/v2-baseline.json`.

What it does:
- seeds the app with a fixed synthetic history of 158 rides;
- freezes the clock at 2026-09-25 12:00;
- reads the header line and the fitness numbers (CTL, ATL, TSB) and the training status;
- imports a synthetic `3x8 @ 250W` .tcx file through Log Ride and saves it;
- writes screenshots to `tools/.out/` (gitignored);
- diffs the result against the baseline.

How to run it:

```
npx vite --port 3000 &            # leave running
node tools/v2-check.mjs           # compare
node tools/v2-check.mjs --write-baseline   # only when a number changes ON PURPOSE
```

Rules:
- `pageErrors` must always be empty.
- Any other difference must be one the phase *expects*. Explain it in the CHANGELOG, then
  re-write the baseline in the same commit.
- **Always look at the screenshots** in `tools/.out/` (use the Read tool on the PNGs).
  Several phases are visual, and a build that passes can still look broken.
- When a phase changes the UI, keep the script working by updating its selectors (e.g. the
  Log Ride button, the Save button, the TCX file input). The same data must still be
  captured. Phases 3–6 will need to extend `numbers` (e.g. read CTL from its new place on
  the Today tab). Keep the key names the same.

### 0.5 New ride fields introduced by this plan (all optional)

| Field | Phase | Meaning |
|---|---|---|
| `bests` | 5 | `{ "5": W, "15": W, "30": W, "60": W, "120": W, "300": W, "600": W, "1200": W, "1800": W, "3600": W, "5400": W, "7200": W }`: best average power per duration, from 1-second data at import. Keys missing when the ride is shorter. |
| `hrStats` | 5 | `{ avg, max }` in bpm, from 1-second data at import |
| `avgPower` | 5 | Average power including zeros (watts), from the file |
| `tssSource` | 5 | `'power'` or `'hr'` (absent means `'power'`) |
| `historical` | 4 | `true` for old imported rides the user has chosen to stop classifying |
| `workoutLevelSource` | 7 | `'structure'` (calculated from intervals), `'manual'` or `'legacy'` |

---

## Phase 1 — Clean out dead code and move helpers (Haiku)

**Goal:** a smaller file with the leaked key gone and nothing visible changed.
**The regression check must show no differences.**

### 1.1 Remove the intervals.icu API key and everything intervals.icu

Delete these from `src/App.jsx`. Find each by its search string. After each deletion, run
`npm run build` and fix any "is not defined" error by deleting the now-dangling reference.
Never fix one by re-adding code.

| Delete | Search string |
|---|---|
| `INTERVALS_CONFIG_KEY` constant | `const INTERVALS_CONFIG_KEY` |
| `START_DATE` constant | `const START_DATE` |
| intervals.icu state block (**this holds the leaked API key**) | `// intervals.icu integration state` through `const [isSyncing, setIsSyncing]` |
| Effect that loads intervals config | `// Load intervals.icu config from localStorage` (the whole `useEffect`) |
| CSV import state | `// CSV import state` (4 `useState` lines) |
| FTP modal state (`showFTPModal`, `detectedFTP`), **but keep `currentFTP` and `intervalsFTP`** | `const [showFTPModal` and `const [detectedFTP` |
| Cloud sync help state | `const [showCloudSyncHelp` |
| VO2max analyzing state (**keep `vo2maxEstimates` state**, it is pass-through) | `const [analyzingActivity` |
| Paste import state | `const [showPasteImport`, `const [pasteContent`, `const [importError` |
| VO2max helper functions | from `// VO2max Calculation Functions` through the end of `analyzeActivityForVO2max` (just before `const calculateNewLevel`) |
| FTP modal handlers | `// FTP modal handlers` through the end of `handleIgnoreFTP` |
| `mapWorkoutTypeToZone` and `getZonePowerRanges` | `// Map intervals.icu workout type` and `// Get zone power ranges` |
| API sync | `// Sync workouts from intervals.icu` through the end of `syncFromIntervalsICU` |
| CSV parsing and import | `// Helper function to parse CSV line` through the end of `handleCSVImport` |
| `importPowerCurve` | `const importPowerCurve` |
| `handlePasteImport` | `const handlePasteImport` |
| Modals: Paste Import, CSV Import, FTP Increase Detection, Cloud Sync Instructions, intervals.icu Sync | JSX comments `{/* Paste Import Modal */}`, `{/* CSV Import Modal */}`, `{/* FTP Increase Detection Modal */}`, `{/* Cloud Sync Instructions Modal */}`, `{/* intervals.icu Sync Modal */}` (each whole `{cond && (...)}` block) |
| Bottom-bar buttons "Paste CSV" and "Import Power" | inside `{/* Import/Export/Reset */}` |
| Ride History's intervals.icu ID tag | `{entry.intervalsId && (` |

Keep all of these:
- `intervalsFTP` state, and its load, save, export, import and Drive-sync lines (pass-through, §0.3).
- `vo2maxEstimates` state, and the same lines for it.
- `powerCurveData` state and the Power Skills card. It still reads the saved curve until Phase 6.
- The `syncStatus` message display, if it's still used by anything else after the deletions.
  If nothing sets it any more, delete the state and its display too.

Then add a one-off cleanup: in the main load effect (`localStorage.getItem(STORAGE_KEY)`),
add `localStorage.removeItem('intervals-icu-config')` inside a `try`. This removes the
saved copy of the key from the user's phone. Comment it: `// v2: remove saved intervals.icu credentials (feature removed)`.

**Tell the user in the report:** removing the key from the code does not remove it from git
history. They must revoke it in intervals.icu (Settings → Developer). Say this even if they
already have.

### 1.2 Move pure helpers into `src/lib/`

Move these **module-level** functions and constants out of `src/App.jsx`. They sit above
`export default function ProgressionTracker`, so nothing inside the component moves in this
phase. Copy each one **verbatim** (same code, same comments), add `export`, and import it
back into `src/App.jsx`.

| New file | Contents |
|---|---|
| `src/lib/dates.js` | `toLocalDateStr`, `parseDateLocal`, `parseDuration`, `formatDateWithDay`, `DAYS_OF_WEEK` |
| `src/lib/zones.js` | `ZONES`, `DEFAULT_LEVELS`, `ZONE_EXPECTED_RPE`, `ZONE_ADJACENCY`, `ZONE_POWER_RATIO_RANGES`, `categoryForRatio` |
| `src/lib/rideFiles.js` | `parseFitFile`, `buildRideFromRecords`, `parseTcxFile`, `downsampleRecords`, `calculateNormalizedPower` (needs `import FitParser from 'fit-file-parser'`) |
| `src/lib/eftp.js` | `EFTP_*` constants, `bestAveragePower`, `estimateRideFtp`, `buildEftpTimeline` |
| `src/lib/intervals.js` | interval constants (`WORK_THRESHOLD` … `MIN_SOLO_WORK_RATIO`), `meanOf`, `adaptiveWorkThreshold`, `mergeLapBlocks`, `buildIntervalLabel`, `detectIntervals` |
| `src/lib/progression.js` | `applyDecay` |

- Keep `STORAGE_KEY` and `FTP` in `src/App.jsx` for now.
- If a moved function uses another moved function, import it from the right `src/lib`
  file. Don't duplicate it.

### 1.3 Verify

1. `npm run build` passes.
2. `node tools/v2-check.mjs` shows **No differences vs baseline**, and `pageErrors` is empty.
3. `grep -rn "4ocowox\|intervals.icu/api\|i259740" src/` returns nothing.
4. Look at `tools/.out/home.png`. The bottom bar now reads "Import  Export … Reset Levels"
   only.
5. `wc -l src/App.jsx` should be roughly 3,300–3,600. Report the number.

**Commits:** `chore: remove intervals.icu integration and leaked API key`,
`refactor: move pure helpers into src/lib`, `docs: …`.
**Next:** Phase 2, Sonnet.

---

## Phase 2 — Bug fixes and one zone definition (Sonnet)

**Goal:** fix the bugs found in the review before the redesign builds on top of them.
Mostly invisible, except the zone ranges shown on screen.

### 2.1 One shared zone definition

Today there are two definitions that disagree:
- **Labels** (`getZoneDescription` inside the component) leave 79–83% FTP in no zone.
- **Detection** (`ZONE_POWER_RATIO_RANGES` in `src/lib/zones.js`) uses different edges.

Replace both with one table in `src/lib/zones.js`. The edges keep **detection's** values
exactly, because those were tuned in Session 19 and must not re-file anyone's intervals:

```js
// Fraction-of-FTP boundaries. [min, max) — max of the last zone is Infinity.
export const ZONE_BOUNDS = {
  recovery:  [0,    0.55],
  endurance: [0.55, 0.70],
  tempo:     [0.70, 0.81],
  sweetspot: [0.81, 0.94],
  threshold: [0.94, 1.02],
  vo2max:    [1.02, 1.20],
  anaerobic: [1.20, Infinity],
};
export const zoneForRatio = (ratio) => /* first zone whose [min,max) contains ratio */;
export const zoneWattRange = (zoneId, ftp) => ({ min: Math.round(lo*ftp), max: hi===Infinity ? null : Math.round(hi*ftp) });
export const zoneRangeLabel = (zoneId, ftp) => /* "127–162W" or "277W+" */;
```

- `categoryForRatio(r)` must return exactly what it did before for every ratio ≥ 0.55.
  For ratios below 0.55, keep returning `'endurance'` as it does today. Detection never
  files an interval as recovery, so add a comment saying so.
- Remove `ZONE_POWER_RATIO_RANGES`.
- Replace `getZoneDescription` with `zoneRangeLabel`. Keep the "Z2:"-style prefixes: Z1
  recovery, Z2 endurance, Z3 tempo, no prefix for sweet spot, Z4 threshold, Z5 VO2max,
  Z6 anaerobic.
- Remove the hard-coded watt text in `ZONES[].description`. It was written for a 235W FTP;
  delete the field if nothing else reads it.

### 2.2 Outdoor rides must not be filed under a zone (D5)

- In `handleLogWorkout`, both save paths build `intervalData` with
  `category: (zone && zone !== 'recovery') ? zone : pendingFitDetail.detection.category`.
  For outdoor rides, `zone` is `null`, so the detected category leaks through. That's why
  the Draper and West Valley rides showed up as VO2max.
- Change it so an **outdoor** ride's `intervalData.category` is `null`. Keep `label`, `sets`
  and `segments`, because the Ride page still shows the detected efforts.
- Do the same in `redetectForRide` and in the FIT backfill path in `handleFitFileImport`
  (`setHistory(prev => prev.map(w => w.id === existing.id ? {`).
- On import of an outdoor file, don't pre-select a zone in the form. Only do that when the
  ride is indoor.
- **One-off data fix:** in the load effect, for rides where `rideType === 'Outdoor'` and
  `intervalData?.category` is set, set the category to `null`. Comment it as a v2 migration.
  This is the only existing-data rewrite in Phase 2; list it in the CHANGELOG.
- Workout Progression must now skip outdoor rides. It already filters on
  `intervalData?.category === zone`, so a `null` category is enough. Confirm by test.

### 2.3 Smaller fixes

1. **FIT/TCX "attach to existing ride" matching.** Replace
   `history.find(w => w.date === parsed.date)` with: among rides on the same date, pick the
   one whose `duration` is closest to `parsed.duration`, and only if within 25% (or the ride
   has `duration` 0). If none qualifies, treat the file as a new ride without asking.
2. **Profile FTP box.** `onChange={(e) => setCurrentFTP(parseInt(e.target.value) || 235)}`
   snaps to 235 when the box is cleared. Keep a local text value while typing. On Save,
   accept 100–500 and otherwise keep the previous FTP and show an inline error.
3. **Reset levels objects** (two places, search `const resetLevels = {`) omit `recovery`.
   Use `{ ...DEFAULT_LEVELS }`.
4. **Negative days to event (D4).** Wherever `getDaysUntilEvent()` is shown (Fitness
   Progress card, Copy for Claude text):
   - past event → "Event complete";
   - no event date → omit the countdown.
5. **Power Skills wording.** "Top X%" is wrong: the number is a percentile, where higher is
   better. Change it to "Xth percentile" in the radar tooltip and the bar tooltip.
6. **Ride History header overlap.** In each history card, the 📊 ✏️ 🗑️ buttons overlap long
   titles and the interval label at 390px. Move the interval label onto its own line under
   the title. The card is redesigned in Phase 4, so keep this fix minimal.

### 2.4 Verify

1. `npm run build` passes, and the regression check has no `pageErrors`.
2. **Expected baseline differences:** none. (The synthetic TCX is indoor, so its category
   stays `vo2max`.) If `numbers` or `importedTcx` changed, you broke something.
3. Add an **outdoor** synthetic check by hand:
   - Seed one ride with `rideType: 'Outdoor'` and `intervalData.category: 'vo2max'`, reload,
     and confirm localStorage shows `category: null`.
   - Confirm the Workout Progression VO2max tab no longer counts it.
4. Screenshot the progression bars and check the zone labels. At FTP 231 they read:
   - Z2: 127–162W
   - Z3: 162–187W
   - 187–217W (sweet spot, no prefix)
   - Z4: 217–236W
   - Z5: 236–277W
   - Z6: 277W+
5. Edit the Profile FTP box: clear it, type 240, Save. The header shows 240W. Clear it and
   press Save: an error shows and FTP is unchanged.

**Commits:** one `fix:` per numbered item where practical, plus `docs:`.
**Next:** Phase 3, Opus.

---

## Phase 3 — App shell, UI kit, data layer, Today tab (Opus)

**Goal:** the new four-tab app. Existing sections are **re-homed** into tabs as they are.
Their redesign is Phase 4 and Phase 6. The Today tab is new and fully designed here.

### 3.1 Target file structure

```
src/
  App.jsx                    # tiny: <AppDataProvider><Shell/></AppDataProvider>
  state/AppDataContext.jsx   # all persisted state + actions (see 3.2)
  state/useHashRoute.js      # tab + page routing via location.hash (see 3.3)
  components/ui/             # the kit (see 3.4)
  components/                # shared app pieces: ZoneBar, RideRow, charts...
  screens/TodayScreen.jsx
  screens/RidesScreen.jsx     # calendar + existing history list, re-homed
  screens/ProgressScreen.jsx  # level bars, chart tabs, Power Skills, Workout Progression, re-homed
  screens/SettingsScreen.jsx  # profile, event, data actions, re-homed
  screens/WorkoutDetailPage.jsx   # existing Workout Detail modal, as a full-screen page
  screens/LogRideSheet.jsx        # existing Log Ride form, as a bottom sheet
  lib/…                      # from Phase 1
```

### 3.2 Data layer (the delicate part)

Move **all** persisted state, the load and save effects, `markDataChanged` and every action
that changes data out of `ProgressionTracker` into `AppDataContext`. That includes:
- `handleLogWorkout`, `handleEditRide` and the edit state;
- `handleDeleteWorkout`;
- `handleFitFileImport` and its backfill;
- `handleRedetectRide`, `handleRedetectAll`;
- export, import and `handleDriveSync`;
- level resets, profile and event saves;
- the eFTP prompt effect.

Expose `useAppData()` → `{ state…, derived…, actions… }`.

- **Derived values** are memoised in the provider: `effectiveLevels`, `eftpTimeline`,
  `currentEftp` and `loads` (`calculateTrainingLoads`).
- **Keep behaviour identical.** Move the logic of `handleLogWorkout` verbatim, including:
  - progression and trickle;
  - `lastWorkedDates`;
  - `recentChanges`;
  - the post-log summary data;
  - `pendingFitDetail`.

  The regression check covers only part of it. Also test by hand: log an indoor Sweet Spot
  ride and confirm the Sweet Spot level, the trickle to Tempo and Threshold, and
  `lastWorkedDates.sweetspot` change exactly as before.
- Split actions from UI. Actions return results; they don't open modals or call `alert()`.
  For example, `importRideFile(file)` returns `{ parsed, detection, existingMatch }`, and
  the Log Ride sheet decides what to show.
- Add `schemaVersion: 2` to the saved object (§0.3).
- The eFTP "raise your FTP?" `window.confirm` becomes an **alert item on the Today tab**
  (3.6), with the same dedupe key `eftp-prompted-value`. The value is stored when the alert
  is dismissed or accepted, not when it's shown.

### 3.3 Navigation

- No router library. `useHashRoute()` parses `location.hash`:
  - `#/today` (default), `#/rides`, `#/progress`, `#/settings`;
  - `#/ride/<id>` (Ride page, full screen, with a "‹ Back" button that calls `history.back()`).
- Hash routing gives the home-screen app (which has no browser back button) working back
  navigation, and makes pages linkable from alerts.
- Remember each tab's scroll position when switching tabs.

### 3.4 UI kit (`src/components/ui/`)

Build these once. Every later phase must use them rather than hand-rolling new styles.

| Component | Notes |
|---|---|
| `Screen` | Tab content wrapper: top padding `env(safe-area-inset-top)`, bottom padding tab bar + `env(safe-area-inset-bottom)`, `max-w-2xl mx-auto px-4` |
| `TabBar` | Fixed bottom bar, 4 tabs with inline-SVG icons + labels: Today, Rides, Progress, Settings. Height 56px + safe area. Active tab tinted. Optional numeric badge (Settings uses it for unsynced changes in Phase 4) |
| `Page` | Full-screen pushed page with header (Back, title, optional right action) |
| `Sheet` | Bottom sheet for forms: slides up, rounded top, drag handle, max height 92vh, internal scroll, sticky footer for the primary button. Closes on backdrop tap or Cancel |
| `Card`, `SectionHeader` | Consistent padding, radius, title style |
| `StatTile` | Label, value, optional unit and optional delta (▲ green / ▼ red) |
| `SegmentedControl` | Replaces the ad-hoc tab buttons (chart tabs, metric toggles) |
| `Button` | `primary` (green), `secondary`, `ghost`, `destructive`; min height 44px |
| `Chip` | Filter / zone selection chips (selectable) |
| `Toast` + `useToast()` | Replaces every informational `alert()` (e.g. "✓ Detected: 3x8 @ 250W") |
| `ConfirmSheet` + `useConfirm()` | Promise-based replacement for `window.confirm()`, with a destructive variant. Use it for delete ride, reset levels, restore backup, attach-to-existing |
| `EmptyState` | Icon, sentence, optional action button |

Design rules to write down in ARCHITECTURE.md (new "Design system" section):
- dark theme (keep `bg-gray-900` page, `bg-gray-800` cards);
- zone colours from `ZONES`;
- body text 15–16px;
- **all inputs `text-base` (16px)**, because iOS zooms into smaller inputs;
- touch targets ≥ 44px;
- numbers in tabular figures (`tabular-nums`);
- no hover-only information: every tooltip must work on tap;
- no emoji as the only label of a control.

### 3.5 iPhone shell fixes

- `index.html`: add `viewport-fit=cover` to the viewport meta. **Without it, iOS reports
  every `env(safe-area-inset-*)` as 0.** That's why the existing bottom padding in
  `src/index.css` does nothing.
- Keep `apple-mobile-web-app-status-bar-style` as `black-translucent`; the `Screen` top
  padding now makes room for it.
- Check that the `apple-touch-icon` link resolves under `/cycling/` in `npm run build`
  output (`dist/index.html`). Fix the path if not.
- Remove `@supports (-webkit-touch-callout: none) { body { padding-bottom … } }` from
  `src/index.css`. `Screen` and `TabBar` handle the safe areas now.
- Page title in the app: small "Casey Rides" wordmark in the Today header only. The other
  tabs show their tab name as the title.

### 3.6 Today tab (designed here)

Top to bottom:

1. **Header row:** "Casey Rides", with `FTP 231W · 3.0 W/kg · eFTP 197W` beneath in small
   text. Tapping eFTP shows a toast explaining it (the old `title` hover can't work on a phone).
2. **Status card:** one headline from `getTrainingStatus` (delete `getTSBStatus`, which
   disagreed with it):
   - a coloured pill, plus its `description` sentence;
   - underneath, three small `StatTile`s: **Fitness** (CTL), **Fatigue** (ATL), **Form**
     (TSB, signed), each with a 14-day delta.
3. **Alerts** (only when present): a list of tappable rows. Phase 3 alert types:
   - *eFTP above FTP* — replaces the confirm. Actions: "Update FTP" (opens Settings →
     Profile with the value pre-filled) and "Dismiss".
   - *N rides need a zone*: indoor rides with `zone == null` and `source === 'imported'`
     (and, after Phase 4, not `historical`). Opens Rides filtered to "Needs zone".
   - *Event complete*: event date passed. Opens Settings → Event.

   The alert list is built by a pure function `buildAlerts(state, derived, today)` in
   `src/lib/alerts.js`, so Phase 6 can add types.
4. **This week card:** Mon–Sun, compared with last week at the same point.
   - Shows hours, TSS and number of rides.
   - Each has a delta ▲/▼.
   - Beneath: a 7-dot row, one per day, filled on ride days and coloured by zone (grey for
     outdoor).
5. **Latest ride card:** name, date, type or zone pill, duration, TSS, interval label.
   Tapping it opens `#/ride/<id>` if the ride has a stream; otherwise it opens the edit
   sheet.
6. **Event card:**
   - name and countdown ("36 days to go"), plus the CTL-toward-target bar that moves here
     from the Fitness Progress card;
   - "Event complete" or "No event set · Add one" (links to Settings) per D4.
7. **Copy for Claude** button (secondary). Keep the function's text format, apart from the
   D4 countdown fix.
8. A **"＋ Log Ride"** primary button, fixed above the tab bar on the Today and Rides tabs.
   It opens `LogRideSheet`.

Delete these as separate cards, since the Today tab replaces them: CTL/ATL/TSB cards,
Fitness Progress, Training Summary, Training Status.

### 3.7 Re-homing (no redesign yet)

| Existing section | New home |
|---|---|
| Header buttons: Log Ride, Sync, Event, Profile | Log Ride → ＋ button. Sync, Event, Profile → Settings tab |
| Progression level bars | Progress tab (top) |
| Chart tabs: Hours, TSS, Elevation, eFTP | Progress tab, using `SegmentedControl` |
| Power Skills card + Rider Type modal | Progress tab. Rider Type modal becomes a `Sheet` |
| Workout Progression modal | Progress tab section. Open by tapping a zone's level bar, **and** a "Workout progression" row. It can stay a `Page` (`#/progress/zone/<id>`) |
| Monthly calendar | Rides tab (top) |
| Ride History modal | Rides tab (below the calendar). Edit and delete use the new sheets |
| Workout Detail modal | `WorkoutDetailPage` at `#/ride/<id>` |
| Log Ride modal | `LogRideSheet` (same fields for now) |
| Post-log summary modal | Stays, as a `Sheet` |
| Profile modal, Event modal | Settings tab sections (inline forms, Save buttons) |
| Import, Export, Reset Levels links | Settings → Data section |

### 3.8 Verify

1. Build passes. Update `tools/v2-check.mjs` selectors:
   - **Log Ride:** the ＋ button.
   - **CTL/ATL/TSB:** now read from the Today status tiles. Adjust the regexes, keep the keys.
   - **Screenshots:** the script should now screenshot **each tab** (`#/today`,
     `#/rides`, `#/progress`, `#/settings`) and one Ride page. Add this.
2. **Expected differences:** `trainingStatus` stays the same. `ftpLine` may change format
   only. Numbers must not change.
3. Look at every screenshot at 390px:
   - no horizontal scroll;
   - no text overlap;
   - the tab bar isn't covering content;
   - every tap target is at least 44px (spot-check with `getBoundingClientRect` in the script).
4. **Manual behaviour checks** (script or by hand), each confirmed against localStorage:
   - log indoor ride, including progression and trickle;
   - edit a ride;
   - delete a ride via `ConfirmSheet`;
   - FIT/TCX import with attach-to-existing;
   - export, then import a backup;
   - eFTP alert shows once, and Dismiss sticks across reload.
5. `window.alert` and `window.confirm` should appear in `src/` only where a phase hasn't
   replaced them yet. List the remaining ones in the CHANGELOG. Phase 4 removes them all.

**Next:** Phase 4, Sonnet.

---

## Phase 4 — Rides, Ride page, Log Ride v2, Settings, auto-sync (Sonnet)

Use only the Phase 3 kit. Look at `screens/TodayScreen.jsx` for the house style.

### 4.1 Rides tab

- **Calendar** (top):
  - Monday-start month grid, swipe or arrows to change month.
  - Each ride day shows a filled circle **coloured by zone**: outdoor = `#14B8A6` teal,
    unclassified = grey. Multi-ride days show two-tone.
  - An 8th narrow column shows that **week's TSS**.
  - Tapping a ride day opens the Ride page (one ride), or a small sheet listing that day's
    rides.
  - Tapping an empty past or today date offers "Log a ride on <date>", which opens
    `LogRideSheet` with the date filled in.
- **Filter chips:** All · Indoor · Outdoor · Needs zone. Plus a search box that matches
  ride name and notes.
- **List:** grouped by month with sticky month headers. Row (`components/RideRow.jsx`):
  - a 4px zone-coloured left edge;
  - name (1 line, truncated);
  - short date + weekday;
  - right side: duration · TSS;
  - second line: interval label (monospace, yellow) or distance/elevation for outdoor.

  Tapping a row opens the Ride page. Render months lazily (e.g. 3 months at a time, with a
  "Show older" button) so 150+ rides stay fast.
- "Needs zone" matches indoor rides with `zone == null`, not `historical`.

### 4.2 Ride page (`#/ride/<id>`, replaces WorkoutDetailPage)

For every ride, with or without a stream:
1. **Header:** name, date, type and zone pill, interval label.
2. **Stats grid:** 3 columns × 2 rows (Duration, Distance or —, Elevation or —, NP, TSS,
   IF), plus Avg HR when known. Use `StatTile`.
3. **Power/HR chart:** existing chart, with shaded intervals. Only when there's a stream.
   Tap shows the tooltip. Height 220.
4. **Intervals table:** existing one.
5. **Notes.**
6. **Actions** (bottom):
   - Edit (opens `LogRideSheet` in edit mode);
   - Re-detect intervals (only with a stream);
   - **Attach ride file**: runs the backfill for *this* ride directly, with no date
     guessing;
   - Delete (destructive `ConfirmSheet`, then back to Rides).

Leave clearly marked `{/* Phase 5: … */}` slots for bests, time in zones, drift and efficiency.

### 4.3 Log Ride v2 (`LogRideSheet`)

Two entry modes, chosen at the top of the sheet:

- **Import file** (default, large button "Import ride file (.fit or .tcx)"):
  - After parsing, show a read-only **summary card**: date, type, duration, distance,
    elevation, NP, avg HR (Phase 5), estimated TSS and IF, and the detected intervals
    (label + zone).
  - Offer an "Edit numbers" link that reveals the numeric fields.
  - If a matching ride exists (Phase 2 rule), show an inline card first:
    "You already logged <name> on <date> (<n> min). **Attach this file to it** / **Save as
    a new ride**". This replaces the `window.confirm`.
- **Enter manually:** date (today), type, duration, NP, distance and elevation (outdoor
  only). **No invented defaults**: fields start empty. Save stays disabled until:
  - duration > 0;
  - NP > 0;
  - an indoor ride has a zone.

  Show inline messages, not alerts.

Fields common to both modes:
- **Name:** default "Indoor ride" / "Outdoor ride", editable.
- **Zone:** indoor only, as a row of `Chip`s coloured by zone. Pre-selected from detection
  (indoor only, Phase 2). Hidden (not greyed) for outdoor.
- **Completed all intervals:** indoor only, toggle. Hidden for outdoor.
- **Effort (RPE):** a row of ten 1–10 tap targets (two rows of 5 on narrow screens), with
  the expected effort marked and "Easy … Hard" ends. Replaces the slider.
- **Notes.**
- Sticky footer: **Save ride** (disabled until valid).

Edit mode: same sheet, pre-filled, titled "Edit ride". After saving, return to where the
user came from (Ride page or list), not to a modal.

### 4.4 Settings tab

Sections (each a `Card` with inline editing and its own Save):
1. **Profile:**
   - FTP, with a live zone table beneath it showing each zone's watt range from
     `zoneRangeLabel`.
   - Weight (lb), Max HR, Resting HR, **Threshold HR (LTHR)** (new, optional, used in
     Phase 5; helper text "Leave blank to estimate from Max HR"), Age, Sex.
   - Changing FTP keeps the existing "reset progression levels?" question, as a `ConfirmSheet`.
2. **Event:** name, date, distance, target fitness (CTL), "Clear event".
3. **Sync & backup:**
   - Google Drive status line ("Last synced 2:14 pm" / "Unsynced changes" / "Not
     connected"), plus a **Sync now** button.
   - Export backup.
   - Restore from backup (a `ConfirmSheet` showing "This replaces all rides on this device
     with <n> rides from <file date>").
4. **Old imported rides:** "Stop asking about N old imported rides". This sets
   `historical: true` on indoor rides with `source === 'imported'` and `zone == null`.
   Confirm first. Reversible via a small "Show them again" link.
5. **Reset progression levels** (destructive, confirm).
6. **About:** app version (`package.json` version, bump it to `2.0.0-beta` in this phase),
   a link to the CHANGELOG on GitHub.

### 4.5 Google Drive auto-sync (D3)

- `src/google-drive-sync.js`:
  - Record `tokenExpiresAt = Date.now() + response.expires_in * 1000` wherever
    `accessToken` is set.
  - Add `hasValidToken()`, true when there's a token and more than 60s remain.
  - `authenticate()` must treat an expired token as absent. Today a stale token is reused
    forever and later calls fail.
- In `AppDataContext`: after any data change, **debounce 3 seconds**. Then, if
  `GoogleDriveSync.hasValidToken()`, run the existing `sync()` silently and update
  `lastSyncedAt`. Otherwise set `hasUnsyncedChanges = true`, which shows the badge on the
  Settings tab.
- **Never** call `authenticate()` from anything except a user tap. iOS blocks popups opened
  without a tap, and a surprise Google popup would be bad UX.
- On app open, don't pull automatically. If a valid token exists (rare after a reload),
  that's fine. Otherwise the Sync button handles it.
- Show sync results as a toast.

### 4.6 Verify

1. Regression check:
   - Update selectors for the new sheet's file input and Save button.
   - The same `importedTcx` values must come out.
   - Add screenshots: Rides tab, the Log Ride sheet (both modes), a Ride page, Settings.
2. Confirm no `window.alert` or `window.confirm` remains:
   `grep -rn "window.confirm\|alert(" src/`. The only allowed hit is the
   storage-full warning in the save effect, which must stay an `alert` because it fires
   when the UI may be broken.
3. Manual checks:
   - manual entry validation;
   - outdoor import hides zone;
   - attach-to-existing card;
   - calendar week TSS equals the sum of that week's rides;
   - "Stop asking" hides rides from Needs zone and from the Today alert count.
4. Auto-sync can't be fully tested without Google. Check the logic with a fake:
   temporarily stub `hasValidToken` to return true and `sync` to log, and confirm one call
   per burst of edits. Remove the stub before committing.

**Next:** Phase 5, Sonnet.

---

## Phase 5 — Metrics engine (Sonnet)

All new calculations are **pure functions in `src/lib/`** with **vitest** tests.
- Add `vitest` as a devDependency and `"test": "vitest run"` to `package.json`.
- Tests live next to their code as `*.test.js`.
- Also add tests for the existing helpers these build on: `calculateNormalizedPower`,
  `bestAveragePower`, `parseDuration`, `detectIntervals` on a synthetic 3x8 stream,
  `zoneForRatio`.

### 5.1 One-second power series at import (`src/lib/rideFiles.js`)

Add `toOneHzSeries(records)` → `{ power: number[] | null, hr: (number|null)[] }`, indexed
by second from the first record:
- Place each record at `round((t - t0) / 1000)`.
- Gaps of ≤ 10s are forward-filled from the previous record (FIT "smart recording" writes
  every few seconds).
- Gaps of > 10s are a stop: power 0, hr null.
- Cap at 8 hours.
- `power` is `null` if no record has power.

Change `buildRideFromRecords` to also return:
- `bests`: for each duration in `[5, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600, 5400, 7200]`,
  the best average power over any window of that many seconds, rounded. Omit durations
  longer than the ride. This is a sliding-window sum, the same approach as
  `bestAveragePower` but at 1s.
- `hrStats`: `{ avg, max }` of non-null HR, rounded, or `null`.
- `avgPower`: mean of the 1Hz power series including zeros, rounded, or `null`.

**Rides with heart rate but no power:**
- `downsampleRecords` currently returns `null` when there is no power. Change it to return
  a stream whenever there is power **or** HR. When there's no power, the stream has
  `power: null`.
- Audit **every** reader of `stream.power`:
  - `bestAveragePower` must return null;
  - `detectIntervals` must return null;
  - the Ride page chart must draw HR only;
  - `estimateRideFtp` must return null, **not 0** (a 0 would win nothing but must never
    display);
  - Workout Progression and the history "📊" check must still work.

  Add tests for an HR-only stream.

Save `bests`, `hrStats` and `avgPower` onto the ride in both save paths, and in the backfill
("Attach ride file") path.

### 5.2 Heart-rate TSS (`src/lib/load.js`)

- `estimateLthr(profile)`: `profile.lthr` if set, else `round(0.89 × profile.maxHR)`, else
  `null`.
- `hrTss(durationMin, avgHr, restingHr, lthr)`: returns `null` if any input is missing or
  `lthr <= restingHr`. Otherwise:

  ```
  hrIF = (avgHr - restingHr) / (lthr - restingHr)
  return round(durationMin / 60 × hrIF² × 100)
  ```
- When saving a ride whose file has **no power** but has HR:
  - set `tss = hrTss(...)` and `tssSource: 'hr'`;
  - leave NP empty and IF `null`.
- The Log Ride summary says "TSS 64 (from heart rate)".
- Manual entry is unchanged: power only.

### 5.3 Training load history (`src/lib/load.js`)

Move `calculateTrainingLoads` here as `dailyLoadSeries(history, today)` → `[{ date, tss,
ctl, atl, tsb }]`, one entry per day from the first ride to today, using the same constants
(42 and 7, the same `2/(n+1)` smoothing). Rebuild `calculateTrainingLoads()` on top of it so
its output is **identical**. The regression check must show the same CTL, ATL and TSB.

Also add:
- `rampRate(series)`: CTL today minus CTL 7 days ago, one decimal.

### 5.4 Per-ride analysis (`src/lib/analysis.js`)

All take a ride (and FTP or profile where needed) and return `null` when data is missing.

| Function | Definition |
|---|---|
| `bestsForRide(ride)` | `ride.bests` if present, source `'1s'`. Else, from `ride.stream`, compute only durations ≥ 60s using `bestAveragePower` (10s bins are too coarse for shorter efforts), source `'10s'`. Returns `{ bests, source }` |
| `timeInZones(ride, ftp)` | From `stream.power` bins (each `binSeconds` long): seconds per zone via `zoneForRatio(p / ftp)`. Null bins are skipped. Returns `{ recovery: s, … }` |
| `aerobicDecoupling(ride)` | Only when the ride has stream power and HR, duration ≥ 60 min, `intervalData` is null (steady ride), and VI = NP / avgPower ≤ 1.15. Drop the first 10 minutes and split the rest in half by time. For each half, EF = mean(power) / mean(hr) over bins where both are non-null. Result: `round((EF1 − EF2) / EF1 × 1000) / 10` (%). |
| `efficiencyFactor(ride)` | NP / avg HR (`hrStats.avg`, else the mean of stream HR), two decimals. Only for rides with IF ≤ 0.80 and duration ≥ 45 min |
| `expectedRpe(intensityFactor)` | IF < 0.65 → 3 · < 0.75 → 4 · < 0.85 → 5 · < 0.95 → 7 · < 1.05 → 8 · else 9 |
| `rpeMismatch(ride)` | `ride.rpe − expectedRpe(ride.intensityFactor)`, or null |

Decoupling bands, shown with the result: < 5% "Solid aerobic base" (green), 5–8% "Some
drift" (amber), > 8% "Drifting: base needs work" (red).

### 5.5 Across-rides analysis (`src/lib/records.js`)

- `powerCurve(history, { from, to })`: per duration, the max over rides of `bestsForRide`.
  Keep which ride and date set it.
- `personalBests(history)`: all-time and last-90-days curves.
- `newBestsForRide(history, ride)`: durations where this ride set a new all-time or
  90-day best. Used for the "New best!" alert.
- `records(history)`:
  - longest ride by duration and by distance;
  - most elevation;
  - highest TSS;
  - year-to-date distance, hours, elevation and ride count, versus the same date last year.
- `observedMaxHr(history)`: max of `hrStats.max`, falling back to stream HR max.

### 5.6 Surface on the Ride page (fill the Phase 4 slots)

1. **Best efforts:** a small table of 5s, 1m, 5m, 20m, 60m (whichever exist). A "★ New
   best" badge where `newBestsForRide` says so. If the source is `'10s'`, add a footnote
   "Re-attach the ride file for sprint-length bests."
2. **Time in zones:** a horizontal stacked bar, zone-coloured, with minutes per zone
   beneath.
3. **Heart-rate drift:** % plus the coloured band sentence. Hidden when `null`.
4. **Efficiency:** EF value, with "Higher over time = fitter".

### 5.7 Verify

1. `npm test` passes. Required test cases:
   - NP of a constant 200W series = 200;
   - `toOneHzSeries` forward-fills a 3s gap and zero-fills a 30s gap;
   - bests of a 3x8@250 synthetic 1Hz series give `"300": 250`;
   - HR-only stream → `estimateRideFtp` null;
   - `hrTss(60, 150, 50, 160)` = 83;
   - decoupling of a perfectly steady series = 0, and of a series whose HR rises 10% in
     the second half ≈ 9.1;
   - `dailyLoadSeries` last entry equals the old `calculateTrainingLoads` output on the
     same data.
2. Regression check:
   - **expected difference:** `importedTcx` gains nothing (the script records only
     existing keys), so no diff;
   - CTL, ATL and TSB unchanged;
   - extend the script to also record the imported ride's `bests["300"]` (expect ≈ 250)
     and `hrStats`, then re-write the baseline and explain it in the CHANGELOG.
3. Screenshot the Ride page of the imported synthetic ride. Best efforts show 5m ≈ 250W,
   and time in zones is mostly Z5 and Z1–Z2.

**Next:** Phase 6, Sonnet.

---

## Phase 6 — Progress tab and Today alerts (Sonnet, load the `dataviz` skill)

Load the `dataviz` skill before writing chart code. Keep charts Recharts. On a phone:
- one chart per card;
- height 200–240px;
- tap tooltips;
- no legends when the colour is already explained by the title.

### 6.1 Progress tab layout (top to bottom)

1. **Levels:**
   - the zone level bars (existing, restyled with `ZoneBar`), each tappable to its Workout
     Progression page;
   - the zone watt range from `zoneRangeLabel`;
   - idle and decay badges as today.
2. **Fitness chart (new):**
   - last 180 days from `dailyLoadSeries`: Fitness (CTL) line in blue, Fatigue (ATL) line
     in orange, Form (TSB) as bars around zero (green above, red below);
   - SegmentedControl 90d / 180d / 1y;
   - header shows the ramp rate: "+4.2 fitness / week".
3. **Training volume:**
   - SegmentedControl: Hours · TSS · Elevation · **Zones**.
   - Hours, TSS and Elevation are the existing charts.
   - **Zones** is new: a weekly stacked bar of time in zones over the last 12 weeks
     (`timeInZones`, rides with streams only). Note beneath it: "Rides with power data only".
4. **Power:**
   - **Power curve:** log-scale x axis with ticks 5s, 30s, 1m, 5m, 20m, 1h, 2h. Two lines:
     last 90 days (solid) and all time (faint). Tap a point to see watts, W/kg and the ride
     and date that set it.
   - Below it, **Power Skills + Rider Type**, now fed from `powerCurve` (last 90 days):
     - Map its 5s/30s/1m/5m/10m/20m/30m/1h/2h values into the existing radar code. Leave
       the percentile formula and phenotype rules unchanged; only the input source changes.
     - If any of the 9 durations is missing, show the radar for what exists and replace the
       Rider Type button with "Import a ride with a sprint to see your rider type".
     - Fall back to the saved `powerCurveData` **only** for durations the computed curve
       lacks, and label that source "from old intervals.icu import".
5. **eFTP:** the existing eFTP Progress chart.
6. **Aerobic fitness:** efficiency factor per qualifying ride over the last 6 months as dots
   (indoor blue, outdoor teal), plus a line of the 6-week rolling median. Below it, the
   average heart-rate drift of qualifying rides in the last 30 days, with its band sentence.
7. **Records:**
   - personal best table (5s, 1m, 5m, 20m, 60m: all-time and 90-day, with W/kg);
   - longest ride, most climbing, biggest TSS (each tappable to its ride);
   - year-to-date vs last year: distance, hours, climbing, rides, with ▲/▼.
8. **Workout Progression:** a row that opens the existing per-zone page.

### 6.2 New Today alerts (extend `buildAlerts`)

| Alert | Rule | Dedupe |
|---|---|---|
| New best | The latest ride set a new all-time best at any of 1m, 5m, 20m, 60m (or 5s, 30s when 1s bests exist) | Per ride id, dismissible |
| Ramp rate | `rampRate > 7` → "Fitness is climbing fast (+X/week). Watch for fatigue." | Shows while true; dismiss hides it for 7 days |
| Feels harder than usual | ≥ 2 of the last 5 rides with power have `rpeMismatch ≥ 2` | Dismiss hides until a new ride is logged |
| Max heart rate | `observedMaxHr > profile.maxHR` (or maxHR unset) → "Highest heart rate seen: 188. Update your profile?" [Update] [Dismiss] | Device-local key `maxhr-prompted-value`, same pattern as eFTP |

Store dismissals device-locally in one localStorage key, `alert-dismissals` (a JSON map),
wrapped in try/catch.

### 6.3 Copy for Claude

Add to the text, where available:
- ramp rate;
- 90-day bests at 1m, 5m, 20m;
- the last 30 days' average heart-rate drift;
- time-in-zone share for the last 4 weeks.

Keep the existing sections and order.

### 6.4 Verify

1. Regression check: no number diffs. Screenshot Progress (full length) and Today with at
   least one of each new alert. To trigger the alerts, seed data in the script: a ride with
   a high HR for the max-HR alert; high RPE rides for the mismatch alert.
2. Tap-test every chart tooltip in the script (tap, then screenshot).
3. Performance: with 158 seeded rides, switching to the Progress tab must not freeze. Time
   it in the script with `performance.now()` around the tab switch. It should be under
   300ms. Memoise with `useMemo` keyed on `history` and `currentFTP` if it isn't.

**Next:** Phase 7, Opus.

---

## Phase 7 — Progression level rebuild (Opus)

### 7.1 The problem (from the review)

`calculateNewLevel(currentLevel, workoutLevel, rpe, completed)` is always called with
`workoutLevel = ZONE_EXPECTED_RPE[zone]`, a constant per zone (Endurance 4, Sweet Spot 6,
…). So:
- a workout's difficulty never reflects what was actually ridden;
- once a zone's level is about 2 above that constant, no workout can raise it.

The levels mostly count logged rides, up to a ceiling.

### 7.2 Required outcome

1. **Workout level from structure.** A pure function
   `workoutLevelFromStructure(ride, ftp)` in `src/lib/progression.js` returns a 1.0–10.0
   level for indoor rides with `intervalData`:
   - It combines the **total work time** of the dominant zone's sets and the **work
     intensity** (%FTP of the work relative to that zone's `ZONE_BOUNDS`).
   - Longer, or harder within the zone, gives a higher level. The scale is logarithmic in
     work time, so doubling a session doesn't double the level.
   - Endurance rides without intervals use ride duration at their IF instead.
2. **Level update driven by the workout.** A new `calculateNewLevel` in the same file:
   - If the workout level L is above the current level P and the ride was completed, the
     level moves toward L. RPE decides how far: at or below expected effort moves most,
     above expected moves less.
   - If L ≤ P, only a small maintenance gain, or none.
   - Not completed keeps today's rule (−0.5 if L ≤ P).
   - There is **no ceiling other than 10**.
3. **Manual rides** (no file) get a **Workout level** stepper (1–10, 0.5 steps) in Log Ride.
   It's shown only for indoor manual entries, pre-filled with the zone's typical level.
   File imports show the calculated level read-only ("This workout: Sweet Spot 5.8"), with
   an override.
4. **Stored on the ride:** `workoutLevel` (number) and `workoutLevelSource`
   (`'structure' | 'manual' | 'legacy'`). Existing rides are not rewritten; missing source
   means `'legacy'`.
5. **Keep:** decay (`applyDecay`), trickle, `lastWorkedDates`, recovery and outdoor rides
   excluded (D5), and every zone's **current level as the starting point** (D1).

### 7.3 Calibration (do this before coding the constants)

- Constants must be tuned against the **user's real history, not the synthetic seed**. At
  the start of the phase, ask the user to export a backup (Settings → Sync & backup →
  Export) and attach it to the session. Do not commit it: it's personal data. Put it in the
  scratchpad.
- Using their rides with `intervalData`, print a table: date, label, zone, current stored
  level, calculated L.
- Tune per-zone reference points so that typical sessions land in sensible places, and show
  the user the table before finalising. For example, a 3x12 sweet spot at 88–90% should be
  about 5, a 2x20 about 6.5, and a 3x20 about 7.5.
- Write the final constants into the code with a comment explaining each.

### 7.4 Optional "recalculate from history"

Settings → Progression → "Recalculate levels from my rides". It replays every classified
indoor ride in date order through the new model (with decay between rides), starting each
zone at 1.0. Before anything is written:
- show a before → after preview per zone;
- apply only on confirm;
- snapshot the old `levels` and `lastWorkedDates` into a device-local
  `levels-before-recalc` key, with an "Undo" link that stays available until the next ride
  is logged.

This is optional. Build it only if calibration went well, and say so in the report either
way.

### 7.5 Verify

1. Unit tests for `workoutLevelFromStructure` and the new `calculateNewLevel`:
   - monotonic in work time and in intensity;
   - bounded 1–10;
   - a harder workout at the same RPE never gains less;
   - the old ceiling case (level 7.5 Sweet Spot, 3x20 at 92%, RPE 6) now gains.
2. Regression check: the imported synthetic TCX now has `workoutLevelSource: 'structure'`
   and its level. Re-write the baseline and document the change.
3. Show the user the calibration table in the final report, in plain language, with 3–4
   examples of their own workouts and the level each now earns.

**Final report:** say the V2 plan is complete. Summarise what changed across all phases in a
short "What's new in 2.0" list for the user. Bump `package.json` to `2.0.0`.

---

## Appendix A — Review findings this plan addresses

| Finding | Phase |
|---|---|
| intervals.icu API key hard-coded in `src/App.jsx` and published in the GitHub Pages bundle | 1 (plus the user revoking it) |
| About 1,000 unreachable lines (intervals.icu, VO2max, paste import, cloud help, FTP modal) | 1 |
| Outdoor rides filed as VO2max intervals | 2 |
| Zone labels vs detection disagree; 79–83% FTP in no zone | 2 |
| "Top X%" is really a percentile | 2 |
| Attach-to-existing matches by date only | 2 |
| FTP box snaps to 235 | 2 |
| Reset levels drops `recovery` | 2 |
| "Days to Event: -104" | 2, 3 |
| History card icon overlap | 2, 4 |
| Header wraps; no safe-area room; `viewport-fit=cover` missing | 3 |
| Four overlapping status cards; TSB "Fresh" vs status "Transition" | 3 |
| Main actions buried at the bottom of a 2.6-screen page | 3 |
| Hover-only tooltips; fiddly RPE slider; invented 60 min / 150W defaults | 3, 4 |
| Calendar tap goes to edit; history has no filter or search | 4 |
| Drive token never expires in memory | 4 |
| Rides without power log 0 TSS | 5 |
| Power Skills depends on a one-time intervals.icu CSV | 6 |
| Progression levels have a hidden ceiling | 7 |
