---
id: ADR-118
title: "The research agent runs on ADK TypeScript as its own Cloud Run service; grounding is never the evidence"
status: accepted
date: 2026-10-07
---
# ADR-118 · The research agent runs on ADK TypeScript as its own Cloud Run service; grounding is never the evidence

## Decision

G7 is built with `@google/adk` for TypeScript and deployed as a separate Node 22 Cloud Run service called from the Next app. Flash-Lite plans two to four queries; 3.8 Flash runs them with Google Search grounding and a schema; code takes URLs from `groundingChunks`, never from model text, ranks them (boosting `.gov`, `.gov.np`, `.edu`, `.edu.au`), fetches the pages itself and stores each with its hash; 3.8 Flash extracts `{fact, quote, url}`; code rejects any quote that is not a normalised substring of the stored page; a human approves through an ADK `RequestInput` node. Student free text never goes into Search grounding.

## Reasoning

- Grounding metadata maps spans of the model's answer to URLs and returns no source text, so it cannot prove a verbatim quote. Fetching the pages ourselves is the only way ADR-112 survives.
- ADK's `requireConfirmation` on a tool does not pause inside a workflow; `RequestInput` does.
- Agent Runtime hosts only Python and Go; nobody has run adk-js under Bun; a separate Node service avoids that risk and reads cleanly on the architecture diagram.
- Search grounding logs are kept up to three days and cannot be disabled.

## Rejected alternative

Google's Deep Research agent (multi-minute, Interactions-only, preview, no domain filter): at most an optional asynchronous report a reviewer can read. Firebase Genkit (see ADR-115).

## Constrains

Deterministic steps (library match, ranking, fetch, quote check, save) are plain function tools so each is a visible span in Cloud Trace. Whether this ships before 18 Oct is the showcase decision with Jenish.
