**Smoke test — roadmaps, part 1 (data, routes, the list and the loader)** · local dev · `http://localhost:3000`

**Before you start**
- `bun run dev` running on the branch `feat/roadmaps` (migration 0003 is applied by `dev` on start: your profile's answers became your first roadmap, "Cyber Security in Perth").
- Your own account has one finished roadmap already, so step 5 shows the first-time flow with a brand-new account (a second Google account); the rest works with yours.
- Check 390 (phone), 768, 1440 and 1920, light and dark; the canvas's Roadmaps page has the boards (RMDesk, RMPhone, RM1920, RMFirstDesk, RMMenuDesk, RMNewDesk, RMReadyDesk, RMFirstLoadDesk).

**1 · Landing** — AC 3
```
Go to   /, then /start, /onboarding, /onboarding/facts, /road
Do      open each, signed in
See     /, /start, /onboarding and the step land on /roadmaps in one move; /road lands on /roadmaps/<id> (your last opened); never a page painted before the move
```

**2 · The list** — AC 2, 5, 6
```
Go to   /roadmaps
Do      read; open the account menu (top right)
See     "Your roadmaps", the lead "Each roadmap is one set of answers…", "New roadmap", one card: the road drawing with the duck and "AUSTRALIA · PERTH", "Cyber Security in Perth", "Master’s · ECU · Perth", "POINT B Permanent residency · 2032", "From onboarding", "Opened today" (or "Made …" before its first open), the footnote; the menu's first item is "Your roadmaps" (also on the board's menu)
```

**3 · Open a roadmap** — AC 3, 6
```
Go to   /roadmaps
Do      press anywhere on the card; then the account menu → Your roadmaps
See     the board at /roadmaps/<id>; on its very first open the duck starts at Australia with the hint on Perth (the next open starts at the course); the menu brings you back to the list, with the card now "Opened today"
```

**4 · Rename** — AC 7, 10
```
Go to   /roadmaps
Do      "…" on the card → Rename · type a name (try 61 characters) · Save; then open Rename again and press Escape; then Cancel
See     the field stops at 60; the card shows the new name and a "Renamed." toast; Escape and Cancel close the dialog and focus returns to the "…" button; Delete is absent from the menu while this is your only roadmap
```

**5 · Start from scratch, and the loader** — AC 4, 8, 9, 10, 11, 33
```
Go to   /roadmaps
Do      New roadmap → read the dialog → Start from scratch → Start the questions · answer the steps (any answers) through step 05 · on "You're all set" press "Go to your roadmaps" · then press Back
See     the dialog "How do you want to start?" with Copy (default, listing your roadmaps) and Start from scratch, the primary changing to "Start the questions"; onboarding opens at question 00 (your comic character); the loader fills the screen: blue grid, the duck on the water, three steps ("Reading your answers · Drawing your new roadmap · Adding it to your roadmaps"), each at least 0.7 s, ticked in turn, then a fade into /roadmaps; the new card is first with a 2px accent border and "New", "From onboarding", and the toast "Your new roadmap is ready." with "Open it"; Back never shows an onboarding screen
Other   a brand-new account: sign in → onboarding → "Go to your roadmaps" → the first-time steps ("…your first roadmap · Opening your roadmaps") → /roadmaps with the first-visit lead "Your first roadmap is ready…" and one card marked New
```

**6 · Delete with Undo** — AC 7
```
Go to   /roadmaps, with two roadmaps
Do      "…" on one → Delete → read → Delete; press Undo in the toast; delete it again and let the toast pass
See     "Delete "<name>"? Its answers and its board go with it. Your other roadmaps stay as they are."; the card goes and the toast "Roadmap deleted." has Undo; Undo puts it back in its place; after the toast passes a reload still shows it gone
```

**7 · Each roadmap keeps its own board** — AC 1, 35
```
Go to   the board of one roadmap
Do      press Data Science → Swap onto your road · reload the page · open the other roadmap's board
See     after the reload Data Science is still on the road (the swap is stored with that roadmap); the other roadmap's board is untouched; Undo on the swap stores the undo too
```

**8 · Copy (placeholder until part 4)** — AC 8
```
Go to   /roadmaps
Do      New roadmap → Copy and change answers; and "…" → Copy and change answers
See     /roadmaps/new?from=<id>: "Copying a roadmap comes in the next part." with "Back to your roadmaps"
```

**9 · Phone and reduced motion** — AC 6, 11
```
Go to   /roadmaps at 390 wide; then the OS's reduce-motion setting on, and step 5's loader again
See     one column of cards; the New roadmap dialog's buttons stacked full width; under reduced motion nothing spins and the loader cuts to the list instead of fading, the ticks still appearing in turn
```

**Changed by the review fixes** (`4c5756b`) and by the dialog fix (`7049e75`)
```
Go to   /roadmaps (with two roadmaps, step 5 done)
Do      make a roadmap; open New roadmap, Rename and Delete; shrink the window to 844×390 and open New roadmap; from /roadmaps press Back
See     the roadmap you just made is first; dialogs fade in from the centre with no scrollbars, and on the short window the dialog scrolls inside its frame with the buttons reachable; Back never shows an onboarding screen; after step 5 the "Your new roadmap is ready." toast still shows
```
```
Go to   an onboarding step left open in another tab, after "Go to your roadmaps"
Do      tap an answer
See     "Onboarding is finished. Your roadmaps hold your answers now."; no new roadmap on /roadmaps
```
```
Go to   a board
Do      Swap, then Undo straight away; reload
See     the board as you left it (the saves land in order)
```

**No need to click** — AC 1, 2, 7 (the 1–60 name, soft delete and restore), 9 (new = never opened), 10 (Escape/Cancel; the focus trap is the shared Dialog's), 35 (a copy's answers never reach its source; another student's roadmaps are never returned, renamed or deleted): `src/features/roadmaps/server/roadmaps.test.ts` (database, 11), `model/roadmap.test.ts`, `components/RoadmapsPage.test.tsx` (24) · AC 11 (step timing ≥ 0.7 s, the fade, failure with "!", Try again from the failed step, the slow note at 10 s, one polite announcement per step, no refresh cutting it short): `RoadmapLoader.test.tsx` (11), `model/loader.test.ts`, `DoneScreen.test.tsx` · AC 3 (every entry point, one hop, nothing painted first): `e2e/routes.e2e.ts` · the board per roadmap: `e2e/your-road.e2e.ts`, `RoadBoard.test.tsx` (47).

**Needs a decision** — from Jenish
1. The shared Dialog draws an "×" close button top right; the canvas's dialogs have none. Keep it (one more way out) or hide it (`showCloseButton={false}` as the Sheet has)?
2. The loader's failure and slow states can't be reached by hand against the mock road (nothing fails or takes 10 s). Unit tests cover them; a look at them needs a forced failure. Leave to the unit tests, or add a dev-only switch?
3. `git stash list` holds "task-4 earlier attempt" (a cancelled dispatch's leftovers, not your work) and an older `feat/onboarding-study` WIP. Drop the first?

**Worth a glance** — the onboarding steps still save each tap (they now write to the roadmap being answered) · the board's lesson and route-detail links open under /roadmaps/<id>/… · "Your roadmap" wording on the board is part 2's ("roadmap" everywhere) · the failure note "We couldn't save that change." sits top-centre over the map; its place on phone and at 1920 was not checked on screen.

**Build report** — each dispatch as its usage report gave it (a resumed dispatch's tokens are the agent's cumulative count less the previous one)
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 1 · the roadmap table, migration, server module | opus | 4m 58s | 92,077 | `943106f` |
| 1 · continued: the database tests (DB was down) | opus | 0m 42s | 6,674 | (same) |
| 2 · onboarding fills the roadmap; routes and the lock | opus | 14m 19s | 231,010 | `96cc264` |
| 2 · fix: the e2e profile helper | opus | 0m 45s | 3,297 | `c464a85` |
| 3 · the list, its menu and dialogs | opus | 20m 29s | 240,851 | `9052c3e` |
| 3 · fix: the shared toast, the drawing's place | opus | 1m 01s | 8,993 | `995ac5a` |
| 4 · the loader | opus | 8m 37s | 147,831 | `57920c8` |
| 4 · fix: the loader runs to its end, focus | opus | 1m 36s | 10,339 | `12b2ab1` |
| 5 · the board keeps each roadmap's choices | opus | 4m 33s | 94,572 | `31ee42e` |
| review · the branch | opus | 6m 24s | 279,363 | `docs/roadmaps/review.md` |
| fix · the review's 15 findings | opus | 9m 45s + 1m 13s | 193,790 + 6,844 | `4c5756b` |
| **Total** | | **74m 22s** | **1,322,685** | 11 |
Tokens are the subagents' own; this session's context is not in them.

**Result**
15 Oct 2026, local dev. Run by Jenish by hand: step 2 (the list) and step 5's New roadmap dialog, where he found the dialog sliding in from the left with scrollbars around it (fixed in `7049e75`). Steps 1, 3, 4, 6–9 and the review-fix steps were not run by hand; the unit, database and route checks above cover them, and the look of the list was checked against the canvas's boards in the build. He then said "review, fix and push".

---

**Smoke test — roadmaps, part 2 (the list, round 2)** · local dev · `http://localhost:3000`

**Before you start**
- `bun run dev` on `feat/roadmaps-list-2` (migration 0004 adds `archived_at` on start). Have at least two roadmaps (New roadmap → Start from scratch makes a second).
- Boards: RMDesk, RMPhone, RM1920 (cards), RMTableDesk, RMTablePhone, RMMenuDesk, RMArchDesk.

**1 · The page** — AC 37, 39
```
Go to   /roadmaps at 1440
Do      read the top; hover a row; press anywhere on a row
See     "2 roadmaps" above "Your roadmaps", the lead "Each roadmap is one set of answers and where it leads…", New roadmap; rows in a grid, each with the road glyph (a line ending in a diamond), the name, "Cyber Security · ECU · Perth", "POINT B Permanent residency · 2032", "From onboarding · Opened today"; the last-opened row carries the accent edge and glyph; hovering tints a glyph; the row opens the board
```

**2 · Sort and the view switch** — AC 38, 40
```
Go to   /roadmaps
Do      Sort → Name, then Date made, then Last opened · press Table · press the "Roadmap" header, then "Last opened" · reload · press Cards
See     the rows re-order each time; the table has Roadmap, Course · city, Progress ("4 of 7 steps walked" with a bar), Next ("Student visa · Late 2026"), Point B, Last opened and "…"; the pressed header shows its arrow; the table is still chosen after the reload (remembered per browser); Cards comes back
```

**3 · Archive and restore** — AC 41, 42
```
Go to   /roadmaps with two roadmaps
Do      "…" on one → Archive · press Undo · archive it again · open "Archived (1)" · press the row · then "…" → Archive on the remaining one
See     the row leaves the list and the count drops; the toast "Archived. Restore it any time from Archived." with Undo; Undo brings it back; archived again, the fold "Archived (1)" sits at the foot, closed; opened, the row is faded and reads "Restore <name>"; pressing it restores with "Restored."; with one roadmap left out of the archive its menu has no Archive and no Delete; an archived roadmap's menu is Restore and Delete; New roadmap's copy list leaves archived ones out
```

**4 · Phone** — AC 39, 40
```
Go to   /roadmaps at 390
Do      look at Cards, then Table
See     one column of rows; the table becomes stacked rows, each cell led by its column name ("Progress", "Next"…), the "…" at the top right of each
```

**No need to click** — AC 42's data (archive, restore, the guard that keeps one roadmap out of the archive): `server/roadmaps.test.ts` (16, database), `actions.test.ts` (56) · `/road` skipping archived: `model/roadmap.test.ts` (`lastOpenedOut`) · AC 43 (progress and next from the board): `board-facts.test.ts` · AC 38 (the remembered view, storage refused): `useListView.test.ts` · AC 37–42, 44 on screen: `RoadmapsPage.test.tsx` (42).

**Needs a decision** — from Jenish
1. Sort is the shared Radix Select (the plan), while criterion 44 says a native select. Keep the shared one for consistency with the rest of the app?
2. A browser that chose Table shows Cards for an instant on load (the choice lives in localStorage, never the server, as decided). Acceptable, or move the choice to a cookie so the server renders it?
3. Between 36 and 64rem the table scrolls sideways and a "…" menu near the bottom can be cut off. Leave, or stack the table there too?

**Worth a glance** — the course line is the same mock on every roadmap, even after a swap (real data later) · delete's refusal reads "Keep one roadmap out of the archive." when archived ones exist · the Providers cookie test is the known flaky one.

**Build report** — each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 6 · archive in the data, board facts | opus | 3m 23s | 78,267 | `da869b6` |
| 6 · fix: delete keeps one out of the archive | opus | 1m 20s | 9,696 | `712c911` |
| 7 · the list as rows or a table, sorted, with archive | opus | 20m 02s | 215,420 | `da082f5` |
| review · part 2 | opus | 4m 12s | 139,696 | `docs/roadmaps/review-2.md` |
| fix · the review's 8 findings | opus | 4m 47s | 101,779 | `50c7cee` |
| **Total** | | **33m 44s** | **544,858** | 4 |

**Result**
15 Oct 2026, local dev. Run by Jenish by hand: steps 1–3 (the page, sort and the view switch, archive and restore), "seems to be working as expected"; he asked why the last-opened row is blue (the canvas's mark; kept). Step 4 (phone) and the three decisions not settled: the defaults stand (shared Select, the Cards flash left, the table scrolling between 576 and 1024). He then said "review, fix and push".