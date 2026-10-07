---
title: Let a new student sign up and see three futures
author: Jenish Shrestha
requested by: Jenish Shrestha
---

# Let a new student sign up and see three futures

_Intent written 5 Oct 2026 with Jenish Shrestha, from a brainstorm over the Hackathon Handoff pack (`/home/jenish/Projects/decision-studio/Hackathon Handoff`). No Jira idea; this folder is the record._

## Problem

A student cannot get into OfCourse today. The repo has a Google sign-in page that serves staff and a placeholder dashboard (`src/app/page.tsx`, `src/app/(app)/dashboard/page.tsx`). Everything the hackathon demonstrates on the student side starts with the opening: sign up, three futures appear, correct one assumption, all three redraw (ADR-057 extension and ADR-058 in `SHARED-decision-record.html`; `HACKATHON-build-handover.md` §1 steps 1–1b; flows DS-FL1 and DS-FL3 in `OfCourse spec.dc.html`).

It matters now because the user test with three students, one counsellor and one marketer runs on 8–9 Oct (ADR-098), and the plan had Priya's spine deployed by 7 Oct (`HACKATHON-genai-build-plan.md`, D2). Nothing is deployed yet.

## Proposed outcome

On 8 Oct a tester opens a public Google Cloud URL on their phone, signs up, and reaches three futures for their own answers within about three minutes. They correct one assumption and see all three futures redraw. Their answers are still there when they come back. Every student who signs up during the test can do this, not only a scripted persona.

## Affected users and systems

- **Students.** International students choosing a course and a route to Australia, whether offshore (e.g. in Nepal) or onshore on a visa. Every account created on the student sign-in page has role `user`.
- **Admins and superadmins.** They sign in on their own page. The users admin itself does not change.
- **Surfaces.** The splash; the student sign-in page at the app's root URL; the admin sign-in page under `/admin`; the picture question; opening screens 1–4 (facts, study, living, after you graduate); the relatives question on screen 3; the futures screen (screen 5) and its weights plaque; the coins screen (screen 6).
- **Data.** The student account; her answers with their state (stated or assumed); the comic-character choice; the relative's place and relationship; coins; saved reminders; a mock Australia catalogue.
- **Systems.** The engine's futures call (deterministic, no model).
- **Decision owners.** Nikhil, the PM, owns the decision record. Jenish owns this slice's build choices and the engine (decided in this brainstorm; see Open questions).

## Scope

- **Destination.** Australia only.
- **Devices.** Every criterion applies on a phone (the reference) and on desktop, which follows the Decision Studio v5 desktop frames, unless the criterion says otherwise.
- **Where a student is now.** Any country in the screen 1 list, including "Australia (on a visa)" and "Another country".
- **Budget.** Hard limit and "roughly".
- **Staying after.** Yes / not sure / no.
- **Roles.** Students on the student page. Admin and superadmin on the admin page.
- **Questions and options.** Taken from the design's opening (`r5-model.js` in the Decision Studio handoff) and DS-D1, minus the items listed under Out of scope.
- **Environments.** Local development and one deployed environment on Google Cloud.

## User stories

1. As a new student, I want to sign in with Google or an email code and choose whether to say how I'd like to be pictured, so that I can start in seconds without filling in a form.
2. As a student, I want to answer a few taps about my situation, what I'd study, where I'd live and what I want after graduating, with "Not sure" always allowed, so that I can see futures without knowing every answer.
3. As a student who has people in Australia, I want to say where they live, so that I can see how far each future is from them.
4. As a student, I want to see three different futures built around cost, staying and career, each showing its good and bad against what I weight, so that I can react to real options instead of answering more questions.
5. As a student, I want to correct an assumption the futures were built on, so that they reflect my real situation.
6. As a student, I want to spend ten coins across my life values, or put that off, so that I can say what my attention, time and energy are for.
7. As a returning student, I want to pick up where I left off, so that I never answer the same thing twice.

## Acceptance criteria

### Across all stories

