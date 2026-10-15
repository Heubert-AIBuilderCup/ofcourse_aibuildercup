---
id: ADR-073
title: "A new value: closeness to a community of similar culture, or to relatives"
status: accepted
date: 2026-10-01
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-073 · A new value: closeness to a community of similar culture, or to relatives

## Decision

- **Life values** (ADR-068) gain **"community and relatives nearby"**: a community of similar culture, and relatives or friends already in the destination.
- It also feeds the **Location** route dimension (ADR-025): a city's bundle (ADR-067) gains a **community attribute** (size of the Nepali or relevant diaspora, from census and official data, sourced and dated), and the student may state **relatives or friends in specific cities** as a fact.
- Shown like every other dimension: good and bad, never a verdict ("Sydney: a large Nepali community and your cousin; higher rent"). Weighted by the student, not assumed.

## Reasoning

For many students the presence of their community or family in a city decides more than rent does; leaving it out of the values would miss a real part of the decision (Nikhil, 1 Oct). Australia's census data makes the community attribute sourceable.

## Constrains

City bundle attribute `community_presence` with provenance; student fact `relatives_in[]`; a life-value pile in the second coin round. Hackathon: a static value in the coin screen and one line on a city tile.
