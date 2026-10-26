**Smoke test — course detail, PR 2** · local · `http://localhost:3000`

**Before you start**
- Branch `feat/course-detail` (stacked on `feat/course-finder`); the local database steps of `smoke.md` first
- `COURSE_DETAIL_ON=1` in your environment for steps 2–4; unset for step 1. `FINDER_ON=1` for step 4

**1 · Switch off, cards unchanged** — AC 22
```
Go to   /roadmaps/<id> with COURSE_DETAIL_ON unset
Do      open the course tile and the 485 tile
See     the card exactly as before: no "Fields close to this one", no "Job market (sample data)"
```

**2 · Fields near and jobs on every course card** — AC 23
```
Go to   /roadmaps/<id> with COURSE_DETAIL_ON=1, on an Adelaide IT road (its stack's course is in Hobart)
Do      open the course tile, then the other-course tile, then the stack's course tile
See     on each, "Fields close to this one" with names and definitions for that card's own course · the occupations that course leads to · "Job market (sample data)" naming that course's own city (Adelaide, Adelaide, Hobart)
```

**3 · Job market, sample** — AC 24
```
Go to   the same card
See     "Job market (sample data)": "N openings · AUD X–Yk starting · <city>" per occupation that has a sample row · no employer or provider named
Other   a Perth road and a Sydney road show different openings for the same occupation
```

**4 · The same detail on a found course's card** — AC 22–24
```
Go to   /roadmaps/<id> with COURSE_DETAIL_ON=1 and FINDER_ON=1
Do      open Find · Search · on a found card open "Jobs and fields close to this one"
See     "Job market (sample data)" with the card's own city in each line · "Fields close to this one" with definitions · no employer or provider named
Other   with COURSE_DETAIL_ON unset, the found cards have no "Jobs and fields close to this one"
```

**No need to click** — AC 22 (`roads/model/details.test.ts` "exactly as it was with the detail off") · AC 23 on every course tile (`roads/model/details.test.ts` "the alternative and the stack") · a found card with and without detail (`finder/components/FinderPanel.test.tsx`) · the switch in the search (`finder/server/search.db.test.ts`, with the database) · AC 24 data rules (`roads/data/job-market.test.ts`).

**Needs a decision** — Nikhil
1. The Diploma-level occupations in the sample job market were chosen by the implementer (ICT Support Technician 313212, Community Worker 411611, Program or Project Administrator 511112). Adjust if you meant others.

**Build report**
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 15 · job-market sample data | sonnet | 2m 08s | 35,839 | `8a69cb4` |
| 16 · course detail on cards | opus | 5m 40s | 76,731 | `210a772` |
| **Total** | | 7m 48s | 112,570 | 2 |

**Verification (overnight)** — type-check clean · lint one warning (the catalogue's size, from PR 1) · finder database tests 19 pass 0 fail · full suite 3810 pass, 546 skip, 0 fail.

## Result

17 Oct 2026, local, branch `test/finder-intersections-all` (all four branches combined). Nikhil reported the smoke test passed. Which steps were run by hand was not itemised; every criterion is also covered by the tests named in "No need to click" and the criteria tables, and by the branch reviews.
