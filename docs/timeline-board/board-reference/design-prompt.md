# OfCourse · the board after onboarding, round 1 of 2 (prompt for Claude Design) · v2, direction B

Work on OfCourse's canvas (https://claude.ai/artifact/CvDM8Q8ZzzKcVhWTo5B4Zr). It has Login, Splash, Onboarding and Board pages. Draw everything below on the Board page. Never overwrite or restyle an existing board; if you need to show a change to one (the "You're all set" link), draw it as a new board. Use the Industry design system already on the canvas. Quote every piece of copy below exactly. Where this prompt says "decide in the design", choose and label your choice on the board. Never add a product rule that isn't written here.

**What changed from v1 (direction B, chosen 12 Oct 2026).** The first take (A, now parked on the Later page) drew the brief as written. B keeps the content and changes how the board behaves:
- The map zooms in three fixed stops (Whole road · Level · Tile) and re-fits whenever its space changes.
- The road ahead is laid out in time: a ruler of years runs beside it, and a step that lasts is drawn as long as it lasts.
- One press means one thing: pressing a tile opens it in the card, and the card's buttons act. There are no hover verb pills and no click-to-act.
- The steps ahead are dark but named. The 3-min lesson is an offer, not a gate.
- Fewer controls: Overview becomes Zoom out; Pick a goal, Layers and the map key move into one View menu; Compare lives in the header only; the weights plaque docks bottom left.
- Phone: a vertical road is the main view, with the map one tap away.

## 1. What this screen is

This is the student's board: one road from where she is now (Point A) to where she wants to end up (Point B, here permanent residency), drawn as tiles on an isometric map. Each step is a level: destination, city, course, and then the route steps (visas, study, work, PR). At each level the board shows the tile she's on, one alternative beside it and one stack holding the rest. A rubber duck marks where she is. Past the course, the road is laid out in time. Her job here is to explore, not to decide. She walks the road, swaps the alternative onto it, looks ahead at the steps, and sees what each choice gives her and costs her. Nothing is ranked or recommended (DS-R1: never "ranked 1st", "best" or "recommended"). "Still exploring" is a state, not a nag. In the handoff the board is the "Decision Studio" board (ADR-095). The copy calls it "your road", and its pieces are routes, tiles and timelines.

## 2. Where it sits

- Entry: "You're all set" (kicker "Onboarding · done", the duck in its little pond, "Back to Your attention") leads here. Draw one new variant of that screen with the primary "Go to your road", keeping "Back to Your attention" as the secondary.
- A returning student who has finished onboarding lands here. ADR-047 says "Exploration persists. A tile once walked stays walked", so draw the board as she left it, at the Level stop on where she is. Nothing greets her (decided in the design).
- Header: the same single menu button as onboarding (top-right corner, person icon, a menu with the "Dark theme" switch and "Sign out"). Desktop and stacked: the "OfCourse" wordmark with the duck, the tag "Still exploring · rank when you're ready", "Ask · 1" and "Compare" (desktop only; stacked moves Ask and Compare to the controls bar). Phone: the wordmark (no duck) and the menu; the tag "Still exploring · ranking optional" sits at the top of the road and over the map.

## 3. Layout per size

The boards are fluid, drawn at 390, 768, 1440 and 1920. Phone is below 576px, stacked from 576 to 1024, side by side from 1024. The 1440 design scales to 1920 (the root font size grows to 4/3). Above 1920 the content stays in a centred frame.

- Desktop: the map fills the left, and a 23.75rem (380px) card column sits on the right with a hairline between them.
  - Over the map: top-left "← Back to Perth" (back to the parent tile). Top-right "View" (a menu: "Pick a goal", "Layers · off by default", then "Map key"). Bottom-right the zoom control. Bottom-left the weights plaque "Weighing · Adjust" with bars Cost, Time, Work, PR, Place, Career. Beside it the line "Years after 2028 are a guide · mock".
  - Hovering a tile lifts it 6px. If the tile has no label at this zoom, its name appears. Nothing acts on hover.
  - Pressing a tile opens it in the card (§6). Zoomed right out, a press first brings that part of the road close (Level stop, centred on it), then opens it.
  - The card column also holds what opens from the board: the stack list, the lesson, and at Whole road the overview.
