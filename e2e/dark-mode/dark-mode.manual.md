# Person checks: dark mode

The smoke test's steps (docs/dark-mode/smoke.md) were not run by hand (its Result: one-shot run), so they come first. Each line: the criterion, then exactly what to look at. Everything else is asserted in dark-mode.e2e.ts beside this file.

## From the smoke test, not run by hand

- [ ] AC5 (smoke 2): on `/` in dark, reload a few times: no light frame flashes before the dark page (the test reads the served HTML, not the paint).
- [ ] AC4 (smoke 2): on `/` and `/admin/sign-in` below 1024 wide (768 and 390), the toggle sits in the steel band on the logo's row, light on steel (the test checks this placement on onboarding only).
- [ ] AC10 (smoke 3): on `/` in dark, after a wrong code, the error block is the dark danger tint with light red text; the code step's inputs have no light fill.
- [ ] AC4 (smoke 4): in the onboarding menu, the Dark theme switch shows on and off by its knob's position, not by colour alone.
- [ ] AC10 (smoke 5): in dark, on `/onboarding/facts/amount` with Not sure, the dashed assumed line and its chips read; on `/onboarding/facts/latest` with Jul 2027 the dashed "mock" tag reads; with devtools Network set to Offline, tapping Hard limit on `/onboarding/facts/limit` shows the save-failed alert in the dark set.
- [ ] AC4 (smoke 6): on `/onboarding/facts/where` at 390, the steel band shows no duck, and the menu button sits on the logo's row.
- [ ] AC10 (smoke 7): in dark, on `/onboarding/study`, `/living`, `/after`, `/attention`, `/admin/users`: the title band stays steel; the coin piles and the users table use the dark set. The coin piles are drawn in the light accent (`accent-700`); say if they read as light boxes (no test visits step 05).
- [ ] AC4 (smoke 8): at 2560 wide on `/onboarding/character`, the menu button sits inside the centred 1920 frame.

## What no test can judge

- [ ] AC10: the onboarding and sign-in screens in dark match their boards at 390 and 1440: DKLogin / DKLoginPhone, DKPictureQ / DKPQPhone, DKFacts / DKFactsFail / DKFactsPhone, DKStudy / DKStudyPhone.
- [ ] AC10: a toast in dark (e.g. a role change in `/admin/users`) is dark, not a light box; no test raises one.
- [ ] AC9: a native select's open dropdown, the scrollbars and the focus rings are dark in dark. No native select was found on the screens the tests visit; if one appears on a later screen, open it in dark.
- [ ] AC8 (worth a glance, outside the criterion's scope): the step numbers in the steel panel's list ("00" to "05") measure 4.31:1 on the steel, in both themes since the panel is the same.
- [ ] AC3: in dark, the hairline between the steel and the page is visible but quiet (Industry's 16% divider), side by side and stacked.
- [ ] AC12: DESIGN.md's dark-theme passage reads correctly (the test checks only that the old "light only" line is gone and that `data-theme` is named).
- [ ] Check the dark screens at 360, 768, 1024, 1280, 1366, 1536 and 1920 wide (the tests visit 390 and 1440, and 768 for the stacked panel).

## Stable ids to add

- Sign-in pages, onboarding panel and admin bar, the logo: found by its text (`OfCourse`, or `OfCourse Admin`) to check the header action sits on its line. Suggest `data-testid="logo"`.
