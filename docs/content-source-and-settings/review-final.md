# Content source and settings, final — Code Review

**Approve with changes.** 0 CRITICAL · 0 HIGH · 3 MEDIUM · 7 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/content-source-and-settings` at `4b1d3d8` + uncommitted work over `main` (`2cb16dc`) · 152 files, +10,266 −3,087 (migration snapshots left out) · 2026-10-17 |
| Reviewed against | security · security-web · security-llm · performance · CLAUDE.md · `tailwind-v4-best-practices (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` · DESIGN.md / globals.css (grep, tokens only) · the four briefs since review-2 |
| Scans | secrets N/A (gitleaks not installed) · dependencies N/A (no manifest or lockfile change) · code N/A (semgrep not installed) |
| Not applicable | `fdd-architecture`, `vercel-composition-patterns` (not loaded, per dispatch) |
| Failed to load | none |
| Read outside the diff | 12 — listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`, `security-llm.md`) | A | — | — |
| Performance | B | MEDIUM · `layout.tsx:93` · a road built per roadmap | build only unnamed roadmaps |
| CLAUDE.md | A | LOW · `OutlineStep.tsx:349` · px in arbitrary value | optional |
| tailwind-v4-best-practices | A | — | — |
| vercel-react-best-practices | B | MEDIUM · `useRoadSession.ts:281` · timers outlive the board | clear timers on unmount |
| Quality (tests, accessibility, state) | B | MEDIUM · `ImagesStep.tsx:356` · slide and tab reset per save | hold them above the version key |
| Criteria | A | 1 manual (7) | — |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | Both starts offered, blog chosen; idea with an idea or on New blog | `SourceForm.test.tsx:263`, `:270` | covered |
| 2 | From a blog, "Make post" makes a feed post | `SourceForm.test.tsx:283` | covered |
| 3 | From an idea: blog first, or straight to the post | `SourceForm.test.tsx:371` | covered |
| 4 | Language, framing, notes, page in either start | `SourceForm.test.tsx:361`, `:371` | covered |
| 5 | Selected slide over a filmstrip, arrow keys, position announced | `stage.test.tsx:47`, `:61`, `:68`, `parts.test.tsx:157` | covered |
| 6 | Panels as tabs, "Fix" badge, fields under headings | `SettingsForm.test.tsx:385`, `:426` | covered |
| 7 | "Send to review" right-most | `SettingsForm.test.tsx:456` (in the bar), smoke | not automatable |
| 8 | Badge; reason on hover or focus; announced | `parts.test.tsx:61`, `:88` | covered |
| 9 | Several Instagram accounts and LinkedIn | `LivePanel.test.tsx:584`, `social.test.ts:597` | covered |
| 10 | Toast text; shares listed with who | `LivePanel.test.tsx:584`, `:607`, `:641` | covered |
| 11 | None ticked: Share unavailable, says why | `LivePanel.test.tsx:621` | covered |

`social.test.ts:597` and the new database tests (`commands.test.ts` default theme and draftChoices, `store.test.ts` notes, `store-backed.test.ts` refused) run only with `DB_TESTS=1`; this review did not run them.

