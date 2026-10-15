---
title: "Your roadmaps, the loader, and the board round 3"
author: Jenish
---

Written 14 Oct 2026 by Jenish as `docs/roadmaps/reference/PROMPT.md`, filed here verbatim with the decisions settled the same day and the acceptance criteria numbered from it. The reference folder is `docs/roadmaps/reference/` (canvas prototypes under `canvas/`, the behaviour in `logic/`). Visual reference: the OfCourse canvas, https://claude.ai/artifact/CvDM8Q8ZzzKcVhWTo5B4Zr, pages Roadmaps (RM* boards), Your answers (RBAns* boards, and every board state frozen) and Board (the live prototype).

# Your roadmaps, the loader, and the board round 3: implement

The design for this slice is final. The attached folder `roadmaps-reference/` is the reference:

- `canvas/*.dc.html` and `canvas/*.css` are the working design prototypes. They are written for the design tool, not for our stack, so use them for behaviour, copy, sizes and styles; don't copy their markup or framework.
- `logic/board.js` and `logic/roadmaps.js` hold the behaviour in plain JS, with comments. All data in them is mock (Priya, Perth, Cyber Security).
- `logic/*-template.html` hold the markup the logic renders.

Start by reading the repo: what the board integration (/road) already does, how onboarding answers are stored, and the routing. Then propose a plan, with what changes for existing code, before writing any. Ask me if anything here conflicts with what's already built.

## 1. Data: a roadmap is now its own thing

- **Roadmap** = one set of onboarding answers + the board built from them + the choices she made on that board (swaps, courses put on it, lessons read).
- **Fields:** id, name, answers (a full copy, never shared with other roadmaps), board choices, copiedFrom (roadmap id or null), createdAt, lastOpenedAt.
- A student can have many. The first one is created when she finishes onboarding.
- Changing an answer in "Your answers" changes only the open roadmap.
- Never rank, score or order roadmaps by quality. The only orderings are last opened (default), date made and name.

## 2. Routes

- `/roadmaps`: the list (section 3). After login and after onboarding, she lands here.
- `/roadmaps/:id`: that roadmap's board (the existing /road board, now per roadmap). Redirect /road to the last opened roadmap.
- `/roadmaps/new?from=:id`: the draft (section 4).
- "Start from scratch" goes to onboarding from question 00. When it finishes, it creates a new roadmap instead of replacing the first.

## 3. /roadmaps: "Your roadmaps"

Reference: `Roadmaps.dc.html`, `roadmaps.css`.

- **Header:** OfCourse and the account menu. "Your roadmaps" is the first item of the account menu on every screen.
- **Top of the page:**
  - Title "Your roadmaps".
  - Lead line: "Each roadmap is one set of answers and the road it draws. Copy one and change a few answers to see another way."
  - On first visit the lead line reads "Your first roadmap is ready. Open it to explore, or make another with different answers."
  - Primary button "New roadmap".
- **Cards, last opened first.** Desktop is an auto-fill grid (min 22rem); phone is one column. Each card shows:
  - a small road drawing (lit tiles = walked, the duck where she is);
  - the name;
  - "Master's · ECU · Perth";
  - "POINT B Permanent residency · 2032";
  - where it came from ("From onboarding" / "Copy of X");
  - dashed chips for each answer that differs from its source;
  - "Opened today".
- **Opening:** the whole card opens it.
- **"…" menu on each card:**
  - Open.
  - Copy and change answers.
  - Rename: a dialog with a text field, max 60 characters.
  - Delete: confirm with "Delete "X"? Its answers and its board go with it. Your other roadmaps stay as they are." Then a toast "Roadmap deleted." with Undo. Hide Delete when she has only one roadmap.
- **New roadmap** opens a dialog, "How do you want to start?", with two radio choices:
  - **"Copy a roadmap and change some answers"** (default). Below it, "Copy which roadmap?" lists her roadmaps.
  - **"Start from scratch"**.
  - The primary button reads "Copy and change answers" or "Start the questions".
- **A newly made roadmap** is first in the list, has a 2px accent border and a "New" tag, and shows a toast "Your new roadmap is ready." with "Open it".
- Footnote: "Roadmaps are never ranked. Each shows where one set of answers leads."
- Dialogs: Escape and Cancel close them; focus is trapped while open and returns to the button that opened them.

## 4. The draft: making a copy

Reference: RoadB with `draft`, see `logic/board.js` (search "draft").

