**Smoke test — dark mode** · local · `http://localhost:3000`

**Before you start**
- `bun run dev` running on `feat/dark-mode`; a student account (or `newStudent` via the dev login).
- Your OS or browser set to dark for the first steps (devtools → Rendering → emulate prefers-color-scheme works too).
- Test at 390 and 1440 wide.

**1 · Follows the device** — AC 7, 6
```
Go to   /  (no theme cookie: clear site data first)
Do      flip the device scheme light ↔ dark while the page is open
See     the page follows at once; the steel hero stays the same dark steel in both; in dark a hairline separates hero and form
```

**2 · The toggle on sign-in** — AC 4, 5
```
Go to   /  then /admin/sign-in
Do      press the moon top-right ("Switch to dark theme") · reload · press the sun
See     dark at once, still dark after reload with no light flash; back to light; the toggle sits on the logo's line (in the steel band below 1024, light on steel)
```

**3 · Dark tokens on the login** — AC 1, 2, 10
```
Go to   /  in dark
Do      request a code with any address · enter a wrong code
See     the card, inputs, the code step and the error block all in the dark set: no light boxes; the error block is the dark danger tint with light red text
```

**4 · Onboarding menu** — AC 4, 11
```
Go to   /onboarding/character  (signed in)
Do      press the person icon top-right ("Menu: theme and sign out") · toggle "Dark theme" · press Escape · open again · Sign out
See     a menu with Dark theme (a switch that moves) and Sign out; the theme flips at once; Escape closes and focus returns to the button; Sign out lands on /
```

**5 · Step 00 and 01 in dark** — AC 2, 3, 10
```
Go to   /onboarding/character, then /onboarding/facts/amount, …/dep, …/hard  in dark
Do      choose Female · tap Not sure · tap Partner · go offline and tap Hard limit
See     the chosen card is a dark blue tint with light text (never a light box); the panel is the same steel with a hairline against the page; impact lines, chips, the mock tag and the save-failed alert all read; step 01 has no separate Sign out button
```

**6 · Phone band** — AC 4
```
Go to   /onboarding/facts/where at 390 in either theme
See     the menu button sits in the steel band on the logo's row, light on steel; the duck is gone from the band (the canvas drops it for the menu)
```

**7 · The older screens** — AC 10
```
Go to   /onboarding/study, /onboarding/living, /onboarding/after, /futures, /attention, /admin/users  in dark
See     the title band stays steel; futures cards, the "might feel" tags, the coins piles and the users table use the dark tokens; no light surfaces
```

**8 · Wide and keyboard** — AC 4, 11
```
Go to   /onboarding/character at 2560 wide; then at 1440 with the keyboard only
See     the menu button sits inside the centred 1920 frame, not at the screen edge; Tab reaches it, Enter opens, arrows move between items, Space toggles Dark theme, Escape closes
```

**No need to click** — AC 1, 8, 9, 12 (theme.test.ts: every ramp, contrast ≥ 4.5 text / ≥ 3 large, `color-scheme`; DESIGN.md) · AC 5, 6, 7 (Providers.test.tsx, e2e/dark-mode.e2e.ts) · under test.

**Needs a decision**
1. Decided in the run: hairlines keep Industry's 16% divider (1.4:1 light, 1.5:1 dark); criterion 8 was amended to say so. Say if you want a stronger divider instead.
2. Above 1920 the header action now sits inside the centred frame (as the content does); the canvas only draws to 1920.
3. Decided in the run (your smoke finding): icons keep their px size at every width (`size-icon-sm` 14, `size-icon` 16, `size-icon-lg` 20), the second px exception after hairlines, recorded in CLAUDE.md and DESIGN.md.

**Not automated** — the light pixel regression check: the previous light shots were gone from disk, so the light screens were looked at, not diffed. In code the light set only gained `color-scheme: light` and the `[data-theme="light"]` selector.

**Worth a glance** — the admin users list at 390 clips the email column (layout, not theme) · on `/onboarding/facts/hard` after a "Not sure" amount the line speaks of the amount (behaviour, not theme) · the splash stays brand blue in both themes by design.

**Build report** — each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 1 · Industry's dark tokens | opus | 2m 14s | 48,547 | `aa861f6` |
| 2 · The theme choice, settable | sonnet | 0m 45s | 22,986 | `e4b6950` |
| 3 · Header action: toggle and onboarding menu | opus | 6m 15s | 89,400 | `daa44b7` |
| 4 · Light panels, dark hairline, action inside the frame | opus | 2m 28s | 56,843 | `d07b9f4` |
| 5 · Dark mode end to end | opus | 5m 20s | 52,363 | `d1950ac` |
| 6 · Every screen in dark, against the boards | opus | 8m 07s | 136,471 | `caba0b4` |
| Review · branch-reviewer | opus | 4m 47s | 142,419 | — |
| Review fixes · all 7 valid (CRITICAL settled in the intent) | opus | 7m 19s | 64,869 | `7ca606a` |
| QA · test-writer | opus | 17m 12s | 129,242 | `53aaade` |
| Smoke fix · icons keep their px size at every width | sonnet | 5m 42s | 43,287 | `bec4fd3` |
| Smoke fix · icon beside text centred on the first line | controller, inline | — | not reported | `39b5ed0` |
| **Total** | | 1h 00m 09s | 786,427 | 10 |
Tokens are the subagents' own; this session's context is not in them.

## Result
Not run by the developer: one-shot run; QA's end-to-end tests stand in.
