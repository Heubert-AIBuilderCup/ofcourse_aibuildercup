---
id: ADR-063
title: "Content adapts to nationality and cultural context"
status: accepted
date: 2026-10-01
amended_by: [ADR-109]
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-063 · Content adapts to nationality and cultural context

## Decision

- Every content blueprint has **cultural slots**: currency and figures ("about 32 lakh" beside AUD 36,000), examples and analogies, who makes the decision (the family, where that is true), the calendar (Dashain, exam seasons), and tone.
- Slots are filled **per market** (Nepal first; India and others later), and a **reviewer from that culture** signs off the variant.
- The student's passport country selects the variant. Art persona variants (ADR-019) extend the same way.

## Rules

- **Adapt the example, never the fact.** Numbers and rules stay identical across variants.
- Shared context, not stereotypes; variants are reviewed for this.

## Reasoning

The same fact lands very differently depending on context; culturally grounded examples are what make a lesson feel like it was written for the student (Nikhil, 1 Oct).

## Constrains

Blueprint schema gains a `market` dimension; the content pipeline renders one structure into several variants; admin shows variants side by side. Hackathon: one Nepal-adapted example in a demo post is enough.