1. Given any student-facing page in this slice, when it is shown, then the product reads "OfCourse", and no page text names Heubert, Expert, Edge or a CRM.
2. Given any screen in this slice, when it is shown, then it contains none of the words "ranked 1st", "best" or "recommended", and no copy says that a counsellor or anyone else already has the student's information (DS-R1, DS-R2).
3. Given any figure on the futures screen, the weights plaque or an impact line, when it is shown, then it carries a source and a data state or is labelled mock (DS-R5).
4. Given any wait in the student app longer than about 400 ms, when it happens, then the duck loader shows ("Keep floating." and the three rotating lines). Shorter waits show nothing. With reduced motion on, the duck sits still on the water.

### 1. Sign in

5. Given a new browser visit, when the first page of the app loads, then the splash plays once (about 3 s) and ends on the "Of Course!" wordmark. Later pages in the same visit show no splash. With reduced motion on, only the final wordmark shows.
6. Given the student sign-in page at the root URL, when it is shown, then it offers "Continue with Google" and email sign-in.
7. Given an address with no account, when it completes Google sign-in on the student page, then a student account with role `user` exists and the picture question opens.
8. Given the student sign-in page, when an email address is entered and a code requested, then a six-digit code is sent to that address and the page shows a code field and "Use a different email".
9. Given the latest code for an address was sent less than 10 minutes ago, when that code is entered, then she is signed in. A new address gets a student account with role `user` and the picture question opens.
10. Given a code older than 10 minutes, when it is entered, then the page says the code has expired and offers to send a new one, and she is not signed in.
11. Given a wrong code, when it is entered, then the page says the code is wrong. After the fifth wrong try, that code no longer works and the page asks her to send a new one.
12. Given a code was sent less than 30 seconds ago, when she looks for "Send a new code", then it is unavailable. After 30 seconds it sends a new code, and the previous code no longer works.
13. Given a student account created with an email code, when the same address signs in with Google on the student page (or the reverse), then she reaches the same account with the same saved answers.
14. Given the picture question ("How should we picture you?": male / female / prefer not to say), when she picks an answer or skips, then her comic-character choice is that answer (neutral when skipped), and screen 1 opens within 3 s of pressing Start.
15. Given a Google account with a name and a photo, when the student account is created, then her comic-character choice stays neutral until she answers the picture question. Nothing is set from her name or photo.
16. Given an account with role `admin` or `superadmin`, when it signs in on the student page, then it is refused with a message that the page is for students, and it is not signed in to the student app.
17. Given the admin sign-in page under `/admin`, when it is shown, then it offers Google sign-in only.
18. Given an account with role `user`, when it signs in on the admin sign-in page, then it is refused with "This account doesn't have admin access", and no account is created or changed.
19. Given an address with no account and no role waiting for it, when it signs in on the admin sign-in page, then it is refused and no account is created.
20. Given a database with no accounts, when the first sign-in happens on the admin sign-in page, then that account is `superadmin`. When instead the first sign-in happens on the student page, then that account is `user`.
21. Given a suspended student account, when she signs in on the student page, then she lands on the suspended page.

### 2. Answer the four question screens

22. Given screens 1–6, when any of them is shown, then six progress dots show which screen she is on.
23. Given screen 1 (Facts about you), when it is shown, then it asks where she is now, her budget per year (amount, what it covers, who pays, hard limit or roughly), timing (earliest start, latest start, most years), who is coming with her, and her qualifications and English score.
24. Given "Where are you right now?" on screen 1, when she picks "Australia (on a visa)", then the impact line differs from the one shown for an offshore country.
25. Given any answer on screens 1–4, when she taps it, then a one-line impact appears under the question within 300 ms.
26. Given any question on screens 1–4, when she taps "Not sure", then the DS-D1 default is stored, marked assumed. The impact line says it is assumed, and the value appears as an assumption chip on the futures.
27. Given "Anyone coming with you?" on screen 1, when she picks "Partner" or "Partner and children", then the answer is saved, no follow-up form appears, and the impact line says family isn't covered in this preview yet.
28. Given the destination question on screen 3, when she picks "Open to others", then the impact line says only Australia is covered in this preview, and her futures are Australian.
29. Given screen 4, when "Would you want to stay after?" is shown, then it offers yes, not sure and no.
30. Given any of screens 2–6, when she presses Back, then the previous screen shows her answers as she left them.

