---
id: ADR-115
title: "Current Gemini models on the global endpoint; Nano Banana 2.1 replaces Imagen"
status: accepted
date: 2026-10-07
---
# ADR-115 · Current Gemini models on the global endpoint; Nano Banana 2.1 replaces Imagen

## Decision

The admin's model layer calls Gemini on Agent Platform (formerly Vertex AI) at location `global`, with these models: `gemini-3.5-flash-lite` (minimal thinking) for the router, the judge, captions, the market rewording and the course "why"; `gemini-3.8-flash` (low thinking) for drafting, vision QA and research extraction; `gemini-3.1-pro-preview` (medium thinking) for claim extraction and as the retry tier, with 3.8 Flash at high thinking as its GA fallback; `gemini-nano-banana-2.1` through `generateContent` with `imageConfig` for cover art; `gemini-embedding-001` at 768 dimensions for embeddings. Code holds a per-model capability map and validates every call against it: allowed thinking levels, whether temperature is honoured, no penalties, `maxOutputTokens` with headroom, billing labels on every call, safety filters left at their default OFF with the non-configurable outcomes handled in code.

## Reasoning

- Imagen was shut down on 17 Aug 2026 and Gemini 2.5 retires on Agent Platform on 20 Oct 2026, the day after judging starts. The code still called Imagen from `us-central1`; neither path works.
- Nano Banana 2.1 is served from `global` only and returns an error for temperature, seed, topP and topK; 3.8 Flash returns a 400 for minimal thinking; 3.6 Flash and later ignore temperature. A wrong value fails rather than degrades, so the rules live in code, per model.
- Flash-Lite is what Google positions for routing, extraction, tagging and classification; using it for the cheap steps is where ADR-077's "as little AI as possible" becomes a cost line.

Sources and the per-use-case settings are in `reports/Google AI stack for OfCourse.md`.

## Rejected alternative

Firebase Genkit as the model layer: its Google plugin bypasses `@google/genai`, does not know the current model ids, and would replace the fake provider and the replays nine days before judging.

## Constrains

Amends ADR-112 where it names Imagen. Model ids and the location are configuration; the capability map is the only place that knows what each model accepts. Determinism comes from the database cache, never from sampling settings.
