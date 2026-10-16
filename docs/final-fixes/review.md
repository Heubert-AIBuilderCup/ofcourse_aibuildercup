# Final fixes before the demo — Code Review

**Approve with changes.** 0 CRITICAL · 0 HIGH · 3 MEDIUM · 9 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `chore/final-fixes` at `2eb1cd9` over `dev` (merge base `1326aa9`) · 30 files, +425 −226 · 2026-10-16 |
| Reviewed against | security · security-web · performance · CLAUDE.md · `fdd-architecture (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` · `vercel-composition-patterns (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` |
| Scans | secrets clean · dependencies 0 new, 2 pre-existing · code clean |
| Not applicable | security-llm.md (no model calls) · skill `rules/` and `references/` files (no hunk needed one) · `src/design-systems/industry/DESIGN.md` (no token choice in doubt) |
| Failed to load | none |
| Read outside the diff | 10 — listed below |

Dependencies: `braces` (high) and `esbuild` (moderate) are in the audit, but `bun.lock` did not change on this branch; both are listed under "Pre-existing, not this branch" and do not count. Unit tests for the five changed test files were run once through `scripts/capped.sh`: 50 pass.

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | B | MEDIUM · `scripts/db-dump.sh:10` · failed dump left as newest snapshot | write to a temp name, move on success |
| Performance | A | — | — |
| CLAUDE.md | B | MEDIUM · `SignInPanel.test.tsx:32` · presentational pass-through test | delete the test |
| fdd-architecture | B | MEDIUM · `src/app/page.tsx:7` · import of another feature's internals | export the icons from `@/features/road` |
| tailwind-v4-best-practices | A | LOW · `SignInPanel.tsx:190` · arbitrary offsets repeated | optional |
| vercel-composition-patterns | A | LOW · `StudentSignIn.tsx:120` · boolean mode prop | optional |
| vercel-react-best-practices | A | — | — |
| Criteria | A | 7 manual | — |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | `db:dump` writes `db-dumps/<date-time>.sql` or the named file; folder git-ignored | manual | not automatable |
| 2 | `db:restore` loads newest or named file, replaces everything incl. migration history; none → says so, exit 1 | manual | not automatable |
| 3 | Both start Postgres if down; documented on CLAUDE.md's commands line | manual (`CLAUDE.md:10` verified in diff) | not automatable |
| 4 | As the last step ticks `onDone` fires and the loader stays in full, no fade | `RoadmapLoader.test.tsx:124-137` · `DoneScreen.test.tsx:98-113` | covered |
| 5 | Under reduced motion the same | `RoadmapLoader.test.tsx:139` | covered |
| 6 | `LOADER_FADE_MS` and `fading` gone; intent and smoke note updated | diff: `loader.ts`, `useLoaderRun.ts`, `docs/roadmaps/*.md` | covered (by inspection) |
| 7 | Brand: OfCourse with the duck mark, the header's asset | `SignInPanel.tsx:136` (`Duck`, as `OnboardingPanel` uses) | manual |
| 8 | Hero kicker, headline, lead per the canvas | `src/app/page.tsx:58-61` | manual |
| 9 | Four squares City/Course/Visa/Goal, label top-left, icon centred, stepping highlight, none under reduced motion, hidden below 576, aria-hidden | `SignInPanel.test.tsx:32` (labels, icons) · CSS `sign-in.module.css:68-116` (motion) | partly covered |
| 10 | Form subtitle; placeholder and validation use you@example.com; "Sign in with Google" with Google's mark | `StudentSignIn.test.tsx:60-80, 85-90` · `GoogleSignIn.test.tsx:24` | covered |
| 11 | "New to OfCourse? Create an account"; footer "© 2026 OfCourse" | `StudentSignIn.test.tsx:70-80` · footer pre-existing `page.tsx:84-92` | covered / manual |
| 12 | Phone, tablet, 1440 and 1920 match the canvas; Google sign-in works | manual | not automatable |
| D1 | Decision: codes off on the page, code path and unit tests stay, e2e code cases skipped with reason | `StudentSignIn.test.tsx:60` · `e2e/student-sign-in.e2e.ts` | covered |
| D2 | Decision: Google is primary (blue); "Create an account" starts Google | `StudentSignIn.test.tsx:70-80` (`signIn.social` payload) | covered |
| D3 | Decision: admin keeps its headline and the outlined button, gains duck and label | `src/app/admin/sign-in/page.tsx:55-86` (no `headline`/`cells`/`primary`) · `e2e/admin-sign-in.e2e.ts:12` | covered |

Rows 1-3 are shell scripts against Docker Postgres; the repo has no script tests and a round-trip would need the container, so they are marked manual rather than uncovered. Row 9's stepping highlight and phone hiding are pre-existing CSS the diff did not touch.

