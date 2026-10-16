**Smoke test — onboarding step 05, Your attention** · local dev · `http://localhost:3000`

**Before you start**
- `bun run dev` running; a student with steps 00–04 done (or any student: step 05 opens directly).
- Check light and dark at 390, 768 and 1440.

**1 · Into step 05 from step 04** — AC 12
```
Go to   /onboarding/after/long-term, then /onboarding/after/stay
Do      read the buttons
See     long-term: "Next: Your attention" opens /onboarding/attention; stay: "Leave the rest for now: go to Your attention"; the band reads "Next: Your attention · optional"
```

**2 · Placing coins** — AC 1, 2, 3
```
Go to   /onboarding/attention
Do      + on Closeness to family three times · − once
See     kicker "Your attention · optional", intro and hint; the tray fills and reads "3 of 10 placed"; the pile's line "Closeness to family at 3: we'll show trip times home on each route.", then "… at 2: trip costs home show on each route."
```

**3 · Refusals** — AC 4
```
Go to   /onboarding/attention
Do      + on one pile six times · then fill to ten and + on another pile
See     "Five is the most on one pile. Take one from here, or place it on another pile."; then "All ten are placed. Take one from another pile first."; + reads capped
```

**4 · Not sure** — AC 5
```
Go to   /onboarding/attention
Do      Not sure · then move one coin
See     Health 2, Financial life 2, the rest 1, "10 of 10 placed", "Assumed: an even spread. You can change it any time."; moving a coin clears it
```

**5 · Done and "Spend them later"** — AC 6, 7, 10
```
Go to   /onboarding/attention
Do      with fewer than ten, try Done · place ten · Done · Back to Your attention · Spend them later
See     Done unavailable with "Place all ten to finish · n left."; at ten it is the strong button with "All ten placed. Done finishes onboarding."; Done → /onboarding/done "You're all set" (coins saved text), the duck on the river, "Keep floating."; later → "Your answers are saved. You can spend your ten coins any time."
```

**6 · Back and returning** — AC 8, 9
```
Go to   /onboarding/attention with coins spent
Do      read · Back
See     her piles as she left them and "Here's where you placed them last time. Move any, or keep them as they are."; Back opens /onboarding/after/long-term
```

**7 · The panel and the welcome** — AC 11, 13
```
Go to   /onboarding/welcome (a new student), /onboarding/facts, /onboarding/attention
Do      read the panel and the welcome
See     steps 00–05, no "Three futures"; welcome "About 6 minutes of short questions" and its three points; "Five short steps" on 00–04 with "Step n of 5."; "The last step" on 05 with "Now · optional", "Then: you're all set", six segments
```

**8 · Landing and the old paths** — AC 14, 15
```
Go to   /, /onboarding, /attention, /futures
Do      open each as a student who has finished, then as one partway through step 05
See     finished: / and /onboarding land on /onboarding/done; partway: on /onboarding/attention; /attention redirects to /onboarding/attention; /futures still opens, and nothing in onboarding links to it
```

**Changed after the smoke test** — the developer's request, 12 Oct
```
Go to   /onboarding/attention
Do      place ten · hover any + · tap a + · take one off
See     every + shows the not-allowed cursor (as do an empty − and an unavailable Done); under the tray "All ten placed. To move one, take it from a pile first, or press Done to finish."; a tapped + says "All ten are placed. Take one from another pile first." on its own card; taking one off removes both. A sixth coin on one pile still says why on that pile's card
```
This notice is not on the Coins board yet: add it there so the design stays the source.

**No need to click** — AC 3, 4, 5, 6 (`coins.test.ts`) · AC 2–9 (`AttentionScreen.test.tsx`) · AC 11, 12 (`onboarding.test.ts`, `OnboardingPanel.test.tsx`, `QuestionScreen.test.tsx`) · AC 13 (`WelcomeScreen.test.tsx`) · AC 14 (`landing.test.ts`) · AC 16 (PRODUCT.md; `bun run test:run` 833 pass, 0 fail) · AC 17 (screenshots against the Coins boards at 390, 768, 1440, 1920, light and dark, by the controller: match, apart from the light accent colour) · under test.

**Worth a glance** — the coins, ticks and selected piles are steel in light mode while the canvas draws them blue: the accent sync is the next branch · the sign-in page's lede still promises three futures · the futures page still links to `/attention` (now a redirect) and to step 04 · `DoneScreen`'s spent-or-later wording has no unit test (copy picked by one flag) · the e2e specs that walk the old coins page and the old flow are stale.

**Build report** — each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 1 · six steps, coin rules, panel, landing | opus | 4m 07s | 85,037 | `0a46281` |
| 2 · attention and done screens, welcome, redirect | opus | 5m 25s | 137,488 | `0615dde` |
| review · branch-reviewer | opus | 3m 41s | 142,830 | `review.md` |
| fix: the review's 6 findings | opus | 1m 57s | 44,101 | `2f55489`, `58a7062` |
| **Total** | | 15m 10s | 409,456 | 4 |
Tokens are the subagents' own; this session's context is not in them. Controller: `c51e526`, the assumed-spread message announced like the pile lines (the review fix's own concern). Task 2's commit was blocked by a stale dev-server type cache (`.next/dev/types`, generated); the controller removed the two stale files and committed. Wall clock, branch to handover: about 36 minutes, including your answers on the futures, the URL and landing, and the wait for the dev server.

**Result**
12 Oct 2026 · local dev. The developer ran the smoke test and reported it done ("smoke test done"), with no issues reported. After it, the developer asked for the used-up + to look and say unavailable; that change (`05bd227`, `d1a88f7`) was clicked through by the developer ("nice").
