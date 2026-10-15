---
id: ADR-009
title: "The board shows only choices that change where the student can go; everything else is a preference"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-009 · The board shows only choices that change where the student can go; everything else is a preference

## Decision

A node appears on the Decision Studio board only if choosing it removes something from the map: destination, region, course, and the route steps to Point B with their risk gates. Every other question (budget, career vs academic, urgency, funding, settling abroad) is a **preference**: it is answered in the Ask panel by chat or by click, it sets weights and switches on follow-up questions, and it is never drawn as a fork. The six "paths" of v4 become preferences.

## Reasoning

- The v4 board drew every question as a fork, so a student who was both career-focused and funding-constrained had to pick one door. Preferences are not exclusive; forks are. Drawing them the same way was the source of the contradiction with ADR-002.
- Students should watch the board *react* to what they say (courses re-ranking, some sealing), not walk a corridor of yes/no doors. The reaction is the insight.
- It keeps the design Nikhil wants: the isometric board, Point A, destinations, regions, courses and routes stay exactly as designed; only the preference questions leave it.

## A preference may seal courses, and that is not a contradiction

"Do you want to settle abroad after graduation?" is a preference (it sets the PR weight). The board may respond by sealing courses that do not lead to residency. The student chose nothing on the board; the board showed a consequence. (Nikhil, 30 Sep.)

## Constrains

Weights set by answers stay visible and adjustable by the student (sliders). The Ask panel is the intake for the Decision Studio, replacing v4's own intake. Supersedes the v4 "Which path fits you?" node and the per-path weight tallies (see System Requirements §2, D5).
