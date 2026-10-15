---
id: ADR-041
title: "Quality bar: nine improvements adopted from the delight / cost / value review"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-041 · Quality bar: nine improvements adopted from the delight / cost / value review

## Decision

1. **Show what changed.** After every re-rank, the board and staged view highlight what moved and what sealed ("Curtin moved up 2", "1 course sealed") for a moment.
2. **Sign-up is two fields.** Email (or phone) and the optional persona question. The first Ask question appears within seconds.
3. **At most one confirmation chip per turn** in Ask, and only when the inference is confident. Otherwise the AI asks instead of guessing.
4. **Ask is a guided intake, not a chatbot.** Short context, structured extraction, question selection by rules. It answers questions about the Studio itself; general questions are pointed to the feed or a counsellor.
5. **Sealing copy is "not yet reachable", never "rejected"**, and the unblock path is shown in the same breath.
6. **The text trade-off card is a designed object**, equal in weight to a comic, so a route without a comic doesn't look poorer.
7. **Light on bandwidth.** Comics and cards ship compressed and lazy-loaded; the Studio is usable on a 3G connection; text arrives before images.
8. **Video only for the highest-frequency gap items**, always behind a storyboard approval.
9. **One-click export** from the admin app (SVG and PNG with the caption) so heavier edits in a design tool are one step away, not a rebuild.

## Reasoning

Each comes from a specific risk found in the 30 Sep review: change blindness, sign-up drop-off, confirmation fatigue, cost blow-up from open chat, discouraging tone, the empty-comic case, Nepal's mobile networks, video cost, and staff falling back to Canva. None of them changes an earlier decision; they set the bar the decisions are built to.

## Constrains

Written into System Requirements §4b (portal quality bar), A2/A6 (admin) and §12 (metrics). Part of the hackathon prototype where cheap (1, 2, 3, 5, 6, 9); 4 and 7 are architecture rules for the build; 8 is policy.
