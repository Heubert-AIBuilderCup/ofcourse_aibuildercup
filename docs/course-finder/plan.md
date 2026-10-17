# Course finder, course detail, what changes, wider interests, one-year courses: Implementation Plan

**Intent:** docs/course-finder/intent.md
**Goal:** A student finds courses by meaning on her board. She sees what each course leads to and what switching changes, and can start a roadmap around any of them. Onboarding offers more fields and one-year courses. A judge sees the retrieval working.
**Approach:** Five branches, each a pull request that stands on its own, landing in the intent's order. Each part has its own switch.
- PR 1 is retrieval: a generated catalogue of `Course` rows plus finder extras, a pgvector table in the existing Postgres, one meaning query and one keyword query, and a checked "why".
- PR 2 adds job-market sample data to course cards.
- PR 3 splits two road rules (the staying route, work rights) so any course can be compared, and adds pinning through roadmap `choices`, with no migration.
- PR 4 and PR 5 change the onboarding questions behind build-time flags, because the question model runs in the browser as well as on the server.
- PR 5 adds a one-year road shape.

A sixth branch merges all five for Nikhil's test.

**Test layers:**
- **Unit tests** (`bash scripts/capped.sh bun test <file>`, suite `bun run test:run`) pin every rule:
  - the catalogue's build rules, its limits and the no-shared-words check;
  - the filters, the similarity floor and the "why" checks;
  - the switches;
  - the seed text, the comparison rows and the pinned road;
  - the new questions and their stored-answer readings;
  - the one-year road shape;
  - the demo-profile roads.
- **Integration tests** cover what crosses a boundary:
  - **Criteria 3, 4, 8, 19 and 20:** the vector table, the meaning query and the keyword query run against Postgres. These are database tests run by path (`DB_TESTS=1 DATABASE_URL=… bash scripts/capped.sh bun test <file>`), added to `bun run test:db`.
  - **Criteria 9, 10 and 11, and the refusal cases:** the server actions are tested with the AI provider faked and the repository mocked, as `src/features/roads/server/why.test.ts` does.
  - **Refusals:** a signed-out visitor, a non-student, another student's roadmap, over the limit.
- **Live quality** (criteria 12–14) is a script against the real embedding model, `bun run finder:eval`, because a fake embedding cannot measure meaning.
- **Not automated:** what shows only on screen (criteria 7 and 38, and the look of every panel) is proven by smoke-test steps.

**Constraints (from CLAUDE.md):**
- Bun only; npm/pnpm/yarn are refused.
- Never commit or push without explicit approval. Squash micro-commits into one semantic commit. Never add co-author text to commit messages.
- Conventional Commits (`type(scope?): description`), enforced by .husky/commit-msg.
- Branch names: main, dev, staging or feat/ fix/ hotfix/ refactor/ docs/ chore/ test/ perf/ ci/ release/ prefixes, enforced by .husky/post-checkout.
- Never start a dev server for the user; they run it.
- Server actions return `ActionResult` (src/shared/types/action-result.ts) and never throw.
- Tailwind 4 is CSS-first (src/app/globals.css): semantic tokens only, no @apply, OKLCH colours, rem not px (two exceptions: hairlines stay 1px, and icons keep their px size through `size-icon-sm` / `size-icon` / `size-icon-lg`).
- Sizes are fluid through the design system's roles: type `text-display`, `text-h1` to `text-h4`, `text-lead`, `text-caption`, `text-overline`; spacing `px-gutter`, `py-section`, `gap-section`, `gap-stack`. Never a size per breakpoint.
- Layout responds to the page's own width (container queries on an `@container` root): `@max-xl:` below 36rem, stacked between 36 and 64rem, `@5xl:` from 64rem; never an arbitrary `@max-[…]`, `@min-[…]` or `max-w-[…]`.
- The active design system is Industry: read src/design-systems/industry/DESIGN.md before any UI work.
- Read node_modules/next/dist/docs before writing Next.js code (see AGENTS.md).
- Run every `bun test`, one file or the suite, through `bash scripts/capped.sh bun test <file>`. Tests compare strings, counts and attributes, never elements.
- Test the brain, not the beauty: unit tests pin logic, hooks, actions and components with behaviour (test-first); pages, layouts, styles and presentational pieces get none.
- No end-to-end code without being asked: no new specs, no throwaway Playwright scripts.
- Take a dump before any reset (`bun run db:dump`).

**Branches (CLAUDE.md prefixes):**

| PR | Branch | From | Tasks |
| --- | --- | --- | --- |
| 1 | `feat/course-finder` | `dev` | 1–14 |
| 2 | `feat/course-detail` | `feat/course-finder` | 15–16 |
| 3 | `feat/course-compare` | `feat/course-detail` | 17–20 |
| 4 | `feat/wider-interests` | `dev` | 21–22 |
| 5 | `feat/one-year-courses` | `feat/wider-interests` | 23–25 |
| test | `test/course-finder-all` | `feat/course-compare` merged with `feat/one-year-courses` | 26 |

**Production before 18 Oct 2026:** only PRs 1–3 may reach production, each with its switch off until its checks pass. PRs 4 and 5 are built, reviewed and tested on their branches and in `test/course-finder-all`, but are not merged into `dev` until after judging starts. They change onboarding and the board, which the recorded video shows.

**Deploying (Nikhil runs every deploy):**
- **From a clean tree only.** `gcloud run deploy --source .` uploads the working directory, uncommitted changes included. Before each deploy, `git status` must be clean on a pushed commit of `dev`. Pass `--labels commit=$(git rev-parse --short HEAD)` so every revision names the commit it was built from.
- **Order:** the migrations job, then the finder seed job (task 9), then the service.
- **The switch:** deploy with `FINDER_ON` unset. Turn it on after the smoke test with `gcloud run services update ofcourse --project applyims --region asia-southeast1 --update-env-vars FINDER_ON=1`. Off is the same command with `--remove-env-vars FINDER_ON`. Each makes a new revision with no rebuild.

**Migrations:** on 16 Oct 2026 no branch, local or on either remote, has a migration past `0024_ai_setting`. Jenish confirmed on 16 Oct that he has none unpushed. Generate it last, just before the pull request, so its journal `when` is the newest. If one of his lands first, regenerate ours after it.

**Overnight run (agreed 16 Oct 2026):** the branches are built unattended on this machine, with nothing merged, pushed or deployed. In this order:
1. **Before any branch:** run `bun run db:dump` against the current development database. It only reads, and it is the copy the morning restore uses.
2. **`feat/update-topics`** from `dev` (docs/update-topics/plan.md).
3. **`feat/course-finder`** (PR 1), stacked on the local commit of `feat/student-tweaks`. Its PR is retargeted to `dev` once the tweaks merge. That base has the privacy page task 13 edits, and the tweaked board files this plan was read against.
4. **`feat/course-detail`** (PR 2), then **`feat/course-compare`** (PR 3), if time allows.
5. **PRs 4 and 5 are not part of the run.**

**The database during the run:**
- The developer's container and its `pg-data` volume are never touched: no `db:reset`, no `docker compose down`, no image switch on the running container.
- Database tests run against a temporary container:
  ```bash
  docker run -d --name finder-test-db -e POSTGRES_USER=app -e POSTGRES_PASSWORD=app -e POSTGRES_DB=app -p 127.0.0.1:5434:5432 pgvector/pgvector:pg17
  DATABASE_URL=postgres://app:app@127.0.0.1:5434/app bun scripts/migrate.ts
  ```
- Wherever this plan's database-test commands say port 5433, the run uses 5434. `finder:seed` and `finder:eval` also run against 5434.
- At the end: `docker rm -f finder-test-db`.
- `docker-compose.yml` is still changed and committed on the branch (task 7). It only takes effect when the developer next runs `bun run dev` there.

**Stop rules:**
- A task whose tests cannot pass after the implementer's fix attempts stops its branch, and the run moves to the next branch.
- A failing `finder:eval` stops PR 1 at task 14 and is reported, with the work up to it kept.
- No command touches production or a remote.

**Before task 1:** the checkout was on `feat/student-tweaks` with uncommitted work when this plan was written. Do not switch branches until that work is committed. Then run `git checkout dev && git pull && git checkout -b feat/course-finder`. Agree the migration number with Jenish (intent, open question 5).

## Files

| Path | Create or modify | Responsibility |
| --- | --- | --- |
| `src/features/finder/switch.ts` | create | `finderOn`, `courseDetailOn`, `compareOn` (server env switches, default off) |
| `src/features/finder/model/types.ts` | create | `FinderExtra`, `FinderHit`, `FinderResult`, `KeywordHit`, `FinderWhy`, `FilterKey`: the one definition of every finder shape |
| `src/features/roads/data/fields.ts` | modify | New niche fields and edges in `FIELDS` / `FIELD_EDGES` (task 2) |
| `src/features/finder/data/GENERATE.md` | create | The committed brief the catalogue was generated from |
| `src/features/finder/data/raw/*.json` | create | Generated raw courses, one file per broad field |
| `src/features/finder/data/schema.ts` | create | `rawCourseSchema` (zod) for a generated course |
| `src/features/finder/data/field-occupations.ts` | create | `FIELD_OCCUPATIONS`: each `FieldId` to existing occupation codes |
| `src/features/finder/model/build.ts` | create | `buildCatalogue(raw)`: `Course` rows and `FinderExtra` rows by rule |
| `src/features/finder/data/catalogue.ts` | create (generated by `scripts/finder-build.ts`) | `FINDER_COURSES: Course[]`, `FINDER_EXTRAS: FinderExtra[]` |
| `scripts/finder-build.ts` | create | Validate raw, build, embed, drop near-duplicates, write `catalogue.ts`, report |
| `src/features/finder/server/embed.ts` | create | `embedTexts`, `EMBED_MODEL`, `EMBED_DIMS`; fake vectors under `AI_PROVIDER=fake` |
| `docker-compose.yml` | modify | `image: pgvector/pgvector:pg17` |
| `src/shared/lib/db/schema.ts` | modify | `courseDoc` table |
| `src/shared/lib/db/migrations/00NN_course_doc.sql` | create | `CREATE EXTENSION IF NOT EXISTS vector` plus the table |
| `docs/course-finder/undo-course-doc.sql` | create | The hand-written undo |
| `scripts/finder-seed.ts` | create | Idempotent seed of `course_doc` from `catalogue.ts` |
| `src/features/finder/model/filters.ts` | create | `feeCapK`, `destinationOk`, `filterOutcome`: pure filter rules |
| `src/features/finder/model/config.ts` | create | `FINDER_TOP`, `FINDER_FLOOR`, `SEARCH_TIMEOUT_MS`, `WHY_TOP`, `FINDER_PER_HOUR` |
| `src/features/finder/server/search.ts` | create | `searchCourses(text, answers)`: one meaning query and one keyword query |
| `src/features/content/ai/config.ts` | modify | `'student_finder_why'` in `UseCase` |
| `src/features/content/ai/prompts.ts` | modify | `STUDENT_FINDER_WHY` spec |
| `src/features/content/ai/fake.ts` | modify | Fake answer for `student_finder_why` |
| `src/features/admin/models/use-cases.ts` | modify | `LISTED` entry |
| `src/features/admin/models/test-call.ts` | modify | `SPECS` entry |
| `src/features/finder/model/why.ts` | create | `quoteFound`, `finderWhyProblems`, `finderWhyTemplate` |
| `src/features/finder/server/why.ts` | create | `writeFinderWhy(text, courseId)` with its timeouts and deadline |
| `src/features/finder/server/limit.ts` | create | `finderAllowed(userId)` |
| `src/features/finder/model/seed.ts` | create | `finderSeedText(roadmap)` |
| `src/features/finder/actions.ts` | create | `findCoursesAction`, `finderWhyAction` |
| `src/features/finder/components/FinderPanel.tsx` | create | Search, results, "why" loading, engine room; shown in the board's column or phone sheet like Your answers |
| `src/features/finder/components/useFinder.ts` | create | The panel's state: search, then the "why" texts |
| `src/features/road/components/RoadBoard.tsx` | modify | Optional `finder` prop; a `finding` state that opens the panel where Your answers opens |
| `src/features/road/components/ControlsBar.tsx` | modify | A fourth "Find" item below 64rem |
| `src/features/road/components/StackList.tsx` | modify | "Find courses by what you enjoy" at the top of the more-courses list |
| `src/app/(app)/roadmaps/[id]/layout.tsx` | modify | Passes `finder` (seed and actions) when `finderOn` |
| `src/features/finder/evals/queries.ts` | create | `DEMO_QUERIES`, `NEGATIVE_QUERIES`, `HELD_OUT_QUERIES` |
| `scripts/finder-eval.ts` | create | Hit@3 on the real model, the floor report |
| `package.json` | modify | `finder:build`, `finder:seed`, `finder:eval`; `test:db` gains the finder suite |
| `README.md` | modify | "How it scales" |
| `src/features/finder/data/job-market.ts` | create | `JOB_MARKET` sample rows, `jobMarketFor(code, cityId)` |
| `src/features/roads/model/details.ts` | modify | `market` on occupation details when `courseDetailOn` |
| `src/features/road/components/CardDetails.tsx` | modify | "Job market (sample data)" section |
| `src/features/finder/components/CourseDetail.tsx` | create | Related fields, jobs, job market on a finder card |
| `src/features/roads/data/occupations.ts` | modify | `routeFor(occupations, cityId, prScore)`; `stayingRoute` delegates |
| `src/features/roads/model/compose.ts` | modify | Exports `workRightsLine(cityId, level, years)`; `cityGuide` uses it |
| `src/features/roads/data/courses.ts` | modify | `courseById` falls back to `FINDER_COURSES` |
| `src/features/finder/model/compare.ts` | create | `compareRows(current, alternative, answers)` |
| `src/features/finder/components/WhatChanges.tsx` | create | The comparison and "Start a new roadmap from it" |
| `src/shared/types/student.ts` | modify | `RoadmapChoices.pinned` |
| `src/features/roads/model/road-for.ts` | modify | Honours `pinned` |
| `src/features/roadmaps/actions.ts` | modify | `createRoadmapAction` takes `pinned` |
| `src/app/(app)/roadmaps/new/page.tsx` | modify | `?pin=<courseId>` |
| `src/features/opening/model/flags.ts` | create | `STUDY_FLAGS` from `NEXT_PUBLIC_WIDER_INTERESTS` and `NEXT_PUBLIC_ONE_YEAR` |
| `src/features/opening/model/questions.ts` | modify | `screensFor(flags)`, new options, `normaliseAnswers` |
| `src/features/roads/data/fields.ts` | modify | `FIELD_OF_OPTION`, `AREA_FIELDS` for the new options (task 20) |
| `Dockerfile` | modify | `ARG`/`ENV` for the two build flags |
| `src/features/roads/data/types.ts` | modify | Optional ending slots, `RoadSpec.shape` |
| `src/features/roads/model/endings.ts` | modify | `oneYearHomeEnding` |
| `src/features/roads/model/build.ts` | modify | One-year shape: drop absent slots, shift, ruler |
| `src/features/roads/model/sound.test-helpers.ts` | modify | Geometry per shape |
| `src/features/roads/data/candidates.ts` | modify | One-year picks (home only) under the flag |
| `src/features/roads/model/match.ts` | modify | A `years` rule under the flag |
| `src/features/finder/data/niche-proposal.json` | create | The isolated agent's niche-field proposal, verbatim |
| `src/features/finder/model/dedupe.ts` | create | `dropNearDuplicates(ids, vectors, threshold)` |
| `src/features/finder/model/seed-plan.ts` | create | `seedPlan(catalogue, stored, model)`: what to embed, keep, remove |
| `src/features/finder/model/words.ts` | create | `STOPWORDS`, `contentWords(text)` (the fake embedding and the shared-words test) |
| `src/features/finder/model/detail.ts` | create | `courseDetail(courseId, cityId)`: fields near, jobs, job market |
| `docs/course-finder/eval.md` | create | The recorded `finder:eval` run |
| `src/features/roads/data/subjects.ts` | modify | `subjectsOf` falls back to finder extras; subjects for added road courses |
| `src/app/(public)/privacy/page.tsx` | modify | Names the finder among what is sent to Gemini (task 13) |
| `docs/hackathon/deploy.md` | modify | §6b, the finder seed job (task 9) |
| `Dockerfile` | modify | Bundles `dist/finder-seed.js` for the seed job (task 9), as well as the build flags (task 21) |

