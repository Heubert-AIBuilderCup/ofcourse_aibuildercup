# Student opening and three futures — Code Review

**Request changes.** 1 CRITICAL · 4 HIGH · 6 MEDIUM · 8 LOW

| | |
| --- | --- |
| Blocking | CRITICAL `engine/catalogue.ts:289` R1 "not sure" is on the Adelaide claim, not Perth (criterion 39) |
| | HIGH `engine/futures.ts:80` most "Not sure" answers never become a chip (criteria 26, 41) |
| | HIGH `opening/model/impact.ts:105` mock figures in impact lines carry no label (criterion 3) |
| | HIGH `opening/components/FuturesScreen.tsx:186` screen 5 has no progress dots (criterion 22) |
| | HIGH `engine/futures.ts:12` engine and opening import each other's internals; shared schema imports a feature |
| Branch | `feat/student-opening-build` at `36ffb90` + uncommitted working tree, over `main` · 105 files, +11,113 −426 · 6 Oct 2026 |
| Reviewed against | security · security-web · performance · CLAUDE.md + AGENTS.md · Industry `DESIGN.md` · `vercel-react-best-practices (SKILL.md)` · `tailwind-v4-best-practices (SKILL.md)` · `fdd-architecture (SKILL.md)` |
| Scans | secrets clean · dependencies 0 new, 2 already on main · code clean (semgrep scanned only the 4 renamed admin files; the new files were not scanned) |
| Not applicable | `security-llm.md` (no model calls) · `vercel-composition-patterns` (not on the dispatch's list) |
| Failed to load | none |
| Read outside the diff | 10, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | B | MEDIUM · `opening/actions.ts:109` · reminder not checked | Check the reminder against the catalogue |
| Performance | B | MEDIUM · `opening/server/profile.ts:91` · reminders grow without limit | Cap and dedupe the reminders |
| CLAUDE.md, AGENTS.md, DESIGN.md | A | LOW · `opening/actions.ts:41` · an action can throw | optional |
| vercel-react-best-practices | A | — | — |
| tailwind-v4-best-practices | A | LOW · `CoinsScreen.tsx:40` · arbitrary gradient | optional |
| fdd-architecture | C | HIGH · `engine/futures.ts:12` · feature cycle | Public `index.ts` and one owner for the contract |
| Quality | B | MEDIUM · `OpeningScreen.tsx:32` · repeated UI | One button variant, one Progress component |
| Criteria | C | CRITICAL · `catalogue.ts:289` · R1 on the wrong claim | Fix 39, then 3, 22, 26 and 41 |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | OfCourse; no internal names | `e2e/futures.e2e.ts:72` | covered (futures page only) |
| 2 | No ranking words or "already has" copy | `e2e/futures.e2e.ts:72`, `FuturesScreen.test.tsx:148` | covered |
| 3 | Every figure sourced or labelled mock | `catalogue.test.ts:276` | partly met: impact-line figures are unlabelled |
| 4 | Duck loader after about 400 ms | `DuckLoader.test.tsx` | covered; the timing can't be automated |
| 5 | Splash once a visit; reduced motion | `Splash.test.tsx`, `e2e/student-sign-in.e2e.ts:186`, `e2e/sign-in.e2e.ts:16` | covered |
| 6 | Google and email offered | `e2e/student-sign-in.e2e.ts:36` | covered |
| 7 | Google sign-up makes a user | `hooks.test.ts:250` | covered at the hooks; Google itself can't be automated |
| 8 | Code sent; code step shown | `StudentSignIn.test.tsx`, `e2e/student-sign-in.e2e.ts:49` | covered |
| 9 | Latest code signs in as a user | `hooks.test.ts:313`, `e2e/student-sign-in.e2e.ts:49` | covered |
| 10 | Expired code | `hooks.test.ts:362`, `e2e/student-sign-in.e2e.ts:84` | covered |
| 11 | Wrong code; fifth wrong voids it | `hooks.test.ts:347`, `e2e/student-sign-in.e2e.ts:65` | covered |
| 12 | 30 s resend; old code dies | `hooks.test.ts:323,330`, `e2e/student-sign-in.e2e.ts:108` | covered |
| 13 | Google and code share one account | `hooks.test.ts:396` | covered one way; the Google leg can't be automated |
| 14 | Picture question; screen 1 within 3 s | `e2e/opening.e2e.ts:29` | covered |
| 15 | Name and photo don't set the character | `e2e/opening.e2e.ts:27` | covered |
| 16 | Admin refused on student page | `e2e/admin-sign-in.e2e.ts:50`, `e2e/student-sign-in.e2e.ts:139` | covered |
| 17 | Admin page is Google only | `e2e/admin-sign-in.e2e.ts:10` | covered |
| 18 | User refused on admin page | `e2e/admin-sign-in.e2e.ts:37`, `hooks.test.ts:290` | covered |
| 19 | New address refused on admin page | `e2e/admin-sign-in.e2e.ts:42`, `hooks.test.ts:264` | covered |
| 20 | First account superadmin only on admin page | `hooks.test.ts:177,189` | covered (runs only on an empty database) |
| 21 | Suspended student lands on /suspended | `e2e/student-sign-in.e2e.ts:168`, `gate.test.ts` | covered |
| 22 | Six progress dots on screens 1–6 | `OpeningScreen.test.tsx:66`, `e2e/opening.e2e.ts:36` | partly met: missing on screen 5 |
| 23 | Screen 1 questions | `questions.test.ts:38`, `OpeningScreen.test.tsx:74` | covered |
| 24 | Onshore line differs | `e2e/opening.e2e.ts:44` | covered |
| 25 | Impact line within 300 ms | `e2e/opening.e2e.ts:38` | covered |
| 26 | Not sure: assumed, said, shown as a chip | `e2e/opening.e2e.ts:56,151` | partly met: most questions get no chip |
| 27 | Dependants saved; no form | `e2e/opening.e2e.ts:65` | covered |
| 28 | Open to others; futures Australian | `e2e/opening.e2e.ts:126` | covered |
| 29 | Stay: yes, not sure, no | `e2e/opening.e2e.ts:134` | covered |
| 30 | Back keeps answers | `e2e/opening.e2e.ts:77`, `e2e/coins-and-return.e2e.ts:95` | covered |
| 31 | Relatives question after community | `e2e/opening.e2e.ts:95` | covered |
| 32 | Distance line per future | `e2e/futures.e2e.ts:30`, `geo.test.ts:73,80` | covered |
| 33 | Promise line for an unknown place | `geo.test.ts:97` | covered |
| 34 | Three futures, not ranked | `e2e/futures.e2e.ts:20`, `futures.test.ts:76` | covered |
| 35 | Marked lines; heaviest drawn larger | `FuturesScreen.test.tsx:111`, `futures.test.ts:166` | covered |
| 36 | "Might feel" rules | `feel.test.ts` | covered |
| 37 | Hard limit never exceeded | `futures.test.ts:233` | covered |
| 38 | Pips, state, source on tap | `e2e/futures.e2e.ts:39` | covered |
| 39 | Perth job-market claim (R1) "not sure" | `catalogue.test.ts:284` (asserts the Adelaide claims) | contradicted |
| 40 | PR shown as a band | `e2e/futures.e2e.ts:43`, `catalogue.test.ts:297` | covered |
| 41 | Chips list what the future rests on; keep-open | `FuturesScreen.test.tsx:160` | partly met: chip list is fixed |
| 42 | Remind me confirms | `e2e/futures.e2e.ts:63` | covered |
| 43 | Weights plaque | `e2e/futures.e2e.ts:48`, `weights.test.ts` | covered |
| 44 | Uncovered field: each card says so | `e2e/futures.e2e.ts:151` | done differently: said once above the cards |
| 45 | Fewer than three, says why | `e2e/futures.e2e.ts:123` | covered |
| 46 | All sealed: nearest routes | `e2e/futures.e2e.ts:127` | covered |
| 47 | Stay No: PR 0, neutral | `e2e/futures.e2e.ts:137` | covered |
| 48 | Same answers, same futures | `e2e/futures.e2e.ts:157`, `futures.test.ts:190` | covered |
| 49 | Chip opens in place | `e2e/futures.e2e.ts:78` | covered |
| 50 | Redraw within 500 ms, marked, saved | `e2e/futures.e2e.ts:78` | covered |
| 51 | Undo | `e2e/futures.e2e.ts:91` | covered |
| 52 | Field or level changes routes | `e2e/futures.e2e.ts:112`, `futures.test.ts:390,401` | covered |
| 53 | Ten coins, eight piles | `CoinsScreen.test.tsx:35,46` | covered |
| 54 | Fifth coin is the limit | `e2e/coins-and-return.e2e.ts:43` | covered |
| 55 | Finish only at ten | `e2e/coins-and-return.e2e.ts:47` | covered |
| 56 | One line per coin | `e2e/coins-and-return.e2e.ts:39` | covered |
| 57 | Not sure spreads, assumed | `e2e/coins-and-return.e2e.ts:72` | covered |
| 58 | Spend later; entry on futures | `e2e/coins-and-return.e2e.ts:79` | covered |
| 59 | Coins never change futures | `e2e/coins-and-return.e2e.ts:59` | covered |
| 60 | Resume partway | `e2e/coins-and-return.e2e.ts:95` | covered |
| 61 | Futures as home | `e2e/coins-and-return.e2e.ts:126` | covered |
| 62 | Back from futures redraws | `e2e/coins-and-return.e2e.ts:147` | covered |
| 63 | Second device | `e2e/coins-and-return.e2e.ts:138` | covered |

How the criteria are graded: CRITICAL where the build does the opposite of what a criterion says (39); HIGH where part of a criterion is not built (3, 22, 26, 41). Criterion 44 is MEDIUM: the content is there, but in a different place.

## Read outside the diff
- `src/shared/lib/auth/session.ts:17` — `getSession` returns null for a suspended account, so the student actions refuse suspended students.
- `node_modules/better-auth/dist/api/state/oauth.mjs:13` — `serverContext` is per-request server state, and the client cannot spoof it.
- `node_modules/better-auth/dist/oauth2/state.mjs:46`, `api/routes/callback.mjs:77,172` — the state is parsed before `handleOAuthUserInfo`, so the surface reaches the user and session hooks on the Google callback.
- `node_modules/better-auth/dist/plugins/email-otp/routes.mjs:35` — the send endpoint also accepts other code types, which the 30 s guard skips (LOW below). Change-email is off. A password reset can't lead to a sign-in, because password sign-in is off.
- `src/shared/lib/auth/index.ts:89` — no `emailAndPassword`. Any session path that isn't Google or a code falls back to the student page, which grants the least.
- `src/features/admin/index.ts` — the repo's own example of a feature's public API.
- `src/shared/components/Providers.tsx:27` — `useThemeChoice` has had no caller since `ThemeChoice` was deleted.
- `README.md:18,43` — still describes `/dashboard`.
- `Hackathon Handoff/HACKATHON-build-handover.md` — confirms that register item R1 is the Perth job market.
- `next.config.ts` — no `cacheComponents`. Link prefetch stops at `(app)/loading.tsx`, so rendering a page doesn't run `markStep` early.

## Findings, by file

### `src/features/engine/catalogue.ts`

**CRITICAL · line 289 · criterion 39 contradicted**
- What: "Not sure" is set on the Adelaide (UniSA) job-market claim. Every Perth job-market claim (ECU, Curtin, TAFE: "Perth IT job market: ~3,400 postings") has `notSure: false`.
- Why: Criterion 39 and open question 10 put the mark on R1, the Perth job market, and the handover confirms that R1 is Perth. The research-agent demo turns exactly that claim from "not sure" to known.
- Rule: intent criterion 39 · a test would have caught it: yes, but `catalogue.test.ts:284` asserts the Adelaide claims, so the test follows the code rather than the intent.
- Fix: Move `notSure: true` to the Perth job-market claims and clear it on UniSA. Update `catalogue.test.ts:201,284` and `FuturesScreen.test.tsx:119` to name Perth.

### `src/features/engine/futures.ts`

**HIGH · line 80 · criteria 26 and 41 partly unbuilt**
- What: `FUTURE_CHIPS` is a fixed list (amount, hard, place, field, latest, stay, earn, level, dest). For any other question, a "Not sure" never becomes a chip, including `covers`, `focus`, `learn`, `community`, `who` and `length`, which the engine reads. Meanwhile `notSureLine` (`impact.ts:21`) tells her "I'll … show it as a chip you can change".
- Why: She is promised a chip she can correct, and her futures rest on an assumption she can't see. Criterion 26 says "any question", and criterion 41 says "the answers that future rests on".
- Rule: intent criteria 26 and 41 · a test would have caught it: yes, with a "Not sure" on `focus` followed by a check for its chip. The e2e only checks the budget.
- Fix: Build each future's chips from the fixed keys plus every assumed answer the engine reads. If that's too much, change `notSureLine` for keys with no chip, and get the intent owner to narrow criterion 26.

**HIGH · line 12 · architectural boundary**
- What: The engine imports `@/features/opening/model/questions` and `profile`, while opening imports `@/features/engine/*`. Neither feature has an `index.ts`. `src/shared/lib/db/schema.ts:19` (shared) imports `@/features/opening/model/profile`.
- Why: Two features depend on each other's internals, and shared code depends on a feature. That is the cycle the FDD public-API rule exists to prevent, and the repo already follows the rule in `features/admin/index.ts`.
- Rule: `fdd-architecture` §2 Public API boundary, §5 Shared infrastructure · a test would have caught it: no, a lint rule (`no-restricted-imports`) would.
- Fix: Give the answer contract (`profile.ts`, `DEFAULTS`, `effective`, `isAssumed`) a single owner: the engine's input type, or `src/shared/types`. Then add `index.ts` to engine and opening, and import only through those.

### `src/features/opening/components/FuturesScreen.tsx`

**HIGH · line 186 · criterion 22 partly unbuilt**
- What: Screen 5 shows "Step 5 of 6" in the overline but has no progress dots. On a return visit even that text goes. Screens 1–4 and 6 do have dots.
- Why: Criterion 22 asks for six dots on every screen from 1 to 6.
- Rule: intent criterion 22 · a test would have caught it: yes, but nothing checks for a `progressbar` on `/futures`.
- Fix: Render the shared Progress at step 5 under the Hero, and add an assertion to `FuturesScreen.test.tsx`.

**MEDIUM · line 207 · criterion 44 done differently**
- What: The note "No health courses in this preview, so these use psychology." appears once, above the cards. The criterion says each card says so.
- Why: The wording departs from the contract. A tester who reads one card at a time on a phone won't see the note.
- Rule: intent criterion 44 · a test would have caught it: no, `e2e/futures.e2e.ts:151` asserts that the note appears exactly once.
- Fix: Put the field-substituted note on each `FutureCard` (keep the chip), or record the intent owner's acceptance in the intent's Changes.

### `src/features/opening/model/impact.ts`

**HIGH · line 105 · criterion 3 partly unbuilt**
- What: "Latest Feb 2027: 3 intakes open." is a mock count with no source, data state or "mock" label. The same goes for "IELTS 6.0: some courses ask for 6.5." (line 113).
- Why: Criterion 3 and the Data constraint require every figure in an impact line to carry a source and state, or a "mock" label.
- Rule: intent criterion 3 (DS-R5) · a test would have caught it: yes, with a test that every impact line containing a digit also contains "mock" or "estimate".
- Fix: Append "· mock" (or the catalogue claim's source) to lines with figures, and add that test over all options.

**MEDIUM · lines 126, 131, 186, 228–259 · copy promises unbuilt behaviour**
- What: Several lines describe behaviour the engine doesn't have: "courses with work-integrated learning rise", "city campuses rise", "research-led courses and PhD pathways rise", "cost and career lead", "offered later, from your profile", "type or pick the field" and "community size shows on each city". Nothing ranks, nothing reads community size, there is no profile and there is no typed field.
- Why: Testers on 8 Oct will look for effects that never happen. The plan's own rule for this port was to keep the prototype's wording "except where it promises something this slice does not do".
- Rule: plan Task 9 and open question 10's principle · a test would have caught it: partly; `coins.test.ts` already bans `rise|lead`, but `impact.test.ts` asserts the promising lines verbatim.
- Fix: Rewrite each line to say what it does in this slice (for example "noted; shapes what we show you later"), and extend the ban on `rise|lead|profile` to impact lines.

### `src/features/opening/actions.ts`

**MEDIUM · line 109 · reminders unchecked and unbounded**
- What: `addReminderAction` stores any `courseId` and any `text` (up to 300 characters) the browser sends. `server/profile.ts:91` dedupes only on `futureId` + `courseId`, so each new courseId adds a row to a JSONB array with no cap. `getProfile` reads that array on every page.
- Why: The stored data can name courses that don't exist, and one script can grow a profile row without limit.
- Rule: `security.md` §9 (allowlist properties) and `performance.md` §4 (a column that grows without limit) · a test would have caught it: yes, with a reminder for a `courseId` outside the catalogue.
- Fix: Take only `futureId` and `courseId`, check the course against `COURSES`, read its `keepOpen.text` on the server, and cap the array (for example 3 × courses).

**LOW · line 41 · an action can throw**
- What: `getSession()` sits outside `asStudent`'s `try`, so a database error during the session lookup is thrown from the action.
- Why: CLAUDE.md says server actions return `ActionResult` and never throw. The clients catch it today.
- Rule: CLAUDE.md, Code · a test would have caught it: yes, with `getSession` rejecting in `actions.test.ts`.
- Fix: Move the session read inside the `try`.

### `src/features/engine/geo.ts`

**MEDIUM · line 63 · short hops read as flights**
- What: Any two different cities get a flight line, so Melbourne→Geelong (65 km) and Sydney→Wollongong (70 km) read "a 1-hour flight".
- Why: A student with a cousin in Melbourne gets advice no one would act on, and the user test exercises exactly this.
- Rule: criterion 32, read literally; a quality issue · a test would have caught it: yes, with a Geelong course and a Melbourne relative in `geo.test.ts`.
- Fix: Below about 300 km, write road time ("about 75 min by road · estimate"), and record the refinement against criterion 32.

### `src/features/opening/components/OpeningScreen.tsx`

**MEDIUM · line 32 · repeated UI and messages**
- What: The `SOLID` primary-strong class string is repeated in four components (StudentSignIn, PictureQuestion, OpeningScreen, CoinsScreen). The progress bar is built twice (here and `CoinsScreen.tsx:130`). `SAVE_FAILED` is typed in five files.
- Why: A change to the Industry button or to the message has to be made in each copy, and a missed copy drifts.
- Rule: severity table, repetition of three or more · a test would have caught it: no.
- Fix: Add a `strong` variant to `button.tsx`, extract one `Progress` component, and export one save-failed message from the opening model.

### `src/features/opening/components/ChipEditor.tsx`

**MEDIUM · line 10 · option strings retyped**
- What: "Something particular" and "Suggest me" are retyped in `ChipEditor.tsx:10`, `FuturesScreen.tsx:52` and `impact.ts`, separately from `questions.ts:39`.
- Why: If the option in `questions.ts` is renamed, `parsePatch` returns null and the field chip silently stops working.
- Rule: repetition of three or more · a test would have caught it: partly; `FuturesScreen.test.tsx:193` would catch the field chip.
- Fix: Export `PARTICULAR`, `DRAWN_TO_AREAS` and `SUGGEST_ME` from `questions.ts` and import them everywhere.

### `src/features/auth/components/StudentSignIn.tsx`

**LOW · line 143 · wrong message on a failed sign-in**
- What: An unknown error at the code step, such as a network failure or Better Auth's 429, reads "We couldn't send the code. Try again." (`code-messages.ts:51`).
- Why: She has the code. The message suggests the opposite.
- Rule: quality · a test would have caught it: yes, with `signIn.emailOtp` rejecting.
- Fix: Add a `SIGN_IN_FAILED` message for the code step.

### `src/shared/lib/auth/index.ts`

**LOW · line 124 · other code types skip the resend guard**
- What: The 30 s guard covers only `type: 'sign-in'`. `forget-password` and `email-verification` sends still email "Your OfCourse code" to existing accounts, because `sendVerificationOTP` (line 225) ignores `type`.
- Why: These are unused paths that can still send mail and spend Resend quota. The only bound on them is the plugin's 10 per minute per IP.
- Rule: `security.md` §8 · a test would have caught it: yes, with a forget-password send in `hooks.test.ts`.
- Fix: In the before hook, refuse `/email-otp/send-verification-otp` for any type other than `sign-in`, and the `/forget-password/email-otp` and `/email-otp/request-password-reset` paths.

### `src/features/opening/components/WeightsPlaque.tsx`

**LOW · line 41 · copy**
- What: "These shape how lists are sorted." Nothing is sorted in this slice.
- Why: It is the same over-promise as the impact lines, on a smaller scale.
- Rule: open question 10's principle · a test would have caught it: no.
- Fix: "These shape what each future is drawn around."

### `src/app/(app)/opening/[step]/page.tsx`

**LOW · line 8 · props typed by hand**
- What: `{ params: Promise<{ step: string }> }` is written out instead of using `PageProps<'/opening/[step]'>`.
- Why: The repo types pages with the global `PageProps`.
- Rule: repo convention (`src/app/page.tsx`) · a test would have caught it: no.
- Fix: Use `PageProps<'/opening/[step]'>`.

### `src/features/opening/components/CoinsScreen.tsx`

**LOW · line 40 · arbitrary values**
- What: `HATCHED` is an arbitrary `bg-[repeating-linear-gradient(…)]`. `admin/sign-in/page.tsx` keeps the starter's `mb-[0.425rem]`, `tracking-[-0.015em]` and `text-sm`.
- Why: The skill reserves arbitrary values for true one-offs. This one fits, but it would sit better in the CSS module.
- Rule: `tailwind-v4-best-practices` §2 · a test would have caught it: no.
- Fix: Move the hatch into a class in a CSS module, or leave it.

### `src/shared/components/DuckLoader.tsx`

**LOW · line 1 · shared with one consumer**
- What: `DuckLoader` and `loader-lines.ts` live in `src/shared`, but only `(app)/loading.tsx` uses them.
- Why: The FDD rule of three says to keep code in its feature until three features use it.
- Rule: `fdd-architecture` §5 · a test would have caught it: no.
- Fix: Move them to `features/opening`, or record why the admin will need them.

### `src/shared/components/Providers.tsx` (outside the diff)

**LOW · line 27 · orphan left by this change**
- What: Deleting `ThemeChoice` left `useThemeChoice` with no caller. `README.md:18,43` still sends people to `/dashboard`.
- Why: CLAUDE.md says to remove what your own change made unused, and the README instruction now leads to a 404.
- Rule: CLAUDE.md, Behaviour §3 · a test would have caught it: no.
- Fix: Remove the hook, or keep it with a comment, and update the README to `/start` and `/admin/sign-in`.

## Top 3 priority fixes
1. `src/features/engine/catalogue.ts:289` — mark the Perth job-market claims (R1) "not sure", not UniSA's, and fix the tests that assert UniSA.
2. `src/features/engine/futures.ts:80` — give each future a chip for every assumed answer it rests on, so the "show it as a chip" promise holds.
3. `src/features/opening/model/impact.ts:105` — label every figure in an impact line as mock, and add the progress dots to `FuturesScreen.tsx:186`.

## Done well
- Each sign-in page can only narrow what a sign-in may do. The rules are pure functions in `access.ts`, unknown or missing values fall back to the student page, and the Google surface travels in Better Auth's server-only OAuth state (checked in the library's code). The only route to superadmin is the admin page's first-account rule.
- The student actions take the user id from the session, check the role, validate every field against the shared model, and log the cause rather than the wrapper, which would carry her answers. The repository merges JSON with parameterised `jsonb ||` and re-parses on every read.
- The engine is pure and deterministic: no clock, no randomness, no locale-aware comparison, and ties broken by id. The database-backed hooks tests and the phone and desktop e2e tests check behaviour, not mocks.

## Built but not asked for
- A Sign out button on the futures screen (`FuturesScreen.tsx`), so testers can switch accounts.
- "Start again" on the coins screen.
- The `level-substituted` notice when no course exists at her level. This is a reasonable edge case with no criterion behind it.
- The Back links on the futures and coins screens are asked for by criterion 30, so they are not extra.

## Blind spots
- No test runs a real Google callback carrying `serverContext.surface`. A manual admin and student Google sign-in on the deployed URL before 8 Oct would cover it, and so would an integration test that calls the callback with a forged state.
- Better Auth's rate limiter keeps its counts in memory on each instance and keys them by IP. Testers on one venue Wi-Fi share 10 code requests a minute, and on Cloud Run the client IP header must be configured. A five-person sign-up dry run would show the effect.
- `markStep` writes during a GET render. That is safe only while `loading.tsx` stops prefetch. An e2e test that prefetches a link and asserts `lastStep` is unchanged would guard it.
- If two admin-page sign-ups land at the same moment on an empty database, `settleFirstAccountRole` turns the loser into a `user` instead of refusing it (criterion 19). This can only happen on the first deploy.
- The R1 mistake survived because the tests were written from the code rather than from the intent's wording. A test that quotes each criterion's Then clause would have caught it.

## Pre-existing, not this branch
- `bun audit`: braces (high, GHSA-vfj7-8cjw-p6xm) and esbuild (moderate, GHSA-67mh-4wv8-2f99). This branch adds no dependency, so neither counts toward the decision.

---
Stack: TypeScript; Next.js 16 App Router (server components, server actions, proxy); React 19; Better Auth 1.7.7 with the email-OTP plugin; Drizzle on Postgres (jsonb); zod/mini; Tailwind CSS 4 with two CSS modules; Bun test with happy-dom; Playwright. Passes applied shallowly: how the rate limiter and client IP work on Cloud Run (not verified); the code scan covered only the 4 renamed files.

## Resolution (6 Oct 2026)

The developer asked for every valid finding to be fixed.

**Judged invalid, left as is:** CRITICAL `catalogue.ts:289` (R1). Register item R1 in the decision record quotes its claim as "a smaller IT job market than Perth" (the Perth vs Adelaide comparison), and the Gen AI plan's demo is "Research this on the Perth-vs-Adelaide job-market claim". That text is the Adelaide (UniSA) card's career claim, which is where the plan put `notSure`. Criterion 39's "the Perth job-market claim" is loose wording for the same claim; proposed for the intent's owner: "the Perth vs Adelaide job-market claim (register item R1)".

**Fixed** (one implementer dispatch, test-first): HIGH chips for assumed answers, mock labels in impact lines, progress dots on screen 5, feature boundaries (answer contract moved to `src/shared/types/student.ts`, `index.ts` per feature); MEDIUM criterion 44 on each card, copy that promised unbuilt behaviour, reminders checked against the catalogue and capped, short hops by road, the `strong` button variant / one Progress / one save-failed message, option strings exported from `questions.ts`; LOW session read inside the try, `SIGN_IN_FAILED`, other email-code types refused, `PageProps`, hatch in a CSS module, DuckLoader moved into the opening feature, orphaned theme hook removed and README updated.

**Left open:** a "Not sure" on a question the engine does not read (where, earliest, years, dep, qual, eng, knows) still says it will show as a chip, and no chip appears — needs a decision (narrow criterion 26, or reword `notSureLine` for those keys). The auth feature has no `index.ts`; the engine and opening import each other's public index (no cycle at runtime).
