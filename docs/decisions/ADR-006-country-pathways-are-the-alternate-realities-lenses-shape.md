---
id: ADR-006
title: "Country pathways are the alternate realities; lenses shape how each is evaluated"
status: accepted
date: 2026-09-29
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-006 · Country pathways are the alternate realities; lenses shape how each is evaluated

## Decision

The country pathway maps (Australia, UK, Canada) describe **a reality** — the concrete stages, rules and options of pursuing that destination. They are the things the student compares. The lenses (ADR-002) determine *which questions and trade-offs* apply within each reality. So: **realities are compared; lenses evaluate.**

## Reasoning

- Cleanly separates two different kinds of knowledge that the mind maps mixed: *what a destination is like* (AU: metropolitan vs regional, WIL, SOL for PR, funding) versus *what a student cares about* (career, funding, speed). Conflating them is what made the trees look like forks.
- A career-focused student and a funding-focused student compare the *same* AU reality but see different trade-offs highlighted — exactly the "career-focused wants UK" case, handled without a bespoke branch.

## Constrains

Country pathways encode to the *catalog's structured entities* (Destination, Visa, Occupation, IntakeCalendar — implementation plan §7 W1), with the deterministic rules (SOL/NOC/Graduate Route) as sourced facts. Lens trade-offs are computed *against* those entities, never asserted by the model.
