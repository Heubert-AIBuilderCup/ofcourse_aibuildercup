---
id: ADR-014
title: "Answers are editable live, sealed courses can be walked, and the student sees why"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-014 · Answers are editable live, sealed courses can be walked, and the student sees why

## Decision

A student can tap any earlier answer to change it; the board re-ranks and re-seals live, with no restart. A sealed course can still be walked: its blocker is the first gate, with the ways to unblock it (bridging course, pathway course, another country). The student sees why a question is asked and why a course ranks where it does ("asked because you weighted PR high"; "ranked up for cost"); the scoring maths stays hidden.

## Reasoning

- Shared answers (ADR-004) only work if answers are editable in place.
- Seeing the way past a blocker is the value of a sealed course; hiding it would hide a real future.
- Explaining the why fixes the extractive feel of profiling without exposing internals a student could game or misread.

## Constrains

Resolves D5, D6, D7 and Q5. Dead ends are visual, never locks. Every question and ranking carries an explain string.
