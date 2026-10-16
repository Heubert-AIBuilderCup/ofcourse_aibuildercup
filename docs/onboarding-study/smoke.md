**Smoke test — onboarding-study** · local · `http://localhost:3000`

**Before you start**
- `bun run dev`; sign in as a student who has passed step 00 (or skip it).

**1 · One question per screen** — AC 1, 2, 3, 4, 13
```
Go to   /onboarding/study
Do      tap "Something particular" · Continue · tap a field · Continue to the end
See     URL /onboarding/study/know → /field → /level → /learning → /length; kicker "1 of 4" turns "1 of 5"; panel "Now · n/N", 00 and 01 Done
```

**2 · The areas** — AC 7, 8, 9
```
Go to   /onboarding/study/know
Do      tap "A few areas I'm drawn to" · Continue · tap three areas · tap a fourth · remove all three
See     "3 of 3 chosen"; "Three is the most for now…"; Health/Engineering/Design say "Nearest field used for now"; after removing all: "0 of 3 chosen", Skip
```

**3 · Ways in and out** — AC 11, 12, 16, 17
```
Go to   /onboarding/facts/english → Next: What you'd study
Do      Back on /know · Leave the rest link · Back on /onboarding/living · open /onboarding
See     /know ← → /facts/english; Leave opens /onboarding/living; its Back opens /onboarding/study/length; /onboarding resumes on step 02
```

**No need to click** — AC 5, 6, 10, 14 (QuestionScreen, AreaChecks, onboarding, impact unit tests) · AC 15 (screenshots at 390, 768, 1440, 1920, light and dark, matched the boards) · AC 18 (PRODUCT.md, CLAUDE.md).

**Needs a decision**
1. The welcome says "Nothing is ranked or recommended." DS-R1 forbids "recommended" on any screen; the panel keeps "Nothing is ranked" for that reason. Change the welcome, or read DS-R1 as "never recommends"?

**Not automated / not run**
- e2e: green at `e4f0106`; the two spec edits in `048e349` were not run (stopped by the developer). Full e2e suite not run.
- Code review: Approve with changes (0 CRITICAL, 0 HIGH, 3 MEDIUM, 6 LOW), 7 fixed, 3 left with reasons in `review.md`. Scans: 0 secrets, 0 new code findings; 2 dependency advisories, no dependency changed.

**Worth a glance** — the (shell) layout now reads her answers (async). Under parallel load on the dev server, a first visit's theme-cookie refresh can leave the server's copy of the shell hidden in the DOM (`div#S:0`, invisible, outside the accessibility tree). Follow-up: set the `theme-os` cookie on the client so the first visit doesn't refresh.

**Build report** — each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 1 · Model | sonnet | 2m 11s | 54,981 | `506e096` |
| 2 · Clearing an answer | sonnet | 1m 47s | 49,348 | `c32d1d9` |
| 3 · Shell answers, panel | sonnet | 1m 54s | 54,764 | `107e375` |
| 4 · AreaChecks | opus | 5m 43s | 103,407 | `c086a62` |
| 5 · QuestionScreen, pages | opus | 6m 29s | 145,871 | `6977503` |
| 6 · e2e, PRODUCT.md | opus | 19m 35s | 188,950 | `e4f0106` |
| fix · question not asked | sonnet | 0m 55s | 31,687 | `048e349` |
| Review · branch-reviewer | opus | 8m 44s | 209,492 | — |
| Review fixes · 7 valid | sonnet | 4m 18s | 91,428 | `52cc745` |
| **Total** | | 51m 26s | 929,928 | 8 (+ docs) |
Tokens are the subagents' own; this session's context is not in them.
Wall clock, from the git log and file times: about 1h 30m (canvas read 10:00, intent 10:26, first commit 10:31, last 11:30). The 38 minutes above are only the subagents' own run time. They leave out the controller's work: reading the canvas, the intent and plan (~30m), the screenshot comparison (~5m), and chasing a flaky e2e test (~15m).

**Result** — Not run by the developer: one-shot run; they click through it at the handover.
