---
id: ADR-008
title: "The image model draws the artwork; code draws the words and numbers"
status: proposed
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-008 · The image model draws the artwork; code draws the words and numbers

## Decision (proposed)

The image model receives only an art prompt, with no text and no numbers. Captions, figures and source footnotes are composited onto the artwork by code, exactly as approved in the blueprint.

## Reasoning

- Image models misspell words and invent or distort numbers. On a visa or cost figure that is a factual error shown to a student.
- It guarantees ADR-007's promise: what was approved as text is what gets published, character for character.
- Text can be re-laid for another language or aspect ratio without re-rendering the art, which also saves render cost.

## Rejected alternative

Letting the image model render text inside the image. Rejected because published wording would no longer be guaranteed to match the approved blueprint.

## Status (30 Sep)

Still proposed. Nikhil: test both approaches on real posts first, then decide. Requirements D13 stays open until the test.
