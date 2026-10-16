---
id: ADR-042
title: "The admin app suggests content to research"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-042 · The admin app suggests content to research

## Decision

The admin app keeps an **Ideas queue**: topics the AI suggests researching, each with the evidence behind it, a suggested format and page, and candidate sources to start from. An editor accepts an idea into a research task or draft, or dismisses it. Suggestions never publish anything on their own.

## Where suggestions come from

- Questions students ask in Ask and in the feed that no content answers.
- The gap list: trade-offs, destinations and courses students hit that have little coverage.
- Engagement: formats and topics that performed well on a page, and their natural follow-ups.
- The calendar: intake deadlines, scholarship closes, visa-rule changes coming up.
- Catalog changes: a new rule or program worth explaining.
- Later: what is trending on the platforms themselves.

## Reasoning

- The team's bottleneck is deciding what to make as much as making it; the system already sees demand the team cannot (Nikhil).
- Suggestions grounded in evidence turn the insights page from a report into a to-do list.

## Constrains

Every suggestion shows its evidence ("31 students asked about part-time work rules in Canada this month"). Candidate sources are starting points; the research and the source check (ADR-035) still happen before publishing. Dismissals are remembered so the same idea is not re-suggested.
