---
id: ADR-053
title: "Universities can promote courses — visibility only, never ranking"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-053 · Universities can promote courses — visibility only, never ranking

## Decision

- Promoted courses are **always labelled** ("Promoted by \[university\]").
- **Promotion never changes the ranking, the match score or eligibility.** Universities pay for visibility, not position.
- Promoted cards appear **only in a defined slot in the deck** (a frequency cap per student), never on the board unless the student adds them, and also in the feed as labelled posts.
- **A promoted course must still fit the student**; one they cannot reach is shown honestly as not yet reachable, or not shown.
- **The relationship is disclosed**, including that Expert earns commission from universities.

## Reasoning

- Promotion is a real revenue stream (Nikhil). It is also the biggest threat to the product's value, which is students trusting the ranking; these rules protect that.

## Constrains

Promotion is managed in the admin app for now (campaign, target audience via the audience matcher F3, frequency cap, reach report). Open: pricing model, and whether universities get their own partner portal later. Check agent-disclosure rules in destination markets before launch.

## Possibilities (future, not built; static pages only in the prototype)

- **University pages**: a promoted university's own page (programs, campus life, intakes), reached from a promoted card or feed post.
- **Mentoring sessions**: professionals already working in a student's chosen industry offer sessions (e.g. a cyber analyst in Perth), promoted to students whose route or field matches. Same rules as promotion: labelled, never affects ranking, matched to the student. Before any real build: mentor vetting and safeguarding, and whether sessions are free or paid.
