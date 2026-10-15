---
id: ADR-079
title: "Every claim shows how strong, how we know and how sure; weak claims become research questions"
status: accepted
date: 2026-10-01
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-079 · Every claim shows how strong, how we know and how sure; weak claims become research questions

## Decision

- Every claim on a future card, trade-off card or route step (e.g. "a smaller IT job market than Perth") carries: a **strength band** (e.g. moderate ● ● ○ ○ ○) with the number behind it on tap (ADR-012); **how we know** (source and date); and **how sure we are** (the data state: confirmed / estimated / unknown / out of date / conflicting).
- **Where real outcome data exists, use it:** Australia's graduate outcomes survey gives employment rates by field and institution ("graduates in this field from this university: 78% in full-time work within four months, survey 2025"); job-posting counts give market size; these are sourced figures, not predictions. Predictions about *this* student (PR likelihood) stay bands without a number (ADR-012).
- A claim shown with weak or no evidence is flagged "we're not sure about this yet" to the student and becomes an **evidence gap** in the admin app, ranked by how many students have seen the claim. Researching it (content team or counsellor) attaches a source; every future and route that used the claim updates.

## Reasoning

A bare comparative ("smaller job market") gives the student no way to tell fact from guess; a band, a source and a confidence level do (Nikhil, 1 Oct). Turning weak claims into a ranked research backlog is how the knowledge base grows where students actually look.

## Constrains

`Fact` gains `strength_band` and `exposure_count`; Insights gains an **Evidence gaps** list feeding the ideas queue (ADR-042) as research tasks. Hackathon: bands + source line on the future cards; one claim marked "not sure yet"; a static Evidence gaps block in Insights.
