# AI infrastructure decisions, 7 October 2026

_Written by Nikhil with Claude. The model layer and the AI architecture around it: which models, how requests are routed, where retrieval lives, how the research agent runs, how quality, safety and spend are shown, how it is hosted, what we fix before the deadline, and what we reuse from outside. Each section says why, what was considered and rejected, where the evidence is, and whether it is settled. Settled decisions move into the shared decision record as ADRs._

**Evidence files** (all in this repo, each claim cited to its source inside):
- `reports/Google AI stack for OfCourse.md`, the current Google model, platform and hosting facts, with per-use-case settings and costs
- `reports/Laya request routing fit.md`, the routing design and the comparison with Laya and Jev
- `reports/Vercel Eve and Jev fit.md`, why neither is in the stack
- `reports/Reusable implementations for our stack.md`, with the "Recheck, 7 Oct 2026" section at the end
- `research_notes/Reusable implementations for our stack/VERIFY_licences_models.md`, every licence, date and model claim checked against its source

---

## 1. Models · Status: decided, Nikhil, 7 Oct

| Use | Model | Why |
|---|---|---|
| Cheap steps (router, judge, captions, Nepal rewording, course "why") | `gemini-3.5-flash-lite`, minimal thinking | Google positions Flash-Lite for routing, extraction, tagging and classification. Gemini 2.5 retires on Agent Platform on 20 Oct, the day after judging starts. |
| Main steps (drafting, vision QA, research extraction) | `gemini-3.8-flash`, low thinking | The current Flash. "Minimal" thinking returns a 400 on it. Price doubles on 1 Jan 2027, so re-cost then. |
| Claim extraction and the retry tier | `gemini-3.1-pro-preview`, medium thinking; `3.8 Flash` at high thinking as the GA fallback | The one step where deep reading pays. Pro is preview and `global`-only, so the fallback stays wired. |
| Images | `gemini-nano-banana-2.1`, `generateContent` with `imageConfig` (4:5, 1K), location `global` only | Imagen is shut down (17 Aug 2026). This model is served only from `global` and rejects temperature, seed, topP and topK. |
| Embeddings | `gemini-embedding-001` at 768 dimensions, normalised in code | Has task types (classification, retrieval query and document), costs less than Embedding 2, is the model Cloud SQL's in-database `embedding()` supports, and avoids Embedding 2's single-aggregated-vector trap. |

**Settings that follow from the models.** Code holds a per-model capability map and validates every call against it: allowed thinking levels, whether temperature is honoured (3.6 Flash and later ignore it), no penalties. `maxOutputTokens` includes thinking tokens, so it gets headroom and `MAX_TOKENS` is its own retry case. The SDK makes one attempt unless `retryOptions` is set, so our ladder owns retries. Safety filters default to OFF on 3.5+ and stay there, with the non-configurable outcomes handled in code. Every call carries `labels` (`app`, `use_case`, `tier`, `prompt_version`, `env`) so billing can be split per use case. Fixed prompt content goes first so implicit caching applies. Determinism comes from the database cache, never from sampling settings.

---

## 2. Routing: a Google-native cascade in our own code · Status: direction set, Nikhil, 7 Oct; builds after this slice

**The chain, in ADR-077 order:** rules → exact cache → embedding router → Flash-Lite → Flash.

1. **Rules** first: regex and lexicons for amounts (lakh, crore, NPR, $), test scores, intakes, relatives. A hit sets its section with certainty and costs nothing.
2. **Cache** on a hash of the normalised text.
3. **Embedding router:** one embedding call, cosine similarity against 15–30 labelled exemplars per section in English, Romanised Nepali and code-mixed text, a fitted threshold per section (so it is multi-label), and an explicit "none" set. The logic is a port of aurelio's MIT semantic-router (about 200 lines); in its demo, fitting thresholds lifted accuracy from 34.85% to 89.39%.
4. **Flash-Lite** only when the top section's margin over the runner-up is below a fitted threshold, or nothing matches: minimal thinking, an enum schema, the embedding candidates as hints.
5. **Flash** only when Flash-Lite's output fails schema validation or contradicts a rule hit.

**Tier routing for the content pipeline needs no classifier.** The task type is known, so a static task→tier table in config decides, and escalation happens only when a validator fails (draft on Flash, retry on Flash with the errors, then Pro). A learned model picker would add cost and opacity where a lookup table is correct and auditable.

