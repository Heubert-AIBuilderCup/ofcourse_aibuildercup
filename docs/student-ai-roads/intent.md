---
title: "Give each student her own road, say why, and let her ask about it"
author: Nikhil
requested by: Nikhil
---

# Give each student her own road, say why, and let her ask about it
_Intent written 15 Oct 2026 with Nikhil. From a brainstorm in chat; there is no idea ticket._

## Problem

- The student side has no AI. Every Gemini call today is admin-side (`src/features/content/ai/`); onboarding, roadmaps and the board make none.
- Every student's board is the same: `/roadmaps/<id>` draws Priya's hand-placed road (`src/features/road/model/fixture.ts`, returned by `getRoad()` in `src/features/road/model/road-data.ts`) whatever she answered. Her answers are stored on the roadmap but never read to build it. `docs/roadmaps/intent.md` left "the graph road engine" to a later slice.
- She cannot ask anything about a city or course on her board, and nothing tells her why a tile is on her road in terms of what she said.
- She can only tap. Onboarding has no place for her own words (answers are capped at 80 characters by `storedAnswerSchema`), though ADR-084 and ADR-088 decided there should be one.
- Admin posts and updates never reach her where she is looking: nothing on the board or roadmaps links to `/feed`, the feed's chips start empty for every student (`loadStudentProfile` returns null, ADR-126), and admin Updates (`src/features/updates/`) reach only the mock students in `students.json`.
- Why now: the hackathon submission is Fri 17 Oct 2026 (`docs/hackathon/next-tasks.md`), and the student side is where judges meet the product.

## Proposed outcome

- A student who finishes onboarding sees a road that follows her answers (where she wants to stay, what she wants to study, at what level, where she has people) instead of Priya's, in the board's existing shape.
- She can read, on the tiles where her answers decided something, why that tile is on her road, citing her answers and the data.
- She can ask about a city or course and get an answer that comes only from OfCourse's data, or a plain "I don't have that in our data".
- She can describe herself in her own words on each onboarding step and see it turned into answers she confirms and notes she can see.
- She meets the posts and updates that concern her course, institution and destination on the board, and the feed opens already filtered to her.
- Six named demo profiles each reach a complete, correct road with every AI feature working, whatever the model does. If any part misbehaves on the day, one switch returns every board to Priya's road and turns the student-side AI off, with no deploy.

## Affected users and systems

- **Students** (signed in): onboarding steps 01–04, `/roadmaps/<id>` (the board, its tile cards, "Your answers"), the student header, `/feed`.
- **Admins**: no screen changes. Their live posts, comics and Updates reach students through the board.
- **Data**: a mock Australian catalogue held in the repo, extending `src/features/engine/catalogue.ts` with visas and PR pathways, occupations, subjects within courses, professional opportunities and a graph of related fields; six complete roads. The roadmap's stored answers gain her free text and her tags.
- **Model layer**: the existing Vertex/Gemini layer, its cache, call log, daily caps and fake provider.
- **Decision owners**: Nikhil decides this slice. It amends ADR-112's split (Jenish keeps the student slice's AI): Nikhil builds it and tells Jenish. ADR-126's profile contract (proposed, Jenish's) gets its loader filled.

## Scope

- Destination: Australia only (ADR-107). Every figure in the catalogue is mock and labelled so.
- Surfaces: onboarding steps 01 Facts, 02 Study, 03 Living, 04 After; the board at `/roadmaps/<id>` and its tile cards; "Your answers" on the board; the student header; `/feed`.
- Roles: students. Admin surfaces unchanged.
- Delivered on five branches that each ship or drop on their own:
  1. **Roads**: the mock catalogue, the six roads, matching, re-matching, the why text, the switch (stories 1–3).
  2. **Ask**, off branch 1 (story 4).
  3. **Card details**, off branch 1, droppable (story 5).
  4. **Free text in onboarding**, off `origin/dev`, independent of the others, droppable (story 6).
  5. **Posts on the board and the way into the feed**, off branch 1, droppable (stories 7–8).

## User stories

1. As a student who has finished onboarding, I want my board to show the road nearest to my answers, so that what I see is about me and not about Priya.
2. As a student changing an answer on my board, I want to see how my road would change before it does, so that I can explore without losing my place.
3. As a student opening a city, course or PR tile, I want to read why it is on my road, so that I can tell which of my answers put it there.
4. As a student looking at a city or course, I want to ask a question about it, so that I can find out what matters to me without leaving the board.
5. As a student opening a course or route tile, I want to see its subjects, the work and placements around it, and the jobs it leads to, so that I can judge it beyond its name.
6. As a student in onboarding, I want to say things in my own words, so that what doesn't fit a chip still counts and I tap less.
7. As a student looking at a course, institution or destination, I want to see the posts and updates about it, so that the news that concerns me finds me.
8. As a student, I want to reach the feed from anywhere in the app and find it already filtered to me, so that I don't have to set it up.

