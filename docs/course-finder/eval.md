# The finder eval: the recorded run

_The latest run is the last section, [17 Oct 2026, after Nikhil's decisions](#17-oct-2026-after-nikhils-decisions). The sections before it are the record of the overnight runs._

_Run on 17 October 2026 (the script prints the UTC date, 2026-10-16) against a local pgvector Postgres seeded with the whole sample catalogue, embedded by the real model. Command:_

```bash
DATABASE_URL=postgres://app:app@127.0.0.1:5434/app GOOGLE_CLOUD_PROJECT=applyims GOOGLE_CLOUD_LOCATION=global bun run finder:eval
```

- **Model:** `gemini-embedding-001`, 768 dimensions, query task `RETRIEVAL_QUERY`.
- **Catalogue:** 479 courses.
- **Queries:** 3 demo queries, 2 negative queries, 20 held-out queries, 10 nonsense strings.
  - The queries are in `src/features/finder/evals/queries.ts`.
  - An isolated agent wrote the held-out queries. It read only `src/features/roads/data/fields.ts`.
- **Filters:** none (`searchCourses(text, {})`).

Two runs:
- **Run 1** used the placeholder floor, 0.5.
- **Run 2** used the fitted floor, **0.605**. That is run 1's suggestion, and it is now `FINDER_FLOOR` in `src/features/finder/model/config.ts`.

**Result:** the eval exits 1 in both runs. Q2 cannot pass, because FIELDS has no behavioural-economics field (see Q2 below). Every other check passes.

## Counts

| | Run 1 (floor 0.5) | Run 2 (floor 0.605) |
| --- | --- | --- |
| Demo queries passing | 2 of 3 (Q2 cannot pass) | 2 of 3 (Q2 cannot pass) |
| Negatives passing | 2 of 2 | 2 of 2 |
| Held-out hit@3 | **19 of 20** | **17 of 20** |
| Suggested floor | 0.605 | 0.617 |

## Demo queries: the top 5 (run 2; the same in run 1)

**Q1** "I like understanding why people do things, and I'm good with computers". It expects `cyber-psychology` and **passes: rank 1**.

1. 0.675 Master of Cyber Psychology [cyber-psychology]
2. 0.671 Master of Cyber Behaviour and Human Factors [cyber-psychology]
3. 0.666 Master of Human-Computer Interaction [hci]
4. 0.664 Master of Social Engineering and Human Risk [cyber-psychology]
5. 0.661 Diploma of Business Analytics [business-analytics]

**Q2** "I want to know why people make bad choices with money, and I'm good at maths". It expects `behavioural-economics` and **cannot pass: FIELDS has no such field**.

The isolated niche-field proposal (task 2) produced no behavioural-economics field. No field is added to make a query pass, so this is a decision for Nikhil (intent, open question 3).

1. 0.664 Graduate Diploma of Actuarial Studies [actuarial-studies]
2. 0.661 Master of Actuarial Science and Finance [actuarial-studies]
3. 0.643 Master of Actuarial Studies [actuarial-studies]
4. 0.636 Diploma of Financial Services [business]
5. 0.634 Master of Actuarial Science [actuarial-studies]

**Q3** "I like drawing and I want to make apps people enjoy using". It expects `hci` and **passes: rank 1**.

1. 0.670 Diploma of User Interface Design [hci]
2. 0.659 Master of Interaction Design [design]
3. 0.652 Diploma of Digital Design and Animation [design]
4. 0.651 Diploma of Design Foundations [design]
5. 0.641 Diploma of Graphic Design and Illustration [design]

## Negative queries

Each must keep `cyber-psychology` out of the top 3. Both pass in both runs.

"I want to build bridges": **pass**.

1. 0.629 Master of Engineering (Structural) [engineering]
2. 0.624 Master of Engineering (Civil Infrastructure) [engineering]
3. 0.613 Diploma of Engineering Studies [engineering]

"I love cooking": **pass**. In run 2 it shows nothing close (best 0.594). Run 1's top 3:

1. 0.594 Diploma of Nutrition and Wellbeing [health]
2. 0.563 Master of Marketing [business]
3. 0.558 Diploma of Health and Nutrition Studies [health]

## Held-out hit@3

### Run 1 (floor 0.5): 19 of 20

The one miss:

"As shift lead at my café I loved figuring out who works well together on the roster and keeping the crew happy." It expects `organisational-psychology`, which is at rank 6.

1. 0.630 Diploma of Leadership and Management [business]
2. 0.630 Diploma of Health Care Management [health]
3. 0.610 Diploma of Human Resources Management [business]

### Run 2 (floor 0.605): 17 of 20

The run 1 miss, plus two queries whose best score is now under the floor:

- "I taught myself Python and made a Discord bot for my friends. Hunting down bugs is weirdly satisfying." It expects `software`. Nothing close (best 0.599); at floor 0.5 it was a hit.
- "My mates and I host our own Minecraft server and I'm obsessed with keeping the lag low and making sure it never crashes." It expects `networks`. Nothing close (best 0.592); at floor 0.5 it was a hit.
- "As shift lead at my café …" It expects `organisational-psychology` (rank 6). Its top 3 are as in run 1.

## The floor: best-score distributions (run 1)

**Held-out hits (19):** 0.592 0.599 0.615 0.620 0.624 0.625 0.633 0.633 0.644 0.650 0.650 0.666 0.669 0.673 0.676 0.682 0.683 0.692 0.711.

**Nonsense strings:**

| String | Best score |
| --- | --- |
| "asdf" | 0.599 |
| "qwerty uiop" | 0.582 |
| "the" | 0.595 |
| "123" | 0.593 |
| "zzzz" | 0.592 |
| "lorem ipsum" | 0.578 |
| "blue" | 0.597 |
| "hmm" | 0.619 |
| "ok" | 0.593 |
| "..." | 0.606 |

- The highest nonsense score is 0.619. The lowest held-out hit is 0.592. The midpoint is **0.605**.
- **The two distributions overlap.** No floor can stop all the nonsense and keep every real query:
  - At 0.605, "hmm" (0.619) and "..." (0.606) still get results.
  - Two real held-out queries (0.592, 0.599) get "Nothing close yet".
  - The floor removes most nonsense, at the price of 2 held-out hits.
- **The suggestion drifts.** Run 2 suggests 0.617, because it sees only the hits that clear the floor in use. The suggestion feeds on itself, so the floor was fitted once, from run 1, as the plan says.
- **Postgres notices.** Nonsense such as "123", "..." and "the" make the keyword query print a notice: "text-search query contains only stop words…". The notice does not hold the query text. It is left out of the output above.

## Criterion 15 (no shared words)

`src/features/finder/evals/queries.test.ts` checks that no demo query shares a content word (stopwords aside) with an expected course's description. The check fails on the generated catalogue. The shared words, per course:

**Q1** (expects `cyber-psychology`):

| Course | Shared words |
| --- | --- |
| Master of Cyber Psychology | "why", "people" |
| Diploma of Security Awareness and Behaviour | "people", "why" |
| Master of Social Engineering and Human Risk | "people" |
| Master of Online Behaviour and Digital Wellbeing | "people" |
| Master of Human-Centred Security | "people" |
| Diploma of Online Safety and Digital Behaviour | "people" |

**Q3** (expects `hci`):

| Course | Shared words |
| --- | --- |
| Diploma of User Interface Design | "apps" |
| Master of Interaction Design and Usability | "people" |
| Master of User Experience Design | "people" |
| Master of Human-Computer Interaction | "people" |
| Master of Human-Centred Design | "people" |
| Master of Digital Interaction Design | "people" |

**Q2** has no expected courses, because its field does not exist.

- Q1 and Q3 still rank their field first.
- Shared words are only part of what puts them there: the embedding compares the whole text.

**The decision is open, for Nikhil.** Either:
- edit those descriptions, then rebuild and re-seed;
- or narrow the rule to exclude common words.

Until then all three checks in `queries.test.ts` are `test.skip`, each with its reason. The assertions are kept as written, so un-skipping restores the check.

## 17 Oct 2026, after Nikhil's decisions

_One run, on 17 October 2026, with the same command, database (479 courses) and model as above, after the word lists were split and the eval was given the action's retry (below). The sections above are the record of the overnight runs; this one replaces their numbers. The eval exits 0._

### What changed

- **Q2 is new.** FIELDS has no behavioural-economics field, so Nikhil swapped Q2 for the existing `actuarial-studies` field. The controller wrote the query from the field's meaning, without reading any course description:
  - "I'm good at maths and I like working out the chances of bad things happening and what they would cost". It expects `actuarial-studies`.
  - Criterion 15 then failed on one shared word, "maths" (Graduate Diploma of Actuarial Studies). "maths" was replaced by a plain synonym, as the brief allowed. "mathematics" was tried first and shared the word with three actuarial descriptions. "numbers" shares none. The query in `queries.ts` is now "I'm good at numbers and I like working out the chances of bad things happening and what they would cost".
  - The wording was not changed to improve its rank. The eval ran once.
- **Two word lists, one per rule** (`src/features/finder/model/words.ts`). Nikhil's decision narrowed criterion 15 to topic words, so the words common in what a student says about herself were set aside. A first run put them into `STOPWORDS`, the one list the word-count rule also reads, and that broke the rule: Q3 counted only "drawing" and was refused without a search, and neither negative reached the model. They are now two lists:
  - `STOPWORDS`, the basic list as it was before 17 October. `contentWords(text)` drops only these. The word-count rule (`server/search.ts`) and the fake embedding read it.
  - `COMMON_WORDS`, the 17-October words: "app", "apps", "enjoy", "good", "how", "like", "love", "make", "makes", "making", "people", "really", "stuff", "thing", "things", "use", "using", "want", "why". `topicWords(text)` drops both lists. Criterion 15 (`queries.test.ts`) reads it, and all three checks pass.
  - A contraction is one word: "I'm good" reads as "i'm", "good", never "m".
- **The word-count rule and floor 0.5.** Text with fewer than 3 content words (`FINDER_MIN_WORDS`) is nothing close. It makes no embedding call and no query. For longer text, `FINDER_FLOOR` is 0.5.
- **The eval retries as the action does.** Each search gets 2 seconds, then one quiet retry of 5 seconds (`searchWithRetry`, `server/retry.ts`, shared by the action and the eval). The first run had no retry, and two held-out searches failed on time, not on meaning.

### Demo queries

**Q1** "I like understanding why people do things, and I'm good with computers". It expects `cyber-psychology` and **passes: rank 1**.

1. 0.675 Master of Cyber Psychology [cyber-psychology]
2. 0.671 Master of Cyber Behaviour and Human Factors [cyber-psychology]
3. 0.666 Master of Human-Computer Interaction [hci]
4. 0.664 Master of Social Engineering and Human Risk [cyber-psychology]
5. 0.661 Diploma of Business Analytics [business-analytics]

**Q2** "I'm good at numbers and I like working out the chances of bad things happening and what they would cost". It expects `actuarial-studies` and **passes: rank 1**.

1. 0.691 Master of Actuarial Studies [actuarial-studies]
2. 0.688 Master of Actuarial Practice [actuarial-studies]
3. 0.686 Graduate Diploma of Actuarial Studies [actuarial-studies]
4. 0.682 Master of Actuarial Science and Finance [actuarial-studies]
5. 0.675 Master of Actuarial Studies [actuarial-studies]

**Q3** "I like drawing and I want to make apps people enjoy using". It expects `hci` and **passes: rank 1**. It has 8 content words, so it is searched.

1. 0.670 Diploma of User Interface Design [hci]
2. 0.659 Master of Interaction Design [design]
3. 0.652 Diploma of Digital Design and Animation [design]
4. 0.651 Diploma of Design Foundations [design]
5. 0.641 Diploma of Graphic Design and Illustration [design]

### Negative queries

Each must keep `cyber-psychology` out of the top 3. **Both pass.**

- "I want to build bridges" has 3 content words ("want", "build", "bridges"), so it reaches the model. Its top 3 are all engineering:
  1. 0.629 Master of Engineering (Structural) [engineering]
  2. 0.624 Master of Engineering (Civil Infrastructure) [engineering]
  3. 0.613 Diploma of Engineering Studies [engineering]
- "I love cooking" has 2 content words ("love", "cooking"): nothing close, with no search. It still does not reach the model, so it passes without testing meaning.

### Held-out hit@3: 19 of 20 (the bar is 16)

No search failed on time. The one miss:

- "As shift lead at my café I loved figuring out who works well together on the roster and keeping the crew happy." It expects `organisational-psychology`, at rank 6, as overnight:
  1. 0.630 Diploma of Leadership and Management [business]
  2. 0.630 Diploma of Health Care Management [health]
  3. 0.610 Diploma of Human Resources Management [business]

The 19 hits' best scores: 0.592 0.599 0.615 0.620 0.624 0.625 0.633 0.633 0.644 0.650 0.650 0.666 0.669 0.673 0.676 0.682 0.683 0.692 0.711. All are above 0.5, so the floor drops none.

### Nonsense strings

All 10 are nothing close, with best 0.000: "asdf", "qwerty uiop", "the", "123", "zzzz", "lorem ipsum", "blue", "hmm", "ok", "...".

- Each has fewer than 3 content words, so the word-count rule stops it before the model. The floor is not tested by them.
- The script's "Suggested FINDER_FLOOR: 0.296" is half the lowest hit, against a nonsense maximum of 0. It means nothing now, and the floor was not changed to match it.

### The floor is no longer fitted on the held-out set

This answers the review's LOW at `config.ts:9`, "the floor was fitted on the held-out set".

- The overnight floor, 0.605, was the midpoint between the held-out hits and the nonsense scores. The held-out score was then reported at that same floor, so the 20 queries were not fully held out.
- The floor is now 0.5, a round number Nikhil chose. It was not fitted on the held-out queries or the nonsense strings.
- The word-count rule, not the floor, now stops the nonsense.
- The held-out 19 of 20 above is measured with a floor the queries did not set.

_17 Oct 2026, later: after main added 9 occupations, the catalogue's occupation codes and career lines were refreshed by rule (`finder:build --rules-only`: no re-embedding, same 479 courses). The reseed embedded 0 of 479, and one eval run gave the same results as above: Q1 to Q3 at rank 1, both negatives pass, held-out 19 of 20._

### Q2 is not independent of the held-out set

Q2 was written after the held-out results were known, and it resembles held-out query 13 ("Probability is my favourite topic, and I like working out the odds of things going wrong and putting a dollar figure on it", `actuarial-studies`). Its rank 1 shows the model finds the field from a paraphrase; it is not a fresh held-out result.

### The cooking negative reaches the model

"I love cooking" had 2 content words, so it stopped at the word-count rule and never tested meaning. It is now "I love cooking big family dinners on weekends", which has 6 and is searched (`queries.test.ts` checks every negative reaches the model).

_17 Oct 2026, final review fixes: one run, same command, database (479 courses) and model; the eval exits 0. Q1 to Q3 at rank 1, both negatives pass, held-out 19 of 20. "I love cooking big family dinners on weekends" top 3: 0.572 Diploma of Nutrition and Wellbeing [health], 0.532 Master of Marketing [business], 0.527 Diploma of Data Visualisation [data]; "I want to build bridges" top 3: 0.629 Master of Engineering (Structural), 0.624 Master of Engineering (Civil Infrastructure), 0.613 Diploma of Engineering Studies [engineering]._

## 17 Oct 2026, intersections

Courses now belong to every subject they combine (Nikhil, 17 Oct 2026). Three Cyberpsychology courses (UTAS, Monash, North Metropolitan TAFE) are filed under Psychology. The four security courses that had been labelled Cyberpsychology (Swinburne, ECU, Curtin, UTS) are now `security-governance`, which is not niche. The seven health informatics courses are filed under Health. The `cyber-psychology` definition was rewritten. No description changed.

- `bun run finder:build --rules-only`: raw 529 · invalid 0 · near-duplicates dropped 0 · kept 479.
- `bun run finder:seed`: embedded 0 of 479 · removed 0. course_doc now holds `psych` / `cyber-psychology` for the UTAS Master of Cyber Psychology.
- `bun run finder:eval`, one run (gemini-embedding-001, 479 courses, floor 0.5), exit 0.

**Q1** "I like understanding why people do things, and I'm good with computers" expects `cyber-psychology`. Three such courses remain, down from 7. It **passes at rank 1**:

1. 0.675 Master of Cyber Psychology [cyber-psychology]
2. 0.671 Master of Cyber Behaviour and Human Factors [security-governance]
3. 0.666 Master of Human-Computer Interaction [hci]

Q2 and Q3 pass at rank 1 with the same top 5 as before. Both negatives pass with the same top 3. Held-out hit@3 is 19 of 20, with the same miss (organisational-psychology, rank 6). All 10 nonsense strings score 0.000.

17 Oct 2026, health informatics occupations: the seven health informatics courses now lead to Health Information Manager and the IT occupations, not nursing; `finder:build --rules-only` kept 479, `finder:seed` embedded 0 of 479, `finder:eval` exit 0 with Q1 to Q3 at rank 1 and held-out 19 of 20 (the same organisational-psychology miss).