**Why this shape:**
- Gemini 3.x no longer returns logprobs, and model self-confidence is miscalibrated, so the escalation signals must be code-checked: embedding margin, rule-versus-model agreement, validator results. That is ADR-112 applied to routing.
- An admin correction becomes a new exemplar at once, with no deploy and no retraining, and the same correction becomes an eval case. That is the adaptability story for judges.
- Every stage is a visible span: a route chip on each reply ("rules · 2 ms" / "Flash-Lite · 640 ms · budget, family"), a Cloud Trace waterfall of one message, and a chart of the share of messages that needed a model.

**Considered and rejected:**
- **Vercel Eve and Jev:** non-Google components in the core path lose points under "built primarily on Google Cloud"; Jev has no Nepali evidence; Eve's natural fit (the research agent) is the worst place for a model that must not approve anything.
- **Laya:** a Jev-compatible classifier, not a router; 0.36 zero-shot accuracy, uncalibrated for Nepali, needs labelled data we do not have, and a GPU instance billed for its whole lifetime. A fair trial becomes possible only after the correction loop has produced labelled data.
- **Vertex Model Optimizer:** experimental, routes between retired 2.x models, opaque. **API Gateway model routing:** a rule switchboard, not a classifier. Both would also break ADR-112.
- **EmbeddingGemma** on Cloud Run is the one open-model option that reads well to judges; optional shadow run, not in the path.

---

## 3. Retrieval stays in Postgres · Status: decided, Nikhil, 7 Oct; pgvector lands with the course-matching work

`gemini-embedding-001` vectors in **pgvector on Cloud SQL PostgreSQL 17** (pgvector 0.8.5 ships there), through Drizzle's `vector()` column. Under 1,000 rows, an exact scan with hard filters in `WHERE`; HNSW only at tens of thousands of courses. Hybrid search (vector plus full-text, rank fusion) from pgvector-node's MIT example when needed. Store `embedding_model` beside each vector, because embedding spaces are incompatible across models. One local change first: `docker-compose.yml` moves from `postgres:17-alpine` to `pgvector/pgvector:pg17`.

**Courses from Mongo.** The business catalogue lives in a self-hosted MongoDB, which has no vector search. For the hackathon the catalogue is imported into Cloud SQL by a one-off script (a JSON export, or labelled mock rows while the export is not ready); Mongo stays the source of truth and a scheduled sync comes later. Not chosen: hosting Mongo on Compute Engine in the demo path (a second database to run, no vector search, and a non-Google component in front of judges); MongoDB Atlas (vector search exists, but it is a new vendor and account eleven days out); Firestore in MongoDB-compatibility mode (Google-native, but a second database beside the Postgres both slices already use, and vector search through that interface is unverified).

**Why:** the answer library's rule, serve a stored answer only above a fitted similarity threshold, needs the raw score. Every managed retrieval product fails that or is oversized for 20 Q&As and 12 courses:
- **File Search** hides retrieval scores and chunks.
- **RAG Engine** is Python-first, allowlist-gated to US regions, and bills a managed Spanner instance.
- **Agent Retrieval** moves the source of truth out of Postgres.
- **AlloyDB AI** is about four times the cost of Cloud SQL; a scale-later option.

---

## 4. Research agent: ADK TypeScript on its own Cloud Run service · Status: direction set, Nikhil, 7 Oct; build decided with Jenish

Flash-Lite plans two to four queries → 3.8 Flash runs them with Google Search grounding and a schema in one call → **code takes URLs from `groundingChunks`, never from model text** → code ranks them (boosting `.gov`, `.gov.np`, `.edu`, `.edu.au`) → **our own fetch** stores each page with its hash → 3.8 Flash extracts `{fact, quote, url}` → code rejects any quote that is not a normalised substring of the stored page → a human approves. The human gate is an ADK `RequestInput` node; `requireConfirmation` on a tool does not pause inside a workflow.

**Why:**
- Grounding metadata maps spans of the *model's answer* to URLs and returns no source text, so it cannot be the evidence for a verbatim-quote check. Fetching the pages ourselves is the only way ADR-112 survives.
- `@google/adk` for TypeScript is GA (2.x) with search, URL-context, human-input and OpenTelemetry primitives. Agent Runtime hosts only Python and Go, so a TypeScript agent deploys to Cloud Run. Nobody has run adk-js under Bun, so it is a separate Node 22 service called from Next; that also gives a cleaner architecture diagram.
- Student free text never goes into Search grounding: its logs are kept up to three days and cannot be disabled.