---

# PR 1: the finder (`feat/course-finder`)

## Task 1: Switches and the finder's shared types
**Delivers:** criterion 1 (the switch); defines every shape later tasks import.
**Files:** create `src/features/finder/switch.ts`, `src/features/finder/switch.test.ts`, `src/features/finder/model/types.ts`.
**Kind:** transcription

- [ ] Step 1: write the failing test `src/features/finder/switch.test.ts`:

```ts
import { describe, expect, it } from 'bun:test'
import { compareOn, courseDetailOn, finderOn } from './switch'

describe('the finder switches', () => {
  it('are off unless set to 1', () => {
    expect(finderOn({})).toBe(false)
    expect(courseDetailOn({ COURSE_DETAIL_ON: 'true' })).toBe(false)
    expect(compareOn({ COMPARE_ON: '1' })).toBe(true)
  })
  it('keeps the finder off while the student AI is off (one switch turns every student model call off)', () => {
    expect(finderOn({ FINDER_ON: '1' })).toBe(true)
    expect(finderOn({ FINDER_ON: '1', STUDENT_AI_OFF: '1' })).toBe(false)
  })
})
```

- [ ] Step 2: run it: `bash scripts/capped.sh bun test src/features/finder/switch.test.ts`. Expected: FAIL, "Cannot find module './switch'".
- [ ] Step 3: create `src/features/finder/switch.ts`:

```ts
// The finder's switches, read on the server from the environment, each off unless set to "1", so a
// part can be turned off with no deploy. The finder is also off while the student AI is off
// (STUDENT_AI_OFF, src/features/roads/switch.ts): it cannot search without a model call. Pure.

import { studentAiOff } from '@/features/roads/switch'

type Env = Record<string, string | undefined>

/** The Find panel on the board (story 1). */
export const finderOn = (env: Env): boolean => env.FINDER_ON === '1' && !studentAiOff(env)

/** Related fields, jobs and sample job-market figures on course cards (story 2). */
export const courseDetailOn = (env: Env): boolean => env.COURSE_DETAIL_ON === '1'

/** "What changes" and "Start a new roadmap from it" (story 3). */
export const compareOn = (env: Env): boolean => env.COMPARE_ON === '1'
```

  Create `src/features/finder/model/types.ts`:

```ts
// The finder's shapes, defined once: the catalogue's extras beside each Course, a search's hits
// and its engine room, and a card's why. Client-safe: types only.

import type { FieldId, Level } from '@/features/engine/types'

/** What the finder knows about a catalogue course beyond the engine's Course row. */
export type FinderExtra = {
  courseId: string
  /** 2–4 sentences on what the course teaches: what is embedded and what a why may quote. */
  description: string
  /** Its field in the field graph (FIELDS in src/features/roads/data/fields.ts). */
  graphField: string
  niche: boolean
  subjects: { majors: string[]; units: string[] }
  /** ANZSCO codes from OCCUPATIONS, assigned by its FieldId (FIELD_OCCUPATIONS). */
  occupationCodes: string[]
}

/** A hard filter a course can fail. */
export type FilterKey = 'level' | 'fee' | 'destination'

/** One of the nearest courses to her words; a card shows it only when `failed` is empty. */
export type FinderHit = {
  courseId: string
  name: string
  university: string
  cityId: string
  level: Level
  years: number
  feeK: number
  field: FieldId
  graphField: string
  niche: boolean
  /** The niche field's one-line definition; null for a field that is not niche. */
  definition: string | null
  description: string
  /** Cosine similarity, 0–1, rounded to 3 places. */
  score: number
  failed: FilterKey[]
}

/** A course the keyword search found for the same words, for the engine room. */
export type KeywordHit = { courseId: string; name: string; rank: number }

type Searched = {
  query: string
  model: string
  /** Her words' embedding came from the in-process cache. */
  cached: boolean
  searchMs: number
  keyword: KeywordHit[]
}

/** A search: the nearest courses, or nothing close enough (best score under FINDER_FLOOR). */
export type FinderResult =
  | (Searched & { kind: 'results'; hits: FinderHit[] })
  | (Searched & { kind: 'nothing-close'; best: number })

/** A card's why: the model's, with the passage it quoted, else the template. */
export type FinderWhy = {
  courseId: string
  text: string
  quote: string | null
  source: 'model' | 'template'
  ms: number
}
```

- [ ] Step 4: run it: `bash scripts/capped.sh bun test src/features/finder/switch.test.ts`. Expected: PASS (2 tests).
- [ ] Step 5: commit: `feat(finder): switches and shared types`

## Task 2: Niche fields proposed without the demo queries
**Delivers:** groundwork for criteria 5 and 12–15. The niche fields come from the taxonomy, not from the queries.
**Files:** modify `src/features/roads/data/fields.ts`; test `src/features/roads/data/fields.test.ts` (create if absent).
**Kind:** judgement

- [ ] Step 1: write the failing tests in `src/features/roads/data/fields.test.ts`:
  - every `FIELDS` id is unique;
  - every `FIELD_EDGES` endpoint is a `FIELDS` id;
  - every niche field has a definition of at most 140 characters;
  - every niche field has at least one edge;
  - `FIELDS.filter((f) => f.niche).length >= 12`. Today there are 3, so this fails.
- [ ] Step 2: run it: `bash scripts/capped.sh bun test src/features/roads/data/fields.test.ts`. Expected: FAIL on the count.
- [ ] Step 3: get the proposal from an isolated agent. Dispatch a `general-purpose` agent, not a fork, with exactly this brief:

  > You are proposing niche or emerging fields of study for a course catalogue for international students in Australia. Do not read any file under `docs/`, `src/features/finder/` or `scripts/`. Read only `src/features/roads/data/fields.ts` and `src/features/engine/types.ts` (`FieldId`). For each of the eight broad fields in `FieldId` (cyber, data, business, it, psych, health, engineering, design), propose 1–3 niche or emerging fields a counsellor would know but a student would rarely search for. Each must be a real field taught in Australian postgraduate or diploma programs. Return JSON only: `[{ "id": kebab-case, "name", "definition": one sentence under 140 characters a 17-year-old understands, "edges": [{ "to": an existing FIELDS id, "kind": "is-a" | "combines" | "related" }] }]`. Skip any field already in FIELDS.

  Add every proposal that passes the tests to `FIELDS` (with `niche: true`) and `FIELD_EDGES`, in the file's existing style. Do not add or remove anything the agent did not propose. Save its raw reply as `src/features/finder/data/niche-proposal.json`.
- [ ] Step 4: run it, plus the roads suite: `bash scripts/capped.sh bun test src/features/roads`. Expected: PASS. In particular `match.test.ts` "the demo profiles" is unchanged (criterion 40).
- [ ] Step 5: commit: `feat(roads): niche fields from a taxonomy proposal`

## Task 3: The generation brief, the raw schema and the raw catalogue
**Delivers:** criteria 15 and 16 (the raw side).
**Files:** create `src/features/finder/data/GENERATE.md`, `src/features/finder/data/schema.ts`, `src/features/finder/data/schema.test.ts`, `src/features/finder/data/raw/<field>.json` (eight files).
**Kind:** judgement

- [ ] Step 1: write the failing test `schema.test.ts`. For each raw file:
  - every row passes `rawCourseSchema`;
  - the eight files together hold 400–1,000 rows;
  - every `graphField` is a `FIELDS` id;
  - every `campusId` is in `FINDER_CAMPUSES`;
  - no two rows share `name + campusId`.
