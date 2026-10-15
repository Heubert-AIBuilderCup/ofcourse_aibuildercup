---
id: ADR-029
title: "Persona variant chosen by an optional sign-up question"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-029 · Persona variant chosen by an optional sign-up question

## Decision

At sign-up the portal asks an optional question: "How should we picture you?" (male / female / prefer not to say), used only to pick the comic character. Neutral if skipped.

## Reasoning

- Keeps ADR-019's rule: the persona comes from what the student chose to share, never from a name or photo.
- Asked once, at sign-up, so it never interrupts the Studio.

## Constrains

The answer is stored as a display preference, not as a demographic field, and is not used for anything else.
