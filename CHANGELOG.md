# Changelog

## Session 24 - V2 Phase 6: Progress Tab and New Alerts (2026-09-25)

This session followed **`V2_PLAN.md`**'s Phase 6. It redesigns the **Progress** tab around the
metrics engine Phase 5 built underneath the app, and adds four new alerts to the **Today** tab.
Nothing about Rides, Log Ride, Settings or the Ride page changes.

### What you'll see on your iPhone

**Progress tab — new charts, top to bottom:**

- **Progression levels** look the same, but the small "+0.3" and "↓ 12d idle" badges under each
  zone now work by **tapping** them (they show a short explanation), instead of only on a
  hover that a phone can never do.
- **Fitness** — a new chart: your Fitness (blue line) and Fatigue (orange line) over the last
  90/180/365 days (pick with the buttons), with your Form shown as green/red bars around the
  middle. The heading shows how fast your fitness is climbing or falling per week.
- **Training volume** now has a fourth tab, **Zones**, next to Hours/TSS/Elevation — a
  12-week bar chart of how many minutes you spent in each training zone (only counts rides
  with a power file attached).
- **Power Curve** — a new chart showing your best power for every effort length from 5 seconds
  to 2 hours, from your last 90 days (solid line) plus your all-time bests (faint line). Tap
  any point to see the watts, watts-per-kilogram, and which ride set it.
- **Power Skills** now uses your own last-90-days data instead of the one-time file imported
  from intervals.icu years ago — that old import is only used to fill in a gap if one of the
  nine effort lengths hasn't been ridden recently, and it's labelled when that happens. If
  several are missing, "Rider Type" is replaced with a note asking for a ride with a sprint in
  it.
- **eFTP Progress** moved to its own card (it used to be a tab inside the Hours/TSS/Elevation
  chart; now that spot is Zones instead).
- **Aerobic Fitness** — a new chart: a dot for every long, steady ride showing how efficiently
  you were riding (power per heartbeat), plus a smoothed trend line. Below it, your average
  heart-rate drift over your last 30 days of steady rides, in plain words ("Solid aerobic
  base" / "Some drift" / "Drifting: base needs work").
- **Records** — a new card: your best-ever and best-in-90-days power at five effort lengths
  (with watts-per-kilogram), your longest ride, biggest climb and highest-effort ride (tap any
  to open it), and this year's totals compared with the same point last year.

**Today tab — four new alerts** (each has a Dismiss button; the app remembers you dismissed it):

- **New best** — when your latest ride sets a new best at a meaningful effort length.
- **Fitness is climbing fast** — a heads-up when your Fitness (CTL) is rising quickly, so you
  can watch for fatigue. Dismissing hides it for a week.
- **Feels harder than usual** — shows up when several of your last few rides felt tougher than
  their power/heart-rate numbers would suggest (could be fatigue, heat, life stress). Stays
  dismissed until you log a new ride.
- **Highest heart rate seen** — if a ride recorded a heart rate above what's saved in your
  profile (or you haven't set a Max HR yet), this offers to update it for you, the same way
  the "raise your FTP?" alert already worked.

### Under the hood (for the curious)

- The Progress tab's new charts are all built from the Phase 5 metrics engine
  (`dailyLoadSeries`, `personalBests`, `records()`, `observedMaxHr`, `timeInZones`,
  `efficiencyFactor`, `aerobicDecoupling`) — nothing new is computed that wasn't already
  possible from your saved ride data.
- Those computations are memoised (cached) in the app's shared data layer, keyed to your ride
  history and FTP, so switching to the Progress tab stays fast even with 150+ rides — measured
  at 130–170ms in the automated check, well under the 300ms target.
- The four new alerts' "don't show me this again" state lives in one small, on-this-device-only
  file (not part of your backup or Google Drive sync), the same way the existing "eFTP above
  FTP" alert already worked.
- "Copy for Claude" now also includes your ramp rate, your 90-day best efforts, your recent
  heart-rate drift, and how your last 4 weeks split across training zones — appended after
  everything that was already there, so nothing about the existing text changed.
- 15 new automated tests cover the four new alert rules (84 tests total, up from 69).

### Anything skipped?

- One more hover-only "title" tooltip remains, on the Today tab's 7-day dot row (Session 3's
  original work) — it wasn't part of this phase's task list (only the Progress level-bar
  badges were), so it's left for a later cleanup pass rather than fixed here.
- Assigning a zone to an imported ride can still move `lastWorkedDates[zone]` backwards — a
  known Phase 5 carryover, unrelated to this phase, still slated for Phase 7.
- The "Edit numbers" cosmetic issue on an HR-only import (still shows an NP field defaulting to
  0) from Phase 5 is also unchanged — out of scope for this phase.

### Baseline change (the automated regression check)

`tools/v2-check.mjs` now also seeds two of the synthetic history's most recent rides with a
high reported effort (RPE) and a high heart rate, records which Today alerts are showing, times
the Progress tab switch, and taps every new chart's tooltip for a screenshot. Only one thing
changed in the baseline: a new `numbers.todayAlerts` field lists the alerts the seeded data
produces — no existing number (Fitness/Fatigue/Form, the imported test ride's numbers, etc.)
changed at all.

### Fix found during the orchestrator's review
- The Power Curve chart's left-hand labels were cut off at iPhone width ("280W" showed as "80W"). The axis is wider now.
- The regression check now waits 3.5 seconds (was 1.8) before each tab screenshot, so charts have finished drawing. Screenshots taken mid-animation had made some lines look cut off.

## Session 24 - V2 Phase 5: Metrics Engine (2026-09-25)

This session followed **`V2_PLAN.md`**'s Phase 5. It doesn't change how any screen looks or
works — it adds a "metrics engine" underneath: better numbers computed from your ride files, and
a few new sections on the Ride page that show them. It also adds the project's first automated
tests, so future changes are less likely to quietly break something.

### What you'll see on your iPhone

- **Ride pages** (tap any ride that has a power file attached) now show, when there's enough
  data for them:
  - A **Best efforts** table — your best 5-second, 1-minute, 5-minute, 20-minute and 60-minute
    power for that ride, with a gold **★ New best** badge next to any that beat your all-time or
    last-90-days record.
  - A **Time in zones** bar — a coloured strip showing how many minutes of the ride were spent
    in each training zone.
  - **Heart-rate drift** — how much your heart rate crept up relative to your power over a long,
    steady ride (only shown for rides that qualify — a genuinely steady effort of an hour or
    more), with a plain-language note: "Solid aerobic base", "Some drift", or "Drifting: base
    needs work".
  - **Efficiency** — your power-to-heart-rate ratio for an easy, longer ride, with "Higher over
    time = fitter" underneath. This is the kind of number that's only useful to watch trend over
    months, not any single ride.
  - These are re-computed from the ride file itself, so **older rides need their file
    re-attached** (Ride page → "Attach ride file") to get the new Best efforts/Time in zones —
    everything else on the page works with what's already saved.
- **Rides with a heart-rate monitor but no power meter** (for example, an outdoor ride recorded
  with just a chest strap) now work properly for the first time:
  - Importing one now shows an estimated **Training Stress Score based on your heart rate**
    instead of showing nothing or a wrong number — the Log Ride summary says something like
    "TSS 64 (from heart rate)".
  - Its Ride page now draws a heart-rate chart (there's just no power line, since there's no
    power to show).
  - This heart-rate-based TSS estimate needs your **Resting HR** and either your **Max HR** or
    your **Threshold HR (LTHR)** filled in under Settings → Profile — if either is missing, the
    ride still saves, just without an estimated TSS.
- Everything else — your Fitness/Fatigue/Form numbers, your FTP, your progression levels — is
  unchanged. This phase is purely additive.

### Under the hood (for the curious)

- Every imported ride file is now also processed at full, one-second resolution to compute
  precise best-power numbers (`bests`), heart-rate stats (`hrStats`) and true average power
  (`avgPower`) — previously the app only had 10-second-averaged data, which understates short,
  sharp efforts like a 5-second sprint.
- Added the project's first automated tests (`npm test`, using a small new tool called
  **vitest** — the only new dependency this whole project plan allows). 69 tests check the new
  math (and some of the existing math it builds on) behaves correctly, including tricky edge
  cases like a heart-rate-only file or a gap in the recording.
- New files: `src/lib/analysis.js` (per-ride numbers) and `src/lib/records.js` (best-ever and
  year-to-date numbers across all your rides). These aren't used anywhere else yet — Phase 6
  wires them into the Progress tab's charts and a few new "New best!" style alerts on Today.

### Baseline change (the automated regression check)

The check that compares the app's behavior against a fixed baseline (`tools/v2-check.mjs`) now
also records the imported test ride's best 5-minute power and heart-rate stats. Since these are
brand-new fields that didn't exist before, the baseline file (`tools/v2-baseline.json`) was
re-written once to include them — nothing about your Fitness/Fatigue/Form numbers changed; only
two new pieces of data were added to what the check watches for.

### Anything skipped?

- The Ride page's new sections don't show up for rides saved before this update, because the
  detailed numbers they need weren't computed at the time — you'd need to use "Attach ride file"
  on an older ride to get them (see above). This is expected, not a bug: old data is never
  guessed at or invented.
- These new numbers aren't shown anywhere except the Ride page yet. Phase 6 (next) adds them to
  the Progress tab's charts (a power curve, a "time in zones" chart, an efficiency trend) and to
  Today's alerts (e.g. "New best!", "Your heart rate hit a new high — update your profile?").

## Session 24 - V2 Phase 4: Rides, Ride Page, Log Ride, Settings and Auto-Sync (2026-09-25)

This session followed **`V2_PLAN.md`**'s Phase 4. It redesigns the three tabs Phase 3 moved but
didn't restyle — Rides, Settings, and the Ride page — and rewrites Log Ride from the ground up.
It also turns on automatic Google Drive backups.

### What you'll see on your iPhone

- **Rides tab**:
  - The monthly calendar now shows a coloured dot on every ride day — the colour matches the
    training zone you rode (or teal for an outdoor ride, grey for an indoor ride still waiting
    for a zone). A day with two rides shows a two-tone dot. A new column on the right of the
    calendar shows each week's total TSS.
  - Tap a ride day to open its chart. Tap a day with more than one ride to see a short list and
    pick one. Tap an empty day in the past (or today) to log a ride on that date.
  - New filter chips — **All · Indoor · Outdoor · Needs zone** — plus a search box that matches
    a ride's name or notes.
  - Your ride history below the calendar is grouped by month with the month name stuck to the
    top as you scroll, and loads a few months at a time with a **Show older rides** button, so
    it stays fast even with hundreds of rides.
- **Ride pages** (tap any ride): a cleaner layout — the ride's name, date, type/zone and any
  detected interval label at the top; a grid of Duration, Distance, Elevation, NP, TSS, IF (and
  Avg HR when known); the same power/heart-rate chart and interval table as before; your notes;
  and three buttons at the bottom: **Edit ride**, **Attach ride file** (add a FIT/TCX file's
  chart to this exact ride — no more guessing which ride it belongs to), and **Delete ride**.
- **Log Ride** is rebuilt:
  - You now choose **Import file** or **Enter manually** at the top.
  - Importing a file shows a short summary (date, duration, power, estimated TSS, detected
    intervals) instead of a form full of numbers. Tap **Edit numbers** if you need to correct
    anything.
  - If you already logged a ride that day, you'll see "You already logged … — **Attach this
    file to it** / **Save as a new ride**" right there in the sheet.
  - Entering a ride by hand now starts with everything blank — no more surprise "60 minutes,
    150 watts" left over from a previous ride. **Save** stays greyed out until you've filled in
    a duration, a power number, and (for an indoor ride) picked a zone.
  - Effort (RPE) is now ten tappable numbers instead of a slider, with the effort your zone
    normally expects circled for you.
- **Settings tab**:
  - Your **Profile** now shows a table of your six training zones and their watt ranges right
    under the FTP box, updating live as you type a new FTP. There's also a new optional
    **Threshold HR / LTHR** field — leave it blank and the app estimates it from your Max HR.
  - **Sync & backup** now says **"Unsynced changes"** if a change hasn't made it to Google Drive
    yet (see auto-sync below).
  - A new **Old imported rides** section lets you say "stop asking" about old rides from the
    original import that never got a training zone — they'll stop showing up in "Needs zone"
    and in the Today alert. Changed your mind? Tap "Show them again."
  - A new **About** section shows the app's version number and a link to this changelog.
  - The **Settings** tab in the bottom bar shows a small red badge when you have changes that
    haven't synced yet.
- **Google Drive auto-sync**: once you've signed in once (Settings → Sync with Google Drive),
  the app now backs up automatically a few seconds after you make a change — log a ride, edit
  one, change your profile — with no extra taps. If your sign-in has expired, nothing pops up
  on its own; the Settings badge just lets you know there's something to sync next time you
  open Settings and tap Sync.
- The **＋ Log Ride** button is now a proper rounded pill (a small cosmetic bug left over from
  the last update).

### Small behaviour changes (on purpose)

- A brand-new manual ride entry starts completely blank (no default 60 minutes / 150 watts / a
  pre-picked zone), so you can't accidentally save a ride with numbers you never actually typed.
- Attaching a FIT/TCX file to an *existing* ride is now done from that ride's own page
  ("Attach ride file"), not by re-opening Log Ride and hoping it finds the right day.
- A Google sign-in that's expired is now treated as signed-out (it used to be reused forever and
  quietly fail on the next sync); the Sync button will ask you to sign in again when that happens.

