---
id: ADR-036
title: "Route comics: a library of slotted trade-off types, matched by rules then AI, with a text fallback"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-036 · Route comics: a library of slotted trade-off types, matched by rules then AI, with a text fallback

## Decision

Common trade-offs are defined in advance as types with slots (city A, city B, the rent difference, the duration). Each type gets an approved comic whose art is shared and whose caption and numbers are filled from the route. A route is matched to a type by rules first (cost delta, regional flag, duration, PR list) and by AI with a confidence threshold only for qualitative cases. Below the threshold the student sees a plain text card with the facts, and the case goes onto the frequency-ranked "not yet covered" list (ADR-015).

## Reasoning

- One approved comic covers many concrete cases, so the common-cases library stays small.
- Rules are deterministic and free where they apply; AI confidence is reserved for what rules cannot decide.
- No student is left without the information; only the comic is missing.

## Constrains

Comics never carry a fact the route does not contain. Slot filling is a test case for ADR-008. Supersedes the "waiting for the engine" question: comics run on the sample product database now and on the engine later.
