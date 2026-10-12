# Cleanup after the bloat audit — Code Review

**Request changes.** 0 CRITICAL · 1 HIGH · 0 MEDIUM · 1 LOW

| | |
| --- | --- |
| Blocking | HIGH · `package.json:32` · `cn` removed while `src/shared/lib/utils.ts:1` still imports `cn/config` |
| Branch | `refactor/cleanup` at `cd32d2e` over `231928b` (dev) · 125 files, +1056 −6200 · 2026-10-12 |
| Reviewed against | security · performance · security-web · CLAUDE.md · `industry DESIGN.md` · `fdd-architecture (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` |
| Scans | secrets clean · dependencies 0 new, 2 pre-existing · code clean |
| Not applicable | security-llm.md (no model code) · other skills (not in dispatch) |
| Failed to load | none |
| Read outside the diff | 11, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | C | HIGH · `package.json:32` · undeclared dependency | restore `cn@^0.4.0` |
| Performance | A | — | — |
| CLAUDE.md | A | LOW · `PictureQuestion.tsx:74` · stale comment | optional |
| industry DESIGN.md | A | — | — |
| fdd-architecture | A | — | — |
| vercel-react-best-practices | A | — | — |
| tailwind-v4-best-practices | A | — | — |
| Criteria | C | task 1: `cn` was in use | restore `cn@^0.4.0` |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | Task 1: futures cluster, 1a dead code, 14 shadcn components and their packages removed | `gate.test.ts` safeNextPath refusals, `landing.test.ts` "never send her to the futures" | partly: `cn` was in use |
| 2 | Task 1: `/futures` → `/onboarding` permanent redirect | — | not automatable (config) |
| 3 | Task 1: no migration; `seen_futures`, `reminders`, `'futures'` in STEPS, `Reminder`, `reminderSchema`, `FUTURE_IDS`, `Profile.reminders` kept | `profile.test.ts` (DB, by path) | met |
| 4 | Task 2: `Screen` fields gone, step 01 wrappers replaced, one resume function, `SIGNIN_PATH` | `onboarding.test.ts`, `landing.test.ts`, `gate.test.ts` | covered |
| 5 | Task 2: copy and table tests gone, every rule test kept | spot-check of the diff | met |
| 6 | Task 3: `SaveFailed`, `StepActions`, `StepKicker`/`StepHeading`, `Note`, `useSubmit`, motion module, messages, limits, `FrameMarks` | `answer-save.test.tsx` (useSubmit), `WelcomeScreen.test.tsx` (focus), `QuestionScreen.test.tsx` | covered |
| 7 | Task 3: same motion under the same reduced-motion rule | read of every module | not automatable |
| 8 | Task 4: stale e2e removed, one-line fixes, checklists, docs and comments | `bun run type-check` (e2e not run, by plan) | met, one comment left |
| 9 | No behaviour change on a live screen | controller's stills after task 3 | at risk: class-merge engine downgraded |

