# User management (first account is superadmin, no staff mark) — Code Review
**Request changes.** 0 CRITICAL, 1 HIGH, 1 MEDIUM, 6 LOW.
Blocking: `src/shared/lib/auth/hooks.test.ts:94-98` — the only test of the first-account rule through the real hook returns early on any database that holds an account, so it passes without asserting anything in a normal run; criterion 1's headline clause has no automated guard.
working tree (uncommitted) at f5d5158 (starter commit, merge base) · 25 files, +115 −479 · 5 Oct 2026

**Reviewed against:** security · security-web · performance · CLAUDE.md (with AGENTS.md) · no project skill applied
**Scans:** secrets clean · dependencies 0 new, 2 pre-existing · code clean (semgrep p/owasp-top-ten, 24 files, no baseline commit possible)
**Not applicable:** security-llm (no model code) · tailwind-v4-best-practices (no styles changed) · vercel-composition-patterns (no routing code) · vercel-react-best-practices (no deployment code)
**Failed to load:** fdd-architecture (dangling symlink: `.claude/skills/fdd-architecture` → `../../.agents/skills/fdd-architecture`, target absent; `setup-ai-skills.sh` not run in this checkout)
**Read outside the diff:**
- `src/shared/lib/auth/index.ts` — whether the count and the insert share a transaction (no) and whether `session.cookieCache` is on (no, so a role set by SQL in the e2e takes effect on the next request)
- `src/features/admin/components/UserPage.tsx` — whether deleting `Toggle` orphaned `useControl`, `Refusal` or `cn` (no)
- `e2e/user-management.e2e.ts`, `e2e/helpers/login.ts`, `e2e/helpers/accounts.ts`, `e2e/welcome.e2e.ts` — whether another spec can create the first account in a parallel worker and break a test (it can; it does not)
- `setup-ai-skills.sh`, `README.md:32`, the `.claude/` listing — what the `.gitignore` hunk drops
- `src/app/admin/users/page.tsx:21`, `src/features/admin/users/server.ts:20` — the two remaining hits for the word "staff"
- tree-wide grep for `staff`, `staffMark`, `setStaffMark`, `isStaffEmail`, `resolveSignupAccess`, `StaffFilter`, `SUPERADMIN_EMAILS`, `AUTH_ALLOWED_DOMAINS`, `STAFF_EMAIL_DOMAINS` — criteria 1c and 2
- `package.json`, `bunfig.toml`, `biome.json`, `tsconfig.json` — versions and lint configuration
- ran read-only: `bun run lint` (clean), `bun run type-check` (clean), `bun test` on the four changed unit files (74 pass, 177 assertions); no database tests, no e2e, no whole suite

## Acceptance criteria

| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1a | On a fresh database the first account (Google or dev login) gets `superadmin` | `src/shared/lib/auth/access.test.ts:98-104` (pure rule); `src/shared/lib/auth/hooks.test.ts:94-98` (through the hook, only when the database is empty) | partially covered — vacuous on any database with an account; the e2e sets the role by SQL |
| 1b | Every later account gets its waiting role, else `user` | `hooks.test.ts:100-118` (DB, opt-in); `access.test.ts:106-116`; `e2e/user-management.e2e.ts:129-157` | covered |
| 1c | `SUPERADMIN_EMAILS`, `AUTH_ALLOWED_DOMAINS` no longer read anywhere | tree-wide grep: neither name in `src/`, `e2e/`, `playwright.config.ts` or any test; `AUTH_ALLOWED_DOMAINS` appears nowhere in the tree | covered, not automatable |
| 2 | No staff mark: no column, auth field, filter, chip, switch, action or error message, in app, tests or e2e | exact-shape assertions: `access.test.ts:165-175` (`ACCESS_ERRORS` equality), `src/features/admin/lib/params.test.ts:6-13`, `src/features/admin/users/server.test.ts:107-118`; `0000_init.sql` has no `staff` column; tree-wide grep finds no `staff` identifier | covered |
| 3 | `.env.example` has the three variables removed | — (hand edit, blocked for the agent) | uncovered, pending by hand — the tree grep still lists `.env.example:17 SUPERADMIN_EMAILS=` and `:22 STAFF_EMAIL_DOMAINS=`; the file was not opened |
| 4 | Nothing else about user management changes | the suites left standing: `access.test.ts` (`roleChangeError`, `accountActionError`), `commands.test.ts` (roles, suspension, sign-out), `UserPage.test.tsx`, `UsersList.test.tsx`, the 7 remaining e2e tests; the diff touches only staff and env lines in `access.ts`, `commands.ts`, `actions.ts`, `server.ts` | covered |

Done differently from the intent: nothing. `resolveSignupAccess(email, invitedRole)` became `resolveSignupRole(firstAccount, invitedRole)`, the database read moved to the hook, the rule kept pure.

## Findings, by file

### `src/shared/lib/auth/hooks.test.ts`

