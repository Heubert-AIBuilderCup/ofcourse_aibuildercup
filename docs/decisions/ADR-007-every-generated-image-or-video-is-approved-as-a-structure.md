---
id: ADR-007
title: "Every generated image or video is approved as a structure before it is rendered"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-007 · Every generated image or video is approved as a structure before it is rendered

## Decision

Content is generated in two stages. First a **blueprint**: format, frames, scene picks, layout, captions, and every fact bound to its catalog source, shown as a free wireframe preview. Staff approve, edit or reject it. **Only an approved blueprint is rendered** into an image or video. Video uses the same gate with a storyboard.

## Reasoning

- **Cost.** Rendering images and video is the expensive step; editing a structure is almost free. Iterating before the render means rejected ideas never cost a render. (Nikhil's direction, 30 Sep.)
- **Accuracy.** A rendered image is pixels and can't be fact-checked. A blueprint is text, so every number and claim is checked while it is still checkable, against its source, before it is baked into an image.
- **Control.** Staff shape the content (scene, framing, wording) without prompt-engineering an image model by trial and error.
- **Audit.** The approved blueprint is a record of exactly what was agreed and from which catalog version, which also lets a changed fact trigger regeneration instead of a silent re-render.

## Rejected alternative

Generate the full image from a prompt and iterate on the output. Rejected: every iteration pays for a render, and facts drawn into the image can't be verified or corrected without regenerating.

## Constrains

The admin panel has no render action before blueprint approval. Facts in a blueprint come only from the catalog; staff fix a wrong fact in the catalog, not in the image. Publishing is a separate, tiered approval after render (System Requirements §8, A4).
