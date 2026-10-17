# Target updates by topic Implementation Plan

**Intent:** docs/update-topics/intent.md
**Goal:** An admin can aim an update at a topic (one of the eight broad fields), together with an institution and a home country. A student sees it when a course on her roadmap is in that field or she said she is drawn to it.
**Approach:** The audience stored as JSON gains an optional `topic`; a missing one reads as "All topics", so no migration is needed. Three things learn the topic:
- the admin preview's rule (`matchAudience`);
- the feed's rule (`feedUpdates`);
- the server reader that turns roadmaps into what the feed's rule reads.

A roadmap with no matched road is now read too, but it can match only through a stated interest, so every older update reaches exactly whom it reached.
**Test layers:**
- **Unit tests** (`bash scripts/capped.sh bun test <file>`) pin every rule:
  - the topic list and its default;
  - the audience rule over the mock students (criteria 4–6);
  - parsing an update, including old audiences (criteria 1–3);
  - the feed rule with its why lines and once-only order (criteria 7–11);
  - the server reader building each roadmap's topics, injected with fake sources as its existing test does (criteria 7, 8 and the no-road case).
- **The admin form's behaviour** (choosing a topic changes the preview's count) is a component test in the existing `UpdatesScreen.test.tsx`.
- **Integration:** criterion 2 crosses the database, so the stored round trip is a database test in `src/features/updates/server/updates.test.ts`. It runs by path with `DB_TESTS=1`, already in `bun run test:db`.
- **Access paths:** no new one. The update actions keep their existing admin checks and tests.

**Constraints (from CLAUDE.md):**
- Bun only; npm/pnpm/yarn are refused.
- Never commit or push without explicit approval. Squash micro-commits into one semantic commit. Never add co-author text to commit messages.
- Conventional Commits (`type(scope?): description`), enforced by .husky/commit-msg.
- Branch names: main, dev, staging or feat/ fix/ hotfix/ refactor/ docs/ chore/ test/ perf/ ci/ release/ prefixes, enforced by .husky/post-checkout.
- Server actions return `ActionResult` (src/shared/types/action-result.ts) and never throw.
- Run every `bun test`, one file or the suite, through `bash scripts/capped.sh bun test <file>`. Tests compare strings, counts and attributes, never elements.
- Test the brain, not the beauty: unit tests pin logic, hooks, actions and components with behaviour (test-first); pages, layouts, styles and presentational pieces get none.
- The active design system is Industry: read src/design-systems/industry/DESIGN.md before any UI work.
- No end-to-end code without being asked.
- `bun run test:db` wipes the development database: `bun run db:dump` first.

**Branch:** `feat/update-topics` from `dev`, created at "go" once the uncommitted `feat/student-tweaks` work in the checkout is committed: `git checkout dev && git pull && git checkout -b feat/update-topics`. The branch is independent of `docs/course-finder`.

## Files

| Path | Create or modify | Responsibility |
| --- | --- | --- |
| `src/features/updates/lib/audience.ts` | modify | `ALL_TOPICS`, `TOPIC_IDS`, `topicName`, `audienceOf`, `AudienceRule.topic`; `matchAudience` reads the topic |
| `src/features/updates/lib/audience.test.ts` | modify | Criteria 4–6 |
| `src/features/updates/index.ts` | modify | `StudentSchema.interests` (optional topic ids) |
| `src/features/updates/students.json` | modify | Stated interests on a few mock students |
| `src/features/updates/lib/update.ts` | modify | The audience schema accepts `topic` (default "All topics"); `DEMO_DRAFT`; the audience error words |
| `src/features/updates/lib/update.test.ts` | modify | Criteria 1–3 (parsing) |
| `src/shared/lib/db/schema.ts` | modify | The audience column's `$type` gains `topic?: string` (type only, no migration) |
| `src/features/updates/server/updates.ts` | modify | Reads each stored audience through `audienceOf` |
| `src/features/updates/server/updates.test.ts` | modify | Criterion 2 (database round trip) |
| `src/features/updates/lib/feed-updates.ts` | modify | `FeedRoadmap` gains `courseTopics`, `interestTopics`, `hasRoad`; the topic rule, why lines and order |
| `src/features/updates/lib/feed-updates.test.ts` | modify | Criteria 7–11, and 3 on the feed |
| `src/features/updates/server/feed-updates.ts` | modify | Builds each roadmap's topics; keeps road-less roadmaps for interest matches |
| `src/features/updates/server/feed-updates.test.ts` | modify | Course and interest topics from real roadmaps, assumed answers, the road-less case |
| `src/features/updates/components/UpdatesScreen.tsx` | modify | The Topic dropdown beside Home country |
| `src/features/updates/components/UpdatesScreen.test.tsx` | modify | Choosing a topic changes the preview's count |
| `src/features/insights/lib/overview.test.ts` | modify | Criterion 6 |

