---
id: ADR-077
title: "Use as little AI as possible: answer once and serve many, generate shared not personal, measure the cost"
status: accepted
date: 2026-10-01
amended_by: [ADR-112]
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-077 · Use as little AI as possible: answer once and serve many, generate shared not personal, measure the cost

## Decision

- **Answer library.** Canonical answers to the questions students actually ask (visa, work hours, documents, costs), counsellor-written or reviewed, with sources and review-by dates. A student question is first matched to the library by meaning (embedding lookup, not generation). Only a genuinely new question reaches the model; its answer, once reviewed, joins the library. The weekly cluster of new questions feeds the ideas queue as lessons to write.
- **Never generate per student.** Renders are shared with persona and market variants only (ADR-019, 063); comics come from the pre-generated type library (ADR-036); template-only formats (SVG, no image model) are the default for posts; image generation is reserved for comics and a few covers.
- **Deterministic first.** The engine stays rule-based; explanations come from templates before the model; taps are the default in Ask and typing the exception; the model reads free text into fact chips and phrases what the engine computed, nothing more.
- **Against slop.** The model drafts only from sources and bound facts; every published post is edited by a human and the model has no publish button; an editorial cadence per feed and page replaces volume targets. A post that says nothing new to its audience is not made.
- **Make the cost visible.** Insights show AI calls per student per session, library hit rate, image renders per week, and an estimated cost and energy line. Targets: a falling calls-per-session and a rising library hit rate.

## Reasoning

Most students ask the same things; generating the same answer thousands of times costs money and energy and, past a point, produces generic text (Nikhil, 1 Oct). The design already prefers rules and shared assets; this makes it a policy with mechanisms and a measure.

## Constrains

Content engine: an answer-library collection and a match-before-generate step in front of every student-facing model call (content spec §3). Model path: the library is the cheapest tier, before small models. Hackathon: a library of \~20 canonical answers in the mock data; one "answered from the library" indicator; the cost line static.
