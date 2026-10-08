# Dark mode — Code Review

**Request changes.** 1 CRITICAL · 0 HIGH · 3 MEDIUM · 4 LOW

| | |
| --- | --- |
| Blocking | CRITICAL · `theme.css:193` · criterion 8 contradicted: dark hairlines measure 1.52:1 against the 3:1 it asks for |
| Branch | `feat/dark-mode` at `9e6e134` over `origin/dev` · 35 files, +1331 −61 · 2026-10-08 |
| Reviewed against | security · security-web · performance · CLAUDE.md · AGENTS.md · Industry DESIGN.md · `tailwind-v4-best-practices (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` · `fdd-architecture (SKILL.md)` |
| Scans | secrets clean · dependencies N/A (no lockfile change) · code clean (semgrep p/owasp-top-ten) |
| Not applicable | `security-llm.md` (no model calls) · `vercel-composition-patterns` (not dispatched, no compound API) |
| Failed to load | none |
| Read outside the diff | 9, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | B | MEDIUM · `theme-actions.ts:24` · validation untested | test unknown values and `system` |
| Performance | A | — | — |
| CLAUDE.md, DESIGN.md | A | LOW · `AccountMenu.tsx:73` · 18px icon | optional |
| tailwind-v4-best-practices | B | MEDIUM · `page.tsx:52` · on-steel classes ×3 | one shared on-steel constant |
| vercel-react-best-practices | A | LOW · `AccountMenu.tsx:37` · Tab leaves menu open | optional |
| fdd-architecture | A | LOW · `SignOutButton.tsx:13` · hook in component file | optional |
| Criteria | C | CRITICAL · `theme.css:193` · criterion 8 hairlines | amend criterion 8 or the token |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | Dark tokens from the canvas, in OKLCH | `theme.test.ts:98` | covered |
| 2 | Chosen card is the dark accent tint | `theme.test.ts:123`; look manual | covered |
| 3 | Panel and hero the same; dark hairline | `OnboardingPanel.test.tsx:65`, `SignInPanel.test.tsx:27`, `Hero.test.tsx:9` | partly covered |
| 4 | 44px toggle; onboarding menu; no step-01 Sign out | `ThemeToggle.test.tsx:31`, `AccountMenu.test.tsx`, `e2e/dark-mode.e2e.ts:60` | partly covered |
| 5 | Changes at once, stored, no flash | `Providers.test.tsx:76`, `e2e/dark-mode.e2e.ts:16` | covered |
| 6 | Follows device until a choice; cookies cleared returns | `Providers.test.tsx:61`, `e2e/dark-mode.e2e.ts:34` | covered |
| 7 | No choice follows the device | `Providers.test.tsx:61`, `e2e/dark-mode.e2e.ts:34` | covered |
| 8 | Text ≥ 4.5, large/icons/hairlines ≥ 3 | `theme.test.ts:123,129` | contradicted (hairlines) |
| 9 | `color-scheme: dark` | `theme.test.ts:107` | covered |
| 10 | No light leftovers at 390 and 1440 | — | not automatable |
| 11 | Keyboard, reduced motion, suite green | `AccountMenu.test.tsx:90,109`, e2e | covered |
| 12 | DESIGN.md says both themes | `DESIGN.md:3` | covered |

Criterion 1: the test asserts each ramp is redefined, not its value; an independent conversion of all 32 dark tokens (bg, text, surface, accent, three ramps) reproduces the canvas hex exactly. The accent-2 ramp is in neither theme block and no file in `src` uses it. Criterion 3: the hairline is checked only by eye. Criterion 4: the toggle on the admin sign-in page and in the admin console bar is not asserted by any test. Criterion 11: "every existing test still passes" is the implementer's claim; this review did not run the suite.

## Read outside the diff
- `src/shared/lib/theme-actions.ts:9` — the cookie options are httpOnly, `sameSite: lax`, `secure` in production, `path: /`.
- `node_modules/next/dist/compiled/@edge-runtime/cookies/index.js:302` — `delete()` writes an expired cookie and the path defaults to `/`, so `system` really clears the cookie.
- `src/app/layout.tsx:21` — the server renders `data-theme` from both cookies, with `suppressHydrationWarning`, so a stored choice is served with no flash.
- `src/shared/components/Providers.tsx:49` — the device effect and the `data-theme` effect are unchanged; `theme` now comes from the choice state.
- `src/app/globals.css:7,11,236` — `@theme inline` makes the nested `[data-theme="light"]` resolve light values. `--bleed` is set on `split-page` and inherited by `split-corner`.
- grep `dark:` / `data-theme` in `src` — no `dark:` class inside OnboardingPanel, SignInPanel or Hero (or their CSS modules). The splash uses `bg-splash` and `bg-panel`, which did not change. The admin console has no light marker.
- canvas `login.css:14` plus a conversion script — all 32 dark tokens match the canvas. `--border` on `--background` measures 1.52:1.
- `bunx biome check` on AccountMenu, ThemeToggle, Providers — clean with no suppressions, so the plan's `biome-ignore` was not needed.
- `src/features/auth/components/SignOutButton.tsx:17` — `leave()` still awaits `signOut()` (the server ends the session) before `replace` and `refresh`.