## Acceptance criteria

### Story 1: her road, matched from her answers

1. Given the mock catalogue, when it is checked, then it holds exactly six complete roads. Each one fills every slot of the board's existing shape: Point A, Australia, a city with an alternative city and a stack, a course with an alternative course and a stack, the student visa, the course years, the 485, and two ways to PR or the not-staying road's equivalent. Each also carries its card text, and every figure on it is labelled mock.
2. Given the six roads, when they are listed, then between them they cover at least three cities (Perth, Adelaide, and Sydney or Melbourne), at least three fields from Cyber Security, Data, Business, IT and Health, the PR routes 190, 491 then 191, and 485 then employer-sponsored 186, and one road for a student who does not want to stay.
3. Given a roadmap whose answers match one of the six roads exactly, when she opens `/roadmaps/<id>`, then the board shows that road in the same layout shape as today: same tile kinds, slots and placement rules.
4. Given a roadmap whose answers match no road exactly, when she opens `/roadmaps/<id>`, then the board shows the nearest road, chosen in this order: stay first (Yes or Not sure to a PR road, No to the not-staying road), then field or areas, then level, then a city hint (the relative's city, else Regional to Perth or Adelaide, else Career-focused to Sydney). Earlier answers win ties.
5. Given the board shows the nearest road, when she looks at it, then it says it is the closest road to her answers and shows one chip per answer the road differs from.
6. Given her budget is below the road's yearly cost, when the board shows the road, then a chip states the gap (for example "AUD 3.5k a year over") and the road is not changed or hidden for it.
7. Given no road can be loaded for a roadmap, when she opens `/roadmaps/<id>`, then the board shows Priya's road with the line "An illustrative road, drawn in the same shape as yours".
8. Given the student-side switch is off, when any student opens any board, then every board shows Priya's road as it does today, with no why text, no Ask and no AI call. No deploy is needed to turn it off or on.
9. Given a roadmap made before this change with board choices stored (swaps, lessons read), when she opens it, then it shows the road its answers match. Choices for tiles on that road still apply, choices for other tiles are ignored, and none is deleted. Turning the switch off shows them on Priya's road as before.
10. Given each of the six named demo profiles, when the unit tests run, then each reaches its own road exactly, with its why text (fake provider) and its suggested Ask answers.

### Story 2: re-matching with a preview

11. Given the board and "Your answers", when she changes an answer that would move her to another road, then the preview line names the new road (for example "Your road changes to Adelaide · Business · 491") before anything changes.
12. Given that preview, when she confirms, then the board shows the new road. Choices for tiles not on the new road are ignored, not deleted, and the why text is written again the next time a card opens.
13. Given that preview, when she cancels, then the road and the answer stay as they were.
14. Given she changes an answer that leaves her on the same road, when the preview shows, then it says nothing on her road moves, or names the chips that change.

### Story 3: why this is on her road

15. Given a city, course, or 190, 491 or 191 tile on a matched road, when she opens its card for the first time, then it shows a few sentences on why the tile is on her road. They name the answers (and tags, story 6) and the catalogue facts they rest on.
16. Given the why text is being written, when the card is open, then a template sentence built from the same answers and facts shows until it arrives, and the card is usable throughout.
17. Given the model fails, times out or returns text that fails its checks, when the card is open, then the template sentence stays and no error is shown.
18. Given she opens the same card again with the same answers, when it shows, then the same why text appears without a new model call.
19. Given any why text, when it is read, then it never calls a road, city or course "best", "recommended", "top" or ranked, and never states a figure that is not in the catalogue.
20. Given Point A, Australia, the visa, the course years, the 485, a junction or a stack, when its card opens, then it shows no why text.

### Story 4: Ask about a city or course

21. Given a city or course tile card, when she opens Ask, then 3 or 4 suggested questions about that tile are offered.
22. Given a suggested question, when she taps it, then its answer, written in advance from the catalogue, appears with its source, without a model call, even when the model is unavailable.
23. Given a question she types about the tile, when she sends it, then the answer uses only that tile's catalogue rows and her answers, cites the rows it used, and is labelled mock.
24. Given a typed question the tile's data cannot answer (including a visa or legal question beyond the rows), when she sends it, then the reply says "I don't have that in our data" and makes no claim.
25. Given a typed question that tries to give the model instructions, when she sends it, then the reply still follows story 4's rules.
26. Given she has reached the daily cap on typed questions, when she tries to send another, then she is told the limit is reached for today and the suggested questions still work.
27. Given any typed question, when it is answered, then the question and the reply are logged for Insights, and her text is never sent to a web search.
28. Given the model fails or times out, when she has typed a question, then the reply says it could not answer now and points to the suggested questions.

### Story 5: subjects, work and jobs in the cards (droppable)

29. Given a course tile, when its card opens, then it lists the course's majors or units and any entry condition (for example a maths bridging unit).
30. Given the course-years tile, when its card opens, then it lists the placements and part-time work around that course and city, with their employers and demand.
31. Given the 485 tile, when its card opens, then it lists graduate programs and the occupations the course leads to.
32. Given a 190, 491 or 191 tile, when its card opens, then it states whether the course's occupation is on that state's list.
33. Given the course stack and the alternative course, when she looks at them, then courses in fields related to hers are marked "related to what you picked", with a one-line definition of the field.
34. Given branch 3 is not merged, when she uses the board, then every card is as stories 1–4 leave it.

### Story 6: her own words in onboarding (droppable)

35. Given steps 01 Facts, 02 Study, 03 Living and 04 After, when she opens the step's first question, then a "Tell me in your own words" box is offered at the top of the step.
36. Given she writes in the box, when it is read, then what fits that step's questions comes back as chips, each quoting her words, which she confirms or removes. A confirmed chip answers its question, and that question is skipped in the step.
37. Given what she wrote includes something that fits no question, when it is read, then it is kept as a tag with her words, shown in "Your answers", and used only by the why text and Ask. It never changes which road she gets.
38. Given a chip for amount (01), stay (04) or English (01), when it comes back, then it fills nothing until she taps to confirm it.
39. Given a chip that contradicts an answer she already gave, when it comes back, then it shows as a change she must tap to accept, and her answer is not overwritten.
40. Given she writes in English, Hinglish or Romanised Nepali, or gives amounts in lakh, crore or NPR, when it is read, then the chips come back in the step's own values (amounts in AUD thousands).
41. Given she writes about her wellbeing (loneliness, stress), when it is read, then it becomes a tag only, never a chip.
42. Given reading fails, is slow, or finds nothing, when she has written, then she sees "I couldn't pick anything out; the questions below are the same" and the taps carry on as today.
43. Given branch 4 is not merged, when she goes through onboarding, then it is as it is today.

### Story 7: posts and updates on the board (droppable)

44. Given a course tile and live comics whose course is that course, when its card opens, then a "Posts and updates" section lists up to 3, each with a why line (for example "A comic about this course") and "See all in the feed".
45. Given a course tile and live admin Updates for that course's institution whose home-country filter is empty or matches her answer to `where`, when its card opens, then they appear in the same section with a why line (for example "Update from ECU").
46. Given the Australia tile and live posts tagged with the Australia destination, when its card opens, then up to 3 appear in the section.
47. Given a tile with nothing linked to it, including every city tile, when its card opens, then no "Posts and updates" section appears.
48. Given branch 5 is not merged, when she uses the board, then every card is as the other branches leave it.

### Story 8: the way into the feed

49. Given any signed-in student screen with the student header, when she looks at the header, then a "Feed" link sits beside "Your roadmaps" and opens `/feed`.
50. Given her open roadmap's `where` is Nepal or India, when she opens `/feed` with no filter in the URL, then the home chip is preselected (`NP` or `IN`). For any other answer it is not.
51. Given her open roadmap's destination answer, when she opens `/feed` with no filter in the URL, then the destination chip is preselected from it.
52. Given any filter key in the feed's URL, even an empty one, when she opens `/feed`, then nothing is preselected from her answers (ADR-126's Clear rule).
53. Given the age chip, when she opens `/feed`, then nothing is preselected for age.

