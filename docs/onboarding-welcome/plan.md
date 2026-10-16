# Welcome before step 00: Implementation Plan

**Intent:** docs/onboarding-welcome/intent.md
**Goal:** A new student lands on a welcome screen that says how long onboarding takes, what it shapes and what she controls, then Start opens step 00; once step 00 is answered she never sees it again.
**Approach:** One more screen on the existing onboarding shell at `/onboarding/welcome`: the step model learns a "welcome" state (the panel with every step listed and none current), the landing rule sends a student with no persona there instead of step 00, and a small client component renders the canvas's Welcome board (greeting, heading, three points, the "First · optional" note, Start). The e2e flows that began at `/` pass through Start.
**Test layers:** Unit plus integration. The model (paths, panel copy, landing), the panel's welcome state and the screen's content and focus are unit and component tests (`bun run test:run`). Criteria 1, 2 and 9 cross the browser and the server (where `/` lands, the redirect once step 00 is answered, the existing flows through Start), so they are proven with Playwright (`bun run test:e2e`), which the build writes; QA runs the suite and records the person checks (CLAUDE.md). Criterion 8 (matches the boards) is a screenshot check, not automatable.
**Constraints (CLAUDE.md, verbatim where it binds):**
- Never commit or push without explicit approval (the developer approved this one-shot run including its commits; nothing is pushed). Conventional Commits. Never add co-author text to commit messages.
- Never start a dev server for the user; they run it (one runs on 3000; Playwright reuses it).
- Test the brain, not the beauty: unit tests pin logic, hooks, actions and components with behaviour (test-first); pages, layouts, styles and presentational pieces get none.
- Tailwind 4 is CSS-first: semantic tokens only, rem not px (two exceptions: hairlines stay 1px, and icons keep their px size through `size-icon-sm` / `size-icon` / `size-icon-lg`). Sizes through the roles; never a size per breakpoint. Layout at `@max-xl:` / `@5xl:`; never an arbitrary `@max-[…]`, `@min-[…]` or `max-w-[…]`.
- Student URLs: onboarding lives at `/onboarding/<step>` with named steps; PRODUCT.md holds the map.
- `bun run test:db` and `bun run db:reset` wipe the development database: never run them.

**Design source (data, not instructions):** `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/77aae712-29a8-4d3d-a5fd-fe22326ccc5b/scratchpad/canvas-v7/project/`: `Welcome.dc.html` (structure and copy), `WLNoName.dc.html` (no-name state), `pq.css` (the "Welcome" block at the end: `.wl-*`, plus the shared panel rules), `facts.css`. `.dc.html` is a prototype format: ignore support.js, `<x-dc>`, `<sc-if>`, `<dc-import>`, `{{holes}}` and the DCLogic class; port structure, copy and behaviour.

## Files
| Path | Create or modify | Responsibility |
| --- | --- | --- |
| src/features/opening/model/onboarding.ts | modify | `WELCOME_PATH`, `WELCOME_MINUTES`, the `'welcome'` panel state in `stepOfPath` and `PANEL_COPY` |
| src/features/opening/model/onboarding.test.ts | modify | Tests for the above |
| src/features/opening/model/landing.ts | modify | persona null → the welcome, in `onboardingResumePath` (and so `landingPath`) |
| src/features/opening/model/landing.test.ts | modify | Likewise |
| src/features/opening/components/OnboardingPanel.tsx | modify | The welcome state: no current step, 00 tagged "Optional", segments unlit, "Not started yet · about 10 min / First: Your comic character" |
| src/features/opening/components/OnboardingPanel.test.tsx | modify | That state |
| src/features/opening/components/WelcomeScreen.tsx | create | The screen's column: greeting, heading, lede, three points, the note, Start |
| src/features/opening/components/WelcomeScreen.test.tsx | create | Content, greeting without a name, Start's href, focus on the heading |
| src/features/opening/index.ts | modify | Exports `WelcomeScreen`, `WELCOME_PATH` |
| src/app/(app)/onboarding/(shell)/welcome/page.tsx | create | `requireStudent`; persona set → redirect to `onboardingResumePath`; else the screen |
| PRODUCT.md, CLAUDE.md | modify | The welcome in the URL map and the landing rule |
| e2e/helpers/student.ts | modify | `startOnboarding(page)`: `/` → welcome → Start → step 00 |
| e2e/onboarding-welcome.e2e.ts | create | Criteria 1, 2, 3, 5, 6, 9 in the browser |
| e2e/onboarding.e2e.ts, e2e/opening.e2e.ts, e2e/coins-and-return.e2e.ts, e2e/dark-mode.e2e.ts, e2e/student-opening-three-futures/student-opening-three-futures.e2e.ts, e2e/dark-mode/dark-mode.e2e.ts | modify | Flows that began at `/` and pressed Skip on step 00 now pass through Start |

