---
id: ADR-112
title: "Gemini and Imagen in the admin: code decides what can be checked, the model proposes"
status: accepted
date: 2026-10-05
amended_by: [ADR-113, ADR-115]
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-112 · Gemini and Imagen in the admin: code decides what can be checked, the model proposes

## Decision

- **Code decides what is checkable.** It splits paragraphs and sentences, reads numbers (in words, with k or lakh, as percentages), and rules that a claim with a number its paragraph lacks is unsupported, whatever a model says. The model judges only claims whose numbers check out but whose wording is not a quote. Confidence is computed in code from the evidence (ADR-096).
- **Model-facing schemas are kept simple** and checked against an allowlist of schema keywords. Code converts answers into the app's types and validates everything checkable. Pasted sources are sent as data, with a rule that they are never instructions.
- **The ADR-099 ladder, as built here:**
  1. cache;
  2. primary model;
  3. retry with the errors;
  4. Pro;
  5. deterministic where meaningful: a text-only cover when art fails, and code verdicts on numbers;
  6. a replay for an exact demo source, checked again; otherwise the editor's "Try again".

  No step stores half a result, and a step cannot run twice at once.
- Prompts are versioned and every call is logged. Daily caps on Pro and image calls stand in for budgets. Development and tests run on a deterministic fake that never spends.
- **An eval suite guards prompt changes:** 10 of 10 planted claims caught, at most 2 false alarms (build plan, G2).
- **Any pasted source runs live.** Both demo posts, "Paid work and grades" and "How much do you love your future self?", are rehearsed live with recorded replays; the second is no longer scripted.
- Cover art is generated for each demo feed post. ADR-077's template-only default for volume stands after the hackathon.
- **Nikhil builds the admin slice's AI** (G2–G6, G8); Jenish keeps the student slice's.
- The exchange-rate line reads "NPR at 88 per AUD · mock rate · 1 Oct 2026" (ADR-097). The legibility floor for feed posts is 11 px at a 328 px phone width, as for comics.

## Reasoning

The judges score the model's work, and the hallucination catch is the item to keep, so it must not depend on the model behaving (Nikhil, 5 Oct). Where `HACKATHON-ai-detailed-spec.md` (ADR-099) differs, it wins; it is not in the repo yet, so the admin build follows this ADR until it is shared.

## Supersedes / amends

Amends ADR-077 (cover art for each demo feed post), ADR-097 ("How much do you love your future self?" runs live instead of scripted) and the build plan's owner split for G2–G8.
