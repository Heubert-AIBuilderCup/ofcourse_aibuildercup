# Make OfCourse submission-ready · Implementation Plan

**Intent:** docs/submission-readiness/intent.md
**Goal:** a repository a judge understands at a glance, model calls visible on Google Cloud, cheaper and safer calls, a suite with no hang, and the pitch drafted.
**Approach:** eight small tasks on `feat/submission-readiness`, each test-first where there is behaviour, docs where there is not. Hardening and cost first, then tracing, then the documents, which describe what the code finally does.
**Test layers:** unit for every behaviour (labels, tiers, the limiter key, the related query, the hooks test, the tracer's off-switch); one DB test for the related query; the e2e specs that touch public pages after the limiter change. Docs tasks are reviewed by reading.
**Constraints:** (from CLAUDE.md) `bun install` only · never push without approval · Conventional Commits, enforced · pre-commit runs lint-staged and type-check · never start a dev server for the user · server actions return `ActionResult` · Tailwind semantic tokens · the Industry design system · read node_modules/next/dist/docs before Next code. For this branch: the fake provider only in tests, never call Vertex; tracing off by default; no student or source text on spans or labels; permissive licences only (ADR-119).

## Files
| Path | Create or modify | Responsibility |
| --- | --- | --- |
| src/shared/lib/rate-limit.ts (+ test), src/proxy.ts | modify (Task 1) | the platform-appended address as the key |
| src/features/content/ai/{config,client,vertex,prompts,models}.ts (+ tests), src/shared/lib/db/schema.ts + migration | modify (Task 2) | labels; the lite tier |
| src/instrumentation.ts, src/features/content/ai/telemetry.ts (+ test), package.json | create, modify (Task 3) | spans and log lines |
| src/features/content/server/store.ts (+ DB test), src/app/(feed)/feed/[id]/page.tsx | modify (Task 4) | related candidates only |
| src/shared/lib/auth/hooks.test.ts | modify (Task 5) | no hang |
| README.md, docs/architecture.svg | modify, create (Task 6) | the entry explained |
| docs/hackathon/public-repo.md, docs/hackathon/deploy.md | create, modify (Task 7) | the public repo checklist; metrics and budget commands |
| docs/hackathon/pitch.md | create (Task 8) | video script and deck content |

## Task 1: The rate limit counts the platform's address
**Delivers:** SR9. **Kind:** judgement.
Today `src/shared/lib/rate-limit.ts` keys by the first `x-forwarded-for` entry, which the browser controls. On Cloud Run the platform appends the client address it saw; read the Cloud Run docs on request headers (cite the page in a comment) and key by the entry `TRUSTED_PROXY_HOPS` from the right (default 1), falling back to `x-real-ip`, then the shared key. Tests: a header `forged, real` keys on `real`; rotating the forged part does not reset the count; `TRUSTED_PROXY_HOPS=2` with `a, b, c` keys on `b`; no header uses the shared key. Commit `fix(security): rate-limit the public pages by the address the platform saw`.

## Task 2: Billing labels and a lite tier
**Delivers:** SR7, SR8. **Kind:** judgement.
Labels: `vertex.ts` sends `labels` on every `generateContent` (JSON and image): `app: 'ofcourse'`, `use_case`, `tier`, `prompt_version`, `env` (`process.env.NODE_ENV`), each normalised to lowercase `[a-z0-9_-]`, at most 63 characters (`labelsFor(req)`, exported and tested). Lite tier: `Tier` gains `'lite'`; `models.lite = env.GEMINI_LITE_MODEL || env.GEMINI_FLASH_MODEL || ''`; the specs for the source check, the art check, captions, market rewording and the design-language description move to `lite`; the ladder for a lite spec is lite → flash → pro (the flash rung carries the problems); `thinkingFor` gives LOW to Flash-Lite too (it already matches `flash`); the `ai_call` tier check gains `'lite'` (`bun run db:generate`, `bun run db:migrate`, never `db:reset`); the daily caps are unchanged (lite and flash are uncapped). `scripts/ai-smoke.ts` lists `GEMINI_LITE_MODEL` as optional. Tests: `labelsFor` normalises and truncates and never includes a user id; `aiConfig({ GEMINI_FLASH_MODEL: 'f' }).models.lite === 'f'`; a lite spec with two bad answers calls lite, flash, pro in order; the moved specs say `tier: 'lite'`. Commit `feat(content): billing labels on every Gemini call and a lite tier for the cheap steps`.

## Task 3: Gemini calls in Cloud Trace and Cloud Logging
**Delivers:** SR5, SR6. **Kind:** judgement.
Read node_modules/next/dist/docs/01-app/02-guides/open-telemetry.md and the `instrumentation.md` file convention first. Add `@opentelemetry/api`, `@opentelemetry/sdk-trace-node` (or the minimal SDK the docs recommend) and `@google-cloud/opentelemetry-cloud-trace-exporter` (all Apache-2.0; check each licence in node_modules and list them for Task 6). `src/instrumentation.ts` `register()` starts the tracer only when `OTEL_ENABLED === '1'` and `NEXT_RUNTIME === 'nodejs'`, with the Cloud Trace exporter (it authenticates with Application Default Credentials). `src/features/content/ai/telemetry.ts` exports `withGenAiSpan(info, run)` and `logAiCall(row)`; wrap the provider calls in `ai/client.ts` (`generateJson` and `generateImage`, one span per attempt with the attempt number) and write one JSON log line per finished call (`console.log(JSON.stringify({ severity: 'INFO', event: 'ai_call', … }))`, which Cloud Logging parses). Never put prompts, answers, source text or user ids on a span or a log line. Tests: with tracing off, `withGenAiSpan` runs the function and records nothing; with an in-memory exporter, a call yields one span with the attributes of SR5 and the outcome; a failing call records `ofcourse.outcome = 'failed'` and the error type, not its message text; `logAiCall` writes one parseable JSON line with the SR6 fields. Commit `feat(content): Gemini calls as spans in Cloud Trace and lines in Cloud Logging`.

## Task 4: Related posts read only their candidates
**Delivers:** SR10. **Kind:** judgement.
`src/app/(feed)/feed/[id]/page.tsx` reads the post with `liveById` and today still loads `listLive()` for Related. Add `relatedCandidates(post)` in `server/store.ts`: live, unexpired feed posts that share the post's `sourceId` or any of its theme or destination tags (jsonb containment on the pinned settings' `tags`), at most 20, newest approval first; `relatedTo` ranks them as today. Tests (DB): a post sharing a tag is returned; one sharing nothing is not; an expired one is not; at most 20. Commit `perf(content): related posts read only their candidates`.

