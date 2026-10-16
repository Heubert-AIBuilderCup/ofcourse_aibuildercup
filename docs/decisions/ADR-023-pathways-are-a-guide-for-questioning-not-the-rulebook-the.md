---
id: ADR-023
title: "Pathways are a guide for questioning, not the rulebook; the next question comes from the whole picture"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-023 · Pathways are a guide for questioning, not the rulebook; the next question comes from the whole picture

## Decision

The country and path trees are used as a guide for what to ask, not as comprehensive rules. Question selection considers the whole picture (everything the student has said and their profile), not only the previous answer in a flow. For now the trees are researched and updated against current data; counsellors maintain them over time as part of the knowledge. Course knowledge is a product database searched by RAG against the student's preferences. Knowledge has three sources (third to be confirmed).

## Reasoning

- The trees are incomplete today (Nikhil); treating them as rules would make the system confidently wrong.
- Whole-picture question selection is what the lens/weights model already implies (ADR-009): the profile state, not a flow position, decides what is worth asking.

## Constrains

Question selection is state-driven. Counsellor edits to the questioning knowledge are versioned. Resolves D11 (US/NZ): all pathways, including US and NZ, are researched now and counsellor-maintained; none is treated as complete.
