---
id: ADR-055
title: "Feed first: the admin app makes portal feed posts; Instagram and LinkedIn versions are derived from them"
status: accepted
date: 2026-10-01
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-055 · Feed first: the admin app makes portal feed posts; Instagram and LinkedIn versions are derived from them

## Decision

- The primary output of the New post flow is a **portal feed post**. Its settings: feed layer (general / featured / personal), audience (everyone, or matched via the audience matcher), the "why you're seeing this" line, an expiry, and an optional link into the Studio.
- **Adapt for Instagram / LinkedIn** generates social versions from an **approved** feed post: re-skinned to the chosen page's brand, re-cropped to the platform, with caption and hashtags (Instagram) or rewritten as a longer post (LinkedIn).
- Derived versions keep the approved facts, so the source check is not repeated; their new layout gets a quick structure approval before rendering. If any wording that carries a claim changes, the source check runs again.

## Reasoning

The feed is where the product's value is (students, Studio links, targeting); social posts are reach (Nikhil, 1 Oct). Deriving social from feed means one researched, checked post feeds every channel.

## Amends

ADR-031/033/034: per-page brands and export still apply, but to the derived versions; the feed has its own brand. The admin handoff's New post flow is rewritten feed-first.
