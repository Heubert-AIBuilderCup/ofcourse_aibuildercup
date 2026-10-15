---
id: ADR-076
title: "Tasters defined, and the holistic profile screen"
status: accepted
date: 2026-10-01
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-076 · Tasters defined, and the holistic profile screen

## Decision

- **A taster** is a ten-minute hands-on try of a field: a task of the kind a first-year student or junior actually does (cyber: find the phishing email among five; nursing: order four arriving patients; psychology: pick the likeliest explanation of a short case; data science: spot the trend in a small table; accounting: find the error in a tiny ledger; UX: choose the better of two screens and say why). It ends with one tap ("How did that feel? energising / fine / draining") and the time taken. The result is a **self-reported fit signal**, shown on the profile ("tried a taste of cyber security: energising"), used only to suggest fields; never a score that gates or ranks.
- **The holistic profile** is one screen bringing everything together: facts (confirmed, assumed, unknown), route weights (coins), life values, goals, interests (RIASEC), personality (OCEAN; phrasing only), tasters tried and how they felt, skills self-assessment, watchlist, ranked routes and exploration state, consents. Every item shows its source and data state, what it is used for, and is editable in place. Students see what the system knows and why; nothing is hidden.

## Reasoning

Doing a slice of the work tells a student more about fit than any quiz, which is why companies use work samples and universities use taster lectures (Nikhil asked for a concrete definition, 1 Oct). A single profile that shows what is known, where it came from and what it is used for is the trust mechanism behind the whole intake (ADR-012, 046, 069).

## Constrains

Taster library: one per seeded field, counsellor-authored, with a model answer and explanation. Profile screen is the "My profile" of ADR-046 extended with ADR-068/069/070 data. Hackathon: two tasters (cyber, psychology) static; the profile screen static.
