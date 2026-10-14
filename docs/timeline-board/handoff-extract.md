# The timeline board: everything the handoff specifies (full extract; round 2 of the design prompt is drawn from §7 and §12 here)

Work on OfCourse's canvas (https://claude.ai/artifact/CvDM8Q8ZzzKcVhWTo5B4Zr). It has Login, Splash and Onboarding pages. Add a new page called "Board" and draw everything below on it. Never overwrite or restyle an existing board; if you need to show a change to one (the "You're all set" link), draw it as a new board on the new page. Use the Industry design system already on the canvas. Quote every piece of copy below exactly. Where this prompt says "decide in the design", choose and label your choice on the board. Never add a product rule that isn't written here.

## 1. What this screen is

This is the student's board: one road from where she is now (Point A) to where she wants to end up (Point B, here permanent residency), drawn as tiles on an isometric map. Each step is a level: destination, city, course, and then the route steps (visas, study, work, PR). At each level the board shows the tile she's on, one alternative beside it and one stack holding the rest. A rubber duck marks where she is. Her job here is to explore, not to decide. She walks the road, swaps the alternative onto it, looks ahead at the steps, and sees what each choice gives her and costs her. Nothing is ranked or recommended (DS-R1: never "ranked 1st", "best" or "recommended"). "Still exploring" is a state, not a nag. In the handoff the board is the "Decision Studio" board (ADR-095). The copy calls it "your road", and its pieces are routes, tiles and timelines.

## 2. Where it sits

- Entry: "You're all set" (kicker "Onboarding · done", the duck in its little pond, "Back to Your attention") will lead here. Draw one new variant of that screen with a primary action to the board, keeping "Back to Your attention" as the secondary. The button's words follow the name choice in §11.
- A returning student who has finished onboarding lands here. The handoff draws no returning landing. ADR-047 says "Exploration persists. A tile once walked stays walked", so draw the board as she left it. Decide in the design whether anything greets her.
- Header: the same single menu button as onboarding (top-right corner, person icon, a menu with the "Dark theme" switch and "Sign out"). The handoff's desktop header also carries the "OfCourse" wordmark with the duck, "Ask · 1", "Compare" and a tag, "Still exploring · rank when you're ready". The phone draws the tag "Still exploring · ranking optional" over the board. Keep those items, and place them so they never collide with the menu button.

## 3. Layout per size

The boards are fluid, drawn at 390, 768, 1440 and 1920. Phone is below 576px, stacked from 576 to 1024, side by side from 1024. The 1440 design scales to 1920 (the root font size grows to 4/3). Above 1920 the content stays in a centred frame while the map's field fills the screen.
- Desktop (handoff frame 1280×800): the map fills the left, and a 380px card column sits on the right with a hairline between them. This mirrors onboarding, with its blue panel on the left and content on the right.
  - Over the map: top-left "← Back to Perth" (back to the parent tile) and "Overview". Top-right: the goal control ("Pick a goal", reading "Goal · Settle in Australia" once one is set) and "Layers".
  - The weights plaque is anchored just left of Point A (§6).
  - Hovering a tile shows its verb as a small dark pill under its label ("Go to Perth →", "Swap onto your road →", "Show 13 more courses →", "Look ahead: Student visa · 500 →"). A click acts at once, with Undo in the toast.
  - Labels: every tile on an open level line is labelled. The current tile gets the full label (name, up to two badges plus "+1", and its one-line why). The handoff notes: "Desktop labels Point A and the parent tile behind the duck."
- Phone (handoff frame 402×874): from top to bottom, the map with the duck at about 42% across and 62% down, then the card, then the controls bar.
  - Over the map: top-left Back, top-right "Goal" and "Layers".
  - Tapping a tile selects it, and the card offers the verb ("Walk to Data Science"/"Swap onto your road" with "Cancel"). Nothing moves on a single tap.
  - Labels: the current tile, its siblings on the open level and the next tile only. "Phone labels nothing behind the duck." The current tile shows its name and badges, without the why line.
  - The card is taller for a course (it holds the course actions) than for a place or step (handoff: 420 vs 290px).
  - The controls bar is a four-column `nav` labelled "Controls": "Ask · 1", "Overview", "Weights" (with six tiny bars), "Compare".
  - The stack, Ask, the lesson, the weights and the map key open as bottom sheets. The overview drops over the top of the map.
