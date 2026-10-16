**Smoke test: admin feed post (all 28 tasks)** · local, fake model provider · `http://localhost:3000`

**Before you start**
- Postgres is running (`bun run db:up`); `.env` holds `DATABASE_URL`, `BETTER_AUTH_SECRET`, `AI_PROVIDER=fake` and `DEV_LOGIN_SECRET`.
- Start the app yourself: `bun run dev`.
- `AI_PROVIDER=fake` means drafts, facts and art come from the deterministic fake, not Gemini: the wording is placeholder text, but every rule and screen is real.
- There are no Google keys, so sign in with the dev login. On `http://localhost:3000`, open the browser console and run, with the secret from `.env` and an email of your choice:
  `await fetch('/api/dev-login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-dev-login-secret': '<DEV_LOGIN_SECRET>' }, body: JSON.stringify({ email: 'you@example.com', name: 'You' }) }); location.href = '/admin'`
- The first account on an empty database becomes superadmin. If accounts already exist, make yours superadmin: `docker exec main-db-1 psql -U app -d app -c "update \"user\" set role = 'superadmin' where email = 'you@example.com'"`.
- Use three browser profiles (for example normal, private, and a second browser): **S** your superadmin, **E** `editor@example.com`, **R** `reviewer@example.com`.
- Demo source to paste (title `Hours of paid work and first-year results`, kind `research summary`), five paragraphs separated by blank lines:
  1. A survey of 3,100 international students at eight Australian universities compared weekly paid-work hours with course results over two semesters.
  2. Students working up to 20 hours a week had grades similar to students who did not work.
  3. Above 20 hours a week, pass rates fell by 11 percentage points. The drop was largest in the first year of study.
  4. The authors note the study shows association, not cause: students under financial pressure may both work more and have less time to study.
  5. At the national minimum wage (AUD 24.95 an hour, mock), 20 hours a week pays about AUD 499 before tax.
- The twin: the same, with title `Past 20 hours a week, pass rates drop 11 points` and paragraph 3 saying `9 percentage points`.

**1 · Give the roles** · AC 8, 9, 10, 1
```
Go to   /admin/users as S (header reads "OfCourse Admin")
Do      sign E and R in once with the dev login · open E's page · tick Editor · confirm · open R's page · tick Reviewer · confirm · in the invite form, leave Editor waiting for waiting@example.com with "No admin role"
See     E and R show Editor / Reviewer chips · waiting@example.com is listed as waiting with an Editor chip · signing waiting@example.com in gives an editor
Other   make a fourth account an admin and open a user's page as that admin: "Only a superadmin can change roles." and no checkboxes
```

**2 · Editors see only the board** · AC 2, 11, 13
```
Go to   /admin as E
Do      look at the tabs · then open /admin/users directly
See     lands on /admin/board · one tab, "Board" · /admin/users sends E back to the board
Other   as S the tabs are exactly "Board" and "Users"
```

**3 · A post from the demo source** · AC 22, 3, 19
```
Go to   /admin/board as S · "+ New feed post"
Do      paste the demo source (title, kind, five paragraphs) · "Extract ideas" · double-click it once to check
See     ¶1–¶5, three key ideas, every fact supported · toast "Ideas extracted" · only one post is created
Other   the board shows the card in "Structures" with "Changed by <you> · <time>"
```

**4 · The planted claim is caught** · AC 23, 24
```
Go to   + New feed post
Do      paste the twin · Extract ideas
See     the title's claim reads "Not supported" in red: "The paragraph gives 9, not 11." · the "9" in ¶3 is highlighted
```

**5 · A failed step keeps your work** · AC 5
```
Go to   + New feed post
Do      paste any other text with [fake:fail-extract] in one paragraph · Extract ideas
See     "This step failed. Your work so far is kept." with "Try again" · every field still holds its text
```

**6 · Draft and compare structures** · AC 25, 26, 27, 28, 29, 30, 34
```
Go to   the post from step 3
Do      tick four templates (Draft stays disabled) · untick to The line, The question, The long read · Draft structures
See     three drafts side by side, each as slide images with its fit checks · chips read "<fact> · ¶n · Hours of paid work… · checked <date>" and "not a fact · checked"
Other   The question shows "No source" with "Fix unbound claim" (fixing clears it) · themes read Paper 14.4:1, Ink 15.4:1, Signal 4.2:1 · The long read shows "Slide 2 · 121 words (30–70) · Over" before approval
```

**7 · Approve, the gate, fit checks** · AC 31, 32, 33, 35
```
Go to   the same post
Do      pick The long read · Paper · Approve structure · then Reopen structures · pick The line · Signal · approve · reopen · Paper · approve
See     after approval the rail says "Gate open" and toast "Structure approved · card crossed the render gate" · The long read: Render disabled with the 121-words row · Signal: "Contrast · Signal 4.2:1 · Too low" · reopening says "Gate locked"
Other   before any approval there is no Render button
```

**8 · Render** · AC 36, 37
```
Go to   the post approved on Paper with The line
Do      Render
See     five slide images, art on the cover only, toast "Rendered · 5 slides" · text slides have no art · the slides look like the draft previews plus the art
Other   a post whose source carries [fake:fail-art] renders with a "No art" tag and "Try again"
```

