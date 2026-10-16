# Admin feed post from a source, round two (stories 11 and 12) — Code Review

**Request changes.** 1 CRITICAL · 0 HIGH · 4 MEDIUM · 7 LOW

| | |
| --- | --- |
| Blocking | CRITICAL · `server/store.ts:191` · settings saved before this round crash the Live, Review and Settings panels |
| Branch | `feat/admin-feed-post-from-source` at `0784918` over `33f32f7` · 116 files, +5141 −473 · 2026-10-08 |
| Reviewed against | security · security-web · security-llm · performance · CLAUDE.md · AGENTS.md · `industry (DESIGN.md)` · round one's Resolution (`review.md`) |
| Scans | secrets N/A (gitleaks not installed) · dependencies 0 new, 2 pre-existing · code N/A (semgrep not installed) |
| Not applicable | `.claude/skills` (not installed in checkout) |
| Failed to load | none |
| Read outside the diff | 9, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`, `security-llm.md`) | C | CRITICAL · `server/store.ts:191` · bodies read without their schema | Parse every body on read |
| Performance | B | MEDIUM · `server/store.ts:477` · whole live list per request | Order, cache, read by id |
| CLAUDE.md / AGENTS.md | A | LOW · `lib/client-safe.test.ts:12` · guard misses new modules | optional |
| industry (DESIGN.md) | A | — | — |
| Quality | B | MEDIUM · `ai/market.ts:26` · replays not keyed by market | Key replay steps by market |
| Criteria | C | CRITICAL · `server/store.ts:191` · 45, 54 fail on older posts | Parse every body on read |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1–70 not listed below | as round one | `review.md` | unchanged |
| 6, 36–38 | art on Gemini, cap, prompt guard | `ai/vertex.test.ts`, `ai/art.test.ts`, `ai/client.test.ts:380` | covered |
| 23, 42, 65 | sentences keep abbreviations whole | `text/sentences.test.ts:22` | covered |
| 34, 35 | glyph the font cannot draw fails fit | `layout/fit.test.ts:101`, `layout/measure.test.ts:21` | covered |
| 45, 54 | review and live panels show settings | `ReviewPanel.test.tsx`, `LivePanel.test.tsx` | contradicted |
| 56–61 | every market as Nepal | `server/commands.test.ts:1051`, `:1092`; `content-submission.e2e.ts:368` | covered |
| 71, 79 | live posts as phone cards, every account | `content-student-feed.e2e.ts:250`; `store.test.ts`; `FeedList.test.tsx` | covered |
| 72 | Featured pinned 72 h | `lib/feed.test.ts:97` | covered |
| 73 | expired or unpublished: gone, 404 | `lib/feed.test.ts:78`; `content-student-feed.e2e.ts:368` | covered |
| 74 | "Nothing in the feed yet." | `FeedList.test.tsx:113` | covered |
| 75 | every slide, one per swipe, alt | `SlideStrip.test.tsx`; `content-student-feed.e2e.ts:277` | covered |
| 76, 82 | home chip shows the market version | `lib/feed.test.ts:123`; `content-student-feed.e2e.ts:302`, `:451` | covered |
| 77 | image route serves live PNGs only | `feed/assets/[id]/route.test.ts`; `store.test.ts`; `content-student-feed.e2e.ts:349` | covered |
| 78 | signed out: sign in and back | `gate.test.ts:20`; `content-student-feed.e2e.ts:384` | covered |
| 80 | tags in four groups, locked | `SettingsForm.test.tsx:168`; `actions.test.ts:173`; `content-student-feed.e2e.ts:208` | covered |
| 81 | chips narrow, combine, stay in URL | `lib/feed.test.ts:183`; `FeedChips.test.tsx`; `content-student-feed.e2e.ts:486` | covered |
| 83 | search every word, "No posts match." | `lib/feed.test.ts:225`; `SearchBox.test.tsx`; `content-student-feed.e2e.ts:528` | covered |
| 84 | profile pre-selects empty chips | `lib/profile-contract.test.ts` | partial |
| 85, 86 | market picker, rate file, no-rate refusal | `markets.test.ts`, `lib/market.test.ts`, `text/numbers.test.ts:28`; `content-student-feed.e2e.ts:425` | covered |
| 87 | labels name the market | `lib/board.test.ts:112`, `RenderStep.test.tsx:673` | covered |
| 88 | follow links, page pre-selected | `FollowPages.test.tsx`, `pages.test.ts`, `LivePanel.test.tsx:207`; `content-student-feed.e2e.ts:406` | covered |
| 89 | Instagram URL as its own record | `server/social.test.ts:433`; `SocialWorkbench.test.tsx`; `content-student-feed.e2e.ts:570` | covered |
| 90, 91 | Instagram link; Related with reasons | `store.test.ts`, `FeedPostView.test.tsx`, `related.test.ts`; `content-student-feed.e2e.ts:617` | covered |
| 92 | tags, markets, rates, pages files | `tags.test.ts`, `markets.test.ts`, `pages.test.ts`, `brands.test.ts` | done differently |

Notes: 45 and 54 hold for posts made after this branch; every post whose settings were saved before it crashes its panel (the CRITICAL). 84 is the hook only, as the intent allows, with the Clear problem below. 92 holds for edits but not for a new market. The intent's 7 Oct Changes line ties the provider and sentence work to criteria 13, 14 and 20; those are the Users tab, the admin's read-only view and the workbench, so the table above uses 36, 23, 42 and 65 instead.

## Read outside the diff
- `src/features/content/server/store.ts:184` — `loadPost` casts stored bodies without parsing them, so no schema default applies on read
- `bun -e` on `lib/lines.ts` `tagsLine` with a pre-round settings body — throws `s.tags.flatMap` on undefined
- `src/features/content/ai/replays.ts:65` — `withReplay` keys a recording by demo key and step only, and returns it without the answer's `verify`
- `src/features/content/lib/client-safe.test.ts:12` — checks the direct imports of a hand-kept list; `markets/`, `tags/`, `pages/` and `lib/profile-contract.ts` are not on it
- `src/shared/lib/db/migrations/meta/_journal.json:30` — 0003 is journaled, so `db:migrate` runs it
- `src/features/content/text/sentences.ts:23` (bytes) — the class is two ASCII `"`; the plan's `”` is gone
- `src/app/globals.css:44`, `:76`, `:81` — `gap-block`, `accent-200` and `accent-700` are real tokens
- `src/features/content/text/locate.ts:61` — `numberVerdict` is unchanged; a null unit still matches any and new units only make it stricter
- `grep Nepal` over `src/features/content` and `src/app` (non-test) — only a comment in the feed image route remains