## Edge cases

- Her answers fit no road's slots (not staying, a diploma, one matching city, a course with no PR route): the nearest road and its chips (criteria 4, 5). Source: code (`fixture.ts` shape, `catalogue.ts` routes) and the PM.
- Onboarding asks no city: matching uses the relative's place, then `place`, then `focus` (4). The relative's place is optional, so it is often absent. Source: code (`questions.ts`).
- Budget over the road's cost: a chip only, never a filter (6). Source: the PM.
- Nothing loads: Priya's road, marked illustrative (7). Source: the PM; the line is from `docs/roadmaps/reference/logic/board.js`.
- Existing roadmaps' stored choices point at Priya's tile ids: ignored when absent, never deleted (9, 12). Source: code (`road/model/scene.ts`).
- Course lengths and start dates differ between roads, and the year ruler places tiles by year (1). The shape is fixed; whether tiles may move along the ruler is open question 5. Source: code (`fixture.ts` `gxAt`).
- The model is slow, failing or capped: template why text (16, 17), suggested Ask answers (22, 28), taps carry on (42). Source: ADR-112 ladder, the PM.
- Ranking language from the model (19). Source: PRODUCT.md, the roadmaps intent.
- Visa and legal questions beyond the data (24); attempts to instruct the model (25). Source: ADR-112, the PM.
- Her text in a web search (27). Source: `docs/hackathon/decisions-2026-10-07.md` §4.
- High-stakes fields need a tap (38). Source: ADR-003.
- Contradictions with a stated answer (39). Source: ADR-088.
- Mixed languages and local amounts (40). Source: ADR-116, the PM.
- Wellbeing statements (41). Source: ADR-088.
- Answers over 80 characters: her free text needs to be stored beyond the current cap (36, 37). Source: code (`storedAnswerSchema`).
- Thailand is a market but not a `where` option, so it never preselects (50). Source: code (`markets.json`, `questions.ts`).
- Onboarding asks no age (53). Source: code.
- City tiles get no posts: posts carry no city (47). Decided out of scope by Nikhil (no admin change).
- Tile cards at 360 px wide with the new sections (29–33, 44–47): checked in the developer's smoke test. Source: CLAUDE.md widths.
- Branches 3 and 5 both add sections to tile cards, so whichever merges second resolves the overlap. Source: the PM.

