# Posts in Nepali, Hindi and Thai · Implementation Plan

**Intent:** docs/guided-post-design/intent.md, story 11 (GD36–GD40).
**Goal:** An editor makes a post or blog in Nepali, Hindi or Thai from English sources, with facts still checked, drawn in the right fonts, and shown to students from the matching home country.
**Approach:**
- **One language list,** a data file (`languages/languages.json`), carried by the source record. Every copy prompt gets the language and a rule. Code checks the script and keeps Western digits, so the number checks are unchanged.
- **Fonts:** Noto Sans Devanagari and Noto Sans Thai (SIL OFL), bundled beside Barlow. The layout engine measures and draws each text run with the font for its script.
- **Fixed lines** come from a small table per language.
- **The feed** matches a post's language to the home chip.

**Test layers:** unit and DB, as in plan-2. Behaviour gets tests, looks get none. No browser specs unless asked.

**Constraints:** as in `docs/guided-post-design/plan-2.md`, with these changes:
- **Branch** `feat/route-insights`.
- **Test database** `app_insights`, at migration 0016. No migration is expected; the language lives in record bodies.
- **Fonts** must be OFL with their licence file committed beside them, and the README's third-party list gains them.

## Task 1: The language on a post (GD36)
**Kind:** judgement
- **`languages/languages.json`:**
  - English, Nepali, Hindi and Thai, each with `{ id: 'en' | 'ne' | 'hi' | 'th', label, nativeLabel, script: 'latin' | 'devanagari' | 'thai', home: null | 'NP' | 'IN' | 'TH' }`;
  - loaded by `languages/index.ts`, following the emotions pattern, which exports `LANGUAGES`, `LanguageId` and `languageById`.
- **The record:** `BODIES.source` gains `language: z.enum([...]).default('en')`, so old sources parse as English.
- **`makePost` and "New blog"** take `language`. `SourceForm` shows a language choice at the start (English pre-selected, GD29), with each option's native name.
- **The remake form** keeps it; changing it at Source remakes from there (GD28).
- **Tests:**
  - **Unit:** old sources parse as `en`.
  - **DB:** a post made in Nepali stores `ne`; a remake changing the language stores the new one.
  - **Component:** the choice exists and English is pre-selected.
- Commit `feat(content): choose a post's language: English, Nepali, Hindi or Thai`.

## Task 2: Every copy prompt in that language (GD37)
**Kind:** judgement
- **Data and rule:** IDEAS, OUTLINE, DRAFT, DRAFT_SLIDE (and nudges), CAPTION (hook and call to action), BLOG_OUTLINE, BLOG_TEXT and COMIC_STORY each get `language: { id, label }` in their data. The rule: "Write every text for readers in <label>, in its own script; keep numbers as Western digits 0–9; keep names of places, universities and visas as they are."
- **Verify (pure, `text/script.ts`):** `scriptShare(text, script)` is the share of letters in the script's Unicode range (Devanagari U+0900–U+097F, Thai U+0E00–U+0E7F). Each verify refuses text under 60% when the language is not English, as a retry problem. Digits outside 0–9 (Devanagari U+0966–096F, Thai U+0E50–0E59) are refused.
- **SOURCE_CHECK:** a rule that the sentence may be in another language than the fact; judge the meaning.
- **Versions:** bump each prompt version.
- **The fake provider** answers in the language when asked: short canned strings per script, so tests can see it.
- **Tests:**
  - `scriptShare` for each script;
  - a Nepali draft in Latin script is refused and retried;
  - native digits are refused;
  - the data carries the language;
  - an English post's data and prompts are unchanged apart from the version.
- Commit `feat(content): Gemini writes a post's text in its language, checked for script and digits`.

## Task 3: Fonts for Devanagari and Thai (GD38)
**Kind:** judgement
- **Bundle the fonts** in `src/features/content/assets/fonts/` with their OFL licence text: Noto Sans Devanagari Regular and Bold, and Noto Sans Thai Regular and Bold. Download them from the official Noto repositories (github.com/notofonts/devanagari, github.com/notofonts/thai, release builds), then check that each file loads with opentype.js.
- **The engine** (`layout/measure.ts`, `layout/engine.ts`) splits a line into script runs and measures each run with its font. Wrapping stays whole-word; Thai has no spaces, so break Thai at `Intl.Segmenter` word boundaries (locale `th`).
- **`svg.ts`** writes each run with its family. `toPng` (`layout/png.ts`) loads the new font files into resvg's `fontFiles`.
- **`missingGlyphs`** checks against the font for each run's script.
- `next.config.ts`'s `outputFileTracingIncludes` keeps the new font files in the standalone build, as it does for Barlow.
- **Tests:**
  - a Nepali and a Thai slide lay out and pass `fitChecks` (glyph, box, legibility);
  - a Thai paragraph wraps at word boundaries;
  - the SVG names the Noto family for those runs;
  - a PNG renders (the resvg path).
- Commit `feat(content): Noto Sans Devanagari and Thai for Nepali, Hindi and Thai slides`.

## Task 4: Fixed lines in the post's language (GD39)
**Kind:** transcription for the table, judgement for the wiring
- **`languages/lines.json`:** per language, the search line template (`To find this again, search “OfCourse {title}”`), "Read the full guide", "Sources", "Swipe", and the caption's sources heading. Write the Nepali, Hindi and Thai lines carefully. They are short; mark them for a native speaker's check in the handover.
- **Wiring:** `SEARCH_LINE`, the sources line and slide, the swipe cue, the caption's tail and the guide line read the post's language. "OfCourse" and the title stay as written.
- **Tests:** a Thai post's last slide carries the Thai search line with "OfCourse" and the title; the Nepali caption's sources heading; English unchanged.
- Commit `feat(content): the lines code writes, in the post's language`.

## Task 5: Who sees it in the feed (GD40)
**Kind:** judgement
- **Feed rule:** a published non-English post gets the tag of its language's home country (`home:NP`, `home:IN`, `home:TH`) through its settings defaults and, in the feed rule (`lib/feed.ts`), shows only under the matching home chip. An English post shows under every home chip, as today.
- **Display:** the card and post page show a language label (the native name).
- **The public page** sets `lang` on its content and in the metadata.
- **Tests:** a Nepali post shows under home NP and not under IN; an English post under both; the card's label; the page's `lang`.
- Commit `feat(content): Nepali, Hindi and Thai posts reach students from those countries`.

## Criteria coverage
| Criterion | Task | Test |
| --- | --- | --- |
| GD36 | 1 | `artifacts.test.ts`, `commands.test.ts` (language stored, remake), SourceForm test |
| GD37 | 2 | `script.test.ts`, the specs' verify tests, `draft.test.ts` (language in data) |
| GD38 | 3 | `engine.test.ts`, `fit.test.ts`, `svg.test.ts`, `png.test.ts` |
| GD39 | 4 | `engine.test.ts`, `caption.test.ts` |
| GD40 | 5 | `feed.test.ts`, card and page tests |
