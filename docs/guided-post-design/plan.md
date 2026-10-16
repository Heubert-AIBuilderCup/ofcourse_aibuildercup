# Make a well-designed post by choosing and nudging · Implementation Plan

**Intent:** docs/guided-post-design/intent.md
**Goal:** An editor picks an idea, a look and a colour preset, swaps slide layouts, steers text and images with chips, and gets on-brand slides with pictures inside, all without writing a prompt.
**Approach:** Four decisions shape the build.
- **The looks share their layouts.** The three looks (`field-notes`, `data-desk`, `postcard`) are templates with the same seven layout ids and the same slot keys: cover, picture, number, bars, quote, checklist, takeaway. Only boxes, art boxes and surfaces differ between looks. So changing a look is changing a template id, and swapping a slide's layout maps text by slot key, both without a model call. A slide gains a `layout` field, and `slideSpec` picks by it, falling back to the kind for old templates.
- **The brand is one guideline file.** It defines the palette, two presets (Pop, Subdued) that map each layout's surface (base, block, deep) to colours, the art style and the voice. Code compiles it into prompts, into the slide themes, and into an SVG duotone filter that tints every image (resvg 2.6.2 has `feColorMatrix` and `feComponentTransfer` compiled in).
- **One image per art box.** A render can carry art per slide, which the comics plan reuses. Postcard draws one wide image cut into windows. Images are planned in words before any is drawn, as an `art_plan` record.
- **Ideas come first.** "Make post" stops after facts at idea cards (an `ideas` record). Picking one drafts three versions in its look.

**Test layers:** Unit plus integration (database).
- **Unit** (`bun run test:run`) holds the decisions:
  - the guideline compiler and presets;
  - layout choice by slide, relayout by slot key, and which layouts a slide can fill, with the reasons;
  - the frame (dots, swipe cue);
  - per-slide art, panorama windows and the tint filter in the SVG, with a PNG pixel check through resvg;
  - the new specs (`IDEAS`, `SCENE_PLAN`) and their fake answers;
  - place detection for Postcard;
  - the nudge chips' data;
  - action refusals;
  - the components with behaviour.
- **Database** (`DB_TESTS=1 DATABASE_URL=…/app_guided bun test <file>`): GD1–GD5, GD10–GD14 and GD8 persist records and pointers. They are proven in `server/commands.test.ts` and `server/social.test.ts` through the fake provider.
- **Smoke test:** the looks themselves (how a slide reads at phone size) are judged on screen. This plan adds no browser specs.
- **No new setup.**

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
- `bun run test:db` **wipes the development database**: never run it. Run DB files by path against `app_guided`, created with `docker compose exec -T db psql -U app -d postgres -c "create database app_guided"` and migrated with `DATABASE_URL=postgres://app:app@127.0.0.1:5433/app_guided bun scripts/migrate.ts`.
- `bun run test:e2e`: only when someone asks. Fake provider only in tests, never Vertex. Migrations by `bun run db:generate` and `bun run db:migrate`, never `db:reset`.
- **Branch:** `feat/guided-post-design`, cut from `feat/submission-readiness` after story 14 (Tasks 60–64). Story 14's migration is 0008; this plan's is 0009.