- The source roadmap's board opens with the Your answers panel already open.
  - Header breadcrumb: "Your roadmaps / New roadmap".
  - Panel kicker: "New roadmap · a copy of X".
  - Title: "Change any answers".
  - Lead: "It starts with the same answers. Change one or more; the map shows what would be different before you create it."
- Answers behave exactly like the existing Your answers panel: the map previews changes as dashed outlines, with "Preview · not saved".
- **The bottom bar:**
  - Left text: "Change at least one answer", or "N answers changed".
  - Buttons: Cancel and **Create roadmap**. Create stays disabled (aria-disabled) until at least one answer changed.
- **Cancel** with changes asks "Discard this new roadmap? Nothing is created. Your other roadmaps stay as they are." with Discard / Keep editing.
- **Create roadmap:** saves the new roadmap (named "Copy of X" for now; she can rename it) with chips for each changed answer, runs the loader (section 5), then lands on /roadmaps with it marked New.

## 5. The full-screen loader

It replaces the old in-map arrival. Reference: `logic/roadmaps.js` (play, LT) and the loader CSS in `road.css` (rb-load*).

- **When it shows:**
  - After "Go to your roadmaps" on the onboarding end screen (that button was "Go to your road"; rename it).
  - After Create roadmap.
- **Layout:** full screen on the blue grid field, the floating duck pond centred, and a three-step checklist under it.
  - First roadmap: "Reading your answers · Drawing your first roadmap · Opening your roadmaps".
  - New roadmap: "Reading your answers · Drawing your new roadmap · Adding it to your roadmaps".
- **Step states:**
  - Done: a ticked white circle.
  - Current: a spinning ring, in bold.
  - Next: a dashed circle at 45% opacity.
- **Timing:** each step ticks when its real work finishes (answers saved / roadmap generated / list data loaded), and stays at least 0.7s so it never flashes. After the last tick the loader fades (0.45s) into /roadmaps.
- **Taking a while:** after about 10s, add "Still working. This can take a little longer."
- **Failure:**
  - The failed step shows a "!" mark.
  - Message: "We couldn't draw your roadmap. Your answers are saved." (for a new one: "…draw this roadmap…").
  - A white "Try again" button retries from the failed step. Answers must already be saved before generation starts.
- **Accessibility:** a polite live region announces each step once.
- **Reduced motion:** nothing spins or fades; the ticks still appear as the work finishes.

## 6. The board, round 3

Reference: `RoadB.dc.html`, `road.css` (the sections marked "legible", "Map controls, round 3" and "hover"), `logic/board.js`.

### Reading the map

- **Kind words.** Every tile's label has a small uppercase word above its name: You, Country, City, Course, Visa, Work visa, Study, Fork, Point B.
  - Off her road it reads "Other city" or "Other course".
  - Stacks read "Not looked at".
  - Existing kickers like "Visited" follow it: "Course · Visited".
- **Icons** on each tile's top face, drawn flat on the tile (lucide-style strokes): you (person), country (globe), city (buildings), course (graduation cap), visa (document with tick), study (open book), work visa (briefcase), Point B (flag), fork (split), stack (+).
  - Stroke colour: field blue on lit tiles; white on other options; muted on tiles ahead.
  - The transform is in `board.js`, search "icoM".
- **Labels hang on their tile** by a 0.75rem line (above, below, left or right).
  - Every tile on her roadmap is named at Level zoom, including the country.
  - Adelaide's name sits above Adelaide, not beside the stack.
  - A name the map's edge would cut is hidden until the camera brings its tile in.
- **On phone:**
  - Labels drop the kind word (the icon carries it), except where she is.
  - Steps ahead aren't named at Level.
  - With Your answers open, the small map names only what would change and where she is.
- **Plain trade-offs everywhere:** "Good for: PR, career" and "Less good for: location", each on its own line, in the card, the tile label and the peek.
  - Lower-case the criteria, keep PR upper-case.
  - "Good for what matters most to you:" replaces "Strong on what you weight most:".
- **The fork to PR heads forward:**
  - A small junction tile ("2 ways to PR") follows the 485.
  - The 190 → Permanent residency lane continues straight on.
  - The 491 → 191 lane leaves the junction and bears away on the far side as one angled slab. Both lanes move forward on screen.
  - The years ruler moves to the other side of the road so the branch never crosses it.
  - Geometry is in `board.js`, search "lgFork".
