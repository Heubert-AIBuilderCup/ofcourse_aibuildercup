---
id: ADR-125
title: "Related posts come from explicit, labelled edges; embeddings and a map view wait"
status: accepted
date: 2026-10-07
---
# ADR-125 · Related posts come from explicit, labelled edges; embeddings and a map view wait

## Decision

A post page shows up to four related live posts, each with the reason it is there, strongest first: built on the same source document, shares a theme tag ("also about …"), shares a destination tag ("also for …"). The edges are computed from the records in code, never by a model. Embedding similarity ("similar reading", `gemini-embedding-001` in pgvector) is added later as one more edge type, ranked last and labelled, once there are more than about fifty posts. No node-graph visualisation for students; a desktop map view is a possible stretch after the submission.

## Reasoning

- Over a few dozen posts, vector similarity makes everything related to everything and cannot answer "why is this connected to that". Facts, sources and tags give edges a reviewer can explain, which is what judges have rewarded ("explainable systems").
- Node diagrams of more than fifteen items become hairballs and are unusable at phone width; "Related, with a reason" is the student-facing shape of the same graph.

## Rejected alternative

A vector-space "connected ideas" explorer as the navigation; an editor-pinned "See also" (more admin UI for little gain now).

## Constrains

`relatedTo` is pure and client-safe; it never includes the post itself or a post that is not live.
