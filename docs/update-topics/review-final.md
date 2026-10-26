# Update topics — Code Review (final)

**Approve with changes.** 0 CRITICAL · 0 HIGH · 1 MEDIUM · 3 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/update-topics` at `fad824a` over `origin/main` (`9317bda`) · 22 files, +1173 −94 · 17 Oct 2026 |
| Reviewed against | security · security-web · performance · CLAUDE.md · `fdd-architecture (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` · `industry/DESIGN.md` (the Topic field) |
| Scans | secrets N/A (not installed) · dependencies clean (no package or lockfile change) · code N/A (not installed) |
| Not applicable | `security-llm.md` (no model code) · Tailwind skill (not dispatched; no class change) |
| Failed to load | none |
| Read outside the diff | 10 — listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | LOW · `lib/audience.ts:59` · stored topic cast, not checked | optional |
| Performance | A | — | — |
| `fdd-architecture` | A | — | — |
| `vercel-react-best-practices` | A | — | — |
| Quality | B | MEDIUM · `lib/audience.test.ts:136` · repeated and pass-through tests | delete the two tests |
| Criteria | A | LOW · `UpdatesScreen.tsx:452` · Topic not beside Country | optional |

First review's fixes, checked against the diff: the HIGH is fixed (`roads/model/tile-posts.ts:79-85`, test `tile-posts.test.ts:98`); the MEDIUM test is gone from `update.test.ts`; the LOWs are fixed (topic why in the preview `audience.ts:114`, `topic` narrowed `audience.ts:15-19`, `isTopic` beside `TOPIC_IDS` `audience.ts:36`, one `drawnToWhy`). The deep-import LOW was declined as project practice; this review follows that ruling (project practice over the skill), so `tile-posts.ts:8` is not raised again. None of the fixes adds a defect.

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | Topic select, "All topics" first and default | `UpdatesScreen.test.tsx:178` | covered |
| 2 | Saved topic reads back, listed and live | `server/updates.test.ts:125` | covered (database) |
| 3 | Older updates read as all topics, same students | `lib/audience.test.ts:143`, `:164`, `lib/feed-updates.test.ts:194`, `:201`, `server/updates.test.ts:139` | covered |
| 4 | Preview counts only students matching all three | `lib/audience.test.ts:201`, `:209`, `UpdatesScreen.test.tsx:178` | covered |
| 5 | Preview counts ranked course or interest | `lib/audience.test.ts:192`, `:214` | covered |
| 6 | Insights uses the same rule | `insights/lib/overview.test.ts:134` | covered |
| 7 | Feed: a course in the field | `lib/feed-updates.test.ts:139`, `server/feed-updates.test.ts:103` | covered |
| 8 | Feed: stated interest, assumed never | `server/feed-updates.test.ts:118`, `:129`, `lib/feed-updates.test.ts:147`, `:185` | covered |
| 9 | The two why lines | `lib/feed-updates.test.ts:139`, `:147` | covered |
| 10 | Once only, course match first | `lib/feed-updates.test.ts:154`, `:159` | covered |
| 11 | Others never see it | `lib/feed-updates.test.ts:131`, `:164`, `:172`, `roads/model/tile-posts.test.ts:98` | covered |

Criterion 2 runs only with `DB_TESTS=1` and was not run here. Criterion 8's "Which field?" and two-field-area paths rest on `fieldPick`, which `roads/model/match.test.ts:413` exercises.

## Read outside the diff
- `git grep` of `listLiveUpdates`, `latestLiveUpdate`, `LiveUpdate`, `.audience` and importers of `features/updates`: the only readers of live updates are `/feed` (`readFeedUpdates`), the board (`roads/server/tile-posts.ts:23-33` → `tilePosts`) and insights (`latestLiveUpdate`). All three now read the topic through `audienceOf` (risk 2). Ask and the other origin/main additions do not read updates.
- `roads/server/tile-posts.ts:23-33`: passes `u.audience` through unchanged, so the tile filter sees the topic `listLiveUpdates` gives it (risk 2).
- `roads/data/courses.ts` (EXTRA_COURSES, `courseById` :1150): every course `field` across the catalogue, origin/main's additions included, is one of the eight topics, and `ecu-data` exists for the tile test (risk 1).
- `engine` catalogue `field` values: the preview catalogue's fields (cyber, data, it, business, psych) are all topics (risk 1).
- `roads/data/fields.ts:171-188`: origin/main's `Psychology` "Which field?" option maps to `psych`, and the `Psychology` area does too. Both pass `isTopic`, and niche ids would be dropped by it (risk 1).
- `roads/model/match.ts:53-56,92-114`: `pickedFields` reads only stated answers (through `said`), so assumed answers never become interests.
- `insights/lib/overview.ts:69-76`: `updateReach` takes an `AudienceRule` from `latestLiveUpdate`, which is now mapped through `audienceOf`.
- `updates/server/updates.ts:86-131`: `createUpdate` is the only writer of an audience, through `parseUpdateInput`. A `git grep` of scripts and e2e finds no other writer.
- Focused run on an exported copy of the branch: the updates, tile-posts and overview tests give 93 pass, 9 skip (database), 0 fail. `tsc` reports no error in any diff file (its only errors come from Next's route types, which are not generated in the copy). Biome is clean on the diff files.
- `git branch --contains fe441a2`: the recorded fix commit exists only on `backup-sync/update-topics`.

Risk 3 settled from the diff: with `ALL_TOPICS`, `matchAudience` gives the same `everyone` or ranked why as before (`audience.ts:96-114`). On the feed, a road-less roadmap returns null for every all-topics update (`feed-updates.ts:46-52`). `find` order is unchanged for `'plain'` (`:81-83`). Tiles pass `ALL_TOPICS` (`tile-posts.ts:84`). Older updates reach exactly the same students.

## Findings, by file

### `src/features/updates/lib/audience.test.ts`

**MEDIUM · line 136, 151 · test bloat**
- What: "are named by the field's name" checks that `topicName('data')` equals the `FIELDS` lookup it is implemented with, plus `'Data science'`, which `:192` and `feed-updates.test.ts:139` already assert through real why lines. "keeps a stored topic" (`:151`) checks a pass-through that every topic-aimed feed test (`feed-updates.test.ts:139` onward) relies on.
- Why: both repeat assertions other tests make through behaviour, and the first restates its own implementation.
- Rule: CLAUDE.md "test the brain, not the beauty"; test bloat (pass-through code, a repeated assertion) · a test would have caught it: n/a.
- Fix: delete both tests. Keep `:143`, the missing-topic default, which is the one that matters.

### `src/features/updates/lib/audience.ts`

**LOW · line 59 · stored topic cast, not checked**
- What: `audienceOf` casts any stored `topic` string to `typeof ALL_TOPICS | TopicId`, so a jsonb value outside the eight topics enters typed as valid.
- Why: it fails closed today: the feed, tiles and preview all match no one. But the type no longer tells the truth at a data boundary, and the form's controlled select would show "All topics" for such a row.
- Rule: `security.md` §6 (validate on arrival, even from a system we own) · a test would have caught it: no, nothing feeds `audienceOf` an unknown topic.
- Fix: return `isTopic(stored.topic) ? stored.topic : ALL_TOPICS` only if "all topics" is the wanted fallback. Otherwise keep the cast and say in the comment that an unknown topic reaches no one.

### `src/features/updates/components/UpdatesScreen.tsx`

**LOW · line 452 · Topic not beside Country**
- What: the Topic field sits between "Ranked a route at" and "Home country" in the `@xl:grid-cols-2` fieldset (`:437`). From `@xl` it shares a row with "Ranked a route at", and "Home country" sits alone on the next row.
- Why: criterion 1 asks for Topic "beside Country", and the lone cell reads as unfinished. The look is the developer's smoke test, so this is not blocking.
- Rule: intent criterion 1 (layout) · a test would have caught it: no, a look check.
- Fix: confirm it at the smoke test (390, 768, 1440). If needed, put Topic and Home country together on the second row.

### `docs/update-topics/review.md`

**LOW · line 126 · record names a pre-sync commit**
- What: "Applied" says the fixes are in `fe441a2`, and `smoke.md:72` repeats it. After the sync they are `e3ae9d2`, and `fe441a2` survives only on `backup-sync/update-topics`. The build report's shas (`smoke.md:59-64`) are pre-sync too.
- Why: anyone following the record lands on a commit that is not in the pull request.
- Rule: a comment that no longer matches · a test would have caught it: no.
- Fix: replace `fe441a2` with `e3ae9d2` in both files, and mark the build-report shas as pre-sync.

## Top 3 priority fixes
1. `src/features/updates/lib/audience.test.ts:136` — delete the `topicName` and "keeps a stored topic" tests.
2. `docs/update-topics/review.md:126` — point the Applied record (and `smoke.md:72`) at `e3ae9d2`.
3. `src/features/updates/lib/audience.ts:59` — decide the fallback for an unknown stored topic, or document fail-closed.

## Done well
- Older updates are safe on every read path: `audienceOf` runs at all three server reads, in the mock transform, inside `feedUpdates` and in the tile filter. A road-less roadmap is structurally unable to match an all-topics or institution update (`lib/feed-updates.ts:46-52`).
- Interests come from `pickedFields`, so assumed answers, two-field areas and origin/main's Psychology option all follow the matcher's own rule, with niche ids filtered by `isTopic`.
- The tile fix is small and pure. A single test pins both sides of it: in-field only, and all topics on every tile.

## Built but not asked for
- The board tiles applying the topic (`roads/model/tile-posts.ts:79-85`) go beyond the intent's surfaces. The first review asked for it, to keep criterion 11's promise on a student surface.

## Blind spots
- Criterion 2 (database round trip) was not run here. Run `bun run db:dump`, then `bun run test:db`, before merging.
- `server/feed-updates.test.ts:118` assumes the Perth answers with "IT and computing, Health" still land on a non-health road. A Perth health road added to the catalogue would turn its why into the course line. The test would fail loudly, not pass wrongly.
- Nothing asserts the Topic select's place in the layout; that is the smoke test's job (`smoke.md` step 1).

---
Stack: TypeScript, Next.js App Router (server-only modules, one client component), React, zod, Drizzle (Postgres jsonb), bun test with happy-dom. Passes applied shallowly: none.

## Applied (17 Oct 2026)

Nikhil: "fix all valid". Fixed in `023ea88`: the MEDIUM (two repeated tests deleted) and all three LOWs (topic checked, not cast, with an unknown topic reaching no one; Topic beside Home country; post-sync commit hashes). None judged invalid.
