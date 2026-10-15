---
id: ADR-070
title: "Personal goals: suggested from context, plus free text; nudges, posts, events and services orbit them"
status: accepted
date: 2026-10-01
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-070 · Personal goals: suggested from context, plus free text; nudges, posts, events and services orbit them

## Decision

- Beyond route dimensions and life values, the student is asked **what else they want to stay on top of**. Suggestions come from context and phase (staying in touch with family, not feeling lonely, time with friends, learning to manage anger, learning the profession, learning a language, managing money), and a **free-text field** lets them add their own ("mindfulness").
- These goals become targets for the companion: **nudges, learning posts, check-ins, recommended events and services** are selected and phrased around them ("you said staying in touch with family matters: Dashain is in three weeks; here's how students handle the time difference").
- Goals are editable any time and can be marked done or dropped; the system eases off when they are.

## Insights

The admin app shows which suggested goals students select and how often, and **themes clustered from the free text** (e.g. mindfulness emerging across 60 students), de-identified. Both feed the ideas queue and expansion ideas (ADR-042, ADR-061): a theme that recurs becomes a content track, an event or a service.

## Reasoning

Suggested goals make the companion relevant to the whole person, and the free text captures what we did not think to suggest, which is exactly the signal the business cannot see otherwise (Nikhil, 1 Oct).

## Constrains

Some goals touch wellbeing (loneliness, anger); content for them is support and signposting with a path to professional help (ADR-061 rule). Goals are the student's own statements, stored with their consent, used for content selection only, never for eligibility or ranking. Free text is clustered into themes for insights; individual entries are visible only to roles that need them. Hackathon: the goals screen with suggestions + free text, and one nudge that cites a goal, static.
