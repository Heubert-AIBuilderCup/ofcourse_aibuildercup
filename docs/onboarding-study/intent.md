---
title: "Step 02, What you'd study: one question per screen"
author: Jenish
---

# Step 02, What you'd study: one question per screen

Written 9 Oct 2026 by Jenish, in the repo (no ticket). Design source: the Claude Design canvas https://claude.ai/artifact/CvDM8Q8ZzzKcVhWTo5B4Zr, Onboarding page, "02 · What you'd study" (Study, StudyTablet, StudyPhone, Study1920, and the phone states SDNothing, SDField, SDAreas, SDRefused, SDNotSure, SDFailed); styles in `facts.css` (the shared question screen and the "Step 02" block) and `pq.css`. Decided with Claude on 9 Oct: the slugs below, our engine's data, and removing the last area clears the answer.

## Problem

Steps 00 and 01 now sit on the onboarding shell, one question per screen, each with its own URL. Step 02 still shows all its questions on one long page outside the shell (`/onboarding/study`, the old opening screen), so the flow changes look and pace halfway through, the panel disappears, and a returning student cannot land on the question she left. The canvas now designs step 02 the way step 01 works, with the one multi-select of the onboarding (the areas).

## Proposed outcome

Step 02 asks one question per screen on the onboarding shell, at `/onboarding/study/<question>`, exactly as step 01 does: the field or the areas are asked only after the answer that opens them, the areas are up to three checkboxes, every tap shows what it does and saves at once, and the panel shows step 02 as current. Steps 03 and 04 are unchanged in this slice.

## Affected users and systems

- Students on step 02, and anyone passing through it to the futures.
- The onboarding shell, its panel and the step 01 question screen (`src/features/opening`); the study questions, defaults and impact lines (`model/questions.ts`, `model/impact.ts`); the answer save (`actions.ts`, `server/profile.ts`); the routes under `src/app/(app)/onboarding`; PRODUCT.md's URL map and CLAUDE.md's "Student URLs"; the end-to-end flows that pass through step 02.

## Scope

In: the screens at `/onboarding/study/<question>` on the onboarding shell; the panel's step 02 state; the links into step 02 (step 01's Next and "Leave the rest for now", step 03's Back) and out of it; the resume rule for step 02; removing the last area; the areas and field-assumption line copy; both themes.
Out: step 03 and step 04 (the old screen stays at `/onboarding/living` and `/onboarding/after`; their own slices follow); the canvas's mock figures where our engine has real ones; the futures' chip editor.

## User stories

1. As a student, I want step 02 to ask one question at a time, like step 01, so that I can answer it at the same pace and see what each answer does.
2. As a student who left in the middle of step 02, I want to come back to the question I left, so that I don't answer again.

## Acceptance criteria

Story 1: one question per screen (surface: `/onboarding/study/<question>`, every width)

1. Given a student on step 02, when she moves through it, then each question has its own URL: `/onboarding/study/know`, `/field`, `/areas`, `/level`, `/learning`, `/length`; opening any of them marks step 02 as where she left off; a slug that names no question is not a page.
2. Given step 02, when she answers "Do you know what you want to study?", then "Which field?" comes next only after "Something particular" and "Pick up to three" only after "A few areas I'm drawn to"; after "Suggest me" or "Not sure" neither is asked; then "Study level", "How you like to learn" and "Course length you'd prefer" follow in that order.
3. Given step 02, when shown, then the kicker reads "What you'd study · n of N", where N is 5 when the field or the areas are asked and 4 otherwise, and it changes as soon as her first answer changes.
4. Given each step 02 question, when shown, then the follow-up questions carry their group label above the question ("Something particular" above "Which field?", "A few areas I'm drawn to" above "Pick up to three"), the question is the screen's heading, and the line under it says why it is asked: know "It sets how wide your futures start: one field, a few areas, or every field in this preview."; field "Your futures are drawn from courses in this field. You can change it on each one."; areas "Courses from each area you pick show side by side, so you can compare them."; level "It sets the course length and entry each future is built on."; learning "It shapes what each future is drawn around. It doesn't put one above another."; length "Length changes the cost, and how long you could work in Australia after you finish."
5. Given a single-choice question (know, field, level, learning, length), when shown, then its options are answer cards as on step 01 with "Not sure" last; a tap checks the card and shows its line within 300 ms; "Not sure" stores the default as assumed and the line reads "Not sure: I'll assume “<default>” and show it as a chip you can change.", the defaults being "Suggest me", "any field", "Master's", "No preference" and "Fine with longer if it opens more".
6. Given a step 02 answer, when its line shows, then it is the model's line (`impactLine`) with two changes from the canvas: the areas are joined with " · " ("IT and computing · Data: courses across them show side by side.") and the field's assumption reads "any field"; on "Which field?" the line "Particular: pick the field." shows until she picks, and on "Pick up to three" the line "Pick up to three areas." shows until she picks.
7. Given "Pick up to three", when shown, then the six areas are checkbox cards with a count "n of 3 chosen" and three marks; a tap chooses or removes an area and saves; Health, Engineering and Design each say "Nearest field used for now" (the engine borrows a nearby field for them); there is no "Not sure".
8. Given three areas chosen, when she taps a fourth, then nothing changes, nothing is saved and "Three is the most for now. Tap one you've chosen to make room." shows; while three are chosen the other cards read as full; the message goes when she removes an area or leaves the question.
9. Given one area chosen, when she removes it, then her areas answer is cleared as if never given (stored answers no longer hold it), the count reads "0 of 3 chosen" and the forward button reads Skip.
10. Given a step 02 question, when idle, saving, saved or failed, then the note reads "“Not sure” is a fine answer. Skip, and I'll assume a sensible default you can change later." (on the areas: "Pick one, two or three. Skip, and I'll start wide, with every field in this preview."), "Saving…", "Saved. Tap another answer to change it." (on the areas: "Saved. Tap an area again to remove it."), or the failure alert with Try again, as on step 01.
11. Given a step 02 question, when she moves, then Back on the first question opens step 01's last question (`/onboarding/facts/english`) and elsewhere the previous question asked; Skip (nothing answered, stores nothing) or Continue opens the next question asked; on the last question the forward button reads "Next: Where and how you'd live" and opens `/onboarding/living`; every other question offers "Leave the rest for now: go to Where and how you'd live", which opens it too; leaving sends any save still waiting.
12. Given step 01, when she presses "Next: What you'd study" or "Leave the rest for now: go to What you'd study", then she opens step 02's first unanswered question; given step 03 (`/onboarding/living`), when she presses Back, then she opens `/onboarding/study/length`.
13. Given the panel on step 02, when side by side, then 00 and 01 read Done and 02 is current with "Now · n/N"; when stacked or on a phone, three segments are lit and the band reads "Now: 02 What you'd study · n of N" and "Next: Where and how you'd live" (screen readers hear "Step 2 of 6."); the panel's title is "Six short steps" and its lead "Each step says why it asks. Nothing is ranked: at the end you see three futures side by side.", as on steps 00 and 01 (the canvas's "ranked or recommended" is not taken: DS-R1 forbids "recommended" on any screen).
14. Given a new question, when it opens, then focus moves to its heading; the cards, the links and the buttons are reachable by Tab; the header menu (Dark theme, Sign out) is present as on every onboarding step.
15. Given step 02 at 390, 768, 1440 and 1920, when compared with the Study and SD boards, then it matches in both themes; 360, 1024, 1280, 1366, 1536 and 2560 are checked in screenshots.

