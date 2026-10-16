**Smoke test — onboarding step 04, After you graduate** · local dev · `http://localhost:3000`

**Before you start**
- `bun run dev` running; sign in as a student who has reached step 03 (or any student: the step 04 URLs open directly).
- Check light and dark (header menu › Dark theme) at a phone width (390), a tablet (768) and desktop (1440).

**1 · Into step 04 from step 03** — AC 7, 9
```
Go to   /onboarding/living/climate
Do      Next: After you graduate
See     /onboarding/after/stay (her first unanswered step 04 question); kicker "After you graduate · 1 of 4"
```

**2 · Stay: Not sure is a real answer** — AC 2, 3, 4, 5, 6
```
Go to   /onboarding/after/stay
Do      read the note · tap Not sure · tap No
See     cards Yes, Not sure, No (no "?" mark); idle note "“Not sure” is a real answer here. Skip, and I'll use it."; Not sure → "Not sure: PR counts, but no route seals." (no Assumed chip); No → "No: PR stops counting in your futures."; "Saved. Tap another answer to change it."
```

**3 · Focus and earning: Not sure assumes** — AC 4, 5
```
Go to   /onboarding/after/focus, then /onboarding/after/earning
Do      tap Not sure on each
See     "Not sure: I'll assume “Career-focused” …" and "… “Helpful” …", the line with a dashed edge; earning has four cards in two columns
```

**4 · The last question opens the futures** — AC 6, 7
```
Go to   /onboarding/after/long-term
Do      read · tap Settle long-term · Show me three futures
See     "4 of 4"; two cards side by side (one column on a phone); no Not sure; idle note "Optional. Skip, and it's left blank."; no "Leave the rest" link; the button lands on /futures
```

**5 · Back and Leave the rest** — AC 7
```
Go to   /onboarding/after/stay
Do      Back · return · Leave the rest for now: show me three futures
See     Back opens /onboarding/living/climate; the link opens /futures
```

**6 · The panel** — AC 8
```
Go to   /onboarding/after/focus at 1440, then at 768
Do      look at the panel
See     1440: 00–03 Done, 04 current "Now · 2/4"; 768: "Now: 04 After you graduate · 2 of 4" / "Next: Three futures", five segments lit, the current one taller
```

**7 · Coming back** — AC 1, 9
```
Go to   /onboarding/after, then /onboarding, then /onboarding/after/nope
Do      open each
See     /onboarding/after opens her first unanswered question (long-term when all four are answered); /onboarding lands on step 04 for a student who left from it or has seen her futures; /onboarding/after/nope is a 404
```

**No need to click** — AC 1, 2, 3, 7, 8, 9 (the rules: `onboarding.test.ts`, `OnboardingPanel.test.tsx`, `landing.test.ts`) · AC 4, 5, 6, 7 (the screen: `QuestionScreen.test.tsx`) · AC 10 (old page removed, PRODUCT.md, `bun run test:run` 831 pass, 0 fail) · AC 11 (screenshots against the Grad boards at 390, 768, 1440, 1920, light and dark, by the controller: match, after one fix: a two-answer question takes two columns) · under test.

**Worth a glance** — steps 01–03 still look as before (the card grid change only touches questions with exactly two answers, which only long-term has) · the "Not sure: I'll assume …" line shows no arrow icon, while the canvas draws one on every line; that is how steps 01–03 already render, so it was left alone · the e2e specs that walk the old step 04 screen (`e2e/helpers/student.ts` SCREENS) are stale until someone asks for e2e.

**Build report** — each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 1 · step model and panel | opus | 1m 50s | 53,485 | `d6e9d99` |
| 2 · screen, pages, old step 04 removed | opus | 3m 35s | 77,075 | `aa79c25` |
| review · branch-reviewer | opus | 2m 32s | 91,733 | `review.md` |
| fix: the review's 4 findings | sonnet | 0m 45s | 19,583 | `7992a9d`, `ac26c9b` |
| **Total** | | 8m 42s | 241,876 | 4 |
Tokens are the subagents' own; this session's context is not in them. Controller: the board comparison and its fix (`e2a493b`, a two-answer question in two columns). Wall clock, intent to handover: about 13 minutes.

**Result**
9 Oct 2026 · local dev. Not run by the developer: they said "push" after the review fixes without reporting a click-through. Covered instead by the unit suite (criteria 1–10) and the controller's screenshots against the Grad boards at 390, 768, 1440 and 1920 in both themes (criterion 11).
