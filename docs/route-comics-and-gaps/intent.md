---
title: Turn a path into a story comic, and see which paths need one
author: Nikhil
---
# Turn a path into a story comic, and see which paths need one
_Intent written 12 Oct 2026 with Nikhil, from a brainstorm in the build session. No ticket. Admin slice 2; follows `docs/admin-feed-post-from-source/intent.md` (stories 1–13)._

## Problem

A student choosing a course cannot picture what a path would mean for their life: "rent about 30% lower" is a number, not an experience (`docs/decisions/000-context.md:84`, "Why comics"). The decision record puts route comics and a frequency-ranked gap list in the hackathon entry (ADR-015, ADR-036, ADR-037, ADR-054 "never cut", ADR-057), but neither exists: the admin has no way to make a comic, and nothing records which paths students meet, so nobody can see which ones have nothing to show them. Futures are computed on each visit and never stored (`src/features/engine/futures.ts`, `src/app/(app)/futures/page.tsx:22`); there is no comic template, character sheet or comics brand in the content engine. Separately, editors approve feed-post text before covers are drawn, but never see what a cover will show until it is drawn (story 13, criterion 102).

## Proposed outcome

An editor turns a path (a city and a course from the catalogue) into a short, relatable story comic without writing a prompt: Gemini proposes the story as a storyboard, the editor shapes it, and only then are panels drawn, in one consistent character and the page's art style. A reviewer publishes it; students meet it in the feed and on its public page. An Insights tab shows which paths students are shown most that have no comic yet, each one click from a new comic. Feed posts gain the same storyboard step before their covers are drawn.

## Affected users and systems

- **Editors and superadmins** make comics, set the comic art style, approve the character, and use the Insights tab.
- **Reviewers and superadmins** approve and publish comics.
- **Admins** see Insights and comics read-only (ADR-108).
- **Students** read comics in the feed and on public pages.
- **Systems:** the content engine (`src/features/content/`), the student feed and public pages, the Page styles screen (ADR-130), and Jenish's student slice: the catalogue (`src/features/engine/catalogue.ts`), the futures page (one counting line), and the futures cards (an optional component placement).
- **Decision owners:** Nikhil (the admin slice); Jenish (the counting line and the card placement in his slice).

## Scope

Admin (desktop): comics, the Comics page brand's style, the character sheet, the Insights tab, the storyboard step for comics and feed posts. Student surfaces: the feed (`/feed`), the public post pages (`/posts/<slug>`), and a component Jenish can place on his futures cards. Local development and the Cloud Run deployment. Comics use one gender-neutral character for now.

## User stories

1. As an editor, I want to turn a path into a short story comic by choosing and shaping, not by writing a prompt, so that students can see what life on that path could feel like.
2. As an editor, I want to set the comics' art style and approve the character before any comic is drawn, so that every comic looks like it belongs to OfCourse and shows the same person.
3. As an editor, I want to see a storyboard of what will be drawn, edit it, and only then draw and fine-tune, for comics and for feed posts, so that I never spend images on something I would not approve.
4. As an editor or reviewer, I want to see which paths students meet most that have no comic, so that I make comics where students actually look.
5. As a student, I want to read a comic about a path I could take, so that I can picture my life on it.

## Acceptance criteria

### 1. A story comic from a path

