**Smoke test — what changes, PR 3** · local · `http://localhost:3000`

**Before you start**
- Branch `feat/course-compare` (stacked on `feat/course-detail` and `feat/course-finder`); the local database steps of `smoke.md` first, then `bun run finder:seed`
- `FINDER_ON=1 COURSE_DETAIL_ON=1 COMPARE_ON=1` for steps 2–5; `COMPARE_ON` unset for step 1

**1 · Switch off, tiles as before** — AC 25
```
Go to   /roadmaps/<id> with COMPARE_ON unset
Do      open the other-city tile and the other-course tile
See     the cards as before: no "What changes"
```

**2 · What changes, from the board** — AC 26, 28
```
Go to   /roadmaps/<id> with COMPARE_ON=1
Do      open the other-course tile, then the other-city tile
See     "What changes" in stacked rows: Money, Time and work rights, Staying or home, Career, Subjects, City · "Now:" and "If you switch:" · changed rows tagged · the Career row gives each job its sample pay and openings ("ICT Security Specialist · AUD 103–141k · 310 openings in Perth (sample)") · the rows end on "Source: OfCourse preview data · mock"
Other   the "Staying or home" row's route matches the PR route that road shows when you open it
```

**3 · What changes, from the finder** — AC 27
```
Go to   Find courses on the board
Do      search "I like understanding why people do things, and I'm good with computers" · press "Compare with my roadmap" on Cyberpsychology
See     the same rows against your road · "Back to results" brings the results back
```

**4 · Start a new roadmap from it** — AC 29
```
Do      in step 3's comparison, press "Start a new roadmap from it" · Create roadmap
See     a new roadmap whose board is built around Cyberpsychology in its city (its English badge reads "IELTS 6.5 overall (sample)") · your first roadmap unchanged in the list
```

**5 · The pin stays put** — AC 30
```
Go to   the new roadmap
Do      change an answer in Your answers and save · move a tile choice on the board
See     the board still centres on the pinned course · the why on its city and course tiles says you chose it ("you chose this course in <city> from Find courses"), never the rules of the road your answers matched
Other   another student's (or your other roadmap's) road is unchanged: finder courses never appear as matched roads
```

**No need to click** — AC 28 (`finder/model/compare.test.ts`) · AC 30 (`finder/model/road-courses.test.ts`, `roads/model/road-for.test.ts`) · the refusals, a new pin refused with `COMPARE_ON` unset included (`finder/actions.test.ts`, `roadmaps/actions.test.ts`, `finder/model/compare.test.ts`) · the Find panel's compare flow, focus and status region (`finder/components/FinderPanel.test.tsx`).

**Decided** (review fixes)
1. A copy made from a pinned roadmap without `?pin=` keeps the source's pin while its course is still in the catalogue, switch on or off; a stale pin drafts unpinned.
2. On a pinned roadmap the why of its city and course tiles says she chose the course, and never names the rules of the road her answers matched.

**Fixed** — `src/features/roadmaps/server/roadmaps.test.ts` hung at its first test: Bun's `expect(…).rejects` waited on the pending insert without letting the socket answer. The test now awaits the refusal itself; the file runs in `test:db`.

**Build report**
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 17 · road-course lookups | opus | 4m 36s + 1m 48s | 81,169 + 85,212 | `8ba97bd` |
| 17 · three road decisions | opus | 6m 25s | 67,482 | `4305de4` |
| 18 · comparison rows | opus | 7m 43s | 80,054 | `01745f1` |
| 19 · what changes UI | opus | 10m 38s | 141,434 | `d3a6043` |
| 20 · pinned roadmaps | opus | 26m 24s | 190,900 | `ff8d144` |
| **Total** | | about 57m | 646,251 | 5 |

**Verification** — type-check clean · lint clean · finder database tests 31 pass 0 fail · full suite 4081 pass, 556 skip, 0 fail · `bun run build` compiles.

**After the review fixes** — type-check clean · lint clean · finder database tests 31 pass 0 fail · roadmaps database tests 29 pass 0 fail · full suite 4100 pass, 556 skip, 0 fail · build not re-run.

## Result

17 Oct 2026, local, branch `test/finder-intersections-all` (all four branches combined). Nikhil reported the smoke test passed. Which steps were run by hand was not itemised; every criterion is also covered by the tests named in "No need to click" and the criteria tables, and by the branch reviews.
