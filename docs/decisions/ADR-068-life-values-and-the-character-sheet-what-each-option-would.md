---
id: ADR-068
title: "Life values and the character sheet: what each option would improve or cost in the student's life"
status: accepted
date: 2026-10-01
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-068 · Life values and the character sheet: what each option would improve or cost in the student's life

## Decision

- Alongside the six **route dimensions**, the student weights a set of **life values**: health, social life, financial life, learning and growth, closeness to family, independence, adventure (list to be refined). Weighted once, as values, ideally via a values sort (ADR-069).
- Every option shows what it would move on a **character sheet** of those values ("regional Tasmania: financial life up, social life down, independence up"), framed as what it would improve or cost, never as a score to maximise. There is no "best life".
- Life-value effects are mostly qualitative or estimated; they carry the estimated / unknown data states and are refined over time from what students report about their own experience (with consent).

## Reasoning

Weighting values gives students a clearer picture of their own goals and lets each option give feedback about who they would become, like a character's stats (Nikhil, 1 Oct). It extends ADR-060's good-and-bad from the route to the life.

## Constrains

Life-value effects are stored as `Effect` records (ADR-067) on life dimensions. Hackathon: a static character sheet for Priya with two options moving it.