## Findings, by file

### `src/design-systems/industry/theme.css`

**CRITICAL · line 193 · criterion 8 contradicted**
- What: in dark, `--border` and `--input` are the text colour at 16% and measure 1.52:1 on the background. Criterion 8 asks for at least 3:1 for hairlines. `theme.test.ts:77` skips them on purpose, and smoke.md lists this under "Needs a decision".
- Why: an acceptance criterion is unmet as written. The `--input` border is also the only boundary of a text field, which WCAG 1.4.11 asks to be 3:1.
- Rule: severity table (criterion contradicted) · a test would have caught it: yes, adding the hairline pair to `largeTextAndIconPairs` fails at 1.52.
- Fix: Jenish decides. Either amend criterion 8 (decorative hairlines exempt, keeping criterion 1's "16%") or raise `--input`, at least, to reach 3:1 and assert it. Criteria 1 and 8 cannot both hold as written.

### `src/shared/lib/theme-actions.ts`

**MEDIUM · line 24 · public action untested**
- What: `setThemeChoice` is an unauthenticated server action. Nothing tests that an unknown value (`'x'`, a number, an object) sets no cookie, or that `'system'` deletes the cookie. The e2e test covers only `'dark'`.
- Why: this is a stranger-callable endpoint whose only control is the input check, and that check has no test.
- Rule: `security.md` §3 (say which check covers a new endpoint), §2 · a test would have caught it: it is the missing test.
- Fix: add a unit test with `next/headers` `cookies()` mocked. Assert that light and dark call `set` with the options, `system` calls `delete`, and anything else calls neither.

### `src/app/page.tsx`

**MEDIUM · line 52 · repeated on-steel classes**
- What: the "light on steel below @5xl" set (`@max-5xl:border-panel-foreground/24 … @max-5xl:focus-visible:outline-panel-accent`) appears three times: here, `admin/sign-in/page.tsx:54` and `AccountMenu.tsx:69`. The two sign-in pages also repeat the whole placement string.
- Why: three copies of one design decision will drift on the next change to the header action.
- Rule: severity table (repetition, three or more) · `tailwind-v4-best-practices` §semantic utilities · a test would have caught it: no, a convention.
- Fix: export one `HEADER_ACTION_ON_STEEL` beside `HEADER_ACTION` (or an `onSteel` prop) and use it in all three places.

### `src/features/admin/components/AdminChrome.tsx`

**MEDIUM · line 19 · criterion 4 placement untested**
- What: no unit test or e2e test asserts the toggle on the admin console bar or on `/admin/sign-in`. Only `/` and onboarding are exercised.
- Why: criterion 4 names all three surfaces, so two of them could lose the toggle without a test failing.
- Rule: Criteria pass · a test would have caught it: yes, a `Switch to dark theme` visibility check.
- Fix: in `e2e/user-management.e2e.ts` (or dark-mode.e2e.ts), assert the toggle is visible on `/admin/sign-in` and on `/admin/users` for an admin.

### `src/features/opening/components/AccountMenu.tsx`

**LOW · line 37 · Tab leaves the menu open**
- What: `onKeyDown` handles Escape, the arrows, Home and End, but not Tab. Focus moves to the page behind while the menu and scrim stay open.
- Why: the ARIA menu pattern closes the menu on Tab. A keyboard user is left with an open menu over content they cannot see.
- Rule: `fdd-architecture` §Accessibility · a test would have caught it: yes, a Tab keydown in `AccountMenu.test.tsx`.
- Fix: on `Tab`, `setOpen(false)` without `preventDefault`, or close on `onBlur` when `relatedTarget` is outside the menu.

**LOW · line 73 · icon size**
- What: the `User` icon is `size-4.5` (18px). DESIGN.md says 16px in an icon button.
- Why: the project rule wins over the canvas's 18px; ThemeToggle uses 16px.
- Rule: DESIGN.md §Rules (icons) · a test would have caught it: no.
- Fix: `size-4`, or record the 18px exception in DESIGN.md.

### `src/features/auth/components/SignOutButton.tsx`

**LOW · line 13 · hook placement**
- What: `useSignOut` lives in a component file. `HEADER_ACTION`, a style constant, is exported from `ThemeToggle.tsx` and imported by another feature.
- Why: FDD names hooks `useX.ts`, and component files export components.
- Rule: `fdd-architecture` §4 naming, §6 hook extraction · a test would have caught it: no.
- Fix: move the hook to `src/features/auth/hooks/useSignOut.ts`, still exported from the index. A follow-up is fine.

### `e2e/dark-mode.e2e.ts`

**LOW · line 49 · fixed wait and tight timeout**
- What: `waitForTimeout(500)` backs a negative assertion, and line 24 asserts the theme change within `timeout: 100`.
- Why: the fixed wait slows the suite and passes vacuously if the listener is slow. The 100 ms timeout can flake on a loaded CI runner.
- Rule: Quality (tests) · a test would have caught it: n/a.
- Fix: keep the 100 ms as the "at once" claim only if CI is stable. For the negative check, assert after an event you can wait on (for example `page.evaluate` reading `matchMedia` after `emulateMedia`).

## Top 3 priority fixes
1. `theme.css:193` — settle criterion 8's hairline clause with Jenish, then assert whatever is decided.
2. `theme-actions.ts:24` — unit-test `setThemeChoice`'s input check and its `system` delete.
3. `page.tsx:52` — one shared on-steel class constant for the three header actions.

## Done well
- The dark set is exact: all 32 tokens convert back to the canvas hex. The test's OKLab matrices are correct and it composites alpha before measuring.
- The theme plumbing is minimal and sound. The choice lives in state, a failed save never reverts the screen, the misuse of `useThemeChoice` is tested, and the cookie keeps httpOnly, lax and secure.
- `useSignOut` is shared rather than copied, and the test asserts the order: `signOut` first, then `replace('/')`.

## Built but not asked for
- `setThemeChoice('system')` deletes the cookie, but no UI calls it (`toggledChoice` returns only light or dark). The plan asked for it; for now it is unused.
- `Hero` (screens 2–4, futures, coins) is marked `data-theme="light"`, and FutureCard's chosen tag got `dark:` overrides. These are sweep fixes for criterion 10, inside scope.

## Blind spots
- Criteria 3 (hairline), 4 (placement, phone band without the duck) and 10 were checked only by screenshots the implementer took, and smoke.md says the light pixel diff was not done. A visual-regression snapshot at 390 and 1440 in both themes would catch drift.
- The menu's `fixed inset-0` scrim sits inside an `@container` (`container-type` makes the container the containing block for fixed elements). It covers the page container, not the viewport, which should be the same area here. Not verified in a browser.
- Tab out of the open menu, and `Space` on "Dark theme", have no keyboard e2e.

---
Stack: TypeScript, React 19 / Next.js (App Router, server actions), Tailwind CSS 4 (CSS-first, container queries), Bun test with happy-dom, Playwright. Passes applied shallowly: none. Visual criteria (3, 10) taken from code and tokens, not from screenshots.

## Fixes applied (2026-10-08)
- CRITICAL · `theme.css:193` · criterion 8 hairlines: settled by amending the intent; inputs also carry the surface fill, so the border is not their only boundary.
- MEDIUM · `theme-actions.ts:24` · `theme-actions.test.ts` mocks `cookies()`: light and dark are stored with httpOnly, lax, `/` and a year; `system` deletes the cookie; `'x'`, `3`, `{}` and `undefined` touch nothing; `rememberSystemTheme` the same. The code already behaved, so the tests passed at once; a broken check fails five of them.
- MEDIUM · `page.tsx:52` · `src/shared/lib/header-action.ts` holds `HEADER_ACTION`, `HEADER_ACTION_ON_STEEL` and `HEADER_ACTION_SIGNIN_SPOT`; both sign-in pages pass the spot, AccountMenu composes the on-steel set, ThemeToggle imports the base.
- MEDIUM · `AdminChrome.tsx:19` · `e2e/dark-mode.e2e.ts`: the toggle shows on `/admin/sign-in` and, for an admin, on `/admin/users`, where a click makes the page dark.
- LOW · `AccountMenu.tsx:37` · Tab and Shift+Tab close the menu without `preventDefault`; `AccountMenu.test.tsx` covers both.
- LOW · `AccountMenu.tsx:73` · the `User` icon is `size-4` (16px).
- LOW · `SignOutButton.tsx:13` · `useSignOut` moved to `src/features/auth/hooks/useSignOut.ts`, still exported from the feature index; `HEADER_ACTION` left ThemeToggle.tsx (above).
- LOW · `dark-mode.e2e.ts:49` · the negative check waits for `matchMedia('(prefers-color-scheme: light)')` instead of 500 ms; the "at once" assertion uses the default timeout.
