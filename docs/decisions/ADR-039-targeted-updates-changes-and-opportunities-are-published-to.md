---
id: ADR-039
title: "Targeted updates: changes and opportunities are published to the students they concern"
status: accepted
date: 2026-09-30
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-039 · Targeted updates: changes and opportunities are published to the students they concern

## Decision

Changes to rules, new scholarships, offers, new programs and courses, government grants, job postings, internships and job-ready programs are published to the students they concern, matched on each student's profile, preferences and ranked routes. There are two kinds:

- **Impact updates**: something changed on a route a student has saved or ranked (a visa rule, a fee, an intake date, a course withdrawn). Matched exactly, always delivered, and the affected plan is flagged **Needs review**.
- **Opportunity updates**: something new the student may want (a scholarship, grant, internship, job, job-ready program, new course). Matched on relevance to their destinations, level, field and weights, with an eligibility check where the data allows.

## Reasoning

- A plan built on a rule that changed is a plan that is now wrong; the student must hear about it. The plan-review flag already exists (S5.2); this makes sure the student is told, not just the plan.
- Opportunities are the most useful thing the feed can carry and the strongest reason to come back. Matching on the student's own routes keeps them relevant, not spam.
- Paths are preferences (ADR-009), so matching uses the profile, weights and ranked routes, never a single "path" label.

## Rules

- **Don't send opportunities a student can't use.** If the eligibility check says no, don't send it. If the check can't tell, send it marked "check your eligibility".
- **Staff see the audience before publishing:** how many students match, and why. Publishing follows the tiered review (ADR-018): rule changes, scholarships and grants are regulated facts and need a reviewer.
- **Every update carries its source, a date, and an expiry** (application deadline, posting close). Expired updates disappear from the feed.
- **Frequency cap** on opportunity updates per student per week. Impact updates are never capped.
- Delivered as a labelled personal item in the feed (ADR-016), with a "why you're seeing this" line ("because you ranked Nursing at Curtin").

## Constrains

Adds an Update record (type, what it applies to, source, valid-until, audience rule) and an audience matcher to the system.

## Settled 30 Sep

- **Channels:** everything appears in the feed; impact updates also go by email or push.
- **Jobs and internships:** staff add them by hand in the admin app for now; importing from job boards comes later.
- **Hackathon:** a thin version is in the demo: staff publish one scholarship, see the matched audience, and it appears on the student's feed.
