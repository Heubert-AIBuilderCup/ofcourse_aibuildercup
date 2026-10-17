# Update topics — Code Review

**Request changes.** 0 CRITICAL · 1 HIGH · 1 MEDIUM · 4 LOW

| | |
| --- | --- |
| Blocking | HIGH · `src/features/roads/model/tile-posts.ts:75-79` · the board's course tiles ignore the topic, so students outside the topic see a topic-aimed update |
| Branch | `feat/update-topics` at `694b711` over `dev` (`eba3279`) · 19 files, +991 −83 · 16 Oct 2026 |
| Reviewed against | security · security-web · performance · CLAUDE.md · `fdd-architecture (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` |
| Scans | secrets N/A (gitleaks not installed) · dependencies 0 new, 2 pre-existing · code N/A (semgrep not installed) |
| Not applicable | `security-llm.md` (no model code) · Tailwind skill (no style change) |
| Failed to load | none |
| Read outside the diff | 10, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | — | — |
| Performance | A | — | — |
| `fdd-architecture` | A | LOW · `lib/audience.ts:3` · deep cross-feature import | optional |
| `vercel-react-best-practices` | A | — | — |
| Quality | B | MEDIUM · `lib/update.test.ts:72` · repeated assertion | delete the repeated test |
| Criteria | C | HIGH · `roads/model/tile-posts.ts:75` · topic ignored on board | apply the topic on tiles |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | Topic dropdown, "All topics" first, new update on it | `UpdatesScreen.test.tsx:178` | covered |
| 2 | Saved topic reads back, listed and once live | `server/updates.test.ts:125` | covered (database) |
| 3 | Older updates read as all topics, same students | `server/updates.test.ts:139`, `lib/audience.test.ts:163`, `lib/feed-updates.test.ts:194`, `:201` | covered |
| 4 | Preview counts only students matching all three | `lib/audience.test.ts:201`, `:209`, `UpdatesScreen.test.tsx:178` | covered |
| 5 | Preview counts ranked course or stated interest | `lib/audience.test.ts:191`, `:214` | covered |
| 6 | Insights uses the same rule | `insights/lib/overview.test.ts:134` | covered |
| 7 | Feed: a course in the field | `lib/feed-updates.test.ts:139`, `server/feed-updates.test.ts:103` | covered |
| 8 | Feed: stated interest, assumed never counts | `server/feed-updates.test.ts:118`, `:129`, `lib/feed-updates.test.ts:147` | covered |
| 9 | Why lines | `lib/feed-updates.test.ts:139`, `:147` | covered |
| 10 | Once only, course match first | `lib/feed-updates.test.ts:154`, `:159` | covered |
| 11 | Others never see it | `lib/feed-updates.test.ts:164`, `:172`, `:131` | covered on `/feed`; the board breaks it (HIGH) |

Criterion 2 runs only with `DB_TESTS=1`, so this review did not run it. Criterion 8's "Which field?" path rests on `pickedFields`, which `src/features/roads/model/match.test.ts:508` tests.

## Read outside the diff
- `src/features/insights/lib/overview.ts:69-75` — `updateReach` passes `latestLiveUpdate`'s audience, now mapped by `audienceOf`, to `matchAudience`. Nothing else is needed (risk 1).
- `src/app/admin/(console)/insights/page.tsx:19,29` — the only caller of `updateReach`, and it reads `latestLiveUpdate()` (risk 1).
- `src/features/updates/components/UpdatesScreen.tsx:57,93-94` — every audience the form and the preview read comes from `DEMO_DRAFT`, `MOCK_UPDATES` (through `.transform(audienceOf)`) or `listUpdates`, so none lacks a topic (risk 2).
- `src/features/roads/data/fields.ts:1` — pure data with one type-only import; nothing server-only reaches the browser (risk 3).
- `src/features/roads/model/match.ts:52-56,92-114` — `pickedFields` reads only stated answers, through `said`; an assumed `know`, `areas` or `field` counts as unanswered (risk 4).
- `src/features/roads/model/match.test.ts:508` — tests the "Which field?" path of `pickedFields`.
- `src/features/roadmaps/model/roadmap.ts:53` and `src/features/roads/model/road-for.ts:30` — `road` is never null, so naming a road-less roadmap does not throw.
- `src/features/roads/model/tile-posts.ts:13-19,75-89`, `src/features/roads/server/tile-posts.ts:40` and `src/app/(app)/roadmaps/[id]/layout.tsx:69` — the board reads the same live updates under its own audience type and never looks at the topic (the HIGH).
- grep of `from '@/features/<x>/…'` at the merge base — 273 deep cross-feature imports, and `roads/client.ts` does not export `FIELDS`.
- `.heubert/scan-deps.json` — `braces` (high) and `esbuild` (moderate). This branch changes neither `package.json` nor `bun.lock`.

## Findings, by file

### `src/features/roads/model/tile-posts.ts` (not in the diff)

**HIGH · line 75-79 · topic ignored on the board**
- What: `tilePosts` puts every live update whose `audience.institution` is a course's university (and whose country matches) on that course's tile. It never reads `audience.topic`, so an "ECU · Data science" update shows on the ECU Cyber Security tile of a student with no data course and no data interest.
- Why: a student outside the topic still sees a topic-aimed update on a student surface. That breaks the intent's outcome ("aim an update at the students a topic concerns") and the spirit of criterion 11, which the intent checked only on `/feed`. Updates stored before this branch are unaffected.
- Rule: intent, Proposed outcome and criterion 11 (a read path of the changed contract left on the old rule) · a test would have caught it: yes, a `tile-posts.test.ts` case with a topic-aimed update on a course outside that field.
- Fix: on a course tile, keep an update only when its topic is `ALL_TOPICS` (read through `audienceOf`) or equals that course's `field` (or one of her stated interests), and widen `LiveUpdate.audience` to carry `topic?`. If the board should ignore topics, the intent has to say so explicitly.

