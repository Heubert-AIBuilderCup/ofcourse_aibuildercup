---
id: ADR-093
title: "For the hackathon, the Decision Studio and the admin app are standalone products"
status: accepted
date: 2026-10-02
amended_by: [ADR-107]
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-093 · For the hackathon, the Decision Studio and the admin app are standalone products

## Decision

- The hackathon entry is **two standalone apps** (the Decision Studio and the admin app) on their own backend and mock data. **Edge, the CRM and any Heubert or Expert internal system are not part of it**: not called, not shown, not mentioned in the demo, the repo or the write-up.
- **Pre-filled answers** come from what the student has already told the app (sign-up, earlier screens, the composer) or, for the demo, from Priya's seeded profile. No copy claims a counsellor or another system "already has" anything.
- **"Send to a counsellor"** generates the counsellor brief and the parent brief inside the app (shareable links); it does not hand off to any external system. In the pitch, the counsellor is a role any education agency has, not our CRM.
- The pitch speaks of students, parents, counsellors and education agencies in general; Heubert and Expert appear only as the team that built it.

## Reasoning

Judges assess the product they can see; internal systems are irrelevant to them and would raise the fresh-project question (Nikhil, 2 Oct). The integration with Edge and the CRM belongs to the final build (FINAL documents).

## Supersedes, for the hackathon only

Any hackathon reference to the CRM, Edge, or counsellor-system pre-fill. ADR-013/028/064 (CRM hand-off, briefs inside the CRM) and the Technical Design apply to the final build.