- Stacked (576–1024): the handoff doesn't draw it. Decide in the design, staying close to the phone order (map band on top, card below) as onboarding stacks its panel into a band.
- Object budget (ADR-051): about seven labelled objects on desktop and five on a phone. The road-ahead count sits outside that budget.

## 4. The road: Priya's mock data (fork layout, tl-model.js `buildClean`)

Priya: business degree, IELTS 7.0, cousin Anjali in Cannington, Perth. All figures are mock.
- Point A: "Point A". Kicker "You". "Business degree · 72% · IELTS 7.0 · AUD 36.5k a year for fees."
- Destination: "Australia". "19 cities to choose from."
- City level (cities fan up-right from the road):
  - On the road: "Perth". Tile line "Curtin Bentley: about 25 min from Anjali in Cannington". Card: "▲ Strong on PR, Work · ▼ Costs you on: Location. A capital that counts as regional: extra points and the longest post-study stay. Curtin Bentley: about 25 min from Anjali in Cannington · ECU Joondalup: about 50 min." Reason: "The city you picked".
  - Alternative: "Adelaide". "Nepali community: moderate · 3½-hour flight from Anjali". Card: "▲ Strong on Cost, PR · ▼ Costs you on: Career. Nepali community: moderate. A 3½-hour flight from Anjali in Perth." Reason: "The next closest fit: swap it onto your road".
  - Stack: "17 more cities", "4 match well". Verb "Show 17 more cities". Filters "All / Regional / Metro". Rows tagged e.g. "Strong match", "Good match", "Fair match".
- Course level (courses fan down-left from the road):
  - On the road: "Cyber Security", "ECU · Perth". Tile line "▲ Strong on PR, Career · ▼ Costs you on: Location". Card: "▲ Strong on what you weight most: PR, Career · ▼ Costs you on: Cost (only AUD 3k spare) and Location (far from the east-coast job market). ECU Joondalup: about 50 min from Anjali in Cannington." Reason: "The course you're on".
    - Badge "Several offerings · 3 intakes": "February, July and November 2027. Same course and trade-offs, so they share one tile."
    - Badge "Condition · IELTS 6.5 by March": "Entry needs 6.5 overall. You have 7.0, so it's met."
    - Badge "Fork ahead · at the 485": "After the 485 there are two ways to PR."
  - Alternative: "Data Science", "UWA · Perth". "▲ Strong on Career · ▼ Costs you on: Cost, PR". Card: "Strong demand in WA, but a bigger step from business. The road ahead re-routes through UWA." Badge "Condition · Maths unit in year 1": "UWA asks business graduates to take one statistics bridging unit."
  - Stack: "13 more in Perth", "3 match well". Verb "Show 13 more courses". Filters "All / Match well / Not yet reachable". Blocked rows read e.g. "Master of Nursing · Curtin · Needs a health bachelor's", tagged "Not yet reachable".
- Route steps (smaller tiles), each step with its card line:
  - "Student visa · 500": "Lodge once the offer and health cover are in hand."
  - "Master's · Cyber Security": "Feb 2027 – Dec 2028, with an industry capstone."
  - "Graduate visa · 485": "Up to five years of work rights."
  - "190 · state nomination": "WA nominates you on your regional work years."
  - Fork below it: "491 · regional" ("Five-year provisional visa.") → "191 · permanent" ("Permanent after three years of regional income.").
  - "Permanent residency", kicker "Point B": "Point B for this road."
