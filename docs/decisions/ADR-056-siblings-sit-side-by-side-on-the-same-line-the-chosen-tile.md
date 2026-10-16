---
id: ADR-056
title: "Siblings sit side by side on the same line: the chosen tile, one alternative, one stack"
status: accepted
date: 2026-10-01
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-056 · Siblings sit side by side on the same line: the chosen tile, one alternative, one stack

## Decision

- Options at the same level (cities, courses) sit **on the same line, at the same depth, side by side across the road**, never trailing up or down a separate branch.
- On the board each level shows **the chosen tile on the road, one alternative beside it** (the next best match), and **one stack** at the end of that line holding the rest ("12 more in Perth · 3 match well").
- Choosing the alternative **swaps it onto the road** (a shared-element move); the previous choice becomes the neighbour. The road ahead re-routes through the new choice.
- The wider choice of three cards lives in the Find deck and in Compare, not on the board.

## Reasoning

In the round-4 board the alternatives climbed a separate zigzag away from the chosen course, so they read as another road instead of a choice at the same point (Nikhil, 1 Oct). A fork is a moment where options are side by side; drawing them that way makes the choice legible and keeps the board within the object budget.

## Amends

ADR-051: "three choices plus one stack" becomes "chosen + one alternative + one stack" on the board.