RC1. Given an editor on the admin, when they choose "New comic", then they pick a path (a city and a course) from the catalogue, and may add a one-line premise (up to 120 characters), an emotion (the story 13 chips or their own word) and nothing else; "Make storyboard" is unavailable until a path is chosen.
RC2. Given a chosen path, when "Make storyboard" runs, then Gemini proposes a story of 3 to 6 panels about a student's life on that path, built from the path's catalogue facts (city, course, university, years, fees, living cost, regional status, PR road, work rights) and the premise and emotion; the storyboard appears as panels, each with its caption laid out where it will be drawn and its art area describing the planned scene.
RC3. Given a storyboard, when the editor edits a caption or a planned scene in place, removes a panel, adds one, or reorders them (staying within 3 to 6), then the storyboard updates and the fit checks for each caption update as for slides.
RC4. Given a caption on the admin comic storyboard, when it is saved, then it states no exact figure by default; any number it does contain must match a catalogue fact of the path, or the caption is refused with the number named.
RC5. Given a caption on the admin comic storyboard, when it promises an outcome to the reader ("you will get PR", "guaranteed", "you'll definitely"), then it is refused with the words named (as the banned-phrase lint does).
RC6. Given an approved storyboard and an approved character sheet, when the editor presses "Draw panels", then each panel's art is drawn in the comics art style with the approved character sheet as the character reference, and each panel's caption is drawn by code; a drawn panel can be redrawn with a short note ("warmer light", "they look older") as another take, keeping the others.
RC7. Given drawn panels, when the comic is sent to review and approved and published, then it is live like a post: in the feed, on its public `/posts/<slug>` page, and exportable as an Instagram carousel for the Comics page; its last slide carries the "To find this again, search “OfCourse <title>”" line.

### 2. The comic art style and the character

RC8. Given the Page styles screen, when an editor opens the Comics page brand, then they can set its design language (art style, copy style, reference images) as for other pages (ADR-130); comics follow it.
RC9. Given no approved character, when an editor opens "Character", then they describe the character in a line (gender-neutral, a student aged 20–24 by default), Gemini proposes a character sheet as a storyboard of views (front, side, a few expressions) for review, the editor edits or approves the plan, then it is drawn; the editor can redraw with a note until satisfied and then approve it.
RC10. Given no approved character sheet, when an editor tries "Draw panels" on any comic, then it is refused with "Approve the comic character first."

### 3. Storyboard first, for feed posts too

RC11. Given a feed post with approved text, when the editor reaches covers, then each cover option's art area first shows its planned scene in words on the cover slide, editable in place; "Make covers" draws only after the editor approves the plans; a drawn cover can be redrawn with a short note as another take.

### 4. Which paths need a comic

RC12. Given students opening their futures on `/futures`, when their futures are shown, then each path in them is counted once per student per day, with no student identifier kept.
RC13. Given the admin, when an editor, reviewer or admin opens the "Insights" tab, then it lists paths ranked by how many times students were shown them in the last 30 days, each with its count, its comic status (none, in progress, live) and, for editors, "Make comic", which opens a new comic with that path chosen.
RC14. Given fewer real counts than a demo needs, when Insights is shown, then any count that is not from real views is labelled "mock".

### 5. Students read comics

RC15. Given a live comic, when a student opens the feed, then the comic appears as a card like a post, matched by the path's destination tag, and opening it shows its panels one per swipe on a phone; a signed-out visitor sees it on its public page.
RC16. Given a live comic for a path, when Jenish's futures cards place the comic component for a future with that path, then the card shows the comic's cover panel linking to it; with no live comic, nothing shows.

### 6. What students were shown, per path (added 14 Oct 2026)

_As the content team, I want to see how each path was pitched to students (as which future, with which strengths and costs, or out of reach), so that we make content that answers what students actually see._ Decided by Nikhil on 14 Oct 2026. The pros and cons come from Jenish's futures code (`strongOn`, `costsOn`, the lines and `keepOpen` in `src/features/engine/futures.ts`), not from Gemini, so they are recorded exactly as shown.

