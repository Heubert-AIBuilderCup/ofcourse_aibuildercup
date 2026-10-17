---
title: "Find courses by meaning and see what each choice changes"
author: Nikhil
requested by: Nikhil
---

# Find courses by meaning and see what each choice changes
_Intent written 16 Oct 2026 with Nikhil. From a brainstorm in chat; there is no idea ticket._

## Problem

- A student reaches courses only through a few chips. "Which field?" offers four options and "Pick up to three" offers six areas (`src/features/opening/model/questions.ts`). Fields she has never heard named stay out of reach. The field graph already defines Cyber-psychology as a niche field, but no course in the catalogue teaches it (`src/features/roads/data/fields.ts`).
- Course matching by meaning with grounded explanations was decided but never built: ADR-074 (embeddings for interests), ADR-087 (retrieval over the catalogue, rules order, the model explains with citations) and ADR-117 (retrieval in Postgres with pgvector). The pitch lists it as "decided, not built" (`docs/hackathon/pitch.md`).
- When she considers another city or course, the board shows which tiles would move ("Your answers" preview, criterion 24 in `docs/roadmaps/intent.md`; "Swap onto your roadmap" on the other-city and other-course tiles). It does not say what changes in her life: money, time, work rights, PR, career.
- Every road is a two-year course. The board cannot show a one-year course, or that one year of study alone does not open the Temporary Graduate visa (485).
- Why now: the AI Builder Cup judges "Technical Merit & Gen AI Implementation" at 40%. It covers meaningful use of Gen AI, a sound implementation, and scalability beyond the prototype (Nikhil, 16 Oct, from the rules). The submission closes 18 Oct 2026, 23:59 IST.

## Proposed outcome

- A student who writes "I like understanding why people do things, and I'm good with computers" finds Cyberpsychology in her top three, marked as a field she may not have heard of. Its explanation quotes the course's own description.
- She can see, for any course or city she is considering, what changes against her current road: cost, time and work rights, staying or going home, career, subjects and city. She can start a new roadmap built around it without losing the one she has.
- She can choose from more fields when she starts, and each choice leads to a real road.
- She can choose a one-year course and see plainly what it gives up.
- A judge sees retrieval working on the live site: the query, the scores, keyword search beside meaning search, the quoted passage. The finder's measured quality is published: the three demo queries pass, and at least 16 of 20 held-out queries put the expected course in the top three.

## Affected users and systems

- **Students** (signed in, with a finished roadmap) on the board `/roadmaps/<id>`, in onboarding (the study questions), and in the New roadmap draft `/roadmaps/new?from=<id>`.
- **Judges and visitors** to the live site and the public repository.
- **Systems:**
  - the course catalogue (a new generated sample catalogue beside the existing one)
  - the field graph and occupation lists
  - matching and the road builder
  - roadmap storage
  - the onboarding questions
  - the Gemini model layer
  - Cloud SQL Postgres
  - the README and the deck
- **Decisions:** Nikhil owns this intent. Jenish owns onboarding and reviews its changes (stories 4 and 5).

## Scope

- **Surfaces:**
  - The board `/roadmaps/<id>`: a Find section, course detail, and "What changes".
  - Onboarding: "Which field?", "Pick up to three", "Most years you'd give it", "Study level".
  - The New roadmap draft.
  - The README.
- **Catalogue:**
  - Today's six road cities (Perth, Adelaide, Sydney, Melbourne, Geelong, Hobart).
  - Diploma and Master's, one or two years.
  - Real university names, every generated figure labelled sample.
- **Delivery:**
  - Five pull requests landing in this order, each usable without the ones after it: 1 Finder, 2 Course detail, 3 What changes, 4 Wider interests, 5 One-year courses.
  - One combined branch for Nikhil to test, so he can reject any part that does not work.
  - Each part has its own switch. With a switch off, that part's surfaces are as they are today.

## User stories

1. As a student, I want to describe what I enjoy and what I'm good at and get courses that match what I mean, so that I find fields I would never have searched for.
2. As a student, I want to see the fields related to a course, the jobs it leads to and how those jobs look in each city, so that I can judge a course beyond its name.
3. As a student, I want to see what changes in my life if I switch to another course or city, and start a new roadmap from it, so that I can weigh a change before committing to it.
4. As a student starting onboarding, I want more fields to choose from, each leading to a real road, so that what I'm drawn to is on offer.
5. As a student, I want to consider one-year courses and see what they give up, so that I can choose between saving a year and keeping my work rights.
6. As a judge, I want to see how the finder found each course and how well it performs, so that I can tell the Gen AI is real, grounded and able to scale.

