---
id: ADR-100
title: "\"Asks before it answers\": the contrast with general chatbots is part of the problem statement and the video"
status: accepted
date: 2026-10-02
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-100 · "Asks before it answers": the contrast with general chatbots is part of the problem statement and the video

## Decision

The problem statement and pitch include the contrast with general-purpose chatbots: they answer at once, sound certain, rarely ask follow-ups, and apologise only when caught. For visas and deadlines the student cannot catch the error. OfCourse asks the follow-up questions that change the answer (and only those), sources and dates every fact, never predicts a personal outcome, marks uncertainty, researches it, and has a person review what it learns. The contrast is told with an illustrative composite example (troubleshooting, then a work-hours visa question). **General chatbots are not named**, and in particular Gemini is not presented as the bad example: OfCourse is built on Gemini, and the point is that the system around the model makes the difference.

## Constrains

Video: a 15–20 s segment showing the work-hours question answered with two follow-ups and a sourced answer (G1 fast path + answer library / G7). The follow-up logic follows ADR-058 (ask only what changes the answer) and the library's context filters (ADR-096).
