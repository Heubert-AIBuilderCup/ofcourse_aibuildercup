**Smoke test — student opening and three futures** · local · `http://localhost:3000`

**Before you start**
- `bun run dev` (starts Postgres, applies both migrations, runs Next on 3000)
- Email codes print in the dev server's terminal as `[sign-in code] <email>: 123456` (no `RESEND_API_KEY`/`EMAIL_FROM` set)
- The dev database has no accounts: your first sign-in on the admin page becomes superadmin
- One private window per account, so sessions don't mix

**1 · Admin sign-in** — AC 17, 20
```
Go to   /admin/sign-in
Do      Sign in with Google (your account)
See     /admin/users, you are superadmin; the page offered Google only, no email field
```

**2 · Splash and the student page** — AC 5, 6, 1
```
Go to   / in a new private window
Do      wait · reload
See     the duck splash about 3 s, once; "OfCourse" page with Sign in with Google and no email field; no splash after reload
```

**3 · Email code** — AC 8, 9, 10, 11, 12
```
Go to   /
Do      a new address · Send me a code · type a wrong code · Sign in · wait 30 s · Send a new code · try the first code · then the new one
See     "The code we sent to …" and "Send a new code in 30 s"; "That code is wrong…"; the old code refused; the new one lands on /picture
Other   terminal: each code printed; in the admin, the new account's role is user
```

**4 · Wrong page refused** — AC 16, 18, 19
```
Go to   / (in the admin window, signed out first)
Do      Sign in with Google with your admin account · then /admin/sign-in with a Google account that has no admin role
See     "This page is for students. This account signs in on the admin page." · "This account doesn't have admin access." — and no account created for the second
```

**5 · Picture question** — AC 14, 15
```
Go to   /picture (the student window)
Do      Female · Start
See     "Facts about you" within about 3 s
```

**6 · Screens 1–4** — AC 22, 23, 24, 25, 26, 27, 28, 29, 30, 31
```
Go to   /opening/facts
Do      Nepal then Australia (on a visa) · AUD 36k · Not sure on "It covers" · Partner · Next · Back · Next×2 · community A little · Do you know anyone: Yes · Cannington, Perth · Cousin · Anjali · Open to others · Next
See     six dots; an impact line at once under each tap (onshore line differs); "Not sure: I'll assume…"; "Family isn't covered in this preview yet…"; answers kept after Back; "Do you know anyone…" appears only after community; "Only Australia is covered…"; screen 4 offers Yes / Not sure / No
```

**7 · Three futures** — AC 32, 34, 35, 36, 38, 39, 40, 41, 42, 43, 2, 3
```
Go to   Show me three futures
Do      How we know on a line · Remind me on a card · Your weights
See     Built around cost / staying / career, no order or "best"; "▲ Gives you / ▼ Costs you / ● Neutral"; "Might feel"; distances from Anjali (minutes in Perth, flight hours elsewhere); "We're not sure about this yet." on the Adelaide job-market line; "Assumed: …" chips; "Reminder set"; the plaque's weights and reasons
```

**8 · Correct a chip** — AC 49, 50, 51, 52
```
Go to   /futures
Do      Budget chip · AUD 42k · Undo in the toast · then the field chip · Data science
See     options open under the chip, "… All three futures redraw."; all three redraw at once, "Redrawn: …", "Changed with your answer"; Undo puts 36k back; routes change for data science
```

**9 · Edge states** — AC 37, 44, 45, 46, 47
```
Go to   /futures
Do      hard-limit chip: Hard limit · budget AUD 30k · then AUD 24k · back to Roughly · stay chip: No · field chip: Suggest me, then on screen 2 areas: Health
See     one future and "Only one route fits a hard limit of AUD 30k"; "Sealed at your hard limit" with the nearest routes and how far over; PR lines "PR doesn't count here…"; "No health courses in this preview, so these use psychology." on each card
```

**10 · Coins** — AC 53, 54, 55, 56, 57, 58, 59
```
Go to   Next: your attention · optional
Do      + six times on one pile · Start again · Not sure · spread them for me · Spend them later · back to coins · place ten · Done
See     "+" stops at five; Done only at ten; one line per coin, none says a route moves; "Assumed: an even spread…"; after Later the futures show "Spend your ten coins"; futures unchanged by coins
```

