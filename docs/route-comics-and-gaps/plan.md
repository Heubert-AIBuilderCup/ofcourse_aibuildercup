# Turn a path into a story comic, and see which paths need one · Implementation Plan

**Intent:** docs/route-comics-and-gaps/intent.md
**Goal:** An editor turns a catalogue path into a reviewed, published story comic through a storyboard they shape before any image is drawn, an Insights tab ranks the paths students are shown by whether they have a comic, and feed-post covers gain the same plan-first step.
**Approach:** A comic is a feed post, so review, publishing, the feed, the public page, slugs, history and the Instagram export come for free.
- **Its source is a path.** It has a `source` record of kind `path` and a `facts` record that code builds from the catalogue: one fact per catalogue line, frozen in the record. It has a `comic` template (3 to 6 panel slides, each an art box above a caption) and a new `course_id` on `content_post` that names its path.
- **The storyboard is the drafts record.** A slide gains an optional `scene` (the planned art in words). Gemini writes one story; the editor edits captions and scenes on the slide previews, where the art area shows the scene in words, and adds, removes or reorders panels. Approving the storyboard is the existing approve gate.
- **"Draw panels" replaces the single render art.** It draws one image per panel, with the approved character sheet and the Comics page's style images as references, into a render that carries per-panel art.
- **Feed-post covers** gain a `cover_plan` record: three planned scenes, editable, drawn only on "Approve and make covers".
- **Counting.** Path views go into an anonymous `path_view` table through one function Jenish calls from `/futures`. Insights ranks them, with labelled mock counts until real ones build up.

**Test layers:** Unit plus integration (database).
- **Unit** (`bun run test:run`, bun test with happy-dom) holds the decisions: path facts from the catalogue, the caption rules (numbers must be catalogue facts, no outcome promises), the panel add/remove/reorder limits, per-panel art in the SVG, the planned scene drawn in the preview's art area, the new prompt specs and their fake answers, the ranking with its mock labels and comic status, the viewer key, the action refusals (session mocked as in `src/features/content/actions.test.ts:25-60`), and the nav entry.
- **Database** (`DB_TESTS=1 DATABASE_URL=… bun test <file>`; every new DB file is added to `test:db` in package.json:17). RC1–RC4, RC6, RC7, RC9–RC13, RC15 and RC16 persist records, pointers, the character sheet, views or live comics, so these tests prove them:
  - the comic commands, through the fake provider, in a new `server/comics.test.ts`;
  - the cover plans, in `server/commands.test.ts`;
  - the character, in `server/character.test.ts`;
  - the views, in `src/features/insights/server/views.test.ts`;
  - the live-comic lookup.