## Read outside the diff
- `node_modules/drizzle-orm/pg-core/dialect.js:60`, `scripts/migrate.ts` — every pending migration runs in one transaction; `_journal.json` lists 0026 and 0027 with rising `when`; `origin/main` stops at 0025.
- `shared/lib/auth/access.ts:169` — `canSeeBoard` is editor, reviewer or admin: the slides route refuses students and signed-out visitors.
- `admin/(console)/assets/[id]/route.ts:13` — the asset route serves the same PNGs under the same gate: the zip leaks nothing new.
- `content/server/store.ts:152` — `getAssets` is capped by `ASSETS_LIMIT`.
- `content/lib/workflow.ts:297` — `live` is in `MOVES_BACK_FROM`: a wording fix from a live post moves it back, exactly as `editSlot` already does.
- `content/server/commands/shared.ts:117` — a move back keeps the published version (criterion 116) and the source check id, so the claim index still resolves.
- `StructuresStep.tsx:274` — `claimsOf` is the record's full claim array: the wording fix's index matches the server's.
- `Workbench.tsx:206`, `:285–291` — every step screen is keyed `${step}-${version}`.
- `content/server/commands/images.ts:525` — each picture drawn is saved, so the version changes per picture.
- `app/(app)/roadmaps/page.tsx:73`, `roadmaps/server/roadmaps.ts:36` — the list page already builds a road per roadmap; the list is capped at 200.
- `road/model/scene.ts:47` — `choicesFrom` saves `country` with every other choice.
- `app/(app)/roadmaps/[id]/layout.tsx:100–111` — compare (and `next`) only with `COMPARE_ON`; the option and job tiles and their details are built whatever the flags.

## Findings, by file

### `src/features/content/components/steps/ImagesStep.tsx`

**MEDIUM · line 356 · the selected slide and tab reset on every save**
- What: `selected` and `open` live inside the screen keyed by version (`Workbench.tsx:206`), and a drawing saves once per picture, so slide 1 and "This slide" come back each time a picture lands, a nudge or scene edit saves, or a reorder runs. `RenderStep.tsx:295`, `LivePanel.tsx:347` and `ReviewPanel.tsx:128` do the same: after Share, the panel jumps to Details and the new share is out of sight.
- Why: The Images step's draw is the demo's showpiece; an editor on slide 5 is pulled back to slide 1 every 20 seconds, and criterion 10's list is hidden right after sharing.
- Rule: Quality, state that survives a save (GD24, and `Workbench.tsx` holds Text and Settings this way) · a test would have caught it: yes, rerender with `version + 1` and assert the selected thumbnail and open tab.
- Fix: Pass `slide` and `tab` (the existing `TabHold`) from Workbench to Images, Render, Review and Live, as Text and Settings already get them.

### `src/features/road/hooks/useRoadSession.ts`

**MEDIUM · line 281 · the start-new timers outlive the board**
- What: `startNew` sets two `setTimeout`s that are never cleared, so a student who leaves during the 1–2 s animation (the breadcrumb, Back, a roadmap in the drawer) is still pushed to `/roadmaps/new?…`. `leaving` is never reset, and `openAnswers` is not blocked while leaving.
- Why: An unexpected navigation in front of judges, and a board that ignores presses if the push does not land.
- Rule: `vercel-react-best-practices` (effects own their cleanup); performance §3 · a test would have caught it: yes, unmount before the hold ends and assert `router.push` was not called.
- Fix: Keep the timer ids in a ref and clear them in an unmount effect (or run the sequence in an effect keyed on the start); block `openAnswers` while leaving.

**LOW · line 133 · the first-arrival spot is saved only if another choice is**
- What: `settled` now carries `country: true`, which `choicesFrom` writes with the next saved choice, but not on its own (the test says ending the arrival saves nothing).
- Why: Her next visit opens at her country after a swap on the first visit, and at her course without one.
- Rule: Quality, consistent state · a test would have caught it: yes, first visit, press, swap, then `sessionFrom(saved)`.
- Fix: Decide where a second visit opens and make it one rule: drop `country` from the save after the arrival, or save it when the arrival ends.

### `src/app/(app)/roadmaps/[id]/layout.tsx`

**MEDIUM · line 93 · a whole road built per roadmap to name the drawer**
- What: Every board load runs `roadFor` (match, compose, `buildRoad`, now with the option tiles) for each listed roadmap, up to `LIST_MAX` 200, though only `roadNames` is read, and not even that when the roadmap has its own name.
- Why: The cost grows with her roadmaps on the busiest student page; the list page pays it already, now the board does on each load and refresh.
- Rule: `performance.md` §1, §2 · a test would have caught it: no.
- Fix: Build only when `r.name` is null, or keep a computed name on the roadmap row; the drawer needs the name alone.

