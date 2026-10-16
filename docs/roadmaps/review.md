# Your roadmaps, part 1 (data, routes, the list and the loader): Code Review

**Request changes.** 1 CRITICAL · 3 HIGH · 7 MEDIUM · 4 LOW

| | |
| --- | --- |
| Blocking | CRITICAL `roadmaps.ts:93`: a new roadmap sorts last, not first (criterion 9) |
| | HIGH `profile.ts:36`: any onboarding write after the lock silently starts a new roadmap |
| | HIGH `roadmaps.module.css:91`: dialog actions can't be reached when the dialog is taller than the screen |
| | HIGH `NewRoadmapDialog.tsx:6`: imports opening's internals; opening and roadmaps depend on each other |
| Branch | `feat/roadmaps` at `7049e75` over `origin/dev` (`5ecceb4`) · 89 files, +5344 −3519 (bun.lock, snapshots and reference left out) · 2026-10-15 |
| Reviewed against | security · security-web · performance · CLAUDE.md + AGENTS.md · `fdd-architecture (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` |
| Scans | secrets clean · dependencies 0 new, 2 pre-existing (braces high, esbuild moderate; package.json unchanged) · code clean (semgrep p/owasp-top-ten) |
| Not applicable | security-llm (no model calls) · tailwind-v4-best-practices (CLAUDE.md rules suffice) · vercel-composition-patterns (not dispatched) |
| Failed to load | none |
| Read outside the diff | 8, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | LOW · `0003_roadmaps.sql:27` · migrated roadmaps show as New | optional |
| Performance | B | MEDIUM · `actions.ts:124` · read thrown away | make step 3 real work |
| CLAUDE.md | C | HIGH · `profile.ts:36` · lock bypassed by writes | refuse writes once closed |
| fdd-architecture | C | HIGH · `NewRoadmapDialog.tsx:6` · deep import, feature cycle | move paths to shared |
| vercel-react-best-practices | A | LOW · `RoadBoard.tsx:7` · barrel for one helper | optional |
| Quality | C | HIGH · `roadmaps.module.css:91` · unreachable dialog actions | let the dialog body scroll |
| Criteria | C | CRITICAL · `roadmaps.ts:93` · criterion 9 contradicted | new roadmaps sort first |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | Roadmap record, many, first on finishing, choices kept | `server/roadmaps.test.ts:53`, `:164`; `RoadBoard.test.tsx:764` | covered |
| 2 | Never ranked; three orderings | `model/roadmap.test.ts:42`; `server/roadmaps.test.ts:95` | covered |
| 3 | `/roadmaps` landing, `/roadmaps/:id` board, `/road` redirect | `landing.test.ts:86`; `redirect.test.ts`; `e2e/routes.e2e.ts:120` | covered |
| 4 | Start from scratch → 00 → a new roadmap | `actions.test.ts:200`; `RoadmapsPage.test.tsx:333`; `profile.test.ts:82` | covered |
| 5 | Header, menu item first, title, lead, button, footnote | `AccountMenu.test.tsx:71`; `RoadmapsPage.test.tsx:139` | covered (lead, menu); rest smoke |
| 6 | Cards: order, grid, contents, whole card opens | `RoadmapsPage.test.tsx:115`; `model/roadmap.test.ts:91` | covered; grid by screenshot |
| 7 | "…" menu: Open, Copy, Rename (60), Delete, toast, Undo | `RoadmapsPage.test.tsx:217`, `:280`; `server/roadmaps.test.ts` | covered |
| 8 | New roadmap dialog | `RoadmapsPage.test.tsx:333` | covered |
| 9 | New roadmap first, 2px border, New tag, ready toast | `RoadmapsPage.test.tsx:406`; `server/roadmaps.test.ts:95` | contradicted |
| 10 | Dialogs: Escape, Cancel, trap, focus return | `RoadmapsPage.test.tsx:392`, `:217` | covered (trap is Radix's) |
| 11 | The loader | `RoadmapLoader.test.tsx:76`; `loader.test.ts`; `DoneScreen.test.tsx:93` | covered; reduced motion by smoke |
| 33 | First-time flow (part 1's leg) | `DoneScreen.test.tsx:93`; `e2e/routes.e2e.ts:120` | not automatable end to end |
| 35 | Rename, delete + Undo, last-opened order, no leak | `server/roadmaps.test.ts:105`, `:164`; `RoadmapsPage.test.tsx:280` | covered |

Row 9: the tag, border and toast are built, but `listRoadmaps` puts every never-opened roadmap after the opened ones, and `server/roadmaps.test.ts:95` pins that order. A second roadmap made from scratch therefore lands last, not first.

## Read outside the diff
- `node_modules/next/dist/docs/01-app/02-guides/prefetching.md:31`: without a `loading.js` boundary, dynamic routes aren't prefetched and `next.config.ts` has no cacheComponents. So the list's links never run the `[id]` layout's `after(touchOpened)`, and seeing a card doesn't clear its New tag.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md:46`: `router.refresh()` clears the client cache for the current route only.
- `node_modules/next/dist/docs/01-app/04-glossary.md:47`: pages are reused on back/forward navigation.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/refresh.md`: the server `refresh()` refreshes the client router; the old finish action called it.
- `git grep` of deep cross-feature imports at `5ecceb4` and HEAD: before this branch only app pages and admin import auth's components; `NewRoadmapDialog.tsx:6` is the first deep import of one feature's model by another.
- `docker-compose.yml:6`: postgres:17-alpine, so the migration can use `gen_random_uuid()`.
- `docs/roadmaps/reference/logic/roadmaps.js:81`, `roadmaps-template.html:104`: the reference sorts the opened one to the top; "Keep it" is the reference's own label.
- `src/features/road/components/RoadHeader.tsx`: the list page's header isn't a copy of it.

## Findings, by file

### `src/features/roadmaps/server/roadmaps.ts`

**CRITICAL · line 93 · criterion 9 contradicted**
- What: `lastOpenedAt desc nulls last` sorts a never-opened roadmap after all opened ones. A roadmap made from scratch (or, in part 4, by copying) therefore lands at the end of the list, while its "New" border and "ready" toast point to it.
- Why: criterion 9 says a newly made roadmap is first in the list. `orderRoadmaps('opened')` (`model/roadmap.ts`) has the same rule, and `server/roadmaps.test.ts:95` and `model/roadmap.test.ts:42` assert it.
- Rule: intent criterion 9 · a test would have caught it: yes, one built from the criterion's wording (one opened roadmap plus one just made: the new one comes first).
- Fix: order by `coalesce(last_opened_at, created_at) desc` (or `nulls first`, then `created_at desc`), do the same in `orderRoadmaps`, and change both tests.

### `src/features/opening/server/profile.ts`

**HIGH · line 36 · the lock bypassed by a write**
- What: `writeDraft` calls `ensureDraft`, so once onboarding is closed, `saveAnswers`, `saveCoins` and `saveRelative` each create a new unfinished roadmap. Only `markStep` checks `onboardingClosed`. Three things can trigger it: a stale onboarding tab, another device, or Back to a cached step (see `DoneScreen.tsx:64`).
- Why: the new draft reopens onboarding without her asking, every `/roadmaps/[id]` board then redirects her into onboarding, and "Start from scratch" refuses her. The decision says only Start from scratch opens a new roadmap. `profile.test.ts:149` asserts the opposite behaviour.
- Rule: intent "Decisions" (the lock) · CLAUDE.md student URLs · a test would have caught it: yes, a database test of a write after finishing.
- Fix: in `writeDraft`, make a draft only while `finished === 0`; once closed, write nothing and have the action return a refusal. Change the test at line 149 to match.

### `src/features/roadmaps/components/roadmaps.module.css`

**HIGH · line 91 · dialog actions out of reach**
- What: the dialogs set `max-height: calc(100% - 2rem)` with `overflow: visible`. A dialog taller than the screen spills past both edges while Radix locks page scroll. That happens on a phone in landscape, at 200% zoom, or with about 7 roadmaps listed under "Copy which roadmap?" on a 390×844 phone.
- Why: Cancel and the primary button are off-screen with no way to scroll to them, so a keyboard or zoom user is stuck in the dialog.
- Rule: FDD a11y principle · CLAUDE.md screen widths · a test would have caught it: no, it is a layout check (a screenshot at 844×390).
- Fix: keep the frame marks on the outer box and give an inner body `overflow-y: auto`, or limit the height of the roadmap list and let it scroll.

### `src/features/roadmaps/components/NewRoadmapDialog.tsx`

**HIGH · line 6 · feature boundary**
- What: the dialog imports `PICTURE_PATH` from `@/features/opening/model/onboarding`, reaching past the barrel to avoid a cycle. `ROADMAPS_PATH` is defined twice (`opening/model/onboarding.ts:237` and `roadmaps/model/roadmap.ts`). opening and roadmaps now import each other (DoneScreen → roadmaps; dialog and actions → opening).
- Why: no import cycle runs through the barrels any more, but the two features are coupled both ways, and a duplicated path constant can drift.
- Rule: `fdd-architecture` §2 Public API Boundary, §5 rule of three · a test would have caught it: no, a convention.
- Fix: three features use the student paths (opening, road, roadmaps), so move `ROADMAPS_PATH`, `roadmapPath` and `PICTURE_PATH` to one shared module (e.g. `src/shared/lib/student-paths.ts`) and import them from there.

**MEDIUM · line 166 · Note not used (×3)**
- What: three dialogs each hand-build an error `<p role="alert">` with danger classes: here, `RenameDialog.tsx:78` and `DeleteDialog.tsx:63`.
- Why: notes are the shared `Note` (plan constraints), and three copies of the same markup will drift apart.
- Rule: CLAUDE.md shared components · repetition ×3 · a test would have caught it: no.
- Fix: `<Note tone="limit" role="alert">{error}</Note>` in all three.

**MEDIUM · line 112 · arbitrary value**
- What: `has-checked:shadow-[inset_0_0_0_1px_var(--color-primary)]`.
- Why: a semantic utility for this exists, and arbitrary values bypass the design system.
- Rule: CLAUDE.md semantic tokens · a test would have caught it: no.
- Fix: `has-checked:ring-1 has-checked:ring-inset has-checked:ring-primary`.

### `src/features/road/hooks/useRoadSession.ts`

**MEDIUM · line 62 · saves can land out of order**
- What: each change or Undo fires `saveChoicesAction` without waiting for the one before. If she swaps and then quickly presses Undo, the two requests can arrive in reverse order, and a stale response can also overwrite `saveFailed`.
- Why: the stored choices can end up as the state she undid, so a reload shows a different board from the one she left (criteria 1 and 35).
- Rule: quality · a test would have caught it: yes, a RoadBoard test that holds the first save until after the second.
- Fix: chain saves on a ref'd promise (last write wins in order), or tag each save with a counter and ignore stale results.

### `src/features/opening/components/DoneScreen.tsx`

**MEDIUM · line 64 · Back may show onboarding (unverified)**
- What: `router.refresh()` clears the client cache for the current route only (use-router.md:46), and back/forward reuses cached pages (glossary:47). Back from `/roadmaps` can therefore paint the cached step before "You're all set". The old action's server `refresh()` refreshed the whole router.
- Why: PRODUCT.md promises that Back never shows onboarding again, and a tap on that cached screen triggers the HIGH at `profile.ts:36`.
- Rule: CLAUDE.md student URLs · a test would have caught it: yes, a Back check after the loader (by smoke test; an e2e spec only if asked).
- Fix: in `arrive`, call a server action that calls `refresh()` before `router.replace`. The loader has finished by then, so nothing is cut short.

### `src/features/roadmaps/components/RoadmapsPage.tsx`

**MEDIUM · line 121 · sizes per breakpoint**
- What: `@max-5xl:px-6 @max-xl:px-4 @max-xl:py-6 @max-xl:gap-6` override `px-gutter` and `py-section`, and `gap-8` stands in for `gap-section`. The same pattern appears in `RoadmapLoader.tsx:59` (`text-h3 @max-xl:text-h4`), `RoadmapThumb.tsx:55` (`h-38 @max-xl:h-32`) and `app/(app)/roadmaps/page.tsx:93` (`px-6 @max-5xl:px-4 @max-5xl:min-h-14`).
- Why: the type and spacing roles are already fluid; per-breakpoint overrides fight them.
- Rule: CLAUDE.md "Never a size per breakpoint" · a test would have caught it: no, a convention.
- Fix: use `px-gutter py-section gap-section` alone, one type role, one thumb height. For the grid, `minmax(min(22rem,100%),1fr)` makes `@max-xl:grid-cols-1` unnecessary.

### `src/features/roadmaps/actions.ts`

**MEDIUM · line 124 · read thrown away**
- What: `warmRoadmapsAction` runs `listRoadmaps` and discards the rows; `/roadmaps` then runs the same query again for the page.
- Why: every finish costs an extra read, and step 3 ticks on a throwaway query rather than on "list data loaded" (criterion 11's real work).
- Rule: `performance.md` §2 (the same value fetched twice) · a test would have caught it: no.
- Fix: tie step 3 to the navigation itself (e.g. resolve when the replaced route has rendered), or say in the step's comment that it is a placeholder like step 2.

**LOW · line 89 · only-one check races**
- What: with two roadmaps, two deletes sent at once both pass `finished <= 1` and both succeed.
- Why: she is left with none finished and lands back in onboarding; Undo restores them.
- Rule: quality · a test would have caught it: yes, a DB test with two concurrent deletes.
- Fix: put the count in the update itself (`... and exists (another alive finished roadmap)`).

### `src/features/roadmaps/model/loader.test.ts`

**MEDIUM · line 49 · test bloat**
- What: the test at line 49 asserts the three constants (700, 450, 10000), which `RoadmapLoader.test.tsx` already proves by timing. The step strings checked at line 15 are checked again in `RoadmapLoader.test.tsx` and `DoneScreen.test.tsx`.
- Why: these repeat assertions other tests already make and pin values rather than behaviour.
- Rule: CLAUDE.md "test the brain" · bloat: delete it.
- Fix: delete the test at line 49, and keep the step strings in one place (`loader.test.ts`).

### `src/shared/lib/db/migrations/0003_roadmaps.sql`

**LOW · line 27 · migrated roadmaps look new**
- What: the INSERT leaves `last_opened_at` null, so a student who already used `/road` sees her roadmap tagged New, gets the first-visit lead, and sees the first arrival again. The rest of the SQL is sound: the data moves before the drops, every statement has its breakpoint, and persona, reminders and seen_futures stay on the profile.
- Why: it is a small untruth for existing students. The drops can't be undone (there's no down migration), though no data is lost.
- Rule: `security.md` §6 (destructive migration called out) · a test would have caught it: no.
- Fix: `last_opened_at = onboarded_at` in the SELECT.

### `src/features/roadmaps/hooks/useLoaderRun.ts`

**LOW · line 61 · reduced-motion pause**
- What: under reduced motion the fade becomes a cut, but `onDone` still waits 450 ms, during which nothing changes on screen.
- Why: a short dead pause for exactly the users who asked for less motion.
- Rule: criterion 11 (reduced motion) · a test would have caught it: yes.
- Fix: skip the wait when `prefers-reduced-motion: reduce` matches.

### `src/features/road/components/RoadBoard.tsx`

**LOW · line 7 · barrel for one helper**
- What: the board imports `roadmapPath` from the roadmaps barrel, which also exports RoadmapsPage, the dialogs and the loader.
- Why: the board's client graph carries modules it never renders, unless they are tree-shaken.
- Rule: `vercel-react-best-practices` bundle-barrel-imports · a test would have caught it: no.
- Fix: the shared paths module from the HIGH at `NewRoadmapDialog.tsx:6` removes this import.

## Top 3 priority fixes
1. `src/features/roadmaps/server/roadmaps.ts:93`: sort never-opened roadmaps first (`coalesce(last_opened_at, created_at) desc`), and update both order tests.
2. `src/features/opening/server/profile.ts:36`: once onboarding is closed, make writes refuse instead of starting a roadmap.
3. `src/features/roadmaps/components/roadmaps.module.css:91`: let the dialog body scroll so its actions are always reachable.

## Done well
- Access is tight. Every repository function takes the session's id and filters by owner, finished and alive. The DB test (`server/roadmaps.test.ts:105`) proves another student's roadmap is never read, renamed, opened, saved, copied or deleted. The e2e spec 404s another student's board, and every action refuses admins and accounts with no role.
- The loader is careful. It starts once despite the double mount, guards with an `alive` flag, and `finishOnboardingAction` deliberately doesn't refresh. Tests pin the 0.7 s minimum, the fade, Try again resuming from the failed step, the slow note, the one-time announcements and focus.
- The migration moves the data before dropping the columns, and a partial unique index makes "one roadmap being answered" a database guarantee rather than a hope.

## Built but not asked for
- `copyRoadmap` and `orderRoadmaps('made' | 'name')`: no caller in part 1. The plan puts them here for part 4, and copy has a database test.
- Walking back to the country (`scene.ts` `toCountry`, `press.ts`, commit `9474dc4`): a road fix carried on this branch.
- The deletion of `docs/timeline-board/` (the old board reference and handoff, about 2,500 lines).
- Shared extractions: `Toast` and `Pond` moved to shared, `useMenuKeys` taken out of AccountMenu, and the shared Dialog's entrance changed (it is now right for the admin's dialogs too).

## Blind spots
- The criterion 9 order: a test written from the criterion's text (opened plus new: the new one first) would have caught it; the existing test was written from the plan.
- A write after the lock: a profile DB test ("after finishing, `saveCoins` starts nothing") would have caught it.
- Back after the loader: only a browser check catches it (the smoke test's step 5, or a Back assertion in the standing routes spec if asked).
- Dialog overflow: a screenshot at 844×390 or 200% zoom.
- Save ordering: a RoadBoard test that resolves the first save after the second.

---
Stack: TypeScript, Next.js 16.3 App Router (server components, server actions, `after`), React 19.2, Drizzle ORM with a hand-edited Postgres 17 migration, Tailwind 4 and CSS modules, Bun test with happy-dom, Playwright specs. Passes applied shallowly: the router's back/forward cache was judged from the Next docs, not run.

## Outcome (15 Oct 2026)
All 15 findings were valid and are fixed in `4c5756b` (`fix(roadmaps): the review's findings`): the list orders by `coalesce(last_opened_at, created_at) desc` (a new roadmap is first); a write after onboarding is closed is refused ("Onboarding is finished. Your roadmaps hold your answers now.") and starts no roadmap; dialogs scroll inside their frame; the student paths live in `src/shared/lib/student-paths.ts` (no duplicate `ROADMAPS_PATH`, no deep import); Back after the loader goes through a server `refresh()` before the page change; the warm action is gone (step 3 is the navigation); saves of the board's choices are chained in order; the only-roadmap delete guard locks her roadmaps first; the three dialog errors are the shared `Note`; the arbitrary shadow is a ring; the constants test is gone; sizes come from the roles alone; migrated roadmaps carry `last_opened_at = onboarded_at`; the reduced-motion wait is skipped; the board no longer imports the roadmaps barrel. Left: nothing. Direct server-module imports between opening and roadmaps remain (not barrels); DoneScreen imports the loader from the roadmaps barrel.
Verified: `bun run test:run` 932 pass, 0 fail; database tests 22 pass; `e2e/routes.e2e.ts` + `e2e/your-road.e2e.ts` 13 passed; type-check and lint clean.
