# Next tasks, 11 to 18 October 2026

_Written 11 Oct 2026 by Claude for Nikhil; Jenish's items are marked. Decisions cited by ADR number live in `docs/decisions/`. Replaces the 8 Oct version._

## Where things stand

- **Branch `feat/admin-feed-post-from-source` is pushed at `8f615e2`.** It holds the admin slice (stories 1–12), story 13 ("make a post without writing a prompt", criteria 93–110), all twelve review round 2 fixes, three small changes (fit as you type, only claim-like titles are checked, a rate limit on public pages) and the Cloud Run packaging. Lint, types, 1,532 unit tests, 192 database tests and the build pass; the browser suite last ran 177 passed, 1 skipped, 1 flaky (Jenish's onboarding spec, passes alone).
- **Gemini is live on `applyims`** (ADR-132): smoke 4/4, eval 10/10 planted with 2 false alarms (bar: all, at most 2).
- **Not deployed yet.** The runbook is `docs/hackathon/deploy.md` (not committed: the local secret scanner flags lines that only name secrets; waiting for Nikhil's word to skip it once).
- **`dev` moved again** (Jenish's #6 onboarding-study, #7 onboarding-living): 67 files, but only three overlap with this branch (`CLAUDE.md`, `OpeningScreen.test.tsx`, `theme-actions.test.ts`), no migration clash.

## The calendar

| Date | What must be true |
| --- | --- |
| **Sat 11 Oct (today)** | **Roster locked** with every member eligible; the site deployed and reachable; a few posts published on it |
| **Sun 12 Oct** | **User test** on the live site |
| Mon 13 Oct | Test findings sorted and fixed; the slice merged into `dev` |
| Tue 14 – Thu 16 Oct | Public GitHub repo, README, architecture diagram, video, deck; `dev` into `main` and deployed |
| **Fri 17 Oct** | **Submit** (the deadline is Sat 18 Oct, 23:59 IST) |

## 1. Today, 11 Oct

| # | Task | Owner | Notes |
| --- | --- | --- | --- |
| 1.1 | **Confirm the roster and every member's eligibility** before it locks today | **Nikhil and Jenish** | No students (the whole team is disqualified if one is found), 21+, JAPAC residents, 2–4 members (ADR-127) |
| 1.2 | `gcloud auth login` in a new terminal | Nikhil | The command-line sign-in expired; nothing on Google Cloud can be created until it is renewed |
| 1.3 | Approve committing `deploy.md` once with the secret scan skipped | Nikhil | False positives only |
| 1.4 | **Deploy**: APIs, Cloud SQL, service account, secrets (the Google sign-in pair copied by Nikhil with the runbook's command), `gcloud run deploy`, the migrations job, a smoke of the live site | Claude, with Nikhil for the secrets step | `docs/hackathon/deploy.md` steps 1–6 and 8 |
| 1.5 | Add the production sign-in address to the Google OAuth client (runbook step 7) | Nikhil | Claude confirms the exact address after the first deploy |
| 1.6 | **Sign in first on the live site**, then publish four to six posts (different destinations and themes, one India and one Nepal version, one made from a link) and save one page style | Nikhil | The first account becomes superadmin; testers then see a full feed |
| 1.7 | Merge `dev` (#6, #7) into the branch and push | Claude | Three overlapping files; the browser suite after it |
| 1.8 | Refresh the pull request description for story 13 and the merge, for Jenish | Claude | Link, title and the full description, as before |
| 1.9 | Tell Jenish: the live URL, the branch to review, and the decisions waiting on him (section 5) | Nikhil | |

## 2. User test, Sun 12 Oct

| # | Task | Owner |
| --- | --- | --- |
| 2.1 | **A one-page script per role**, written today: the marketer makes a post from a link (versions, edits on the slide, an emotion, covers, settings and tags, send to review); Nikhil reviews and publishes; the students browse the feed (chips, search, the India or Nepal version, related posts, a public `/posts/<slug>` page, the Instagram links); the counsellor reads the feed | Claude drafts, Nikhil adjusts |
| 2.2 | Accounts: the marketer as editor, Nikhil as reviewer (superadmin), three students by Google sign-in, the counsellor as a student-side reader | Nikhil (Users admin) |
| 2.3 | What to watch: where people hesitate, any wrong number or label, time from paste to publish, whether the chips and the search are understood, whether anyone looks for a prompt box | Nikhil |
| 2.4 | Capture in `docs/admin-feed-post-from-source/user-test.md`: each finding becomes a fix (test-first) or a later idea | Nikhil writes, Claude sorts |

## 3. After the test, 13 Oct

| # | Task | Owner |
| --- | --- | --- |
| 3.1 | Fix the test's findings, test-first, smallest first; re-issue only the smoke steps a fix touches | Claude |
| 3.2 | The smoke test's third round (S8–S15 in `smoke.md`), if not covered by the user test | Nikhil |
| 3.3 | Merge the pull request into `dev` once Jenish has reviewed | Nikhil and Jenish |

## 4. Submission, 14–17 Oct

| # | Task | Owner | Notes |
| --- | --- | --- | --- |
| 4.1 | **Decide the fresh-code question**: the repo began from the Heubert starter, which predates the hackathon; ask support+aibuildercup@hack2skill.com in writing, or present it plainly in the README | Nikhil | ADR-127; the rules disqualify "code developed prior to the official launch" |
| 4.2 | **Public GitHub repository** with the merged `main`: no `.env`, no Heubert-only material, the decision register and docs included | Nikhil creates it; Claude prepares the push | Required by the rules (ADR-128); everything in it becomes public under a 6-month right of first refusal |
| 4.3 | **README for OfCourse**, replacing the starter's: what it does, the architecture, how to run it, the named agents (Extractor, Drafter, Illustrator, Source Checker, Localiser, Captioner, Router later), and the "third-party code" section with every library and ported idea and its licence | Claude | ADR-119, ADR-128 |
| 4.4 | **Architecture diagram**: Cloud Run, Cloud SQL, Secret Manager, Agent Platform on `global` with the models of ADR-115, the human checkpoints; as an SVG in the repo and a slide | Claude | |
| 4.5 | **Observability, optional** (about a day): one Cloud Trace span per model call (use case, model, tokens, cached, fallback), log-based metrics, a Vertex AI spend-cap budget | Claude | Strong for "Google Cloud depth"; only if 3.1 is done by Tue |
| 4.6 | **Rest of Task 32, optional**: billing labels on every call and a Flash-Lite tier for the cheap steps | Claude | Low thinking on Flash already landed (`bad642f`) |
| 4.7 | **Rate limit keyed by the address Google adds**, not the one the browser sends, before the site is public | Claude | Review round 2 fix C's concern |
| 4.8 | **Video under 3 minutes** and a **PDF deck**, in English: script drafted from the user test on Mon 13 Oct | Claude drafts the script and the deck's content; Nikhil records | |
| 4.9 | `dev` into `main` (both slices), deploy `main`, final smoke, submit with the live URL | Nikhil and Jenish, Claude for the deploy | Fri 17 Oct |

## 5. Jenish, as soon as possible

| Item | ADR | Why |
| --- | --- | --- |
| Hosting on `applyims` instead of his project (no billing there) | ADR-120, ADR-132 | The site is deployed there today |
| The profile fields the feed reads (`homeMarket`, `destinations`, `ageBand`) and the Clear rule | ADR-126 | His slice supplies `loadStudentProfile`'s body |
| Theme "Media, Content & Digital Experiences", the public repo, the named-agents pitch | ADR-128 | Submission requirements |
| His Resend key and sender address, if students should sign in by email code on the live site | — | Without them, Google sign-in only (decided for the test) |
| The flaky `e2e/onboarding.e2e.ts:254` (the tagline matches the splash overlay) | — | His spec |

## 6. After 18 Oct

The request-routing cascade (ADR-116), course matching with pgvector and the Mongo import (ADR-117), the ADK research service (ADR-118), several market versions per post, embedding edges in Related, shaping-aware text measuring for Devanagari, route comics, learning from editors' edits. Each starts with a brainstorm and an intent.

## How to resume with Claude

- "gcloud done" (and "commit the runbook") to start the deploy.
- "Merge dev" for task 1.7; "PR description" for 1.8; "Write the test script" for 2.1.
- After the test: paste the findings, or point to `user-test.md`.
- "README", "diagram", "observability", "video script" for section 4.
