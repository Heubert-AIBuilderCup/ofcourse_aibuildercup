---
id: ADR-046
title: "Design must survive a state catalogue and five stress-test students"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-046 · Design must survive a state catalogue and five stress-test students

## Decision

Every Studio screen is designed against (1) a **state catalogue** and (2) **five stress-test students**. A screen is ready when it works for all five in every relevant state.

## State catalogue

- **Data states** on every card and step: confirmed · estimated · unknown · out of date · under review · conflicting sources — each with its own look and a line saying what the student can do.
- **Eligibility states:** open · open with conditions · partly eligible · not yet reachable (one blocker) · several blockers · everything sealed (shows the nearest reachable options and what would open them).
- **Route shapes:** a straight road; a pathway (diploma or foundation → degree); a fork inside a route (two ways to PR, with trade-offs); a setback (refusal and reapply, deferred intake); several offerings of one course (campus × intake).
- **System states:** loading · error · empty search · slow connection · reduced motion.

## Five stress-test students

1. **Priya** — the baseline (offshore, single, IELTS 7.0, parents pay AUD 36k/yr fees).
2. **Suman** — married with a child; partner wants to work; dependants' costs and visa.
3. **Anisha** — IELTS 5.5 against a 6.5 requirement; every good route starts with a test or pathway step.
4. **Rohan** — already in Australia on another visa (onshore) with a prior student-visa refusal.
5. **Bikash** — budget below every course on the board; everything sealed.

## Also required

- Ask shows extracted **facts** back as editable chips ("Budget: AUD 36,000 a year, fees only") before they touch the board, not just the preference.
- A **My profile** screen: every captured fact, its source and confirmation state, editable.
- Costs anchored to the student's own budget ("within your AUD 36k", "about AUD 4k over"), shown in AUD with NPR alongside; the visa funds-to-show figure kept distinct from the cost of living.
- Compare bars say what "full" means for that country's rule.
- The student's ranking and the system's match score look different ("Your 1st choice" vs "Best match for your weights"); explanations give the top one or two reasons and admit near-ties.
- PR bands show their conditions (e.g. state nomination is competitive). Visa and PR content is framed as information with sources; personal advice comes from a registered agent or counsellor.
- Share a route with a parent (read-only link).
- Bands never rely on colour alone; text on blue meets contrast; the staged view is the accessible version of the board.

## Reasoning

- The v5 screens handle the happy path; most real students are not the happy path. Designing the hard cases now is cheap; discovering them on real data is not (30 Sep stress test).

## Constrains

Mock profiles for the five students are part of the design handoff and of the developers' test fixtures. Migration-advice framing needs a legal check with registered agents before the student-facing launch.