**Rejected:** Google's **Deep Research agent** (multi-minute, Interactions-only, preview, no domain filter); at most an optional asynchronous report a reviewer can read. **Firebase Genkit** as the model layer: its own REST client instead of `@google/genai`, no knowledge of the current model IDs, an older OpenTelemetry pin that conflicts with ADK's; adopting it would replace `vertex.ts`, the fake provider and the replays for a framework that is not itself a Google Cloud service.

---

## 5. Quality, safety and spend as Google surfaces · Status: direction set, Nikhil, 7 Oct

| Concern | Decision | Why |
|---|---|---|
| Evals | `bun run ai:eval` stays the deterministic gate. The Gen AI evaluation service (GA 31 Jul 2026) runs the same golden set as bring-your-own-response data, through its REST API or a small Python job, with a 3.x judge pinned. | The service is a judge-visible Google surface; its default judge is 2.5 Flash, which retires on 20 Oct, so the judge must be pinned. The service's full SDK is Python. |
| Prompt tuning | The data-driven prompt optimizer on the router and extraction prompts, 50–100 labelled samples; every optimised prompt must pass `ai:eval` and get a version bump. | Google tooling that improves our own prompts without surrendering the decision to the model. |
| Safety | **Model Armor direct calls**, not the inline config: screen pasted sources for injection (chunked under the 65k-token limit; `EXECUTION_SKIPPED` means "not screened", not clean); student free text in inspect-only mode; wellbeing routed in code. Gemini `safetySettings` stay OFF. | Inline Model Armor fails open when unavailable and cannot be combined with `safetySettings`. Neither Model Armor nor Gemini has a self-harm category, so that path must be ours. |
| Observability | One span per model call in the wrapper that already writes `ai_call`, with the OpenTelemetry GenAI attributes plus `use_case`, `tier`, `prompt_version`, `cached`, `fallback`, exported to Cloud Trace. One structured JSON log line per call; log-based counter metrics by use case and outcome, created **before** the demo. No student text in span attributes. | Cloud Trace renders GenAI spans natively. Log-based metrics are not backfilled. |
| Spend | A spend-cap budget on `aiplatform.googleapis.com`, an alerts-only budget beside it, request labels into the BigQuery billing export, and the app's own daily Pro and image caps kept. | No Google-side per-model daily cap exists. A timed-out call is still billed, so thinking levels are pinned and timeouts are generous. |
| Data | Agent Platform only; never an AI Studio free key for real student text. Zero-retention hardening after the hackathon. | The unpaid Developer API may be human-reviewed and used for training. Zero retention likely forfeits the implicit-cache discount; decide later. |

Working cost estimate from the Google stack report: about **$0.11–0.15 per feed post**, and **$35–60 of Gemini spend** for two weeks at demo scale, with the image and Pro extraction as the two largest lines.

---

## 6. Hosting: one Cloud Run service, one Cloud SQL instance, Gemini on `global` · Status: direction set, Nikhil, 7 Oct; deployment owned by Jenish

- **Cloud Run with our own Dockerfile**, `output: 'standalone'`, Node 24 runtime with Bun used only to install. Instance-based billing (`--no-cpu-throttling`), `--min-instances=1`, concurrency about 40 because resvg holds the CPU.
- **Cloud SQL PostgreSQL 17, Enterprise edition**, Unix-socket connection, pool of about 5 per instance. Migrations as a Cloud Run job before the traffic shift.
- **Region:** asia-southeast1 (Singapore), or asia-south1 (Mumbai) if Nepal dominates; Cloud Run and Cloud SQL together, Gemini on `global`.
- **Secrets** in Secret Manager, pinned to versions; a dedicated runtime service account with the minimum roles; `DEV_LOGIN_SECRET` never set in production.
- **Background steps** (`after()`: vision checks, 10–60 s) backed by a Postgres lease so a step cut off by scale-in can be claimed again; Cloud Tasks later.

