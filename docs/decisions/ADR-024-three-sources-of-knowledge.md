---
id: ADR-024
title: "Three sources of knowledge"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-024 · Three sources of knowledge

## Decision

The system reasons over three sources: the student's profile; the regulations knowledge base (visa, PR, costs, scholarships, with the questioning pathways kept there as counsellor-maintained knowledge); and the product database of courses, searched by RAG against the student's preferences.

## Reasoning

- Keeps the split clean: facts about the student, facts about the rules, facts about the products.
- The pathways are knowledge, not code, so counsellors can update them (ADR-023).

## Constrains

Amends ADR-023. Every recommendation cites which source each fact came from.
