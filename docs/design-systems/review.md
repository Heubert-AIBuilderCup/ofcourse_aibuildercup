# Design systems and the Industry sign-in page — Code Review

**Request changes.** 0 CRITICAL · 1 HIGH · 5 MEDIUM · 8 LOW

| | |
| --- | --- |
| Blocking | HIGH · `sign-in.module.css:289-296` · the reduced-motion block loses on specificity: the headline still slides in, the corner marks still rotate in, hover transitions still run |
| Branch | `main` at no commit (working tree over the empty tree) · 28 files, +2493 −0 · 2026-10-04 |
| Reviewed against | security.md · security-web.md · performance.md · CLAUDE.md (Code, Design, Behaviour) · `tailwind-v4-best-practices (SKILL.md)` · `vercel-react-best-practices (SKILL.md + rules/rerender-use-ref-transient-values.md)` |
| Scans | secrets N/A (gitleaks not installed) · dependencies 0 new, 2 pre-existing · code N/A (semgrep not installed) |
| Not applicable | security-llm.md (no model code) · fdd-architecture, vercel-composition-patterns (excluded by dispatch) · tailwind `references/theming.md` (dark selector settled by grep) |
| Failed to load | `.claude/skills/*` in this repo are symlinks to a missing `.agents/skills` (setup-ai-skills.sh not run); both SKILL.md files were read from a sibling checkout of the same skills |
| Read outside the diff | 10 — listed below |

Dependencies: `braces` 3.0.3 (high, via micromatch → lint-staged) and `esbuild` 0.18 (moderate, via drizzle-kit → @esbuild-kit) are dev-tooling transitives the diff did not add or bump; neither counts toward the decision. The esbuild advisory concerns its own dev server, which this project never runs.

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | — | — |
| Performance | B | MEDIUM · `SignInPanel.tsx:21-25` · re-render per mousemove | refs and direct style writes |
| CLAUDE.md (Code, Design) | B | MEDIUM · `dialog.tsx:475` · Tailwind palette colour | `bg-foreground/80` |
| tailwind-v4-best-practices | B | MEDIUM · `page.tsx:51` · overline type repeated as arbitrary values | one `--text-overline` token or utility |
| vercel-react-best-practices | B | MEDIUM · `SignInPanel.tsx:21-25` · state for a transient value | `useRef` + DOM write |
| Criteria | C | HIGH · `sign-in.module.css:289` · reduced motion incomplete | wrap motion in `no-preference` |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | Two columns from the design's auto-fit grid, stacking under 520px | — | uncovered |
| 2 | Dark panel: grid paper, drift, scanline, brand frame, kicker with cursor, two-line headline, lede, four cells | — | uncovered |
| 3 | Crosshair follows the pointer with an `X 0000 · Y 0000` readout | — | uncovered |
| 4 | Load sequence with the design's delays (d1–d8, mark and cell offsets) | — | not automatable |
| 5 | Every animation and transition stops under `prefers-reduced-motion` | — | uncovered, and not met |
| 6 | Hover: marks spread 3px, arrow nudges 4px | — | uncovered |
| 7 | Framed 400px card with kicker, "Welcome back", helper line, one primary action | `e2e/smoke.e2e.ts:8` (button only) | partly covered |
| 8 | "Continue with Google" starts Google and returns to `next` | `GoogleSignIn.test.tsx:19-27` | covered |
| 9 | A refused start shows a generic message, never the provider's text | `GoogleSignIn.test.tsx:29-35` | covered |
| 10 | `?error=signin` shows the callback failure line on the page | — | uncovered |
| 11 | Signed in, `/` redirects to a safe `next` or the dashboard | `e2e/smoke.e2e.ts:3-13` (signed-out half) | partly covered |
| 12 | Switching the design system is one line; nothing else hard-codes a system | — | uncovered, verified by reading |
| 13 | `src/shared/components/ui` reads only the shadcn variables | `inventory.test.ts` (files exist only) | uncovered, one exception |
| 14 | Frame marks render only when a system sets `--ds-frame-marks` | — | uncovered, verified by reading |
| 15 | Each system supplies OKLCH tokens, next/font fonts and a DESIGN.md; Neutral leaves `--ds-font-body` defined | — | uncovered, verified by reading |

