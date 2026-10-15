# Blogs beside posts, and posts that start from an idea · Implementation Plan

**Intent:** docs/blogs-and-research/intent.md
**Goal:** Editors write reviewed, fact-checked blogs with the guided steps, link them both ways with posts, publish them to a public, search-readable page and the feed, and start posts or blogs from an idea with sources Gemini's search suggests.
**Approach:** A blog is a `content_post` of kind `blog`. It reuses everything a post has:
- the source, facts, ideas, history, the step lock, review, publishing, `published_approval_id`, slugs and story 14's moves;
- `art_plan` and per-slide art for its pictures.
It adds three record kinds: `blog_outline`, `blog_text` and `blog_link`.
Search is one new provider capability: a JSON call with the Google Search tool, whose source URLs code checks against the grounding chunks. It feeds "Start from an idea" (suggested sources become links read by the safe reader) and "Research this" (sources that really state the claim become new facts). Public blog pages follow the `/posts/<slug>` pattern, with structured data.

**Test layers:** Unit plus integration (database).
- **Unit:** the specs and their verification (grounded URLs only, question headings, FAQ count, word range), outline operations, the blog step mapping, the structured data, and the components with behaviour.
- **Database** (`DB_TESTS=1 DATABASE_URL=…/app_blogs bun test <file>`): every command that persists (blog lifecycle, links, research, publishing, readers), through the fake provider.
- **Browser specs:** added only if asked.
- **Refusals:** a non-editor on every new command; the public blog route refusing unpublished and expired blogs; a grounded URL not in the chunks refused.

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
- `bun run test:db` wipes the dev database: never run it. Run DB files by path against `app_blogs` (create it: `docker compose exec -T db psql -U app -d postgres -c "create database app_blogs"`, then migrate it: `DATABASE_URL=postgres://app:app@127.0.0.1:5433/app_blogs bun scripts/migrate.ts`).
- `bun run test:e2e`: only when asked. Fake provider only in tests, never Vertex. Migrations by `bun run db:generate` and `bun run db:migrate`, never `db:reset`. Applied migrations are never edited.
- When a component test fails, run it with `DEBUG_PRINT_LIMIT=300 … --timeout 20000`.
- **Branch:** `feat/blogs-and-research`, cut from `feat/workbench-flow` (stories 9 and 10, built first tonight). The latest migration before it is 0011 (feat/workbench-flow, built first), so this plan's is 0012. Cut this branch from `feat/workbench-flow`.

## Files
| Path | Create or modify | Responsibility |
| --- | --- | --- |
| src/shared/lib/db/schema.ts, content-shapes.ts, migration 0012, model/artifacts.ts, model/current.ts (+ tests) | modify (Task 1) | kind `blog`; `blog_outline`, `blog_text`, `blog_link` records; `content_post.blog_id` |
| ai/client.ts, ai/vertex.ts, ai/fake.ts, ai/config.ts, ai/search.ts (+ tests) | modify, create (Task 2) | **the one definition of `searchJson` and `GroundedSource`** |
| server/commands/research.ts, components/steps/SourceForm.tsx, components/steps/SourceCheckPanel.tsx (+ tests) | create, modify (Tasks 3, 4) | start from an idea; research a claim |
| lib/steps.ts, lib/workflow.ts, server/commands/blog.ts, ai/blog.ts, ai/prompts.ts (+ tests) | modify, create (Tasks 5, 6) | the blog's steps, outline and text |
| server/commands/blog.ts, server/commands/images.ts (+ tests) | modify (Task 7) | blog pictures and embedded slides |
| server/commands/review.ts, server/store.ts (+ tests) | modify (Task 8) | blog review and publishing; readers |
| src/app/(public)/blog/[slug]/page.tsx, lib/public-blog.ts, src/app/sitemap.ts, src/app/robots.ts, feed pages and cards (+ tests) | create, modify (Task 9) | public pages, structured data, feed |
| server/commands/blog-links.ts (+ tests), feed/public/caption code | create, modify (Task 10) | posts and blogs linked both ways |
| components/steps/OutlineStep.tsx, components/steps/BlogTextStep.tsx, components/Board.tsx, Workbench.tsx (+ tests) | create, modify (Task 11) | the blog screens |
| scripts/ai-smoke.ts | modify (Task 12) | live checks |

