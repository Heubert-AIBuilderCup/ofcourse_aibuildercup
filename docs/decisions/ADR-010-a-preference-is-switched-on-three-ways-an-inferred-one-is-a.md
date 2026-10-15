---
id: ADR-010
title: "A preference is switched on three ways; an inferred one is a suggestion until confirmed"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-010 · A preference is switched on three ways; an inferred one is a suggestion until confirmed

## Decision

A preference (and the follow-up questions it activates) is switched on by a stated preference, by an explicit toggle, or by the AI reading the student's free text. An AI-inferred preference is shown as a suggestion the student confirms; it does not activate anything or set a weight until confirmed.

## Reasoning

- Chat-or-click intake (the Ask panel) means students express preferences in different ways; supporting all three avoids forcing one.
- Inference is the smoothest path but the riskiest; confirmation keeps the student in control of what shapes their map (consistent with the human-confirm rule in the Technical Design).

## Constrains

The Ask panel shows inferred preferences as confirmable chips. Weights and question activation read only confirmed preferences. Resolves Decision Record Q1 / Requirements D1.
