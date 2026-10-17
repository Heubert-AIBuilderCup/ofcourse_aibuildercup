**Smoke test — course finder, PR 1** · local · `http://localhost:3000`

**Before you start**
- Branch `feat/course-finder` (built overnight from `origin/main` in `C:\Projects\main-overnight`). Task 13, the Find panel on the board, is not built yet; it waits for student-tweaks to be committed, then the branch is rebased onto it and task 13 is done. Until then there is nothing to click; the steps below check the parts underneath.
- Local database: this branch moves Docker to `pgvector/pgvector:pg17` on a new volume `pg-data-vector`. On first `bun run dev` here the database starts empty and migrated; then `bun run db:restore` loads last night's dump (`db-dumps/2026-10-16_23-15-41.sql`). Your old `pg-data` volume is untouched.
- `GOOGLE_CLOUD_PROJECT=applyims GOOGLE_CLOUD_LOCATION=global` and a gcloud application-default login for the live commands.

**1 · The catalogue** — AC 16, 17, 18
```
Go to   src/features/finder/data/catalogue.ts (479 courses), data/raw/*.json (529 generated), data/GENERATE.md
Do      open a few courses at random · read their description, fee, lines.work and lines.pr
See     plain descriptions, sample labels on every claim, work rights and PR route in the road's own words
```

**2 · Seed your database** — AC 3, 19
```
Do      bun run finder:seed  (twice)
See     "embedded 479 of 479 · removed 0", then "embedded 0 of 479"
```

**3 · The eval** — AC 12, 13, 14
```
Do      DATABASE_URL=<your dev database URL> GOOGLE_CLOUD_PROJECT=applyims GOOGLE_CLOUD_LOCATION=global bun run finder:eval
See     Q1 → cyber-psychology rank 1 · Q2 → actuarial-studies rank 1 · Q3 → hci rank 1 · negatives pass ("build bridges" top 3 all engineering; "I love cooking" nothing close, under three words) · held-out 19 of 20 (one miss, organisational-psychology at rank 6) · the 10 nonsense strings nothing close · exits 0
Other   docs/course-finder/eval.md, section "17 Oct 2026, after Nikhil's decisions", holds this run
```

**After task 13 only** — AC 1–10, 19, 20 (the panel, the cards, the why, the engine room, the messages)

**No need to click** — AC 4 (`model/filters.test.ts`, `server/search.db.test.ts`) · AC 6 (`model/why.test.ts`, `server/why.test.ts`) · AC 9, 10, 11 (`actions.test.ts`) · AC 15 (`evals/queries.test.ts`) · AC 17 (`model/build.test.ts`) · AC 18 (`model/dedupe.test.ts`).

**After deploy only** — AC 7 (speed on the warm live site) · `docs/course-finder/deploy-checklist.md`

**Needs a decision** — Nikhil
1. **Q2 has no field.** The isolated niche proposal produced no behavioural-economics field, so Q2 cannot pass. Replace Q2 with a query for a field that exists, or add the field by hand (which breaks the "taxonomy, not the demo" rule).
   **Decided:** Q2 now asks for the existing `actuarial-studies` field, which ranks first.
2. **Criterion 15 fails.** Q1 shares "why" and "people", Q3 shares "people" and "apps" with generated descriptions. Either edit those descriptions, or narrow the rule (exclude very common words). The two tests are skipped with that reason.
   **Decided:** criterion 15 sets common self-description words aside (`COMMON_WORDS`, read by `topicWords`); the word-count rule still counts them (`contentWords`). All three checks run and pass.
3. **The floor is weak.** Nonsense ("hmm" 0.619) scores above two real held-out queries (0.592, 0.599). At 0.605, 17 of 20 pass; at 0.5, 19 of 20 pass but "I love cooking" returns results. Consider a minimum word count for "nothing close" instead.
   **Decided:** text with fewer than 3 content words is nothing close, and the floor is 0.5.
4. **Cold start.** The first embedding call after idle took longer than the 2 s search timeout; on Cloud Run the first search after an idle spell could say "Couldn't search right now". Options: a warm-up call at start-up, or a longer first timeout.
   **Decided:** a warm-up call at server start, plus one quiet 5-second retry.
5. **Biome and the 1.4 MiB catalogue.** Biome skips files over 1 MiB (one lint warning). Exclude `src/features/finder/data/catalogue.ts` in `biome.json`, or raise `files.maxSize`.
   **Decided:** the catalogue is excluded in `biome.json`.

**Worth a glance** — every existing road reads the same (task 4 refactored `stayingRoute` and `cityGuide`; covered by the "is sound" tests) · the admin Models screen lists the new "student_finder_why" use case

**Build report** — each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 1 · switches and types | sonnet | 1m 58s | 34,352 | `6afedab` |
| 2 · isolated niche proposal | opus | 0m 42s | 49,002 | — |
| 2 · niche fields | opus | 2m 25s | 44,194 | `7d33f0d` |
| 3 · schema and brief | opus | 2m 30s | 61,418 | — |
| 3 · 8 isolated generators | sonnet | 2m 04s – 3m 14s each | 538,533 | — |
| 3 · validate and commit | opus | 2m 05s | 67,014 | `1d1887f` |
| 4 · road rules for any course | opus | 2m 40s | 41,481 | `30e4d73` |
| 5 · catalogue build | opus | 3m 56s | 65,308 | `ff8a2c1` |
| 6 · embeddings | opus | 3m 18s | 47,337 | `8144528` |
| 7 · course_doc table | opus | 3m 31s | 50,934 | `1c6c833` |
| 8 · finder:build | opus | 7m 42s | 65,362 | `b11c5ac` |
| 9 · finder:seed and deploy docs | opus | 7m 24s | 90,370 | `d9b0950` |
| 10 · filters and search | opus | 4m 22s | 63,108 | `59f8701` |
| 11 · the checked why | opus | 5m 35s | 96,702 | `314406a` |
| 12 · seed text, limit, actions | opus | 5m 16s | 84,416 | `2bd6616` |
| 14 · isolated held-out queries | opus | 1m 01s | 53,312 | — |
| 14 · evals, floor, README | opus | 8m 43s + 2m 24s | 201,188 | `b226624` |
| **Total** | | about 1h 45m | 1,754,033 | 13 |
Tokens are the subagents' own; this session's context is not in them.

**Verification (overnight)** — type-check clean · lint clean but one warning (the catalogue's size) · finder database tests 19 pass 0 fail (127.0.0.1:5434) · full suite `BETTER_AUTH_URL=http://localhost:3000 bun run test:run` 3796 pass, 546 skip, 0 fail.

## Result

17 Oct 2026, local, branch `test/finder-intersections-all` (all four branches combined). Nikhil reported the smoke test passed. Which steps were run by hand was not itemised; every criterion is also covered by the tests named in "No need to click" and the criteria tables, and by the branch reviews.
