---
id: ADR-099
title: "The AI detailed specification is the build contract for G1–G10"
status: accepted
date: 2026-10-02
amended_by: [ADR-113]
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-099 · The AI detailed specification is the build contract for G1–G10

## Decision

`HACKATHON-ai-detailed-spec.md` defines, for every Gen AI use case, the data contracts, the prompts (with versions and model tier), the mechanism, a case matrix (common / less common / fallback) and the evals. It sets shared conventions: primitive types, provenance on every value, the common answer contract, confidence computed in code, a six-level fallback ladder (cache → primary → retry → secondary model → deterministic → human or replay), a common system preamble, a banned-phrase lint and the call log. Where it differs from the build plan or the refinement, it wins.

## Reasoning

Planning the uncommon cases and fallbacks before coding is what keeps a live demo from failing and keeps generated content honest (Nikhil, 2 Oct).