- Tile one-liners use "▲ Strong on … · ▼ Costs you on …". "● Neutral" belongs to the trade-off lines in route detail and the futures, not to tiles. Tiles carry no "Might feel" and no offsets.
- Badge vocabulary (fixed, at most two per tile plus "+n"): Condition, Blocker, Several offerings, Fork ahead, Out of date. Each has a Lucide icon (alert-circle, lock, layers, split, clock).

## 5. The duck, Point A and Point B

The duck is the same rubber duck as onboarding's pond. It stands on the current tile, bobs gently, faces the way it travels (DS-R9) and walks tile to tile. Point A is the student's root, never a choice. Point B is the end of this road. In the card the duck speaks in first person ("Your guide"), and its facts carry a source line.

## 6. Interactions, with the handoff's copy

- Walk: card primary "Walk to Cyber Security", or on desktop a click. Toast "Walked to Perth" with "Undo".
- Card at the current tile:
  - Kicker "You are here · Course".
  - Course actions, two plus "More" (from: Put on my board · Compare · Keep an eye on it · What it asks for · Try a taster · Ask about this course · Talk to a counsellor).
  - "On your board because: The course you're on".
  - Badges as buttons that open their explanation.
  - Primary "Look ahead: Student visa · 500", secondary "Open route detail".
- Select (phone): kicker "Not visited · Course", primary "Swap onto your road" or "Walk to …", secondary "Cancel".
- Swap (ADR-056): the alternative and the road tile pass each other on a short arc so they never overlap. The road ahead re-routes ("Master's · Data Science"), the duck moves with it, and Cyber Security stays lit as visited in the alternative slot. Tag during the move: "Swapping onto your road". Toast: "Data Science is on your road now. The road ahead re-routed through it." with "Undo". Undo lives only in the toast (about 4.5 s, DS-E15).
- Look ahead (route step): the duck stays. Kicker "Look ahead · the duck stays · Route step", primary "Open route detail at this step", secondary "Back to Cyber Security".
- Stack: opens the sheet (title, "Close", the sub, filters, then rows with the course actions). "Put on my board" on a row: toast "Information Systems is on your board, beside your road. Data Science folded into the stack." with "Undo". The new tile is tagged "Added · from your stack".
- Fog and the "?" lesson:
  - The unexplored road ahead is dark and counted: "4 more steps · 2 ways to PR", with "? What happens here · 3-min lesson".
  - The sheet: "Lesson · 3 min read · OfCourse learning" / "The Master's years, in 3 minutes".
    - "Two years of coursework, finishing with an industry capstone."
    - "During term you can work up to 48 hours a fortnight; in holidays, unlimited."
    - "Finish in a regional city like Perth and the Graduate visa (485) that follows can run up to five years."
  - Closing line "Finish reading and this part of your road is revealed.", then "Later" / "Done reading".
  - After: toast "That part of your road is now revealed". Master's and the 485 turn from dark to dim, labelled.
- Fork marker: the 491 → 191 branch is a thinner road off the trunk after the 485, plus the "Fork ahead" badge on the course. Branch-and-return itself lives in route detail, not on the board.
- Goal (a control, not drawn on the map):
  - Picker: "Pick a distant goal" / "Every road that reaches it lights up." Choices: "Settle in Australia", "Work in cyber", "Finish under budget".
  - With Settle chosen, rings go round each road that reaches it, with tags such as "Reaches it · 5 yrs", "Needs IELTS 7.5 first" and "5 of 12 reach it".
  - The card shows "Goal · Settle in Australia" with "2 of the 3 roads on your board reach it. Each needs the 485, then state nomination or the regional route."
- Overview (toggles to "Back to the walk"):
  - "You've looked at 3 of 11 routes", with a progress bar.
  - Rows: "Australia · 19 cities · 3 looked at", "Perth · 15 courses · 3 looked at", "Cyber Security · 3 intakes · walked", "Permanent residency · 2 ways from the 485".
  - Desktop line: "Counts per city and route. What you've looked at stays lit; the rest waits for you."