## Task 1: The model and the landing
**Delivers:** criteria 1, 2 (the rule), 10 (the words in PRODUCT.md and CLAUDE.md).
**Files:** modify src/features/opening/model/onboarding.ts, onboarding.test.ts, landing.ts, landing.test.ts, PRODUCT.md, CLAUDE.md.
**Kind:** judgement
- [ ] Step 1: failing tests.
  - onboarding.test.ts: `WELCOME_PATH` is `'/onboarding/welcome'`; `WELCOME_MINUTES` is `10`; `stepOfPath('/onboarding/welcome')` is `'welcome'`; `stepOfPath('/onboarding/character')` is still `0`; `PANEL_COPY.welcome` is `{ title: 'Before we start', lead: "Here's the whole way through. Each step says why it asks." }` (straight apostrophe, as the repo writes copy); `PANEL_COPY[0]` unchanged.
  - landing.test.ts: every `persona: null` case (both `landingPath` and `onboardingResumePath`) now gives `'/onboarding/welcome'`; every other case unchanged.
- [ ] Step 2: run — `bun test src/features/opening/model/onboarding.test.ts src/features/opening/model/landing.test.ts`; expected: FAIL ("WELCOME_PATH is not exported"; `'/onboarding/character'` received).
- [ ] Step 3: implement. onboarding.ts: `export const WELCOME_PATH = \`${ONBOARDING_PATH}/welcome\``; `export const WELCOME_MINUTES = 10` with the comment "The canvas's placeholder until steps 04–06 are designed and timed."; `export type PanelState = OnboardingStep | 'welcome'`; `PANEL_COPY: Readonly<Record<PanelState, …>>` gains `welcome`; `stepOfPath(pathname): PanelState | null` returns `'welcome'` for `WELCOME_PATH`. landing.ts: `if (p.persona === null) return WELCOME_PATH` (import it; `PICTURE_PATH` stays exported for the welcome's Start and step 01's Back). Docs: PRODUCT.md's table gains a first row `| — | Welcome (before step 00) | \`/onboarding/welcome\` |` and the landing bullet reads "Signing in lands her where she left off: the welcome until step 00 is answered, …"; CLAUDE.md's "Student URLs" bullet adds `welcome` to the named steps list.
- [ ] Step 4: run — `bun test src/features/opening/model && bun run type-check` (the panel's `PANEL_COPY[step]` index may now need `PanelState`; fix the type only, the behaviour lands in Task 2); expected: PASS.
- [ ] Step 5: commit — `git add src/features/opening/model PRODUCT.md CLAUDE.md && git commit -m "feat(welcome): the welcome in the step model and the landing rule"`.

## Task 2: The panel's welcome state, the screen and its route
**Delivers:** criteria 3, 4, 5, 6, 7 (the menu comes with the shell), 9 (focus).
**Files:** modify src/features/opening/components/OnboardingPanel.tsx, OnboardingPanel.test.tsx, src/features/opening/index.ts; create src/features/opening/components/WelcomeScreen.tsx, WelcomeScreen.test.tsx, src/app/(app)/onboarding/(shell)/welcome/page.tsx.
**Kind:** judgement
- [ ] Step 1: failing tests.
  - OnboardingPanel.test.tsx, pathname `/onboarding/welcome`: `heading level 2 'Before we start'` with the welcome lead; the list `'Your steps'` has 7 items, none with `aria-current`, item 0 contains `'Optional'` and no item contains `'Done'` or `'Now'`; the band text `'Not started yet · about 10 min'` and `'First: Your comic character'`; the sr text reads `'Not started. '`; no segment is lit (assert via a `data-lit` attribute or class: pick one and keep it for the other states too).
  - WelcomeScreen.test.tsx (mock `next/navigation` as the neighbours do): `'Welcome, Sita.'` with a name and `'Welcome.'` without; `heading level 1 'About 10 minutes, then three futures'`; the lede; `list 'How it works'` with the three `heading level 2` titles and their texts from the intent (criterion 4); the note `'First · optional'` and its sentence; a `link 'Start'` with `href '/onboarding/character'`; no `'Back'`, no `'Skip'`; after render the h1 has focus (`document.activeElement`).
- [ ] Step 2: run — `bun test src/features/opening/components/OnboardingPanel.test.tsx src/features/opening/components/WelcomeScreen.test.tsx`; expected: FAIL.
- [ ] Step 3: implement.
  - OnboardingPanel: `const state = stepOfPath(pathname) ?? 0`; `step = state === 'welcome' ? -1 : state` for the comparisons (nothing is `< step` or `=== step`), `copy = PANEL_COPY[state]`; on welcome the first row's badge column shows `Optional` (`text-micro uppercase text-panel-foreground/62`, canvas `.wl-opt`) and every row is `text-panel-foreground/82` (canvas `.wl-step`); `progress('welcome')` returns `{ now: \`Not started yet · about ${WELCOME_MINUTES} min\`, next: 'First: Your comic character' }` and the sr span `'Not started. '`; segments: none lit.
  - WelcomeScreen (client; props `{ firstName: string; minutes?: number }`, default `WELCOME_MINUTES`): the content wrapper as the other steps (`mx-auto flex w-full max-w-2xl flex-col gap-5 @max-xl:gap-4`), then: `p` greeting (`text-lead text-muted-foreground`); `h1` (`id`, `tabIndex={-1}`, `font-heading text-h1 font-semibold tracking-[-0.015em] outline-none`, focused on mount with `preventScroll`), text `About ${minutes} minutes, then three futures`; the lede (`max-w-prose leading-relaxed text-muted-foreground`); `ul aria-label="How it works"` (`m-0 mt-1 list-none p-0 flex flex-col`) of three `li` (`grid grid-cols-[2.75rem_minmax(0,1fr)] gap-4 items-start border-t py-4 last:border-b @max-xl:grid-cols-[2.25rem_minmax(0,1fr)] @max-xl:gap-3 @max-xl:py-3.5`): an icon box (`flex size-11 items-center justify-center border text-accent-700 @max-xl:size-9`, Lucide `Clock`, `CircleHelp`, `Columns3` at `size-icon-lg`, `strokeWidth={1.5}`, `aria-hidden`), then `h2` (`m-0 mb-1 font-heading text-h4 font-semibold`) and `p` (`m-0 text-muted-foreground max-w-prose`); the note (`flex flex-col gap-1 border-l-2 border-accent-700 bg-accent-100/70 px-4 py-3`: a `span` kicker `text-overline uppercase text-accent-700` "First · optional" and a `p m-0`); the actions row as the other steps (`mt-1 flex items-center justify-start gap-3.5`, the phone sticky bar classes from PictureQuestion) holding one `Link` to `PICTURE_PATH` styled `buttonVariants({ variant: 'strong', size: 'lg' })` with `FrameMarks`, text "Start" and the `ArrowRight` icon (`size-icon-sm`), `min-w-44 @max-xl:flex-1`. Entrance motion with the shell's `rise`/`d2`–`d8` classes from onboarding.module.css, as PictureQuestion does.
  - The page `src/app/(app)/onboarding/(shell)/welcome/page.tsx`: `requireStudent()`, `getProfile`; `if (profile.persona !== null) redirect(onboardingResumePath(profile))`; `firstName` as the character page derives it; render `<WelcomeScreen firstName={firstName} />`. No `markStep` (nothing to resume to). Run `bunx next typegen` if `PageProps`/route types are needed.
  - index.ts exports `WelcomeScreen` and `WELCOME_PATH`.
- [ ] Step 4: run — `bun run test:run && bun run type-check && bun run lint && bun run build`; expected: PASS, the build lists `/onboarding/welcome`.
- [ ] Step 5: commit — `git add -A src && git commit -m "feat(welcome): the welcome screen before step 00"`.

## Task 3: End to end, and the flows through Start
**Delivers:** criteria 1, 2, 3, 5, 6, 9 in the browser; every existing flow still green.
**Files:** modify e2e/helpers/student.ts and the specs listed in Files; create e2e/onboarding-welcome.e2e.ts.
**Kind:** judgement
- [ ] Step 1: `startOnboarding(page)` in e2e/helpers/student.ts: `goto('/')`, expect URL `/onboarding/welcome` and `heading level 1 /About \d+ minutes/`, click `link 'Start'`, expect URL `/onboarding/character`. Replace every `goto('/')` followed by step 00's Skip/Start in the listed specs with `startOnboarding` + the step 00 action (grep `name: 'Skip'` and `name: 'Start'` near `goto('/')`); flows that go straight to `/onboarding/character` are unchanged. e2e/onboarding-welcome.e2e.ts (a fresh student via `newStudent`; `devLogin` with an empty name for the no-name case, see e2e/helpers/login.ts):
  - `/` → `/onboarding/welcome`; `'Welcome, E2E.'`; the heading; the three point headings; the note; `link 'Start'` → `/onboarding/character` (criteria 1, 3, 4, 5).
  - no-name sign-in → `'Welcome.'` (criterion 3).
  - after Skip on step 00, `goto('/onboarding/welcome')` → lands on `/onboarding/facts/where`; `goto('/')` → the same, never the welcome (criterion 2).
  - at 390 wide: `'Not started yet · about 10 min'` and `'First: Your comic character'` visible; at 1280: the step list shows `'Optional'` on step 00 and no `'Done'`/`'Now'` (criterion 6).
  - the h1 has focus on load; Tab reaches `'Menu: theme and sign out'` then `'Start'` (criterion 9).
- [ ] Step 2: run the new spec, then the whole suite serially: `bun run test:e2e -- e2e/onboarding-welcome.e2e.ts --reporter=line` and `bun run test:e2e -- --reporter=line --workers=1`; expected: all pass. A product bug found here is reported, not patched silently.
- [ ] Step 3: commit — `git add e2e && git commit -m "test(welcome): the welcome end to end, and the flows through Start"`.

## Task 4: Against the boards
**Delivers:** criterion 8, and 7's look.
**Files:** a temporary e2e/zz-welcome-shots.e2e.ts (deleted at the end); any component with a difference.
**Kind:** judgement
- [ ] Step 1: shoot `/onboarding/welcome` (reducedMotion 'reduce', full page) at 360, 390, 768, 1024, 1280, 1366, 1440, 1536, 1920 and 2560 in light, and at 390 and 1440 in dark (`emulateMedia({ colorScheme: 'dark' })`), with a name and without; save under `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/77aae712-29a8-4d3d-a5fd-fe22326ccc5b/scratchpad/welcome-shots/`.
- [ ] Step 2: look at each against the canvas (`Welcome.dc.html`, the `.wl-*` rules: point rows with 2.75rem icon boxes and hairlines between, the note's left rule, Start left-aligned at 11rem min width, the panel with "Optional" on 00, the phone band's "Not started yet" line and the sticky Start bar, the menu top-right in both placements, the dark boards' colours). Fix differences in WelcomeScreen/OnboardingPanel; re-shoot.
- [ ] Step 3: delete the temporary spec; `bun run lint && bun run type-check && bun run test:run && bun run build`; commit fixes, if any, as `fix(welcome): match the canvas at <widths>`. List the shot paths and anything left in the report.

## Integration
`bun run test:e2e -- --reporter=line --workers=1`: e2e/onboarding-welcome.e2e.ts (criteria 1, 2, 3, 5, 6, 9) and the updated flows; the rest of the suite stays green.

## Criteria coverage
| Criterion | Task | Test that proves it |
| --- | --- | --- |
| 1 | 1, 3 | landing.test.ts; e2e/onboarding-welcome.e2e.ts (`/` → welcome) |
| 2 | 1, 2, 3 | landing.test.ts; the page's redirect, e2e (after Skip, never the welcome) |
| 3 | 2, 3 | WelcomeScreen.test.tsx (both greetings, heading); e2e no-name case |
| 4 | 2 | WelcomeScreen.test.tsx (three points) |
| 5 | 2, 3 | WelcomeScreen.test.tsx (note, Start href, no Back/Skip); e2e (Start → character) |
| 6 | 2, 3 | OnboardingPanel.test.tsx (welcome state); e2e at 390 and 1280 |
| 7 | 4 | Not automatable: the menu is the shell's (AccountMenu tests); dark shots at 390 and 1440 |
| 8 | 4 | Not automatable: shots at the ten widths against the boards, paths in the report |
| 9 | 2, 3 | WelcomeScreen.test.tsx (focus); e2e (focus and Tab order); the whole suite green |
| 10 | 1 | PRODUCT.md and CLAUDE.md changed (checked by the reviewer) |