### Fix found during the orchestrator's review
- The "Unsynced changes" badge showed on the Settings tab every time the app opened, even with no edits, because loading saved data counted as a change. Now "unsynced" means your data was changed after the last successful sync (`exportedAt` later than `lastSyncedAt`), and any successful sync, including a pull or an "already up to date", records the sync time. Checked: a fresh open shows no badge; edits made while signed out still show it after a reload; with a (stubbed) valid sign-in a burst of edits syncs once.

### Checks

- Build passes.
- **Regression check** (`tools/v2-check.mjs`): **no differences vs baseline** — same CTL 45,
  ATL 33, TSB +12, "Transition", and the same imported test ride (54 min, NP 208, TSS 73,
  zone `vo2max`, "3x8 @ 250W"), even though the Log Ride sheet and the Rides tab both changed
  underneath it. The script now opens Log Ride and screenshots both entry modes (Import file,
  Enter manually) before importing the test file — the file input is found the same way, since
  Import file is still the sheet's first, default mode. No tap targets under 44px, no sideways
  scrolling, no page errors.
- `grep -rn "window.confirm\|alert(" src/`: only the one storage-full `alert()` remains (it must
  stay one, by design — it fires when the app itself may be broken). No `window.confirm` anywhere.
- **By-hand checks**, each confirmed against the saved data:
  - Manual entry: Save stayed disabled with everything blank, with only a duration, and with a
    duration + power but no zone (indoor); it enabled once all three were filled in. Switching to
    Outdoor removed the zone requirement (and hid the zone chips) as expected.
  - Importing an outdoor file also hid the zone chips.
  - The "attach to an existing ride" card: choosing **Save as a new ride** fell through to the
    normal import summary; choosing **Attach this file to it** added the file's chart to the
    existing ride without changing its TSS or zone, created no duplicate, and opened its Ride
    page.
  - A test week with a 50-TSS ride and a 70-TSS ride showed **120** in that week's calendar
    column.
  - "Stop asking about old imported rides" removed them from the "Needs zone" filter and from
    the Today alert count; "Show them again" brought both back.
  - Editing a ride from its Ride page saved and returned to that same Ride page; editing a ride
    opened from the Rides list did the same.
  - Auto-sync logic, checked with a temporary test stub (removed before committing): a burst of
    three quick profile edits produced exactly **one** sync call when a Google sign-in was
    valid; with no valid sign-in, the Settings tab showed the unsynced-changes badge and no sync
    was attempted.

### Deferred to later phases (not changed here, on purpose)

- Best efforts, time in zones, heart-rate drift and efficiency factor on the Ride page: Phase 5
  (the page has marked slots waiting for them).
- The Progress tab's look, and the new Today alerts (new best, ramp rate, "feels harder than
  usual", max heart rate): Phase 6.
- The progression-level ceiling, and the "assigning a zone to an old imported ride can move its
  decay clock backwards" quirk noted in Session 23: Phase 7.