### `src/features/updates/lib/update.test.ts`

**MEDIUM · line 72 · test bloat**
- What: "opens the form with an update for all topics" asserts `DEMO_DRAFT.audience.topic === ALL_TOPICS`. `UpdatesScreen.test.tsx:178` already asserts this through the form ("+ New update" opens `DEMO_DRAFT`, and the select's value is `ALL_TOPICS`).
- Why: the second test adds upkeep and proves nothing new.
- Rule: CLAUDE.md "test the brain, not the beauty" and the test-bloat rule (a test that repeats another's assertion) · a test would have caught it: n/a.
- Fix: delete the test.

### `src/features/updates/lib/audience.ts`

**LOW · line 99 · preview why differs from the feed's**
- What: for an institution and a topic together, the admin's student preview says "Because you ranked ECU Cyber Security", while the student's feed says "Because Data science is on your roadmap …".
- Why: the preview no longer shows what she will read. The wording already differed before topics, and smoke.md names this.
- Rule: criterion 9 (the feed) is met; this concerns the preview only · a test would have caught it: no, both sides are pinned as they are.
- Fix: if the preview should mirror the feed, prefer the topic why when a topic is set.

**LOW · line 15 · topic typed as `string`**
- What: `AudienceRule.topic` is `string`, and `update.ts:94` casts the enum to `[string, ...string[]]`, though `TopicId` exists.
- Why: a typo such as `topic: 'Data'` compiles and quietly matches no one.
- Rule: missing type narrowing · a test would have caught it: no, type-check would if the type were narrow.
- Fix: type it `typeof ALL_TOPICS | TopicId`.

**LOW · line 3 · deep cross-feature import**
- What: imports `@/features/roads/data/fields`. `server/feed-updates.ts:14` imports `@/features/roads/model/match`, and `insights/lib/overview.test.ts:3` imports `@/features/updates/lib/audience`.
- Why: `fdd-architecture` §2 asks for imports through a feature's public API. The repo has 273 such deep imports at the base, and `roads/index.ts` is server-only by design, so project practice wins and this stays LOW.
- Rule: `fdd-architecture` §2 Public API Boundary · a test would have caught it: no, a convention.
- Fix: optionally export `FIELDS` (and `pickedFields`) from `roads/client.ts` and import from there.

### `src/features/updates/server/feed-updates.ts`

**LOW · line 32 · `isTopic` away from `TOPIC_IDS`**
- What: the type guard for topic ids is defined here, while `TOPIC_IDS` and `TopicId` live in `lib/audience.ts`. The "drawn to" why line is also written twice (`lib/audience.ts:87`, `lib/feed-updates.ts:49`).
- Why: the topic contract is split across files. Two copies is below the rule of three.
- Rule: duplicated logic, below MEDIUM · a test would have caught it: no.
- Fix: export `isTopic` from `lib/audience.ts` beside `TOPIC_IDS`.

## Pre-existing, not this branch
- `braces` ≤3.0.3, GHSA-vfj7-8cjw-p6xm (high) and `esbuild` ≤0.24.2, GHSA-67mh-4wv8-2f99 (moderate), from `bun audit`. This branch neither added nor bumped them.

## Top 3 priority fixes
1. `src/features/roads/model/tile-posts.ts:75` — apply the update's topic on course tiles, with a test.
2. `src/features/updates/lib/update.test.ts:72` — delete the repeated default-topic test.
3. `src/features/updates/lib/audience.ts:15` — narrow `topic` to `typeof ALL_TOPICS | TopicId`.

## Done well
- Older updates are safe on every audience read path: `audienceOf` on all three server reads, the mock updates' transform, again inside `feedUpdates`, and a parse default. Road-less roadmaps cannot match an all-topics update (`lib/feed-updates.ts:33-40`), and a test pins it.
- Interests come from `pickedFields`, so assumed answers are left out by the matcher's own rule, and a test checks that through stated and assumed fixtures.
- No migration: the topic lives inside the existing jsonb, and only the `$type` changed.

## Built but not asked for
- Nothing. The `interests` on four mock students in `students.json` serve criterion 5.

## Blind spots
- The board's tiles: no test feeds `tilePosts` a topic-aimed update. A unit case in `tile-posts.test.ts` would have caught the HIGH.
- An area that maps to two fields (`IT and computing` → `it`, `cyber`) counting for both topics is not asserted here. A server test with only that area and a `cyber` update would pin it.
- Criterion 2 runs only with `DB_TESTS=1`. Run `bun run test:db` (after `bun run db:dump`) before merging.

---
Stack: TypeScript, Next.js (App Router, server-only modules, a client component), React, zod, Drizzle (Postgres jsonb), bun test with happy-dom. Passes applied shallowly: none.

## Applied (17 Oct 2026)

Nikhil: "fix all valid". Fixed in `e3ae9d2`: the HIGH (board tiles), the MEDIUM (repeated test), and the LOWs at `audience.ts:99`, `audience.ts:15` and `feed-updates.ts:32`. Left, judged invalid: the LOW at `audience.ts:3` (deep cross-feature import), which is deliberate project practice (273 such imports at the base; `roads/index.ts` is server-only by design).
