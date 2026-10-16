---
id: ADR-086
title: "Relatives and friends nearby are asked for by place; locations drive \"near\" recommendations"
status: accepted
date: 2026-10-02
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-086 · Relatives and friends nearby are asked for by place; locations drive "near" recommendations

## Decision

- When community or relatives nearby matters, ask: **"Do you know anyone who lives in Australia? Where?"** (city or suburb, and relationship: family / friend / community). Stored as `relatives_in[]` with a location.
- Campuses, suburbs and cities carry **locations** in the data; routes show **distance or commute from people the student knows** ("Curtin Bentley: 25 min from your cousin in Cannington"), and Location good-and-bad uses it.
- Locations are only the student's own statements, used for this purpose, editable and removable; no one else's personal data is stored beyond a place and a relationship.

## Reasoning

"Community matters" is only useful if we know where the student's people are (Nikhil, 2 Oct).

## Constrains

Mock data: coordinates for campuses and suburbs; Priya has a cousin in a Perth suburb. Commute is a straight-line or mock estimate in the prototype.
