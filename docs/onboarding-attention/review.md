# Step 05, Your attention — Code Review

**Approve with changes.** 0 CRITICAL · 0 HIGH · 2 MEDIUM · 4 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/onboarding-attention` at `660dc88` over `e33f547` (dev) · 28 files, +1291 −708 · 2026-10-12 |
| Reviewed against | security · security-web · performance · CLAUDE.md · `industry DESIGN.md` · `vercel-react-best-practices (SKILL.md)` · `fdd-architecture (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` |
| Scans | secrets clean · dependencies N/A (package.json and bun.lock unchanged) · code clean (semgrep p/owasp-top-ten, baseline e33f547) |
| Not applicable | security-llm.md (no model calls) · vercel-composition-patterns (not dispatched) |
| Failed to load | none |
| Read outside the diff | 8 — listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | — | — |
| Performance | A | — | — |
| CLAUDE.md | A | LOW · `landing.ts:17` · futures still resume at 05 | optional |
| `industry DESIGN.md` | A | — | — |
| `vercel-react-best-practices` | A | — | — |
| `fdd-architecture` | B | MEDIUM · `AttentionScreen.tsx:284` · live regions mount with text | one persistent live region |
| `tailwind-v4-best-practices` | A | LOW · `AttentionScreen.tsx:287` · callout classes repeated | optional |
| Tests | B | MEDIUM · `coins.test.ts:156` · duplicated test | delete the Health test |
| Criteria | A | 3 manual, 1 not automatable | — |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | shell, copy, marks step 05 | `AttentionScreen.test.tsx:47` (hint) · smoke | covered in part |
| 2 | tray, polite count, Not sure | `AttentionScreen.test.tsx:47`, `:96` | covered |
| 3 | + / −, counts, pile lines | `coins.test.ts:151-165` · `AttentionScreen.test.tsx:65` | covered |
| 4 | refusals at five and ten | `coins.test.ts:185-206` · `AttentionScreen.test.tsx:82` | covered |
| 5 | Not sure spread, assumed | `coins.test.ts:101` · `AttentionScreen.test.tsx:96` | covered |
| 6 | Done gate and lines | `coins.test.ts:213` · `AttentionScreen.test.tsx:47`, `:108` | covered |
| 7 | spent / later / refused save | `AttentionScreen.test.tsx:108-158` | covered |
| 8 | Back to long-term | `AttentionScreen.test.tsx:170` | covered |
| 9 | returning piles, back note | `AttentionScreen.test.tsx:176` | covered |
| 10 | "You're all set" | smoke §5 | manual |
| 11 | panel 00–05, band, copy | `OnboardingPanel.test.tsx:154`, `:167` · `onboarding.test.ts:222`, `:244` | covered |
| 12 | step 04 forward | `QuestionScreen.test.tsx:536`, `:570` · `onboarding.test.ts:649` | covered |
| 13 | welcome copy, 6 min | `WelcomeScreen.test.tsx:29`, `:42` · `OnboardingPanel.test.tsx` (welcome) | covered |
| 14 | landing and resume | `landing.test.ts:31-66` | covered |
| 15 | /attention redirect, no /futures | `landing.test.ts:66` · `QuestionScreen.test.tsx:536` · smoke §8 | covered in part |
| 16 | PRODUCT.md, suite | PRODUCT.md diff · smoke (833 pass) | manual |
| 17 | boards at four widths | screenshots | not automatable |

Rows 1, 10 and 16: the untested parts are page code (`markStep` on open, the done page's redirect) and copy picked by one flag, which CLAUDE.md's "test the brain, not the beauty" leaves untested; project rule over the plugin's "uncovered = HIGH". The redirect in row 15 is config, checked by smoke.

## Read outside the diff
- `src/app/(app)/start/page.tsx:9`, `onboarding/page.tsx:9`, `(shell)/welcome/page.tsx:14`: all pass `getProfile`'s `Profile`, and `Resumable` picks `coins` from `Profile`, so type-check makes every caller pass it.
- `src/features/opening/server/profile.ts:45,65`: `getProfile` is `cache()`d (no double read with the shell layout); `coins` is `coinsSchema.safeParse(...)`, null on a bad row; `saveCoins` parses with the unchanged `coinsSchema`. The new screen sends the same three shapes as the old one.
- Done/attention loop: `/onboarding/done` redirects only when `coins === null`; `/onboarding/attention` never redirects. No loop.
- `src/shared/lib/auth/gate.ts:26`, `src/proxy.ts:43-45`: `/onboarding/:path*` covers both new pages; `/attention` stays in both, harmless (the config redirect runs before the proxy). Both pages call `requireStudent` and read only the session user's own row; `gate.test.ts` and `access.test.ts` cover the guard.
- `OnboardingPanel.tsx:186`: "Step n of" reads `ONBOARDING_STEPS.length - 1`, now 5. `Progress.tsx:4` keeps `SCREEN_COUNT = 6` on its own, read only by FuturesScreen, so the parked page doesn't break.
- `FuturesScreen.tsx:40`: its own `ATTENTION_PATH = '/attention'` now goes through the redirect. Still works.
- `onboarding.module.css:74-114`: the `.riverDuck` animation sits inside `@media (prefers-reduced-motion: no-preference)`. Outside it the duck is placed at rest at the right end.
- `src/app/(app)/futures/page.tsx:15`: still calls `markStep(user.id, 'futures')`. See the LOW on `landing.ts`.

## Findings, by file

### `src/features/opening/components/AttentionScreen.tsx`

**MEDIUM · lines 284, 299 · live regions mounted with their text**
- What: the refusal (`role="status"`, 284) and the pile line (`aria-live="polite"`, 299) are rendered only when they have text, so the live region and its message reach the DOM together.
- Why: screen readers often skip a live region that arrives already filled. A refused + changes no count, so a blind student who taps it may hear nothing.
- Rule: `fdd-architecture` §Accessibility; QuestionScreen already does it right (`QuestionScreen.tsx:250`, a persistent `aria-live` wrapper). A test would have caught it: no, happy-dom does not model announcements.
- Fix: put one persistent `aria-live="polite"` region (per pile, or one for the list) in the DOM from the start and render the refusal or line inside it, as QuestionScreen does.

**LOW · line 287 (and 157) · callout classes repeated**
- What: the note style `border-l-2 border-neutral-600 bg-neutral-100 px-3.5 py-2.5 text-caption` now appears five times in four components, two of them new here. The impact-line style appears twice in this file.
- Why: a change to the callout look has to be made in five places.
- Rule: `tailwind-v4-best-practices` §semantic utilities; CLAUDE.md "surgical changes" argues against refactoring the other three in this branch. A test would have caught it: no, a convention.
- Fix: follow-up: a small `Note` component in the feature.

**LOW · lines 66-121 · state wiring inline**
- What: piles, assumed, last, refused, failed and pending, with plus/minus/notSure/save, are about 45 lines of non-rendering logic in a 390-line component.
- Why: the save-with-retry logic is a candidate to share with QuestionScreen's.
- Rule: `fdd-architecture` §6 hook extraction. A test would have caught it: no.
- Fix: optional: extract `useCoinPiles` into `components/` or `hooks/`.

### `src/features/opening/model/coins.test.ts`

**MEDIUM · line 156 · test repeats another's assertion**
- What: "gives Health its first text at 1 or 2 coins and its second at 3 to 5" asserts exactly what the every-pile test at line 165 asserts for index 0.
- Why: two failures for one bug, and one more test to keep in step with the copy.
- Rule: plugin Quality (test bloat); CLAUDE.md "test the brain". A test would have caught it: n/a.
- Fix: delete the test at line 156.

### `src/features/opening/model/onboarding.test.ts`

**LOW · lines 398-399 · asserting a removed field is absent**
- What: `not.toHaveProperty('lastLabel' | 'leaveLabel')` pins that a deleted optional field stays deleted. The labels themselves are pinned in `QuestionScreen.test.tsx:536,570`.
- Why: it tests the shape of the code, not behaviour.
- Rule: plugin Quality (test bloat). A test would have caught it: n/a.
- Fix: drop the two lines.

### `src/features/opening/model/landing.ts`

**LOW · line 17 · the futures still send a student to step 05**
- What: `reachedAttention` treats `lastStep === 'futures'` as reaching step 05, and the futures page still marks `'futures'` on every open (`futures/page.tsx:15`). So a student who opens `/futures` by URL mid-step 02 after this change also resumes at step 05 and skips 02–04.
- Why: criterion 14 limits that jump to students who reached the futures "before this change".
- Rule: intent criterion 14 and edge case 3. A test would have caught it: no, the landing test cannot tell old marks from new ones.
- Fix: stop `markStep(user.id, 'futures')` in the futures page (the futures are parked), or accept the jump and say so in PRODUCT.md.

## Top 3 priority fixes
1. `AttentionScreen.tsx:284,299`: keep the per-pile live region in the DOM and change only its text.
2. `coins.test.ts:156`: delete the duplicated Health test.
3. `futures/page.tsx:15`: stop marking `'futures'`, so that only past visits resume at step 05.

## Done well
- The rules stay pure and in the model: `refusal`, `doneLine` and the coin lines are in `coins.ts`, and the screen copies none of them. Landing is one function, and `landingPath` now just delegates.
- The landing test checks both functions together and checks every combination for "never /futures".
- The attention page runs `getProfile` and `markStep` in parallel, and the river motion respects reduced motion with a resting fallback.

## Built but not asked for
- The band on step 04 reads "Next: Your attention · optional" (`OnboardingPanel.tsx:37`); no criterion names the suffix.
- `lastLabel` / `leaveLabel` removed from the step type and QuestionScreen (plan-directed cleanup).

## Blind spots
- Screen-reader announcements (refusal, pile line, tray) are not verifiable in happy-dom. A manual VoiceOver/NVDA pass, or a Playwright a11y check, would cover them.
- The e2e specs that walk `/attention` and the old step 04 → futures flow are stale (out of scope per the intent). They will fail the next time e2e is run.
- `/onboarding/done`'s redirect and the spent/later copy rely on the smoke run alone.

---
Stack: TypeScript, React 19 client components, Next.js App Router (server pages, `next.config` redirects), Tailwind 4 with CSS modules, bun:test with happy-dom and Testing Library. Passes applied shallowly: none.

## Fixes applied
- MEDIUM · `AttentionScreen.tsx:284,299` live regions: each pile keeps one `aria-live="polite"` region in the DOM (`empty:absolute`), and the refusal or pile line renders inside it · 2f55489
- LOW · `AttentionScreen.tsx:287,157` callout classes: fixed within AttentionScreen (`NOTE` and `IMPACT` constants); a shared Note component across the four screens is a follow-up · 2f55489
- LOW · `AttentionScreen.tsx:66-121` state wiring: piles, assumed, last, refused with plus, minus and notSure moved to `components/useCoinPiles.ts`; save stays in the screen · 2f55489
- MEDIUM · `coins.test.ts:156` duplicated Health test: deleted · 2f55489
- LOW · `onboarding.test.ts:398-399` removed-field assertions: dropped · 2f55489
- LOW · `landing.ts:17` futures resume at 05: `futures/page.tsx` no longer calls `markStep(user.id, 'futures')`; only marks stored before this change resume at step 05 (comments updated, no decision in code changed) · 2f55489