- Stacked (576–1024): header, map, card (22rem, scrolls), controls bar. Same zoom and same press rule as desktop; no plaque (Weights is in the controls bar).
- Phone: header, then a two-way switch "Road" / "Map", then the view, then the controls bar.
  - Road (the default): a vertical road. A narrow road line with its nodes runs down the left; each step's date leads its kicker ("Late 2026 · Next · Route step"), so there is no date column. Where she is, the card spans the full width with the duck standing on the road just above it; the guide's words sit flat in the card (no inner box) and the badges sit side by side. "Also in Perth" (the alternative and the stack) is right under it. On arrival the road scrolls so the card is in view. The line "Dates after 2028 are a guide · mock" sits at the top.
  - Map: the same map as desktop. Over it: Back and View top-left, the zoom stops top-right, the tag under them. A peek of the card sits at the bottom: its kicker, name, one line and its primary action (plus "Cancel" when a pressed tile is open).
  - Pressing a row in Road, or a tile in Map, opens that tile's card as a bottom sheet (Road) or in the peek (Map).
  - The controls bar is a three-column `nav` labelled "Controls": "Ask · 1", "Weights" (with six tiny bars), "Compare". Overview is the Whole road stop.
  - The stack, Ask, the lesson, the weights, the overview and the map key open as bottom sheets.
- Object budget (ADR-051): about seven labelled objects on desktop and five on a phone at the Level stop. The year ruler and the road-ahead count sit outside that budget.

## 4. Zoom (new in v2)

- Three fixed stops, named on the control: "Whole road", "Level", "Tile", with "−" and "+" either side (phone shows the three names only). The control is a group labelled "Zoom"; the current stop is pressed.
  - Whole road: every tile, short labels ("Perth · 15 courses", "Master's", "485", "491 · regional", "191 · permanent", "Point B / Permanent residency") and the years. The overview opens in the card column (desktop) or as a sheet (phone).
  - Level (the default): the open level around where she is: the tile she's on, the alternative and the stack, each named with its ▲/▼ line; the parent with its line; the next step; the start of the road ahead and the "4 more steps · 2 ways to PR" plate.
  - Tile: one tile up close. Where she is, its label carries the name, up to two badges plus "+1", and the why line.
- The stop fits the map's space: on load and on every resize the current stop re-fits, so each size gets a full view.
- Input: the buttons; trackpad pinch, Ctrl + scroll and the wheel step one stop; two-finger pinch steps on touch; drag pans, and panning always keeps some of the road on screen.
- Looking at the road ahead (a pressed step past the course): the camera goes there and those steps carry their labels.

## 5. The road: Priya's mock data (fork layout, tl-model.js `buildClean`)

Priya: business degree, IELTS 7.0, cousin Anjali in Cannington, Perth. All figures are mock.
- Point A: "Point A". Kicker "You". "Business degree · 72% · IELTS 7.0 · AUD 36.5k a year for fees."
- Destination: "Australia". "19 cities to choose from."
- City level (cities fan down-left from the road):
  - On the road: "Perth". Tile line "Curtin Bentley: about 25 min from Anjali in Cannington". Card: "▲ Strong on PR, Work · ▼ Costs you on: Location. A capital that counts as regional: extra points and the longest post-study stay. Curtin Bentley: about 25 min from Anjali in Cannington · ECU Joondalup: about 50 min." Reason: "The city you picked".
  - Alternative: "Adelaide". "Nepali community: moderate · 3½-hour flight from Anjali". Card: "▲ Strong on Cost, PR · ▼ Costs you on: Career. Nepali community: moderate. A 3½-hour flight from Anjali in Perth." Reason: "The next closest fit: swap it onto your road".
  - Stack: "17 more cities", "4 match well". Verb "Show 17 more cities". Filters "All / Regional / Metro". Rows tagged e.g. "Strong match", "Good match", "Fair match".
