---
id: ADR-022
title: "Data ownership and freshness"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-022 · Data ownership and freshness

## Decision

The compliance/counselling team owns visa, PR and eligibility facts; the content team owns course scores and descriptions. Every fact carries a review-by date and is re-checked when it expires.

## Reasoning

- Matches the catalog's owner\_role and validity-window design.
- A review-by date turns "someone should check this" into a queue.

## Constrains

Expired facts flag dependent content and plans as Needs review (S5.2, A4.3). Resolves D10 (data ownership).