- [ ] Step 2: run it: `bash scripts/capped.sh bun test src/features/finder/data/schema.test.ts`. Expected: FAIL (no schema).
- [ ] Step 3: implement.
  - **`schema.ts`** exports:
    - `FINDER_CITIES = ['perth', 'adelaide', 'sydney', 'melbourne', 'geelong', 'hobart'] as const`;
    - `FINDER_CAMPUSES`: the `CAMPUSES` (src/features/engine/catalogue.ts:153) in those cities whose id is used by some course in `COURSES` or `EXTRA_COURSES`, so the university name is known;
    - `rawCourseSchema` (`import { z } from 'zod'`, as src/features/roads/actions.ts does), with these fields:
      - `name`: 8–90 characters
      - `campusId`: one of `FINDER_CAMPUSES`
      - `level`: `'Diploma' | "Master's"`
      - `years`: `1 | 2`
      - `feeK`: an integer, 12–60
      - `field`: a `FieldId`
      - `graphField`: a string
      - `niche`: boolean
      - `placements`: boolean
      - `description`: 120–600 characters, 2–4 sentences (count `/[.!?](\s|$)/`)
      - `majors`: 1–4 strings
      - `units`: 3–8 strings
    - `type RawCourse = z.infer<typeof rawCourseSchema>`.
  - **`GENERATE.md`** is the brief, committed so anyone can see how the catalogue was made. Its content:
    - **Purpose:** a sample catalogue for a demo; every figure is labelled sample.
    - **Coverage:**
      - the usual courses of the broad field, plus every niche field in `FIELDS` under it;
      - at the campuses listed, as Diploma or Master's, one or two years;
      - fees typical for the level (Diploma 12–28k, Master's 26–60k).
    - **Descriptions:**
      - say what the course teaches and how, in plain words;
      - vary length and voice;
      - no marketing words ("best", "leading", "top");
      - no figures except the course length.
    - **Units and majors:** realistic.
    - **Forbidden:** visa or PR claims (code adds those); employer names.
  - **Generation:** dispatch eight `general-purpose` agents in one message, one per `FieldId`. Each gets the full text of `GENERATE.md`, the `FINDER_CAMPUSES` ids with their names, and that field's graph fields (its own `FIELDS` entry plus every niche field with an edge to it). The brief says: "Do not read any file under `docs/`, `src/features/finder/evals/` or `scripts/`. Write 50–110 courses as a JSON array to `src/features/finder/data/raw/<field>.json`." No agent sees the demo or held-out queries.
- [ ] Step 4: run it: `bash scripts/capped.sh bun test src/features/finder/data/schema.test.ts`. Expected: PASS. Fix rows by re-asking the same agent for the failing ones; never hand-edit a description towards a query.
- [ ] Step 5: commit: `feat(finder): generation brief and raw sample catalogue`

## Task 4: Road rules any course can use
**Delivers:** criterion 17 (the rules the catalogue build relies on); the existing roads unchanged.
**Files:** modify `src/features/roads/data/occupations.ts`, `src/features/roads/model/compose.ts`; test `src/features/roads/data/occupations.test.ts` (create), `src/features/roads/model/compose.test.ts`.
**Kind:** judgement

- [ ] Step 1: write the failing tests.
  - **`occupations.test.ts`:**
    - `routeFor([], 'perth', 3)` is `'none'`;
    - for every course id in every `OCCUPATIONS[].courseIds` and every city in `CITY_STATE`, `stayingRoute(id, city) === routeFor(occupationsFor(id), city, courseById(id)?.prScore)`;
    - `routeFor(occupationsFor(id), city, 0)` is `'none'` for any such id.
  - **`compose.test.ts`:**
    - `workRightsLine('perth', "Master's", 2)` is `'Counts as regional: up to 5 years of post-study work rights after the course'`;
    - `workRightsLine('sydney', 'Diploma', 2)` is `'Not regional: about 18 months of post-study work rights after a diploma'`;
    - `workRightsLine('perth', "Master's", 1)` is `'One year of study alone does not open the Temporary Graduate visa (485)'`.
- [ ] Step 2: run: `bash scripts/capped.sh bun test src/features/roads/data/occupations.test.ts src/features/roads/model/compose.test.ts`. Expected: FAIL, "routeFor is not a function" / "workRightsLine is not exported".
- [ ] Step 3: implement.
  - **`occupations.ts`:** add `export function routeFor(occupations: readonly Occupation[], cityId: string, prScore: number | undefined): StayingRoute`, with the body of today's `stayingRoute` (`occupations.ts:153-160`) made to read its arguments. Make `stayingRoute(courseId, cityId)` return `routeFor(occupationsFor(courseId), cityId, courseById(courseId)?.prScore)`. Its signature and doc comment stay.
  - **`compose.ts`:** split `cityGuide` (`compose.ts:21-32`).
    - `export function workRightsLine(cityId: string, level: Level, years: number): string` returns today's `rights` text for `years >= 2`, and the one-year sentence above for `years === 1`.
    - `cityGuide` becomes `` `${workRightsLine(cityId, level, 2)}. About ${livingOf(cityId)}.` ``, so every existing road's text is unchanged.
- [ ] Step 4: run `bash scripts/capped.sh bun test src/features/roads`. Expected: PASS, including every "is sound" test in `compose.test.ts:92`.
- [ ] Step 5: commit: `refactor(roads): staying route and work rights callable for any course`

## Task 5: Field occupations and the catalogue build
**Delivers:** criteria 16 and 17, and the build half of 3 (the "sample data" label).
**Files:** create `src/features/finder/data/field-occupations.ts`, `src/features/finder/model/build.ts`, `src/features/finder/model/build.test.ts`.
**Kind:** judgement

- [ ] Step 1: write the failing tests `build.test.ts` against a few hand-written `RawCourse` fixtures:
  - **Ids:** `buildCatalogue(raw).courses[i].id` is `` `f-${slug(name)}-${campusId}` ``, and ids are unique even when two raw names slug alike (a `-2` suffix).
  - **University:** `university` is the university that `COURSES`/`EXTRA_COURSES` use for that `campusId`.
  - **Rules (criterion 17):** for a course with field `cyber` in `perth`:
    - `lines.pr.text` names the route `routeFor(occupations, 'perth', undefined)` gives;
    - `lines.work.text === workRightsLine('perth', level, years)`;
    - `prScore` is 3/2/1/0 for 190/491/186/none.
  - **One year:** a one-year course's `lines.work.text` is the one-year sentence.
  - **Sample labels:** every claim's `source` ends with `' · sample'`, and `feeClaim.detail[0]` names the fee.
  - **Extras:** `extras[i].occupationCodes` equals `FIELD_OCCUPATIONS[field]`, and `extras[i].description` is the raw description, unchanged.
  - **Field occupations:** every code in `FIELD_OCCUPATIONS` exists in `OCCUPATIONS`.
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/finder/model/build.test.ts`. Expected: FAIL (no module).
- [ ] Step 3: implement.
  - **`field-occupations.ts`:** `export const FIELD_OCCUPATIONS: Readonly<Record<FieldId, readonly string[]>>`. Map each `FieldId` to the `OCCUPATIONS` codes whose `courseIds` include courses of that field in `COURSES`/`EXTRA_COURSES`. Compute it, don't type it by hand: `occupationsFor(c.id)` over every course of the field, de-duplicated. A field with none maps to `[]`, which gives "no clear PR". That is honest, and the test pins it.
  - **`build.ts`:** export `buildCatalogue(raw: readonly RawCourse[]): { courses: Course[]; extras: FinderExtra[] }`. It is pure.
    - Follow the `Course` shape of `src/features/roads/data/courses.ts:148-171`, with a local `claim()` like `courses.ts:6-13` whose source suffix is `' · sample'` and source `'OfCourse sample catalogue'`.
    - **`route`:** `routeWord(route)` plus ", then PR" unless `'none'`.
    - **`careerScore`:** 3 when the field has occupations, else 2.
    - **`keepOpen`:** `{ text: 'Ask <university> about the next intake', doors: 'keeps 1 door open' }`.
    - **`lines`:**
      - `time`: "<years> year(s), <level>", neutral;
      - `work`: `workRightsLine`, effect `gives` when `years === 2`, else `costs`;
      - `pr`: the route words, effect `gives` unless none;
      - `career`: the occupation names joined, or "No listed occupation for this field", neutral.
    - No text in `lines` comes from the raw rows.
- [ ] Step 4: run `bash scripts/capped.sh bun test src/features/finder/model/build.test.ts`. Expected: PASS.
- [ ] Step 5: commit: `feat(finder): build catalogue rows by rule`

## Task 6: Embeddings
**Delivers:** the embedding call criteria 3, 12–14 and 19 rely on; the "cached" flag in criterion 19.
**Files:** create `src/features/finder/server/embed.ts`, `src/features/finder/server/embed.test.ts`, `src/features/finder/model/config.ts`.
**Kind:** judgement

- [ ] Step 1: write the failing tests `embed.test.ts` with `process.env.AI_PROVIDER = 'fake'`, and `mock.module('server-only', () => ({}))` as `src/features/roadmaps/server/own-words.db.test.ts:10` does:
  - **Dimensions:** `embedTexts(['a b'], 'RETRIEVAL_QUERY')` resolves to one vector of length `EMBED_DIMS` (768).
  - **Determinism:** the same text gives the same vector.
  - **Shared words:** two texts sharing a word have cosine similarity > 0; two with no word in common have 0.
  - **Cache:** `embedQuery('x')` twice returns `cached: false`, then `cached: true`.
  - **Failure:** the fake fails when the text contains `[fake:fail-embed]` (rejects).
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/finder/server/embed.test.ts`. Expected: FAIL (no module).
- [ ] Step 3: implement.
  - **`config.ts`** (pure, transcription inside this task):

```ts
// The finder's numbers, in one place. FINDER_FLOOR is fitted in task 14 from the held-out and
// nonsense queries (scripts/finder-eval.ts prints the distribution); 0.5 until then.
export const FINDER_TOP = 10
export const WHY_TOP = 3
export const SEARCH_TIMEOUT_MS = 2000
export const FINDER_FLOOR = 0.5
export const FINDER_PER_HOUR = 30
```

  - **`embed.ts`** (`import 'server-only'`) exports:
    - `EMBED_MODEL = 'gemini-embedding-001'` and `EMBED_DIMS = 768` (ADR-115);
    - `type EmbedTask = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'`;
    - `embedTexts(texts: readonly string[], task: EmbedTask, signal?: AbortSignal): Promise<number[][]>`;
    - `embedQuery(text: string, signal?: AbortSignal): Promise<{ vector: number[]; cached: boolean }>`.
  - **The real path:**
    - Construct the client the way `src/features/content/ai/vertex.ts:200-209` does: `new GoogleGenAI({ vertexai: true, project, location })` from `aiConfig(process.env)`, created lazily once.
    - Call `client.models.embedContent({ model, contents: text, config: { taskType: task, outputDimensionality: EMBED_DIMS, abortSignal: signal } })` and read `res.embeddings?.[0]?.values`. Throw if it is missing or the wrong length.
    - Verified in `node_modules/@google/genai/dist/node/node.d.ts`:
      - `Models.embedContent` (line 11924);
      - `EmbedContentConfig.taskType: string`, `outputDimensionality`, `abortSignal` (lines 4267-4302);
      - `EmbedContentResponse.embeddings[].values` (lines 4349-4359, 2211-2219).
    - The typed config has no `labels`, so these calls carry no billing labels.
    - **Verified live, 16 Oct 2026:** `embedContent` with `gemini-embedding-001` at location `global`, project `applyims`, `outputDimensionality: 768` returned a 768-length vector. The production service already sets `GOOGLE_CLOUD_LOCATION`, so no new location setting is needed.
    - **One text per call.** Batching for `gemini-embedding-001` is not verified in this repo, so `embedTexts` runs at most 4 calls at a time.
    - The model can be overridden with `GEMINI_EMBEDDING_MODEL`.
  - **The fake path** (`aiConfig(process.env).provider === 'fake'`): a bag-of-words vector. Lower-case the text, split on non-letters, drop the stopwords listed in the file, and hash each word to an index in 0..767 (FNV-1a) with +1. All zeros is allowed (similarity 0).
  - **Cache:** a `Map` capped at 500 entries (delete the oldest when full), keyed by the trimmed text.
  - **Logs:** nothing here logs the text (criterion 11).
- [ ] Step 4: run `bash scripts/capped.sh bun test src/features/finder/server/embed.test.ts`. Expected: PASS.
- [ ] Step 5: commit: `feat(finder): embeddings with a deterministic fake`

## Task 7: The `course_doc` table in pgvector
**Delivers:** the storage for criteria 3, 4, 19 and 20.
**Files:** modify `docker-compose.yml`, `src/shared/lib/db/schema.ts`; create the migration `src/shared/lib/db/migrations/00NN_course_doc.sql` (NN agreed with Jenish), `docs/course-finder/undo-course-doc.sql`, `src/features/finder/server/course-doc.db.test.ts`.
**Kind:** judgement

- [ ] Step 1: write the failing database test `course-doc.db.test.ts`. Follow `src/features/roadmaps/server/own-words.db.test.ts`: `describe.skipIf(!enabled)`, a lazy `db` import in `beforeAll`, and an id prefix `cd-t-` for cleanup.
  - `select extname from pg_extension where extname = 'vector'` returns one row.
  - Inserting two rows whose embeddings are unit vectors on axis 0 and axis 1, then ordering by `cosineDistance(courseDoc.embedding, axis0)`, returns the axis-0 row first with distance 0.
- [ ] Step 2: run `DB_TESTS=1 DATABASE_URL=postgres://app:app@127.0.0.1:5433/app bash scripts/capped.sh bun test src/features/finder/server/course-doc.db.test.ts`. Expected: FAIL (no table).
- [ ] Step 3: implement.
  1. **Back up first:** `bun run db:dump` (the overnight run takes it before anything else; see "Overnight run").
  2. **Swap the image and the volume together:** in `docker-compose.yml`, change `postgres:17-alpine` (L6) to `pgvector/pgvector:pg17`, and rename the volume `pg-data` to `pg-data-vector` (both the service's mount, L13-14, and the top-level `volumes:` entry, L21-22). Add a comment in the file's style explaining why.
     - The image is Debian-based (glibc) while the old one is Alpine (musl). Postgres sorts text through the C library, so text indexes written by one are unsafe under the other. Data moves between them only by dump and restore, never by reusing files.
     - With a new volume name, `docker compose` gives the new image a fresh, empty volume. The old `pg-data` volume is never opened by it and stays intact, so branches without this change still find their data.
     - **Morning step for the developer** (not done by the run): on this branch, `bun run dev` starts the new database empty and migrates it. Then `bun run db:restore` loads the dump.
     - Jenish does the same after the merge.
  3. **The table:** in `schema.ts`, below `aiSettingChange` (L603-610), add `courseDoc = pgTable('course_doc', …)`. Import `vector` (and `boolean`, `integer` if not already imported) from `drizzle-orm/pg-core`; `vector` is verified at `node_modules/drizzle-orm/pg-core/columns/vector_extension/vector.d.ts:37-41`, drizzle-orm 0.45.3. Its columns:
     - `id` text primary key
     - `name`, `university`, `cityId` (`city_id`), `level`, `field`, `graphField` (`graph_field`), `description`, `textHash` (`text_hash`) and `embeddingModel` (`embedding_model`): text, not null
     - `years` and `feeK` (`fee_k`): integer, not null
     - `niche`: boolean, not null
     - `embedding`: `vector('embedding', { dimensions: 768 })`, not null
     - `updatedAt`: `tz('updated_at').notNull().defaultNow()`

     Add a short comment in the file's style saying it is the finder's copy of the catalogue, rebuilt by `bun run finder:seed`. No HNSW index: under a thousand rows an exact scan is right (ADR-117).
  4. **The migration:** `bun run db:generate --name course_doc`. Production can run its `CREATE EXTENSION`: checked 16 Oct 2026 in Cloud SQL Studio on `ofcourse-db` as `ofcourse`, `pg_has_role(current_user, 'cloudsqlsuperuser', 'member')` was true, `vector` was in `pg_available_extensions`, and it was not yet installed. Then prepend `CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint` to the generated SQL. Hand edits to generated migrations exist already (`0018_roadmaps.sql:27`). Check the journal's `when` is later than the last entry (`docs/hackathon/deploy.md:104`).
  5. **The undo:** write `docs/course-finder/undo-course-doc.sql`: `DROP TABLE IF EXISTS course_doc;`, plus a comment that the extension stays and the journal row must be deleted by hand. Do not put it in the migrations folder, where the migrator would read it.
- [ ] Step 4: run `bun scripts/migrate.ts`, then the Step 2 command. Expected: PASS. Then run `bun run type-check`. Expected: no errors.
- [ ] Step 5: commit: `feat(db): course_doc with pgvector for the finder`

## Task 8: `finder:build` (validate, build, drop near-duplicates, write the catalogue)
**Delivers:** criteria 16 and 18.
**Files:** create `src/features/finder/model/dedupe.ts`, `src/features/finder/model/dedupe.test.ts`, `scripts/finder-build.ts`, `src/features/finder/data/catalogue.ts` (generated), `src/features/finder/data/catalogue.test.ts`; modify `package.json`.
**Kind:** judgement

- [ ] Step 1: write the failing tests.
  - **`dedupe.test.ts`:** `dropNearDuplicates(ids, vectors, 0.95)` returns `{ kept, dropped }`. It keeps the first of any pair over the threshold, keeps both of a pair at 0.94, and is stable in input order.
  - **`catalogue.test.ts`** (criterion 16), on the generated `FINDER_COURSES` / `FINDER_EXTRAS`:
    - 400–1,000 courses, and the same number of extras with matching ids;
    - every course in `FINDER_CITIES`, `level` Diploma or Master's, `years` 1 or 2;
    - every `feeClaim.source` ends with `' · sample'`;
    - every description has 2–4 sentences;
    - no id collides with `COURSES`/`EXTRA_COURSES`.
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/finder/model/dedupe.test.ts src/features/finder/data/catalogue.test.ts`. Expected: FAIL.
- [ ] Step 3: implement.
  - **`dedupe.ts`:** pure cosine similarity plus the greedy keep-first rule above.
  - **`scripts/finder-build.ts`:** a top-level-await Bun script in the style of `scripts/ai-eval-student.ts`, with an env guard first: refuse `AI_PROVIDER=fake`.
    1. Read `src/features/finder/data/raw/*.json` and parse each row with `rawCourseSchema`. Print and skip invalid rows.
    2. Run `buildCatalogue`.
    3. Embed `` `${name}. ${description}` `` with `RETRIEVAL_DOCUMENT`.
    4. Run `dropNearDuplicates` at 0.95.
    5. Write `src/features/finder/data/catalogue.ts`. Its header comment is "Generated by scripts/finder-build.ts from data/raw on <date>; do not edit", followed by `export const FINDER_COURSES: readonly Course[] = [...]` and `export const FINDER_EXTRAS: readonly FinderExtra[] = [...]`. Use `JSON.stringify` with two spaces, then `bun run format`.
    6. Print `raw N · invalid N · near-duplicates dropped N · kept N`.
  - **`package.json`:** add `"finder:build": "bun --conditions react-server scripts/finder-build.ts"`.
  - **Run it:** `bun run finder:build`. It needs `GOOGLE_CLOUD_PROJECT` and an ADC login; the developer runs it.
- [ ] Step 4: run the Step 2 command. Expected: PASS. Record the printed counts in the commit body.
- [ ] Step 5: commit: `feat(finder): build the sample catalogue (N courses, N near-duplicates dropped)`

## Task 9: `finder:seed` (idempotent, re-embeds only what changed)
**Delivers:** the data behind criteria 3 and 19; re-embedding only what changed.
**Files:** create `src/features/finder/model/seed-plan.ts`, `src/features/finder/model/seed-plan.test.ts`, `scripts/finder-seed.ts`; modify `package.json`.
**Kind:** judgement

- [ ] Step 1: write the failing test `seed-plan.test.ts`. `seedPlan(catalogue: {id; textHash}[], stored: {id; textHash; embeddingModel}[], model)` returns `{ embed: string[]; keep: string[]; remove: string[] }`:
  - a new id goes to `embed`;
  - a changed hash goes to `embed`;
  - a different `embeddingModel` goes to `embed`;
  - same hash and model go to `keep`;
  - a stored id no longer in the catalogue goes to `remove`.
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/finder/model/seed-plan.test.ts`. Expected: FAIL.
- [ ] Step 3: implement.
  - **`seed-plan.ts`:** pure.
  - **`scripts/finder-seed.ts`** (env guard: `DATABASE_URL` set):
    1. Compute each course's `textHash` with `sha256Hex` (src/features/content/server/hash.ts) of `` `${name}. ${description}` ``.
    2. Read the stored rows and plan.
    3. Embed the `embed` ids with `RETRIEVAL_DOCUMENT`.
    4. Upsert all catalogue rows (`onConflictDoUpdate` on id) and delete the `remove` ids.
    5. Print `embedded N of M · removed N`.
  - **`package.json`:** add `"finder:seed": "bun --conditions react-server scripts/finder-seed.ts"`.
  - **Production runs it as a Cloud Run job, like the migrations.** The Cloud SQL Auth Proxy is not installed on the development machine, and the job already has the socket, the secrets and a service account that calls Vertex.
    - **Dockerfile:** in the build stage, after `RUN bun run build`, add `RUN bun build scripts/finder-seed.ts --target bun --conditions react-server --outfile dist/finder-seed.js`. Check the flags with `bun build --help` first. In the runtime stage, add `COPY --from=build /app/dist/finder-seed.js ./dist/finder-seed.js`.
    - **`docs/hackathon/deploy.md`:** add a §6b, "Seed the finder". It is the §6 `gcloud run jobs deploy` command with:
      - the job name `ofcourse-finder-seed`;
      - `--command bun --args dist/finder-seed.js`;
      - `GOOGLE_CLOUD_PROJECT=applyims,GOOGLE_CLOUD_LOCATION=global` added to `--set-env-vars`, since it calls the embedding model.

      Then `gcloud run jobs execute ofcourse-finder-seed --project applyims --region asia-southeast1 --wait`.
    - **The morning checklist:** write `docs/course-finder/deploy-checklist.md` for Nikhil. It gives every command filled in, in this order:
      1. **Before deploying:**
         - bring `dev` up to date (merge `origin/main` for the privacy page, and decide on `fix/image-timeout`);
         - merge the PRs in order: student-tweaks, update-topics, course-finder retargeted to `dev`;
         - `git status` clean on `dev`.
      2. **Deploy the service** with `FINDER_ON` unset and `--labels commit=$(git rev-parse --short HEAD)`.
      3. **Migrations:** redeploy `ofcourse-migrate` with the new image (the §6 `--image` from `gcloud run services describe`) and execute it.
      4. **Seed:** deploy and execute the §6b seed job; expect `embedded N of N`.
      5. **Smoke test with the finder off:** the site unchanged, and topics in `/admin/updates`.
      6. **Switch on:** `gcloud run services update ofcourse --project applyims --region asia-southeast1 --update-env-vars FINDER_ON=1`. Smoke test the three demo searches and time them (criterion 7).
      7. **Rollback:**
         - `--remove-env-vars FINDER_ON` hides the finder;
         - `gcloud run services update-traffic ofcourse --project applyims --region asia-southeast1 --to-revisions <previous>=100` returns the whole site. The database changes only add things.
      8. **A note:** a tagged no-traffic revision cannot be tested signed-in. Google sign-in redirects only to `BETTER_AUTH_URL`, so test with the switch on the main URL.
      9. **Local database:** on `feat/course-finder`, `bun run dev` then `bun run db:restore`. Tell Jenish the same.
    - **Who runs it:** Nikhil runs it after the migrations job. Running it a second time must print `embedded 0`.
- [ ] Step 4: run the test (PASS). Then `bun run finder:seed` twice locally. Expected: the first prints `embedded N of N`, the second `embedded 0 of N`.
- [ ] Step 5: commit: `feat(finder): idempotent seed that re-embeds only what changed`

## Task 10: Filters and the search
**Delivers:** criteria 3, 4, 8, 19 (results side) and 20.
**Files:** create `src/features/finder/model/filters.ts`, `src/features/finder/model/filters.test.ts`, `src/features/finder/server/search.ts`, `src/features/finder/server/search.db.test.ts`; modify `package.json` (`test:db`).
**Kind:** judgement

- [ ] Step 1: write the failing tests.
  - **`filters.test.ts`:** `failedFilters(answers: StoredAnswers, course: { level; feeK; cityId }): FilterKey[]`:
    - **Level:** with a stated Bachelor's `qual`, a Diploma fails `level` (levels from `levelsOpenTo`, src/features/roads/model/eligibility.ts:31); with no `qual`, nothing fails `level`.
    - **Fees only:** with `amount` 30 stated and `covers` "Fees only", feeK 32 fails `fee` and 30 passes.
    - **Fees and living:** with `covers` "Fees and living", feeK 12 in Perth fails when `12 + cityById('perth').livingK > 30`.
    - **Assumed answers:** an assumed `amount` never fails `fee`, since assumed answers count as unanswered (`said`, src/features/roads/model/match.ts:52-55).
    - **Destination:** `dest` "Australia" or "Open to others" never fails `destination`.
  - **`search.db.test.ts`** (`AI_PROVIDER=fake`; insert 6 `course_doc` rows with fake embeddings of their texts; prefix `sd-t-`):
    - **Meaning order:** `searchCourses('cryptography networks', {})` returns `kind: 'results'`, with the row whose text has both words first and scores in descending order.
    - **Filters:** a Diploma row is in `hits` with `failed` `['level']` for a stated Bachelor's `qual`.
    - **Keyword:** `keyword` lists the rows whose text contains "cryptography", with `rank > 0`.
    - **Nothing close:** `searchCourses('zebra', {})` with no shared words returns `kind: 'nothing-close'`.
    - **Cache:** a second identical search has `cached: true`.
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/finder/model/filters.test.ts`, then `DB_TESTS=1 DATABASE_URL=postgres://app:app@127.0.0.1:5433/app bash scripts/capped.sh bun test src/features/finder/server/search.db.test.ts`. Expected: FAIL.
- [ ] Step 3: implement.
  - **`filters.ts`:** pure.
  - **`search.ts`** (`import 'server-only'`) exports `searchCourses(text: string, answers: StoredAnswers): Promise<FinderResult>`:
    1. `embedQuery(text, AbortSignal.timeout(SEARCH_TIMEOUT_MS))`.
    2. In parallel:
       - **meaning:** `db.select({...columns, distance: cosineDistance(courseDoc.embedding, vector)}).from(courseDoc).orderBy(distance).limit(FINDER_TOP)`, with `cosineDistance` from `drizzle-orm` (verified `node_modules/drizzle-orm/sql/functions/vector.d.ts:93`);
       - **keyword:** `` sql`ts_rank(to_tsvector('english', ${courseDoc.name} || ' ' || ${courseDoc.description}), plainto_tsquery('english', ${text}))` `` as rank, `where` the same `@@`, ordered by rank descending, limit 5.
    3. Build each hit:
       - `score = Math.round((1 - distance) * 1000) / 1000`;
       - `definition` from `FIELDS` when `niche`;
       - `failed` from `failedFilters`.
    4. If the best score is under `FINDER_FLOOR`, return `nothing-close`.
    5. Errors propagate, and the action maps them (task 12). Log nothing that holds the text.
  - **`package.json`:** add `src/features/finder/server` to `test:db`.
- [ ] Step 4: run the Step 2 commands. Expected: PASS.
- [ ] Step 5: commit: `feat(finder): meaning and keyword search with hard filters`

## Task 11: The checked "why"
**Delivers:** criterion 6.
**Files:** modify `src/features/content/ai/config.ts`, `src/features/content/ai/prompts.ts`, `src/features/content/ai/fake.ts`, `src/features/admin/models/use-cases.ts`, `src/features/admin/models/test-call.ts`, `src/features/content/ai/models.test.ts`; create `src/features/finder/model/why.ts`, `src/features/finder/model/why.test.ts`, `src/features/finder/server/why.ts`, `src/features/finder/server/why.test.ts`.
**Kind:** judgement

- [ ] Step 1: write the failing tests.
  - **`model/why.test.ts`:**
    - **`quoteFound(quote, description)`:**
      - true for an exact substring;
      - true when the quote differs only in runs of whitespace or curly versus straight quotes (`’` vs `'`, `“”` vs `"`);
      - false for a paraphrase;
      - false for a quote under 20 characters.
    - **`finderWhyProblems({ why, quote }, description)`** returns `[]` for a clean answer, and one line each for:
      - a quote not found;
      - a figure in `why` absent from the description (via `numbersIn`, src/features/roads/model/why.ts:542);
      - any `rankingWords(why)` (src/features/roads/model/why.ts:153);
      - a `why` over 300 characters.
    - **`finderWhyTemplate(said, description)`** is `` `Matches what you said about “${said trimmed to 60 chars, … if cut}”, from the course description: “${first sentence}”` ``.
  - **`server/why.test.ts`** (`AI_PROVIDER=fake`; mock `server-only`, `@/features/content/ai/calls` and `@/features/content/ai/cache` as `src/features/roads/server/why.test.ts:10,28-29` does):
    - `writeFinderWhy('I like puzzles', <a FINDER_COURSES id>)` returns `source: 'model'` with a `quote` found in that course's description;
    - with `[fake:fail-student_finder_why]` in the text it returns `source: 'template'`;
    - an unknown course id returns null;
    - a deadline of 1 ms returns the template.
  - **`models.test.ts:52-54`:** add `'student_finder_why'` to the student use cases, and assert `allowedTiers('student_finder_why')` is `['lite', 'flash']`.
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/finder/model/why.test.ts src/features/finder/server/why.test.ts src/features/content/ai/models.test.ts`. Expected: FAIL.
- [ ] Step 3: implement.
  - **The use case:**
    - Add `'student_finder_why'` to the `UseCase` union (`config.ts:11-31`). The `student_` prefix matters: `allowedTiers` keeps it to lite and flash, and the admin Models screen labels it Student (`models.ts:27-32`, `ModelsScreen.tsx:343`).
    - Add it to `LISTED` (`src/features/admin/models/use-cases.ts`; the type-check enforces this).
    - Add `STUDENT_FINDER_WHY` to `SPECS` (`test-call.ts:55`).
  - **`prompts.ts`:** after `STUDENT_WHY` (L1266-1316), in the same shape, add `STUDENT_FINDER_WHY: PromptSpec<typeof STUDENT_FINDER_WHY_SCHEMA>`:
    - `useCase: 'student_finder_why'`, `version: 'student_finder_why.v1'`, `tier: 'lite'`, `maxTier: 'flash'`, `temperature: 0.2`;
    - `schema: z.object({ why: z.string(), quote: z.string() })`;
    - data `{ said: string; course: { name: string; description: string } }`;
    - `rules`:
      1. One or two sentences, under 300 characters, linking what she said to the course.
      2. `quote` is one passage copied word for word from `course.description`, at least 20 characters.
      3. Say nothing the description does not say: no jobs, pay, visas, rankings or promises.
      4. No figures except those in the description.
      5. Never "best", "top", "recommended", "better" or "right choice".
      6. Plain words a 17-year-old understands.
    - An `example` whose answer passes `finderWhyProblems`; the prompts test checks examples against the schema.
  - **`fake.ts`:** a `student_finder_why(data)` entry. It returns `why: 'You said ' + said.slice(0, 40) + '; this course covers it.'` and `quote` = the first sentence of the description.
  - **`model/why.ts`:** pure; imports `numbersIn` and `rankingWords` from `@/features/roads/model/why`.
  - **`server/why.ts`** (`import 'server-only'`):
    - Exports `writeFinderWhy(said: string, courseId: string, deadlineMs = FINDER_WHY_DEADLINE_MS): Promise<FinderWhy | null>`, with `FINDER_WHY_TIMEOUT_MS = 6000` and `FINDER_WHY_DEADLINE_MS = 8000` defined in this file.
    - Looks the course up in `FINDER_COURSES` / `FINDER_EXTRAS`.
    - Calls `ai.generateJson(STUDENT_FINDER_WHY, { data, cache: false, verify: (v) => finderWhyProblems(v, description), timeoutMs: FINDER_WHY_TIMEOUT_MS, signal })`. `cache: false` because the data holds her own words, as own-words does (`src/features/opening/server/own-words.ts:56`).
    - Uses the deadline race of `src/features/roads/server/why.ts:50-69`, so a late answer is never read.
    - Returns `{ courseId, text, quote, source, ms }`.
- [ ] Step 4: run the Step 2 command, then `bun run type-check`. Expected: PASS, no type errors.
- [ ] Step 5: commit: `feat(finder): a grounded why that quotes the course and is checked by code`

## Task 12: Seed text, the limit and the actions
**Delivers:** criteria 2 (seed text), 9, 10 and 11, and the refusals.
**Files:** create `src/features/finder/model/seed.ts`, `src/features/finder/model/seed.test.ts`, `src/features/finder/server/limit.ts`, `src/features/finder/actions.ts`, `src/features/finder/actions.test.ts`.
**Kind:** judgement

- [ ] Step 1: write the failing tests.
  - **`seed.test.ts`:** `finderSeedText({ answers, tags })`. It never reads `ownWords`: the privacy page (`src/app/(public)/privacy/page.tsx:99-101`) promises that what she writes about how she feels is never sent to the models that write explanations, and her raw own-words text can hold that. It reads only her `tags`, which the own-words reading has already split, keeping `wellbeing` ones out.
    - with study-step tags whose quotes are "I like people" and "I like puzzles" (`wellbeing: false`) plus stated `areas` `['Health', 'Design']`, it returns `'I like people. I like puzzles. I'm drawn to Health and Design.'`;
    - a study-step tag with `wellbeing: true` never appears;
    - tags from other steps never appear;
    - a stated `field` "Data science" gives `"I'm drawn to Data science."`;
    - the `field` default `'Any'` or an assumed answer adds nothing;
    - nothing at all gives `''`.
  - **`actions.test.ts`** (mock `asStudent` and the repository the way `src/features/roads/server/why.test.ts` does for `roadWhyAction`; mock `./server/search` and `./server/why`):
    - **Not a student:** `findCoursesAction` for a signed-out user or a non-student is refused (the `asStudent` refusal).
    - **Not hers:** another student's roadmap id gives `{ ok: false, error: 'Not found' }`.
    - **Switch off:** with `FINDER_ON` unset it gives `{ ok: false, error: 'Not found' }`.
    - **Bad text:** empty or 301+ characters gives `{ ok: false, error: 'Tell us a bit more' }`.
    - **Limit:** after `FINDER_PER_HOUR` searches the next gives `ok: false` with an error starting `'You have searched a lot this hour'` and naming the minutes left (criterion 10).
    - **Failure:** when `searchCourses` rejects it gives `{ ok: false, error: "Couldn't search right now" }`, and `console.error` was called with no argument containing the typed text (criteria 9 and 11).
    - **Success:** `{ ok: true, result }`.
    - **The why:** `finderWhyAction` returns the template without calling the model once `whyAllowed(userId)` is false (`src/features/roads/server/why-limit.ts`).
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/finder/model/seed.test.ts src/features/finder/actions.test.ts`. Expected: FAIL.
- [ ] Step 3: implement.
  - **`seed.ts`:** pure. It reads `effective` / `isAssumed` from `src/features/opening/model/questions.ts`.
  - **`limit.ts`:** copies `src/features/roads/server/why-limit.ts`, with `FINDER_PER_HOUR`, and returns the `RateLimit` (`src/shared/lib/rate-limit.ts:8`) so the message can name the minutes.
  - **`actions.ts`** (`'use server'`, in the style of `src/features/roads/actions.ts`):
    - `findCoursesAction(roadmapId: string, text: string): Promise<ActionResult<{ result: FinderResult }>>` and `finderWhyAction(roadmapId: string, courseId: string, text: string): Promise<ActionResult<{ why: FinderWhy }>>`.
    - Each runs inside `asStudent('finder.search' | 'finder.why', …)`.
    - Ids go through `z.string().min(1).max(64)` and the text through `z.string().trim().min(1).max(300)`.
    - The roadmap must be hers (`getRoadmap(userId, id)`), and `finderOn(process.env)` must be true.
    - On a search error, call `console.error('[finder.search]', err instanceof Error ? err.name : 'error')` and nothing more.
    - Never throws.
- [ ] Step 4: run the Step 2 command. Expected: PASS.
- [ ] Step 5: commit: `feat(finder): search and why actions with a limit, refusals and quiet failure`

## Task 13: The Find sheet on the board
**Delivers:** criteria 1, 2, 3, 4, 5, 6 (display), 8, 9, 10 (display), 19 and 20 (display).
**Files:** create `src/features/finder/components/useFinder.ts`, `src/features/finder/components/useFinder.test.ts`, `src/features/finder/components/FinderPanel.tsx`; modify `src/features/road/components/RoadBoard.tsx`, `src/features/road/components/RoadBoard.test.tsx`, `src/features/road/components/ControlsBar.tsx`, `src/features/road/components/StackList.tsx`, `src/app/(app)/roadmaps/[id]/layout.tsx`, `src/app/(public)/privacy/page.tsx`. `RoadHeader.tsx` is not touched: at 1024px it has no room for another button (the dashed tag and the two actions leave about 60px for the roadmap name).
**Kind:** judgement

- [ ] Step 1: write the failing test `useFinder.test.ts`. The hook takes `search` and `why` functions shaped like the two actions; test it with `renderHook` as the repo's other hook tests do. Assertions:
  - after `run('x')` resolves with 10 hits of which 4 have `failed` non-empty, `cards.length` is 6 and `room.hits.length` is 10;
  - `why` is called once each for the first 3 cards, and never for the others or a failed hit;
  - a `why` that resolves after a new `run` is ignored (its courseId is not in the new cards);
  - `{ ok: false, error }` from `search` sets `state.error` to that string and `cards` to `[]`;
  - a `nothing-close` result sets `state.message` to `'Nothing close yet; tell us a bit more.'`.
  - **`RoadBoard.test.tsx`**, in the existing file's style (strings, counts and attributes; never elements):
    - with no `finder` prop, nothing named "Find courses" or "Find" exists (criterion 1);
    - with `finder`, pressing "Find" in the controls bar shows a textbox whose value is the seed;
    - opening Your answers while Find is open closes Find, and the reverse;
    - closing Find returns the column to the card it showed before.
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/finder/components/useFinder.test.ts src/features/road/components/RoadBoard.test.tsx`. Expected: FAIL.
- [ ] Step 3: implement.
  - **Before any markup:** read `src/design-systems/industry/DESIGN.md`, and how Your answers opens over the board (`RoadBoard.tsx:329-354` `answersPanel(place)`, `:356-378` `column()`, `:384-418` `sheet()`, `:502-507` the aside's width, `:522-539` the phone's modeless Sheet). **The finder opens the same way:**
    - **Desktop:** in the right column, widened like Your answers (`w-md`).
    - **Stacked** (36–64rem): the lower half (`@max-5xl:h-1/2`).
    - **Phone:** a modeless bottom Sheet with `answersStyles.sheet`, so the map stays live.
  - **`useFinder`:** the pure state behind the panel, described above.
  - **`RoadBoard`:**
    - A `finder?: { seed: string; search: …; why: … }` prop: the data and the two actions, not a node, because the board renders the panel in two places.
    - A `finding` state beside `answering`:
      - `column()` returns `<FinderPanel place="column" …>` while finding;
      - `sheet()` returns null while finding, so the card sheet and the Find sheet never stack;
      - the aside takes `w-md @max-5xl:h-1/2` while answering or finding;
      - opening one of Find and Your answers closes the other.
  - **The entry points:**
    - **Desktop** (from `@5xl`): a "Find courses" outline button at the top of the aside, above `column()`, hidden while answering or finding, and `@max-5xl:hidden`.
    - **Below 64rem:** a fourth `ControlsBar` item, "Find", with the Lucide `Search` icon. `grid-cols-4` when both Your answers and Find are present. At 360px each item is about 90px, and the icon sits above the caption.
    - **The more-courses list:** `StackList` gets an optional `onFind`, shown as a text button "Find courses by what you enjoy" at the top of the list.
  - **`FinderPanel`** (`'use client'`) takes `{ place, roadmapId, seed, search, why, onClose }`. Its head follows `PanelHead` (src/features/road/components/PanelHead.tsx), as the other column panels do. It holds:
    - **Search:** a textarea prefilled with `seed`, and a Search button.
    - **Cards** (the `Card` from `src/shared/components/ui/card.tsx`), each with:
      - the name, then university · city · level · years, and the fee "AUD Nk a year";
      - "match 0.71" in `text-muted-foreground`, never `primary`: small text in primary fails contrast (DESIGN.md);
      - the existing `MockTag` (src/features/road/components/MockTag.tsx) for "sample data";
      - for niche fields, a one-word "Wildcard" tag with the definition under it;
      - the why with its quote in quotation marks, or "Writing why…" while it loads.
    - **Messages:** the error or nothing-close text.
    - **"How this was found"** (a disclosure) holds the engine room. Everything stacks, one list under another; nothing sits side by side, since the column is about 332px inside its padding:
      - the query, the model and "cached";
      - search and why milliseconds;
      - all 10 hits with scores, failed ones in `text-muted-foreground` with "Fails: level", "Fails: fee" or "Fails: destination";
      - "Keyword search found" listing `keyword`, under the meaning list;
      - each why's quote.
    - Semantic tokens and text roles only. Check at 360, 390, 768, 1024, 1280, 1440 and 1920 during the smoke test. There are no design boards for these screens, so the smoke test is the only visual check.
    - **The catalogue warning:** under the sheet's title, one line in `text-caption`: "A sample catalogue for this demo: the courses are illustrative, not real offerings of these universities." Each card also keeps its "sample data" tag. The courses carry real university names, and the site is public.
  - **Privacy page:** in `src/app/(public)/privacy/page.tsx:95-97`, add "find courses from what you type" to the list of what is sent to Gemini on Vertex AI. Change nothing else on the page.
  - **`RoadBoard`:** add an optional `finder?: ReactNode` prop, passed to `RoadHeader` (rendered just before the Feed link) and to `ControlsBar` (where Feed sits when stacked). Nothing renders when it is undefined (criterion 1).
  - **`layout.tsx`:** after `details` (L66), when `finderOn(process.env) && built`, pass `finder={{ seed: finderSeedText(roadmap), search: findCoursesAction, why: finderWhyAction }}` to `RoadBoard`. Otherwise pass nothing, and no entry point renders.
- [ ] Step 4: run the Step 2 command, then `bash scripts/capped.sh bun test src/features/road` (the board's tests unchanged) and `bun run type-check`. Expected: PASS.
- [ ] Step 5: commit: `feat(finder): Find courses on the board, with the engine room`

## Task 14: Demo, negative and held-out queries, the eval, the floor and the README
**Delivers:** criteria 12, 13, 14, 15 and 21, and the fitted floor for 8.
**Files:** create `src/features/finder/model/words.ts` (`STOPWORDS`, `contentWords`; move the fake's stopword list here and import it in `embed.ts`), `src/features/finder/evals/queries.ts`, `src/features/finder/evals/queries.test.ts`, `scripts/finder-eval.ts`; modify `src/features/finder/model/config.ts` (`FINDER_FLOOR`), `package.json`, `README.md`.
**Kind:** judgement

- [ ] Step 1: write the failing test `queries.test.ts` (criterion 15). For each of `DEMO_QUERIES`, `contentWords(query.text)` shares no word with `contentWords(description)` of any `FINDER_EXTRAS` row whose `graphField` is in `query.expect`.
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/finder/evals/queries.test.ts`. Expected: FAIL (no module).
- [ ] Step 3: implement.
  - **`queries.ts`** exports `type FinderQuery = { text: string; expect: string[] /* graph field ids */ }` and:
    - **`DEMO_QUERIES`:**
      - Q1 "I like understanding why people do things, and I'm good with computers" expects `['cyber-psychology']`;
      - Q2 "I want to know why people make bad choices with money, and I'm good at maths" expects the behavioural-economics graph field id from task 2;
      - Q3 "I like drawing and I want to make apps people enjoy using" expects the human–computer interaction / UX graph field id from task 2.

      If task 2 produced no field for Q2 or Q3, stop and tell Nikhil (intent open question 3). Never add a field or edit a description to make a query pass.
    - **`NEGATIVE_QUERIES`:** "I want to build bridges" and "I love cooking", each with `notInTop3: ['cyber-psychology']`.
    - **`HELD_OUT_QUERIES`:** 20 entries written by an isolated `general-purpose` agent. Its brief:

      > Read only `src/features/roads/data/fields.ts`. Write 20 sentences a 17–25-year-old might type about what they enjoy and are good at, each pointing to one or two FIELDS ids, without using the field's name or its definition's words. Vary them: some vague, some specific, some mixing two interests. Return JSON `[{ "text", "expect": [ids] }]`.

      It must not read `docs/`, `src/features/finder/` or `scripts/`. Paste its reply verbatim, with a comment naming how it was made.
  - **`scripts/finder-eval.ts`:**
    - Env guard: a real provider and a seeded `DATABASE_URL`.
    - Run every query through `searchCourses(text, {})`.
    - Print:
      - per demo query, the top 5 (name, graphField, score);
      - per negative query, pass/fail;
      - held-out hit@3 as `N of 20`;
      - the best-score distribution for the held-out hits and for 10 nonsense strings ("asdf", "qwerty uiop", "the", "123", "zzzz", "lorem ipsum", "blue", "hmm", "ok", "...").
    - Suggest `FINDER_FLOOR` as the midpoint between the highest nonsense best score and the lowest held-out hit's best score.
    - Exit 1 unless the demo queries all pass, the negatives all pass and the held-out score is 16 or more.
    - Add `"finder:eval": "bun --conditions react-server scripts/finder-eval.ts"` to `package.json`.
  - **The floor:** run it, set `FINDER_FLOOR` to the suggestion, run it again, and record the output in `docs/course-finder/eval.md`: the date, the counts and the top 5 per demo query.
  - **README:** add a "How it scales" section (criterion 21) that says:
    - rules decide, the model explains, and code checks the model;
    - courses are found with one meaning query and one keyword query in the existing Postgres (pgvector on Cloud SQL), with an exact scan below a thousand rows and an index beyond it;
    - a production catalogue loads through a sync job (`finder:seed` re-embeds only changed rows);
    - the catalogue is generated sample data, by `scripts/finder-build.ts` from `src/features/finder/data/GENERATE.md`, because the business's catalogue is not public;
    - the held-out score from `eval.md`.

    Name no internal system.
- [ ] Step 4: run the Step 2 command (PASS), then `bun run finder:eval`. Expected: exit 0. If it exits 1, stop and report the printed results to Nikhil; do not tune the catalogue towards the queries.
- [ ] Step 5: commit: `feat(finder): demo, negative and held-out evals, fitted floor, README`

---

# PR 2: course detail (`feat/course-detail`, from `feat/course-finder`)

## Task 15: Job-market sample data
**Delivers:** criterion 24 (the data).
**Files:** create `src/features/finder/data/job-market.ts`, `src/features/finder/data/job-market.test.ts`.
**Kind:** judgement

- [ ] Step 1: write the failing tests:
  - **Coverage:** for every `OCCUPATIONS` code and every city in `FINDER_CITIES`, `jobMarketFor(code, cityId)` returns `{ openings, payLowK, payHighK }`.
  - **Values:** `openings` is a positive integer; `payLowK < payHighK`; both 40–150.
  - **No employers:** no row has a key other than `code`, `cityId`, `openings`, `payLowK` and `payHighK`, so no employer or provider can be named.
  - **Unknown:** an unknown code returns `null`.
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/finder/data/job-market.test.ts`. Expected: FAIL.
- [ ] Step 3: implement.
  - Export `JOB_MARKET: readonly JobMarketRow[]` and `jobMarketFor`, with a header comment: "Sample figures for the demo, not from any provider; shown under 'Job market (sample data)'".
  - Write the rows by hand, with these rules:
    - Sydney and Melbourne have the most openings, Hobart and Geelong the fewest;
    - security and data pay above general IT;
    - Diploma-level occupations sit lower.
  - Put the `JobMarketRow` type in `src/features/finder/model/types.ts`, next to the other finder shapes.
- [ ] Step 4: run the Step 2 command. Expected: PASS.
- [ ] Step 5: commit: `feat(finder): sample job-market figures by occupation and city`

## Task 16: Course detail on finder cards and board course cards
**Delivers:** criteria 22, 23 and 24.
**Files:** modify `src/features/finder/model/types.ts`, `src/features/finder/server/search.ts`, `src/features/finder/switch.ts` (no change, used), `src/features/roads/model/details.ts`, `src/features/road/components/CardDetails.tsx`, `src/app/(app)/roadmaps/[id]/layout.tsx`, `src/features/finder/components/FinderPanel.tsx`; create `src/features/finder/model/detail.ts`, `src/features/finder/model/detail.test.ts`, `src/features/finder/components/CourseDetail.tsx`; test `src/features/roads/model/details.test.ts` (existing).
**Kind:** judgement

- [ ] Step 1: write the failing tests.
  - **`detail.test.ts`:** `courseDetail(courseId, cityId)` returns `CourseDetailData = { fieldsNear: { name; definition }[]; jobs: { code; name; market: JobMarketRow | null }[] }`:
    - `fieldsNear` is `relatedFields(graphField)` mapped to `FIELDS` names and definitions, in `FIELD_EDGES` order;
    - `jobs` follows the extras' `occupationCodes`, with `market` from `jobMarketFor(code, cityId)`;
    - an unknown course returns null.
  - **`details.test.ts`:** `detailsByTile(spec, answers, { detail: true })`:
    - the `course` tile gains `fieldsNear` (one step from `spec.field`) and `occupations` with `market` for `spec.cityId`;
    - with `{ detail: false }` or the argument left out, every tile's details are exactly what they are today: compare `JSON.stringify` of both (criterion 22).
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/finder/model/detail.test.ts src/features/roads/model/details.test.ts`. Expected: FAIL.
- [ ] Step 3: implement.
  - **`types.ts`:**
    - Add `CourseDetailData`.
    - Add `detail?: CourseDetailData` to `FinderHit`.
    - In `src/features/roads/model/details.ts:26-38`, extend the details type with `fieldsNear?: { name: string; definition: string }[]` and `market?` on each `occupations` item. Type-only import of `JobMarketRow`.
  - **`search.ts`:** fill `detail` on each hit when `courseDetailOn(process.env)`.
  - **`details.ts`:** add an optional third argument `opts?: { detail?: boolean }`; `layout.tsx` passes `{ detail: courseDetailOn(process.env) }`.
  - **`CardDetails.tsx`:** after "Occupations it leads to", a "Job market (sample data)" section per occupation: "N openings · AUD X–Yk starting · <city>". Also a "Fields close to this one" section listing name and definition. Each uses the existing section pattern (L47-117) and footer, with the source text "OfCourse sample data".
  - **`CourseDetail.tsx`:** the same two sections for a finder card, as an expandable part of the card in `FinderPanel`.
  - No employer or provider name anywhere.
- [ ] Step 4: run the Step 2 command, then `bash scripts/capped.sh bun test src/features/road src/features/roads`. Expected: PASS.
- [ ] Step 5: commit: `feat(finder): related fields, jobs and sample job market on course cards`

---

# PR 3: what changes (`feat/course-compare`, from `feat/course-detail`)

## Task 17: Finder courses resolve as road courses, never as candidates
**Delivers:** criterion 30, and the groundwork for 26–29.
**Files:** modify `src/features/roads/data/courses.ts` (`courseById`), `src/features/roads/data/occupations.ts` (`occupationsFor`), `src/features/roads/data/subjects.ts` (`subjectsOf`); create `src/features/finder/model/road-courses.test.ts`.
**Kind:** judgement

- [ ] Step 1: write the failing tests `road-courses.test.ts`:
  - **Lookups:** `courseById(FINDER_COURSES[0].id)` returns that course; `occupationsFor(id)` returns the `OCCUPATIONS` whose codes are in its extras; `subjectsOf(id)` returns its majors and units with the sample source.
  - **Never candidates:** no `ALL_PICKS` course id starts with `f-` (criterion 30).
  - **Sound roads:** for 30 two-year finder courses (every 10th), `composeRoad({ cityId: cityOf(course).id, courseId, stays })` for `stays` true and false gives a spec that passes `expectSound(buildRoad(spec, { answers: {} }), spec)` (`src/features/roads/model/sound.test-helpers.ts:101`).
  - **Demo roads:** `match.test.ts` "the demo profiles" still passes.
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/finder/model/road-courses.test.ts`. Expected: FAIL.
- [ ] Step 3: implement.
  - **Fallbacks:** in each lookup, check the existing data first, then `FINDER_COURSES` / `FINDER_EXTRAS` (a `Map` by id built once). `ALL_PICKS` (`src/features/roads/data/candidates.ts:22-35`) keeps reading `COURSES` and `EXTRA_COURSES` only.
  - **Bundle size:** run `bun run build` before and after, and compare the "First Load JS" the build prints for `/roadmaps/[id]`. If it grows by more than 100 kB, do not ship the fallback in client code. Move the three lookups' finder branch behind a server-only module, and have `layout.tsx` and the new-roadmap page build pinned roads on the server only (they already do: `roadFor` runs in the layout). Say which way it went in the commit body.
- [ ] Step 4: run the Step 2 command, then `bash scripts/capped.sh bun test src/features/roads`. Expected: PASS.
- [ ] Step 5: commit: `feat(roads): finder courses resolve as road courses, never as candidates`

## Task 18: The comparison rows
**Delivers:** criteria 26, 27 and 28 (the logic).
**Files:** create `src/features/finder/model/compare.ts`, `src/features/finder/model/compare.test.ts`.
**Kind:** judgement

- [ ] Step 1: write the failing tests `compare.test.ts`.
  - **The function:** `compareRows(current: RoadSpec, alternative: RoadSpec | null, answers: StoredAnswers, alternativeCityId: string): CompareRow[]`. `CompareRow = { key: 'money' | 'time' | 'pr' | 'career' | 'subjects' | 'city'; label: string; current: string; alternative: string; changed: boolean }`, defined in `src/features/finder/model/types.ts`.
  - **Rows:** for the Perth demo road against `composeRoad({ cityId: 'sydney', courseId: <a Sydney two-year course of the same field>, stays: true })`, there are six rows, in order.
  - **Money:** "AUD Nk a year · AUD Mk in all · living about …", with "fits your budget" or "over your budget" by the fee rule of `failedFilters`. "Fits" is left out when no budget was stated.
  - **Time:** `workRightsLine(cityId, level, years)`.
  - **PR (criterion 28):** the alternative's `prRoute` read through `routeWord` equals `composeRoad(...)`'s `prRoute`. "Home" is shown for a road home.
  - **Career:** occupation names, plus "N openings in <city> (sample)" when job-market data exists.
  - **Subjects:** the first three majors or units.
  - **City:** name plus "counts as regional" or "not regional".
  - **No course there:** a `null` alternative (no course of her field in that city) gives course rows reading "No course of your field there in our catalogue", and city rows still compared.
  - **`changed`:** false when both sides' strings are equal.
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/finder/model/compare.test.ts`. Expected: FAIL.
- [ ] Step 3: implement `compare.ts`, pure. Its helpers:
  - `alternativeForCity(spec, altCityId)` returns the spec for the first `ALL_PICKS` pick in `altCityId` with the same `field`, `level` and `stays`, else the same `field` and `stays`, else null, via `composeRoad`;
  - `alternativeForCourse(spec, courseId)` returns `composeRoad({ cityId: cityOf(courseById(courseId)).id, courseId, stays: spec.stays })`.
- [ ] Step 4: run the Step 2 command. Expected: PASS.
- [ ] Step 5: commit: `feat(finder): what changes, row by row, from the road rules`

## Task 19: "What changes" on the board and in the finder
**Delivers:** criteria 25, 26 and 27 (display).
**Files:** modify `src/features/roads/model/details.ts` (or a new `compareByTile` beside it), `src/app/(app)/roadmaps/[id]/layout.tsx`, `src/features/road/components/CardDetails.tsx`, `src/features/finder/actions.ts`, `src/features/finder/actions.test.ts`, `src/features/finder/components/FinderPanel.tsx`; create `src/features/finder/components/WhatChanges.tsx`.
**Kind:** judgement

- [ ] Step 1: write the failing tests.
  - **`actions.test.ts`:** `compareCourseAction(roadmapId, courseId)`:
    - refuses a non-student, another student's roadmap and an unknown course (`'Not found'`);
    - refuses when `compareOn` is false;
    - for her roadmap and a finder course returns `{ ok: true, rows, pinnable }`, with `pinnable` true for a two-year course and false for a one-year course until PR 5.
  - **`compareByTile(spec, answers)`:** returns rows keyed by the alt-city and alt-course tile ids, and nothing for other tiles.
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/finder/actions.test.ts src/features/finder/model/compare.test.ts`. Expected: FAIL.
- [ ] Step 3: implement.
  - **`layout.tsx`:** when `compareOn`, compute `compareByTile` next to `details` and pass it to `RoadBoard` → `CardDetails` the way `details` travels (RoadBoard.tsx L160, L374, L412, L492).
  - **`WhatChanges`:** stacked rows, not a table: a two-column table would wrap long lines like the work-rights sentence into ragged cells in a column about 332px wide. Each row is its label (`text-overline`), then "Now: …" and "If you switch: …". Changed rows carry a one-word "Changes" tag, and unchanged rows are muted.
  - **"Start a new roadmap from it":** a link to `/roadmaps/new?from=<id>&pin=<courseId>`, shown when the alternative has a course that can be pinned.
  - **Finder cards:** a "Compare with my roadmap" button. Buttons are verbs, so not "What if I took this?". It calls `compareCourseAction` and replaces the results with `WhatChanges` under a `PanelHead` with "Back to results", the way the more-courses list opens a card.
  - With the switch off nothing renders, and the tiles' actions are as today (criterion 25).
- [ ] Step 4: run the Step 2 command, then `bash scripts/capped.sh bun test src/features/road`. Expected: PASS.
- [ ] Step 5: commit: `feat(finder): what changes on other-city and other-course tiles and found courses`

## Task 20: Pinned roadmaps
**Delivers:** criteria 29 and 30.
**Files:** modify `src/shared/types/student.ts` (`RoadmapChoices`, its zod at L213-219), `src/features/roads/model/road-for.ts`, `src/features/roads/model/road-for.test.ts`, `src/features/roadmaps/actions.ts` (`createRoadmapAction`), `src/features/roadmaps/server/roadmaps.ts` (`createRoadmap` keeps `choices`), `src/app/(app)/roadmaps/new/page.tsx`, `src/features/road/components/RoadBoard.tsx` (draft type), every `kind === 'matched' || kind === 'nearest'` reader (`src/app/(app)/roadmaps/[id]/layout.tsx:64` and any other found by `grep -rn "'nearest'" src`).
**Kind:** judgement

- [ ] Step 1: write the failing tests.
  - **`road-for.test.ts`:**
    - `roadFor({ answers, relative, pinned: { courseId, cityId } }, {})` returns `kind: 'pinned'` and `spec.courseId === courseId`;
    - `stays` follows the matched road's `stays` for her answers;
    - an unknown pinned course falls back to the matched road;
    - with `STUDENT_ROADS_OFF=1` the result is `'off'` as today.
  - **`createRoadmapAction` test** (beside the existing ones in `src/features/roadmaps`):
    - `{ fromId, answers, pinned }` stores `choices.pinned`, and the source roadmap's row is unchanged (criterion 29);
    - an unknown or one-year pinned course (until PR 5) gives `'Not found'`.
  - **`student.ts` schema test:** `choices.pinned` survives a round trip, and malformed values are dropped.
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/roads/model/road-for.test.ts src/features/roadmaps`. Expected: FAIL.
- [ ] Step 3: implement.
  - **`RoadmapChoices`:** add `pinned?: { courseId: string; cityId: string }`.
  - **`roadFor`:** gains `pinned?` on its input. When it resolves, build `composeRoad({ cityId, courseId, stays: match.spec.stays })` and return `kind: 'pinned'` with the match kept for the why. Add `'pinned'` to the `RoadFor` kind, and treat it like `'matched'` wherever `built` is computed.
  - **`roadmapRoad`** (`src/features/roads/server/roadmap-road.ts:13-22`) passes `roadmap.choices.pinned`.
  - **The new-roadmap page** reads `?pin=`, checks the course with `courseById` (two-year only until PR 5), and passes `pinned` in the draft. `RoadBoard`'s create sends it.
  - **`createRoadmapAction`** validates it and passes `choices: { pinned }` to `createRoadmap`.
  - **Rematching:** her answers changing later re-match nothing on a pinned roadmap; the pin stays.
- [ ] Step 4: run the Step 2 command, then `bash scripts/capped.sh bun test src/features/roads src/features/road src/features/roadmaps` and `bun run type-check`. Expected: PASS.
- [ ] Step 5: commit: `feat(roadmaps): start a new roadmap with a course pinned`

---

# PR 4: wider interests (`feat/wider-interests`, from `dev`)

## Task 21: Build-time study flags, and questions and fields that follow them
**Delivers:** criterion 31; the switch PR 5 also uses.
**Files:** create `src/features/opening/model/flags.ts`; modify `src/features/opening/model/questions.ts`, `src/features/opening/model/questions.test.ts`, `src/features/roads/data/fields.ts`, `src/features/roads/data/candidates.ts`, `Dockerfile`.
**Kind:** judgement

- [ ] Step 1: write the failing tests.
  - **`questions.test.ts`:**
    - `screensFor({ widerInterests: false, oneYear: false })` gives option lists for `field`, `areas`, `years` and `level` equal to today's (compare the `options` arrays as strings);
    - `SCREENS` equals `screensFor(STUDY_FLAGS)`;
    - `parseAnswerIn(screensFor(flags), key, raw)` behaves as `parseAnswer` today when both flags are off.
  - **`fields.test.ts`:** `fieldOfOption(flagsOff)` and `areaFields(flagsOff)` equal today's `FIELD_OF_OPTION` and `AREA_FIELDS`.
  - **`compose.test.ts`:** `picksFor(flagsOff)` equals today's `ALL_PICKS` (ids, in order).
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/opening/model/questions.test.ts src/features/roads/data/fields.test.ts src/features/roads/model/compose.test.ts`. Expected: FAIL.
- [ ] Step 3: implement.
  - **`flags.ts`:**

```ts
// Onboarding's build-time flags. The question model runs in the browser as well as on the server,
// so these are NEXT_PUBLIC_ variables, inlined by `next build` (node_modules/next/dist/docs/01-app/
// 02-guides/environment-variables.md:158-191): each is read by its literal name, never through a
// variable, or it is not inlined. Changing one needs a rebuild. Pure.

export type StudyFlags = { widerInterests: boolean; oneYear: boolean }

export const STUDY_FLAGS: StudyFlags = {
  widerInterests: process.env.NEXT_PUBLIC_WIDER_INTERESTS === '1',
  oneYear: process.env.NEXT_PUBLIC_ONE_YEAR === '1',
}
```

  - **`questions.ts`:** wrap the `SCREENS` literal (L113-145 and its neighbours) in `export function screensFor(flags: StudyFlags): readonly Screen[]`, then `export const SCREENS = screensFor(STUDY_FLAGS)`. Add `parseAnswerIn(screens, key, raw)`, and make `parseAnswer(key, raw)` call it with `SCREENS`. Every other export keeps its signature.
  - **`fields.ts`:** `fieldOfOption(flags)` and `areaFields(flags)`. `FIELD_OF_OPTION`, `AREA_FIELDS` and `ANSWERED_FIELDS` become their values for `STUDY_FLAGS`.
  - **`candidates.ts`:** `picksFor(flags)` and `candidatesFor(flags)`, with `ALL_PICKS = picksFor(STUDY_FLAGS)` and `ROAD_CANDIDATES = candidatesFor(STUDY_FLAGS)`, so tests can match against the flag-on candidates.
  - **`fields.test.ts`:** this branch starts from `dev`, where task 2's test file does not exist yet; create it here with only the two assertions above. The merge in task 26 keeps both sets.
  - **`Dockerfile`:** in the build stage, before `RUN bun run build` (L17), add `ARG NEXT_PUBLIC_WIDER_INTERESTS=0`, `ARG NEXT_PUBLIC_ONE_YEAR=0` and `ENV NEXT_PUBLIC_WIDER_INTERESTS=$NEXT_PUBLIC_WIDER_INTERESTS NEXT_PUBLIC_ONE_YEAR=$NEXT_PUBLIC_ONE_YEAR`. Turning a flag on for production means changing its default here and redeploying: `gcloud run deploy --source .` passes no build arguments. Say so in a comment.
- [ ] Step 4: run the Step 2 command, then `bash scripts/capped.sh bun test src/features/opening src/features/roads`. Expected: PASS, everything unchanged.
- [ ] Step 5: commit: `refactor(opening): study questions and fields follow build-time flags`

## Task 22: More field options, each with a road
**Delivers:** criteria 32 and 33; 40 under the flag.
**Files:** modify `src/features/opening/model/questions.ts`, `src/features/roads/data/fields.ts`, `src/features/roads/data/courses.ts` (`EXTRA_COURSES`, only where a field has no two-year road course in a skeleton city), `src/features/roads/data/subjects.ts` (subjects for any course added), `src/features/roads/model/match.test.ts`.
**Kind:** judgement

- [ ] Step 1: write the failing tests.
  - **Options:** with `widerInterests: true`, `field` offers today's four plus Psychology, Health, Design and Engineering, and `areas` adds Psychology. Further options wait for the intent's open question 1.
  - **A road for every option (criterion 33):** for every `field` and `areas` option under the flag, `picksFor(flagsOn)` holds a pick whose course `field` is that option's `FieldId`. For each field option, `matchRoad` for `stated({ know: PARTICULAR, field: option, level: "Master's" })`, run over the flag-on candidates, gives a road of that field.
  - **Demo roads (criterion 40):** every `DEMO_PROFILES` profile reaches its `roadId` exactly with the flag-on candidates too.
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/opening/model/questions.test.ts src/features/roads/model/match.test.ts`. Expected: FAIL.
- [ ] Step 3: implement.
  - Add the options under the flag, and `FIELD_OF_OPTION` / `AREA_FIELDS` entries for them (`psych`, `health`, `design`, `engineering`).
  - Where a field has no two-year course in a skeleton city, add one course in the shape of `courses.ts:148-171`, at an existing campus, labelled mock, with a `SUBJECTS` entry. Psychology has one catalogue course today; check its `years` and city first.
  - **The new courses go in their own array, `WIDER_COURSES`, never in `EXTRA_COURSES`.** Two readers count every `EXTRA_COURSES` row whatever the flag: `candidates.ts:22-25` (matching for everyone) and `skeletons.ts:21-24` (the city tile's "Perth · N courses"). `courseById` may look in `WIDER_COURSES` always, since a lookup changes nothing. `picksFor(flags)` and the skeleton count include it only when `flags.widerInterests`.
  - **Test that the flag off changes nothing:** `picksFor(flagsOff)` ids equal today's, and every `SKELETONS[city].slots.city.short` equals today's.
  - `matchRoad` may need its candidates passed in; it already takes `roads` (`src/features/roads/model/road-change.ts:19` passes them).
  - If a demo profile's road changes under the flag, stop and report: it must not.
- [ ] Step 4: run the Step 2 command, then `bash scripts/capped.sh bun test src/features/opening src/features/roads`. Expected: PASS.
- [ ] Step 5: commit: `feat(opening): more fields to choose from, each with a road`

---

# PR 5: one-year courses (`feat/one-year-courses`, from `feat/wider-interests`)

## Task 23: The years and level questions, and answers already stored
**Delivers:** criteria 34, 35 and 36.
**Files:** modify `src/features/opening/model/questions.ts`, `src/features/opening/model/questions.test.ts`, `src/features/roadmaps/server/roadmaps.ts` (`toRoadmap`, L57-65).
**Kind:** judgement

- [ ] Step 1: write the failing tests.
  - **Options:** with `oneYear: true`, `years` offers `['1', '2']` (label unchanged), its default is `'2'`, and `level` offers `['Diploma', "Master's"]`.
  - **`normaliseAnswers(answers, flags)`:**
    - with `oneYear` on, `years` "3" or "4 or more" becomes "2" (same `state`), and a `level` of "Bachelor's" is removed, so she is asked again: `onboardingResumePath` (src/features/opening/model/landing.ts) opens the level question for a draft without it;
    - with `oneYear` off it returns the answers unchanged.
  - **`toRoadmap`:** applies `normaliseAnswers(answers, STUDY_FLAGS)` (a test in `src/features/roadmaps/server/` beside the existing ones).
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/opening/model/questions.test.ts src/features/roadmaps`. Expected: FAIL.
- [ ] Step 3: implement.
  - The options and the default go in `screensFor` under `flags.oneYear`.
  - `normaliseAnswers` is pure, in `questions.ts`.
  - `toRoadmap` calls it once, so every reader sees normalised answers.
  - The `qual` question is not touched: Bachelor's stays a qualification she can hold.
- [ ] Step 4: run the Step 2 command. Expected: PASS.
- [ ] Step 5: commit: `feat(opening): one or two years, Diploma or Master's`

## Task 24: One-year road courses and matching by length
**Delivers:** criterion 37 (matching side); 40 under the flag.
**Files:** modify `src/features/roads/data/courses.ts`, `src/features/roads/data/subjects.ts`, `src/features/roads/data/candidates.ts` (`picksFor`), `src/features/roads/model/match.ts`, `src/features/roads/model/match.test.ts`, `src/features/roads/model/compose.test.ts` (L36-39), `src/features/road/components/MatchStrip.tsx` (the new difference's words).
**Kind:** judgement

- [ ] Step 1: write the failing tests.
  - **Picks:** with `oneYear: true`, `picksFor` includes one-year courses as home picks only (`stays: false`). With the flag off, `compose.test.ts:36-39` still holds: two-year courses only.
  - **Matching:** a profile stating `years: '1'` matches a one-year road when one exists at her level and field. With `years: '2'` it matches a two-year road. With `years` unanswered or assumed, matching is as today.
  - **The strip:** a `Difference` with key `'years'` reads "Length: 1 year · this road: 2 years".
  - **Demo roads:** every `DEMO_PROFILES` profile is unchanged with the flag on (they state no `years`).
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/roads/model/match.test.ts src/features/roads/model/compose.test.ts`. Expected: FAIL.
- [ ] Step 3: implement.
  - **Courses:** add six one-year courses, one per skeleton city (a mix of one-year Graduate Diplomas and Master's), at existing campuses, labelled mock, each with `SUBJECTS`. They go in their own array, `ONE_YEAR_COURSES`, never in `EXTRA_COURSES`, for the same reason as task 22's `WIDER_COURSES`: the skeleton count (`skeletons.ts:21-24`) reads every course at every length. `courseById` may look in it always. `picksFor` and the skeleton count include it only when `flags.oneYear`. Test that with the flag off every `SKELETONS[city].slots.city.short` is unchanged.
  - **Matching:** in `match.ts`, add a `years` rule after `level`, read only when `STUDY_FLAGS.oneYear`. Add `'years'` to `Difference.key` (L23), and its words in `MatchStrip.tsx`.
  - **`compose.test.ts:36-39`:** the two-year assertion becomes "two-year unless the one-year flag is on".
- [ ] Step 4: run `bash scripts/capped.sh bun test src/features/roads src/features/road`. Expected: PASS.
- [ ] Step 5: commit: `feat(roads): one-year courses, matched by the length she gives`

## Task 25: The one-year road shape
**Delivers:** criterion 37; prepares 38 (smoke).
**Files:** modify `src/features/roads/data/types.ts`, `src/features/roads/model/endings.ts`, `src/features/roads/model/compose.ts`, `src/features/roads/model/build.ts`, `src/features/roads/model/course-words.ts`, `src/features/roads/model/details.ts`, `src/features/roads/model/why.ts` (`WHY_SLOTS` readers), `src/features/roads/model/tile-posts.ts`, `src/features/roads/model/sound.test-helpers.ts`, `src/features/roads/model/build.test.ts`, `src/features/roads/model/compose.test.ts`; `src/features/road/model/fixture.ts` (export `gxAt`, `YU`).
**Kind:** judgement

These facts come from reading the code (fixture.ts:10-27, types.ts:60-145, build.ts:71-189, drawing.ts:75-90, phone-road.ts:102-120):
- every road today is Priya's 17 tiles at Priya's places;
- a road home renames the ending tiles but keeps the 485 and the fork;
- the map, the phone list and the plate already hide the fork when `walk.fork` is false and no tile has `branch`;
- `buildRoad` and `expectSound` assume every slot is filled.

- [ ] Step 1: write the failing tests.
  - **`build.test.ts`:** for a one-year home spec (from `composeRoad` on a task 24 one-year course with `stays: false`):
    - no tile has the id of the `visa-485`, `fork`, `pr-straight`, `pr-lane` or `pr-lane-end` slots;
    - `road.walk.fork` is false, and no tile has `branch`;
    - the home tile's `gx` is `gxAt(2028) + 0.35`, and every tile before the course keeps Priya's `gx`/`gy`;
    - the ruler's last tick is 2029;
    - `walk.ahead`, `walk.rows`, `arrival.walk.ahead` and `lesson.tileIds` name only tiles the road has;
    - the course card's text contains "One year of study alone does not open the Temporary Graduate visa (485)" and names a two-year course of the same field in that city (from `roadCoursesIn`).
  - **`compose.test.ts`:** every one-year pick under the flag passes `expectSound(road, spec)`. `expectSound` compares against the geometry for `spec.shape`: `'two-year'` (today's, unchanged for every existing road) or `'one-year-home'`.
- [ ] Step 2: run `bash scripts/capped.sh bun test src/features/roads/model/build.test.ts src/features/roads/model/compose.test.ts`. Expected: FAIL.
- [ ] Step 3: implement, following the read of the board code:
  - **`types.ts`:** `RoadSpec.shape?: 'two-year' | 'one-year-home'` (absent means two-year). The slots `visa-485`, `fork`, `pr-straight`, `pr-lane` and `pr-lane-end` become optional in the slot record's type only for that shape; keep `Record<SlotId, SlotCopy>` for two-year specs through a union.
  - **`endings.ts`:** `oneYearHomeEnding(cityId, level, twoYearCourseName)` returns only `pr-point` (Home, "From Jan 2028"), with the hint sentence and its `endRow`.
  - **`compose.ts`:** `composeRoad` uses it when `course.years === 1`, and leaves `visa-485` out of `words.slots`.
  - **`build.ts`:**
    - filter `PRIYA.tiles` to the slots the spec has;
    - place the home tile at `gxAt(2028) + 0.35` on the trunk;
    - drop absent ids from `walk`, `arrival.walk` and `lesson.tileIds`;
    - set `walk.fork = false`;
    - cut the ruler to 2027–2029 (`to: gxAt(2029.6)`);
    - skip absent slots in the `here` and `cards` loops (L134, L163) and in `slotOf` (L26);
    - drop the `fork` badge from the course.
  - **The other readers:** `course-words.ts` makes `visa-485` optional (L318) and its "Two years of units" line follows `years` (L249). `details.ts:134-148`, `why.ts` and `tile-posts.ts` skip absent slots.
  - **Drawing:** the drawing, scene, camera, swap and phone-road models need no change; leave them.
- [ ] Step 4: run `bash scripts/capped.sh bun test src/features/roads src/features/road`. Expected: PASS: every existing road's geometry is unchanged, and Priya's fixture tests are untouched.
- [ ] Step 5: commit: `feat(roads): a one-year road that ends at home and says what a second year opens`

---

# The combined branch (`test/course-finder-all`)

## Task 26: Merge every part, compare lengths, and check that the switches are independent
**Delivers:** criteria 39 and 41.
**Files:** modify `src/features/finder/model/compare.test.ts`, `src/features/finder/actions.ts` (one-year courses become pinnable), `src/app/(app)/roadmaps/new/page.tsx` (allow one-year pins).
**Kind:** judgement

- [ ] Step 1: `git checkout feat/course-compare && git checkout -b test/course-finder-all && git merge feat/one-year-courses`. Resolve conflicts, keeping both sides' behaviour. The likely files are `fields.ts`, `candidates.ts`, `compose.ts` and `courses.ts`.
- [ ] Step 2: write the failing tests.
  - **Lengths (criterion 39):** `compareRows` between a two-year road and a one-year finder course in the same city shows, in the `time` row, `workRightsLine(city, level, 1)` for the one-year side, and in the `pr` row "Home" for the one-year side.
  - **Pinnable:** `compareCourseAction` now returns `pinnable: true` for one-year courses, and a one-year pin builds a `'one-year-home'` road.
- [ ] Step 3: implement the two changes the tests ask for. Then make `oneYearHomeEnding`'s hint use `workRightsLine(cityId, level, 1)` (task 4), so the one-year sentence has one source; PR 5 was built from `dev` and wrote it as a literal.
- [ ] Step 4: run `bun run test:run`, `bun run type-check`, `bun run lint` and `bun run build`. Expected: all pass. Run `bun run test:db` only after `bun run db:dump`: it wipes the development database.
- [ ] Step 5: commit: `test: combined finder, detail, compare, interests and one-year branch`. The 41 check is a smoke step: start with every switch on, turn each one off in turn (env for the three runtime switches; `.env.local` plus a dev-server restart for the two build flags), and confirm the other parts still work.

## Integration

These tests cross a boundary and run outside the default `bun run test:run` filter:
- **Database tests by path:**
  - `src/features/finder/server/course-doc.db.test.ts` (task 7);
  - `src/features/finder/server/search.db.test.ts` (task 10, criteria 3, 4, 8, 19, 20).

  Each runs with `DB_TESTS=1 DATABASE_URL=postgres://app:app@127.0.0.1:5433/app bash scripts/capped.sh bun test <file>`. Both are added to `bun run test:db`, which wipes the dev database: `bun run db:dump` first.
- **The actions** (task 12, criteria 9, 10, 11 and the refusals; task 19; task 20) run in the unit suite with the AI provider faked and the repository mocked, as `src/features/roads/server/why.test.ts` does.
- **Live quality** (criteria 12–14): `bun run finder:eval` against a seeded database and the real embedding model. Exit 0 is the bar.

## Criteria coverage

| Criterion | Task | Test that proves it |
| --- | --- | --- |
| 1 | 1, 13 | `switch.test.ts` "are off unless set to 1"; the layout renders no `finder` when off (smoke step) |
| 2 | 12, 13 | `seed.test.ts` |
| 3 | 10, 13 | `search.db.test.ts` "meaning order"; card fields by smoke |
| 4 | 10 | `filters.test.ts`; `search.db.test.ts` "failed level" |
| 5 | 2, 10, 13 | `fields.test.ts` definitions; `definition` on niche hits in `search.db.test.ts` |
| 6 | 11, 13 | `model/why.test.ts`; `server/why.test.ts`; `useFinder.test.ts` "why for the first 3 cards" |
| 7 | 14 | Not automatable: a timing on the deployed, warm revision; smoke step with the measured times |
| 8 | 10, 14 | `search.db.test.ts` "nothing close"; floor fitted by `finder:eval` |
| 9 | 12, 13 | `actions.test.ts` "search rejects"; `useFinder.test.ts` error state |
| 10 | 12 | `actions.test.ts` "limit" |
| 11 | 6, 12 | `actions.test.ts` "console.error without the text"; `ai_call` holds no text (existing schema) |
| 12 | 14 | `bun run finder:eval` (demo queries) |
| 13 | 14 | `bun run finder:eval` (negatives) |
| 14 | 14 | `bun run finder:eval` (held-out ≥ 16); README states it |
| 15 | 14 | `queries.test.ts` |
| 16 | 3, 8 | `schema.test.ts`; `catalogue.test.ts` |
| 17 | 4, 5 | `occupations.test.ts`; `build.test.ts` "rules" |
| 18 | 8 | `dedupe.test.ts`; the build's printed count |
| 19 | 10, 13 | `search.db.test.ts` (hits, failed, cached); `useFinder.test.ts` "room has all 10" |
| 20 | 10 | `search.db.test.ts` "keyword" |
| 21 | 14 | Not automatable: README text, read at review |
| 22 | 16 | `details.test.ts` "unchanged without detail" |
| 23 | 16 | `detail.test.ts`; `details.test.ts` "course tile gains fieldsNear and occupations" |
| 24 | 15, 16 | `job-market.test.ts`; `details.test.ts` market |
| 25 | 19 | `actions.test.ts` "refuses when compareOn is false"; tiles unchanged by smoke |
| 26 | 18, 19 | `compare.test.ts` six rows; `compareByTile` test |
| 27 | 19 | `actions.test.ts` `compareCourseAction` |
| 28 | 18 | `compare.test.ts` "PR row equals the road's" |
| 29 | 20 | `road-for.test.ts` pinned; `createRoadmapAction` test "source unchanged" |
| 30 | 17, 20 | `road-courses.test.ts` "no ALL_PICKS id starts with f-" |
| 31 | 21 | `questions.test.ts` "flags off equals today" |
| 32 | 22 | `questions.test.ts` options |
| 33 | 22 | `match.test.ts` "a road for every option" |
| 34 | 23 | `questions.test.ts` "oneYear off unchanged" |
| 35 | 23 | `questions.test.ts` `normaliseAnswers` years |
| 36 | 23 | `questions.test.ts` `normaliseAnswers` level |
| 37 | 24, 25 | `match.test.ts` years rule; `build.test.ts` one-year shape |
| 38 | 25 | Not automatable: label overlap at ten widths, checked in the smoke test |
| 39 | 26 | `compare.test.ts` "one year against two" |
| 40 | 2, 17, 22, 24 | `match.test.ts` "the demo profiles", flags off and on |
| 41 | 1, 21, 26 | `switch.test.ts`; `questions.test.ts` flag variants; smoke step in task 26 |
