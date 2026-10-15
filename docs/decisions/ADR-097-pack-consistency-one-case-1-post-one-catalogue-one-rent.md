---
id: ADR-097
title: "Pack consistency: one case-1 post, one catalogue, one rent figure, a firm cut line, tiers reconciled, and answers to the blocking questions"
status: accepted
date: 2026-10-02
amended_by: [ADR-106, ADR-109, ADR-112, ADR-123]
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-097 · Pack consistency: one case-1 post, one catalogue, one rent figure, a firm cut line, tiers reconciled, and answers to the blocking questions

## Decision

- **Case 1 is "Paid work and grades".** Its mock source is authored from the start with ¶5 (minimum-wage earnings at 20 hours, cited), so the Nepal version converts a figure the source genuinely contains (consistent with ADR-083). "How much do you love your future self?" is a second, scripted feed post.
- **Catalogue:** 6 seeded cities with full bundles (+ Wollongong for Suman) and \~12 seeded courses; larger stack counts are display-only names.
- **Rent fact:** "rent about AUD 160 a week lower (about 30%)", everywhere.
- **The third real case is the research agent plus the hallucination catch** (§0c); insights → ideas is a static preview.
- **Cut line:** spine (G1, G9) → comic (G3, G4) → hallucination catch (G2) → research agent (G7, with replay) → G8; first cuts G5, G6, G10. The engine (\~1.5 days, no AI) is assigned to whichever coding agent is free first.
- **Spec tiers are reconciled to §0c:** the composer (G1), the three futures and board (engine), the Find hand's whys (G9) are **Real**; "Ask about this course" is Real for the demo question via the library/G7, Scripted otherwise; offsets (G10), Adapt for Instagram (G6) and the Nepal variant (G5) are **Real if time allows, else Scripted**.

## Answers to blocking questions

| Question | Answer |
| --- | --- |
| AD-Q4 / Q5: which source has a money figure; where the exchange-rate source shows | "Paid work and grades" ¶5. The rate appears as a small source line under the converted figure: "NPR at 88 per AUD · mock rate · 1 Oct 2026". |
| AD-Q7: does the reviewer's approval publish regulated content? | Yes: for regulated content the reviewer's approval is the publish action. For general content the editor publishes. |
| DS-Q2: where composer corrections go | Every confirm / fix is logged to `parse_logs` and appears in the admin Parsing monitor; no Studio screen is needed. |
| DS-Q5: which "might feel" rule binds | ADR-089: effect size × how much she weights the dimension. The design's sign-plus-weight is replaced. |
| DS-Q3: does PR have "not sure"? | Yes: yes / not sure / no; "not sure" weighs 2 (handover weight rules). |
| AD-Q1 / Q2: tiers and Gen AI ids | From handover §0c and the build plan's G1–G10, as above. |
| AD-Q10: which third real case | The research agent and the hallucination catch (§0c). |

## Reasoning

An independent review of the assembled pack (2 Oct) found older copies at the top level, contradictions between sections and documents, a missing engine contract, and a workload larger than the calendar. The engine contract is now in the hackathon architecture (§4b).