## Task 1: Topics and the audience rule
**Delivers:** criteria 4, 5 and 6; defines the topic contract every later task imports.
**Files:** modify `src/features/updates/lib/audience.ts`, `src/features/updates/lib/audience.test.ts`, `src/features/updates/index.ts`, `src/features/updates/students.json`, `src/features/insights/lib/overview.test.ts`.
**Kind:** judgement

- [ ] Step 1: write the failing tests.
  - **`audience.test.ts`:**
    - `TOPIC_IDS` is `['cyber', 'data', 'business', 'it', 'psych', 'health', 'engineering', 'design']`.
    - `topicName('data')` is the `FIELDS` name for `data` (src/features/roads/data/fields.ts).
    - `audienceOf({ institution: 'ECU', homeCountry: null })` is `{ institution: 'ECU', homeCountry: null, topic: ALL_TOPICS }`.
    - **Old rules unchanged:** for every institution in `INSTITUTIONS` plus `ALL_INSTITUTIONS`, and every home country plus `null`, `matchAudience({ ...rule, topic: ALL_TOPICS }, MOCK_STUDENTS)` gives the same student ids and why lines as today. Pin these as the current expected arrays for two or three rules; the existing tests pin the rest.
    - **Topic (criteria 4 and 5):** `matchAudience({ institution: ALL_INSTITUTIONS, homeCountry: null, topic: 'data' }, students)` keeps exactly the students who have a ranked course whose `field` is `data`, or `'data'` in `interests`.
      - Its why line is `Because Data science is on a route you ranked`, or `Because you said you're drawn to Data science`, using `topicName`.
      - With an institution set, both the institution and the topic must match, and the why line stays the institution one.
      - With a home country set, students from elsewhere are left out.
  - **`overview.test.ts` (criterion 6):** the reach it reports for a latest update with `topic: 'data'` equals `matchAudience` of that audience over the same students.
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/updates/lib/audience.test.ts src/features/insights/lib/overview.test.ts`. Expected: FAIL, "ALL_TOPICS is not exported".
- [ ] Step 3: implement.
  - **`audience.ts`:**
    - `export const ALL_TOPICS = 'All topics'`;
    - `export const TOPIC_IDS = [...] as const satisfies readonly FieldId[]`;
    - `export type TopicId = (typeof TOPIC_IDS)[number]`;
    - `export const topicName = (id: string): string`, from `FIELDS`;
    - `AudienceRule` becomes `{ institution: string; homeCountry: string | null; topic: string }`;
    - `export function audienceOf(stored: { institution: string; homeCountry: string | null; topic?: string }): AudienceRule`, where a missing topic reads as `ALL_TOPICS`.
    - In `matchAudience` (L36), after the country check:
      - `ALL_TOPICS` passes;
      - otherwise a student passes when a ranked course (through `byId`) has `field === topic` or `student.interests` includes it;
      - the why lines are as above.
  - **`index.ts`:** `StudentSchema` gains `interests: z.array(z.enum(TOPIC_IDS)).default([])`. Import `TOPIC_IDS` from `./lib/audience`; `audience.ts` imports only the `MockStudent` type from `..`, so there is no runtime cycle.
  - **`students.json`:** give three or four students `interests` (for example one `["data"]`, one `["psych", "health"]`), including one whose ranked courses are in another field, so criterion 5's interest path is visible in the preview.
  - **`overview.ts`** needs no change: it calls `matchAudience` with the stored audience, which task 2 passes through `audienceOf`.
- [ ] Step 4: run the Step 2 command, then `bash scripts/capped.sh bun test src/features/updates src/features/insights`. Expected: PASS.
- [ ] Step 5: commit: `feat(updates): topics in the audience rule`

## Task 2: Parsing and storing the topic
**Delivers:** criteria 1 (the default), 2 and 3.
**Files:** modify `src/features/updates/lib/update.ts`, `src/features/updates/lib/update.test.ts`, `src/shared/lib/db/schema.ts`, `src/features/updates/server/updates.ts`, `src/features/updates/server/updates.test.ts`.
**Kind:** judgement

- [ ] Step 1: write the failing tests.
  - **`update.test.ts`:**
    - `parseUpdateInput({ ...DEMO_DRAFT, audience: { institution: 'ECU', homeCountry: null } })` succeeds with `audience.topic === ALL_TOPICS` (criteria 1 and 3);
    - with `topic: 'data'` it keeps `'data'`;
    - with `topic: 'astrology'` it fails with `UPDATE_ERRORS.audience`;
    - `DEMO_DRAFT.audience.topic` is `ALL_TOPICS`.
  - **`updates.test.ts`** (database, existing `describe.skipIf(!enabled)` at L19):
    - an update created with `topic: 'data'` comes back from `listUpdates()`, and after approval from `listLiveUpdates()`, with `audience.topic === 'data'` (criterion 2);
    - a row inserted directly with `audience: { institution: 'ECU', homeCountry: null }` (no topic) comes back with `topic: ALL_TOPICS` (criterion 3).
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/updates/lib/update.test.ts`, then `DB_TESTS=1 DATABASE_URL=postgres://app:app@127.0.0.1:5433/app bash scripts/capped.sh bun test src/features/updates/server/updates.test.ts`. Expected: FAIL.
- [ ] Step 3: implement.
  - **`update.ts`:**
    - the `audience` schema (L84-90) gains `topic: z.enum([ALL_TOPICS, ...TOPIC_IDS] as [string, ...string[]]).default(ALL_TOPICS)`;
    - `UPDATE_ERRORS.audience` becomes `'Choose who it reaches: an institution, a topic, and a home country or everyone.'`;
    - `DEMO_DRAFT.audience` gains `topic: ALL_TOPICS`.
  - **`schema.ts:536`:** the `$type` becomes `{ institution: string; homeCountry: string | null; topic?: string }`. Type only: `bun run db:generate` must produce no migration; check it and delete anything it makes.
  - **`server/updates.ts`:** every read that returns `StoredUpdate` (`listUpdates` L44, `latestLiveUpdate` L49, `listLiveUpdates` L63) maps `audience` through `audienceOf`.
