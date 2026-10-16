---
id: ADR-005
title: "The product visualises multiple realities and their trade-offs — comparison is the core"
status: accepted
date: 2026-09-29
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-005 · The product visualises multiple realities and their trade-offs — comparison is the core

## Decision

The system's job is to let the student **see several possible futures side by side** — as concrete routes from the root — and to show the **trade-offs between them, visually**, including trade-offs *derived from the student's own preferences*. Comparison with visual trade-offs is the primary output, not a ranked list.

## Reasoning

- This is the direct answer to failure #1 and #2: futures are compared on one surface, and each future is a *route* (course → visa → work rights → PR) so the invisible stages become visible.
- Trade-offs stated honestly and paired with what offsets them ("Perth rent is 30% below Sydney") are more persuasive and more trustworthy than a single "best" answer — and they keep the decision the student's own, which is the point of a counsellor-gated product.
- A ranked list hides the shape of the decision. A comparison exposes it. The student should leave knowing *what they're choosing between*.

## Constrains

The engine returns *a set of routes with per-dimension trade-offs* (cost, time, work rights, PR odds, location), not just a score. The Studio renders them for comparison; the Journey unrolls the promoted one. Trade-off visuals are a first-class deliverable, not decoration.
