**Smoke test — onboarding-living** · local · `http://localhost:3000`

**Before you start**
- `bun run dev`; sign in as a student who has passed step 02 (or skip through it).

**1 · One question per screen** — AC 1, 2, 3, 4, 5, 8
```
Go to   /onboarding/living
Do      tap Open to others · Continue · a place · Continue · community "A little" · Continue · "Yes" · Continue
See     /destination → /place → /community → /know-anyone → /who-and-where; kicker "1 of 4" → "of 5" → "of 6"; "Only Australia is covered…" in the calm style; panel 03 "Now · n/N", 00–02 Done
```

**2 · The person, any part blank** — AC 9, 10, 6
```
Go to   /onboarding/living/who-and-where
Do      pick Cousin only · then a city or suburb · type a name · choose "Somewhere else" and type a town · clear every part
See     "Pick a city or suburb, and each route shows its distance from your cousin." → "<Name> in Cannington, Perth: … min · ESTIMATE. Every route…" → "We'll show distances from … in <town> once…"; "Saved. Every change saves as you go."; all cleared: forward reads Skip
```

**3 · Community "No" and climate** — AC 2, 6, 7
```
Go to   /onboarding/living/community
Do      tap "No" · Continue
See     "No: noted; it won't change your futures."; "3 of 4"; Continue opens /climate (no know-anyone); no "Not sure"; "Optional. Skip, and it's left out."; "Next: After you graduate" opens /onboarding/after
```

**4 · Ways in and out** — AC 7, 12, 11
```
Go to   /onboarding/study/length → "Next: Where and how you'd live"
Do      Back on /destination · open /onboarding/after and press Back · open /onboarding · open /onboarding/living/nope
See     Back opens /onboarding/study/length; step 04's Back opens /onboarding/living/climate; /onboarding resumes on step 03; /nope is not found; on /futures a person with no place shows no distance line
```

**No need to click** — AC 3, 4, 5, 10, 11 (onboarding, impact, geo, actions unit tests) · AC 13 (PRODUCT.md; `bun run test:run` 822 pass, 0 fail) · AC 14 (screenshots at 390, 768, 1440, 1920 and dark at 390 and 1440 matched the Live and LV boards; minutes differ on purpose: the engine's, not the canvas's mock).

**Needs a decision**
1. The canvas counts "Do you know anyone…" before community is answered ("1 of 5" on Destination); we count it only once community is answered and not "No" ("1 of 4"), as the existing rule `isVisible('knows')` does. Keep ours, or follow the canvas?
2. The welcome still says "Nothing is ranked or recommended." (carried from step 02).

**Not automated / not run**
- e2e: not run (CLAUDE.md: only when asked). The specs that walk step 03 through the old screen (`e2e/helpers/student.ts` `answerOpening`, `onboarding.e2e.ts`, `student-opening-three-futures`, `dark-mode`) are now stale and will fail until updated.
- Code review: Approve with changes (0 CRITICAL, 0 HIGH, 2 MEDIUM, 5 LOW); all 7 fixed in `dd03d5f`, see `review.md`. Scans: 0 secrets, 0 new code findings; 2 dependency advisories, no dependency changed.

**Worth a glance** — the step 02 save hook was generalised (`useKeyedSave` under `useAnswerSave` and the new `useRelativeSave`) · `AnswerCards` takes a `dense` size for the relationship cards · the living-only parts of `OpeningScreen` and `RelativeForm.tsx` are gone (no route rendered them).

**Build report** — each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 1 · The rules | opus | 14m 29s | 169,457 | `ca6ce7b` |
| 2 · Screen, person form, pages | opus | 8m 20s | 161,174 | `643e158` |
| fix · "Perth CBD, Perth" | opus (this session, inline) | 0m 48s | 4,762 output · 8 turns on a ~218k context | `c7b6ee1` |
| fix · muted "(optional)" | opus (this session, inline) | 0m 13s | 1,780 output · 4 turns on a ~236k context | `e113760` |
| Review · branch-reviewer | opus | 4m 27s | 154,755 | `review.md` |
| Review fixes · 7 valid | sonnet | 2m 53s | 62,492 | `dd03d5f` |
| **Total** | | 31m 10s | 547,878 subagent + 6,542 inline output | 5 (+ docs) |
Subagent tokens are each dispatch's usage report. The inline fixes ran in this session, so they have no usage report of their own: their time and tokens come from this session's log (timestamps and per-turn usage), as output tokens plus the context each turn re-read; that is not the same measure as a subagent's figure, so it is not added to it.
Wall clock, start to handover, from the clock, file times and git log: 13:40 → 14:13, about 33 minutes (canvas, intent and plan 13:40–13:45; task 1 13:45–13:59; task 2 to 14:08; full suite, screenshots and the two fixes to 14:12).

**Changed by the review fixes**

**5 · Forgetting the person** — AC 9, edge case
```
Go to   /onboarding/living/know-anyone (with a person added)
Do      tap "No" · tap "Yes" · Continue
See     "No: noted…"; then "Yes: next, tell me who and where…" (the old person is gone); /who-and-where opens empty
```

**Result** — 9 Oct 2026 · local · Jenish reported the smoke test done ("done with the smoke test"), without naming the steps run or any problem in step 03. Raised while testing, outside this slice: step 01's shared item lines (Timing, Budget, Qualifications) speak for another screen's answer (on "Most years you'd give it", "4 or more" shows "Latest Feb 2028: 7 intakes open"); to fix on its own branch. After the review fixes, Jenish said "push" without reporting step 5 (forgetting the person) as run; it is covered by the `QuestionScreen.test.tsx` tests added in `dd03d5f`.
