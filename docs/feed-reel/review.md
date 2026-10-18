# feat/feed-reel — Code Review

**Request changes** (needs fixes). 1 CRITICAL · 0 HIGH · 7 MEDIUM · 8 LOW

| | |
| --- | --- |
| Blocking | CRITICAL · `src/app/admin/sign-in/page.tsx:95` · the judge passcode shown on the admin sign-in gives anyone editor and reviewer access |
| Branch | `feat/feed-reel` at `7c9ee2c` over `main` (merge-base `72a3abf`) · 140 files, +8406 −624 · 2026-10-18 |
| Reviewed against | security · security-web · security-llm · performance · CLAUDE.md · `vercel-react-best-practices (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` · `fdd-architecture (SKILL.md)` |
| Scans | secrets N/A (not installed) · dependencies 0 new, 2 pre-existing · code N/A (not installed) |
| Not applicable | other `.claude/skills` (not in dispatch) |
| Failed to load | none |
| Read outside the diff | 9, listed below |

The diff file covers 119 of the 140 files. It leaves out the generated finder catalogue, the raw finder JSON, the SVG art and bun.lock. Those were judged only through their tests.

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`, `security-llm.md`) | C | CRITICAL · `src/app/admin/sign-in/page.tsx:95` · public passcode | passcode off admin page |
| Performance | A | LOW · `student-profile.ts:20` · whole roadmaps per page | optional |
| vercel-react-best-practices | B | MEDIUM · `FeedList.tsx:166` · wheel swallows nested scroll | inner scrollers scroll first |
| tailwind-v4-best-practices, CLAUDE.md | B | MEDIUM · `FeedPostCard.tsx:124` · hardcoded 20rem | one shared custom property |
| fdd-architecture | B | MEDIUM · `FeedList.tsx:222` · focus hidden | visible focus, no auto-focus |
| Quality | B | MEDIUM · `sound.test-helpers.ts:164` · guard weakened | restore the case-blind regex |
| Criteria | A | 3 not automatable | — |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | Feed: one post per screen | manual | not automatable |
| 2 | One wheel gesture moves one post or one slide | `components/feed/wheel.test.ts` | covered |
| 3 | Filters stay put in a side column (a sheet when narrow) | manual (e2e drives both) | not automatable |
| 4 | Show filter: Updates · Posts · Blogs | `FeedFilters.test.tsx`, `lib/feed.test.ts`, `FeedList.test.tsx` | covered |
| 5 | Multi-value filters, preset from her roadmaps | `lib/feed.test.ts`, `profile-contract.test.ts`, `profile-from-answers.test.ts` | covered |
| 6 | Updates first, a screen each | `FeedList.test.tsx:349` | covered |
| 7 | Panel: posting account, sample "For your roadmaps" | `roadmap-lines.test.ts`, `FeedList.test.tsx:387`, `feed.test.ts` (postingAccounts) | covered |
| 8 | No Swap with no action | `press.test.ts`, `RoadBoard.test.tsx:416` | covered |
| 9 | Her own course says "Walk to …" | `press.test.ts:246` | covered |
| 10 | Compare target with no road dropped (Geelong) | `finder/model/compare.test.ts:185` | covered |
| 11 | Zoom stops: Journey · Stage · Step | `RoadBoard.test.tsx`, `e2e/your-road.e2e.ts` | covered |
| 12 | No dead buttons: cards, stack list, weighing, Pick a destination | `RoadBoard.test.tsx`, `press.test.ts` | covered |
| 13 | make-posts | `make-posts-plan.test.ts`, `make-posts-art.test.ts` | covered |
| 14 | seed-updates | `scripts/seed-updates.test.ts` | covered |
| 15 | copy-content | `copy-content-plan.test.ts` | covered |
| 16 | Thai and Nepali posts | `make-posts-plan.test.ts:62` | covered |
| 17 | Devanagari vowel-sign rendering | `layout/svg.test.ts:653` | covered |
| 18 | Source's wording only in the post's script | `script.test.ts`, `SourceCheckPanel.test.tsx`, `StructuresStep.test.tsx`, `commands.test.ts` | covered |
| 19 | Judges offered Priya alone | `judge/offered-story.test.ts`, `JudgeAccess.test.tsx` | covered |
| 20 | Dialog shows and fills the passcode | `JudgeAccess.test.tsx:69` | covered |
| 21 | Three new areas, Data folded into IT | `questions.test.ts`, `match.test.ts`, `AreaChecks.test.tsx` | covered |
| 22 | Nine mock road courses | `compose.test.ts:516`, `finder/data/catalogue.test.ts` | covered |
| 23 | 12 finder courses | `finder/data/catalogue.test.ts:97` | covered |
| 24 | Sticky Back/Continue | manual | not automatable |

Row 2 tests the gate, not the two wheel handlers that use it. Rows 13–15 test the scripts' pure parts; their database writes are untested (see Blind spots). Row 23 checks the nine road twins but not the three TAFE diplomas. Row 20 is met, but it is also the CRITICAL finding below.

## Read outside the diff
- `src/shared/lib/db/schema.ts:247-345`: only content_artifact, content_step and content_idea_decision reference posts. `published_approval_id` has no FK, so posts can be inserted before their artifacts.
- `src/features/content/server/store.ts:128-146`: an artifact's id is `artifactId(kind, postId, body)` and an asset's is the hash of its bytes. Deduplicating assets by id is therefore sound.
- `src/features/content/server/store.ts:1227-1250`: the feed reads the Instagram link from a `social_link` artifact, which the copy carries.
- `src/features/content/ai/art.ts:278-290`: coverArt's cache key today matches what `artKey` builds.
- `src/features/content/feed-actions.ts:16-22`: the query is bounded (≤16 keys, ≤8 values, ≤500 chars) before parseFilters runs.
- `grep AREA_FIELDS src`: no consumer reads a stored area through engine's table. Roads go through `areaFields`, which maps Data.
- `src/features/opening/actions.ts:4`: opening imports only `roads/switch`, so `roads/data/fields.ts` → `opening/model/questions` adds no cycle.
- `src/features/roadmaps/server/roadmaps.ts:216`: `listRoadmaps` is bounded by LIST_MAX.
- `package.json:51`: `@resvg/resvg-js` is pinned to exactly 2.6.2.

## Findings, by file

### `src/app/admin/sign-in/page.tsx`

**CRITICAL · line 95 · access opened to the public**
- What: The admin sign-in passes `JUDGE_PASSCODE` to `JudgeAccess`, which shows it and fills it in (`JudgeAccess.tsx:81`). Anyone who opens `/admin/sign-in` signs in as `judge-admin@judges.ofcourse.app`, which has editor and reviewer capabilities.
- Why: A stranger can write, approve and publish posts and targeted Updates to every student's feed in production. The passcode, its rate limit and the constant-time compare no longer guard anything.
- Rule: `security.md` §3 and §8 (a deliberate bypass is still flagged) · a test would have caught it: no, `JudgeAccess.test.tsx:69` asserts the passcode is shown.
- Fix: Keep the shown passcode on the student page (`src/app/page.tsx:97`, which only creates new students, bounded by the AI caps) and drop the prop here. Alternatively, make the judge admin read-only while the passcode is public. Nothing else crosses to the client: only `JUDGE_PASSCODE?.trim()`, and the server actions are unchanged.

### `src/features/content/components/feed/FeedList.tsx`

**MEDIUM · line 166 · the wheel swallows nested scrolling**
- What: The scroller's wheel handler calls `preventDefault()` on every vertical wheel event. That includes events over the post panel (`overflow-y-auto`, `FeedPostCard.tsx:168`) and over an update card's inner scroller (line 228).
- Why: A long caption or update cannot be scrolled with a wheel or trackpad. The gesture jumps to the next post instead, and the text can only be reached by dragging a scrollbar.
- Rule: `vercel-react-best-practices` `client-passive-event-listeners` (a non-passive listener must leave the default scroll alone where it is not taking over) · a test would have caught it: yes, a wheel event sent from inside an overflowing panel, asserting `defaultPrevented` is false.
- Fix: Before calling preventDefault, walk from `e.target` up to the scroller. Return early if any element on the way can still scroll in `deltaY`'s direction.

**MEDIUM · line 222 · focus taken on load and never shown**
- What: The posts region (`tabIndex={0}`) takes focus on mount (line 183) and has `outline-none`.
- Why: A keyboard or screen-reader user lands past the header and filters with no sign of where focus is (WCAG 2.4.3, 2.4.7). Ctrl+wheel zoom and reduced motion are handled correctly.
- Rule: `fdd-architecture` §Accessibility (visible focus indicators) · a test would have caught it: no, a convention.
- Fix: Replace `outline-none` with the project's `focus-visible` ring. Drop the auto-focus, or focus only after a first interaction inside the feed.

**LOW · line 99 · `after` has no caller**
- What: `page.tsx` dropped `FollowPages` and passes no `after`, so the prop and its last-screen branch are dead.
- Why: Unused API surface, and the follow screen disappeared from `/feed` without anyone asking for that.
- Rule: `fdd-architecture` YAGNI · a test would have caught it: no.
- Fix: Remove the prop, or pass `<FollowPages />` if the follow screen should stay.

### `src/features/content/components/feed/FeedPostCard.tsx`

**MEDIUM · line 124 · hardcoded 20rem tied to another file**
- What: The first grid column's calc hardcodes `20rem` as `page.tsx`'s `w-72` (line 60) plus `@5xl:gap-8` (line 57). It is written as arbitrary `w-[min(55cqw,80cqh)]` and `grid-cols-[…]` values.
- Why: If either side changes, the slide silently stops being centred on the window.
- Rule: `tailwind-v4-best-practices` §2 (semantic over arbitrary) and CLAUDE.md (sizes through roles) · a test would have caught it: no, a convention.
- Fix: Set one custom property (e.g. `--feed-side`) on the `data-feed-shell` root and read it in both the aside width and the calc.

### `scripts/copy-content-plan.ts`

**MEDIUM · line 111 · the remote guard never fires for production**
- What: `targetRefusal` lets any 127.0.0.1 or localhost target through. Production is reached through the Cloud SQL proxy on 127.0.0.1, and the test's own production URL passes (`copy-content-plan.test.ts:83`). The planned production run therefore needs no `--yes-remote`, and only the port tells it apart from a local target.
- Why: The one deliberate-intent gate on a script that writes live rows into production is inert for exactly that run.
- Rule: `security.md` §8 · a test would have caught it: no, the test pins the inert behaviour.
- Fix: Require the target database to be named (e.g. `--target ofcourse`, checked against the URL's database name), or prompt with `maskUrl(to)` before writing. Default to `--dry-run`.

### `scripts/copy-content.ts`

**LOW · line 389 · content-addressed ids kept on rewritten bodies**
- What: Bodies are rewritten (user ids and names) but keep their `artifactId(kind, postId, body)` id. Updates are inserted raw, without `parseUpdateInput`.
- Why: The target ends up with records whose id no longer hashes their content (unverified whether anything rechecks this). The update rows cross a system boundary without being validated.
- Rule: `security.md` §6 · a test would have caught it: no.
- Fix: Record this exception in the script's header comment, and run each update through `parseUpdateInput` before inserting it.

### `scripts/make-posts.ts`

**MEDIUM · line 319 · unsupported sentences waved through**
- What: `settleClaims` marks every sentence the source check could not find as editorial opinion when the source's wording does not fit. The reviewer account then approves and publishes, and no person reads it.
- Why: The source check is the product's guard on model-written claims (visas, fees). The script turns its failures into "opinion", and the post then goes to production through copy-content.
- Rule: `security-llm.md` §2 and §3 (an outward action is confirmed by a person) · a test would have caught it: no.
- Fix: Stop at the first not-found sentence unless `--accept-opinion` is passed. List every sentence marked as opinion in the final summary, so the copy to production is a reviewed step.

### `scripts/make-posts-art.ts`

**MEDIUM · line 30 · cache key copied, not shared**
- What: `artKey` rebuilds coverArt's key (model, prompt, aspectRatio, set, option, attempt; `ai/art.ts:279`) by hand. Its test checks it against a prompt the test builds itself, not the prompt drawScene builds (character sheet, design language, references).
- Why: Any change to coverArt's key, or a look post with a character, silently sends the slides to the image model, and the run then stops at `checkOwnArt`.
- Rule: Quality (duplicated logic) · a test would have caught it: partly, it pins one prompt shape.
- Fix: Export the key builder from `ai/art.ts` and call it from both places.

### `scripts/seed-updates.ts`

**LOW · line 78 · no local-only guard**
- What: Unlike its sibling scripts, it publishes to whatever `DATABASE_URL` Bun loads.
- Why: A shell with a production URL exported would put mock updates live.
- Rule: `security.md` §8 · a test would have caught it: no.
- Fix: Add the same host check as `make-posts.ts:57`.

### `src/features/roads/model/sound.test-helpers.ts`

**MEDIUM · line 164 · ranking guard weakened**
- What: The regex lost its `i` flag, so all-caps "BEST" and "TOP" now pass. `[Ll]eading(?! [A-Z])` exempts every "leading" followed by a capital, so "a leading Australian university" passes too.
- Why: The guard keeps ranking words out of every road's copy (DS-R1). The exemption is far wider than the one quote it was written for.
- Rule: Quality (a test that asserts less than its name) · a test would have caught it: no, it is the test.
- Fix: Keep the `/…/i` regex and remove the literal `leading Teams` from the JSON before matching.

### `src/features/opening/components/AreaChecks.tsx`

**LOW · line 41 · a Data-era answer is counted but not shown**
- What: A stored `['Data', …]` reads "n of 3 chosen" with no card ticked. `parseAnswer` maps Data only on the next save.
- Why: A student partway through onboarding sees a count she cannot match to any card.
- Rule: Quality · a test would have caught it: yes, rendering with `stated(['Data'])`.
- Fix: Map retired areas (`RETIRED_AREAS`) when reading the stored value, before computing `chosen`.

### `src/features/content/server/student-profile.ts`

**LOW · line 20 · whole roadmaps read per page**
- What: Every infinite-scroll page now reads every finished roadmap (answers, choices) just to get names and destinations. Before, it read one row.
- Why: The cost grows with her roadmaps times the pages she scrolls. It is bounded by LIST_MAX.
- Rule: `performance.md` §1 (whole records loaded for one field) · a test would have caught it: no.
- Fix: Select only name, answers and choices.

### `src/app/(feed)/feed/page.tsx`

**LOW · line 57 · raw spacing instead of the roles**
- What: The feed uses `@5xl:gap-8`, `py-6`, `py-3` and `gap-4` (and `gap-5` in `FeedFilters.tsx`, `text-sm` in `JudgeAccess.tsx`). CLAUDE.md names `gap-stack`, `gap-section`, `py-section` and the type roles, and `@5xl:gap-8` is a size per breakpoint.
- Why: These sizes drift from the design system's fluid scale.
- Rule: CLAUDE.md (sizes through roles) · a test would have caught it: no.
- Fix: Use the roles.

### `src/features/judge/components/JudgeAccess.test.tsx`

**LOW · line 76 · markup asserted**
- What: `tagName === 'STRONG'` tests the markup. The prefill and sent-form assertions beside it already carry the behaviour.
- Why: It is test bloat that breaks on a styling change.
- Rule: CLAUDE.md "test the brain, not the beauty" · a test would have caught it: n/a.
- Fix: Drop that line.

### `src/features/content/layout/svg.ts`

**LOW · line 46 · tied to a renderer bug**
- What: The `dx` shift makes up for resvg 2.6.2 dropping a spacing sign's width. The exact pin holds for now, but a bump that fixes the bug would double the gap after every sign on Nepali and Hindi slides. The test checks only the emitted `dx`.
- Why: Every Devanagari slide depends on a bug that is not named where the version is pinned.
- Rule: Quality · a test would have caught it: only a render test.
- Fix: Note it beside the pin, or add a render test that checks a PNG's text width.

## Top 3 priority fixes
1. `src/app/admin/sign-in/page.tsx:95`: stop showing the passcode on the admin page, or make the judge admin read-only.
2. `scripts/copy-content-plan.ts:111`: require the target database to be named before writing to production, with a dry run first.
3. `src/features/content/components/feed/FeedList.tsx:166`: let nested scrollers take the wheel, and restore a visible focus ring.

## Done well
- copy-content reads the source in a read-only transaction and writes the target in one transaction, all or nothing, with a real dry-run rollback. It also checks that both databases are on the same migration, skips posts already there, checks slugs first, refuses user ids it cannot map, and masks credentials in every message.
- Feed URL handling is safe. Repeated keys are reduced to known tag values in the tag file's order, `show` to its three kinds, and the action's query is bounded before any read.
- "Use the source's wording" is refused in the command (`review.ts:83`) as well as hidden in the UI, with a database test for a stale page. Data-era answers go through one mapping, used by both `parseAnswer` and `areaFields`.

## Built but not asked for
- `FollowPages` removed from `/feed`, and an unused `FeedList.after` prop.
- Eager or lazy image loading with `fetchPriority` on the first slide and blog cover.

## Blind spots
- The feed and slide wheel handlers have no component test. A happy-dom test sending `WheelEvent`s (deltaY, ctrlKey, a nested target) and asserting `defaultPrevented` and `scrollTo` calls would pin them.
- copy-content's `writeTarget` (skipping, unlinking, user mapping, dry-run rollback) has no database test. A `DB_TESTS=1` test copying between two schemas would cover it.
- The Devanagari shift is checked as emitted SVG, not as pixels. A PNG render of नेपाल and निरन्तर would check it as drawn.
- Unverified: whether anything recomputes artifact ids after the copy, and whether drawScene's prompt for look posts matches `artKey`'s.

## Pre-existing, not this branch
- braces ≤3.0.3 (high, GHSA-vfj7-8cjw-p6xm) and esbuild ≤0.24.2 (moderate, GHSA-67mh-4wv8-2f99). Both are transitive; package.json and bun.lock are unchanged.

---
Stack: TypeScript, React 19 and Next.js App Router (server actions), Tailwind CSS 4 with container queries, Drizzle on Postgres (postgres-js), Bun scripts and `bun:test` with happy-dom, Playwright, resvg SVG rendering. Passes applied shallowly: Devanagari and Thai shaping in `svg.ts` (judged from the code and its test, not from rendered output), and the generated finder catalogue and raw JSON (judged only through their tests).

## Applied

2026-10-18, on `feat/feed-reel` over `7c9ee2c`, uncommitted. Every finding was taken as valid, and each one is fixed. Full suite: 4675 pass, 567 skip, 0 fail. `type-check` and `biome check src e2e scripts` are clean.

| # | Finding | Status | What changed |
| --- | --- | --- | --- |
| 1 | CRITICAL · `admin/sign-in/page.tsx:95` public passcode | fixed | The admin page passes no passcode, so its dialog asks for it again (a password field). `JudgeAccess` also ignores a passcode handed to the admin form (no `stories`), so the passcode is never shown there. The student page (`src/app/page.tsx`) still shows the passcode and fills it in. Test: "never on the admin form, even when handed one". |
| 2 | MEDIUM · `FeedList.tsx:166` wheel swallows nested scrolling | fixed | `nestedScroll` (wheel.ts) walks from the event target up to the scroller. If an element on the way scrolls (overflow auto or scroll) and is not yet at its end in that direction, the handler returns without `preventDefault`. The feed (y) and the slide strip (x) both use it. Tests in wheel.test.ts, plus FeedList tests with an overflowing panel: `defaultPrevented` is false and the feed does not move; at the panel's end the feed moves one post. |
| 3 | MEDIUM · `FeedList.tsx:222` focus | fixed (compromise) | No focus is taken on load, and `tabIndex=0` stays. The ring shows on keyboard focus only (`focus-visible:inset-ring-2 inset-ring-ring`), so mouse users never see it. Test: the region is not focused after render and keeps tabindex 0. |
| 4 | LOW · `FeedList.tsx:99` unused `after` | fixed | The prop and its branch are removed. The follow screen stays off `/feed`, as the developer asked. |
| 5 | MEDIUM · `FeedPostCard.tsx:124` hard-coded 20rem | fixed | `--feed-side: 20rem` is set on the `data-feed-shell` root. The aside is `w-(--feed-side)`, and its right padding (`pr-stack`) is the gap to the posts. The grid's calc reads `var(--feed-side)`, so the slide stays centred on the window. |
| 6 | MEDIUM · `copy-content-plan.ts:111` inert remote guard | fixed | A run is now a dry run unless `--write` is passed. `--write` requires `--target <dbname>`, which must equal the `--to` URL's database name. A `--target` given on a dry run is checked as well, and `--write` with `--dry-run` is refused. Tests cover both. |
| 7 | LOW · `copy-content.ts:389` | fixed | Each update goes through `checkedUpdate`, which uses `parseUpdateInput`, before it is inserted. One the form would refuse stops the copy. The header comment now says that artifact ids are kept on rewritten bodies, and why: pointers, the published approval and other records name them, and nothing checks an id against its body. |
| 8 | MEDIUM · `make-posts.ts:319` opinion waved through | fixed | A not-found sentence still takes the source's own wording when that wording fits the post's script, because it is grounded. Otherwise the run stops at that sentence and names it, unless `--accept-opinion` is passed (`notFoundStep`). The final summary always lists every sentence marked opinion, on made and failed posts alike (`opinionLines`). A read-only listing of the five posts to copy is in the report to the developer. |
| 9 | MEDIUM · `make-posts-art.ts:30` copied cache key | fixed | `artCacheKey` is exported from `ai/art.ts`. `coverArt` and `artKey` both call it, and a test pins `artKey` to it. |
| 10 | LOW · `seed-updates.ts:78` no local guard | fixed | `remoteRefusal` refuses any host but this machine unless `--allow-remote` is passed. It is tested. |
| 11 | MEDIUM · `sound.test-helpers.ts:164` guard weakened | fixed | The guard is case-insensitive again (`rankingWords`). Only the literal unit names "Leading Teams" and "Leading People" are stripped before matching; without that, four road specs fail. "a leading Australian university" is caught again (sound.test.ts). |
| 12 | LOW · `AreaChecks.tsx:41` Data-era count | fixed | The stored value is read through `currentAreas` (questions.ts, now exported) before counting. A stored `['Data']` ticks IT and computing, and the next tap saves the area under today's name. |
| 13 | LOW · `student-profile.ts:20` whole roadmaps | fixed | `listRoadmapSummaries` (roadmaps.ts) selects only name, answers and choices, with the same order and bound. Covered by type-check only: its database test needs `DB_TESTS=1` and writes rows, so it was not run. |
| 14 | LOW · feed spacing | fixed | The feed page uses `py-stack` and `gap-stack`, `FeedList` uses `py-stack`, `FeedFilters` uses `gap-stack`, and the JudgeAccess passcode line uses `text-caption`. `@5xl:gap-8` is gone; the gap now lives inside `--feed-side`. |
| 15 | LOW · `svg.ts:46` tied to resvg 2.6.2 | fixed | A RESVG PIN comment sits in svg.ts and a line in docs/hackathon/deploy.md (package.json cannot carry a comment). A render test draws the heading नेपाल with resvg. As svg.ts writes it, the word is as wide as its letters; written plain, it comes out one sign short. A resvg that fixes the bug fails the test. With the shift removed, it fails. |
| — | LOW · `JudgeAccess.test.tsx:76` markup asserted | fixed | The `tagName === 'STRONG'` line is replaced by a text check. |

Also on this pass, at the developer's request: the course card is reordered. The order is Your guide, Conditions (the condition badges plus the course's own conditions), Ask, Study (majors, units), Careers (occupations with their sample job market), and Related fields (three, then "and N more"), with one source line per group. Ask moved up because `askFacts` answers from the guide's and conditions' rows (fees, majors, units, entry conditions, the budget sum). RoadCard.test.tsx pins this.
