---
id: ADR-083
title: "Admin design frozen; four findings carried into the build"
status: accepted
date: 2026-10-02
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-083 · Admin design frozen; four findings carried into the build

## Decision

The admin design is frozen at "Admin app - round 2" (round-3 changes applied, 2 Oct). Findings from the last round become build rules:

- **Never add to a source to create a fact.** A market variant converts a figure the source already contains, or shows none. (The prototype added a mock paragraph to have a figure to convert; the real pipeline must not.)
- **Brand skin and theme are chosen on the blueprint, before render**, so the contrast check can block. (The prototype picks the theme after render, which is why a 4.2:1 theme could only be flagged.)
- **A currency conversion is a fact:** the NPR figure carries its exchange-rate source and date (mock rate in the prototype: 88 NPR per AUD).
- **Multi-panel comics on phones show one panel at a time, swiped.** A four-panel grid renders at about 10 px text at phone width and fails legibility; grids are desktop-only.

## Also noted

"Regenerate this panel" in the prototype swaps a stock image; the real one re-renders art only. Reviewer-from-the-market sign-off (ADR-063) is a workflow role for the final build. Promotion campaigns, Brands and video remain cut (ADR-057).