## Findings, by file

### `src/features/content/server/store.ts`

**CRITICAL · line 191 · old rows read without their schema**
- What: `loadPost` reads bodies as `r.body as Body<…>` without parsing them, so `FeedSettingsSchema.tags.default([])` never applies to settings saved before this round. `LivePanel.tsx:39` (`body.tags.find`), `lines.ts:81` `tagsLine` (Review and Live panels) and `SettingsForm.tsx:95` (`draft.tags.includes`) all throw on such a row; `tagsLine` was run to confirm it.
- Why: every post rendered with settings, in review or live before this deploy (the 8 Oct test posts on the shared environment included) fails to open in the workbench on the 12 Oct test. The `ConversionSchema` and `BrandSchema.instagram` defaults are dead on read the same way.
- Rule: `security.md` §6 (deserialise with a schema), and criteria 45 and 54 · a test would have caught it: yes, a store test that inserts a settings body in the old shape by SQL and loads the post. Every fixture writes `tags: []` or goes through `putArtifact`.
- Fix: parse each row with `BODIES[r.kind]` in `loadPost`, which also applies every default, and do the same for `listLive`'s `settings`. Add the old-shape test.

**MEDIUM · line 477 · the whole live list on every feed request**
- What: `listLive` reads every live post's settings, structure, layout and slides on each `/feed` and `/feed/[id]` view. The post page then scans that list for one id. Each cover image runs `isLiveAsset`'s join, with no index behind the `@>` on `body->'slides'`. `LIMIT 500` has no `ORDER BY`, so past 500 live posts an arbitrary set is shown and the newest can drop out.
- Why: the cost grows with live posts × page views × images shown, all on a student surface, and above the limit the result is wrong as well as slow.
- Rule: `performance.md` §1, §2, §6 · a test would have caught it: no, it needs a load test with a few hundred live posts.
- Fix: order by approval time before the limit. Cache `listLive` under a tag that `approveAndPublish` invalidates, and give the post page a by-id read. Say in a comment why a scan is acceptable for `isLiveAsset` at the expected size.

