**Smoke test — onboarding welcome** · local · `http://localhost:3000`

**Before you start**
- `bun run dev` running on `feat/onboarding-welcome`; a fresh student (new email code or Google account), or reset yours (persona null).
- Test at 390, 768, 1440 and 1920 wide, light and dark.

**1 · A new student lands on the welcome** — AC 1, 3, 4, 5
```
Go to   /
Do      read it
See     /onboarding/welcome: "Welcome, <first name>.", "About 10 minutes, then three futures", the lede, three points with icons, the "First · optional" note, one Start button; no Back, no Skip
```

**2 · Start opens step 00** — AC 5
```
Go to   the welcome
Do      press Start
See     /onboarding/character, the panel marking step 00 "Now · optional"
```

**3 · Never again once step 00 is answered** — AC 2
```
Go to   step 00 · Skip · then open / and /onboarding/welcome by hand
See     both land on your first unanswered step 01 question, not the welcome
```

**4 · The panel before anything** — AC 6
```
Go to   the welcome at 1440, then at 768 and 390
See     1440: "Before we start" with "Here's the whole way through…", steps 00–06 listed, none current, 00 tagged "Optional"; 768/390: seven unlit segments, "Not started yet · about 10 min", "First: Your comic character"
```

**5 · Menu and dark** — AC 7
```
Go to   the welcome in dark (device dark, or the menu's Dark theme)
See     the menu button top-right (in the band on 768/390); the steel panel unchanged; the note's tint dark; nothing light-themed left
```

**6 · No name** — AC 3
```
Go to   /  signed in with an email code (no name on the account)
See     "Welcome." alone
```

**7 · Keyboard** — AC 9
```
Go to   the welcome
Do      no click; press Tab, then Shift+Tab
See     focus starts on the heading; Tab reaches Start; Shift+Tab goes back through the menu button
```

**No need to click** — AC 1, 2 (landing.test.ts, e2e/onboarding-welcome.e2e.ts) · AC 3–5 (WelcomeScreen.test.tsx) · AC 6 (OnboardingPanel.test.tsx) · AC 10 (PRODUCT.md, CLAUDE.md) · under test.

**Needs a decision**
1. "About 10 minutes" is the canvas's placeholder until steps 04–06 are designed and timed.
2. The welcome shows every time she lands with step 00 unanswered (it isn't remembered); opening step 00 by its URL still works.

**Worth a glance** — on phones the point text is 15px against the canvas's 14 and headings 18 against 17 (type roles, never a size per breakpoint) · the point text wraps at `max-w-prose` (~520px) against the canvas's 52ch · the 8 widths beyond the boards (360, 1024, 1280, 1366, 1536, 2560) looked right in the shots.

**Build report** — each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 1 · The model and the landing | sonnet | 0m 55s | 33,538 | `7a4544d` |
| 2 · Panel welcome state, the screen and its route | opus | 3m 02s | 71,841 | `d87f52b` |
| 3 · End to end, flows through Start | opus | 11m 13s | 79,740 | `4551f50` |
| 4 · Against the boards | opus | 3m 07s | 86,345 | — |
| Review · branch-reviewer | opus | 3m 05s | 105,512 | — |
| Review fixes · all 4 valid | sonnet | 0m 44s | 29,957 | `c300f99` |
| QA · run-only (the full serial suite; person checks recorded) | controller | — | not reported | — |
| **Total** | | 22m 06s | 406,933 | 4 |
Tokens are the subagents' own; this session's context is not in them.

## Result
Not run by the developer: one-shot run; QA's end-to-end tests stand in.
