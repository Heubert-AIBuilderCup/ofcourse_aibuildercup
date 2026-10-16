---
id: ADR-002
title: "The five \"paths\" are lenses, not forks — a student can be on several at once"
status: accepted
date: 2026-09-29
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-002 · The five "paths" are lenses, not forks — a student can be on several at once

## Decision

Exploratory, Fast-Track, Scholarship & Funding, Career-Focused and Country-Specific are **not branches the student forks between**. They are *lenses*: each is a bundle of (a) the questions worth asking and (b) the trade-offs worth surfacing, **activated by the student's preferences**, and **any number can be active simultaneously**. The student never forks on them.

## Reasoning

- The common cases are blends. A **career-focused student who wants the UK** is Career + Country-Specific. A **career-focused scholarship candidate** is Career + Scholarship. Forcing a single path would misfile the majority of real students.
- Modelled as lenses, each path's questions and trade-offs are reusable across every combination without a combinatorial explosion of "Career-UK-Scholarship" branches.
- This is consistent with the recommendation engine's design (implementation plan §5): *filter-then-score over a constraint set*, not classification into a bucket. Lenses are how the constraints and scorers are organised for authoring and for explanation.

## Rejected alternative

Treating the mind-map paths literally as a decision tree the student traverses. Rejected: the mind maps are excellent *authoring artefacts* (they enumerate the questions and outcomes per concern) but they were drawn as trees, and reading them as trees produces the fork problem.

## Constrains

Each mind map is encoded as a `Lens`: `{activation_rule, questions[], tradeoffs[]}`. No lens is a node in the futures graph. The "path" name may appear in *explanations* ("we prioritised funding because budget was your main constraint") — never as a choice.
