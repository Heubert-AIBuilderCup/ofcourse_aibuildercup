@AGENTS.md

# Heubert Next.js Starter

A full-stack Next.js starter: Google sign-in, roles, a users admin, Postgres with Drizzle. Product truth for a project made from it goes in PRODUCT.md (OfCourse's is there); intents and plans in docs/<slug>/.

## Commands

- `bun install` (Bun only; npm/pnpm/yarn are refused)
- `bun run dev` — checks port 3000 is free (scripts/check-port.mjs), starts Postgres in Docker and waits until it is healthy (`db:up`), applies pending migrations (scripts/migrate.ts), then runs Next on 3000. Postgres keeps running after you stop Next; `docker compose stop` stops it.
- `bun run db:up` — Postgres alone, on 127.0.0.1:5433 · `bun run db:generate` — a migration from schema changes · `bun run db:reset` — wipe and migrate
- `bun run lint` / `bun run lint:fix` / `bun run format` — Biome
- `bun run type-check` — tsc --noEmit
- `bun run test:run` — unit and component tests, `bun test` with happy-dom (test/setup/happydom.ts). It runs under a 6 GB memory cap (scripts/capped.sh) because a failing component test here has sent `bun test` past 29 GB and killed the machine; run every `bun test`, one file or the suite, through it: `bash scripts/capped.sh bun test <file>`. The known trigger: a failing assertion whose diff prints a DOM element (`expect(node or [nodes]).toEqual(...)`, `toHaveFocus`), so tests compare strings, counts and attributes (`getAttribute('aria-label')`, `document.activeElement === el`), never elements. Test the brain, not the beauty: unit tests pin logic, hooks, actions and components with behaviour (test-first); pages, layouts, styles and presentational pieces get none. The look is checked against the design boards with screenshots, never asserted pixel by pixel. Database tests run by path: `DB_TESTS=1 DATABASE_URL=… bun test <file>`
- `bun run test:db` — **wipes the development database** (`db:reset`), then runs the database-backed suites with `DB_TESTS=1`, so the first-account rule in src/shared/lib/auth/hooks.test.ts runs on an empty table instead of being skipped
- `bun run test:e2e` — Playwright against a dev server it starts itself on 3000; run only when someone asks for it.
- No end-to-end code without being asked: no new specs, no throwaway Playwright scripts for screenshots, no browser automation inside a build. The standing specs under e2e/ are updated only when a change alters what they cover. The look of a screen is the developer's smoke test; a screenshot comparison against the design boards happens only when they ask for one.
- Dev login for e2e: `POST /api/dev-login` `{ email, name? }` with header `x-dev-login-secret: $DEV_LOGIN_SECRET` signs in as that email; 404 in production or without the secret (playwright.config.ts passes it to the server it starts)
- `bun run build`

## Git

- Never commit or push without explicit approval. Squash micro-commits into one semantic commit. Never add co-author text to commit messages.
- Conventional Commits (`type(scope?): description`), enforced by .husky/commit-msg.
- Branch names: main, dev, staging or feat/ fix/ hotfix/ refactor/ docs/ chore/ test/ perf/ ci/ release/ prefixes, enforced by .husky/post-checkout.
- pre-commit runs lint-staged and type-check; pre-push runs the tests and the build.
- Never start a dev server for the user; they run it.

## Code

- Folders: src/app (routes), src/features/<feature> (feature code), src/shared/{components,hooks,lib,types}. shadcn components are in src/shared/components/ui.
- Access rules live in one pure module, src/shared/lib/auth/access.ts; pages and actions call it, the proxy only checks the cookie. New signed-in pages go under src/app/(app) and into APP_PATHS and the proxy matcher together.
- Student URLs (the map is in PRODUCT.md): onboarding lives at `/onboarding/<step>` with named steps, never numbers (`welcome`, `character`, `facts`, `study`, `living`, `after`, `attention`, then `/onboarding/done`), and one URL per screen with the question as a readable slug segment (`/onboarding/facts/who-pays`, `/onboarding/study/learning`). `/onboarding` resumes where she left off (one rule, `onboardingResumePath` in src/features/opening/model/landing.ts); a bare step (`/onboarding/facts`) opens its first unanswered question. Internal keys never appear in a URL: slugs map to keys in src/features/opening/model/onboarding.ts. Her answers live on roadmaps (one `roadmap` row each); onboarding answers the one she is making (unfinished, at most one). With its coins stored she lands on `/onboarding/done`, and onboarding stays open while a roadmap is being answered: "Go to your roadmaps" there finishes it (`finished_at`), so from then, answering none, `/`, sign-in, `/start`, `/onboarding` and every `/onboarding/...` URL, `/onboarding/done` included, take her to `/roadmaps` (the lock is the `(locked)` route group's layout; done/ sits outside it and closes by the same rule, `onboardingClosed`). `/roadmaps` is the list and her landing, `/roadmaps/[id]` a roadmap's board (it sends her back to where she left off while one is being answered), `/road` a redirect to the last opened one; `/attention` redirects to step 05. Retired paths redirect permanently in next.config.ts.
- Every redirect is answered before anything is painted, and in one hop: student and admin pages have no `loading.tsx` (under a loading boundary a page's `redirect()` or `notFound()` arrives inside a streamed 200, so the browser paints that page, then loads another), and each entry point sends a visitor straight to where she belongs (`/` and `/start` to her resume path, an admin to `/admin/users`). e2e/routes.e2e.ts checks it for every kind of visitor.
- Server actions return `ActionResult` (src/shared/types/action-result.ts) and never throw.
- Tailwind 4 is CSS-first (src/app/globals.css): semantic tokens only, no @apply, OKLCH colours, rem not px (two exceptions: hairlines stay 1px, and icons keep their px size through `size-icon-sm` / `size-icon` / `size-icon-lg`, so they do not grow with the 1440→1920 scaling). Dark mode follows `<html data-theme>`.
- Sizes are fluid through the design system's roles: type `text-display`, `text-h1` to `text-h4`, `text-lead`, `text-caption`, `text-overline`; spacing `px-gutter`, `py-section`, `gap-section`, `gap-stack`. Never a size per breakpoint.
- Layout responds to the page's own width (container queries on an `@container` root) at Tailwind's own container sizes, two breakpoints and a cap: `@max-xl:` below 36rem/576px (phones: one column, 1rem side gutter, sticky actions), stacked between 36 and 64rem (panel as a band on top, one column), `@5xl:` from 64rem/1024px (side by side). From 1024 there is no breakpoint: the page keeps growing, and from 1440 to 1920 the whole design scales with the screen (the root font-size grows to 4/3 in globals.css, so 1920 is the 1440 design larger, not just wider). Above 1920 content stays in a centred frame while backgrounds fill (`--container-cap`, the one size of our own; `split-page`, `split-panel` for split pages). Content widths are Tailwind's: `max-w-sm` 24rem (form cards), `max-w-2xl` 42rem (question screens), `max-w-7xl` 80rem (futures, wide screens), `max-w-prose` for running text. Grids inside content size themselves (`repeat(auto-fit, minmax(…, 1fr))`), never a third breakpoint; never an arbitrary `@max-[…]`, `@min-[…]` or `max-w-[…]`.
- Check every screen at 360, 390, 768, 1024, 1280, 1366, 1440, 1536, 1920 and 2560 wide. The design canvas (Claude Design) draws 390, 768, 1440 and 1920 as fluid boards; the other widths are checked in screenshots.

## Design

- The active design system is Industry: read src/design-systems/industry/DESIGN.md before any UI work. Its tokens arrive through the shadcn variables, so components only use semantic classes.
- Systems live in src/design-systems/<name>; src/design-systems/index.ts picks the active one. Switching or adding a system: src/design-systems/README.md.
- Read node_modules/next/dist/docs before writing Next.js code (see AGENTS.md).

## Skills

.claude/skills holds the Vercel, Tailwind 4 and FDD-architecture skills (setup-ai-skills.sh). Re-run `bash setup-ai-skills.sh` after a fresh clone.

<!-- BEGIN:claude-behavior (source: https://github.com/multica-ai/andrej-karpathy-skills/blob/main/CLAUDE.md) -->

## Behaviour

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

<!-- END:claude-behavior -->
