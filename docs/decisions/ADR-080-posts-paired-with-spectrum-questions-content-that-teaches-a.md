---
id: ADR-080
title: "Posts paired with spectrum questions: content that teaches a concept and learns a trait"
status: accepted
date: 2026-10-01
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-080 · Posts paired with spectrum questions: content that teaches a concept and learns a trait

## Decision

- Some feed posts are **paired with a profile question** that places the student on a spectrum. First example: the post *"How much do you love your future self?"* (patience, utility and discounting in economics) paired with a **patience spectrum** question (smaller reward now vs larger later; how far ahead you plan; how you handle waiting).
- The answer is stored as a **self-reported trait with a data state** on the profile, alongside the other profile builders (ADR-069), with a line saying what it is used for.
- **What it may influence:** how trade-offs are phrased and which content and check-ins the student gets (an impatient student sees the long road broken into near milestones; a patient one sees the compounding). **What it may never influence:** which options are shown, their order, eligibility, or anything about price or promotion.
- Other pairs follow the same pattern (e.g. a post on loss aversion paired with a risk-attitude spectrum; a post on sunk cost paired with a persistence spectrum). Each is one post, one question, one spectrum.

## Reasoning

A post that teaches a concept and a question that measures the student's own habit on it is the most natural way to gather trait data: the student learns something, sees why the question is asked, and the system learns how to speak to them (Nikhil, 1 Oct). It is also the clearest example of the agent model: ask easily, we research, we save for the next student.

## Constrains

Spectrum answers follow the profile-builder rules (optional, purpose stated, self-report, no validity claims). Hackathon: this post is the demo feed post in case 1 (two markets), with its paired question on the profile.