- Map key ("?"):
  - "What you can press": "Place tile · Go here. The duck walks there." · "Stack · Show more. Opens the list, filtered." · "Route step · Look ahead. The duck stays put." · "Control · Does what its label says, always in the same place."
  - "What the light means": "Visited · lit" · "Not visited · dim" · "Unexplored · dark, counted" · "Not yet reachable · hatched" · "Dotted outline · data unknown or out of date".
- One-time duck hint: a pulsing ring on the next tile, with the duck's line "Tap Perth to see its courses."
- Weights: on desktop, the plaque by Point A reads "Weighing · Adjust" with bars Cost, Time, Work, PR, Place, Career. On phone it's the "Weights" control. Its sheet, "What you're weighing", has sliders for Cost, Time to outcome, Work rights, PR pathway, Location and Career, then "Done".
- Ask (the control only):
  - "Ask · 1" while one answer would change the picture, otherwise "Ask · quiet". Pressing the quiet control shows the toast "Nothing to ask right now. None of your answers would change the picture."
  - The preview (draw it as a board state): "Preview · shown as outlines on the board". "If yes: Teaching seals and Accounting moves in · a new way to PR appears (491 → 191). Nothing changes until you confirm." On the map, outlined ghost tiles carry "If yes: a new way to PR" and "If yes: 1 more blocked".
  - After "Yes", a banner with "Got it": "Since you said yes to settling: Teaching is not yet reachable · Data Science moved onto your board · a new way to PR appeared." New tiles arrive fogged with "New".
- Layers ("Layers · off by default", like a map app; button "Layers · 1 on"):
  - "Roads not taken": faint outlines.
  - "What changed": a numbered log, e.g. "You said cost matters. Cost now weighs most on every road."
  - "Deadlines": the "Deadline front", "Feb intake closes 15 Nov", "6 weeks left", with "Move time forward · Oct 1".
- Links out: "Open route detail" and "Open route detail at this step" go to route detail (its header reads "← Back to the board · Route detail"). "Compare" goes to Compare. Draw the links only, not those screens.

## 7. Boards to draw

Draw each at 390 (phone) and 1440 (desktop) unless noted. The handoff preset is in brackets.
1. At the course, the main board [t-clean]: phone and desktop, plus 768 and 1920, plus dark theme at 390 and 1440.
2. City level open, at Perth [t-city]: phone.
3. Alternative selected (phone) and hovered with its verb (desktop) [t-swap1].
4. Swap during, tiles on the arc [t-swap2]: phone.
5. Swap after, with the Undo toast [t-swap3]: phone and desktop.
6. Look ahead at "Student visa · 500" [model state `look`, no preset]: phone and desktop.
7. Stack sheet "13 more in Perth" with filters [t-stack]: phone. Desktop: decide in the design.
8. Put on my board from a row, with Undo [t-boardadd]: phone and desktop.
9. Fog lesson open [t-learn]: phone and desktop. 10. Road revealed [t-learned]: phone.
11. Goal set, rings and tags [t-goal]: phone with the picker closed, desktop with it open.
12. Overview with the map key [c, legend]: phone and desktop.
13. First-time hint [hint]: phone.
14. Ask mark with the outlines preview [t-preview]: phone and desktop.
15. After "Yes": banner, Teaching sealed, the new way to PR [b]: phone and desktop.
16. Ask quiet, with its toast: phone.
17. Weights sheet (phone) and plaque (desktop).
18. Bikash, everything sealed [t-bikash]: phone and desktop (details below).
19. Layers [t-layers, t-sil, t-log, t-front]: phone, plus desktop for the deadline front. Lower priority: ADR-057 kept layers and goal as designed screens, not built logic.
20. Map key sheets [states, kinds] as one reference board (details below).
21. The futures, both options in §11: phone and desktop.
22. "You're all set" with its new link to the board: phone and desktop.
23. Loading, error and an empty map. The handoff only has the shared loader (the duck floating down a river, "Keep floating."). Decide in the design.