- [ ] Step 4: run the Step 2 commands, then `bun run type-check`. Expected: PASS, no errors.
- [ ] Step 5: commit: `feat(updates): store an update's topic, old ones reading as all topics`

## Task 3: The feed's topic rule
**Delivers:** criteria 7, 8, 9, 10 and 11, and 3 on the feed.
**Files:** modify `src/features/updates/lib/feed-updates.ts`, `src/features/updates/lib/feed-updates.test.ts`.
**Kind:** judgement

- [ ] Step 1: write the failing tests in `feed-updates.test.ts`, with `FeedRoadmap` fixtures.
  - **The shape:** `FeedRoadmap` becomes `{ id; name; universities: string[]; country: string | null; courseTopics: string[]; interestTopics: string[]; hasRoad: boolean }`.
  - **Course match (criterion 7):** a live update with `topic: 'data'` reaches a roadmap with `courseTopics: ['data']`. The why is `Because Data science is on your roadmap "Perth"`.
  - **Interest match (criteria 8 and 9):** it reaches a roadmap with only `interestTopics: ['data']`. The why is `Because you said you're drawn to Data science`.
  - **Once only (criterion 10):** with roadmaps `[interest-only A, course B]` it appears once, through B (a course match first). With `[course A, course B]` it goes through A.
  - **Everyone else (criterion 11):** no matching topic, a different country, or a different institution means it is not in the result.
  - **Road-less roadmaps:** a roadmap with `hasRoad: false` matches only an update with `institution: ALL_INSTITUTIONS`, a topic that is not `ALL_TOPICS`, and that topic in `interestTopics`. It never matches an update with `ALL_TOPICS`, so every older update reaches exactly whom it did (criterion 3).
  - **Existing tests:** the file's current tests pass with the new fields added to their fixtures as `courseTopics: []`, `interestTopics: []`, `hasRoad: true`.
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/updates/lib/feed-updates.test.ts`. Expected: FAIL.
- [ ] Step 3: implement.
  - Replace `matches` (L21-24) with `matchOf(u, r): 'plain' | 'course' | 'interest' | null`, following the rules the tests pin. The institution and country checks are today's.
  - `whyOf` gains the two topic lines. `'plain'` keeps today's lines.
  - In `feedUpdates`, for each live update take the first roadmap whose `matchOf` is `'plain'` or `'course'`, else the first that is `'interest'`.
  - Read the topic with `audienceOf(u.audience).topic`, so an update object without one still works.
- [ ] Step 4: run the Step 2 command. Expected: PASS.
- [ ] Step 5: commit: `feat(updates): updates reach students by topic, with why`

## Task 4: Each roadmap's topics, from the board's road and her answers
**Delivers:** criteria 7 and 8 (from real roadmaps), and the road-less case.
**Files:** modify `src/features/updates/server/feed-updates.ts`, `src/features/updates/server/feed-updates.test.ts`.
**Kind:** judgement

- [ ] Step 1: write the failing tests in `server/feed-updates.test.ts`, using its injected `sources(env)` (L39-42) and its roadmap fixtures.
  - **Course topics:** a roadmap whose answers match a data road gives `courseTopics` with the `field` of its course, alternative and stacked course, de-duplicated, via `courseById`.
  - **Interest topics:** a roadmap with `know` "A few areas I'm drawn to" and stated `areas` `['Health']` gives `interestTopics: ['health']`. The same answers stored as `assumed` give `[]` (`said`, src/features/roads/model/match.ts:52-56).
  - **No road:** with `env` `{ STUDENT_ROADS_OFF: '1' }`, so that `roadFor` returns no spec (src/features/roads/model/road-for.ts:30), the roadmap is still passed on, with `hasRoad: false`, `universities: []` and `courseTopics: []`. Its `interestTopics` still come from her answers.
  - **End to end:** `readFeedUpdates` then gives a road-less student a live topic update matching her stated interest, and never an `ALL_TOPICS` update.
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/updates/server/feed-updates.test.ts`. Expected: FAIL.
- [ ] Step 3: implement `feedRoadmap` (L30-45) so that it always returns one `FeedRoadmap`:
  - `hasRoad: spec !== null`;
  - `courseTopics` from the spec's three course ids when there is a spec;
  - `interestTopics`: `(pickedFields(r.answers) ?? []).filter(isTopic)`, with `pickedFields` from `src/features/roads/model/match.ts:113`. It reads only stated answers, through `fieldPick` (L92-107).

  Keep the existing `try`/`catch` and its quiet failure.