Story 2: coming back (surface: `/onboarding`, `/onboarding/study`)

16. Given a student, when she opens `/onboarding/study`, then she opens her first unanswered question among those asked for her answers, else the last (`/onboarding/study/length`); a question not asked for her answers (the field without "Something particular", the areas without "A few areas I'm drawn to") opens the same place.
17. Given a student who left from step 02, when she opens `/` or `/onboarding`, then she lands as criterion 16 says; the retired `/opening/study` still lands there through `/onboarding/study`.
18. Given PRODUCT.md and CLAUDE.md, when read, then the URL map and the student URL rules list step 02's slugs; the existing unit and end-to-end suites pass, with the flows through step 02 now answering it one question per screen.

## Edge cases

- She answered "Something particular" and a field, then changes to "Suggest me": the field stays stored but is not asked or counted (N drops to 4) and its line stays quiet (criteria 2, 3, 6; code: `isVisible`, `unsureQuestions` in impact.ts).
- "Not sure" on the first question assumes "Suggest me", so no follow-up is asked (criterion 2; code: `effective`).
- She opens `/onboarding/study/areas` with "A few areas" answered: the question shows with her areas checked (criteria 1, 7).
- A refused fourth tap is not a save: the count, the cards and the stored answer stay as they were (criterion 8).
- Reduced motion: the screen's entrance and the tick motion are off; nothing else changes (criterion 15; the shell's rule).

## Constraints

- CLAUDE.md: the onboarding system (shell, panel, menu); container-query layout, the type and spacing roles, px icons, no size per breakpoint; student URLs as named slugs under `/onboarding/<step>`, keys never in a URL; server actions return `ActionResult` and never throw; "test the brain, not the beauty"; `bun run test:db` and `bun run db:reset` are never run; no dev server started by the agent.

## Out of scope

- Step 03 (`feat/onboarding-living`, next) and step 04 (its boards are arriving on the canvas): they keep the old screen until their slices.
- Dark boards for step 02: the canvas has none; dark comes from the tokens and is checked in screenshots (criterion 15).

## Dependencies

- None. The engine already maps Health, Engineering and Design to a nearby field (`AREA_FIELDS` in `src/features/engine/catalogue.ts`).

## Open questions

None blocking. Decided for this pass: slugs `know`, `field`, `areas`, `level`, `learning`, `length`; removing the last area clears the answer (the canvas allows it; the old screen kept the last one); the panel keeps its lead "Nothing is ranked: …" because DS-R1 (SHARED decision record, "No screen says “ranked 1st”, “best” or “recommended”") forbids the canvas's "ranked or recommended".

1. The welcome screen, already merged, says "Nothing is ranked or recommended." (`src/features/opening/components/WelcomeScreen.tsx:28`), which DS-R1 forbids as written. Owner: Jenish, with Nikhil if DS-R1 is to read "never recommends" rather than "never says the word". Does not block this slice.
