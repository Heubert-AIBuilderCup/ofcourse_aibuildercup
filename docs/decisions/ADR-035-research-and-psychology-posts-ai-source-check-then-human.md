---
id: ADR-035
title: "Research and psychology posts: AI source check, then human sign-off"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-035 · Research and psychology posts: AI source check, then human sign-off

## Decision

Before publishing, an AI check tests whether each claim in the post appears in the linked source and flags anything it cannot find. A human reviewer then signs off.

## Reasoning

- The AI check is cheap and catches the common failure (a claim the paper never made); the human catches the subtle ones.

## Constrains

A flagged claim blocks publishing until resolved. Applies to the research and psychology tiers of ADR-018.