RC17. Given students' futures on `/futures`, when they are first shown and each time they redraw after the student changes an answer, then each path shown is recorded anonymously with the future it appeared as (cheapest, staying or career), its strengths and its costs as shown. A path offered as out of reach is recorded with how much it was over budget. No answer of the student's and no student identifier is kept, and the totals of RC12 still count a student once per path per day.
RC18. Given the Insights tab, when an editor, reviewer or admin opens a path's details, then they see:
- its showings in the last 30 days, split by the future it appeared as;
- the strengths and costs students saw, each as the share of showings ("strong on cost 80% · costs on PR 60%");
- its lines as students see them (time, work, PR, career);
- how often it was out of reach and by how much on average;
- its comic status and "Make comic" (RC13).
A path never shown reads "Not shown to students yet".
RC19. Given Jenish's futures page, when it adds the documented first-draw line and calls the documented action on redraw, then showings are recorded. Until then, Insights shows the labelled mock counts of RC14 and no strengths or costs.

## Edge cases

- **A character sheet not approved:** drawing refused (RC10). From the decisions (ADR-096, ADR-098) and the PM.
- **The daily image cap reached while drawing:** the panels drawn so far are kept and the rest read "Daily image limit reached" with "Draw remaining" (RC6). From the code (criterion 6's pattern, `ai/client.ts` caps).
- **A caption number not in the path's facts:** refused (RC4). From the PM ("comics can be more lenient", with this safety net).
- **A caption that promises an outcome:** refused (RC5). From the decision record (never predict a personal outcome) and the PM.
- **A path removed from the catalogue after a comic is made:** the comic keeps the facts it was made from (RC2). From the code (immutable records, ADR-111).
- **A student counted twice the same day for the same path:** counted once (RC12). From the PM.
- **No counts yet:** Insights shows mock counts, labelled (RC14). From the PM.
- **A path with no live comic on a futures card:** nothing shows (RC16). From the PM.
- **Persona variants (male, female, neutral per student answer):** decided out of scope for now by Nikhil; one gender-neutral character.
- **A redraw that shows the same futures again**: recorded as another showing (RC17); the daily unique totals are unchanged (RC12). From the PM ("first draw + each redraw").
- **Exact figures in comics:** decided out of scope by Nikhil ("comics are not for that; infographics could have more control").
- **A "possible story" label on comics:** not chosen; decided out of scope by Nikhil.

## Constraints

- **Deadline:** built overnight on 12–13 Oct; demo video 16 Oct; submission 17 Oct.
- **Cost:** each comic draws 3–6 panels, and character-sheet drafts draw images too, all within the daily image cap (60 today).
- **Model rules:** the editor never writes a prompt from scratch; they edit what Gemini proposes (ADR-129). Gemini draws the art, code draws every word (ADR-008, ADR-054).
- **Legibility:** captions follow the feed posts' legibility floor (11 px at 328 px, ADR-112).
- **Design:** the Industry design system for the admin; the Comics page brand's style for the comics.
- **Data:** counts are anonymous (ADR-021).

## Out of scope

- Persona variants per student answer (later; ADR-019 and ADR-029 stay the direction).
- An art style per comic (one shared comics style now).
- The rest of Insights: Ideas, Maintenance, Parsing (later slices).
- Which answers students correct on a path, reminders set, and an across-all-paths summary of strengths and costs: decided out of scope by Nikhil, 14 Oct 2026.
- Comic videos (ADR-041).
- Logging student questions.
- Placing the comic on Jenish's futures cards: his slice places the component this slice provides.

## Dependencies

- Jenish: one counting line on the futures page (RC12); placing the comic component on his futures cards (RC16). Until the counting line lands, Insights shows labelled mock counts.
- The catalogue's facts (`src/features/engine/catalogue.ts`, `types.ts`).
- Story 13 (versions, emotion chips, the art check, page styles, public pages) on `feat/submission-readiness`.

## Open questions

1. The Comics Instagram handle (placeholder `@ofcourse_comics`). Owner: Nikhil. Does not block.
2. The comic art style's description and reference images for the Comics page brand. Owner: Nikhil. Does not block (a default style is used until set).
3. Whether to raise the daily image cap for the demo. Owner: Nikhil. Does not block.
4. When Jenish adds the counting line and places the comic component. Owner: Jenish. Does not block (mock counts until then).