- Google Drive auto-sync can't be tested against the real Google sign-in in this environment
  (no network access to Google's servers); it was checked with a stub that stands in for
  `GoogleDriveSync.hasValidToken()`/`sync()`, as the plan asks for. Please try a real sign-in and
  a few edits on your phone and confirm Settings shows "Last synced …" afterward.

### Files Changed
- `src/components/ui/Button.jsx`, `src/Shell.jsx` — `Button` takes a `rounded` prop; the ＋ Log
  Ride button is a real pill
- `src/google-drive-sync.js` — `tokenExpiresAt`, `hasValidToken()`, `authenticate()` no longer
  reuses an expired token
- `src/state/AppDataContext.jsx` — `userProfile.lthr`; `hasUnsyncedChanges` + the 3s auto-sync
  debounce; `hideOldImportedRides()`/`showOldImportedRides()`/`oldImportedRideCount()`;
  `getDefaultFormData()` starts duration/NP/zone empty; ride name defaults at save time
- `src/state/ShellContext.js` — `openLogRide(date)` can pre-fill the Log Ride date
- `src/components/ActivityCalendar.jsx` — zone-coloured dots, week-TSS column, day-tap behaviour
- `src/components/RideRow.jsx` — new (replaces `RideHistoryList.jsx`, removed)
- `src/screens/RidesScreen.jsx` — filter chips, search, month-grouped lazy list
- `src/screens/WorkoutDetailPage.jsx` — Ride page rebuild (stats grid, actions row, Phase 5 slots)
- `src/screens/LogRideSheet.jsx` — Log Ride v2 (import/manual modes, inline attach card, RPE grid)
- `src/screens/SettingsScreen.jsx` — zone table, LTHR, old imported rides, About
- `package.json` — version `2.0.0-beta`
- `tools/v2-check.mjs`, `tools/v2-baseline.json` — Log Ride sheet screenshots for both modes (no
  baseline value changes)
- `ARCHITECTURE.md` — Rides/Ride page/Log Ride/Settings sections rewritten for Phase 4; Google
  Drive Sync section documents auto-sync; `historical` field documented
- `CHANGELOG.md` — this entry

---

## Session 23 - V2 Phase 3: New Four-Tab Layout and Today Tab (2026-09-25)

This session followed **`V2_PLAN.md`**'s Phase 3. The app gets a new layout: four tabs along the bottom of the screen, and a new **Today** tab that sums up where your training is. Everything else that was on the old long page is still there, moved into a tab. It mostly looks the same as before; Phases 4 and 6 redesign those parts.

### What you'll see on your iPhone
- **A tab bar at the bottom: Today · Rides · Progress · Settings.** It sits above the iPhone's home bar, and the top of the app now leaves room for the clock and battery at the top of the screen. (Before this, the app couldn't tell where those were. See "iPhone fixes" below.)
- **Today tab** (opens first):
  - "Casey Rides" with **FTP 231W · 3.0 W/kg · eFTP 197W** under it. Tap **eFTP** to see what it means.
  - **One training status**, e.g. "Transition — Extended rest or detraining", with three tiles: **Fitness (CTL)**, **Fatigue (ATL)** and **Form (TSB)**. Each tile shows how much it has changed in the last 14 days (▲/▼). The old page had four separate cards here, and two of them could disagree ("Fresh" next to "Transition"). That can't happen now.
  - **Alerts**, shown only when something needs you. Tap one to go to the right place:
    - "**Your estimated FTP is …W**", with **Update FTP** and **Dismiss** buttons. This replaces the pop-up that used to ask the same question. Update FTP opens Settings with the new number already typed in. You still tap Save. Dismiss hides it for that number, even after you close and reopen the app.
    - "**16 rides need a zone**": opens Rides showing just those rides, so you can give each one a zone.
    - "**Gran Fondo Utah is complete**": opens Settings → Event, where you can set your next event.
  - **This week**: hours, TSS and number of rides from Monday to today, compared with last week up to the same day. Underneath is a row of 7 dots, one per day, coloured by the zone you rode (grey for outdoor rides).
  - **Latest ride**: tap it to open that ride's chart. A ride without a chart opens its edit form instead.
  - **Event**: "36 days to go" (or "Event complete"), plus the fitness-toward-target bar that used to be in the Fitness Progress card.
  - **Copy for Claude**: works exactly as before.
- **＋ Log Ride** is a green button that floats above the tab bar on Today and Rides. The form now slides up from the bottom. It has the same fields as before, and its **Save Workout** button always stays visible at the bottom.
- **Rides tab**: the monthly calendar on top, and your whole ride history below it. The history used to be a pop-up. The small 📊 ✏️ 🗑️ icons are now bigger buttons labelled **Chart**, **Edit** and **Delete**. Delete asks you to confirm in a panel that slides up from the bottom.
- **Progress tab**: your zone level bars (tap a zone to see its workouts), the Hours / TSS / Elevation / eFTP charts, Power Skills, and a **Workout progression** row. To see a Power Skills bar's number, tap the bar. That used to need a mouse.
- **Settings tab**: your Profile, your Event, **Sync & backup** (Sync with Google Drive, Export backup, Import backup) and **Reset progression levels**. Each section has its own Save button. These used to be the header buttons and the small links at the bottom of the page.
- **Ride pages**: a ride's chart now opens as a full screen, with **‹ Back** at the top left and **Re-detect** at the top right. Because the home-screen app has no browser back button, Back is built into the app.
- **No more pop-up boxes.** Messages like "✓ Detected: 3x8 @ 250W" now show as a short banner at the top of the screen. Questions ("Delete this ride?", "Reset progression levels?", "Attach this file to the ride you already logged?", "Restore this backup?") show as a panel that slides up from the bottom, with clearly labelled buttons.
- **Text boxes no longer make the iPhone zoom in** when you tap them. All inputs now use 16px text, and iOS only zooms on smaller text. Every button is at least 44 points tall, big enough to tap easily.
- The app remembers how far down each tab you've scrolled while you switch between tabs.

### Small behaviour changes (on purpose)
- **Restoring a backup now asks first.** It tells you how many rides are on the phone now and how many are in the backup. Before, it replaced everything without asking.
- **Profile changes are saved when you tap Save profile.** Before, Max HR, weight and similar fields changed as you typed, and Cancel didn't undo them.
- **After editing a ride you stay where you were.** Before, the app always jumped back to Ride History.
- **Saved data now includes `schemaVersion: 2`.** This is a small version label written into your saved data, backup files and the Google Drive copy. Older backups without it still load exactly as before.

### Behind the scenes (for the technically curious)
- `src/App.jsx` went from ~3,460 lines to 18. All saved data, and everything that changes it, moved into `src/state/AppDataContext.jsx`. The logic for saving a ride was moved **word for word**, so progression, the trickle to neighbouring zones and the "last worked" dates behave exactly as before (checked, see below).
- Screens live in `src/screens/`, shared pieces in `src/components/`, and a small set of building blocks (buttons, cards, sheets, tiles, tab bar) in `src/components/ui/`. Every later phase builds from these blocks. `ARCHITECTURE.md` has a new "Design system" section with the rules.
- Moving between tabs and pages uses the part of the web address after `#` (e.g. `#/rides`, `#/ride/1234`). No new libraries were added.
- **iPhone fixes:** `index.html` now has `viewport-fit=cover`. Without it, iOS reports the notch and home-bar areas as zero, so the old bottom padding never did anything. That padding was removed. The new screens, sheets and tab bar handle those areas themselves. The home-screen icon link was checked, and it works under `/cycling/`.

### Checks
- Build passes.
- **Regression check** (`tools/v2-check.mjs`): no page errors, no pop-up dialogs. CTL 45, ATL 33, TSB +12 and "Transition" are unchanged, and so is the imported test ride (54 min, NP 208, TSS 73, "3x8 @ 250W"). **One expected difference**: the header line changed format only, from `FTP: 231W • 3.0 W/kg • eFTP: 197W` to `FTP 231W · 3.0 W/kg · eFTP 197W`. The numbers are the same. The baseline was re-written for this in the same commit as the script update.
- The check script was updated for the new layout. It now opens Log Ride with the ＋ button and reads CTL/ATL/TSB and the training status from the Today tiles (same key names). It takes screenshots of every tab, the Log Ride sheet, the post-log summary and one Ride page. It also lists any button smaller than 44px (none) and checks each tab for sideways scrolling (none).
- **By-hand checks** (each confirmed in the saved data):
  - Logged an indoor Sweet Spot ride on the old version and the new one, from the same starting data. The results were identical:
    - Sweet Spot went 5.4 → 5.9.
    - The trickle gave Tempo 3.1 → 3.2 and Threshold 3.8 → 3.9.
    - Sweet Spot's "last worked" date went 2026-09-18 → 2026-09-25.
    - TSS was 75.
    - Giving a zone to an old imported ride also matched: Threshold 3.8 → 4.8.
  - Deleted a ride with the confirm panel: Cancel kept it, Delete removed it.
  - Imported a TCX file on a day that already had a ride of similar length. The app offered to attach it; attaching added the chart and intervals to that ride without creating a duplicate or changing its TSS or zone, then opened its Ride page.
  - Exported a backup. The file has `schemaVersion: 2` and all the old intervals.icu fields. Restored it after deleting a ride, and got all 158 rides back. Also restored an old-style backup without `schemaVersion`, and it worked.
  - The eFTP alert appears, and stays through a reload until you answer it. After Dismiss it stayed gone after a reload. Update FTP opened Settings with 197 typed in, and saving it asked about resetting levels.
  - Back from a Ride page returns to Rides at the same scroll position. Opening a Ride page directly and tapping Back goes to Rides.