Bikash: Point A "Diploma in Computing · 68% · IELTS 5.5 · AUD 18k a year.", Sydney "Where you hoped to study."
- On the road, a hatched sealed stack: "9 courses in Sydney" / "None reachable yet" / "Show 9 blocked courses", with "Source: Entry rules: university 2027 admissions pages · checked 12 Sep 2026".
- Beside it, four tiles, kicker "One step away", reason "The nearest road that's open to you" (long title on desktop, short on phone):
  - "Adelaide · a cheaper city"/"Adelaide": "Opens 4 courses within AUD 18k".
  - "Diploma of IT · TAFE NSW"/"TAFE diploma": "Opens a Bachelor of IT in 2029, with a year of credit".
  - "Vice-Chancellor's scholarship · ECU"/"Scholarship": "Opens 2 courses in Perth at 25% off".
  - "Save for the July 2027 intake"/"July intake": "Opens 3 courses if you add about AUD 6k".
  - Each has its source line, e.g. "Study Adelaide cost guide · checked 12 Sep 2026".
- Card: the duck's line "Nothing in Sydney is open to you yet. That's a starting point, not a dead end. Here are four roads one step away, and what each one opens." Primary "Talk it through with a counsellor". The board is never blank.

Map key sheets:
- States:
  - "Visited" "Lit, full colour. You've been here."
  - "Not visited" "Dim, labelled. Next to where you've been."
  - "Unexplored" "Dark, no label. Counted: “4 more steps”."
  - "Not yet reachable" "Hatched, with a lock. The way past is inside."
  - Each again with "Dotted outline: data unknown or out of date".
- Kinds:
  - Place tile "Go to Perth": "The duck walks there; its card opens below."
  - Stack "Show 9 more cities": "The search drawer opens, filtered to the group."
  - Route step "Look ahead: Student visa": "Route detail opens at this step. The duck stays."
  - Control "Walk to Perth": "A real button with a verb, always in the same place."

## 8. Motion (durations from the handoff)

- The duck walks and tiles slide in 0.6 s (cubic-bezier(.3,.7,.3,1)).
- The camera pans and labels follow in 0.55 s (cubic-bezier(.2,.8,.2,1)).
- A hovered or selected tile lifts 6px. The duck bobs 3px on a 2.4 s loop.
- Panels rise (fade in from 12px below): the verb pill in 0.18 s, Goal, Layers and the preview in 0.2 s, the toast and sheets in 0.3 s, the banner in 0.35 s.
- The hint ring pulses on a 1.6 s loop. Toasts with Undo stay about 4.5 s, others 3.2 s.
- Swap: a shared-element move along the arc. The handoff's live frame moved in a straight line, so draw the arc.
- ADR-045: tiles settle, the tile becomes the card, nothing pops in from nowhere.
- Reduced motion: show the final frame only. No bob, no pulse (the ring stays still), the camera cuts, a swap jumps to its after state.

## 9. Accessibility

- Every tappable tile is a real button, at least 44px, whose name is its verb ("Go to Perth", "Swap Data Science onto your road", "Show 13 more courses", "Look ahead: Student visa · 500"). The handoff gives only the verb, so add the tile's state in words ("Perth, city, visited").
- Keyboard: the handoff is silent. Tab moves through the tappable tiles in road order, then the card, then the controls. Enter acts, and Escape closes a sheet. Decide the visible focus in the design.
- Screen readers hear: the duck as "You are here"; toasts, the banner and the reveal in a polite live region; layer rows as switches; "?" as "Map key"; the plaque as "Adjust weights".
- Never colour alone (DS-R4, DS-R10):
  - walked is lit, the alternative is the smaller tile off the road with its reason line, fog is dark and counted, and sealed is hatched with a lock;
  - unknown data has a dotted outline, a goal is a ring plus a tag, weights are bar heights plus labels;
  - fog never means impossible.
- Text on the blue field meets contrast (ADR-046).

## 10. Design system (Industry, as on the canvas)

