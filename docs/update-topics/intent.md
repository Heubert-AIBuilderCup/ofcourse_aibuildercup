---
title: "Target updates by topic as well as institution and country"
author: Nikhil
requested by: Nikhil
---

# Target updates by topic as well as institution and country
_Intent written 16 Oct 2026 with Nikhil. From a conversation in chat; there is no idea ticket._

## Problem

- An admin can aim an update at an institution (or all of them) and a home country (or all), and nothing else. The audience is stored as `{ institution, homeCountry }` (`src/shared/lib/db/schema.ts:534-536`) and matched in `src/features/updates/lib/feed-updates.ts:21-31` and `src/features/updates/lib/audience.ts:36`.
- News that concerns a field rather than one institution cannot reach the right students. For example: a new data scholarship, a change for health courses, or a cyber security graduate program. Today it goes either to everyone or to a single institution's students.
- Posts go to every student (`src/features/content/server/feed.ts:15-17`). So there is no way to reach "students interested in data, from Nepal".

## Proposed outcome

- An admin can aim an update at the students a topic concerns, alone or together with an institution and a home country.
- Each student who sees it is told why, in her own terms.
- Every update made before this change reaches exactly the students it reaches today.

## Affected users and systems

- **Admins who make and approve updates:** `/admin/updates`, the update form and its reach preview.
- **Students:** the updates on `/feed`.
- **The admin insights overview**, which uses the same audience rule (`src/features/insights/lib/overview.ts`).
- **Data:** the stored update audience; students' roadmaps and onboarding answers, read only.
- **Owner:** Nikhil.

## Scope

- **Topics:** the eight broad fields (Cyber security, Data, Business, IT, Psychology, Health, Engineering, Design), named as in `src/features/roads/data/fields.ts`.
- **Surfaces:**
  - the update form and reach preview on `/admin/updates`;
  - the insights overview;
  - the student's `/feed`.
- **Variants:** all home countries; all institutions.

## User stories

1. As an admin, I want to aim an update at a topic, alone or with an institution and a home country, so that news about a field reaches the students it concerns.
2. As a student, I want to see updates about the fields I'm on or interested in, and why I'm seeing them, so that I trust what reaches me.

## Acceptance criteria

### Story 1: the admin's audience

1. **The dropdown.** Given the update form on `/admin/updates`, when it is open, then the audience offers a Topic choice beside Country, with "All topics" first and then the eight topics. A new update starts on "All topics".
2. **Saved.** Given an update saved with a topic, when it is opened again or approved, then its topic is the one chosen.
3. **Older updates.** Given an update stored before this change (no topic), when it is listed, previewed or matched, then it reads as "All topics" and reaches the same students as before.
4. **All three must match.** Given an audience with an institution, a topic and a home country, when its reach is previewed on `/admin/updates`, then it counts only students who match all three. "All" on any of them leaves that part out.
5. **The preview counts interests.** Given the mock students in the preview, when a topic is chosen, then a mock student counts if one of her ranked courses is in that field or she has that field among her stated interests.
6. **Insights.** Given the insights overview, when it counts an update's reach, then it uses the same rule as 4.

### Story 2: the student's feed

7. **A course in the field.** Given a live update aimed at a topic, when a student opens `/feed`, then she sees it if one of her roadmaps has a course in that field (its course, alternative or stacked course), and its other audience parts match.
8. **A stated interest.** Given a live update aimed at a topic, when a student opens `/feed`, then she also sees it if she chose that field ("Which field?") or one of her areas ("Pick up to three") maps to it, on any of her roadmaps, and its other audience parts match. An answer stored as assumed does not count.
9. **The why line.** Given an update she sees through a topic, when its card is shown, then the why line says:
   - "Because <topic> is on your roadmap "<name>"" when it matched a course;
   - otherwise "Because you said you're drawn to <topic>".
10. **Once only.** Given a student who matches through several roadmaps or both ways, when `/feed` is shown, then the update appears once, through the first roadmap that matches (last opened first), preferring a course match.
11. **Others never see it.** Given a student who matches none of the update's audience parts, when `/feed` is shown, then the update is not there.

## Edge cases

- **A roadmap whose answers match no road** (code: `src/features/updates/server/feed-updates.ts`, "none when its answers match no road") → 7 does not apply; 8 still applies through its answers.
- **Assumed answers** (code: `src/features/roads/model/match.ts:52-55`, assumed counts as unanswered) → 8.
- **An area that maps to two fields** (code: `AREA_FIELDS['IT and computing']` is `['it', 'cyber']`) → 8: it counts for both topics.
- **Updates stored before the change** (code: the audience jsonb) → 3.
- **A student with no roadmaps (an admin)** sees none (code, today's behaviour) → 11.
- **Niche fields as topics** → decided out of scope (Nikhil, 16 Oct).

## Constraints

- **Deadline:** submission closes 18 Oct 2026, 23:59 IST. This ships before it only if all its criteria pass; otherwise it waits.
- **No migration:** the topic is stored inside the existing audience.
- **No end-to-end tests without Nikhil's ask** (CLAUDE.md).

## Out of scope

- Niche fields from the field graph as topics.
- Aiming an update at one named student.
- Aiming at a city or a single course.
- Topics on posts (posts keep reaching every student).

## Dependencies

- None. It is independent of `docs/course-finder`.

## Open questions

None.

## Delivery

17 Oct 2026. Pull request `feat/update-topics` → feat/course-compare (stacked last; merges after the course finder). Covered by tests: criteria 1–11 (criterion 2 by a database test). QA re-checks by hand: docs/update-topics/smoke.md. No migration and no switch.
