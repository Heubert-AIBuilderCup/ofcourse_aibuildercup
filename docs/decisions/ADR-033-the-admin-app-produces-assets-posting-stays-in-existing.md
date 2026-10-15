---
id: ADR-033
title: "The admin app produces assets; posting stays in existing tools"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-033 · The admin app produces assets; posting stays in existing tools

## Decision

The admin app produces assets and captions (and hashtags). Posting and scheduling stay in the tools the team already uses, such as a scheduler like Postiz. Direct posting is not built.

## Reasoning

- Avoids building and maintaining platform integrations that existing tools already provide.

## Constrains

Export formats per platform: Instagram carousel images + caption; LinkedIn post text (+ optional image or PDF carousel).