## Task 5: The sign-in hooks test never hangs
**Delivers:** SR11. **Kind:** judgement.
`src/shared/lib/auth/hooks.test.ts` hangs on "the student page refuses an address an admin role waits for, and keeps the role" (Bun 1.3's `expect(…).rejects` on a refused sign-up inside a transaction never returns). Replace every `expect(…).rejects` in the file with the `failureOf` pattern the content DB tests use, and run the file with `DB_TESTS=1` on an empty database (`bun run test:db` wipes the dev database: use a separate one, `app_hooks`, created with `docker compose exec -T db psql -U app -d postgres -c "create database app_hooks"` and migrated with `DATABASE_URL=…/app_hooks bun scripts/migrate.ts`; never wipe `app`). Commit `test(auth): wait for refused sign-ups without .rejects`.

## Task 6: README and architecture diagram
**Delivers:** SR1, SR2, SR3. **Kind:** judgement.
Read the code, not memory: the model specs and tiers in `ai/prompts.ts` and `ai/config.ts`, the deploy runbook (`docs/hackathon/deploy.md`, untracked: read it), the decisions ADR-115 to ADR-132, PRODUCT.md (Jenish's product truth), and the intents. Replace the starter's README with OfCourse's: what and for whom; the architecture with `docs/architecture.svg` and the Google Cloud services list (Cloud Run, Cloud SQL for PostgreSQL 17, Secret Manager, Agent Platform/Vertex AI on `global` with Gemini 3.8 Flash, Flash-Lite, 3.1 Pro preview, Nano Banana 2.1, Cloud Trace, Cloud Logging, Cloud Build, Artifact Registry); the named agents with the model or code behind each and the human checkpoints; the student side (Jenish's opening, briefly, from PRODUCT.md); run locally (Bun, Docker, `.env` keys without values, the fake provider); deploy (link the runbook); tests; the decision register; and "Third-party code": every runtime dependency in `package.json` with its licence read from `node_modules/<pkg>/package.json` (and the tracing packages from Task 3), ported ideas (the sentence merge rule's origin, the Cloud Run Dockerfile pattern from vercel/next.js `with-docker`, MIT), the Barlow fonts (SIL OFL, `src/features/content/assets/fonts/OFL.txt`), and the art library images (their source). No Heubert-internal names (Expert, Edge, CRM). `docs/architecture.svg`: a clean, hand-written SVG (no external fonts or images, `currentColor`-friendly or a `prefers-color-scheme` style block so it reads in light and dark), showing the request path, the models per agent, the data stores and the three human checkpoints, accurate to the code. Commit `docs: the OfCourse README and architecture diagram`.

## Task 7: Public repository checklist; metrics and budget commands
**Delivers:** SR4, SR6 (the deploy part). **Kind:** judgement.
`docs/hackathon/public-repo.md`: the steps to publish the merged `main` as a new public GitHub repository: a fresh clone; exclude `.env*`, `.heubert/`, `research_notes/` (decide on `reports/`: they are our own research, fine to publish; say so); whether to keep history (recommend a single squashed import commit dated after the hackathon start, plus a README line on the starter's origin, pending ADR-127's statement); a secret scan before the push (gitleaks if installed, else a grep list of key patterns); a `LICENSE` choice for the team; and the rules' requirements (public, the live URL, the video, the deck). Add to `docs/hackathon/deploy.md` (untracked; edit it, the controller commits it): `gcloud logging metrics create` for `ai_call` counts by use case and outcome and a latency distribution, the `OTEL_ENABLED=1` env var on the service and `roles/cloudtrace.agent` for the runtime account, and a `gcloud billing budgets create` command filtered to Vertex AI with alert thresholds. Commit `docs(hackathon): public repository checklist`.

## Task 8: The pitch, drafted
**Delivers:** SR12. **Kind:** judgement.
`docs/hackathon/pitch.md`: a video script under 3 minutes (about 420 spoken words), scene by scene: the student's problem (from PRODUCT.md and the decision record's problem statement), the editor making a post from a link with no prompt (versions, edit on the slide, covers, the source check catching a planted error), the reviewer publishing, the student finding it in the feed and again via "search OfCourse …", the architecture slide, the closing line; each scene with what is on screen and what is said, and its seconds. Then the deck, slide by slide (10–12 slides): problem, who it is for, the solution, the demo flow, the named agents and what code checks, Google Cloud architecture, Gemini use and the eval result (10/10 planted errors caught), cost and safety (caps, labels, code-decided facts), impact and what's next, team. Theme "Media, Content & Digital Experiences" (ADR-128, proposed: mark it). Commit `docs(hackathon): the video script and deck content`.

## Criteria coverage
| Criterion | Task | Proven by |
| --- | --- | --- |
| SR1, SR2, SR3 | 6 | Reading: README sections present; every package.json runtime dependency listed (a script in the task's report compares the lists) |
| SR4 | 7 | Reading |
| SR5, SR6 | 3, 7 | `telemetry.test.ts` (off-switch, attributes, failure, log line); the deploy commands by reading |
| SR7, SR8 | 2 | `vertex.test.ts` (`labelsFor`), `client.test.ts` (lite ladder), `config` and prompts tests |
| SR9 | 1 | `rate-limit.test.ts` |
| SR10 | 4 | `store.test.ts` (DB) |
| SR11 | 5 | `hooks.test.ts` on an empty database, completing |
| SR12 | 8 | Reading |
