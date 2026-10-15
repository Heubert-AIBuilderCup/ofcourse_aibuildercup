# Guided post design, part 2 of 3 (Tasks 1–5, 13): Code Review

**Request changes.** 0 CRITICAL · 3 HIGH · 2 MEDIUM · 8 LOW

Verdict for the caller: **Needs fixes.**

| | |
| --- | --- |
| Blocking | HIGH · `layout/fit.ts:100`: the contrast check skips the text at the foot of each slide (source line, search line, frame), which fails on Pop block and on Postcard art |
| | HIGH · GD21: a figure taken from the notes is not refused in a non-factual slot, and no test covers this |
| | HIGH · GD19: no fact names the link it came from |
| Branch | `feat/guided-post-design` at `5e1f39c` over `6ce85a8` · 67 files, +6501 −505 · 13 Oct 2026 |
| Reviewed against | security · security-web · security-llm · performance · CLAUDE.md · `fdd-architecture (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` |
| Scans | secrets N/A (not installed) · dependencies 0 new, 2 pre-existing · code N/A (not installed) |
| Not applicable | other `.claude/skills` (not dispatched) · Tailwind skill (no new styling) |
| Failed to load | none |
| Read outside the diff | 9, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`, `security-llm.md`) | A | — | — |
| Performance | A | — | — |
| CLAUDE.md | A | LOW · `ai/art.ts:34` · dead input | optional |
| fdd-architecture | A | LOW · `SourceForm.tsx:74` · error not announced | optional |
| vercel-react-best-practices | A | — | — |
| Quality | B | MEDIUM · `relayout.ts:129` · labels never fit | derive short labels by code |
| Criteria | C | HIGH · `fit.ts:100` · foot row unchecked | check muted text, back the foot row |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| GD4 | Looks are sets of layouts; changing the look makes no model call | `templates.test.ts:59`, `commands.test.ts:3142` | covered (the idea's look is part 3) |
| GD5 | Layouts the slide can fill, disabled ones with a reason, no model call | `relayout.test.ts:41`, `commands.test.ts:3142` | covered (the logic; the previews are part 3) |
| GD6 | Frame: dots, swipe cue, source line, search line | `svg.test.ts:209`, `engine.test.ts:271` | covered |
| GD7 | No place, so Postcard is not suggested | — | part 3 (Task 6) |
| GD8 | Old posts keep their templates and look the same | `svg.test.ts:313`, `artifacts.test.ts:86`, `templates.test.ts` | covered |
| GD9 | Pop and Subdued; fit, legibility and contrast checks pass | `fit.test.ts:227`, `guideline.test.ts:32`, `commands.test.ts:3211` | covered, but the checks miss the foot row (HIGH) |
| GD15 | Guideline in every prompt | `draft.test.ts:369`, `art.test.ts:129`, `caption.test.ts:217` | covered (the ideas and scene-plan prompts are part 3) |
| GD16 | Images mapped to the palette; original kept; no model call | `tint.test.ts:61`, `svg.test.ts:385` | covered |
| GD17 | A changed guideline flows into presets, tint, prompts and checks | `guideline.test.ts:63`, `fit.test.ts:251` | covered |
| GD18 | Links, framing and notes fields, help text, five-link cap | `SourceForm.test.tsx:43`, `commands.test.ts:640` | covered |
| GD19 | Each link read; facts name their link; source line names the sites; unread links listed | `commands.test.ts:558`, `:603`, `:623`, `engine.test.ts:157` | partly: no fact names its link |
| GD20 | Framing line steers the extraction | `extract.test.ts:127`, `commands.test.ts:661` | covered here (steering the ideas and showing the line are part 3) |
| GD21 | Notes are opinion, never facts, never support a number | `commands.test.ts:661`, `draft.test.ts:405` | partly: the number half is uncovered |

Note: the smoke doc says "GD21 (a number only in your notes is refused: `commands.test.ts`)". No such test exists in this diff or at HEAD.

## Read outside the diff
- `src/features/content/**`: grep of every `layoutStructure`, `slideSpec`, `draw` and `fitChecks` call. All use the new signatures. `draftFitChecks` (`server/preview.ts:150`) passes neither `sites` nor `sourceSite`; the second was already missing, and fit rows do not read the source line.
- `server/fetch-page.ts:9-236`: the guard is https only, refuses private, link-local and metadata ranges, re-checks each redirect, caps the body at 2 MB and has a timeout. It runs once per link, so all five links are guarded.
- `server/page-style.ts:205`: the page art style is checked by `artPromptError` when saved. Moving it after the guideline heading therefore opens no way past the guard.
- `lib/claims.ts:19` and `:100-130`: numbers are checked only in factual slots. A figure in a non-factual slot passes.
- grep for `GD21` in the tests at HEAD: only the `editor_notes` data tests exist.
- grep for `paragraphSite` in the components: nothing shows which link a fact came from.
- `templates/postcard.json` at `5e1f39c`: computed the panel extents against `SOURCE_LINE.y` 1270 (`engine.ts:35`). Panel bottoms are cover 1218, number 1248 and takeaway 1058.
- `server/page-style.ts:184` and the `TEMPLATES` users: a stored `closestTemplateId` still resolves through `templateById`.
- `docs/guided-post-design/smoke.md`: grep for the GD21 claim.

## Findings, by file

### `src/features/content/layout/fit.ts`

**HIGH · line 100 · foot-row contrast**
- What: per surface, the check covers ink on bg and ink on highlight. It never covers `muted`, the colour of the source line, the search line and the frame. Pop block puts stone on yellow at 4.05:1: the Data Desk number source line (`data-desk.json:307`) and the Field Notes cover and takeaway frame and search line. On Postcard the foot row sits outside the panel, over the tinted art: number's panel ends at 1248, takeaway's at 1058, cover's at 1218, while the baseline is at 1270. Stone on the Pop duotone's deep blue is 1.16:1.
- Why: GD9 promises that legibility and contrast pass in both presets. The rows pass while the fact attribution and the search line (criterion 106) can be unreadable.
- Rule: GD9; `security-web` n/a; a test would have caught it: yes, a contrast row for muted on bg, and for the foot row on Postcard.
- Fix: add a muted-on-bg row per surface used, and pick a muted that reaches 4.5:1 on yellow. Extend the panel to cover the foot row on Postcard, or give the foot row its own backing.

### `src/features/content/ai/draft.ts`

**HIGH · line 250 · notes numbers unenforced**
- What: `editor_notes` reaches the draft data, and only the prompt rule (`prompts.ts:200`) keeps their figures out. `unboundSlots` skips non-factual slots (`claims.ts:19`), so "25 hours" from the notes can land in a heading or takeaway and pass every code check. No test asserts that a number found only in the notes is refused.
- Why: GD21 says notes "never support a number". The plan and the smoke doc claim code enforces this, and it does not.
- Rule: GD21 uncovered (HIGH, an uncovered criterion) · a test would have caught it: yes, a fake draft that writes a notes-only figure into a non-factual slot.
- Fix: in `problemsIn`, refuse any number in any slot that is in neither a bound fact nor the source facts, at least one that appears in the notes. Then add the DB test.

### `src/features/content/layout/engine.ts`

**HIGH · line 112 · fact names no link**
- What: `paragraphSite` feeds only the slide's source line. Facts store no link, and no screen shows which article a fact or paragraph came from.
- Why: GD19 says "Each fact names the link it came from". With several links, the editor cannot tell which article a fact rests on.
- Rule: GD19 partly uncovered · a test would have caught it: yes, a component test that a fact row shows its site.
- Fix: show `paragraphSite(source, fact.ref)` on each fact row and chip, and mark article boundaries in the source pane. Test both.

### `src/features/content/server/commands/look.ts`

**MEDIUM · line 117 · preset on a legacy post**
- What: `setPreset` sets `themeId` to `pop` or `subdued` without checking that the post's versions are looks.
- Why: on a legacy post, `slideColours` then returns null, so `draftPreviewPng` gives no image and `approveStructure` refuses with `noTheme` until a theme is chosen again.
- Rule: quality, a reachable state that breaks previews · a test would have caught it: yes, `setPreset` on a `the-line` post.
- Fix: refuse when the picked item, or every item, is not a look, with `WORKFLOW_ERRORS.preset`. Add a DB test.

### `src/features/content/layout/relayout.ts`

**MEDIUM · line 129 · derived labels never fit**
- What: `label`, `labelA` and `labelB` are the whole fact sentence. The number label is capped at 40 characters (`postcard.json`, Field Notes), so changing to Big number or bars almost always yields a failing fit row.
- Why: GD5 is meant to give a designed slide in one click. Every number or bars swap instead needs a hand edit.
- Rule: quality, a derivation that does not meet its own slot limits · a test would have caught it: yes, run `fitChecks` after `relayout` to number.
- Fix: derive a short label by code (the words around the figure, cut at the limit). Pin it with a test that the swapped slide passes its length rows.

### `src/features/content/ai/art.test.ts`

**LOW · line 369 · precondition regex**
- What: `expect(prompt).toMatch(/d/)` matches the letter d, not a digit.
- Why: the precondition ("the guideline has digits") is never really checked.
- Rule: quality, a test that asserts less than it says · caught: no.
- Fix: `/\d/`.

### `src/features/content/components/steps/SourcePane.tsx`

**LOW · line 138 · text silently wins over links**
- What: when a text source gets links added, or a links source gets pasted text, `sourceFrom` (`source.ts:190`) takes the text and drops the links without a word.
- Why: the editor thinks the links were read.
- Rule: quality · caught: no.
- Fix: refuse both together with a message, or clear the other field when one is chosen.

### `src/features/content/server/commands/source.ts`

**LOW · line 186 · framing length counted two ways**
- What: the refusal counts code points, while `BODIES.source` `max(200)` counts UTF-16 units. A 200-emoji line passes the refusal and then throws in `BODIES.source.parse`.
- Why: the editor gets a generic failure instead of "Keep it to 200 characters." The browser's `maxLength` mostly prevents this.
- Rule: quality · caught: no.
- Fix: count the same way in both places.

### `src/features/content/templates/index.ts`

**LOW · line 28 · legacy ticks hidden**
- What: `TEMPLATES = LOOKS`, so `StructuresStep` (lines 237 and 455) lists only the looks. On a legacy post at structures, its own ticked template disappears from the ticks and from the "Ticked:" summary.
- Why: drafting a legacy post again quietly moves it to a look. Part 3's plan expects legacy ticks to stay.
- Rule: GD8 adjacent · caught: no.
- Fix: list `LEGACY_TEMPLATES` for a post whose ticks name one.

### `src/features/content/ai/art.ts`

**LOW · line 34 · dead input**
- What: `tone?` is kept as "no longer drawn; callers may still pass it".
- Why: CLAUDE.md asks for simplicity, with no unused parameters.
- Rule: CLAUDE.md §2 · caught: no.
- Fix: remove it, and the callers' argument.

### `src/features/content/ai/caption.ts`

**LOW · line 150 · page tone dropped**
- What: captions for a page brand (Cerebral) now carry the OfCourse guideline voice in place of the page's own tone. The plan named only `FEED_BRAND.tone`.
- Why: a page's captions change voice. This may be intended, but no criterion says it.
- Rule: done differently from the plan · caught: no (the test pins the new behaviour).
- Fix: confirm with Nikhil, or keep the page tone next to `brand_voice`.

### `src/features/content/components/steps/SourceForm.tsx`

**LOW · line 74 · limit message not announced**
- What: "Up to five links." is a plain `<p>`. It is not in the field's `aria-describedby` and has no live region.
- Why: a screen-reader user sees only a disabled button.
- Rule: `fdd-architecture` §Accessibility · caught: no.
- Fix: add its id to `aria-describedby`, or give it `role="alert"`.

### `src/features/content/layout/fit.test.ts`

**LOW · line 160 · duplicated fixture**
- What: `lookStructure` is copied almost verbatim into `svg.test.ts`.
- Why: two copies drift apart.
- Rule: quality, duplication · caught: no.
- Fix: share one fixture in `text/fixtures` or a test helper.

## Top 3 priority fixes
1. `layout/fit.ts:100`: check muted on bg per surface, fix Pop block's muted, and back Postcard's foot row.
2. `ai/draft.ts:250`: refuse notes-only figures in any slot by code, and add the GD21 number test.
3. `layout/engine.ts:112`: show each fact's site on the workbench (GD19).

## Done well
- The art-prompt guard splits at the last guideline heading (`ownWords`), so an idea that fakes the heading stays guarded. The test at `art.test.ts:369` onward proves it, and the page art style is guarded when saved.
- Legacy drawing is pinned byte for byte. Reading the code confirms why: surface, frame, bars, panel and tint are gated on look-only fields, and the source line keeps the same text and width.
- One guideline file, parsed by zod and cross-checked by name, drives presets, tint, prompts and checks. `compile()` lets every test inject a changed guideline without writing a file.

## Built but not asked for
- The comparison bars drawn as proportional rectangles (`svg.ts`): within GD4's bars layout, but beyond what a criterion states.
- `Made` (a refusal carrying `failed`) on both "Make post" and remake: needed for GD19, and fine.

## Blind spots
- The contrast and legibility of the foot row over art: only a check that samples the art behind the text, or a screenshot review at 360 and 390 widths, would catch it.
- The `PINNED` legacy SVG was added in the same commit that changed the engine, so "captured before" cannot be verified from the diff. I checked it by reading the code paths, not by running the base commit.
- Prompt quality with the guideline appended (whether Gemini honours "no text" next to hex codes) needs `bun run ai:smoke` on Vertex.

---
Stack: TypeScript, Next.js (App Router, server actions), React 19 client components, zod, Drizzle/Postgres, resvg SVG rendering, Gemini prompts; bun test with happy-dom. Passes applied shallowly: none. The Postcard foot-row extents were computed from the JSON, not seen on a rendered slide.


## Resolution · 13 Oct 2026

The developer asked for every valid finding to be fixed before the smoke test. One implementer dispatch fixed all of them, test-first, in `d90a62d`, `2ded400`, `24ace42` and `322aa38` (brief: `.heubert/review-fixes-brief.md`, items 1–35, also covering the GD2 and GD12 differences from the criteria table).
Left, with the reason: `caption.ts:150` page tone (deliberate: GD15 makes the guideline the brand voice for all copy; the page copy style still rides; flagged to Nikhil). Item 19: zod already counted code points, so no throw existed; one shared schema now counts both.
