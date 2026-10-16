---
id: ADR-106
title: "The engine is Jenish's; \"might feel\" uses sign × weight plus a cost size rule"
status: accepted
date: 2026-10-05
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-106 · The engine is Jenish's; "might feel" uses sign × weight plus a cost size rule

## Decision

- **Jenish builds the engine** (futures, weights and feel) in the student opening slice.
- **"Might feel" for the hackathon:**
  - Gives you: relieved at weight 2 or more, else fine.
  - Neutral: fine.
  - Costs you: hard at weight 3, stretched at weight 2, else fine.
  - Cost only: a route over budget is at least stretched, and more than 20% over is hard, whatever the weight.
- **Effect-size thresholds for every dimension come after the hackathon** (owner: Nikhil).

## Reasoning

ADR-098 allowed sign × weight if effect size got complicated. With a mock catalogue of about twelve courses there is no effect-size data per dimension except cost (Jenish, 5 Oct). Jenish was free first, which is ADR-097's rule for the engine.

## Supersedes / amends

Amends ADR-098 (engine owner; "might feel"), ADR-097 (the DS-Q5 answer) and, for the hackathon only, ADR-089.
