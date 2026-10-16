---
id: ADR-064
title: "Two briefs at submission: one for the counsellor, one for the parents"
status: accepted
date: 2026-10-01
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-064 · Two briefs at submission: one for the counsellor, one for the parents

## Decision

When the student submits an enquiry, two briefs are generated from the same data. The **counsellor brief** (Technical Design §6; later inside the CRM): ranked routes, profile and answers, assumptions, risks and `needs_review` items, next actions. The **parent brief**: plain language, culturally framed (ADR-063), later in Nepali: what their child is considering and why, what each option costs in rupees and when, what is needed from the family (funds to show, documents), the risks, and questions worth asking the counsellor. Shared by read-only link (parent mode, ADR-046).

## Reasoning

In Nepal the family decides and pays; a parent who understands the options makes the counsellor's job easier and the decision better (Nikhil, 1 Oct).

## Constrains

Both briefs are templated generation over the student record and engine output; facts carry sources. The parent brief never shows internal PR estimates. Hackathon: static mock pages for both.
