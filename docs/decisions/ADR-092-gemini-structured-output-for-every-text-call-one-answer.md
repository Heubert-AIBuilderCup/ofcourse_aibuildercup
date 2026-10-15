---
id: ADR-092
title: "Gemini structured output for every text call; one answer contract for every RAG output"
status: accepted
date: 2026-10-02
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-092 · Gemini structured output for every text call; one answer contract for every RAG output

## Decision

- All text use cases use Gemini's **structured output mode** (JSON + response schema). Schemas are defined once in Zod and converted, so contract and validator stay identical; code still validates truth (quotes, numbers, citations, lengths).
- Every RAG output (research answers, course whys, offsets, claim updates) uses **one answer contract**: text, claims (each with source ids, quote and value), sources (title, URL, publisher, date, kind), strength band, data state, confidence, quotable flag, missing, follow-ups. Nothing is shown without a source.
- If grounded search and a response schema can't be combined in one request, use two calls (grounded → structured).

## Reasoning

Constrained decoding removes most malformed outputs; a single contract means the student UI, the admin review screen, the evals and the answer library all read the same shape (Nikhil, 2 Oct).

## Constrains

Spec in `HACKATHON-genai-build-plan.md` Part B (top). The answer library stores this contract. D1 spikes confirm structured output and the grounding combination.
