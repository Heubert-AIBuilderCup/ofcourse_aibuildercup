**Smoke test — Your road** · local dev · `http://localhost:3000`

**Before you start**
- `bun run dev` running; a student who has finished onboarding (step 00 answered, coins spent or left for later). The first arrival shows once per browser: clear the site's storage (`ofcourse:road-arrived`) to see it again.
- Check light and dark at 390, 768 and 1440 (and 1920 for the scale).

**1 · Into the road** — AC 6, 7
```
Go to   /onboarding/done (just after finishing), then /, then /onboarding
Do      press "Go to your road"
See     /road; / and /onboarding land a finished student on /road; a student who has not finished is sent to her onboarding step
```

**2 · First arrival** — AC 4
```
Go to   /road in a fresh browser
Do      read, then press anything
See     the duck at Australia, the hint on Perth "Tap Perth to see its courses."; any press ends it; the next visit starts at the course
```

**3 · Zoom and the map** — AC 2
```
Go to   /road at 1440
Do      Whole road · Level · Tile, − and +; the wheel; pinch on a trackpad; drag; resize the window
See     three stops, a 0.55 s move (a cut with reduced motion), the overview at Whole road with "Back to the walk", the map re-fits on resize, a drag stops with some road still on screen; the year ruler and the slabs as long as each step
```

**4 · One press, then the card acts** — AC 3
```
Go to   /road
Do      press Data Science · Swap onto your road · Undo · press Student visa · 500 · Back to Cyber Security · press Perth at Whole road
See     the card opens (nothing on hover); the swap on the arc, the toast with Undo, Undo puts it back; the look-ahead card; a press at Whole road goes to Level centred on Perth first; "Back to Perth" opens Perth
```

**5 · The stack and the lesson** — AC 4, 8, 10
```
Go to   /road?tile=more-courses-perth
Do      Show 13 more courses · filter · Put on my board on Information Systems · Undo · Back · open "? What happens here · 3-min lesson" · Later · open it again · Done reading
See     the list with filters (URL gains open=list; Back closes it); the added tile tagged "Added · from your stack" with its toast; the lesson at /road/learn/masters-years in the card column, Later closes it, Done reading shows "Lesson read. The Master's years now show as looked at." and the Master's and the 485 turn dim
```

**6 · Links out and the URL** — AC 8, 9, 11
```
Go to   /road?tile=data-science-uwa-perth, then /road?tile=nowhere&zoom=huge, then the here-card's "Open route detail"
Do      open each
See     the deep link opens Data Science's card at Level; bad values are dropped quietly (the default board, no error); route detail is a placeholder for the next round with a way back
```

**7 · Phone** — AC 1, 5, 14
```
Go to   /road at 390
Do      Road / Map · press a row · Escape · Map: press a tile · open the stack and the lesson · /road?tile=data-science-uwa-perth
See     the vertical road (an ordered list, dates leading each kicker, the duck on the line above her card, "Also in Perth" under it, scrolled to her card); a row opens a bottom sheet (Escape closes it); Map shows the peek card; the controls bar Ask · 1, Weights, Compare; the deep link scrolls to the row and opens its sheet
```

**8 · The lock** — AC 19 (added 13 Oct)
```
Go to   /onboarding/done as a student who has not pressed "Go to your road" yet; press it, then press Back; then open /, /start, /onboarding, /onboarding/facts
Do      open each
See     the board opens straight away; every one lands on /road; Back never shows an onboarding step. For now /onboarding/done stays open. Before pressing "Go to your road", the steps stay open and /road sends her to "You're all set"
```

**No need to click** — AC 2, 3, 9, 10, 11, 12, 16 (model and component unit tests: camera, scene, press, URL parse/serialize and history rules, deep links, Back closing the list and the lesson, the redirect) · AC 17 (`e2e/your-road.e2e.ts`: 5 passed) · AC 18 (below).

**Screenshots against the Board page** (390, 768, 1440, 1920, light and dark; the canvas renders come from the reference build) — the board, the zoom stops, Whole road with the overview, the stack list, the lesson, the alternative's card, look ahead, and the phone Road, Map and sheet match. Differences:
- The canvas renders show a broken image for the duck and the guide's icon (their image links resolve only on the canvas); the app shows the duck.
- Button labels are Barlow Condensed in the app, the design system's heading face; the renders show Barlow because the canvas's button stylesheet was not loaded outside the canvas.
- At Whole road the app opens the overview in the card column, as the spec says; the canvas's Whole road board without the overview panel shows the here-card instead.
- The pressed tile's dashed ring and the duck's position differ by a few pixels at the Level stop.

**Not in this round** — the goal picker, Layers, Ask's preview and banner, the weights sheet, Compare, route detail's screen, the futures switcher: their controls are in place and do nothing.

**Worth a glance** — a known flaky Providers unit test (device-theme cookie) fails about one run in three; unrelated.

**Build report** — each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 1 · model: data, scene, camera, URL, press | opus | 9m 07s | 141,830 | `8f25713` |
| 2 · routes, access, hand-off | opus | 3m 58s | 67,300 | `279ab30` |
| 3 · board, map, camera, card column | opus | 14m 33s | 307,097 | `dc3512b` |
| 4 · card actions and states (finished an interrupted run) | opus | 2m 27s | 95,862 | `54b7ab6` |
| 5 · phone, sheets, Note shared, empty road, e2e specs | opus | 14m 13s | 265,027 | `9286a6a` |
| **Total** | | 44m 18s | 877,116 | 5 |
Tokens are the subagents' own; the interrupted first run of task 4 reported no usage. Controller: the lint exclusion for the design reference (`a736139`), the e2e spec fixes (`aa8e55b`), the reference renders and the screenshot comparison. Wall clock, plan to handover: about 1 h 25 min.

**Result**
Not run by the developer yet.