## Acceptance criteria

### Story 1: the finder (PR 1)

1. **Switch off.** Given the finder's switch is off, when any student opens `/roadmaps/<id>`, then no Find section appears and the board is as it is today.
2. **Prefill.** ~~Given the switch is on and a finished roadmap, when she opens its board, then a Find section shows a text box. It is prefilled with what she wrote in the Study step's own-words box plus her chosen field or areas, and it is editable. It is empty when she gave neither.~~
   Amended 17 Oct 2026 (Nikhil): given the switch is on and a finished roadmap, when she opens its board, then a Find section shows a text box, prefilled with the quotes of her Study-step tags that are not about wellbeing plus her chosen field or areas (her chips), never the raw own-words text, and editable. It is empty when she gave neither.
3. **Results.** Given she searches, when results return, then up to ten courses appear in order of similarity. Each card shows the course, university, city, level, length, annual fee, its similarity score and the label "sample data".
4. **Filters.** Given she searches, when results return, then the cards show only courses that pass three filters: the levels her qualification opens, her destination, and her budget.
5. **Wildcards.** Given a result is in a niche field, when its card is shown, then it is marked as a wildcard with the field's one-line definition.
   Amended 17 Oct 2026 (Nikhil): a course belongs to every subject its niche field combines (field graph); the card says so, and says when it fits more than one of her interests; visa, work rights and PR follow its primary discipline only.
6. **The "why".** Given results are shown, when the "why" texts arrive after the results, then each of the top three cards has one, and it passes three checks:
   - its quoted passage appears word for word in that course's description, ignoring whitespace and straight or curly quotes;
   - it contains no figure that is not in the description;
   - it contains no ranking word.

   A "why" that fails any check is replaced by the template "Matches what you said about …, from the course description: …".
7. **Speed.** Given the deployed site is warm, when she searches Q1, Q2 or Q3, then the results appear within 2 seconds.
8. **No match.** Given text whose best match is under the finder's similarity floor, when she searches, then no cards appear and the panel says "Nothing close yet; tell us a bit more."
9. **Failure.** ~~Given the search fails or takes more than 2 seconds, when she searches, then only the Find section shows "Couldn't search right now", and the rest of the board works as usual.~~
   Amended 17 Oct 2026 (Nikhil): given the search fails, or takes more than 2 seconds and then fails or runs out on its one quiet retry with a 5-second budget, when she searches, then only the Find section shows "Couldn't search right now", and the rest of the board works as usual.
10. **Limit.** Given she has reached the finder's limit per student, when she searches, then the Find section says the limit is reached and when she can search again, and the rest of the board is unaffected.
11. **Logs.** Given any search, when the call logs are read, then they hold the outcome and the timings, and not the text she typed.
12. **Demo queries.** Given the catalogue is seeded:
    - when Q1 "I like understanding why people do things, and I'm good with computers" is searched, then the Cyberpsychology course is in the top three;
    - ~~when Q2 "I want to know why people make bad choices with money, and I'm good at maths" is searched, then Behavioural Economics is in the top three;~~
      Amended 17 Oct 2026 (Nikhil): when Q2 "I'm good at numbers and I like working out the chances of bad things happening and what they would cost" is searched, then an actuarial studies course is in the top three (the isolated niche proposal produced no behavioural-economics field);
    - when Q3 "I like drawing and I want to make apps people enjoy using" is searched, then a Human–Computer Interaction or UX course is in the top three.
13. **Negative cases.** Given the catalogue is seeded, when "I want to build bridges" or ~~"I love cooking"~~ is searched, then Cyberpsychology is not in the top three. Amended 17 Oct 2026 (Nikhil): the cooking negative is "I love cooking big family dinners on weekends", so that it has the 3 content words it needs to reach the model.
14. **Held-out score.** Given 20 held-out queries written by an agent with no access to the catalogue, the demo queries or this intent, when the student eval runs, then at least 16 put their expected course in the top three. The README states the score.
15. **No shared words.** ~~Given the catalogue, when it is checked, then no demo query shares a content word (stopwords aside) with the description of the course it expects.~~
    Amended 17 Oct 2026 (Nikhil): given the catalogue, when it is checked, then no demo query shares a topic word (stopwords and very common words aside) with the description of the course it expects. Text of fewer than 3 content words is "nothing close" without a search, and the similarity floor is 0.5.
16. **Catalogue limits.** Given the catalogue, when it is checked:
    - it holds between 400 and 1,000 courses;
    - every course is in one of the six cities, is a Diploma or a Master's, and lasts one or two years;
    - every course has a 2–4 sentence description, an annual fee, a field from the field graph and the label "sample data".
