---
title: "Step 04, After you graduate: one question per screen"
author: Jenish
---

# Step 04, After you graduate: one question per screen

Written 9 Oct 2026 by Jenish, in the repo (no ticket). Design source: the Claude Design canvas https://claude.ai/artifact/CvDM8Q8ZzzKcVhWTo5B4Zr, Onboarding page, "04 · After you graduate" (Grad, GradTablet, GradPhone, Grad1920, and the phone states GRNothing, GRStayNo, GRNotSure, GRLast, GRFailed); styles in `facts.css` (the shared question screen and the "Step 04" block). Built the way steps 02 and 03 were (docs/onboarding-study/, docs/onboarding-living/).

## Problem

Steps 00 to 03 sit on the onboarding shell, one question per screen. Step 04 is still the old long page outside the shell (`/onboarding/after`), so the last step before the futures changes look, the panel disappears, and a returning student cannot land on the question she left.

## Proposed outcome

Step 04 asks its four questions one per screen on the onboarding shell, at `/onboarding/after/<question>`, reusing the shared QuestionScreen. The last question's button opens the futures. The questions, their answers and their lines are today's; only the screen changes.

## Scope

In: the screens at `/onboarding/after/<question>`; the panel's step 04 state; the links into step 04 (step 03's Next and "Leave the rest") and out of it (Back to step 03, forward to the futures); the resume rule for step 04; both themes.
Out: the futures screen and step 06; the canvas's leave screen ("Next · step 05", the river) where the app already shows its loading screen; end-to-end tests (run only when asked).

## User stories

1. As a student, I want step 04 to ask one question at a time, like steps 01 to 03, so that I answer at the same pace and see what each answer does before my futures are drawn.

## Acceptance criteria

Story 1: one question per screen (surface: `/onboarding/after/<question>`, every width)

1. Given step 04, when she moves through it, then each question has its own URL: `/onboarding/after/stay`, `/focus`, `/earning`, `/long-term`; opening one marks step 04 as where she left off; a slug that names no question is not a page.
2. Given step 04, when shown, then the order is "Would you want to stay after?", "Career-focused or academic?", "Do you need to earn while studying?", "Settle long-term, or come home eventually? (optional)", always all four; the kicker reads "After you graduate · n of 4".
3. Given each question, when shown, then the question is the heading and the line under it reads: stay "It decides whether PR counts in your futures, and how much."; focus "It sets how much career outcomes weigh against cost, time and the rest."; earning "It sets how much part-time work weighs, and whether its rules show on every route."; long-term "It doesn't change your routes now. It shapes what we show you later."
4. Given a question, when shown, then its options are answer cards as on steps 02 and 03: stay Yes, Not sure, No, where Not sure is an ordinary card (no "?" mark, no assumption: it is a real answer); focus Career-focused, Academic, then Not sure; earning Yes, Helpful, No, then Not sure; long-term Settle long-term, Come home eventually, with no Not sure. Not sure on focus or earning stores the default as assumed (Career-focused, Helpful) and its line reads "Not sure: I'll assume “<default>” and show it as a chip you can change."
5. Given an answer, when its line shows, then it is today's line for that answer (stay Yes "Yes: courses off the occupation list seal; regional study gains points.", Not sure "Not sure: PR counts, but no route seals.", No "No: PR stops counting in your futures."; focus and earning as today; long-term "<Choice>: noted; it shapes what we show you later.").
6. Given a step 04 question, when idle, saving, saved or failed, then the note reads as on step 02, except: stay idle "“Not sure” is a real answer here. Skip, and I'll use it."; long-term idle "Optional. Skip, and it's left blank."
7. Given a step 04 question, when she moves, then Back on stay opens `/onboarding/living/climate` and elsewhere the previous question; Skip or Continue opens the next; on long-term the forward button reads "Show me three futures" and opens `/futures`; every other question offers "Leave the rest for now: show me three futures", which opens `/futures`; leaving sends any save still waiting. Step 03's Next and its "Leave the rest" open step 04's first unanswered question.
8. Given the panel on step 04, then 00 to 03 read Done and 04 is current with "Now · n/4"; stacked or on a phone the band reads "Now: 04 After you graduate · n of 4" and "Next: Three futures" ("Step 4 of 6." for screen readers), with five segments lit as the brand-ground segments draw them.

Coming back (surface: `/onboarding`, `/onboarding/after`)

9. Given a student, when she opens `/onboarding/after`, then she opens her first unanswered question, else long-term; `/` and `/onboarding` land there for a student who left from step 04, and `/onboarding` lands there for one who has seen her futures (as today's resume rule).
10. Given the old step 04 page, when this ships, then no route renders it and its code is removed; PRODUCT.md's URL map lists step 04's slugs; the unit suite passes.
11. Given step 04 at 390, 768, 1440 and 1920, when compared with the Grad and GR boards, then it matches in both themes.

## Edge cases

- An unanswered stay still counts as not sure for the futures (DS-D3, ADR-097), as today.
- Stay "Not sure" is stored as stated, not assumed: it never shows as an assumption chip.
- A student who reached the futures and comes back opens long-term when every question is answered, so Back from the futures lands on step 04's last screen.

## Constraints

- CLAUDE.md: onboarding shell, container-query layout, type and spacing roles, student URLs as named slugs, `ActionResult`, "test the brain, not the beauty", no `bun run test:db` or `db:reset`, no dev server started by the agent. The stored answers do not change shape: no migration.

## Out of scope

- The futures screen, its chips and step 06.
- End-to-end tests: the specs that walk step 04 through the old screen are not updated in this slice.

## Open questions

None blocking. Decided by Jenish on 9 Oct: the slugs `stay`, `focus`, `earning`, `long-term`; the last button opens `/futures` directly (the app's loading screen covers the wait); the panel keeps "Nothing is ranked".

## Delivery

9 Oct 2026 · branch `feat/onboarding-after`, pull request to `dev` (after `feat/brand-ground`, which it is built on). Criteria 1–10 covered by unit tests (onboarding, OnboardingPanel, QuestionScreen, landing; `bun run test:run` 830 pass, 0 fail); criterion 11 by screenshots at 390, 768, 1440, 1920 in both themes. Code review: Approve with changes, 1 MEDIUM and 3 LOW, all fixed. QA should re-check by hand: the four screens, stay's Not sure as a real answer, Back to step 03 and the last button to `/futures`, and `/onboarding/after` resuming. The e2e specs that walk the old step 04 screen are stale and need updating before `bun run test:e2e`. Known flaky, unrelated: a Providers test on the device-theme cookie fails about one run in three.
