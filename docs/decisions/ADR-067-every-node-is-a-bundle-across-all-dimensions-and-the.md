---
id: ADR-067
title: "Every node is a bundle across all dimensions, and the interactions between attributes are stored as effects"
status: accepted
date: 2026-10-01
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-067 · Every node is a bundle across all dimensions, and the interactions between attributes are stored as effects

## Decision

- **A node is never one variable.** Every destination, city, campus, course and route step carries a profile across all six dimensions (plus Family): e.g. a city is a place to live, a part-time job market, a set of PR points and a cost of living at once. Each attribute has its own source and data state.
- **Interactions are stored explicitly as effects:** cause → affected dimension → direction → size (where known) → evidence. Examples: regional campus → PR pathway up (regional points), work rights & experience down (fewer part-time jobs), cost down (rent); a course with work-integrated learning → career prospects up via internships; a big city → income during study up, cost up.
- **A route's outcome is the composition** of its nodes' bundles and effects along the path. The trade-off cards, the good-and-bad view (ADR-060), the flexibility deltas and the "life after" segment (ADR-066) all read from this composition.
- Effects are **knowledge, maintained by counsellors** in the regulations knowledge base (ADR-024), never hard-coded, so they can be corrected and dated.

## Reasoning

Treating each tile as one value would hide exactly the trade-offs students need to see (studying while working, suburbs vs city job chances, internships feeding a career) (Nikhil, 1 Oct). Storing effects explicitly also makes the engine's reasoning auditable.

## Constrains

Implementation plan: Campus/City (C, D), Course (A), work rights (E) and occupation (G) attributes populate the bundles; a new `Effect` record and an effects pass in the engine (W3). Hackathon: the mock data carries bundles and a handful of effects for the Australia set so the trade-off cards are computed, not typed.
