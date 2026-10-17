**Smoke test — update topics** · local · `http://localhost:3000`

**Before you start**
- Branch `feat/update-topics` (built overnight in the worktree `C:\Projects\main-overnight`; check it out in your checkout once student-tweaks is committed, or run the app from the worktree)
- `bun run dev`; sign in as a superadmin for the admin steps, and as a student with a finished roadmap for the feed steps
- No migration and no switch: this branch changes no database table

**1 · The Topic choice** — AC 1, 2
```
Go to   /admin/updates
Do      open a new update · look at the Audience fields
See     "Topic" between "Ranked a route at" and "Home country", on "All topics", then the eight fields
Other   choose Data science · save · reopen it: Topic is still Data science
```

**2 · The reach follows the topic** — AC 4, 5
```
Go to   /admin/updates, the same update
Do      set Ranked a route at to All institutions · switch Topic between All topics, Data science and Psychology
See     the status line's reach (mock students) changes with each; the student preview's why reads "Because … is on a route you ranked" or "Because you said you're drawn to …"
Other   add a Home country: the reach only shrinks · set Ranked a route at to ECU with Topic Data science: the preview's why is still the topic line, as on her feed
```

**3 · Older updates are untouched** — AC 3, 6
```
Go to   /admin/updates and /admin/insights
Do      look at an update made before today
See     its Topic reads All topics, and its reach and the insights figure are what they were
```

**4 · A student on a matching road sees it** — AC 7, 9
```
Go to   /admin/updates
Do      approve an update with All institutions · Topic = the field of a student's road (e.g. Cyber security for the Perth road)
See     on that student's /feed: the update, with "Because Cyber security is on your roadmap "<name>""
Other   on the board: an approved "ECU · Data science" update sits on an ECU Data Science course tile, not on an ECU Cyber Security tile; an "ECU · All topics" update sits on both
```

**5 · A student who said she's drawn to it sees it** — AC 8, 9
```
Go to   /admin/updates, then /feed as a student who picked "A few areas I'm drawn to" · Health in onboarding
Do      approve an update with Topic = Health
See     the update on her feed, with "Because you said you're drawn to Health" (or the roadmap line, if her road's course is in Health)
```

**6 · Once, and only for the right students** — AC 10, 11
```
Go to   /feed as a student with two roadmaps that both match; then as a student who matches neither topic nor country
See     the first: the update once · the second: no update
```

**No need to click** — AC 10 (once only, course match first) and AC 11 (no match, no update) · `src/features/updates/lib/feed-updates.test.ts`; AC 2 · `src/features/updates/server/updates.test.ts` (database).

**Worth a glance** — the existing ECU scholarship update still reaches its students · the update form's other fields

**Build report** — each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 1 · topics and the audience rule | opus | 4m 34s | 76,147 | — (blocked: plan gap) |
| 1 · resume with glue (option a) | opus | 4m 32s | 93,584 | `14d25cb` |
| 2 · parsing and storing the topic | opus | 3m 18s | 40,477 | `235d974` |
| 3 · the feed's topic rule | opus | 3m 46s | 48,238 | `18ae55d` |
| 4 · each roadmap's topics | opus | 4m 31s | 57,045 | `ccf5712` |
| 5 · the Topic dropdown | sonnet | 1m 59s | 42,204 | `037ae66` |
| **Total** | | 22m 40s | 357,695 | 5 |
Tokens are the subagents' own; this session's context is not in them.

**Verification (overnight, 16–17 Oct 2026)** — `bun run type-check` clean · `bun run lint` clean (870 files) · database test 7 pass 0 fail · full suite `BETTER_AUTH_URL=http://localhost:3000 bun run test:run` 3721 pass, 533 skip, 0 fail.

**Carried concerns**
- Plan gap fixed in task 1: a required `topic` broke files of later tasks, and the mock updates' audience was not covered; task 1 added the minimal glue.
- Review fixes (17 Oct, `e3ae9d2`): board tiles now respect the topic; the preview why matches the feed; see review.md "Applied".

## Result

17 Oct 2026, local, branch `test/finder-intersections-all` (all four branches combined). Nikhil reported the smoke test passed. Which steps were run by hand was not itemised; every criterion is also covered by the tests named in "No need to click" and the criteria tables, and by the branch reviews.
