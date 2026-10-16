# Step 03, Where and how you'd live — Code Review

**Approve with changes.** 0 CRITICAL · 0 HIGH · 2 MEDIUM · 5 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/onboarding-living` at `72daf23` over `origin/dev` (`20d12c2`) · 34 files, +1536 −543 · 2026-10-09 |
| Reviewed against | security · security-web · performance · CLAUDE.md · `vercel-react-best-practices (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` · `fdd-architecture (SKILL.md)` · `industry/DESIGN.md` |
| Scans | secrets clean · dependencies 0 new, 2 pre-existing · code clean (semgrep p/owasp-top-ten) |
| Not applicable | `security-llm.md` (no model calls) · `vercel-composition-patterns` (not in dispatch) |
| Failed to load | none |
| Read outside the diff | 8, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | B | MEDIUM · `QuestionScreen.tsx:154` · person never forgotten | clear her person on "No" |
| Performance | A | — | — |
| vercel-react-best-practices | A | — | — |
| tailwind-v4-best-practices / DESIGN.md | A | — | — |
| fdd-architecture / CLAUDE.md | B | MEDIUM · `onboarding.ts:55` · panel copy ×4 | one shared constant |
| Criteria | A | 1 not automatable | — |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | own URL per question, marks step, unknown slug 404 | `onboarding.test.ts:391` | covered |
| 2 | order; kicker n of N, 4 to 6 | `onboarding.test.ts:451`, `QuestionScreen.test.tsx:384` | covered |
| 3 | why lines | `onboarding.test.ts:363` | covered |
| 4 | cards, Not sure last, defaults | `impact.test.ts:531`, `QuestionScreen.test.tsx:399` | covered |
| 5 | answer lines | `impact.test.ts:531`, `impact.test.ts:845` | covered |
| 6 | notes, person failure, Try again | `QuestionScreen.test.tsx:408`, `:441` | covered |
| 7 | Back, Next, Leave, links in and out, flush | `QuestionScreen.test.tsx:372`, `:472`, `OpeningScreen.test.tsx:161`, `onboarding.test.ts:558` | covered |
| 8 | panel on step 03 | `OnboardingPanel.test.tsx:139` | covered |
| 9 | person form; all blank stores none | `PersonForm.test.tsx:29`, `:104`, `actions.test.ts:225`, `QuestionScreen.test.tsx:457` | covered |
| 10 | person line | `impact.test.ts:563` | covered |
| 11 | futures' distance line | `geo.test.ts:129`, `:141` | covered |
| 12 | resume | `onboarding.test.ts:526`; `landing.test.ts:79` (elsewhere) | covered |
| 13 | PRODUCT.md; unit suite passes | diff; suite not re-run here | covered |
| 14 | matches the Live and LV boards | manual | not automatable |

Criterion 1's "marks step 03" and `notFound()` live in the page, which the project leaves untested by rule; the code is right (`living/[question]/page.tsx:20-21`). Criterion 13's suite result is the smoke file's claim (822 pass); run `bun run test:run` before the PR.

## Read outside the diff
- `src/features/opening/model/questions.ts:285` — `activeRelative` drops the person unless "knows" is visible and Yes, so the futures ignore a person after community or knows turns No.
- `src/app/(app)/futures/page.tsx:16`, `src/features/engine/futures.ts:277` — the futures read the person only through `activeRelative` and `distanceLine`, which now returns null with no place.
- `src/features/opening/server/profile.ts:64,99` — reads parse with the loosened `relativeSchema`, so pre-slice rows stay valid; writes re-parse.
- `src/features/opening/model/onboarding.ts:371` — `shownQuestion` calls `firstOpenQuestion` without the person; checked that no reachable URL makes that differ from the page's redirect.
- `src/app/(app)/onboarding/(shell)/facts/page.tsx`, `landing.ts:23`, `PictureQuestion.tsx:71` — callers of the functions widened to `StepKey` only pass or read step 01 keys; nothing passes `'person'` where a stored key is needed.
- `src/shared/lib/auth/gate.ts:26`, `src/proxy.ts:42` — `/onboarding` is in APP_PATHS and the matcher; both new pages call `requireStudent`.
- `src/features/opening/server/profile.ts:45` — `getProfile` is `cache()`d, so the shell layout and the page share one read.
- `src/features/opening/model/landing.test.ts:79` — `lastStep: 'living'` lands on `/onboarding/living`, which now redirects to her first open question.

## Findings, by file

### `src/features/opening/components/QuestionScreen.tsx`

**MEDIUM · line 154 · her person is never forgotten**
- What: the old screen cleared the stored person when "Do you know anyone…" turned anything but Yes (`OpeningScreen` lines 1192-1193 and its test, both deleted). `answer()` does not, and `AnswerCards` cannot unselect a relationship (`AnswerCards.tsx:15`). So once she picks one, nothing in the UI removes the person's name and suburb.
- Why: this is a third party's personal data, stored with no path to delete it. No criterion asked for the deletion to be dropped. The intent's edge case keeps the person only when community turns No.
- Rule: `security.md` §4 (deletion) · a test would have caught it: yes, the deleted "forgets her person when she says she knows no one" test.
- Fix: when `knows` is saved as anything other than a stated Yes, call `changePerson(null)` (setting the state and saving null), and port the deleted test to `QuestionScreen.test.tsx`.

**LOW · line 54 · notes**
- What: `PERSON_NOTES` repeats `saving: 'Saving…'` instead of spreading `NOTES` as `OPTIONAL_NOTES` does, and `notes` at line 178 is a three-level nested ternary.
- Why: a fourth copy of the same note, and a choice that is harder to read than a lookup.
- Rule: quality, duplication and nesting · a test would have caught it: no, style.
- Fix: `{ ...NOTES, idle: …, saved: … }`, and pick the notes with early returns in a small `notesFor(question)` helper.

### `src/features/opening/model/onboarding.ts`

**MEDIUM · line 55 · panel copy repeated four times**
- What: `PANEL_COPY[3]` is a fourth literal copy of the "Six short steps" title and lead (steps 0, 1, 2 and 3).
- Why: changing the lead (the open "ranked or recommended" question in smoke.md) now takes four identical edits.
- Rule: severity table, repetition (three or more) · a test would have caught it: no, the test asserts that they are equal.
- Fix: one `SIX_STEPS` constant, used by keys 0 to 3.

**LOW · line 344 · step 01 helpers widened to StepKey**
- What: `factPath`, `factKey` and `firstUnanswered` now take or return `StepKey`, but step 01 never asks `'person'`.
- Why: the types now allow a value that cannot happen, so callers lose narrowing they had before.
- Rule: quality, names say what things are · a test would have caught it: no.
- Fix: keep them on `QuestionKey`, with a cast or a narrowing guard at the one place step 01's `StepQuestion.key` meets them.

### `src/features/opening/model/impact.ts`

**LOW · line 372 · the tag is found by searching the composed string**
- What: `splitTag` finds `' · estimate'` with `indexOf` in a line that also contains text she typed (the place name, the contact's name). A typed "Darwin · estimate" renders a false tag.
- Why: the line is built and then parsed again. The first is the source of truth, and the second breaks on user text.
- Rule: quality, no duplicated logic · a test would have caught it: no, nothing types the separator.
- Fix: have `personLine` return its parts (text, tag, after) and let `impactLine` join them, or match only the line's last tag.

### `src/app/(app)/onboarding/(shell)/facts/[question]/page.tsx`

**LOW · line 308 · an action passed that is never used**
- What: the step 01 and 02 pages now pass `saveRelativeAction`, which their screens never call, because the prop is required.
- Why: it is noise on two pages, and it serialises one more action reference to the client.
- Rule: `fdd-architecture` §YAGNI · a test would have caught it: no.
- Fix: make `saveRelativeAction` optional on `QuestionScreen` (step 3 only), as the plan allowed.

### `src/features/opening/components/OpeningScreen.tsx`

**LOW · line 116 · generality for one remaining screen**
- What: only step 04 renders here now, yet the screen keeps `index === 3 ? … : stepPath(index - 1)`, adds a visible-items filter (line 131) and passes `null` as the relative.
- Why: dead branches suggest that other screens still use it.
- Rule: CLAUDE.md §Simplicity · a test would have caught it: no.
- Fix: leave it as is until step 04 moves to the shell. Drop the new filter unless an `after` item can be hidden.

## Top 3 priority fixes
1. `QuestionScreen.tsx:154` — forget her person when "Do you know anyone…" is not a stated Yes; restore the deleted test.
2. `onboarding.ts:55` — one constant for the panel's "Six short steps" copy.
3. `impact.ts:372` — return the person line in parts instead of searching it for " · estimate".

## Done well
- The person is one pseudo-key (`PERSON`) through the step model. `askedQuestions`, `firstOpenQuestion` and `questionPath` handle it in one place each, and TypeScript narrowing keeps it away from `answers[…]`.
- `useKeyedSave` generalises the step 02 save hook without changing its debounce, sequence, retry or flush, and the step 01/02 tests are untouched.
- `placeLabel` replaces two copies of the "Cannington, Perth" rule, and `whoOf` names the contact the same way in the screen line and the futures line.

## Built but not asked for
- `dense` cards on `AnswerCards`, and the estimate tag split out on screen (both are needed to draw the canvas's person form; no criterion names them).

## Blind spots
- The e2e specs that walk step 03 through the old screen are stale and will fail (`e2e/onboarding-study.e2e.ts:66` expects `/onboarding/living$`; `answerOpening`, `dark-mode.e2e.ts:632`). The intent puts this out of scope and nothing runs e2e automatically. A follow-up branch should update them before anyone runs `bun run test:e2e`.
- Only a screenshot or a manual pass catches a stored place that has left the catalogue: the select shows "Choose a city or suburb" and the next edit drops the stored name. A component test with a stale `placeId` would catch it.
- The scans' two dependency advisories (braces high, esbuild moderate) predate this branch, which changes no dependency. They are listed here only.

---
Stack: TypeScript, React 19, Next.js (App Router, server actions), Tailwind 4, Zod (mini), Bun test with happy-dom. Passes applied shallowly: none. Visual fidelity (criterion 14) is not judged here.

## Fixes applied (9 Oct 2026)
The developer said "fix all valid". All seven were valid; applied in `dd03d5f` (unit suite 826 pass, 0 fail).
- MEDIUM · her person is forgotten: "No" or "Not sure" on "Do you know anyone…" clears the person and saves `null`; tests in `QuestionScreen.test.tsx`.
- MEDIUM · one constant for the panel's "Six short steps" copy.
- LOW · notes: `PERSON_NOTES` spreads `NOTES`; `notesFor(question)` replaces the nested ternary.
- LOW · `factPath`, `factKey`, `firstUnanswered` back on `QuestionKey` (one cast at `FACT_QUESTIONS`).
- LOW · the person line carries its tag in parts; a typed " · estimate" draws no tag (`impact.test.ts`).
- LOW · `saveRelativeAction` optional; the facts and study pages no longer pass it.
- LOW · OpeningScreen: the new visible-items filter dropped (no step 04 item can be hidden); the rest left until step 04 moves to the shell, as the finding itself advised.
Left: nothing. Noted by the implementer: the facts and study pages still pass the unused `relative` prop (not part of any finding).
