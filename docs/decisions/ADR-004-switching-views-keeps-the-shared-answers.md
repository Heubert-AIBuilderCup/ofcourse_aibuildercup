---
id: ADR-004
title: "Switching views keeps the shared answers"
status: accepted
date: 2026-09-29
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-004 · Switching views keeps the shared answers

## Decision

When the student switches between realities (e.g. the UK view → the Canada view, or a scholarship-weighted view → a speed-weighted view), **every answer they have already given is retained and reused**. Only questions the new view *additionally* needs are asked. Answers are owned by the profile, not by the view.

## Reasoning

- Comparison (failure #1) is impossible if each view demands its own interrogation — the student would abandon before the second view. Shared answers make switching cheap, and cheap switching is what makes comparison real.
- It is also correct: "my budget is 25 lakh" is a fact about the student, not about the UK. Storing it per-view would be a data-modelling error that invites contradictions.
- This is the same principle as the OfCourse loop ("each surface writes into the next" — answers editable in place, in the thread) applied across views.

## Constrains

A single `Student` record is the store; views are *projections* over it. A view may add fields; it may never own them. The Studio's "one active path" rule applies to what's *promoted*, not to what's *answered*.