### `window.alert` / `window.confirm` still in the code
- **One `alert`**: the "Could not save your data — browser storage may be full" warning in the save code (`src/state/AppDataContext.jsx`). The plan says it must stay an `alert`, because it appears when the app itself may be broken.
- **No `window.confirm` left.** The other 19 pop-ups are now banners or confirm panels.

### Deferred to later phases (not changed here, on purpose)
- The Rides, Ride page, Log Ride and Settings designs, filters and search, and Google Drive auto-sync: Phase 4. The re-homed sections look much as they did.
- Some old small print is only visible with a mouse: the date on a zone's "+0.3" badge, and the "idle" badge explanation. They're minor and go away when Phase 6 restyles the level bars.
- The level-bar animation after logging a ride plays on the Progress tab, but Log Ride is usually opened from Today, so you rarely see it. Phase 6 can decide whether to keep it.
- Existing quirk, kept as-is: giving a zone to an old imported ride sets that zone's "last worked" date to the ride's own (old) date, which can move it backwards. The ride-saving logic was moved word for word, so this was not changed. It is worth fixing in Phase 7.
- Power Skills percentiles show decimals ("44.9th percentile"). This is unchanged from Phase 2, and Phase 6 replaces this card's data.

### Files Changed
- `src/App.jsx`: now only the providers + `Shell`
- `src/Shell.jsx`, `src/state/AppDataContext.jsx`, `src/state/useHashRoute.js`, `src/state/ShellContext.js`: new
- `src/components/ui/*`: new UI kit (Screen, TabBar, Page, Sheet, Card, SectionHeader, StatTile, SegmentedControl, Button, Chip, Toast, ConfirmSheet, EmptyState)
- `src/components/*.jsx`, `src/screens/*.jsx`: new (re-homed sections, Today tab, sheets and pages)
- `src/lib/load.js`, `chartData.js`, `summary.js`, `alerts.js`, `format.js`: new; `progression.js`, `rideFiles.js`, `zones.js`: helpers moved in
- `index.html`: `viewport-fit=cover`; `src/index.css`: old iOS body padding removed, sheet animations, window scrolling
- `tools/v2-check.mjs`, `tools/v2-baseline.json`: new selectors, screenshots, tap-target check; `ftpLine` format
- `ARCHITECTURE.md`: rewritten for the new structure (file layout, data layer, routing, UI kit, design system, screens)
- `CHANGELOG.md`: this entry

---

## Session 23 - V2 Phase 2: Bug Fixes and One Zone Table (2026-09-25)

This session followed **`V2_PLAN.md`**'s Phase 2. It's a bug-fix pass — nothing about how the app looks or works day-to-day changes, except the zone ranges shown on the progression bars and a few small wording/validation fixes.

### What you'll see on your iPhone
- **The zone ranges under each progression bar now line up with how the app actually files your workouts.** Before this fix, the labels and the behind-the-scenes zone detection disagreed, so power between 79–83% of your FTP wasn't labeled as belonging to any zone at all, even though a ride in that range was still being filed under Tempo or Sweet Spot. At your current FTP (231W) the six zones now read: **Z2: 127–162W · Z3: 162–187W · 187–217W (Sweet Spot) · Z4: 217–236W · Z5: 236–277W · Z6: 277W+**.
- **Outdoor rides no longer show up under a training zone.** A handful of outdoor rides (for example, ones named things like "Draper" or "West Valley") were incorrectly showing up in the Workout Progression screen's VO2max tab. Outdoor rides were never supposed to count toward a zone — that's fixed, both going forward and for the rides that were already affected (see "One-off data fix" below).
- **The Profile FTP box behaves properly.** Before, clearing the box to type a new number would sometimes flash to 235 partway through typing. Now you can clear it and type freely; if you tap Save with it empty or with a number outside 100–500, you'll see a small red message and your old FTP stays in place instead of being silently overwritten.
- **"Days to Event" no longer goes negative.** Once your event date has passed, the Fitness Progress card and the Copy for Claude text now say "Event complete" instead of something like "Days to Event: -104".
- **Power Skills tooltips now say "62nd percentile"** instead of "Top 62%" — the old wording read backwards, since a bigger number there is better, not worse.
- **Importing a FIT/TCX file matches the right ride** when you've logged more than one ride on the same day — it now compares ride length, not just the date, before offering to attach the file to an existing ride.
- **Ride History cards**: the interval label (like "3x8 @ 250W") now sits on its own line instead of occasionally running under the 📊 ✏️ 🗑️ buttons on a long ride name.
- **Reset Levels** (both the Profile "FTP changed, reset levels?" prompt and the bottom-bar Reset Levels link) now correctly reset Recovery along with the other six zones — before, Recovery was silently skipped.

### One-off data fix: outdoor rides' zone tag
On the first load after this update, the app does a one-time cleanup: any ride already saved with `rideType: 'Outdoor'` that had a zone category attached to its interval data (from the bug described above) gets that category cleared. This does **not** touch anything else about the ride — its name, duration, distance, elevation, detected interval label, and power/heart-rate data are all untouched. It only stops the ride from being counted under a training zone it was never supposed to belong to. This can't be undone by "Undo" since it isn't a button — but nothing is deleted, and re-running the app doesn't change it again once it's been cleaned up (rides without a category are left alone).

### Why this happened (for the technically curious)
Every ride's `intervalData.category` field is supposed to record which training zone a workout's effort was filed under. For outdoor rides, that field was supposed to stay empty, but the code had a fallback: whenever no zone was manually picked, it fell back to whatever zone the automatic interval detector guessed from the power data. Outdoor rides never have a manually picked zone, so they always hit that fallback and got a guessed zone anyway. That's now fixed everywhere the field gets set: saving a ride, editing a ride, re-running interval detection, and attaching a FIT/TCX file to an existing ride.

### Checks
- Build passes.
- Regression check (`tools/v2-check.mjs`): **no differences vs baseline**, no page errors — expected, since Phase 2 doesn't touch the synthetic indoor test ride's numbers.
- `categoryForRatio()` (the function that decides which zone a detected interval belongs to) was checked against its old behavior for 2,001 ratios (0.000 to 2.000, in steps of 0.001): **0 mismatches**. No existing ride gets re-filed into a different zone by this update.
- By-hand checks: seeded an outdoor ride with a leftover zone category, reloaded, and confirmed localStorage cleared it to `null` and it no longer appeared under the Workout Progression VO2max tab. Screenshotted the progression bars at FTP 231W and confirmed the exact zone label text above. Walked through the Profile FTP box: typed 240 and saved (header updated to 240W), then cleared it and saved again (inline error shown, FTP stayed at 240W).

### Deferred to later phases (not fixed here, on purpose)
- The app's overall layout, navigation and design (bottom tabs, Today tab, etc.) — Phase 3.
- Heart-rate-only rides logging 0 TSS, and several other metrics-engine gaps — Phase 5.
- The progression-level ceiling bug — Phase 7.
- `window.alert`/`window.confirm` usage throughout the app is unchanged in this phase; Phase 3/4 replace them with in-app toasts and confirm sheets.

### Files Changed
- `src/lib/zones.js` — `ZONE_BOUNDS` replaces `ZONE_POWER_RATIO_RANGES`; adds `zoneForRatio`, `zoneWattRange`, `zoneRangeLabel`; `categoryForRatio` behavior unchanged; `ZONES[].description` (hard-coded 235W-FTP text, unused) removed
- `src/App.jsx` — `getZoneDescription` removed (replaced by `zoneRangeLabel`); outdoor rides no longer get a zone category (`handleLogWorkout`, `redetectForRide`, FIT/TCX backfill, Log Ride pre-select); one-off outdoor-category migration in the load effect; FIT/TCX same-day matching now uses `findMatchingRideForImport` (duration-based); Profile FTP box validates and no longer snaps to 235; both "reset levels" code paths use `{ ...DEFAULT_LEVELS }`; "Event complete" replaces negative day counts (Fitness Progress card, Copy for Claude); Power Skills tooltips say "Xth percentile"; Ride History interval label moved to its own line
- `ARCHITECTURE.md` — new "Zone Definitions" section; updated Ride Source Model / Interval Data / UI Layout / Modal system / Key Functions sections for the above
- `CHANGELOG.md` — this entry

---

## Session 23 - V2 Phase 1: Remove intervals.icu and Tidy the Code (2026-09-25)

