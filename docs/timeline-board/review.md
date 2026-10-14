# Your road (timeline board, round 1) — Code Review

**Approve with changes.** 0 CRITICAL · 0 HIGH · 8 MEDIUM · 11 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/your-road` at `016b0ee` over `origin/dev` (`1eb13f3`) · 112 files, +7950 −426 · 2026-10-13 |
| Reviewed against | security · security-web · performance · CLAUDE.md (+ AGENTS.md, Next docs) · `fdd-architecture (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` |
| Scans | secrets clean · dependencies 0 new, 2 pre-existing (braces, esbuild) · code clean |
| Not applicable | security-llm.md (no model calls) · vercel-composition-patterns (not dispatched) |
| Failed to load | none |
| Read outside the diff | 9, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | — | — |
| Performance | A | LOW · `RoadMap.tsx:240` · per-frame recompute | optional |
| CLAUDE.md | B | MEDIUM · `phone-road.module.css:20` · px not rem | rem in the CSS modules |
| fdd-architecture | B | MEDIUM · `RoadBoard.tsx:111` · hook extraction | move session logic to a hook |
| tailwind-v4-best-practices | B | MEDIUM · `RoadCard.tsx:135` · type outside the roles | use the type roles |
| vercel-react-best-practices | B | MEDIUM · `RoadBoard.tsx:459` · derived state in effect | derive the panel from segments |
| Quality | B | MEDIUM · `RoadCard.tsx:104` · repeated markup | extract the shared pieces |
| Criteria | A | 1 manual, 1 screenshot-only | — |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | Header, wide / stacked / phone layout | `camera.test.ts:845` (layoutOf), `RoadBoard.test.tsx` "on a phone" | covered (look: screenshots) |
| 2 | Three stops, fit, gestures, clamp, log move | `camera.test.ts:691–843`, `e2e/your-road.e2e.ts:113` | covered (resize re-fit, reduced-motion cut: manual) |
| 3 | One press = one meaning; card buttons act | `press.test.ts`, `RoadBoard.test.tsx:379–576` | covered |
| 4 | Board states, boards 2–12 and 14–15 | `scene.test.ts`, `RoadBoard.test.tsx` | covered, except "loading" (see note) |
| 5 | Phone Road view: line, dates, scroll on arrival | `phone-road.test.ts`, `RoadBoard.test.tsx` "on a phone" | covered |
| 6 | "You're all set": one action, Go to your road | `DoneScreen.test.tsx:56` | covered |
| 7 | `/road` for a finished student; else resume | `landing.test.ts`, `redirect.test.ts`, `e2e/routes.e2e.ts` | covered |
| 8 | Lesson over the board; route detail registered | `RoadBoard.test.tsx:464–484`, `routes.test.ts` | covered |
| 9 | Query state, defaults omitted | `road-url.test.ts`, `useRoadUrl.test.tsx` | covered |
| 10 | Stable ids; replace vs push | `road-url.test.ts:923`, `useRoadUrl.test.tsx:389` | covered |
| 11 | Bad values dropped; deep links | `road-url.test.ts:871–906`, `RoadBoard.test.tsx` deep link | covered |
| 12 | Mock data behind the interface; >2028 marked | `scene.test.ts:124`, `road-data.ts` | covered |
| 13 | Copy rules; field colour per theme | review (no banned words found) | not automatable |
| 14 | Real buttons, names, aria-pressed, Zoom group, live region, Escape, `<ol>` | `RoadBoard.test.tsx`, `BottomSheet.test.tsx` | covered (44px minimum untested) |
| 15 | Reduced motion | `RoadBoard.test.tsx:509` (swap jumps) | partly; camera cut, bob, pulse manual |
| 16 | Unit tests listed | the model and component tests above | covered |
| 17 | E2E: zoom, swap + Undo, stack, lesson, phone switch | `e2e/your-road.e2e.ts` | covered |
| 18 | Screenshots vs the Board boards | `smoke.md` differences list | manual |
| 19 | The lock on "Go to your road" | `actions.test.ts:1651`, `profile.test.ts:542` (DB), `DoneScreen.test.tsx`, `e2e/routes.e2e.ts:904` | covered; Back from the board is manual (smoke 8) |

Criterion 4: the board's "loading" state was not built, in line with the 13 Oct decision ("nothing on the way pretends to load") and the removed DuckLoader. Criterion 4 still says "loading", though, so see the LOW finding on `intent.md`.

## Read outside the diff
- `src/app/(app)/start/page.tsx:9` — `/start` follows `onboardingResumePath`, so the lock reaches it.
- `src/features/opening/actions.ts:43` — `asStudent` wraps `run` in try/catch: `finishOnboardingAction` (and its `refresh()`) never throws.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/refresh.md` — `refresh()` from `next/cache` is valid only in a server action, which is where it is used.
- `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md:345` — `pushState`/`replaceState` sync with `useSearchParams`, so `useRoadUrl`'s approach is supported.
- `src/app/globals.css:159` — a `data-theme="light"` field is the brand blue in light mode and Industry steel in dark (criterion 13 holds).
- `src/shared/components/ui/button.tsx:70` — strong and outline `Button`s draw FrameMarks themselves, so DoneScreen's button keeps them.
- `src/design-systems/industry/theme.css:67`, `src/app/globals.css:53` — the `neutral-*` ramp, `text-micro` and `size-icon-xs` are design-system tokens.
- `find src/app -name loading.tsx` — no student or admin page keeps a loading boundary.
- `grep sheetIn`, `grep \.mock` in `src` — both are unused (findings below).

## Findings, by file

### `src/features/road/components/RoadBoard.tsx`

**MEDIUM · line 459 · derived state in an effect**
- What: `ShowRoadPanel` sets the lesson or route panel in a `useEffect`. The server render, and the first client paint, of `/road/learn/masters-years` or `/road/route/<id>` therefore show the here-card, and the panel only appears after hydration.
- Why: a deep link to the lesson paints the wrong card first and then swaps it. On a phone the sheet rises late. This is the paint-then-change the branch's own CLAUDE.md rule sets out to remove.
- Rule: `vercel-react-best-practices` `rerender-derived-state-no-effect` · a test would have caught it: no, happy-dom runs effects before the assertions.
- Fix: in `RoadBoard`, derive `panel` during render from `useSelectedLayoutSegments()` (`['learn', id]` or `['route', id]`), validated with `lessonById` / `routeStep`. Then drop the context and its effect.

**MEDIUM · line 57 · layout chosen after hydration**
- What: `useLayout` starts at `'wide'` and measures in a layout effect. A phone's server HTML is the stacked board (map, card, controls), and it becomes the Road/Map phone tree only after hydration.
- Why: every first load on a phone shows one layout and then another. CLAUDE.md asks the layout to come from the page's own width through container queries.
- Rule: CLAUDE.md §Code (container queries) · `rendering-hydration-no-flicker` · a test would have caught it: no, it needs a real first paint (an e2e screenshot before hydration).
- Fix: keep the body hidden (`invisible`) until the first measure, or switch the phone and desktop trees with `@max-xl:` visibility rather than JS.

**MEDIUM · line 111 · logic in the component**
- What: about 115 lines of non-rendering logic live in the component (`change`, `go`, `press`, `zoom`, `close`, `view`, `back`, `primary`, `closeList`, `put`, `leaveLesson`, `read`, the pushed-entry refs), next to the layout, the column and the phone sheet.
- Why: this 479-line file has four jobs, and the session and history rules can only be tested through the whole board.
- Rule: `fdd-architecture` §6 hook extraction (5+ lines of non-rendering logic) · a test would have caught it: no, a structure rule.
- Fix: move the session, toast and history handling into `hooks/useRoadSession.ts`, and leave `RoadBoard` to lay out.

**LOW · line 390 · arbitrary grid values**
- What: `grid-cols-[minmax(0,1fr)_23.75rem]`, `@max-5xl:grid-rows-[minmax(0,1fr)_22rem]` and the phone's `grid-rows-[…]` are arbitrary values. The 23.75rem column also appears only here.
- Why: the card column's width is a design size and should have one name.
- Rule: `tailwind-v4-best-practices` §2 · a test would have caught it: no.
- Fix: use the spacing scale (`23.75rem` is `--spacing-95`) through a named utility, or a CSS module variable.

### `src/features/road/components/RoadCard.tsx`

**MEDIUM · line 104 · repeated markup**
- What: the "? What happens here · 3-min lesson" link is written three times (here, `PhoneRoad.tsx:224`, `RoadMap.tsx:578`). The dashed "mock" tag is written four times (here at line 89, `PhoneRoad.tsx:83`, `StackList.tsx:103`, `RoadMap.tsx:226`).
- Why: a copy or style change has to be made in three or four places, and they will drift.
- Rule: Quality, no duplicated logic (three or more) · a test would have caught it: no.
- Fix: add `LessonLink` and `MockTag` to `src/features/road/components/` and use them in each place.

**MEDIUM · line 135 · type outside the roles**
- What: the road's components use `text-sm` 21 times and `text-base` several times. The opening feature uses `text-sm` 4 times.
- Why: CLAUDE.md makes type fluid through the design system's roles. `text-sm` and `text-base` are Tailwind defaults outside that system.
- Rule: CLAUDE.md §Code (type roles) · a test would have caught it: no, a convention.
- Fix: map each use to `text-caption`, or to body text with no class, per DESIGN.md.

### `src/features/road/hooks/useMapCamera.ts`

**MEDIUM · line 33 · repeated helper**
- What: `reducedMotion` is defined three times (here, `useSwapMotion.ts:8`, `useTradePlaces.ts:7`). The root font-size read is repeated in `useMapCamera` and `useTradePlaces`.
- Why: three copies of the reduced-motion rule (criterion 15) can diverge.
- Rule: Quality, no duplicated logic (three or more) · a test would have caught it: no.
- Fix: one `prefersReducedMotion()` and one `rootScale()` in a small `hooks/motion.ts`.

### `src/features/road/components/phone-road.module.css`

**MEDIUM · line 20 · px where rem is the rule**
- What: the road line (`calc(0.625rem - 2px)`, `width: 4px`), the node's `2px` border, the `6px`/`10px` dashes and the `3px`/`4px`/`8px` shadows are px. So are the focus ring (`2px`/`4px`) and the bob (`-3px`) in `road-map.module.css:149`.
- Why: they do not scale from 1440 to 1920 with the rest of the design. Only hairlines and icons are allowed in px.
- Rule: CLAUDE.md §Code (rem not px) · a test would have caught it: no, a convention.
- Fix: convert them to rem (`0.25rem`, `0.125rem`, `0.1875rem`, …). Keep px only for the 1px hairlines.

### `src/features/road/components/BottomSheet.test.tsx`

**MEDIUM · line 16 · test bloat**
- What: these three tests check that the shadcn/Radix Sheet is a named dialog, renders nothing when closed and closes on Escape. `RoadBoard.test.tsx` "opens a pressed row in a bottom sheet; Escape and its Cancel close it" already asserts all three through the board.
- Why: they test the framework's own behaviour and repeat another test's assertions.
- Rule: CLAUDE.md "test the brain, not the beauty" · a test would have caught it: n/a.
- Fix: delete the file.

### `src/features/road/components/road-map.module.css`

**LOW · line 33 · raw colours in the mixes**
- What: the fog, fork, plate and label shades mix in `black` (`color-mix(in oklch, black 30%, var(--fld))`), and the duck's shadow is `oklch(0 0 0 / 28%)`.
- Why: colours should come from tokens. These are raw colours, though only used to darken a token.
- Rule: `tailwind-v4-best-practices` §1 · a test would have caught it: no.
- Fix: mix with a token (for example `--neutral-900`, or the theme's foreground on dark) or name one shade variable at the top of the module.

### `src/features/road/components/RoadMap.tsx`

**LOW · line 240 · per-frame recompute**
- What: each camera frame (0.55 s of `setCam` via requestAnimationFrame) re-renders `Drawing`. That reruns `depthOrder`, `drawTile`, `labelOf` and several `tiles.find` and `order.indexOf` scans, which is O(n²) in tiles.
- Why: the cost grows with tile count times frames. That is cheap at 16 mock tiles, but real roads will be larger.
- Rule: `performance.md` §2 · a test would have caught it: no.
- Fix: memoise `depthOrder` and an id-to-index map per scene, and look tiles up through a `Map`.

### `src/features/road/hooks/useRoadUrl.ts`

**LOW · line 27 · query written onto the lesson path**
- What: `setState` builds the URL from the current `pathname`. A zoom or view change while the lesson or route detail is open writes `/road/learn/masters-years?zoom=tile`.
- Why: the query ends up on a path that does not read it, and Done reading or Later then drops it.
- Rule: criterion 10 (the URL holds the board's state) · a test would have caught it: yes, a RoadBoard test zooming with the lesson open.
- Fix: always write to `ROAD_PATH`, or route zoom and view changes through `go()` while a panel is open.

### `src/features/road/model/road-data.ts`

**LOW · line 68 · field nothing reads**
- What: `Tile.mock` is set in the fixture and pinned by `scene.test.ts:124`, but no component reads it. The "a guide · mock" note is one global line on the map and the phone road.
- Why: it is dead data with a test, so it reads as if each tile were marked.
- Rule: `fdd-architecture` YAGNI · a test would have caught it: no.
- Fix: render the per-tile mark (for example in the label's `when`), or drop the field and its test.

### `src/features/road/index.ts`

**LOW · line 10 · public API wider than its users**
- What: the index exports the camera maths, `historyMode`, `RoadPanelContext`, `NEW_SESSION` and more. Outside the feature, only `RoadBoard`, `ShowRoadPanel`, `getRoad`, `roadRedirect`, `lessonById` and `routeStep` are used.
- Why: every export is a contract other features may start to rely on.
- Rule: `fdd-architecture` §2 and YAGNI · a test would have caught it: no.
- Fix: export only what `src/app` imports. Tests import their module by relative path already.

### `src/app/(app)/onboarding/(shell)/done/page.tsx`

**LOW · line 9 · comment no longer matches**
- What: the comment says "Once she has gone to her road, the shell's layout sends her there instead". But `done/` sits outside `(locked)` on purpose and stays open.
- Why: it describes the lock the 13 Oct decision deferred.
- Rule: Quality · a test would have caught it: no.
- Fix: say "stays open after she goes to her road, for now; moving it into (locked) locks it".

### `src/app/page.tsx`

**LOW · line 41 · two hops via `next`**
- What: a finished student signed in with `?next=/onboarding/facts` is sent there, and the `(locked)` layout then sends her to `/road`.
- Why: this breaks the "one hop" rule this branch adds to CLAUDE.md, though only on a rare path.
- Rule: CLAUDE.md §Code (one hop) · a test would have caught it: yes, a `routes.e2e.ts` case with `next`.
- Fix: when `askedFor` is an onboarding path and `onboardedAt` is set, use `ROAD_PATH`.

### `src/shared/components/motion.module.css`

**LOW · line 102 · unused class**
- What: `.sheetIn` and its keyframes were added, but nothing uses them since the sheets moved to the shadcn Sheet (5659a91).
- Why: it is dead CSS in a shared module.
- Rule: CLAUDE.md "remove what your change made unused" · a test would have caught it: no.
- Fix: delete both.

### `next.config.ts`

**LOW · line 15 · retired path now 404s**
- What: the permanent `/futures` → `/onboarding` redirect was removed, and `/futures` is now a 404 (asserted in `routes.e2e.ts:875`). No criterion asked for this.
- Why: CLAUDE.md still says retired paths redirect permanently, and old links now break. The removal keeps the one-hop rule.
- Rule: CLAUDE.md §Code (retired paths) · a test would have caught it: it is asserted, deliberately.
- Fix: record the exception in CLAUDE.md's retired-paths line, or point `/futures` at `/start` and accept a second hop.

### `docs/timeline-board/intent.md`

**LOW · line 38 · criterion text out of date**
- What: criterion 4 still lists "loading", but the 13 Oct decision and the DuckLoader removal mean the board has no loading state.
- Why: the contract and the build disagree on paper.
- Rule: Criteria pass · a test would have caught it: no.
- Fix: strike "loading" from criterion 4, citing the 13 Oct decision.

## Top 3 priority fixes
1. `RoadBoard.tsx:459` — derive the lesson or route panel from `useSelectedLayoutSegments()`, not an effect.
2. `RoadBoard.tsx:57` — no visible stacked layout on a phone before the first measure.
3. `RoadCard.tsx:104` — extract `LessonLink` and `MockTag`, and use the type roles instead of `text-sm`.

## Done well
- The lock is small and well placed. `onboarded_at` is a nullable, metadata-only column. `markOnboarded` writes only `WHERE onboarded_at IS NULL`. The action derives the user from the session, refuses without coins, and returns `ActionResult` through `asStudent` with `refresh()` inside the try. `routes.e2e.ts` checks every visitor kind hop by hop, including the roles `/road` must refuse (signed out, admin).
- The model is pure and tested where the rules live: camera fit, clamp and log tween, wheel and pinch stepping, scene sessions, press-to-card, URL parse/serialize with a bad value dropped per case, and the phone rows. Tile ids are allowlisted against the scene before they touch state.
- APP_PATHS and the proxy matcher changed together. No `loading.tsx` is left under student or admin pages, and `next` stays behind `safeNextPath`.

## Built but not asked for
- Removing the DuckLoader, both `loading.tsx` files and three e2e tests (the developer's decision), and the "one hop" rule in CLAUDE.md with `ADMIN_HOME` and the root page resolving the destination itself.
- Removing the `/futures` redirect (see the LOW finding).
- The shared `Duck` image component, `AccountMenu`'s `band` prop and `SheetContent`'s `showCloseButton`. All three are used by this branch.
- The walk back to the city ("Go to Perth" / "Walk to Cyber Security") and the empty road. Criteria 3 and 4 name both, so they are in scope.

## Blind spots
- The lesson-first-paint and phone-layout flashes only show before hydration. A Playwright check that screenshots or inspects the DOM with JavaScript disabled (or before hydration) would catch both.
- Back from `/road` after "Go to your road" relies on `refresh()` clearing the client router cache. It is checked by hand (smoke 8); an e2e that presses the button and then `page.goBack()` would pin it.
- The 44px tile minimum, the resize re-fit and the reduced-motion camera cut have no test. A `drawTile` unit test for the minimum, and a RoadBoard test that changes the stubbed `clientWidth`, would cover the first two.
- `profile.test.ts`'s once-only write runs only under `DB_TESTS=1` (`bun run test:db`). Make sure it ran before merging.

---
Stack: TypeScript, Next.js App Router (this repo's version: `refresh` from `next/cache`, `LayoutProps`/`PageProps`, history API sync), React 19, Tailwind 4 with CSS modules, Drizzle on Postgres, Bun test with happy-dom, Playwright. Passes applied shallowly: visual fidelity to the Board boards and criterion 13's copy were judged from the code and `smoke.md`, not from screenshots.

## Outcome (13 Oct 2026)
Fixed in `6dca3ab` (`fix(road): the review's findings`): every MEDIUM, and every LOW but one.
- `RoadBoard.tsx:459`: the panel is derived from `useSelectedLayoutSegments()` during render; the context and effect are gone.
- `RoadBoard.tsx:57`: the board stays `invisible` until its first measure, so no wrong layout is painted on a phone.
- `RoadBoard.tsx:111`: `hooks/useRoadSession.ts` holds the session, toasts and history; RoadBoard is 316 lines.
- `RoadCard.tsx:104`: `LessonLink` and `MockTag`, used in every place listed.
- `RoadCard.tsx:135`: partly invalid. `text-base` is the design system's body role (`--text-base: var(--ds-text-body)` in globals.css), so it stays. Six `text-sm` (14px) remain where the design draws 14px and no role matches (caption is 12–13px, body 15px).
- `useMapCamera.ts:33`: one `prefersReducedMotion()` and `rootScale()` in `hooks/motion.ts`.
- `phone-road.module.css:20`, `road-map.module.css:149`: rem; 1px hairlines and one 1.5px dotted outline remain.
- `BottomSheet.test.tsx`: deleted.
- LOWs: named grid sizes; a named `--shade`; memoised depth order and id maps in RoadMap; zoom or view over a panel leaves it for `/road` (tested); `Tile.mock` dropped; road's index narrowed; the done page's comment; a finished student's onboarding `next` goes straight to `/road` (`routes.e2e.ts`); `.sheetIn` deleted.
- `intent.md:38`: "loading" struck from criterion 4 (in the docs commit).

Left, deliberately: `next.config.ts:15` (`/futures` 404s). The developer asked for it to be removed; it was parked, not retired, so the retired-paths rule does not apply.

Verified: `bun run test:run` 826 pass, 0 fail; type-check and lint clean; `e2e/routes.e2e.ts`, `e2e/your-road.e2e.ts`, `e2e/onboarding.e2e.ts` 25 passed; /road at 1440 unchanged against the before screenshot (only the duck's bob differs).