- Course level (courses fan up-right from the road):
  - On the road: "Cyber Security", "ECU · Perth". Tile line "▲ Strong on PR, Career · ▼ Costs you on: Location". Card: "▲ Strong on what you weight most: PR, Career · ▼ Costs you on: Cost (only AUD 3k spare) and Location (far from the east-coast job market). ECU Joondalup: about 50 min from Anjali in Cannington." Reason: "The course you're on".
    - Badge "Several offerings · 3 intakes": "February, July and November 2027. Same course and trade-offs, so they share one tile."
    - Badge "Condition · IELTS 6.5 by March": "Entry needs 6.5 overall. You have 7.0, so it's met."
    - Badge "Fork ahead · at the 485": "After the 485 there are two ways to PR."
  - Alternative: "Data Science", "UWA · Perth". "▲ Strong on Career · ▼ Costs you on: Cost, PR". Card: "Strong demand in WA, but a bigger step from business. The road ahead re-routes through UWA." Badge "Condition · Maths unit in year 1": "UWA asks business graduates to take one statistics bridging unit."
  - Stack: "13 more in Perth", "3 match well". Verb "Show 13 more courses". Filters "All / Match well / Not yet reachable". Blocked rows read e.g. "Master of Nursing · Curtin · Needs a health bachelor's", tagged "Not yet reachable".
- Route steps, laid out in time (dates after 2028 are mock and marked so):
  - "Student visa · 500" (Late 2026): "Lodge once the offer and health cover are in hand."
  - "Master's · Cyber Security" (Feb 2027 – Dec 2028, a slab two years long): "Feb 2027 – Dec 2028, with an industry capstone."
  - "Graduate visa · 485" (from 2029): "Up to five years of work rights."
  - "190 · state nomination" (2031): "WA nominates you on your regional work years."
  - Fork, a thinner road after the 485: "491 · regional" (2031 – 2034) ("Five-year provisional visa.") → "191 · permanent" (2034) ("Permanent after three years of regional income.").
  - "Permanent residency" (2032), kicker "Point B": "Point B for this road."
  - The year ruler runs beside the road ahead on its up-right side: "Now", then 2027 to 2034.
- Tile one-liners use "▲ Strong on … · ▼ Costs you on …". "● Neutral" belongs to the trade-off lines in route detail and the futures, not to tiles. Tiles carry no "Might feel" and no offsets.
- Badge vocabulary (fixed, at most two per tile plus "+n"): Condition, Blocker, Several offerings, Fork ahead, Out of date. Each has a Lucide icon (alert-circle, lock, layers, split, clock).

## 6. The duck, Point A and Point B

The duck is the same rubber duck as onboarding's pond. It stands on the current tile inside a white ring, bobs gently, faces the way it travels (DS-R9) and walks tile to tile. On the phone road it sits on the road line beside the card. Point A is the student's root, never a choice. Point B is the end of this road. In the card the duck speaks in first person ("Your guide"), and its facts carry a source line.

## 7. Interactions

One press opens; the card's buttons act. A pressed tile shows a dashed ring.
- The card at the current tile:
  - Kicker "You are here · Course".
  - Course actions: "What it asks for" plus "More" (from: Put on my board · Compare · Keep an eye on it · What it asks for · Try a taster · Ask about this course · Talk to a counsellor).
  - "On your board because: The course you're on". Badges as buttons that open their explanation.
  - Primary "Look ahead: Student visa · 500", secondary "Open route detail".
- A pressed place or course: kicker "Not visited · Course" (or "Visited · City"), its card text and reason, primary its verb ("Swap onto your road", "Go to Perth", "Walk to Data Science"), secondary "Cancel".
- A pressed stack: kicker "Stack · Course", primary "Show 13 more courses", secondary "Cancel".
- A pressed route step = look ahead. The duck stays. Kicker "Look ahead · the duck stays · Route step", the step's line, primary "Open route detail at this step", secondary "Back to Cyber Security".
- Walk: toast "Walked to Perth" with "Undo".
- Swap (ADR-056): the alternative and the road tile pass each other on a short arc so they never overlap. The road ahead re-routes ("Master's · Data Science"), the duck moves with it, and Cyber Security stays lit as visited in the alternative slot. Tag during the move: "Swapping onto your road". Toast: "Data Science is on your road now. The road ahead re-routed through it." with "Undo". Undo lives only in the toast (about 4.5 s, DS-E15). On the phone road the two rows trade places along the same arc.
- Stack: opens in the card column (desktop) or as a sheet (phone): title, "Close", the sub, filters, then rows with the course actions. "Put on my board" on a row: toast "Information Systems is on your board, beside your road. Data Science folded into the stack." with "Undo". The new tile is tagged "Added · from your stack".
- The road ahead and the lesson:
  - The road ahead is dark, named and counted: "4 more steps · 2 ways to PR", with "? What happens here · 3-min lesson".
  - The lesson opens in the card column (desktop) or as a sheet (phone): "Lesson · 3 min read · OfCourse learning" / "The Master's years, in 3 minutes".
    - "Two years of coursework, finishing with an industry capstone."
    - "During term you can work up to 48 hours a fortnight; in holidays, unlimited."
    - "Finish in a regional city like Perth and the Graduate visa (485) that follows can run up to five years."
  - Then "Later" / "Done reading". After "Done reading": toast "Lesson read. The Master's years now show as looked at." (new copy, decided in the design). Master's and the 485 turn from dark to dim.
