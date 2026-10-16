# Onboarding welcome — Code Review

**Request changes.** 0 CRITICAL · 1 HIGH · 0 MEDIUM · 3 LOW

| | |
| --- | --- |
| Blocking | HIGH · `src/app/(app)/onboarding/(shell)/welcome/page.tsx:13` · new page has no test proving signed-out and admin visitors are refused |
| Branch | `feat/onboarding-welcome` at `77f0bd4` over `origin/dev` (`f1e2492`) · 21 files, +776 −62 · 2026-10-08 |
| Reviewed against | security · security-web · performance · CLAUDE.md (+ AGENTS.md, PRODUCT.md) · `vercel-react-best-practices (SKILL.md)` · `fdd-architecture (SKILL.md)` |
| Scans | secrets clean · dependencies N/A (no lockfile change) · code clean (semgrep p/owasp-top-ten, 0) |
| Not applicable | security-llm.md (no model code) · tailwind-v4-best-practices (no new CSS) · vercel-composition-patterns (no composition change) · industry DESIGN.md (look is manual) |
| Failed to load | none |
| Read outside the diff | 10 — listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | C | HIGH · `welcome/page.tsx:13` · no refusal test | e2e: signed-out and admin refused |
| Performance | A | — | — |
| CLAUDE.md | A | LOW · `character/page.tsx:7` · stale comment | optional |
| vercel-react-best-practices | A | — | — |
| fdd-architecture | A | LOW · `WelcomeScreen.tsx:42` · unused prop | optional |
| Criteria | A | 2 not automatable | — |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | persona null: `/` and `/onboarding` open the welcome | `landing.test.ts:13`, `onboarding-welcome.e2e.ts:13`, `:51` | covered |
| 2 | step 00 answered: welcome sends her on | `landing.test.ts:63`, `onboarding-welcome.e2e.ts:83` | covered |
| 3 | greeting with or without name, heading, lede | `WelcomeScreen.test.tsx:29`, `:36`, `onboarding-welcome.e2e.ts:62` | covered |
| 4 | three points, each with an icon | `WelcomeScreen.test.tsx:42` | covered |
| 5 | "First · optional" note; Start to step 00; no Back or Skip | `WelcomeScreen.test.tsx:52`, `onboarding-welcome.e2e.ts:13` | covered |
| 6 | panel: none current, 00 Optional, segments unlit, band text | `OnboardingPanel.test.tsx:41`, `onboarding-welcome.e2e.ts:105`, `:121` | covered |
| 7 | header menu present; both themes | `onboarding-welcome.e2e.ts:144` (menu); themes manual | not automatable |
| 8 | matches the boards at the ten widths | manual | not automatable |
| 9 | focus on heading; Tab reaches menu and Start; suites pass | `WelcomeScreen.test.tsx:66`, `onboarding-welcome.e2e.ts:144` | covered |
| 10 | PRODUCT.md and CLAUDE.md include the welcome | diff of both files | covered |

Criterion 4: the copy is exact, but no test checks that each point has an icon. Criterion 9: I ran the four changed unit files (43 pass). I did not run the full unit or e2e suites. Copy rule: "Nothing is ranked or recommended" does not break criterion 2 of `docs/student-opening-three-futures/intent.md`. That criterion only covers the screens of that slice, and PRODUCT.md line 3 uses the same negation.

## Read outside the diff
- `src/proxy.ts:43`, `src/shared/lib/auth/gate.ts:26` — `/onboarding/:path*` and the `/onboarding` prefix already cover `/onboarding/welcome`, so no change is needed.
- `src/shared/lib/auth/session.ts:40` — `requireStudent` sends a signed-out visitor to sign-in and an admin to `ADMIN_PATH`.
- `src/features/opening/model/landing.ts:29` — `landingPath` delegates to `onboardingResumePath` when persona is null, so both send a new student to the welcome. Every other case is unchanged.
- `src/app/(app)/start/page.tsx`, `src/app/(app)/onboarding/page.tsx` — both still route through `landingPath` / `onboardingResumePath`.
- `src/app/(app)/onboarding/(shell)/character/page.tsx` — no redirect to the welcome, so step 00's own URL still opens. Its doc comment is now stale (LOW).
- `src/features/opening/components/OnboardingPanel.tsx:100-135` — Done/Now/Optional branches with `step = -1`. Steps 00 and 01 behave as before. The unused `badge` value on the welcome is harmless.
- `src/features/opening/components/OnboardingShell.tsx:18-20` — the shell renders the panel and `AccountMenu` on every page in `(shell)`, the welcome included (criterion 7).
- e2e specs not changed by this branch (`dark-mode*.e2e.ts`, `welcome.e2e.ts`, `student-sign-in.e2e.ts`, others with `goto('/')`) — none expects `/` to land on step 00. `STUDENT_APP_URL` matches `/onboarding/welcome`.
- `e2e/onboarding.e2e.ts:80`, `src/shared/lib/auth/gate.test.ts:24` — the signed-out refusal test covers step 01 only; nothing covers the welcome.
- `src/app/globals.css:57,88,94` — `size-icon-lg`, `accent-100` and `accent-700` exist as tokens.

