---
title: "Step 05, Your attention: the last onboarding step"
author: Jenish
---

# Step 05, Your attention: the last onboarding step

Written 12 Oct 2026 by Jenish, in the repo (no ticket). Design source: the Claude Design canvas https://claude.ai/artifact/CvDM8Q8ZzzKcVhWTo5B4Zr, Onboarding page, "05 · Your attention" (Coins, CoinsTablet, CoinsPhone, Coins1920, and the phone states CNNone, CNPartly, CNFull, CNTen, CNNotSure, CNBack); the updated Grad and Welcome boards; styles in `facts.css`. The canvas parks Three futures: "coming back later as its own feature, outside onboarding".

## Problem

Onboarding still ends on the futures. The canvas has moved the futures out of onboarding (they are the result, shown elsewhere later), so onboarding is now six steps, 00 to 05, ending on Your attention. In the app that step is still the old coins page at `/attention`, outside the shell, with the old band and progress bar, and step 04 still sends her to `/futures`.

## Proposed outcome

Your attention is step 05 on the onboarding shell at `/onboarding/attention`, built from the Coins boards. Done (exactly ten coins) or "Spend them later" ends onboarding on "You're all set" at `/onboarding/done`. Step 04 leads to step 05. The panel, the band and the welcome speak of the six steps 00 to 05. Nothing in onboarding links to `/futures` any more, and signing in never lands there; the futures page stays, reachable by its URL, for its own feature later.

## Scope

In: step 05 at `/onboarding/attention`; the end screen at `/onboarding/done`; step 04's way forward; the panel and band for steps 00 to 05; the welcome's copy; landing and resume; `/attention` redirected; both themes.
Out: where the futures appear next (its own feature); the light accent ramp synced to the brand blue (its own branch next); the sign-in page's lede, which still mentions three futures; end-to-end tests (run only when asked).

## User stories

1. As a student finishing onboarding, I want to place ten coins on what matters to me, or leave them for later, so that what OfCourse shows me later follows my attention without changing my routes.
2. As a student who has finished, I want to land on "You're all set" and still change my coins or any answer, so that I know I'm done and nothing is locked.

## Acceptance criteria

Story 1: the coins (surface: `/onboarding/attention`, every width)

1. Given step 05, when shown, then it sits on the onboarding shell: kicker "Your attention · optional", heading "Your attention", the intro "These ten coins are your attention, time and energy for the next few years. Where do they go?", the hint "Tap + to place a coin. Coins shape what we show you later; they never change your routes.", and opening it marks step 05 as where she left off.
2. Given the tray, when shown, then it shows ten coins, those placed filled, "<n> of 10 placed" announced politely, and a "Not sure" action.
3. Given the eight piles (Health, Social life, Financial life, Learning and growth, Closeness to family, Community and relatives nearby, Independence, Adventure), when she taps + or −, then the pile gains or loses a coin (at most five on a pile, ten in all), its count and its five-coin stack follow, and the pile she last changed shows its line "<Pile> at <n>: <text>": 0 "nothing extra shown for it."; 1–2 and 3–5 as the canvas's two texts per pile (Health "health cover basics appear on every route." / "we'll show clinics, sport and health cover on each route.", and so on for every pile, exactly as `Coins.dc.html` PILES).
4. Given a pile at five, or all ten placed, when she taps +, then nothing is placed and the pile shows "Five is the most on one pile. Take one from here, or place it on another pile." or "All ten are placed. Take one from another pile first."; + reads as capped.
5. Given "Not sure", when tapped, then the coins become the even spread Health 2, Social life 1, Financial life 2, Learning and growth 1, Closeness to family 1, Community and relatives nearby 1, Independence 1, Adventure 1, stored as assumed, and "Assumed: an even spread. You can change it any time." shows until she moves a coin.
6. Given fewer than ten placed, then Done is not available and the line under it reads "Place all ten to finish · <n> left."; with exactly ten, Done is the strong button and the line reads "All ten placed. Done finishes onboarding." "Your routes stay exactly as they are, whatever you place here." shows above them.
7. Given Done with ten placed, when tapped, then her coins are saved as spent (assumed when they are the untouched spread) and she lands on `/onboarding/done`; given "Spend them later: finish without placing coins", then her coins are saved as later and she lands on `/onboarding/done`; a refused save keeps her on the screen with today's failure message and Try again.
8. Given Back, when tapped, then she opens `/onboarding/after/long-term`.
9. Given a student with coins already spent, when she opens step 05, then her piles show as she left them, with "Here's where you placed them last time. Move any, or keep them as they are."

