# Roadmaps parts 4 and 5 (Your answers over the board; New roadmap) — Code Review

**Request changes.** 0 CRITICAL · 2 HIGH · 4 MEDIUM · 7 LOW

| | |
| --- | --- |
| Blocking | HIGH · `src/app/(app)/roadmaps/page.tsx:75` · a copy is not named "Copy of X" (criterion 31) |
| | HIGH · `src/features/roadmaps/model/roadmap.ts:8` · roadmaps imports the opening's model internals |
| Branch | `feat/your-answers` at `c7d2be5` over `origin/dev` (`9e239e1`) · 47 files, +3479 −346 · 2026-10-15 |
| Reviewed against | security · security-web · performance · CLAUDE.md · AGENTS.md · `fdd-architecture (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` |
| Scans | secrets clean · dependencies clean (none changed) · code clean |
| Not applicable | `security-llm.md` (no model code) · `tailwind-v4-best-practices` (not dispatched; CLAUDE.md's Tailwind rules applied) · `vercel-composition-patterns` (not dispatched) |
| Failed to load | none |
| Read outside the diff | 9 — listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | LOW · `roadmaps.ts:315` · no cap on new roadmaps | optional |
| Performance | A | LOW · `roadmap.ts:148` · question words rebuilt per row | optional |
| CLAUDE.md | B | MEDIUM · `AnswersPanel.tsx:400` · option cards not the shared ones | reuse AnswerCards and AreaChecks |
| `fdd-architecture` | C | HIGH · `roadmap.ts:8` · deep import of opening internals | question model to shared |
| `vercel-react-best-practices` | A | LOW · `useRoadSession.ts:103` · refresh overwrites Undo | optional |
| Criteria | C | HIGH · `page.tsx:75` · copy's name | store "Copy of X" on create |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 23 | Your answers from the menu and Point A; only the open roadmap changes | `RoadBoard.test.tsx:1001`, `:1016`; `AccountMenu.test.tsx:135`; `roadmaps.test.ts:351` | covered |
| 24 | Dashed preview, "If you save", "Preview · not saved", the panel's words; tiles wait | `RoadBoard.test.tsx:1023`, `:1035`; `AnswersPanel.test.tsx:105` | covered |
| 25 | Changes wait together; closing asks | `AnswersPanel.test.tsx:127`, `:147` | covered |
| 26 | Saved toast with Undo, "Changed just now", nothing-changes copy, Skipped / 10 coins | `RoadBoard.test.tsx:1051`, `:1078`; `answers-panel.test.ts:77`, `:129`, `:227` | covered |
| 27 | Phone: Map view, 62% sheet, map drops controls and frames | `RoadBoard.test.tsx:1114` | covered, framing manual |
| 28 | Draft opens the source's board, panel in draft mode, breadcrumb | `RoadBoard.test.tsx:1166`; `AnswersPanel.test.tsx:213` | covered |
| 29 | The bar and Create aria-disabled until a change | `AnswersPanel.test.tsx:225` | covered |
| 30 | Cancel with changes asks | `AnswersPanel.test.tsx:258` | covered |
| 31 | Create saves "Copy of X" with chips, runs the loader, lands marked New | `RoadBoard.test.tsx:1198`; `actions.test.ts:517`; `roadmaps.test.ts:194`; `roadmap.test.ts:202` | uncovered (the name) |
| 32 | Copy and change answers from the menu and the dialog | `RoadmapsPage.test.tsx:365`, `:636` | covered |
| — | Scratch through the panel, never onboarding | `RoadmapsPage.test.tsx:642`; `RoadBoard.test.tsx:1268`, `:1279`; `AnswersPanel.test.tsx:295`; `actions.test.ts` | covered |

Criterion 27's 62% height, no scrim and the camera framing are a look check (smoke step 5); criterion 26's "usual motion" has nothing to move for these two mock effects and is manual.

## Read outside the diff
- `src/features/roadmaps/server/roadmaps.ts:93` — `hers()` filters user, finished and alive: another student's or a draft's roadmap is refused on save and as a source.
- `src/app/(app)/roadmaps/page.tsx:66-75` — a copy's name resolves through `roadmapName`, so a null name reads as the road's name, not "Copy of X".
- `src/features/{road,opening,roadmaps}` imports (grep) — road → opening and roadmaps indexes, opening → roadmaps index, roadmaps → opening internals: no runtime cycle, at the price of the deep import.
- `src/features/opening/actions.ts:58` — `savePersonaAction` runs in `asStudent` and parses the persona; nothing else in the diff writes the profile.
- `src/features/opening/model/questions.ts:60-74` — "Where are you right now?" has 12 options and a `select` control in onboarding.
- `src/features/opening/model/onboarding.ts:353` — `askedQuestions` depends on the answers given, so follow-up questions appear only for saved answers.
- `src/features/opening/components/AnswerCards.tsx:22`, `:55` — onboarding's option cards exist, with arrow-key movement.
- `src/features/road/components/RoadMap.tsx:432` — every tile button is named "… Open in the card".
- `src/features/roadmaps/components/RoadmapsPage.test.tsx:365` — the card menu's Copy link to `/roadmaps/new?from=` is already tested.

## Findings, by file

### `src/app/(app)/roadmaps/page.tsx`

**HIGH · line 75 · a copy's name**
- What: `createRoadmap` stores `name: null` and the list names every unnamed roadmap from the road, so a copy reads "Cyber Security in Perth", the same as its source; only its "from" line says "Copy of …".
- Why: criterion 31 and the part 1 decision say a copy is named "Copy of X" until renamed; two cards with the same name are hard to tell apart.
- Rule: intent criterion 31 · a test would have caught it: yes, nothing asserts a created copy's name.
- Fix: in `createRoadmapAction`, store `Copy of <source name>` (the source resolved with `roadmapName(source, roadNames(getRoad()))`), cut to `ROADMAP_NAME_MAX` so the `roadmap_name_check` holds; add an action and DB test.

### `src/features/roadmaps/model/roadmap.ts`

**HIGH · line 8 · feature boundary**
- What: the roadmaps model imports `opening/model/answers-panel`, `opening/model/onboarding` and `opening/model/questions` by path, and `roadmaps/actions.ts:5` imports `opening/model/questions` the same way; the comment says the index would create a cycle (opening index → DoneScreen → roadmaps index → this model).
- Why: the project's FDD skill forbids importing another feature's internals; the question model is now used by three features (opening, road's `AnswersPanel`, roadmaps), which is the skill's own threshold for `src/shared`.
- Rule: `fdd-architecture` §2 Public API Boundary, §5 Rule of Three · a test would have caught it: no, a structure rule.
- Fix: move the pure question model (`questions.ts`, the step lists, `answerLabel`) to `src/shared/lib/questions/` and import it from there in all three features; that removes both the deep imports and the cycle.

**LOW · line 148 · recomputed per row, second naming rule**
- What: `answerDiffs` rebuilds `titled()` and `questionWords()` for every roadmap on the list; it also names questions by matching `q.group` to a title, while `answers-panel.ts` matches by `itemId`.
- Why: the cost grows with the number of roadmaps times the number of questions, and the chip's words can drift from the row's words.
- Rule: `performance.md` §2 · a test would have caught it: no.
- Fix: build the question words once at module level, exported from the same place `answerGroups` names its rows.

### `src/features/road/components/AnswersPanel.tsx`

**MEDIUM · line 400 · option cards copied, not shared**
- What: the option cards copy onboarding's `AnswerCards` class list word for word, as `role="radio"` buttons that are each a tab stop, with no arrow keys.
- Why: the shared component owns its look and behaviour (memory: shared components own behaviour). Here the copy drops the radiogroup keyboard pattern and will drift from onboarding.
- Rule: CLAUDE.md shared components · `fdd-architecture` composition · a test would have caught it: yes, a keyboard test (ArrowDown moves the check).
- Fix: export `AnswerCards` and `AreaChecks` from the opening and render them here with the pending value. Keep the "Your answer now" line as a slot.

**LOW · line 159 · "Changed just now" survives Undo**
- What: `done` is set on Save and never cleared, so after the toast's Undo the row still says "Changed just now" over the old answer.
- Why: the row claims a change that was undone.
- Rule: criterion 26 · a test would have caught it: yes.
- Fix: clear `done` for the keys whose answer equals the saved one again (or when `answers` changes under the panel).

**LOW · line 396 · a select asked for, cards built**
- What: "Where are you right now?" (12 countries) renders as 12 radio cards.
- Why: the Part 4 decisions ask for a select there, as onboarding has.
- Rule: intent, Part 4 decisions · a test would have caught it: yes.
- Fix: render the question's `select` control with the shared Select when `control === 'select'`.

### `src/features/road/components/RoadBoard.tsx`

**MEDIUM · line 204 · follow-up questions never appear for a pick**
- What: the rows are built from the saved `answers`, so a pending pick that opens a follow-up (`know` → `field` or `areas`, `community`/`knows` → the person) shows nothing more until saved; in a draft nothing is saved before Create, so those questions cannot be answered at all.
- Why: a copy or a scratch roadmap is created with, for example, "a particular course" and no course field, or keeps the source's now-hidden `field`.
- Rule: scratch rule ("every question open") · a test would have caught it: yes, nothing picks a gating answer in a draft.
- Fix: let the caller rebuild the groups from the answers with the pending picks merged in (lift `pending`, or pass `groupsFor(answers)`), and drop hidden answers from the merged set before Save or Create.

**LOW · line 216 · creation flow in the road feature**
- What: the board now holds the draft's create step, the loader (imported from `@/features/roadmaps`) and the landing on `/roadmaps?made=`; the file is 519 lines.
- Why: creating a roadmap is the roadmaps feature's job, and the board gains a second responsibility (the plan put it here, so this is a follow-up).
- Rule: Quality, one responsibility per file · a test would have caught it: no.
- Fix: a `DraftBoard` in roadmaps that renders `RoadBoard` with an `onCreate` callback and owns the loader.

### `src/features/road/hooks/useRoadSession.ts`

**MEDIUM · line 49 · the mock effects written three times**
- What: the over-budget sum and the "Not taken yet" rule exist in `answers-panel.ts:182`/`:217`, `scene.ts:262` (`applyAnswers`) and here (`answersSaid`, line 60), each with its own `NOT_TAKEN`, rounding and city/course lookup.
- Why: the toast, the badge and the preview can disagree as soon as one copy changes.
- Rule: Quality, duplicated logic (three or more) · a test would have caught it: no, each copy has its own passing test.
- Fix: have `answersSaid` read the figures from the scene it already built (`after.badges.over`, the course's `costs`). Take `Not taken yet` and `Hard limit` from the question model once it is shared (see the HIGH above).

**LOW · line 103 · a save's refresh can undo the Undo on screen**
- What: Save queues a write whose success calls `router.refresh()`. If Undo is pressed before that refresh lands, the new `roadmap.answers` reset local `answers` to the saved set until Undo's own write and refresh land.
- Why: the marks flicker back for a moment, and stay if Undo's write fails.
- Rule: `vercel-react-best-practices` rerender-derived-state · a test would have caught it: yes, Save then Undo before the refresh resolves.
- Fix: ignore a server read while a write is queued (compare against the last answers sent), or refresh only after the queue drains.

### `src/features/road/components/RoadMap.tsx`

**MEDIUM · line 432 · tiles named for what they no longer do**
- What: Point A's button is still named "Point A, … Open in the card" though a press opens Your answers. While the answers are open, every tile says "Open in the card" and opens nothing.
- Why: a screen-reader user hears one action and gets another.
- Rule: `fdd-architecture` accessibility · criterion 36 · a test would have caught it: yes, `RoadBoard.test.tsx:144` pins tile names but not Point A's.
- Fix: name Point A "Point A, … Open your answers". While answering, name the tiles without the action, or say "Close your answers to open it".

### `src/features/road/components/answers.module.css`

**LOW · line 23 · px outside the two exceptions**
- What: `.ask` has `border-top: 2px solid`.
- Why: CLAUDE.md allows px only for 1px hairlines and icon sizes.
- Rule: CLAUDE.md, rem not px · a test would have caught it: no, a convention.
- Fix: `0.125rem`.

### `src/features/roadmaps/server/roadmaps.ts`

**LOW · line 315 · no cap on new roadmaps**
- What: `createRoadmap` inserts with no per-student limit, and `listRoadmaps` (pre-existing) returns every row unbounded.
- Why: a script with a student session can grow her list, and every list render, without bound.
- Rule: `security.md` §8 quotas · `performance.md` §1 · a test would have caught it: no.
- Fix: a cap in `createRoadmap` (count her alive rows inside the insert's transaction) and a limit on the list. A follow-up is fine.

## Top 3 priority fixes
1. `src/app/(app)/roadmaps/page.tsx:75`: store a copy's name as "Copy of X" (≤ 60) when it is created, with a test.
2. `src/features/roadmaps/model/roadmap.ts:8`: move the question model to `src/shared` and drop the deep imports.
3. `src/features/road/components/RoadBoard.tsx:204`: build the rows from the answers with pending picks merged in, so follow-up questions appear in edit mode and in drafts.

## Done well
- The writes are tight. Both actions take the session's user and parse every entry with `parseAnswer`. The repository refuses the whole set if one entry fails (`wholeAnswers`), and `hers()` keeps out drafts, deleted rows and other students' roadmaps. DB tests prove each refusal, and the draft stores nothing until Create.
- The swap-motion fix (`203acda`) holds: the `ended` flag stops a late frame after the timer, and `useSwapMotion.test.tsx` drives frames and the timer by hand in exactly that order.
- The preview stays in the session. `choicesFrom` strips it, with a test, and `applyAnswers` is pure, with a no-mutation test. The here-card and the map both read `scene.badges`.

## Built but not asked for
- The reverse preview ("No longer a stretch", "Within your budget") and the toasts "Budget changed. … fits your budget." and "English test changed. …". These are small additions inside the two mock effects.
- The draft loader's failure line "We couldn't draw this roadmap. Nothing is created yet." (a sensible variant of criterion 11's wording).

## Blind spots
- Back (popstate) with pending changes closes the panel without criterion 25's ask. A RoadBoard test should pick, then drop `open=answers` from the query, then expect the ask or a kept pick.
- If the response to `createRoadmapAction` is lost after the insert, Try again makes a second roadmap. This needs an idempotency key and a test where the action succeeds on the server but rejects on the client.
- The sheet's 62% height, the missing scrim and the camera framing above it need a phone screenshot at 360/390, not a unit test.

---
Stack: TypeScript, React 19 and Next.js App Router (server actions, `after`, `refresh`), Tailwind 4 with CSS modules, Drizzle on Postgres, bun test with happy-dom. Passes applied shallowly: Next's version-specific behaviour (`refresh()` from `next/cache`, `useSelectedLayoutSegments` under a page) was taken on trust, not checked against `node_modules/next/dist/docs`.

## Outcome (15 Oct 2026)
Fixed in `5827b68` (`fix(road): the review's blocking findings on Your answers and the draft`): a copy is named "Copy of <source>" (HIGH); a pick that opens a follow-up question shows it at once, and hidden answers are dropped before Save or Create (MEDIUM); Point A's name says it opens her answers and, while they are open, every tile says to close them first (MEDIUM); "Changed just now" clears on Undo; "Where are you right now?" is the shared Select; the ask's border in rem.
Left as follow-ups, by the developer's "fast" instruction (none blocks the merge): the question model's move to a shared place (HIGH, boundary: the deep imports stay with their comment), sharing `AnswerCards`/`AreaChecks` with the panel (MEDIUM), the mock effects written three times (MEDIUM), the draft's create flow living in the road feature, a save's refresh racing an Undo, `answerDiffs` recomputed per row, no cap on a student's roadmaps.
Verified: `bun run test:run` 1125 pass, 0 fail (under the new memory cap); database 22 pass; type-check and lint clean.
