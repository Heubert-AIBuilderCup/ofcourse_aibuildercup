---
id: ADR-019
title: "Shared renders with persona variants; full personalisation only with consent"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-019 · Shared renders with persona variants; full personalisation only with consent

## Decision

Renders are shared by default: one per route or post, reused for everyone. Where a scene shows a person, a small set of persona variants is rendered (male, female, gender-neutral; cultural context later), chosen from what the student has shared, neutral by default. Only the character changes; the facts, trade-off and scene stay identical. Full personalisation (the student's own photo or name) only where a format calls for it and with the student's consent.

## Reasoning

- Variants keep the cost of a shared render (three instead of one, all cached) while letting students see themselves.
- Changing only the character prevents stereotyped variants and keeps the content the same content.
- Persona is chosen from what the student shared, never guessed from a name or photo.

## Constrains

Cache key includes the variant. Resolves D14 (revised 30 Sep).
