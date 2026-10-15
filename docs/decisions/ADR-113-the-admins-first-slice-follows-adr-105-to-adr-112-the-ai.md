---
id: ADR-113
title: "The admin's first slice follows ADR-105 to ADR-112; the AI detailed specification's extra items come in later slices"
status: accepted
date: 2026-10-05
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-113 · The admin's first slice follows ADR-105 to ADR-112; the AI detailed specification's extra items come in later slices

## Decision

For the first admin slice (the feed post from a source), the decisions in ADR-105 to ADR-112 are final where `HACKATHON-ai-detailed-spec.md` differs. The slice is a subset of the spec, not a departure from it. These spec items are revisited in later slices:

- legibility at 390 px with a 14 px minimum (this slice: 11 px at 328 px);
- two to three templates per run (this slice: the editor picks one to three);
- the editor editing an overflowing draft's wording with numbers locked;
- the LinkedIn carousel as a PDF;
- Instagram's 5–8 hashtags (this slice: up to 150 words and up to 8 hashtags);
- the deterministic fallbacks beyond a text-only cover and code verdicts: marking facts by hand, basic drafts, default market wording, template captions, and "not checked" vision results needing an override;
- the spec's logging fields, prompt files and the G3, G5, G6 and G8 eval sets.

Fixes owed to the spec itself, for its next revision:

- **G2 paragraph merging** ("merge paragraphs under 40 words") breaks the planted twin and the design's ¶1–¶5; merge only short fragments.
- **The model's confidence is still used** by the G2 and G7 judges, although 0.4 and ADR-096 say confidence is computed in code.
- **G2 should say** that the judge cannot clear a number mismatch (ADR-112).
- **G5's market reviewer and G3's tier detection** are deferred by ADR-109.
- **Out-of-date sources:** the refinement's cut order yields to ADR-097, and its Firestore vector search to ADR-105.

## Reasoning

The 8 Oct test needs a slice that works end to end. Each difference is either stricter or an addition the spec makes later, so nothing built now has to be undone (Nikhil, 5 Oct).

## Supersedes / amends

Amends ADR-112 (the spec does not override it for this slice) and, for this slice only, ADR-099.
