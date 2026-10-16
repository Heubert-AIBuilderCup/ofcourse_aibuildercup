---
id: ADR-108
title: "Admin roles: editor and reviewer on any staff account; one person may hold both"
status: accepted
date: 2026-10-05
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-108 · Admin roles: editor and reviewer on any staff account; one person may hold both

## Decision

- **Editor and reviewer are capabilities an account holds alongside its role** (user, admin, superadmin). An account can hold either or both, and an admin may hold them too. A superadmin can act as editor and reviewer.
- **Only a superadmin gives or removes them**, including for an address before its first sign-in.
- Accounts with a content capability sign in on the admin page and are refused on the student page.
- **One account may make and approve the same post**; the approval records "self-reviewed".
- An admin with no content capability sees the board read-only.
- The counsellor role (ADR-020) is not in the hackathon. The admin's budgets (ADR-020) are daily caps on model calls in configuration, with no screen.

## Reasoning

The team is small, and the user test has one marketer, who must be able to run the whole flow alone (Nikhil, 5 Oct). Recording a self-review keeps the missing second look visible instead of pretending it happened.

## Supersedes / amends

Amends ADR-020: for the hackathon, the separation of making from approving is recorded, not enforced, and budgets live in configuration.
