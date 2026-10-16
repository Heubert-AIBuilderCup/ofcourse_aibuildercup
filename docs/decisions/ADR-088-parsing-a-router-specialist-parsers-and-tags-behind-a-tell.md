---
id: ADR-088
title: "Parsing: a router, specialist parsers and tags behind a \"tell me in your own words\" composer"
status: accepted
date: 2026-10-02
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-088 · Parsing: a router, specialist parsers and tags behind a "tell me in your own words" composer

## Decision

Free text is parsed in two steps: a **router** classifies which profile sections a message touches (multi-label, with spans and confidence); **specialist parsers**, one per section with a tight schema, run in parallel on their spans; a **tag parser** keeps nuance that fits no field as tags with the student's own words. Code validates, drops values whose quote is missing, turns conflicts with confirmed facts into questions, and requires a tap for high-stakes fields. The composer is a Claude-like box where students can say anything with nuance; results fill the profile or become tags. Tags never drive eligibility or ranking. Wellbeing statements become tags with support content only. Course questions route to the answer path. Full spec: G1 in `HACKATHON-genai-build-plan.md`.

## Reasoning

Small schemas per section are more accurate, cheaper and testable than one large prompt; the router lets only the relevant parsers run; tags keep what students care about without forcing it into fields (Nikhil, 2 Oct). Jev fits the router role but stays an evaluate-later option (model path phase 2): the hackathon is judged on the Google Cloud stack and two weeks is not the time to add a vendor.
