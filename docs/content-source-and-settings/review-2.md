# Content source and settings, round 2 — Code Review

**Approve with changes.** 0 CRITICAL · 0 HIGH · 4 MEDIUM · 5 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/content-source-and-settings`, uncommitted work on `2cb16dc` over `main` · 66 tracked files +5,083 −2,230, plus 11 new source files and the docs · 2026-10-17 |
| Reviewed against | security · security-web · security-llm · performance · CLAUDE.md · `tailwind-v4-best-practices (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` · the six session briefs (cs-gemini-busy, cs-ideas, cs-limits, cs-header, cs-noscroll, cs-defaults-fix) |
| Scans | secrets N/A (gitleaks not installed) · dependencies N/A (no manifest or lockfile change) · code N/A (semgrep not installed) |
| Not applicable | `fdd-architecture`, `vercel-composition-patterns` (not loaded, per dispatch) · DESIGN.md (no new colour) |
| Failed to load | none |
| Read outside the diff | 9, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`, `security-llm.md`) | A | — | — |
| Performance | B | MEDIUM · `client.ts:735` · 429s spend the cap | refused attempts not counted |
| CLAUDE.md | B | MEDIUM · `SettingsForm.test.tsx:532` · colour asserted | delete two class assertions |
| tailwind-v4-best-practices | A | — | — |
| vercel-react-best-practices | B | MEDIUM · `SettingsForm.tsx:247` · effect-held tab, three ways | one by-name tab hold |
| Quality (tests, accessibility) | A | LOW · `stage.tsx:117` · div in button | optional |
| Criteria | B | MEDIUM · `intent.md:58` · criterion 5 stale | amend criterion 5 and smoke |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | Both starts offered, blog chosen; idea with an idea or on New blog | `SourceForm.test.tsx:263`, `:270` | covered |
| 2 | From a blog, "Make post" makes a feed post | `SourceForm.test.tsx:283` | covered |
| 3 | From an idea: blog first, or straight to the post | `SourceForm.test.tsx:371` | covered |
| 4 | Language, framing, notes, page in either start | `SourceForm.test.tsx:361`, `:371` | covered |
| 5 | One slide, previous/next, "2 of 6", no strip | `parts.test.tsx:126`, `stage.test.tsx:38` | done differently |
| 6 | Panels as tabs, "Fix" badge, fields under headings | `SettingsForm.test.tsx:385`, `:426` | covered |
| 7 | "Send to review" right-most | manual (smoke) | not automatable |
| 8 | Badge; reason on hover or focus; announced | `parts.test.tsx:31`, `:58` | covered |
| 9 | Several Instagram accounts and LinkedIn | `LivePanel.test.tsx:584`, `social.test.ts:597` | covered |
| 10 | Toast text; shares listed with who | `LivePanel.test.tsx:584`, `:607`, `:641` | covered |
| 11 | None ticked: Share unavailable, says why | `LivePanel.test.tsx:621` | covered |

Criterion 5: at the developer's request (no-scroll spec) the filmstrip replaced Previous/Next, and the position is now said to screen readers only (`stage.tsx:96`); see the `intent.md` finding.

## Read outside the diff
- `ai/calls.ts:40` `reserve` — counts every non-cached row of the tier, failed ones included: each 429 retry takes a cap slot (finding).
- grep `useCase:` across `src/` — every student-facing spec is `student_*`; admin's test call runs `once`: the exemption holds.
- `server/after.ts:12` — `after()`; `finish()` wraps each run's work in its own `withWaitNotes`, so a context carried into a nested `after()` is replaced: no notes cross runs.
- `next/dist/docs/.../after.md:56` — nested `after()` is supported, so `checkAfter` from inside the draft run is valid.
- `commands/check.ts:118` `checkAfter` — a failed save is returned untouched; a check in flight is retried once free: no new refusal path. The client's GD29 auto-pick used to trigger the same check, so the cost is unchanged.
- `lib/workflow.ts:439` `approveStructureError` — fit rows never blocked Approve; the Text test expecting Approve enabled with an overlong slot is not a weakening.
- `SourcePane.test.tsx:350` — one of the four `wrap-anywhere` copies it counts is the now sr-only title.
- grep `takeSlideAction` — still wired in `workbench-actions.ts:67`, `:93`; no screen calls it.
- grep `SUPPORT_EMAIL`, `parts.tsx` head — read only by `ai/config.ts` from the server pages, passed by context; no `NEXT_PUBLIC`.

## Findings, by file

### `src/features/content/ai/client.ts`

