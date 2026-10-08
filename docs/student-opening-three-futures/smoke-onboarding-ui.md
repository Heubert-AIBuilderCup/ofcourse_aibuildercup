**Smoke test — onboarding steps 00–01 (UI pass)** · local · `http://localhost:3000`

**Before you start**
- `bun run dev` running; a fresh student (a new Google account or email code), or reset yours (persona null, last_step 'picture').
- Test at 390, 768, 1440 and 1920 wide (devtools responsive).

**1 · Step 00 on the shared shell** — AC 14, 22
```
Go to   /
Do      sign in · pick Female · Start
See     "Saving…", then step 01 on its first question; the panel stays put, 00 now "Done", 01 "Now · 1/11"
```

**2 · One question per screen** — AC 23, 25
```
Go to   /onboarding/facts
Do      tap Nepal · Continue · tap AUD 36k · Continue … through the eleven
See     kicker "Facts about you · N of 11", the question as the heading, a why line, cards with "Not sure" last; the impact line at once; the note "Saving…" then "Saved. Tap another answer to change it."
```

**3 · The lines that differ** — AC 24, 26, 27, 3
```
Go to   /onboarding/facts/where, then /amount, then /coming, then /latest
Do      Australia (on a visa) · Not sure on Amount · Partner · Jul 2027
See     onshore line (not Nepal's) · "Not sure: I'll assume “AUD 30k” …" with a dashed edge · the grey family line · a line with the "mock" tag
```

**4 · Keyboard** — developer ask
```
Go to   /onboarding/facts/covers
Do      Tab to the cards · arrows · Home · End
See     arrows move and pick, Home picks the first, End picks "Not sure"; each pick saves
```

**5 · Save fails** — developer ask
```
Go to   /onboarding/facts/limit
Do      devtools Network → Offline · tap Hard limit · back online · Try again
See     "We couldn't save that. Your answer is still here…" with Try again; the card stays picked; Try again saves
```

**6 · Back and leave** — AC 30
```
Go to   /onboarding/facts/where
Do      Back · Start · "Leave the rest for now: go to What you'd study" · Back on step 02
See     step 00 with Female pressed · step 02 opens · Back lands on "English test" with answers kept
```

**7 · Sign out and come back** — AC 60
```
Go to   /onboarding/facts (partly answered)
Do      Sign out · sign in again
See     the login page, then step 01 at her first unanswered question with every answer kept
```

**8 · Wide screens** — developer ask
```
Go to   /onboarding/facts at 1440, 1920, 2560
Do      compare
See     1920 is the 1440 design larger, not wider; 2560 centres the 1920 frame
```

**No need to click** — AC 2 (OnboardingPanel.test.tsx, onboarding.test.ts) · AC 22 seven-step panel (OnboardingPanel.test.tsx) · signed-out refusal (e2e/onboarding.e2e.ts) · under test.

**Needs a decision**
1. Above 1920: the panel's colour runs to the screen edge through padding (`split-panel`), or the page is boxed at 1920 as the canvas now draws it.
2. Criterion 22 says six progress dots; the onboarding panel shows seven steps (00–06), as the design does. Screens 2–4 keep six dots until redesigned.
3. "Step 1 of 6" is read out only on tablet and phone (the hidden text sits in the band); on desktop the step list's current item says where she is.
4. On the last question the Next button is solid even unanswered; the canvas keeps it outlined until she answers.

**Worth a glance** — step 02–04 screens (old look) after leaving step 01 · the futures' chips after "Not sure" answers · dark mode (Industry ships light only).

**Build report** — each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 1 · Commit the approved work | haiku | 0m 36s | 18,270 | `5cef5f1`, `f6f302c` |
| 2 · The onboarding model | sonnet | 0m 44s | 27,323 | `c3be14b` |
| 3 · The impact view | sonnet | 0m 36s | 37,090 | `6c43c2a` |
| 4 · Save and retry, per question | sonnet | 0m 46s | 23,034 | `d41ccec` |
| 5 · The onboarding shell and panel | opus | 4m 47s | 94,624 | `a19bb1e` |
| 6 · Answer cards, a radiogroup | sonnet | 1m 28s | 42,371 | `aa27c6b` |
| 7 · Step 01, one question per screen | opus | 3m 34s | 88,128 | `7a68d1e` |
| 8 · End-to-end on the new step 01 | opus | 5m 41s | 81,981 | `89b0fa4` |
| 8 · fix: restore step 02 resume case | opus | 1m 37s | 87,401 | `c57718d` |
| 9 · Visual check against the canvas | opus | 7m 52s | 141,164 | `38ead9a` |
| Review · branch-reviewer | opus | 6m 47s | 199,181 | — |
| Review fixes · all valid | opus | 8m 46s | 130,323 | `98b1471` |
| QA · test-writer | opus | 9m 58s | 108,456 | `0ff6379` |
| QA · fix: AC4 reduced-motion timing | opus | 2m 12s | 113,957 | `0ff6379` |
| QA · fix: both slow-loader tests | opus | 3m 48s | 118,382 | `0ff6379` |
| Smoke fix · Start opens question 1 | sonnet | 4m 34s | 37,222 | `7bfbea2` |
| Fix · criterion 25 in-between impact lines | sonnet | 4m 59s | 44,202 | `d00b7ca` |
| Smoke fix · panel cut off in short windows | sonnet | 11m 39s | 27,330 | `65d43fc` |
| URLs · /onboarding scheme, redirects, e2e | opus | 15m 27s | 129,191 | `89e6231`, `8d7c329`, `5785818` |
| Review · post-review commits | opus | 4m 25s | 138,884 | — |
| Review fixes · /onboarding URLs, all five | opus | 7m 40s | 80,631 | `0323b0b` |
| **Total** | | 1h 47m 36s | 1,769,145 | 21 |
Tokens are the subagents' own; this session's context is not in them.

## Changed by the review fixes
- Step 1: on a slow server the duck ("Keep floating.") shows in the main column while the panel stays put.
- Panel type on the roles: the lead at body size on phones (was 14px), step rows at caption size (13px, was 14).

## Result
Not run by the developer: one-shot run; QA's end-to-end tests stand in.