## Constraints

- **Deadline**: the run is overnight on 15–16 Oct 2026, and the submission is Fri 17 Oct 2026. Each branch ships on its own, and the six demo profiles are what the demo relies on.
- **The board's layout shape is fixed**: no new tiles, slots or placements (the PM).
- Mock data lives as typed data in the repo, not in Postgres tables. This departs from ADR-117 for now.
- Nothing is ranked or recommended (PRODUCT.md). The model explains and answers; code decides which road, tile and order (ADR-087, ADR-112). Tags never decide anything (ADR-088).
- Gemini through the existing Vertex layer, with its cache, call log, caps and fake provider. No new vendor.
- Australia only; every catalogue fact labelled mock (ADR-107, ADR-097).
- Unit tests for the logic; no new end-to-end specs. Standing specs are updated only where a change alters what they cover (CLAUDE.md).
- Separate worktrees off `origin/dev`. Nikhil's uncommitted work on the current branch is untouched. Nothing is pushed or merged without Nikhil.
- The design system (Industry) and the layout rules in CLAUDE.md apply to every new section.

## Out of scope

- Postgres tables, pgvector and embeddings for the catalogue: ADR-117's import, after 18 Oct.
- An admin screen to edit the catalogue or the roads: later.
- City or course tag groups for posts, and any admin editor change: later (story 7 uses existing links only).
- Countries other than Australia.
- New tiles, a course detail page, or a change to the board's shape.
- More than six roads, or roads assembled per student from parts.
- Tags as a tie-break in matching.
- A free-text box on every question screen (ADR-084 in full): later.
- Age in the profile.

## Dependencies

- `origin/dev` at `1326aa9` (route insights merged) as the base.
- The Vertex project and credentials already live for the admin (ADR-132).
- ADR-126's contract (`homeMarket`, `destinations`, `ageBand`): proposed, Jenish's. Story 8 fills its loader under those names.
- ADR-112's owner split: amended by this slice; Jenish to be told.

## Open questions

1. How many typed Ask questions may a student send per day? Suggested 20. Owner: Nikhil. Doesn't block the start (criterion 26 holds for any number).
2. The standing e2e specs that check Priya's road: update them to the matched roads, or run e2e with the switch off? Owner: Nikhil. Doesn't block the start; blocks merging branch 1.
3. Who checks the six roads' copy before the demo? Claude drafts it overnight; Nikhil checks Friday morning. Owner: Nikhil. Doesn't block the start.
4. Telling Jenish about the ADR-112 amendment and the ADR-126 loader. Owner: Nikhil. Doesn't block the start.
5. Within the fixed shape, may tiles move along the year ruler to match a road's start date and course length, or do positions stay as Priya's with the year labels changed? Owner: Nikhil. Doesn't block the start; the six roads can be authored to either.

