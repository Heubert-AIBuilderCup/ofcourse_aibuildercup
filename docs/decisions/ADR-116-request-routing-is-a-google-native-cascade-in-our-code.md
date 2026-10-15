---
id: ADR-116
title: "Request routing is a Google-native cascade in our own code"
status: accepted
date: 2026-10-07
---
# ADR-116 · Request routing is a Google-native cascade in our own code

## Decision

Student free text is routed by a chain our code owns, in ADR-077 order: rules (regex and lexicons) → an exact cache → an embedding router (`gemini-embedding-001` against labelled exemplars per section, a fitted threshold per section, an explicit "none" set) → `gemini-3.5-flash-lite` only when the margin is low or nothing matches → Flash only when Flash-Lite's answer fails validation or contradicts a rule. Tier routing inside the content pipeline is a static task→tier table with escalation on validator failure. An admin correction becomes a new exemplar at once and an eval case.

## Reasoning

- Gemini 3.x returns no logprobs and model self-confidence is miscalibrated, so the escalation signals must be code-checked: embedding margin, rule-versus-model agreement, validator results. That is ADR-112 applied to routing.
- Every stage is visible: a route chip per reply, a Cloud Trace span per stage, a chart of the share of messages that needed a model.
- Threshold fitting lifted an embedding router from 35% to 89% in the reference library's demo; the port is about 200 lines.

## Rejected alternative

- Vercel Eve and Jev: non-Google components in the core path, no Nepali evidence.
- Laya: a classifier rather than a router, uncalibrated for Nepali, needs labelled data we do not have, GPU billed for the instance's lifetime.
- Vertex Model Optimizer (experimental, routes between retired models) and API Gateway model routing (a rule switchboard): both opaque, both break ADR-112.

Details: `reports/Laya request routing fit.md`, `reports/Vercel Eve and Jev fit.md`.

## Constrains

Builds after the admin slice; the exemplar table and the fit script land with it. EmbeddingGemma on Cloud Run is an optional shadow comparison, never in the path.