## Task 1: Records for blogs and their links
**Delivers:** the storage under BR1–BR11.
**Kind:** judgement
- **Kinds:** `content_post` kind gains `'blog'` (the check at `schema.ts:228`). `content_post` gains `blog_id text null` (references `content_post.id`, on delete set null, indexed): the blog a post belongs to.
- **Artifact kinds**, with `BODIES` entries:
  - **`blog_outline`** `{ factsId, idea: IdeaCard | null, sections: { heading: string; point: string }[] (1–8), takeaways: string[] (3–5), faq: { q: string; point: string }[] (3–5), note: string | null }`.
  - **`blog_text`** `{ outlineId, sections: { heading, body, factIds: string[] }[], takeaways: string[], faq: { q, a, factIds }[], emotion: string | null, note: string | null }`.
  - **`blog_link`** `{ kind: 'from_blog' | 'linked', blogId, postId }` (history of linking).
- **Pointers** gain `outlineId` and `blogTextId`, each `ref.default(null)`. `current()` keeps an outline while its `factsId` matches the facts, and blog text while its `outlineId` matches the outline.
- **Migration 0012:** generate it with `bun run db:generate`; the kind checks are re-created as 0004 does. Apply it to `app` and `app_blogs`.
- **Tests:**
  - **Unit:** the new bodies parse; an outline with 9 sections fails; `current()` drops stale outline and text records.
  - **DB:** a blog post inserts; `blog_id` set null when its blog is deleted.
- Commit `feat(content): records for blogs, their outline and text, and their links to posts`.

## Task 2: A JSON call with Google Search
**Delivers:** the capability BR12–BR14 rest on.
**Kind:** judgement
- **Verified facts** (`node_modules/@google/genai/dist/genai.d.ts`):
  - `Tool.googleSearch?: GoogleSearch` (`:16086`);
  - `Candidate.groundingMetadata?: GroundingMetadata` (`:1713`) with `groundingChunks?: GroundingChunk[]` (`:8045`, each `web?: { uri, title }`) and `searchEntryPoint?: SearchEntryPoint` (`:8052`, `renderedContent?: string`, `:14681`).
  - Check whether this version allows `responseSchema` together with tools. If not, ask for JSON in the prompt and parse it with zod.
- **`searchJson<S>(spec, { data, postId }): Promise<{ ok: true; value: z.infer<S>; sources: GroundedSource[]; entryPoint: string | null } | { ok: false; reason: string; error: string }>`** on the AI client (`ai/client.ts`, beside `generateJson` `:251`):
  - `GroundedSource = { url: string; title: string }` comes from the grounding chunks;
  - it is logged in `ai_call` (tier `flash`, use case of the spec), with labels and telemetry like other calls;
  - its own daily cap `AI_DAILY_CAP_SEARCH` (missing reads as 20, not 0, so it works out of the box).