**Answers, 16 Oct 2026 (Nikhil):**
- Question 2: the standing board spec runs with `STUDENT_ROADS_OFF=1` (playwright.config.ts) until the matched roads get their own spec.
- Question 5: yes, tiles may move along the year ruler. Phase 2 does it by shifting everything after the course years by one fixed amount, never respacing.

---

# Round 2, phase 1: roads that fit more students, and AI that reads better
_Added 16 Oct 2026 with Nikhil, after the code review and a scenario run against live Gemini (7,680 answer combinations through matching; 24 why, 24 Ask and 18 own-words calls). Phase 1 lands before the submission on Fri 17 Oct 2026; phase 2 is listed under Out of scope._

## Problem (round 2)

- Matching misses most students:
  - only 16% of answer combinations reach a road exactly, because all six roads are a two-year Master's;
  - every student who won't stay gets the Melbourne data road, whatever she studies;
  - Health, Engineering and Design students land on a data or cyber road;
  - a student with only a high-school certificate can be given a Master's.
- The why rarely says why: it names facts but not the rule that chose the tile ("Data Scientist is on no NSW list" on Sydney's card), gives alternatives false reasons, puts "(mock)" after every fact, echoes question wording ("you want to study something particular"), and once gave a tag as the reason for a city.
- Ask on Flash took 3–30 s (one question failed after two timeouts), wrote "your stated budget amount of 30", and cannot compare an alternative course with hers.
- Own words drops the commonest sentence's field ("I want to do data science, a masters" loses data science), leaves "30 lakh" as a tag instead of an amount, and stores instruction-like text as a tag.

## Proposed outcome (round 2)

- A student whose field and level the catalogue teaches gets a road with a course in her field at a level her qualification allows, in the same board shape.
- A student who won't stay gets a road in her field that ends at home.
- Every why says which of her answers chose the tile; the strip's chips say what each difference means.
- Ask answers in about 1–2 s; her own words keep the field she names and the amount she writes.
- A real-Gemini check, run before recording, proves each student call on the live models.

## Scope (round 2)

- Australia only, the same six cities, all figures mock.
- Branches: `feat/student-roads-ask`, `feat/student-roads-cards` and `feat/student-roads-posts` are merged into `feat/student-roads`. `feat/onboarding-own-words` stays separate, rebased onto it, and droppable.

## User stories (round 2)

9. As a student, I want my road's course to be in my field and at a level I can enter, so that my board is about what I want to study.
10. As a student who will go home, I want a road in my field that ends at home, so that going home does not decide where I study.
11. As a student, I want each why to say which of my answers put the tile there, so that I can see what to change.
12. As a student asking about a course or city, I want quick answers that can compare the alternative with my course, and that point me somewhere when the data has nothing.
13. As a student writing in my own words, I want the field and amount I write to be kept.
14. As the developer, I want one real-Gemini check of every student call before recording, so that the demo cannot fail on a model setting.

## Acceptance criteria (round 2)

### Story 9: a course that fits her
54. Given the catalogue, when it is checked, then it holds at least 12 more two-year courses than on 15 Oct: Master of Nursing and Master of Public Health (Health), Master of Engineering (civil) (Engineering), Master of UX or Interaction Design (Design), two-year Diplomas, and a third course in every city whose stack held fewer than three. Each course has subjects, occupations with state lists, opportunities, 3–4 suggested questions and its own English requirement, all labelled mock.
55. Given any city skeleton and any catalogue course taught there, when the road is built, then it has the board's shape exactly (every tile's kind, slot, order and position), every reference resolves, and every card has text. A test builds every such combination.
56. Given her field (or areas) and level are taught in at least one city at a level her qualification allows, when she opens her board, then the road's course is in that field at that level.
57. Given one of the six demo profiles, when its road is built, then its course text is the hand-written text from 15 Oct; any other combination uses the template text.
58. Given a combination with no hand-written text, when its course card is read, then its text comes only from catalogue figures and never names a relative, a degree she holds or a score.