### 3. People in Australia

31. Given screen 3 with "Does a community or relatives nearby matter?" answered other than "No", when the screen updates, then "Do you know anyone who lives in Australia?" appears. With "No", it does not appear.
32. Given she says yes and picks a city or suburb from the preview's places, a relationship (cousin, sibling, aunt or uncle, friend, other) and optionally a name, when the futures show, then each future gives one distance line marked as an estimate. A future in her person's city reads "<campus>: about N min from <name, or else the relationship> in <place>". A future in another city reads "<city>: a N-hour flight from <name, or else the relationship> in <their city>".
33. Given she picks "Somewhere else" and types a place, when the futures show, then each future shows a line promising the distance once it can be worked out, instead of a distance.

### 4. See three futures

34. Given screens 1–4 completed with any mix of answers and "Not sure", when the futures screen opens, then up to three futures appear, headed "built around cost", "built around staying" and "built around career". Each is a different route from the preview catalogue, and they are not numbered or ordered as a ranking.
35. Given a future, when it is shown, then it gives a one-line route and one line per dimension (Cost, Time, Work, PR, Location, Career). Each line is marked "▲ Gives you", "▼ Costs you" or "● Neutral" by shape and word as well as colour. The dimensions she weights most are drawn larger.
36. Given a line on a future, when its "Might feel" is shown, then it follows these rules:
    - Gives you: relieved when her weight for that dimension is 2 or more, else fine.
    - Neutral: fine.
    - Costs you: hard at weight 3, stretched at weight 2, else fine.
    - Cost only: a route over her budget is at least stretched, and more than 20% over her budget is hard, whatever her weight.
37. Given a hard-limit budget, when the futures show, then no future costs more than that budget.
38. Given a claim on a future, when it is shown, then it carries strength pips (1–5) and a data state. Tapping it shows the number, its source and its date.
39. Given a future that uses the Perth job-market claim (register item R1), when it is shown, then that claim reads "We're not sure about this yet".
40. Given a future, when it is shown, then any PR outlook appears as a band and never as a number (DS-R6).
41. Given a future, when it is shown, then under "What I assumed · tap to correct" it lists as chips the answers that future rests on. Answers she left as "Not sure" read "Assumed: …" (for example "Assumed: Budget about AUD 30k a year"). It also offers a keep-options-open action that names how many options it keeps open, with "Remind me".
42. Given "Remind me" on a keep-options-open action, when she presses it, then the page confirms the reminder is saved to her account.
43. Given the futures screen, when she opens the weights plaque, then it shows Cost, Time, Work, PR, Location and Career, each 0–3 from her answers by the DS-D3 rules (capped at 3), each with its rule's reason. Family is not shown.
44. Given she chose a field or area that has no courses in the preview catalogue, when the futures show, then they use the nearest covered field, each card says so (for example "No nursing courses in this preview, so these use health sciences"), and a chip lets her change the field.
45. Given fewer than three different routes fit her limits, when the futures screen opens, then only those futures show. A line says why and names the chip that would open more.
46. Given a hard-limit budget that rules out every route, when the futures screen opens, then it reads "Sealed at your hard limit" and shows the nearest routes, drawn as sealed, each with how far over her budget it is, beside the budget chip. The screen is never blank.
47. Given "Would you want to stay after?" answered "No", when the futures show, then her PR weight is 0 and PR lines read neutral, "doesn't count here".
48. Given the same saved answers, when the futures screen is opened twice, then the same futures appear with the same lines.

### 5. Correct a chip

49. Given a chip on a future, when she taps it, then that question's options open in place under the chip, headed "<question>. All three futures redraw."
50. Given the chip editor, when she picks a new value, then within 500 ms all three futures redraw from the new value. Rows that changed read "Changed with your answer", each changed card is tagged "Redrawn: <what changed>", and the new value is saved as stated, no longer assumed.
51. Given a chip change, when she presses Undo, then the previous value and the previous futures return.
52. Given a chip change to field or level, when the futures redraw, then the routes can change to courses that exist for the new field or level.