- `vertex.ts` builds the request with `tools: [{ googleSearch: {} }]`.
- **The fake provider** returns a canned answer plus three canned grounding chunks for known test ideas (`[fake:fail-search]` fails).
- **Code check:** any URL in the model's answer that is not among the grounding chunks' URIs is dropped. Redirect URIs (`vertexaisearch…/grounding-api-redirect/…`) are kept as given and resolved by the safe reader when read.
- **Tests:** a fake answer naming a URL not in the chunks has it dropped; the cap refuses at its limit; the request carries the tool (unit on `vertex.ts`' request builder).
- Commit `feat(content): Gemini calls with Google Search, their sources checked against the grounding`.

## Task 3: Start from an idea
**Delivers:** BR12, BR13.
**Kind:** judgement
- **`SUGGEST_SOURCES` spec** (`ai/search.ts`): use case `suggest_sources`, version `suggest_sources.v1`.
  - Answer `{ sources: [{ url, title, site, why, official: boolean }] }`, 5–8, official first.
  - Data: the idea (≤200 characters), `brand_voice`, the audience (international students).
- **`suggestSources(actor, { idea })`:** an editor, and the idea passes `artPromptError` (no prompt injection is executed: the idea is data).
  - It returns the verified sources (URLs only from grounding) and the `entryPoint` HTML. No record is made; this is a lookup.
  - "Try a more specific idea." when none come back.
- **`SourceForm`:**
  - A third entry, "Start from an idea": the idea field with a placeholder and help text, then "Find sources".
  - The list shows ticks (official ones ticked by default, top three, GD29), title, site and why, plus Google's search entry point rendered in a sandboxed `<iframe srcdoc>` as Google's grounding display rules require.
  - "Use these" fills the Links field with the ticked URLs and runs "Make post" (or "Make blog") as for links (GD18–GD19, unchanged).
- **Tests:**
  - **Unit:** verify drops non-grounded URLs and orders official first.
  - **Component:** "Find sources", ticks, "Use these" calls make with the ticked links, and the entry point renders in an iframe with the `sandbox` attribute.
  - **DB:** a refusal for a non-editor.
- Commit `feat(content): start a post from an idea with sources Gemini's search suggests`.

## Task 4: Research a claim, when asked
**Delivers:** BR14 (GD35).
**Kind:** judgement
- **`RESEARCH_CLAIM` spec:** answer `{ sources: [{ url, title, sentence }] }` up to 3, from search.
- **`researchClaim(actor, id, version, { sentence })`:** an editor, at a stage where the check shows.
  - It calls the spec, keeps only grounded URLs, reads each page with the safe reader (`server/fetch-page.ts`), and keeps a source only when the page holds a sentence that the source check (`SOURCE_CHECK`, `ai/source-check.ts`) finds supports the claim.
  - It returns the candidates; nothing is saved.
- **`addResearchSource(actor, id, version, { url })`:** appends the page as a new part of the source (Task 13's parts: a new source record with the extra part), adds that sentence as a fact, and reruns the source check.
- **`SourceCheckPanel`:** each "Not found" row gets "Research this", then a loading state (13 Oct loader), then the candidates with "Add as a source" or "Dismiss".
- **Tests (DB, fake):**
  - a candidate whose page lacks the sentence is not offered;
  - "Add as a source" makes a new source with the part and the fact, and the sentence then checks found;
  - one search per press;
  - a non-editor is refused.
  - **Component:** the button, the loading state, the candidates.
- Commit `feat(content): research an unsupported claim with Google Search, on request`.

## Task 5: The blog's steps, ideas and outline
**Delivers:** BR1, BR2.
**Kind:** judgement
- **`lib/steps.ts`:** a blog's steps are `source, ideas, outline, text, images, settings, review, live`. `stepOfStage` maps a blog with an idea picked and no text to `outline`. Use the same functions with the post's kind.
- **"New blog"** (Board button for editors, `/admin/blogs/new` or `posts/new?kind=blog`): the same `SourceForm` with links or idea. `makePost` takes `kind: 'feed' | 'blog'`, and for a blog the ideas step asks `IDEAS` for blog angles (a `kind` field in its data; the cards are the same shape, top three marked as recommended, GD33's formats not used for blogs).
- **`BLOG_OUTLINE` spec** (flash): from the facts, the angle, the framing line and `brand_voice`, it returns sections (question-style headings), takeaways and an FAQ.
  - Verify: 3–8 sections, every heading a question (ends with "?"), 3–5 takeaways, 3–5 FAQ, no numbers outside the facts.
- **Commands:**
  - `pickBlogAngle(actor, id, version, { card })` makes an outline record;
  - `editOutline(actor, id, version, op)` (reorder, add, remove, reword a heading or point; never below 1 or above 8 sections) saves new outline records with notes.
- **Tests:** verify refuses a non-question heading and 9 sections; pick saves the outline; edit operations and their limits; a non-editor is refused.
- Commit `feat(content): blogs start like posts and get an editable outline`.

## Task 6: Writing the blog
**Delivers:** BR3.
**Kind:** judgement
- **`BLOG_TEXT` spec** (flash): from the outline, the facts, `brand_voice` and the editor's notes as opinion only, it returns each section's body with `fact_ids`, the takeaways and the FAQ answers with `fact_ids`.
  - Verify:
    - total body 600–1,200 words;
    - every number in a bound fact or the facts (the GD21 rule, `problemsIn`);
    - banned phrases (`text/lint.ts`);
    - each FAQ answer bound to at least one fact.
  - The retry ladder carries the problems.
- **`writeBlog`** runs it in the background (`runStepAfter`, step `blog_text`, with the 13 Oct progress) and saves `blog_text`.
- **`editBlogSection(actor, id, version, { part: 'section' | 'takeaway' | 'faq'; index; field: 'heading' | 'body' | 'q' | 'a'; text })`** saves new text and reruns the source check for the changed sentences (the slide check, fed the blog's sentences: give `ai/source-check.ts` a source of sentences that is not slide-bound if needed).
- **`approveBlogText`** moves `structures` → `approved` with a revision-like pin. Reuse `revision` with `structure` null and `blogTextId` set, or add `blogTextId` to the approval body: choose the smaller change and say which.
- **Tests (DB):** write saves the text; a number not in the facts is retried; an edit reruns the check; approval needs a clean check (criterion 43).
- Commit `feat(content): Gemini writes the blog from the outline, every fact checked`.

## Task 7: Blog pictures and embedded slides
**Delivers:** BR4.
**Kind:** judgement
- Reuse Task 8 of guided design (`art_plan`, `planImages`, `drawImages`, `nudgeImage`, "New picture", progress and resume) with blog targets: `cover` plus up to 3 inline (`after section n`), each with a planned scene. `SCENE_PLAN`'s data gets the section text. The pictures are wide (`16:9` for the cover, `4:3` inline), tinted (GD16).
- **`embedPostSlides(actor, id, version, { postId, at })`:** embeds a live linked post's slides after a section, in place of a picture.
- **Tests (DB):** plan and draw make a cover and inline pictures; embedding refuses a post that is not linked or not live.
- Commit `feat(content): a blog's cover and inline pictures, or a linked post's slides`.

## Task 8: Blog review and publishing; readers
**Delivers:** BR5; the readers for BR9–BR11.
**Kind:** judgement
- **Review and publishing** work for blogs:
  - `sendToReview`, `approveAndPublish`, `sendBack` ("Request changes"), withdraw, `editLive`, `discardChanges`;
  - `publishApproval` sets `published_approval_id`;
  - `giveSlug` gives blogs slugs in their own namespace (`/blog/<slug>`).
- **The approval** pins `blogTextId`, the images and the settings.
- **`store.ts` readers:**
  - `liveBlogs()` and `liveBlogBySlug(slug)` return title, dates (published from the first approval, updated from the latest), sections, takeaways, FAQ, pictures, embedded posts, sources (from the source parts, with links), tags and slug;
  - `listLiveBlogSlugs()` returns rows for the sitemap;
  - `isLiveBlogAsset(id)` checks a blog's assets.
- **Tests (DB):** a published blog is read with its dates; editing and republishing updates "updated" and keeps the slug; an unpublished blog is null; a reviewer publishes and an editor alone cannot.
- Commit `feat(content): review and publish blogs, read by their slug`.

## Task 9: Blog pages for readers, search engines and the feed
**Delivers:** BR9, BR10, BR11.
**Kind:** judgement
Read `node_modules/next/dist/docs` for metadata, `generateMetadata`, sitemap and robots first, and follow `src/app/(public)/posts/[slug]/page.tsx` and `lib/public-post.ts`.
- **`/blog/[slug]`** shows the parts BR9 lists, with "Follow us" from the brand files' Instagram plus a `linkedin` field (placeholder URL, intent open question 1).
- **Structured data** (`lib/public-blog.ts`, pure): JSON-LD `Article` (headline, datePublished, dateModified, author `Organization` OfCourse, image, mainEntityOfPage) and `FAQPage`, in a `<script type="application/ld+json">` with the text escaped. The canonical address comes from `SITE_URL`.
- **The sitemap** lists blogs with `lastModified` = updated. **Robots** allow `/blog/`.
- **Assets:** `src/app/(public)/blog/assets/[id]/route.ts` serves the PNGs a live blog pins (`isLiveBlogAsset`), and is rate-limited like posts (`proxy.ts`, the matcher includes `/blog`).
- **The feed:** live blogs appear as blog cards (title, cover, reading time = words / 200, rounded) through the same chips (criterion 81). `/feed/blog/<id>` (or `/feed/<id>` by kind) shows the blog inside the app.
- **Tests:**
  - **Unit:** the JSON-LD for a blog with an FAQ, escaping, the reading time.
  - **Route:** a live blog renders signed out; unpublished and expired are 404; the asset route serves only live blog assets.
  - **DB:** the sitemap rows; the feed includes the blog card under a matching chip and not under another.
- Commit `feat(content): public blog pages with structured data, the sitemap and blog cards in the feed`.

## Task 10: Posts and blogs, linked both ways
**Delivers:** BR6, BR7, BR8.
**Kind:** judgement
- **`makePostsFromBlog(actor, blogId, version)`:** starts a feed post whose source is the blog. Its source parts are the blog's sections as paragraphs, with the blog's public URL as the part's url, and `blog_id` is set. Its ideas come from the sections (an `IDEAS` data field `from_blog_sections`). It may be called repeatedly.
- **`makeBlogFromPost(actor, postId, version)`:** starts a blog with the post's source and facts and links the post (`blog_id`).
- **`linkToBlog(actor, postId, version, { blogId })`:** links a post to an existing live or draft blog. A `blog_link` record is written for each.
- **Readers:** the feed post, the public post page and the caption builder (`ai/caption.ts` assembly, code-written, never the model) add "Read the full guide: <blog URL>" when the post's blog is live. The blog's reader lists its live posts under "From this guide".
- **Tests (DB):** a post made from a blog has the blog's sections as its source and `blog_id`; its caption ends with the guide line once the blog is live, and not before; "From this guide" lists only live posts; link and unlink write `blog_link` records; a non-editor is refused.
- Commit `feat(content): make posts from a blog, a blog from a post, linked both ways`.

## Task 11: The blog screens
**Delivers:** the controls of BR1–BR8 in the admin.
**Kind:** judgement
Read `DESIGN.md`. Follow the step screens (`components/Workbench.tsx`, `lib/steps.ts`), the slides-first layout and GD30's side-by-side layout: content in one area, actions beside it, each scrolling on its own.
- **Board:** a "New blog" button; blog cards marked "Blog".
- **Outline step (`OutlineStep`):** the sections as a sortable list (heading and point editable in place, add, remove, move), takeaways and FAQ, then "Write the blog".
- **Text step (`BlogTextStep`):** the article preview on one side (headings, bodies, takeaways, FAQ, pictures as placed) and, on the other, the selected section's fields, its facts as ¶ chips, the chips (Task 7 of guided design, applied to a section through a `BLOG_SECTION` redraft if small, else omit and say so), and "Approve text → Images".
- **Images, Settings, Review, Live** reuse the post screens with blog content.
- **On a feed post:** "Make a blog" and "Link to an existing blog" (a picker of blogs).
- **On a live blog:** "Make posts from this blog" and its posts listed.
- **Tests (behaviour):**
  - the outline list's add, remove and move call the actions with the right operation;
  - "Write the blog" calls `writeBlogAction`;
  - editing a section calls `editBlogSectionAction`;
  - "Make posts from this blog" calls its action;
  - a non-editor sees no controls.
- Commit `feat(content): the blog screens: outline, text, and links to posts`.

## Task 12: The new prompts in the live smoke run
**Delivers:** live checks by hand (not criteria).
**Kind:** judgement
- Add one call each to `scripts/ai-smoke.ts`:
  - `suggest_sources` (an idea such as "student work hours in Australia");
  - `research_claim`;
  - `blog_outline`;
  - `blog_text`.
- Do not run it. Type-check and lint.
- Commit `chore(content): search, outline and blog prompts in the live smoke run`.

## Integration
- **Database**, by path against `app_blogs`: `server/commands.test.ts`, `server/blog.test.ts` (new), `server/research.test.ts` (new), `server/store.test.ts`, `server/images.test.ts`, `server/social.test.ts`.
- **Before the smoke test:** `bun run lint && bun run type-check && bun run test:run && bun run build`, plus the DB files.

## Criteria coverage
| Criterion | Task | Test that proves it |
| --- | --- | --- |
| BR1 | 5, 11 | `steps.test.ts` (blog steps); `blog.test.ts` (new blog from links or idea); Board test |
| BR2 | 5, 11 | `blog.test.ts` (outline verify, pick, edit ops); OutlineStep test |
| BR3 | 6 | `blog.test.ts` (write, number rule, edit reruns check, approval needs a clean check) |
| BR4 | 7 | `blog.test.ts` / `images.test.ts` (cover + inline, embed refusals) |
| BR5 | 8 | `blog.test.ts` (review, publish, request changes, edit live) |
| BR6 | 10 | `blog.test.ts` (posts from a blog, repeatable) |
| BR7 | 10 | `blog.test.ts` (guide line once live, From this guide) |
| BR8 | 10, 11 | `blog.test.ts` (make a blog from a post, link to existing); component tests |
| BR9 | 9 | route test (signed out, parts present) |
| BR10 | 9 | `public-blog.test.ts` (JSON-LD, canonical); sitemap and robots tests |
| BR11 | 9 | `store.test.ts` (blog card under matching chip) |
| BR12 | 2, 3 | `search.test.ts` (grounded URLs only, official first); SourceForm test |
| BR13 | 3 | SourceForm test (Use these → make with ticked links); existing link-reading tests |
| BR14 | 4 | `research.test.ts` (unsupported page not offered, add as source, one search per press) |