- Fork marker: the 491 → 191 branch is a thinner road off the trunk after the 485, plus the "Fork ahead" badge on the course. Branch-and-return itself lives in route detail.
- Goal (in View, not drawn on the map): picker "Pick a distant goal" / "Every road that reaches it lights up." Choices "Settle in Australia", "Work in cyber", "Finish under budget". Rings and tags next round.
- Overview = the Whole road stop:
  - "You've looked at 3 of 11 routes", with a progress bar.
  - Rows: "Australia · 19 cities · 3 looked at", "Perth · 15 courses · 3 looked at", "Cyber Security · 3 intakes · walked", "Permanent residency · 2 ways from the 485".
  - Desktop line: "Counts per city and route. What you've looked at stays lit; the rest waits for you."
  - "Back to the walk" returns to the Level stop.
- Map key (in View): "What you can press": "Place tile · Opens it. Go here from the card." · "Stack · Opens it. Show more from the card." · "Route step · Look ahead. The duck stays put." · "Control · Does what its label says, always in the same place." "What the light means": "Visited · lit" · "Not visited · dim" · "Unexplored · dark, named" · "Not yet reachable · hatched" · "Dotted outline · data unknown or out of date". (The press lines change from v1 because a press now opens rather than acts.)
- One-time duck hint: a pulsing ring on the next tile, with the duck's line "Tap Perth to see its courses."
- Weights: the plaque (desktop) or the "Weights" control (stacked, phone). Its sheet, "What you're weighing", has sliders for Cost, Time to outcome, Work rights, PR pathway, Location and Career, then "Done". Next round.
- Ask: "Ask · 1" while one answer would change the picture, otherwise "Ask · quiet". Preview and banner: next round.
- Layers (in View): next round.
- Links out: "Open route detail" and "Open route detail at this step" go to route detail. "Compare" goes to Compare. Draw the links only.

## 8. Boards to draw in this round

Draw each at 390 (phone) and 1440 (desktop) unless noted.

1. At the course, the main board: 1440 and 1920 at Level; 768; phone Road and phone Map; the three zoom stops at 1440; a press from Whole road. (Done.)
2. City level open, at Perth: phone (Road).
3. Alternative pressed: phone (sheet) and desktop (card).
4. Swap during, on the arc: phone (Map).
5. Swap after, with the Undo toast: phone (Road) and desktop.
6. Look ahead at "Student visa · 500": phone (sheet) and desktop (card).
7. Stack "13 more in Perth" with filters: phone (sheet) and desktop (card column).
8. Put on my board from a row, with Undo: phone (Road).
9. Lesson open: phone (sheet) and desktop (card column).
10. Lesson read: phone (Road).
11. Whole road with the overview, and the map key: phone and desktop.
12. First arrival, with the one-time duck hint: phone and desktop. The duck starts at Australia, the hint ring is on Perth (decided in the design).
13. The three futures, both options in §12: phone and desktop.
14. "You're all set" with "Go to your road": phone and desktop.
15. Loading and an empty map: phone and desktop (decide in the design).

Next round, not now (leave their controls in place): the goal picker and its rings; Ask's preview, banner and "Ask · quiet"; the weights sheet; Layers; Bikash's everything-sealed board; the states and kinds reference sheets; an error state.

## 9. Motion

