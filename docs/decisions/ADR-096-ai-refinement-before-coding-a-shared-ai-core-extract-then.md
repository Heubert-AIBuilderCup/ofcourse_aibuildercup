---
id: ADR-096
title: "AI refinement before coding: a shared AI core, extract-then-normalise, research recipes, an anti-slop guard, and consistent characters"
status: accepted
date: 2026-10-02
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-096 · AI refinement before coding: a shared AI core, extract-then-normalise, research recipes, an anti-slop guard, and consistent characters

## Decision

- **A shared AI core** is built before any use case: schema registry (Zod → Gemini response schemas), one LLM client (structured output, retries, fallbacks, safety handling), cache, logger, prompt registry, eval runner, normalisers.
- **Parsing extracts what was said; code normalises** money, dates, places and fields. Every fact carries its **subject** (self, partner, child, relative). Confidence is computed from evidence, not taken from the model. Short replies are tried against the last question first; the current screen's parser runs speculatively alongside the router.
- **Research uses recipes** per question type (visa rule, cost, job market, course fact, general) with preferred source tiers, an excluded list, page fetching for verifiable quotes, freshness windows, and per-claim review. Library matching filters by metadata before similarity. The personal part of an answer is computed by the engine, not regenerated.
- **Generation follows a style guide and a banned-phrase lint**; draft diversity comes from different templates; templates are JSON data.
- **Comic characters use an approved character sheet per persona** as the reference for every panel.

## Reasoning

Gap analysis before coding (2 Oct): models are unreliable at conversion and arithmetic; facts about other people were unattributed; unconstrained search returns marketing; unguarded copy drifts into generic text; image models do not keep a character consistent. Full detail and the revised build order in `HACKATHON-genai-refinement.md`.
