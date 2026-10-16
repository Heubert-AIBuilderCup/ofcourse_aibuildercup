---
title: "Your road: the board after onboarding (round 1, direction B)"
author: Jenish
---

# Your road: the board after onboarding (round 1, direction B)

Written 12 Oct 2026 by Jenish, in the repo (no ticket). Spec: `docs/timeline-board/board-reference/design-prompt.md` (v2, direction B), the source of truth for behaviour, copy and data; quote its copy exactly. Reference build from the canvas: `docs/timeline-board/board-reference/board-reference/` (`RoadB.dc.html`, `road-logic.txt`, `road.css`, `login.css`): reuse its geometry, scene data, camera maths and label rules, rewritten in this repo's stack, components and conventions. Visual reference: the Board page of the OfCourse canvas, https://claude.ai/artifact/CvDM8Q8ZzzKcVhWTo5B4Zr. Below, "spec §n" means a section of `design-prompt.md`.

## Problem

Onboarding ends on "You're all set" and leads nowhere. The handoff's timeline board is the screen after onboarding: one road from where she is to permanent residency, tiles on an isometric map, the duck where she is, explored rather than decided.

## Proposed outcome

"Your road" at `/road`: the board a finished student lands on, built from the direction B design: three zoom stops, the road ahead laid out in time, one press opens a tile in the card and the card's buttons act, and on a phone a vertical road with the map one tap away. Priya's mock data behind the interface real data will use.

## Decisions (Jenish, 12 Oct 2026)

- The screen is called "Your road" (ADR-002 keeps "path" for explanations). URLs: `/road`, never `/board` or `/path`.
- The three futures: the staying road only in this build. No switcher and no `future` param; options A and B wait for real futures data.
- What she does on the board (walks, swaps, Put on my board, lesson read) is held in the session with Undo; nothing is saved to her profile this round (saving needs real data and a migration: its own slice).
- Onboarding's flow stays as it is. "You're all set" has one action: the primary "Go to your road" (to `/road`), replacing "Back to Your attention" (the canvas will be updated to match). A finished student (coins stored, spent or later) lands on `/road` from `/`, sign-in and the bare `/onboarding`; each onboarding step stays reachable by its URL. *(Replaced 13 Oct, below.)*
- 13 Oct 2026, after the smoke test: onboarding locks when she presses "Go to your road", which records that she finished; from then every onboarding URL, "You're all set" included, takes her to `/road`, and Back from the board never shows onboarding again. Until she presses it (coins stored or not), onboarding stays open and she can change her answers. The arrival animation the canvas draws for that press (boards RBArr*) was built, then dropped the same day: the press takes her straight to the board, and nothing on the way pretends to load. For now "You're all set" stays open after the press.

## Scope

In: the board screen and its states; the map and camera; press-to-card; the phone Road view; the routes `/road`, `/road/learn/masters-years`, `/road/route/<route-id>` (registered and linked, screen next round); the query state; the mock data module; "You're all set" → `/road`; landing for a finished student; both themes; unit tests and the end-to-end checks listed below.
Out (leave the controls in place, wire nothing): the goal picker, Ask's preview and banner, the weights sheet, Layers, the route detail screen, Compare, Find, the feed, the composer, the futures switcher.

## Acceptance criteria

The board (surface: `/road`, every width)

1. Header: the wordmark, the tag, "Ask · 1", "Compare" and the existing menu, per spec §2 and §3 for each size. Body: an isometric map plus a card column at 1024px and wider; stacked below 1024: map, card, then a controls bar; phone (below 576): a "Road" / "Map" switch. Layout follows the container-query breakpoints and rem sizing; 1440 scales to 1920 as onboarding does.
2. The map, per spec §4 and the reference camera: three zoom stops (Whole road, Level, Tile); it re-fits on load and on every resize; wheel, trackpad pinch, touch pinch and drag-to-pan, with the pan clamped so some of the road stays on screen; a 0.55 s log-scale camera move, cut to the new stop under reduced motion; the time ruler beside the road ahead; slabs as long as each step lasts; lit / dim / dark / looked-at / dotted states.
3. One press = one meaning: a tile press opens that tile in the card (phone Road: a bottom sheet; phone Map: the peek card). The card's buttons act: Swap onto your road, Show 13 more courses, Look ahead, Go to Perth, Cancel / Back to <here>. A press at Whole road first moves the camera to Level, centred on that tile. No hover-to-act anywhere.
4. The states of spec §8, boards 2–12 and 14–15: city level open; alternative pressed; swap on the arc, then after with the Undo toast; look ahead; the stack with filters, and Put on my board with Undo; the lesson, then lesson read; Whole road with the overview; the map key in View; first arrival with the duck hint; "You're all set" with "Go to your road"; the empty map. *(Loading struck 13 Oct: the road is mock data with nothing to wait for, so nothing pretends to load; a loading state comes with real data.)*
5. The phone Road view: the road line is the card's left edge where she is, with the duck on the line above the card; dates lead each step's kicker; on arrival it scrolls so the card (or what just changed) is in view.
6. "You're all set": its one action is the primary "Go to your road", to `/road`.