### What you'll see on your iPhone
- Almost nothing, on purpose. The only visible change: the links at the bottom of the page now read **Import · Export … Reset Levels**. "Paste CSV" and "Import Power" are gone.

### Removed: everything intervals.icu
- **Security fix:** the intervals.icu API key was written into the app's code and published with the live site. It's now deleted from the code, and the app also deletes the saved copy from your phone the next time it opens (`localStorage['intervals-icu-config']`).
- **Action for you:** deleting the key from the code does **not** delete it from the project's history on GitHub, where anyone can still read it. Revoke it in intervals.icu (**Settings → Developer**) and create a new one if you ever need it. Do this even if you think you already have.
- Also removed: the intervals.icu sync screen, the CSV paste import, the power-curve import, the VO2max estimator that relied on intervals.icu, the old "your FTP went up" pop-up, the cloud-sync help screen, and the intervals.icu ID tag in Ride History. None of these could still be reached in normal use.
- **Nothing you saved is lost.** Rides imported from intervals.icu keep every field. The old `intervalsFTP`, `vo2maxEstimates` and `powerCurveData` values are still loaded, saved, exported and synced unchanged. The Power Skills card still reads the saved power curve (Phase 6 replaces it).
- **Small fix:** Export was leaving out `vo2maxEstimates`, so a backup file didn't carry them. It now includes them.

### Code tidy-up (no behaviour change)
- 30 helper functions and constants moved out of `src/App.jsx` into six new files under `src/lib/` (`dates`, `zones`, `rideFiles`, `eftp`, `intervals`, `progression`). They were copied exactly, and a line-by-line comparison showed nothing changed.
- `src/App.jsx`: 5,353 → 3,425 lines.

### Checks
- Build passes. Regression check (`tools/v2-check.mjs`): **no differences vs baseline**, no page errors.
- A search for the API key and athlete ID in `src/` finds nothing.

### Files Changed
- `src/App.jsx` — intervals.icu code removed, helpers moved out, Export includes `vo2maxEstimates`
- `src/lib/dates.js`, `zones.js`, `rideFiles.js`, `eftp.js`, `intervals.js`, `progression.js` — new
- `ARCHITECTURE.md` — file structure, import sources, state, functions, layout
- `CHANGELOG.md` — this entry

---

## Session 22 - V2 Review and Implementation Plan (2026-09-25)

### Planning only — no app code changed
- Reviewed every screen at iPhone width (390px) with a 158-ride synthetic history, and read all of `src/App.jsx`. Findings and the agreed direction (four-tab layout, intervals.icu removal, new metrics, progression rebuild) are in **`V2_PLAN.md`**, split into 7 phases with a recommended model per phase.
- **Security finding:** the intervals.icu API key is hard-coded in `src/App.jsx` (intervals.icu state block) and published in the GitHub Pages bundle. Phase 1 removes it from the code; the user must also revoke it in intervals.icu, since it stays in git history.
- Added **`tools/v2-check.mjs`**, a regression check every V2 phase runs: seeds a fixed synthetic history, freezes the clock at 2026-09-25, imports a synthetic `3x8 @ 250W` TCX through Log Ride, records key numbers (header, CTL/ATL/TSB, training status, the imported ride's duration/NP/TSS/interval label) and screenshots at 390px. Baseline in `tools/v2-baseline.json`; output in `tools/.out/` (gitignored). Verified deterministic (two runs, no differences, no page errors).

### Files Changed
- `V2_PLAN.md` — new
- `tools/v2-check.mjs`, `tools/v2-baseline.json` — new
- `.gitignore` — ignore `tools/.out`
- `CHANGELOG.md` — this entry

---

## Session 21 - TCX File Import (2026-09-25)

### Feature: Log Ride accepts .TCX files alongside .FIT
- **Why**: the user's hardest efforts are outdoor rides, and TrainerDay/Garmin sometimes export those as TCX rather than FIT. eFTP (Session 20) only sees rides with saved power data, so those rides were invisible to it.
- The Log Ride "Import FIT File" button is now **"Import FIT/TCX File"** and accepts `.tcx`. New `parseTcxFile()` reads the XML with the browser's built-in `DOMParser` (no new dependency) and converts trackpoints and laps into the same record shape the FIT reader produces. The FIT-specific result-building in `parseFitFile()` was moved into a shared `buildRideFromRecords()`, so both formats go through identical code for form pre-fill, power stream, interval detection, same-date backfill, eFTP and charts. FIT behavior is unchanged.
- **Missing power = 0W**: TrainerDay leaves `<Watts>` out of a trackpoint while coasting instead of writing 0 (the sample file had ~45% of points without power and not a single 0W reading). These points are counted as 0W, which keeps NP and TSS honest; skipping them would have overstated both. This can't inflate eFTP.
- TCX has no Normalized Power or total-ascent field, so NP is always calculated from the power samples and elevation from altitude readings (0 ft if the file has none, as with the sample).

### Verified against
- `Draper_Road_Cycling-260917.tcx` (TrainerDay, 92 min, 5,519 trackpoints): pre-filled 2026-09-17, 92 min, Outdoor, 12.1 mi, NP 192W; saved with a 552-bin power stream (no gaps) and per-second HR; TSS 106; header eFTP 215W. No console errors.
- `West_Valley_City_Road_Cycling-260920.fit` re-imported after the refactor: same results as before (94 min, Outdoor, 23.2 mi, NP 210W, eFTP estimate 196W).

### Files Changed
- `src/App.jsx` — `parseTcxFile()`, `buildRideFromRecords()` (extracted from `parseFitFile()`), `handleFitFileImport()` (reads `.tcx` as text), Log Ride import button label/accept list, three "Import a FIT file" hints now say "FIT or TCX"
- `ARCHITECTURE.md` — import sources, function table
- `CHANGELOG.md` — this entry

---

## Session 20 - Calculate eFTP From FIT Power Streams (2026-09-25)

### Feature: eFTP no longer depends on intervals.icu
- **Problem**: "eFTP" (`ride.eFTP`) only ever came from the (now unreachable) intervals.icu API
  sync or the "Paste CSV" import. Since FIT import became the primary way to log rides, that
  field was frozen. Worse, `getDefaultFormData()` pre-filled every new ride's eFTP input with
  the last stored value, so one imported number (243W) silently copied itself onto every ride
  logged afterward — which is what produced the recurring "Your estimated FTP (243W) is 12W
  higher..." popup even after the user manually lowered their FTP.
- **Fix**: three new pure helpers (`bestAveragePower`, `estimateRideFtp`, `buildEftpTimeline`)
  calculate eFTP directly from each ride's own `stream` (already saved from FIT import, Session
  18): best 20-minute power x 0.95, or best 60-minute power if higher. The live eFTP shown
  everywhere in the app is the highest such estimate from the last 90 days (`eftpTimeline`,
  `currentEftp`) — the same rolling-window model intervals.icu itself used, just computed
  locally. See `EFTP_ESTIMATE_PLAN.md` for the full design.
- The eFTP input field is removed from the Log Ride / Edit Ride form entirely — eFTP is now
  calculated, never entered. Editing an old ride preserves its legacy `eFTP` value via
  `...oldWorkout` in the save path (nothing sets or clears it anymore).
- **Known limitation**: the estimate reflects the hardest effort in the last 90 days, so ERG/
  sweet-spot/threshold workouts (e.g. 2x20 @ 95% FTP) produce an eFTP *below* true FTP. A real
  20-minute test or long hard climb gives the most accurate reading. This is why the update
  prompt (below) only ever offers to raise FTP.

### Fix: FTP update popup no longer nags
- Replaced the old effect (ran on every `history` change, no dedup, could re-fire the same
  prompt on every app launch) with one that only offers an FTP increase, and only once per
  distinct new estimate: the prompted value is stored in `localStorage['eftp-prompted-value']`
  *before* the confirm dialog opens, so Cancel and OK both count as "seen." Manually changing
  FTP does not trigger it (the effect depends only on the calculated eFTP, not on `currentFTP`).
  This key is device-local by design — not part of `STORAGE_KEY` or Google Drive sync — so at
  worst a second device prompts once more.

### eFTP Progress chart: kept working across the transition
- `calculateEFTPHistory()` now takes `(history, eftpTimeline)`. Per calendar month, it prefers
  the highest calculated estimate; only falls back to a ride's legacy `ride.eFTP` for months
  *before* the first FIT-based estimate exists (`firstStreamDate`). This is what keeps the old
  243W copy-forward values from drawing a false flat line across recent months — those rides
  are ignored in favor of the calculated numbers once any FIT ride exists.
