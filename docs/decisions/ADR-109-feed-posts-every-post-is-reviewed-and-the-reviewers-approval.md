---
id: ADR-109
title: "Feed posts: every post is reviewed, and the reviewer's approval publishes it with its variants"
status: accepted
date: 2026-10-05
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-109 · Feed posts: every post is reviewed, and the reviewer's approval publishes it with its variants

## Decision

- **In the first admin slice every feed post needs a reviewer**, regulated or not. Editor-only publishing of general content (ADR-018; ADR-097, AD-Q7) comes later.
- **The editor sets the feed settings before sending to review** (layer, audience, why line, expiry, Studio link). The reviewer approves what goes out, settings included, and that approval publishes it (AD-Q7).
- A reviewer who won't approve **sends the post back with a required one-line reason**. Reviewers never edit wording.
- **Market variants are made before review and approved with their post.** The market-reviewer sign-off (ADR-063) is deferred.
- Social versions get no fit checks in this slice (AD-F26 and AD-Q14 stay open).
- Published posts are stored as live; the student feed that shows them is a later slice. Audience counts are mock and labelled.

## Reasoning

There is no tier logic to misclassify in a three-day build, and both demo sources are research, which needs review anyway (Nikhil, 5 Oct).

## Supersedes / amends

Amends ADR-018 (general content is reviewed too, for now), ADR-063 (the market reviewer comes later) and ADR-097 (the general-content half of AD-Q7).
