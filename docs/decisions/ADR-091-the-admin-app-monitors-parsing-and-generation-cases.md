---
id: ADR-091
title: "The admin app monitors parsing and generation cases"
status: accepted
date: 2026-10-02
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-091 · The admin app monitors parsing and generation cases

## Decision

A **Parsing** screen in the admin app shows each student message with router labels and confidences, parser outputs, validation failures, and what the student did next (confirmed / fixed / ignored); a review queue of low-confidence and corrected cases; per-parser accuracy from corrections; tag themes. The same view lists offset suggestions (G10) and course "whys" (G9) awaiting review. Corrections become eval cases.

## Reasoning

Human-in-the-loop only works if humans can see what the model did and where it was corrected (Nikhil, 2 Oct); it is also the clearest demonstration of rigour for the judges.
