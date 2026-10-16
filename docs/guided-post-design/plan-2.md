# A smoother workbench and more control over the narrative · Implementation Plan

**Intent:** docs/guided-post-design/intent.md, stories 9 and 10 (GD28–GD34; GD35 is built with blogs and research), and the Changes section (13 Oct 2026).
**Goal:** The editor edits any step directly with no Back buttons and confirms, sees sensible defaults, works with slides and actions side by side, chooses where sources go, shapes a post slide by slide before any text is written, and picks from ten described formats with Gemini's top three marked.
**Approach:**
- **Edits move the post back by themselves.** Every edit command allowed at the current step is also allowed at a passed step. It moves the post back first (story 14's `goBack`), then applies the edit in one save, and returns a note line.
- **A post outline before drafting.** A `post_outline` record (each slide's job, layout and point) sits between ideas and drafts. Drafting follows it.
- **Formats as data,** like the emotions and nudges.
- **Two scroll areas.** The layout becomes two areas that scroll on their own.
- **Sources move off the slides,** into the caption, the last slide or a sources slide, by a per-post setting.

**Test layers:** Unit plus integration (database), as the earlier plans. Behaviour gets tests, looks get none. No browser specs unless asked; the uncommitted e2e updates in the working tree are left alone.

**Constraints:**
- `bun install` (Bun only; npm/pnpm/yarn are refused)
- Never commit or push without explicit approval. Squash micro-commits into one semantic commit. Never add co-author text to commit messages.
- Conventional Commits (`type(scope?): description`), enforced by .husky/commit-msg.
- Never start a dev server for the user; they run it.
- Access rules live in one pure module, src/shared/lib/auth/access.ts; pages and actions call it, the proxy only checks the cookie.
- Server actions return `ActionResult` (src/shared/types/action-result.ts) and never throw.
- Tailwind 4 is CSS-first (src/app/globals.css): semantic tokens only, no @apply, OKLCH colours, rem not px.
- The active design system is Industry: read src/design-systems/industry/DESIGN.md before any UI work.
- Read node_modules/next/dist/docs before writing Next.js code (see AGENTS.md).
- `bun run test:run` — Test the brain, not the beauty.
- Never run `bun run test:db` or `db:reset`. DB files by path against `app_flow` (create it with `docker compose exec -T db psql -U app -d postgres -c "create database app_flow"`, then migrate with `DATABASE_URL=postgres://app:app@127.0.0.1:5433/app_flow bun scripts/migrate.ts`). One file per process. Component tests with `DEBUG_PRINT_LIMIT=300 … --timeout 20000`.
- Fake provider only. Migrations by `bun run db:generate` and `bun run db:migrate`. Applied migrations are never edited. The latest is 0010, so this plan's is 0011.
- **Branch:** `feat/workbench-flow`, cut from `feat/guided-post-design` (HEAD 09c780f or later). Leave the uncommitted `e2e/` files alone.

## Task 1: Edits at a passed step move the post back by themselves (GD28)
**Kind:** judgement
- In `lib/workflow.ts`, every editing action (`editSlot`, `editScene`/`editImageScene`, `setSlideLayout`, `setLook`, `setPreset`, `nudgeSlide`, `nudgeVersion`, `takeSlide`, `addFact`, `removeFact`, `pickIdeas`, `remake`…) gets a "home stage", the stage where it is allowed today. When called at a later feed-post stage (`approved`, `rendered`), the command:
  1. moves the post back to the home stage, the way `goBack` does (`server/commands/back.ts`, keeping records, clearing approvals);
  2. applies the edit, all in one save;
  3. returns `{ ok, id, version, note }`, for example "Text changed: the pictures of changed slides will be planned again".
- At `in_review` the edit first withdraws, then moves back. At `live`, an edit first runs `editLive`, so students keep the live version.
- Moves are refused while a step runs (`stepRunningError`).
- The confirms in `components/parts.tsx` (`backConfirm`) stay only for "Discard changes". "Back to …" buttons are removed from passed steps, and passed steps render editable (Workbench's read-only mode goes, except for viewers who cannot edit).
- **Tests:**
  - **DB:** `editSlot` on a rendered look post lands at `structures` with the edit saved and no approval; at `live` the published version still reads; refused while a step runs.
  - **Component:** a passed Text step shows editable fields and no "Back to text versions"; the note shows after an edit.
- Commit `feat(content): edit any step directly; the post moves back by itself`.

## Task 2: Defaults pre-selected (GD29)
**Kind:** judgement
- **Ideas:** `IDEAS` returns a `rank` per card. The top three are marked "Recommended", ordered first, and the first is pre-selected on the cards (the editor still presses "Use this idea"; nothing drafts by itself).
- **Text:** when versions arrive, the first version whose `versionStatus` is ready is picked automatically (`pick`), and the editor can choose another.
- **Settings:** when a post first reaches Settings, the feed settings are pre-filled: the layer "general", the audience "everyone", the expiry 90 days, and tags from the source's destination and theme where the facts name them (`lib/places.ts`). Nothing is saved until the editor saves or sends.
- **Tests:** `IDEAS` verify orders by rank; the auto-pick picks the first ready version and not a failing one; the Settings defaults.
- Commit `feat(content): sensible defaults for ideas, versions and settings`.

## Task 3: Slides and actions side by side (GD30)
**Kind:** judgement
- On desktop (`@5xl:`), every step screen is two areas: the slides or article area and the actions and fields area. Each scrolls on its own (`overflow-y-auto` within a viewport-height frame below the header and step bar), and both stay in view. Below `@5xl` they stack, as now.
- The chosen-version editor (`components/steps/text/ChosenVersion.tsx`) puts the film strip and large slide in the slides area, and the fields, chips and layouts in the actions area.
- Images puts the slides with pictures on one side, and the chips, scene and progress on the other.
- Settings puts the preview on one side, and the check summary, feed settings and Send on the other.
- Follow the Industry layout rules: container queries, no new breakpoints.
- **Tests (behaviour only):** the two regions exist with accessible names ("Slides", "Actions") on each step.
- Commit `feat(content): slides and their actions side by side on every step`.

## Task 4: Where sources go (GD31)
**Kind:** judgement
- **The setting:** `FeedSettingsSchema` gains `sourcesAt: z.enum(['caption', 'last_slide', 'sources_slide']).default('caption')`.
- **Layout:** the per-slide source line is no longer drawn on look posts. Legacy posts keep theirs (GD8).
  - **`last_slide`:** one line "Sources: <site names>" above the search line on the last slide, wrapped and fitted.
  - **`sources_slide`:** an extra final slide (a `sources` layout in every look: heading "Sources", one row per source with its site and title, never long URLs, at most 6), before the slide with the search line or carrying it.
- **Captions:** they always end with "Sources: <site names>" (code-written, `ai/caption.ts` assembly).
- **Pages:** the feed post page and the public page list the sources with their links.
- **Tests:** each option's layout (no source lines on body slides; the last-slide line; the sources slide's rows); the caption tail; the public page lists links.
- Commit `feat(content): choose where a post's sources go: the caption, the last slide or a sources slide`.

## Task 5: An outline before drafting (GD32)
**Kind:** judgement
- **Record:** artifact kind `post_outline` (migration 0011) `{ factsId, ideas: IdeaCard[], format: FormatId, slides: { job: 'hook' | 'point' | 'proof' | 'compare' | 'step' | 'takeaway' | 'sources', layout: LayoutId, point: string }[] (3–10), note }`, plus `PointersSchema.outlineId` and a `current()` link (while `factsId` matches).
- **`OUTLINE` spec** (lite): from the facts, the idea(s), the format and `brand_voice`, it returns the slides. Verify the count, the layouts in the look and no numbers outside the facts.
- **Commands:** `pickIdeas` makes the outline (not the drafts). `editPostOutline(op)` reorders, adds, removes, or changes a slide's job, layout or point. `writeSlides` drafts three versions that all follow the outline: the same slide count, layouts and points. The `DRAFT` data gets the outline, and verify refuses a version that departs from it.
- **`OutlineStep` for posts:** a list of slide rows (job, layout, point editable in place, move, add, remove), the format and look shown, then "Write the slides". The step `outline` sits between ideas and text in `lib/steps.ts` for look posts.
- **Tests:** `pickIdeas` makes an outline and no drafts; edit operations and limits; drafts follow the outline (verify refuses a different slide count); the step mapping.
- Commit `feat(content): shape a post slide by slide before any text is written`.

## Task 6: Ten formats with Gemini's top three; a bullets layout (GD33, GD34)
**Kind:** judgement
- **`formats/formats.json`:** id, label, description (one line) and its default slide jobs for: myth vs fact; N things nobody tells you; this or that; step by step; informative, one idea per slide; bullet points; a day in the life; question and answer; before you go (checklist); then vs now (timeline). Load it as the emotions and nudges are (`formats/index.ts`).
- **Ideas:** `IDEAS` answers each card with a `format` (one of the ids) and ranks formats for the source. The cards show the format's label and description, and the top three formats are marked "Recommended", the first pre-selected (GD29). On the outline, the format can be changed (which re-outlines, one lite call).
- **`bullets` layout** in all three looks: a heading plus three to five short points, each drawn with a bullet mark by code. Relayout maps a body's sentences to bullets and back (`layout/relayout.ts`).
- **Tests:** the formats file parses with ten ids; ideas verify accepts only known formats; the bullets layout lays out three and five points and passes fit; relayout to and from bullets.
- Commit `feat(content): ten described formats with Gemini's top three, and a bullet-points layout`.

## Criteria coverage
| Criterion | Task | Test that proves it |
| --- | --- | --- |
| GD28 | 1 | `commands.test.ts` (edit at a passed step moves back; live stays; refused while running); Workbench/StructuresStep tests |
| GD29 | 2 | `ideas.test.ts` (rank order); `commands.test.ts` (auto-pick); SettingsForm test (defaults) |
| GD30 | 3 | Workbench tests (two named regions per step) |
| GD31 | 4 | `engine.test.ts`/`svg.test.ts` (each option); `caption.test.ts` (sources tail); public page test |
| GD32 | 5 | `commands.test.ts` (outline, edits, drafts follow it); `steps.test.ts` |
| GD33 | 6 | `formats.test.ts`; `ideas.test.ts` (known formats, top three) |
| GD34 | 6 | `engine.test.ts`, `fit.test.ts`, `relayout.test.ts` (bullets) |