17. **Visa and PR lines.** Given any catalogue course, when its visa and PR lines are shown, then they equal what the existing rules give for its city, level, length and its field's occupations. None is written by a model.
18. **Duplicates.** Given the catalogue is generated, when near-duplicate descriptions are removed, then no two remaining courses are near-duplicates, and the number removed is reported.

### Story 6: what judges see (PR 1)

19. **Engine room.** Given a search, when the engine room is opened, then it shows:
    - her query;
    - the embedding model's name;
    - all ten nearest courses with their scores, those that failed a filter greyed out with the failing rule named;
    - the passage each "why" quoted;
    - "cached" when an answer came from the cache;
    - the time taken by the search and by the "why" texts.
20. **Keyword comparison.** Given a search, when the engine room is opened, then the keyword search's top results for the same text are shown beside the meaning search's.
21. **README.** Given the README, when it is read, then a "How it scales" section says:
    - rules decide, the model explains, and code checks the model;
    - courses are found with one query in the existing database;
    - a production catalogue would load through a sync job;
    - the catalogue is generated sample data, by the named script, and why.

    It names no internal system.

### Story 2: course detail (PR 2)

22. **Detail switch off.** Given the course detail switch is off, when any course card is opened, then it is as it is today.
23. **Related fields and jobs.** Given the switch is on, when she opens a found course's card or a course card on the board, then it shows the fields one step away in the field graph, each with its definition, and the jobs the course leads to.
24. **Job market.** Given a job on a course card, when it is shown, then it carries sample openings and a starting pay range in AUD for the course's city, under the heading "Job market (sample data)". It names no employer and no outside data provider.

### Story 3: what changes (PR 3)

25. **Compare switch off.** Given the compare switch is off, when she opens an other-city or other-course tile, then it behaves as it does today.
26. **From the board.** Given the switch is on, when she opens an other-city or other-course tile on the board, then a "What changes" comparison shows her current road beside the alternative for:
    - money: tuition per year and in total, living costs in that city, and whether it fits her budget;
    - time and work rights after the course;
    - staying or going home: the PR route (190, 491, 186 or no clear PR) or the home ending;
    - career: the jobs, with sample pay and openings for that city;
    - the subjects;
    - the city.
27. **From the finder.** Given the switch is on, when she chooses "Compare with my roadmap" on a found course, then the same comparison shows her current road beside that course.
28. **Same rules.** Given an alternative that is on a road, when it is compared, then its PR route and work rights equal what that road shows.
29. **New roadmap.** Given a comparison, when she chooses "Start a new roadmap from it", then the New roadmap draft opens with her answers and that course (and its city) pinned. Creating it shows a board built around that course, and her current roadmap is unchanged.
30. **Pinned courses stay put.** Given a roadmap with a pinned course, when any other roadmap is matched, then the pinned course is never offered by matching.

### Story 4: wider interests (PR 4)

31. **Interests switch off.** Given the wider-interests switch is off, when she opens the study questions, then they offer today's options.
32. **More options.** Given the switch is on, when she opens "Which field?" or "Pick up to three", then they offer more options from the field graph, including Psychology, Health, Design and Engineering.
33. **A road for every option.** Given any option offered there, when matching runs for a student who chose it, then at least one road whose field is that option's can be reached.

### Story 5: one-year courses (PR 5)

34. **One-year switch off.** Given the one-year switch is off, when she opens onboarding or a board, then the questions and roads are as they are today.
35. **Length question.** Given the switch is on, when she opens "Most years you'd give it", then it offers 1 year and 2 years. A stored "3" or "4 or more" reads as 2 years.
36. **Level question.** Given the switch is on, when she opens "Study level", then it offers Diploma and Master's only. A stored "Bachelor's" reads as unanswered, and she is asked again.
37. **One-year road.** Given she answered 1 year and a one-year course is her road, when she opens the board, then:
    - the road ends at home with no 485 tile;
    - the board says one year of study alone does not open the Temporary Graduate visa;
    - it names a two-year option that would.
38. **Board widths.** Given a one-year road, when the board is checked at 360, 390, 768, 1024, 1280, 1366, 1440, 1536, 1920 and 2560 wide, then no labels overlap.
39. **Compare lengths.** Given a comparison between a one-year and a two-year course, when it is shown, then the one-year side shows no post-study work rights and the two-year side shows its 485.

### Across all parts

40. **Demo roads.** Given the six demo profiles, when their roads are built with every switch on, then each is the same road it is today.
41. **Combined branch.** Given the combined test branch, when Nikhil turns any one part's switch off, then the other parts still work.