### 6. Spend the coins

53. Given the coins screen, when it is shown, then it holds ten coins and eight empty piles: health, social life, financial life, learning and growth, closeness to family, community and relatives nearby, independence, adventure.
54. Given a pile with five coins, when she tries to add a sixth, then it is refused.
55. Given the coins screen, when fewer or more than ten coins are placed, then she cannot finish. With exactly ten placed, she can.
56. Given a coin placed on a pile, when it lands, then one line says what that coin means.
57. Given the coins screen, when she taps "Not sure", then the coins are spread evenly and marked assumed.
58. Given the coins screen, when she taps "Spend them later", then the coins stay unspent and the futures screen shows "Spend your ten coins", which opens the coins screen.
59. Given any coin placement, when it changes, then the futures do not change (DS-R7).

### 7. Come back

60. Given a student who left partway through screens 1–4, when she signs in again, then the screen she left opens with all her earlier answers.
61. Given a student who has reached the futures screen before, when she signs in again, then her futures open, computed from her saved answers.
62. Given a returning student on the futures screen, when she goes Back to an earlier screen and changes an answer, then her futures redraw with the change.
63. Given a student who signs in on a second device with the same account, when the app opens, then her answers and futures are the same as on the first device.

## Edge cases

- **"Not sure" on a high-stakes fact** (budget, timing): the default is assumed and marked, and the futures use it. Criterion 26. From the spec, DS-E1 and DS-D1.
- **A field with no courses in the catalogue** uses the nearest field, said plainly. Criterion 44. From the spec, DS-E13 (open question DS-Q4), decided by Jenish.
- **Fewer than three distinct routes fit**: show fewer and say why. Criterion 45. From the PM (Jenish), because the catalogue is small.
- **A hard limit seals every route**: nearest routes shown as sealed with how far over each is; never blank. Criterion 46. From the spec, DS-E4; the board version is out of this slice.
- **Stay = No**: PR counts for nothing. Criterion 47. From the spec, DS-E5.
- **A relative in a place outside the preview's data** gets the promise line. Criterion 33. From the spec, DS-E7.
- **"Open to others" as destination**: futures stay Australian, with one line saying so. Criterion 28. From the PM; the spec's UK swap in DS-F14 is dropped.
- **Dependants picked**: the answer is saved, with no follow-up form. Criterion 27. From the PM. The follow-up form and Suman's lanes were decided out of scope by Jenish.
- **The same email via Google and via a code** is one account. Criterion 13. From the PM.
- **Signing in on the wrong page** is refused in both directions. Criteria 16 and 18. From the PM.
- **A public deploy with an empty database**: a student can never become superadmin. Criterion 20. From the code (`resolveSignupRole` in `src/shared/lib/auth/access.ts`) and the README warning; decided by the PM.
- **Expired, wrong or replaced codes**. Criteria 10–12. From the PM.
- **A Google name or photo must not choose the comic character**. Criterion 15. From the docs, ADR-019 and ADR-029.
- **A suspended student**. Criterion 21. From the code (`src/shared/lib/auth/gate.ts`, `SUSPENDED_PATH`).
- **Splash already seen in this visit; reduced motion**. Criterion 5. From the spec, DS-E11 and DS-E14; DS-Q7 decided by Jenish as per browser visit.
- **Over budget on a "roughly" budget**: the feel is at least stretched. Criterion 36. From the PM: the simplification ADR-098 allows, plus a Cost-only size rule.
- **Composer conflicts and unquotable values** (DS-E2, DS-E3) were decided out of scope by Jenish and go to the composer slice.
- **Put on my board, Compare with fewer than two routes, Ask once and Undo after the toast** (DS-E8, E9, E10, E15) were decided out of scope by Jenish and go to the board and Find slices.

## Constraints