Row 5: the design's rule used `!important`; the port dropped it and `.page *` (0,1,0) now loses to `.line > span` (0,1,1), `.frame > [data-frame-mark]` (0,2,0), `.spread [data-frame-mark]` and `.spread .arrow` (0,2,0). The dispatch note said the module uses `!important` under reduce-motion; it does not.
Row 12: the switch is `index.ts` plus the CLAUDE.md "Design" pointer, as the README says; grep found no `industry`, `barlow` or `--ds-*` outside `src/design-systems` except the `--ds-*` contract in `globals.css`. The sign-in page itself is Industry's vocabulary (grid paper, cells, kickers) and stays so under Neutral; that is content, not a hard-coded system, but worth a line in `src/design-systems/README.md`.
Row 13: the exception is `bg-black/80` on the dialog overlay (finding below).

## Read outside the diff
- `src/shared/lib/theme.ts:13-24` — cookies parsed to `light | dark | system`; one `data-theme` resolver.
- `src/shared/components/Providers.tsx:66-68` — client writes `documentElement.dataset.theme`; the same `[data-theme='dark']` selector as `globals.css:7` and both `theme.css` files: dark mode has one switch.
- `src/shared/lib/auth/gate.ts:42-49` — `safeNextPath` is a path regex plus a prefix allowlist; no other origin or scheme passes, so `redirect(next)` on `page.tsx:28` is not an open redirect.
- `e2e/smoke.e2e.ts:3-13` — the only browser test of the page: button visible, signed-out `/dashboard` lands on `/`.
- grep `industry|barlow|--ds-` in `src` outside `src/design-systems` — comments and the `--ds-*` contract only.
- grep `components/ui/card` in `src` — `Card` is imported nowhere; the admin uses the `card` class string instead.
- `package.json`, `bun.lock:170,510,610,640` — `braces` and `esbuild` arrive through lint-staged and drizzle-kit; `lucide-react`, `class-variance-authority`, `@radix-ui/react-slot` were already dependencies.
- `next.config.*`, `src/proxy.ts` — no CSP or frame headers exist; pre-existing, not this change.
- `.claude/skills/` — dangling symlinks; skills read from `eevs-npl` and `expert-predict` checkouts.
- `bun test GoogleSignIn.test.tsx inventory.test.ts` — 3 pass; the CSS-module import works under bun test.

## Findings, by file

### `src/features/auth/components/sign-in.module.css`