**11 · Coming back** — AC 60, 61, 62, 63
```
Go to   / in a new private window, a new student
Do      answer screen 1 · Next · close the window · sign in again with a code in another window · finish to the futures · open / again · Back to screen 1, change the budget, forward again
See     lands on screen 2 with screen 1's answers; later lands on the futures ("Your three futures · nothing ranked"); the futures show the new budget
```

**12 · Suspended student** — AC 21
```
Go to   /admin/users (admin window)
Do      suspend the student from step 11 · in the student window sign in with a code
See     /suspended
```

**No need to click** — AC 4 (the loader shows only after 400 ms: `DuckLoader.test.tsx`; you may glimpse it on a slow load) · AC 7, 13 (the Google leg for a student is proven through the hooks in `hooks.test.ts`; step 4 exercises Google on both pages) · AC 48 (`futures.test.ts` determinism, `futures.e2e.ts` reload) · under test.

**After deploy only** — not in this run (local only)
```
Deploy to Google Cloud (services chosen at plan time: the app on Cloud Run, Postgres on Cloud SQL) → set RESEND_API_KEY and EMAIL_FROM, BETTER_AUTH_URL, and the Google redirect URI for the new URL → Jenish signs in on /admin/sign-in first (superadmin) → repeat steps 2–4 on the deployed URL
```

**Needs a decision** — from the developer or Nikhil
1. "Not sure" on where, timing, dependants, qualifications or "do you know anyone" says "I'll … show it as a chip", but those answers don't change the futures, so no chip appears. Narrow criterion 26 to the answers the futures use, or reword that line for those questions.
2. Criterion 39 says "the Perth job-market claim (R1)"; register R1 is "a smaller IT job market than Perth", shown on the Adelaide card, and the build marks that one. Accept the wording "the Perth vs Adelaide job-market claim (register item R1)"?
3. Back links on the futures and coins screens are not in the frozen frames; criteria 30 and 62 need them. Keep them where they are?
4. Open question 10's copy defaults and open question 3's qualification options (High school … Master's; IELTS bands) are in the build until Nikhil answers.

**Worth a glance** — the users admin (moved into a route group; "Back to the app" is now "Sign out") · the starter's welcome and user-management flows

**Build report** — each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 1 · Surface rules and paths | sonnet | 1m 27s | 53,306 | working tree |
| 2 · Auth wiring: surfaces, email codes, dev login | opus | 9m 13s | 151,615 | working tree |
| 2 · fix: email-code rate limit allows five tries | sonnet | 0m 48s | 33,511 | working tree |
| 3 · Routes and guards, admin sign-in, OfCourse name | opus | 9m 32s | 150,323 | working tree |
| 4 · Student sign-in page and splash | opus | 21m 31s | 236,355 | working tree |
| 5 · Student profile: contract, table, repository | opus | 4m 50s | 79,476 | working tree |
| 6 · Questions model and student actions | opus | 7m 19s | 138,065 | working tree |
| 7 · Engine foundations | opus | 9m 0s | 145,869 | working tree |
| 8 · Futures engine | opus | 6m 54s | 119,423 | working tree |
| 9 · Impact lines and coin rules | sonnet | 6m 11s | 117,377 | working tree |
| 10 · Landing, resume, picture question | opus | 3m 22s | 83,360 | working tree |
| 11 · Screens 1–4 | opus | 9m 56s | 174,804 | working tree |
| 12 · Futures screen (first attempt interrupted: not reported) | opus | 5m 2s | 115,706 | working tree |
| 13 · Coins screen and loader | sonnet | 2m 6s | 60,844 | working tree |
| 14 · End-to-end journey specs | opus | 9m 3s | 111,082 | working tree |
| Review · branch-reviewer | opus | 9m 14s | 339,072 | `review.md` |
| Review fixes · 17 valid findings | opus | 20m 15s | 297,405 | working tree |
| **Total** | | 2h 15m 43s | 2,407,593 | 0 (uncommitted, awaiting approval) |

Tokens are the subagents' own; this session's context is not in them.
