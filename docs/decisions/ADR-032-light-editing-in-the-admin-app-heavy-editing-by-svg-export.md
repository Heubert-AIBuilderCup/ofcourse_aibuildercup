---
id: ADR-032
title: "Light editing in the admin app; heavy editing by SVG export"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-032 · Light editing in the admin app; heavy editing by SVG export

## Decision

The admin app supports changing text, swapping an image, picking a colour theme and reordering slides. Anything heavier is exported as SVG to a design tool.

## Reasoning

- A full design editor is a product in itself; light edits cover most tweaks, and SVG export keeps the rest possible.

## Constrains

Structures render to SVG for text-heavy formats; export preserves brand fonts and colours.