**HIGH · line 289 · reduced motion incomplete**
- What: `.page *, .page *::before, .page *::after { animation: none; transition: none }` has specificity (0,1,0). `.line > span` (0,1,1), `.frame > [data-frame-mark]` (0,2,0), `.spread [data-frame-mark]` and `.spread .arrow` (0,2,0) all set `animation`/`transition` and win, so under `prefers-reduced-motion: reduce` the two headline lines still slide up 105%, every corner mark still rotates in, and the button's hover transitions still run.
- Why: the design states, and the module's own header promises, that all motion stops under reduce-motion; a user who asked for no motion still gets sliding text at 56px.
- Rule: design criterion 5; `security-web.md` has no motion section, this is WCAG 2.3.3 · a test would have caught it: yes, a Playwright check with `emulateMedia({ reducedMotion: 'reduce' })` asserting `getComputedStyle(el).animationName === 'none'` on `.line > span` and `[data-frame-mark]`.
- Fix: invert the gate so no specificity fight exists: wrap every `animation:` and `transition:` declaration in `@media (prefers-reduced-motion: no-preference) { … }` and delete the `reduce` block. (Restoring the design's `!important` also works and is the one place it is idiomatic, but the media wrap needs none.)

**LOW · line 2276 · cell flash colour**
- What: `cellScan` flashes `--panel-accent` (accent-300) at 38%; the design flashes `--color-accent` (the steel 500, which is `--primary` here).
- Why: the cells read paler than the artboard; small, but it is the one ambient colour on the panel.
- Rule: design criterion 2 · a test would have caught it: no, visual.
- Fix: `color-mix(in oklch, var(--primary) 38%, transparent)`.

### `src/features/auth/components/SignInPanel.tsx`

**MEDIUM · line 21-25 · React state for pointer position**
- What: every `mousemove` calls `setCross`, re-rendering the whole panel (brand, headline, four cells, their marks) at pointer-event rate; on screens under `md` the crosshair is `hidden` but the state churn still happens.
- Why: a transient DOM-adjacent value drives React's reconciler sixty or more times a second for three `style` attributes; the cost grows with pointer-event rate, not data, which is why it does not show in tests.
- Rule: `vercel-react-best-practices` §rerender-use-ref-transient-values; `performance.md` §2 recomputation where input did not change · a test would have caught it: no, a render-count assertion only.
- Fix: keep the crosshair nodes in refs and write `style.transform` / `textContent` in the handler (or set `--mx`/`--my` custom properties on the section and position the lines with `left: var(--mx)`), toggling visibility with one boolean state on enter/leave. While there, the static panel can stay a server component with a small client `Crosshair` child that listens on `parentElement`, so only the tracker ships as JS.

**LOW · line 2009, 2015, 1988 · small deviations and a type lie**
- What: the cells are `max-sm:hidden` and the crosshair `hidden md:block` — neither is in the design, which shows both at every width; `styles[\`c${i + 1}\` as 'c1']` builds a CSS-module key and casts it; the blinking `_` cursor is read aloud as "underscore".
- Why: two silent scope decisions and a cast that hides a typo at compile time.
- Rule: CLAUDE.md Behaviour §1 "surface tradeoffs"; design criteria 2–3 · a test would have caught it: no.
- Fix: say in the page comment why cells and crosshair are dropped on small screens (or keep them); make `CELLS` carry its class, `[['A1', styles.c1], …]`; `aria-hidden` on the cursor span.

### `src/app/page.tsx`

**MEDIUM · line 51 · the overline type role as repeated arbitrary values**
- What: the 10–11px uppercase `tracking-widest` overline appears as `text-[0.625rem]` here, three times in `SignInPanel.tsx` (crosshair label, kicker at `0.6875rem`, cells) and again as literal `font-size: 0.6875rem; letter-spacing: 0.08em` on `[data-slot="table-head"]` in `industry/theme.css:705-709`.
- Why: a recurring type role written five ways will drift; Industry's DESIGN.md calls kickers and overlines a system role.
- Rule: `tailwind-v4-best-practices` §2 semantic utilities over arbitrary values; severity table, repetition of three or more · a test would have caught it: no, a convention.
- Fix: one `--text-overline` / `--text-overline--letter-spacing` pair in `@theme` (or an `@utility overline`) sourced from a `--ds-*` variable each system sets; use it in the page, the panel and the Industry table head.

**LOW · line 503 · the page is Industry regardless of system**
- What: grid paper, scanline, cells and the blueprint card are Industry's vocabulary; under Neutral the marks vanish but the composition remains.
- Why: the README claims a one-line switch; it is true for tokens, fonts and marks, and the sign-in page should say it is a design, not a system artefact.
- Rule: criterion 12 · a test would have caught it: no.
- Fix: one sentence in `src/design-systems/README.md`: the sign-in page is built from the Industry artboard and is redesigned, not switched.

### `src/features/auth/components/GoogleSignIn.tsx`

**LOW · line 1886 · arrow renders 16px, not 14px; marks skip the mark-in**
- What: `size-3.5` on the `ArrowRight` loses to `buttonVariants`' `[&_svg]:size-4` (a descendant selector, specificity 0,1,1), so the arrow is 16px; and the button carries `styles.spread` but not `styles.frame`, so its marks never run `markIn` at the design's 1.5s.
- Why: DESIGN.md fixes label icons at 14px; the design's last beat of the load sequence is the button's marks.
- Rule: design criteria 4 and 7; Industry DESIGN.md §Icons · a test would have caught it: no, computed style only.
- Fix: `[&_svg:not([class*='size-'])]:size-4` in `buttonVariants` (shadcn's current form), and add `styles.frame` with a `.frame.btn > [data-frame-mark] { animation-delay: 1.5s }` rule or equivalent.

### `src/shared/components/ui/dialog.tsx`

**MEDIUM · line 475 · Tailwind palette colour on the overlay**
- What: `DialogOverlay` is `bg-black/80`.
- Why: CLAUDE.md Code says semantic tokens only and both DESIGN.md files say never Tailwind's palette; the components' contract with the design-system layer is that they read only the variables.
- Rule: CLAUDE.md §Code; `tailwind-v4-best-practices` §1 design tokens · a test would have caught it: no, a convention.
- Fix: `bg-foreground/80`, or a `--overlay` variable each system sets if a system wants a tinted scrim.

**LOW · line 2500 · close icon at the default stroke**
- What: `<X className="h-4 w-4" />` uses Lucide's stroke 2; Industry DESIGN.md says 1.5, "never thicker".
- Why: the one icon every Industry dialog shows is drawn heavier than the system allows, and the component cannot know the system.
- Rule: Industry DESIGN.md §Icons · a test would have caught it: no.
- Fix: a `--ds-icon-stroke` variable (Neutral 2, Industry 1.5) and `[data-slot] svg { stroke-width: var(--ds-icon-stroke) }` in `globals.css`, so the component stays system-agnostic.

### `src/design-systems/industry/theme.css`

**MEDIUM · line 711 · `::selection` hard-codes the light accent**
- What: `background: oklch(0.586 0.073 248.5 / 30%)` repeats `--primary`'s light value instead of reading it; the dark theme's `--primary` is different, so the selection colour does not follow the theme.
- Why: the one literal colour in a file whose purpose is to make everything follow the variables.
- Rule: CLAUDE.md §Code semantic tokens; `tailwind-v4-best-practices` §1 · a test would have caught it: no.
- Fix: `background: color-mix(in oklch, var(--primary) 30%, transparent)`.

**LOW · line 626 · shadows on transparent line drawings**
- What: `--card: transparent` makes cards line drawings, but `card.tsx:2394` keeps `shadow-sm` and `DialogContent` `shadow-lg`, so a shadow halo surrounds a frame with no fill.
- Why: DESIGN.md's first rule is "a hairline border, no fill".
- Rule: Industry DESIGN.md §Rules · a test would have caught it: no.
- Fix: in this file's `@layer components`: `[data-slot="card"], [role="dialog"] { box-shadow: none }` (add `data-slot="dialog-content"` to `DialogContent` for symmetry with the README's data-slot convention).

### `src/design-systems/industry/index.ts`

**LOW · line 582 · font weights do not match the utilities used**
- What: Barlow loads 400/500/700, but the admin uses `font-semibold` (600) on body text in seven places (`UserPage.tsx:1037,1047,1322`, `UsersList.tsx:1432,1616,1633,1754`); nothing in the diff uses `font-bold`.
- Why: the browser substitutes 700 for a 600 request, so "semibold" reads as bold, while a weight nobody asked for is on the critical path (next/font preloads each weight).
- Rule: `performance.md` §5 assets no one displays · a test would have caught it: no.
- Fix: load `['400', '500', '600']` or change the body-text `font-semibold` to `font-medium`; drop 700 unless something uses it.

### `src/features/admin/components/styles.ts`

**MEDIUM · line 1784 · a second Card, by hand, four times**
- What: `card` = `'relative rounded-lg border bg-card p-5 text-card-foreground'` duplicates `Card`'s classes, and every user inserts `<FrameMarks />` itself (`UserPage.tsx:1019-1020`, `UsersList.tsx:1439-1440, 1677-1678, 1742-1743`); `Card` from `ui/card` is imported nowhere.
- Why: the marks were put inside `Card` so callers would not have to remember them; four manual insertions is the repetition that `Card` exists to remove, and the next framed section will forget one.
- Rule: severity table, repetition of three or more; Industry DESIGN.md "a new framed object is `relative border` with `<FrameMarks />` inside" — true, but `Card` already is one · a test would have caught it: no.
- Fix: render `<Card asChild>`-style or `<Card className="p-5">` in the admin (a `section` variant can take an `as` prop) and delete `card` from `styles.ts`. Each insertion checked is inside a `relative` element and before content, so this is duplication, not a defect.

### `src/features/admin/components/UserPage.tsx`

**LOW · line 908 · two error helpers, one message twice**
- What: `useControl` here and `useAdminAction` in `../hooks` do the same job; `'Could not reach the server. Please try again.'` is a constant here and an inline literal at `UsersList.tsx:1671`.
- Why: two hooks for one pattern diverge; the file also holds ten components in 481 lines.
- Rule: quality, duplicated logic · a test would have caught it: no.
- Fix: extend `useAdminAction` with the "keep the error beside the control" mode and export the message from it; move `Confirm` and `Toggle` to their own files.

### `src/app/globals.css`

**LOW · line 352, 359 · 1px hairlines under "rem not px"**
- What: the marks' strokes are `width: 1px` / `height: 1px`; `sign-in.module.css:2081` draws its grid lines at 1px too.
- Why: acceptable: a hairline must be one device pixel and `0.0625rem` would scale with the root font size and blur; but CLAUDE.md states the rule without the exception, so the next reader will "fix" it.
- Rule: CLAUDE.md §Code "rem not px" · a test would have caught it: no.
- Fix: add "(hairlines stay 1px)" to the CLAUDE.md rule, and prefer Tailwind's `h-px` / `w-px` where a class is possible, as `SignInPanel.tsx:1940,1946` already does.

## Top 3 priority fixes
1. `sign-in.module.css:289` — wrap every `animation`/`transition` in `@media (prefers-reduced-motion: no-preference)` and delete the reduce block.
2. `SignInPanel.tsx:21` — track the pointer with refs and direct style writes; one boolean state for show/hide.
3. `dialog.tsx:475`, `industry/theme.css:711` — `bg-foreground/80` and `color-mix(in oklch, var(--primary) 30%, transparent)`: the last two literals in the variable contract.

## Done well
- Fonts come through `next/font` per system, self-hosted with `display: swap`; the artboard's `fonts.googleapis.com` link is gone, so the page adds no third-party origin and no render-blocking stylesheet.
- The variable contract is clean: `neutral/theme.css` is the template every system must fill, `--ds-frame-marks` gates the marks in one place, `--ds-font-*` bridge into `@theme inline`, and dark mode has exactly one selector across `globals.css`, both theme files, `layout.tsx` and `Providers.tsx`.
- `page.tsx` awaits `searchParams` and the session together, funnels `next` through `safeNextPath`, and shows a generic failure line; `GoogleSignIn.test.tsx` asserts the callback arguments and that the provider's message never reaches the screen.

## Built but not asked for
- Cells hidden under `sm` and the crosshair hidden under `md`; panel padding reduced on phones — sensible, but not in the artboard and not recorded.
- A derived dark theme for Industry (the system ships light only) — needed by the starter's theme toggle; documented in `theme.css`.
- `[data-slot="table-head"]` overline styling in Industry — a reasonable extension of DESIGN.md.

## Blind spots
- Fidelity (criteria 1–4, 6–7) and the reduced-motion contract are invisible to unit tests; a Playwright spec with a 1440px and a 390px screenshot of `/`, plus `emulateMedia({ reducedMotion: 'reduce' })` asserting `animationName === 'none'` on `.line > span`, `[data-frame-mark]` and the grid section, would hold the design in place.
- The design-system switch (criteria 12–15) has no test; a Playwright check that `[data-frame-mark]` is `display: none` when `index.ts` exports `neutral`, and `block` for `industry`, would catch a system that forgets a variable.
- No CSP exists in the repo; when one is added, the crosshair's inline `style` attributes will need `style-src-attr` or a class-driven alternative. Pre-existing, not this change.

---
Stack: TypeScript · Next.js 16 App Router (RSC, `next/font`) · React 19 · Tailwind 4 CSS-first with one CSS module · shadcn/Radix · bun test + Testing Library · Playwright. Passes applied shallowly: none; dependency audit folded from `bun audit` output without re-running it.

## Outcome · 2026-10-04

Instruction: fix all valid. All 14 findings judged valid; none out of reach, deliberate or moot.

Fixed, all 14. Two notes:
- `UserPage.tsx` duplicated error handling: the shared `NETWORK_ERROR` constant was applied; the suggested file split is polish, not a defect, and was left.
- `SignInPanel.tsx` small deviations: hiding the cells under `sm` and the crosshair under `md` was deliberate and is now recorded in a comment; the cast and the cursor's `aria-hidden` were fixed.

Deviations from the suggested fixes: the Industry `box-shadow: none` rule sits outside `@layer components`, because Tailwind's shadow utilities live in `@layer utilities` and an unlayered rule wins without `!important`. The button's svg selector is `[&_svg:not([class*=size-])]:size-4`, unquoted, to fit the cva string.

Added: `e2e/sign-in.e2e.ts` (error line, reduced motion, phone width), not yet run. After the fixes: lint clean, type-check clean, 166 tests pass, production build succeeds.