- **The map key strip** (top left of the map):
  - Four swatches: "On your roadmap · Other options · More to look at · Ahead, not open yet", plus "Got it".
  - It shows on her first visit to a roadmap's board, and the first time a newly created roadmap is opened.
  - On phone it sits under the top controls as a two-column grid.

### Controls

- **Remove "Back to Perth" / "Back"** from the map. The header breadcrumb "Your roadmaps / {roadmap name}" leaves the board; tiles move her along it.
- **Replace the View menu** with one "Map key" button (a circled "?" + "Map key", aria-pressed) that shows and hides the key strip.
  - "Pick a goal" and "Layers" are not built this round; remove them.
  - The old map key popover is gone: the strip is the key.
- **Hover:**
  - The tile rises 6px with an eased transform (0.18s, cubic-bezier(.2,.7,.3,1)), and its top colour eases.
  - The name of an unlabelled tile fades in (0.16s).
  - The tile's hit area must not move, or the pointer slips off and it flickers.
  - Don't redraw geometry on hover.
  - No transitions with reduced motion or during the arrival.

### Buttons and wording

- **Every button on the board does what it says:**
  - Card actions: Look ahead, Walk to …, Swap onto your roadmap with its arc, Show 13 more, Put on my board, Done reading.
  - Toasts carry Undo where the action can be undone.
  - Ask and Compare stay out of scope: they show "Ask and Compare come in a later round."
- **Wording:** user-facing "your road" is now "your roadmap" everywhere ("Swap onto your roadmap", "Nothing on your roadmap changes.", "Your roadmap shows what would move…"). Keep "Whole road" on the zoom bar.

## Sizes

Container queries: phone under 576, stacked under 1024, desktop from 1024. Use rem throughout, with the root growing from 16px at 1440 to 21.33px at 1920 (`html{font-size:clamp(16px, calc(100vw / 90), 21.3333px)}`). There are 1920 artboards for the board, Your roadmaps, New roadmap and the loader.

## Done when

- First-time flow works end to end: finish onboarding → "Go to your roadmaps" → loader → /roadmaps with one roadmap marked New → open it → board with the key strip.
- New roadmap works both ways: copy → draft → change one answer → Create → loader → list with the new card first → open it, and its answers differ from the source. Scratch → onboarding → a second roadmap.
- Rename, delete with Undo, and last-opened order work. A roadmap's answers never leak into another.
- Board: kind words, icons, anchored labels, the forward fork, plain trade-offs, the key strip with the Map key button, no Back, smooth hover. Phone, tablet, 1440 and 1920 all checked.
- Keyboard: every control reachable, dialogs trap and return focus, touch targets at least 44px, reduced motion respected.


## Decisions (Jenish, 14 Oct 2026)

