---
id: ADR-117
title: "Retrieval stays in Postgres with pgvector; the course catalogue is imported from Mongo"
status: accepted
date: 2026-10-07
---
# ADR-117 · Retrieval stays in Postgres with pgvector; the course catalogue is imported from Mongo

## Decision

Embeddings (the answer library, course matching, later the semantic cache) are stored in pgvector on the Cloud SQL PostgreSQL 17 instance both slices already use, through Drizzle. Under a thousand rows the query is an exact scan with the hard filters in the same `WHERE`; HNSW only at tens of thousands of courses. Each vector row records its `embedding_model`. The business's course catalogue lives in a self-hosted MongoDB, which has no vector search: for the hackathon it is imported into Cloud SQL by a one-off script (a JSON export, or labelled mock rows until the export exists); Mongo stays the source of truth and a scheduled sync comes later.

## Reasoning

- The answer library serves a stored answer only above a fitted similarity threshold, which needs the raw score. File Search hides scores and chunks; RAG Engine is Python-first and region-gated; Agent Retrieval moves the truth out of Postgres; AlloyDB costs about four times Cloud SQL.
- One database, one driver, one architecture line for judges. A self-hosted Mongo in the demo path would mean running it on a VM with no vector search; Atlas would be a new vendor eleven days out; Firestore would be a second database.

## Rejected alternative

Hosting Mongo on Compute Engine; MongoDB Atlas; Firestore in MongoDB-compatibility mode (its vector search through that interface is unverified).

## Constrains

`docker-compose.yml` moves to the `pgvector/pgvector:pg17` image when the first vector column lands. Course matching is part of the student slice and the showcase decision with Jenish, not the admin slice.