**HIGH · line 94-98 · test that asserts nothing in a normal run** — `if (hadAccounts) return` makes the only test of the first-account rule through the real hook pass without an assertion on any database that holds an account, which is every developer database after its first sign-in (`cleanUp` deletes only `@hooks.e2e.test` accounts, so `hadAccounts` is almost always true). The regression it exists to catch is the one nothing else catches: `noAccountsYet()` never returning true (for example the `cast(... as int)` dropped, so postgres-js hands back the bigint count as the string `"0"` and `=== 0` is false). Then no account is ever made superadmin, the other hook tests still pass (they prove later accounts are not superadmin), the e2e passes (it sets the role by SQL), and criterion 1's headline clause ships unguarded. Breaks the criteria pass and the quality bar (tests assert behaviour). Fix: (a) compute `hadAccounts` with top-level `await` (Bun supports it in test files) and declare the test with `test.skipIf(hadAccounts)`, so the run reports a skip, not a pass; (b) point `DB_TESTS` at a dedicated test database the suite may empty, so `cleanUp` can truncate `user` and the test always runs, or add a CI step `bun run db:reset && DB_TESTS=1 DATABASE_URL=… bun test src/shared/lib/auth/hooks.test.ts`; (c) in the e2e `beforeAll`, when `accountState(SUPERADMIN)` shows the row went into an empty table, assert `role === 'superadmin'` before `setRole`. A test would have caught this: this is the test.

**LOW · line 37-40 · counting by loading rows** — `accountCount()` selects every account's id and reads `.length`; the cost grows with the number of accounts in the development database. Breaks `performance.md` §1. Fix: `count(*)`. A test would have caught this: no, it is a cost.

### `src/shared/lib/auth/index.ts`

**MEDIUM · line 14-17, 69-72 · check-then-act on a privilege grant** — `noAccountsYet()` counts in one statement and Better Auth inserts the user in a later one; the count runs on the app's `db`, outside anything the adapter wraps the insert in, and under Postgres' default READ COMMITTED a shared transaction would not help: two sign-ups that overlap on an empty table both read 0 and both become superadmin. Idiom: Better Auth's `databaseHooks.user.create.before` is a pre-insert callback, not a serialised section. An attacker cannot observe the owner's first sign-in and the window is one round-trip, so this is fragile rather than a hole, and the blast radius is bounded (a second superadmin whom the first can demote). Breaks `security.md` §3 (the grant is decided from a stale read). Fix, without the schema change the intent rules out: in the `after` hook, when `created.role === 'superadmin'` and no invite was consumed, select the superadmin that comes first by `(created_at, id)`; if it is not `created.id`, demote `created.id` to `user`. Each racing hook demotes only itself and the order is deterministic, so exactly one survives. If a later change gives sign-up a transaction, `pg_advisory_xact_lock(<constant>)` around count and insert closes it directly. A test would have caught this: only a concurrency test (two parallel `signUp` calls through the internal adapter on an empty table, asserting one superadmin), which needs the dedicated test database from the HIGH finding.

**LOW · line 15 · O(N) count to learn one bit** — `count(*)` scans the whole `user` table on every account creation to find out whether it is empty; grows with the number of accounts, once per sign-up. Breaks `performance.md` §1. Fix: `select 1 from "user" limit 1` or `exists`, O(1). A test would have caught this: no.

**LOW · line 67-72 · deliberate widening, recorded** — With `SUPERADMIN_EMAILS` gone, the first Google account to sign in on an empty database, any Google account since registration is open, becomes superadmin with nothing configured. Criterion 1 asks for exactly this; recorded because `security.md` §8 asks that a widening be flagged even when deliberate. Two consequences for the README or a runbook: a fresh deployment reachable before the owner signs in hands superadmin to whoever arrives first (sign in immediately after the first deploy; never set `DEV_LOGIN_SECRET` where strangers can reach the server); and because the test is "no accounts" rather than "no superadmin", a database with accounts but no superadmin can never produce one through the app, `bun run db:reset` or a manual `update` being the only way out. Fix: document both. A test would have caught this: no, it is a product decision.

### `e2e/user-management.e2e.ts`

