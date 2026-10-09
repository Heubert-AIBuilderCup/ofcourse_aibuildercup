---
title: "Step 03, Where and how you'd live: one question per screen"
author: Jenish
---

# Step 03, Where and how you'd live: one question per screen

Written 9 Oct 2026 by Jenish, in the repo (no ticket). Design source: the Claude Design canvas https://claude.ai/artifact/CvDM8Q8ZzzKcVhWTo5B4Zr, Onboarding page, "03 · Where and how you'd live" (Live, LiveTablet, LivePhone, Live1920, and the phone states LVNothing, LVOpen, LVNoCommunity, LVPerson, LVElse, LVFailed); styles in `facts.css` (the shared question screen and the "Step 03" block). Built the way step 02 was (docs/onboarding-study/).

## Problem

Steps 00 to 02 sit on the onboarding shell, one question per screen. Step 03 is still the old long page outside the shell (`/onboarding/living`), so the flow changes look halfway through, the panel disappears, and a returning student cannot land on the question she left. The canvas now designs step 03 as one question per screen, with "Who, and where?" as its one form.

## Proposed outcome

Step 03 asks one question per screen on the onboarding shell, at `/onboarding/living/<question>`, reusing step 02's QuestionScreen: "Do you know anyone…" only after community is not "No", the person form only after "Yes", climate optional with no "Not sure". Every part of the person form may be left blank. Step 04 is unchanged in this slice.

## Scope

In: the screens at `/onboarding/living/<question>`; the person form; the panel's step 03 state; the links into step 03 (step 02's Next and "Leave the rest", step 04's Back) and out of it; the resume rule for step 03; a looser stored person (any part blank); both themes.
Out: step 04 (the old screen stays at `/onboarding/after`); the canvas's mock minutes and place list (ours come from the engine); end-to-end tests (run only when asked).

## User stories

1. As a student, I want step 03 to ask one question at a time, like steps 01 and 02, so that I answer at the same pace and see what each answer does.
2. As a student who knows someone in Australia, I want to tell what I know about them and leave the rest blank, so that my futures can show how far each route is from them.

## Acceptance criteria

Story 1: one question per screen (surface: `/onboarding/living/<question>`, every width)

