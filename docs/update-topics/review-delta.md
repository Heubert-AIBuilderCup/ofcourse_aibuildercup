# Update topics, delta since the final review — Code Review

**Approve with changes.** 0 CRITICAL · 0 HIGH · 1 MEDIUM · 1 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/update-topics` at `a2f4fc3` over `aa7e3f5` · 7 files, +44 −21 · 17 Oct 2026 |
| Reviewed against | security · security-web · performance · CLAUDE.md · industry `DESIGN.md` · `fdd-architecture (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` |
| Scans | secrets N/A (not installed) · dependencies N/A (not installed; no package change) · code N/A (not installed) |
| Not applicable | `security-llm.md` (no model code) |
| Failed to load | none |
| Read outside the diff | 4 — listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | — | — |
| Performance | A | — | — |
| fdd-architecture | A | — | — |
| vercel-react-best-practices | A | — | — |
| CLAUDE.md (git) | B | MEDIUM · `023ea88` · co-author trailer | squash without the trailer |
| Criteria, DESIGN.md | A | LOW · `UpdatesScreen.tsx:455` · unknown topic shows "All topics" | optional |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | Topic beside Country, "All topics" first | `UpdatesScreen.test.tsx` (select); layout manual | covered |
| 2 | Saved topic reads back | `server/updates.test.ts` (database) | covered, unchanged |
| 3 | Older updates read as all topics | `audience.test.ts:136`, `feed-updates.test.ts:210` | covered |
| 4 | Preview matches all three | `audience.test.ts` | covered, unchanged |
| 5 | Preview counts ranked course or interest | `audience.test.ts` | covered, unchanged |
| 6 | Insights uses the same rule | `insights/lib/overview.test.ts` | covered, unchanged |
| 7 | Feed: a course in the field | `feed-updates.test.ts`, `server/feed-updates.test.ts` | covered, unchanged |
| 8 | Feed: stated interest, assumed never | `server/feed-updates.test.ts` | covered, unchanged |
| 9 | The two why lines | `feed-updates.test.ts` | covered, unchanged |
| 10 | Once only | `feed-updates.test.ts` | covered, unchanged |
| 11 | Others never see it, an unknown topic included | `audience.test.ts:144`, `feed-updates.test.ts:201` | covered |

The tests were not run here: the branch is not checked out in this worktree, and exporting it was refused. The final review ran them on an export, and the pre-commit hook ran type-check on `023ea88`.

## Read outside the diff
- `updates/lib/update.ts:94` — the save schema accepts only `ALL_TOPICS` and the eight topics, so `NO_TOPIC` cannot be written.
- `updates/lib/feed-updates.ts:16-56` — `interestTopics` and `courseTopics` are `string[]`, so the widened topic type compiles; a `NO_TOPIC` rule matches no roadmap.
- `roads/model/tile-posts.ts:79-84` — tiles compare `audienceOf(...).topic` with the course's field, so `NO_TOPIC` reaches no tile.
- `git merge-base feat/update-topics origin/main` — `9317bda`, so it merges into main clean. PR 3 of the finder stack conflicts with it afterwards (see `docs/course-finder/review-delta.md`).

## Findings, by file

### Commit history (`origin/main..feat/update-topics`)

**MEDIUM · `023ea88` · co-author trailer**
- What: the fix commit ends with a `Co-Authored-By` line, and the branch is 14 commits, not yet squashed.
- Why: CLAUDE.md forbids co-author text, and a GitHub squash merge copies the trailer into main.
- Rule: CLAUDE.md §Git · a test would have caught it: no.
- Fix: squash the branch into one `feat(updates): …` commit without the trailer before pushing.

### `src/features/updates/components/UpdatesScreen.tsx`

**LOW · line 455 · an unknown topic shows as "All topics"**
- What: a rule read as `NO_TOPIC` reaches the controlled select, which has no such option, so the browser shows "All topics".
- Why: the form would show the opposite of what the update does (it reaches no one). Only mock data can carry such a topic today; the save schema refuses it.
- Rule: `security.md` §6 (validated state shown truthfully) · a test would have caught it: yes, a form test given an unknown stored topic.
- Fix: optional: add a disabled "No topic (unknown)" option when the value is `NO_TOPIC`.

## Top 3 priority fixes
1. `023ea88` — squash the branch without the co-author trailer.
2. `src/features/updates/components/UpdatesScreen.tsx:455` — optional: show `NO_TOPIC` as itself.

## Done well
- `topicOf` checks the stored topic instead of casting it, and fails closed: an unknown topic reaches no student, no roadmap and no tile, never everyone.
- The two new tests assert outcomes through `matchAudience` and `feedUpdates`, not the mapping, and the two bloated tests are gone.
- The layout fix is one class: "Ranked a route at" spans the row, so Topic and Home country sit side by side.

## Built but not asked for
- nothing

## Blind spots
- Not run here: the updates, tile-posts and insights tests, and `test:db` for criterion 2. Run them at the branch tip before pushing.
- Topic beside Home country at `@xl` is a look check: confirm it at 768 and 1440 in the smoke test.

---
Stack: TypeScript, React client component, Tailwind 4 container queries, zod, Bun test with happy-dom. Passes applied shallowly: none; tests not run (see the note under the criteria).

## Applied (17 Oct 2026)

Nikhil: "fix all valid". Fixed: the LOW (an unknown stored topic now shows as "No topic (unknown)" in the form). The MEDIUM (the co-author trailer) goes when the branch is squashed before the push. update-topics is now stacked on the finder stack (merge order finder → detail → compare → update-topics), and its feed reader keeps both the topics and the pin, with a test for a pinned finder course. None judged invalid.