## Findings, by file

### `src/app/(app)/onboarding/(shell)/welcome/page.tsx`

**HIGH · line 13 · new access path with no refusal test**
- What: The new page calls `requireStudent()`, and the proxy matcher covers it. No test shows that a signed-out visitor or an admin is refused at `/onboarding/welcome`.
- Why: The page is a new signed-in path. Without a test, a later layout or matcher change could expose it and nothing would fail.
- Rule: `security.md` §3, "a new endpoint … is unauthenticated until proven otherwise" · a test would have caught it: yes, an e2e refusal case. None exists for this path.
- Fix: Add to `e2e/onboarding-welcome.e2e.ts` the case from `onboarding.e2e.ts:80`: a signed-out visit to `/onboarding/welcome` gets `/` with no welcome heading. Add the same for an admin session (lands on `/admin/users`).

### `src/features/opening/components/WelcomeScreen.tsx`

**LOW · line 42 · prop with no consumer**
- What: `minutes?: number`, which defaults to `WELCOME_MINUTES`, is never passed. The only caller is the page, which leaves it unset.
- Why: It is configurability nobody asked for. The intent leaves timing out of scope.
- Rule: `fdd-architecture` §YAGNI ("If a prop has no current consumer, remove it") and CLAUDE.md "Simplicity First" · a test would have caught it: no, a convention.
- Fix: Use `WELCOME_MINUTES` directly in the heading and drop the prop.

**LOW · lines 47, 61 · unused id**
- What: `useId()` gives the `h1` an `id` that nothing references (no `aria-labelledby`, no link).
- Why: It is dead code that makes a reader look for a connection that does not exist.
- Rule: Quality, names that say what things are · a test would have caught it: no.
- Fix: Remove `headingId` and the `id` attribute, or add the `aria-labelledby` it was meant for.

### `src/app/(app)/onboarding/(shell)/character/page.tsx`

**LOW · line 7 · comment no longer matches**
- What: The doc comment still says "a new student lands here (landingPath)". After this branch she lands on the welcome.
- Why: The comment misleads the next reader about where the landing rule points.
- Rule: LOW, a comment that no longer matches · a test would have caught it: no.
- Fix: Change it to "reached from the welcome's Start".

## Top 3 priority fixes
1. `e2e/onboarding-welcome.e2e.ts` — add signed-out and admin refusal cases for `/onboarding/welcome`.
2. `src/features/opening/components/WelcomeScreen.tsx:42` — drop the unused `minutes` prop.
3. `src/app/(app)/onboarding/(shell)/character/page.tsx:7` — update the stale landing comment.

## Done well
- The landing change is one line in the single rule (`onboardingResumePath`), and the start page, the onboarding page and the welcome's own redirect all go through it. Every persona-null case was updated in both test blocks.
- The panel's welcome state adds a `PanelState` without touching the step 00/01 branches. The new `data-lit` hook is pinned for step 00 and step 01 too, not only the welcome.
- The e2e flows go through a single `startOnboarding` helper. The no-name case signs in with a real email code, and none of the specs use fixed waits.

## Built but not asked for
- The `minutes` prop on `WelcomeScreen` (see LOW).
- CLAUDE.md's new testing lines (commit `3ff68ff`, "test the brain, not the beauty"): a process change unrelated to the welcome. Name it in the PR text or ship it on its own.

## Blind spots
- The AC2 copy scan (`student-opening-three-futures.e2e.ts:113`) starts after the welcome, so no test checks that the welcome's "recommended" stays a negation. A copy test on `WelcomeScreen` with an allowlist for "Nothing is ranked or recommended" would cover it.
- In dark mode, the note's tint (`bg-accent-100/70`, `text-accent-700`) and the icon boxes can only be checked by eye against DKWelcome and DKWelcomePhone. The screenshots in smoke.md are the implementer's claim, not verified here.
- With reduced motion, the entrance (`rise`/`d2`–`d8`) should be off. No test checks it; an e2e with `reducedMotion: 'reduce'` checking computed animation would.

---
Stack: TypeScript, React 19 / Next.js App Router (server page + client component), Tailwind 4 utilities, bun test + Testing Library (happy-dom), Playwright. Passes applied shallowly: visual fidelity (criteria 7, 8) not judged, since DESIGN.md and the canvas were not read. The full unit and e2e suites were not run.

## Fixes applied (2026-10-08)
- HIGH, no refusal test for the welcome: added two cases to `e2e/onboarding-welcome.e2e.ts`. Signed-out visit lands on `/` with "Continue with Google" visible and no welcome heading; an admin session visiting `/onboarding/welcome` lands on `/admin/users` and never sees the heading. No product change.
- LOW, `minutes` prop: dropped; `WelcomeScreen` uses `WELCOME_MINUTES` directly.
- LOW, unused `useId`/`id`: removed `headingId` and the `id` attribute; `tabIndex={-1}` and the focus effect stay.
- LOW, stale comment: `character/page.tsx` now says "reached from the welcome's Start (and with Back from screen 1)".