### Story 10: the road home in her field
59. Given stay "No", when her road is matched, then it is in her field (by criterion 56's rule), and its steps after the 485 read as a road home with no claim of a path to PR.

### Eligibility (stories 9 and 10)
60. Given qualification High school, then only Diplomas and Bachelor's are offered; Diploma opens Bachelor's; Bachelor's or Master's opens Master's. Phase 1 has two-year roads only, so a student without a Bachelor's gets a Diploma road where one exists in her field. "Not sure" gates nothing.
61. Given a field-specific Master's (Nursing, Engineering), when its course card is read, then it carries a "needs a degree in this field" condition.
62. Given her English answer and a course's English requirement, when the course card is read, then the condition reads met or not met from those two values; Priya's fixed IELTS 6.5 is gone from every matched road.
63. Given no course fits her qualification in her field anywhere, when her road is matched, then she gets the nearest road with a chip naming the level difference.

### Story 11: the why says why
64. Given a city, course or PR tile on a matched or nearest road, when its why is written, then its data names the rule that chose the tile (stay, field, level, or the city hint and its source), and the why says it.
65. Given an alternative or stack course, when its why is written, then it says how that course relates to hers (same city, a related field from the field graph, the cost or PR difference) and never that her answers chose it.
66. Given any why, when it is read, then it has no "(mock)" inside its sentences, does not repeat a question's option wording ("something particular", "A few areas I'm drawn to"), and never gives a tag as the reason a tile is on her road.

### Story 12: Ask, quicker and more useful
67. Given Ask, when a typed question is answered, then the call runs on Flash-Lite.
68. Given her answers reach Ask or the why, when they are written into the model's data, then amounts read "AUD 30k a year", not raw numbers.
69. Given the alternative or a stack course, when she asks how it differs from her course, then the answer may cite rows of both courses.
70. Given a reply of "I don't have that in our data.", when it shows, then the tile's suggested questions follow it, and for a question about visas, the law or safety one more line reads "A registered migration agent or your counsellor can answer this." Both are written in code.

### Story 13: her own words, read better
71. Given own words, when a reading runs, then it runs on Flash-Lite.
72. Given a field or areas chip with no "know" chip in the same reading, when the reading is checked, then the matching "know" value is added, so the field or areas chip is kept.
73. Given her text contains an amount (AUD, k, lakh, crore, NPR, INR) or a start month and year, when the reading is checked, then code reads it into the `amount` or `earliest` chip, whether or not the model offered one.
74. Given text that tells the model what to do ("ignore your instructions…"), when the reading is checked, then it becomes neither a chip nor a tag.

### The strip's chips
75. Given a chip on the strip, when it is read, then it says what the difference means in plain words for its key, for example "City: Sydney, for its job market (you said career-focused)"; no chip pairs a key with an answer to another question.

### Story 14: the real-Gemini check
76. Given a local merge of `feat/student-roads` and `feat/onboarding-own-words` that is never pushed, when the check runs, then it makes exactly 8 live calls on Flash-Lite with the cache bypassed and Pro capped at 0: 2 why (a course and an alternative), 3 Ask (an answer, a no-data refusal, "Can I afford this?"), 3 own words (English, Romanised Nepali, Hindi). It prints one line per call (name, model, time, ok or failed with the first 500 characters of the error) and exits with failure if any call fails.
77. Given each reply, when the check judges it, then a pass also requires the app's own checks: no ranking words, cited ids that exist, amounts in AUD, no wellbeing chip, the field kept.
78. Given the check, when it runs, then it writes only to the scratch database `student_roads`, never to `app`.

## Edge cases (round 2)

- Her field is taught in only some cities: the city hint picks among those (56).
- No course at a level she can enter: the nearest road with a level chip (63).
- Design is weak on occupation lists, so its PR steps say so (54, 58).
- "Not sure" on qualification or English gates nothing (60, 62).
- Flash-Lite refused "Can I afford this?" in the scenario run where Flash answered; the check includes that question (76).
- Existing roadmaps rematch on open, as in criterion 9.

## Constraints (round 2)

- Lands before Fri 17 Oct 2026.
- The board's shape stays fixed, and in phase 1 positions do not move either (two-year programs only).
- No new cities. Roads stay finite, and every one is built in a test (55).
- Gemini spend: the check is 8 calls; Pro stays capped at 0 for student calls.

## Out of scope (round 2, phase 1)

- Phase 2, after the submission:
  - tiles moving with dates, by a fixed shift after the course years (three-year Bachelor's roads, July starts);
  - the full catalogue (a Bachelor's in each field, more Diplomas);
  - a relative named in her own words becoming a chip she confirms, which fills the person form.
- The admin smoke plan (its own run, on `test/ai-smoke-languages`).
- Postgres tables for the catalogue.
- Roads assembled freely.

## Robustness additions (round 2, phase 1)
_Added 16 Oct 2026 with Nikhil, after a second review of the plan._

### Safety rails
79. Given the why, Ask or own words, when a call fails and is retried, then it never climbs to the Pro tier, whatever the daily caps say. Each of these prompts names Flash as its highest tier.
80. Given Ask or the why, when the model has not answered within an overall deadline (Ask 12 s, the why 10 s, retries included), then Ask shows "I couldn't answer that just now…" and the why keeps its template text. A late answer is ignored.
81. Given `STUDENT_AI_OFF=1`, when a student uses the app, then her road is still matched and composed, no student model call is made, the why shows its template, Ask offers its suggested questions only (no typed box), and the own-words box does not show. Without the variable, everything works as before.

### Code-first facts
82. Given her budget and a course or city tile, when she asks Ask, then its data holds a row computed in code from her budget, what it covers and the catalogue. For example: "Your budget, AUD 30k a year for fees only: the fees are AUD 33k a year, AUD 3k over". The model may cite it.
83. Given her own words hold Devanagari digits or लाख/करोड ("२५ लाख"), when they are read, then code reads the amount as it does "25 lakh".

### Measurement
84. Given `bun run ai:eval:student`, run by hand, when it runs, then it scores a labelled set: at least 25 own-words texts (English, Hinglish, Romanised Nepali and Devanagari) with their expected chips and tags, and at least 15 Ask questions marked answerable or refused. It makes no more than 60 Flash-Lite calls, with the cache off, writing only to `student_roads`. It prints the scores by key.
85. Given that run, when it ends, then it passes only if:
    - there are zero wellbeing chips, zero chips or tags from instruction-like text, zero ranking words, and zero figures outside the data;
    - own-words chips are at least 90% right of those offered, and at least 80% of the expected ones are found;
    - Ask's answerable-or-refused verdict is at least 90% right.
86. Given the matching sweep over the onboarding's answer combinations, when the unit tests run, then at least 50% match exactly and every candidate road is reachable.

### Demo aids
87. Given `bun run roads:gallery`, when it runs, then it writes `docs/student-ai-roads/road-gallery.md`: every composed road with its label, course, alternative, stack, PR steps and course-card text, for a human read. No model call is made.
88. Given `bun run ai:warm:student` with an explicit `DATABASE_URL`, when it runs, then it fills the why cache for demo profiles 1 and 2's why tiles (at most 16 Flash-Lite calls). It prints the database it wrote to.

Ask replies in English, even to a question in Nepali or Hindi, so its figure checks hold (decided 16 Oct).

### Changes after the plan review (16 Oct 2026, Nikhil)
- **54:** the Master of Nursing is a graduate-entry course, open to any bachelor's degree. The Master of Engineering keeps its "needs a degree in engineering" condition.
- **55 and 56:** phase 1 builds roads only from courses that run two years. A course of any other length (the Bachelor of Cyber Security at ECU) is in the catalogue, but on no road until phase 2.
- **New, 89:** given a Diploma road, its course step names the course's own level ("Diploma · Information Technology", never "Master's · …"), and its 485 tile describes the post-vocational stream, not the graduate stream.
- **60 and 63:** when no road fits the levels her qualification opens, she is offered a road at her own level or below, never above, with a chip naming the level difference. In a tie, a course with no field-specific entry degree comes before one with one.
- **76:** the check runs with the developer's own `.env` in the check worktree (the model names, project and provider as the app uses them). Only `DATABASE_URL` (the `student_roads` database) and `AI_DAILY_CAP_PRO=0` are set on the command line.
- **84 and 85:**
  - The expected chips and verdicts are written before any live call, and Nikhil skims the two case files before the evaluation runs.
  - The report shows how many misses each bar allows.
  - The zero-tolerance rule on figures outside the data counts the model's first attempt, since the app's checks already block such figures before anything is shown.
- **86:** the 50% exact floor applies to answer sets a road can match: a level that has a road, a qualification that opens a level that has one, and a city hint that names a city teaching her field. The share over the full sweep is reported, with no floor.
- **88:** the warm-up reads the demo account's own roadmap, by its email, and warms its why tiles, so the cached entries are the ones the board reads.
- **If time runs short before the submission:** drop R12 (gallery, warm-up) first, then R11 (evaluation). The safety rails (R0) and the check (R10) stay.


## Story 15: choosing and testing models from the admin side (round 2, phase 1)
_Added 16 Oct 2026 with Nikhil, so that a failing model can be tested and switched without a redeploy. It is built on its own branch, `feat/admin-model-settings`, which starts from `feat/student-roads` after R8 (changed after the second plan review, below) and can be dropped on its own. One migration is pre-approved: a settings table and a change log._

15. As a superadmin, I want to see each model call's health, test it, and switch its model from the admin side, so that if a model breaks on the day I can fix it in a minute.

### Acceptance criteria (story 15)
90. Given an admin or superadmin, when they open the admin "Models" page, then it lists every use case (admin and student) with the tier it uses and that tier's model, and every tier (lite, flash, pro, image) with its model, whether that model was chosen on the page or comes from the environment, and its last error if any.
91. Given a student account, or a signed-out visitor, when they open the page or call its actions, then they are refused (the admin pages' existing rule).
92. Given an admin who is not a superadmin, when they view the page, then Test, Change and Reset are not offered, and the actions refuse them.
93. Given a superadmin, when they press Test on a use case, then exactly one live call runs through the app's real model client with its prompt example, the cache off and the daily caps respected, and the page shows ok or failed, the model, the time and the first 500 characters of any error. "Test all student calls" runs the 8 calls of the real-Gemini check (criterion 76) and shows one line each.
94. Given a superadmin choosing a model for a tier, when they save, then only a model on the app's known list can be chosen, and the save is accepted only after one test call on the new model passes. The choice then applies to the next call without a redeploy.
95. Given a superadmin choosing a tier for a use case, when they save, then only the tiers that use case allows are offered. A student use case allows Flash-Lite and Flash, never Pro (criterion 79's ceiling). An image use case allows only the image tier.
96. Given a model chosen on the page that returns a model-not-found or permission error, when a call uses it, then the call is retried once on that tier's model from the environment, the call log marks it as a fallback, and the page shows a red "falling back" mark on the tier until it is changed or reset.
97. Given "Reset to defaults", when a superadmin presses it and confirms, then every choice is cleared and every call uses the environment's models again.
98. Given any change or reset, when it is saved, then the change log records who, when, what was changed, and the old and new values, and the page shows the last 20 entries.
99. Given no choice saved, when any call runs, then it behaves exactly as before story 15.

### Out of scope (story 15)
- Choosing models per student or per market, editing prompts, and changing the daily caps from the page (they stay environment variables).

### Changes after the second plan review (16 Oct 2026, Nikhil)
- **Story 15:** `feat/admin-model-settings` starts from `feat/student-roads` after R8 (and R11's Ask part) are committed, not after R0 or after R10's check, so it is built in the overnight run, which waits for no one.
- **61:** only the Master of Engineering carries the "needs a degree in this field" condition. The Master of Nursing is graduate entry (see 54) and has none.
- **If time runs short before the submission:** drop the road gallery (R12a) first, then R11 (evaluation), then the Models page's screen (M4), keeping M1–M3. The safety rails (R0) and the check (R10) stay, and so does the warm-up (R12b) while the why's prompt version has changed, since a new version empties the why cache.


## Story 16: her exact English score (round 2, phase 1)
_Added 16 Oct 2026 with Nikhil: the English question offered only IELTS 6.0, 6.5, 7.0, "7.5 or more" and "Not taken yet", so a PTE or TOEFL score, or an exact IELTS score, could not be given._

16. As a student, I want to enter my exact English score, from the test I took, so that each course says truly whether I meet its requirement.

### Acceptance criteria (story 16)
100. Given the English question in onboarding (step 01) and in "Your answers", when she chooses "Enter my exact score", then she can pick IELTS Academic (overall 4.0 to 9.0, in steps of 0.5), PTE Academic (a whole number from 10 to 90) or TOEFL iBT (a whole number from 0 to 120), and enter her score. A score outside its test's range is refused with one sentence saying the range. The quick options stay as they are.
101. Given an exact score, when it is saved, then it is stored as a stated answer in the form "IELTS 6.5", "PTE 58" or "TOEFL 85", and it reads that way everywhere her answers are shown.
102. Given an exact score and a course, when the course card's English condition is read, then it compares the score with the course's IELTS requirement through a mock equivalence table (PTE and TOEFL to IELTS, labelled mock), and reads met or not met, naming her test and score: "You have PTE 58 (about IELTS 6.5, mock); this course needs IELTS 7.0".
103. Given her own words name an exact score ("I got 6.5 in IELTS", "PTE 58"), when they are read, then the `eng` chip carries that exact score, in the stored form, and still needs a tap (criterion 38).

### Out of scope (story 16)
- Band-by-band scores (a course that needs 7.0 in each band, such as Nursing): phase 2.
- Other tests (Duolingo, Cambridge): later.