- Type: Barlow Condensed headings over Barlow. Use the fluid roles (display, h1–h4, lead, caption, overline), never a size per breakpoint. Use rem, with 1px hairlines.
- Objects are square, hairline-framed blueprint objects with "+" corner marks. Cards are line drawings; the solid primary button is the one filled object. One primary action per view.
- The map is a brand field, like onboarding's panel.
  - Light theme: #0062c4 with white type (the handoff's #1877F2 ground with a 40px white grid becomes this blue). The light accent ramp is the brand blue: accent #0077ed, 600 #0062c4, 700 #00509f, 800 #003f7f.
  - Dark theme: the field is Industry's steel. The light ground is #f2f2f3.
  - Re-derive the handoff's road and tile shades for this field and check them in both themes.
- Copy is short, plain, sentence case. Buttons are verbs. No exclamation marks or emoji. Icons are Lucide at 1.5 stroke, 14/16/20px.
- Content widths come from Tailwind (max-w-sm, -2xl, -7xl, prose). Grids size themselves. No third breakpoint.

## 11. Open choices for the developer (draw the options, don't decide)

1. The screen's name. Suggested: "Your road". Possible: "Your path". ADR-002 lets "path" appear in explanations, "never as a choice". The drawn copy keeps road, routes and tiles either way.
2. How the three futures appear. Each future is a route, from R5 for Priya: "Built around staying" (Perth · Master of <field>, ECU · 190 state nomination, then PR), "Built around cost" (Adelaide · Master of <field>, UniSA · 491 regional visa, then PR) and "Built around career" (Sydney · Master of <field>, UTS · 485, then employer sponsorship).
   - Option A: the board opens on one road with a compact control to switch between the three futures' roads, never numbered or ordered. ADR-011: "The Decision Studio board shows a single route at a time with a switcher."
   - Option B: a first view where she picks one of the three futures, then the board.
   - Show how switching futures differs from swapping Perth for Adelaide on the board, since the cost future is Adelaide.
   - The handoff draws only the staying road. Draw the other two roads in the same shape and mark them as illustrative.
3. The composer. The handoff docks "Tell me in your own words" under the card (DS-F30). The app has none yet, so draw without it and leave room where it would dock.

## 12. Handoff contradictions (noted, not resolved; show the developer)

- The board's preset menu (fix, busy, hover, hint, a, b, c, legend, states, kinds) draws the pre-ADR-051/056 layout: up to four siblings, two stacks per level, and state words on tiles. The frozen fork layout is in the t-* presets. Redraw every state on the fork layout.
- After "Yes", the course that moves in is "Accounting" (preview text, the log), "Data Science" (phone banner, DS-FL4) or "Project Management" (desktop banner). The preview's tag on Teaching can't show, because Teaching sits inside the stack on the fork layout.
- The kinds sheet says a route step opens route detail. The model opens a look-ahead card first.
- Controls are listed as "Ask · Overview · Weights · Rank · Compare · Send · Back", but Rank and Send aren't drawn. Compare is always shown, against DS-E9 ("hidden until two ranked or added").
- The weights sliders run 0–4 in steps of 0.5, without reasons. DS-F9/DS-D3 say 0–3, capped, each with its reason.
- Counts: "13 more in Perth" against ADR-056's "12 more" and the goal tag "5 of 12". The kinds sheet's "9 more regional cities" against "17 more cities".
- The "Still exploring" tag reads differently on phone and desktop. ADR-040 makes a one-node-at-a-time staged view the phone default; the frozen phone shows the map.
- The hint starts the duck at Australia, but the fork boards start it on the course.
- The Perth line: "Your cousin lives in Cannington" (showcase) against "Curtin Bentley: about 25 min from Anjali in Cannington" (model). The budget: AUD 36.5k (Point A) against 36k (ADR-046).
- Onboarding now asks "stay" (step 04), so the handoff's one Ask question ("Do you want to settle in Australia after you graduate?") is open only for a student who said "Not sure".

## 13. Not in this round

Find (the discovery deck), the feed, the companion, Compare and ranking screens, route detail itself (only the link to it), and Ask's answer flow (only the control and the board's preview outlines).