**LOW · line 618 · expired posts' images still served**
- What: `isLiveAsset` checks stage and approval but not expiry, so an expired post's slides stay servable to any signed-in account while its page answers 404 (73).
- Why: the image route and the page disagree about what is live. Ids are content hashes, so the exposure is small.
- Rule: `security.md` §3 · a test would have caught it: yes, a store test with an expired approval.
- Fix: apply `expiresAt` in the query (settings joined through the approval), or check `isLive` before serving.

### `src/features/content/ai/market.ts`

**MEDIUM · line 26 · replays are not keyed by market**
- What: the rewording step is always `'market'` and its read-back `'vision-np'` (`server/commands/shared.ts:340`), whatever the market. `withReplay` keys by demo key and step only and returns the recording without `verify`.
- Why: once `ai:replays` is run, a failed India or Thailand call on a demo source replays the Nepal rewording (Nepal notes, Nepal framing) under an India label. Recording an India run also overwrites Nepal's.
- Rule: criteria 85 and 87, and review Quality · a test would have caught it: yes, record a Nepal replay, then fail an India call on the same demo source.
- Fix: name the steps per market (`market-IN`, `vision-IN`; keep the current names for NP so existing recordings still load).

**LOW · line 112 · Nepal names on generic code**
- What: `nepalVersion`, the `vision-np` step, the feed image route's header comment and `layout/market.test.ts`'s header still say Nepal for every market.
- Why: the next reader takes the market path for Nepal-only code.
- Rule: naming drift · a test would have caught it: no, a convention.
- Fix: rename to `marketVersion` and correct the comments.

### `src/features/content/lib/profile-contract.ts`

**MEDIUM · line 23 · Clear cannot clear a chip the profile filled**
- What: `chipsFromProfile` fills any chip the URL leaves empty. "Clear" removes the key from the URL, so the profile fills it again on the next load.
- Why: once Jenish's body lands, a student from Nepal can never see posts for other destinations or the main version. The contract (ADR-126, proposed, to agree by 9 Oct) fixes this behaviour.
- Rule: criterion 81 (Clear drops one) and the 84 edge case · a test would have caught it: yes, a page test with a profile, then Clear.
- Fix: apply the profile only when the URL carries no filter key at all, or give Clear an explicit value (`destination=any`) that the profile does not overwrite.

### `src/features/content/markets/index.ts`

**MEDIUM · line 10 · a new market is a code change**
- What: `MARKET_IDS` and `MARKET_CURRENCIES` are enums in code. A market added to `markets.json` fails the zod parse at load, and so does its `home:` tag in `tags.json`.
- Why: criterion 92 says a changed markets file gives new values in the lists. Edits to names, notes and rates do; a new market does not.
- Rule: criterion 92 · a test would have caught it: yes, the parse-at-load tests with a fourth market.
- Fix: record in the intent's Changes that a new market needs a code change (the stored market body is an enum), or derive the ids from the file.

### `src/features/content/text/sentences.ts`

**LOW · line 23 · curly quotes lost; some false joins**
- What: the plan's `["”]` became two ASCII quotes, so a source with typographic quotes (most pasted text) still splits `"Will it last?” she asked`. `No.` and single-letter initials (`Plan B.`) now join two real sentences into one claim.
- Why: claims still split or merge where criteria 23, 42 and 65 want them separate.
- Rule: review Quality · a test would have caught it: yes, a fixture with `”` and one ending "No."
- Fix: restore `”`, add both fixtures, and drop `No` from the abbreviation list or require a digit after it.

### `src/features/content/lib/client-safe.test.ts`

