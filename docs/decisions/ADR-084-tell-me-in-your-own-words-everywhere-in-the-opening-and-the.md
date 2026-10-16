---
id: ADR-084
title: "\"Tell me in your own words\" everywhere in the opening and the board; free text parsed into the profile"
status: accepted
date: 2026-10-02
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-084 · "Tell me in your own words" everywhere in the opening and the board; free text parsed into the profile

## Decision

Every opening screen and the board carry a **"Tell me in your own words"** field (the OfCourse Ask pattern: chat or tap). Whatever the student types is parsed into profile facts as confirmable chips (Gen AI use case G1), with the quoted words shown; vague answers ("somewhere not too expensive, near family if possible") become several chips with lower confidence for the student to confirm or fix. Taps remain the fast path; typing is always available.

## Reasoning

The new opening lost the chat that OfCourse had; students with vague or mixed answers had nowhere to say them, and parsing those into the profile is exactly what the model is for (Nikhil, 2 Oct).
