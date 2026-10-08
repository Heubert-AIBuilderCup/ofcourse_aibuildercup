# Onboarding steps 00–01 (UI pass) — Code Review

**Approve with changes.** 0 CRITICAL · 0 HIGH · 5 MEDIUM · 6 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/student-opening-build` at `fe63638` over `fa42cff` · 40 files, +3223 −234 · 2026-10-07 |
| Reviewed against | security · security-web · performance · CLAUDE.md + AGENTS.md · Industry `DESIGN.md` · `tailwind-v4-best-practices (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` · `fdd-architecture (SKILL.md)` |
| Scans | secrets clean · dependencies 0 new, 2 pre-existing · code clean |
| Not applicable | `security-llm.md` (no model calls) · `vercel-composition-patterns` (not dispatched) |
| Failed to load | none |
| Read outside the diff | 11 — listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | — | — |
| Performance | A | — | — |
| CLAUDE.md · DESIGN.md | B | MEDIUM · `OnboardingPanel.tsx:58` · type size per breakpoint | use type roles, drop overrides |
| tailwind-v4-best-practices | A | LOW · `AnswerCards.tsx:125` · `!` override on borrowed class | optional |
| vercel-react-best-practices | A | — | — |
| fdd-architecture | A | LOW · `FactsScreen.tsx:7` · auth internals import | optional |
| Quality | B | MEDIUM · `answer-save.ts:79` · unmount drops a pending save | send pending saves on unmount |
| Criteria | B | MEDIUM · `(onboarding)/layout.tsx:9` · duck loader likely gone 00↔01 | add an onboarding `loading.tsx` |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 2 | No "best"/"recommended" | `onboarding.test.ts:129` · `OnboardingPanel.test.tsx:51` | covered |
| 3 | Mock figure labelled | `impact.test.ts:697` · `FactsScreen.test.tsx:127` | covered |
| 4 | Duck loader on waits > 400 ms | — | at risk |
| 14 | Step 01 within 3 s of Start | `e2e/opening.e2e.ts:44` | covered |
| 22 | Progress shows the screen | `OnboardingPanel.test.tsx:51` · `e2e/opening.e2e.ts:53` | done differently |
| 23 | Step 01 asks the eleven facts | `onboarding.test.ts:31` · `FactsScreen.test.tsx:77` | covered |
| 24 | Onshore line differs | `e2e/opening.e2e.ts:68` | covered |
| 25 | Impact line within 300 ms | `e2e/opening.e2e.ts:68` · `FactsScreen.test.tsx:94` | covered |
| 26 | Not sure stores default, assumed | `e2e/opening.e2e.ts:91` · `impact.test.ts:657` | covered |
| 27 | Partner: saved, no form, line | `e2e/opening.e2e.ts:102` · `impact.test.ts:683` | covered |
| 30 | Back keeps answers | `e2e/opening.e2e.ts:114` · `e2e/opening.e2e.ts:59` | covered |
| 60 | Return to where she left | `e2e/coins-and-return.e2e.ts:94` · `e2e/onboarding.e2e.ts:46` | covered |

22: the plan's decision (seven steps 00–06, a list on desktop) departs from "six progress dots"; 14's quoted question text also changed ("How would you like your comic character drawn?"); neither is recorded in the intent (finding below). 4 is not in this pass's list but the new layout changes it; reasoning below, not run. 60 now means "her first unanswered question on step 01", as the plan defines it. Criterion 2 is tested on the panel copy only; the step 00/01 screen copy was checked by hand and is clean.

## Read outside the diff
- `src/app/(app)/opening/[step]/page.tsx` — still renders `OpeningScreen` for `facts`, but the static `(onboarding)/opening/facts` route wins, so the old facts screen is unreachable.
- `src/app/(app)/layout.tsx` — `requireStudent()` wraps the `(onboarding)` group; the page's own check is a second guard.
- `src/shared/lib/auth/gate.ts:26` · `src/proxy.ts:41` — `/picture` and `/opening/:path*` already in APP_PATHS and the matcher; the URLs did not change.
- `e2e/admin-sign-in.e2e.ts:75` — an admin is already refused across the student app, the new route included.
- `src/features/opening/actions.ts:61` — `saveAnswersAction` authenticates (`asStudent`) and parses every key and value; unchanged.
- `src/features/opening/model/impact.ts:32,37,55` — `MOCK`, `assumedText`, `textOf` exist; `impactLine` swaps `find` for `filter()[0]`, the same result, and only `OpeningScreen` calls it. The "never changes a line" test checks it.
- `src/features/opening/model/landing.ts:15` — landing sends a returning student to `/opening/facts`, which redirects to her first unanswered question.
- `src/features/auth/components/SignOutButton.tsx` — signs out and replaces to `/` with no hook to flush the step's pending saves.
- `src/app/(app)/loading.tsx` + `node_modules/next/dist/docs/…/loading.md:86` — the one loading boundary sits above the new `(onboarding)` layout.
- `src/design-systems/industry/DESIGN.md` · `src/app/globals.css:81–111` — `accent-*`, `neutral-*`, `danger-*`, `panel-*` are the system's own ramps, so the colours are allowed.
- `src/features/auth/` — has no `index.ts`; every caller imports its components directly.

## Findings, by file

### `src/features/opening/model/answer-save.ts`

**MEDIUM · line 79 · a pending save dropped on unmount**
- What: unmounting clears each debounce timer without sending its save. `FactsScreen.flush` covers only the screen's own exits (Back to 00, Next, Leave). Browser Back or Forward out of the step, Sign out, or closing the tab within 300 ms of a tap loses that answer. Separately, `flush` also re-sends saves already in flight, because `'saving'` covers both waiting and in flight.
- Why: she sees the card checked and the "Saving…" note. When she returns, the question is unanswered and the futures use the default, so `FactsScreen.tsx:45` ("a quick tap is never lost") is not true.
- Rule: Quality, errors surfaced not swallowed · a test would have caught it: no. `answer-save.test.tsx` asserts the opposite ("never calls the action when unmounted").
- Fix: on unmount, fire the waiting saves instead of clearing them, and expose a `flush()` that fires only the waiting timers. Change that test to expect one call, and drop the hand-rolled `flush` in FactsScreen.

### `src/app/(app)/(onboarding)/layout.tsx`

**MEDIUM · line 9 · duck loader likely gone between steps 00 and 01**
- What: the only loading boundary is `(app)/loading.tsx`, and it wraps the whole `(onboarding)` layout (Next docs, loading.md:86). Start (00→01) and Back (01→00) now change a segment inside that boundary, which is already showing, so a transition keeps the old screen rather than showing the fallback. `PictureQuestion.tsx:68` still says "a slow one shows the duck loader". Reasoned from Next's model, not run.
- Why: criterion 4 needs the duck on any wait over about 400 ms, and Start does a server redirect and a profile read.
- Rule: intent criterion 4 · a test would have caught it: yes, an e2e that slows `/opening/facts` (`page.route` delay) and expects "Keep floating.".
- Fix: add `src/app/(app)/(onboarding)/loading.tsx` rendering `DuckLoader`. It sits inside the shell, so the panel stays and the main column shows the duck. Add that throttled e2e.

### `src/features/opening/components/OnboardingPanel.tsx`

**MEDIUM · line 58 · type size per breakpoint, off the roles**
- What: the brand is `text-xl @max-xl:text-lg`, the lead adds `@max-xl:text-sm` (line 83), and the step rows use `text-sm` (line 103). `PictureQuestion.tsx:124` sets the choices in `text-lg leading-[1.15]`. Lines 58 and 83 are sizes per breakpoint, and none of the four uses a type role.
- Why: the roles are fluid on purpose, and per-breakpoint sizes are the drift CLAUDE.md and DESIGN.md forbid.
- Rule: CLAUDE.md §Code "Never a size per breakpoint" · DESIGN.md §Sizing · `tailwind-v4-best-practices` §2 · a test would have caught it: no, a convention.
- Fix: use `text-h4` for the brand and the choices, `text-caption` (or body) for the lead and rows, and drop the `@max-xl:text-*` overrides.

### `docs/student-opening-three-futures/intent.md` (not in the diff)

**MEDIUM · criteria 14, 22 · contract not amended**
- What: the build shows seven steps (00–06) where criterion 22 says six progress dots, and step 00 asks a different question from the text criterion 14 quotes. The plan records 22 as the developer's decision; neither change is in the intent's "Changes".
- Why: the intent is the contract a later review and QA read. As written, both criteria now read as contradicted.
- Rule: Criteria pass, done differently · a test would have caught it: no.
- Fix: add a 7 Oct entry under "Changes" that rewords 22 (seven steps on the onboarding panel, six dots on screens 2–4 until redesigned) and 14's question text.

### `e2e/onboarding.e2e.ts`

**MEDIUM · line 11 · the same locator three times**
- What: `card(page, question, name)` is defined identically in `e2e/onboarding.e2e.ts:11`, `e2e/opening.e2e.ts:19` and `e2e/coins-and-return.e2e.ts:14`, and repeated inside `answerFact` (`e2e/helpers/student.ts:85`).
- Why: when the radiogroup's naming changes, four places need the same edit.
- Rule: Quality, repetition three or more · a test would have caught it: no.
- Fix: export `card` from `e2e/helpers/student.ts`, use it in `answerFact`, and import it in the three specs.

### `src/features/opening/components/AnswerCards.tsx`

**LOW · line 125 · borrowed class held by `!important`**
- What: the tick reuses step 00's `.tick` (unlayered, `scale(0)`, keyed to `aria-pressed`) and needs `group-aria-checked:transform-none!` to show.
- Why: a change to step 00's CSS silently breaks step 01's tick.
- Rule: `tailwind-v4-best-practices` §4 spirit · a test would have caught it: no.
- Fix: optional. Move the tick's scale-in to the shell module, or to a `scale-0 group-aria-checked:scale-100` utility pair.

### `src/features/opening/components/OpeningScreen.tsx`

**LOW · line 134 · unreachable branch**
- What: `index === 0 ? PICTURE_PATH` (and `PICTURE_PATH` at line 28) serves screen 1, which this branch made unreachable. `OpeningScreen.test.tsx` still tests `show(0)`.
- Why: dead code that reads as live.
- Rule: CLAUDE.md §3, clean up your own orphans · a test would have caught it: no.
- Fix: drop the branch and the `show(0)` Back assertion, or leave a follow-up note until screens 2–4 move to the shell.

### `src/features/opening/components/FactsScreen.tsx`

**LOW · line 25 · duplicated constants**
- What: `FAILED` is the same string here and in `PictureQuestion.tsx:26`, beside `model/messages.ts`. `PICTURE_PATH` (line 21) is repeated in `OpeningScreen.tsx:28`. `PictureQuestion.tsx:21` `FIRST_SCREEN` restates `FACTS_PATH`.
- Why: copy and paths drift apart.
- Rule: Quality, no duplicated logic · a test would have caught it: no.
- Fix: put the copy in `model/messages.ts` and `PICTURE_PATH` in `model/onboarding.ts`, and import `FACTS_PATH`.

**LOW · line 7 · import from a feature's internals**
- What: `@/features/auth/components/SignOutButton` is imported directly.
- Why: FDD wants a public API, but `auth` has none and `FuturesScreen` and `AdminChrome` already do the same.
- Rule: `fdd-architecture` §2 (the repo's precedent, so LOW) · a test would have caught it: no.
- Fix: follow-up: an `src/features/auth/index.ts`.

### `src/app/globals.css`

**LOW · line 150 · comment overstates container queries**
- What: "Container queries measure in the browser's rem, so breakpoints stay put." By CSS Containment 3, `rem` in a container condition resolves against the root's computed font-size, the scaled one.
- Why: it has no effect today, because scaling starts at 1440 and the page container is then above every scaled threshold (64rem tops out near 1365px). A later nested container could be misled.
- Rule: LOW, a comment that does not match · a test would have caught it: no.
- Fix: reword it to say the thresholds scale too but sit below the widths where scaling applies.

## Top 3 priority fixes
1. `src/features/opening/model/answer-save.ts:79`: send waiting saves on unmount, and make `flush` fire only waiting timers.
2. `src/app/(app)/(onboarding)/loading.tsx` (new): a `DuckLoader` boundary inside the shell, plus a throttled e2e for Start.
3. `src/features/opening/components/OnboardingPanel.tsx:58`: type roles only, with no `@max-xl:text-*`.

## Done well
- `impactView` derives everything from `impactLine` and a shared `unsureQuestions`, and one test checks text + tag == line over every case, so the futures' lines cannot drift.
- `/opening/facts` validates `q` against the model before using it and redirects only to model-built paths. Auth is layered: proxy, then the `(app)` layout, then the page.
- The radiogroup does roving tabindex, picks on arrows, puts "Not sure" last and moves focus on question change, tested in a unit test and by keyboard end to end.

## Built but not asked for
- The 1440–1920 root scaling and `split-page`/`split-panel` frame change every page, admin included (the developer's layout decision, CLAUDE.md).
- A step 00 rework (figures, motion, greeting, re-choosing on Back). The old "You're in" state and the redirect-once-answered are gone.

## Blind spots
- Root scaling on the users admin and the admin sign-in at 1440–1920: no screenshots or e2e cover them. A screenshot pass at 1440, 1680 and 1920 would.
- Losing a tap on browser Back within 300 ms: only an e2e that taps and then calls `page.goBack()` at once would show it.
- The duck loader between 00 and 01: settled only by a throttled-navigation e2e.

---
Stack: TypeScript, React 19 / Next.js App Router (route groups, server components and actions, `useSearchParams` with `history.pushState`), Tailwind CSS 4 (container queries, `@utility`), CSS Modules, Bun test + happy-dom, Playwright. Passes applied shallowly: none. The Next loading-boundary point is reasoned from the docs, not run. The session's preloaded CLAUDE.md showed a different layout rule (`@max-compact`/`@split`) from HEAD; HEAD's (`@max-xl`/`@5xl`) was used. The dependency advisories (braces high, esbuild moderate) are pre-existing: this branch changes no manifest or lockfile.

## Fixes applied (2026-10-07)

The developer's instruction: fix all valid findings. All ten fixed.

- **MEDIUM `answer-save.ts:79`, pending save dropped on unmount: fixed.** The hook keeps the debounce timers as "waiting", apart from saves in flight, and exposes `flush()`, which sends only the waiting saves; unmounting calls it. `answer-save.test.tsx` now expects one call with the last tap after an unmount, and a new test checks that `flush()` sends a waiting save at once and never re-sends one in flight. FactsScreen's own `retry`-based flush is gone; it calls the hook's `flush()`.
- **MEDIUM `(onboarding)/layout.tsx`, duck loader between 00 and 01: fixed.** New `src/app/(app)/(onboarding)/loading.tsx` renders `DuckLoader` inside the shell (loading.md: nested inside the same folder's layout), so the panel stays and the step's column shows the duck. The e2e (`e2e/onboarding.e2e.ts`, "a slow step 01 after Start shows the duck loader beside the panel") slows the server, not the network: when `/opening/facts` is requested (`page.route`), it locks her `student_profile` row for 2 s, so the page's `markStep` waits. Holding the whole request does not work: the fallback comes in the same response, so neither boundary could show (tried, it fails with and without the file). Fails without the file, passes with it.
- **MEDIUM `OnboardingPanel.tsx:58/83/103`, `PictureQuestion.tsx:124`, sizes per breakpoint: fixed.** Brand `text-h4` (18px at 390, 20px at 1440, as the design's 18/20); lead on body (15px at both; the design's 15px, 14px on a phone before); step rows `text-caption` (13px at 1440 against the design's 14px; body would be 15, equally off, and caption keeps the rows below the lead as drawn); choices `text-h4` (18 at 390, 20 at 1440; were 18 at both) on the role's own line height. `@max-xl:text-*` and `@max-xl:leading-normal` gone.
- **MEDIUM intent.md, contract not amended: fixed (7 Oct, by the intent's author, Jenish, in the one-shot run).** Criteria 14 and 22 corrected in place to match the design, with a dated entry under "Changes".
- **MEDIUM e2e, the same locator three times: fixed.** `card(page, question, name)` is exported from `e2e/helpers/student.ts`, used by `answerFact`, and imported by the three specs; their copies are gone.
- **LOW `AnswerCards.tsx:125`, tick held by `!important`: fixed.** The card's tick has its own `scale-0 group-aria-checked:scale-100`, with the spring transition under `motion-safe:`; it no longer borrows step 00's `.tick`.
- **LOW `OpeningScreen.tsx:134`, unreachable branch: fixed.** The `index === 0` Back branch and `PICTURE_PATH` are gone; screens 2–4 go back as before. The `show(0)` Back assertion is gone, the rest of that test stays.
- **LOW `FactsScreen.tsx:25`, duplicated constants: fixed.** The save-failed copy is `ANSWER_SAVE_FAILED` in `model/messages.ts`, imported by FactsScreen and PictureQuestion; `PICTURE_PATH` is in `model/onboarding.ts` (also used by `stepOfPath`); PictureQuestion uses `FACTS_PATH`.
- **LOW `FactsScreen.tsx:7`, import from a feature's internals: fixed.** New `src/features/auth/index.ts` exports `SignOutButton` only (it reads the auth client and gate paths, nothing server-only); FactsScreen imports it from `@/features/auth`. FuturesScreen and AdminChrome still import it directly, as asked.
- **LOW `globals.css:150`, comment overstates container queries: fixed.** It now says the thresholds scale too, but scaling starts at 1440 where the page is already wider than every threshold, so the breakpoints hold. CLAUDE.md and DESIGN.md do not make the claim.
