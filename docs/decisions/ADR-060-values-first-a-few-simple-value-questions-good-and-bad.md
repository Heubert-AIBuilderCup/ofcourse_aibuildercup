---
id: ADR-060
title: "Values first: a few simple value questions, good-and-bad instead of ranking, and what flexibility buys"
status: accepted
date: 2026-10-01
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-060 · Values first: a few simple value questions, good-and-bad instead of ranking, and what flexibility buys

## Decision

- **A few simple value questions open the Studio** (three or four taps: what matters most right now; how flexible on where you live; would you want to stay after; how soon). Facts (grades, scores, budget) are not asked up front; they appear as assumption chips to correct (ADR-058).
- **No system ranking, no pushing.** The system never labels an option "ranked 1st", "best" or "recommended". Each option shows its **good and bad per dimension**, held up against the student's value system (their weights), with the dimensions they weighted most drawn larger. Internal sorting still decides what is shown (fold rules), but it is never displayed as a rank. The student's own 1st / 2nd / 3rd (ADR-038) stays; it is their choice.
- **Show what flexibility buys.** For each dimension, a "what if I were flexible on…" control shows the delta before anything changes: what they would gain, what they would give up, and how many more options open ("flexible on where you live: regional PR points, rent \~30% lower; you give up the big-city job market; 4 more courses open").
- The three opening futures (ADR-058) are **illustrations of their values** ("built around staying", "built around cost", "built around career"), each with good and bad, never a recommendation.

## Reasoning

- The product is for exploring; a cardinal ranking or a recommendation closes the exploration and takes the decision away from the student (Nikhil, 1 Oct). Weights were chosen precisely to express values rather than to produce a winner.
- Flexibility is where most real value lies for students; showing its price and its reward makes the trade-off concrete without telling them what to do.

## Amends

ADR-058: "recommend like a counsellor" becomes "show good and bad like a counsellor who respects your values"; counsellor voice may still hedge and explain, never direct. ADR-025/ADR-046: "best match for your weights" labels are replaced by per-dimension good/bad; the student-vs-system rank distinction resolves to the student's rank only. ADR-030: the weights plaque gains the "flexible on…" control.