**LOW · line 17-30 · setup bypasses the rule under test; comment overstates** — `beforeAll` grants the role by SQL, so this suite proves nothing about criterion 1, and "no later e2e user can be that first account" holds only inside this spec: with `fullyParallel: true`, `e2e/welcome.e2e.ts:35` may create the first account from another worker. Harmless today (welcome asserts only the dashboard greeting and deletes its user; `setRole` makes this spec's superadmin whatever the order). Breaks the quality bar (a comment that does not match). Fix: reword the comment; see fix (c) under the HIGH finding to make the suite assert the rule when the table is empty. A test would have caught this: no, it is a comment.

### `.gitignore`

**LOW · line 22 · `.claude/` ignored wholesale; not asked for** — Hand-made, outside every criterion. Today it drops only the four `.claude/skills/*` symlinks, which `setup-ai-skills.sh` recreates and whose targets under `.agents/` were already ignored, so a fresh clone ends where it did before. The problem is latent: the broad rule will silently keep any future shared `.claude/settings.json`, `commands/`, `agents/` or a real skill directory out of the repo; the script's own comment anticipates a real skill (`impeccable`) living in `.claude/skills`. Breaks CLAUDE.md "every changed line should trace to the request". Fix: keep the narrow `.claude/settings.local.json` rule and, if the symlinks irritate, add `.claude/skills/` only. A test would have caught this: no.

### `src/app/admin/users/page.tsx` and `src/features/admin/users/server.ts`

**LOW · page.tsx line 21, server.ts line 20 · the word "staff" in copy** — "Personal data: for staff only." (a user-visible lede) and "a handful of staff" (a comment) are the English word, not the mark, so criterion 2 is met as written. The intent says OfCourse has "no notion of staff". Breaks nothing; naming drift. Fix: "for admins only" and "a handful of invited addresses". A test would have caught this: no.

## Pre-existing, not this branch

- `braces` ≤ 3.0.3 — high, GHSA-vfj7-8cjw-p6xm (stack exhaustion through deeply nested patterns, CWE-674).
- `esbuild` ≤ 0.24.2 — moderate, GHSA-67mh-4wv8-2f99 (any website can send requests to the development server).

`bun.lock` is unchanged by this change, so both are inherited from the starter and do not count toward the decision. `bun pm why braces esbuild` names the path; bump them in a `chore` pull request.

## Top 3 priority fixes

1. `hooks.test.ts:94-98` — turn the silent early return into a visible `test.skipIf`, and give the DB tests a database they may empty (or a CI step on `db:reset`) so the first-account rule is proven through the hook on every run.
2. `auth/index.ts:69-79` — close the first-sign-up race in the `after` hook by demoting a superadmin that is not first by `(created_at, id)`; while there, replace `count(*)` with `exists`/`limit 1`.
3. `.gitignore:22` — restore the narrow `.claude/settings.local.json` rule so future shared Claude configuration is not silently dropped.

## Done well

The rule is a pure function (`access.ts:57-60`) with its two reads run in parallel in the hook, the one-pure-module shape CLAUDE.md asks for. The removal is complete and surgical: every orphan the change created is gone, Biome and tsc are clean, the migration carries no `staff` column, and the remaining tests assert exact shapes so a leftover field would fail them rather than slip past a grep.

## Built but not asked for

The `.gitignore` hunk (`.claude/` wholesale instead of `.claude/settings.local.json`). Nothing else: the README copy and comment edits follow directly from the criteria.

## Blind spots

- The race at `index.ts:69-72` is invisible to every test here; only a concurrency test on an empty table (two `signUp` calls in parallel, assert one superadmin) would show it, and that needs a database the suite may truncate.
- "A database with accounts but no superadmin is a dead end" is a product consequence; no test catches it, a line in the README does.
- Criterion 3 is not automatable as the repo stands; a short script asserting that every key in `.env.example` is read somewhere in `src/` (and vice versa) would make it so.

## Fixes applied · 5 Oct 2026

Jenish asked for every finding to be fixed. One `implementer` dispatch applied them; lint, type-check, the unit suite (159 pass) and the database tests (38 pass, the first-account test ran on the then-empty database) are green after.

| Finding | Fixed | Where |
| --- | --- | --- |
| HIGH · hooks test asserts nothing | yes | `hooks.test.ts` computes `hadAccounts` at module load and uses `test.skipIf`, so a skip is reported; `bun run test:db` (new, wipes the dev database then runs the DB suites) documented in README and CLAUDE.md; the e2e `beforeAll` asserts the role is `superadmin` when the account went into an empty table |
| MEDIUM · check-then-act on the grant | yes | pure `settleFirstAccountRole` in `access.ts`; the `after` hook demotes a first-account superadmin that is not first by `(created_at, id)`. Residual: `created_at` is app-set, so the window is narrowed, not sealed |
| LOW · `count(*)` to learn one bit | yes | `noAccountsYet()` is an existence check |
| LOW · counting by loading rows | yes | `hasAccounts()` in the test, `limit 1` |
| LOW · deliberate widening | yes | three README notes under Roles |
| LOW · e2e comment overstates | yes | comment reworded |
| LOW · `.gitignore` ignores `.claude/` | declined | Jenish's decision (5 Oct): the whole `.claude/` folder stays ignored on purpose |
| LOW · "staff" in copy | yes | lede reads "Personal data: for admins only."; comment reads "a handful of invited addresses" |

Left: criterion 3 (`.env.example`) is still a hand edit. The race loser gets its waiting role if one exists, else `user`, a slight generalisation of the suggested fix, unit-tested.

---
Stack: TypeScript · Next.js 16 (App Router, server actions) · React 19 · Better Auth 1.7.7 (`databaseHooks`, drizzle adapter) · Drizzle ORM 0.45 on Postgres via postgres-js · Bun 1.3 test runner with happy-dom · Playwright · Biome · Zod. Passes applied shallowly: architecture (the repo's `fdd-architecture` skill failed to load; judged against CLAUDE.md's folder and boundary rules only).
