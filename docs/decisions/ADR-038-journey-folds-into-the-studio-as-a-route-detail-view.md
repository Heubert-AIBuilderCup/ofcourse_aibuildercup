---
id: ADR-038
title: "Journey folds into the Studio as a route detail view; students rank several routes and submit the ranked list"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-038 · Journey folds into the Studio as a route detail view; students rank several routes and submit the ranked list

## Decision

There is no separate Journey tab. Selecting a route on the board opens it in a detail view inside the Studio, with dates, the documents each stage needs, and progress. The student keeps several routes and **ranks** them (1st choice, 2nd, 3rd). The ranked list, with the profile and answers, is what is submitted to the CRM.

## Reasoning

- The Journey tab was the promoted route drawn on a second surface; a detail view of the selected route gives the same information without leaving the board (Nikhil).
- Real students hold a first choice and fallbacks; a single promoted route threw the fallbacks away. A ranked list is how counsellors already think ("if Curtin says no, then…").
- The ranked list is a better handoff than one plan: the counsellor sees the student's order of preference, not just their favourite.

## Supersedes / amends

Supersedes ADR-026 (board vs Journey). Amends ADR-011: the Compare view compares the ranked routes, and "promote" becomes "rank #1". Amends ADR-028: submission sends the ranked routes (all of them, in order), not one promoted plan. ADR-013 unchanged: nothing reaches the CRM until the student submits.

## Constrains

A plan record holds an ordered list of routes with a rank. The detail view reads the same route data as the board (steps, gates, dates, documents). The briefing (Technical Design §6) presents the ranked list. Progress marking (applied → enrolled → …) lives in the detail view of whichever route the student is pursuing.
