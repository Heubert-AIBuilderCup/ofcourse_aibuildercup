---
title: Make OfCourse submission-ready
author: Nikhil
---
# Make OfCourse submission-ready
_Intent written 11 Oct 2026 with Nikhil, from the plan for 11–18 October (`docs/hackathon/next-tasks.md`, section 4). No ticket. Branch `feat/submission-readiness`, cut from `feat/admin-feed-post-from-source` at `b37c66a`._

## Problem

The admin slice works and Gemini is live, but the entry is not ready to be judged: the repo still carries the starter's README with no account of the architecture or the third-party code the rules ask us to credit; judges score "Google Cloud architectural depth" and nothing shows a model call on Google's own tools; the public pages' rate limit trusts an address the browser can forge; the cheap steps run on a model costlier than they need, with no billing labels to show cost per use; and one sign-in test hangs.

## Proposed outcome

A judge who opens the public repository understands what OfCourse does, how it is built on Google Cloud, which agents do what, how to run it and what code it reuses; each Gemini call is visible in Cloud Trace and Cloud Logging with its use case, model, tokens and outcome; spend is attributable per use case; the public pages cannot be flooded by rotating a header; the full test suite runs without a hang.

## Affected users and systems

Judges and the public (repository, README, diagram); the team (tracing, logs, labels); students and visitors (public pages). Systems: the model layer (`src/features/content/ai/`), the public routes and proxy, Next's instrumentation, the docs.

## Scope

The repository and docs; the server on Cloud Run (`applyims`); local development (tracing off by default).

## User stories and acceptance criteria

### 1. Judges understand the entry from the repository

SR1. Given the repository's `README.md`, when a judge reads it, then it says what OfCourse is (one paragraph), who it is for, the architecture (a diagram and a list of the Google Cloud services used, each with what it does), the named agents with the model or code behind each (Extractor, Drafter, Illustrator, Art checker, Source checker, Localiser, Captioner), how a human approves every post, how to run it locally and how to deploy it (linking `docs/hackathon/deploy.md`), and the decision register; and no Heubert-internal name (Expert, Edge, CRM) appears.
SR2. Given the README's "Third-party code" section, when it is read, then every runtime dependency in `package.json` is listed with its licence, every idea or snippet ported from another project is named with its source and licence, and the fonts and image assets are credited with their licences.
SR3. Given `docs/architecture.svg`, when it is opened, then it shows the request path (browser → Cloud Run → Cloud SQL, Secret Manager, Agent Platform on `global` with each model, Cloud Trace and Logging), the human checkpoints (approve the version, pick the cover, review and publish), and matches the code; it reads in light and dark viewers.
SR4. Given `docs/hackathon/public-repo.md`, when the team prepares the public repository, then it lists every step and check: what is excluded (`.env*`, `.heubert/`, scratch notes), how history is handled, the secret scan, the licence file, and the fresh-code statement to settle (ADR-127).

### 2. Model calls are visible on Google Cloud

SR5. Given the server runs with tracing on (`OTEL_ENABLED=1` on Cloud Run), when any Gemini call is made, then a span named `gen_ai <use case>` reaches Cloud Trace with the OpenTelemetry GenAI attributes (`gen_ai.operation.name`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`) and `ofcourse.use_case`, `ofcourse.tier`, `ofcourse.prompt_version`, `ofcourse.cached`, `ofcourse.outcome`; no student or source text is put on a span. With tracing off (the default, and always in tests), no exporter loads.
SR6. Given any Gemini call, when it completes, then one structured JSON log line is written (`event: "ai_call"`, use case, tier, model, prompt version, cached, outcome, milliseconds, token counts), which Cloud Logging indexes for log-based metrics; and `docs/hackathon/deploy.md` gains the commands that create the metrics and a spend-cap budget on Vertex AI.
SR7. Given any Vertex call, when it is sent, then it carries `labels` (`app: ofcourse`, `use_case`, `tier`, `prompt_version`, `env`), lowercase, at most 63 characters, never a user id, so billing reports split spend per use case.

### 3. Cheaper and safer

SR8. Given the cheap steps (the source check, the art check, captions, market rewording, the design-language description), when they call Gemini, then they use a `lite` tier (`GEMINI_LITE_MODEL`, falling back to the Flash model when unset, so today's `.env` keeps working), with low thinking on Flash-Lite; the retry ladder goes lite → flash → pro; the call log records the `lite` tier.
SR9. Given a visitor rotating their `X-Forwarded-For` header, when they request `/posts/<slug>` or its images, then the rate limit still counts them as one address: the key is the address the platform appended (the right-most entry, or the hop count set by `TRUSTED_PROXY_HOPS`, default 1), never a browser-supplied left-most entry.
SR10. Given a post page, when it shows related posts, then it reads only the candidates it needs (the post's own source and tags), not every live post.
SR11. Given `bun run test:db`, when it runs, then `src/shared/lib/auth/hooks.test.ts` completes (no `expect(…).rejects` on a refused sign-up; the `failureOf` pattern), and all its tests pass on an empty table.

### 4. The pitch, drafted

SR12. Given `docs/hackathon/pitch.md`, when the team records the video and builds the deck, then it holds a video script under 3 minutes (scene by scene, with what is on screen and what is said), and the deck's slide-by-slide content (problem, solution, demo, architecture, Gemini and Google Cloud use, impact, team), consistent with the README and the theme "Media, Content & Digital Experiences" (ADR-128, proposed).

## Edge cases

- Tracing on but the exporter cannot reach Google: the call still succeeds; the span is dropped (SR5).
- A label value that is not lowercase or longer than 63 characters: normalised or dropped, never sent invalid (SR7).
- No `GEMINI_LITE_MODEL`: the lite tier uses the Flash model (SR8).
- A request with no forwarding header: the limiter falls back to a shared key, as today (SR9).

## Constraints

Fresh-code clause and permissive licences only (ADR-119); no new paid service beyond those in ADR-120 and ADR-132; tracing never sends student or source text; the fake provider in tests; by 17 Oct.

## Out of scope

Deploying (separate, blocked on Nikhil's gcloud sign-in), recording the video, creating the public GitHub repository (Nikhil), Jenish's slice.

## Dependencies

`feat/admin-feed-post-from-source` (this branch is cut from it and merges after it); `@opentelemetry/*` and the Google Cloud trace exporter as new dependencies (Apache-2.0).

## Open questions

1. The fresh-code statement for the README and the submission (ADR-127). Owner: Nikhil. Does not block the work.
