# Student opening and three futures Implementation Plan

**Intent:** docs/student-opening-three-futures/intent.md
**Goal:** A new student signs in on the student page (Google or an email code), answers four short screens, sees three futures built by rules over a mock Australia catalogue, corrects a chip and sees all three redraw, spends or defers her coins, and comes back to where she left off; admins sign in on their own page.
**Approach:** Two new pure features carry the logic: `src/features/engine` (the mock catalogue, weights, feel, distances and `buildFutures`, importable on server and client so a redraw is computed instantly in the browser and identically on the server) and `src/features/opening/model` (question definitions, defaults, impact lines, coins). One table, `student_profile`, holds a student's answers as JSON validated by zod, written by server actions on every tap. Auth gains a "surface" (student or admin page) carried through Google sign-in with Better Auth's server-trusted OAuth state, and the email-code plugin; all access rules stay pure in `access.ts`.
**Test layers:** Unit plus integration. Most criteria (weights 43, feel 36, futures selection 34–37 and 44–48, distances 32–33, impact lines 24–28, coins 53–59, the surface rules 16–20) are pure functions proven with `bun run test:run`. Criteria that cross a boundary need integration: the sign-in flows and the code rules (6, 8–14, 16–21) go through Better Auth and the database, so they are proven by database tests (`DB_TESTS=1 DATABASE_URL=postgres://app:app@127.0.0.1:5433/app bun test <file>`) for the hook rules and by Playwright (`bun run test:e2e`, which starts its own dev server on 3000) for the pages; persisted answers and coming back (60–63) need the database and a browser; the redraw timing and Undo (50–51) and the splash (5) need a browser. Access paths added here (two sign-in pages, a new role refusal on each, the dev login's surface, the student pages behind a session, the student-only actions) each have a refusal test named in the coverage table. Google's consent screen cannot run in tests: the Google path is proven by the hooks running through Better Auth's internal adapter with the surface set, plus the button's presence in Playwright. All three layers are already set up in this repo; nothing is installed.
**Constraints:**
- Never commit or push without explicit approval. Squash micro-commits into one semantic commit. Never add co-author text to commit messages.
- Conventional Commits (`type(scope?): description`), enforced by .husky/commit-msg.
- pre-commit runs lint-staged and type-check; pre-push runs the tests and the build.
- Never start a dev server for the user; they run it.
- Folders: src/app (routes), src/features/<feature> (feature code), src/shared/{components,hooks,lib,types}. shadcn components are in src/shared/components/ui.
- Access rules live in one pure module, src/shared/lib/auth/access.ts; pages and actions call it, the proxy only checks the cookie. New signed-in pages go under src/app/(app) and into APP_PATHS and the proxy matcher together.
- Server actions return `ActionResult` (src/shared/types/action-result.ts) and never throw.
- Tailwind 4 is CSS-first (src/app/globals.css): semantic tokens only, no @apply, OKLCH colours, rem not px (hairlines stay 1px). Dark mode follows `<html data-theme>`.
- Sizes are fluid through the design system's roles: type `text-display`, `text-h1` to `text-h4`, `text-lead`, `text-caption`, `text-overline`; spacing `px-gutter`, `py-section`, `gap-section`, `gap-stack`. Never a size per breakpoint.
- The active design system is Industry: read src/design-systems/industry/DESIGN.md before any UI work. Its tokens arrive through the shadcn variables, so components only use semantic classes.
- Read node_modules/next/dist/docs before writing Next.js code (see AGENTS.md).
- `bun run test:db` **wipes the development database**: never run it in this work; run database tests by path.
- For this run, "commit" steps are replaced by "leave the change in the working tree": the user approves one squashed commit at the end.

**Design references** (rendered from the frozen showcase, read them with the Read tool before UI work): `/tmp/claude-1000/-home-jenish-Projects-decision-studio-ofcourse/77aae712-29a8-4d3d-a5fd-fe22326ccc5b/scratchpad/frames/` — `r9a-*.png` splash, `r10a-0..2.png` sign-up / picture / you're in, `r1-0..4.png` screens 1–4, `r1-5.png` futures, `r1-6.png` redraw, `r1-7..9.png` coins, `r1-10.png` / `r1-11.png` desktop, `p3fix-0.png` field redraw, `p3fix-2.png` weights plaque, `p3claims-0..1.png` claim opened and not sure, `r8c-0..2.png` relatives and distances, `r7d-0.png` marked lines, `p3load-*.png` loader; every frame's full text is in `text.txt` beside them. The prototype's own logic is in `/home/jenish/Projects/decision-studio/Hackathon Handoff/Hackathon Decision Studio Handoff/r5-model.js` (questions, options, impact copy, chip text). Where a frame and the intent disagree, the intent wins; the intent's "Design reference" section lists what is left off.

## Files

| Path | Create or modify | Responsibility |
| --- | --- | --- |
| `src/shared/lib/auth/access.ts` | modify | Surface rules: who a sign-up on each page becomes, and which session each page refuses (pure) |
| `src/shared/lib/auth/access.test.ts` | modify | Unit tests for the surface rules |
| `src/shared/lib/auth/gate.ts` | modify | Paths: `HOME_PATH='/start'`, student `APP_PATHS`, admin sign-in paths, error targets for both pages |
| `src/shared/lib/auth/gate.test.ts` | modify | Unit tests for the new paths and targets |
| `src/shared/lib/auth/surface.ts` | create | Server-only: the request's surface (dev-login override, email-code path, OAuth state) |
| `src/shared/lib/auth/index.ts` | modify | Surface-aware user and session hooks, the `/sign-in/social` hook, the email-code plugin and its 30-second resend guard |
| `src/shared/lib/auth/client.ts` | modify | Email-code client plugin |
| `src/shared/lib/auth/session.ts` | modify | `requireStudent`, `requireAdmin` redirects to the admin sign-in page |
| `src/shared/lib/auth/hooks.test.ts` | modify | Database tests for the surface rules through Better Auth's internal adapter |
| `src/shared/lib/email/sign-in-code.ts` | create | Server-only: send the six-digit code (provider by env, console in development) |
| `src/app/api/dev-login/route.ts` | modify | Optional `surface` in the body |
| `src/shared/lib/auth/dev-login.ts` | modify | `surface` in the body schema |
| `src/app/signin-error/admin/route.ts` | create | Where a failed admin Google sign-in lands |
| `src/proxy.ts` | modify | Matcher for the student pages; admin sign-in page left public; signed-out admin visitors go to the admin sign-in page |
| `src/app/admin/(console)/layout.tsx`, `page.tsx`, `users/page.tsx`, `users/[id]/page.tsx` | create (moved) | The existing admin console, moved into a route group so the sign-in page sits outside its admin-only layout |
| `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/users/**` | delete (moved) | Replaced by the `(console)` group |
| `src/app/admin/sign-in/page.tsx` | create | Admin sign-in: Google only, refusal messages |
| `src/app/page.tsx` | modify | Student sign-in: Google and email code, refusal and code messages |
| `src/features/auth/components/StudentSignIn.tsx` | create | Client: the email-code steps and Google button for students |
| `src/features/auth/components/GoogleSignIn.tsx` | modify | `surface` and `errorCallbackURL` props |
| `src/features/auth/components/SignInForm.tsx` | delete | The starter's visual-only password form, no longer used |
| `src/app/(app)/dashboard/page.tsx` | delete | Replaced by `/start` |
| `src/app/(app)/layout.tsx` | modify | The student shell: `requireStudent`, phone-first column, splash, no admin header |
| `src/app/(app)/loading.tsx` | create | The duck loader for waits over about 400 ms |
| `src/app/(app)/start/page.tsx` | create | Resolves where a signed-in student lands (resume) |
| `src/app/(app)/picture/page.tsx` | create | "How should we picture you?" and "You're in" |
| `src/app/(app)/opening/[step]/page.tsx` | create | Screens 1–4 |
| `src/app/(app)/futures/page.tsx` | create | Screen 5, the futures, and home on return |
| `src/app/(app)/attention/page.tsx` | create | Screen 6, the coins |
| `src/shared/lib/site.ts` | modify | `SITE_NAME = 'OfCourse'` |
| `src/shared/lib/db/schema.ts` | modify | `student_profile` table |
| `src/shared/lib/db/migrations/0001_*.sql` | create (generated) | The table's migration, by `bun run db:generate` |
| `public/brand/duck.png` | create (copied) | The duck from the design assets |
| `src/features/opening/model/profile.ts` | create | The shared contract: personas, steps, stored answers, relative, coins, zod schemas |
| `src/features/opening/model/questions.ts` | create | Screens, questions, options, defaults, visibility, chip text, effective values |
| `src/features/opening/model/impact.ts` | create | The one-line impact under each question |
| `src/features/opening/model/coins.ts` | create | Coin rules and effect lines |
| `src/features/opening/server/profile.ts` | create | Server-only: read and write `student_profile` |
| `src/features/opening/actions.ts` | create | Server actions for answers, relative, persona, coins, reminders |
| `src/features/opening/components/*` | create | Splash, opening screen, relative form, futures screen and card, weights plaque, coins screen |
| `src/shared/components/DuckLoader.tsx` | create | The loader |
| `src/features/engine/types.ts` | create | The engine's shared types |
| `src/features/engine/catalogue.ts` | create | The mock Australia catalogue, labelled mock |
| `src/features/engine/geo.ts` | create | Distances: minutes within a city, flight hours between cities |
| `src/features/engine/weights.ts` | create | DS-D3 weights and their reasons |
| `src/features/engine/feel.ts` | create | "Might feel" (DS-D4 plus the Cost rule) |
| `src/features/engine/futures.ts` | create | `buildFutures`, `diffFutures` |
| `e2e/helpers/*`, `e2e/*.e2e.ts` | modify / create | Integration specs and helpers (code from the database, splash skip, surface login) |

## Task 1: Surface rules and paths (pure)
**Delivers:** acceptance criteria 16, 18, 19, 20 (the rules), and the paths every later task uses.
**Files:** modify `src/shared/lib/auth/access.ts`, `src/shared/lib/auth/access.test.ts`, `src/shared/lib/auth/gate.ts`, `src/shared/lib/auth/gate.test.ts`.
**Kind:** judgement — four files; the code is given in full, the tests by assertion.

- [ ] Step 1: write the failing tests. In `access.test.ts` (same `bun:test` style as the file), add `describe('surfaceSignup')` and `describe('surfaceSessionError')` with these assertions:
  ```ts
  // student page: always a user, never the first-account superadmin; an address with a role waiting is refused
  expect(surfaceSignup({ surface: 'student', firstAccount: true, invitedRole: null })).toEqual({ role: 'user' })
  expect(surfaceSignup({ surface: 'student', firstAccount: false, invitedRole: null })).toEqual({ role: 'user' })
  expect(surfaceSignup({ surface: 'student', firstAccount: false, invitedRole: 'admin' })).toEqual({ refuse: 'STUDENT_PAGE_ONLY' })
  // admin page: first account is superadmin, a waiting role applies, anyone else is refused
  expect(surfaceSignup({ surface: 'admin', firstAccount: true, invitedRole: null })).toEqual({ role: 'superadmin' })
  expect(surfaceSignup({ surface: 'admin', firstAccount: false, invitedRole: 'admin' })).toEqual({ role: 'admin' })
  expect(surfaceSignup({ surface: 'admin', firstAccount: false, invitedRole: 'superadmin' })).toEqual({ role: 'superadmin' })
  expect(surfaceSignup({ surface: 'admin', firstAccount: false, invitedRole: null })).toEqual({ refuse: 'NOT_ADMIN' })
  // sessions
  expect(surfaceSessionError('student', 'user')).toBeNull()
  expect(surfaceSessionError('student', 'admin')).toBe('STUDENT_PAGE_ONLY')
  expect(surfaceSessionError('student', 'superadmin')).toBe('STUDENT_PAGE_ONLY')
  expect(surfaceSessionError('admin', 'admin')).toBeNull()
  expect(surfaceSessionError('admin', 'superadmin')).toBeNull()
  expect(surfaceSessionError('admin', 'user')).toBe('NOT_ADMIN')
  expect(surfaceSessionError('admin', undefined)).toBe('NOT_ADMIN')
  expect(canUseStudentApp('user')).toBe(true)
  expect(canUseStudentApp('admin')).toBe(false)
  expect(isSurface('admin')).toBe(true); expect(isSurface('Admin')).toBe(false); expect(isSurface(undefined)).toBe(false)
  ```
  In `gate.test.ts`, replace the dashboard-based cases with:
  ```ts
  expect(HOME_PATH).toBe('/start')
  for (const p of ['/start', '/picture', '/opening/facts', '/futures', '/attention']) expect(isAppPath(p)).toBe(true)
  for (const p of ['/', '/dashboard', '/suspended', '/signin-error', '/admin/sign-in', '/startx']) expect(isAppPath(p)).toBe(false)
  expect(isAdminSignInPath('/admin/sign-in')).toBe(true)
  expect(isAdminSignInPath('/admin/users')).toBe(false)
  // signed-out visitors: admin pages go to the admin sign-in page, student pages to /
  expect(welcomeUrl(at('/admin/users')).pathname).toBe('/admin/sign-in')
  expect(welcomeUrl(at('/admin/users')).searchParams.get('next')).toBe('/admin/users')
  expect(welcomeUrl(at('/futures')).pathname).toBe('/')
  expect(welcomeUrl(at('/futures')).searchParams.get('next')).toBe('/futures')
  expect(welcomeUrl(at('/start')).search).toBe('')               // home is not remembered
  expect(welcomeUrl(at('/admin')).search).toBe('')               // admin home is not remembered either
  expect(safeNextPath('/futures')).toBe('/futures')
  expect(safeNextPath('/admin/users')).toBe('/admin/users')
  expect(safeNextPath('/admin/sign-in')).toBeNull()              // never a loop back to the sign-in page
  expect(safeNextPath('/dashboard')).toBeNull()
  expect(signinErrorTarget('ACCOUNT_SUSPENDED')).toBe('/suspended')
  expect(signinErrorTarget('STUDENT_PAGE_ONLY')).toBe('/?error=student-only')
  expect(signinErrorTarget('unable_to_create_user')).toBe('/?error=signin')
  expect(adminSigninErrorTarget('ACCOUNT_SUSPENDED')).toBe('/suspended')
  expect(adminSigninErrorTarget('NOT_ADMIN')).toBe('/admin/sign-in?error=not-admin')
  expect(adminSigninErrorTarget(null)).toBe('/admin/sign-in?error=signin')
  expect(SIGNIN_MESSAGES.signin).toBe('Google sign-in did not finish. Try again.')
  expect(SIGNIN_MESSAGES['student-only']).toBe('This page is for students. This account signs in on the admin page.')
  expect(SIGNIN_MESSAGES['not-admin']).toBe("This account doesn't have admin access.")
  ```
  Keep the existing `safeNextPath` refusal list and the `isAdminPath` cases.
- [ ] Step 2: run them — `bun test src/shared/lib/auth/access.test.ts src/shared/lib/auth/gate.test.ts`; expected: FAIL (`surfaceSignup` is not exported; `HOME_PATH` is `/dashboard`).
- [ ] Step 3: implement. Append to `access.ts` (after `settleFirstAccountRole`; keep every existing export):
  ```ts
  /** Which sign-in page a request came from: the student page at / or the admin page. */
  export const SURFACES = ['student', 'admin'] as const

  export type Surface = (typeof SURFACES)[number]

  export function isSurface(value: unknown): value is Surface {
    return typeof value === 'string' && (SURFACES as readonly string[]).includes(value)
  }

  /** The codes a sign-in refused by its page carries (Better Auth's APIError body.code). */
  export const SURFACE_ERRORS = {
    studentPageOnly: 'STUDENT_PAGE_ONLY',
    notAdmin: 'NOT_ADMIN',
  } as const

  /**
   * A first sign-in on a page: the role the new account gets, or the code to refuse it with (no
   * account is created then). The student page always makes a user, even on an empty database, so
   * nobody becomes superadmin by signing up as a student; an address an admin role is waiting for
   * belongs on the admin page. The admin page makes the first account ever a superadmin, applies a
   * waiting role, and refuses everyone else.
   */
  export function surfaceSignup(i: {
    surface: Surface
    firstAccount: boolean
    invitedRole: InviteRole | null
  }): { role: Role } | { refuse: string } {
    if (i.surface === 'student') {
      return i.invitedRole ? { refuse: SURFACE_ERRORS.studentPageOnly } : { role: 'user' }
    }
    if (i.firstAccount) return { role: 'superadmin' }
    return i.invitedRole ? { role: i.invitedRole } : { refuse: SURFACE_ERRORS.notAdmin }
  }

  /** A session about to open on a page: the code to refuse it with, or null. */
  export function surfaceSessionError(surface: Surface, role: string | null | undefined): string | null {
    if (surface === 'student') return role === 'user' ? null : SURFACE_ERRORS.studentPageOnly
    return canUseAdmin(role) ? null : SURFACE_ERRORS.notAdmin
  }

  /** The student app (the opening and the futures): accounts with role user only. */
  export function canUseStudentApp(role: string | null | undefined): boolean {
    return role === 'user'
  }
  ```
  In `gate.ts`: set `HOME_PATH = '/start'`; `APP_PATHS = ['/start', '/picture', '/opening', '/futures', '/attention'] as const` (comment: keep in step with the proxy matcher); export `ADMIN_PATH = '/admin'`, `ADMIN_SIGNIN_PATH = '/admin/sign-in'`, `ADMIN_SIGNIN_ERROR_PATH = '/signin-error/admin'`; add `isAdminSignInPath(pathname)` (`underPrefix(pathname, ADMIN_SIGNIN_PATH)`); `welcomeUrl` sends `isAdminPath` requests to `ADMIN_SIGNIN_PATH` (no `next` when the path is exactly `/admin`) and everything else to `/` (no `next` for `HOME_PATH`); `safeNextPath` returns null for anything under `ADMIN_SIGNIN_PATH` before the existing checks; add:
  ```ts
  /** The `?error=` values the two sign-in pages understand, and what each says. */
  export const SIGNIN_MESSAGES = {
    signin: 'Google sign-in did not finish. Try again.',
    'student-only': 'This page is for students. This account signs in on the admin page.',
    'not-admin': "This account doesn't have admin access.",
  } as const
  export type SigninMessageKey = keyof typeof SIGNIN_MESSAGES
  ```
  `signinErrorTarget(code)`: `ACCOUNT_SUSPENDED` → `SUSPENDED_PATH`; `SURFACE_ERRORS.studentPageOnly` → `'/?error=student-only'`; else `'/?error=signin'`. New `adminSigninErrorTarget(code)`: `ACCOUNT_SUSPENDED` → `SUSPENDED_PATH`; `SURFACE_ERRORS.notAdmin` → `'/admin/sign-in?error=not-admin'`; else `'/admin/sign-in?error=signin'`. Import `SURFACE_ERRORS` from `./access` (both modules are pure; no cycle: access.ts imports nothing from gate.ts).
- [ ] Step 4: run them — `bun test src/shared/lib/auth/access.test.ts src/shared/lib/auth/gate.test.ts`; expected: PASS. Then `bun run type-check`; expected: PASS (the e2e specs that still expect `/dashboard` are updated in Task 3).
- [ ] Step 5: leave the change in the working tree (no commit, per the constraints).

## Task 2: Auth wiring — surfaces, email codes, dev login
**Delivers:** criteria 7, 8, 9, 10, 11, 12, 13, 16, 18, 19, 20, 21 at the hook level (the pages come in Tasks 3–4).
**Files:** create `src/shared/lib/auth/surface.ts`, `src/shared/lib/email/sign-in-code.ts`, `src/shared/lib/email/sign-in-code.test.ts`, `src/app/signin-error/admin/route.ts`; modify `src/shared/lib/auth/index.ts`, `src/shared/lib/auth/client.ts`, `src/shared/lib/auth/dev-login.ts`, `src/shared/lib/auth/dev-login.test.ts`, `src/app/api/dev-login/route.ts`, `src/shared/lib/auth/hooks.test.ts`.
**Kind:** judgement.

**Interfaces other tasks rely on**
```ts
// src/shared/lib/auth/surface.ts (no 'server-only' import: auth/index.ts loads it and hooks.test.ts loads auth)
export type SurfaceOrAny = Surface | 'any'          // 'any' = the dev login without a surface: the starter's rules, no page checks
export function runWithSurface<T>(surface: SurfaceOrAny, fn: () => Promise<T>): Promise<T>   // AsyncLocalStorage from node:async_hooks
export const EMAIL_CODE_PATHS: readonly string[]   // ['/sign-in/email-otp', '/email-otp/send-verification-otp']
export async function currentSurface(ctx: { path?: string } | null): Promise<SurfaceOrAny>
//   order: 1) the runWithSurface store; 2) ctx.path in EMAIL_CODE_PATHS → 'student';
//          3) (await getOAuthState())?.serverContext?.surface when isSurface(...); 4) 'student' (least privilege)
//   getOAuthState can throw outside a request: catch → null.

// src/shared/lib/email/sign-in-code.ts
export const SIGN_IN_CODE_TTL_SECONDS = 600
export async function sendSignInCode(email: string, code: string): Promise<void>
//   RESEND_API_KEY and EMAIL_FROM set → POST https://api.resend.com/emails with
//     headers { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
//     body { from: EMAIL_FROM, to: [email], subject: 'Your OfCourse code', text: `Your OfCourse code is ${code}. It works for 10 minutes.` };
//     a non-2xx response throws Error(`Email provider refused the code email (${status})`).
//   else NODE_ENV !== 'production' → console.info(`[sign-in code] ${email}: ${code}`) and resolve.
//   else throw Error('No email provider: set RESEND_API_KEY and EMAIL_FROM.')

// Error codes the pages map to messages (Task 4): 'INVALID_OTP' | 'OTP_EXPIRED' | 'TOO_MANY_ATTEMPTS' (Better Auth),
// 'CODE_RECENTLY_SENT' (ours, below), 'STUDENT_PAGE_ONLY' | 'NOT_ADMIN' (SURFACE_ERRORS), 'ACCOUNT_SUSPENDED'.
export const CODE_RECENTLY_SENT = 'CODE_RECENTLY_SENT'   // export from surface.ts
```

**Verified facts this task rests on** (better-auth 1.7.7 in node_modules)
- `getOAuthState`, `addOAuthServerContext`, `createAuthMiddleware`, `APIError` are exported from `better-auth/api` (`dist/api/index.mjs:220`). `addOAuthServerContext(values)` called from a `before` hook on `/sign-in/social` embeds `values` in the OAuth state; on the callback they read back as `getOAuthState().serverContext` and cannot be spoofed by the client (`dist/api/state/oauth.mjs:20-36`). The client sends the page as `signIn.social({ ..., additionalData: { surface } })` (`dist/api/routes/sign-in.mjs:116`).
- `betterAuth({ hooks: { before: AuthMiddleware } })` (`@better-auth/core/dist/types/init-options.d.mts:1513`).
- `databaseHooks.user.create.before(user, context: GenericEndpointContext | null)` and the same `(data, context)` for `session.create.before` (`init-options.d.mts:1274`); the context comes from the current endpoint and is null outside one, e.g. in the dev-login route (`dist/db/with-hooks.mjs:8`). Throwing `APIError.from('FORBIDDEN', { code, message })` from a hook during the Google callback redirects to the `errorCallbackURL` with `?error=<code>` (`dist/api/routes/callback.mjs:191-192`; `dist/oauth2/link-account.mjs:127` rethrows API errors), the pattern `ACCOUNT_SUSPENDED` already uses.
- `emailOTP` from `better-auth/plugins/email-otp` (package export `./plugins/email-otp`). Options (`dist/plugins/email-otp/types.d.mts`): `sendVerificationOTP({ email, otp, type })`, `otpLength` (default 6), `expiresIn` in seconds (default 300), `allowedAttempts` (default 3), `resendStrategy` (default `'rotate'`: a new code replaces the stored one). Do not set its `rateLimit`: it applies to every email-code path, the sign-in attempts included.
- The code is stored in `verification` with identifier `` `sign-in-otp-${email}` `` (`dist/plugins/email-otp/utils.mjs:4`) and value `` `${otp}:${attempts}` `` (plain storage, the default). A wrong code increments attempts and keeps the original expiry; once attempts reach `allowedAttempts` the next try throws `TOO_MANY_ATTEMPTS` and the code is gone; an expired code throws `OTP_EXPIRED` (`dist/plugins/email-otp/routes.mjs:761-772`).
- Signing in with a code for an address with no account creates it with `emailVerified: true, name: name || ''` and runs the user hooks with `ctx.path === '/sign-in/email-otp'` (`routes.mjs:411-423`).
- Server API: `auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })`, `auth.api.signInEmailOTP({ body: { email, otp } })` (`dist/plugins/email-otp/index.mjs:38,43`). Client: `emailOTPClient` from `better-auth/client/plugins`; Better Auth maps paths to client methods, so the client calls are `authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })` and `authClient.signIn.emailOtp({ email, otp })`.
- Google sign-in for an address that already has a code account links to it: the provider is trusted when Google reports the email verified, and the local account is verified (`dist/oauth2/link-account.mjs:136-139`, `requireLocalEmailVerified` defaults to true). Code sign-in for an address that has a Google account finds that user by email (`routes.mjs:411`). So criterion 13 needs no linking configuration.
- `'server-only'` throws under `bun test`; tests of server-only modules call `mock.module('server-only', () => ({}))` first (`src/shared/lib/presence-server.test.ts:10-11`).

- [ ] Step 1: write the failing tests.
  - `sign-in-code.test.ts`: with `RESEND_API_KEY`/`EMAIL_FROM` set and `globalThis.fetch` replaced by a `mock()` that resolves `{ ok: true, status: 200 }`, `sendSignInCode('a@b.test', '123456')` calls fetch once with `'https://api.resend.com/emails'` and a JSON body whose `to` is `['a@b.test']` and whose `text` contains `123456`; with fetch resolving `{ ok: false, status: 422 }` it rejects; with neither variable set and `NODE_ENV='test'` it resolves and logs a line containing the code (spy on `console.info`); with neither set and `NODE_ENV='production'` it rejects with `/No email provider/`. Restore env and fetch after each.
  - `dev-login.test.ts`: `devLoginInput.parse({ email: 'a@b.test', surface: 'admin' }).surface` is `'admin'`; `surface: 'staff'` fails; no surface parses with `surface` undefined.
  - `hooks.test.ts`: wrap the existing `signUp` body in `runWithSurface('any', …)` so the existing cases keep the starter's rules, and add a helper `signUpOn(surface, email)` that runs the same create inside `runWithSurface(surface, …)`. New cases (all addresses `@hooks.e2e.test`):
    ```ts
    // student page
    await signUpOn('student', at('stu')); expect(await roleOf(at('stu'))).toBe('user')        // even when it is the first account
    await waitWithRole(at('stu-invited'), 'admin')
    await expect(signUpOn('student', at('stu-invited'))).rejects.toMatchObject({ body: { code: 'STUDENT_PAGE_ONLY' } })
    expect(await roleOf(at('stu-invited'))).toBeUndefined()                                    // nothing created
    expect(await isWaiting(at('stu-invited'))).toBe(true)                                      // the waiting role is kept
    // admin page (make sure an account exists first, as the existing waiting-role test does)
    await expect(signUpOn('admin', at('adm-nobody'))).rejects.toMatchObject({ body: { code: 'NOT_ADMIN' } })
    expect(await roleOf(at('adm-nobody'))).toBeUndefined()
    await waitWithRole(at('adm-invited'), 'admin'); await signUpOn('admin', at('adm-invited'))
    expect(await roleOf(at('adm-invited'))).toBe('admin')
    // sessions: each page refuses the other kind of account
    // createSession inside runWithSurface('student') for an admin account → rejects { body: { code: 'STUDENT_PAGE_ONLY' } }, 0 sessions
    // createSession inside runWithSurface('admin') for a user account → rejects { body: { code: 'NOT_ADMIN' } }, 0 sessions
    // student + user → 1 session; admin + admin → 1 session
    // email codes, through the server API (hooks see the real path)
    await auth.api.sendVerificationOTP({ body: { email: at('code'), type: 'sign-in' } })
    const code = (await verificationValue(`sign-in-otp-${at('code')}`)).split(':')[0]   // helper reading schema.verification
    const res = await auth.api.signInEmailOTP({ body: { email: at('code'), otp: code } })
    expect(res.user.email).toBe(at('code')); expect(await roleOf(at('code'))).toBe('user')
    // a second code within 30 s is refused
    await auth.api.sendVerificationOTP({ body: { email: at('again'), type: 'sign-in' } })
    await expect(auth.api.sendVerificationOTP({ body: { email: at('again'), type: 'sign-in' } }))
      .rejects.toMatchObject({ body: { code: 'CODE_RECENTLY_SENT' } })
    // after 30 s (move the stored expiry back 31 s) a new code is sent and the old one no longer works
    // five wrong codes, then the right one → TOO_MANY_ATTEMPTS
    // an expired code (set expires_at in the past) → OTP_EXPIRED
    // an admin account signing in with a code → STUDENT_PAGE_ONLY and no session
    // same address: a user created on the student page (as Google would), then a code sign-in → the same user id
    ```
    Mock `sendSignInCode` is not needed: with no provider variables and `NODE_ENV` not production it logs.
- [ ] Step 2: run them — `bun test src/shared/lib/email src/shared/lib/auth/dev-login.test.ts` (expected FAIL: modules missing) and `DB_TESTS=1 DATABASE_URL=postgres://app:app@127.0.0.1:5433/app bun test src/shared/lib/auth/hooks.test.ts` (expected FAIL: `runWithSurface` missing). Postgres is already running on 5433 (`bun run db:up` if not).
- [ ] Step 3: implement.
  - `surface.ts` as in the interface above.
  - `index.ts`:
    - `user.create.before(newUser, ctx)`: `const surface = await currentSurface(ctx)`; for `'any'` keep today's `resolveSignupRole(first, invited)`; otherwise `const d = surfaceSignup({ surface, firstAccount: first, invitedRole: invited })`; `'refuse' in d` → `throw APIError.from('FORBIDDEN', { code: d.refuse, message: … })` (messages: STUDENT_PAGE_ONLY "This page is for students.", NOT_ADMIN "This account doesn't have admin access."), else `{ data: { ...newUser, role: d.role } }`.
    - `user.create.after`: unchanged (the first-account race settle still applies).
    - `session.create.before(newSession, ctx)`: after the suspended check, `const surface = await currentSurface(ctx)`; unless `'any'`, read the account's role (one-row select like `isSuspended`, `src/shared/lib/auth/index.ts:41`) and throw the same way when `surfaceSessionError(surface, role)` is not null.
    - `hooks.before = createAuthMiddleware(async (ctx) => { … })`: on `ctx.path === '/sign-in/social'`, `await addOAuthServerContext({ surface: isSurface(ctx.body?.additionalData?.surface) ? that : 'student' })`; on `ctx.path === '/email-otp/send-verification-otp'` with `ctx.body?.type === 'sign-in'`, look up `ctx.context.internalAdapter.findVerificationValue(`sign-in-otp-${email.toLowerCase()}`)` and, when it exists and `expiresAt − SIGN_IN_CODE_TTL_SECONDS·1000 > Date.now() − 30_000` (sent less than 30 s ago; the expiry survives wrong tries, the created time does not), throw `APIError.from('TOO_MANY_REQUESTS', { code: CODE_RECENTLY_SENT, message: 'Wait 30 seconds before asking for a new code.' })`.
    - `plugins: [emailOTP({ otpLength: 6, expiresIn: SIGN_IN_CODE_TTL_SECONDS, allowedAttempts: 5, sendVerificationOTP: ({ email, otp }) => sendSignInCode(email, otp) }), nextCookies()]` — `nextCookies()` stays last.
  - `client.ts`: `createAuthClient({ plugins: [emailOTPClient()] })`; keep the existing named exports and add `export const emailOtp = authClient.emailOtp`.
  - `dev-login.ts`: `surface: z.enum(SURFACES).optional()` in `devLoginInput`.
  - `api/dev-login/route.ts`: wrap the find/create/createSession block in `runWithSurface(body.data.surface ?? 'any', …)`; a create or session refused with an `APIError` whose `body.code` is one of `ACCOUNT_SUSPENDED`, `STUDENT_PAGE_ONLY`, `NOT_ADMIN` answers `403 { error: code }` (generalise the existing suspended branch, `src/app/api/dev-login/route.ts:37-43`). Update its doc comment.
  - `signin-error/admin/route.ts`: as `src/app/signin-error/route.ts` with `adminSigninErrorTarget`.
- [ ] Step 4: run them — the commands of Step 2; expected: PASS (the first-account case stays skipped on a database with accounts). Then `bun run test:run` and `bun run type-check`; expected: PASS.
- [ ] Step 5: leave the change in the working tree.

## Task 3: Routes and guards — student shell, admin sign-in page, OfCourse name
**Delivers:** criteria 1 (name), 16, 17, 18, 19, 20, 21 at the page level; the student shell the later pages sit in.
**Files:**
- move `src/app/admin/layout.tsx` → `src/app/admin/(console)/layout.tsx`, `src/app/admin/page.tsx` → `src/app/admin/(console)/page.tsx`, `src/app/admin/users/page.tsx` → `src/app/admin/(console)/users/page.tsx`, `src/app/admin/users/[id]/page.tsx` → `src/app/admin/(console)/users/[id]/page.tsx` (`git mv`; contents unchanged except imports if any break)
- create `src/app/admin/sign-in/page.tsx`, `src/app/(app)/start/page.tsx`, `e2e/admin-sign-in.e2e.ts`, `e2e/helpers/student.ts`
- modify `src/proxy.ts`, `src/shared/lib/auth/session.ts`, `src/app/(app)/layout.tsx`, `src/app/page.tsx` (redirects only; the student design is Task 4), `src/features/auth/components/GoogleSignIn.tsx`, `src/features/auth/components/SignOutButton.tsx`, `src/features/admin/components/AdminChrome.tsx`, `src/shared/lib/site.ts`, `e2e/helpers/login.ts`, `e2e/welcome.e2e.ts`, `e2e/smoke.e2e.ts`, `e2e/user-management.e2e.ts`
- delete `src/app/(app)/dashboard/page.tsx`, `src/features/auth/components/SignInForm.tsx`; delete `src/shared/components/ThemeChoice.tsx` and `src/shared/lib/theme-actions.ts` only if `grep -rn` shows the dashboard was their only user (the root layout keeps reading the theme cookie through `src/shared/lib/theme.ts`, which stays)
**Kind:** judgement.

**Interfaces**
```ts
// session.ts
export async function requireStudent(): Promise<Session>   // signed out → WELCOME_PATH; suspended → SUSPENDED_PATH; !canUseStudentApp(role) → ADMIN_PATH
export async function requireAdmin(): Promise<Session>     // signed out → ADMIN_SIGNIN_PATH; suspended → SUSPENDED_PATH; !canUseAdmin(role) → HOME_PATH
// requireSession stays for any other caller (WELCOME_PATH when signed out).

// GoogleSignIn.tsx
export function GoogleSignIn(props: { next: string; surface: Surface; errorCallbackURL: string; className?: string })
//   signIn.social({ provider: 'google', callbackURL: next, errorCallbackURL, additionalData: { surface } })

// SignOutButton.tsx
export function SignOutButton(props: { redirectTo?: string })   // default WELCOME_PATH

// e2e/helpers/login.ts
export async function devLogin(page: Page, email: string, name?: string, opts?: { surface?: 'student' | 'admin' }): Promise<string>
export async function devLoginRaw(page: Page, body: { email: string; name?: string; surface?: 'student' | 'admin' }): Promise<{ status: number; body: unknown }>
// e2e/helpers/student.ts
export const STUDENT_APP_URL = /\/(start|picture|opening\/[a-z]+|futures|attention)$/
```

**Behaviour to build**
- `proxy.ts`: matcher `['/start/:path*', '/picture/:path*', '/opening/:path*', '/futures/:path*', '/attention/:path*', '/admin/:path*']` (literals; keep in step with `APP_PATHS`). `isAdminSignInPath` → `NextResponse.next()` before anything else. No session cookie → `welcomeUrl(req.nextUrl)` (Task 1 already splits admin and student targets). Admin paths keep the full session check; a non-admin goes to `HOME_PATH`. Student paths stay cookie-only (the layout checks the role).
- `(app)/layout.tsx`: `requireStudent()`, the presence `after()` call kept, and a full-width main area (`min-h-dvh bg-background`); each screen sets its own width (phone-first single column, wider grids on desktop in Tasks 11–13). No top bar: the student design has none.
- `(app)/start/page.tsx` for now: `requireStudent()` and a one-line page reading "Welcome to OfCourse." (Task 9 replaces it with the resume logic). It proves the shell in tests.
- `page.tsx` (/): signed in → an admin goes to `ADMIN_PATH`, anyone else to the safe `next` or `HOME_PATH`; the rest of the page stays as it is until Task 4.
- `admin/sign-in/page.tsx`: the starter's Industry sign-in layout (copy the structure of today's `src/app/page.tsx`: `SignInPanel` with `productName="OfCourse Admin"`, lede "Content, reviews and accounts for OfCourse.", the framed card) with: overline "Admin sign-in", heading "Sign in", line "Use your Google account.", the error line from `SIGNIN_MESSAGES[error]` when `?error=` is `signin` or `not-admin` (role="alert"), and only `<GoogleSignIn surface="admin" errorCallbackURL={ADMIN_SIGNIN_ERROR_PATH} next={safe next or ADMIN_PATH} />` — no email field, no "create an account", no privacy/terms links. Signed in as an admin → redirect to the safe `next` or `ADMIN_PATH`; signed in as a student → show the page (a Google sign-in with a non-admin account is refused there).
- `AdminChrome`: replace "Back to the app" with `<SignOutButton redirectTo={ADMIN_SIGNIN_PATH} />`.
- `site.ts`: `SITE_NAME = 'OfCourse'`; `package.json` `name` → `ofcourse` (the README's step 2 says rename both).
- e2e: `/dashboard` assertions in `user-management.e2e.ts` become `STUDENT_APP_URL` for user accounts (lines 86, 88, 213) and `/start` for the "signed out → /" checks (lines 126, 180, 222, 224); `welcome.e2e.ts`: signed-out `/admin` → `/admin/sign-in$`, signed-out `/admin/users` → `/admin/sign-in?next=%2Fadmin%2Fusers`, signed-in user at `/` → `STUDENT_APP_URL`, signed-in admin (devLogin then `setRole`) at `/` → `/admin/users$`; `smoke.e2e.ts`: `/start` signed out → `/`.

- [ ] Step 1: write the failing tests — `e2e/admin-sign-in.e2e.ts`:
  ```ts
  // the admin page offers Google only
  await page.goto('/admin/sign-in')
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  await expect(page.getByLabel(/email/i)).toHaveCount(0)
  // its two messages
  await page.goto('/admin/sign-in?error=not-admin'); await expect(page.getByRole('alert')).toHaveText("This account doesn't have admin access.")
  await page.goto('/signin-error/admin?error=NOT_ADMIN'); await expect(page).toHaveURL(/\/admin\/sign-in\?error=not-admin$/)
  await page.goto('/signin-error?error=STUDENT_PAGE_ONLY'); await expect(page).toHaveURL(/\/\?error=student-only$/)
  // refusals through the dev login's surface (the same hooks Google runs)
  const user = freshEmail('as-user'); await devLogin(page, user)                                  // a user account
  expect(await devLoginRaw(page, { email: user, surface: 'admin' })).toMatchObject({ status: 403, body: { error: 'NOT_ADMIN' } })
  const nobody = freshEmail('as-nobody')
  expect(await devLoginRaw(page, { email: nobody, surface: 'admin' })).toMatchObject({ status: 403, body: { error: 'NOT_ADMIN' } })
  expect(await userIdByEmail(nobody)).toBeNull()                                                   // nothing created
  const adm = freshEmail('as-admin'); await devLogin(page, adm); await setRole(adm, 'admin')
  expect(await devLoginRaw(page, { email: adm, surface: 'student' })).toMatchObject({ status: 403, body: { error: 'STUDENT_PAGE_ONLY' } })
  expect((await devLoginRaw(page, { email: adm, surface: 'admin' })).status).toBe(200)
  // each side keeps the other kind of account out
  // a user session at /admin/users → STUDENT_APP_URL; an admin session at /start → /admin/users
  ```
  Clean up with `deleteUsers` in `finally`, as the existing specs do.
- [ ] Step 2: run them — `bun run test:e2e -- e2e/admin-sign-in.e2e.ts`; expected: FAIL (no `/admin/sign-in` page; 404).
- [ ] Step 3: implement the behaviour above. Next 16 facts: a folder in parentheses is a route group that does not change the URL, so `src/app/admin/(console)/users/page.tsx` still serves `/admin/users` and `src/app/admin/sign-in/page.tsx` sits outside the console's layout (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`); `params`/`searchParams` are promises (`page.md:13`); the repo's pages type props with the global `PageProps<'/route'>` and layouts with `LayoutProps<'/route'>` (`src/app/page.tsx:29`, `src/app/(app)/layout.tsx:13`).
- [ ] Step 4: run them — `bun run test:e2e -- e2e/admin-sign-in.e2e.ts e2e/welcome.e2e.ts e2e/smoke.e2e.ts e2e/user-management.e2e.ts`; expected: PASS. Then `bun run test:run`, `bun run lint`, `bun run type-check`; expected: PASS.
- [ ] Step 5: leave the change in the working tree.

## Task 4: Student sign-in page and the splash
**Delivers:** criteria 5, 6, 8, 9, 10, 11, 12, 16 (page), 21 (page).
**Files:** modify `src/app/page.tsx`, `src/app/(app)/layout.tsx` (mount the splash), `e2e/sign-in.e2e.ts`, `e2e/helpers/db.ts`; create `src/features/auth/components/StudentSignIn.tsx`, `src/features/auth/components/StudentSignIn.test.tsx`, `src/features/auth/lib/code-messages.ts`, `src/features/auth/lib/code-messages.test.ts`, `src/features/opening/components/Splash.tsx`, `src/features/opening/components/splash.module.css`, `src/features/opening/components/Splash.test.tsx`, `public/brand/duck.png` (copy of `/home/jenish/Projects/decision-studio/Hackathon Handoff/Hackathon Decision Studio Handoff/assets/rubber-duck.png`), `e2e/student-sign-in.e2e.ts`; keep `src/features/auth/components/SignInPanel.tsx` and `sign-in.module.css` (the admin sign-in page uses them).
**Kind:** judgement.

**Design:** frames `r10a-0.png` (sign-up), `r9a-*.png` (splash stills and reduced motion). Hero band in the primary colour across the top: overline "OfCourse" (`text-overline uppercase`), heading "From off course to “Of Course!”" (`font-heading text-h1`), lede "One account, so your answers are kept. Two taps, then we start." (the design's "and your board" is dropped: there is no board in this slice). Below it, one column: "Continue with Google" (`GoogleSignIn surface="student" errorCallbackURL={SIGNIN_ERROR_PATH}`), an "or" divider, then the email steps. The design's Email | Phone tabs are not built (phone sign-up is out of scope).

**Interfaces**
```ts
// src/features/auth/lib/code-messages.ts (pure)
export type CodeError = 'INVALID_OTP' | 'OTP_EXPIRED' | 'TOO_MANY_ATTEMPTS' | 'CODE_RECENTLY_SENT' | 'STUDENT_PAGE_ONLY' | 'SEND_FAILED' | 'INVALID_EMAIL'
export const CODE_MESSAGES: Record<CodeError, string> = {
  INVALID_OTP: 'That code is wrong. Check the email and try again.',
  OTP_EXPIRED: 'That code has expired. Send a new one.',
  TOO_MANY_ATTEMPTS: 'That code no longer works. Send a new one.',
  CODE_RECENTLY_SENT: 'Wait 30 seconds before asking for a new code.',
  STUDENT_PAGE_ONLY: 'This page is for students. This account signs in on the admin page.',   // = SIGNIN_MESSAGES['student-only']; import it, do not retype
  SEND_FAILED: "We couldn't send the code. Try again.",
  INVALID_EMAIL: 'Enter a valid email address.',
}
export const MAX_WRONG_CODES = 5
export const RESEND_WAIT_SECONDS = 30
/** Map a Better Auth client error ({ code?: string, status?: number }) to one of ours; ACCOUNT_SUSPENDED → 'suspended'. */
export function codeErrorOf(error: { code?: string } | null | undefined): CodeError | 'suspended'
// src/features/opening/components/Splash.tsx
export const SPLASH_SEEN_KEY = 'ofcourse:splash'
export function Splash(): JSX.Element | null   // client; reads/writes sessionStorage inside try/catch
```

**Behaviour**
- `StudentSignIn` (client) steps: **email** (label "Your email", hint "We send a six-digit code. No password.", button "Send me a code"; a value that fails `z.email()` shows `INVALID_EMAIL` and sends nothing) → `emailOtp.sendVerificationOtp({ email, type: 'sign-in' })` → **code** ("The code we sent to {email}", an input with `inputMode="numeric"`, `autoComplete="one-time-code"`, `maxLength={6}`, label "Six-digit code"; button "Sign in"; "Send a new code" disabled with "Send a new code in {n} s" for `RESEND_WAIT_SECONDS` after each send; "Use a different email" back to the email step) → `signIn.emailOtp({ email, otp })` → on success `router.replace(next)` (next = the safe `next` passed from the page, else `HOME_PATH`). A wrong code counts locally; on the `MAX_WRONG_CODES`th wrong code, or on `TOO_MANY_ATTEMPTS`, show that message and disable "Sign in" until a new code is sent. `ACCOUNT_SUSPENDED` → `router.replace(SUSPENDED_PATH)`. Every message has `role="alert"`.
- `page.tsx`: the design above; `?error=` values `signin` and `student-only` show `SIGNIN_MESSAGES[...]` (role="alert"); mount `<Splash />`. Keep the signed-in redirects from Task 3.
- `Splash`: full-screen overlay (`fixed inset-0 z-50 bg-background`, `data-testid="splash"`, `aria-hidden="true"`) shown only when `sessionStorage[SPLASH_SEEN_KEY]` is unset; set it on mount. About 3 s, CSS keyframes in `splash.module.css`: "Off Course" holds; the duck (`/brand/duck.png`, `next/image` or `<img>` with `alt=""`) swims in from the left facing right (DS-R9: it faces the way it travels; mirror with `-scale-x-100` if the PNG faces left), takes the second "f" away to the right; the letters close; the quotes and "!" arrive ("“Of Course!”"); the tagline "From off course to “Of Course!”" fades in; then the overlay fades and unmounts. With `matchMedia('(prefers-reduced-motion: reduce)').matches`, render the final wordmark and tagline with no animation (`data-reduced="true"`) and unmount after 1.5 s. Mounted in `page.tsx` and `(app)/layout.tsx`; the session flag makes it play once per visit across both.
- `e2e/helpers/db.ts`: add `latestSignInCode(email)` (`select value from verification where identifier = ${'sign-in-otp-' + email}` → the part before the last colon), `expireSignInCode(email)` (`expires_at = now() - interval '1 minute'`), `ageSignInCode(email, seconds)` (`expires_at = expires_at - make_interval(secs => ${seconds})`), `suspend(email)`; add `skipSplash(page)` to `e2e/helpers/student.ts` (`page.addInitScript(() => sessionStorage.setItem('ofcourse:splash', 'seen'))`).

- [ ] Step 1: write the failing tests.
  - `code-messages.test.ts`: `codeErrorOf({ code: 'INVALID_OTP' })` → `'INVALID_OTP'`; `'OTP_EXPIRED'`, `'TOO_MANY_ATTEMPTS'`, `'CODE_RECENTLY_SENT'`, `'STUDENT_PAGE_ONLY'` map to themselves; `'ACCOUNT_SUSPENDED'` → `'suspended'`; anything else or null → `'SEND_FAILED'`; `CODE_MESSAGES.STUDENT_PAGE_ONLY === SIGNIN_MESSAGES['student-only']`.
  - `Splash.test.tsx` (Testing Library under happy-dom, `src/features/admin/components/AdminNav.test.tsx` for the style): with `sessionStorage` empty it renders `getByTestId('splash')` and then `sessionStorage.getItem('ofcourse:splash')` is set; with the key set it renders nothing; with `window.matchMedia` stubbed to `matches: true` the overlay has `data-reduced="true"`.
  - `StudentSignIn.test.tsx`: mock `@/shared/lib/auth/client` with `mock.module` (`emailOtp.sendVerificationOtp`, `signIn.emailOtp`, `signIn.social`) and `next/navigation`'s `useRouter`; typing `not-an-email` and pressing "Send me a code" shows "Enter a valid email address." and does not call send; a valid address shows "The code we sent to a@b.test" and "Send a new code in 30 s" (disabled); five rejected codes (`{ error: { code: 'INVALID_OTP' } }`) end on "That code no longer works. Send a new one." with "Sign in" disabled; `{ error: { code: 'STUDENT_PAGE_ONLY' } }` shows the student-only message.
  - `e2e/student-sign-in.e2e.ts` (use `skipSplash` except in the splash test; `freshEmail`, clean up in `finally`):
    ```ts
    // the page offers both ways in, at phone width and on desktop
    for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(size); await page.goto('/')
      await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
      await expect(page.getByLabel('Your email')).toBeVisible()
    }
    // a new address signs in with a code and becomes a student
    await page.getByLabel('Your email').fill(email); await page.getByRole('button', { name: 'Send me a code' }).click()
    await expect(page.getByText(`The code we sent to ${email}`)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Use a different email' })).toBeVisible()
    await page.getByLabel('Six-digit code').fill(await latestSignInCode(email)); await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(STUDENT_APP_URL); expect((await accountState(email))?.role).toBe('user')
    // wrong, expired, five wrong, a new code after 30 s (move the stored expiry back 31 s and `page.clock` forward 31 s), the old code then refused
    // an admin account using a code → the student-only message, no session; `/?error=student-only` → the same message
    // a suspended student using a code → /suspended
    // the splash plays on the first page of a visit and not on the next
    await page.goto('/'); await expect(page.getByTestId('splash')).toBeVisible(); await expect(page.getByTestId('splash')).toBeHidden({ timeout: 6000 })
    await page.reload(); await expect(page.getByTestId('splash')).toHaveCount(0)
    // under reduced motion only the final wordmark shows
    ```
    Update `e2e/sign-in.e2e.ts`: keep the "did not finish" message test (now on the new page) and the phone-width Google button test; replace the reduced-motion test (the old headline is gone) with the splash's reduced-motion check above.
- [ ] Step 2: run them — `bun test src/features/auth src/features/opening/components/Splash.test.tsx`; expected: FAIL (modules missing). `bun run test:e2e -- e2e/student-sign-in.e2e.ts`; expected: FAIL.
- [ ] Step 3: implement the behaviour above. Industry rules (`src/design-systems/industry/DESIGN.md`): the solid primary button is the one filled object; headings `font-heading`; icons Lucide at `strokeWidth={1.5}`; copy sentence case, buttons are verbs; status text `text-muted-foreground`. Reuse `Button`, `Input`, `Label` from `src/shared/components/ui`.
- [ ] Step 4: run them — the commands of Step 2; expected: PASS. Then `bun run test:run`, `bun run lint`, `bun run type-check`; expected: PASS.
- [ ] Step 5: leave the change in the working tree.

## Task 5: The student profile — contract, table, repository
**Delivers:** the storage behind criteria 14, 26, 32, 42, 50, 57, 58, 60–63.
**Files:** create `src/features/opening/model/profile.ts`, `src/features/opening/model/profile.test.ts`, `src/features/opening/server/profile.ts`, `src/features/opening/server/profile.test.ts`; modify `src/shared/lib/db/schema.ts`; generate `src/shared/lib/db/migrations/0001_*.sql` (+ its meta snapshot and journal entry).
**Kind:** judgement.

**The shared contract — `src/features/opening/model/profile.ts` (pure; every later task imports from here, never retypes)**
```ts
export const QUESTION_KEYS = ['where', 'amount', 'covers', 'who', 'hard', 'earliest', 'latest', 'years', 'dep', 'qual', 'eng',
  'know', 'field', 'areas', 'level', 'learn', 'length', 'dest', 'place', 'community', 'knows', 'climate',
  'stay', 'focus', 'earn', 'settle'] as const
export type QuestionKey = (typeof QUESTION_KEYS)[number]
export type AnswerValue = string | number | string[]          // amount is a number (AUD thousands); areas is up to three strings
export type AnswerState = 'stated' | 'assumed'               // 'assumed' = she tapped "Not sure" (the default is stored)
export type StoredAnswer = { value: AnswerValue; state: AnswerState }
export type StoredAnswers = Partial<Record<QuestionKey, StoredAnswer>>

export const PERSONAS = ['male', 'female', 'neutral'] as const   // "Prefer not to say" and Skip both store 'neutral'
export type Persona = (typeof PERSONAS)[number]
export const OPENING_STEPS = ['facts', 'study', 'living', 'after'] as const   // screens 1–4, also their URL segments
export type OpeningStep = (typeof OPENING_STEPS)[number]
export const STEPS = ['picture', ...OPENING_STEPS, 'futures', 'attention'] as const
export type Step = (typeof STEPS)[number]

export const RELATIONSHIPS = ['Cousin', 'Sibling', 'Aunt or uncle', 'Friend', 'Other'] as const
export type Relative = { placeId: string | null; place: string; relationship: (typeof RELATIONSHIPS)[number]; name: string | null }
//   placeId: a place in the catalogue (Task 7) or null when she picked "Somewhere else" and typed `place`

export const LIFE_VALUES = ['Health', 'Social life', 'Financial life', 'Learning and growth', 'Closeness to family',
  'Community and relatives nearby', 'Independence', 'Adventure'] as const
export type Coins = { state: 'later' } | { state: 'spent'; piles: number[]; assumed: boolean }   // piles: 8 entries, each 0–5, sum 10

export type FutureId = 'cost' | 'staying' | 'career'
export type Reminder = { futureId: FutureId; courseId: string; text: string; at: string }   // at: ISO time

export type Profile = { userId: string; persona: Persona | null; answers: StoredAnswers; relative: Relative | null;
  coins: Coins | null; reminders: Reminder[]; lastStep: Step; seenFutures: boolean }

// zod schemas for everything stored as JSON, used on every read and write:
export const storedAnswerSchema, storedAnswersSchema, relativeSchema, coinsSchema, reminderSchema
//   storedAnswersSchema: an object whose keys are QuestionKey; on read, invalid entries are dropped (not thrown) — use
//     a parse that keeps only the entries storedAnswerSchema accepts.
//   relativeSchema: place 1–80 chars trimmed, name null or 1–40 chars trimmed, relationship in RELATIONSHIPS.
//   coinsSchema: { state: 'later' } | { state: 'spent', piles: 8 ints 0..5 summing to 10, assumed: boolean }.
```

**The table — `schema.ts`** (below the access section, same conventions: camelCase keys, snake_case columns, `tz()` timestamps, `oneOf` checks; `jsonb` from `drizzle-orm/pg-core` with `.$type<…>()`; import the constants and types from `@/features/opening/model/profile` — types with `import type`)
```ts
export const studentProfile = pgTable('student_profile', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  persona: text('persona', { enum: PERSONAS }),                 // null until the picture question is answered or skipped
  answers: jsonb('answers').$type<StoredAnswers>().notNull().default({}),
  relative: jsonb('relative').$type<Relative>(),
  coins: jsonb('coins').$type<Coins>(),
  reminders: jsonb('reminders').$type<Reminder[]>().notNull().default([]),
  lastStep: text('last_step', { enum: STEPS }).notNull().default('picture'),
  seenFutures: boolean('seen_futures').notNull().default(false),
  createdAt: tz('created_at').notNull().defaultNow(),
  updatedAt: tz('updated_at').notNull().defaultNow(),
}, (t) => [
  check('student_profile_persona_check', sql`${t.persona} is null or ${oneOf(t.persona, PERSONAS)}`),
  check('student_profile_last_step_check', oneOf(t.lastStep, STEPS)),
])
```
Generate: `DATABASE_URL=postgres://app:app@127.0.0.1:5433/app bun run db:generate` (writes `0001_*.sql`), apply: `DATABASE_URL=postgres://app:app@127.0.0.1:5433/app bun scripts/migrate.ts`. Never hand-edit the generated SQL.

**The repository — `src/features/opening/server/profile.ts`** (`import 'server-only'`)
```ts
export async function getProfile(userId: string): Promise<Profile>        // insert … on conflict do nothing, then select; JSON parsed with the schemas
export async function saveAnswers(userId: string, patch: StoredAnswers): Promise<void>   // merge: answers = answers || patch::jsonb; updated_at = now()
export async function savePersona(userId: string, persona: Persona): Promise<void>
export async function saveRelative(userId: string, relative: Relative | null): Promise<void>
export async function saveCoins(userId: string, coins: Coins): Promise<void>
export async function addReminder(userId: string, reminder: Reminder): Promise<void>   // replaces an existing one with the same futureId and courseId
export async function markStep(userId: string, step: Step): Promise<void>   // last_step = step; step 'futures' also sets seen_futures = true; never moves seen_futures back
```
Every function ensures the row exists first (the same insert … on conflict do nothing), so a write never fails on a profile that was not read yet. Drizzle facts: `.set({ answers: sql\`${studentProfile.answers} || ${JSON.stringify(patch)}::jsonb\` })` merges top-level keys (Postgres `jsonb || jsonb`); `.onConflictDoNothing()` exists on inserts (drizzle-orm 0.45, as used by the repo's postgres-js driver in `src/shared/lib/db/index.ts`).

- [ ] Step 1: write the failing tests.
  - `profile.test.ts` (unit): `storedAnswersSchema` keeps `{ amount: { value: 36, state: 'stated' } }`, drops `{ nonsense: … }` and `{ amount: { value: 36, state: 'maybe' } }`; `coinsSchema` accepts eight piles summing to 10 with none above 5, refuses a pile of 6, a sum of 9, seven piles; `relativeSchema` trims, refuses a relationship outside `RELATIONSHIPS`, refuses an 81-character place.
  - `server/profile.test.ts` (database, the `DB_TESTS` gate and `mock.module('server-only', () => ({}))` exactly as `src/features/admin/users/server.test.ts:9-30`; insert its own users with ids starting `sp-t-` and emails `@sp.e2e.test`, delete them after):
    ```ts
    const p = await getProfile(uid)                     // created on first read
    expect(p).toMatchObject({ persona: null, answers: {}, relative: null, coins: null, reminders: [], lastStep: 'picture', seenFutures: false })
    await saveAnswers(uid, { amount: { value: 36, state: 'stated' } })
    await saveAnswers(uid, { hard: { value: 'Roughly', state: 'assumed' } })
    expect((await getProfile(uid)).answers).toEqual({ amount: { value: 36, state: 'stated' }, hard: { value: 'Roughly', state: 'assumed' } })
    await saveAnswers(uid, { amount: { value: 30, state: 'stated' } }); expect((await getProfile(uid)).answers.amount?.value).toBe(30)
    await markStep(uid, 'living'); expect((await getProfile(uid)).lastStep).toBe('living')
    await markStep(uid, 'futures'); await markStep(uid, 'attention')
    expect(await getProfile(uid)).toMatchObject({ lastStep: 'attention', seenFutures: true })
    await addReminder(uid, r1); await addReminder(uid, { ...r1, text: 'again' })   // same future and course
    expect((await getProfile(uid)).reminders).toHaveLength(1)
    await saveCoins(uid, { state: 'later' }); await savePersona(uid, 'neutral'); await saveRelative(uid, rel); await saveRelative(uid, null)
    // a write before any read creates the row; deleting the user deletes the profile (cascade)
    ```
- [ ] Step 2: run them — `bun test src/features/opening/model/profile.test.ts` and `DB_TESTS=1 DATABASE_URL=postgres://app:app@127.0.0.1:5433/app bun test src/features/opening/server/profile.test.ts`; expected: FAIL (modules missing).
- [ ] Step 3: implement; generate and apply the migration as above.
- [ ] Step 4: run them — the commands of Step 2; expected: PASS. `bun run type-check`; expected: PASS.
- [ ] Step 5: leave the change in the working tree.

## Task 6: Questions model and the student actions
**Delivers:** criteria 22, 23, 26, 27, 28, 29, 31 (rules), and the write path for 14, 32, 42, 50, 57, 58.
**Files:** create `src/features/opening/model/questions.ts`, `src/features/opening/model/questions.test.ts`, `src/features/opening/actions.ts`, `src/features/opening/actions.test.ts`.
**Kind:** judgement.

**`questions.ts` — the one definition of the screens (pure)**
```ts
import type { AnswerValue, OpeningStep, QuestionKey, StoredAnswer, StoredAnswers } from './profile'
export const NOT_SURE = 'Not sure'
export type Question = {
  key: QuestionKey
  label: string                       // shown above the options
  options: readonly AnswerValue[]     // amount: numbers (AUD thousands), displayed "AUD 30k"
  control: 'chips' | 'select' | 'multi'   // 'select' for where; 'multi' for areas (up to three)
  notSure: boolean                    // whether a "Not sure" option is offered
}
export type Item = { id: string; title: string; questions: readonly Question[] }   // one impact line per item (Task 9)
export type Screen = { step: OpeningStep; number: 1 | 2 | 3 | 4; title: string; sub: string; next: string; items: readonly Item[] }
export const SCREENS: readonly Screen[]
export const DEFAULTS: Partial<Record<QuestionKey, AnswerValue>>
export function questionOf(key: QuestionKey): Question
export function isVisible(key: QuestionKey, answers: StoredAnswers): boolean
export function effective(answers: StoredAnswers, key: QuestionKey): AnswerValue | undefined   // stated or assumed value, else DEFAULTS[key]
export function isAssumed(answers: StoredAnswers, key: QuestionKey): boolean                   // state 'assumed', or unanswered with a default
export function parseAnswer(key: QuestionKey, raw: unknown): StoredAnswer | null
//   NOT_SURE on a question with notSure → { value: DEFAULTS[key], state: 'assumed' }; a valid option → { value, state: 'stated' };
//   a StoredAnswer object whose value is a valid option or the default (Undo restores these) → itself; anything else → null.
//   areas: an array of 1–3 distinct valid options.
export function chipText(key: QuestionKey, answers: StoredAnswers): string   // prefixed "Assumed: " when isAssumed
export function fieldsChosen(answers: StoredAnswers): { kind: 'field' | 'areas' | 'any'; values: string[] }
```
Screen content (from `r1-0..4.png` / `text.txt` and `r5-model.js` `OPEN`, minus the pre-fill state):
| Screen | title / sub / next button | items → questions (options; ✱ = no "Not sure") |
| --- | --- | --- |
| 1 facts | "Facts about you" / "Two to four taps a question. “Not sure” is fine anywhere." / "Next: what you'd study" | where "Where are you right now?" (select: Nepal, India, Bangladesh, Sri Lanka, Pakistan, Bhutan, Vietnam, Philippines, Indonesia, China, Australia (on a visa), Another country) · budget "Your budget per year": amount "Amount" (24, 30, 36, 42), covers "It covers" (Fees only, Fees and living), who "Who pays" (Family, Savings, Loan, A mix), hard "Is this a hard limit, or roughly?" (Hard limit, Roughly) · timing "Timing": earliest "Earliest start" (Feb 2027, Jul 2027, Later), latest "Latest you'd accept" (Feb 2027, Jul 2027, Feb 2028), years "Most years you'd give it" (2, 3, 4 or more) · dep "Anyone coming with you?" (No one, Partner, Partner and children) · quals "Your qualifications and scores": qual "Last qualification" (High school, Diploma, Bachelor's, Master's), eng "English test" (IELTS 6.0, IELTS 6.5, IELTS 7.0, IELTS 7.5 or more, Not taken yet) |
| 2 study | "What you'd study" / "Two to four taps. You can say “suggest me”." / "Next: where and how you'd live" | know "Do you know what you want to study?" (Something particular, A few areas I'm drawn to, Suggest me), field "Which field?" (Cyber security, Data science, Business analytics, Information technology), areas "Pick up to three" (multi: IT and computing, Business, Data, Health, Engineering, Design) ✱ · level "Study level" (Diploma, Bachelor's, Master's) · learn "How you like to learn" (Hands-on with placements, Mostly classroom and research, No preference) · length "Course length you'd prefer" (As short as possible, Fine with longer if it opens more) |
| 3 living | "Where and how you'd live" / "Where you'd be happy, not just where the course is." / "Next: after you graduate" | dest "Destination" (Australia, Open to others) · place "Kind of place" (City, Suburban, Regional) · community "Does a community of similar culture, or relatives nearby, matter?" (Yes, A little, No), knows "Do you know anyone who lives in Australia?" (Yes, No) · climate "Climate (optional)" (Mild, Warm, No preference) ✱ |
| 4 after | "After you graduate" / "There are no wrong answers. Each one changes which roads stay open." / "Show me three futures" | stay "Would you want to stay after?" (Yes, Not sure, No) ✱ — "Not sure" is a real answer here (ADR-097) · focus "Career-focused or academic?" (Career-focused, Academic) · earn "Do you need to earn while studying?" (Yes, Helpful, No) · settle "Settle long-term, or come home eventually? (optional)" (Settle long-term, Come home eventually) ✱ |

`DEFAULTS` (DS-D1's assumed values): where Nepal, amount 30, covers Fees only, who Family, hard Roughly, earliest Feb 2027, latest Jul 2027, years 3, dep No one, qual Unknown, eng Unknown, know Suggest me, field Any, level Master's, learn No preference, length Fine with longer if it opens more, dest Australia, place Suburban, community A little, knows No, stay Not sure (DS-D3 and ADR-097 give an unanswered stay the weight 2 and no sealing), focus Career-focused, earn Helpful. No default for areas, climate, settle.
Visibility: field iff `effective(know) === 'Something particular'`; areas iff `effective(know) === "A few areas I'm drawn to"`; knows iff `answers.community` exists and its value is not 'No'; everything else always.
`chipText` (from `r5-model.js` `CHIPT`): amount "Budget about AUD {v}k a year"; hard "A hard limit" / "A rough budget"; covers "Fees only" / "Fees and living"; place "Prefers {v lowercased}"; latest "Latest start {v}"; stay "Wants to stay after" / "Not sure about staying" / "Not staying after"; earn "Earning while studying: {v lowercased}"; level "Level: {v}"; dest "Australia only" / "Open to others · Australia shown"; field → from `fieldsChosen`: "Field: Cyber security" / "Areas: IT and computing, Data" / "Field: any (suggest me)". Prefix "Assumed: " when `isAssumed`.

**`actions.ts`** (`'use server'`, pattern `src/features/admin/users/actions.ts:31-48`: read the session with `getSession()`, refuse, validate, call the repository, return `ActionResult`)
```ts
export async function saveAnswersAction(patch: unknown): Promise<ActionResult<{ answers: StoredAnswers }>>
//   patch: an object of QuestionKey → raw value, NOT_SURE, or a StoredAnswer (Undo); every entry through parseAnswer; any null → fail
export async function savePersonaAction(persona: unknown): Promise<ActionResult>         // one of PERSONAS
export async function saveRelativeAction(relative: unknown): Promise<ActionResult>       // relativeSchema or null
export async function saveCoinsAction(coins: unknown): Promise<ActionResult>             // coinsSchema
export async function addReminderAction(reminder: unknown): Promise<ActionResult>        // { futureId, courseId, text }; `at` set on the server
// Messages: signed out "Please sign in again."; not a student (canUseStudentApp false) "Not authorised."; invalid "That answer isn't one of the options."
```

- [ ] Step 1: write the failing tests.
  - `questions.test.ts`: `SCREENS.map(s => s.step)` is `['facts', 'study', 'living', 'after']`; screen 1's `where` options end with `'Australia (on a visa)', 'Another country'`; `questionOf('stay').options` is `['Yes', 'Not sure', 'No']` and `notSure` false; `isVisible('field', {})` false and true with know stated "Something particular"; `isVisible('knows', {})` false, with community `A little` true, with community `No` false, with community assumed (Not sure) true; `parseAnswer('amount', 36)` → stated 36, `parseAnswer('amount', 37)` → null, `parseAnswer('amount', 'Not sure')` → `{ value: 30, state: 'assumed' }`, `parseAnswer('climate', 'Not sure')` → null, `parseAnswer('areas', ['Data', 'Health'])` → stated, four areas → null; `effective({}, 'amount')` → 30, `isAssumed({}, 'amount')` true, `isAssumed({ amount: { value: 36, state: 'stated' } }, 'amount')` false; `chipText('amount', {})` → "Assumed: Budget about AUD 30k a year", `chipText('stay', { stay: { value: 'Yes', state: 'stated' } })` → "Wants to stay after"; `fieldsChosen({})` → `{ kind: 'any', values: [] }`.
  - `actions.test.ts`: `mock.module('@/shared/lib/auth/session', …)` returning a session whose role you set per test, and `mock.module('./server/profile', …)` with spies; signed out → `{ ok: false, error: 'Please sign in again.' }` and no repository call; role `admin` → "Not authorised." and no call; a student saving `{ amount: 36 }` → `{ ok: true, answers: { amount: { value: 36, state: 'stated' } } }` and `saveAnswers` called with that patch; `{ amount: 37 }` → "That answer isn't one of the options."; `{ nonsense: 1 }` → the same; `savePersonaAction('robot')` refused; `saveCoinsAction` with a sum of 9 refused; `addReminderAction` stores an ISO `at`.
- [ ] Step 2: run them — `bun test src/features/opening/model/questions.test.ts src/features/opening/actions.test.ts`; expected: FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: run them; expected: PASS. `bun run type-check`; expected: PASS.
- [ ] Step 5: leave the change in the working tree.

## Task 7: Engine foundations — types, mock catalogue, distances, weights
**Delivers:** criteria 32, 33 (distance lines), 43 (weights and reasons), and the data behind 34–48.
**Files:** create `src/features/engine/types.ts`, `src/features/engine/catalogue.ts`, `src/features/engine/catalogue.test.ts`, `src/features/engine/geo.ts`, `src/features/engine/geo.test.ts`, `src/features/engine/weights.ts`, `src/features/engine/weights.test.ts`.
**Kind:** judgement (the catalogue's prose is authored; its numbers below are fixed because the tests pin them).

**`types.ts` (the engine's one definition of its types; the UI imports them type-only)**
```ts
export const DIMENSIONS = ['cost', 'time', 'work', 'pr', 'location', 'career'] as const
export type Dimension = (typeof DIMENSIONS)[number]
export const DIMENSION_LABELS: Record<Dimension, string> = { cost: 'Cost', time: 'Time', work: 'Work', pr: 'PR', location: 'Location', career: 'Career' }
export type Weight = 0 | 1 | 2 | 3
export type Weights = Record<Dimension, Weight>
export type Effect = 'gives' | 'neutral' | 'costs'
export type Feel = 'relieved' | 'fine' | 'stretched' | 'hard'
export const FEELS: readonly Feel[] = ['relieved', 'fine', 'stretched', 'hard']
export type DataState = 'confirmed' | 'estimated' | 'unknown' | 'out of date' | 'conflicting'
export type Pips = 1 | 2 | 3 | 4 | 5
export const BANDS: Record<Pips, string> = { 1: 'low', 2: 'moderate', 3: 'fair', 4: 'strong', 5: 'very strong' }
export type Claim = { pips: Pips; state: DataState; source: string; date: string; detail: string[]; notSure: boolean }
export type LineData = { effect: Effect; text: string; claim: Claim }
export type FieldId = 'cyber' | 'data' | 'business' | 'it' | 'psych'
export type Level = 'Diploma' | "Bachelor's" | "Master's"
export type Point = { lat: number; lng: number }
export type City = Point & { id: string; name: string; regional: boolean; livingK: number; location: { text: string; claim: Claim } }
export type Place = Point & { id: string; name: string; cityId: string }
export type Campus = Point & { id: string; name: string; cityId: string }
export type Course = { id: string; name: string; university: string; campusId: string; field: FieldId; level: Level;
  feeK: number; years: number; route: string; prScore: 0 | 1 | 2 | 3; careerScore: 1 | 2 | 3 | 4 | 5; placements: boolean;
  feeClaim: Claim; lines: Record<'time' | 'work' | 'pr' | 'career', LineData>; keepOpen: { text: string; doors: string } }
//   prScore 0 = no road to PR (sealed when she wants to stay); careerScore = the job market the route enters
```

**`catalogue.ts`** — exports `PREVIEW_TODAY = '2026-10-01'`, `CITIES`, `PLACES`, `CAMPUSES`, `COURSES`, `FIELD_OF_OPTION` (`'Cyber security' → 'cyber'`, `'Data science' → 'data'`, `'Business analytics' → 'business'`, `'Information technology' → 'it'`), `FIELD_LABELS` (`cyber 'cyber security'`, `data 'data science'`, `business 'business analytics'`, `it 'information technology'`, `psych 'psychology'`), `AREA_FIELDS` (`'IT and computing' → { fields: ['it', 'cyber'] }`, `Business → { fields: ['business'] }`, `Data → { fields: ['data'] }`, `Health → { fields: ['psych'], substitutedFrom: 'health' }`, `Engineering → { fields: ['it'], substitutedFrom: 'engineering' }`, `Design → { fields: ['it'], substitutedFrom: 'design' }`), and lookups `cityOf(course)`, `campusOf(course)`, `placeById(id)`. Every claim's `source` ends "· mock" or its `state` text says mock; every figure is mock (DS-R5, DS-F43).
| City id | name | regional | livingK | lat, lng | location.text (claim) |
| --- | --- | --- | --- | --- | --- |
| perth | Perth | true | 21 | -31.952, 115.861 | "Counts as regional; rent about AUD 160 a week lower than Sydney (about 30%)" (4 pips, estimated) |
| adelaide | Adelaide | true | 20 | -34.929, 138.601 | "Counts as regional; rent about 30% below Sydney" (4, estimated) |
| sydney | Sydney | false | 28 | -33.869, 151.209 | "The highest rents in the country" (1, estimated) |
| melbourne | Melbourne | false | 25 | -37.814, 144.963 | "A big city; rents below Sydney's" (2, estimated) |
| geelong | Geelong | true | 22 | -38.149, 144.361 | "Counts as regional; an hour from Melbourne" (4, confirmed) |
| hobart | Hobart | true | 21 | -42.882, 147.327 | "Counts as regional; a small city with a tight rental market" (3, estimated) |
| wollongong | Wollongong | true | 24 | -34.425, 150.893 | "Counts as regional; 90 minutes from Sydney by train" (4, confirmed) |
Places: Perth CBD (-31.952, 115.861), Cannington (-32.017, 115.935), Joondalup (-31.745, 115.766), Bentley (-32.001, 115.900); Adelaide CBD (-34.929, 138.601), Mawson Lakes (-34.810, 138.610); Sydney CBD (-33.869, 151.209), Parramatta (-33.815, 151.001), Strathfield (-33.873, 151.094); Melbourne CBD (-37.814, 144.963), Footscray (-37.800, 144.900), Clayton (-37.915, 145.129); Geelong (-38.149, 144.361), Waurn Ponds (-38.210, 144.300); Hobart (-42.882, 147.327), Sandy Bay (-42.904, 147.325); Wollongong (-34.425, 150.893). Ids are kebab-case names (`cannington`, `perth-cbd`).
Campuses: ECU Joondalup (-31.752, 115.770), Curtin Bentley (-32.006, 115.894), TAFE Perth (-31.949, 115.858), UniSA City West (-34.924, 138.592), UTS Ultimo (-33.883, 151.200), Monash Clayton (-37.911, 145.134), Swinburne Hawthorn (-37.822, 145.039), Deakin Waurn Ponds (-38.198, 144.298), UTAS Sandy Bay (-42.903, 147.325), UOW Wollongong (-34.405, 150.878).
| Course id | name · university | campus | field | level | feeK | years | route | prScore | careerScore | placements | keepOpen (text · doors) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ecu-cyber | Master of Cyber Security · ECU | ECU Joondalup | cyber | Master's | 33 | 2 | 190 state nomination, then PR | 3 | 3 | true | Sit the IELTS before 30 Nov · keeps 2 doors open: the February and July intakes |
| curtin-it | Master of Information Technology · Curtin | Curtin Bentley | it | Master's | 34 | 2 | 190 state nomination, then PR | 3 | 3 | true | Ask Curtin about the July intake now · keeps 1 door open |
| unisa-cyber | Master of Cyber Security · UniSA | UniSA City West | cyber | Master's | 27 | 2 | 491 regional visa, then PR | 3 | 2 | false | Apply to two intakes (Feb and Jul 2027) · keeps 2 doors open |
| unisa-it | Master of Information Technology · UniSA | UniSA City West | it | Master's | 29 | 2 | 491 regional visa, then PR | 3 | 2 | false | Apply to two intakes (Feb and Jul 2027) · keeps 2 doors open |
| uts-cyber | Master of Cyber Security · UTS | UTS Ultimo | cyber | Master's | 47 | 2 | 485, then employer sponsorship | 1 | 5 | true | Ask UTS whether you can defer a year · keeps 1 door open |
| uts-data | Master of Data Science and Innovation · UTS | UTS Ultimo | data | Master's | 49 | 2 | 485, then employer sponsorship | 1 | 5 | true | Ask UTS whether you can defer a year · keeps 1 door open |
| monash-data | Master of Data Science · Monash | Monash Clayton | data | Master's | 45 | 2 | 485, then employer sponsorship | 1 | 4 | false | Apply before the 30 Nov round · keeps 2 doors open |
| deakin-ba | Master of Business Analytics · Deakin | Deakin Waurn Ponds | business | Master's | 36 | 2 | 491 regional visa, then PR | 3 | 2 | true | Apply to two intakes (Mar and Jul 2027) · keeps 2 doors open |
| deakin-cyber | Master of Cyber Security · Deakin | Deakin Waurn Ponds | cyber | Master's | 35 | 2 | 491 regional visa, then PR | 3 | 2 | true | Apply to two intakes (Mar and Jul 2027) · keeps 2 doors open |
| utas-it | Master of Information Technology and Systems · UTAS | UTAS Sandy Bay | it | Master's | 28 | 2 | 491 regional visa, then PR | 3 | 1 | false | Ask about the July intake · keeps 1 door open |
| uow-cyber | Master of Cyber Security · UOW | UOW Wollongong | cyber | Master's | 38 | 2 | 491 regional visa, then PR | 3 | 3 | true | Apply to two intakes (Feb and Jul 2027) · keeps 2 doors open |
| swin-cyberpsych | Master of Psychology (Cyberpsychology) · Swinburne | Swinburne Hawthorn | psych | Master's | 40 | 2 | 485, no clear road to PR | 0 | 3 | true | Ask Swinburne about credit for your degree · keeps 1 door open |
| ecu-bsc-cyber | Bachelor of Cyber Security · ECU | ECU Joondalup | cyber | Bachelor's | 32 | 3 | 190 state nomination, then PR | 3 | 3 | true | Apply to two intakes (Feb and Jul 2027) · keeps 2 doors open |
| tafe-cyber | Diploma of Information Technology (Cyber Security) · North Metropolitan TAFE | TAFE Perth | cyber | Diploma | 15 | 2 | Diploma, then a degree pathway | 0 | 2 | true | Ask about the pathway into a degree · keeps 1 door open |
Each course's `lines` (time, work, pr, career) is authored prose with a claim, modelled on the design's three futures (`text.txt` lines 430–705): e.g. unisa-cyber time "About 6 years to permanent residency · a later intake keeps it open" (costs, 2 pips, unknown), work "Regional study: up to 5 years of post-study work rights" (gives, 4, confirmed), pr "Regional points, then a 491 to 191 path" (gives, 3, estimated), career **"A smaller IT job market than Perth"** (costs, 2, estimated, `notSure: true`, detail ["Adelaide IT job market: moderate · ~2,100 postings last quarter vs 3,400 in Perth", "Graduates in this field from UniSA: 78% in full-time work within four months · graduate outcomes survey 2025"], source "Job-ad counts, Jul–Sep 2026 · mock figure") — the R1 claim; unisa-it carries the same R1 career claim. ecu-cyber and uts-cyber follow the design's Perth and Sydney futures. Effects follow the facts: metro (Sydney, Melbourne) work "Metro: 2 years of post-study work rights" costs; regional work gives; prScore 3 pr gives, 1 costs ("No regional points; depends on an employer"), 0 costs ("No clear road to permanent residency"). Only the R1 claims have `notSure: true`. No keepOpen names a country other than Australia.

**`geo.ts`**
```ts
export function haversineKm(a: Point, b: Point): number          // earth radius 6371 km
export function minutesBetween(a: Point, b: Point): number       // round to the nearest 5 of (km × 1.3 / 40 × 60 + 10)
export function flightHours(a: Point, b: Point): number          // round to the nearest 0.5 of (km / 750 + 0.75)
export function formatFlight(hours: number): string              // 3.5 → 'a 3½-hour flight', 4 → 'a 4-hour flight'
export function distanceLine(course: Course, relative: Relative | null): string | null
//   null relative → null; relative.placeId null → `Distances from ${who} in ${relative.place} will show once we can work them out.`
//   same city → `${campus.name}: about ${minutesBetween(place, campus)} min from ${who} in ${place.name} · estimate`
//   other city → `${city.name}: ${formatFlight(flightHours(place, city))} from ${who} in ${placeCity.name} · estimate`
//   who = relative.name, else `your ${relationship.toLowerCase()}`
```

**`weights.ts`**
```ts
export function deriveWeights(answers: StoredAnswers): { weights: Weights; reasons: Record<Dimension, string> }
//   DS-D3, Family never shown. A driving answer that is assumed (Not sure or unanswered) gives the DS-D3 default
//   (cost 2, time 2, work 2, pr 2, location 1, career 2) with the reason "Not sure: assumed {n}" (location's reads "No preference: 1"). Months to the latest start are
//   counted from PREVIEW_TODAY: Feb 2027 → within 6 months, Jul 2027 → within a year, Feb 2028 → more than a year.
//   Reasons, as the design's plaque (`p3fix-2.png`): "A hard limit: 3" / "A rough budget: 2" (+ " · paying by loan +1");
//   "Latest start within 6 months: 3" / "Latest start within a year: 2" / "Latest start more than a year away: 1" (+ " · as short as possible +1");
//   "Need to earn: yes · 3" / "Need to earn: helpful · 2" / "Need to earn: no · 1";
//   "Stay after: yes · 3 · routes with no PR path seal" / "Stay after: not sure · 2" / "Stay after: no · 0";
//   "{City|Suburban|Regional} chosen: 2" (+ " · community matters +1" when community is stated Yes or A little) / "No preference: 1";
//   "Career-focused: 3" / "Academic: 1" (+ " · placements +1" when learn is stated "Hands-on with placements"). Every weight capped at 3.
```

- [ ] Step 1: write the failing tests.
  - `catalogue.test.ts`: 7 cities, 14 courses; every course's campus and city resolve; every claim has a non-empty source and date; exactly the two UniSA career claims have `notSure`; no `keepOpen.text` contains UK, Canada, New Zealand or US; every city id in places and campuses exists.
  - `geo.test.ts`: `haversineKm(perth, adelaide)` between 2100 and 2160; `formatFlight(3.5)` → 'a 3½-hour flight', `formatFlight(5)` → 'a 5-hour flight'; `minutesBetween(p, p)` → 10; `distanceLine(ecu-cyber, { placeId: 'cannington', place: 'Cannington', relationship: 'Cousin', name: 'Anjali' })` matches `/^ECU Joondalup: about \d+ min from Anjali in Cannington · estimate$/` and its number equals `minutesBetween(cannington, ecuJoondalup)`; for unisa-cyber it is `'Adelaide: a 3½-hour flight from Anjali in Perth · estimate'`; with no name it says "your cousin"; with `placeId: null, place: 'Kathmandu'` it is the promise line; with no relative, null.
  - `weights.test.ts`: Priya's answers (hard Roughly, latest Jul 2027, earn Helpful, stay Yes, place Regional, community A little, focus Career-focused, learn Hands-on with placements, all stated) → weights `{ cost: 2, time: 2, work: 2, pr: 3, location: 3, career: 3 }` and reasons `"A rough budget: 2"`, `"Latest start within a year: 2"`, `"Need to earn: helpful · 2"`, `"Stay after: yes · 3 · routes with no PR path seal"`, `"Regional chosen: 2 · community matters +1"`, `"Career-focused: 3 · placements +1"`; `{}` → `{ cost: 2, time: 2, work: 2, pr: 2, location: 1, career: 2 }`; Hard limit + Loan → cost 3 (capped); stay No → pr 0; latest Feb 2027 + As short as possible → time 3 (capped); place assumed → location 1 with "No preference: 1"; no PR line text in the catalogue contains a `%` or a probability (criterion 40) — assert this in `catalogue.test.ts`.
- [ ] Step 2: run them — `bun test src/features/engine`; expected: FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: run them; expected: PASS. `bun run type-check`; expected: PASS.
- [ ] Step 5: leave the change in the working tree.

## Task 8: The futures engine — feel, buildFutures, diffFutures
**Delivers:** criteria 34, 35, 36, 37, 38 (data), 39, 40, 41 (data), 44, 45, 46, 47, 48, 50 (diff), 52, 59 (coins are not an input).
**Files:** create `src/features/engine/feel.ts`, `src/features/engine/feel.test.ts`, `src/features/engine/futures.ts`, `src/features/engine/futures.test.ts`, `src/features/engine/fixtures.ts` (exports `PRIYA_ANSWERS: StoredAnswers` and `ANJALI: Relative` exactly as the Priya test below defines them; Task 12's test imports them).
**Kind:** judgement.

**Interfaces**
```ts
// feel.ts
export function feelOf(effect: Effect, weight: Weight, cost?: { budgetK: number; totalK: number }): Feel
//   DS-D4: gives → relieved when weight ≥ 2, else fine; neutral → fine; costs → hard at 3, stretched at 2, else fine.
//   Cost rule (only when `cost` is passed and totalK > budgetK): at least stretched; over by more than 20 % of budgetK → hard.

// futures.ts — pure, deterministic (no Date, no random); runs in the browser and on the server
export type EngineInput = { answers: StoredAnswers; relative: Relative | null }    // coins are deliberately not an input (DS-R7)
export type FutureLine = { dim: Dimension; effect: Effect; text: string; feel: Feel; claim: Claim; weighMost: boolean }
export type Future = { id: FutureId; heading: string; courseId: string; route: string; distance: string | null;
  strongOn: Dimension[]; costsOn: Dimension[]; lines: FutureLine[]; chips: QuestionKey[]; keepOpen: { text: string; doors: string } }
export type Notice = { kind: 'field-substituted' | 'level-substituted' | 'fewer' | 'australia-only'; text: string; chip?: QuestionKey }
export type SealedRoute = { courseId: string; route: string; overByK: number }
export type FuturesResult =
  | { kind: 'futures'; weights: Weights; reasons: Record<Dimension, string>; futures: Future[]; notices: Notice[] }
  | { kind: 'sealed'; weights: Weights; reasons: Record<Dimension, string>; budgetK: number; nearest: SealedRoute[]; notices: Notice[] }
export const FUTURE_HEADINGS: Record<FutureId, string> = { cost: 'Built around cost', staying: 'Built around staying', career: 'Built around career' }
export const FUTURE_CHIPS: Record<FutureId, QuestionKey[]> = {
  cost: ['amount', 'hard', 'place', 'field', 'latest'], staying: ['amount', 'stay', 'earn', 'level', 'field'], career: ['amount', 'dest', 'field', 'earn'] }
export function buildFutures(input: EngineInput): FuturesResult
export function diffFutures(prev: FuturesResult, next: FuturesResult): Partial<Record<FutureId, Dimension[]>>
//   a future whose course changed → all six dimensions; same course → the dimensions whose effect, text or feel changed
```

**The rules `buildFutures` follows (in order)** — use `effective`, `isAssumed`, `fieldsChosen` (Task 6), `deriveWeights`, catalogue and `distanceLine` (Task 7):
1. Fields: `fieldsChosen` → `field`: `[FIELD_OF_OPTION[v]]` (`'Any'` → every field); `areas`: the union of `AREA_FIELDS[a].fields`, and for each area with `substitutedFrom` a notice `field-substituted` "No {substitutedFrom} courses in this preview, so these use {FIELD_LABELS[field]}." with chip `field`; `any`: every field.
2. Level: courses in those fields at `effective(level)`; none → every level in those fields and a notice `level-substituted` "No {level} courses for these fields in this preview, so these show other levels." chip `level`.
3. Staying: when `effective(stay) === 'Yes'`, drop courses with `prScore === 0` (DS-D3: routes with no PR path seal).
4. Budget: `b = effective(amount)`; total = `feeK` + (`effective(covers) === 'Fees and living'` ? city `livingK` : 0); a hard limit (`effective(hard) === 'Hard limit'`) keeps only totals ≤ b.
5. Sealed: a hard limit left nothing while step 3's pool had courses → `{ kind: 'sealed', budgetK: b, nearest }`, nearest = the pool's three lowest totals, ascending, `overByK = total − b`.
6. Pick, each from what the earlier picks left: cost = lowest total (ties: higher careerScore, then id ascending); staying = highest prScore (ties: lower total, then id); career = highest careerScore (ties: higher prScore, lower total, id). Fewer than three → a notice `fewer`: hard limit → "Only one route fits a hard limit of AUD {b}k" / "Only {n} routes fit …" chip `amount`; else when step 3 removed any → "Only {n} … with a road to permanent residency" (zero: "No route in this preview has a road to permanent residency for these fields") chip `stay`; else "Only {n} … in this preview for these fields" chip `field`.
7. Lines, in DIMENSIONS order: **cost** computed — d = b − total; label "Fees about AUD {feeK}k a year" (or "Fees and living about AUD {total}k a year"); d ≥ 5 → gives "…: within your budget, AUD {d}k spare"; 0 ≤ d < 5 → neutral "…: within your budget, only AUD {d}k spare"; over by ≤ 6 → costs "…: AUD {−d}k over, a stretch on a rough budget"; more → costs "…: AUD {−d}k over your budget"; claim `feeClaim`. **time, work, career** = the course's lines. **pr** = the course's line, except `effective(stay) === 'No'` → neutral "PR doesn't count here: you don't plan to stay" (same claim). **location** = the city's text and claim; effect from the place answer (assumed counts as no preference): Regional → gives in a regional city, costs in a metro one; City → gives in a metro city, neutral in a regional one; Suburban or none → neutral. feel = `feelOf(effect, weights[dim], dim === 'cost' ? { budgetK: b, totalK: total } : undefined)`; `weighMost` = weight is the maximum weight and ≥ 2.
8. `route` = "{city} · {course name}, {university} · {course route}" (e.g. "Adelaide · Master of Cyber Security, UniSA · 491 regional visa, then PR"); `strongOn` = dims that give and are `weighMost`; `costsOn` = dims that cost, in DIMENSIONS order; `chips` = `FUTURE_CHIPS[id]`; `distance` = `distanceLine(course, relative)`.
9. Notice `australia-only` "Only Australia is covered in this preview, so these futures are Australian." when `answers.dest?.value === 'Open to others'`.

- [ ] Step 1: write the failing tests.
  - `feel.test.ts`: `feelOf('gives', 2)` relieved, `('gives', 1)` fine, `('neutral', 3)` fine, `('costs', 3)` hard, `('costs', 2)` stretched, `('costs', 1)` fine, `('costs', 1, { budgetK: 30, totalK: 33 })` stretched, `('costs', 1, { budgetK: 30, totalK: 37 })` hard, `('costs', 3, { budgetK: 30, totalK: 31 })` hard, `('gives', 2, { budgetK: 30, totalK: 27 })` relieved.
  - `futures.test.ts` — Priya = all stated: know Something particular, field Cyber security, level Master's, amount 30, covers Fees only, hard Roughly, latest Jul 2027, stay Yes, place Regional, community A little, focus Career-focused, earn Helpful, learn Hands-on with placements; relative Anjali, Cousin, Cannington:
    ```ts
    const r = buildFutures({ answers: priya, relative: anjali })
    expect(r.kind).toBe('futures')
    expect(r.futures.map(f => [f.id, f.courseId])).toEqual([['cost', 'unisa-cyber'], ['staying', 'ecu-cyber'], ['career', 'uts-cyber']])
    expect(line(r, 'cost', 'cost')).toMatchObject({ effect: 'neutral', text: 'Fees about AUD 27k a year: within your budget, only AUD 3k spare', feel: 'fine' })
    expect(line(r, 'staying', 'cost')).toMatchObject({ effect: 'costs', text: 'Fees about AUD 33k a year: AUD 3k over, a stretch on a rough budget', feel: 'stretched' })
    expect(line(r, 'career', 'cost')).toMatchObject({ effect: 'costs', text: 'Fees about AUD 47k a year: AUD 17k over your budget', feel: 'hard' })
    expect(line(r, 'cost', 'career').claim.notSure).toBe(true)
    expect(r.futures[0].route).toBe('Adelaide · Master of Cyber Security, UniSA · 491 regional visa, then PR')
    expect(r.futures[0].distance).toBe('Adelaide: a 3½-hour flight from Anjali in Perth · estimate')
    expect(r.futures[0].strongOn).toEqual(['pr', 'location']); expect(r.futures[0].chips).toEqual(FUTURE_CHIPS.cost)
    expect(line(r, 'cost', 'pr').weighMost && line(r, 'cost', 'location').weighMost && !line(r, 'cost', 'cost').weighMost).toBe(true)
    // 36k redraws: Adelaide's cost line gives, AUD 9k spare, relieved; diffFutures marks cost on every future
    // hard limit 30 → one future (unisa-cyber) and a 'fewer' notice "Only one route fits a hard limit of AUD 30k" with chip 'amount'
    // hard limit 24 → { kind: 'sealed', budgetK: 24, nearest: [unisa-cyber 3, ecu-cyber 9, deakin-cyber 11] }
    // stay No → every pr line neutral "PR doesn't count here: you don't plan to stay"; weights.pr 0
    // areas ['Health'] with stay unanswered → notice "No health courses in this preview, so these use psychology." and one future (swin-cyberpsych)
    // areas ['Health'] with stay Yes → no futures and the 'fewer' notice with chip 'stay'
    // level Diploma → tafe-cyber; Bachelor's → ecu-bsc-cyber; dest Open to others → the australia-only notice
    // {} (nothing answered) → three futures, no throw
    expect(buildFutures(input)).toEqual(buildFutures(input))     // deterministic
    ```
- [ ] Step 2: run them — `bun test src/features/engine/feel.test.ts src/features/engine/futures.test.ts`; expected: FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: run them; expected: PASS. `bun run test:run`, `bun run type-check`; expected: PASS.
- [ ] Step 5: leave the change in the working tree.

## Task 9: Impact lines and coin rules (pure)
**Delivers:** criteria 24, 25 (the line itself; timing is Task 11), 26 (impact wording), 27, 28, 53–57 (rules), 59.
**Files:** create `src/features/opening/model/impact.ts`, `src/features/opening/model/impact.test.ts`, `src/features/opening/model/coins.ts`, `src/features/opening/model/coins.test.ts`.
**Kind:** judgement.

**`impact.ts`**
```ts
export function impactLine(itemId: string, answers: StoredAnswers, relative: Relative | null): string | null
//   itemId = an `Item.id` from SCREENS; null when nothing in the item is answered yet
export function notSureLine(key: QuestionKey): string   // `Not sure: I'll assume “${display(DEFAULTS[key])}” and show it as a chip you can change.`
```
Port `impact(id, a)` from `/home/jenish/Projects/decision-studio/Hackathon Handoff/Hackathon Decision Studio Handoff/r5-model.js:41-63`, keeping its wording except where it promises something this slice does not do or names data the catalogue does not have:
- where: as the prototype (onshore "In Australia: you may apply onshore · your current visa's conditions still apply"; "Another country: we'll check the visa rules for where you are · study fees apply"; else "{country}: visa required · study fees apply") — the onshore and offshore lines differ (criterion 24).
- budget: as the prototype, with its `FEES` table computed from the catalogue: each city with its cheapest course fee (`COURSES` by `cityOf`). Hard limit: "Hard limit at {b}k: {cities above b} seal; {first two cities at or below b} stay open." (or "nothing seals; …", "nothing in this preview fits yet."); roughly: "Roughly {b}k: {cities within b+6} stay open, marked as a stretch." / "everything up to about {b+6}k stays open."; amount answered without hard: "About AUD {b}k a year. Tell me if it's a hard limit."
- timing: the prototype's mock counts ("Latest Feb 2027: 3 intakes open." / Jul 2027 5 / Feb 2028 7) and its two-year note.
- dep: "No one" → "Just you: single living costs on every route."; Partner or Partner and children → **"Family isn't covered in this preview yet, so every route shows costs for you alone."** (criterion 27).
- quals: eng IELTS 6.5 or above → "IELTS {x}: meets the English requirement of every course in this preview."; IELTS 6.0 → "IELTS 6.0: some courses ask for 6.5." ; Not taken yet → "Not taken yet: routes are marked unconfirmed until you sit it."; only qual answered → "{qual}: noted for entry requirements."
- know / field / areas, learn, length, place, focus, earn: as the prototype (level drops "business": "Master's: 18 months to 2 years, building on your degree.").
- dest: Australia → "Australia: {CITIES.length} cities in this preview."; Open to others → **"Only Australia is covered in this preview, so your futures will be Australian."** (criterion 28).
- community: Yes "Yes: community size shows on each city, and where your people live."; A little / No as the prototype.
- knows / relative (screen 3, the `community` item's second question and the relative form): a relative in a catalogue place → "{who} in {place}, {city}: {two nearest campuses in that city with `minutesBetween`, e.g. "Curtin Bentley is about 20 min away, ECU Joondalup about 75 min"}. Every route shows its distance from {who}. Estimated distances."; "Somewhere else" → "We'll show distances from {who} in {place} once we can work them out."
- climate: "{choice}: noted; climate doesn't change your futures in this preview." (the prototype's "rise" is not built).
- stay: Yes as the prototype; Not sure "Not sure: PR counts, but no route seals."; No "No: PR stops counting; cost and career lead."
- settle: "Settle long-term: noted; it shapes what we show you later." / "Come home eventually: noted; it shapes what we show you later."
- Any question answered "Not sure" → `notSureLine(key)` for that question takes the item's line.

**`coins.ts`**
```ts
export const COINS_TOTAL = 10
export const MAX_PER_PILE = 5
export const NOT_SURE_SPREAD = [2, 1, 1, 2, 1, 1, 1, 1] as const     // the design's even spread (r5-model.js LIFE_UNSURE)
export function placed(piles: readonly number[]): number
export function addCoin(piles: readonly number[], index: number): number[]      // unchanged when the pile has 5 or all 10 are placed
export function removeCoin(piles: readonly number[], index: number): number[]   // unchanged at 0
export function canFinish(piles: readonly number[]): boolean                     // exactly 10 placed
export function coinLine(index: number, count: number): string                   // `${LIFE_VALUES[index]} at ${count}: ${text}.`
export const COINS_INTRO = 'These ten coins are your attention, time and energy for the next few years. Where do they go?'
export const COINS_HINT = 'Tap + to place a coin. Coins shape what we show you later; they never change your routes.'
export const COINS_ASSUMED = 'Assumed: an even spread. You can change it any time.'
```
`coinLine` texts by tier (1 coin / 2–3 / 4–5; 0 → "nothing changes"), DS-R7-safe (open question 10's default: no line claims a route or city moves):
Health: sleep and exercise get a mention on busy weeks / we'll point out long commutes and heavy workloads when they come up / your health comes first in what we remind you of · Social life: clubs and events show in your feed now and then / we'll mention student communities on each route / we'll keep people and events in front of you · Financial life: money basics appear on every route / money tips and part-time ideas show in your feed / we'll check in about money every month · Learning and growth: short reads for your next step show in your feed / we'll point out placements and tasters when they come up / stretch reading and research pathways show in your feed · Closeness to family: call-time tips appear in your feed / we'll show trip times home on each route / we'll remind you of family dates · Community and relatives nearby: community events show now and then / we'll show community size on each city / community events and groups show in your feed · Independence: tips on living alone show in your feed / own-room costs show on every route / we'll help you plan living on your own · Adventure: weekend ideas show now and then / we'll mention what's nearby to explore / new places and trips show in your feed.

- [ ] Step 1: write the failing tests.
  - `impact.test.ts`: `impactLine('where', { where: s('Australia (on a visa)') }, null)` differs from the Nepal line and contains "onshore"; `impactLine('dep', { dep: s('Partner') }, null)` → the family line; `impactLine('dest', { dest: s('Open to others') }, null)` → the Australia-only line; `impactLine('budget', { amount: s(24), hard: s('Hard limit') }, null)` starts "Hard limit at 24k:" and names Sydney among what seals; `impactLine('budget', { amount: notSure }, null)` → `notSureLine('amount')` = "Not sure: I'll assume “AUD 30k” and show it as a chip you can change."; the relative line for Anjali in Cannington contains "Every route shows its distance from Anjali."; `impactLine('budget', {}, null)` → null. (`s(v)` = `{ value: v, state: 'stated' }`.)
  - `coins.test.ts`: `addCoin([5,0,0,0,0,0,0,0], 0)` unchanged; ten coins placed → `addCoin` unchanged anywhere; `removeCoin` at 0 unchanged; `canFinish` true only at exactly 10; `NOT_SURE_SPREAD` sums to 10 with no pile above 5; `coinLine(4, 3)` → "Closeness to family at 3: we'll show trip times home on each route."; `coinLine(0, 0)` → "Health at 0: nothing changes."; no `coinLine(i, n)` for any i and n in 0..5 matches `/\b(rise|rises|lead|leads|seal|rank|sort)\b/`.
- [ ] Step 2: run them — `bun test src/features/opening/model`; expected: FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: run them; expected: PASS. `bun run type-check`; expected: PASS.
- [ ] Step 5: leave the change in the working tree.

## Task 10: Landing, resume and the picture question
**Delivers:** criteria 14, 15, 60, 61 (landing).
**Files:** create `src/features/opening/model/landing.ts`, `src/features/opening/model/landing.test.ts`, `src/features/opening/components/PictureQuestion.tsx`, `src/features/opening/components/PictureQuestion.test.tsx`, `src/app/(app)/picture/page.tsx`; modify `src/app/(app)/start/page.tsx` (replace Task 3's placeholder).
**Kind:** judgement.

```ts
// landing.ts (pure)
export function landingPath(p: Pick<Profile, 'persona' | 'lastStep' | 'seenFutures'>): string
//   persona null → '/picture'; seenFutures → '/futures'; lastStep in OPENING_STEPS → `/opening/${lastStep}`;
//   lastStep 'futures' or 'attention' → '/futures'; otherwise ('picture') → '/opening/facts'
```
- `start/page.tsx`: `requireStudent()`, `getProfile(user.id)`, `redirect(landingPath(profile))`.
- `picture/page.tsx`: `requireStudent()`; persona already set → `redirect('/start')`; else render the hero of Task 4 (same band, heading "From off course to “Of Course!”") and `<PictureQuestion />`.
- `PictureQuestion` (client), frame `r10a-1.png` / `r10a-2.png`: overline "Optional · one tap", heading "How should we picture you?", line "Used only to pick the character in your comics. Nothing else reads it. Skip it and the character is neutral.", three toggle buttons (`aria-pressed`) Male / Female / Prefer not to say, then "Skip" (outline) and "Start" (primary). Start saves the choice (`male`, `female`; "Prefer not to say" or nothing chosen → `neutral`) with `savePersonaAction`; Skip saves `neutral`. Then it shows "You're in. The first screen opens in a moment." and "Your comic character is {male|female|neutral}." (open question 10's default: no profile clause) and calls `router.push('/opening/facts')` straight away. A failed save shows the action's error (role="alert") and stays.
- Nothing reads the Google name or photo for the character: the profile's persona stays null until this screen saves (criterion 15).

- [ ] Step 1: write the failing tests — `landing.test.ts`: the five branches above (`{ persona: null, … }` → '/picture'; `{ persona: 'neutral', lastStep: 'picture', seenFutures: false }` → '/opening/facts'; lastStep 'living' → '/opening/living'; seenFutures true with lastStep 'living' → '/futures'; lastStep 'attention' → '/futures'). `PictureQuestion.test.tsx` (mock `../actions` and `next/navigation`): Start with nothing chosen calls `savePersonaAction('neutral')` and `push('/opening/facts')`; Female then Start → `'female'`; Prefer not to say → `'neutral'`; Skip → `'neutral'`; after saving "You're in. The first screen opens in a moment." is shown; `{ ok: false, error: 'Please sign in again.' }` shows that error and does not navigate.
- [ ] Step 2: run them — `bun test src/features/opening/model/landing.test.ts src/features/opening/components/PictureQuestion.test.tsx`; expected: FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: run them; expected: PASS. `bun run type-check`; expected: PASS.
- [ ] Step 5: leave the change in the working tree.

## Task 11: Screens 1–4
**Delivers:** criteria 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32 (capture), 33 (capture).
**Files:** create `src/app/(app)/opening/[step]/page.tsx`, `src/features/opening/components/OpeningScreen.tsx`, `src/features/opening/components/OpeningScreen.test.tsx`, `src/features/opening/components/RelativeForm.tsx`, `src/features/opening/components/OptionButtons.tsx`, `src/features/opening/components/Hero.tsx`.
**Kind:** judgement.

- `page.tsx`: `const { step } = await params` (a promise, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md:13`); a step not in `OPENING_STEPS` → `notFound()`; `requireStudent()`; `getProfile`; `markStep(user.id, step)`; render `<OpeningScreen screen={SCREENS[i]} answers={profile.answers} relative={profile.relative} />`.
- `Hero` (shared by the opening, futures and coins screens; Task 4's sign-in band can reuse it): the primary band with an overline (`text-overline uppercase`), a title (`font-heading text-h1`) and an optional sub (`text-lead`).
- `OpeningScreen` (client), frames `r1-1..4.png`, desktop `r1-10.png`:
  - Hero: overline "Getting started · step {n} of 6", the screen's title and sub. Under it six progress segments, the first n filled, with `aria-label="Step {n} of 6"`.
  - Each item: its title (`font-heading text-h4`), then each visible question (`isVisible`): its label (`text-caption text-muted-foreground`) and `OptionButtons` — toggle buttons with `aria-pressed` for `chips`, a native `<select>` (label "Where are you right now?") for `select`, toggles allowing up to three for `multi`; a "Not sure" button when `notSure` (in the select, a "Not sure" option). Amount options read "AUD 24k" etc.
  - The impact line under each item: `impactLine(item.id, answers, relative)` in a box with a left accent rule (`border-l-2 border-primary bg-accent-100`), `role="status"`, rendered from local state in the same render as the tap — no request in between (criterion 25).
  - A tap updates local answers (`parseAnswer`) at once and calls `saveAnswersAction({ [key]: raw })` inside `startTransition`; a failed save shows `toast.error(result.error)` (Sonner, as `src/features/admin/hooks/useAdminAction.ts`) and keeps the local value.
  - Screen 3: when `knows` is Yes, `RelativeForm`: "Who, and where?" — a select "City or suburb" listing `PLACES` as "{place}, {city}" plus "Somewhere else" (which reveals a text input "Where?"); relationship toggles from `RELATIONSHIPS` ("They're your…"); "Name (optional)". It saves through `saveRelativeAction` when a place and a relationship are set (the name on blur). Changing `knows` to No saves `null`.
  - Footer: "Back" (a `Link` to the previous step; none on screen 1), the screen's `next` button (a `Link` to the next step, or `/futures` on screen 4), and the line "“Not sure” is fine anywhere. It becomes an assumption you can correct on each future." No composer, no "From what you told us" tags, no "That's right" buttons.
  - Desktop: inside an `@container` (as `src/app/page.tsx:40`), items sit in two columns from about `@min-[48rem]`; one column below.
- [ ] Step 1: write the failing tests — `OpeningScreen.test.tsx` (mock `../actions`; render screen 1 with `answers={}`): the heading "Facts about you" and `getByLabelText('Step 1 of 6')`; pressing "AUD 36k" shows "About AUD 36k a year. Tell me if it's a hard limit." synchronously and calls `saveAnswersAction({ amount: 36 })`; "Not sure" in the budget item shows `notSureLine('amount')`; choosing "Australia (on a visa)" in the select shows a line containing "onshore"; "Partner" shows the family line; screen 3 has no "Do you know anyone who lives in Australia?" until "A little" is pressed, then it appears; pressing Yes shows "Who, and where?"; screen 4's stay question offers exactly Yes, Not sure, No; screen 2's Back links to `/opening/facts` and screen 4's button "Show me three futures" links to `/futures`.
- [ ] Step 2: run them — `bun test src/features/opening/components/OpeningScreen.test.tsx`; expected: FAIL.
- [ ] Step 3: implement (Industry: one filled primary button per screen — the next button; option toggles are outline buttons, pressed ones `bg-accent-200`).
- [ ] Step 4: run them; expected: PASS. `bun run lint`, `bun run type-check`; expected: PASS.
- [ ] Step 5: leave the change in the working tree.

## Task 12: The futures screen
**Delivers:** criteria 2, 3, 34, 35, 36, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 49, 50, 51, 52, 58 (entry), 61 (home).
**Files:** create `src/app/(app)/futures/page.tsx`, `src/features/opening/components/FuturesScreen.tsx`, `src/features/opening/components/FutureCard.tsx`, `src/features/opening/components/ChipEditor.tsx`, `src/features/opening/components/WeightsPlaque.tsx`, `src/features/opening/components/SealedView.tsx`, `src/features/opening/components/FuturesScreen.test.tsx`; modify `src/features/opening/model/questions.ts` (add `editLabel`), `src/features/opening/model/questions.test.ts`.
**Kind:** judgement.

- `questions.ts`: `export function editLabel(key: QuestionKey): string` — the question's label, except amount → "Your budget per year" and field → "What you'd study"; test: `editLabel('amount')` → "Your budget per year", `editLabel('stay')` → "Would you want to stay after?".
- `page.tsx`: `requireStudent()`; `getProfile`; `const initial = buildFutures({ answers, relative })`; `markStep(user.id, 'futures')`; render `<FuturesScreen initialAnswers={…} relative={…} initial={initial} coins={profile.coins} reminders={profile.reminders} returning={profile.seenFutures} />`. The client recomputes with the same `buildFutures`, so the server's and the browser's futures are the same for the same answers (criterion 48).
- `FuturesScreen` (client), frames `r1-5.png`, `r1-6.png`, `p3claims-0..1.png`, `r7d-0.png`, `r8c-2.png`, desktop `r1-11.png`:
  - Hero: overline "Step 5 of 6 · three futures, nothing ranked" (returning: "Your three futures · nothing ranked"), title "Here's what each would give you". Then the duck note (`/brand/duck.png`, alt "") "Here's what each of these would give you and cost you. Tell me what I got wrong." and the weights line "Weighed from your answers, 0–3: Cost 2 · Time 2 · Work 2 · PR 3 · Location 3 · Career 3 · the heavier, the larger it’s drawn" with a button "Your weights" that opens `WeightsPlaque` (the `Sheet` in `src/shared/components/ui/sheet.tsx`): overline "What you're weighing", title "Your weights", line "These shape how lists are sorted. Nothing here says what to do.", one row per dimension with its weight and reason (the design's "flexible on…" half is not built).
  - Notices: each notice's text (`role="status"`) and, when it has a chip, that chip's button (opens `ChipEditor` in place).
  - `FutureCard` per future (no numbers, no order words): overline heading; a "Redrawn: {label}" tag when changed; the route (`font-heading text-h3`); the distance line with a Lucide `House` icon (strokeWidth 1.5); "Strong on what you weight most: {labels}" when `strongOn` is not empty; "Costs you on: {labels}"; then the six lines. A line: overline "{DIM} · ▲ Gives you" / "▼ Costs you" / "● Neutral" (+ " · You weigh this most"), with a left edge drawn solid for gives, dashed for costs and dotted for neutral (shape and word, never colour alone: DS-R4); its text, `text-h4` when `weighMost` and body size otherwise; pips (`●●●○○` with `aria-label="Strength 3 of 5"`) and "{BANDS[pips]} · {state}"; "How we know" (a disclosure button) revealing each `detail` line and "Source: {source} · {date}"; when `claim.notSure`, a dotted box "We're not sure about this yet." (open question 10's default); "Might feel: {feel}" followed by the four feels, the current one filled (`aria-current="true"`); a changed line gets "Changed with your answer" and `bg-accent-100`. Then "What I assumed · tap to correct" and the chips (`chipText`) as buttons; then "Keep options open", "{text}" with its doors in bold, and "Remind me" (→ `addReminderAction({ futureId, courseId, text })`, then a toast "Reminder saved. You'll see it in your feed once it's ready." and the button reads "Reminder set", disabled; it starts that way when `reminders` already has this future and course).
  - `ChipEditor` (in place, under the chip): heading "{editLabel(key)}. All three futures redraw.", the question's options (`OptionButtons`; for field: the four fields and "Suggest me"; amount shows "AUD 24k"…), and "Not sure" when allowed. Choosing applies the change.
  - Applying a change: build the patch (field chips: `{ know: 'Something particular', field: v }`, "Suggest me": `{ know: 'Suggest me' }`), update answers with `parseAnswer`, `next = buildFutures(...)`, `changed = diffFutures(prev, next)`, render — all synchronously, before any request (criterion 50: under 500 ms). Then `saveAnswersAction(patch)` and `toast('Redrawn: {label}', { action: { label: 'Undo', onClick } })` (Sonner) where the label is `chipText` with its first letter lowercased; Undo puts back the previous stored answers (as `StoredAnswer` objects), recomputes and saves them.
  - `SealedView` when `kind === 'sealed'`: "Sealed at your hard limit" (`font-heading text-h3`), "Nothing in this preview fits AUD {b}k a year. The nearest roads:", each nearest route as a card drawn sealed (dashed border, `text-muted-foreground`) reading "{route}" and "AUD {overByK}k over your hard limit", and the budget and hard-limit chips with their editor. Never blank.
  - Footer: "Shown in no order. None of these is a ranking or a pick. Figures are mock." (the design's "recommended" is a forbidden word, criterion 2); coins null → a link button "Next: your attention · optional" to `/attention`; coins `later` → "Spend your ten coins" to `/attention`; spent → nothing; then `<SignOutButton />` (quiet, so testers can switch accounts).
  - Desktop: inside an `@container`, the cards sit in three columns from about `@min-[64rem]`, one column below.
- [ ] Step 1: write the failing tests — `FuturesScreen.test.tsx` (mock `../actions`, `sonner`; Priya's answers and relative from `src/features/engine/fixtures.ts`, created in Task 8): three headings "Built around cost/staying/career"; "Adelaide · Master of Cyber Security, UniSA · 491 regional visa, then PR"; "▲ Gives you" and "▼ Costs you" present; "We're not sure about this yet." present once per card that carries R1; pressing "How we know" on a line shows "Source:"; the chip "Budget about AUD 30k a year" opens "Your budget per year. All three futures redraw."; pressing "AUD 36k" shows "Fees about AUD 27k a year: within your budget, AUD 9k spare", three "Redrawn: budget about AUD 36k a year" tags and at least one "Changed with your answer", and calls `saveAnswersAction({ amount: 36 })`; invoking the toast's Undo brings back "only AUD 3k spare"; "Remind me" calls `addReminderAction` with the future's id and course; the plaque lists "A rough budget: 2"; a sealed result renders "Sealed at your hard limit" and "AUD 3k over your hard limit"; `container.textContent` matches none of `/ranked 1st|\bbest\b|recommended/i`; coins `later` renders "Spend your ten coins".
- [ ] Step 2: run them — `bun test src/features/opening/components/FuturesScreen.test.tsx src/features/opening/model/questions.test.ts`; expected: FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: run them; expected: PASS. `bun run test:run`, `bun run lint`, `bun run type-check`; expected: PASS.
- [ ] Step 5: leave the change in the working tree.

## Task 13: The coins screen and the loader
**Delivers:** criteria 4, 53, 54, 55, 56, 57, 58, 59.
**Files:** create `src/app/(app)/attention/page.tsx`, `src/features/opening/components/CoinsScreen.tsx`, `src/features/opening/components/CoinsScreen.test.tsx`, `src/shared/components/DuckLoader.tsx`, `src/shared/components/DuckLoader.test.tsx`, `src/shared/lib/loader-lines.ts`, `src/app/(app)/loading.tsx`.
**Kind:** judgement.

- `attention/page.tsx`: `requireStudent()`; `getProfile`; `markStep(user.id, 'attention')`; `<CoinsScreen initial={coins?.state === 'spent' ? coins : null} />`.
- `CoinsScreen` (client), frames `r1-7..9.png`: Hero overline "Getting started · step 6 of 6 · optional", title "Your attention", `COINS_INTRO`. A counter "{n} coins left to place" ("1 coin left to place", "All 10 placed"). Eight rows (`LIFE_VALUES`): the name, the count, "−" and "+" buttons with `aria-label="Take a coin from {value}"` / `"Add a coin to {value}"`; "+" disabled at 5 or when ten are placed; "−" disabled at 0. Under the rows one line: `COINS_HINT` at first, `coinLine(i, count)` for the last pile changed, `COINS_ASSUMED` after "Not sure · spread them for me" (which sets `NOT_SURE_SPREAD` and marks the coins assumed until any pile changes). "Start again" empties the piles. "Spend them later" saves `{ state: 'later' }` and goes to `/futures`. "Done" is enabled only when `canFinish`; disabled it reads "Place all ten to finish"; it saves `{ state: 'spent', piles, assumed }` and goes to `/futures`. Coins never touch answers or futures (DS-R7).
- `loader-lines.ts`: `export const LOADER_LINES = ['Drifting is still moving.', "You don't have to see the sea to know it's there.", 'Small paddles, long way.'] as const`, `export const LOADER_TITLE = 'Keep floating.'` (copy in config, ADR-075).
- `DuckLoader` (client), frames `p3load-*.png`: a river band with the duck (`/brand/duck.png`, alt "") drifting left to right and facing right (DS-R9), `LOADER_TITLE` and one line from `LOADER_LINES`, rotating one per mount through `sessionStorage['ofcourse:loader-line']` (try/catch; falls back to the first line). It is invisible for the first 400 ms (a CSS animation that starts at `opacity: 0` and becomes visible after a 400 ms delay, so short waits show nothing), and under `motion-reduce:` the duck does not move. `role="status"`, `aria-label="Loading"`.
- `(app)/loading.tsx`: renders `<DuckLoader />` (Next shows it while a student route loads: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`).
- [ ] Step 1: write the failing tests — `CoinsScreen.test.tsx` (mock `../actions`, `next/navigation`): starts with "10 coins left to place" and "Done" disabled reading "Place all ten to finish"; pressing "Add a coin to Health" five times disables it; a sixth press does nothing; reaching ten disables every "+" and enables "Done"; "Not sure · spread them for me" shows `COINS_ASSUMED` and "All 10 placed"; "Done" calls `saveCoinsAction({ state: 'spent', piles: [2,1,1,2,1,1,1,1], assumed: true })` and `push('/futures')`; "Spend them later" saves `{ state: 'later' }`; after one coin on Closeness to family the line reads "Closeness to family at 1: call-time tips appear in your feed.". `DuckLoader.test.tsx`: renders "Keep floating." and one of `LOADER_LINES`; two mounts show two different lines; with `sessionStorage` throwing it still renders the first line.
- [ ] Step 2: run them — `bun test src/features/opening/components/CoinsScreen.test.tsx src/shared/components/DuckLoader.test.tsx`; expected: FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: run them; expected: PASS. `bun run test:run`, `bun run lint`, `bun run type-check`; expected: PASS.
- [ ] Step 5: leave the change in the working tree.

## Task 14: The student journey, end to end
**Delivers:** the integration proof for criteria 1–4, 14, 15, 22–35, 38–63 in a real browser against the real database.
**Files:** create `e2e/opening.e2e.ts`, `e2e/futures.e2e.ts`, `e2e/coins-and-return.e2e.ts`; modify `e2e/helpers/db.ts` (add `profileOf(email)`: `select persona, answers, relative, coins, reminders, last_step, seen_futures from student_profile p join "user" u on u.id = p.user_id where u.email = ${email}`), `e2e/helpers/student.ts` (add `newStudent(page, label)`: `skipSplash`, `devLogin(page, freshEmail(label), 'E2E Student', { surface: 'student' })`, returns the email; and `answerOpening(page, answers)` that walks screens 1–4 tapping the given options by their visible names).
**Kind:** judgement.

Specs (each test creates its own student and deletes it in `finally`; assertions by role and visible text, as the existing specs):
- `opening.e2e.ts`
  ```ts
  // a new student lands on the picture question; the character is not set from the account
  await page.goto('/'); await expect(page).toHaveURL(/\/picture$/); expect((await profileOf(email))?.persona).toBeNull()
  // Start opens screen 1 within 3 s
  await page.getByRole('button', { name: 'Female' }).click()
  const t0 = Date.now(); await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByRole('heading', { name: 'Facts about you' })).toBeVisible(); expect(Date.now() - t0).toBeLessThan(3000)
  expect((await profileOf(email))?.persona).toBe('female')
  await expect(page.getByLabel('Step 1 of 6')).toBeVisible()
  // an impact line within 300 ms of a tap
  await page.getByRole('button', { name: 'AUD 36k' }).click()
  await expect(page.getByText('About AUD 36k a year. Tell me if it\'s a hard limit.')).toBeVisible({ timeout: 300 })
  // onshore and offshore read differently; Not sure becomes an assumption; Partner says family isn't covered
  // Back keeps answers; screen 3 shows "Do you know anyone…" only after community; Yes opens the relative form (Cannington, Cousin, Anjali)
  // Open to others says only Australia is covered; screen 4 offers Yes / Not sure / No; "Show me three futures" → /futures
  ```
  Run once at 390 × 844 and once at 1280 × 800 (a `for` over the two sizes, or two tests).
- `futures.e2e.ts` (answer as Priya with `answerOpening`, then on `/futures`):
  ```ts
  for (const h of ['Built around cost', 'Built around staying', 'Built around career']) await expect(page.getByText(h)).toBeVisible()
  await expect(page.getByText('Adelaide: a 3½-hour flight from Anjali in Perth · estimate')).toBeVisible()
  await expect(page.getByText(/^ECU Joondalup: about \d+ min from Anjali in Cannington · estimate$/)).toBeVisible()
  await expect(page.getByText('▲ Gives you').first()).toBeVisible()
  await expect(page.getByText("We're not sure about this yet.").first()).toBeVisible()
  // How we know reveals a source; PR shows no percentage; the plaque lists the reasons; Remind me stores one reminder (profileOf)
  // the page has none of the forbidden words and no internal names; the title says OfCourse; "mock" appears
  const text = await page.locator('body').innerText()
  expect(text).not.toMatch(/ranked 1st|\bbest\b|recommended/i); expect(text).not.toMatch(/Heubert|Expert|\bEdge\b|\bCRM\b/)
  await expect(page).toHaveTitle(/OfCourse/)
  // the redraw: within 500 ms of choosing, changed rows marked, saved as stated; Undo restores
  await page.getByRole('button', { name: 'Budget about AUD 36k a year' }).first().click()
  await expect(page.getByText('Your budget per year. All three futures redraw.')).toBeVisible()
  await page.getByRole('button', { name: 'AUD 42k' }).click()
  await expect(page.getByText(/^Redrawn: budget about AUD 42k a year$/).first()).toBeVisible({ timeout: 500 })
  await expect(page.getByText('Changed with your answer').first()).toBeVisible()
  expect((await profileOf(email))?.answers.amount).toEqual({ value: 42, state: 'stated' })
  // Undo (the toast's button) brings the 36k lines back
  // field chip → Data science changes the routes; hard limit 30 → one future and the "Only one route fits" notice;
  // hard limit 24 → "Sealed at your hard limit" with "over your hard limit" routes; stay No → "PR doesn't count here";
  // areas Health → "No health courses in this preview, so these use psychology."; reload → the same three routes
  ```
- `coins-and-return.e2e.ts`
  ```ts
  // coins: Next: your attention → /attention; a sixth coin on one pile is refused; Done needs exactly ten; Done → /futures, coins saved;
  // Not sure spreads them and says "Assumed: an even spread."; Spend them later → /futures shows "Spend your ten coins"
  // the futures' text is the same before and after spending coins
  // coming back: leave on screen 2 → a new context signs in as the same student → / lands on /opening/study with screen 1's answers kept
  // after the futures were seen → / lands on /futures; go Back to screen 1, change the budget, return → the futures show the new budget
  // a second device (another context, same email) shows the same answers and futures
  ```
- [ ] Step 1: write the specs above.
- [ ] Step 2: run them before the rest of the plan's tasks are finished only if useful; at this point, after Tasks 1–13, run `bun run test:e2e -- e2e/opening.e2e.ts e2e/futures.e2e.ts e2e/coins-and-return.e2e.ts`; expected: PASS. A failure here is a bug in Tasks 3–13 or in the spec: fix the cause, not the assertion, unless the assertion contradicts the intent.
- [ ] Step 3: run the whole e2e suite — `bun run test:e2e`; expected: PASS (the starter's specs updated in Tasks 3–4 included).
- [ ] Step 4: run everything else — `bun run test:run`, `DB_TESTS=1 DATABASE_URL=postgres://app:app@127.0.0.1:5433/app bun test src/shared/lib/auth/hooks.test.ts src/features/opening/server src/features/admin/users src/shared/lib/presence-server.test.ts`, `bun run lint`, `bun run type-check`, `bun run build`; expected: PASS.
- [ ] Step 5: leave the change in the working tree.

## Integration

The boundary-crossing criteria are proven at two levels:
- **Database tests** (Better Auth's real hooks and endpoints, the real tables): `DB_TESTS=1 DATABASE_URL=postgres://app:app@127.0.0.1:5433/app bun test src/shared/lib/auth/hooks.test.ts src/features/opening/server` — surfaces, refusals, first account, email codes (send, verify, wrong, expired, locked, resend), linking by address, the profile repository.
- **Playwright** (`bun run test:e2e`; it starts `bun run dev` on 3000 with its own `DEV_LOGIN_SECRET`, or reuses a running server that has the same secret): `e2e/admin-sign-in.e2e.ts`, `e2e/student-sign-in.e2e.ts`, `e2e/opening.e2e.ts`, `e2e/futures.e2e.ts`, `e2e/coins-and-return.e2e.ts`, plus the starter's specs updated for the new paths.
Before the e2e run, the migration must be applied (Task 5) and Postgres up (`bun run db:up`).

## Criteria coverage

| Criterion | Task | Test that proves it |
| --- | --- | --- |
| 1 OfCourse, no internal names | 3, 14 | `futures.e2e.ts` (title, body text) |
| 2 no forbidden words, no "already has" copy | 12, 14 | `FuturesScreen.test.tsx` textContent; `futures.e2e.ts` body text |
| 3 figures sourced or mock | 7, 12, 14 | `catalogue.test.ts` (every claim sourced); `futures.e2e.ts` ("mock" present, "How we know" source) |
| 4 loader over 400 ms | 13 | `DuckLoader.test.tsx` (lines, rotation); the 400 ms delay is CSS — Not automatable reliably end to end: depends on server timing |
| 5 splash once per visit, reduced motion | 4 | `Splash.test.tsx`; `student-sign-in.e2e.ts` |
| 6 student page offers Google and email | 4 | `student-sign-in.e2e.ts` (phone and desktop) |
| 7 Google sign-up creates a student | 2 | `hooks.test.ts` student surface → role user (the Google consent screen itself is Not automatable: it cannot run in tests) |
| 8 code sent, code step shown | 4 | `StudentSignIn.test.tsx`; `student-sign-in.e2e.ts` |
| 9 latest code signs in, new account is a student | 2, 4 | `hooks.test.ts` (signInEmailOTP); `student-sign-in.e2e.ts` |
| 10 expired code | 2, 4 | `hooks.test.ts` (OTP_EXPIRED); `student-sign-in.e2e.ts` (expireSignInCode) |
| 11 wrong code, five wrong | 2, 4 | `hooks.test.ts` (TOO_MANY_ATTEMPTS); `StudentSignIn.test.tsx`; `student-sign-in.e2e.ts` |
| 12 30-second resend, new code cancels old | 2, 4 | `hooks.test.ts` (CODE_RECENTLY_SENT, old code refused); `StudentSignIn.test.tsx`; `student-sign-in.e2e.ts` |
| 13 same address, one account | 2 | `hooks.test.ts` (student-page user then code sign-in → same id); Google-then-code linking rests on Better Auth's implicit linking (`link-account.mjs:136-139`) — the Google leg is Not automatable |
| 14 picture question, screen 1 within 3 s | 10, 14 | `PictureQuestion.test.tsx`; `opening.e2e.ts` (timed) |
| 15 nothing from Google name or photo | 10, 14 | `opening.e2e.ts` (persona null before the question) |
| 16 admin refused on the student page | 1, 2, 4 | `access.test.ts`; `hooks.test.ts`; `admin-sign-in.e2e.ts` (dev login student surface → 403); `student-sign-in.e2e.ts` (admin with a code → message) |
| 17 admin page Google only | 3 | `admin-sign-in.e2e.ts` |
| 18 user refused on the admin page | 1, 2, 3 | `access.test.ts`; `hooks.test.ts`; `admin-sign-in.e2e.ts` |
| 19 new address without a waiting role refused on the admin page | 1, 2, 3 | `access.test.ts`; `hooks.test.ts` (nothing created); `admin-sign-in.e2e.ts` |
| 20 first account only via the admin page | 1, 2 | `access.test.ts`; `hooks.test.ts` (student first account → user; the empty-table admin case runs only on an empty database, as today) |
| 21 suspended student | 2, 4 | `hooks.test.ts` (existing suspended case); `student-sign-in.e2e.ts` |
| 22 six progress dots | 11 | `OpeningScreen.test.tsx`; `opening.e2e.ts` |
| 23 screen 1 questions | 6, 11 | `questions.test.ts`; `OpeningScreen.test.tsx` |
| 24 onshore vs offshore | 9, 11 | `impact.test.ts`; `OpeningScreen.test.tsx`; `opening.e2e.ts` |
| 25 impact within 300 ms | 11, 14 | `OpeningScreen.test.tsx` (same render); `opening.e2e.ts` (timeout 300) |
| 26 Not sure → assumed, chip | 6, 9, 12 | `questions.test.ts`; `impact.test.ts`; `FuturesScreen.test.tsx` ("Assumed:") |
| 27 dependants recorded, family line | 9, 11 | `impact.test.ts`; `OpeningScreen.test.tsx`; `opening.e2e.ts` |
| 28 Open to others | 8, 9 | `impact.test.ts`; `futures.test.ts`; `opening.e2e.ts` |
| 29 stay yes / not sure / no | 6, 11 | `questions.test.ts`; `OpeningScreen.test.tsx` |
| 30 Back keeps answers | 11, 14 | `OpeningScreen.test.tsx` (links); `opening.e2e.ts` |
| 31 relatives question appears after community | 6, 11 | `questions.test.ts`; `OpeningScreen.test.tsx`; `opening.e2e.ts` |
| 32 distance lines | 7, 8, 14 | `geo.test.ts`; `futures.test.ts`; `futures.e2e.ts` |
| 33 promise line | 7 | `geo.test.ts` |
| 34 up to three futures, no order | 8, 12 | `futures.test.ts`; `FuturesScreen.test.tsx`; `futures.e2e.ts` |
| 35 marks by shape and word, weighted larger | 8, 12 | `futures.test.ts` (weighMost); `FuturesScreen.test.tsx`; `futures.e2e.ts` |
| 36 Might feel incl. the Cost rule | 8 | `feel.test.ts`; `futures.test.ts` |
| 37 hard limit never exceeded | 8 | `futures.test.ts` (hard 30) |
| 38 pips, state, source on tap | 12 | `FuturesScreen.test.tsx`; `futures.e2e.ts` |
| 39 R1 not sure | 7, 8, 12 | `catalogue.test.ts`; `futures.test.ts`; `futures.e2e.ts` |
| 40 PR as a band | 7, 14 | `catalogue.test.ts` (no PR line holds a percentage); `futures.e2e.ts` |
| 41 chips with Assumed, keep-open with Remind me | 6, 8, 12 | `questions.test.ts` (chipText); `FuturesScreen.test.tsx` |
| 42 Remind me saved | 6, 12, 14 | `actions.test.ts`; `FuturesScreen.test.tsx`; `futures.e2e.ts` (profileOf) |
| 43 weights plaque | 7, 12 | `weights.test.ts`; `FuturesScreen.test.tsx`; `futures.e2e.ts` |
| 44 field not covered | 8, 14 | `futures.test.ts`; `futures.e2e.ts` |
| 45 fewer than three | 8, 14 | `futures.test.ts`; `futures.e2e.ts` |
| 46 all sealed | 8, 12, 14 | `futures.test.ts`; `FuturesScreen.test.tsx`; `futures.e2e.ts` |
| 47 stay No | 7, 8, 14 | `weights.test.ts`; `futures.test.ts`; `futures.e2e.ts` |
| 48 same answers, same futures | 8, 14 | `futures.test.ts`; `futures.e2e.ts` (reload) |
| 49 chip opens its options in place | 12, 14 | `FuturesScreen.test.tsx`; `futures.e2e.ts` |
| 50 redraw within 500 ms, marked, saved | 8, 12, 14 | `futures.test.ts` (diff); `FuturesScreen.test.tsx`; `futures.e2e.ts` (timeout 500, profileOf) |
| 51 Undo | 12, 14 | `FuturesScreen.test.tsx`; `futures.e2e.ts` |
| 52 field or level changes the routes | 8, 14 | `futures.test.ts`; `futures.e2e.ts` |
| 53 ten coins, eight empty piles | 9, 13 | `coins.test.ts`; `CoinsScreen.test.tsx` |
| 54 at most five a pile | 9, 13 | `coins.test.ts`; `CoinsScreen.test.tsx`; `coins-and-return.e2e.ts` |
| 55 finish only at ten | 9, 13 | `coins.test.ts`; `CoinsScreen.test.tsx`; `coins-and-return.e2e.ts` |
| 56 one line per coin | 9, 13 | `coins.test.ts`; `CoinsScreen.test.tsx` |
| 57 Not sure spread | 9, 13 | `coins.test.ts`; `CoinsScreen.test.tsx`; `coins-and-return.e2e.ts` |
| 58 Spend them later | 12, 13 | `FuturesScreen.test.tsx`; `CoinsScreen.test.tsx`; `coins-and-return.e2e.ts` |
| 59 coins never change futures | 8, 14 | `futures.ts` takes no coins (type-level); `coins-and-return.e2e.ts` |
| 60 resume partway | 10, 14 | `landing.test.ts`; `coins-and-return.e2e.ts` |
| 61 futures as home | 10, 14 | `landing.test.ts`; `coins-and-return.e2e.ts` |
| 62 Back from futures redraws | 11, 12, 14 | `coins-and-return.e2e.ts` |
| 63 second device | 5, 14 | `profile.test.ts` (database); `coins-and-return.e2e.ts` |