**Why:** Firebase App Hosting cannot build with Bun, stops at Next 15.2, has no Mumbai or Sydney region, and gives no control over the native resvg binary and the fonts. `after()` needs CPU outside the request, which only instance-based billing gives. Cloud Run allows 10 s between SIGTERM and SIGKILL, less than one vision check. Enterprise Plus is the default for PG16+ and costs more for nothing we use. Two weeks of infrastructure comes to about **$45–55 before Gemini**, within the trial credit, but trial accounts cannot raise quotas, so a paid billing account if 429s are a risk.

---

## 7. What we fix before 18 Oct · Status: decided, Nikhil, 7 Oct

The research produced a 14-item list. We cut it to three fixes on the admin branch, each half a day:

| Keep | Why |
|---|---|
| Image generation moves to `gemini-nano-banana-2.1` through `generateContent`; default location `global`; image finish reasons handled as "use the fallback cover" | `ai/vertex.ts` still calls Imagen and `ai/config.ts` still defaults to `us-central1`. No cover art can be generated until this changes. |
| Sentence splitting keeps `Intl.Segmenter` and adds a merge pass for abbreviations, initials and quoted speech (no library) | `Intl.Segmenter` cuts "Dr." and "Rs." into their own sentences, identically on Node and Bun. The effect today is spurious claims and extra judge calls, not missed errors: useful rather than urgent. The research's `sentence-splitter` was tested on 7 Oct and rejected: it merges "…pays AUD 499. Above 20 hours…" into one sentence, failing our existing probe; `sentencex` merges "p.a. Living costs…". The merge pass passed all four fixtures on both runtimes. |
| A glyph check in the fit step | Only the brand font is loaded, so an emoji or Devanagari character in a draft renders blank. The check refuses the text with a reason instead. |

The per-model capability map, labels, `maxOutputTokens` and the Flash-Lite tier from section 1 ride along with the first fix where they touch the same files; the rest of section 1 lands as the Gemini connection is tested.

| Dropped or after 18 Oct | Why |
|---|---|
| JSON field ordering (`propertyOrdering`) | Unnecessary: the API keeps schema key order on all current models, and zod 4 preserves it. |
| Extra judge labels ("contradictory", "needs no source") | The editor's existing "opinion" mark already covers connective sentences, and "not found" already blocks. |
| Number-parsing test oracle (Recognizers-Text) | A package untouched since 2023 that confuses percentage points with percent. |
| Ready-made step-trace UI components (AI Elements) | Built around Vercel's AI SDK message shapes; the Workbench already shows steps. |
| Embedding router, semantic cache, ADK research service, route comics | New features from sections 2–4, one to two days each, not fixes. Which one, if any, ships before 18 Oct is decided with Jenish. |
| Shaping-aware text measuring (harfbuzzjs), emoji as images, LinkedIn PDF, hybrid search, zero-retention hardening, Cloud Tasks | Real improvements with no demo value this month. |

**Why the trim:** eleven days remain and the list was about ten days of engineering, before the Gemini connection (waiting on credentials), the pull request and the deployment.

---

## 8. Reuse policy for the model layer · Status: decided, Nikhil, 7 Oct

Libraries and ported ideas, never copied apps or frameworks.

**Why:**
- Nothing found does our distinctive parts better: fit-checked layout, code-decided number and quote checks, the fake provider and replays. Google's samples supply current API shapes but stale model IDs; the Python fact-checking projects supply algorithms short enough to port.
- The competition's fresh-code clause makes a copied component look like pre-existing work; an npm dependency does not. Its right-of-first-refusal clause means we must be able to grant an exclusive licence, so nothing AGPL or "commercial licence required".

**Rule:** permissive licence (MIT, Apache-2.0, BSD, ISC) only; every library and every ported idea named in a "third-party code" section of the README.

---

## 9. Open items · Status: owners proposed

| Item | Owner | By |
|---|---|---|
| Vertex credentials: enable the Vertex AI API, Application Default Credentials or a service-account key, `.env` settings | Jenish (project owner, ADR-098) | this week |
| Image path, splitter, glyph check on the branch | Nikhil | 10 Oct |
| `ai:smoke`, `ai:eval`, `ai:replays` against real Gemini; un-skip the replay e2e; log `usageMetadata` to replace the assumed token counts | Nikhil, once credentials exist | 12 Oct |
| Log-based metrics and the spend-cap budget created in the project | Jenish | before the first deployed demo |
| Which of sections 2–4 ships before 18 Oct, if any | Both | 9 Oct |
| README third-party section | Nikhil | 15 Oct |
