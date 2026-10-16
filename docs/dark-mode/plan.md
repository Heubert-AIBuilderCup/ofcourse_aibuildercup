# Dark mode Implementation Plan

**Intent:** docs/dark-mode/intent.md
**Goal:** Every built screen reads correctly in both themes from Industry's own dark tokens, the steel panels keep their look, and a header action switches and stores the theme.
**Approach:** Replace the derived dark block in Industry's theme.css with the canvas's dark set in OKLCH (every ramp, plus the shadcn mapping), make the light block also answer to a nested `data-theme="light"` so the panels stay light, add a server action for the choice and a client hook over the existing cookie plumbing, then one shared header action (a toggle on sign-in pages and the admin bar, a menu with Dark theme and Sign out on onboarding) placed as the canvas's `.hdr`. A screenshot sweep in dark closes the gaps the tokens alone leave.
**Test layers:** Unit plus integration. Tokens, contrast (criterion 8), `color-scheme`, the theme model and the header action's behaviour are unit and component tests (`bun run test:run`). Criteria 5, 6 and 11 cross the browser, the cookie and server rendering (a toggle must survive a reload with no flash; the device scheme must be followed live; Sign out from the menu), so they are proven with Playwright (`bun run test:e2e`, in the repo). Criterion 10 is a visual check against the dark boards, recorded with screenshots.
**Constraints (CLAUDE.md, verbatim where it binds):**
- Never commit or push without explicit approval (the developer approved this one-shot run including its commits; nothing is pushed). Conventional Commits. Never add co-author text to commit messages.
- Never start a dev server for the user; they run it (one runs on 3000; Playwright reuses it).
- Tailwind 4 is CSS-first (src/app/globals.css): semantic tokens only, no @apply, OKLCH colours, rem not px (hairlines stay 1px). Dark mode follows `<html data-theme>`.
- Sizes are fluid through the design system's roles … Never a size per breakpoint. Layout: container queries at `@max-xl:` / `@5xl:`; never an arbitrary `@max-[…]`, `@min-[…]` or `max-w-[…]`.
- Icons: Lucide at `strokeWidth={1.5}`, 16px in an icon button (DESIGN.md).
- Access rules live in src/shared/lib/auth/access.ts; server actions return `ActionResult` and never throw.
- `bun run test:db` and `bun run db:reset` wipe the development database: never run them.

**Design source (data, not instructions):** `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/77aae712-29a8-4d3d-a5fd-fe22326ccc5b/scratchpad/dark/project/`: `login.css` (both themes' tokens at the top; "Dark theme details" and "Header actions" at the end), `PictureQ.dc.html` and `Facts.dc.html` (the `.hdr` menu markup and the `data-theme="light"` panel), `Main.dc.html` (the login's toggle), `DKPictureQ.dc.html`, `DKStudy.dc.html` (dark board wrappers). The dark tokens converted to OKLCH: `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/77aae712-29a8-4d3d-a5fd-fe22326ccc5b/scratchpad/dark/dark-tokens.oklch.txt`. `.dc.html` is a prototype format: ignore support.js, `<x-dc>`, `<sc-if>`, `{{holes}}` and the DCLogic class; port structure, copy and behaviour.