- Chart dots are now hollow for legacy/imported months and solid for calculated months, so the
  handover point is visible at a glance. The tooltip shows the peak ride's name/date for
  calculated months, or "Imported from intervals.icu" for legacy ones. "Latest" in the chart
  header now matches the page header's `currentEftp.value` instead of the last plotted month.
- Old `ride.eFTP` values are never deleted or rewritten — a history with no FIT streams at all
  renders identically to before this change.
- Verified: unit-style checks on the three helpers (steady/interval/gap/rolling-window/
  binSeconds-independence cases) and an in-browser check seeding a history with 5 months of
  legacy-only rides, 4 months of FIT-stream rides (including a 260W/20-min effort and two stale
  243W manual entries dated after the first stream), and `ftp: 231`: header, chart "Latest",
  and Copy for Claude all showed the calculated 247W; the popup fired exactly once and did not
  reappear on reload; editing and saving a legacy ride kept its stored `eFTP`; a history with no
  streams at all rendered the chart exactly as before (all hollow dots, no header eFTP).
- **Not done**: the plan's optional cleanup of the unreachable intervals.icu sync modal and
  FTP-increase modal (`syncFromIntervalsICU`, `showFTPModal`/`detectedFTP`) was skipped. Their
  triggering code (`setShowIntervalsSyncModal(true)`) turned out to have one real call site,
  inside `analyzeActivityForVO2max()`'s "intervals.icu not configured" guard — dormant only
  because `intervalsConfig` ships with hardcoded defaults and nothing in the UI clears it, not
  because the call itself is unreachable. Removing the modal without also reworking that guard
  risked breaking the (kept) VO2max analyzer, so it was left in place pending a closer look in a
  future session.

### Files Changed
- `src/App.jsx` — `bestAveragePower()`, `estimateRideFtp()`, `buildEftpTimeline()`,
  `eftpTimeline`/`currentEftp` (`useMemo`), `calculateEFTPHistory()`, eFTP Progress chart (dot
  styling, tooltip, "Latest", empty-state text), FTP-update prompt effect (`eftpPromptedValue`),
  `getDefaultFormData()` (eFTP field removed), Log/Edit Ride form (eFTP input removed, RPE
  slider now full width), ride create/edit save paths, header eFTP display, Ride History row,
  `copyForAnalysis()`
- `ARCHITECTURE.md` — new "eFTP Estimation" section, updated state/function/chart tables
- `CHANGELOG.md` — this entry
- `EFTP_ESTIMATE_PLAN.md` — marked Status: Implemented in Session 20 (§7 cleanup not done, see above)

---

## Session 19 - Interval Detection Fixes (Sub-Threshold Work & Auto-Laps) (2026-08-21)

