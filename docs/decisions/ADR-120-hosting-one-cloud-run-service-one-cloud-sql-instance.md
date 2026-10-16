---
id: ADR-120
title: "Hosting: one Cloud Run service, one Cloud SQL instance, Gemini on global"
status: proposed
date: 2026-10-07
---
# ADR-120 · Hosting: one Cloud Run service, one Cloud SQL instance, Gemini on global

## Decision (proposed; the Google Cloud project is on Jenish's account, ADR-098)

The Next app runs on Cloud Run from our own Dockerfile (`output: 'standalone'`, Node 24 runtime, Bun used only to install), with instance-based billing, `--min-instances=1` and concurrency about 40. The database is Cloud SQL PostgreSQL 17, Enterprise edition, over the Unix socket, with migrations as a Cloud Run job before the traffic shift. Region asia-southeast1 (Singapore), or asia-south1 (Mumbai) if Nepal dominates; Cloud Run and Cloud SQL together, Gemini on `global`. Secrets in Secret Manager pinned to versions; a dedicated runtime service account; `DEV_LOGIN_SECRET` never set. Background steps started with `after()` are backed by a Postgres lease so a step cut off by scale-in can be claimed again.

## Reasoning

- Firebase App Hosting cannot build with Bun, stops at Next 15.2, has no Mumbai or Sydney region and gives no control over the native resvg binary and the fonts.
- `after()` needs CPU outside the request, which only instance-based billing provides; Cloud Run allows ten seconds between SIGTERM and SIGKILL, less than one vision check.
- Enterprise Plus is the default for PG16+ and costs more for nothing we use.
- Two weeks of infrastructure is about $45–55 before Gemini, within the trial credit; trial accounts cannot raise quotas, so a paid billing account if 429s are a risk.

## Rejected alternative

Firebase App Hosting; AlloyDB (a free trial that forces an upgrade a month later).

## Constrains

The submission requires a live URL on Cloud Run or Firebase and the stack built primarily on Google Cloud (ADR-128). Log-based metrics and the spend-cap budget are created before the first deployed demo, because log-based metrics are not backfilled.
