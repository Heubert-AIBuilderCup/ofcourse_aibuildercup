---
id: ADR-003
title: "Preferences drive the questions and pre-populate the profile"
status: accepted
date: 2026-09-29
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-003 · Preferences drive the questions and pre-populate the profile

## Decision

From the root preferences, the system **(a)** pre-populates the profile with what can be inferred or defaulted, and **(b)** asks only the questions that the *active lenses* make relevant. A student who never mentions funding is not asked the merit-scholarship battery; a student who says "I want to stay after" gets the settle-abroad questions.

## Reasoning

- Directly fixes failure #3 (extractive profiling): the form disappears; the student is asked only what their own stated goals make relevant, and sees each answer returned as a change in the futures shown.
- Fewer, better-targeted questions raise completion and answer quality — the profile that matters most (the fields the eligibility rules read) gets filled with attention rather than fatigue.
- Pre-population from preferences is safe *only* because of the human-confirm rule (technical design §4): a pre-filled value is `llm_suggested` until the student confirms it, and high-stakes fields (PR intent, funds) are always asked, never inferred.

## Constrains

The question flow is **data-driven from the active lenses**, not a fixed script. Every question maps to a profile field and a reason it's being asked. Confirmation state per field persists (ADR-004).
