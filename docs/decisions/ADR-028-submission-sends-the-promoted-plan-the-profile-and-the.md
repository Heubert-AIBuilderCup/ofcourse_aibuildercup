---
id: ADR-028
title: "Submission sends the promoted plan, the profile and the answers to the CRM"
status: accepted
date: 2026-09-30
amended_by: [ADR-038]
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-028 · Submission sends the promoted plan, the profile and the answers to the CRM

## Decision

When a student submits an enquiry, the CRM receives the promoted plan plus the profile and answers. Other saved plans stay on the portal and remain visible to the counsellor in the admin panel.

## Reasoning

- The counsellor needs the plan the student chose and why; the alternatives are context, available on request, not enquiry data.

## Constrains

Refines ADR-013. The briefing (Technical Design §6) is built from this payload.
