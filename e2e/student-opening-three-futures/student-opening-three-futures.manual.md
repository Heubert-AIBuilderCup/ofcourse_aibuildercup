# Person checks: onboarding steps 00–01 (student-opening-three-futures)

Steps from smoke-onboarding-ui.md, not run by hand (its Result: one-shot run), come first. Each line: the criterion, then exactly what to look at. Everything else in this pass is asserted in student-opening-three-futures.e2e.ts beside this file.

## From the smoke test, not run by hand

- [ ] AC14, AC22 (smoke 1), at 390, 768 and 1440: after Start, the panel stays put (no flash or replayed entrance) while step 01 slides in; 00 now shows its check and "Done", 01 "Now · 1/11".
- [ ] AC23, AC25 (smoke 2): each question screen reads as one unit: kicker, the question as the big heading, the why line under it, the cards with "Not sure" last and dashed; the cards slide in, the impact line rises in under the question.
- [ ] AC26 (smoke 3): the "Not sure: I'll assume …" line has a dashed left edge, and its extra assumed values show as chips under it.
- [ ] AC27 (smoke 3): the Partner line is the grey "limit" style, distinct from the plain and assumed lines.
- [ ] AC3 (smoke 3): on `/onboarding/facts/latest` with Jul 2027, the "mock" tag sits after the line as a small dashed tag, readable at 390.
- [ ] Developer ask, keyboard (smoke 4): the focus ring is clearly visible on the card the arrows land on, at 390 and 1440.
- [ ] Developer ask, save fails (smoke 5): with devtools Network set to Offline (a real dropped connection, not the test's interception), the alert and Try again show; back online, Try again saves.
- [ ] AC30 (smoke 6): on a phone, the sticky Back / Continue bar never covers the last card or the impact line when scrolled to the bottom.
- [ ] AC60 (smoke 7): sign out with a real Google or email-code sign-in and sign in again: step 01 opens at her first unanswered question.
- [ ] Developer ask, wide (smoke 8): at 1920 the page looks like the 1440 board enlarged, not stretched; at 2560 the 1920 frame sits centred, and the panel's colour either runs to the screen edge or is boxed (open decision 1 in the smoke test: say which you see).

## What no test can judge

- [ ] AC4: with reduced motion on (OS setting), the duck on the loader and on the panel sits still on the water and the page has no slide-ins; the test checks only that nothing in the loader moves.
- [ ] AC4: the loader's three lines rotate during a long wait (the test sees "Keep floating." and one line only).
- [ ] AC22: on tablet and phone, the seven progress segments show done / now / later in three distinct tones (the test checks the read-out text only).
- [ ] AC2: the panel art and any image text on steps 00–01 carry no "best", "recommended" or "ranked 1st" (the test reads page text only).
- [ ] Check steps 00 and 01 at 360, 1024, 1366 and 1536 wide (the tests visit 390, 768, 1440, 1920 and 2560).

## Stable ids to add

- Step 01, the impact line under the question: found by `[aria-live="polite"]` with text. Suggest `data-testid="impact-line"`.
- Loader, the duck: decorative and hidden from the accessibility tree, so the motion check covers the whole loader (`status "Loading"`). Suggest `data-testid="duck"` on the duck.
- Loader (fast-wait probe), its heading: found in page script as the `h2` with text "Keep floating.". Suggest `data-testid="loader"` on the loader root.
- Step 01, the first question's heading (fast-wait probe): found in page script as the first `h1` by its text. Suggest `data-testid="fact-question"`.
- Onboarding panel, the step list items: found by position (`listitem` 0 and 1 of "Your steps"). Suggest `data-step="00"`… on each item.
- Onboarding panel, the "Step N of 6." read-out: found by its text. Suggest `data-testid="step-progress"`.
- Step 01, the kicker "Facts about you · N of 11": found by its text. Suggest `data-testid="fact-counter"`.
- Step 01, the answer cards in AC2, AC25 and the keyboard test: the first and second card found by position. Suggest `data-value="<option>"` on each card.
- Step 01, the save note ("Saving…" / "Saved. …"): found by its text. Suggest `data-testid="save-status"`.
