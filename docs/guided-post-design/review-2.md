# Guided post design, part 3 of 3 (Tasks 6–12, 14, 15 and their fixes) — Code Review

**Request changes.** 0 CRITICAL · 2 HIGH · 5 MEDIUM · 5 LOW

| | |
| --- | --- |
| Blocking | HIGH · GD25 not met on posts from before the looks: their Images screen is titled "Render" (`Workbench.tsx:112`) |
| | HIGH · GD27 not met on the Images screen: its controls offer no way back, and "Draw images" does not name the next step (`ImagesStep.tsx:181`) |
| Branch | `feat/guided-post-design` at `2c0021e` over `5e1f39c` · 95 files, +10138 −1077 · 2026-10-13 |
| Reviewed against | security · performance · security-web · security-llm · CLAUDE.md · industry `DESIGN.md` · next `dynamic-routes.md` · `fdd-architecture (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` · `vercel-composition-patterns (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` |
| Scans | secrets N/A (not installed) · dependencies 0 new, 2 pre-existing · code N/A (not installed) |
| Not applicable | none of the skills named in the dispatch |
| Failed to load | none |
| Read outside the diff | 8, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`, `security-llm.md`) | A | — | — |
| Performance | A | LOW · `images.ts:194` · images drawn inline | optional |
| CLAUDE.md · DESIGN.md | B | MEDIUM · `nudges.test.ts:31` · test bloat | delete the duplicate test |
| fdd-architecture | B | MEDIUM · `StructuresStep.tsx` · 1476 lines, 9 components | split ChosenVersion and VersionDetails out |
| vercel-react-best-practices | B | MEDIUM · `[step]/page.tsx:34` · fetches every step's data | load history and art per step |
| vercel-composition-patterns | B | MEDIUM · `StructuresStep.tsx:1077` · selected slide resets | lift the selection above the key |
| tailwind-v4-best-practices | B | MEDIUM · `LayoutPicker.tsx:67` · arbitrary aspect | use `aspect-4/5` |
| Criteria | C | HIGH · GD25, GD27 · partly unmet | Images title and way back |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| GD1 | Make post offers 2–6 idea cards | `server/commands.test.ts:396`, `ai/ideas.test.ts`, `IdeasStep.test.tsx` | covered |
| GD2 | Pick or combine drafts for that idea | `server/commands.test.ts:451`, `ai/draft.test.ts`, `IdeasStep.test.tsx` | covered, done differently |
| GD3 | More ideas adds up to 4, keeps shown | `server/commands.test.ts:509` | covered |
| GD4 | Social version keeps the look (Task 11 half) | `server/social.test.ts:732` | covered |
| GD8 | Old posts unchanged | `server/social.test.ts:804`, `components/Workbench.test.tsx:373`, `server/images.test.ts` | covered |
| GD10 | Text chips on a slide or a version | `server/commands.test.ts:3583`, `StructuresStep.test.tsx` | covered |
| GD11 | Use a slide from another version | `server/commands.test.ts:3699`, `StructuresStep.test.tsx` | covered |
| GD12 | Scenes in words, edited, drawn on approval | `server/images.test.ts:222`, `ImagesStep.test.tsx`, `routes.test.ts` | covered, done differently |
| GD13 | Nudge one image, keep the earlier take | `server/images.test.ts:287`, `ImagesStep.test.tsx` | covered |
| GD14 | Count shown; daily limit keeps drawn ones | `server/images.test.ts:322`, `templates.test.ts` | covered |
| GD22 | Version card: strip, tag, Details closed | `lib/version-status.test.ts:59`, `StructuresStep.test.tsx:884` | covered |
| GD23 | Fact once as ¶ chip; labels on attention | `components/FactChip.test.tsx:44`, `StructuresStep.test.tsx` | covered |
| GD24 | Strip, large slide, chips, layouts, sticky bar | `StructuresStep.test.tsx:917` | covered |
| GD25 | Bar and step titles read Source … Live | `components/StageRail.test.tsx:23` | partly: legacy Images screen titled "Render" |
| GD26 | Article folded, key ideas whole, fact rows | `components/steps/SourcePane.test.tsx:146` | covered |
| GD27 | One screen per step, way forward and back | `lib/steps.test.ts:15`, `components/Workbench.test.tsx:297` | partly: Images screen has no way back |

Done differently: GD2 shows "For: <angle>" once above the versions, not on each version (all three serve the same idea). GD12 waits for a "Plan images" press instead of showing scenes on arrival at Images, and there is no "Plan again".

## Read outside the diff
- `lib/client-safe.test.ts:18` — every `lib/` and `model/` module is guarded automatically (so `steps.ts`, `version-status.ts`, `places.ts` are), and `layout/relayout.ts` and `nudges/index.ts` were added: no client component reaches server-only code.
- `server/preview.ts:19` — `recordOf` reads the plan and the layout by id, post and kind, and `plannedScenes` also requires the same revision: another post's plan, or a plan for other text, gets a 404.
- `server/commands/shared.ts:115` — `open()` runs `actionError` (editor-only, stage) and the version check before any model call, for every new command.
- `next/dist/server/web/spec-extension/revalidate.js:86`, `next/dist/server/lib/implicit-tags.js`, `revalidatePath.md:28` — a literal path with `'layout'` builds the tag `/admin/posts/<id>/layout`, and no step page carries that tag (LOW below).
- `ai/prompts.ts:53` — `buildPrompt` puts DATA in a fence after `INJECTION_RULE`: idea cards, the framing line, notes and scenes reach the model as data.
- `server/commands/render.ts:125,519` — `retryArt` and `chooseCover` refuse a look post (its render's art fallback is null, and a look revision has no covers), so neither redraw can drop `slideArt`.
- `components/steps/RenderStep.tsx:409` — a legacy post's Images screen has the heading "Render".
- `server/store.ts:62` — `RENDER_ART_LIMIT = 100` bounds `listSlideArt`.

Unverified: how `runStep` locks. I assumed it works as it does elsewhere: one running step per name, refused while running. `drawImages` and `nudgeImage` share the `images` lock. `planImages` holds a different lock, so it is guarded only by the version check.

## Findings, by file

### `src/features/content/components/Workbench.tsx`

**HIGH · line 112 · GD25 step title on legacy posts**
- What: For a post from before the looks, the Images step renders `RenderStep`, whose heading reads "Render" (`RenderStep.tsx:409`). `Workbench.test.tsx` even asserts `/Render/` at `step="images"`.
- Why: GD25 says the step titles read Source, Ideas, Text, Images, Review and Live for any post, and the plan said legacy labels follow the same words. The bar says Images but the screen says Render.
- Rule: intent GD25 · a test would have caught it: yes, a heading assertion of "Images" at the legacy Images step; the current test pins the opposite.
- Fix: Title the legacy render screen "Images" (or pass the heading in), and change the Workbench test to assert it.

### `src/features/content/components/steps/ImagesStep.tsx`

**HIGH · line 181 · GD27 way forward and way back**
- What: The Images screen of a look post has "Plan images", "Draw images (n images)" and "Draw remaining", but no way back to the text. "Draw images" does not name the step it leads to. The legacy Images screen (`RenderStep`) has no way back either.
- Why: GD27 says each step's action bar names the way forward and the way back. Today an editor at Images must open Text from the bar and then press its "Back to text versions".
- Rule: intent GD27 · a test would have caught it: yes, an ImagesStep test looking for the way back at `approved` and `rendered`.
- Fix: Add "← Back to text" (the existing `backAction('structures')` with its confirm, as StructuresStep does past the gate) to the Images bar. Have the bar name the next step, for example "Draw images (3 images) → Review" or "Feed settings → Review".

### `src/features/content/components/steps/StructuresStep.tsx`

**MEDIUM · line 1077 · selected slide resets after every change**
- What: `ChosenVersion` keeps the selected slide in `useState(1)`. Every save bumps the post's version, `Workbench` keys the screen by `${step}-${version}` (`Workbench.tsx:87`), and that remounts the step. So after Shorter, a layout swap, an edit or "Use here" on slide 3, the editor is back on slide 1.
- Why: GD24's single-slide editor loses its place on every action, which undoes the "one slide large" flow.
- Rule: `vercel-composition-patterns` §state-lift-state · a test would have caught it: yes, a test that selects slide 2, rerenders at version + 1 and expects slide 2 still pressed.
- Fix: Keep the selected slide in the URL (`?slide=n`), or in state above the keyed boundary, and clamp it to the slide count.

**MEDIUM · whole file · one file, nine components**
- What: The file grew to 1476 lines. It holds StructuresStep, VersionCard, VersionDetails, VersionControls, ChosenVersion (22 props), AnotherTake, CheckStatus, FlaggedSentences and FixUnbound, plus the attention and count helpers.
- Why: One file now carries the version list, the detail view, the single-slide editor and the checks, so every change to one touches a file of 1.5k lines.
- Rule: `fdd-architecture` §hook extraction, composition over configuration · a test would have caught it: no, structure.
- Fix: Move `ChosenVersion` and `VersionDetails` (with `attentionOf`, `slideFacts` and `countOf`) into their own files under `components/steps/text/`.

**LOW · lines 524, 615 · "structures" still in labels**
- What: The legacy button still reads "Draft structures", and the empty state reads "No structures drafted yet.".
- Why: GD25 dropped "Structures" from the editor's words, and the step heading is now "Text".
- Rule: GD25 (naming drift) · a test would have caught it: yes, a text query, but the current test matches only the exact word.
- Fix: "Draft versions" and "No versions drafted yet."

**LOW · line 121 · duplicated helper**
- What: `letterOf` repeats `versionLetter` from `server/commands/structures.ts:321`.
- Why: The UI and the history notes must agree on the version letter, and two copies can drift apart.
- Rule: quality · duplicated logic · a test would have caught it: no.
- Fix: Export one helper from `lib/` and use it in both places.

### `src/app/admin/(console)/posts/[id]/[step]/page.tsx`

**MEDIUM · line 34 · every step loads every step's data**
- What: Each step page reads `earlierArt`, `listHistory` and `pageStyles` and serialises them into the client `Workbench`. Only Source shows the history, and only the legacy Images step uses earlier art. `listSlideArt` is already limited to `step === 'images'`.
- Why: The cost grows with the post's history on every step view: two extra queries plus a larger RSC payload on Text, Review and Live.
- Rule: `performance.md` §2 and §5 · `vercel-react-best-practices` server-serialization · a test would have caught it: no.
- Fix: Load each one only on the step that shows it, as `slideArt` already is.

### `src/features/content/components/LayoutPicker.tsx`

**MEDIUM · line 67 · arbitrary value where a utility exists**
- What: `aspect-[4/5]` on the layout sketch.
- Why: Tailwind 4 has the ratio utility `aspect-4/5`, and the repo keeps arbitrary values for true one-offs.
- Rule: `tailwind-v4-best-practices` §semantic utilities over arbitrary values · a test would have caught it: no, a convention.
- Fix: `aspect-4/5`.

### `src/features/content/nudges/nudges.test.ts`

**MEDIUM · line 31 · test bloat**
- What: "gives every chip an id of its own" checks the uniqueness that `parseNudges` already enforces at module load, and that the next test ("refuses a file whose ids repeat") proves.
- Why: It repeats another test's assertion and adds nothing the parse does not already guarantee.
- Rule: CLAUDE.md test the brain, not the beauty · repeated assertion · a test would have caught it: n/a.
- Fix: Delete the test.

### `src/features/content/actions.ts`

**LOW · line 222 · revalidatePath tag matches nothing**
- What: `revalidatePath('/admin/posts/<id>', 'layout')` builds the tag `/admin/posts/<id>/layout`. Next derives a step page's tags from its route pattern (`/admin/(console)/posts/[id]/layout`) and its literal path (`/admin/posts/<id>/text`), so nothing matches. The comment and `actions.test.ts` claim it refreshes every step screen.
- Why: Nothing breaks today, because the pages are dynamic (session cookie) and the action's revalidate flag makes the client refresh. But the stated mechanism is false, and a test pins it.
- Rule: `revalidatePath.md:28` (a literal path takes no `type`) · a test would have caught it: no, the test mocks `revalidatePath`.
- Fix: Revalidate the literal path with no type, or `'/admin/(console)/posts/[id]', 'layout'` if every post may refresh, and correct the comment.

### `src/features/content/server/commands/images.ts`

**LOW · line 194 · images drawn one by one inside the request**
- What: `drawImages` draws each planned image in sequence inside the server action, under the `images` lock. Field Notes draws up to one image per art-box slide.
- Why: The request time grows with the number of art boxes, roughly 3–4 image calls end to end. Drawing in sequence is deliberate, so that the daily limit keeps the first images, and the covers already worked this way.
- Rule: `performance.md` §3 (a slow third party called inline) · a test would have caught it: no.
- Fix: Optional now. Later, move the drawing to `runStepAfter` or a job, as the drafting is.

### `src/shared/lib/db/migrations/0009_content_artifact_ideas.sql`

**LOW · line 2 · the check is validated under a full lock**
- What: The migration drops and re-adds `content_artifact_kind_check`. Postgres validates every row while it holds an ACCESS EXCLUSIVE lock.
- Why: The time grows with the artifact table, which gains rows on every save. Nothing is lost, and the migration follows the pattern of 0004.
- Rule: `performance.md` §4 · a test would have caught it: no.
- Fix: Optional: `ADD CONSTRAINT … NOT VALID`, then `VALIDATE CONSTRAINT` in a second statement.

## Top 3 priority fixes
1. `components/Workbench.tsx:112` — title the legacy Images screen "Images", and assert it in the test.
2. `components/steps/ImagesStep.tsx:181` — put a way back to the text in the Images bar, and name the next step.
3. `components/steps/StructuresStep.tsx:1077` — keep the selected slide across saves.

## Done well
- Every redraw carries a look's pictures through one `RenderImages` shape (`imagesOf`, `movedImages`, `withSlideImage`): claims, restore, reorder, swap, the market version and social versions. Each is proven by a database test, and the redraw paths not changed here (`retryArt`, `chooseCover`) refuse a look post.
- The preview route's `plan` parameter is scoped to the post and the revision. It is in the cache key, the session is checked first, and a route test proves another plan gets a 404.
- Every new action is editor-only through `ACTION_STAGES` and `EDITOR_ACTIONS`, and the refusal of reviewers and admins is tested in both `workflow.test.ts` and the database suites. Model output (idea cards, scenes, nudged versions) is checked by code before it is saved.

## Built but not asked for
- "Draw remaining" also redraws any slide whose scene was edited after it was drawn.
- A third slot label, "Number not in its fact". "Back to versions" on the Ideas screen. "Hide article".
- Market items on the Board now open `/images`. Discard, publish, send back and withdraw now move to the new current step's screen. These are needed by GD27 rather than new scope.

## Blind spots
- The selected slide resetting after a save: only a component test that rerenders at the next version would catch it.
- The `revalidatePath` tag: unit tests mock it. Only a build, or a check of the cache tags, shows that it matches nothing.
- GD25 and GD27 on the Images screen: the existing tests pin today's labels. An ImagesStep test and a legacy Workbench test asserting the criterion's words would catch both.
- The real image model's 21:9 panorama and the 1:1 crop of wide art boxes are judged on screen only (smoke G7).

---
Stack: TypeScript, Next.js App Router (React 19 server and client components, server actions, dynamic `[step]` route), Tailwind 4, Drizzle on Postgres, zod, Gemini through `@google/genai`, `bun test` with happy-dom. Passes applied shallowly: none. Next's cache tagging was checked in the installed `node_modules` rather than assumed. The lock semantics of `runStep` were not read (see above).


## Resolution · 13 Oct 2026

The developer asked for every valid finding to be fixed before the smoke test. One implementer dispatch fixed all of them, test-first, in `d90a62d`, `2ded400`, `24ace42` and `322aa38` (brief: `.heubert/review-fixes-brief.md`, items 1–35, also covering the GD2 and GD12 differences from the criteria table).
Left, with the reason: `images.ts:194` images drawn in sequence (deliberate, so the daily image limit keeps the first images); migration 0009 `NOT VALID` (moot: the migration is applied and must not be edited). Item 25: the forward labels stay ("Draw images (n images)", "Send to review → Review" already named the next step); "← Back to text" added.