## Read outside the diff
- `src/features/road/components/RoadBoard.tsx:215` — `arrive` is `router.replace(...)`: the Create roadmap loader is removed by the route swap, never stuck.
- `src/features/opening/components/DoneScreen.tsx:65-66` — refresh action then `router.replace`; same guarantee for onboarding.
- `src/features/roadmaps/hooks/useLoaderRun.ts:56-59` — the `alive` check sits immediately before `setDone` with no await before `onDone()`, so the dropped guard changes nothing after unmount.
- `src/app/admin/sign-in/page.tsx:55-86` — passes no `headline`, `cells` or `primary`: default headline, A1-D1 cells, outlined button, as D3 says.
- `src/features/auth/components/StudentSignIn.tsx:72,85` — the only effects reaching the email/code refs are `?.focus()` calls; with `codes={false}` nothing else runs and `pageNotice` still shows through `message`.
- `src/features/road/index.ts` — exports no `ICONS`; `src/app/page.tsx:7` bypasses the public API (finding below).
- `src/features/auth/index.ts` — exports neither `SignInPanel` nor `StudentSignIn`; routes already import auth internals, so the boundary is this repo's loose practice, which sets the severity.
- `src/features/auth/components/sign-in.module.css:68-116` — cell animations only under `prefers-reduced-motion: no-preference`.
- `docker-compose.yml:8-12` — `app/app` dev credentials, bound to `127.0.0.1:5433`; the scripts add no secret.
- grep "Continue with Google" — none left in `src/` or `e2e/`; it remains in historic docs and in `docs/student-opening-three-futures/smoke.md:12,20,34` (finding below).

## Findings, by file

### `scripts/db-dump.sh`

**MEDIUM · line 10 · failed dump becomes the newest snapshot**
- What: `> "$file"` creates the file before `pg_dump` runs; if `pg_dump` fails (or `docker compose exec` does), `set -e` exits and an empty or truncated `.sql` stays in `db-dumps/` with the newest timestamp.
- Why: the next `bun run db:restore` with no argument picks that file, `psql` runs an empty transaction, and the script prints "Restored" though nothing was; the safety net reports success on the one day it did not hold.
- Rule: `security.md` §6/§8 (a data tool whose failure is silent) · a test would have caught it: no, a shell path
- Fix: dump to `"$file.part"` and `mv` it into place at the end, or `trap 'rm -f "$file"' ERR`; either way an unfinished dump never carries the `.sql` name.

### `scripts/db-restore.sh`

**LOW · line 14 · a dump older than a migration can fail at DROP**
- What: `pg_dump --clean` emits `DROP TABLE` without `CASCADE`; a table added by a migration since the dump that references a dumped table makes the drop fail, `ON_ERROR_STOP` stops, `--single-transaction` rolls back.
- Why: safe (nothing is lost) but the only message is psql's, and the script's comment promises "everything is replaced".
- Rule: `security.md` §6 (say what an irreversible change leaves behind) · a test would have caught it: no
- Fix: one line in the comment and CLAUDE.md: restore after `db:reset` when a migration has landed since the dump, or add `--clean` with `DROP SCHEMA public CASCADE` semantics via a `-c` prelude.

### `src/app/page.tsx`