**9 · Source check and feed settings** · AC 42, 43, 49, 50, 51, 52, 53
```
Go to   the rendered post
Do      Run source check · mark the not-found claim as editorial opinion · in settings try Personal with no why line, then Featured, then leave expiry unset · finally General · Everyone · 90 days · Save · Send to review
See     one claim "Not found" ("First year is the worst time…") and Send to review blocked until it is marked · "Personal and matched posts always say why" · Featured greys out Matched with "Featured posts go to everyone" · counts read "(mock)" · the missing-setting message names expiry
Other   the board shows the card under "In review"
```

**10 · Review, send back, publish** · AC 44, 45, 46, 47, 48, 54
```
Go to   the post in review
Do      as E: look at "Approve and publish" · as R: try Send back with a blank reason, then "Slide 2 is too long" · as S/E: resend · as R: Approve and publish
See     E sees it disabled with "Waiting for a reviewer" · R has no way to edit wording · blank reason keeps Send back disabled · the editor sees "Sent back by <R>: Slide 2 is too long" · after approval: "Reviewed by <R> · facts locked"
Other   board: "Live in feed · exported" with "General · Everyone · Leaves the feed in 90 days" · take a second post through and approve it as its own creator (S): "· self-reviewed"
```

**11 · Two tabs, one post** · AC 21
```
Go to   any post at Structures, open in two tabs as S
Do      tab A: choose a theme · tab B: pick a structure
See     tab B toasts "Changed by <you> just now" and reloads showing tab A's theme
```

**12 · Admins read, superadmins act** · AC 14, 15, 7, 17, 18, 20
```
Go to   /admin/board as a plain admin (no capability)
Do      open a post
See     no "+ New feed post" and no buttons in the workbench · as S every editor and reviewer button is there
Other   at 1280 px wide nothing scrolls sideways except the board's columns · from the Social filter, "← Board" returns to that filter
```

**13 · Vision check and override** · AC 39
```
Go to   + New feed post · a source with [fake:vision-stray] in a paragraph · take it through to Render
Do      read the three rows under the slides · send to review · as R open it
See     "No stray text in artwork" fails · R sees "Flagged by the vision check" and Approve disabled · Override with a reason → "Overridden by <R>: <reason>" and Approve is enabled
```

**14 · Light edits and regenerating the cover** · AC 40, 41
```
Go to   a rendered post (The line on Paper)
Do      edit the cover phrase · move body slide 2 down · Swap image (pick a library image) · edit the art prompt · "Regenerate this slide only"
See     the slide shows the new phrase and the fact chips are unchanged · slides 2 and 3 swap · "Version 2" under the cover and only the cover image changes · text slides read "No art"
Other   after the phrase edit, Send to review asks for the source check again
```

**15 · Preview in context** · AC 55
```
Go to   a rendered post with Personal settings and a why line
Do      switch from "Slides" to "Preview in context"
See     a phone-sized card: "For you", the cover, title, why line, the Studio link's call to action, the source line · the settings summary beside it
```

**16 · Nepal version** · AC 56, 57, 58, 60, 61
```
Go to   the rendered paid-work post
Do      Market: Nepal · look at the money slide · send to review and approve as R · open the live post
See     the board shows "<title> · Nepal" · the slide reads "AUD 499 (≈ NPR 43,900)" with "NPR at 88 per AUD · mock rate · 1 Oct 2026" under it · the reviewer sees Default and Nepal side by side · the live post shows both, with no way to add a version
Other   on a post whose source has no money figure, Nepal shows no NPR at all · after Regenerate cover the Nepal version has to be made again
```

**17 · Instagram version and export** · AC 62, 63, 64, 65, 66, 67
```
Go to   a live feed post (a post not yet live has no "Adapt")
Do      Adapt · Cerebral · Instagram carousel · Create social version · open it · Quick approve layout · Render · edit the caption · Reset to approved wording · Export
See     a linked card "Instagram · Cerebral ↳ from feed post" · "Facts locked · from feed post <title>" · a caption with hashtags · Export disabled after the edit, enabled after Reset · cerebral_<slug>_instagram.zip downloads (slide SVGs, PNGs, caption.txt)
Other   the social card moves to "Live in feed · exported" · nothing is posted anywhere
```

