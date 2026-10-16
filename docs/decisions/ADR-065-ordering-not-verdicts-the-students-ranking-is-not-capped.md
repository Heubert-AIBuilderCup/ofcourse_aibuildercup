---
id: ADR-065
title: "Ordering, not verdicts; the student's ranking is not capped"
status: accepted
date: 2026-10-01
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-065 · Ordering, not verdicts; the student's ranking is not capped

## Decision

- To avoid decision paralysis, the system may **order** options by closeness to the student's values and say so ("sorted by how well they fit what you weight"). It never labels one "best", "recommended" or "ranked 1st", and every option keeps its good and bad (ADR-060).
- The **student ranks as many options as they like**; the top few show first, the rest a scroll away. Switching between realities and comparing them is unchanged (ADR-011, ADR-038).

## Reasoning

A scannable order prevents paralysis; a verdict ends exploration. Three was an arbitrary cap (Nikhil, 1 Oct).

## Amends

ADR-038 (ranking uncapped); ADR-060 (ordering allowed, verdicts still not). Compare shows any ranked routes, a few at a time.
