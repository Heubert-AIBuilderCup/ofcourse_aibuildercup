---
id: ADR-001
title: "The student's root is their current reality — a fixed node, never a choice"
status: accepted
date: 2026-09-29
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-001 · The student's root is their current reality — a fixed node, never a choice

## Decision

The graph of possible futures has exactly one root: **where the student is right now** — their situation, preferences and constraints as they state them. The student is never asked to pick a starting "type" or "path." The root is populated from their preferences; everything else grows from it.

## Reasoning

- A student cannot meaningfully choose a starting archetype before they understand the options — the choice would be uninformed and would *hide* the futures that don't fit the archetype. That reproduces failure #2 (the route is invisible).
- "Where you are" is the only thing every student can answer honestly on day one. Preferences are cheap to state; identity labels are not.
- Anchoring on the present makes trade-offs concrete: every future is measured as a *delta from here* (more cost, longer, better PR odds), which is how humans actually reason about a decision.

## Rejected alternative

Asking the student to select a path (Exploratory / Fast-Track / Scholarship / Career / Country-Specific) as the first step, then branching. Rejected because the paths are not mutually exclusive (see ADR-002) and a forced first choice discards real futures.

## Constrains

The OfCourse **Ask** surface opens with situation and preferences, never a path picker. The Student entity (implementation plan §3) is the root record. The Studio graph is rooted at one node.