1. Given step 03, when she moves through it, then each question has its own URL: `/onboarding/living/destination`, `/place`, `/community`, `/know-anyone`, `/who-and-where`, `/climate`; opening one marks step 03 as where she left off; a slug that names no question is not a page.
2. Given step 03, when shown, then the order is Destination, Kind of place, community, "Do you know anyone who lives in Australia?" (only when community is answered and not "No"), "Who, and where?" (only when that is answered "Yes"), "Climate (optional)"; the kicker reads "Where and how you'd live · n of N" with N from 4 to 6, changing as soon as an answer changes it.
3. Given each question, when shown, then the question is the heading and the line under it reads: destination "It sets the country each future is drawn in. This preview covers Australia."; place "It changes the rent, part-time work and migration points on each route."; community "It shapes where each future places you to live. It doesn't put one above another."; know-anyone "If you do, each route can show how far it is from them."; who-and-where "Each route then shows its distance from them. Leave any part blank."; climate "Some people settle better in one climate or another."
4. Given a single-choice question, when shown, then its options are answer cards as on step 02 with "Not sure" last (climate has none); "Not sure" stores the default as assumed (Australia, Suburban, A little, No) and its line reads "Not sure: I'll assume “<default>” and show it as a chip you can change."
5. Given an answer, when its line shows, then it is: Australia "Australia: <n> cities in this preview" with the mock tag; Open to others "Only Australia is covered in this preview, so your futures will be Australian." in the calm limit style; place and community as today's lines; know-anyone "No: noted; it won't change your futures.", or "Yes: next, tell me who and where. Every route can then show its distance from them." until her person has a place, then the person line (criterion 9); climate "<Choice>: noted; climate doesn't change your futures in this preview."
6. Given a step 03 question, when idle, saving, saved or failed, then the note reads as on step 02, except: climate idle "Optional. Skip, and it's left out."; the person form idle "Every change saves as you go. Skip, and no one is added.", saved "Saved. Every change saves as you go.", failed "We couldn't save that. What you entered is still here. Check your connection and try again." with Try again.
7. Given a step 03 question, when she moves, then Back on Destination opens `/onboarding/study/length` and elsewhere the previous question asked; Skip or Continue opens the next; on Climate the forward button reads "Next: After you graduate" and opens `/onboarding/after`; every other question offers "Leave the rest for now: go to After you graduate"; leaving sends any save still waiting. Step 02's Next and its "Leave the rest" open step 03's first unanswered question; step 04's Back opens `/onboarding/living/climate`.
8. Given the panel on step 03, then 00 to 02 read Done and 03 is current with "Now · n/N"; stacked or on a phone the band reads "Now: 03 Where and how you'd live · n of N" and "Next: After you graduate" ("Step 3 of 6." for screen readers); the lead keeps "Nothing is ranked" (DS-R1 forbids the canvas's "recommended").

Story 2: the person (surface: `/onboarding/living/who-and-where`)

9. Given "Who, and where?", when shown, then it has "City or suburb" (a select of the engine's places grouped by city, "Choose a city or suburb" first, "Somewhere else" last), "Where?" (a text field, only after "Somewhere else"), "They're your…" (Cousin, Sibling, Aunt or uncle, Friend, Other as cards) and "Name (optional)"; every part may be left blank and each change saves as she goes; when every part is blank, no person is stored.
10. Given a person, when her line shows, then it names her contact by the name, else by the relationship ("your cousin", "your sibling", "your aunt or uncle", "your friend"), else (Other, or none chosen) "the person you know"; with a preview place it reads "<Who> in <Place, City>: <campus> is about <n> min away, <campus> about <m> min · estimate. Every route shows its distance from <who>." with minutes from the engine; with "Somewhere else" "We'll show distances from <who>[ in <where>] once we can work them out."; with no place "Pick a city or suburb, and each route shows its distance from <who>."
11. Given a person with no place, when her futures are drawn, then no distance line shows; with a place, the futures' distance lines name her contact as criterion 10 does.

Coming back (surface: `/onboarding`, `/onboarding/living`)

12. Given a student, when she opens `/onboarding/living`, then she opens her first unanswered question among those asked (the person counts as answered once stored), else Climate; a question not asked for her answers opens the same place; `/` and `/onboarding` land there for a student who left from step 03.
13. Given PRODUCT.md, when read, then the URL map lists step 03's slugs; the unit suite passes.
14. Given step 03 at 390, 768, 1440 and 1920, when compared with the Live and LV boards, then it matches in both themes.

## Edge cases

- Community changed to "No" after "Yes" and a person: know-anyone and the person are no longer asked or counted, and the futures ignore the person (`activeRelative`, unchanged).
- "Not sure" on know-anyone assumes "No": the person is not asked.
- "Somewhere else" with nothing typed is a person with a place still to come: the line promises distances later.
- Stored people from before this slice (every part set) still read as they do today.

## Constraints

- CLAUDE.md: onboarding shell, container-query layout, type and spacing roles, student URLs as named slugs, `ActionResult`, "test the brain, not the beauty", no `bun run test:db` or `db:reset`, no dev server started by the agent. The person is jsonb: loosening its schema needs no migration.

## Out of scope

- Step 04 (`/onboarding/after`, the old screen) and its Back to step 03 beyond the one link above.
- End-to-end tests: the specs that walk step 03 through the old screen are not updated in this slice.

## Open questions

None blocking. Decided by Jenish on 9 Oct: the slugs above; any part of the person may be blank; no relationship reads "the person you know"; places and minutes from the engine; Back and Next as criterion 7; the panel keeps "Nothing is ranked".

## Delivery

9 Oct 2026 · branch `feat/onboarding-living`, pull request to `dev`. Criteria 1–13 covered by unit tests (onboarding, impact, geo, actions, OnboardingPanel, QuestionScreen, PersonForm, OpeningScreen; `bun run test:run` 826 pass, 0 fail); criterion 14 by screenshots at 390, 768, 1440, 1920 and dark. Code review: Approve with changes, 2 MEDIUM and 5 LOW, all fixed. QA should re-check by hand: the person form (any part blank, "Somewhere else"), forgetting the person on "No", and step 04's Back. The e2e specs that walk the old step 03 screen are stale and need updating before `bun run test:e2e`.
