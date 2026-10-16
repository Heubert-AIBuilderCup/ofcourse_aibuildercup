---
id: ADR-101
title: "Agents: the research agent is the headline; a content agent and a watcher agent are stretch goals"
status: accepted
date: 2026-10-02
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-101 · Agents: the research agent is the headline; a content agent and a watcher agent are stretch goals

## Decision

- **G7, the research agent**, stays the headline agent, built on Google's agent tooling if the day-3 spike works, with its trace visible.
- **A1, a content agent** (admin): chains existing pipelines (library, research, facts, structures, render, review) from an evidence gap, idea or comic gap to a review-ready draft. Fixed tool menu, code-enforced order, human gates after research, structures and render; it never approves its own work.
- **A2, a watcher agent** (student side): deterministic checks per student (stale facts, deadlines, opportunities, stale assumptions, route changes), model only to prioritise and phrase; caps from ADR-039/054; stale claims trigger research, never a guess. Runs from the Simulate button in the demo.
- **No agents** in the engine (eligibility, ranking, sealing stay rules) and **no free-roaming student chat agent**.
- A1 and A2 start only after the spine, the comic, the hallucination catch and G7 are deployed (cut line, ADR-097).

## Reasoning

Agents add real value where autonomy saves human effort under human control (research, content production, monitoring) and show the scalable potential the admin app exists for; they would harm consistency in the engine and add risk in open student chat (2 Oct). Specs: A1, A2 in `HACKATHON-ai-detailed-spec.md`.
