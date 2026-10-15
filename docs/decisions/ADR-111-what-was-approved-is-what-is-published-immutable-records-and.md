---
id: ADR-111
title: "What was approved is what is published: immutable records and one layout engine"
status: accepted
date: 2026-10-05
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-111 · What was approved is what is published: immutable records and one layout engine

## Decision

- **Every step writes a record that is never changed**, identified by a hash of its content: source, facts, drafts, the approved revision, layout, render, checks, settings, approval. A post points at its current records. A check or an approval counts only for the exact revision and render it names; the approval pins them, and publishing points at the approval.
- **One layout engine on the server measures text with the brand's font files and places every line.** Draft previews, fit checks, the render and the export all come from it. The browser shows its images and never draws post text. Art fills a fixed box, so it never moves a word.
- **Fit checks show on every draft before approval. Nothing changes approved wording or layout afterwards**: no shortening and no font change by code. Fixes happen by reopening, and a light edit makes a new revision that is checked again.
- Exports and live posts are built from the stored files the reviewer saw.

## Reasoning

A reviewer's approval means nothing if what is published can drift from what they saw. Estimating text width without the font was 16% off on a real sentence (Nikhil, 5 Oct).

## Constrains

AD-R1, AD-R2, AD-R4 and AD-R14 are enforced by the data, not by convention.