**No need to click** · AC 4 (replay on a demo source: `replays.test.ts`, `extract.test.ts`; the browser check is skipped until `bun run ai:replays` has recordings) · AC 6 (daily caps: `client.test.ts`, `store-backed.test.ts`) · AC 12 (staff refused on the student page: `isStudent` in `access.test.ts`; the page itself is Jenish's) · AC 16 (lost role → "Not authorised.": `actions.test.ts`) · AC 38 (art prompt guard: `draft.test.ts`, `art.test.ts`) · AC 59 (the Nepal wording never changes a number: `ai/market.test.ts`) · AC 68 (no posting code: a grep of src/features/content finds only the Vertex client) · AC 69, 70 (templates and brands as files: `templates.test.ts`, `brands.test.ts`, `svg.test.ts`) · under test.

**After deploy only** · live models
```
AI_PROVIDER=vertex with GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION=global, GEMINI_FLASH_MODEL, GEMINI_PRO_MODEL, GEMINI_IMAGE_MODEL set → bun run ai:smoke (five ok lines) → bun run ai:eval (10/10 planted, ≤ 2 false alarms) → bun run ai:replays (recordings and covers; then the skipped replay e2e runs)
```

**Needs a decision** · from Nikhil
1. Re-inviting an address that already has an account replaces its Editor/Reviewer ticks with whatever the form says, so ticks can be removed by accident. Keep "the form is the truth", or only ever add capabilities from an invite?
2. The art-prompt guard refuses brand names as whole words, and one page brand is called "Main", so "the main hall at dusk" is refused. Rename the brand, or exempt common words?
3. Criterion 52 asks for "the missing setting is named"; the app shows one message naming layer, audience and expiry together. Fine, or name only the missing one?
4. The paid-work ¶5 holds two AUD figures, so the Nepal version converts both: "AUD 24.95 (≈ NPR 2,200)" an hour and "AUD 499 (≈ NPR 43,900)". Convert both, or only the weekly figure?
5. Placeholder wording to replace in the JSON when you have it: page-brand bylines and tones (`src/features/content/brands/*.json`), template slot labels (`src/features/content/templates/*.json`).

**Worth a glance** · the users admin's existing role change, suspension and sign-out everywhere · an admin can now suspend an editor (an editor's role is still "user")

**Not automated, carried from the build**
- Live Gemini and Imagen behaviour: pending Google Cloud credentials (smoke, eval, replays).
- A cover-art fallback is logged as an extra `ai_call` row marked cached, because the model client records no fallback for image calls.
- `bun run test:db` covers the content server suites; one unit test file mocks the call log for the whole run, so the store-backed AI test runs by path. To be untangled before the pull request.
- The existing "who is online" e2e now opens /dashboard first, because a dev sign-in loads no page.
- Social renders reuse the feed post's art and skip the vision check; caption replays are not recorded for the demo.
- The board's Nepal card link opens the render step on Nepal, but a live post's view starts on Default.

**Build report** · each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 1 · Content capabilities and the name | haiku | 2m 23s | 49,003 | `a42a300` |
| 2 · Domain types, immutable records, valid state | sonnet | 2m 05s | 47,171 | `c97a8ac` |
| 5 · Templates with slot boxes, brands, fonts | sonnet | 1m 19s | 31,398 | `4979dc3` |
| 6 · Text tools without the model | sonnet | 3m 16s | 50,797 | `eb08a9f` |
| 6 · fix: real demo paragraphs as fixtures | sonnet | 0m 58s | 57,147 | `2a66dc6` |
| 7 · Layout engine | opus | 8m 42s | 102,791 | `ad0e15e` |
| 8 · Claims and workflow rules | sonnet | 2m 45s | 61,360 | `5a726b3` |
| 8 · fix: clear audience rules for everyone | sonnet | 0m 39s | 64,628 | `62b44ea` |
| 3 · Schema, capabilities, users-admin controls, content tables | opus | 8m 57s | 141,693 | `a3a1d7f` |
| 4 · Into the admin by role; route group | opus | 3m 22s | 62,191 | `3678f7e` |
| 4 · fix: users e2e expects the board | opus | 0m 45s | 65,680 | `a0b6e6f` |
| 9 · Model layer | opus | 10m 31s | 101,456 | `c1fef33` |
| 10 · Demo sources and exact-match replays | sonnet | 1m 12s | 30,111 | `727712b` |
| 11 · Source to facts (G2) | opus | 5m 19s | 79,154 | `eb51eb2` |
| 11 · fix: quotes must state the fact; judge concurrency | opus | 1m 23s | 87,848 | `1ed8cb7` |
| 12 · Draft structures (G3) | opus | 6m 42s | 95,766 | `126dbbb` |
| 13 · Cover art (G4) and render | sonnet | 2m 52s | 59,017 | `97f8e33` |
| 14 · Source check | sonnet | 2m 42s | 69,566 | `58643f6` |
| 3 · fix: await immutability checks; DB tests run | opus | 14m 14s | 162,044 | `f1613da` |
| 15 · Store and step lock | opus | 4m 19s | 75,574 | `9de7a37` |
| 16 · Commands | opus | 12m 03s | 155,829 | `44df3c8` |
| 17 · Server actions, asset and preview routes | sonnet | 5m 52s | 82,108 | `663b74c` |
| 18 · The Board | sonnet | 2m 53s | 57,105 | `5be1ce3` |
| 19 · Workbench: source and structures (blocked) | opus | 12m 53s | 187,491 | — |
| 19 · fix: client-safe workflow, guard test | opus | 1m 05s | 193,143 | `00f6709` |
| 20 · Workbench: render to live | opus | 12m 44s | 149,485 | `22e7281` |
| 21 · Smoke, eval, replay scripts | sonnet | 7m 10s | 107,465 | `e9767ab` |
| 21 · fix: key replays by claim text | sonnet | 1m 37s | 120,098 | `cb25142` |
| 22 · E2E for the core | opus | 25m 09s | 224,161 | `ef41108` |
| 23 · Vision check (G8) | sonnet | 10m 01s | 164,036 | `0b12d82` |
| 24 · Light edits and regenerating the cover | opus | 13m 19s | 159,813 | `6f1d6f2` |
| 24 · fix: unique cover versions; scope No art in e2e | opus | 5m 02s | 171,234 | `38ad8cd` |
| 25 · Preview in context | sonnet | 2m 42s | 58,720 | `fbf93c3` |
| 26 · The Nepal version (G5) | opus | 13m 17s | 228,536 | `24aebc1` |
| 26 · fix: tie Nepal to its render; show it when live | opus | 2m 59s | 245,928 | `654fb58` |
| 27 · Social versions and export (G6) | opus | 17m 35s | 239,689 | `82699e8` |
| 28 · E2E for the submission criteria | opus | 12m 44s | 145,412 | `7137a7c` |
| **Total** | | 243m 30s | 4,184,648 | 36 |
Tokens are the subagents' own; this session's context is not in them.

