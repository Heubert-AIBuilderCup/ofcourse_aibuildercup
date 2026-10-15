---
id: ADR-087
title: "Course matching uses RAG over the product database; rules order, the model explains with citations"
status: accepted
date: 2026-10-02
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-087 · Course matching uses RAG over the product database; rules order, the model explains with citations

## Decision

Course recommendations are a Gen AI use case (**G9**): the student's interests and free text are embedded and matched against course descriptions (semantic retrieval, ADR-074), filtered by hard constraints (budget limit, level, destination, eligibility), then **ordered deterministically** by fit to her weights (ADR-065). Gemini writes the "why" for each card **grounded only in the retrieved course text and her profile**, citing the passages it used. The model retrieves and explains; it never decides order or eligibility.

## Reasoning

RAG over the product database is how synonyms and related topics actually find courses, and grounded explanations make each match trustworthy (Nikhil, 2 Oct; ADR-024).

## Constrains

Course embeddings stored with the mock catalog; a G9 spec in `HACKATHON-genai-build-plan.md`.
