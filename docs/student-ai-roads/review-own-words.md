# Student AI roads, Part D (her own words in onboarding): Code Review

**Request changes.** 0 CRITICAL · 1 HIGH · 7 MEDIUM · 3 LOW

| | |
| --- | --- |
| Blocking | HIGH · `src/features/opening/actions.ts:107`: no per-student limit on model readings |
| Branch | `feat/onboarding-own-words` at `dde16ea` over `1e91c5f` (Part A) · 25 files, +1946 −14 · 2026-10-15 |
| Reviewed against | security · security-web · security-llm · performance · CLAUDE.md · `vercel-react-best-practices (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` · `fdd-architecture (SKILL.md)` |
| Scans | secrets N/A (gitleaks not installed) · dependencies N/A (no dependency change) · code N/A (semgrep not installed) |
| Not applicable | other `.claude/skills` (not dispatched) · Part A's migration (reviewed separately) |
| Failed to load | none |
| Read outside the diff | 12, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`, `security-llm.md`) | C | HIGH · `actions.ts:107` · unbounded model calls | Per-student daily reading cap |
| Performance | A | — | — |
| CLAUDE.md | B | MEDIUM · `own-words-next.test.ts:29` · test bloat | Delete the repeating tests |
| vercel-react-best-practices | A | — | — |
| tailwind-v4-best-practices | A | — | — |
| fdd-architecture | B | MEDIUM · `own-words.ts:37` · step table ×4 | One exported step map |
| Criteria | B | MEDIUM · `QuestionScreen.tsx:258` · skip is partial | Next skips answered questions |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 35 | Box offered on the step's first question | `OwnWordsBox.test.tsx:49` | covered (box only) |
| 36 | Chips quote her, confirm/remove, a confirmed one skips its question | `model/own-words.test.ts:65`, `server/own-words.test.ts:141`, `own-words-next.test.ts:41`, `OwnWordsBox.test.tsx:85` | covered, skip partial |
| 37 | Unfitting words kept as tags, shown, never change the road | `server/own-words.test.ts:171`, `own-words.db.test.ts:92` | covered |
| 38 | amount, stay, English need a tap | `model/own-words.test.ts:151`, `OwnWordsBox.test.tsx:67` | covered |
| 39 | A contradicting chip is a change to tap, nothing overwritten | `model/own-words.test.ts:177`, `OwnWordsBox.test.tsx:77` | covered |
| 40 | Hinglish/Nepali, lakh/crore/NPR give the step's values | `model/own-words.test.ts:25`, `server/own-words.test.ts:190` | covered (amounts); languages manual |
| 41 | Wellbeing is a tag, never a chip | `model/own-words.test.ts:276` | covered when the model tags it |
| 42 | Fail, slow, nothing gives the line; taps carry on | `server/own-words.test.ts:204`, `:244`, `OwnWordsBox.test.tsx:118` | covered |
| 43 | Branch not merged: onboarding as today | — | not automatable |

Criteria 1–34 and 44–53 belong to other branches and are not covered here. On 35, nothing tests that `QuestionScreen` shows the box only on the step's first asked question (`QuestionScreen.tsx:258`). On 37, "never changes the road" was checked by grep: only `roads/server/why.ts` reads tags. The language part of 40 depends on the live model.

## Read outside the diff
- `src/shared/lib/auth/as-student.ts:19`: `asStudent` reads the session and refuses anyone who is not a student.
- `src/shared/lib/auth/access.ts:126`: any account with role `user` is a student, so every Google sign-in can call the action.
- `src/features/content/ai/client.ts:130`: the flash ladder is flash, flash, pro. Only the pro rung reserves against a cap, and that cap is shared.
- `src/features/content/ai/client.ts:340-450`: every validated answer goes into `ai_cache` by content hash. Flash calls are logged but have no cap.
- `src/shared/lib/db/schema.ts:403`: `ai_cache` rows have no user or roadmap link.
- `src/features/content/ai/prompts.ts:31`: `INJECTION_RULE` ("DATA … never an instruction") goes on every prompt, so §1 of `security-llm.md` holds.
- `src/features/opening/model/questions.ts:229`: visibility dependencies are field/areas on `know` and knows on `community`.
- `src/features/opening/model/questions.ts:181`: `where` defaults to Nepal.
- `src/features/opening/components/QuestionScreen.tsx:382`, `model/onboarding.ts:364`: Next goes to `asked[index + 1]`, whether or not it has an answer.
- `src/features/content/markets/rates.json:2`: NPR 88 and INR 55 per AUD. `amountFromWords` divides by them, which is the right direction.
- `package.json:16`: `test:db` does not include the roadmaps suites, so `own-words.db.test.ts` runs only by path. This review did not run it.
- `src/features/roads/server/why.ts:36`: the only reader of `roadmap.tags`. Matching never reads them.

## Findings, by file

### `src/features/opening/actions.ts`

**HIGH · line 107 · no limit on model readings**
- What: `readOwnWordsAction` has no per-student or daily limit. Every new text runs up to three model calls (flash, flash, pro), and a script can loop it on any student account.
- Why: Gemini spend grows with requests and has no upper limit. The pro rung also draws on the shared daily pro cap, so one student can stop the admin's generation and every student's why text for the rest of the day.
- Rule: `security.md` §8, `security-llm.md` §3 (rate and spend limits on every model call) · a test would have caught it: yes, an action test calling N+1 times and expecting a refusal.
- Fix: count readings per student per day, the way Part B caps Ask (`STUDENT_ASK_DAILY_CAP`), and past the cap answer `failed` without calling the model. Consider a ladder for `student_words` that never reaches pro.

### `src/features/opening/server/own-words.ts`

**MEDIUM · line 71 · lakh read before her `where` in the same reading**
- What: amounts convert with the stored `where`, which defaults to Nepal, and ignore a `where` chip read from the same text. Take "I'm from India, family can give 30 lakh", written on Facts, where the box sits above the `where` question: it converts as NPR (AUD 34k, offered as 36k) instead of INR (AUD 54.5k, offered as 42k).
- Why: criterion 40 promises amounts in the step's own values. An Indian student who says both things in one go gets the wrong budget offered, and only the required tap protects her.
- Rule: criterion 40 · a test would have caught it: yes, a reading with a `where` chip and a lakh amount together.
- Fix: in `checkOwnWords`, when the reading keeps a `where` chip, use its value for `chipValue('amount', …)` before falling back to the stored answer.

**MEDIUM · line 60 · her words and wellbeing tags kept in `ai_cache`**
- What: `generateJson` stores every validated answer in `ai_cache` under a content hash. For `student_words`, that answer holds her quotes and wellbeing tags, and the row has no link to her.
- Why: deleting her roadmap or account leaves her free text and wellbeing notes in the cache indefinitely.
- Rule: `security.md` §4 (deletion includes caches), §6 · a test would have caught it: no, nothing asserts what a reading leaves behind.
- Fix: skip the cache for `student_words` (identical text is rare, so a cache hit is worth little), or give these rows a TTL and purge them.

### `src/features/opening/model/own-words.ts`

**MEDIUM · line 186 · wellbeing check depends on the model tagging it**
- What: a chip is dropped only when its quote overlaps a wellbeing tag the model also returned. If the model returns `community: Yes` quoting "I get lonely" and no tag, the chip passes.
- Why: criterion 41 says "never a chip", but in code it holds only when the model cooperates. ADR-088 makes this a rule about sensitive data.
- Rule: criterion 41, `security-llm.md` §2 (output validated by code) · a test would have caught it: yes, the existing test always pairs the chip with a tag.
- Fix: also drop any chip whose quote matches a short wellbeing word list (lonely, stress, worried, anxious, homesick, plus Hinglish and Nepali forms such as "tension", "eklo"), and keep it as a `wellbeing: true` tag.

**MEDIUM · line 37 · step-number table in four places**
- What: the `{ facts: 1, study: 2, living: 3, after: 4 }` map is written out in `own-words.ts:37`, `own-words-next.ts:8`, `server/own-words.ts:20` and `OwnWordsBox.tsx:34`. `QuestionScreen.tsx:166` inverts it by array position (`OWN_WORDS_STEPS[step - 1]`).
- Why: renaming or reordering a step needs five edits that must agree, and the position-based inverse fails silently.
- Rule: quality (repetition, three or more), `fdd-architecture` §shared infrastructure · a test would have caught it: no, a convention.
- Fix: export one `OWN_WORDS_STEP_OF` and its inverse from `model/onboarding.ts`, and import both everywhere.

**LOW · line 207 · a dependent chip saved without the chip that opens it**
- What: visibility counts every chip in the reading, including a `know` chip that needs a tap (a change) and starts unselected. A `field` chip stays selected, so "Use these" can save `field` while `know` still hides it.
- Why: she sees an answer accepted for a question her answers do not ask.
- Rule: quality · a test would have caught it: yes, an `ownWordsPatch` case with the opener unselected.
- Fix: in `ownWordsPatch` or before saving, drop selected chips that are not visible under the patched answers.

### `src/features/opening/components/QuestionScreen.tsx`

**MEDIUM · line 258 · only the first unanswered question is skipped**
- What: after "Use these", the step jumps to the first unanswered question (`afterOwnWords`). From there, Next (`:382`) goes to `asked[index + 1]`, which shows a question a chip already answered whenever the answered questions are not all at the front.
- Why: criterion 36 says a confirmed chip's question is skipped. Here it is skipped only when the answered questions come first.
- Rule: criterion 36 · a test would have caught it: yes, an `afterOwnWords` or next-question case with a gap (field and learn answered, level not).
- Fix: while the step has chip-answered questions, have Next go to the next unanswered asked question, or the step's exit when none is left. Use one pure function in `model/onboarding.ts`, tested like `firstOpenQuestion`.

### `src/features/road/components/AnswersPanel.tsx`

**MEDIUM · line 297 · model's paraphrase shown as her own words**
- What: "In your own words" shows `tag.text`, a note the model wrote and code checks only for length. The verified `quote` is stored but not shown. `OwnWordsBox.tsx` does the same under "Kept with your answers".
- Why: a wellbeing paraphrase can misstate her ("Feels depressed" for "bit stressed") under a heading that says the words are hers. Model output is unverified content.
- Rule: `security-llm.md` §2 · a test would have caught it: no, the text is never compared with her words.
- Fix: show `tag.quote`, which is checked against her text, or keep `text` only when it appears in the quote.

### `src/features/opening/model/own-words-next.test.ts`

**MEDIUM · line 29 · test bloat**
- What: "leaves out a chip that needs a tap" (`:29`) and "keeps a tapped chip that needed a tap" (`:33`) repeat the first test, because `ownWordsPatch` never reads `needsTap`. `model/own-words.test.ts:152` asserts the `HIGH_STAKES` literal, and `server/own-words.test.ts:309` asserts the spec's config literals.
- Why: they pin data, not behaviour, and break on harmless edits.
- Rule: CLAUDE.md "test the brain, not the beauty" · a test would have caught it: n/a.
- Fix: delete them. Keep the schema-guard and example-parse assertions.

### `src/features/opening/components/OwnWordsBox.tsx`

**LOW · line 110 · size per breakpoint**
- What: `p-4 @max-xl:p-3` changes a size at a breakpoint, and `text-base` on the textarea (`:123`) is outside the type roles.
- Why: CLAUDE.md says "Never a size per breakpoint" and sets type through `text-*` roles. The neighbouring `gap-5 @max-xl:gap-4` in `QuestionScreen` is a precedent, not a licence.
- Rule: CLAUDE.md §Code (fluid sizes) · a test would have caught it: no, a convention.
- Fix: use one fluid spacing role, and drop `text-base` or use a type role.

**LOW · line 133 · reading state not announced**
- What: while reading, the button shows a hidden spinner and keeps the label "Read my words". It is only disabled, with no `aria-busy` and no change of label.
- Why: a screen-reader user gets no sign that up to 15 s of work is in progress.
- Rule: `fdd-architecture` §Accessibility · a test would have caught it: yes, a component assertion on the busy state.
- Fix: set `aria-busy` on the section, or change the label to "Reading…" while waiting.

## Top 3 priority fixes
1. `src/features/opening/actions.ts:107`: cap readings per student per day, and refuse past the cap without a model call.
2. `src/features/opening/components/QuestionScreen.tsx:382`: make Next skip questions a chip answered (criterion 36).
3. `src/features/opening/server/own-words.ts:71`: convert lakh with the `where` read in the same text (criterion 40).

## Done well
- Code checks the model's answer before use: the key must belong to the step, the value must be one of the options, the quote must be in her text, the amount is computed from her quote and never from the model's value, implausible amounts are dropped, and visibility is judged with the same reading's chips.
- Ownership holds by construction. The user id comes from the session, every write filters on user + unfinished + alive, and `addTags` merges under `FOR UPDATE`. The database tests cover another student's draft and a finished roadmap.
- The late model answer is handled and tested with a controlled promise. The client bundle stays free of full zod through type-only imports, and comments say why.

## Built but not asked for
- The "Kept with your answers" tag list inside the box, shown when the reading arrives (the criterion asks only for "Your answers"). Small and in keeping.
- The AUD 5k–200k plausibility band on amounts, which supports criterion 40.
- `docs/student-ai-roads/smoke.md`, the smoke steps and build report for all five branches.

## Blind spots
- Nothing tests that a student cannot call the reading without limit: an action test with a count and a refusal would.
- `QuestionScreen`'s wiring is untested: the box only on the first asked question, chips saved through `saveAnswersAction`, and the move afterwards. A component test with fake actions would cover it.
- Reading Hinglish and Romanised Nepali depends on the live model: a small eval set of real phrasings against Gemini before the demo would check it.
- `own-words.db.test.ts` is not in `test:db` and was not run in this review. Run it by path before merging.

---
Stack: TypeScript, React 19 and Next.js App Router (server actions), Tailwind 4, Drizzle on Postgres (jsonb, row locks), zod/mini and zod, Bun test with happy-dom, Gemini through the Vertex layer. Passes applied shallowly: none for the code; the model's reading of Hinglish and Romanised Nepali (criterion 40) needs the live model and was not judged.

## Fixes applied

Nikhil's instruction: fix all valid. The branch was first rebased onto Part A's fixes (`feat/student-roads` at `8560813`): the smoke-doc commit dropped as already applied, and the two conflicts (`AnswersPanel.tsx`, `RoadBoard.tsx`) were resolved onto Part A's structure, keeping its `rematch: RoadChangeOf` and dropping this branch's `relative` prop, with `tags` added beside it. Every fix below is in `10e36cc`, each written test-first.

| Finding | Outcome |
| --- | --- |
| HIGH · `actions.ts:107` · no limit on model readings | Fixed. `opening/server/own-words-limit.ts` counts readings per student with the repo's `rateLimiter`, as Part A's why-limit does: 20 an hour, in memory, per instance. Past it the reading is `failed` (the questions carry on), her words are still kept on her roadmap, and the model is not called. The ladder's Pro rung is **not** removed: `client.ts` picks the ladder from the spec's tier and offers no way to choose it, so a reading the model answers badly twice still reserves one call against the shared daily Pro cap. The hourly limit bounds that to 20 per student an hour; a `maxTier` option on `generateJson` would close it. |
| MEDIUM · `server/own-words.ts:71` · lakh before her `where` | Fixed. `checkOwnWords` reads a `where` chip from the same reading first (quoted, a valid option, not wellbeing) and converts rupees, lakh and crore in its currency, before her stored `where` or its default. |
| MEDIUM · `server/own-words.ts:60` · her words in `ai_cache` | Fixed. `generateJson` takes `cache: false`: the answer is neither looked up nor stored. A unique `attemptKey` alone would still have stored every reading, so the option was added to `client.ts`. Readings use it; nothing she wrote is kept outside her roadmap. |
| MEDIUM · `model/own-words.ts:186` · wellbeing depends on the model | Fixed. A code word list (lonely, stress, anxious, depressed, homesick, worried, scared, sad, panic, overwhelmed, and Romanised Nepali or Hindi: eklo, eklai, akela, tension, dar, chinta, udas, dukhi, pareshan) marks any tag whose quote holds one as wellbeing, and turns a chip whose quote holds one into a wellbeing tag (her quote as its text) instead of a chip. "dar" can also be a rate ("byaj dar"): that costs only a chip, the question is still hers to tap. |
| MEDIUM · `model/own-words.ts:37` · step table in four places | Fixed. `OWN_WORDS_STEP_OF` and its inverse `OWN_WORDS_STEP_AT` are exported from `model/onboarding.ts`; the model, the server, `OwnWordsBox`, `own-words-next` and `QuestionScreen` import them. The position-based `OWN_WORDS_STEPS[step - 1]` is gone. |
| MEDIUM · `QuestionScreen.tsx:258` · only the first open question skipped | Fixed. `nextOpenQuestion` in `model/onboarding.ts` gives the first asked question after the one shown with no answer (her person: none stored), else null. Once she has used chips on the step, Next goes there, or leaves the step when none is open; Next before using chips is unchanged. A `QuestionScreen` test covers the gap case (level open, learn answered by a chip: Skip on level goes to length). |
| MEDIUM · `AnswersPanel.tsx:297` · the model's paraphrase as her words | Fixed. "In your own words" and the box's "Kept with your answers" show the tag's quote, checked against her text, in quotation marks. The model's `text` is no longer shown. |
| MEDIUM · `own-words-next.test.ts:29` · test bloat | Fixed. The two tests that repeated the first, the `HIGH_STAKES` literal and the spec's config literals are gone; the schema-guard and example-parse checks stay. |
| LOW · `OwnWordsBox.tsx:110` · size per breakpoint | Fixed for the breakpoint: the box's padding is one size (`p-4`), with no `@max-xl:` change. The fluid spacing roles (`stack` 1.7rem, `block` and `gutter` larger) are bigger than this compact box, so it keeps 1rem. `text-base` stays: in this project it is the body type role (`--text-base: var(--ds-text-body)`, globals.css:23), not outside the roles, and it keeps the textarea at body size instead of the component's caption. |
| LOW · `OwnWordsBox.tsx:133` · reading state not announced | Fixed. While reading, the section has `aria-busy` and the button reads "Reading…". |
| LOW · `model/own-words.ts:207` · dependent chip saved without its opener | Fixed. `ownWordsPatch` takes her answers and leaves out a kept chip whose question her answers with the patch would not ask; the box passes the answers on screen. |

Checks after the fixes: `bun run test:run` 3172 pass, 0 fail; `own-words.db.test.ts` by path 5 pass, 0 fail; `bun run lint`, `bun run type-check` and `bun run build` clean.