### `src/shared/lib/db/migrations/0026_content_artifact_share.sql`

**LOW · line 2 · `NOT VALID` buys nothing inside drizzle's transaction**
- What: Review 1's fix splits the check into `NOT VALID` then `VALIDATE`, but drizzle runs every pending migration in one transaction, so the scan still happens under the `ACCESS EXCLUSIVE` lock the `DROP`/`ADD` took.
- Why: Harmless at today's table size (and correct), but the comment-level promise of a lighter lock is not kept.
- Rule: `performance.md` §4 · a test would have caught it: no.
- Fix: Leave it; run the migrations job before traffic moves to the new revision (the new code reads `ai_call.refused`), which smoke.md already says.

### `src/features/content/ai/client.ts`

**LOW · line 1016 · the image backoff ignores the caller's abort**
- What: The image retry loop waits with `sleep(wait)`; the JSON loop uses `pause(wait, req.signal)`.
- Why: A cancelled image call can keep waiting up to the 60 s budget and reserve another slot.
- Rule: `performance.md` §3 · a test would have caught it: yes, abort mid-wait and count the calls.
- Fix: Use `pause(wait, req.signal)` and stop the loop when it returns false.

### `src/features/road/components/RoadCard.tsx`

**LOW · line 284 · `aria-description` for the place**
- What: "Back to where you are" carries the place in `aria-description` (also `PhoneMap.tsx:79`), an ARIA 1.3 draft attribute many screen readers skip.
- Why: The place the old label named may not be heard.
- Rule: WAI-ARIA 1.2 · a test would have caught it: no.
- Fix: An `sr-only` span inside the button ("Back to where you are, Cyber Security"), or `aria-describedby` on a visible second line.

### `src/features/content/components/steps/OutlineStep.tsx`

**LOW · line 349 · px inside an arbitrary value**
- What: `max-h-[calc(2lh+0.5rem+2px)]` adds 2px for the borders.
- Why: CLAUDE.md keeps px to hairlines and icons; this one is two hairlines, arguably within it.
- Rule: CLAUDE.md, rem not px · a test would have caught it: no.
- Fix: Keep it with a comment naming the two 1px borders, or let `field-sizing` and `rows={2}` bound it.

### `src/features/content/components/steps/StructuresStep.test.tsx`

**LOW · line 471 · a class asserted**
- What: The criterion-29 test pins `auto-cols-[minmax(12rem,1fr)]` (and `toHaveClass('min-w-0')` further down); the value was changed here to follow the new layout.
- Why: Tests the beauty; every restyle edits the test.
- Rule: CLAUDE.md, test the brain not the beauty · a test would have caught it: n/a.
- Fix: Delete the class lines; the side-by-side rule is a smoke check.

### `docs/content-source-and-settings/smoke.md`

**LOW · line 86 · "Check results (first …)" no longer true**
- What: Step 11 still lists Text's "Check results" first; step 13 and the code put "Checks" last. `text/ChosenVersion.tsx:212` says "Check results" too.
- Why: Whoever runs the smoke will think the build is wrong.
- Rule: Criteria pass, docs match the build · a test would have caught it: no.
- Fix: "Text: Your version · Versions · Style · Redraft · Checks (n to fix)", and "Checks" in the comment.

## Top 3 priority fixes
1. `ImagesStep.tsx:356` (and Render, Review, Live) — hold slide and tab above the version key.
2. `useRoadSession.ts:281` — clear the start-new timers on unmount; block answers while leaving.
3. `layout.tsx:93` — build a road only for roadmaps with no name.

