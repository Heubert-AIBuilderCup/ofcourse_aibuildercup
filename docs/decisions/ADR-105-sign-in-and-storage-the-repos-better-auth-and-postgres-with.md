---
id: ADR-105
title: "Sign-in and storage: the repo's Better Auth and Postgres, with a student page and an admin page"
status: accepted
date: 2026-10-05
source: SHARED-decision-record.html (imported 2026-10-07)
---

# ADR-105 · Sign-in and storage: the repo's Better Auth and Postgres, with a student page and an admin page

## Decision

- **Google sign-in and the six-digit email code run on the repo's existing authentication (Better Auth)**, not Firebase Auth. No phone or SMS (unchanged).
- **Two sign-in pages.** Students sign in at the app's root URL with Google or an email code, and every account made there is a student. Staff sign in at `/admin/sign-in` with Google only. Each page refuses accounts that belong on the other.
- **The first account on an empty database becomes superadmin only when it signs in on the admin page.** The first account on the student page is a student, so a public deploy can never hand superadmin to a tester.
- **Data lives in the repo's Postgres (Drizzle)**, not Firestore. The apps are deployed on Google Cloud, with the services (for example Cloud Run and Cloud SQL) chosen in the build plans. Vertex AI and the image model are called from the server.

## Reasoning

The repo already has working Google sign-in, roles, suspension and a users admin on Better Auth and Postgres (Jenish and Nikhil, 5 Oct). Rebuilding them on Firebase would cost days before the 8 Oct test. The competition requires deployment on Google Cloud and Google's AI stack, and this keeps both.

## Supersedes / amends

Amends ADR-098 (the sign-up line) and the handover's stack (Firestore, Firebase Hosting and Auth). The module boundaries of `FINAL-system-architecture.md` still apply.