- The duck walks and tiles slide in 0.6 s (cubic-bezier(.3,.7,.3,1)).
- The camera moves between zoom stops in 0.55 s, scaling evenly (log scale), labels following.
- A hovered or pressed tile lifts 6px. The duck bobs 3px on a 2.4 s loop.
- Panels rise (fade in from 12px below): View in 0.2 s, the toast, sheets and card content in 0.3 s.
- The hint ring pulses on a 1.6 s loop. Toasts with Undo stay about 4.5 s, others 3.2 s.
- Swap: a shared-element move along the arc.
- ADR-045: tiles settle, the tile becomes the card, nothing pops in from nowhere.
- Reduced motion: show the final frame only. No bob, no pulse, the camera cuts between stops, a swap jumps to its after state.

## 10. Accessibility

- Every tile is a real button, at least 44px, named by the tile and its state, then what a press does: "Data Science, not visited. Open in the card". The pressed tile is `aria-pressed`.
- Keyboard: Tab moves through the tiles in road order, then the card, then the controls. Enter opens, the card's buttons act, Escape closes a sheet or the View menu. The zoom stops are buttons in a group labelled "Zoom".
- Screen readers hear: the duck as "You are here: Cyber Security"; zoom changes, toasts and the lesson's result in a polite live region; "Map key" in View; the plaque as "Weighing. Adjust weights". The phone's Road view is an ordered list of steps.
- Never colour alone (DS-R4, DS-R10): walked is lit, the alternative is off the road with its reason line, the road ahead is dark and named, sealed is hatched with a lock; unknown data has a dotted outline; a goal is a ring plus a tag; weights are bar heights plus labels; the pressed tile has a dashed ring, where she is a solid ring and the duck. The road ahead being dark never means impossible.
- Text on the blue field meets contrast (ADR-046).

## 11. Design system (Industry, as on the canvas)

- Type: Barlow Condensed headings over Barlow. Use rem, with 1px hairlines.
- Objects are square, hairline-framed blueprint objects with "+" corner marks on buttons. One primary action per view.
- The map is a brand field, like onboarding's panel. Light theme: #0062c4 with white type. Dark theme: Industry's steel. The light ground is #f2f2f3. Lit tiles are white, dim tiles white at about 30% over the field, dark tiles the field darkened.
- Copy is short, plain, sentence case. Buttons are verbs. No exclamation marks or emoji. Icons are Lucide at 1.5 stroke, 14/16/20px.

## 12. Open choices for the developer (draw the options, don't decide)

1. The screen's name. Drawn as "Your road". Possible: "Your path". ADR-002 lets "path" appear in explanations, "never as a choice".
2. How the three futures appear. Each future is a route, from R5 for Priya: "Built around staying" (Perth · Master of <field>, ECU · 190 state nomination, then PR), "Built around cost" (Adelaide · Master of <field>, UniSA · 491 regional visa, then PR) and "Built around career" (Sydney · Master of <field>, UTS · 485, then employer sponsorship).
   - Option A: the board opens on one road with a compact switcher between the three futures' roads, never numbered or ordered. ADR-011: "The Decision Studio board shows a single route at a time with a switcher."
   - Option B: a first view where she picks one of the three futures, then the board.
   - Show how switching futures (the whole road changes) differs from swapping Perth for Adelaide (one tile changes).
   - The other two roads are illustrative; mark them.
3. The composer. Draw without it and leave room under the card where it would dock.

## 13. Where the handoff disagrees: use these

- Layout: every state on the fork layout (one tile on the road, one alternative beside it, one stack at the end of each level line).
- Counts: "17 more cities" (4 match well) and "13 more in Perth" (3 match well).
- The Perth line: "Curtin Bentley: about 25 min from Anjali in Cannington".
- Point A's budget: "AUD 36.5k a year for fees".
- The kinds sheet says a route step opens route detail; use the look-ahead card, with route detail one action further.
- Controls bar (stacked and phone): "Ask · 1", "Weights", "Compare". The handoff's "Overview" control is the Whole road stop.
- Desktop hover verbs and click-to-act are replaced by press-to-open (B).

## 14. Not in this round

Find (the discovery deck), the feed, the companion, Compare and ranking screens, route detail itself (only the link to it), and Ask's answer flow.