### Bug: intervals below 85% FTP were never detected
- **Symptom**: a 2x30 @ 182W tempo session imported from a FIT file produced no intervals at all — no label in Ride History, nothing in Workout Progression.
- **Root cause**: `detectIntervals()` called a bin "work" only at ≥85% FTP (`WORK_THRESHOLD`). At a 235W FTP that bar is 200W, so a 182W tempo interval never crossed it. The lap fallback used the same 85% bar, so it couldn't rescue the ride either. Every tempo, endurance and low sweet spot session was invisible by construction — only threshold/VO2max work was ever detected.
- **Fix — adaptive work threshold**: new `adaptiveWorkThreshold()` runs a 1-D 2-means split (Lloyd's algorithm, seeded at the 10th/90th percentiles) over the ride's own smoothed power trace, finding its recovery level and its work level, and puts the threshold at the midpoint. Indoor ERG power is a near-square wave, so this converges cleanly. The 182W/125W ride splits at ~153W and both 30-minute blocks are found.
- The adaptive value can only ever **lower** the bar: `min(0.85 × FTP, adaptive)`. Nothing that was detected before this change stops being detected.
- **Guards against phantom intervals**, since the threshold is now relative:
  - `MIN_WORK_RATIO` (0.60) — a segment must average ≥60% FTP to count as work at all, so a warmup/cooldown split can't be reported as "2x20 @ 120W".
  - `WORK_REST_SEPARATION` (1.15) — the work level must sit ≥15% above the easy level, otherwise the ride is steady and the adaptive threshold is rejected.
  - `MIN_SOLO_WORK_RATIO` (0.76) — a *single* work block below 76% FTP is steady riding, not an interval (stops a 90-minute endurance ride becoming "1x70 @ 162W").
  - Adaptive detection runs for **indoor rides only** (`{ indoor }`, from `rideType`). Outdoor power from rolling terrain is too noisy and would invent intervals; outdoor rides keep the fixed 85%-FTP behavior unchanged.

### Bug: long intervals chopped into auto-laps were mis-counted
- **Symptom**: the same 2x30 file records twelve laps — each 30-minute interval is split into 8/8/8/6-minute auto-laps. Once the threshold fix let the lap path see them, it would have reported "6x8 @ 181W + 2x6 @ 179W" instead of "2x30 @ 181W".
- **Fix**: new `mergeLapBlocks()` collapses consecutive laps whose average power is within ±7% into a single block before anything is classified.
- Lap segmentation is now preferred when it finds **more** intervals than step detection, or when it finds the **same number and agrees on total work time within 25%** — in the tie case lap boundaries are the more accurate of the two (they give exactly 30:00, where step detection includes the ramp-up).

### Fix: interval zone categories now match the app's own zone table
- `ZONE_POWER_RATIO_RANGES` disagreed with the watt ranges in `ZONES`: a 205W block (Sweet Spot per the zone table at a 235W FTP) was filed under Tempo, because the tempo band ran all the way to 88% FTP.
- Boundaries realigned to the `ZONES` watt ranges: endurance <0.70, tempo <0.81, sweetspot <0.94, threshold <1.02, vo2max <1.20, anaerobic above.
- Only affects newly detected/re-detected rides — `intervalData.category` already stored on a ride is untouched.

### Feature: re-detect without re-importing
- Rides imported before this fix already have their power stream saved, so detection can simply be re-run on it — no need to find and re-import the original `.fit` files.
- **🔍 Re-detect** button in the Workout Detail modal header — re-runs detection for that one ride.
- **🔍 Re-scan intervals** button in the Workout Progression modal header — re-runs detection across every ride with a saved stream, after a confirmation showing how many rides will be scanned, then reports how many had intervals found and how many changed.
- Both skip rides whose `intervalData.source` is `'manual'`, and both keep a user-chosen `zone` as the category rather than overwriting it with the detected one (same rule the FIT import path already used). If a re-detect comes back empty on a ride that already has interval data, the existing data is kept.
- Lap data isn't stored per ride, so re-detection uses step detection only — usually identical, occasionally a little less precise on interval boundaries than a fresh FIT import.

### Verified against
The attached `Tempo_2x30` FIT file (75 min, 4500 power records, 12 laps) now returns `2x30 @ 181W [tempo]` with segments at 10:00–40:00 and 42:00–72:00, both with and without lap data. Synthetic checks confirmed 4x4 VO2max, 3x15 sweet spot, 2x20 threshold, 3x20 endurance and mixed-set workouts all still detect correctly, and that steady endurance rides, steady tempo rides, recovery spins and outdoor rolling terrain still return no intervals.

### Files Changed
- `src/App.jsx` — `adaptiveWorkThreshold()`, `mergeLapBlocks()`, `meanOf()`, detection constants, `detectIntervals()` (adaptive threshold, work floor, lap merging/preference, solo-segment guard), `ZONE_POWER_RATIO_RANGES`, `handleFitFileImport()` (passes `indoor`), `redetectForRide()`/`handleRedetectRide()`/`handleRedetectAll()`, Workout Detail + Workout Progression modal headers
- `ARCHITECTURE.md` — detection functions, threshold constants table, indoor/outdoor rule, modal headers
- `CHANGELOG.md` — this entry

---

## Session 18 - Indoor Interval Tracking & Progression (2026-08-20)

### Feature: Interval detection from FIT files
- `parseFitFile()` now keeps a downsampled power/HR stream (`downsampleRecords()`, 10-second bins) and lap data instead of discarding per-second records after computing NP. Rides without power data still return `stream: null` — no behavior change for those.
- New `detectIntervals(stream, ftp, laps)`: step-detection on a 3-bin (30s) smoothed power trace. A bin counts as "work" at ≥85% FTP (`WORK_THRESHOLD`); work runs shorter than 90s (`MIN_WORK_SECONDS`) are discarded as noise; runs separated by a ≤20s gap are merged (handles momentary power dropouts). Falls back to FIT lap boundaries when laps yield more qualifying segments than step detection (handles variable-power intervals ERG step detection would miss). Segments are grouped into sets (±15% duration, ±5% watts) and categorized by the dominant set's %FTP into the same zone IDs used everywhere else (endurance/tempo/sweetspot/threshold/vo2max/anaerobic).
- `buildIntervalLabel()` turns sets into a display string like `4x6 @ 280W` (or `3x8 @ 250W + 4x1 @ 320W` for multiple sets).
- Detection runs on every FIT import. A confirmation panel in the Log Ride modal shows the detected label and pre-selects the Zone field to the detected category (the user can still change it before saving) — this is a narrow, explicitly agreed exception to the Session 5 "no auto-classification" rule, since it comes from actual interval structure rather than an NP guess.

### Feature: FIT backfill for already-logged rides
- Importing a FIT file whose date matches an existing ride now prompts: attach the interval/stream data to that ride, or fall through to the normal new-ride flow. Attaching updates only `stream`/`intervalData` on the existing entry in place — TSS, zone, and progression levels are untouched — then opens the new Workout Detail modal so the result is visible immediately.

### Feature: Workout Detail modal
- New modal (`showWorkoutDetail`, ride ID), opened via a new "📊" button in Ride History entries (shown only when a ride has `stream` or `intervalData`) or automatically after a FIT backfill.
- Recharts `ComposedChart`: power as a stepped `Area`, heart rate as a `Line` on a secondary right-hand axis (omitted entirely if the ride has no HR data), and a `ReferenceArea` per detected segment shading the work intervals. Below the chart, a compact table of each interval's duration/watts/HR.
- Ride History entries now show the detected interval label (e.g. `4x6 @ 280W`) as a small tag next to the ride name when present.

### Feature: Interval Progression modal
- New "📈 Workout Progression" dashboard button below Ride History, opening a modal (`showProgressionModal`) with a tab per training zone (recovery excluded) and a session count badge.
- Trend chart (Recharts `AreaChart`, zone-colored) toggles between total work minutes and work-time-weighted average watts across a category's sessions.
- Session list (newest first) shows date, label, and the dominant set's average HR — this is the planning view: e.g. seeing the last three Sweet Spot sessions were 2x20/2x22/2x25 @ 195W to decide whether to push watts or duration next. Clicking a session opens its Workout Detail modal. Empty-category state points the user at FIT import.
- **Default view (no zone tab selected)**: opening the modal no longer pre-selects a zone. With nothing selected, it shows the 5 most recent indoor workouts and their zones (clickable through to Workout Detail when interval data exists) instead of one category's trend chart. Selecting a tab switches to that zone's chart/session-list view as above.

### Feature: Copy for Claude interval progressions
- `copyForAnalysis()` now appends an `## Interval Progressions` section (skipped entirely if no ride has `intervalData`) listing up to the last 3 sessions per category, oldest → newest, e.g. `Sweet Spot: 2x20 @ 195W (Jul 30) → 2x22 @ 195W (Aug 6) → 2x25 @ 195W (Aug 13)`.

### Data model
- Two new optional fields on ride history entries, both `undefined` on rides that predate this feature (manual, CSV, API, or old FIT imports) — every consumer null-checks:
  - `stream: { binSeconds, power: [...], hr: [...] }` — downsampled per-ride power/HR, ~8-12KB for a 2-hour ride at 10s bins.
  - `intervalData: { source: 'auto'|'manual', category, label, sets: [{reps, workSeconds, avgWatts, avgHR, restSeconds}], segments: [{startSec, endSec, avgWatts, avgHR}] }`.
- No IndexedDB, no new storage key — both fields round-trip through the existing single `STORAGE_KEY` object (and therefore through Export/Import and Google Drive sync) automatically since `history` was already fully persisted.
- The localStorage save effect is now wrapped in `try/catch`; a quota error surfaces an alert telling the user to export a backup instead of silently failing to save.
- intervals.icu interval import remains explicitly out of scope (future work) — the `intervalData` shape was designed to be compatible with a future importer from that source.

### Files Changed
- `src/App.jsx` — `downsampleRecords()`, `detectIntervals()`, `buildIntervalLabel()`, `parseFitFile()` (stream/laps), `handleFitFileImport()` (backfill + detection), `handleLogWorkout()` (persists `pendingFitDetail`), `handleCancelEdit()`/`closeLogRideModal()` (clear `pendingFitDetail`), Workout Detail modal, Interval Progression modal + dashboard button, Ride History 📊 button + interval label tag, `copyForAnalysis()` interval section, localStorage save effect try/catch
- `ARCHITECTURE.md` — data model, key functions, modal system, UI layout
- `CHANGELOG.md` — this entry
- `INTERVAL_TRACKING_PLAN.md` — status updated to implemented

---

## Session 17 - Remove Instant Analysis Card, Relocate Copy for Claude (2026-08-20)

### Removed: Instant Analysis Card
- Removed the "Instant Analysis" card (auto-generated insights list) from the dashboard.
- Removed its supporting code: `generateInsights()` (~300-line rule-based insight generator) and `getInsightStyle()` (insight icon/color mapping). Both were only used by this card.

### Relocated: Copy for Claude Button
- The "Copy for Claude" button (calls `copyForAnalysis()`, unchanged) now lives inside the **Training Status** card, directly below the status pill/TSB%, instead of its own card. `copyForAnalysis()` already built its clipboard text independently of the insights list, so no logic changes were needed — only the button's JSX location and styling (small gray/green pill button, `mt-3` spacing to sit under the TSB% line).
- Removed the plain-text status description (e.g. "Productive overload, fitness improving") that used to sit below the TSB% line in the Training Status card, replaced by the relocated button in that spot. The status label pill and TSB% are unchanged.

### Files Changed
- `src/App.jsx` — removed Instant Analysis card JSX, `generateInsights()`, `getInsightStyle()`, `insights` variable; moved Copy for Claude button into Training Status card; removed status description paragraph
- `ARCHITECTURE.md` — UI layout renumbered, Training Summary + Training Status description updated
- `CHANGELOG.md` — this entry

---

## Session 16 - FIT File Import in Log Ride Modal (2026-07-01)

### Feature: Import FIT File
- New "📁 Import FIT File" button at the top of the Log Ride modal (both logging a new ride and editing an existing one).
- Parses `.fit` files (Garmin/Wahoo/Zwift/TrainerRoad exports) entirely client-side using the `fit-file-parser` npm package (chosen over a hand-rolled binary parser to avoid re-implementing the FIT binary protocol's edge cases).
- Pre-fills into `formData`: Date, Duration, Normalized Power, Distance, Elevation, and Ride Type (Indoor/Outdoor, detected from GPS position data in the file's records).
- **Does NOT set Zone, Ride Name, or RPE** — the user still picks those and hits Save, exactly like manual entry today. This keeps the ride tagged `source: 'manual'` with no changes needed to `handleLogWorkout` or the Ride Source Model, and preserves the Session 5 rule that zone classification is always user-driven (NP-based auto-classification was unreliable for interval workouts).
- **Normalized Power**: uses the device's own `normalized_power` field if present in the FIT file; otherwise computes it client-side from the per-second power stream (30s rolling average, 4th-power mean, 4th root — `calculateNormalizedPower()`); falls back to average power if no per-second stream exists.
- **Elevation**: uses the FIT file's `total_ascent` if present; otherwise sums positive altitude deltas across records.
- **Bug caught during testing**: feeding the parser a non-FIT file (wrong file picked by accident) caused it to loop indefinitely trying to recover a header, hanging the tab. Fixed by validating the FIT header's `.FIT` signature bytes before handing the file to the parser at all, so invalid files fail immediately with a clear alert instead of hanging.

### Files Changed
- `package.json` — added `fit-file-parser` dependency
- `src/App.jsx` — `calculateNormalizedPower()`, `parseFitFile()`, `handleFitFileImport()`, Log Ride modal button
- `ARCHITECTURE.md` — Data Import Sources, Key Functions
- `CHANGELOG.md` — this entry

---

## Session 15 - Mobile Elevation Chart Y-axis Fix (2026-06-21)

### Bug Fix: Elevation ("Altitude") Y-axis Overflow on Mobile
- **Symptom**: On narrow mobile viewports, the Monthly Elevation chart's Y-axis
  tick labels (e.g. `12,000ft`) ran offscreen.
- **Root cause**: The axis `tickFormatter` produced wide labels using thousands
  separators plus a `ft` suffix, exceeding the fixed `width={55}` axis column.
- **Fix**: Shortened tick labels to a compact "k" form — `12,000ft` → `12k`,
  `7,500ft` → `7.5k`, values under 1,000 shown as-is. The chart title and the
  tooltip still show the full `ft` value, so no clarity is lost.
- **Scope**: Only the Elevation chart needed this; Hours (`Xh`), TSS, and eFTP
  (`XW`) axes have small 1–3 digit values and do not overflow.

### Files Changed
- `src/App.jsx` — Elevation chart Y-axis `tickFormatter`
- `CHANGELOG.md` — this entry

---

## Session 14 - Progression Level Decay + Zone Trickle (2026-02-16)

### Feature 1: Zone Decay
- **New constant**: `ZONE_ADJACENCY` — one-hop neighbor map for each zone (20% factor)
- **New module-level function**: `applyDecay(levels, lastWorkedDates)` — computes decay without mutating stored state
- **New state**: `lastWorkedDates` (`{ zoneId: 'YYYY-MM-DD' }`) — tracks when each zone was last directly trained
- **Derived state**: `effectiveLevels` (useMemo) — `applyDecay(levels, lastWorkedDates)`. This is what's shown in bars and used for new workout calculations. `levels` remains the raw/base value.
- **Decay rules**: 14-day grace period, then −0.1/week. VO2max and Anaerobic decay 1.5× faster. Floor: `max(1.0, level × 0.5)`. Recovery zone excluded. Zones with no `lastWorkedDate` never decay.
- **Progression bars**: Show effective (decayed) level in bar fill and number. Ghost bar (20% opacity) shows raw pre-decay level when decayed. "↓ Xd idle" badge in gray when decayed.
- **`handleLogWorkout`**: Uses `effectiveLevels[zone]` (not raw `levels`) as starting point for new level calculations — users start from their current fitness.
- **`lastWorkedDates` updated**: On new ride log (primary zone only). On edit when zone is assigned/changed. NOT updated by trickle.
- **Reset Levels** (both the action bar button and the FTP-change reset in Profile modal): now also clears `lastWorkedDates`.
- **`handleRecalculateLevels`** (FTP modal): clears `lastWorkedDates`.
- **Persistence**: `lastWorkedDates` added to localStorage save/load, `exportData`, `importData`, `handlePasteImport`, `handleDriveSync` (local payload + pull callback).

### Feature 2: Zone Trickle
- **Trickle logic in `handleLogWorkout` (new ride path)**: When primary zone's level increases, adjacent zones each receive `primaryChange × 0.2` bonus. Cap: skip if adjacent zone already ≥ primary zone's new level. All level changes (primary + trickle) applied in a single `setLevels` call.
- **Trickle stored in ride entry**: `entry.trickleEffects = [{ zone, amount }]` — used for post-log summary display.
- **Post-log summary modal**: New section "Trickle bonus to adjacent zones" lists trickled zones and amounts (e.g. "Sweet Spot ~+0.10 (from Threshold workout)").
- **Progression bars**: Trickle badges shown with `~` prefix and lighter green (`text-green-500 / bg-green-900/30`) to distinguish from direct-work badges.
- **Trickle does NOT**: reset decay clock for adjacent zones; apply on negative/zero primary changes; push adjacent above primary zone's new level; apply in edit path.

### Files Changed
- `src/App.jsx` — all feature code
- `ARCHITECTURE.md` — new constants, state, functions, persistence
- `CHANGELOG.md` — this entry

---

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

---

## Session 11 - Form Redesign, Rider Type, Date Fixes & UX (2026-02-09)

### Date Formatting
- Day of week appended to all dates in Ride History and Copy for Claude (e.g., `2026-02-05 - Thursday`)
- **UTC timezone bug fix**: Replaced all `toISOString().split('T')[0]` calls (10 instances) with `toLocalDateStr()` helper using local `getFullYear/getMonth/getDate`. Prevents wrong-day display in US timezones.

### Copy for Claude Enhancements
- Added: FTP, W/kg, eFTP, Days to Event, Training Status label
- Added: 28-day TSS, weekly training hours (past 4 weeks with ride counts)
- Added: Indoor/Outdoor ride type per workout; zone hidden for outdoor rides
- Removed word "status" from closing prompt to avoid confusion with app-defined Training Status

### Log Ride / Edit Workout Form Redesign
- **New layout**: Ride Name | Date → Ride Type | Completed All Intervals → Primary Zone | NP → Duration | Distance | Elevation → eFTP | RPE → TSS/IF → Notes
- **Conditional fields**: Outdoor greys out Primary Zone & Completed All Intervals (zone saves as `null`); Indoor greys out Distance & Elevation (zeroed on save)
- **eFTP field** now in both Log Ride and Edit Workout (was edit-only); defaults to latest eFTP from history
- **Elevation field** added (uses same data field as CSV imports)
- **RPE restructured**: Removed Expected RPE box; renamed Actual RPE to "RPE: X (Expected Y)"
- **Yesterday link removed**; default date is today
- **Modal closes immediately** on Save Workout (post-log summary still appears as overlay)
- Shared `getDefaultFormData(history)` helper for all form resets

### Ride History Updates
- Title row now shows `Name - Indoor/Outdoor - Zone` (indoor) or `Name - Outdoor` (outdoor)
- "Needs classification" flag hidden for outdoor rides

### Header & Fitness Progress
- Added W/kg display: `FTP: 235W • 3.2 W/kg • eFTP: 241W`
- Days to Event moved from header to Fitness Progress card: `Days to Event: X | CTL Target: 80-100`

### Rider Type (NEW)
- Phenotype algorithm based on Power Skills radar data (Sprint/Attack/Climb percentile averages)
- 6 types: Sprinter, Puncheur, Rouleur, Time Trialist, Climber, All-Rounder
- Color-coded "Rider Type: X" button in Power Skills card header (w-2/5, matches power bars width)
- Click opens modal with plain-text explanation, category scores, and methodology

### Modal UX
- All 11 modals now close when clicking outside the popup (backdrop `onClick` + `stopPropagation` on inner content)

### Elevation Chart
- Changed from weekly (20-week) to monthly (rolling 12-month window), matching eFTP chart pattern
- Aggregates elevation per calendar month with `calculateMonthlyElevation()`
- Ride count tooltip only counts rides with elevation > 0

### Files Changed
- `src/App.jsx` — all feature code
- `ARCHITECTURE.md` — updated for session 11 changes
- `CHANGELOG.md` — this entry
- `FEATURES.md` — Rider Type marked completed

---

## Session 13 - CTL/ATL/TSB Card Update Bug Fix (2026-02-15)

### Critical Bug Fix: Training Load Cards Not Updating
- **Symptom**: CTL, ATL, TSB cards showed stale values after logging rides — neither outdoor nor indoor rides caused any change
- **Root cause**: UTC timezone parsing bug in `calculateTrainingLoads()`. `new Date("YYYY-MM-DD")` parses as midnight UTC, which in US timezones (e.g. Mountain Time, UTC-7) becomes the previous evening (~5PM local). The EMA loop walked day-by-day starting from this 5PM timestamp, and when it reached today's date at 5PM local, the loop condition `currentDate <= today` failed because the current time was earlier (e.g. 10AM). Result: today's rides were completely invisible to CTL/ATL/TSB.
- **Fix**: Added `parseDateLocal(dateStr)` helper that parses "YYYY-MM-DD" as local midnight via `new Date(y, m-1, d)`. Applied across all date comparisons in the app.
- **Scope**: Same UTC bug affected weekly/monthly chart data, insights, Training Summary, imports, and event countdown — all fixed

### New Utility Function
- `parseDateLocal(dateStr)` — module-level helper alongside `toLocalDateStr()`. Parses "YYYY-MM-DD" strings as local midnight instead of UTC midnight.

### Files Changed
- `src/App.jsx` — parseDateLocal helper, all date comparison fixes
- `CHANGELOG.md` — this entry

---

## Session 12 - GitHub Pages Deployment (2026-02-12)

### GitHub Pages Setup
- **Vite base path**: Set `base: '/cycling/'` in `vite.config.js` for subfolder deployment
- **PWA paths**: Updated `scope` and `start_url` to `/cycling/`
- **GitHub Actions workflow**: `.github/workflows/deploy.yml` — auto-builds and deploys on push to `main`
  - Uses `actions/configure-pages@v4`, `upload-pages-artifact@v3`, `deploy-pages@v4`
  - Includes build verification step (`ls dist/ && head dist/index.html`)
  - Supports manual trigger via `workflow_dispatch`
- **Live URL**: `https://caseywalrath.github.io/cycling/`
- **`main` branch created**: First time repo has a `main` branch; set as default, all `claude/` branches merge into it

### Files Changed
- `vite.config.js` — base path, PWA scope/start_url
- `.github/workflows/deploy.yml` — new file
- `ARCHITECTURE.md` — deployment docs
- `CHANGELOG.md` — this entry