## Done well
- The slides route is a careful copy of its siblings: the board gate before any read, the id bounded, feed kind and render checked, every asset required, `private, no-store`, a slugged filename, and seven route tests including the refusals.
- The new board data stays on the server: options, jobs, visas and the next road are built from the catalogue in the layout and passed by tile id; compare's pin and the morph are only drawn with `COMPARE_ON`, and `withStart` strips a primary that could only start one.
- The morph is pure and tested frame by frame (`start.test.ts`), uses the browser's frames with a timer to end it and a cleanup, respects reduced motion, and skips itself on the phone's Road view.

## Built but not asked for
- The whole student-board half (commit `4b1d3d8` and the tiles, small and anim briefs), Download slides, the skippable Blog step, the Checks tab, the board scrolling inside itself, the Gemini busy handling and daily-limit lines, and combining up to four ideas: none is in intent.md's eleven criteria. Say so in the PR text, or split the student board into its own.

## Blind spots
- Not run here: `bun run type-check`, `bun run lint`, the unit suite, and the database suites (`DB_TESTS=1 DATABASE_URL=… bash scripts/capped.sh bun test` on `server/commands.test.ts`, `server/store.test.ts`, `server/social.test.ts`, `ai/store-backed.test.ts`, `server/images.test.ts`).
- Deploy tomorrow: many new files are untracked (the slides route, `stage.tsx`, `CheckResults.tsx`, `RouteDetail.tsx`, `RoadmapDrawer.tsx`, `start.ts`, `options.ts`, `next-road.ts`, `wait-notes.ts`, `limits.ts`, `share.ts`, migrations 0026/0027 and their snapshots); `git status` before the commit. Run the migrations job before switching traffic, and check Cloud Run has `AI_DAILY_CAP_IMAGE` and `AI_DAILY_CAP_PRO` set: unset, they refuse every image and Pro call.
- The no-scroll fit, the board's inner scroll and the morph's smoothness are visual: screenshots at the listed widths and one run on a slow laptop.
- Screen-reader behaviour of the tooltips, tabs and filmstrip was judged by reading only.

---
Stack: TypeScript, React 19 / Next.js App Router (route handlers, server actions, layouts, `after()`), Tailwind 4 container queries, Radix Sheet (shadcn), zod, Drizzle migrations on Postgres, Gemini prompts via Vertex, bun test with happy-dom, Playwright specs. Passes applied shallowly: accessibility and animation timing judged by reading; no database or browser run.

## Applied (18 Oct 2026, the developer said "fix all valid")
- MEDIUM slide and tab reset on save: Workbench holds the selected slide and each step's open tab above the version key (`useHolds`, `SlideHold`, stage.tsx) and passes them to Images, Render and Review; Live keeps its tab (Share stays open after a share). Tests rerender with version + 1.
- MEDIUM start-new timers: kept in a ref and cleared on unmount; presses and Your answers blocked while leaving; `leaving` reset when the push fires. Tests: unmount before the hold, Your answers during the morph.
- MEDIUM drawer names: `drawerNames` builds a road only for a roadmap with no name of its own (tested by the builder's calls).
- LOW first arrival: ending it saves her spot once (`country: true`), so her next visit opens where she stood (tested, with the second visit).
- LOW image retry: waits with `pause(wait, signal)` and stops when aborted (no caller passes a signal yet).
- LOW `aria-description`: replaced by an sr-only name, "Back to where you are, <place>".
- LOW OutlineStep 2px: kept, the comment names the two 1px hairlines (`field-sizing` ignores `rows`, so `max-h` is the only bound).
- LOW class assertions in StructuresStep.test.tsx removed; LOW smoke.md step 11 and ChosenVersion's comment say "Checks".
- Left, as the finding itself advises: migration 0026's `NOT VALID` (harmless; already applied on dev databases).
- Follow-up, not done: BlogImagesStep's slide and tab still reset on save (no fixture yet).
- Results: unit suite 4,435 pass, 0 fail; type-check and lint clean; content and roadmaps DB suites pass on a fresh database with 0026 and 0027.
