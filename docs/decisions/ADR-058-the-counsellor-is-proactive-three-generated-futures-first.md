---
id: ADR-058
title: "The counsellor is proactive: three generated futures first, questions only when they change the picture, options kept open, a watcher on the student's behalf"
status: accepted
date: 2026-10-01
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-058 · The counsellor is proactive: three generated futures first, questions only when they change the picture, options kept open, a watcher on the student's behalf

## Decision

- **Start with three generated timelines.** From the few facts available at sign-up (or the CRM enquiry) the engine drafts three distinct futures (e.g. safe and affordable; best path to staying; bold career), each with its **assumptions shown as editable chips**. Correcting a chip redraws all three. The student starts by reacting, not answering.
- **Ask only questions that change the picture.** Before asking, check whether any answer would move the recommendations; if not, don't ask. Every question states its "because".
- **Recommend like a counsellor:** with reasons, hedges and trade-offs, framed as what the student could do, never a single answer.
- **Keeping options open is a first-class recommendation** ("sit the IELTS before 30 Nov so the UK stays possible"; "apply to two intakes"), labelled with how many doors it keeps open.
- **Commit late.** "Still exploring" is a valid state for weeks; ranking is optional until the student wants a counsellor. The counsellor sees the exploration state.
- **A watchlist and a watcher.** Students mark what to keep an eye on; the system adds what they should watch. A daily pass re-checks every plan against new data (opportunities, rule changes, deadlines, stale assumptions) and turns findings into feed items and check-ins. The LLM phrases; the system is the proactive part.

## Reasoning

- The tool is for exploring; the previous flow asked a lot and pushed the student to commit early (Nikhil, 1 Oct). The best counsellor proposes from knowledge first and asks second.
- LLMs are reactive; proactivity has to come from the system (defaults, generated options, a scheduled watcher), with the model writing the words.

## Constrains

The engine runs on partial profiles with explicit defaults and labels every assumption; it supports an "options kept open" measure per action; and it exposes a watcher pass. Amends ADR-003/010 (questions become conditional on information value), ADR-027 (sign-up stays, but the first screen after it is the three futures), ADR-044 (the watcher is the engine behind the check-in loop).
