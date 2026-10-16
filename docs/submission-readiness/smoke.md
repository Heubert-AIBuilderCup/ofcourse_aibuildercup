# Smoke test · submission readiness · branch `feat/submission-readiness`

_Built 11 Oct 2026 (Tasks SR1–SR8, 9 commits on top of `feat/admin-feed-post-from-source`). Local, `bun run dev` on localhost:3000._

**Before you start**
- Pull nothing: the branch is local only until you say push. You are on it already (`git branch` shows `* feat/submission-readiness`).
- `bun install` (new packages: OpenTelemetry and the Cloud Trace exporter).
- Migration 0007 (the `lite` tier in the call log) is applied by `bun run dev`.
- Optional in `.env`: `GEMINI_LITE_MODEL=gemini-3.5-flash-lite` (without it the cheap steps use your Flash model).

**T1 · The README and the diagram** — SR1, SR2, SR3
```
Go to   README.md and docs/architecture.svg (open the SVG in a browser, light and dark)
Do      read it as a judge would
See     what OfCourse is, the Google Cloud services, the eight agents with their models, the three human checkpoints, run and deploy, the third-party code with every dependency's licence; no internal product names
Other   two items to settle: the art library images' source (README says unknown) and the fresh-code line (ADR-127)
```

**T2 · The cheaper model on the cheap steps** — SR8
```
Go to   a post, with AI_PROVIDER=vertex and GEMINI_LITE_MODEL set (or on the stand-in)
Do      make a post and let the source check run; make covers; make an Instagram version
See     everything works as before; in the call log (ai_call table) the source check, art check and captions are tier "lite"
```

**T3 · Gemini calls visible on Google Cloud** — SR5, SR6, SR7
```
Go to   the dev server's terminal while making a post
Do      watch the output
See     one JSON line per Gemini call: {"severity":"INFO","event":"ai_call","use_case":…,"outcome":"ok",…}, never any text from the source
Other   with OTEL_ENABLED=1 on the deployed service, each call is a "gen_ai <use case>" span in Cloud Trace; billing labels per call appear in the billing export
```

**T4 · Related posts and the public pages' limit** — SR9, SR10
```
Go to   /feed/<id> of a post that shares a tag with another
Do      read Related; then reload /posts/<slug> quickly more than 60 times in a minute (or trust the unit test)
See     Related as before, faster; the 61st request answers 429 with Retry-After
```

**No need to click** — SR11 (`hooks.test.ts` runs 29/29 on an empty database) · SR4 and SR12 by reading: `docs/hackathon/public-repo.md`, `docs/hackathon/pitch.md` · under test.

**Needs a decision** — from Nikhil
1. Commit `docs/hackathon/deploy.md` once with the local secret scan skipped (false positives: lines that name secrets or generate a password).
2. The fresh-code statement (ADR-127): disclose the starter and ask the organiser in writing, or disclose only.
3. The art library images and `public/brand/quack.mp4`: confirm their source and licence, or replace them, before the repo goes public.
4. The repository licence: a proprietary notice (fits the right of first refusal) or MIT.
5. ADR-119 lists permissive licences; `@resvg/resvg-js` is MPL-2.0 (fine unmodified) and `postgres` is Unlicense: add one line to the register.
6. The decision register names internal products (the CRM, Expert, Edge): leave them in the public repo or strip them.
7. The Vertex AI budget amount (the runbook says USD 100 a month as a placeholder).

**Live checks, run by the controller on 11 Oct 2026 (project applyims)**
```
ai:smoke   extract 4.5 s · draft 11.1 s · source check on gemini-3.5-flash-lite 1.1 s · image 10.6 s · labels accepted
ai:eval    planted caught 10/10 · false alarms 0 · PASS (source check on Flash-Lite)
```

**Verification, 11 Oct 2026**
```
bun run lint         Checked 507 files. No fixes applied.
bun run type-check   clean
bun run test:run     1662 pass · 226 skip · 0 fail · Ran 1888 tests across 158 files
DB suites            197 pass · 0 fail · Ran 197 tests across 14 files; hooks.test.ts 29/29 on an empty database
bun run build        Compiled successfully
```

**Build report** · each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| SR1 · rate limit by the platform's address | fable | 6m 38s | 46,097 | `52fd8ff` |
| SR2 · billing labels and a lite tier | fable | 11m 41s | 111,249 | `978e110` |
| SR3 · Cloud Trace and Cloud Logging | opus | 11m 56s | 103,913 | `ff4693a` |
| SR4 · related posts read only their candidates | fable | 6m 49s | 65,206 | `f09647c` |
| SR5 · the sign-in hooks test never hangs | fable | 12m 31s | 56,242 | `d54c339` |
| SR6 · README and architecture diagram | opus | 11m 59s | 205,643 | `d1a7b0c` |
| SR7 · public repository checklist; runbook additions | fable | 8m 02s | 89,267 | `2c27e72` |
| SR8 · video script and deck content | opus | 4m 44s | 89,712 | `6de81e4` |
| **Total** | | **1h 14m** | **767,329** | **8** |
Tokens are the subagents' own; this session's context is not in them. Plan and intent by the controller (`b5abc14`).

**Browser suite, 12 Oct 2026, on this branch against the running dev server** — 170 passed · 1 skipped · 11 failed (12.7m). Every content spec passed, story 13's included. The eleven failures are in the student flows, whose code and specs are identical on `dev` (this branch's merges touched only two of Jenish's test files):
- Nine (`coins-and-return` ×3, `futures` ×2, `opening` ×2, `student-opening-three-futures` AC26, `onboarding-study`) wait for a level-1 heading "Where and how you'd live" that the onboarding "living" step (Jenish's #7) no longer renders as the page heading; his #6/#7 updated `opening.e2e.ts` and added `onboarding-study.e2e.ts`, but the other specs still expect it.
- `dark-mode.e2e.ts:625` (AC10) reads an element of the same changed flow (`querySelectorAll` on null).
- `user-management.e2e.ts:83` ("a user is kept out of the admin"): the student is sent to the student app correctly, but the app now forwards a new student straight into onboarding, so the second `page.goto('/admin/users')` is aborted mid-redirect (`net::ERR_ABORTED`). Consistent when run alone. The behaviour holds; the spec needs to allow the onboarding hop.
For Jenish: update those specs to the new living step (and the user-management assertion to accept the onboarding URL), on `dev`.
