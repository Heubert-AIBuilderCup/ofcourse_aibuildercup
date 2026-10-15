---
id: ADR-054
title: "Defaults decided on delegation"
status: accepted
date: 2026-09-30
status_note: "decided by Claude at Nikhil's request"
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-054 · Defaults decided on delegation

## Decision

1. **Demo formats:** sketch insight and article carousel (one single image, one multi-slide; neither needs illustrated portraits).
2. **Formats per page (provisional until the real page list exists):** main page — editorial cover, article carousel; cerebral page — sketch insight, minimal concept; infographics page — metaphor grid; books page — book explainer; comics page — comic strips; portal feed — all.
3. **Cut order if time runs short:** maintenance queue → ideas queue → insights → brands editor → video → targeted update becomes a static mock. Never cut: the student path (sign-up, Ask, board, route detail, rank and compare, feed item) and the admin core (gap list → structures → render; one new-post flow).
4. **Language:** English only for the prototype and first release; all text kept outside layouts, comic text drawn by code in slots, so Nepali can be added later.
5. **Words in images for the prototype:** drawn by code by default (Walk screenshots showed baked-in comic text unreadable on phones). ADR-008 stays proposed until the test: ten real marketing posts, both ways, in week two.
6. **Feed defaults:** ≤ 3 opportunity items per student per week; ≤ 1 check-in per week; one personal item per four posts; featured pinned for 72 hours. Tune from S8 metrics.

## Reasoning

Each is a design or engineering default that is cheap to change and where the evidence in this record is clear. Nikhil asked for these to be decided rather than left open (30 Sep).

## Left with Nikhil (recommendation only)

- **Promotion pricing:** recommend a flat fee per campaign or bundling into the partnership agreement; avoid per-click / per-impression pricing, which rewards pushing promotions and undermines ADR-053.
- **Maintenance queue owner:** recommend one named compliance owner, \~2 hours a week to start.
- **Legal checks:** migration-advice framing (registered agents), UK/EU consent, the book page.
- **Real Instagram page list; image/video models** (after the test); **post-study moves** (Q6, parked).