- [ ] Step 4: run `bash scripts/capped.sh bun test src/features/updates`. Expected: PASS.
- [ ] Step 5: commit: `feat(updates): read each roadmap's course and interest topics`

## Task 5: The Topic dropdown in the update form
**Delivers:** criteria 1 (display) and 4 (the preview responds).
**Files:** modify `src/features/updates/components/UpdatesScreen.tsx`, `src/features/updates/components/UpdatesScreen.test.tsx`.
**Kind:** judgement

- [ ] Step 1: write the failing test in `UpdatesScreen.test.tsx`, in the file's existing style (strings and counts):
  - the select labelled "Topic" has "All topics" selected on a new draft;
  - choosing "Psychology" changes the reach in the status line to `matchAudience({ ...audience, topic: 'psych' }, MOCK_STUDENTS).length`;
  - the student preview's why line is the topic's why.
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/updates/components/UpdatesScreen.test.tsx`. Expected: FAIL.
- [ ] Step 3: implement.
  - **Read first:** `src/design-systems/industry/DESIGN.md`.
  - **The field:** in the Audience fieldset (L428-457), add a third `Field` labelled "Topic", after "Ranked a route at" and before "Home country". It is a `NativeSelect` whose options are `ALL_TOPICS`, then `TOPIC_IDS` with `topicName`, and it sets `audience.topic`.
  - **Layout:** keep the fieldset's `@xl:grid-cols-2`; the third field wraps to the next row, which needs no new layout rule.
- [ ] Step 4: run the Step 2 command, then `bash scripts/capped.sh bun test src/features/updates`. Expected: PASS.
- [ ] Step 5: commit: `feat(updates): choose a topic in the update form`

## Integration

`src/features/updates/server/updates.test.ts` (criterion 2, task 2) runs against Postgres:

`DB_TESTS=1 DATABASE_URL=postgres://app:app@127.0.0.1:5433/app bash scripts/capped.sh bun test src/features/updates/server/updates.test.ts`

It is already in `bun run test:db`, which wipes the dev database, so run `bun run db:dump` first.

## Criteria coverage

| Criterion | Task | Test that proves it |
| --- | --- | --- |
| 1 | 2, 5 | `update.test.ts` default `ALL_TOPICS`; `UpdatesScreen.test.tsx` "All topics" selected |
| 2 | 2 | `updates.test.ts` (database) round trip with `topic: 'data'` |
| 3 | 2, 3 | `update.test.ts` and `updates.test.ts` missing topic reads as all; `feed-updates.test.ts` road-less roadmaps never match an all-topics update |
| 4 | 1, 5 | `audience.test.ts` all three must match; `UpdatesScreen.test.tsx` reach changes |
| 5 | 1 | `audience.test.ts` ranked-course or interest path |
| 6 | 1 | `overview.test.ts` reach equals `matchAudience` |
| 7 | 3, 4 | `feed-updates.test.ts` course match; `server/feed-updates.test.ts` course topics |
| 8 | 3, 4 | `feed-updates.test.ts` interest match; `server/feed-updates.test.ts` stated versus assumed, road-less |
| 9 | 3 | `feed-updates.test.ts` the two why lines |
| 10 | 3 | `feed-updates.test.ts` once only, course match first |
| 11 | 3 | `feed-updates.test.ts` not matched |