**MEDIUM · lines 735, 1001 · 429 retries spend the paid daily cap**
- What: Each backoff retry on Pro (735) and on the image model (1001) reserves a new cap slot, and `reserve` counts failed rows too, so a busy minute turns one picture or Pro call into up to six slots.
- Why: The caps bound cost (lib/limits.ts tells judges so) but a 429 is refused, not billed; an 18-image post in a busy spell can take about 100 of the 600 image slots sized in `deploy-checklist.md:155`, locking judges out on submission day.
- Rule: `performance.md` §3, retry policy · a test would have caught it: yes, an image cap of 2 with three 429s then a picture should still draw; `client.test.ts:812` pins the opposite.
- Fix: Keep logging every attempt, but settle a 429-refused reservation so it does not count (a flag `reserve` excludes, or delete the pending row), or hold one slot per call across its retries.

**LOW · line 739 · one note per run, cleared by any call**
- What: Calls running in parallel inside one step share the run's single note; a call that answers clears it (`note(null)`) while a sibling still waits.
- Why: On a multi-call step the loader can drop "Google's model is busy…" mid-wait; cosmetic.
- Rule: Quality · a test would have caught it: yes, two calls under one `withWaitNotes`, one answering while the other waits.
- Fix: Clear only the note this call set, or keep a note per call in the listener and show the latest.

### `src/features/content/components/steps/SettingsForm.tsx`

**MEDIUM · line 247 · three ways to hold the open tab, two through effects**
- What: Settings holds its panel as an index+1 into `PANELS`, Text the same into `TEXT_TABS` (`StructuresStep.tsx:740`), the other steps by name through `StepTabs`; the first two pin the first-opened tab with an effect that writes parent state after render.
- Why: One rule written three times, with an extra render on each first open; the next step that wants "open on To fix, then stay" copies it again.
- Rule: Quality, duplicated logic; `rerender-move-effect-to-event` · a test would have caught it: no, the behaviour is right.
- Fix: One by-name hold in `stage.tsx` (`StepTabs` taking an `initial` name the caller computes, Workbench holding `string | null`), used by Settings, Text and the slide steps; drop `PANELS`, `TEXT_TABS` and both effects.

### `src/features/content/components/steps/SettingsForm.test.tsx`

**MEDIUM · line 532 · a colour class asserted**
- What: This line and `StructuresStep.test.tsx:1157` query `.text-destructive` to prove the count badge is in the problem style.
- Why: Tests the beauty; the tab's accessible name ("To fix · 3 to fix") already pins the count, and a restyle breaks both.
- Rule: CLAUDE.md, test the brain not the beauty · a test would have caught it: n/a.
- Fix: Delete the two lines.

### `src/features/content/components/stage.tsx`

**LOW · line 117 · a block inside a button**
- What: Each thumbnail's `<button>` wraps a `<div>`; a button takes phrasing content only.
- Why: Invalid HTML; harmless in browsers today, flagged by validators.
- Rule: HTML content model · a test would have caught it: no.
- Fix: `<span aria-hidden="true" inert className="pointer-events-none block">`.

### `src/features/content/components/steps/SourcePane.tsx`

**LOW · line 268 · the source title hidden with the step names**
- What: This h2 is the article's title, not the step's name, yet it is now sr-only; the source-kind overline stands alone, `wrap-anywhere` on an sr-only node does nothing, and `SourcePane.test.tsx:372` still counts that copy.
- Why: The editor loses which article she is at; the test checks a copy that cannot overflow.
- Rule: cs-header-brief §2, only headings that repeat the step name · a test would have caught it: no.
- Fix: Keep the title visible at `text-h4`, as the brief does for sub-part headings, or drop the overline and expect three copies.

### `src/features/content/components/Workbench.tsx`

**LOW · line 380 · the Flash-Lite line on every step, until a rerun**
- What: `liteLine` sits under the rail on every screen of the post for as long as a step's last run used Lite.
- Why: The brief asked for the step's own screen, once; on every screen it becomes standing noise.
- Rule: cs-gemini-busy-brief §3 · a test would have caught it: no.
- Fix: Show it beside that step's failed line only, or keep it and record the choice in smoke.md.

### `src/app/admin/(console)/posts/[id]/workbench-actions.ts`

**LOW · line 67 · "Use here" removed, its action kept**
- What: GD11's UI is gone, but `takeSlideAction` (`actions.ts:507`), the `useSlide` command, `SlideTake` and its workflow entries stay wired.
- Why: An editor action no screen offers, still to maintain and test.
- Rule: CLAUDE.md, remove what your change orphans · a test would have caught it: no.
- Fix: Remove the action, schema, command and `'useSlide'` with their tests, or note it kept on purpose.

