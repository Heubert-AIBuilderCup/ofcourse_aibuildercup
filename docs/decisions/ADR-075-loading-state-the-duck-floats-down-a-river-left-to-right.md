---
id: ADR-075
title: "Loading state: the duck floats down a river, left to right, with a rotating line"
status: accepted
date: 2026-10-01
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-075 · Loading state: the duck floats down a river, left to right, with a rotating line

## Decision

- Every loading state in the portal shows the duck floating on a river, drifting left to right, with the line **"Keep floating."** by default.
- Three more lines rotate with it, one per load, in order then repeating: "Drifting is still moving." / "You don't have to see the sea to know it's there." / "Small paddles, long way." (Nikhil kept these three of five proposed.)
- Rules: shown only for waits longer than about 400 ms (shorter waits show nothing); with reduced motion on, the duck sits still on the water; error states use their own copy, never the river; the admin app uses a plain loader.

## Reasoning

The duck is the companion (ADR-043, ADR-045); a wait is a moment to keep the student company rather than show a spinner, and the river fits the journey the whole product is about (Nikhil, 1 Oct). Lines are original, short, and never promise an outcome.

## Constrains

One shared loader component with a copy list in config, so lines can be changed without a release; market variants may localise the lines later (ADR-063).
