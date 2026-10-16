---
id: ADR-011
title: "The board shows one route at a time; a separate Compare view puts 2 to 4 saved routes side by side"
status: accepted
date: 2026-09-30
amended_by: [ADR-038]
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-011 · The board shows one route at a time; a separate Compare view puts 2 to 4 saved routes side by side

## Decision

The Decision Studio board shows a single route at a time with a switcher. Side-by-side comparison of 2 to 4 saved routes, with their trade-offs, happens in a separate Compare view.

## Reasoning

- The isometric board reads best as one map; several at once would crowd it and lose the design Nikhil wants to keep.
- ADR-005 still holds: comparison is the core output. It moves to its own view rather than being squeezed onto the board.

## Constrains

Refines ADR-005. Compare view is a first-class surface with the trade-off object per route. Resolves Q2 / D2.
