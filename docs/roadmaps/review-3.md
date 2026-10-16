# Roadmaps part 3, the board round 3 — Code Review

**Approve with changes.** 0 CRITICAL · 0 HIGH · 5 MEDIUM · 5 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/board-round-3` at `bdf97d8` over `origin/dev` (`470d275`) · 31 files, +1536 −480 · 15 Oct 2026 |
| Reviewed against | security · security-web · performance · CLAUDE.md · AGENTS.md · `fdd-architecture (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` |
| Scans | secrets clean · dependencies unchanged (no package or lockfile change) · code clean (0 findings, 29 files) |
| Not applicable | `security-llm.md` (no model calls) · `vercel-composition-patterns` (not in brief) · criteria 1–11, 23–44 (other parts) |
| Failed to load | none |
| Read outside the diff | 10, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | — | — |
| Performance | A | LOW · `RoadMap.tsx:464` · kind per frame | optional: memoise kinds per scene |
| CLAUDE.md conventions | B | MEDIUM · `KeyStrip.tsx:84` · size per breakpoint | one gap and padding |
| `tailwind-v4-best-practices` | B | MEDIUM · `RoadHeader.tsx:39` · palette step | `text-muted-foreground` |
| `fdd-architecture` | A | LOW · `layout.tsx:28` · name inputs copied | optional |
| `vercel-react-best-practices` | A | LOW · `RoadMap.tsx:464` · memoisation | optional |
| Map model (camera, fixture) | B | MEDIUM · `camera.ts:70` · angled slab framed flat | use `gy1` in `corners` |
| Quality (tests) | B | MEDIUM · `RoadHeader.test.tsx:55` · repeated test | delete it |
| Criteria | B | MEDIUM · `PhoneRoad.tsx:87` · "Your road" left | rename two labels |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 12 | kind words over every name | `kinds.test.ts:15`, `drawing.test.ts:321`, `RoadBoard.test.tsx:657` | covered |
| 13 | icons flat on the top face, coloured by state | `kinds.test.ts:56`, `drawing.test.ts:424`, `RoadBoard.test.tsx:672`; colours manual | covered |
| 14 | hanging labels, all named, Adelaide, edge, phone | `drawing.test.ts:295–421` | covered, one clause deferred |
| 15 | plain trade-offs on two lines | `copy.test.ts:28`, `RoadBoard.test.tsx:880`, `:982` | covered |
| 16 | forward fork, junction, angled 491, ruler side | `scene.test.ts:62–104`, `drawing.test.ts:278` | covered |
| 17 | key strip: content, first visit, phone grid | `RoadBoard.test.tsx:822`, `KeyStrip.test.tsx:10`; phone grid manual | covered |
| 18 | no Back, breadcrumb, Map key replaces View | `RoadBoard.test.tsx:713`, `:822`, `RoadHeader.test.tsx:43` | covered |
| 19 | hover lift, hit area fixed, name fades | `RoadBoard.test.tsx:685`, `:699`; motion manual | covered |
| 20 | every button acts; Ask/Compare toast | `RoadBoard.test.tsx:849`, `:1036`, `:794`, `press.test.ts:163` | covered |
| 21 | "your roadmap" everywhere but Whole road | `copy.test.ts:35` (fixture only) | partial |
| 22 | sizes at phone, tablet, 1440, 1920 | manual (smoke step 6) | not automatable |

Note: 14's "with Your answers open, the small map names only what would change" needs the Your answers panel (part 4); nothing here can satisfy it yet. 21 is partial: two accessible names still say "Your road" (finding below).

## Read outside the diff
- `src/features/road/model/press.ts:55–118` — `cardFor`/`primaryAction`: the new walk rule only fires for the last `next` tile when it is a place or course; a route step still gets a look card (link), swap and list rules run first. Settled.
- `src/features/road/model/drawing.ts:274` — `depthOrder` sorts on `middle()`, which now averages `gy1`: the angled slab and the junction are ordered correctly. Settled.
- `src/features/road/model/drawing.ts:228` — the hit box is computed from the unlifted geometry for a hovered tile; for the angled slab it still covers the slab (the hexagon clip is the same generic shape every slab already had). Settled.
- `src/features/road/model/camera.ts:59–85` — `corners()` ignores `gy1` (finding below).
- `src/features/road/components/road-map.module.css:97,107` — `[data-lift]` drives the hover top colour; still set on hover. Settled.
- `src/features/road/components/RoadMap.tsx:69,126,137` — `MAP_BUTTON` has no phone hide; `parent` is still used for labels, not dead; the map region is still named "Your road, map".
- `src/design-systems/industry/theme.css:71`, `src/app/globals.css:102` — `neutral-500` is a design-system palette step, not a semantic role.
- `src/app/(app)/roadmaps/page.tsx:29–65` — the list resolves names from the same `here`/`city` inputs as the layout, so the breadcrumb and the list agree.
- `docs/roadmaps/reference/logic/board.js:17–50, 266–286, 664–692` — `ICO` paths, `lgKind`, `lgFork` numbers, `icoM` and the edge thresholds match; two small drifts noted (LOW).
- `grep "your road"` over `src` (non-test) — `PhoneRoad.tsx:87`, `RoadMap.tsx:137` remain.

## Findings, by file

### `src/features/road/components/PhoneRoad.tsx`

**MEDIUM · line 87 · wording left behind**
- What: The phone list keeps `aria-label="Your road"`, and `RoadMap.tsx:137` keeps the region name "Your road, map", while the switch beside them was renamed "Show your roadmap as".
- Why: Screen-reader users still hear "your road". Criterion 21 says every user-facing instance changes, and the board now names the same thing two ways.
- Rule: intent criterion 21 · a test would have caught it: no, `copy.test.ts` only scans fixture strings, not component copy or accessible names.
- Fix: Rename both to "Your roadmap" and "Your roadmap, map", and update the two e2e locators. Widen the copy check to a source grep, or accept these as names for the Road view and record that decision in the intent.

### `src/features/road/model/camera.ts`

**MEDIUM · line 70 · angled slab framed as flat**
- What: `corners()` builds a slab's frame from `t.gy ± w` at both ends, so the 491's far end (`gy1 -2.1`) is framed as if it sat at `-1.25`. This branch added `gy1` to `drawTile`, `middle`, `ends` and `iconOn`, but not to the camera.
- Why: At the Tile stop focused on the 491 lane, the camera frames a slab that isn't there, so the real lane sits off-centre and can be cut at its end. At Whole road the 191 tile hides the gap.
- Rule: `performance.md` n/a; correctness of a named risk · a test would have caught it: yes, a `fit('tile', 'regional-491', …)` test checking that the lane's far end is inside the frame.
- Fix: In the slab branch, use `t.gy1 ?? t.gy` for the two `gx1` corners (or share `drawTile`'s `quad`), and add that one test.

### `src/features/road/components/KeyStrip.tsx`

**MEDIUM · line 84 · sizes per breakpoint**
- What: The strip changes its gap and padding by width (`@max-5xl:gap-3 @max-5xl:pl-2.5`, `@max-xl:gap-x-3 … py-1.5 pr-1.5`), on top of the phone layout switch.
- Why: CLAUDE.md: "Never a size per breakpoint". Spacing should come from one value or a fluid role; only the layout (flex to grid) should respond to width.
- Rule: CLAUDE.md §Code (sizes) · a test would have caught it: no, a convention.
- Fix: Keep the `@max-xl:grid` layout switch and use one gap and padding at every width (or `gap-stack`).

**LOW · line 94 · focus lost on Got it**
- What: "Got it" unmounts the strip, so keyboard focus falls to `<body>`.
- Why: A keyboard user loses their place on the board (criterion 36 territory).
- Rule: `fdd-architecture` §Accessibility · a test would have caught it: yes, assert `document.activeElement` is Map key after Got it.
- Fix: On close, focus the Map key button (pass a ref, or focus it in `onKeyShown(false)`).

### `src/features/road/components/RoadHeader.tsx`

**MEDIUM · line 39 · palette step where a role exists**
- What: The breadcrumb separator uses `text-neutral-500`, the only `text-neutral-*` in `src`.
- Why: CLAUDE.md asks for semantic tokens only. A palette step does not follow the role when the theme or design system changes.
- Rule: `tailwind-v4-best-practices` §Design Tokens; CLAUDE.md §Code · a test would have caught it: no, a convention.
- Fix: Use `text-muted-foreground`.

### `src/features/road/components/RoadHeader.test.tsx`

**MEDIUM · line 55 · repeated test**
- What: "hands Ask and Compare to the board" checks that `onLater` is called twice. `RoadBoard.test.tsx` ("Ask and Compare") already presses the same two header buttons and checks the toast they cause.
- Why: Two tests pin one behaviour, so one change breaks both. This is test bloat.
- Rule: review Quality (repeats another test's assertion) · a test would have caught it: n/a.
- Fix: Delete this test and keep the breadcrumb test.

### `src/features/road/components/RoadMap.tsx`

**LOW · line 464 · per-frame kind lookups**
- What: `kindOf` runs twice per tile on every camera frame (in `labelOf` via `drawing.ts`, and in `TileIcon`). Each call does `includes` over `lit`/`next`/`ahead`/`cityLine`.
- Why: The cost grows with tiles × road length × frames. That is trivial on the hand-placed fixture, but the graph engine will grow it. The result depends only on the scene.
- Rule: `performance.md` §2 (recomputation where the input did not change); `vercel-react-best-practices` `rerender-memo` · a test would have caught it: no.
- Fix: `useMemo(() => new Map(scene.tiles.map((t) => [t.id, kindOf(t, scene)])), [scene])` in `Drawing`, and pass the word and icon in.

### `src/features/road/components/road-map.module.css`

**LOW · line 275 · hover and press double-lift**
- What: Pressing a hovered tile drops `data-hover` (the CSS transform eases back from −6px) while the geometry jumps up 6px at once. For 0.18 s the tile shows at about −12px, then settles. Closing the card while still hovering dips it the other way.
- Why: A small visible bounce on every press. Criterion 19 asks for a smooth lift.
- Rule: intent criterion 19 · a test would have caught it: no, motion is the smoke test's.
- Fix: Keep `data-hover` while pressed and drop the geometry lift for a hovered-then-pressed tile, or turn off the transform transition when `data-lift` comes from a press.

### `src/features/road/model/fixture.ts`

**LOW · line 176 · reference drift**
- What: The junction is labelled at every stop (`ABOVE`), where the reference's `lgFork` leaves it unnamed at Whole road (`road: 'none'`). Separately, `labelOf` (`drawing.ts`) still shows the parent city's sub at Level, which the legible reference drops ("names only, the card has the rest").
- Why: These are small differences from the agreed geometry and label rules; the Whole road view gets one more name.
- Rule: intent Decisions (the reference's geometry) · a test would have caught it: the scene test pins `ABOVE`, so it would have caught it had it pinned the reference.
- Fix: `lab('none', 'above', 'above')` for the junction, and drop `c.parent` from the Level sub rule. Or keep both and say so in smoke.md.

### `src/app/(app)/roadmaps/[id]/layout.tsx`

**LOW · line 28 · name inputs copied**
- What: `nameOf(road.walk.here)` / `nameOf(road.walk.cityLine[0])` repeats `roadWords().names` in `roadmaps/page.tsx:37`.
- Why: Two copies of one naming rule can drift, and the breadcrumb and the list must agree. This is two uses, under the rule of three.
- Rule: `fdd-architecture` §5 (rule of three) · a test would have caught it: no.
- Fix: Optional: export a `roadNames(road)` from the roadmaps model and call it in both places.

## Top 3 priority fixes
1. `src/features/road/model/camera.ts:70` — frame the angled slab by its `gy1` end, and add one fit test.
2. `src/features/road/components/PhoneRoad.tsx:87`, `RoadMap.tsx:137` — "Your roadmap" in the two accessible names (and the e2e locators).
3. `src/features/road/components/KeyStrip.tsx:84`, `RoadHeader.tsx:39` — one spacing value; `text-muted-foreground`.

## Done well
- The rules sit in the pure model (`kindOf`, `iconOn`, `labelOf`'s phone and edge rules, `cut`) and are tested against the reference's numbers. The hit box staying put under hover is asserted, not assumed.
- Removing ViewMenu, MapKey and Back left nothing behind: no orphaned props (`onBack`, `onKey`), handlers (`back`), CSS (`.swatch`) or imports.
- The `c87e6a6` walk fix is narrow. It comes after the swap and list rules, covers only the last `next` place or course, and its test also pins that a route step is not a walk.

## Built but not asked for
- The junction's own card ("Fork", its guide line). It is pressable, so it needs one; this is reasonable and noted in smoke.md.
- The phone rule moving any other city's label beside it (the reference does this for Adelaide only).

## Blind spots
- The icon colours per state, the hanging line, the hover easing and the key strip's phone grid are CSS only. Only the 390/768/1440/1920 smoke screenshots against RoadB*/RBKey* check them.
- The camera's framing of the angled slab: no unit test exercises `fit` on a slab with `gy1`.
- Wording outside the fixture (component strings, accessible names): `copy.test.ts` does not scan it. A grep-based test over `src/features/road` would.

---
Stack: TypeScript, React 19 / Next.js (App Router layout, client components), SVG with CSS modules, Tailwind 4 (container queries), bun:test with happy-dom. Passes applied shallowly: none. The motion and look were judged from the code, not on screen.

## Outcome (15 Oct 2026)
All 10 findings fixed in `49f3ba1` (`fix(road): the review's findings on the legible board`): "Your roadmap" / "Your roadmap, map" as the two region names (the copy test now greps the feature's source); the camera frames an angled slab's far end; one gap and padding on the key strip at every width; `text-muted-foreground` for the separator; the repeated Ask/Compare test deleted; kind words and icons memoised per scene; a pressed tile's transform does not animate (no double lift); the junction unnamed at Whole road and Perth's sub dropped at Level; Got it hands focus to the Map key button; `roadNames(road)` shared by the layout and the list. Left: nothing. Note: closing the card while a tile is still hovered (keyboard focus) can dip it once.
Verified: `bun run test:run` 1031 pass, 0 fail; `e2e/your-road.e2e.ts` + `e2e/routes.e2e.ts` 13 passed; type-check and lint clean.