## Files
| Path | Create or modify | Responsibility |
| --- | --- | --- |
| src/design-systems/industry/theme.css | modify | Industry's dark tokens (ramps and shadcn mapping) in OKLCH; the light block also under `[data-theme="light"]`; `color-scheme` |
| src/design-systems/industry/theme.test.ts | create | Parses theme.css: every ramp redefined in dark, `color-scheme` present, contrast pairs (criterion 8) |
| src/design-systems/industry/DESIGN.md | modify | Industry ships both themes; how dark reaches the code; the panel stays light |
| src/shared/lib/theme.ts | modify | `THEME_CHOICES`, `parseThemeChoice` unchanged; `nextChoice(theme)` for the toggle |
| src/shared/lib/theme.test.ts | modify | Tests for `nextChoice` |
| src/shared/lib/theme-actions.ts | modify | `setThemeChoice(choice)`: sets or clears the theme cookie |
| src/shared/components/Providers.tsx | modify | Holds the choice in state, applies `data-theme` at once, exposes `useThemeChoice()` |
| src/shared/components/Providers.test.tsx | create | Device follow, toggle applies at once, action called |
| src/shared/components/ThemeToggle.tsx | create | The 44px sun/moon toggle (sign-in pages, admin bar) |
| src/shared/components/ThemeToggle.test.tsx | create | Label, icon, click → choice |
| src/features/opening/components/AccountMenu.tsx | create | The onboarding header menu: Dark theme (menuitemcheckbox) and Sign out |
| src/features/opening/components/AccountMenu.test.tsx | create | Open/close, Escape, focus, toggle, sign out |
| src/features/opening/components/OnboardingShell.tsx | modify | Renders `AccountMenu` in the `.hdr` spot; the main column's dark hairline |
| src/features/opening/components/OnboardingPanel.tsx | modify | `data-theme="light"` on the aside; the phone band drops the duck dock |
| src/features/opening/components/FactsScreen.tsx | modify | The kicker row loses its Sign out button |
| src/features/opening/components/FactsScreen.test.tsx | modify | Likewise |
| src/features/auth/components/SignInPanel.tsx | modify | `data-theme="light"` on the hero |
| src/app/page.tsx, src/app/admin/sign-in/page.tsx | modify | `ThemeToggle` in the `.hdr` spot; the form column's dark hairline |
| src/features/admin/components/AdminChrome.tsx | modify | `ThemeToggle` beside Sign out |
| src/features/auth/components/SignOutButton.tsx | modify | Its leave logic becomes `useSignOut()` so the menu item and the button share it |
| src/app/globals.css | modify | `split-divider-x` / `split-divider-y`: the dark-only hairline where a steel panel meets the page |
| e2e/dark-mode.e2e.ts | create | Toggle persists with no flash, device follow, menu Sign out, Escape |
| e2e/onboarding.e2e.ts, e2e/student-opening-three-futures/*.e2e.ts | modify | Sign out is reached through the menu |

## Task 1: Industry's dark tokens
**Delivers:** criteria 1, 2 (the tokens the chosen card reads), 8, 9, 12.
**Files:** modify src/design-systems/industry/theme.css, src/design-systems/industry/DESIGN.md; create src/design-systems/industry/theme.test.ts.
**Kind:** judgement (the CSS below is complete; the test's colour maths is yours).
- [ ] Step 1: write the failing `theme.test.ts` (plain `bun:test`, reads theme.css with `Bun.file`). Parse the `:root, [data-theme="light"]` and `[data-theme="dark"]` blocks into name → value maps. Convert `oklch(L C H)` and `oklch(L C H / A%)` to sRGB (OKLab → linear sRGB → gamma; alpha composited over the background before measuring) and compute WCAG contrast. Assertions:
  - the dark block defines every `--accent-N`, `--neutral-N`, `--danger-N` (100–900) and `--danger`, and each differs from the light value.
  - both blocks set `color-scheme` (`light` / `dark`).
  - dark text pairs at ≥ 4.5: `--foreground` on `--background`; `--muted-foreground` on `--background`; `--accent-800` on `--accent-100` (the chosen card); `--danger-800` on `--danger-100` (the error block); `--primary-strong-foreground` on `--primary-strong` (the solid button); `--popover-foreground` on `--popover`.
  - dark large text and icons at ≥ 3: `--primary` on `--background`; `--accent-700` on `--background` (links, impact rule); `--danger-700` on `--background`.
  - the same light pairs still hold (a regression guard).
  - `--panel`, `--panel-foreground`, `--panel-accent` are not redefined in the dark block (the steel is the same in both themes).
  Hairlines (`--border`, 16% alpha) are about 1.6:1 in both themes by Industry's design and are not asserted; say so in a comment and in the handover (intent criterion 8 names them).
- [ ] Step 2: run it — `bun test src/design-systems/industry/theme.test.ts`; expected: FAIL (the dark block lacks the ramps; no `color-scheme`).
- [ ] Step 3: edit theme.css. (a) The light block's selector `:root {` becomes `:root,\n[data-theme="light"] {` and gains `color-scheme: light;` as its first declaration, so a panel marked `data-theme="light"` inside a dark page takes the light values. (b) Replace the whole `[data-theme="dark"] { … }` block (theme.css:131–168, "Derived dark theme") with this one, and update the file's header comment (line 5) to "Industry ships both themes; the dark one is its own set, below.":
  ```css
  /* Industry's dark theme (the canvas's [data-theme="dark"] set, in OKLCH). The steel panel tokens
     (--panel*) are not redefined: a panel is the same steel in both themes. */
  [data-theme="dark"] {
    color-scheme: dark;
    /* the accent ramp, 100 deep to 900 (900 stays the steel) */
    --accent-100: oklch(0.256 0.034 252.6);
    --accent-200: oklch(0.311 0.045 251.8);
    --accent-300: oklch(0.388 0.055 248.5);
    --accent-400: oklch(0.607 0.074 249.1);
    --accent-500: oklch(0.681 0.073 247.7);
    --accent-600: oklch(0.78 0.071 248.1);
    --accent-700: oklch(0.871 0.063 248.6);
    --accent-800: oklch(0.931 0.035 246.9);
    --accent-900: oklch(0.291 0.036 249.2);
    /* the neutral ramp */
    --neutral-100: oklch(0.246 0.009 255.6);
    --neutral-200: oklch(0.284 0.01 260.7);
    --neutral-300: oklch(0.351 0.01 260.7);
    --neutral-400: oklch(0.438 0.009 260.7);
    --neutral-500: oklch(0.572 0.008 260.7);
    --neutral-600: oklch(0.662 0.008 260.7);
    --neutral-700: oklch(0.75 0.008 260.7);
    --neutral-800: oklch(0.863 0.006 264.5);
    --neutral-900: oklch(0.139 0.003 246.3);
    /* the danger ramp */
    --danger: oklch(0.681 0.161 26.7);
    --danger-100: oklch(0.222 0.037 25.9);
    --danger-200: oklch(0.265 0.053 26.6);
    --danger-300: oklch(0.382 0.098 27.7);
    --danger-400: oklch(0.582 0.17 27.1);
    --danger-500: oklch(0.681 0.161 26.7);
    --danger-600: oklch(0.681 0.161 26.7);
    --danger-700: oklch(0.794 0.119 26.3);
    --danger-800: oklch(0.871 0.069 26.3);
    --danger-900: oklch(0.931 0.035 26.5);
    /* the solid "aa" button: accent-700 fill with the ground as its label; accent-800 hover, accent-900 pressed */
    --primary-strong: oklch(0.871 0.063 248.6);
    --primary-strong-foreground: oklch(0.19 0.007 258.4);
    --primary-strong-hover: oklch(0.931 0.035 246.9);
    --primary-strong-active: oklch(0.291 0.036 249.2);
    /* color-bg, color-text, color-surface */
    --background: oklch(0.19 0.007 258.4);
    --foreground: oklch(0.928 0.003 264.5);
    --card: transparent;
    --card-foreground: oklch(0.928 0.003 264.5);
    --popover: oklch(0.234 0.009 255.6);
    --popover-foreground: oklch(0.928 0.003 264.5);
    /* color-accent, with the ground as its label */
    --primary: oklch(0.711 0.07 248.2);
    --primary-foreground: oklch(0.19 0.007 258.4);
    --secondary: oklch(0.284 0.01 260.7);
    --secondary-foreground: oklch(0.928 0.003 264.5);
    --muted: oklch(0.234 0.009 255.6);
    --muted-foreground: oklch(0.75 0.008 260.7);
    /* hover tint: accent-200; its text accent-800 */
    --accent: oklch(0.311 0.045 251.8);
    --accent-foreground: oklch(0.931 0.035 246.9);
    --destructive: oklch(0.681 0.161 26.7);
    --destructive-foreground: oklch(0.19 0.007 258.4);
    /* color-divider: color-text at 16% */
    --border: oklch(0.928 0.003 264.5 / 16%);
    --input: oklch(0.928 0.003 264.5 / 16%);
    --ring: oklch(0.711 0.07 248.2);
    --chart-1: oklch(0.681 0.073 247.7);
    --chart-2: oklch(0.871 0.063 248.6);
    --chart-3: oklch(0.607 0.074 249.1);
    --chart-4: oklch(0.931 0.035 246.9);
    --chart-5: oklch(0.388 0.055 248.5);
    --sidebar: oklch(0.19 0.007 258.4);
    --sidebar-foreground: oklch(0.928 0.003 264.5);
    --sidebar-primary: oklch(0.711 0.07 248.2);
    --sidebar-primary-foreground: oklch(0.19 0.007 258.4);
    --sidebar-accent: oklch(0.311 0.045 251.8);
    --sidebar-accent-foreground: oklch(0.931 0.035 246.9);
    --sidebar-border: oklch(0.928 0.003 264.5 / 16%);
    --sidebar-ring: oklch(0.711 0.07 248.2);
  }
  ```
  If a contrast assertion fails on these values, report the pair and the ratio; do not retune the canvas's colours silently (the handover carries it).
- [ ] Step 4: DESIGN.md: line 3 "The dark theme is derived from its ramps; Industry itself ships light only." → "Industry ships both themes; `theme.css` carries the light set on `:root, [data-theme="light"]` and the dark set on `[data-theme="dark"]`, so a steel panel marked `data-theme="light"` keeps its look inside a dark page." Add under "## Rules": "- Dark mode: the steel panel and the login hero are the same in both themes (`data-theme="light"` on them); a hairline (`--border`) marks where they meet the dark ground. Never a `dark:` class inside the panel."
- [ ] Step 5: run — `bun test src/design-systems/industry/theme.test.ts && bun run test:run`; expected: PASS, "0 fail".
- [ ] Step 6: commit — `git add src/design-systems/industry && git commit -m "feat(theme): Industry's dark tokens"`.

## Task 2: The theme choice, settable
**Delivers:** criteria 5 (the store), 6, 7 (kept), the hook the header action needs.
**Files:** modify src/shared/lib/theme.ts, theme.test.ts, src/shared/lib/theme-actions.ts, src/shared/components/Providers.tsx; create src/shared/components/Providers.test.tsx.
**Kind:** judgement
- [ ] Step 1: failing tests.
  - theme.test.ts: `toggledChoice('light')` is `'dark'`, `toggledChoice('dark')` is `'light'`.
  - Providers.test.tsx (happy-dom; mock `window.matchMedia` with a controllable `matches` and `change` listeners; `mock.module('@/shared/lib/theme-actions', …)` with `rememberSystemTheme` and `setThemeChoice` as `mock(async () => {})`): render `Providers` with `initialChoice="system"`, `systemTheme={null}` and a child that calls `useThemeChoice()` and renders `theme` and a button calling `setChoice('dark')`:
    - device dark → `document.documentElement.dataset.theme` is `'dark'` and the child shows `dark`; flipping the device to light fires `change` → `'light'` (criterion 6);
    - click → `'dark'` at once (before the action resolves), `setThemeChoice` called once with `'dark'`; a later device change no longer moves the theme (the choice wins);
    - `initialChoice="light"` with device dark → `'light'` (criterion 7's inverse: a stored choice wins);
    - `useThemeChoice()` outside a Provider throws a clear error.
- [ ] Step 2: run — `bun test src/shared`; expected: FAIL ("toggledChoice is not a function", "useThemeChoice is not exported").
- [ ] Step 3: implement.
  - theme.ts: `export const toggledChoice = (theme: Theme): ThemeChoice => (theme === 'dark' ? 'light' : 'dark')`.
  - theme-actions.ts: `export async function setThemeChoice(choice: unknown): Promise<void>`: `'light' | 'dark'` → `cookies().set(THEME_COOKIE, choice, cookieOptions)`; `'system'` → `cookies().delete(THEME_COOKIE)`; anything else ignored. Same options as `rememberSystemTheme` (httpOnly, lax, a year).
  - Providers.tsx: `choice` in state (from `initialChoice`); `theme = resolveTheme(choice, system)`; `setChoice(next)` sets state and calls `setThemeChoice(next)` (a rejection is logged in development with `console.warn` and otherwise ignored: the page already shows the theme; the cookie is a convenience). Export `useThemeChoice(): { choice: ThemeChoice; theme: Theme; setChoice: (c: ThemeChoice) => void }` from a `ThemeContext` created in Providers.tsx (one definition; the header components import it from `@/shared/components/Providers`). The `data-theme` effect stays as it is.
- [ ] Step 4: run — `bun test src/shared && bun run type-check`; expected: PASS.
- [ ] Step 5: commit — `git add src/shared && git commit -m "feat(theme): a stored theme choice and the hook that sets it"`.

## Task 3: The header action: a toggle, and the onboarding menu
**Delivers:** criteria 4, 5 (applies at once), 11 (keyboard).
**Files:** create src/shared/components/ThemeToggle.tsx, ThemeToggle.test.tsx, src/features/opening/components/AccountMenu.tsx, AccountMenu.test.tsx; modify src/features/auth/components/SignOutButton.tsx, src/features/opening/components/OnboardingShell.tsx, OnboardingPanel.tsx, FactsScreen.tsx, FactsScreen.test.tsx, src/app/page.tsx, src/app/admin/sign-in/page.tsx, src/features/admin/components/AdminChrome.tsx.
**Kind:** judgement
- [ ] Step 1: failing tests (render inside `Providers` with mocked `matchMedia` and theme-actions, as Task 2's test does; `next/navigation` and `@/shared/lib/auth/client` mocked as SignOutButton's neighbours do).
  - ThemeToggle.test.tsx: in light, a `button` named `'Switch to dark theme'` showing the Moon icon; click → `document.documentElement.dataset.theme` is `'dark'` and the name becomes `'Switch to light theme'` with the Sun; `setThemeChoice` called with `'dark'`.
  - AccountMenu.test.tsx: a `button` named `'Menu: theme and sign out'` with `aria-haspopup="menu"` and `aria-expanded="false"`; no `menu` in the document. Click → `aria-expanded="true"`, a `menu` named `'Menu'` with a `menuitemcheckbox` `'Dark theme'` (`aria-checked="false"` in light) and a `menuitem` `'Sign out'`; focus is on `'Dark theme'`. Click `'Dark theme'` → theme `'dark'`, `aria-checked="true"`, the menu stays open. `Escape` → closed, focus back on the button. Clicking outside (the scrim) → closed. `ArrowDown` from `'Dark theme'` focuses `'Sign out'`, `ArrowUp` goes back, `End`/`Home` likewise. Click `'Sign out'` → `signOut` called, then `router.replace('/')`.
  - FactsScreen.test.tsx: the kicker row has no `'Sign out'` button any more (change the existing assertion).
- [ ] Step 2: run — `bun test src/shared/components src/features/opening/components/AccountMenu.test.tsx src/features/opening/components/FactsScreen.test.tsx`; expected: FAIL ("Cannot find module './ThemeToggle'" / './AccountMenu'; the Sign out assertion).
- [ ] Step 3: implement.
  - `useSignOut()` in SignOutButton.tsx: the `leave` logic (`signOut()`, then `router.replace(redirectTo)` and `router.refresh()`, `pending` state) extracted and exported; `SignOutButton` uses it; `AccountMenu` imports it from `@/features/auth` (add it to src/features/auth/index.ts).
  - `ThemeToggle` (client): `const { theme, setChoice } = useThemeChoice()`; a `button type="button"` `size-11` (44px), hairline border, `aria-label` and `title` `Switch to dark theme` / `Switch to light theme`, Lucide `Moon` in light and `Sun` in dark at 16px `strokeWidth={1.5}` (the icon pops in with a short motion-safe spring, canvas `tt-in`), `onClick={() => setChoice(toggledChoice(theme))}`. Styles from canvas `.hdr-btn`: `bg-transparent text-foreground border-border hover:bg-foreground/6 hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-primary`. A `className` prop for placement.
  - `AccountMenu` (client, onboarding): the same 44px button with Lucide `User` (18px), `aria-label="Menu: theme and sign out"`, `aria-haspopup="menu"`, `aria-expanded`. Open: a full-screen transparent scrim `button tabIndex={-1} aria-hidden` that closes on click, and a `div role="menu" aria-label="Menu"` absolutely under the button (`min-w-56 bg-background border p-1.5 shadow-md`, motion-safe fade-in) holding: `button role="menuitemcheckbox" aria-checked` "Dark theme" with the Moon/Sun icon, a label, and a drawn switch (`span aria-hidden`: a 2.25×1.25rem frame whose knob translates when checked, accent-700 when on; from canvas `.hdr-sw`); `div role="separator"`; `button role="menuitem"` "Sign out" with Lucide `LogOut`. Focus the first item on open; `Escape` closes and refocuses the button; `ArrowDown`/`ArrowUp`/`Home`/`End` move focus among items; "Dark theme" toggles and keeps the menu open; "Sign out" closes and calls `leave()`. Items `min-h-11`, `hover:bg-foreground/6`, `focus-visible:outline-2 focus-visible:-outline-offset-2`. Biome's `useSemanticElements` for `role="menuitem*"`: one `biome-ignore` with the reason (the canvas pattern; a `<menu>` element has no checkbox item).
  - Placement (canvas `.hdr`, positioned on the grid, not inside the panel; the grid gets `relative`): onboarding `absolute z-20 top-11 right-14 @max-5xl:top-6 @max-5xl:right-10 @max-xl:top-1.5 @max-xl:right-4`; login and admin sign-in `absolute z-20 top-11 right-14 @max-5xl:top-9 @max-5xl:right-12 @max-xl:top-5 @max-xl:right-5`. Below `@5xl` the action sits in the steel band, so its colours are light on steel: `@max-5xl:text-panel-foreground @max-5xl:border-panel-foreground/24 @max-5xl:hover:bg-panel-foreground/8 @max-5xl:hover:border-panel-foreground/45 @max-5xl:focus-visible:outline-panel-accent`; the open menu itself stays on page colours. The phone band drops the duck dock (`@max-xl:hidden` on the dock in OnboardingPanel; the canvas removes it to make room).
  - OnboardingShell renders `<AccountMenu />` in that spot; src/app/page.tsx and admin/sign-in/page.tsx render `<ThemeToggle className=… />` in theirs; AdminChrome puts `<ThemeToggle />` in the top bar beside Sign out (`flex items-center gap-2`). FactsScreen's kicker row loses the `SignOutButton` (the row keeps the kicker; `justify-between` becomes unnecessary).
- [ ] Step 4: run — `bun run test:run && bun run type-check && bun run lint`; expected: PASS. (Existing OnboardingPanel/PictureQuestion snapshots of text are unaffected; the e2e that clicks 'Sign out' directly is updated in Task 5.)
- [ ] Step 5: commit — `git add -A src && git commit -m "feat(theme): a theme toggle on sign-in pages and the onboarding menu with Dark theme and Sign out"`.

## Task 4: The steel panels stay light; the dark hairline
**Delivers:** criterion 3.
**Files:** modify src/features/opening/components/OnboardingPanel.tsx, OnboardingShell.tsx, src/features/auth/components/SignInPanel.tsx, src/app/page.tsx, src/app/admin/sign-in/page.tsx, src/app/globals.css; tests OnboardingPanel.test.tsx, SignInPanel.test.tsx.
**Kind:** judgement
- [ ] Step 1: failing tests: OnboardingPanel.test.tsx and SignInPanel.test.tsx assert the `aside` / `section` has `data-theme="light"`.
- [ ] Step 2: run — `bun test src/features/opening/components/OnboardingPanel.test.tsx src/features/auth/components/SignInPanel.test.tsx`; expected: FAIL.
- [ ] Step 3: implement. `data-theme="light"` on the onboarding `aside` and the login hero `section` (Task 1 made the light block answer to it, so every token inside them resolves light; the panel's own `--panel*` tokens are the same in both themes anyway). The hairline: in globals.css, beside `split-panel`, two utilities `@utility split-divider-x { box-shadow: inset 1px 0 0 var(--border) }` and `@utility split-divider-y { box-shadow: inset 0 1px 0 var(--border) }`; the main column (OnboardingShell's content column, the login's and admin sign-in's `main`) gets `dark:@5xl:split-divider-x dark:@max-5xl:split-divider-y` (verify the variant stacking compiles: `bunx tailwindcss`-free check via `bun run build` and a look in the browser; the `dark` variant is `@custom-variant dark` in globals.css). Note for the record: `dark:` matches descendants of a dark `<html>` even inside the light panel, so nothing inside the panels may use `dark:` (DESIGN.md rule from Task 1).
- [ ] Step 4: run — `bun run test:run && bun run build`; expected: PASS, build clean.
- [ ] Step 5: commit — `git add -A src && git commit -m "feat(theme): the steel panels stay light, with a hairline on the dark ground"`.

## Task 5: End to end
**Delivers:** criteria 5, 6, 11 across the browser; the specs that reach Sign out.
**Files:** create e2e/dark-mode.e2e.ts; modify e2e/onboarding.e2e.ts, e2e/student-opening-three-futures/student-opening-three-futures.e2e.ts (Sign out through the menu).
**Kind:** judgement
- [ ] Step 1: write the specs (helpers in e2e/helpers: `skipSplash`, `newStudent`, `deleteUsers`; `page.emulateMedia({ colorScheme })`; `context.cookies()` / `clearCookies()`):
  - "the toggle stores the theme and the next page paints in it": `/` with device light → `html[data-theme=light]`; click `'Switch to dark theme'` → `html[data-theme=dark]` within 100 ms; cookie `theme=dark`; `page.reload()` → the HTML as served already carries `data-theme="dark"` (read `await page.content()` or check the attribute right after `domcontentloaded`, before hydration) and the button reads `'Switch to light theme'`.
  - "with no choice the page follows the device": device dark, no cookie → dark; `emulateMedia({ colorScheme: 'light' })` on the open page → light within 500 ms; set a choice (click) then flip the device → unchanged.
  - "the onboarding menu": a new student on `/onboarding/character`: `'Menu: theme and sign out'` → `menu 'Menu'` with `'Dark theme'` and `'Sign out'`; `'Dark theme'` → dark and `aria-checked="true"`; `Escape` closes, the button has focus; open again, `'Sign out'` → URL `/`.
  - "step 01 has no separate Sign out": on `/onboarding/facts/where`, `getByRole('button', { name: 'Sign out' })` has count 0 outside the menu.
  - Update the existing Sign out flows in e2e/onboarding.e2e.ts and the QA spec to open the menu first (add `signOutViaMenu(page)` to e2e/helpers/student.ts, one definition).
- [ ] Step 2: run — `bun run test:e2e -- e2e/dark-mode.e2e.ts --reporter=line`; expected: PASS; then the whole suite `bun run test:e2e -- --reporter=line --workers=1`; expected: all pass.
- [ ] Step 3: commit — `git add e2e && git commit -m "test(theme): dark mode end to end"`.

## Task 6: Every screen in dark, against the boards
**Delivers:** criteria 2, 10 (and 3's look).
**Files:** a temporary e2e/zz-dark-shots.e2e.ts (deleted at the end); any component with a light-only colour found by the sweep.
**Kind:** judgement
- [ ] Step 1: a temporary spec (reducedMotion 'reduce', `emulateMedia({ colorScheme: 'dark' })`, no theme cookie) shoots at 390 and 1440, full page: `/` (idle, after "Send me a code" the code step, and the wrong-code error via a bad code), `/admin/sign-in` (with `?error=not-admin`), `/onboarding/character` (nothing, one chosen, save failed), `/onboarding/facts/where` (nothing), `…/amount` (Not sure), `…/dep` (Partner), `…/hard` (save failed), `/onboarding/study`, `/onboarding/living`, `/onboarding/after`, `/futures` (after `answerOpening` with PRIYA), `/attention`, and the admin console `/admin/users` (sign in as an admin the way e2e/user-management.e2e.ts does). Save under `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/77aae712-29a8-4d3d-a5fd-fe22326ccc5b/scratchpad/dark-shots/`. Also the same login and onboarding screens in light at 390 and 1440, to compare with the pre-change light shots you take first (before Task 3's header action lands, from `git stash` or the `backup` of HEAD~: simplest is to shoot light on the current branch before starting Task 1 and keep them).
- [ ] Step 2: look at every dark shot against the DK boards (login.css tokens, the DK board wrappers) and the criterion-10 list: no light surfaces, boxes, tags, toasts or alerts on the dark ground; the chosen card is the dark tint; impact lines, chips and the mock tag read; the error block is the dark danger set; the panel is steel with the hairline; the header action is visible in both placements; the futures cards, the coins piles and the admin table use the dark tokens. Fix anything left (a hard-coded light colour, a `bg-white`, an opacity tint that assumed a light ground); each fix is a one-line change in the component, test-first where a test can see it (most cannot: say so).
- [ ] Step 3: light regression: the light shots after all tasks differ from the pre-change ones only where the header action was added (and the phone band's duck); confirm with PIL `ImageChops.difference` bounding boxes and say what they cover.
- [ ] Step 4: delete the temporary spec; `bun run lint && bun run type-check && bun run test:run && bun run test:e2e -- --reporter=line --workers=1 && bun run build`; commit any fixes `fix(theme): dark leftovers on <screens>`. List the shot paths and anything left in the report.

## Integration
`bun run test:e2e -- --reporter=line --workers=1` (Playwright, the dev server on 3000 reused): e2e/dark-mode.e2e.ts (criteria 5, 6, 11), the updated Sign out flows; the rest of the suite stays green.

## Criteria coverage
| Criterion | Task | Test that proves it |
| --- | --- | --- |
| 1 | 1 | theme.test.ts (every ramp redefined in dark, from the canvas values) |
| 2 | 1, 6 | theme.test.ts (accent-800 on accent-100 ≥ 4.5); Task 6 shots of a chosen card |
| 3 | 4, 6 | OnboardingPanel.test.tsx, SignInPanel.test.tsx (`data-theme="light"`); Task 6 shots (hairline) |
| 4 | 3 | ThemeToggle.test.tsx, AccountMenu.test.tsx, FactsScreen.test.tsx (no separate Sign out); placement in Task 6 shots |
| 5 | 2, 3, 5 | Providers.test.tsx (applies at once, action called); e2e/dark-mode.e2e.ts (cookie, served `data-theme`, no flash) |
| 6 | 2, 5 | Providers.test.tsx (device change followed; a choice wins); e2e/dark-mode.e2e.ts |
| 7 | 2 | Providers.test.tsx (system + device dark → dark); existing theme.test.ts |
| 8 | 1 | theme.test.ts (text ≥ 4.5, large/icons ≥ 3). Hairlines at 16% are ~1.6:1 by Industry's design in both themes: not met, needs a decision |
| 9 | 1 | theme.test.ts (`color-scheme` in both blocks) |
| 10 | 6 | Not automatable: the screenshot sweep at 390 and 1440 against the DK boards, with the shot paths in the report |
| 11 | 3, 5 | AccountMenu.test.tsx (Escape, arrows, focus); e2e/dark-mode.e2e.ts; the whole suite green |
| 12 | 1 | DESIGN.md changed in Task 1 (checked by the reviewer) |
