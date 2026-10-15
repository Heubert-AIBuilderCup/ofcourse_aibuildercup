---
id: ADR-119
title: "Reuse libraries and ported ideas, never copied apps; permissive licences only"
status: accepted
date: 2026-10-07
---
# ADR-119 · Reuse libraries and ported ideas, never copied apps; permissive licences only

## Decision

Outside code enters the product as an npm dependency or as an idea ported into our own code, never as a copied application, template or framework. Only permissive licences (MIT, Apache-2.0, BSD, ISC); nothing AGPL and nothing that needs a commercial licence for derivatives. Every library and every ported idea is named, with its licence, in a "third-party code" section of the README.

## Reasoning

- The competition's rules require fresh code written during the hackathon and a public repository under a six-month right of first refusal for an exclusive licence. A copied component looks like pre-existing work; an AGPL dependency is a licence we could not grant exclusively.
- Four research passes found nothing that does our distinctive parts better: fit-checked layout, code-decided number and quote checks, the fake provider and replays. Google's samples supply current API shapes with stale model ids; the Python fact-checking projects supply algorithms short enough to port. Almost every hackathon winner with public code ships no licence at all.

## Rejected alternative

Forking a chatbot template (Scira is AGPL, lobe-chat needs a commercial licence, Vercel's RAG starter has no licence); adopting Genkit; copying hackathon winners' code.

## Constrains

A dependency swap is tested against our own fixtures before adoption: `sentence-splitter` was proposed by the research and rejected on 7 Oct because it failed the existing sentence probe.
