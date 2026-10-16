**Smoke test — student-ai-roads** · local, one branch at a time · `http://localhost:3000`

**Before you start**
- Five branches, each in its own worktree: `C:\Projects\main-student-roads` (A, roads and why), `…-ask` (B), `…-cards` (C), `C:\Projects\main-onboarding-own-words` (D), `…-posts` (E). B to E each start from A, so each one also shows A's work.
- Each worktree needs your `.env`, copied from `C:\Projects\main\.env` (it was not copied, because reading it was refused).
- Stop the dev server in `C:\Projects\main` first (port 3000), then `bun run dev` in the worktree you are testing. It applies migration `0023_student_ask` to your `app` database. The migration only adds a table and two nullable columns.
- Real Gemini needs `gcloud auth application-default login` and the `GEMINI_*_MODEL` values in `.env`. `AI_PROVIDER=fake` runs everything without a model.
- Sign in as a new student for each road below, or make one roadmap per road with "New roadmap → Start from scratch".

**1 · A matched road** (branch A) — AC 1, 3
```
Go to   /onboarding, then answer: Stay "Yes", "Something particular" → Cyber security, Master's, a cousin in a Perth place
Do      finish onboarding · Go to your roadmaps · open the roadmap
See     Perth · Master of Cyber Security, ECU · 190 and 491 → 191 ahead, in the same board shape as before; no "Closest road" line
```

**2 · Why it's on your roadmap** (branch A) — AC 15, 16, 18, 20
```
Go to   the board from step 1
Do      open the Cyber Security card · close it · open it again · open the 485 card and the fork
See     "Why it's on your roadmap": a template sentence first, then Gemini's, naming your answers and the facts; the same text shows at once on the second open; the 485 and the fork have no why
```

**3 · The nearest road** (branch A) — AC 4, 5, 6
```
Go to   /roadmaps → New roadmap → Start from scratch
Do      answer: Stay "Yes", Business analytics, Diploma, budget AUD 24k
See     the Geelong · Business road, "Closest road to your answers" with a chip "Level: you said Diploma · this road is Master's", and the course marked over budget
```

**4 · Changing an answer** (branch A) — AC 11, 12, 13, 14
```
Go to   the step-1 board → Your answers
Do      change the field to Data science, read the preview, cancel · change it again and save · change Climate
See     "Your road changes to Sydney · …" before saving; cancel leaves Perth; save shows Sydney and the card's why is new; Climate says "Nothing on your road moves."
```

**5 · Not staying** (branch A) — AC 2 (the road home)
```
Go to   a new roadmap: Stay "No", Data science, Master's
Do      open the board, then the steps after the 485
See     Melbourne · Monash Data Science; the steps read "Two ways home", "Home with two years of Australian work"; nothing claims a path to PR
```

**6 · The switch** (branch A) — AC 8, 9
```
Go to   .env: STUDENT_ROADS_OFF=1, restart dev
Do      open the step-1 roadmap
See     Priya's road exactly as before, no strip, no why, no Ask; earlier swaps and lessons read still show. Remove the line and restart: her road is back with the same choices
```

**7 · Ask, suggested questions** (branch B) — AC 21, 22
```
Go to   the step-1 board on branch B → the Perth card, then the Cyber Security card
Do      tap a suggested question on each
See     3–4 questions per card; each answer appears at once with its source and the mock tag
```

**8 · Ask, typed** (branch B) — AC 23, 24
```
Go to   the Cyber Security card
Do      type "How much are the fees a year?" · then "What is the visa processing time?"
See     the first is answered from the course's rows with citations and the mock tag; the second says "I don't have that in our data."
```

**9 · Card details** (branch C) — AC 29, 30, 31, 32, 33
```
Go to   the step-1 board on branch C
Do      open the course, the course years, the 485, the 190 and 491 steps, and the course stack
See     majors, units and conditions; placements and part-time work; graduate programs and occupations; "… is on WA's 190 list"; related courses tagged "Related to what you picked", each with its definition
```

**10 · Your own words** (branch D) — AC 35, 36, 38, 39, 40
```
Go to   a new roadmap on branch D → /onboarding/study
Do      in "Tell me in your own words" write "I want to do data science, a masters, hands-on" → Read my words · then on Facts write "budget around 26 lakh"
See     chips for field, level and learning, each quoting you; "Use these" skips those questions; on Facts the amount chip reads AUD 30k and says "Tap to use"
```

**11 · Tags in your answers** (branch D) — AC 37, 41
```
Go to   Living → write "I want to be near the beach, and I worry about feeling lonely"
Do      read it · finish · open the board → Your answers
See     "In your own words" with both tags; the loneliness one is never a chip; the road is the same as without them
```

