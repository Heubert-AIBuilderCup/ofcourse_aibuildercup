---
id: ADR-015
title: "One admin app, two content streams; common cases pre-generated, uncommon ones surfaced by frequency"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-015 · One admin app, two content streams; common cases pre-generated, uncommon ones surfaced by frequency

## Decision

The admin app produces both route trade-off comics (from engine data) and marketing posts (from pasted sources), sharing brand rules, templates and the approval flow. Common route cases are defined and generated in advance. Cases the system is not ready for are surfaced in the admin panel ranked by how often they occur, so staff generate comics or videos for the ones that matter.

## Reasoning

- One pipeline and one brand voice for both streams (Nikhil: "one ecosystem").
- Pre-generating the common cases keeps the student experience complete; frequency-ranking the rest spends effort where it pays.

## Constrains

The insights page gets a concrete job: a "not yet covered" list ranked by frequency, each with a Generate action. Resolves D8.
