---
id: ADR-048
title: "Interaction grammar: four kinds of object, one look and one verb each"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-048 · Interaction grammar: four kinds of object, one look and one verb each

## Decision

Everything interactive on the board is one of four kinds: **place tile** (go here), **stack** (show more), **route step** (look ahead), **control** (a labelled button in a fixed place). Labels are text attached to tiles, never button-like boxes; tapping a label taps its tile. The verb appears before the action (hover on desktop; select-then-commit on phone). One highlighted primary action per view (the duck's suggested next step). Only nearby tiles are tappable. Controls never move. A one-time duck hint and a "?" legend teach the grammar. Dashed or dotted outlines are reserved for unknown data; stacks look like piles.

## Reasoning

- Users could not tell which rectangles were buttons or what they did (Nikhil, 30 Sep). When every object looks alike, the student has to guess, and guessing breaks the seamless feel ADR-045 asks for.
- Games solve this with a consistent object language and a map key; the same kind always does the same thing.

## Constrains

Every action has one home (the action inventory in `HACKATHON-design-studio-2-fog-folding-interaction.md` §6). Nothing irreversible happens on a single tap; every move can be undone.
