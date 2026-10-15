---
id: ADR-057
title: "Hackathon scope freeze: one last design build, then build and test"
status: accepted
date: 2026-10-01
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-057 · Hackathon scope freeze: one last design build, then build and test

## Decision

After one last design build (the ADR-056 fork layout, the two missing static pages, and Bikash's everything-sealed moment), the designs are frozen. New ideas go to the "later" list in this record, not into the hackathon.

## In the hackathon demo

- **Student:** sign-up → Ask (chat or tap, fact chips) → the decluttered board reacting live → preview before committing → route detail with comic, bands and numbers on tap, branch-and-return strip → Find deck with a cyberpsychology wildcard → rank and Compare → feed with a labelled scholarship; Bikash's everything-sealed moment; the static university and mentoring pages; the mocked "year 2" triggers.
- **Admin:** the production board + workbench, feed-first New post (structures → approve → render → source check → review → feed settings → publish), Adapt for Instagram / LinkedIn, the comics gap list, a targeted scholarship update with its audience preview, and **static** Insights, Ideas queue and Maintenance queue screens (added 1 Oct).

## Cut from the demo (kept for later)

Goal picker and layers beyond what is already designed (kept as designed screens, not built as logic), parallel lanes, the full stress test (except Bikash), live insights / ideas / maintenance logic (static screens only), the brands editor, video, promotion campaigns beyond the promoted card, the companion logic.

## Plan

1–3 Oct: last design build and freeze. 4–10 Oct: build the demo path on one shared mock-data file used by both apps. 8–9 Oct: test with three students, one counsellor, one marketing staff member. 11–13 Oct: fix, rehearse, record a backup video. Deadline \~14 Oct.

## Final scope (2 Oct)

Deep on a narrow spine, wide only where free. **Tier 1 (real):** Priya's single route end to end; case 2 (the comic onto her route); case 1 (the two-market post into her feed); the research agent on register item R1 and the planted-hallucination catch; deployed with fallbacks. **Tier 2 (scripted, mock data):** Bikash, the scholarship update with audience, the deck wildcard, the engine room. **Tier 3 (static design previews):** everything else designed. The admin app exists to show scalable potential and runs mostly on mock data. Division: Jenish backend and AI; Nikhil front ends, mock data, test, video and pitch. Details in `HACKATHON-build-handover.md` §0c.

## Competition requirements (checked 1 Oct)

Judging: Technical Merit & Gen AI 40%, Problem & Impact 25%, Innovation 25%, UX 10%. Must be a fresh project deployed on Cloud Run / GCP / Firebase with a public repo and a \<3-minute video. So: **three real end-to-end generation cases** (two-market feed post; gap-list comic onto a route; insights → ideas) plus a real engine on mock data; everything else static. Deadline confirmed: 18 Oct 2026. Team registered. Google Cloud project on Jenish's account for now (Nikhil to be added with owner access).

## Extension (1 Oct, ADR-058)

One more design round before the freeze: the proactive opening (three generated futures with assumption chips), "keep options open" recommendations, the watchlist, and the composed weekly feed. The demo opening changes to: sign up → three futures appear → correct one assumption → the board redraws → the system names which doors to keep open.

## Image generation (1 Oct)

The demo's render step generates real images with Google's image models on Vertex AI: artwork only, with text laid on by code; one live persona variant, the others pre-made; a pre-rendered fallback for every demo image. Video is out.

## Shared mock data (1 Oct)

Both apps use Australia only. The top item in the admin comics gap list is a trade-off on Priya's route (ECU Cyber Security, Perth); the scholarship in Updates targets ECU / Perth routes, matching the Studio's "because you ranked ECU Cyber Security".

## Reasoning

Designing had outpaced building and scope grew daily; no working prototype existed and no real user had seen it (1 Oct review).
