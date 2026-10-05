# User management: first account is superadmin, no staff mark

Recorded 5 Oct 2026 from Jenish's request, before the first commit of the OfCourse repo (made from the Heubert Next.js starter). No Jira ticket; this folder is the record.

## Intent

The starter decided who is superadmin from an environment allowlist and marked employees by email domain. OfCourse needs neither: the person who sets the project up is its superadmin, and there is no notion of staff.

## Acceptance criteria

1. **First account is superadmin.** On a fresh database, the first account created (by Google or the dev login) gets the `superadmin` role. Every later account gets the role a superadmin left waiting for its address, else `user`. `SUPERADMIN_EMAILS` and `AUTH_ALLOWED_DOMAINS` are no longer read anywhere and are gone from the env files.
2. **No staff mark.** `STAFF_EMAIL_DOMAINS` is gone. No `staff` column, auth field, filter, chip, switch, action or error message remains, in the app, the tests or the e2e suite.
3. **`.env.example` matches**: the three variables are removed from it. (Blocked for the agent by the session's `.env*` permission rule; Jenish edits it by hand.)
4. **Nothing else about user management changes**: roles, waiting roles, suspension, sign-out everywhere, the last-superadmin rules and the admin's access rules behave as before.

## Out of scope

Any other change to auth, the admin, or the schema. The migration is regenerated as a single `0000_init` because the repo has no history yet; the local database is reset with `bun run db:reset`.
