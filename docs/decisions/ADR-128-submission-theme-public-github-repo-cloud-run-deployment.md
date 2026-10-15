---
id: ADR-128
title: "Submission: the Media, Content & Digital Experiences theme, a public GitHub repo, a Cloud Run deployment"
status: proposed
date: 2026-10-07
---
# ADR-128 · Submission: the Media, Content & Digital Experiences theme, a public GitHub repo, a Cloud Run deployment

## Decision (proposed; needs Jenish)

OfCourse enters the AI Builder Cup under **Media, Content & Digital Experiences**, with the fact-checked content engine and the student feed as the headline and the student opening as the audience it serves. The submission is a **public GitHub repository**, a live URL on Cloud Run with the database on Google Cloud, a video under three minutes and a PDF deck, all in English. The pitch presents the pipeline as named agents with visible roles (Extractor, Number Checker, Judge, Drafter, Illustrator, Source Checker, Vision QA, Localiser, Router, Researcher, Matcher), an architecture diagram across Cloud Run, Agent Platform `global`, Cloud SQL with pgvector, Cloud Trace and Model Armor, a Cloud Trace waterfall of one post, and the admin step trace with its human checkpoints.

## Reasoning

- The official themes page names education inside this theme's description; none of the six themes is education itself. The earlier "Future of Work" suggestion came from aggregator sites.
- Scoring is 40% technical merit and "Google Cloud architectural depth", 25% problem alignment, 25% innovation, 10% UX. Winners of the 2025–26 Google hackathons were rewarded for named agents, breadth of Google services and explicit review steps; OfCourse has all three and needs only to make them legible.
- The rules require the public repo and the Cloud Run or Firebase deployment; our remote is a private Bitbucket repo today.

## Rejected alternative

Future of Work as the theme; a private repo with judge access (not allowed).

## Constrains

Everything in the repository becomes public and sits under a six-month right of first refusal for an exclusive licence: no proprietary Heubert code beyond what the product needs, and no AGPL dependency (ADR-119). Submitted code is built primarily on Google Cloud.
