---
id: ADR-059
title: "Feed relevance for retention, and what the admin app shows"
status: accepted
date: 2026-10-01
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-059 · Feed relevance for retention, and what the admin app shows

## Decision

- **A student's feed is composed, not just ranked.** Each week: one **"this week"** item (the single most useful next step, in the guide's voice), one **watcher** item (something moved or opened), one **learning** item tied to the next step on their road, general posts with one featured, and a check-in when an assumption is stale.
- **Ranking signals:** match to route and phase; deadline proximity; knowledge gap (what they haven't covered yet); variety. Every item says why.
- **The admin app shows the same data from the other side:** where students are on their roads; which gates they stall at longest; what is on watchlists (demand for content and promotion); which route steps have no lesson yet (coverage); whether "this week" items get done; return rate. The ideas queue draws from these.

## Reasoning

Retention depends on the feed being useful every week, not merely relevant on average (Nikhil, 1 Oct). Items produced by the watcher checking each plan against new data are relevant by construction; composition guarantees the next step is always there.

## Constrains

Posts carry targeting metadata (phase, route elements, dimensions, fields, destinations). Students carry state (phase, routes, weights, watchlist, lessons read). Metrics: "this week" completion and weekly return rate join S8. Admin screens for this are static mocks in the hackathon (ADR-057).