- **Deadline.** Live by 8 Oct for the 8–9 Oct user test (ADR-098).
- **Hosting.** Deployed on Google Cloud at a URL the testers and judges can reach, as the competition requires (`HACKATHON-build-handover.md` §0b). The Google Cloud project is on Jenish's account (ADR-098). Which Google Cloud services, and which email-sending service for the codes, are decided at plan time.
- **Sign-in.** Stays on the repo's existing authentication (Better Auth) for both Google and email codes, not Firebase Auth.
- **Design.** The Industry design system (`src/design-systems/industry/DESIGN.md`), which is the system the frozen designs use. The frozen Decision Studio v5 frames are the reference, phone first.
- **Name.** "OfCourse", with no internal names anywhere a student looks (ADR-093, ADR-095).
- **Speed.** Impact line within 300 ms; screen 1 within 3 s of Start; redraw within 500 ms; loader only for waits over about 400 ms (DS-F2, F3, F14, F42).
- **No model calls in this slice.** Futures, weights and feel are rules over the catalogue, and the same answers give the same futures (ADR-077, handover §4).
- **Record.** The decision record wins over the spec. Where this intent departs from the record, a new ADR records it (see Open questions).
- **Data.** Every figure is mock and labelled as such.

## Out of scope

- **The composer** ("Tell me in your own words", G1). It gets its own slice next.
- **The dependants follow-up form, Family weight and line, and Suman's lanes** (DS-F6, DS-F41). They go to a later slice.
- **Priya's seeded account and the pre-filled "From what you told us · confirm" state.** How Priya appears in the demo is decided in a later slice.
- **Phone-number sign-up** (ADR-098).
- **New roles** such as editor and reviewer. They come with the admin app.
- **Other student surfaces:** the board, route detail, Find, ranking and Compare, the feed, the watchlist, and the profile screen. "Remind me" is saved, but nothing shows it until the feed exists.
- **The rest of the engine:** routes, preview, flex, deck, questions/next and watch. These belong to Jenish's later board and Find slices.
- **G9 course whys and G10 offsets.**
- **Destinations other than Australia**, including DS-F14's UK route.
- **Real travel times** from a maps service.
- **The admin Parsing monitor.**
- **Repo housekeeping:** moving to a public GitHub repo and renaming anything students don't see. This happens before submission.
- **Funnel metrics and events.**

## Dependencies

- **A mock Australia catalogue, written by Jenish in this slice.** Six cities plus Wollongong and about 12 courses (ADR-097), with fees, intakes, PR paths, claims with sources and dates, and coordinates for campuses and a few suburbs (ADR-086). It draws on the design prototypes (`r5-model.js`, `tl-model.js`) and the handover's figures, including the rent fact "about AUD 160 a week lower (about 30%)" (ADR-097). All of it is labelled mock.
- **The engine contract.** ADR-097 places it in "the hackathon architecture §4b", which is not in the pack. Until it arrives, `FINAL-system-architecture.md` §4 is the reference.
- **An email-sending service** for the six-digit codes, chosen at plan time.
- **Google sign-in credentials** that allow the deployed URL.

## Open questions