Routes and state (surface: the URL)

7. `/road` is the board; "Go to your road" goes there, and so does a finished student from `/`, sign-in and `/onboarding`. If onboarding isn't finished, `/road` redirects to where she left off in onboarding.
8. `/road/learn/masters-years` is the 3-min lesson, over the board: a sheet on phone, the card column on desktop. `/road/route/<route-id>` is registered and "Open route detail" / "Open route detail at this step" link to it; its screen is next round.
9. Query state, defaults omitted: `tile` (a tile's stable id; none by default; removing it closes the card), `zoom` (`whole` | `level` | `tile`; default `level`; `whole` also shows the overview), `view` (`road` | `map`; default `road`; phone only, ignored at 576px and wider), `open` (`list`, only with a stack tile, e.g. `?tile=more-courses-perth&open=list`).
10. Stable ids for every slug, never display names. Pressing a tile, changing zoom or switching Road/Map replaces the history entry; opening the stack list, the lesson or route detail pushes one, so Back closes it. Toasts, Undo, the swap animation, the View menu and the map key stay out of the URL.
11. An unknown `tile` id or a bad param value is dropped quietly and the board opens at its default; no error screen. A deep link to `/road?tile=…` opens the board at the Level stop centred on that tile with its card open; on phone the Road view scrolls to that row and opens its sheet.

Data and rules

12. Priya's mock data (spec §5) lives in one fixture behind the interface real data will use, with stable tile and route ids, out of the components; dates after 2028 are marked "a guide · mock".
13. Copy: short, plain, sentence case; no exclamation marks or emoji; never "best", "recommended" or "ranked". The light map field is #0062c4 with white type, dark is Industry steel; never colour alone (spec §10).
14. Accessibility (spec §10): every tile is a real button, at least 44px, named "<name>, <state>. Open in the card", with `aria-pressed`; zoom is a button group labelled "Zoom"; toasts and zoom changes go to a polite live region; Escape closes sheets and the View menu; the phone Road view is an ordered list.
15. Motion (spec §9); under reduced motion: no bob, no pulse, the camera cuts, a swap jumps to its end state.

Done means

16. Unit tests for: the camera fit per stop and size; the scene builder; press-to-card; parsing each URL param (defaults omitted, bad values dropped); the replace and push history rules; a deep link restoring tile, zoom and view; Back closing the lesson and the stack list; the onboarding redirect.
17. End-to-end checks for: zoom stops via buttons and wheel; swap with Undo; the stack opening; the lesson opening and closing; the phone Road/Map switch.
18. Screenshots at 390, 768, 1440 and 1920, light and dark, compared with the canvas's Board boards, with every difference listed.

Added 13 Oct (surface: "You're all set" → `/road`, every width)

19. Pressing "Go to your road" records that she finished onboarding (once; pressing again changes nothing) and only then takes her to `/road`; if saving fails she stays on "You're all set" with a short message and can press again. Once recorded, `/`, sign-in, `/start`, `/onboarding` and every `/onboarding/...` URL (for now not "You're all set") take her to `/road`, and Back from the board does not show an onboarding screen. Before she presses it, `/road` takes her to where she left off (with coins stored, "You're all set").
20. *(Dropped 13 Oct: the arrival animation from "You're all set" to the board.)*

## Constraints

- CLAUDE.md in full; `node_modules/next/dist/docs` before Next.js code (routing, `useSearchParams`, the history API with the App Router). Design tokens: map `login.css` onto the existing tokens; add none. Shared components own behaviour (`Button`, `Note`, the motion module).