### `docs/content-source-and-settings/intent.md`

**MEDIUM · line 58 · criterion 5 no longer describes the screen**
- What: Criterion 5 asks for previous and next and a visible "2 of 6"; the no-scroll spec replaced them with the filmstrip and the position is now sr-only (`stage.tsx:96`). `smoke.md:25` still says "Next slide / Previous slide", `:86` omits "Check results", `:104` says Escape does not close the tooltip (it does).
- Why: The contract and the smoke test contradict the build; whoever checks against them will fail it.
- Rule: Criteria pass, done differently · a test would have caught it: no.
- Fix: Amend criterion 5 to the filmstrip (selected thumbnail marked, arrow keys), or show the position visibly under the slide; update smoke.md steps 3 and 11 and the tooltip line.

## Top 3 priority fixes
1. `client.ts:735`, `:1001` — a 429-refused attempt no longer counts against the day's cap.
2. `intent.md:58` — amend criterion 5 (or show the position), and update `smoke.md:25`, `:86`, `:104`.
3. `SettingsForm.tsx:247` — one by-name tab hold in `stage.tsx` for Settings, Text and the slide steps.

## Done well
- The backoff is deterministic under test (`deps.sleep`, `deps.random`), proven against its budget by summing the waits, stops on the caller's abort mid-wait, leaves student calls as they were, and a Lite answer passes the same schema and checks and stays out of the cache.
- Wait notes live outside the database module, one async context per run, writes in order, and each note beats the lock while waiting; a failed note write never fails the run.
- `SUPPORT_EMAIL` is validated, read on the server per request and passed by context; one pure line serves the server's refusals and the screens, and `failure.ts` learnt the new wording with a test. Tests moved to the new structure mostly got stronger: every slide checked for controls, tabs and focus by attributes.

## Built but not asked for
- The six session asks (a–f) sit outside criteria 1–11, and intent.md records none of them. The "Plan · n left to draw" count, the Review "Facts" tab and the Blog step's stage go a little past the no-scroll spec's wording, within its aim.

## Blind spots
- No page scroll at 1440×900 and the listed widths: screenshots per step at each width.
- Tooltips and drawers clipped inside scrolling areas (first-row Ideas cards, tab panels): a manual pass.
- The database suites this work touches, not run here: `DB_TESTS=1 DATABASE_URL=… bash scripts/capped.sh bun test` on `server/store.test.ts` (notes, Lite), `server/commands.test.ts` (draft choices, check after drafting, four cards), `server/images.test.ts` (429 backoff), `server/social.test.ts`; and `bun run type-check`.
- A real Vertex 429's `retryDelay` format: the parser expects `"retryDelay":"12s"` in the message; one probe against Vertex would confirm it.

---
Stack: TypeScript, React 19 / Next.js App Router (server actions, `after()`), Node AsyncLocalStorage, Tailwind 4 container queries, Radix Sheet (shadcn), zod, Drizzle on Postgres, bun test with happy-dom. Passes applied shallowly: accessibility judged by reading, not with a screen reader; the no-scroll fit not checked on screen.

## Applied (17 Oct 2026, the developer's decisions)
- MEDIUM client.ts 429s and the cap: decided "refused attempts don't count". A new `ai_call.refused` flag (migration 0027); refused attempts stay in the log but the day's count reads only answered calls (Pro, image, search and the busy-lite row). Tests: a cap of 2 with three 429s still draws; the same for Pro.
- LOW wait notes: one note per call (`callNotes()`); the run shows the latest note of a call still waiting.
- MEDIUM one tab hold: `StepTabs` holds the open tab by name with an `initial`; PANELS, TEXT_TABS and both effects removed; the first tab is pinned at the first click or key in the step (`holdOnWork`).
- LOW thumbnail button wraps a block `span`.
- LOW source title: visible again at `text-h4` (decided "show it, small").
- LOW Flash-Lite line: only on the screen of the step that used Lite (decided), mapped in one place (`SCREENS`, lib/running.ts); source_check, research and market show it on Settings.
- LOW orphans of GD11: `takeSlideAction`, `SlideTake`, `useSlide` and their workflow entries removed with their tests (also `slideFitsAt`, `draftCalls`).
- MEDIUM the two colour-class test lines deleted; the counts stay pinned by the tabs' names.
- MEDIUM criterion 5: amended in intent.md to the filmstrip (decided); smoke.md steps 3 and 11 and the tooltip line updated.
- Left: nothing. Unit suite 4,353 pass, 0 fail; type-check and lint clean; content DB suites pass on a fresh database with 0026 and 0027.
