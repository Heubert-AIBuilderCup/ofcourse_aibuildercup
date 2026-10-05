# Heubert Next.js Starter

A full-stack Next.js starter with Google sign-in, roles and a users admin, ready for AI-assisted development.

## Stack

| Category | Tools |
| --- | --- |
| Core | Next.js 16 · React 19 · TypeScript 5 |
| Data | Postgres 17 in Docker · Drizzle ORM |
| Auth | Better Auth with Google |
| UI | Tailwind CSS 4 · shadcn/ui (25 components) · Sonner · switchable design systems |
| Testing | bun test with happy-dom · Testing Library · Playwright |
| DX | Bun · Biome · Husky with lint-staged |

## What you get

- **Google sign-in** with a sign-in page at `/`, a signed-in dashboard at `/dashboard`, and a proxy that sends signed-out visitors to sign in and back.
- **Roles:** user, admin and superadmin. The first account to sign in on a fresh database becomes superadmin; every other role is given in the admin.
  - Sign in immediately after the first deployment: the first account on an empty database becomes superadmin, whoever it is.
  - Never expose `DEV_LOGIN_SECRET` where strangers can reach the server; with it, anyone can create that first account.
  - A database that has accounts but no superadmin cannot produce one through the app. The way out is `bun run db:reset` (which wipes it) or a manual `update "user" set role = 'superadmin' where email = …`.
- **Users admin** at `/admin/users`: search and filters, who is online now, a page per account, role changes, roles waiting on an address before its first sign-in, suspension with a reason, and sign out everywhere. The last superadmin can never be removed or suspended.
- **Switchable design systems** in `src/design-systems`: Industry (from Claude Design) is active, Neutral is plain shadcn. Switching is one line; each system carries its tokens, fonts and a DESIGN.md for agents.
- **Light and dark themes** that follow the device, rendered on the server without a flash.
- **A dev login** so Playwright and the browser console can sign in without Google.

## Quick start

Prerequisites: Bun 1.3 or later, Node 22 or later, Docker.

```bash
bun install
cp .env.example .env        # fill in BETTER_AUTH_SECRET and the Google keys
bash setup-ai-skills.sh     # Claude Code skills
bunx playwright install chromium
bun run dev                 # Postgres, migrations, then http://localhost:3000
```

Without Google keys, sign in from the browser console on `http://localhost:3000`:

```js
await fetch('/api/dev-login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-dev-login-secret': '<DEV_LOGIN_SECRET>' }, body: JSON.stringify({ email: 'you@example.com', name: 'You' }) }); location.href = '/dashboard'
```

## Claude Code plugins

The team workflow plugins, `heubert-team-workflow` and `heubert-discovery`, are not set up in this repo.

- **Heubert claude.ai organisation members** get both automatically: the organisation turns them on in claude.ai, and Claude Code syncs them into every session.
- **Anyone else** needs read access to `heubert/heubert-claude-workflow` on Bitbucket, then runs:

```bash
claude plugin marketplace add git@bitbucket.org:heubert/heubert-claude-workflow.git
claude plugin install heubert-team-workflow@heubert
```

Organisation members should not run these: the plugin would load twice.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Starts Postgres, applies migrations, runs Next on 3000 |
| `bun run build` | Production build |
| `bun run lint` / `lint:fix` | Biome |
| `bun run type-check` | TypeScript |
| `bun run test:run` | Unit and component tests |
| `bun run test:db` | **Wipes the development database**, then runs the database-backed tests |
| `bun run test:e2e` | Playwright end-to-end tests |
| `bun run db:generate` | A migration from schema changes |
| `bun run db:reset` | Wipe the database and migrate |

## Making a project from it

1. Pick a design system in `src/design-systems/index.ts` (see its README).
2. Rename `SITE_NAME` in `src/shared/lib/site.ts` and `name` in `package.json`.
3. Change the ports if 3000 or 5433 are taken: `package.json`, `docker-compose.yml`, `.env`, `playwright.config.ts`.
4. Add your tables to `src/shared/lib/db/schema.ts` and run `bun run db:generate`.
5. Build features under `src/features/<feature>` and pages under `src/app/(app)`. Add each new top-level path to `APP_PATHS` in `src/shared/lib/auth/gate.ts` and to the proxy matcher in `src/proxy.ts`.

See `CLAUDE.md` for the rules agents and people follow in this repo.
