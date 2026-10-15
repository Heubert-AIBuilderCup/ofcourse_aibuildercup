---
id: ADR-110
title: "Templates and brands are data files in the repo; the editor picks which templates to draft"
status: accepted
date: 2026-10-05
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-110 · Templates and brands are data files in the repo; the editor picks which templates to draft

## Decision

- **Each feed template** (slots, limits, text boxes, art box) **and each brand** (fonts, colours, themes, tone) **is a JSON file in the repo.** Adding a template or changing the mock brand is a file change, with no editor screen. The Brands editor stays cut (ADR-057).
- **Before drafting, the editor ticks one to three templates**, and one structure is drafted per ticked template.
- An approved structure carries a frozen copy of its template and brand, so a later file change never alters an approved post.

## Reasoning

Nikhil wants to add templates and follow brand guidelines without a new screen (5 Oct). One draft per chosen template gives the diversity ADR-096 asks for, and lets the editor ask for a single draft when one is enough.

## Supersedes / amends

Amends ADR-034 (one to three variations, the editor's choice, instead of two to three offered).
