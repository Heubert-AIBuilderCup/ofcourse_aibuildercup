# Story 14, move back and forth between the steps — Code Review

**Approve with changes.** 0 CRITICAL · 0 HIGH · 5 MEDIUM · 6 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/guided-post-design`, range `ea4fb56..6ce85a8` (part 1 of 3) · 51 files, +3296 −362 (generated snapshot and journal left out) · 13 Oct 2026 |
| Reviewed against | security · security-web · performance · CLAUDE.md · Industry `DESIGN.md` · `fdd-architecture (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` |
| Scans | secrets N/A (gitleaks not installed) · dependencies 0 new, 2 pre-existing · code N/A (semgrep not installed) |
| Not applicable | `security-llm.md` (no prompt changes; the remake reuses existing extract and draft calls) · skill `rules/` files (no hunk raised one) |
| Failed to load | none |
| Read outside the diff | 9, listed below |

Pre-existing, not this branch: `braces` <=3.0.3 (high, GHSA-vfj7-8cjw-p6xm) and `esbuild` <=0.24.2 (moderate, GHSA-67mh-4wv8-2f99). package.json is unchanged, so neither counts toward the decision.

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | — | — |
| Performance | A | — | — |
| Data (moves, publish, discard) | B | MEDIUM · `back.ts:200` · discard keeps working page | restore page and theme too |
| `fdd-architecture` | B | MEDIUM · `board.ts:90` · rule duplicated | one `changedSincePublished` helper |
| `vercel-react-best-practices` | A | — | — |
| `tailwind-v4-best-practices` / Industry | A | LOW · `Board.tsx:114` · tag classes repeated | use `tag` |
| Accessibility | B | MEDIUM · `parts.tsx:65` · focus lost on confirm | move focus into the confirm |
| Criteria | B | MEDIUM · `workflow.ts:115` · no discard at source | allow discard at `source` |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 111 | Passed steps read-only, rail links passed steps only | `Workbench.test.tsx:195`, `:216`; `StageRail.test.tsx:23`; `ReviewPanel.test.tsx:329` | covered |
| 112 | Back to step keeps records, clears approval | `commands.test.ts:2292`, `:2324`, `:2356`; `StructuresStep.test.tsx:601` | covered |
| 113 | Source editable, remake, old versions restorable | `commands.test.ts:2689`, `:2794`, `:2856`; `SourcePane.test.tsx:321`, `:363` | covered |
| 114 | Covers reused only for the same text | `commands.test.ts:2634` | covered |
| 115 | Withdraw from review, off reviewer's list | `commands.test.ts:2422`; `ReviewPanel.test.tsx:308` | covered |
| 116 | Edit live: students keep live version; Board "Live" badge | `commands.test.ts:2442`; `store.test.ts:913`; `LivePanel.test.tsx:276`; `Board.test.tsx:100` | covered, badge differs |
| 117 | Republish replaces at the same slug | `commands.test.ts:2442`; `store.test.ts:935` | covered |
| 118 | Moves refused while a step runs, naming it | `commands.test.ts:2388`, `:2442` | covered |
| 119 | "Changed since published", Discard after confirm | `commands.test.ts:2516`, `:2581`; `Workbench.test.tsx:239`, `:265` | partly: not at `source` |
| 120 | Request changes, note at the named step, kept until resend | `commands.test.ts:2596`; `current.test.ts:239`; `ReviewPanel.test.tsx:263`; `Workbench.test.tsx:295`, `:313` | covered |
| 121 | Confirm lists kept and remade; only "Go back" moves | `back-summary.test.ts`; `StructuresStep.test.tsx:601`; `SourcePane.test.tsx:391` | covered |
| 122 | Moves disabled with the running step in words | `running.test.ts`; `StructuresStep.test.tsx:626`; `SourcePane.test.tsx:409`; `LivePanel.test.tsx:287`; `ReviewPanel.test.tsx:316`; `Workbench.test.tsx:277` | covered |

Criterion 111 was judged as written in this range (one long page, rail links scroll to anchors). GD27 replaced it later with one screen per step. Criterion 120's "stays visible after the editor withdraws" can never apply, because sending to review clears the note and withdraw only runs from review. The smoke report raises this as a question, and the intent still has to be reworded.

## Read outside the diff
- `src/app/(feed)/feed/[id]/page.tsx`, `feed/page.tsx`, `feed/assets/[id]/route.ts`, `(public)/posts/[slug]/page.tsx`, `posts/assets/[id]/route.ts`, `sitemap.ts`: every student route reads only `liveById`, `listLive`, `liveBySlug`, `isLiveAsset`, `relatedCandidates` or `listLiveSlugs`, and never `loadPost` or a stage.
- `server/store.ts:954` `isLiveAsset`: goes through `approvalOf` + `liveFeedPosts()`, so it reads the published approval. Settled.
- `server/store.ts:889` `instagramLinks`: reads exported social children by parent. A working pointer of the feed post is never read. Settled.
- `server/store.ts:403`: `title` is written only when the placeholder is first extracted. No move or remake changes the title students see. Settled.
- `server/store.ts:533`, `:586` `LIVE_STAGES`: used only on the admin side (the Board's live line). Settled.
- `server/commands/shared.ts:115` `open()`: runs `actionError` (editor-only for every new action) and refuses social posts. All six new actions go through `onPost` → `command` → `open`. The no-session case is covered by `actions.test.ts:178` over `CASES`. Settled.
- `server/steps.ts:138` `runningSteps`: ignores rows past `TIMEOUT`, so a crashed step cannot lock the moves forever. Settled.
- `model/current.ts:40-90`: vision and override are not read, so losing them on discard does nothing. Covers count only for their revision. Settled.
- `server/social.ts:353`, `:396` and `LivePanel.tsx:62`: a live post's social versions read `pointers.pageBrandId`. This is the basis of the discard finding below.

## Findings, by file

### `src/features/content/server/commands/back.ts`

**MEDIUM · line 200 · discard is not a full return to the live version**
- What: `discardChanges` spreads `post.pointers` (the working copy) under the published records. As a result `pageBrandId`, `themeId` and `coversId` stay as the editor left them, not as they were when the post was published.
- Why: a live post's social versions read `pageBrandId` (`social.ts:396`, `LivePanel.tsx:62`). After "Discard changes", a page change the editor threw away still decides whether "Create social version" reuses the post's art. Criterion 119 says discard returns the post to its live version.
- Rule: criterion 119; `security.md` §6, data integrity · a test would have caught it: no, `commands.test.ts:2516` checks only the pinned pointers and never changes the page or theme before discarding.
- Fix: restore `themeId` from `published.revision.themeId`. Pin `pageBrandId` on the approval body at publish (nullable, default null for older records) and restore it from there. Then add both keys to the discard test after a page and theme change.

**LOW · line 169 · discard keeps the working pick when the facts match**
- What: `publishedDrafts` returns the current `draftsId`, `picked` and `ticked` whenever the current drafts share the published facts, even if the editor has picked another version since.
- Why: the next "Edit" then starts from the discarded pick, not from the published text.
- Rule: criterion 119 · a test would have caught it: no, the discard test remakes the source, so the facts always differ.
- Fix: run the structure-matching branch in both cases, so `picked` is the index whose structure equals the published revision's.

### `src/features/content/lib/workflow.ts`

**MEDIUM · line 115 · no "Discard changes" at the source step**
- What: `discardChanges` is allowed at `structures`, `approved`, `rendered` and `in_review`, but not at `source`. A live post taken to "Edit" and then "Back to source" shows the "Changed since published" badge with no Discard button (`Workbench.tsx:136`).
- Why: criterion 119 offers Discard for any live post being edited. At the source step the editor has to "Continue with this source" first, which also runs the source check.
- Rule: criterion 119 (the plan's stage list is narrower than the criterion) · a test would have caught it: yes, a workflow case for `source`; `workflow.test.ts` pins the narrower list.
- Fix: add `'source'` to the list. The command needs no other change, and the test's `STAGES_ALLOWED` should include it.

### `src/features/content/lib/board.ts`

**MEDIUM · line 90 · the "changed since published" rule exists twice**
- What: `publishedApprovalId !== null && !['live','exported'].includes(stage)` is written once here (with its own `PUBLISHED_STAGES`, line 40) and again inline in `Workbench.tsx:136`. The stage list is a third copy of `LIVE_STAGES` (`store.ts:491`).
- Why: if the rule changes (for example, adding `source` handling), the Board and the workbench can disagree.
- Rule: quality, no duplicated logic; `fdd-architecture` KISS · a test would have caught it: no, each copy is tested alone.
- Fix: export one pure `changedSincePublished(stage, publishedApprovalId)` from `lib/` (with the published stages) and call it from both places.

### `src/features/content/components/Board.tsx`

**MEDIUM · line 114 · criterion 116's "Live" badge is replaced, not added**
- What: criterion 116 says the Board shows an edited live post "in its working column with a 'Live' badge". The card shows "Changed since published" (the wording of criterion 119) and no "Live".
- Why: the criteria disagree on what the card reads, and the intent's Changes entry does not say that 119 replaces 116's badge.
- Rule: criterion 116 done differently · a test would have caught it: yes, `Board.test.tsx:100` asserts only the 119 wording.
- Fix: either add a "Live" tag next to "Changed since published", or amend criterion 116 in the intent's Changes to say the badge reads as 119 has it.

**LOW · line 114 · tag classes written out again**
- What: `border px-2 py-0.5 text-caption` is repeated here and at `Workbench.tsx:141`, while `parts.tsx` already exports `tag` for this.
- Why: one more copy of the status-tag style to keep in step.
- Rule: Industry `DESIGN.md`, status tag; `tailwind-v4-best-practices` §2 · a test would have caught it: no, a convention.
- Fix: use `tag` (with `self-start` on the Board).

### `src/features/content/components/parts.tsx`

**MEDIUM · line 65 · focus is lost when a confirm opens**
- What: `Move` disables its own trigger (`disabled={blocked || asking}`) while the confirm is open and moves focus nowhere. A keyboard user's focused button turns disabled, focus drops to `<body>`, and the next Tab starts at the top of the page, far from "Go back" or "Stay".
- Why: every move back and "Discard changes" goes through this confirm.
- Rule: `fdd-architecture` §Accessibility (keyboard support) · a test would have caught it: yes, a component test asserting `document.activeElement` after the click.
- Fix: put `autoFocus` on "Stay" (the safe choice), or focus the question heading through a ref, and give focus back to the trigger when "Stay" closes the confirm.

### `src/features/content/server/commands/structures.ts`

**LOW · line 447 · covers reused across a page or emotion change**
- What: `earlierCovers` matches on structure, template, brand and theme. Brand is always `FEED_BRAND`, and neither the post's page (`pageBrandId`, which sets the art style, criterion 105) nor the emotion is part of the match.
- Why: if an editor goes back, changes the page and approves the same text, the cover options are the ones drawn in the old page's style.
- Rule: criteria 105 and 114 read together · a test would have caught it: no, `commands.test.ts:2634` never changes the page.
- Fix: also match the `pageBrandId` the covers were made under, which needs it stored on the covers body or the revision. Otherwise record in the intent that 114 matches on text only.

### `src/features/content/server/store.test.ts`

**LOW · line 985 · the backfill test runs a copy of the migration**
- What: the test runs a hand-copied `update … set published_approval_id …` statement instead of the SQL in `0008_content_post_published_approval.sql`.
- Why: if someone edits the migration's statement, the test still passes.
- Rule: quality, a test should assert behaviour and not a copy · a test would have caught it: n/a.
- Fix: read the statement from the migration file (the second statement, after the breakpoint) and narrow it with the test's id prefix.

### `src/features/content/lib/back-summary.ts`

**LOW · line 7 · client-safe lib takes its type from the server module**
- What: `import type { BackTo } from '../server/commands'` in a pure, client-safe file. `actions.ts:77` also restates the same union as `z.enum(['source', 'structures'])`.
- Why: the lib layer depends on the server barrel, and the two definitions can drift apart.
- Rule: `fdd-architecture` §1 locality; quality, no duplication · a test would have caught it: no.
- Fix: define `BACK_TO = ['source', 'structures'] as const` and `BackTo` in `lib/workflow.ts`, and use it from `back.ts`, `actions.ts` and here.

### `src/features/content/components/HistoryPanel.tsx`

**LOW · line 55 · restore of an older version silently rolls back fact edits**
- What: any drafts record can now be restored, with the post pointed back at the facts it was drafted from (`restore.ts:58`). For the same source, that includes facts from before "Add as fact" or "Remove", and nothing says so.
- Why: the editor's fact edits disappear from the post without warning. The newer facts record still exists, but History does not list it.
- Rule: criterion 113 extended beyond a remade source; criterion 95 · a test would have caught it: no.
- Fix: when the drafts' facts differ from the current ones, add a line beside "Restore" ("Brings back the facts it was made from"), or limit this branch to facts from another source.

## Top 3 priority fixes
1. `back.ts:200`: restore `themeId` from the revision and a pinned `pageBrandId` on discard.
2. `workflow.ts:115`: allow `discardChanges` at `source`.
3. `parts.tsx:65`: move focus into the confirm and give it back on "Stay".

## Done well
- The published version is a column of its own (`published_approval_id`), written in the same transaction as the approval. Every student reader goes through one join (`approvalOf`) and one predicate (`liveFeedPosts`), including Related's source match through the published facts. No student path reads the working pointers.
- The DB tests prove what matters: records are never deleted by a move; the live page stays byte-equal through edit, remake and discard; republishing keeps the same slug; a reviewer or an admin is refused on every new command.
- No model or network call runs inside a transaction: the remake reads the page and extracts outside `save`, and `earlierCovers` is one indexed query inside it.

## Built but not asked for
- A running-step label for `market` ("The market version is being made"). It is harmless and consistent with criterion 122.
- Restoring drafts made from earlier facts on the same source (see the HistoryPanel finding).

## Blind spots
- Discard after a page or theme change: needs a DB test that changes both during the edit and checks the live post's pointers afterwards.
- Keyboard flow through the confirms: needs a component test on `document.activeElement`, or a Playwright keyboard pass.
- Race between `waitingFor` and a step that starts just after it: the version check in `save` protects the data, but nothing tests it.
- How the header confirm (`max-w-sm` inside the step header row) looks at 1024–1440: it is checked by screenshots, not by tests.

---
Stack: TypeScript, Next.js (App Router, server actions), React 19 client components, Drizzle ORM on Postgres (jsonb), Tailwind 4, bun test with happy-dom. Passes applied shallowly: none. Industry's "status is one word in a tag" conflicts with the badge wording that criterion 119 dictates; the intent wins.


## Resolution · 13 Oct 2026

The developer asked for every valid finding to be fixed before the smoke test. One implementer dispatch fixed all of them, test-first, in `d90a62d`, `2ded400`, `24ace42` and `322aa38` (brief: `.heubert/review-fixes-brief.md`, items 1–35, also covering the GD2 and GD12 differences from the criteria table).
Left, with the reason: none in this report. Criterion 120 wording corrected in the intent by the controller.
