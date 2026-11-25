# BECOMING v0.3

**Personal Life OS & Intelligent Companion Team**
_Less reading. Less deciding. More becoming._ · Build Trust. Build Business. Build Freedom.

A mobile-first PWA (Thai-first UI) for an ambitious mother and founder whose days are unpredictable. It picks **one meaningful thing** for the time and energy she actually has, re-plans when life interrupts (Rescue Mode), and uses unexpected free minutes well (Opportunity Window).

**Live app:** https://natnabyrinrise.github.io/becoming/

## Use it on a phone
1. Open the live link in Safari (iPhone) or Chrome (Android).
2. Share → **Add to Home Screen** (iPhone) / ⋮ → **Install app** (Android).
3. It opens full-screen like an app and the shell works offline.

> Data is stored **only in that browser on that device** (localStorage). Nothing is sent to a server. Clearing site data or switching devices loses it — use **Settings → สำรองข้อมูล (JSON)** regularly, and **นำเข้าข้อมูล** to move data to another device.

## Run locally
```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # Vitest (engine + store acceptance scenarios)
npm run typecheck  # tsc -b
npm run lint       # oxlint
npm run build      # production build in dist/
npm run preview    # serve the build
```
Requires Node 20+.

## Features
| Area | What works |
|---|---|
| Onboarding | Name, wake/sleep, work time, family commitments, primary business (or undecided), mission priorities, reminders, reward preferences. Skippable. |
| Home — My Universe | Becoming Orb (evolves with XP, glows with today's progress), journey day, energy, progress ring, One Thing status, one companion message, 4 quick actions. |
| Morning Briefing | Energy orb (0–100), mood, sleep, available time → Today's Reality → One Thing (accept / replace / pick yourself / start). |
| My Day | Fixed vs flexible vs anchor-based blocks; create, edit, delete, complete, skip, reschedule today, reorder, daily/weekly/one-off; conflict prevention. |
| Focus Mode | Orb timer from timestamps (survives refresh), pause/resume/complete/exit, overtime prompt: continue / break / reduce scope / stop & reschedule. |
| Rescue Mode | Reason → remaining time → energy → proposed plan (revised One Thing, protected, rescheduled, before/after) → confirm → undo latest. |
| I Have a Moment | 5–120 min → energy → one fitting task or recovery → start / another / dismiss. |
| My Team | Orbital constellation + list view; J, Atlas, Muse, Bloom, Spark with start / later / change / dismiss / details. Rule-based, labelled as such. |
| Smart Follow-up | Overdue high-priority, repeatedly postponed, stalled projects, missed routines, over-estimate tasks, saved content ideas; snooze/dismiss; quiet hours. |
| Founder Mode | Primary business + milestones + micro-tasks, supporting projects, Idea Inbox, Personal Brand content, Partnership pipeline, AI Company prototype tracker (10 roles, all start "planned"), Revenue tracker. |
| Rewards | XP + coins with idempotent transactions, levels, Mystery Gift (unlocked by One Thing), personal rewards, Comeback Bonus, My Sanctuary (SVG home that grows). |
| Reflection | Evening Debrief (3 questions + J summary + tomorrow's One Thing), Journal (CRUD, search, tags, type & date filters, optional voice where supported), Weekly Board Meeting. |
| Growth | Mission planets, energy wave, focus bars, routine balance, revenue by month, gamification shown separately — no combined "life score". |
| Data | JSON export, import with preview + per-collection validation, confirm before overwrite, reset with typed confirmation, corrupted-storage recovery, versioned persistence. |
| PWA | Manifest, icons, offline shell service worker. |

## Architecture
```
src/
  app/            App shell, routes (HashRouter → works on GitHub Pages)
  components/     ui/, graphics/ (Orb, rings), companions/ (SVG avatars), navigation/
  features/       one folder per screen
  engine/         pure domain logic, no React
    recommendations/  deterministic recommender + RecommendationProvider interface
    scheduling/       day resolution, conflicts, Rescue plan/apply/undo
    rewards/          awardOnce (dedupe by sourceEventId), levels, sanctuary
    follow-up/        smart follow-up rules
  store/          Zustand store (persisted domain), useUI (temporary UI), backup/migrations
  types/          typed models + Zod schemas
  services/       future-integration adapter interfaces
  tests/          Vitest acceptance tests
```

### Recommendation engine (deterministic)
Filters done/blocked/dependency-waiting tasks → keeps those that fit the window → scores by priority, mission order, primary business, in-progress, postponements, window fit, energy band and circumstances → returns one task + companion + short reason, or a clearly labelled smaller step, or recovery. Energy < 30 → recovery; 30–49 → low-effort only (thresholds configurable).

## Tests
`npm test` covers acceptance scenarios A (normal morning), B (childcare rescue), C (0 minutes), D (low energy), E (5-minute window), F (reward integrity), G (return after inactivity), H (persistence across refresh), I (focus timer across refresh), J (rescue undo), L (backup round-trip + invalid record rejection), plus corrupted storage and routine conflicts. Scenario K (responsive) was checked with Playwright at 390 / 820 / 1440 px — no horizontal overflow, no runtime errors.

## Known limitations
- Data is per-device/per-browser; no sync yet.
- Companions are rule-based, not AI agents.
- Browser notifications only fire while the app is open; no background push (iOS especially).
- Voice input in Journal depends on the browser's Web Speech API (mostly Chrome/Android).
- Weekly recurrence uses the weekday it was created on; no custom multi-day patterns yet.
- Rescue "undo" covers the latest confirmed rescue only.
- Fonts load from Google Fonts; offline it falls back to system fonts.

## Future integrations
Adapter interfaces live in `src/services/integrations.ts`: Notion, Google Calendar, AI recommendations (same shape as the local engine), Supabase sync, voice, push, health data. None are connected; the Settings screen marks them "not connected". API keys must live in a backend/edge function, never in this bundle.

## Assumptions
- Asia/Bangkok default timezone (editable).
- Starter data (AI Company project, tasks, routines) is editable sample content, not recorded achievements.
- XP awards: One Thing 50, health/family routine 20, brand 15, debrief 15, rescue bonus 30, comeback 25, other tasks 10 — all editable.
