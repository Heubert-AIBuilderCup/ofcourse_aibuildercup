---
id: ADR-040
title: "Mobile-friendly from the start: a staged view, one node at a time, with the overall board a tap away"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-040 · Mobile-friendly from the start: a staged view, one node at a time, with the overall board a tap away

## Decision

The portal is designed for phones from the first prototype. Alongside the isometric board there is a **staged view**: the student sees one node at a time (Point A, then the destination they're on, then the region, then the course, then each route step and gate), moving forward and back, with the same answers, weights and sealing as the board. An **overview** shows the whole board at a glance, zoomable, and tapping any node returns to the staged view at that node. The staged view is the default on phones; the board is the default on desktop; both are available on both.

## Reasoning

- Most students will be on phones. An isometric board with a side panel is a desktop layout; without a phone-first view the core experience would be lost for most users (Nikhil: mobile from the get-go).
- One node at a time is also good pacing: it matches the "fog of war" disclosure already in the design and keeps the reaction to each answer legible.
- The overview keeps the thing students love about the board (seeing the whole map) without asking a phone to render it as the working surface.

## Constrains

Board and staged view render the same data; nothing is board-only. The Ask panel becomes a bottom sheet on phones. The weights plaque (ADR-030) is a compact bar in the staged view. The Compare view is a swipeable stack of route cards on phones.
