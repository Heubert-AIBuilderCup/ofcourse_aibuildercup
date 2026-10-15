# Admin feed post from a source — Code Review

**Request changes.** 0 CRITICAL · 3 HIGH · 7 MEDIUM · 7 LOW

| | |
| --- | --- |
| Blocking | HIGH · `src/shared/lib/auth/access.ts:110` · criteria 11 and 12 have nothing in this branch behind them |
| | HIGH · `src/features/content/ai/market.ts:131` · the Nepal number guard accepts numbers from unsupported and unbound facts (59) |
| | HIGH · `src/features/content/lib/workflow.ts:162` · a render with no vision result can be sent to review and published (39) |
| Branch | `feat/admin-feed-post-from-source` at `dabd851` over `origin/dev` (`36ffb90`) · 208 files, +28920 −124 · 2026-10-06 |
| Reviewed against | security · security-web · security-llm · performance · CLAUDE.md · AGENTS.md · `industry (DESIGN.md)` |
| Scans | secrets N/A (gitleaks not installed) · dependencies 0 new, 2 pre-existing · code N/A (semgrep not installed) |
| Not applicable | `.claude/skills` (never installed: setup-ai-skills.sh not run) |
| Failed to load | none |
| Read outside the diff | 9, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`, `security-llm.md`) | C | HIGH · `ai/market.ts:131` · model output number guard | Check against the post's own numbers |
| Performance | B | MEDIUM · `server/commands.ts:234` · render and vision inline | Move rendering off the request |
| CLAUDE.md / AGENTS.md | B | MEDIUM · `db/schema.ts:16` · shared imports a feature | Move the constants into shared |
| industry (DESIGN.md) | A | LOW · `UserPage.tsx:133` · sizes outside the roles | optional |
| Quality | B | MEDIUM · `StructuresStep.tsx:57` · repeated helpers | One shared copy of each |
| Criteria | C | HIGH · criteria 11, 12 uncovered; 39 fails open | Ship the sign-in pages, close the gate |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | "OfCourse Admin", no internal names | `site.test.ts`; `content-roles.e2e.ts:174` | covered |
| 2 | only Board and Users tabs | `nav.test.ts`; `content-roles.e2e.ts:190` | covered |
| 3 | one line confirms each change | `content-feed-post.e2e.ts:141` | covered |
| 4 | Replay on a demo-source failure | `replays.test.ts`; `content-feed-post.e2e.ts:200` (skipped) | mechanism only |
| 5 | failure keeps work, Try again | `client.test.ts`, `SourceForm.test.tsx`; `content-feed-post.e2e.ts:183` | covered |
| 6 | daily cap acts as a failed call | `client.test.ts`, `store-backed.test.ts` | covered |
| 7 | nothing clipped at 1280 px | `content-roles.e2e.ts:85` | partial |
| 8 | superadmin gives Editor, Reviewer | `access.test.ts`, `UserPage.test.tsx`; `content-roles.e2e.ts:92` | covered |
| 9 | waiting roles at first sign-in | `hooks.test.ts`; `content-roles.e2e.ts:130` | covered |
| 10 | admin cannot change roles | `UserPage.test.tsx`, `users/commands.test.ts`; `content-roles.e2e.ts:159` | covered |
| 11 | admin sign-in page reaches the Board | — | uncovered |
| 12 | student sign-in page refuses staff | — | uncovered |
| 13 | no Users tab, users URL refused | `content-roles.e2e.ts:174` | covered |
| 14 | admin sees all, changes nothing | `workflow.test.ts`, `server/commands.test.ts`; `content-roles.e2e.ts:196` | covered |
| 15 | superadmin has every action | `access.test.ts`, `workflow.test.ts` | covered |
| 16 | role removed: "Not authorised." | `actions.test.ts:131`; `users/commands.test.ts` | covered |
| 17–20 | columns, linked cards, changed by, workbench | `board.test.ts`, `Board.test.tsx`, `Workbench.test.tsx`; `content-feed-post.e2e.ts:215` | covered |
| 21 | stale save refused | `store.test.ts`, `server/commands.test.ts`; `content-feed-post.e2e.ts:533` | covered |
| 22–24 | paragraphs, facts, planted claim | `extract.test.ts`, `locate.test.ts`, `SourcePane.test.tsx`; `content-feed-post.e2e.ts:150`, `:176` | covered |
| 25–30 | templates, drafts, chips, No source, themes | `claims.test.ts:62`, `StructuresStep.test.tsx`, `draft.test.ts`; `content-feed-post.e2e.ts:253` | covered |
| 31–35 | gate, reopen, fit rows | `fit.test.ts`, `workflow.test.ts`; `content-feed-post.e2e.ts:297` | covered |
| 36–38 | render, No art, art-prompt guard | `render.test.ts`, `art.test.ts`; `content-feed-post.e2e.ts:317`, `:357` | covered |
| 39 | vision check gates publishing | `vision.test.ts`, `workflow.test.ts`; `content-submission.e2e.ts:225` | fails open |
| 40–41 | light edits, regenerate cover | `server/commands.test.ts`; `content-submission.e2e.ts:267`, `:307` | covered |
| 42–48 | source check, opinion, review, send back | `source-check.test.ts`, `ReviewPanel.test.tsx`; `content-feed-post.e2e.ts:389`–`:508` | covered |
| 49–51, 53 | layer, audience, why line, mock | `SettingsForm.test.tsx`, `workflow.test.ts`; `content-feed-post.e2e.ts:389` | covered |
| 52 | the missing setting is named | `workflow.test.ts` | done differently |
| 54 | live card line, settings locked | `LivePanel.test.tsx`, `lines.test.ts`; `content-feed-post.e2e.ts:477` | done differently |
| 55 | preview in context | `PhoneFeedCard.test.tsx`; `content-submission.e2e.ts:334` | covered |
| 56–58, 60–61 | Nepal card, NPR, live together | `lib/market.test.ts`, `server/commands.test.ts`; `content-submission.e2e.ts:357`, `:386`, `:400` | covered |
| 59 | Nepal changes no number | `ai/market.test.ts` | partial |
| 62–67 | Adapt, social version, caption, export | `social.test.ts`, `caption.test.ts`, `zip.test.ts`; `content-submission.e2e.ts:432`–`:491` | covered |
| 68 | nothing posted anywhere | manual | not automatable |
| 69–70 | templates and brands as files | `templates.test.ts`, `brands.test.ts`, `svg.test.ts` | covered |

Notes: 4 and 37's demo branch work in code but `ai/replays/index.ts` is empty, `demo-sources/covers/` is empty and the second rehearsed source is not in the repo. 7 is asserted on the role pages only, not on the workbench with three drafts. 69 also needs an import line in `templates/index.ts`, not only a file. The plan's coverage table was checked against test titles in the diff. Line numbers for unit tests were checked only where shown.

## Read outside the diff
- `src/shared/lib/auth/session.ts:17` — `getSession` treats a suspended session as signed out, so the content actions refuse it
- `src/proxy.ts:39` — the matcher is `/dashboard` and `/admin` only, so `/api/ai-provider` relies on its own gate, which returns 404 in production
- `src/shared/lib/auth/index.ts:132` — no session cookie cache, so `editor`/`reviewer` are read fresh on every request
- `grep isStudent src` — no caller outside `access.ts` and its test
- `git ls-tree 36ffb90` — dev has no `/admin/sign-in` page and no student-page refusal (Jenish's merged PR held only his intent)
- `grep "from '@/features" src/shared` — `db/schema.ts` is the only shared file that imports a feature
- `bun.lock` at `36ffb90` — braces 3.0.3 and esbuild 0.18.20 were already there before this branch
- `src/features/content/demo-sources/covers/`, `ai/replays/` — no covers and no recordings on disk
- `grep -i "heubert|expert|edge|crm"` over admin and content sources — nothing user-visible

## Findings, by file

### `src/features/content/ai/market.ts`

**HIGH · line 131 · model output number guard**
- What: `factValues(facts)` collects numbers from every extracted fact, including unsupported ones such as the twin's planted figure. `makeNepal` passes `facts.body.facts` (`server/commands.ts:1105`). The model is sent these numbers as allowed `fact_values`, and an answer using any of them passes.
- Why: a reworded presentational slot can carry the planted figure, or a true figure the default version never states. The Nepal slots get no source check and no vision check, and approval publishes them.
- Rule: `security-llm.md` §2, and criterion 59 ("any other number is rejected"). Would a test have caught it: no. Nothing feeds the twin's unsupported number back through `nepalVersion`.
- Fix: build the allowed set from the numbers in the approved revision's own slots, or at least from the supported facts it binds (as `caption.ts` `boundFacts` does). Add a test with the planted figure.

### `src/features/content/lib/workflow.ts`

**HIGH · line 162 · vision gate fails open**
- What: `publishError` and `sendToReviewError` block only a flagged vision. A render with no vision record passes both, and the test says so ("passes a clean vision or none"). `readBack` (`server/commands.ts:365`) drops a failed vision call silently, and the render still reports success.
- Why: any vision timeout, failure or daily cap on a non-demo source lets a render go to review and live without the check criterion 39 puts on every render. The reviewer sees only "Not run on this render."
- Rule: criterion 39, and `security.md` §8 (a change that disables a check is flagged). Would a test have caught it: no. A test exists that asserts the opposite.
- Fix: require a current vision record, or a recorded override, in `sendToReviewError` and `publishError`. When `readBack` fails, say so in the step ("Vision check failed · Try again").

**MEDIUM · line 24 · criterion 52 done differently**
- What: `missingSetting` always reads "Choose the layer, audience and expiry…", even when only the expiry is missing (the form defaults the layer and audience).
- Why: criterion 52 asks for the missing setting to be named. The smoke file lists this as an open decision.
- Rule: criterion 52. Would a test have caught it: yes, if a test asserted the message with only the expiry unset.
- Fix: name the setting that is missing, or record Nikhil's decision in the intent's Changes.

### `src/shared/lib/auth/access.ts`

**HIGH · line 110 · criteria 11 and 12 uncovered**
- What: `isStudent` has no caller, and no `/admin/sign-in` page exists here or on dev. The proxy (`src/proxy.ts:24`) lets through a path that returns 404. An editor can sign in on the student page and is signed in to the student app.
- Why: two acceptance criteria have no code path in this branch. `AdminChrome` already assumes the student app refuses board-only roles, but nothing does.
- Rule: criteria 11 and 12 (uncovered criterion). Would a test have caught it: yes, an e2e test through the real sign-in pages rather than the dev login.
- Fix: land Jenish's sign-in pages first, or add the student-page refusal and the admin sign-in page here, with e2e tests for both. Otherwise move 11 and 12 out of this PR's scope in the intent.

### `src/features/content/server/commands.ts`

**MEDIUM · line 1097 · Nepal and social renders never vision-checked**
- What: `makeNepal` draws new slides (reworded text, NPR figures, rate line) with no vision read-back. `renderSocial` (`server/social.ts:180`) does the same.
- Why: criterion 39 covers every finished render. These are the slides most likely to differ from what the vision check last saw.
- Rule: criterion 39. Would a test have caught it: no. Nothing asserts a vision record on a market or social render.
- Fix: run `visionCheck` on the market's and the social version's stored slides, and gate publishing or export on it. If that is out of scope, record the exception in the intent.

**MEDIUM · line 234 · rendering and vision inline in the server action**
- What: `draw` runs resvg synchronously for every slide on Node's event loop. `readBack` then awaits one model call per slide, each with up to three attempts of 30 s, before the action returns. The preview route redraws layout and resvg on every request the browser has not cached.
- Why: the cost grows with slides × renders and blocks every other request on the process while it runs. A render click can take minutes.
- Rule: `performance.md` §3 (blocking work, slow third party inline) and §2 (recomputation). Would a test have caught it: no, it needs a load test.
- Fix: return after the render is saved and run the vision check as its own step (the step lock and polling already exist). Consider a worker or a server-side cache keyed by drafts id, slide and theme for the previews.

**LOW · line 396 · double submit runs extraction twice**
- What: `startFeedPost` checks for an existing post, then calls the model before inserting. Two overlapping submits both extract, and one result is thrown away.
- Why: the second Pro-tier call counts against the daily cap. The post itself stays single.
- Rule: `performance.md` §2. Would a test have caught it: no.
- Fix: insert a placeholder post, or take a step lock keyed by the request id, before extracting.

### `src/shared/lib/db/schema.ts`

**MEDIUM · line 16 · shared imports a feature**
- What: the shared schema imports `ARTIFACT_KINDS`, `Pointers` and `STAGES` from `src/features/content/model`.
- Why: `shared` now depends on a feature, which inverts CLAUDE.md's folder layering. Every importer of the schema pulls in the content model. This is rated MEDIUM, not HIGH, because the schema's own comment invites feature tables there and no written rule bans the import direction (the FDD skill is not installed).
- Rule: CLAUDE.md §Code (folders). Would a test have caught it: no, a convention.
- Fix: keep the tables, but move the stage and kind lists (and the `Pointers` type) into a shared module the feature imports. Or inline the check lists in the schema.

### `src/features/content/lib/lines.ts`

**MEDIUM · line 31 · "Leaves the feed in n days" never counts down**
- What: `expiryText` prints the configured duration (30 or 90). A post approved 60 days ago still reads "Leaves the feed in 90 days".
- Why: criterion 54's line is read as time left. The approval's `by.at` is available but unused.
- Rule: criterion 54. Would a test have caught it: yes, with a test that fixes the clock after approval.
- Fix: work out the days left from the approval time in `liveLine` (pass `approvedAt`). Show "Left the feed" once it is past.

### `src/features/content/ai/replays/index.ts`

**MEDIUM · line 2 · no recordings, no covers, one demo source missing**
- What: `REPLAYS` is `{}`, `demo-sources/covers/` is empty, and "How much do you love your future self?" is not in `DEMO_SOURCES`.
- Why: criteria 4 and 37's demo branch cannot happen on 8 Oct as built. A failed call on a rehearsed source shows "Try again" or "No art", not "Replay". The e2e test is skipped.
- Rule: criteria 4 and 37, and the intent's Scope (two rehearsed sources). Would a test have caught it: the skipped e2e test would.
- Fix: run `bun run ai:replays` with Vertex access, commit the recordings and covers, add the second source, and un-skip the e2e test.

### `src/features/content/components/steps/StructuresStep.tsx`

**MEDIUM · line 57 · repeated helpers and primitives**
- What: `Control` is defined here and in `RenderStep.tsx:45`. `tag` appears three times (RenderStep, StructuresStep, SourcePane), the native select class string three times (LivePanel, SettingsForm, StructuresStep) and textarea styling twice. `escapeRegExp` appears three times (draft, lib/market, text/lint), `mapLimited` twice (extract, source-check), `factValues` twice (caption, market) and `CheckField` twice (UserPage, UsersList).
- Why: copies drift. `factValues` already differs in intent between caption and market (the HIGH above).
- Rule: review Quality (no duplicated logic), and repetition of three or more. Would a test have caught it: no.
- Fix: one `Control` and `tag` in a shared content UI module, `Textarea`/`NativeSelect` in `shared/components/ui`, and one copy each of the text helpers.

### `src/features/admin/users/commands.ts`

**LOW · line 226 · invite to an existing account: two transactions, silent removal**
- What: `setRoleAs` and then `setCapabilitiesAs` run separately. Unticked boxes remove Editor and Reviewer from an account that had them.
- Why: if the second step fails, the change is half applied, and re-inviting an editor as admin drops their editor rights without a prompt (open decision 1 in the smoke file).
- Rule: `security.md` §6. Would a test have caught it: no.
- Fix: one transaction, and settle the "form is the truth" decision.

### `src/features/content/ai/client.ts`

**LOW · line 184 · cap check not atomic; art limit not said**
- What: `underCap` counts and then calls, so concurrent calls can pass the cap together. An image refused for the cap shows only "No art" (`art.ts:83`), never "daily limit reached".
- Why: the cap can be overrun by the number of concurrent calls. Criterion 6 asks for the limit to be named for art too.
- Rule: `security-llm.md` §3 (spend limits), and criterion 6. Would a test have caught it: no.
- Fix: reserve a row before calling (insert, then count). Pass the `daily_limit` reason through `coverArt` to the label.

### `src/app/admin/(staff)/assets/[id]/route.ts`

**LOW · line 19 · stored SVG served inline**
- What: SVG assets are served as `image/svg+xml` with no `X-Content-Type-Options: nosniff` and no `Content-Security-Policy: sandbox`.
- Why: text is escaped (`svg.ts` `escapeXml`), so this is defence in depth against a future unescaped field.
- Rule: `security-web.md` §2. Would a test have caught it: no.
- Fix: add `nosniff` and `Content-Security-Policy: sandbox` (or `Content-Disposition: attachment` for SVG).

### `src/features/admin/components/UserPage.tsx`

**LOW · line 133 · sizes outside the type roles**
- What: the new lines use `text-base` and `text-sm` (also in `UsersList.tsx`), matching the existing users admin rather than the roles.
- Why: DESIGN.md says type comes from the roles.
- Rule: DESIGN.md §Sizing; CLAUDE.md §Code. Would a test have caught it: no, a convention.
- Fix: use `text-caption` or body, in a follow-up for the whole users admin.

### `src/features/content/components/SlidePreview.tsx`

**LOW · line 43 · slide images carry no words**
- What: every rendered slide has `alt="Slide n"`. After render, the review shows the post's wording only inside images.
- Why: a reviewer using a screen reader cannot read what they approve.
- Rule: review Quality (accessibility). Would a test have caught it: yes, an axe check on the review step.
- Fix: pass the slide's text lines (from the layout) as alt text or as a visually hidden caption.

### `src/features/content/components/steps/RenderStep.tsx`

**LOW · line 45 · step file holds shared primitives**
- What: `Control`, `Toggle`, `tag`, `MARKETS`, `RenderedSlides` and `MarketSlides` live in this 560-line step and are imported by four other steps. `server/commands.ts` is 1221 lines covering every command, drawing, light edits and Nepal.
- Why: these files have more than one job, and changes ripple across steps.
- Rule: review Quality (one responsibility). Would a test have caught it: no.
- Fix: move the primitives to `components/parts.tsx`. Split commands by stage (structures, render, review, market).

## Pre-existing, not this branch
- braces 3.0.3 (GHSA-vfj7-8cjw-p6xm, high) through micromatch, and esbuild 0.18.20 (GHSA-67mh-4wv8-2f99, moderate) through drizzle-kit. Both are in `bun.lock` at `36ffb90` and are dev tooling. The four added packages (@google/genai 2.27.0, @resvg/resvg-js 2.6.2, fflate 0.8.3, opentype.js 2.0.0) are pinned exactly and carry no advisory.

## Top 3 priority fixes
1. `src/features/content/ai/market.ts:131` — allow only the approved revision's own numbers in a Nepal answer.
2. `src/features/content/lib/workflow.ts:162` — refuse send-to-review and publish without a current vision record, and say when the read-back fails.
3. `src/shared/lib/auth/access.ts:110` — land the admin sign-in page and the student-page refusal, or move criteria 11 and 12 out of scope.

## Done well
- "Approved is what is published" holds: hash-named records, update triggers in migration 0002, no code path that updates them, and `current()` dropping any check, vision, market or approval that names another revision or render.
- Every new path checks access on the server: `requireBoard` in the layout and pages, `canSeeBoard`/`canEdit` on the asset, preview and export routes (404 otherwise), and `actionError` in every command. `routes.test.ts`, `actions.test.ts` and `server/commands.test.ts` test the refusals.
- The model layer: pasted text is fenced as data with an injection rule, schemas are allowlisted, numbers and quotes are decided by code, answers are validated before use, there are timeouts and daily caps, and no prompt text reaches the logs. SVG output is escaped and art is limited to data URIs.

## Built but not asked for
- `/api/ai-provider`, a dev-only route that tells the e2e tests the server is fake (gated like the dev login, 404 in production).
- `src/shared/lib/no-inline-block.test.ts`, a repo-wide guard against Tailwind's `inline-block` sizing.
- LinkedIn post text capped at 300 words (the criterion sets no limit).

## Blind spots
- The Nepal guard: only a test that feeds a model answer carrying the twin's unsupported figure would catch it. A property test over every fact value not in the revision would also catch it.
- Vision failing open: a command test where the vision call fails, then publish is attempted.
- Rendering on the event loop: a load test with two editors rendering at once.
- Criteria 11 and 12: e2e tests through the real sign-in pages. The dev login hides the gap.
- Live Gemini and Imagen behaviour (smoke, eval, replays) has not been run, so prompt quality and the 10/10 planted-claim bar are unverified.

---
Stack: TypeScript, Next.js 16 (App Router, server actions, route handlers), React 19, Better Auth, Drizzle on Postgres, Zod 4, Tailwind 4, bun test with happy-dom, Playwright, @google/genai (Vertex Gemini and Imagen), opentype.js, resvg, fflate. Passes applied shallowly: the layout engine's geometry (`engine`, `fit`, `measure`) was judged from its tests, not by hand. E2e specs and most unit tests were read by title. Live model behaviour was not exercised.

## Resolution · 6 Oct 2026

The developer asked to fix every valid finding.

**Fixed:**
- HIGH: Nepal number guard (`34615bc`); the vision gate now treats a missing check as "Not checked", which blocks review and publish until a run or a reviewer override, and a failed read-back is shown (`bfc81fd`).
- MEDIUM: criterion 52 now names only the missing settings (`2cdb5f0`). Nepal and social renders are vision-checked and gated (`3c4c8bc`). The vision check runs as its own step after the render returns, and previews are cached in process (`017d280`). Shared no longer imports a feature (`3feeb75`). The live line counts down from the approval (`352bb3b`). Duplicated helpers are merged (`7de9bcb`).
- LOW: one extraction per request id (`a21a6b7`); the invite to an existing account runs in one transaction and warns before removing a capability (`4117b74`); the daily cap is reserved atomically and an art refusal reads "Daily image limit reached" (`c6152d0`); assets are served with nosniff and SVGs are sandboxed (`0ae2bd8`); type roles on the new users-admin lines (`9d4bfc0`); slide images carry their words as alt text (`748546a`); step primitives and the commands are split by job (`b6ee29a`).

**Left, with the reason:**
- HIGH, criteria 11 and 12, code part: invalid for this branch. The admin sign-in page and the student page's refusal belong to Jenish's slice (ADR-105, ADR-108). This branch provides `isStudent` and lets `/admin/sign-in` through. The intent records it (`9724547`).
- MEDIUM, no recordings, covers or second demo source: out of reach for now. It needs Google Cloud credentials (`bun run ai:replays`) and Nikhil's "future self" text.

**After the fixes:** lint clean; type-check clean; `bun run test:run` 653 pass, 0 fail; database suites 121 pass, 0 fail; build succeeds; `bun run test:e2e` 46 passed, 1 skipped.