**LOW · line 12 · guard misses the new client modules**
- What: `markets/index.ts`, `tags/index.ts` and `pages/index.ts` are imported by `'use client'` steps but are not on the list. `lib/profile-contract.ts` is in `lib/`, where ADR-126 places a database read.
- Why: lib/* is meant to stay client-safe, and the guard will not notice when the contract's body reads the database.
- Rule: CLAUDE.md §Code and the guard's own purpose · a test would have caught it: no.
- Fix: add the three index files. Move `loadStudentProfile` to `server/` and amend ADR-126's location before Jenish confirms.

### `e2e/content-student-feed.e2e.ts`

**LOW · line 97 · stale comment over the 60 s waits**
- What: here and at `content-feed-post.e2e.ts:139` and `content-submission.e2e.ts:109`, the comment says four workers share the dev server; `playwright.config.ts:25` now runs one. No assertion was weakened; the waits only lengthen timeouts.
- Why: the waits also absorb render time under contention, which round one's event-loop finding predicts, and the comment hides that the cause is unmeasured.
- Rule: comment no longer matches · a test would have caught it: no.
- Fix: correct the comment. Recommend one timed run against `bun run build && bun run start`, with two editors rendering at once, to separate dev compilation from render cost.

### `src/features/content/components/feed/FeedChips.tsx`

**LOW · line 7 · two copies of labels and the excerpt rule**
- What: `ROW_LABELS` repeats `TAG_LEGENDS` (`SettingsForm.tsx:65`). `excerptOf` (`store.ts:458`) repeats the excerpt rule in `RenderStep.tsx:59`.
- Why: the feed card and the admin's phone preview can drift apart.
- Rule: review Quality (duplicated logic) · a test would have caught it: no.
- Fix: export the group labels from `tags/index.ts` and the excerpt rule from `lib/feed.ts`.

### `docs/admin-feed-post-from-source/intent.md`

**LOW · line 313 · wrong criterion numbers in Changes**
- What: the 7 Oct entry names criteria 13 (provider) and 14 and 20 (sentences). The plan's Task 30 and its coverage table repeat them.
- Why: whoever traces a criterion to its tests is sent to the Users tab and the workbench.
- Rule: a comment that no longer matches · a test would have caught it: no.
- Fix: 36 for the provider; 23 and 42 for the sentences.

## Pre-existing, not this branch
- `braces` 3.0.3 (GHSA-vfj7-8cjw-p6xm, high) and `esbuild` ≤0.24.2 (GHSA-67mh-4wv8-2f99, moderate) are both in `scan-deps.json`; the dispatch named one. Neither `package.json` nor `bun.lock` changed in `33f32f7..HEAD`, and round one found both in `bun.lock` at `36ffb90`. Both are dev tooling.

## Top 3 priority fixes
1. `src/features/content/server/store.ts:191` — parse each body with `BODIES[kind]` on read, and add an old-shape settings test.
2. `src/features/content/ai/market.ts:26` — key the market and market-vision replay steps by market id.
3. `src/features/content/server/store.ts:477` — order before the limit, cache `listLive` per publish, and read the post page by id.

## Done well
- The feed image route checks the session, then runs a parameterised jsonb containment over approved renders and market versions only, serves PNG only with `nosniff`, and is tested for draft, SVG and unknown ids in unit, DB and browser tests. `/feed` is in `APP_PATHS` and the matcher together, and no staff-only field reaches a client component.
- The Instagram link is enforced in the command (https, `instagram.com` host) as a new immutable record. Reviewer, admin, student, `instagram.com.evil.test` and `javascript:` are refused in a DB test.
- Round one's fixes stand: the Nepal guard still allows only bound supported facts, vision gates block review and publish, and shared still imports no feature. Money stays in code (no-rate pairs refused before the model, bare `$` unconverted). The image request sends no sampling settings, and a missing image part throws, so the fallback runs.

## Built but not asked for
- The market overflow retry and its no-cache rule (`07e7bfc`, `e87a620`, `6268e9c`): outside Tasks 29–42, and in support of criterion 59.
- One Playwright worker locally, and the `sign-in.e2e.ts` alert filter for Next's route announcer.

## Blind spots
- Rows written before a schema change: only a test that writes the old shape by SQL and loads it catches this; every current fixture is new-shape.
- Replays across markets: a test with a recorded Nepal step and a failed India call on the same demo source.
- Feed cost: a load test with a few hundred live posts and their cover requests.
- The profile chips: a page test with a profile and Clear, before ADR-126 is agreed.
- The live Nano Banana call (4:5 aspect ratio), `ai:smoke` and smoke S1–S7 have not been run.

---
Stack: TypeScript, Next.js 16 App Router (server components, route handlers, server actions, proxy), React 19, Drizzle on Postgres (jsonb), Zod 4, Tailwind 4, @google/genai (Gemini `generateContent` with image output), opentype.js, resvg, bun test with happy-dom, Playwright. Passes applied shallowly: the Gemini image request was judged against the plan's SDK notes, not run; the e2e specs were read, not run; the event-loop cost of rendering was not measured.