## Edge cases

- **The student wrote no own words and chose no field** (code: the own-words box is optional) → 2.
- **The question shares words with a course's description, so it isn't proving meaning** (PM) → 15, 20.
- **The finder looks rigged because only known queries pass** (PM) → 14, 13.
- **Nonsense or empty text** (PM) → 8.
- **The embedding call fails or is slow; a cold start on Cloud Run** (PM) → 9, 7 (measured warm, with cold reported).
- **Many top results fail her filters** (PM) → 4, 19.
- **She types personal details into the box** (PM) → 11.
- **A model-written "why" overclaims, or quotes something not in the description** (code: the checks in `src/features/roads/model/why.ts`) → 6.
- **Generated descriptions repeat each other and bunch the scores** (PM) → 18.
- **A real university name next to an invented figure** (code: the DS-R5 labelling in `src/features/engine/catalogue.ts`) → 3, 16, 24.
- **Visa rules invented per course** (PM) → 17.
- **Job figures presented as a named provider's data** (PM) → 24.
- **New courses change existing students' roads** (code: matching runs over every catalogue course, `src/features/roads/data/candidates.ts`):
  - the six demo roads stay → 40;
  - pinned courses stay out of matching → 30;
  - other roadmaps may move to a better road (PM).
- **A new field option with no road** (code: `AREA_FIELDS`, `FIELD_OF_OPTION` in `src/features/roads/data/fields.ts`) → 33.
- **Stored answers that no longer exist** ("3", "4 or more", "Bachelor's") (code: `questions.ts`) → 35, 36.
- **A demo profile stores "3" years** (code: the default in `questions.ts`) → 35, 40.
- **One year does not meet the 485's two-year study rule** (PM, from Home Affairs' study requirement) → 37, 39.
- **The board's fixed shape** (code: `src/features/road/model/fixture.ts`, positions by year) → 38.
- **Courses outside six cities, or of other lengths** → decided out of scope (Nikhil, 16 Oct).
- **Courses with no description in the existing catalogue, which the finder cannot quote** (code) → 6 (the template).

## Constraints

- **Deadline.** Submission closes 18 Oct 2026, 23:59 IST. Any part not passing its criteria by then stays switched off and is not shown in the video.
- **Retrieval stays in the existing Postgres on Cloud SQL, with pgvector** (ADR-105, ADR-117). No new database.
- **Models per ADR-115:** `gemini-embedding-001` at 768 dimensions for embeddings, Flash-Lite for the "why".
- **Rules decide, the model explains, and code checks the model** (ADR-087). No model decides order, eligibility, a visa or a PR route.
- **Every generated figure is labelled sample or mock** (DS-R5).
- **No internal system** is named in new code, UI or README text.
- **No end-to-end tests without Nikhil's ask** (CLAUDE.md).
- **The recorded video stays valid:** the six demo roads do not change (40).
- **The video must run 3 to 4 minutes** under the rules Nikhil quoted on 16 Oct; the new scene fits inside that.

## Out of scope

- Three-year courses and Bachelor's degrees: later; the deck's "future development" slide.
- New cities: later.
- Real course data (the CRICOS register) and real job-market data: the future slide.
- Employer names in job data.
- A multi-turn finder with constraint chips extracted by the model.
- Changes to the existing "Your answers" preview.
- The answer library (ADR-077): its own slice.

## Dependencies

- **Databases:**
  - the pgvector image for local databases (each developer takes a `db:dump` first);
  - the vector extension on the Cloud SQL instance.
- **Migration number:** agreed with Jenish, so it does not clash with other branches.
- **Jenish's review** of the onboarding changes (stories 4 and 5).
- **Recording the new video scene** on the live site after the parts it shows pass.

## Open questions

1. **New options.** Which exact field and area options does story 4 add, beyond Psychology, Health, Design and Engineering? Owner: Nikhil. Does not block the start; blocks PR 4.
2. **Finder limit.** How many searches per student per hour? Owner: Nikhil. Does not block; the default is the same window as the "why" limit.
3. **Q3.** Is "I like drawing and I want to make apps people enjoy using" kept as the third demo query? Owner: Nikhil. Does not block the start; blocks the video scene.
4. **Jenish's sign-off.** Does Jenish accept the onboarding changes (stories 4 and 5) and the switch of the local database image? Owner: Jenish. Does not block the start; blocks merging PRs 4 and 5.
5. **Migration.** Which migration number does the finder take? Owner: Jenish and Nikhil. Does not block the start; blocks the deploy.
6. **Video.** When is the new scene recorded, and which beats move to fit it? Owner: Nikhil. Does not block.