## Files
| Path | Create or modify | Responsibility |
| --- | --- | --- |
| src/features/content/brands/guideline.json, brands/guideline.ts (+ test) | create (Task 1) | **the one definition of the palette, `PRESETS`, `Surface`, `presetThemes`, `guidelineFor`** |
| src/features/content/model/types.ts, templates/*.json, templates/index.ts, layout/engine.ts, layout/svg.ts, layout/fit.ts (+ tests) | modify, create (Task 2) | the three looks, layout choice by slide, surfaces, the frame: **`LOOKS`, `LayoutId`, `LAYOUT_IDS`, `isLook`** |
| layout/svg.ts, layout/render.ts, layout/tint.ts, server/commands/shared.ts, server/preview.ts, model/artifacts.ts (+ tests) | modify, create (Task 3) | per-slide art, panorama windows, the tint, the planned scene in the art area: **`SlideArt`** |
| layout/relayout.ts, server/commands/look.ts, lib/workflow.ts, actions.ts (+ tests) | create, modify (Task 4) | swap a layout, change a look, choose a preset: **`layoutOptions`, `relayout`** |
| ai/draft.ts, ai/caption.ts, ai/art.ts, ai/design-language.ts (+ tests) | modify (Task 5) | the guideline in every prompt |
| ai/ideas.ts, ai/prompts.ts, ai/config.ts, ai/fake.ts, lib/places.ts, server/commands/source.ts, server/commands/ideas.ts, model/artifacts.ts, shared/lib/db/content-shapes.ts, migration 0009 (+ tests) | create, modify (Task 6) | idea cards and drafting for an idea: **`IdeaCard`** |
| content/nudges/nudges.json, nudges/index.ts, ai/draft.ts, server/commands/structures.ts (+ tests) | create, modify (Task 7) | text chips, use a slide from another version: **`TEXT_NUDGES`, `IMAGE_NUDGES`** |
| ai/scene-plan.ts, ai/art.ts, server/commands/images.ts, model/artifacts.ts (+ tests) | create, modify (Task 8) | plan, draw and nudge images |
| components/steps/IdeasStep.tsx, components/steps/StructuresStep.tsx, components/LayoutPicker.tsx (+ tests) | create, modify (Task 9) | the ideas and versions screens |
| components/steps/ImagesStep.tsx, components/steps/RenderStep.tsx, components/Workbench.tsx (+ tests) | create, modify (Task 10) | the images screen |
| server/social.ts (+ test) | modify (Task 11) | social versions of look posts; old posts unchanged |
| scripts/ai-smoke.ts | modify (Task 12) | live checks for the new specs |
| components/steps/StructuresStep.tsx, components/StageRail.tsx, components/steps/SourcePane.tsx, components/FactChip.tsx, lib/version-status.ts (+ tests) | modify, create (Task 14, built with Task 9) | the slides-first workbench, plain step names, the folded source |
| src/app/admin/(console)/posts/[id]/[step]/page.tsx, lib/steps.ts, components/Workbench.tsx, components/StageRail.tsx (+ tests) | create, modify (Task 15) | one screen per step |
| model/artifacts.ts (source parts), server/commands/source.ts, ai/extract.ts, layout/engine.ts, components/steps/SourceForm.tsx, components/steps/SourcePane.tsx (+ tests) | modify (Task 13, built after Task 5) | several links, a framing line, notes kept as opinion |

## Task 1: The brand guideline file and the two presets
**Delivers:** GD9 (presets), GD17 (one file drives them); the data GD15 and GD16 use.
**Files:** create `src/features/content/brands/guideline.json`, `brands/guideline.ts`, `brands/guideline.test.ts`.
**Kind:** judgement
- **`guideline.json`**, with stand-in values from the brand files until Nikhil's guideline arrives (intent open question 1):
  - **Palette:** `palette: [{ name, hex, role }]`, with blue `#1877F2`, yellow `#F5C542`, paper `#F4EFE6`, ink `#16191B`, white `#FFFFFF`, light blue `#E3EDFD` and stone `#5F5D58`.
  - **Presets:** `presets: { pop, subdued }`. Each maps the surfaces `base`, `block` and `deep` to `{ bg, ink, highlight, muted }` by palette name.
    - Pop: base white or paper; block yellow with ink; deep blue with white.
    - Subdued: base paper; block light blue with ink; deep paper with blue as the highlight.
  - **Tints:** `tint: { pop: { shadow, light }, subdued: { wash, strength } }`.
  - **Art:** `art: { style, dos: string[], donts: string[], neverShow: string[] }`.
  - **Voice:** `voice: { rules: string[], readingLevel }`.
- **`guideline.ts`** (the one definition):
  - `GUIDELINE` (parsed with zod at load, so a bad file fails at start);
  - `PRESETS = ['pop', 'subdued'] as const`, `type Preset`;
  - `type Surface = 'base' | 'block' | 'deep'`;
  - `presetThemes(preset): Record<Surface, Theme>`. `Theme` is `ThemeSchema`, `model/types.ts:102`, with ids like `pop-base`;
  - `guidelineFor(use: 'image' | 'copy'): string`. It returns the parts a call needs as fixed sentences: for images the palette by name and hex, the style, the dos, the don'ts and never-show; for copy the voice rules and reading level.
  - `paletteHexes(): string[]`.
- **Unit tests:**
  - every preset's surfaces resolve to hex colours from the palette;
  - ink on bg is at least 4.5:1, and ink on highlight is at least 4.5:1, for every surface of both presets (`contrastRatio`, `text/contrast.ts:5`);
  - `guidelineFor('image')` contains every palette name with its hex and every never-show item, and none of the voice rules;
  - `guidelineFor('copy')` holds the voice rules and none of the hexes;
  - a guideline loaded with a changed hex changes `presetThemes` and `guidelineFor` (inject the parsed object through an exported `compile(guideline)` helper, so the test needs no file write).
- Commit `feat(content): one brand guideline file with Pop and Subdued presets`.

## Task 2: The three looks, layouts chosen per slide, surfaces and the frame
**Delivers:** GD4 (looks as layouts), GD6, GD8, GD9 (layout in a preset).
**Files:** modify `model/types.ts` (+ test), `templates/index.ts` (+ `templates.test.ts`), `layout/engine.ts` (+ test), `layout/svg.ts` (+ test), `layout/fit.ts` (+ test); create `templates/field-notes.json`, `templates/data-desk.json`, `templates/postcard.json`.
**Kind:** judgement
- **Schema:**
  - `SlideSchema` (`types.ts:39`) gains `layout: z.enum(LAYOUT_IDS).nullable().default(null)`;
  - `SlideSpecSchema` (`:80`) gains `surface: z.enum(['base','block','deep']).default('base')` and `panel: z.boolean().default(false)` (the slots sit on a light card over full-bleed art);
  - `TemplateSchema` (`:88`) gains `look: z.boolean().default(false)` and `layouts: z.record(z.enum(LAYOUT_IDS), SlideSpecSchema).optional()`.
  - `LAYOUT_IDS = ['cover','picture','number','bars','quote','checklist','takeaway'] as const` and `type LayoutId` are exported from `model/types.ts`.
  - Slide kinds stay `cover | body | take | single`. Each layout states its kind: cover is `cover`, takeaway is `take`, the rest are `body`.
  - Old records parse with `layout: null`.
- **Slot keys, the same in every look:**
  - cover: `kicker`, `heading`;
  - picture: `heading`, `body` (15–25 words, factual);
  - number: `number` (a figure, presentational), `label`, `body`;
  - bars: `heading`, `labelA`, `valueA`, `labelB`, `valueB`;
  - quote: `quote` (factual), `credit`;
  - checklist: `heading`, `items` (2–4 lines, one per line break);
  - takeaway: `heading`, `body`.
  The art boxes and surfaces follow the design board (https://claude.ai/artifact/F6D5AWxdEdLZRzwruohB99):
  - **Field Notes:** cover full-bleed art with a block band; picture with a top art box (1080×540); number on base.
  - **Data Desk:** cover on deep with a small spot art box; number on block; bars on base; takeaway on deep.
  - **Postcard:** every layout `panel: true` with a full-slide art box.
  - Body text runs 44–52 px, headings 72–110 px and numbers 200–300 px, never below the floor.
- **Registry:**
  - `LOOKS` = the three look templates, and `TEMPLATES` becomes `LOOKS` (what "Make post" offers).
  - `LEGACY_TEMPLATES` = the four old ones.
  - `templateById` (`:25`) searches looks, legacy and `QUOTE_CARD`, so old posts and their frozen templates still resolve (GD8).
  - `isLook(template)` is exported.
- **Engine:** `slideSpec(template, slide)` (`engine.ts:47`) returns `template.layouts[slide.layout]` when the template is a look and the slide has a layout, else today's first-by-kind rule. Update its callers: it takes the slide, not only the kind.
  - **The frame**, drawn for look templates only: slide dots (one per slide, the current one solid) and "Swipe →" on every slide but the last, in the frame row at the slide foot, beside the source line where the slide has one.
  - **Surfaces:** `svgSlides` draws each slide with the theme of its spec's surface from `presetThemes(preset)` (Task 1) when the template is a look. The preset comes from the revision's `themeId`, which is `'pop' | 'subdued'` for look posts. Old templates keep a single theme.
  - **Panel:** when `spec.panel`, a white rectangle at 90% opacity with 14 px corners is drawn under the slots' union box plus 48 px padding.
- **`fitChecks`** (`fit.ts:22`): for a look, contrast is checked per surface used (ink on bg, and ink on highlight where a slot has a mark).
- **`templates.test.ts`:**
  - the ids line (`:21`) becomes the looks plus legacy;
  - the body-limit rule (`:77-83`) applies to legacy templates, and looks' body slots are capped at 25 words;
  - the box-overlap rule allows slots over an art box when `panel` is true;
  - every look defines all seven layouts with exactly the slot keys above.
- **Tests:**
  - a structure in each look with one slide per layout lays out and passes `fitChecks` with Pop and with Subdued;
  - `slideSpec` picks by layout for a look and by kind for `the-line`;
  - the SVG of a look slide holds the dots with the current one solid, and "Swipe" on every slide but the last;
  - a stored `the-line` revision renders byte-identical SVG to before (capture the SVG string before changing the engine and pin it as the expected value: a regression pin, not a look check);
  - a block-surface slide uses the preset's block bg.
- Commit `feat(content): three looks built from shared slide layouts, with surfaces and a frame`.

## Task 3: An image per slide, a panorama, the brand tint, the planned scene
**Delivers:** GD16; the drawing side of GD12–GD14 (one image per art box), Postcard's panorama (GD4).
**Files:** modify `layout/svg.ts`, `layout/render.ts`, `server/commands/shared.ts` (`draw` `:193`), `server/preview.ts` (`draftPreviewPng` `:46`, `layoutPreviewPng` `:76`), `model/artifacts.ts` (the `render` body `:92`); create `layout/tint.ts`; tests beside each.
**Kind:** judgement
- **`SlideArt`** (the one definition, in `model/types.ts`): `{ slide: number; assetId: string | null; scene: string; take: number; nudge: string | null; fallback: 'no_art' | 'daily_limit' | null }`.
  - `BODIES.render` gains `slideArt: z.array(SlideArtSchema).optional()` and `panorama: z.object({ assetId: z.string() }).nullable().optional()`.
  - A render without them keeps its single `art` (old posts unchanged).
  - The comics plan reuses `slideArt` for its panels; tell nothing else.
- **`svgSlides`** (`svg.ts:72`):
  - It gains `arts?: (string | null)[]`, indexed by slide, and `panorama?: string`. With `arts`, slide i's art box takes `arts[i]`. With `panorama`, slide i shows window i of the wide image: a nested `<svg>` with a `viewBox` offset.
  - Windows are evenly spaced across the image's width, each the art box's aspect ratio. They overlap when the image is narrower than the slides end to end; read the image's pixel size from its PNG header.
  - With neither, today's single `art`.
- **`layout/tint.ts`:** `tintFilter(preset, guideline): string` returns an SVG `<filter>` definition.
  - **Pop:** a duotone. `feColorMatrix type="matrix"` to luminance, then `feComponentTransfer` with `feFuncR`, `feFuncG` and `feFuncB` `type="table"`, mapping dark to the tint's shadow (brand blue) and light to its light (paper or yellow).
  - **Subdued:** desaturate to 40%, then blend a brand wash at the guideline's strength.
  - `svgSlides` puts it in `<defs>` and sets `filter="url(#tint)"` on every art `<image>` of a look template.
  - The stored image asset is never changed (GD16: "the original is kept").
- **The planned scene in the art area:** `draftPreviewPng` and `layoutPreviewPng` gain `planned?: (string | null)[]`, indexed by slide. With no art, the slide draws "Planned scene" (overline) and the scene text in the art box, wrapped, at the legibility floor or larger, on a muted fill. The preview route (`app/admin/(console)/posts/[id]/preview/route.ts`) passes the scenes of the current `art_plan` (Task 8) or the slide's `scene` field. Leave the route change to Task 8, which creates the record.
- **Tests:**
  - `arts: [a, null, b]` puts `a` in slide 1, none in slide 2 and `b` in slide 3;
  - a panorama over 4 slides gives 4 windows whose x offsets increase and cover the image from left edge to right edge;
  - the SVG of a look slide with art holds the tint filter, and a legacy slide does not;
  - **pixel check (brain, not beauty: the colour mapping is a decision):** rendering a mid-grey test PNG through `toPng` (`layout/png.ts:9`) with the Pop tint gives a pixel whose colour is closer to the mix of the tint's shadow and light than to grey;
  - a preview with a planned scene contains its text.
- Commit `feat(content): an image per slide, a panorama across slides, and images tinted to the brand`.

## Task 4: Swap a slide's layout, change the look, choose the preset
**Delivers:** GD4 (change look, no model call), GD5, GD9 (choose preset).
**Files:** create `layout/relayout.ts` (+ test), `server/commands/look.ts` (+ DB tests in `server/commands.test.ts`); modify `lib/workflow.ts` (+ test), `actions.ts` (+ test), `src/app/admin/(console)/posts/[id]/page.tsx` and `components/Workbench.test.tsx` (action wiring: `WorkbenchActions` is typed as every action).
**Kind:** judgement
- **`layoutOptions(slide: Slide, facts: Fact[]): { id: LayoutId; ok: true } | { id: LayoutId; ok: false; reason: string }[]`** (pure; `layout/relayout.ts`):
  - number needs a figure in a fact bound on the slide: `Big number needs a number from a fact on this slide.`
  - bars need two figures in bound facts: `Bars need two numbers from facts on this slide.`
  - checklist needs at least two sentences or lines: `A checklist needs two or more points.`
  - quote needs a factual sentence: `A quote needs a sentence from the source.`
  - cover and takeaway are offered only at the first and last place; picture always fits.
- **`relayout(slide: Slide, to: LayoutId, facts: Fact[]): Slide`** (pure) maps text by slot key.
  - It keeps the keys both layouts share.
  - It derives the new ones by code:
    - `number` and `label` come from the first bound fact's `value` and its sentence;
    - `items` come from the body's sentences, one per line;
    - `labelA`, `valueA`, `labelB` and `valueB` come from two bound facts;
    - a quote's text is the bound fact's sentence.
  - It drops keys the new layout lacks, keeps `factIds`, and sets `layout` and `kind`.
  - It never calls a model.
- **Commands**, each through `command()` (`server/commands/shared.ts:148`) at `structures`, saving a new drafts record with a note, as `editPickedSlot` does (`structures.ts:194`):
  - `setSlideLayout(actor, id, version, { index, slide, layout })`: refused with the option's reason when not ok; the note is `Slide <n>: <layout label>`;
  - `setLook(actor, id, version, { index, look })`: changes the version's `templateId` and frozen template to that look, keeping slides and layouts; the note is `Look: <name>`;
  - `setPreset(actor, id, version, { preset })`: sets the post's `themeId` to `'pop' | 'subdued'` (`chooseTheme`, `structures.ts:362`, accepts these for a look post).
- **Workflow:** `setSlideLayout`, `setLook` and `setPreset` are editor actions at `['structures']`. Each gets an action that follows `onPost`.
- **Tests:**
  - **Unit:**
    - a slide with no number in its facts gets number disabled with the reason;
    - relayout from picture to number fills `number` from the fact and keeps `body`;
    - picture to checklist splits sentences into `items`;
    - checklist back to picture joins them;
    - fact ids are kept.
  - **DB:**
    - `setSlideLayout` saves a new drafts record with the slide's layout and text mapped, and makes no model call (the fake provider records none);
    - a disabled layout is refused;
    - `setLook` changes the template and keeps every slot's text;
    - `setPreset('subdued')` makes the preview draw on Subdued surfaces;
    - a non-editor is refused.
- Commit `feat(content): swap a slide's layout, change the look and choose the colour preset`.

## Task 5: The brand guideline in every prompt
**Delivers:** GD15.
**Files:** modify `ai/draft.ts` (`draftStructures` data `:239-249`, `redraftSlide` data `:406-420`), `ai/caption.ts` (`:146`), `ai/art.ts` (`coverPrompt` `:62`), `ai/design-language.ts` (`:45`), and their tests.
**Kind:** judgement
- **Copy:** draft, "Another take" and caption data gain `brand_voice: guidelineFor('copy')` (Task 1) in place of `tone: FEED_BRAND.tone` (`draft.ts:241`, `:417`; `caption.ts:146`). The page's `copy_style` still rides along when there is one.
- **Images:** `coverPrompt` (and Task 8's slide-art prompt) appends `guidelineFor('image')` after the scene. A page's `artStyle`, when set, still replaces the guideline's style sentence only.
- **Design language:** the `DESIGN_LANGUAGE` data gains the guideline's art style, so a description of reference images is phrased against it.
- **Prompt versions:** bump them (`draft.v5`, `draft_slide.v3`, `caption.v4`), since the prompt text changed and the cache keys must change with it.
- **Tests:**
  - the data sent for a draft contains the guideline's voice rules and no `FEED_BRAND.tone`;
  - a cover prompt contains each palette hex and the never-show items;
  - a page art style replaces only the style sentence;
  - with a guideline compiled from a changed object (Task 1's `compile`), the next prompt carries the change.
  - The spec examples still parse (`schema.safeParse(example.answer)`).
- Commit `feat(content): every Gemini prompt carries the brand guideline`.

## Task 6: Idea cards first
**Delivers:** GD1, GD2, GD3, GD7.
**Files:** create `ai/ideas.ts` (+ test), `lib/places.ts` (+ test), `server/commands/ideas.ts` (+ DB tests); modify `ai/prompts.ts` (`IDEAS`; `DRAFT` gains `layout` per slide and the idea), `ai/config.ts` (`UseCase` gains `'ideas'`), `ai/fake.ts` (+ test), `ai/draft.ts`, `model/artifacts.ts` (`ideas` body), `src/shared/lib/db/content-shapes.ts` (`ARTIFACT_KINDS` gains `ideas` and `art_plan`; `PointersSchema` gains `ideasId` and `artPlanId`, each `ref.default(null)`), migration 0009 (re-create the kind check, as `0004_content_artifact_covers.sql` does), `server/commands/source.ts` (`makePost` `:105`), `lib/workflow.ts`, `actions.ts` (+ tests).
**Kind:** judgement
- **`placesIn(facts: Fact[]): string[]`** (`lib/places.ts`): the city names in `CITIES` (`@/features/engine`) and the countries Australia, United Kingdom, UK, New Zealand, United States, USA, Nepal, India and Thailand that the facts' text names, matched case-insensitively on word boundaries.
- **`IDEAS`**: use case `ideas`, version `ideas.v1`, tier `lite`, temperature 0.8.
  - Schema `{ cards: [{ angle, hook, audience, look, slides }] }`. `look` is one of the three look ids.
  - Rules:
    - 4 to 6 distinct ideas;
    - a hook of at most 90 characters, with no numbers unless a fact holds them;
    - the audience in a few words;
    - slides between 4 and 8;
    - suggest `postcard` only when `places` is not empty;
    - fewer cards (at least 2) when the source supports fewer;
    - `avoid` lists hooks already shown.
  - Data: the facts, the paragraphs, `brand_voice`, the looks with one line each, `places`, `avoid`, and the source's framing line as `editor_intent` (Task 13; GD20: the cards serve it, and IdeasStep shows it above the cards).
  - `verify`:
    - count 2–6;
    - a look id from the list;
    - postcard refused when there are no places;
    - hooks within 90 characters, free of banned phrases, and with numbers only from facts (`numbersIn`, `text/numbers.ts:132`).
  - A fake answer of 4 cards, honouring `[fake:fail-ideas]`.
- **`BODIES.ideas`**: `{ factsId, cards: IdeaCard[], rounds: number }`, where `IdeaCard = { angle, hook, audience, look: LookId, slides: number }` is the one definition, exported from `model/types.ts`.
- **`makePost`** (`source.ts:105`): after extract, it runs the ideas step (`runStep(id, 'ideas', …)`) instead of drafting, and stops at `structures` with `ideasId` set and no drafts. The editor picks next. A failed ideas step keeps the facts and offers "Try again" (criterion 93's rule).
- **`pickIdeas(actor, id, version, { cards: number[] })`**: 1 or 2 indexes. It drafts three versions in the first card's look (one template), with the idea(s) in the draft data. With two cards, both angles and hooks go in as "combine these".
  - `DRAFT`'s schema gains `layout` per slide (one of the seven), and its rules gain "choose each slide's layout from the look's layouts". `templateData()` (`draft.ts:188`) sends the look's layouts and slot keys. `toStructure` (`draft.ts:59`) sets `layout` and `kind` from it.
  - The drafts record gains `idea: { cards: IdeaCard[] } | null` (default null), shown on each version as "For: <angle>".
- **`moreIdeas(actor, id, version)`**: calls `IDEAS` with `avoid` (the shown hooks) and saves a new `ideas` record with the old cards plus up to 4 new ones, and `rounds + 1`.
- **Workflow:** `pickIdeas` and `moreIdeas` are editor actions at `['structures']`, each with an action.
- **Tests:**
  - **Unit:**
    - `placesIn` finds "Perth" and "Australia" and nothing in a fact without places;
    - `IDEAS`' example parses;
    - verify refuses postcard with no places, 7 cards, and a 91-character hook.
  - **DB:**
    - "Make post" stops with an ideas record and no drafts;
    - picking card 2 drafts 3 versions in that card's look, each slide with a layout, and the drafts record carries the idea;
    - combining two cards passes both;
    - "More ideas" keeps the old cards and adds new ones;
    - a `[fake:fail-ideas]` source keeps the facts and the step offers Try again;
    - a non-editor is refused.
- Commit `feat(content): idea cards before drafting, and drafts made for the chosen idea`.

## Task 7: Steer text with chips, and use a slide from another version
**Delivers:** GD10, GD11.
**Files:** create `src/features/content/nudges/nudges.json`, `nudges/index.ts` (+ test; the `emotions/` pattern); modify `ai/draft.ts` (+ test), `ai/prompts.ts` (`DRAFT` and `DRAFT_SLIDE` take a `nudge`), `ai/fake.ts`, `server/commands/structures.ts` (+ DB tests), `lib/workflow.ts`, `actions.ts` (+ tests).
**Kind:** judgement
- **`nudges.json`**:
  - `text`: shorter, simpler, personal, surprising, practical, warmer, each `{ id, label, instruction }`, for example "Shorter: cut each slot to about two thirds, keep every fact";
  - `image`: closer, wider, more-people, fewer-things, warmer-light, calmer.
  - `nudges/index.ts` exports `TEXT_NUDGES`, `IMAGE_NUDGES`, `textNudge(id)` and `imageNudge(id)`.
- **`nudgeSlide(actor, id, version, { slide, nudge })`**: `redraftSlide` (`structures.ts:293`) with the nudge's instruction in its data (`DRAFT_SLIDE` gains `nudge: string | null`). It is verified like "Another take" (`withSlideTake`, `draft.ts:317`), and the note is `Slide <n>: <label>`.
- **`nudgeVersion(actor, id, version, { index, nudge })`**: one `DRAFT` call with `base` (that version's slides) and the nudge, asking for one version. It replaces that version in a new drafts record, and the note is `Version <letter>: <label>`.
  - The facts, bindings and number checks hold as for any draft (`problemsIn`, `draft.ts:141`). A version that fails verification keeps the old wording and returns `Could not <label>. Try again.`
- **`useSlide(actor, id, version, { from: number; slide: number })`**: copies slide `slide` of version `from` into the picked version at the same place, layout and fact ids included. It is refused when the picked version has no slide there (`That version has no slide <n>.`). The note is `Slide <n> taken from version <letter>`, and it makes no model call.
- **Workflow:** `nudgeSlide`, `nudgeVersion` and `useSlide` are editor actions at `['structures']`, each with an action.
- **Tests:**
  - **Unit:** the nudge files parse, and the ids are unique.
  - **DB (fake provider):**
    - `nudgeSlide('shorter')` changes only that slide, and the data sent carries the instruction;
    - `nudgeVersion` changes only that version;
    - a nudge whose answer changes a number is refused and keeps the old text;
    - `useSlide` copies the slide with its fact ids and makes no model call;
    - each saves a history entry;
    - a non-editor is refused.
- Commit `feat(content): steer text with chips and take a slide from another version`.

## Task 8: Plan images in words, draw them, nudge one
**Delivers:** GD12, GD13, GD14.
**Files:** create `ai/scene-plan.ts` (+ test), `server/commands/images.ts` (+ DB tests); modify `ai/prompts.ts` (`SCENE_PLAN`), `ai/config.ts` (`'scene_plan'`), `ai/fake.ts`, `ai/art.ts` (`slidePrompt`, and `coverArt` gains `aspectRatio` `'4:5' | '1:1' | '21:9'`, passed to `generateImage`, whose type `ai/client.ts:412` widens to match; installed `@google/genai` 2.27 types `ImageConfig.aspectRatio` as a string and its `AspectRatio` enum includes `21:9`, `genai.d.ts:648`), `model/artifacts.ts` (`art_plan` body), `lib/workflow.ts`, `actions.ts` (+ tests), the preview route (passes the plan's scenes as `planned`, Task 3).
**Kind:** judgement
- **`BODIES.art_plan`**: `{ revisionId, scenes: { slide: number; scene: string }[], panorama: boolean }`. `current()` keeps it only while `revisionId` matches (the covers rule, `model/current.ts:53`).
- **`SCENE_PLAN`**: use case `scene_plan`, version `scene_plan.v1`, tier `lite`.
  - Data: each art-box slide's text and layout, the idea, the look, the emotion and `guidelineFor('image')`.
  - Schema `{ scenes: [{ slide, scene }] }`.
  - Rules: what is seen only; no words, numbers, logos or brands; at most 200 characters each; one consistent student character across slides; for Postcard, one wide scene described left to right across the slides.
  - `verify`: one scene per art-box slide, each passing `artPromptError` (`draft.ts:51`).
  - A fake answer.
- **Commands** (look posts only; legacy posts keep "Make covers"):
  - **`planImages(actor, id, version)`** at `approved`: calls `SCENE_PLAN` and puts an `art_plan` record. Postcard sets `panorama: true` with one scene.
  - **`editImageScene(actor, id, version, { slide, text })`** at `approved`: 1–200 characters, `artPromptError`; puts a new `art_plan`.
  - **`drawImages(actor, id, version)`** at `approved`: requires a current plan (`Plan the images first.`), and pressing it is the approval.
    - For each planned slide in order, it draws with `coverArt`:
      - `slidePrompt({ scene, emotion, guideline, nudge: null })`;
      - aspect `4:5` for full-slide art boxes, `1:1` for square ones (choose by the art box's ratio), or one `21:9` image for a panorama;
      - the page's reference images;
      - `set` = render art version, `option` = slide.
    - It puts a `render` with `slideArt` (or `panorama`) and moves to `rendered`, through the existing render path (`renderPost`, `server/commands/render.ts:82`, with `arts` from Task 3).
    - At the daily limit, it keeps the images drawn and marks the rest `daily_limit` (GD14). "Draw remaining" (the same command at `rendered`) draws only the missing ones.
  - **`nudgeImage(actor, id, version, { slide, nudge })`** at `rendered`: draws that slide again with the image nudge's instruction (take + 1). The new render keeps every other slide's `assetId`, and the earlier take stays in the render history ("Swap image" lists it, `RenderStep.tsx:108`).
- **`imagesFor(template, structure): number`** (pure): the count shown before "Draw images": the art-box slides, or 1 for a panorama.
- **Workflow:** `planImages`, `editImageScene`, `drawImages` (`['approved', 'rendered']`) and `nudgeImage` (`['rendered']`) are editor actions. The `render` and `makeCovers` actions refuse a look post with `Use Draw images for this post.`
- **Tests:**
  - **DB (fake provider):**
    - plan, then edit, then draw: each image request carries its own scene and the guideline;
    - nudge slide 2 with `closer`: only slide 2's asset changes, and the request carries the nudge;
    - with `AI_DAILY_CAP_IMAGE=2` and 4 art slides, two are drawn and two are `daily_limit`, and "Draw remaining" draws only those;
    - Postcard makes one `21:9` request;
    - draw without a plan is refused;
    - a non-editor is refused.
  - **Unit:** `imagesFor` per look; the `SCENE_PLAN` example parses; a scene with a digit fails verify.
- Commit `feat(content): plan each image in words, draw them, and nudge one`.

## Task 9: The ideas and versions screens
**Delivers:** the controls of GD1–GD5, GD9, GD10, GD11.
**Files:** create `components/steps/IdeasStep.tsx` (+ test), `components/LayoutPicker.tsx` (+ test); modify `components/steps/StructuresStep.tsx` (+ test), `components/Workbench.tsx` (`Steps` `:62`), the workbench view builder in `src/app/admin/(console)/posts/[id]/page.tsx` (ideas, layout options, nudges).
**Kind:** judgement
Read `src/design-systems/industry/DESIGN.md` first.
- **`IdeasStep`** (shown at `structures` when the post has an `ideasId` and no drafts): the cards in a grid (`repeat(auto-fit, minmax(…, 1fr))`), each with:
  - the angle as its title, the hook, "For: <audience>", and the suggested look and slide count;
  - "Use this idea", or a tick for "Combine" (at most two ticked);
  - then "More ideas".
  - A running ideas step shows its state, as other steps do.
- **`StructuresStep`, for a look post:**
  - The template ticks are gone. The idea shows above the versions ("For: <angle>", with "Back to ideas" to see the cards again without losing the versions).
  - Each version has a look switch (three options) and the chips `TEXT_NUDGES` for the whole version.
  - The preset switch, Pop or Subdued, replaces the theme buttons for look posts (`StructuresStep.tsx:395-428`).
  - Under each slide of the picked version are:
    - the `LayoutPicker`;
    - the text chips for that slide;
    - on another version's slide, "Use this slide in my version".
  - "Another take" stays for legacy posts only. A nudge chip with no direction is the same thing.
- **`LayoutPicker`**: the seven layouts as small labelled previews. Disabled ones show their reason (from `layoutOptions`, Task 4) as text, not only a tooltip. Choosing one calls `setSlideLayoutAction`.
- Legacy posts show the step as today.
- **Tests (behaviour):**
  - "Use this idea" calls `pickIdeasAction` with that index;
  - ticking two shows "Combine", and a third tick is disabled;
  - a disabled layout shows its reason and does not call the action;
  - a chip calls `nudgeSlideAction` with its id;
  - "Use this slide in my version" calls `useSlideAction` with the source version and slide;
  - the preset switch calls `setPresetAction`;
  - a legacy post still shows the template ticks.
- Commit `feat(content): the ideas and versions screens for choosing and nudging`.

## Task 10: The images screen
**Delivers:** the controls of GD12–GD14.
**Files:** create `components/steps/ImagesStep.tsx` (+ test); modify `components/steps/RenderStep.tsx` (+ test), `components/Workbench.tsx`.
**Kind:** judgement
- **`ImagesStep`** (look posts at `approved` and `rendered`, in place of `RenderStep`'s cover controls; the settings and review controls stay):
  - "Plan images", then each art-box slide's preview with its planned scene in the art area, editable in place through `EditableSlidePreview`'s art-area slot. If Task 7 of the comics plan has not added that slot, add `kind: 'scene'` to `EditableSlot` here, saved through `onSave('scene', …)`.
  - "Draw images (<n> images)", using `imagesFor`.
  - After drawing:
    - each image's slide;
    - the `IMAGE_NUDGES` chips;
    - "Swap image" to an earlier take (`RenderStep.tsx:108` already lists earlier art);
    - a slide not drawn reads "Daily image limit reached" or "No art", with "Draw remaining".
- **Tests (behaviour):**
  - "Draw images" shows the count and calls `drawImagesAction`;
  - editing a planned scene calls `editImageSceneAction`;
  - a nudge chip calls `nudgeImageAction` with the slide and the chip;
  - a `daily_limit` slide shows the label and "Draw remaining";
  - a legacy post shows "Make covers" as today.
- Commit `feat(content): the images screen: plan, draw and nudge`.

## Task 11: Social versions of look posts; old posts unchanged
**Delivers:** GD8; the social half of GD4 and GD12.
**Files:** modify `server/social.ts` (`createVersion` `:136`, `renderSocial` `:382`, `makeSet` `:331`; + `server/social.test.ts`, DB).
**Kind:** judgement
- **A social version of a look post:**
  - keeps the look and the post's preset;
  - re-lays out with the page brand's fonts (the page's single theme is not used for look posts: surfaces come from the preset);
  - draws the parent render's `slideArt`, or its `panorama`, slide by slide, with the tint.
  - It draws its own cover only for legacy posts, as today (`:416`).
- **The quote card** (`QUOTE_CARD`) is unchanged.
- **Tests (DB):**
  - adapting a look post for `main` renders each slide with the parent's per-slide art and the post's preset surfaces;
  - a Postcard post's social version shows the same panorama windows;
  - a legacy `the-line` post adapts and renders exactly as before (the stored SVG of an existing test post matches);
  - `makeSet` on a look post makes its versions and the quote card.
- Commit `feat(content): social versions keep a post's look, preset and pictures`.

## Task 12: The new prompts in the live smoke run
**Delivers:** a live check, by hand, of `IDEAS`, `SCENE_PLAN` and a nudge (not a criterion).
**Files:** modify `scripts/ai-smoke.ts`.
**Kind:** judgement
- Add one call each:
  - `ideas` (the paid-work demo source's facts);
  - `scene_plan` (a Field Notes structure with two art-box slides);
  - `draft_slide` with the `shorter` nudge.
- Print them in the script's line format. Do not run it: it calls Vertex.
- Type-check and lint.
- Commit `chore(content): the idea, scene-plan and nudge prompts in the live smoke run`.


## Task 13: Links in, points out, framed by one line (build after Task 5, before Task 6)
**Delivers:** GD18, GD19, GD20 (the stored framing line; Task 6 feeds it to the ideas), GD21.
**Files:** modify `model/artifacts.ts` (`BODIES.source` `:32`, + test), `server/commands/source.ts` (`makePost` `:105`, `sourceFrom`, `readSource`, `remakeFromSource` from story 14; + DB tests in `server/commands.test.ts`), `server/fetch-page.ts` (unchanged API; called once per link), `ai/extract.ts` (+ test), `layout/engine.ts` (the source line `:144-151`, + test), `components/steps/SourceForm.tsx` (+ test), `components/steps/SourcePane.tsx` (the remake form at stage `source`, + test), `actions.ts` (`makePostAction` input, + test).
**Kind:** judgement
- **The source record** gains, all optional so stored sources parse:
  - `parts: { url: string; site: string; title: string; from: number; to: number }[]`, one per link read. `from` and `to` are the paragraph range (`¶from` to `¶to`) that link's text fills;
  - `failed: { url: string; error: string }[]`;
  - `framing: string | null`, up to 200 characters;
  - `notes: string | null`, up to 2,000 characters.
  The paragraphs of all parts run in one sequence (`¶1` … `¶n`), so fact refs and sentence ids keep their shape (`¶2.3`). A single-link source still sets `url` and `site` as today. Each article is capped at its first 60 paragraphs.
- **`makePost`** input becomes `{ requestId, links: string[] (0–5), text?: string, title?: string, framing?: string, notes?: string, pageBrandId? }`.
  - **Refusals:** more than 5 links gets `Up to five links.`; no links and no text gets `Paste a link or some text.`; a framing line over 200 characters gets `Keep it to 200 characters.`
  - **Reading:** links are read in parallel with `fetchPage` (`server/fetch-page.ts:232`, through `Promise.allSettled`). Failures go to `failed`. When every link fails, nothing is made and the result lists each failed link with `Could not read this page` (`PAGE_ERROR`, `:14`).
  - **Title:** the first readable part's title, unless the editor typed one.
  - **Extraction:** one call over all parts' numbered sentences (`extract.v2`, criterion 95). The framing line is passed as `editor_intent`, to choose key ideas only, never to invent facts. The notes are **never** sent as source text.
- **Facts and source lines:** `paragraphSite(source, ref): string | null` (pure, in `lib/` or beside `layoutStructure`) gives the site of the part that holds `ref`. `layoutStructure`'s input gains `sites?: Record<string, string>` (ref to site). A slide's source line names the distinct sites of its facts, as "Source: abc.net.au" or "Sources: abc.net.au, studyaustralia.gov.au", ellipsised as today. With no parts, it is today's line.
- **Notes as opinion:** the notes go into draft data as `editor_notes`, with the rule "may be used as the editor's opinion, never as a fact or a number". A slot written from them is not factual, so the source check reads it as opinion (criterion 43's mark). A number that appears only in the notes fails the existing number checks (`problemsIn`, `ai/draft.ts:141`).
- **`SourceForm`** (`components/steps/SourceForm.tsx`):
  - **Links:** a textarea, one per line. Placeholder `https://… one link per line, up to five`; help text "We read each article and pull out its points."
  - **Framing:** an input. Placeholder `e.g. Show first-year students why 20 hours is the limit`; help text "Tell Gemini the story you want to tell. Optional."
  - **Notes:** a textarea. Placeholder `Your own view or experience`; help text "Kept as your opinion, never used as a fact. Optional."
  - "Paste text instead" opens today's text box with its title field.
  - The page choice and "Make post" stay. Failed links show under the field after a run.
- **The source pane's remake form** (story 14, Task 62) uses the same fields, prefilled from the current source.
- **Tests:**
  - **DB (fake provider; inject the page reader as `makePost`'s `read` argument, as Task 51 does):**
    - two links make one source with two parts and continuous paragraph refs; facts from both;
    - one failing link of two is listed in `failed` while the other is used;
    - every link failing makes nothing and lists both;
    - six links are refused;
    - the framing line is in the extract data, and the notes are not;
    - the notes reach the draft data as `editor_notes`.
  - **Unit:**
    - `paragraphSite` for refs in each part;
    - a slide whose facts come from two parts gets "Sources: a, b";
    - a stored single-link source parses and lays out as before.
  - **Component:**
    - the placeholders and help texts show;
    - "Paste text instead" reveals the text box;
    - a sixth link line shows the limit message and disables "Make post".
- Commit `feat(content): make a post from several links, framed by one line, with your notes kept as opinion`.


## Task 14: The workbench shows the slides, not a wall of text (build with Task 9)
**Delivers:** GD22, GD23, GD24, GD25, GD26. Applies to look posts and legacy posts alike.
**Files:** modify `components/steps/StructuresStep.tsx` (the `DraftCard` and slot list, `:312-316`, `:546-595`; + test), `components/StageRail.tsx` (+ test; the labels Task 63 of story 14 linked), `components/steps/SourcePane.tsx` (+ test), `components/FactChip.tsx` (+ test), `components/Workbench.tsx`, and the component that renders key ideas (find where key ideas are cut: likely a `slice`/`truncate` in `SourcePane.tsx`; + a test that pins whole text); create `lib/version-status.ts` (+ test).
**Kind:** judgement
Read `src/design-systems/industry/DESIGN.md` first, and follow the redesign board (https://claude.ai/artifact/RxBz892AziFiYckdLp1Pxb): Blueprint frames, one primary button, status as a one-word tag, whitespace between sections.
- **`versionStatus(item: DraftItem, checks: FitCheck[], facts: Fact[]): { ready: boolean; problems: { text: string; fix?: { kind: 'nudge'; nudge: 'shorter'; slide: number } | { kind: 'layout'; slide: number; layout: LayoutId } }[] }`** (pure). The problems come from the failing fit rows, `problems`, unbound slots and not-found claims, each as one plain sentence, for example "Slide 1 headline is 12 characters; the most is 10." A length overflow offers the `shorter` nudge on that slide (Task 7).
- **The version card (GD22):**
  - the angle as the title, the "Ready" or "<n> to fix" tag, and the slides' previews in a sideways strip (`SlidePreview`, readable size: two slides visible per card);
  - the problems with their fix buttons, and "Use this version" (primary);
  - "Details" (a native `<details>`) holding today's slot list, fact quotes and the full fit checks, unchanged inside.
- **Fact chips (GD23):** a bound fact shows once per slide as `¶<n>`, which opens a popover with the sentence and its source. Slot labels only for "Not in the source" and "Opinion".
- **The chosen version (GD24):**
  - a film strip of its slides (numbered, with the layout name), and the selected slide large with its fields (`EditableSlidePreview` stays the in-place editor on the large slide);
  - beside it, the text fields with counts, the text chips (Task 7), the layout picker (Task 4/9) and that slide's fact chips;
  - "From the other versions" lists matching slides with "Use here" (Task 7);
  - a sticky action bar (`position: sticky; bottom: 0`, semantic tokens only) with "All checks pass" or "<n> to fix", "See checks", and "Approve text" (the approve action).
- **Labels (GD25):**
  - `StageRail` reads Source, Ideas (only when the post has an `ideasId`), Text, Images, Review, Live;
  - the step heading "Structures" becomes "Text";
  - "Gate locked" and "Gate open" are dropped from the header (the rail's current step says where the post is);
  - theme buttons drop the contrast ratio from their names (the ratio stays in Details);
  - legacy post labels follow the same words.
- **Source pane (GD26):**
  - the article clamped to its first four lines with "Show article" (a disclosure, not a new page);
  - key ideas rendered whole: remove the cut and add a test with a 200-character key idea;
  - facts as numbered rows with "Remove", plus "Add a fact from the article" (the existing select-a-sentence flow).
- **Tests (behaviour, not looks):**
  - `versionStatus` for a ready version, an overflow (with the shorter fix), an unbound slot and a not-found claim;
  - the card shows "Ready" or "1 to fix" and the problem sentence;
  - "Shorten it" calls `nudgeSlideAction` with `shorter`;
  - "Details" is closed by default and holds the check rows;
  - no "not a fact · checked" text renders;
  - the rail labels read Source, Text, Images, Review, Live (and Ideas with an ideas record);
  - a key idea of 200 characters renders whole;
  - "Show article" reveals the full text.
  Update the existing tests that read the old labels and slot lists.
- Commit `feat(content): a slides-first workbench that shows only what needs attention`.


## Task 15: One screen per step (build with Tasks 9, 10 and 14)
**Delivers:** GD27 (and story 14's criterion 111 as amended, `docs/admin-feed-post-from-source/intent.md` Changes, 12 Oct 2026).
**Files:** create `src/app/admin/(console)/posts/[id]/[step]/page.tsx`, `src/features/content/lib/steps.ts` (+ test); modify `src/app/admin/(console)/posts/[id]/page.tsx` (redirects to the current step), `components/Workbench.tsx` (+ test), `components/StageRail.tsx` (+ test), the step components' action bars (+ tests), and every place that links to `/admin/posts/<id>` and expects a section (the Board cards, `revalidatePath` calls in `actions.ts` `:163`: revalidate the post's layout path so every step page refreshes).
**Kind:** judgement
- **`lib/steps.ts`** (pure; the one definition):
  - `STEP_IDS = ['source', 'ideas', 'text', 'images', 'review', 'live'] as const`, `type StepId`;
  - `stepOfStage(stage, hasIdeas): StepId`:
    - `source` → source;
    - `structures` → ideas when the post has ideas and no drafts, else text;
    - `approved` → images for a look post, or text for a legacy one (the render step);
    - `rendered` → images;
    - `in_review` and `ready` → review;
    - `live` and `exported` → live;
  - `stepsFor(post): { id: StepId; label: string; state: 'done' | 'current' | 'todo' }[]`. The labels are those of GD25. Ideas appears only for posts with an ideas record. For a legacy post, Images is the render-and-covers step.
  - `canOpen(step, post): boolean`: done or current.
- **Routing.** Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` first: in this version `params` is a `Promise<{ id: string; step: string }>` (`dynamic-routes.md:24`).
  - `posts/[id]/[step]/page.tsx` loads the post as `posts/[id]/page.tsx` does today, and calls `notFound()` for an unknown step id.
  - A step the post has not reached redirects to the current step's address.
  - It renders the `Workbench` with `step`.
  - `posts/[id]/page.tsx` redirects to `/admin/posts/<id>/<stepOfStage(...)>`.
  - The static `export/` and `preview/` folders beside `[step]` keep matching first (a static segment matches before a dynamic one). The existing route tests in `src/features/content/routes.test.ts` must still pass unchanged.
- **`Workbench`** renders only the screen for `step`:
  - **source:** the source pane, facts and history;
  - **ideas:** `IdeasStep`;
  - **text:** the versions or the chosen-version editor (Task 14);
  - **images:** `ImagesStep` (look posts) or today's render step (legacy);
  - **review:** the review panel, the settings and the source check;
  - **live:** the live panel.
  A passed step renders read-only with its "Back to <step>" (story 14), and the current step renders with its controls.
- **`StageRail`** becomes the numbered step bar. Done and current steps are links to their addresses (`next/link`), and todo steps are plain text. It replaces Task 63's in-page anchors.
- **Action bars:** each step's bar names the next step on its forward action ("Approve text → Images", "Draw images", "Send to review → Review"). After a forward action succeeds, the client routes to the new current step (`router.push` to the address from `stepOfStage`).
- **Tests:**
  - **Unit:**
    - `stepOfStage` for every stage, with and without ideas, look and legacy;
    - `stepsFor` states and labels;
    - `canOpen` refuses todo.
  - **Components:**
    - the step bar links only done and current steps;
    - the Workbench at `step='text'` renders the versions and no source pane;
    - at a done step it renders read-only with "Back to <step>";
    - a successful "Approve text" calls the router with `/images`.
  - **Routes:** the existing `routes.test.ts` passes (`export` and `preview` unaffected).
- Commit `feat(content): one screen per step, with the step bar to move between them`.

## Integration
- **Database**, by path against `app_guided`: `src/features/content/server/commands.test.ts`, `src/features/content/server/social.test.ts`, `src/features/content/server/store.test.ts`.
- **Before the smoke test:** `bun run lint && bun run type-check && bun run test:run && bun run build`, plus the DB files.
- **Comics plan follow-up** (`docs/route-comics-and-gaps/plan.md`): its Task 1 `panels` becomes this plan's `slideArt`, and its Task 4 per-panel art is already built here. Its migration becomes 0010. Update that plan before its build.

## Criteria coverage
| Criterion | Task | Test that proves it |
| --- | --- | --- |
| GD1 | 6, 9 | `ideas.test.ts` (count, verify); `commands.test.ts` (Make post stops at ideas); `IdeasStep.test.tsx` |
| GD2 | 6, 9 | `commands.test.ts` (pick one, combine two, idea on the drafts); `IdeasStep.test.tsx` |
| GD3 | 6 | `commands.test.ts` (More ideas keeps the old cards and adds new) |
| GD4 | 2, 4, 11 | `templates.test.ts` (seven layouts per look); `engine.test.ts`; `commands.test.ts` (`setLook`, no model call); `social.test.ts` |
| GD5 | 4, 9 | `relayout.test.ts` (options with reasons, mapping); `commands.test.ts` (`setSlideLayout`); `LayoutPicker.test.tsx` |
| GD6 | 2 | `svg.test.ts` (dots, swipe cue, source line, search line on the last slide) |
| GD7 | 6 | `places.test.ts`; `ideas.test.ts` (postcard refused with no places) |
| GD8 | 2, 11 | `svg.test.ts` (legacy SVG unchanged); `social.test.ts` (legacy adapt unchanged); `templateById` finds legacy |
| GD9 | 1, 2, 4 | `guideline.test.ts` (presets, contrast); `fit.test.ts` (per-surface contrast); `commands.test.ts` (`setPreset`) |
| GD10 | 7, 9 | `commands.test.ts` (slide and version nudges, numbers held, history) |
| GD11 | 7, 9 | `commands.test.ts` (`useSlide`, no model call) |
| GD12 | 3, 8, 10 | `preview.test.ts` (planned scene drawn); `commands.test.ts` (plan, edit, draw only after approval); `ImagesStep.test.tsx` |
| GD13 | 8, 10 | `commands.test.ts` (nudge one image, others unchanged) |
| GD14 | 8, 10 | `commands.test.ts` (cap 2 of 4, draw remaining); `scene-plan.test.ts` (`imagesFor`) |
| GD15 | 1, 5 | `guideline.test.ts`; `draft.test.ts`, `caption.test.ts`, `art.test.ts` (guideline in the data and prompts, changes follow the file) |
| GD16 | 3 | `tint.test.ts` (filter per preset; pixel check through resvg; legacy untouched; original asset unchanged) |
| GD17 | 1, 2 | `guideline.test.ts` (a changed palette changes presets and prompts); `fit.test.ts` (checks run on the new colours) |
| GD18 | 13 | `SourceForm.test.tsx` (fields, placeholders, help, five-link limit); `commands.test.ts` (six refused) |
| GD19 | 13 | `commands.test.ts` (two links, one failing, all failing); `engine.test.ts` ("Sources: a, b") |
| GD20 | 13, 6 | `commands.test.ts` (framing in the extract and ideas data); `IdeasStep.test.tsx` (shown above the cards) |
| GD21 | 13 | `commands.test.ts` (notes never sent as source, sent as `editor_notes`); number checks refuse a notes-only number |
| GD22 | 14 | `version-status.test.ts`; `StructuresStep.test.tsx` (status tag, problem sentence, one-click fix, Details closed) |
| GD23 | 14 | `FactChip.test.tsx` (one chip per fact, opens the sentence); `StructuresStep.test.tsx` (no "not a fact · checked") |
| GD24 | 14, 7, 9 | `StructuresStep.test.tsx` (film strip, large slide, Use here, sticky Approve text) |
| GD25 | 14 | `StageRail.test.tsx` (Source, Ideas, Text, Images, Review, Live) |
| GD26 | 14 | `SourcePane.test.tsx` (folded article, whole key ideas, fact rows) |
| GD27 | 15 | `steps.test.ts` (step of each stage, states, canOpen); `Workbench.test.tsx` (one screen per step, read-only passed step); `StageRail.test.tsx`; `routes.test.ts` unchanged |