1. **Record the decisions this brainstorm changed as new ADRs.** Owner: Nikhil. Does not block. The decisions:
   - Jenish owns the engine (ADR-098 gave it to Nikhil's agent).
   - "Might feel" uses sign × weight plus the Cost-only size rule for the hackathon.
   - Google and email sign-in run on Better Auth instead of Firebase Auth.
   - There are two sign-in pages, and the first-account superadmin rule applies on the admin page only.
   - The UK swap in DS-F14 is dropped.
   - Seeded Priya is deferred.
   - Hosting services are chosen at plan time rather than Firestore and Firebase.
2. **Share the missing documents.** `HACKATHON-ai-detailed-spec.md`, `HACKATHON-genai-refinement.md` and the hackathon architecture §4b, which ADR-096, 097 and 099 cite. Owner: Nikhil. Does not block; FINAL architecture §4 is used meanwhile.
3. **How does a new student give her qualifications and English score on screen 1?** The design offers only Priya's pre-filled values ("Bachelor of Business · 72%" / "That's not right"). Owner: Nikhil. Blocks only that item; until answered, "Not sure" stores "unknown" and futures mark their routes unconfirmed (DS-D1).
4. **What does a keep-options-open action count as an "option kept open" on Australian routes?** The design's example is a UK door, which is out of scope. Owner: Jenish, while writing the catalogue. Does not block.
5. **What happens when an address with an admin role waiting signs up on the student page?** Owner: Jenish. Does not block.
6. **Reconcile Jenish's catalogue with Nikhil's Part C mock data**, so the admin app and the student app share one set. Owners: Nikhil and Jenish. Does not block this slice.
7. **Confirm the submission deadline** (18 Oct or about 14 Oct) and the 11 Oct team-formation cutoff in the Hack2skill dashboard. Owner: Jenish. Does not block.
8. **Check the image-model quota request**, which was due on 3 Oct. Owner: Jenish. Does not block this slice.
9. **Effect-size thresholds for "Might feel" on every dimension.** Owner: Nikhil. Post-hackathon; does not block.
10. **Copy in the frozen design that this slice can't make true.** Owner: Nikhil. Does not block; the build uses the defaults below until he answers.
    - The "not sure" note reads "We've asked a counsellor to check, and it updates here when they do", but nobody is asked in this slice. Default: "We're not sure about this yet."
    - "You're in" says "Change it any time on your profile", and the profile doesn't exist yet. Default: the profile clause is left out.
    - The coin effect lines say coins move cities ("cities with the shortest trips to Kathmandu rise"), which breaks DS-R7. Default: each line says what the value means to her and never claims a route or city moves.
    - The design puts the "not sure" mark on Adelaide's time-to-PR claim. Default: it goes on the R1 job-market claim, as criterion 39 says.

## Design reference

The frozen showcase (`Decision Studio v5 - Walk - timelines and companion.dc.html`, export of 2 Oct 2026) is the visual reference. Frames by surface:

| Surface | Frames |
| --- | --- |
| Splash | Round 9 · 1 (live, four stills, reduced motion) |
| Student sign-in, code step, picture question, "You're in" | Round 10 · 1 (the code step is in the SignUp component, no frame) |
| Screens 1–4 | Round 6 part 1 · 1 · screens 1–4; Desktop · facts |
| Relatives on screen 3 | Round 8 · 3 · just answered yes, Anjali in Cannington |
| Futures and redraw | Round 6 part 1 · 1 · 5 and futures-redraw; part 3 · Fixes (field), claims frames; Round 7 · 4 · marked lines; Round 8 · 3 · distance on each; Desktop · futures |
| Weights plaque | Round 6 part 3 · Fixes · weights plaque, top half only |
| Coins | Round 6 part 1 · 1 · 6 (empty, a coin lands, not sure) |
| Loader | Round 6 part 3 · 11 |

Designed on these screens but left off in this slice: the composer bar, "How people deal with this" offsets, "Keep an eye on this", the bottom bar (Ask, Board, Watchlist, Rank), the "flexible on…" half of the plaque, the "From what you told us · confirm" tags and "That's right", and the UK route for "Open to others".

Not designed, built from the Industry system and the nearest frame: the Google button on the student sign-in page; the admin sign-in page; the wrong-page refusals; the code errors; the "fewer than three", "all sealed" and "field not covered" futures states (the prototype's sealed card state is the model); the promise line; the "Spend your ten coins" entry; the futures screen as home on a return visit; desktop for sign-in, screens 2–4, coins and the plaque.

## Changes

- 5 Oct 2026, Jenish, before planning: criteria 32, 33, 41 and 49 corrected to match the frozen design (relationship options, flight-time distances to other cities, chips list every answer a future rests on, the inline chip editor). Open question 10 and the Design reference section added from the design check.
- 6 Oct 2026, review fixes: criterion 32 refined in the build, its wording unchanged. A future in another city less than 300 km from her person's city (Melbourne to Geelong, Sydney to Wollongong) reads "<city>: about N min by road from <name, or else the relationship> in <their city> · estimate" instead of a flight; 300 km or more stays a flight.
