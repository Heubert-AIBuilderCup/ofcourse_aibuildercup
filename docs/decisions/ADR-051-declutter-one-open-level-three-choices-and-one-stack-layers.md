---
id: ADR-051
title: "Declutter: one open level, three choices and one stack, layers off by default"
status: accepted
date: 2026-09-30
amended_by: [ADR-056]
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-051 · Declutter: one open level, three choices and one stack, layers off by default

## Decision

- **One open level at a time.** Only the level the student is choosing at fans out; levels behind collapse to the chosen tile. Tapping a past tile reopens that level and folds the current one.
- **At most three choices plus one stack per level**, on phone and desktop: the current or picked tile, the best match, one real alternative; everything else in a single stack ("9 more · 3 match well"). Grouping (regional / metro / not yet reachable) moves into filters in the search drawer.
- **No state words on tiles** ("visited", "not visited", "unexplored"); the tile's look carries the state and a legend explains it once.
- **Only the focused tile has a full label** (name, badges, why); others show their name only.
- **Layers, off by default**: silhouettes of roads not taken, the change log, the deadline front and parallel lanes are optional map layers. The answer preview appears only while answering. The goal picker is a control, not something drawn on the board.
- **An object budget**: at most about seven labelled objects on screen on desktop, five on a phone.

## Reasoning

The round-3 board followed ADR-047 and was still cluttered (Nikhil, 30 Sep): two levels open at once, five siblings plus two stacks per level, the state written on nine tiles. The limits were too generous, and round 4's mechanics would have added more to the same surface.

## Amends

ADR-047: sibling limit changes from 3 phone / 5 desktop to 3 + one stack everywhere; two stacks per level become one. ADR-049: its mechanics are layers or transient, not permanent board furniture.