- Built in four parts, one branch and PR each, in this order: **1** roadmaps data, routes, list and loader · **2** the board, round 3 · **3** Your answers over the board (the panel the prompt calls "existing": it was designed on the canvas but never built, and the draft is that panel in a second mode) · **4** New roadmap: the draft and Start from scratch. Parts 1 and 2 are independent; 3 needs 1; 4 needs 3.
- Built on the current scene model (the hand-placed fixture and `buildScene`); the graph road engine is a later slice.
- Branch `feat/roadmaps` from `feat/your-road` (its PR into dev is open), not from dev.
- The data model moves answers, the relative, the coins and "where she left off" from `student_profile` onto each roadmap; the comic character (persona) stays on the profile, one per student. A migration turns each existing student's profile into her first roadmap. Jenish decided the migration with this prompt; the one-shot run carries on through it and shows it in its own commit.
- The `onboarded_at` lock is replaced: onboarding is open while a roadmap is still being answered (the student's one unfinished roadmap) and closed otherwise; "Start from scratch" opens a new unfinished roadmap.
- Delete is a soft delete (`deleted_at`), so Undo restores the same roadmap. "New" is a roadmap never opened. The first roadmap is named from its course and city ("Cyber Security in Perth"); a copy is "Copy of X" until renamed. The card's drawing is the reference's small diagonal road, lit to where she is.
- Previews of a changed answer (part 3) use the two mock effects the design draws (budget, English test) and "Nothing on your roadmap changes." for every other answer; a real effect comes with real data.

## Acceptance criteria

Part 1: data, routes, the list and the loader (surfaces: `/roadmaps`, `/roadmaps/[id]`, `/road`, "You're all set")

1. A roadmap is its own stored record: id, name, a full copy of her answers (never shared with another roadmap), the board's choices, where it was copied from, when it was made and when it was last opened. A student can have many. The first one is created when she finishes onboarding.
2. Roadmaps are never ranked, scored or ordered by quality; the only orderings are last opened (the default), date made and name.
3. `/roadmaps` is the list; after login and after onboarding she lands there. `/roadmaps/:id` is that roadmap's board (the existing board, per roadmap). `/road` redirects to the last opened roadmap.
4. "Start from scratch" goes to onboarding from question 00; when it finishes it creates a new roadmap instead of replacing the first.
5. The list page: the header has OfCourse and the account menu, and "Your roadmaps" is the first item of the account menu on every screen. The title "Your roadmaps", the lead line (its first-visit wording on first visit), the primary "New roadmap", and the footnote "Roadmaps are never ranked. Each shows where one set of answers leads."
6. Cards, last opened first: an auto-fill grid (min 22rem) on desktop, one column on phone. Each shows the small road drawing (lit tiles walked, the duck where she is), the name, "Master's · ECU · Perth", "POINT B Permanent residency · 2032", where it came from ("From onboarding" / "Copy of X"), dashed chips for each answer that differs from its source, and "Opened today". The whole card opens it.
7. The "…" menu on each card: Open; Copy and change answers; Rename (a dialog with a text field, max 60 characters); Delete, confirmed with "Delete "X"? Its answers and its board go with it. Your other roadmaps stay as they are.", then a toast "Roadmap deleted." with Undo; Delete is hidden when she has only one roadmap.
8. "New roadmap" opens a dialog "How do you want to start?" with two radio choices, "Copy a roadmap and change some answers" (default, with "Copy which roadmap?" listing her roadmaps) and "Start from scratch"; the primary reads "Copy and change answers" or "Start the questions".
9. A newly made roadmap is first in the list, has a 2px accent border and a "New" tag, and shows a toast "Your new roadmap is ready." with "Open it".
10. Dialogs: Escape and Cancel close them; focus is trapped while open and returns to the button that opened them.
11. The full-screen loader replaces the old in-map arrival. It shows after "Go to your roadmaps" on the onboarding end screen (renamed from "Go to your road") and after Create roadmap: the blue grid field, the floating duck pond centred, a three-step checklist (first roadmap: "Reading your answers · Drawing your first roadmap · Opening your roadmaps"; new roadmap: "Reading your answers · Drawing your new roadmap · Adding it to your roadmaps"). Step states: done (a ticked white circle), current (a spinning ring, bold), next (a dashed circle at 45% opacity). Each step ticks when its real work finishes (answers saved / roadmap generated / list data loaded) and stays at least 0.7 s; after the last tick the loader fades (0.45 s) into `/roadmaps`. After about 10 s: "Still working. This can take a little longer." On failure the failed step shows "!", the message "We couldn't draw your roadmap. Your answers are saved." (a new one: "…draw this roadmap…"), and a white "Try again" retries from the failed step; answers are saved before generation starts. A polite live region announces each step once. Reduced motion: nothing spins or fades; the ticks still appear.

Part 2: the board, round 3 (surface: the board at every width)

12. Kind words: every tile's label has a small uppercase word above its name (You, Country, City, Course, Visa, Work visa, Study, Fork, Point B); off her road "Other city" / "Other course"; stacks "Not looked at"; existing kickers follow it ("Course · Visited").
13. Icons on each tile's top face, flat on the tile (lucide-style strokes): you, country, city, course, visa, study, work visa, Point B, fork, stack. Stroke colour: field blue on lit tiles, white on other options, muted on tiles ahead. The transform is the reference's `icoM`.
14. Labels hang on their tile by a 0.75rem line (above, below, left or right). Every tile on her roadmap is named at Level, including the country; Adelaide's name sits above Adelaide; a name the map's edge would cut is hidden until the camera brings its tile in. On phone: labels drop the kind word except where she is; steps ahead aren't named at Level; with Your answers open the small map names only what would change and where she is.
15. Plain trade-offs everywhere: "Good for: PR, career" and "Less good for: location", each on its own line, in the card, the tile label and the peek; criteria lower-case, PR upper-case; "Good for what matters most to you:" replaces "Strong on what you weight most:".
16. The fork to PR heads forward: a junction tile ("2 ways to PR") after the 485; the 190 → PR lane straight on; the 491 → 191 lane leaves the junction and bears away on the far side as one angled slab; the years ruler moves to the other side of the road. Geometry as the reference's `lgFork`.
17. The map key strip (top left of the map): four swatches "On your roadmap · Other options · More to look at · Ahead, not open yet" plus "Got it"; it shows on her first visit to a roadmap's board and the first time a newly created roadmap is opened; on phone it sits under the top controls as a two-column grid.
18. Controls: "Back to Perth" / "Back" is removed; the header breadcrumb "Your roadmaps / {roadmap name}" leaves the board; the View menu is replaced by one "Map key" button (a circled "?" + "Map key", aria-pressed) that shows and hides the strip; "Pick a goal", "Layers" and the old map-key popover are gone.
19. Hover: the tile rises 6px with an eased transform (0.18 s, cubic-bezier(.2,.7,.3,1)) and its top colour eases; an unlabelled tile's name fades in (0.16 s); the hit area never moves; no geometry redraw on hover; no transitions with reduced motion or during the arrival.
20. Every button on the board does what it says (Look ahead, Walk to …, Swap onto your roadmap with its arc, Show 13 more, Put on my board, Done reading); toasts carry Undo where the action can be undone; Ask and Compare show "Ask and Compare come in a later round."
21. Wording: user-facing "your road" is "your roadmap" everywhere ("Swap onto your roadmap", "Nothing on your roadmap changes.", "Your roadmap shows what would move…"); "Whole road" stays on the zoom bar.
22. Sizes: container queries (phone under 576, stacked under 1024, desktop from 1024), rem throughout, the root growing from 16px at 1440 to 21.33px at 1920; checked at phone, tablet, 1440 and 1920 against the 1920 artboards.

Part 3: Your answers over the board (surface: the board)

23. "Your answers" opens over the live board from the header menu and from a press on Point A: every onboarding answer, each changeable inline; changing an answer changes only the open roadmap.
24. The map is the preview: picking a new answer draws what would move as dashed outlines with "If you save" under a "Preview · not saved" tag, and the panel says it in words; tiles wait while she edits (pan and zoom work, presses don't open cards).
25. Changes wait together ("2 changes not saved · Discard · Save changes"); closing with changes asks first ("Discard 1 change? Your answers and your roadmap stay as they are.").
26. Saved: the road changes with the usual motion, the toast has Undo, the row says "Changed just now"; an answer that changes nothing says "Nothing on your roadmap changes." before and "Saved. Nothing on your roadmap changes." after. Open answers say "Skipped" / "10 coins to spend" with "Answer now", never counted or nagged.
27. Phone: opening her answers switches to Map view; the sheet takes the lower 62%; the map above drops its controls and frames only what would change.

Part 4: New roadmap (surfaces: `/roadmaps/new?from=:id`, the list)

28. The draft opens the source roadmap's board with Your answers already open: breadcrumb "Your roadmaps / New roadmap", kicker "New roadmap · a copy of X", title "Change any answers", lead "It starts with the same answers. Change one or more; the map shows what would be different before you create it." Answers behave exactly as in part 3.
29. The bottom bar: left "Change at least one answer" or "N answers changed"; buttons Cancel and Create roadmap, Create aria-disabled until at least one answer changed.
30. Cancel with changes asks "Discard this new roadmap? Nothing is created. Your other roadmaps stay as they are." with Discard / Keep editing.
31. Create roadmap saves the new roadmap ("Copy of X", renameable) with chips for each changed answer, runs the loader (the new-roadmap steps), then lands on `/roadmaps` with it marked New.
32. "Copy and change answers" from a card's menu and from the New roadmap dialog open `/roadmaps/new?from=:id`.

Done when (all parts)

33. First-time flow end to end: finish onboarding → "Go to your roadmaps" → loader → `/roadmaps` with one roadmap marked New → open it → board with the key strip.
34. New roadmap both ways: copy → draft → change one answer → Create → loader → list with the new card first → open it, and its answers differ from the source; scratch → onboarding → a second roadmap.
35. Rename, delete with Undo and last-opened order work; a roadmap's answers never leak into another.
36. Keyboard: every control reachable; dialogs trap and return focus; touch targets at least 44px; reduced motion respected.

## Delivery

- 15 Oct 2026 — Part 1 (criteria 1–11, 33 and 35 as far as part 1 reaches them): branch `feat/roadmaps`, PR into dev from https://bitbucket.org/heubert/decision-studio-ofcourse/pull-requests/new?source=feat/roadmaps&t=1. Covered by tests: 1, 2, 4, 7, 9, 10, 11, 35 (unit and database), 3 (`e2e/routes.e2e.ts`). QA re-checks by hand: the list's look at every width, the loader's look and reduced motion, the first-time flow with a new account (docs/roadmaps/smoke.md). Review: docs/roadmaps/review.md, all 15 findings fixed. Parts 2–4 follow on their own branches.

## Round 2 of the list (Jenish's canvas, 15 Oct 2026)

Read from the canvas on 15 Oct: the board's design (RoadB.dc.html, road.css) is unchanged, so parts 2–4 above stand as written and move one place down (board round 3 is now part 3, Your answers part 4, New roadmap part 5). The Roadmaps page changed and is already merged, so **part 2 is the list's round 2**. Reference: `docs/roadmaps/reference/canvas/Roadmaps.dc.html` and `roadmaps.css` (the new ones), `logic/roadmaps-2.js` and `roadmaps-2-template.html` (their logic and markup); canvas boards RMDesk, RMPhone, RM1920 (cards), RMTableDesk, RMTablePhone, RMMenuDesk, RMArchDesk. The "Big cards with key facts" boards (RMBigDesk, RMBigPhone) are a design alternative, not built. The Mascot page (`reference/mascot/`) is a brand exploration no screen uses yet; nothing is built from it until a screen on the canvas adopts it.

Decisions: archive is a column (`archived_at`) with its own migration; an archived roadmap stays out of the count, the sort, the copy list and `/road`'s choice, and its board still opens by URL; the Cards/Table choice is remembered per browser (localStorage, never the server); Progress and Next are read from the roadmap's board (its stored choices against the mock road); the thumbnail drawing goes.

Part 2: the list, round 2 (surface: `/roadmaps`)

37. Above the title a count, "3 roadmaps" ("1 roadmap"), counting roadmaps that are not archived. The lead reads "Each roadmap is one set of answers and where it leads. Copy one and change a few answers to see another way." (the first-visit line as before).
38. A bar under the title: "Sort" with Last opened (default), Date made and Name; and "Show as" Cards / Table (a button group with `aria-pressed`), remembered per browser.
39. Cards are compact rows in an auto-fill grid (min 22rem; one column on phone): a road glyph (a vertical line ending in a diamond; accent on the one opened last, and on hover), the "New" tag, the name, "Course · University · City", "POINT B Permanent residency · 2032", dashed chips for each answer that differs from its source, and "From onboarding · Opened today". The whole row opens it; the "…" menu sits at its right.
40. Table: columns Roadmap (the glyph, the name, where it came from, its chips), Course · city, Progress ("4 of 9 steps walked" with a bar), Next ("Student visa · late 2026", or "Pick a course in …" when nothing is next), Point B, Last opened, and More; the Roadmap and Last opened headers sort (`aria-sort`); the last-opened row is marked; on phone the table becomes stacked rows with the column names as labels.
41. The "…" menu: Open, Copy and change answers, Rename, Archive, Delete; Archive and Delete are hidden while she has one roadmap that is not archived; an archived roadmap's menu is Restore and Delete.
42. Archive folds a roadmap away: the toast "Archived. Restore it any time from Archived." with Undo; an "Archived (n)" fold at the foot of the list (closed by default, `aria-expanded`) lists them at 75% opacity, the whole row restores ("Restore <name>"), with the toast "Restored."; an archived roadmap is not counted, not in the copy list, and never what `/road` opens.
43. Progress and Next come from the roadmap's board: walked = the steps lit on its road, steps = the road's rows; next = the next step's name and date.
44. Keyboard: the sort is a labelled native select; the view switch, headers, fold and menus are buttons; focus returns to the "…" button when its menu or dialog closes.
- 15 Oct 2026 — Part 2 (criteria 37–44, the list's round 2): branch `feat/roadmaps-list-2`, PR into dev from https://bitbucket.org/heubert/decision-studio-ofcourse/pull-requests/new?source=feat/roadmaps-list-2&t=1. Covered by tests: 37–43 (unit and database). QA re-checks by hand: the phone table (step 4), the look at every width against RMDesk/RMPhone/RM1920/RMTableDesk/RMTablePhone/RMArchDesk. Review: docs/roadmaps/review-2.md, 8 of 9 findings fixed, one left by design. Next: part 3, the board round 3.