**12 · Posts on the board** (branch E) — AC 44, 45, 46, 47
```
Go to   admin: a live comic for ECU Cyber Security, a live Update for ECU, a live post tagged Australia; then the step-1 board on branch E
Do      open the Cyber Security card, the Australia card, the Perth card
See     "Posts and updates" on Cyber Security (the comic and the ECU update, with why lines) and on Australia; none on Perth
Admin   an Update aimed at India does not show for a student from Nepal
```

**13 · The feed** (branch E) — AC 49, 50, 51, 52, 53
```
Go to   the account menu
Do      Feed · then clear the chips and reload
See     "Feed" under "Your roadmaps"; /feed opens with Nepal and Australia preselected and no age chip; cleared chips stay clear
```

**No need to click** — AC 2 (`build.test.ts`: six roads, cities, fields, routes) · AC 7 (`road-for.test.ts`, `match-line.test.ts`: the illustrative fallback) · AC 10 (`match.test.ts`: the six demo profiles) · AC 17, 19 (`server/why.test.ts`, `why.test.ts`: failure falls back to the template, no ranking words) · AC 25, 26, 27, 28 (`server/ask.test.ts`, `asks.test.ts` against the database, `TileAsk.test.tsx`: instruction attempts, the cap, the log, failures) · AC 34, 43, 48 (true by construction: without that branch nothing is passed to the card or the step) · AC 42 (`server/own-words.test.ts`, `OwnWordsBox.test.tsx`: failure and the 15 s deadline) · under test.

**Needs a decision** — Nikhil
1. "Not sure" answers (stored as assumed defaults) count in matching, so a chip can read "you said …" for something she never said. Count them, or treat them as unanswered.
2. `e2e/your-road.e2e.ts` checks Priya's text: update it to the matched roads, or run e2e with `STUDENT_ROADS_OFF=1` (intent, open question 2). It is not run in this build.
3. Ask's cap: 20 typed questions a day per student (`STUDENT_ASK_DAILY_CAP`) unless you name another (open question 1).
4. The six roads' copy and the occupation state lists are invented mock data and need your read (open question 3). Five roads' course stacks list courses from the alternative city ("N more in Hobart" on the Adelaide road), because those cities have only two courses. Add same-city courses, or keep it.
5. Decided by criterion 23, done in branch B: an Ask reply may use the figures in her own answers (for example her budget), as the why does.
6. Lakh and crore read as NPR until she answers "where" (the box sits above that question).
7. Archived roadmaps count for the feed's preselected chips. Leave them out, or keep them.
8. Branches B, C, D and E all touch `RoadCard`, `RoadBoard`, `PhoneRoad` and the board layout, so the second, third and fourth to merge will each need a small conflict fix.

**Worth a glance** — `/roadmaps` (each row's words now come from its own road) · `/roadmaps/new?from=…` (the copy draft shows the source's road, with no strip) · the lesson and route pages (they now load the roadmap twice) · the fake provider's why text still says "road" · the existing roadmaps database suite hangs on this machine on its constraint-error test (it does the same on `dev`) · the step-name table in branch D exists in three places.

**Build report** — each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| A1 · mock catalogue | sonnet | 7m 39s | 89,967 | `cf61b98` |
| A2 · six roads on Priya's shape | opus | 13m 00s | 165,145 | `2ee1211` |
| A3 · matching | sonnet | 2m 59s | 42,762 | `87dbaba` |
| A4 · fallback and switch | haiku | 3m 25s | 36,169 | `37dc3b2` |
| A5 · the board draws her road | opus | 5m 11s | 65,625 | `9104e91` |
| A6 · the migration | sonnet | 15m 46s | 48,190 | `cc5134d` |
| A7 · re-match preview | opus | 4m 37s | 60,852 | `f248eb4` |
| A8 · why text, server | opus | 10m 16s | 131,617 | `261f791` |
| A8 · fix: a course's list reads its own state | opus | 2m 23s | 7,358 | `d219423` |
| A9 · why in the card | opus | 7m 48s | 92,298 | `2983655` |
| A9 · fix: why on phones, roadmap wording | opus | 4m 30s | 27,341 | `1e91c5f` |
| B1 · Ask log and count | sonnet | 2m 10s | 24,731 | `afaeb6e` |
| B2 · answering a question | opus | 7m 31s | 101,074 | `103b88e` |
| B3 · Ask in the card | opus | 6m 33s | 99,624 | `8fd99e4` |
| B3 · refactor: one rule for suggested questions | opus | 3m 52s | 19,264 | `a3c554c` |
| C1 · card details model | sonnet | 3m 16s | 49,764 | `e50caf8` |
| C1 · fix: a route card's list follows its visa | sonnet | 2m 24s | 12,081 | `f8fb97b` |
| C2 · the cards show details | sonnet | 6m 44s | 70,955 | `31181d2` |
| D1 · own-words checks | opus | 5m 21s | 59,092 | `33be230` |
| D1 · fix: field with know, implausible amounts | opus | 2m 58s | 10,767 | `f50ea27` |
| D2 · own words server | opus | 10m 08s | 120,687 | `309e115` |
| D2 · fix: 15 s deadline, mock list | opus | 3m 15s | 7,780 | `e6a347d` |
| D3 · own words box and tags | opus | 8m 04s | 115,240 | `176f665` |
| E1 · posts per tile | sonnet | 2m 31s | 29,366 | `f033da7` |
| E2 · posts in the card | opus | 6m 18s | 86,370 | `b0fbf5b` |
| E3 · feed link and profile | sonnet | 6m 02s | 45,190 | `338d97f` |
| **Total** | | 2h 34m 41s | 1,619,309 | 26 |