Story 2: finishing, the panel and landing (surface: `/onboarding/done`, the panel, `/`, `/onboarding`)

10. Given `/onboarding/done`, when shown, then it reads "Onboarding · done", "You're all set", and "Your answers and your ten coins are saved. You can change any of them later." when her coins are spent, else "Your answers are saved. You can spend your ten coins any time."; the duck floats on the river with "Keep floating."; "Back to Your attention" opens `/onboarding/attention`.
11. Given the panel, then it lists 00 to 05 (no "Three futures"); on steps 00 to 04 its title is "Five short steps" and its lead "Each step says why it asks, and “Not sure” is always a fine answer."; on step 05 and the end screen the title is "The last step" and the lead "Optional. It never changes your routes; it shapes what we show you on them later.", 00 to 04 read Done and 05 is current with "Now · optional"; the band reads "Now: 05 Your attention · optional" and "Then: you're all set" ("Step 5 of 5."), and on steps 01 to 04 "Step <n> of 5." with six segments.
12. Given step 04's last question, then its forward button reads "Next: Your attention" and opens `/onboarding/attention`; its other questions offer "Leave the rest for now: go to Your attention".
13. Given the welcome, then it lists steps 00 to 05 and its copy is the Welcome board's: "About 6 minutes of short questions", "Your answers shape what OfCourse shows you: what you'd study, where you'd live, and what could come after.", and the three points "Five short steps, one question at a time", "Each question says why it asks", "Nothing ranked or recommended" with their lines; the band reads "Not started yet · about 6 min".
14. Given a signed-in student, when she opens `/` or `/onboarding`, then she lands on the welcome until step 00 is answered; on `/onboarding/done` once her coins are stored (spent or later); else where she left off, with step 05 (or the futures, for a student who reached them before this change) resuming at `/onboarding/attention`.
15. Given `/attention`, when opened, then it redirects permanently to `/onboarding/attention`; nothing in onboarding links to `/futures`, and the futures page still opens by its URL.
16. Given PRODUCT.md, then its URL map and resume rules say the above; the unit suite passes.
17. Given step 05 and the end screen at 390, 768, 1440 and 1920, when compared with the Coins and CN boards, then they match in both themes (apart from the light accent colours, which the next branch syncs).

## Edge cases

- Coins stored as later, then she opens step 05: the piles start empty; Done with ten saves them as spent.
- The even spread, then one coin moved: no longer assumed.
- A student who reached the futures before this change and has no coins: she resumes at step 05, not on the futures.
- `seenFutures` stays stored and unused by landing; no migration.

## Constraints

- CLAUDE.md: onboarding shell, container-query layout, type and spacing roles, student URLs as named slugs, `ActionResult`, "test the brain, not the beauty", no `bun run test:db` or `db:reset`, no dev server started by the agent. Stored coins keep their shape (`later` | `spent` with piles and assumed): no migration.

## Out of scope

- The futures' new place in the product.
- The light accent ramp synced to the brand blue.
- End-to-end tests: the specs that walk the old coins page and the old flow are not updated in this slice.

## Open questions

None blocking. Decided by Jenish on 12 Oct: the futures leave onboarding and stay reachable by URL ("it's the result, not the onboarding"); step 05 at `/onboarding/attention`, `/attention` redirected; a finished student lands on `/onboarding/done`; the accent sync is the next branch. The canvas's copy and even spread replace the app's older coin lines and spread.

## Delivery

12 Oct 2026 · branch `feat/onboarding-attention`, pull request to `dev`. Criteria 1–16 covered by unit tests (coins, onboarding, landing, OnboardingPanel, QuestionScreen, AttentionScreen, WelcomeScreen; `bun run test:run` 0 fail); criterion 17 by screenshots at 390, 768, 1440, 1920 in both themes. Code review: Approve with changes, 2 MEDIUM and 4 LOW, all fixed (one narrowed to this branch). Added at the developer's request after the smoke test: a used-up + shows the not-allowed cursor and reads as unavailable, a notice under the tray once all ten are placed, and a tap on a used-up + says why on its card; the tray notice is not on the Coins board yet. QA should re-check by hand: Done and "Spend them later" ending on "You're all set", landing for a finished student and one partway, `/attention` redirecting, and that nothing in onboarding links to `/futures`. Follow-ups: the light accent ramp synced to the brand blue (next branch); a shared note component across four screens; the sign-in lede still promises three futures; the e2e specs for the old coins page and flow are stale.
