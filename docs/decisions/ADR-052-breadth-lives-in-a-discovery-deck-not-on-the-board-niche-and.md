---
id: ADR-052
title: "Breadth lives in a discovery deck, not on the board; niche and emerging courses arrive as wildcards"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-052 · Breadth lives in a discovery deck, not on the board; niche and emerging courses arrive as wildcards

## Decision

- **The board is for the road** the student is walking (ADR-051 limits). It never tries to show the catalogue.
- **Discovery lives in Find** as a **deck**: three course cards at a time, drawn from the whole product database, weighted to the student's preferences and weights. The student keeps, skips, or draws again.
- **One card in every hand is a wildcard**: a niche or emerging course adjacent to the student's interests that they would not search for (e.g. cyberpsychology for psychology + technology; suicidology for psychology + public health). Wildcards look distinct.
- **"Put it on my board"** is the only way a course becomes a node.
- **The compendium**: the full catalogue, searchable and filterable (the search drawer, grown up); undiscovered fields shown as silhouettes.

## Reasoning

- Realistically there are far too many paths for nodes (Nikhil, 30 Sep). Games with huge item pools never show them all: they offer a small weighted draft, make rare finds feel special, and keep a compendium for browsing (Slay the Spire, Hades, Pokédex).
- Recommending niche and emerging courses students would never reach on their own is a key part of the product; in a stack they would stay buried.

## Honesty rules for wildcards

A wildcard shows its trade-offs as clearly as its appeal: weaker or unclear career data, and whether the field maps to a skilled occupation (critical for students who want PR), using the estimated and unknown data states (ADR-046).

## Constrains

The product database needs field tags, a niche/emerging flag, and an adjacency map between fields (data work for W1). The engine returns a deck draw (three cards, one wildcard) as well as ranked routes.