**MEDIUM · line 7 · route imports another feature's internals**
- What: `import { ICONS } from '@/features/road/model/kinds'` reaches past `src/features/road/index.ts`, which exists and does not export the icons.
- Why: the road feature's model file is now a public contract of the sign-in page without the feature saying so; renaming or splitting `kinds.ts` breaks a route it has no reason to know about.
- Rule: `fdd-architecture` §2 Public API Boundary (HIGH in the skill; MEDIUM here because the same file already imports auth internals, the repo's practice) · a test would have caught it: no, a lint rule would
- Fix: export the four icons (or a `LOGIN_CELLS`/`ICONS`) from `@/features/road` and import from there.

### `src/features/auth/components/SignInPanel.test.tsx`

**MEDIUM · line 32 · a test of a presentational pass-through**
- What: the new case renders `SignInPanel` with a headline and four cells and asserts the heading's text, the concatenated labels and that two `<svg>`s exist: the props written straight back out.
- Why: CLAUDE.md gives pages, layouts and presentational pieces no unit tests; this one pins markup, breaks on any redesign and would never catch a product bug.
- Rule: CLAUDE.md "test the brain, not the beauty" · a test would have caught it: n/a, this is the test
- Fix: delete it; the look of the cells is the screenshot check the intent's row 12 already asks for.

### `src/features/auth/components/SignInPanel.tsx`

**LOW · line 190 · arbitrary offsets repeated**
- What: `top-[0.425rem] left-[0.425rem]` on the label, next to the cell's pre-existing `p-[0.425rem]`: the same arbitrary value three times.
- Why: three copies of a one-off number drift apart; the cell's padding already places the corner.
- Rule: `tailwind-v4-best-practices` §2 semantic utilities over arbitrary values · a test would have caught it: no, a convention
- Fix: make the cell `grid` and put label and icon in the same cell (`col-start-1 row-start-1`), label `self-start justify-self-start`, icon `place-self-center`; no new arbitrary value.

**LOW · line 46 · `cells` is open-ended where `headline` is a tuple**
- What: `headline` is typed `readonly [string, string]` but `cells` is `readonly PanelCell[]`; a fifth cell gets `POSITIONS[4]`, `undefined`, and no lit highlight.
- Why: the component has four positions; the type should say so, as it does for the headline.
- Rule: quality, names and types that say what things are · a test would have caught it: no
- Fix: `readonly [PanelCell, PanelCell, PanelCell, PanelCell]`.

### `src/features/auth/components/StudentSignIn.tsx`

**LOW · line 129 · two independent Google pending states**
- What: `create` (`useGoogleSignIn`) and the instance inside `GoogleSignIn` each own `pending`/`failed`; pressing "Create an account" leaves the Google button enabled and vice versa, and the failure sentence is written twice (`:431`, `GoogleSignIn.tsx:107`).
- Why: a second press starts a second `signIn.social` while the first is leaving; harmless today, but two controls for one action should share one state.
- Rule: quality, no duplicated logic · a test would have caught it: yes, "pressing Create disables Sign in with Google" asserts nothing today
- Fix: call `useGoogleSignIn` once in `StudentSignIn` and pass `start`/`pending`/`failed` into `GoogleSignIn` (or render the link from the same hook result).

**LOW · line 120 · a boolean mode prop**
- What: `codes` switches the card between two renders while all fourteen state hooks, both refs and the resend clock still mount in Google-only mode.
- Why: `patterns-explicit-variants` says a `GoogleOnlySignIn` beside the code card would read as what it is; the intent's decision (keep the code path) is met either way.
- Rule: `vercel-composition-patterns` §architecture-avoid-boolean-props · a test would have caught it: no
- Fix: optional; a follow-up when the provider lands and the page decides which card it is.

### `src/features/roadmaps/components/RoadmapLoader.test.tsx`

**LOW · line 135 · class-string assertions**
- What: `not.toContain('opacity-0')` and `not.toContain('transition')` pin the removed implementation rather than behaviour; the `onDone` timing assertion on line 131 already says the loader is done as the last step ticks.
- Why: a later styling change (any transition on the loader) fails a test about a fade that no longer exists.
- Rule: CLAUDE.md "tests compare strings and attributes" is honoured; "test the brain" is not · a test would have caught it: n/a
- Fix: drop the two lines, keep the `onDone` assertions.

**LOW · line 139 · the reduced-motion case repeats the one above**
- What: the hook no longer reads `matchMedia`; "under reduced motion, the same" runs the same steps and assertions as line 124.
- Why: test bloat, small; it documents the intent's row 5, which is its only value.
- Rule: quality, a test that repeats another's assertion · a test would have caught it: n/a
- Fix: optional; delete or keep as the pin for row 5.

### `e2e/dark-mode/dark-mode.e2e.ts`

**LOW · lines 531, 665 · skips wider than the decision**
- What: AC9 and AC11's sign-in cases fill the email field but type no code; the decision skips "cases that type a code". Both are now `test.skip`, so the theme toggle from the keyboard on the sign-in page has no spec.
- Why: a standing spec is updated only when a change alters what it covers; these could keep covering it with the Google button in the field's place.
- Rule: CLAUDE.md e2e rule · a test would have caught it: n/a
- Fix: re-point AC11 at the Google button (focus, Tab, toggle, nothing else changes) and AC9 at the toggle itself; or record the loss in the skip reason.

### `docs/student-opening-three-futures/smoke.md`

**LOW · lines 12, 20, 34 · stale smoke steps**
- What: the living smoke doc still says "Continue with Google" and "OfCourse page with Continue with Google and 'Your email'".
- Why: whoever runs the smoke before the demo reads a page that no longer exists.
- Rule: quality, a comment that no longer matches · a test would have caught it: no
- Fix: "Sign in with Google", no email field.

## Pre-existing, not this branch
- `braces` ≤3.0.3 (high, GHSA-vfj7-8cjw-p6xm) and `esbuild` ≤0.24.2 (moderate, GHSA-67mh-4wv8-2f99): dev-tool transitive dependencies; `bun.lock` unchanged on this branch.

## Top 3 priority fixes
1. `scripts/db-dump.sh:10` — write to a temp name and move on success, so a failed dump is never the newest snapshot.
2. `src/app/page.tsx:7` — import the icons through `@/features/road`'s index.
3. `src/features/auth/components/SignInPanel.test.tsx:32` — delete the presentational test.

## Done well
- The loader fix is the smallest correct one: the fade, its constant and its state are gone rather than shortened, both callers end in `router.replace`, and the hook's unmount guarantee still holds without the extra `alive` check.
- `useGoogleSignIn` is a clean extraction: the OAuth target type, the `signIn.social` payload and the admin page's outlined button are untouched, and the unit test pins the payload rather than the component.
- The scripts are quoted throughout, pass no value into a shell string, use `ON_ERROR_STOP` with `--single-transaction` so a bad restore rolls back, and the dumps folder is ignored before the first dump exists. Google's brand mark keeps its exact hex fills and white tile, with the reason stated in the comment.

## Built but not asked for
- "New to OfCourse? Create an account" renders with codes on too (`StudentSignIn.tsx:418-436`), where a new account could also come by code; the intent ties it to the Google-only decision. Harmless; say so or gate it on `googleOnly`.
- `GoogleTarget` exported type and the `ArrowRight` on the primary button: both serve the asked-for change.

## Blind spots
- The four widths against the canvas (row 12) and the duck mark's size in the panel are visual; a screenshot pass at 390, 768, 1440 and 1920 is the check.
- A dump/restore round-trip (rows 1-3) is unverified here; one manual run of `db:dump` then `db:restore` on the dev database, plus one with Postgres stopped, settles both scripts and the MEDIUM above.
- `db-dumps/` will hold real sign-in emails from the dev database; it is git-ignored, and nothing else keeps it out of a backup or a shared machine.

---
Stack: TypeScript, React 19, Next.js App Router (server + client components), Tailwind 4, bun test with happy-dom and Testing Library, Playwright, bash with Docker Compose and Postgres `pg_dump`/`psql`. Passes applied shallowly: none.

## What was fixed, 16 Oct 2026

Jenish said "review, fix and push"; every finding was taken as valid except the two marked optional and one adjudicated below.

| Finding | Outcome |
| --- | --- |
| MEDIUM `scripts/db-dump.sh:10` failed dump becomes the newest snapshot | Fixed: the dump is written to `<file>.part` and renamed when pg_dump has finished; an EXIT trap removes a part file. Round trip re-run: dump 44K, restore OK. |
| LOW `scripts/db-restore.sh:14` a dump older than a migration can fail at DROP | Fixed: the script's comment and CLAUDE.md's `db:restore` entry say the restore rolls back as one transaction and to `db:reset` first in that case. |
| MEDIUM `src/app/page.tsx:7` route imports another feature's internals | Fixed: `ICONS` is exported from `@/features/road` and imported from there. |
| MEDIUM `SignInPanel.test.tsx:32` presentational pass-through test | Fixed: deleted. The cells are the screenshot check. |
| LOW `SignInPanel.tsx:190` arbitrary offsets repeated | Fixed: the cell is a grid; label and icon share its one cell, the label in the padded corner, the icon centred. No new arbitrary value. |
| LOW `SignInPanel.tsx:46` `cells` open-ended | Fixed: `PanelCells` is a four-tuple; the page's `CELLS` is typed with it. |
| LOW `StudentSignIn.tsx:129` two Google pending states | Fixed: one `useGoogleSignIn` in `StudentSignIn`, passed to `GoogleSignIn` as `run`; the button and "Create an account" go busy and fail together, and the failure sentence shows once, under the button. |
| LOW `StudentSignIn.tsx:120` boolean mode prop | Left, as the finding says: a follow-up when the provider lands and the page decides which card it is. |
| LOW `RoadmapLoader.test.tsx:135` class-string assertions | Fixed: the two lines are gone; the `onDone` timing is the assertion. |
| LOW `RoadmapLoader.test.tsx:139` reduced-motion case repeats | Left: it is the pin for criterion 5. |
| LOW `dark-mode.e2e.ts:531,665` skips wider than the decision | Fixed: AC9 reads color-scheme off the Google button, AC11 toggles the theme from the keyboard with the Google button standing for the page's content; both run again. |
| LOW `docs/student-opening-three-futures/smoke.md` stale steps | Fixed: "Sign in with Google", no email field. |
| Built but not asked for: "New to OfCourse? Create an account" with codes on too | Left as the canvas draws it under the card in every state; with codes on, a new account can also come by code, and the line still says what it says. |

Tests after the fixes: auth components, the loader and the done screen, 49 pass; lint and type-check clean.