Row 9: `cn()` is the class merger behind every component; it now resolves to `cn@0.2.6` (the `shadcn` CLI's own copy) instead of `cn@0.4.0`. The stills matched, so no change was seen, but the engine every screen depends on is no longer the one the repo chose.

## Read outside the diff
- `src/shared/lib/utils.ts:1` — imports `createCn` from `cn/config`: the removed package is in use.
- `node_modules/cn/package.json` — resolves to 0.2.6, hoisted from `shadcn`/`@shadcn/registry`; base lock had 0.4.0 as a direct dependency.
- `.husky/pre-push:3` — runs `test:run`, so dropping the duplicate `test` script is safe.
- `src/app/(app)/` — only `onboarding` and `start` remain; no live page lost its matcher or `APP_PATHS` entry.
- `src/shared/lib/db`, migrations — no change on this branch; `getProfile` still parses `reminders` with `reminderSchema`.
- `bun.lock` at `231928b` — `braces@3.0.3` and `esbuild@0.18.20` (via `@esbuild-kit`) identical before and after: pre-existing.
- `src/features/opening/model/onboarding.ts:362` — `firstOpenQuestion` returns a key with a `'where'` fallback, so `/onboarding/facts` and the resume rule never get the bare step path (no redirect loop).
- `.next/static/chunks/2fjq0m3b9hobq.js` — `markFrame` exports `sign-in…markFrame` plus motion's `d1`: cross-file `composes` resolved in the build.
- `src` grep for removed module classes (`styles.page`, `shell.rise`, `picture.errorIn`, …) — none left; worth doing because CSS-module typings would not catch them.
- `e2e` grep for `tap`, `PRIYA`, `answerOpening`, `OpeningAnswers` — none left; `STUDENT_APP_URL` consumers still match `/start` and `/onboarding/…`.
- `node_modules/next/dist/docs/…/proxy.md` §Execution order — config redirects run before the proxy, so `/futures` needs no matcher entry.

## Findings, by file

### `package.json`

**HIGH · line 32 · undeclared runtime dependency**
- What: Task 1 ran `bun remove cn`, but `src/shared/lib/utils.ts:1` imports `createCn` from `cn/config`. It still resolves only because `shadcn` and `@shadcn/registry` pull in `cn@0.2.6`, which bun hoists.
- Why: Every `cn()` call in the app now runs on a version nobody picked (0.4.0 → 0.2.6), and it will break when `shadcn` drops or bumps its own copy, or under an isolated install.
- Rule: `security.md` §5 (a dependency is declared and locked) and plan task 1 ("check each is unused first"); the audit's grep missed `'cn/config'` · a test would have caught it: no, hoisting hides it. A missing-dependency lint rule would.
- Fix: `bun add cn@^0.4.0` (the base range) so the lockfile regenerates. Then rerun `src/shared/lib/utils.test.ts` and correct the audit's §6 line about `cn`.

### `src/features/opening/components/PictureQuestion.tsx`

**LOW · line 74 · stale comment**
- What: The JSX comment that moved with the focus effect still says "Back from screen 1"; the doc comment above it was updated to "step 01".
- Why: Audit §6 lists this file's "screen 1" wording as contradicting the code, and task 4 fixes those.
- Rule: plan task 4, CLAUDE.md "Surgical changes" (a comment that no longer matches) · a test would have caught it: no, a comment.
- Fix: "Back from step 01".

## Top 3 priority fixes
1. `package.json:32` — `bun add cn@^0.4.0`, then rerun `utils.test.ts`.
2. `PictureQuestion.tsx:74` — "screen 1" → "step 01".

## Done well
- The motion merge kept its behaviour. Longhands on `.frame`, `markFrame`/`cardFrame` composing the shared delays, and `.question > :not([role="alert"])` all keep each delay and entrance whatever order the modules load in. Every animation still sits under `prefers-reduced-motion: no-preference`.
- The access surface shrank cleanly. `APP_PATHS`, the matcher and `RETURN_PATHS` agree, `safeNextPath` now refuses `/futures` and `/attention` with a new test, and the unused `addReminderAction` server action is gone.
- `useSubmit` replaced two hand-written copies with one hook. Its tests pin the rules that matter: retrying the same value, staying pending once saved, and `SAVE_FAILED` when the request never arrives.

## Built but not asked for
- Nothing. `tap` and `PRIYA` were removed whole rather than trimmed, but their only callers went with this branch.

## Blind spots
- The phantom `cn` passed type-check, the build and the unit tests. Only a dependency lint (an undeclared-import rule) or a clean isolated install would catch it.
- Motion was not compared, only stills. A short reduced-motion and full-motion screen recording of `/`, `/admin/sign-in`, `/onboarding/character`, a step 01 failed save and `/onboarding/attention` would confirm the merge.
- The e2e edits were type-checked, not run. Run `onboarding-study`, `onboarding-welcome`, `student-opening-three-futures` and `coins-and-return` on the next QA pass.

---
Stack: TypeScript, React 19, Next.js 16 (App Router, proxy, server actions), CSS Modules with cross-file `composes`, Tailwind 4, Playwright, bun test. Passes applied shallowly: motion was judged by reading the CSS cascade, not by watching it.

## Fixes applied

- HIGH · `package.json`: `cn@^0.4.0` restored (`src/shared/lib/utils.ts` imports `cn/config`; the audit's "no import" missed the subpath). Fixed in the commit below.
- LOW · `PictureQuestion.tsx`: "screen 1" now reads "step 01". Fixed in the commit below.