- **Refusals.** Every new access path has one: "New comic", the storyboard edits, the character actions and "Draw panels" refuse a non-editor (`canEdit`, `src/shared/lib/auth/access.ts:154`). "Make comic" on Insights shows only for editors. The character sheet image is served only through the admin asset route, which already refuses a student (`src/features/content/routes.test.ts`).
- **Not tested by code.** What shows only on screen (the storyboard view, the panels view, the Insights table's look, the comic in the feed on a phone) is proven by its smoke-test step.
- **No new setup.** Both layers exist in this repo, so none is installed.

**Constraints:**
- `bun install` (Bun only; npm/pnpm/yarn are refused)
- Never commit or push without explicit approval. Squash micro-commits into one semantic commit. Never add co-author text to commit messages.
- Conventional Commits (`type(scope?): description`), enforced by .husky/commit-msg.
- pre-commit runs lint-staged and type-check; pre-push runs the tests and the build.
- Never start a dev server for the user; they run it.
- Access rules live in one pure module, src/shared/lib/auth/access.ts; pages and actions call it, the proxy only checks the cookie.
- Server actions return `ActionResult` (src/shared/types/action-result.ts) and never throw.
- Tailwind 4 is CSS-first (src/app/globals.css): semantic tokens only, no @apply, OKLCH colours, rem not px.
- The active design system is Industry: read src/design-systems/industry/DESIGN.md before any UI work.
- Read node_modules/next/dist/docs before writing Next.js code (see AGENTS.md).
- `bun run test:run` — Test the brain, not the beauty: unit tests pin logic, hooks, actions and components with behaviour (test-first); pages, layouts, styles and presentational pieces get none.
- `bun run test:db` — **wipes the development database**: never run it on this branch's build; run DB files by path against a separate database (`app_comics`, created with `docker compose exec -T db psql -U app -d postgres -c "create database app_comics"` and migrated with `DATABASE_URL=postgres://app:app@127.0.0.1:5433/app_comics bun scripts/migrate.ts`).
- `bun run test:e2e` — run only when someone asks for it: this plan adds no browser specs.
- For this branch: the fake provider only in tests, never call Vertex; Jenish's files (`src/features/engine/*`, `src/features/opening/*`, `src/app/(app)/*`) are read, never changed; migrations by `bun run db:generate` and `bun run db:migrate`, never `db:reset`.

## Branches (decided by Nikhil, 12 Oct 2026)
Three branches, stacked so each can be reviewed alone and the last one holds all three for one test session:
1. `feat/route-comics` from `feat/submission-readiness`: Tasks 1–10, 14, 15.
2. `feat/cover-plans` from `feat/route-comics`: Task 11.
3. `feat/route-insights` from `feat/cover-plans`: Tasks 12–13. Smoke-test everything on this one.

So each branch carries only its own schema, Task 1's `cover_plan` pieces (the kind, the body, the pointer, the `current()` link) move into Task 11, and the `path_view` table moves into Task 12. Each has its own migration. Before the build, cut branch 1 from the refined `feat/submission-readiness`.

**After story 14 of the feed-post slice (12 Oct 2026, Tasks 60–63 of `docs/admin-feed-post-from-source/plan.md`):**
- **What "live" means for a comic.** Students read a post's published approval (`content_post.published_approval_id`), not its stage. So in Task 13 `comicStatuses` counts a comic as `live` when it has a published approval and is unexpired, and in Task 14 `liveComicCovers` reads published comics through `readLive`.
- **Going back works on comics too.** In Task 7, "Back to source" on a comic opens its path, premise and emotion: changing them and saving remakes the storyboard (`makeComic`'s story step on the existing post), and "Continue" keeps it. In Task 9, "Back to text versions" from the panels returns to the storyboard, and the drawn panels are reused when the approved storyboard is unchanged (the covers rule of Task 61, applied to `panels`).
- **The panels step** follows the same pattern as other steps: read-only once passed, with its "Back to…" in its header.

## Revisions, 13 Oct 2026 (read before any task; they override the task text where they differ)

Since this plan was written, guided post design, story 14, stories 9 and 10, and blogs were built (`docs/guided-post-design/`, `docs/blogs-and-research/`). Build comics on that code.

**Branches and migrations**
- **Branches:** `feat/route-comics` is cut from `feat/blogs-and-research`, and `feat/route-insights` from `feat/route-comics`.
- **Task 11 (cover plans) is dropped:** planning pictures in words (GD12, `art_plan`) already does it for every look post.
- **Migrations:** comics uses 0014 for `course_id` and `comic_character`. Insights uses 0015 for `path_view`, made in Task 12.

**What comics reuse from the built code**
- **Per-slide art exists.**
  - Task 1's `panels` on the render is replaced by `slideArt` (`SlideArt`, `model/types.ts`).
  - Task 4 does not touch `svgSlides` (its `arts` already exist): it adds only the Comics brand, the comic template and `DEFAULT_COMIC_STYLE`.
  - The planned scene in the art area exists (`planned`), and so does the `scene` field on a slide if Task 1 of guided design added it. Otherwise add `scene` as Task 1 here says.
- **The comic template** is a look-style template (`look: true` with `layouts`), so the frame, surfaces, tint and presets apply. Panels use one `panel` layout (art box over caption), and the template's caption slot is its body.
- **Drawing panels (Task 9) reuses `server/commands/images.ts`:** planning (the storyboard's scenes become the `art_plan` scenes with no model call), drawing with progress and resume, retry, "New picture", "Edit scene", nudges, and keeping unchanged pictures. It adds only the character sheet as the first reference image, and the refusal "Approve the comic character first." `drawPanels` and `redrawPanel` become thin wrappers or are not needed: say which.
- **Steps:** a comic's steps are Source (path, premise, emotion), Text (the storyboard), Images (panels), Settings, Review and Live (`lib/steps.ts`). Every step is editable in place (GD28), with the side-by-side layout (GD30). Task 7's `StoryboardStep` follows the chosen-version editor's layout.
- **Edit history:** Task 6's `makeComic` writes a source of kind `path`, as planned. Going back to Source and changing the path, premise or emotion remakes the storyboard.

**Unchanged:** the character (Task 8), publishing and the Comics page (Task 10), the Insights tab and counting (Tasks 12–13), and the futures-card component (Task 14). `published_approval_id` is the "live" test for comics, as the 12 Oct note above says.

## Files
| Path | Create or modify | Responsibility |
| --- | --- | --- |
| src/shared/lib/db/schema.ts, src/shared/lib/db/content-shapes.ts, migration 0014 | modify, create (Task 1) | `content_post.course_id`, the `cover_plan` kind, `comic_character`, `path_view` |
| src/features/content/model/types.ts, model/artifacts.ts, model/current.ts (+ tests) | modify (Task 1) | `scene` on a slide, `panels` on a render, the `cover_plan` body and its link |
| src/features/content/lib/path-facts.ts (+ test) | create (Task 2) | a path's label and facts from the catalogue: **the one definition of `Path`, `PATHS`, `pathById`, `pathFacts`** |
| src/features/content/lib/comic-rules.ts (+ test) | create (Task 3) | caption refusals, panel limits: **`COMIC_PANELS`, `comicCaptionError`, `panelOpsError`** |
| src/features/content/brands/comics.json, brands/index.ts, templates/comic.json, templates/index.ts, layout/svg.ts, server/preview.ts (+ tests) | create, modify (Task 4) | the Comics page brand, the comic template, per-panel art, the planned scene in the art area: **`COMICS_BRAND_ID`, `COMIC_TEMPLATE_ID`, `DEFAULT_COMIC_STYLE`** |
| src/features/content/ai/comic.ts, ai/prompts.ts, ai/config.ts, ai/fake.ts (+ tests) | create, modify (Task 5) | the `COMIC_STORY` spec and `draftStory` |
| src/features/content/server/commands/comic.ts, comic-actions.ts, src/app/admin/(console)/comics/new/page.tsx, components/NewComicForm.tsx, components/Board.tsx (+ tests) | create, modify (Task 6) | "New comic" → a comic post at its storyboard |
| server/commands/comic.ts, lib/workflow.ts, components/StoryboardStep.tsx, components/EditableSlidePreview.tsx, components/Workbench.tsx (+ tests) | modify, create (Task 7) | editing the storyboard, the approve gate |
| src/features/content/server/character.ts, ai/character.ts, src/app/admin/(console)/comics/character/page.tsx, components/CharacterStudio.tsx, comic-actions.ts (+ tests) | create (Task 8) | the character sheet: plan, draw, redraw, approve |
| server/commands/comic.ts, ai/art.ts, components/PanelsStep.tsx, lib/workflow.ts (+ tests) | modify, create (Task 9) | draw, redraw and draw-remaining panels |
| server/social.ts, components/LivePanel (where adapt is offered), lib/feed tags on comic creation (+ tests) | modify (Task 10) | comics in the feed and public pages; Instagram for the Comics page only |
| ai/art.ts, ai/prompts.ts, ai/fake.ts, server/commands/render.ts, components/steps/RenderStep.tsx (+ tests) | modify (Task 11) | plan-first covers for feed posts |
| src/features/insights/server/views.ts, src/features/insights/lib/viewer-key.ts, src/features/insights/index.ts (+ tests) | create (Task 12) | counting the paths shown: **`recordPathViews`** |
| src/features/insights/lib/rank.ts, insights/mock-views.json, insights/components/InsightsTable.tsx, src/app/admin/(console)/insights/page.tsx, src/features/admin/lib/nav.ts (+ tests) | create, modify (Task 13) | the Insights tab |
| src/features/content/server/store.ts (`liveComicCovers`), components/ComicCoverLink.tsx, docs/route-comics-and-gaps/for-jenish.md (+ DB test) | modify, create (Task 14) | the comic on a futures card |
| scripts/ai-smoke.ts | modify (Task 15) | live one-call checks for the new specs |

## Task 1: The records a comic, a cover plan, a character and a view need
**Delivers:** the storage under RC2, RC6, RC9, RC11, RC12 (proven with them in later tasks).
**Files:** modify `src/shared/lib/db/schema.ts`, `src/shared/lib/db/content-shapes.ts`, `src/features/content/model/types.ts`, `model/artifacts.ts`, `model/current.ts`; create migration `src/shared/lib/db/migrations/0014_*.sql` by `bun run db:generate`; tests in `model/artifacts.test.ts` (or the file that already parses `BODIES`), `model/current.test.ts`, `server/schema.test.ts` (DB).
**Kind:** judgement
- **`content_post.course_id`** `text` null, with an index. It holds the path a comic tells (a catalogue course id, Task 2); null on every other post. Expose it as `courseId: string | null` wherever a post row is read (`loadPost`, `listCards`, `readLive`'s `FeedPost`: follow how `slug` is carried, `server/store.ts:179`, `:480`, `:700`).
- **Artifact kind `cover_plan`** is added to `ARTIFACT_KINDS` (`content-shapes.ts:22-40`). The migration re-creates the kind check, as `migrations/0004_content_artifact_covers.sql` does. `BODIES.cover_plan = z.object({ revisionId: id, scenes: z.array(z.string().min(1).max(200)).length(3), idea: z.string().nullable() })`. `PointersSchema` gains `coverPlanId: ref.default(null)` (follow `coversId`, `content-shapes.ts`). `current()` keeps the plan only while `body.revisionId === revision.id` (the covers rule, `model/current.ts:53`).
- **`SlideSchema`** (`types.ts:39`) gains `scene: z.string().max(300).nullable().default(null)`: the planned art in words. Stored structures without it parse as null.
- **`BODIES.render`** (`artifacts.ts:92`) gains optional `panels: z.array(z.object({ assetId: z.string().nullable(), scene: z.string(), note: z.string().nullable(), take: z.number().int().nonnegative(), fallback: z.enum(['no_art', 'daily_limit']).nullable() })).optional()`. This is one entry per slide, in slide order. A render without it keeps the single `art` as today.
- **Table `comic_character`**:
  - `brand_id text primary key`, `description text not null`, `views jsonb not null` (an array of `{ label: string, scene: string }`);
  - `sheet_asset_id text null` (the latest drawn sheet), `sheet_note text null`;
  - `approved_asset_id text null`, `approved_by text null` (references `user.id`), `approved_at timestamptz null`;
  - `updated_by text not null`, `updated_at timestamptz not null`.
  - Follow `pageStyle`, `schema.ts:337-345`, with the `tz()` helper at `:34`.
- **Table `path_view`**: `day date not null`, `course_id text not null`, `viewer_key text not null`, primary key `(day, course_id, viewer_key)`, plus an index on `(day)`. It has no user reference, by design (RC12).
- Run `bun run db:generate` and check that the SQL has the kind check re-created, the column, both tables and nothing else. Apply it to `app_comics` (see Constraints).
- **Unit tests:**
  - a stored `source`, `drafts`, `revision` and `render` body from before this change parses, with `scene` null and no `panels`;
  - a `cover_plan` with 2 scenes fails, and one with 3 passes;
  - `current()` drops a cover plan whose `revisionId` is an older revision.
- **DB test** (`server/schema.test.ts`, which already uses `failureOf` at `:21`): inserting a `cover_plan` artifact succeeds; an unknown kind still fails; a second `path_view` row with the same day, course and key fails (primary key).
- Commit `feat(content): records for comics, cover plans, the comic character and path views`.

## Task 2: A path's facts, from the catalogue
**Delivers:** RC2 (the facts a story is built from); the frozen-facts edge case.
**Files:** create `src/features/content/lib/path-facts.ts`, `lib/path-facts.test.ts`.
**Kind:** judgement
- **Import only from `@/features/engine`**: `COURSES`, `CITIES`, `cityOf` (barrel `src/features/engine/index.ts:4-13`). Do not edit Jenish's files. Type a course as `(typeof COURSES)[number]`.
- **The interface** (the one definition; Tasks 6, 12, 13 and 14 import it):
  - `type Path = { id: string; label: string; city: string; course: string; university: string }`. `id` is the course id, since each course has exactly one city (`cityOf`, `catalogue.ts:804`). `label` is ``${city.name} · ${course.name}, ${course.university}``.
  - `PATHS: readonly Path[]`, in catalogue order.
  - `pathById(id: string): Path | null`.
  - `pathFacts(id: string): { title: string; paragraphs: { ref: string; text: string }[]; facts: Fact[] } | null`. `Fact` is from `model/types.ts:16`.
- **`pathFacts`** writes one plain sentence per catalogue line, each its own paragraph (`¶1`, `¶2`, …):
  - the city and whether it is regional (`regional`);
  - the university and course name;
  - the years;
  - the fee (`feeClaim`'s text, `catalogue.ts:323-328`);
  - living cost (`livingK` as "Living costs about AUD <n>k a year", plus the city's `location.text`);
  - the PR road (`course.route`, and `lines.pr.text`);
  - work rights (`lines.work.text`);
  - career (`lines.career.text`);
  - time (`lines.time.text`).
- **Each fact:**
  - `{ id: 'f<n>', text: sentence, quote: sentence, ref: '¶<n>', sentenceId: '¶<n>.1', supported: true, why: null, span: null }`;
  - `value`: the first number in the sentence with its unit via `numbersIn` (`text/numbers.ts:132`), else null.
- **Unit tests:**
  - `PATHS.length === COURSES.length`, and every id is a course id;
  - `pathFacts('ecu-cyber')` holds a fact whose text contains the course's fee in thousands, and one naming Perth;
  - every fact's `quote === text`, and its `ref` exists in `paragraphs`;
  - an unknown id gives null;
  - the result is deterministic (two calls are deep-equal).
- Commit `feat(content): a path's facts from the catalogue`.

## Task 3: Caption rules and panel limits
**Delivers:** RC3 (3 to 6), RC4, RC5.
**Files:** create `src/features/content/lib/comic-rules.ts`, `lib/comic-rules.test.ts`; modify `src/features/content/text/lint.ts` (+ its test) only to add `outcomePromises` beside `BANNED_PHRASES` (`text/lint.ts:3`).
**Kind:** judgement
- **The interface** (the one definition; Tasks 5, 7 and 9 import it):
  - `COMIC_PANELS = { min: 3, max: 6 } as const`.
  - `outcomePromises(text: string): string[]` in `text/lint.ts`. It finds, case-insensitively and on word boundaries: "you will get", "you'll get", "you will be", "guaranteed", "guarantee", "definitely", "for sure", "100%", "certain to", "you will", "you'll". It returns each phrase as written in the text, the longest match first, so "You will get" wins over "You will".
  - `comicCaptionError(text: string, facts: Fact[]): string | null`. The checks run in this order:
    - an outcome promise: `Remove "<phrase>": a comic never promises an outcome.`;
    - a banned phrase (`bannedPhrases`, `text/lint.ts:31`): `Remove "<phrase>".`;
    - a number no fact holds: `<number> is not a fact of this path.` for the first such number. Compare through `numbersIn` on both sides, the way `missingNumbers` does (`text/numbers.ts:167`), so "AUD 30k" in a caption matches "AUD 30k" in a fact;
    - otherwise null.
  - `type PanelOp = { kind: 'add'; after: number } | { kind: 'remove'; at: number } | { kind: 'move'; at: number; to: number }`.
  - `panelOpsError(count: number, op: PanelOp): string | null`:
    - `A comic has at least 3 panels.` when removing at 3;
    - `A comic has at most 6 panels.` when adding at 6;
    - `No such panel.` for an index out of range.
  - `applyPanelOp<T>(slides: T[], op: PanelOp, blank: T): T[]`, pure.
- **Unit tests:**
  - "You will get PR after two years" refuses, naming "You will get";
  - "Guaranteed work" refuses;
  - "Rent felt lighter than in Sydney" passes;
  - "about AUD 30k a year" passes against a fact holding it, and "about AUD 31k" refuses, naming it;
  - a caption with no number passes;
  - remove at 3 and add at 6 refuse;
  - `move` keeps every element;
  - `add` after the last appends the blank.
- Commit `feat(content): comic caption rules and panel limits`.

## Task 4: The Comics page, the comic template, per-panel art, the planned scene in the art area
**Delivers:** RC8 (the Comics page on Page styles), the drawing side of RC2 (captions laid out where they will be drawn, the scene in the art area), RC6 (each panel its own art), RC7 (the search line on the last panel).
**Files:** create `src/features/content/brands/comics.json`, `templates/comic.json`; modify `brands/index.ts` (+ `brands.test.ts`), `templates/index.ts` (+ `templates.test.ts`), `layout/svg.ts` (+ test), `server/preview.ts` (+ test), `src/app/admin/(console)/posts/[id]/preview/route.ts` (only if the query needs nothing new: it should not).
**Kind:** judgement
- **`comics.json`**:
  - `id: "comics"`, `name: "OfCourse Comics"`, `kind: "page"`;
  - the fonts and themes of `main.json`, a tone line for comics;
  - `instagram: { handle: "ofcourse_comics", url: "https://www.instagram.com/ofcourse_comics/" }` (a placeholder: intent open question 1).
- **`brands/index.ts`** exports `COMICS_BRAND_ID = 'comics'` and adds the brand to `PAGE_BRANDS` (`:13`), so the Page styles screen lists it with no change there (RC8). It does not go into `pages/pages.json`: no theme sends a feed post to it.
- **`DEFAULT_COMIC_STYLE`** (exported from `brands/index.ts`): "Warm hand-drawn graphic-novel style, clean ink lines, soft flat colours, natural light, expressive faces". It is used when the Comics page has no design language (intent open question 2).
- **`templates/comic.json`**: `id: "comic"`, `format: "carousel"`, canvas 1080×1350, two slide entries.
  - The first entry: `spec.kind: "cover"`, `repeat {min 1, max 1}`.
  - The second entry: `spec.kind: "body"`, `repeat {min 2, max 5}`. Together that is 3 to 6 panels, matching `COMIC_PANELS` (Task 3).
  - Each spec: `artBox {x 0, y 0, w 1080, h 1080}` and one slot `caption`: `factual: false`, `presentational: false`, limit chars 1–140, font body, `fontPx` 44, `lineHeight` 1.25, box below the art (x 72, y 1104, w 936, h 150), mark none; `sourceLine: false`.
  - The search line (`SEARCH_LINE`, `layout/engine.ts:38`) is added by the engine on the last slide. Leave room for it below the caption box; a 140-character caption plus the line for a 60-character title must pass `fitChecks` (`layout/fit.ts:22`).
  - Export `COMIC_TEMPLATE_ID = 'comic'` from `templates/index.ts`. Keep it **out of `TEMPLATES`** (`:12`), so "Make post" never offers it. `templateById('comic')` (`:25`) still finds it, as it finds `QUOTE_CARD` (`:23`).
- **Per-panel art in `svgSlides`** (`layout/svg.ts:72`): today one `art` data URI fills every slide's art box (`:99-104`). Add an optional `arts?: (string | null)[]`, indexed by slide. When given, slide i uses `arts[i]` (null draws the empty art box as today with no art). When absent, behaviour is unchanged. `renderSlides` and `draw()` (`layout/render.ts:16`, `server/commands/shared.ts:193`) pass it through.
- **The planned scene in the art area**: when a slide is previewed without art and has a `scene` (Task 1), the preview draws the words "Planned scene" (overline) and the scene text inside the art box, wrapped, in the body font at the legibility floor or larger (`LEGIBILITY_FLOOR_PX`, `engine.ts:20`), on a muted fill. Add `planned?: string | null` to `draftPreviewPng`, `layoutPreviewPng` (`server/preview.ts:46`, `:76`) and the SVG builder. The draft preview reads it from the slide's `scene`. Task 11 passes a cover plan's scene for a feed post's cover.
- **Unit tests:**
  - `brandById('comics')` exists and is a page brand;
  - `TEMPLATES` has no `comic`, and `templateById('comic')` returns it;
  - a comic structure with 3 and with 6 panels lays out and passes `fitChecks` with a 140-character caption and a 60-character title (the search line on the last slide);
  - `svgSlides` with `arts: [a, null, b]` puts `a` in slide 1, nothing in slide 2 and `b` in slide 3;
  - a draft preview of a slide with a scene contains the scene text, and one without a scene does not.
- Commit `feat(content): the Comics page, the comic template and per-panel art`.

## Task 5: Gemini writes the story
**Delivers:** RC2.
**Files:** create `src/features/content/ai/comic.ts`, `ai/comic.test.ts`; modify `ai/prompts.ts` (a `COMIC_STORY` spec), `ai/config.ts` (`UseCase` gains `'comic_story'`, `:5-14`), `ai/fake.ts` (a `FAKE_ANSWERS.comic_story` entry, `:73`), `ai/fake.test.ts`.
**Kind:** judgement
- **`COMIC_STORY`** is a `PromptSpec` (`prompts.ts:8`): use case `comic_story`, version `comic_story.v1`, tier `flash`, temperature 0.8.
  - Model-facing schema: `{ title: string, panels: [{ caption: string, scene: string }] }`. Give no list lengths: the schema guard drops them (`ai/schema-guard.ts`), and the rules state 3 to 6.
  - **Rules:**
    - a short story about one student's life on this path;
    - one gender-neutral character called "the student", aged 20–24;
    - 3 to 6 panels;
    - each caption is at most 140 characters, plain words, written as the student's experience;
    - no exact figures unless a fact holds them, and then exactly as the fact writes them;
    - never promise an outcome ("you will get", "guaranteed");
    - each scene is at most 300 characters, describing what is seen (place, action, light), with no words, letters, numbers, logos or brand names in the picture;
    - the title is at most 60 characters.
  - `example`: a Perth path with a 4-panel answer that passes the rules.
  - `instruction`: the `buildPrompt` pattern (`prompts.ts:43`).
- **`draftStory(input, deps)`** in `ai/comic.ts`:
  - `input = { path: Path, facts: Fact[], premise: string | null, emotion: { label: string; tone: string } | null, postId: string }`, with `Path` from Task 2.
  - It returns `{ ok: true; title: string; structure: Structure } | { ok: false; error: string }`.
  - It calls `ai.generateJson(COMIC_STORY, { data, postId, verify })` (`client.ts:251`). `data` holds the path label, the facts (`id` and `text`), the premise and the emotion. `verify` returns problems for:
    - fewer than 3 or more than 6 panels;
    - a caption over 140 characters, or one `comicCaptionError` (Task 3) refuses;
    - a scene `artPromptError` (`ai/draft.ts:51`) refuses;
    - an empty title.
    The ladder retries with these problems (`ai/client.ts:106`).
  - The structure: `templateId: 'comic'`; slide 1 `kind 'cover'`, the rest `kind 'body'`; each slide `{ slots: { caption: { text, factIds: [], factual: false } }, scene }`; `artPrompt` set to the first panel's scene (at most 400 characters).
- **The fake answer** builds a 4-panel story from `data` (the path label in the first caption, no numbers) and honours the `[fake:fail-comic_story]` and `[fake:bad-comic_story]` markers in the premise (`ai/fake.ts:3-9`).
- **Unit tests** (fake provider, as `ai/draft.test.ts` does):
  - `COMIC_STORY.schema.safeParse(COMIC_STORY.example.answer)` succeeds;
  - `draftStory` returns 4 panels with scenes and template `comic`;
  - an answer with 7 panels, then a good one, ends with the good one (the retry carries the problem);
  - an answer whose caption says "guaranteed" is retried;
  - the data sent carries the premise and the emotion's tone;
  - a failing provider returns `{ ok: false }`.
- Commit `feat(content): Gemini drafts a comic story from a path`.

## Task 6: "New comic" makes a comic post at its storyboard
**Delivers:** RC1, RC2 (end to end, persisted), the frozen-facts edge case.
**Files:** create `src/features/content/server/commands/comic.ts`, `server/comics.test.ts` (DB), `src/features/content/comic-actions.ts`, `comic-actions.test.ts`, `src/app/admin/(console)/comics/new/page.tsx`, `components/NewComicForm.tsx`, `components/NewComicForm.test.tsx`; modify `components/Board.tsx` (a "New comic" button beside "New post" and a "Comic character" link beside "Page styles", `Board.tsx:45`), `package.json` (`test:db` list gains `src/features/content/server/comics.test.ts`).
**Kind:** judgement
- **`makeComic(actor: Actor, input: { courseId: string; premise: string | null; emotion: string | null; requestId: string }): Promise<ActionResult<{ id: string }>>`**:
  - **Refusals, before any call:**
    - a non-editor gets `WORKFLOW_ERRORS.notAuthorised` (the `makePost` rule, `server/commands/source.ts:107`);
    - an unknown course gets `Choose a path.`;
    - a premise over 120 characters gets `Keep the premise to 120 characters.`;
    - an emotion is checked by `emotionError` (`emotions/index.ts`);
    - a premise `artPromptError` refuses gets its message (the premise reaches the scene prompts).
  - **Then, following `makePost`'s order** (`server/commands/source.ts`):
    1. insert a `feed` post with `course_id` set, title "Comic: <path label>", stage `structures`, and pointers with `pageBrandId: 'comics'`;
    2. put a `source` record: `kind: 'path'`, `title` the path label, `text` the paragraphs joined, `paragraphs` and `demoKey: null`;
    3. put a `facts` record from `pathFacts` (Task 2): `keyIdeas: []`, `replays: []`. These records freeze the facts, whatever the catalogue later says;
    4. under `runStep(postId, 'draft', …)` (`server/steps.ts:93`), call `draftStory` (Task 5) and put a `drafts` record: one item `{ structure, template: templateById('comic'), angle: 'Story' }`, the emotion, note `Storyboard drafted`;
    5. save pointers with `draftsId`, `ticked: ['comic']`, `picked: 0`, `themeId` set to the Comics brand's first theme (the approve gate needs one, `lib/workflow.ts:168`), and the post's title set to the story's title (`savePointers` takes `title`, `store.ts:384`; the search line and the slug use it);
    6. put a `settings` record with `tags: ['destination:AU']` (every catalogue path is in Australia), so the feed's destination chip matches it (RC15), with the rest of the settings at their defaults (follow where a post's first settings record is made).
  - A failed story keeps the post, source and facts, and returns `{ ok: true, id }`. The workbench then shows "Try again" on the storyboard (the existing failed-draft state).
- **`makeComicAction(input: unknown)`** in `comic-actions.ts` (`'use server'`; the `asActor` pattern of `page-style-actions.ts:33`) zod-parses, calls `makeComic`, revalidates `/admin/board`, and returns `ActionResult<{ id }>`.
- **The page** `/admin/comics/new` (editors only: `requireBoard()` then `canEdit` or `redirect(BOARD_PATH)`, as `posts/new/page.tsx:13-14`) shows `NewComicForm`, with `PATHS` (Task 2) and `EMOTIONS` as props. It preselects the path from `?path=<courseId>` when that is a known course (Task 13 links here).
- **`NewComicForm`**: a path select (labels from `PATHS`), a premise field with a 120-character counter, the emotion chips with "Your own word" (reuse the chips component the post flow uses), and "Make storyboard", disabled until a path is chosen. On success it routes to `/admin/posts/<id>`.
- **Tests:**
  - **DB** (`server/comics.test.ts`, fake provider, the setup of `server/commands.test.ts`):
    - the post has `course_id`, page `comics`, a `path` source whose paragraphs equal `pathFacts`, and a drafts record with template `comic` and scenes;
    - the settings tags hold `destination:AU`;
    - a non-editor is refused, with no post made;
    - a `[fake:fail-comic_story]` premise leaves the post with facts and no drafts.
  - **Actions:** no session gives `Not authorised.` and no command call (the pattern of `actions.test.ts:168-176`).
  - **Component:** "Make storyboard" is disabled with no path and enabled after choosing one; `?path=` preselects; a 121-character premise shows the counter over the limit and disables the button.
- Commit `feat(content): New comic makes a storyboard from a path`.

## Task 7: The editor shapes the storyboard
**Delivers:** RC2 (the storyboard shown as panels), RC3, RC4 and RC5 on save.
**Files:** modify `server/commands/comic.ts`, `server/commands/structures.ts` (`editSlot`, `:268`), `lib/workflow.ts` (+ `workflow.test.ts`), `comic-actions.ts` (+ test), `server/comics.test.ts` (DB), `components/EditableSlidePreview.tsx` (+ test), `components/Workbench.tsx` (the `Steps` switch, `:62`); create `components/StoryboardStep.tsx` (+ test).
**Kind:** judgement
- **Caption saves on a comic.** `editSlot` (`structures.ts:268`) refuses with `comicCaptionError(text, facts)` (Task 3) when the post has a `courseId`, before saving. This is RC4 and RC5. Feed posts are unchanged: the editor's own text is not linted today (`structures.ts:268`).
- **New commands** in `server/commands/comic.ts`. Both run through `command()` (`server/commands/shared.ts:148`) and save a new `drafts` record, as `editPickedSlot` does (`structures.ts:194`), so history and restore keep working (`listHistory`, `store.ts:271`).
  - **`editScene(actor, id, version, { slide: number; text: string })`**:
    - a refusal from `artPromptError` (`ai/draft.ts:51`) is returned as its message;
    - over 300 characters gets `Keep the scene to 300 characters.`;
    - the note is `Panel <n> scene edited`.
  - **`editPanels(actor, id, version, op: PanelOp)`** (`PanelOp` from Task 3):
    - `panelOpsError` refuses;
    - `applyPanelOp` runs with the blank `{ kind: 'body', slots: { caption: { text: '', factIds: [], factual: false } }, scene: '' }`;
    - the kinds are then recomputed (slide 1 `cover`, the rest `body`), so the template's repeat rules hold;
    - the notes are `Panel <n> added`, `Panel <n> removed`, `Panel <n> moved to <m>`.
- **`lib/workflow.ts`:**
  - `PostAction` gains `editScene` and `editPanels`, both in `EDITOR_ACTIONS` (`:37`), each with `ACTION_STAGES` `['structures']` (`:76`);
  - `approveStructureError` (`:166`) gains a comic rule, when the picked draft's template id is `comic`: every scene is non-empty (`Plan the scene for panel <n>.`), and every caption passes `comicCaptionError` (its message, prefixed `Panel <n>: `).
- **Actions** `editSceneAction(id, at, input)` and `editPanelsAction(id, at, op)` in `comic-actions.ts` follow `onPost` (`actions.ts:172`), which handles the version and revalidation.
- **`EditableSlidePreview`** (`:14-29`): `EditableSlot` gains an optional `kind: 'scene'`. The caller may pass a slot whose box is the slide's art box and whose text is the scene. It is edited like a text slot, with the label "Planned scene", and saved through `onSave('scene', text)`.
- **`StoryboardStep`** shows the picked comic draft's panels in order as `EditableSlidePreview`s. The preview draws the scene in the art area (Task 4), the caption is editable, and the scene is editable through the art area. Under each panel are "Add after", "Remove", and "Move earlier" / "Move later". Then comes "Approve storyboard" (the existing approve action). A refusal message shows under the panel it names. "Another take" and the template ticks are not shown. `Workbench`'s `Steps` (`:62`) renders `StoryboardStep` instead of the structures step when the post has a `courseId`.
- **Tests:**
  - **DB:**
    - a caption with "guaranteed" is refused and saves nothing;
    - a caption with "AUD 30k", where the path's fee is 30k, saves;
    - `editScene` saves a new drafts record with the scene and note;
    - removing at 3 panels is refused;
    - adding, then moving, gives the expected order with kinds recomputed;
    - approving with an empty scene is refused with `Plan the scene for panel 4.`;
    - a non-editor is refused for both commands.
  - **Workflow unit:** both actions are editor actions in `structures` only; the comic approve rule.
  - **Component:** "Remove" is disabled at 3 panels and "Add after" at 6; saving the art-area slot calls `onSave('scene', …)`.
- Commit `feat(content): edit a comic storyboard before it is drawn`.

## Task 8: The comic character
**Delivers:** RC9; the refusal of RC10 is enforced in Task 9 on this task's `approvedAssetId`.
**Files:** create `src/features/content/server/character.ts`, `server/character.test.ts` (DB; add to `test:db`), `ai/character.ts` (+ test), `src/app/admin/(console)/comics/character/page.tsx`, `components/CharacterStudio.tsx` (+ test); modify `ai/prompts.ts` (`CHARACTER_PLAN`), `ai/config.ts` (`UseCase` gains `'character_plan'`), `ai/fake.ts`, `ai/art.ts` (an `aspectRatio` input on `coverArt`), `comic-actions.ts` (+ test).
**Kind:** judgement
- **`CHARACTER_PLAN`**: use case `character_plan`, version `character_plan.v1`, tier `flash`.
  - Schema `{ views: [{ label: string, scene: string }] }`.
  - Rules:
    - 4 to 6 views of one gender-neutral student aged 20–24, by default (the description may refine it);
    - labels such as "Front", "Side", "Back", "Smiling", "Worried", "Thinking";
    - each scene is at most 200 characters: pose, clothing, expression, with no words or numbers.
  - A fake answer of 5 views.
- **`coverArt`** (`ai/art.ts:184`) gains optional `aspectRatio?: '4:5' | '1:1'`, default today's `ASPECT_RATIO`. It is passed to `generateImage` (`client.ts:410`, which takes `'4:5' | '1:1'`) and into the cache key only when it is not the default, so existing keys are unchanged.
- **`server/character.ts`** (the brand id is always `COMICS_BRAND_ID`, Task 4):
  - **`characterOf(): Promise<Character | null>`**. `Character = { description, views, sheetAssetId, sheetNote, approvedAssetId, approvedBy, approvedAt }`.
  - **`planCharacter(actor, { description })`**:
    - `canEdit`, else `Not authorised.`;
    - 1 to 200 characters, and `artPromptError` must pass;
    - it calls `CHARACTER_PLAN` and upserts the row, keeping `approvedAssetId`. An approved character stays usable until another is approved.
  - **`editCharacterView(actor, { index, label, scene })`**: the same guards.
  - **`drawCharacter(actor, { note: string | null })`**:
    - no views gives `Plan the character first.`;
    - a note over 80 characters, or one `artPromptError` refuses, is refused.
    - Code builds the prompt: the Comics art style (`designLanguageOf('comics')?.artStyle ?? DEFAULT_COMIC_STYLE`, `server/page-style.ts:112`); "A character reference sheet of one person on a plain light background, the same person in every view:"; each `label: scene`; the description; the note; and the no-text sentence `art.ts` uses.
    - It calls `coverArt` with `aspectRatio: '1:1'`, the Comics page's reference images, `set` a counter from the row so each redraw is a new key, and `postId` null-safe (check `generateImage`'s `postId` type; pass the brand id if it must be a string).
    - Drawn bytes are stored with `putAsset` (`store.ts:115`), and `sheet_asset_id` and `sheet_note` are set.
    - `daily_limit` returns `{ ok: false, error: 'Daily image limit reached' }`; no art returns `Could not draw the sheet. Try again.`
  - **`approveCharacter(actor)`**: no sheet gives `Draw the character first.`; otherwise it sets `approved_asset_id = sheet_asset_id`, `approved_by` and `approved_at`.
- **Actions** in `comic-actions.ts`: `planCharacterAction`, `editCharacterViewAction`, `drawCharacterAction`, `approveCharacterAction` (`asActor`, `revalidatePath('/admin/comics/character')`).
- **The page** `/admin/comics/character`: `requireBoard()`. Editors act; reviewers and admins see it read-only (`canEdit` decides). It renders `CharacterStudio`:
  - a description line with a default of "A gender-neutral student, 20–24, casual clothes";
  - "Plan the sheet";
  - the views as a storyboard of cards, each label and scene editable;
  - "Draw the sheet";
  - the drawn sheet from `/admin/assets/<id>` (staff only, `app/admin/(console)/assets/[id]/route.ts:12`);
  - "Redraw with a note" and "Approve this character";
  - the currently approved sheet beside it, labelled "Approved".
- **Tests:**
  - **DB:**
    - plan, then edit a view, then draw, then approve: the row's fields at each step;
    - redraw with a note makes a new sheet and keeps the approved one until approved again;
    - approving with no sheet is refused;
    - a non-editor is refused for each command;
    - a capped image day returns `Daily image limit reached` (cap 0: the fake provider respects `AI_DAILY_CAP_IMAGE`, see `config.ts:27`).
  - **Unit:** the `CHARACTER_PLAN` example parses; `coverArt` keys are unchanged for the default aspect ratio and differ for `1:1`.
  - **Component:** read-only viewers see no buttons; "Approve this character" is disabled with no sheet.
- Commit `feat(content): plan, draw and approve the comic character`.

## Task 9: Draw the panels, redraw one with a note
**Delivers:** RC6, RC10; the daily-image-cap edge case.
**Files:** modify `server/commands/comic.ts`, `ai/art.ts` (a `panelPrompt` builder, + test), `lib/workflow.ts` (+ test), `comic-actions.ts` (+ test), `server/comics.test.ts`, `components/Workbench.tsx`; create `components/PanelsStep.tsx` (+ test).
**Kind:** judgement
- **`panelPrompt({ style, scene, emotion, note }): string`** in `ai/art.ts`. It joins:
  - the style;
  - "The same character as in the first reference image, drawn consistently.";
  - the scene;
  - `withMood` (`art.ts:12`);
  - the note when given ("Change: <note>");
  - the no-text sentence.
  It passes `clean()` (`art.ts:46`).
- **`drawPanels(actor, id, version)`**, through `command()`, is allowed at `approved` and `rendered`.
  - It refuses `Approve the comic character first.` when `characterOf()?.approvedAssetId` is null (RC10), and `Approve the storyboard first.` when there is no revision.
  - For each slide of the revision's structure that has no drawn panel in the current render (all of them on the first run; only the missing ones on "Draw remaining"), it calls `coverArt` with:
    - `prompt: panelPrompt(…)`, the style from the Comics design language or `DEFAULT_COMIC_STYLE`;
    - `aspectRatio: '1:1'`, matching the 1080×1080 art box;
    - `references: [character sheet, ...Comics reference images]`, with the character sheet first;
    - `set` = the render's art version, `option` = the slide index.
  - The calls run one after another, so a capped day keeps the panels already drawn.
  - It lays out the revision (the existing render path, `renderPost`, `server/commands/render.ts:82`, with `arts` from Task 4) and puts a `render` record whose `panels` hold each panel's `{ assetId, scene, note: null, take, fallback }`.
  - It moves an `approved` post to `rendered`. A `rendered` post stays there with the new render.
- **`redrawPanel(actor, id, version, { panel: number; note: string })`** is allowed at `rendered`.
  - The note is 1–80 characters and must pass `artPromptError`.
  - It draws only that panel (take + 1, and the note in the prompt and the record). The new render keeps every other panel's `assetId` byte for byte.
- **`lib/workflow.ts`:**
  - `drawPanels` (`['approved', 'rendered']`) and `redrawPanel` (`['rendered']`) are editor actions.
  - The `render` action refuses a comic with `Use Draw panels for a comic.`
  - `sendToReviewError` (`:185`), for a comic (the revision's template is `comic`), requires every panel drawn (`Draw every panel first.`) instead of a source check, since a comic has no factual slots (RC4 replaces the check). Feed posts are unchanged.
- **`PanelsStep`** (shown by `Workbench` for a comic at `approved` and `rendered`, instead of the render step's cover controls; keep the render step's settings and "Send to review" controls) shows:
  - "Draw panels";
  - each panel's PNG with its caption;
  - per panel, "Redraw with a note" (a short field);
  - a panel that is not drawn reads "Daily image limit reached" or "No art" (`components/parts.tsx:34` has the label), with "Draw remaining".
- **Tests:**
  - **DB, fake provider:**
    - with no approved character, refused with the RC10 message and no image call;
    - with one, every panel is drawn and the render's `panels` has one entry per slide, each a distinct asset;
    - the image request carries the character sheet as its first reference (record what `generateImage` received: inject the AI deps as the existing render tests do);
    - `redrawPanel` on panel 2 changes only panel 2's asset and stores the note;
    - with `AI_DAILY_CAP_IMAGE=2` and 4 panels, panels 1–2 are drawn, 3–4 read `daily_limit`, and after raising the cap "Draw remaining" draws only 3–4;
    - send to review is refused while a panel is missing;
    - a non-editor is refused.
  - **Unit:** `panelPrompt` contains the scene, the mood and the note, and no digits.
  - **Component:** a panel with `daily_limit` shows the label and "Draw remaining".
- Commit `feat(content): draw comic panels with the approved character`.

## Task 10: A published comic in the feed, on its public page, and for the Comics page on Instagram
**Delivers:** RC7, RC15.
**Files:** modify `server/social.ts` (+ `server/social.test.ts`, DB), `server/comics.test.ts`, and the live panel component that offers "Make Instagram version" and "Make the set" (find it from `adaptPostAction` and `makeSetAction` in `actions.ts`; + its test).
**Kind:** judgement
- **Review and publishing are unchanged** (`sendToReview`, `approveAndPublish`, `server/commands/review.ts:123`, `:131`). A live comic is a live feed post, so `listLive` (`store.ts:626`), `/feed`, `/feed/<id>` (`SlideStrip`, swiped one panel at a time on a phone), `giveSlug` (`store.ts:429`) and `/posts/<slug>` (`isLiveAsset`, `store.ts:914`) carry it as they are. This task proves that with a test and changes only what follows.
- **Instagram for a comic.**
  - `adaptPost` (`social.ts:100`) on a comic accepts only `brandId: 'comics'`; any other page is refused with `A comic goes to the Comics page.`
  - `renderSocial` (`:382`) draws a comic's social version with the parent render's per-panel art (`panels[i].assetId` bytes as `arts`, Task 4) and never draws its own cover (`ownCover: false`).
  - `makeSet` (`:331`) on a comic makes only the Comics version, with no quote card.
  - On a feed post, `makeSet` and the adapt choices leave out the Comics page, even when it has a design language.
- **The live panel:** for a comic, it offers one "Make Instagram version for Comics" and hides the page choice and "Make the set".
- **Tests (DB, fake provider):**
  - **Publishing:** a comic taken through drawn panels, settings, send to review and approve:
    - is in `listLive()` with the `destination:AU` tag, so `applyFilters` with destination AU keeps it and destination UK drops it (`lib/feed.ts:97`);
    - has a slug, and `liveBySlug` returns it;
    - its last slide's layout carries the search line with its title;
    - every slide PNG is a live asset.
  - **Instagram:**
    - adapting the comic for `main` is refused;
    - adapting it for `comics` renders, and each social slide's SVG embeds the same panel art as the parent's slide (compare the art data URI or the asset bytes);
    - `makeSet` on a feed post with a styled Comics page makes no Comics version, and on a comic makes exactly one.
- Commit `feat(content): publish comics to the feed, public pages and the Comics page`.

## Task 11: Plan the covers before drawing them
**Delivers:** RC11.
**Files:** modify `ai/prompts.ts` (`COVER_PLAN`), `ai/config.ts` (`UseCase` gains `'cover_plan'`), `ai/fake.ts`, `ai/art.ts` (+ test), `server/commands/render.ts` (`makeCovers` `:402`, + DB tests in `server/commands.test.ts`), `lib/workflow.ts` (+ test), `actions.ts` (+ test), `src/app/admin/(console)/posts/[id]/preview/route.ts` (+ `routes.test.ts`), `components/steps/RenderStep.tsx` (+ test).
**Kind:** judgement
- **`COVER_PLAN`**: use case `cover_plan`, version `cover_plan.v1`, tier `lite`.
  - Schema `{ scenes: string[] }`.
  - Rules:
    - exactly three different scenes for the post's cover, each at most 200 characters;
    - what is seen only (place, people, action, light, composition);
    - no words, letters, numbers, logos or brand names.
  - Data: the cover slide's words, the version's angle, the emotion, the page's art style (`designLanguageOf`, as `coverFor` reads it, `render.ts:49`) and the editor's optional idea.
  - `verify`: three scenes, each passing `artPromptError`.
  - A fake answer of three scenes.
- **`planCovers(actor, id, version, { idea: string | null })`** at `rendered`:
  - `coverIdeaError` applies to the idea (`workflow.ts:204`);
  - it calls `COVER_PLAN` and puts a `cover_plan` record `{ revisionId, scenes, idea }`;
  - it points `coverPlanId` at it.
- **`editCoverScene(actor, id, version, { option: 0 | 1 | 2; text: string })`**: 1–200 characters, `artPromptError`; it puts a new `cover_plan` with that scene replaced.
- **`makeCovers`** now:
  - requires a current cover plan (`Plan the covers first.`), and pressing it is the approval of the plans;
  - draws option i from `coverPrompt` with scene i as its scene (`art.ts:62`), in place of the one shared prompt;
  - keeps everything else as it is: the art check, the cap labels, `set`, `COVERS_KEPT`.
- **"Another set"** plans again (a new plan, then the editor approves).
- **`redrawCover(actor, id, version, { option; note })`**:
  - the note is 1–80 characters and must pass `artPromptError`;
  - it draws that option again with the note added ("Change: <note>");
  - it puts a new `covers` record with only that option replaced.
- **`lib/workflow.ts`:** `planCovers`, `editCoverScene` and `redrawCover` are editor actions at `['rendered']`.
- **Actions:** `planCoversAction`, `editCoverSceneAction` and `redrawCoverAction` follow `onPost`. `makeCoversAction` no longer takes an idea.
- **Preview route** (`preview/route.ts`): the layout query gains optional `plan=<coverPlanId>&option=<n>`. The route loads the plan, checks it belongs to the post, and passes `planned: scenes[n]` to `layoutPreviewPng` (Task 4). It stays staff-only (`canSeeBoard`, `:30`).
- **`RenderStep`'s cover area:**
  - before covers: an idea field and "Plan covers";
  - then three cover-slide previews, each showing its planned scene in the art area, editable through the art-area slot (`EditableSlidePreview`, Task 7), and "Approve and make covers";
  - after drawing: the options as today, each with "Redraw with a note", plus "Use this cover" and "Another set".
- **Tests:**
  - **DB:**
    - `makeCovers` with no plan is refused and calls nothing;
    - with a plan, the three image prompts each contain their own scene;
    - an edited scene reaches the prompt;
    - `redrawCover` on option 1 keeps options 0 and 2 byte for byte;
    - a plan for an older revision is not current after reopen and reapprove;
    - a non-editor is refused.
  - **Unit:** the `COVER_PLAN` example parses; a scene with a digit fails verify.
  - **Route:** a plan id from another post is 404.
  - **Component:** "Approve and make covers" shows only once a plan exists.
- Commit `feat(content): plan feed-post covers in words before drawing them`.

## Task 12: Count the paths students are shown
**Delivers:** RC12.
**Files:** create `src/features/insights/lib/viewer-key.ts` (+ test), `src/features/insights/server/views.ts`, `src/features/insights/server/views.test.ts` (DB; add to `test:db`), `src/features/insights/index.ts`.
**Kind:** judgement
- **`viewerKey(userId: string, day: string, secret: string): string`**: `createHmac('sha256', secret).update(`${day}:${userId}`).digest('hex').slice(0, 32)`.
  - The key changes every day, so days cannot be linked.
  - Without the secret, the user cannot be found.
  - No user id is stored (RC12).
  - The secret is `process.env.BETTER_AUTH_SECRET`.
- **`courseIdsShown(result)`**: from a futures result typed structurally as `{ kind: 'futures'; futures: { courseId: string }[] } | { kind: 'sealed'; nearest: { courseId: string }[] }` (`src/features/engine/futures.ts:57-72`; do not import Jenish's internals). It returns the distinct course ids shown.
- **`recordPathViews(userId: string, courseIds: readonly string[], now = new Date()): Promise<void>`**:
  - it keeps only known paths (`pathById`, Task 2) and counts each once;
  - it inserts `(utc day, courseId, viewerKey)` into `path_view` with `onConflictDoNothing`, so one student counts once per path per day;
  - it deletes rows older than 31 days;
  - it **never throws**: it catches, logs `[insights.recordPathViews]` and returns, so `/futures` never breaks;
  - with no secret it records nothing and logs once.
- **`pathViewCounts(days = 30, now = new Date()): Promise<Map<string, number>>`**: counts per course over the last `days` UTC days.
- **`index.ts`** exports `recordPathViews` and `courseIdsShown` for Jenish's page (Task 14 documents the line).
- **Tests:**
  - **Unit:** the same user and day give the same key; another day gives another key; the key never contains the user id.
  - **Unit:** `courseIdsShown` for futures and for sealed.
  - **DB:**
    - two calls the same day for the same student and path give count 1;
    - another student gives 2;
    - the next day gives a new row;
    - an unknown course id is ignored;
    - a row 40 days old is deleted on the next call and not counted;
    - no column holds the user id (select the row and assert it has none);
    - with `BETTER_AUTH_SECRET` unset, the call resolves and writes nothing.
- Commit `feat(insights): count the paths students are shown, anonymously`.

## Task 13: The Insights tab
**Delivers:** RC13, RC14.
**Files:** create `src/features/insights/lib/rank.ts` (+ test), `src/features/insights/mock-views.json`, `src/features/insights/components/InsightsTable.tsx` (+ test), `src/app/admin/(console)/insights/page.tsx`; modify `src/features/content/server/store.ts` (`comicStatuses`, + DB test in `server/comics.test.ts`), `src/features/admin/lib/nav.ts` (+ `nav.test.ts`, which asserts the labels at `:23`).
**Kind:** judgement
- **`comicStatuses(): Promise<Map<string, 'in_progress' | 'live'>>`** in `store.ts`, over feed posts with a `course_id`:
  - `live` when one is live or exported and unexpired (`isLive`, `lib/feed.ts:143`);
  - `in_progress` when one exists at any other stage;
  - live wins over in progress.
- **`mock-views.json`**: a count per catalogue course id (all 14, varied between 3 and 60).
- **`rankPaths(paths: readonly Path[], real: Map<string, number>, comics: Map<string, 'in_progress' | 'live'>, mock: Record<string, number>, opts = { mockBelow: 20 }): InsightRow[]`**:
  - `InsightRow = { path: Path; count: number; mock: boolean; status: 'none' | 'in_progress' | 'live' }`;
  - when the total of real counts is below `mockBelow`, a path with no real count takes its mock count with `mock: true`;
  - otherwise only real counts show, and paths with none show 0;
  - it sorts by count descending, then label.
- **The page** `/admin/insights`: `requireBoard()`, `AdminPageHeader` with the title "Insights" and the lede "Paths students were shown in the last 30 days, counted once per student a day, with no names kept." (the pattern of `board/page.tsx:8-17`), and `InsightsTable` with the rows and `canMake = canEdit(user)`.
- **`InsightsTable`**:
  - columns rank, path, times shown (with a "mock" badge where `mock`), comic (None, In progress, Live);
  - when `canMake`, a "Make comic" link to `/admin/comics/new?path=<id>` on every row;
  - one line above the table when any row is mock: "Counts marked mock are examples until real views build up."
- **`nav.ts`**: `ADMIN_SECTIONS` gains `{ href: '/admin/insights', label: 'Insights', show: (s) => canSeeBoard(s) }` between Board and Users. Editors, reviewers and admins see it.
- **Tests:**
  - **Unit:**
    - with 0 real views every row is mock;
    - with 25 real views across two paths only those are non-zero and none is mock;
    - with 5 real views on one path, that path shows 5 not mock, and the others show mock;
    - the order by count, then label;
    - a status taken from `comics`.
  - **DB:** a comic at `structures` gives `in_progress`; a live one gives `live`; a feed post without a course is not counted.
  - **Nav:** the labels for an editor are `['Board', 'Insights']` and for a superadmin `['Board', 'Insights', 'Users']`. Follow the cases in `nav.test.ts:27`.
  - **Component:** "Make comic" shows only with `canMake`, its href carries the path id, and the mock line shows only with a mock row.
- Commit `feat(insights): the Insights tab ranks paths and says which have a comic`.

## Task 14: A comic on a futures card
**Delivers:** RC16.
**Files:** modify `src/features/content/server/store.ts` (`liveComicCovers`, + DB test in `server/comics.test.ts`), `src/features/content/index.ts` if a barrel exists (else export from `server/store.ts` and name the import path in the doc); create `src/features/content/components/ComicCoverLink.tsx`, `docs/route-comics-and-gaps/for-jenish.md`.
**Kind:** judgement
- **`liveComicCovers(courseIds: readonly string[]): Promise<Record<string, ComicCover>>`**:
  - `ComicCover = { title: string; href: string; coverSrc: string }`;
  - for each course id, the newest-approved live, unexpired comic with that `course_id`;
  - `href` is `postPath(slug)` and `coverSrc` is `postAssetPath(first slide png)` (`lib/public-post.ts:65`, `:68`), both public, so a student's browser can load them;
  - a course with no live comic is absent.
- **`ComicCoverLink({ comic }: { comic: ComicCover })`**: a client-safe, presentational link showing the cover image and "Read the comic: <title>". It gets no test, per CLAUDE.md.
- **`for-jenish.md`**, for Jenish's slice, says:
  - **The counting line** for `src/app/(app)/futures/page.tsx` (`:22`): hoist `const initial = buildFutures(…)`, then `await recordPathViews(user.id, courseIdsShown(initial))`.
  - **The covers:** `const comics = await liveComicCovers(courseIdsShown(initial))`, passed through `FuturesScreen` to `FutureCard`. There, `comics[future.courseId] && <ComicCoverLink comic={…} />` (a natural place is near "Keep options open", `FutureCard.tsx:185-201`).
  - **Imports:** the import paths.
  - **Until the line lands:** Insights shows mock counts.
  - **Not changed:** that this branch changes none of his files.
- **DB tests:** a live comic for `ecu-cyber` gives its slug href and its first-slide asset path; a comic in progress gives nothing; of two live comics, the newer approval wins; an expired one gives nothing.
- Commit `feat(content): live comic covers for the futures cards`.

## Task 15: The new prompts in the live smoke run
**Delivers:** a live check, by hand, of the specs added in Tasks 5, 8 and 11 (not a criterion).
**Files:** modify `scripts/ai-smoke.ts`.
**Kind:** judgement
- Add one call each for `comic_story` (the `ecu-cyber` path facts, no premise), `character_plan` (the default description) and `cover_plan` (the cover words of a demo source). Print them in the script's existing line format: `<use case> · <model> · <ms> ms · ok`.
- Do not run it: it calls Vertex. The developer runs `bun run ai:smoke` by hand.
- **Test:** `scripts/ai-smoke.ts` runs under the fake provider if it already supports that; otherwise type-check and lint only.
- Commit `chore(content): the comic and cover-plan prompts in the live smoke run`.

## Integration

- **Database**, by path against `app_comics` (never `bun run test:db` during the build: it wipes the development database). Each file is also added to the `test:db` list in package.json:17:
  - `src/features/content/server/schema.test.ts`
  - `src/features/content/server/comics.test.ts`
  - `src/features/content/server/character.test.ts`
  - `src/features/content/server/commands.test.ts`
  - `src/features/content/server/social.test.ts`
  - `src/features/insights/server/views.test.ts`
- **The command:** `DB_TESTS=1 DATABASE_URL=postgres://app:app@127.0.0.1:5433/app_comics bun test <files>`.
- **Before the smoke test:** `bun run lint && bun run type-check && bun run test:run && bun run build`, plus the DB files above.

## Criteria coverage
| Criterion | Task | Test that proves it |
| --- | --- | --- |
| RC1 | 6 | `NewComicForm.test.tsx` (button disabled without a path, premise limit, `?path=`); `comics.test.ts` (refusals) |
| RC2 | 2, 5, 6, 4 | `path-facts.test.ts`; `comic.test.ts` (story shape and data); `comics.test.ts` (persisted storyboard with scenes); `preview.test.ts` (scene drawn in the art area) |
| RC3 | 3, 7 | `comic-rules.test.ts` (limits, ops); `comics.test.ts` (edit scene, add, remove, move); `StoryboardStep.test.tsx` |
| RC4 | 3, 7 | `comic-rules.test.ts` (number not a fact); `comics.test.ts` (refused on save, refused at approve) |
| RC5 | 3, 7 | `comic-rules.test.ts`, `lint.test.ts` (outcome promises); `comics.test.ts` (refused on save) |
| RC6 | 9, 4 | `comics.test.ts` (each panel drawn with the sheet as first reference, redraw one with a note); `svg.test.ts` (per-panel art) |
| RC7 | 10, 4 | `comics.test.ts` / `social.test.ts` (live, slug, search line, Comics-only Instagram with panel art); `templates.test.ts` (search line fits) |
| RC8 | 4 | `brands.test.ts` (the Comics page brand among the page brands, so Page styles lists it) |
| RC9 | 8 | `character.test.ts` (plan, edit, draw, redraw, approve, refusals) |
| RC10 | 9 | `comics.test.ts` (refused with "Approve the comic character first." and no image call) |
| RC11 | 11 | `commands.test.ts` (no plan refused, each option drawn from its own scene, edit reaches the prompt, redraw one keeps the others) |
| RC12 | 12 | `viewer-key.test.ts`; `views.test.ts` (once per student per path per day, no user id stored) |
| RC13 | 13 | `rank.test.ts`; `comics.test.ts` (`comicStatuses`); `nav.test.ts`; `InsightsTable.test.tsx` ("Make comic" for editors, href) |
| RC14 | 13 | `rank.test.ts` (mock rule); `InsightsTable.test.tsx` (mock badge and line) |
| RC15 | 10 | `comics.test.ts` (live comic in `listLive`, kept by the AU destination filter, public slug and assets); swiping one panel at a time on a phone: Not automatable, smoke test (no browser tests in this plan) |
| RC16 | 14 | `comics.test.ts` (`liveComicCovers`); placing it on the card is Jenish's (intent, Dependencies) |
| Daily image cap while drawing | 9 | `comics.test.ts` (cap 2 of 4, then draw remaining) |
| Frozen facts | 6 | `comics.test.ts` (the path's facts are in the post's own source and facts records) |
| Refusals for non-editors | 6, 7, 8, 9, 11 | each command's DB test; `comic-actions.test.ts` (no session) |

## Task 16 (story 6, 14 Oct 2026): Record what each path was shown as
**Delivers:** RC17; the recording half of RC19.
**Files:** `src/shared/lib/db/schema.ts` and migration 0016; `src/features/insights/server/views.ts` (+ DB test); `src/features/insights/actions.ts` (+ test); `src/features/insights/index.ts`.
**Kind:** judgement
- **Table `path_showing`:**
  - `id uuid pk`, `day date not null`, `course_id text not null`, `viewer_key text not null` (the RC12 daily key, so the same student's showings on a day can be grouped without an identity);
  - `future_id text null` (`'cost' | 'staying' | 'career'`, null when out of reach);
  - `strong_on text[] not null default '{}'`, `costs_on text[] not null default '{}'`;
  - `out_of_reach boolean not null default false`, `over_by_k integer null`;
  - `redraw boolean not null default false`, `created_at timestamptz not null default now()`;
  - an index on `(day, course_id)`.
  Migration 0016 (`bun run db:generate`), applied to `app` and `app_insights`.
- **`recordFuturesShown(userId, result, { redraw })`:**
  - for `kind: 'futures'`, one row per future (`courseId`, `id`, `strongOn`, `costsOn`);
  - for `kind: 'sealed'`, one row per nearest route with `out_of_reach` and `over_by_k` from `overByK`.
  It also records the RC12 daily view (`recordPathViews`). Known paths only, never throws, old rows (>31 days) are deleted as `path_view`'s are, and nothing is written with no secret.
  The result is typed structurally from `src/features/engine/futures.ts:39-72`; Jenish's files are never edited.
- **`recordRedrawAction(result: unknown)`** (`'use server'`, `src/features/insights/actions.ts`): requires a student session (`requireStudent`'s rule, without redirect: returns `ActionResult`), validates the result with zod (only the fields above, bounded arrays), and calls `recordFuturesShown(..., { redraw: true })`.
- `index.ts` exports `recordFuturesShown` and `recordRedrawAction`. `recordPathViews` stays for the first-draw line or becomes a thin call; keep the names in `for-jenish.md` working.
- **Tests (DB):**
  - three futures write three rows with their strengths and costs;
  - a sealed result writes out-of-reach rows with `over_by_k`;
  - a redraw adds rows but not daily totals;
  - no column holds a user id;
  - unknown courses are ignored.
  - **Action:** refuses no session and a staff session; refuses a malformed result.
- Commit `feat(insights): record how each path was shown to students, anonymously`.

## Task 17 (story 6): Each path's showings on the Insights tab
**Delivers:** RC18, RC19 (the display).
**Files:** `src/features/insights/server/views.ts` (`pathShowingStats`, + DB test), `src/features/insights/lib/rank.ts` (+ test), `src/features/insights/components/InsightsTable.tsx` (+ test), `src/app/admin/(console)/insights/page.tsx`.
**Kind:** judgement
- **`pathShowingStats(days = 30)`:** a map from course to:
  - `{ showings, byFuture: { cost, staying, career }, strongOn: Record<dim, share>, costsOn: Record<dim, share>, outOfReach: { count, avgOverK } }`;
  - shares as whole percentages of the path's showings.
- **The path's lines** come from the catalogue (the course's `lines.time/work/pr/career.text` via `@/features/engine`'s `COURSES`, read-only).
- **`InsightsTable`:** each row expands ("Details") to show the RC18 list, with the dimension labels from Jenish's vocabulary (cost, staying, career: read from the engine's types or labels). A path with none reads "Not shown to students yet", and mock-counted paths never show invented strengths.
- **Tests:**
  - stats shares and averages from known rows (DB);
  - the details render the shares and lines, and "Not shown to students yet" (component).
- Commit `feat(insights): see how each path was pitched: futures, strengths, costs and out of reach`.

## Task 18 (story 6): Tell Jenish
**Delivers:** RC19 (the hand-over).
**Files:** `docs/route-comics-and-gaps/for-jenish.md`.
**Kind:** judgement
- Update the note:
  - the first-draw line becomes `await recordFuturesShown(user.id, initial, { redraw: false })`;
  - in `FuturesScreen` after a redraw, `recordRedrawAction(next)` (fire and forget; it never blocks the screen);
  - the import paths;
  - that nothing is recorded until both are in.
- No code. Commit `docs(insights): the futures page lines that record what students were shown`.
