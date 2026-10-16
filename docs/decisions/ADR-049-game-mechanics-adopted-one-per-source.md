---
id: ADR-049
title: "Game mechanics adopted, one per source"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-049 · Game mechanics adopted, one per source

## Decision

| From | Mechanic | In the Studio |
| --- | --- | --- |
| **Zero Escape** (999, Virtue's Last Reward) | The flowchart is navigation: jump back to any branch and take the other option, keeping what you learned | Every fork on a route is a point the student can return to and branch from; all answers kept (ADR-004). The core mechanic. |
| **Into the Breach** | Shows exactly what will happen before you commit | Preview the effect of an answer before confirming ("If yes: 2 courses seal, Curtin moves up"). |
| **Civilization** tech tree | Pick a distant goal; the game plots every step to it | Goal-first planning: "settle in Australia" lights up every route that reaches it and the steps each needs. In the study years, the readiness view for each remaining gate (ADR-050). |
| **Outer Wilds** ship log | A knowledge map that fills in as you discover; unexplored leads as "?" | Fog filled by learning as well as visiting: reading the post on the student visa reveals that part of the road (ADR-044, ADR-047). |
| **Detroit: Become Human** | Chapter flowchart with roads not taken as silhouettes | Roads not taken shown faintly so the student knows other futures exist. **Not** adopted: the "how other players chose" percentages, which would push a life decision toward the crowd. |
| **428: Shibuya Scramble** | Several protagonists' timelines run in parallel and affect each other | For students with dependants, the partner's and children's timelines run alongside, and the student's choices visibly change theirs. |
| **Slay the Spire** | The branching map ahead is fully readable, with a clear icon per node type | The fixed badge vocabulary and road-ahead visibility (ADR-047). |
| **Until Dawn** | A "butterfly effect" log of each choice and what it caused | A change log: what each answer changed on the board, so the student can trace why it looks the way it does. |
| **FTL** | An advancing front makes time pressure visible | Intake and scholarship deadlines shown as a front moving along the route, not dates in a list. |

## Reasoning

- These games solve the Studio's exact problems: many branches kept readable, consequences shown before commitment, returning to an earlier choice without losing progress (30 Sep review).
- In those games the timelines are fiction and exploring them is the fun; here each is a real five-year life. The mechanics must make options clear and never make one feel like a high score (ADR-045).

## Constrains

Branch points are stored with the plan so the student can return to them. The engine supports a preview (a dry-run of an answer). Details for design in `HACKATHON-design-studio-4-timelines-deck-companion.md`.