**Verification, run by the controller on 6 Oct 2026**
- `bun run lint`: Checked 281 files, no fixes. `bun run type-check`: clean.
- `bun run test:run`: 605 pass, 128 skip (database-gated), 0 fail.
- `bun run test:db`: 114 pass, 0 fail.
- `bun run build`: compiled; routes include /admin/board, /admin/posts/new, /admin/posts/[id], /preview, /export, /admin/assets/[id].
- `bun run test:e2e`: 46 passed, 1 skipped (the replay test, until `bun run ai:replays` has run with Google Cloud credentials).

**Result** · 6 Oct 2026 · local, `bun run dev` on localhost:3000, fake model provider
- Run by the developer: the core flow from a pasted source through structures, render, vision check, source check and feed settings (steps 3, 4, 6–9).
- Found in that round and fixed: fact chips collapsing to one word per line (root cause: Tailwind 4's `inline-block` also sets the width to the `block` spacing token; `a260f5c`, plus a guard test), the dark-mode paragraph highlight and the unsupported-span mark (`9f0c547`), a plain title like "Test Feed" listed as a fact (titles are now claims only when they state a number; `9f0c547`), and three drafts wrapping instead of sitting side by side (`1cba1cc`).
- Not run by hand: steps 1, 2, 5 and 10–17. Covered by `e2e/content-roles.e2e.ts`, `e2e/content-feed-post.e2e.ts` and `e2e/content-submission.e2e.ts`: after the fixes, `bun run test:e2e` gave 46 passed, 1 skipped (the replay test, pending Google Cloud credentials).
- The developer's words: "things look good for now. But UI can be improved". UI polish is to follow as its own round.
- Live Gemini and Imagen not yet tried (needs the Vertex settings; `bun run ai:smoke`, `ai:eval`, `ai:replays`).

**Re-check after the review fixes** · 6 Oct 2026

**R1 · Vision runs after the render, and "Not checked" blocks** · AC 39
```
Go to   a post approved on Paper
Do      Render · watch the Vision check block · then try Send to review on a render whose check failed or has not run
See     "Rendered · 5 slides" at once · the block shows "Running…", then its three rows · with no result: "Not checked" + "Run vision check", and Send to review disabled with "The render is not checked. Run the vision check before sending to review."
Other   in review, a "Not checked" render shows "Override", and Approve says "…A reviewer must override it to publish."
```

**R2 · The missing setting is named** · AC 52
```
Go to   a rendered post's Feed settings
Do      leave only the expiry unset
See     "Choose the expiry before sending to review."
```

**R3 · Nepal version is vision-checked** · AC 39, 56–61
```
Go to   a rendered paid-work post
Do      Market: Nepal · wait for "Vision check · Nepal" · send to review
See     review is refused while Nepal is "Not checked" · in review a second "Vision check · Nepal" block with its own Override
```

**R4 · The live line counts down** · AC 54
```
Go to   the board or a live post
Do      look at the live line
See     "Leaves the feed in <days left> days" (days left since approval), "Leaves the feed tomorrow", or "Left the feed on <date>"
```

**R5 · Social export needs a checked render** · AC 39, 66, 67
```
Go to   a social version after Render
Do      wait for its Vision check · try Export before and after
See     Export disabled with "The render is not checked…" until the check passes
```

**R6 · Users admin: an invite that would remove a capability warns** · AC 8, 9
```
Go to   /admin/users as S · Add by email
Do      enter an existing editor's address with Editor unticked
See     "<address> already has Editor; saving without Editor removes it." with "Save and remove" and "Cancel" · the capability labels and chips are caption size
```

**R7 · Daily image limit is named** · AC 6
```
Go to   (only if you lower AI_DAILY_CAP_IMAGE to 0 in .env and restart) a post approved on Paper
Do      Render
See     the cover tag reads "Daily image limit reached" with "Try again", not "No art"
```

No need to click: AC 59 (the Nepal number guard, `ai/market.test.ts`) · extraction runs once per request id (`server/commands` DB test) · assets served with nosniff, SVGs sandboxed (`routes.test.ts`) · slide images' alt text (`SlidePreview` test) · the refactors (all suites green).

---

**Smoke test · second round · 7 Oct 2026** · local, `bun run dev` on localhost:3000, fake model provider · stories 11 and 12 and the Gemini fixes (Tasks 29–42)

**Before you start**
- In `.env` (and `.env.example`): rename `IMAGEN_MODEL` to `GEMINI_IMAGE_MODEL` (value `gemini-nano-banana-2.1`), set `GOOGLE_CLOUD_LOCATION=global`, remove `IMAGEN_NEGATIVE_PROMPT` if present; restart the dev server.
- Migration 0003 (the `social_link` record kind) applied: `bun run db:migrate` if the server did not already.
- A student account: `POST /api/dev-login` with a fresh email (role `user`), or a Google account that is not staff.
- S = superadmin, ER = an editor who is also a reviewer, ST = the student.

**S1 · Market version with a picker** — AC 85, 86, 87
```
Go to   a rendered paid-work post as ER · Render step
Do      For market: India · Make market version
See     "India version made · linked card on the board" · slide 2 reads "AUD 499 (≈ INR 27,400)" with "INR at 55 per AUD · mock rate · 1 Oct 2026" under it · the board card reads "<title> · India"
Other   Review panel and Live panel say "India version", never "Nepal"
```

**S2 · The fit check names a character the font cannot draw** — AC 34, 35
```
Go to   a structure before approval as ER (or a light edit of the cover phrase after render)
Do      put an emoji in the text, e.g. "Keep 😀 calm"
See     a failing fit row "Slide n · <slot> · cannot draw "😀" · Missing glyph" and Render blocked until it is removed
```

**S3 · Tags in feed settings** — AC 80
```
Go to   Feed settings of a rendered post as ER
Do      tick Australia · Books and movies · Over 25 · save
See     four fieldsets Destination / Home country / Theme / Age · the summary line "Australia · Books and movies · Over 25" in the review and live panels ("For everyone" when none)
```

**S4 · The student feed** — AC 71, 74, 75, 77, 78, 79
```
Go to   /feed as ST, window 360 px wide, then desktop
Do      read the cards · open one · scroll the slides sideways on the phone width
See     live posts newest first, phone-sized cards (tag "For you" or "Featured", cover, title, excerpt, why line, Studio text, source line) · the post page with every slide, one per swipe, alt "Slide n: …" · signed out, /feed sends you to sign in and back
Other   an image URL of a draft render under /feed/assets/<id> answers 404
```

**S5 · Chips, search and the home-country version** — AC 81, 82, 83
```
Go to   /feed as ST
Do      pick Australia · add Books and movies · Clear on Destination · search "rupees" · search nonsense · pick Home country: India on a post with an India version
See     each pick narrows the list and stays in the URL into the post page and back · "No posts match." for the nonsense search · under home=India the India slides (INR) show, other posts show their main version
```

**S6 · The Instagram loop** — AC 88, 89, 90
```
Go to   a live post as ER · Live panel · Adapt
Do      see the Page brand pre-selected from the theme (Work and study life → Main) · Instagram · create, approve layout, render, export · paste https://www.instagram.com/p/test123/ · Save link
See     "Link saved" and "Posted: <url> · by <name>" · a non-instagram URL refused with "Paste the post's instagram.com link."
Other   /feed/<id> as ST shows "See this post on Instagram" and "Follow @ofcourse_ai"; every feed page ends with "Follow OfCourse on Instagram" and the three pages
```

**S7 · Related posts** — AC 91
```
Go to   a post page as ST where another live post shares its destination or theme
Do      read "Related"
See     up to four posts with their reason: "built on the same source" · "also about <theme>" · "also for <destination>" · no section when nothing is shared
```

**No need to click** — AC 14, 20, 65 (sentences keep "Dr.", "Rs." and initials whole: `sentences.test.ts`) · AC 72, 73 (Featured pinned 72 h, expiry by the clock: `feed.test.ts`, `lines.test.ts`; the page's 404 is in the e2e) · AC 76, 84 (`feed.test.ts`, `profile-contract.test.ts`; the profile values arrive with Jenish's slice) · AC 92 (the files parse at load: `markets.test.ts`, `tags.test.ts`, `pages.test.ts`, `brands.test.ts`) · under test.

**After deploy only** — AC 6, 13, 37 on the live model
```
.env with AI_PROVIDER=vertex, GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION=global, GEMINI_FLASH_MODEL, GEMINI_PRO_MODEL, GEMINI_IMAGE_MODEL=gemini-nano-banana-2.1 → bun run ai:smoke → if the image line fails on the aspect ratio, ASPECT_RATIO becomes '3:4' in art.ts (Task 29 Step 6) → bun run ai:eval → bun run ai:replays
```

**Needs a decision** — from Nikhil
1. Task 32 (per-model thinking levels, labels, token caps, the Flash-Lite tier): build it now, or after the demo.
2. The placeholders in the files: age bands (`tags/tags.json`), the three handles and URLs (`brands/*.json`), the theme-to-page rule (`pages/pages.json`), the twelve rates (`markets/rates.json`).
3. With Jenish by 9 Oct: the profile contract (ADR-126), `/feed` beside his routes (ADR-121), the theme and the public repo (ADR-128).

**Worth a glance** — the admin's Nepal flows after the market generalisation (S1 with Nepal: AC 56–61 unchanged) · the social workbench on a LinkedIn version shows no Instagram link field · the board's "↳ <Market> · market variant" line.

**Not automated, carried from the build**
- A draft whose cover is byte-identical to a live post's cover is served by the feed's image route (content-addressed ids): by design, noted by Task 35.
- The feed finds a post by scanning `listLive()` (bounded, cached per request); a by-id read is a later store change.
- The row labels of the feed chips duplicate `TAG_LEGENDS` in SettingsForm.tsx.
- `RenderStep.tsx` and `store.ts` both hold the "first body slot" excerpt rule.

**Build report · second round** · each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 29 · cover art on Gemini (Nano Banana 2.1, global) | fable | 9m 54s | 81,417 | `cf90f79` |
| 30 · sentences keep abbreviations whole | haiku | 2m 41s | 25,527 | `72daf6c` |
| 31 · the glyph fit check | fable | 6m 21s | 45,620 | `e46aa87` |
| 33 · live posts for the feed | fable | 13m 54s | 117,432 | `e270c99` |
| 34 · the feed, the post page, the image route | fable | 16m 52s | 125,815 | `6cc5f0d` |
| 35 · the feed in the browser (8 e2e) | fable | 8m 29s | 91,932 | `d1b27c4` |
| 36 · markets, currencies, the mock rate file | fable | 12m 48s | 114,913 | `042ce22` |
| 37 · the market picker and labels | fable | 19m 41s | 160,422 | `2185fd0` |
| 38 · tags in four groups | fable | 26m 19s | 109,099 | `ba0f20e` |
| 39 · feed chips, search, the profile hook | fable | 23m 22s | 140,125 | `6079de2` |
| 41 · related posts | fable | 5m 06s | 54,574 | `fec208f` |
| 40 · Instagram pages, the link record, follow links | fable | 20m 02s | 207,058 | `36e3a4d` |
| 42 · the targeted feed in the browser (15 e2e) | fable | 22m 35s | 137,175 | `05d668b` |
| **Total** | | **3h 08m** | **1,411,109** | **13** |
Tokens are the subagents' own; this session's context is not in them. Docs commit `1d13135` (intent, plan, decision register) by the controller.

**Verification, run by the controller on 7–8 Oct 2026**
```
bun run lint         Checked 337 files. No fixes applied.
bun run type-check   tsc --noEmit, clean
bun run test:run     773 pass · 148 skip · 0 fail · Ran 921 tests across 101 files
DB suites            128 pass · 1 skip · 0 fail · Ran 129 tests across 10 files (the skip is the first-account rule, which needs an empty table: bun run test:db)
bun run build        Compiled successfully · ƒ /feed · ƒ /feed/[id] · ƒ /feed/assets/[id]
bun run test:e2e     61 passed · 1 skipped (5.2m), one worker; the skip is the replay test, which needs bun run ai:replays
```
Four local runs with two or four workers each failed different tests on timeouts while the dev server was shared (eight different tests, none twice); the config now runs one worker locally, as CI does. The same runs found one real defect in a spec: the sign-in page has two `role="alert"` elements (the page's line and Next's empty route announcer), so `sign-in.e2e.ts` now takes the alert with text. The waits after a workbench press are 60 s, since each press runs a server step.

**Result · second round** · 8 Oct 2026 · Not run by the developer yet. Nikhil asked for the branch review and the next plan first and will work through S1–S7 when he is back; until then the second round rests on the verification above (unit, DB, build, and 61 browser tests on one worker).

---

**Smoke test · third round · story 13, make a post without writing a prompt · built 9–10 Oct 2026** · local, `bun run dev` on localhost:3000

**Before you start**
- `AI_PROVIDER=fake` for a quick pass, or `vertex` (project `applyims`) to see real Gemini; restart the dev server after changing `.env`. The browser tests need `fake`.
- Migrations 0004 (cover options), 0005 (page styles) and 0006 (post slugs) are applied by `bun run dev`.
- ER = an editor who is also a reviewer; ST = a student; a signed-out browser window for S15.

**S8 · Make post from a link or text** — AC 93, 94
```
Go to   /admin/posts/new as ER
Do      paste a news article's https link (or the paid-work text) · Page: Main · Make post
See     facts appear as the source's own sentences (¶n.m) · three versions arrive by themselves, side by side, each "<template> · <angle>"
Other   a link to http://localhost or a PDF reads "Could not read that page." and keeps the form
```

**S9 · Facts by pointing; the headline rule** — AC 95, 96
```
Go to   the source pane of that post
Do      select a sentence · Add as fact · Remove another fact
See     each fact is a source sentence word for word · a source whose title claims more than its text shows "Headline claim not in the article", unbindable
```

**S10 · Emotion, versions, editing on the slide** — AC 97, 98, 100, 104
```
Go to   the structures step
Do      pick an emotion chip and draft again · Use this version · click a text slot on a slide, change a sentence, Save
See     the slide redraws and its fit rows update · the check runs by itself: "Every sentence found in the source" or "N not found" with "Source ¶n: …" and "Use the source's wording", which fixes it in one click
```

**S11 · Another take and history** — AC 99, 101
```
Go to   the picked version
Do      Another take on one slide · open History · Restore an earlier entry
See     only that slide changes · History lists each change with who and when · Restore brings the old text back as current; nothing is lost
```

**S12 · Covers** — AC 102, 103
```
Go to   Render, then the Covers block
Do      type a Cover idea (try one with a digit: refused) · Make covers · Use this cover · Another set
See     three cover slides to choose from · the chosen one "In use" · no "Run vision check" and no "Not checked" anywhere · review and publish no longer wait on a vision check
```

**S13 · Page styles** — AC 105
```
Go to   Board · Page styles
Do      upload one or two reference images on a page · Describe the style · edit the three fields · Save
See     Art style, Copy style, Closest template saved · a post made for that page drafts in its copy style and its covers follow the art style
```

**S14 · The search line, captions, markets, the set** — AC 106, 108, 109, 110
```
Go to   a rendered post; then a live post's Live panel
Do      look at the last slide · Make market version (India) · Reword for India · Make the set
See     the last slide ends "To find this again, search “OfCourse <title>”" · the market version appears at once with INR, then reworded on request · the set lists a version per styled page plus a quote card, each "Ready to export" · captions open with a hook, carry the post's own lines, the search phrase and hashtags from the tags
```

**S15 · The public page** — AC 107
```
Go to   /posts/<slug> in a signed-out window (the slug is the title in lowercase with hyphens)
Do      read the page · open /sitemap.xml
See     the title, the slides, the search line and "Join OfCourse"; the tab reads "<title> | OfCourse"; no audience or why line · the sitemap lists the post · an unpublished post's slug is "not found"
```

**No need to click** — AC 94 (address, redirect and size refusals: `fetch-page.test.ts`, 17 cases) · AC 101 (restore never changes a record: `commands.test.ts`) · AC 103 (a cover with text is replaced once: `art.test.ts`) · under test.

**After deploy only** — AC 107 on Google: submit `/sitemap.xml` in Google Search Console once the site is live; indexing takes days to weeks.

**Needs a decision** — from Nikhil
1. Review round 2's findings (`review-2.md`): still not fixed; #1 (records read without their schema) matters more now, since every story-13 field reads as `undefined` on older posts.
2. The post's page is stored on the post's pointers, not the source record (Task 53), so it can change before approval.
3. Fit rows update when a slot is saved, not on each keystroke (criterion 98 says "as they type").
4. A label-style title such as "Test Feed" now shows as "Headline claim not in the article" (Task 46).
5. The public pages and their images have no rate limit; images are cached publicly for an hour after a post expires (Task 54).

**Worth a glance** — Jenish's `e2e/onboarding.e2e.ts:254` failed once in the full run (strict-mode match on the tagline while the splash overlay was up) and passed alone · `src/shared/lib/auth/hooks.test.ts` hangs on one test at HEAD (a Bun `.rejects` hang, known since 9 Oct).

**Verification, run by the controller on 10 Oct 2026**
```
bun run lint         Checked 485 files. No fixes applied.
bun run type-check   clean
bun run test:run     1491 pass · 216 skip · 0 fail · Ran 1707 tests across 150 files
DB suites            186 pass · 0 fail · Ran 186 tests across 13 files (hooks.test.ts excluded: known hang)
bun run build        Compiled successfully
bun run test:e2e     177 passed · 1 skipped · 1 failed (onboarding.e2e.ts:254, flaky, passes alone) (9.3m)
ai:smoke (applyims)  extract 2.7 s · draft, three versions 14.8 s · source check 2.0 s · image 11.9 s · all ok
ai:eval (applyims)   planted caught 10/10 · false alarms 2 · PASS
```

**Build report · third round** · each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 43 · dark-mode e2e (press animation timing) | fable | 6m 56s | 61,237 | `725c451` |
| 44 · last-slide search line | fable | 15m 13s | 116,973 | `64df3fb` |
| 45 · emotion chips | fable | 20m 55s | 177,724 | `2b4730c` |
| 46 · facts by pointing, headline rule, no judge | opus | 20m 43s | 237,231 | `da3aecb` |
| 47 · three versions per draft | fable | 29m 16s | 167,380 | `abc6439` |
| 48 · edit on the slide, automatic check | opus | 42m 56s | 405,278 | `55ef535` |
| 49 · another take on one slide | fable | 19m 19s | 216,555 | `0ac2c17` |
| fix: the source check judges meaning, not wording | controller | — | — | `f037442` |
| 50 · make covers; slide vision out of the flow | opus | 58m 44s | 477,238 | `dd8c946`, `542ea36` |
| 51 · make post from text or a link | opus | 30m 28s | 231,415 | `c579d36` |
| 52 · version history and restore | fable | 20m 25s | 241,334 | `114e6bb` |
| 53 · design language per page | opus | 51m 11s | 452,336 | `49ce72c` |
| 54 · public page per post, sitemap | opus | 48m 38s | 197,027 | `98ea83d` |
| 55 · captions: hook and call to action | fable | 14m 30s | 138,953 | `b5d6664` |
| 56 · market versions at once | fable | 16m 36s | 152,665 | `56607e5` |
| 57 · make the set | fable | 20m 20s | 219,553 | `8010420` |
| 58 · story 13 in the browser | opus | 19m 52s | 171,636 | `19bd7fb` |
| **Total** | | **7h 16m** | **3,668,835** | **18** |
Tokens are the subagents' own; this session's context is not in them. Also by the controller on 9 Oct: `be52644` (no list lengths to Gemini), `bad642f` (low thinking on Flash), `8cff094` (an admin lands on Users), `90683bc` (story 13 docs, ADR-129–132).


---

## Round 4 · story 14 · move back and forth between the steps

**Smoke test — story 14** · local · `http://localhost:3000` · branch `feat/submission-readiness` (Tasks 60–64, 12 Oct 2026)

**Before you start**
- Restart `bun run dev` (migration 0008 adds the published version to posts; it is already applied to your database, the restart just reloads the code).
- An editor account and a reviewer account (or a superadmin, who is both). One post at Rendered and one live post on the Board.

**S16 · Every passed step stays in view** — AC 111
```
Go to   /admin/board · open a post at Rendered
Do      click "Source" and "Structures" in the stage bar
See     each scrolls to its step; earlier steps show read-only (no edit controls); steps not reached are not links
```

**S17 · Back to text versions, with a confirm** — AC 112, 121, 114
```
Go to   the same post
Do      press "Back to text versions" · read the confirm · press "Go back" · approve the same version again · render
See     the confirm lists what is kept and what is remade; the post is at Structures, gate locked; after rendering, the covers are the ones made before
```

**S18 · Back to source and remake** — AC 113
```
Go to   a post at Structures
Do      press "Back to source" · change a sentence · "Save and remake" · then open History and restore an older version
See     new facts and three new versions; History lists the old versions; Restore brings one back with its own facts
Other   "Back to source" then "Continue with this source" without changes returns to the versions with no new drafting
```

**S19 · Moves wait while a step runs** — AC 118, 122
```
Go to   a post at Rendered
Do      press "Make covers" and look at the "Back to…" buttons while it runs
See     they are disabled with "Covers are being drawn"; once covers land they work again
```

**S20 · Withdraw from review** — AC 115
```
Go to   a rendered post · "Send to review"
Do      as the editor, press "Withdraw from review"
See     the post is back at Rendered, no reason asked; the reviewer's Board no longer shows it waiting
```

**S21 · Request changes** — AC 120
```
Go to   a post in review, signed in as the reviewer
Do      press "Request changes" · choose "Covers" · write a note · then as the editor go "Back to text versions" · approve · render · send to review
See     the note shows beside Covers (at the top once you are back at text versions), with who and when; it is gone once the post is sent to review again
```

**S22 · Edit a live post while it stays up** — AC 116, 117, 119
```
Go to   a live post · open its /posts/<slug> in a second tab
Do      press "Edit" · change a slide · reload the public tab · then send to review, approve and publish · reload the public tab
See     the Board shows "Changed since published"; the public page keeps the old slides until publish, then shows the new ones at the same address
Other   repeat Edit · change a slide · "Discard changes" · confirm: the post is live again with its published slides, and your change is in History
```

**No need to click** — AC 112 records never deleted by a move, and every move refused for a reviewer without editor (`commands.test.ts`) · AC 117 the sitemap and feed read only the published version (`store.test.ts`) · under test.

**Needs a decision** — from Nikhil
1. Criterion 120 says a note "stays visible after the editor withdraws". A post in review never carries a note (sending it to review clears it), so that case cannot happen. Shall I reword the criterion to "after the editor goes back", or keep notes through a resend too?

**Worth a glance** — On a live post the slides show twice (in the render step and in the review summary above the live panel) · after "Save and remake" the source check records a hidden failed run because nothing is picked yet (nobody sees it) · restoring a version saved before "Add as fact" or "Remove" brings back that older facts list.

**Verification, run by the controller on 12 Oct 2026**
```
bun run lint         Checked 513 files. No fixes applied.
bun run type-check   clean
bun run test:run     1718 pass · 247 skip · 0 fail · Ran 1965 tests across 161 files
DB suites            166 pass · 0 fail · Ran 166 tests across 10 files (src/features/content/server + ai/store-backed, on app_story14)
bun run build        Compiled successfully
```

**Build report · story 14** · each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 60 · the published version apart from the working one | opus | 8m 41s | 103,712 | `3c418c5` |
| 61 · the moves back | opus | 17m 53s | 171,610 | `e2af6a5` |
| 62 · change the source and remake | opus | 15m 39s | 205,636 | `f8dc8cb` |
| 62 · fix: restore before a remake; continue without versions | opus | 7m 11s | 10,834 | `285ab6e` |
| 63 · every passed step visible, with its way back | opus | 19m 26s | 164,175 | `8272556` |
| 64 · discard, request changes, confirm, say why | opus | 23m 22s | 259,957 | `f85ee94` |
| **Total** | | **1h 32m** | **915,924** | **6** |
Tokens are the subagents' own; this session's context is not in them. Story 14's intent and plan by the controller (`4bf35ee`).