Tokens are the subagents' own; this session's context is not in them. The time and tokens of the four follow-up fixes (A9, B3, C1, D1/D2) are the difference between their agent's usage reports before and after the fix.

**Result**
Not run by the developer: one-shot run; they click through it at the handover.

---

**Smoke test, round 2 phase 1** · `feat/student-roads` · `http://localhost:3000`

**Before you start**
- Your `.env` in `C:\Projects\main-student-roads`, then `bun run dev` there (port 3000 free first).
- Make one roadmap per step below with "New roadmap → Start from scratch"; every answer not named is left as it comes.

**14 · A health student's road** — AC 54, 56
```
Go to   a new roadmap: Stay "Yes", "A few areas I'm drawn to" → Health, Last qualification "Bachelor's"
Do      finish onboarding · open the board · open the course card
See     Adelaide · Master of Nursing (graduate entry), UniSA, with no "Closest road" line; the course step reads "Master's · Nursing (graduate entry)"
```

**15 · A Diploma student's road** — AC 60, 89
```
Go to   a new roadmap: Stay "Yes", "Something particular" → Information technology, Last qualification "High school"
Do      open the board · open the course step and the 485
See     Adelaide · Diploma of Information Technology, UniSA College; the course step reads "Diploma · Information Technology", never "Master's"; the 485 describes the post-vocational stream; the fork after it reads "No clear road to PR" with the course's own reason ("a diploma alone does not lead to nomination…"), and no step claims a path to PR; the strip says "Closest road to your answers" with "Staying: this road has no clear road to PR (you said you'd stay)"
```

**16 · Going home in her field** — AC 59
```
Go to   a new roadmap: Stay "No", "Something particular" → Cyber security, Last qualification "Bachelor's"
Do      open the board, then the steps after the 485
See     Perth · Master of Cyber Security, ECU (not Melbourne's data road); the steps read "Two ways home", "Home with up to five years of Australian work", "Home"; nothing claims a path to PR
```

**17 · The chips' wording** — AC 63, 75
```
Go to   a new roadmap: Stay "Yes", "Something particular" → Data science, level "Diploma" · then another: Stay "Yes", "A few areas I'm drawn to" → Health, "Career-focused"
Do      open each board and read the strip
See     "Closest road to your answers" with "Level: this road is a Master's (you said Diploma)"; then "City: Adelaide (you said career-focused, which points to Sydney)". No chip pairs a key with another question's answer
```

**18 · A why naming its rule** — AC 64, 65, 66
```
Go to   the step-14 board
Do      open the course card, the Adelaide card, then a course in "2 more in Adelaide"
See     the course's why says you picked Health and that your qualification opens a Master's; Adelaide's says you'd stay; the alternative says how it relates to your course (same city, field, cost or PR) and never that your answers chose it. No "(mock)" inside a sentence, no option wording such as "something particular"
```

**19 · Ask's refusal follow-up** — AC 67, 70, 82
```
Go to   the step-14 board → the course card
Do      type "What is the visa processing time?" · then "Is there a gym on campus?" · then, with a budget stated, "Can I afford this on my budget?"
See     the first two: "I don't have that in our data.", then the card's suggested questions; the visa one adds "A registered migration agent or your counsellor can answer this.", the gym one does not; the third answers in AUD from the budget row, in about 1–2 s
```

**20 · Student AI off** — AC 81
```
Go to   .env: STUDENT_AI_OFF=1, restart dev
Do      open the step-14 board · the course card
See     the same road; the why is the template sentence only; Ask shows its suggested questions and no typed box. Remove the line and restart: the typed box is back
```
