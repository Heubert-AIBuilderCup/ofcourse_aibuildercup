---
id: ADR-094
title: "Each app gets a build spec and flow boards in the house format; old designs are archived"
status: accepted
date: 2026-10-02
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-094 · Each app gets a build spec and flow boards in the house format; old designs are archived

## Decision

- Once the designs are frozen, Claude Design produces for **each app** a specification and flow boards in the same format as the CRM's Studylink spec: stable ids (DS-F/FL/D/E/P/R/Q for the Studio, AD-… for the admin app), a feature inventory with state, flows screen by screen with the surface named, data contracts, edge cases with whose move, permissions, invariants and open questions. Each item also carries its **build tier** (Real / Scripted / Preview, handover §0c), its **ADR** and, where relevant, its **Gen AI use case** (G1–G10).
- The decision record stays the source of reasons; the spec is the source for QA and build. Where they disagree, the decision record wins and the spec is corrected.
- Superseded design files are **archived, not deleted**, moved to an `archive/` folder with "(superseded 2 Oct 2026)" in the name, after checking that no current file imports them.

## Reasoning

The Studylink spec format makes QA and build card-by-card possible without re-reading prose (Nikhil, 2 Oct); old explorations in the projects confuse both the design agent and the developers.
