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
