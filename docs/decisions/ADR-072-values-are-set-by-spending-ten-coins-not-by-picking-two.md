---
id: ADR-072
title: "Values are set by spending ten coins, not by picking two"
status: superseded
date: 2026-10-01
superseded_by: ADR-078
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-072 · Values are set by spending ten coins, not by picking two

## Decision

- The first values question is a **constant-sum allocation**: the student spends **10 coins** across the six route dimensions (plus Family when they have dependants). Maximum 5 on one pile; all ten must be placed. The piles map directly onto the weights.
- Piles start empty. "Not sure" fills an even spread and marks the weights as an **assumption** to revisit (ADR-058), never as stated values.
- As each coin lands, one line shows its effect ("Cost at 3: regional campuses start to lead"), the preview mechanic of ADR-049.
- Life values (ADR-068) are a second, optional coin round later, not in the opening. The remaining opening questions (flexibility on where you live, stay after, how soon) stay as taps.

## Reasoning

- "Pick up to two" captures which values matter but not how much, and asks for no trade-off; weights need intensity (Nikhil, 1 Oct).
- Spending a fixed budget is honest about scarcity in the same way the product is, maps straight onto weights, and fits the game feel (ADR-045). Best–worst scaling is more reliable in research but hides the weights from the student and feels like a survey.
- Capping piles and refusing an even default counter the known failure of constant-sum questions (flat spreads).

## Constrains

Weights 0–3 derive from coins (0 → 0, 1–2 → 1, 3 → 2, 4–5 → 3) or the scale is changed to 0–5; the engine takes whichever the team picks, consistently. Round-6 design: replace question 1 with the coin screen.
