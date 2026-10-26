**Smoke test — content source and settings** · local · `http://localhost:3000`

**Before you start**
- `bun run dev` (it applies migrations 0026, the `share` record, and 0027, the refused flag on AI calls, to your dev database)
- Signed in as an admin; a feed post at Settings and one that is live

**1 · Start from a blog** — criteria 1, 2, 4
```
Go to   /admin/posts/new
Do      "From a blog" is chosen · paste a blog link · pick a page · Make post
See     the post opens at its idea cards; no "Write the blog" anywhere
```

**2 · Start from an idea** — criteria 1, 3
```
Go to   /admin/posts/new · choose "From an idea"
Do      type an idea · Find sources · tick two · Go straight to the post
See     a feed post from those pages; again with "Write a blog first": a blog (Outline · Write the blog)
Other   /admin/posts/new?kind=blog opens on "From an idea"
```

**3 · Settings, one slide at a time** — criterion 5
```
Go to   a feed post at Settings
Do      click thumbnails in the filmstrip under the slide; arrow keys on it
See     the selected slide on top with every slide as a thumbnail below, the selected one marked; no sideways scrolling; at 1024, 1440 and 1920 it fits without scrolling
```

**4 · Feed settings as tabs** — criterion 6
```
Go to   the same post, Feed settings
Do      click each tab; arrow keys move between them
See     Source check with "Fix" while a claim is not found; the fields grouped under their headings
```

**5 · Disabled buttons explain** — criteria 7, 8
```
Go to   the same post with a claim not found
Do      hover the "!" badge on Send to review · Tab to it
See     Send to review is the right-most control; the badge explains what to fix
```

**6 · Share to several accounts** — criteria 9, 10, 11
```
Go to   a live feed post, its Live step
Do      Share stays unavailable (badge) until a box is ticked · tick @ofcourse_ai and @ofcourse_comics, and LinkedIn · Share
See     toast "Shared to Instagram: @ofcourse_ai, @ofcourse_comics · LinkedIn"; the share listed with your name
```

**7 · Gemini busy (429), handled** — added 17 Oct after the blog failed locally
```
Go to   a blog at its Outline · Write the blog (or Plan images on a post)
Do      nothing special; if Google is busy, watch the loader
See     "Google's model is busy (gemini-3.8-flash). Trying again in about 8 s (try 2)" while it waits;
        if Flash and Pro stay busy: "Flash and Pro are busy. Writing with Flash-Lite instead"
Other   afterwards, under the step rail on any screen of that post: "Written with Flash-Lite because Flash and Pro were busy: the blog text."
```
Hard to trigger on demand: the retries, the minute's budget and the fallback are pinned by ai/client.test.ts; this step is a glance if Google is busy while you test.

**8 · Framing shapes the whole post; Combine up to four** — added 17 Oct
```
Go to   /admin/posts/new · From a blog
Do      the Expert Education PR-courses link · framing "each slide should show one of the themes in australia to get a PR" · Make post
See     the top card is the whole post (one subject per slide); tick three or four cards · Combine works; a fifth tick is unavailable, its badge says why
```

**9 · Daily limits explained** — added 17 Oct
```
Before  locally, SUPPORT_EMAIL=nikhil@heubert.com and a low AI_DAILY_CAP_IMAGE (e.g. 1) in your .env
Do      draw a post's images
See     "Today's limit of 1 images is used up. OfCourse caps paid AI calls a day to keep costs down. It resets at 05:30 IST (midnight UTC). Need it sooner? Email nikhil@heubert.com."
Then    put your real caps back
```

**10 · Compact header on every step** — added 17 Oct
```
Go to   any post, each step in turn
See     "← Board / title" on one line (long titles end in …, full on hover), the rail under it, no big step heading; more of the cards, slides and fields fit without scrolling
```

**11 · No page scrolling, no fold-outs** — added 17 Oct · at 1440×900 and on your big screen
```
Go to   one post through every step: Ideas, Outline, Text, Images, Settings, Review, Live (and a blog's)
Do      click thumbnails in the filmstrip, arrow keys on it; switch the right-hand tabs; open a version's Details and Settings' "All checked sentences"
See     the page itself never scrolls; the selected slide fits with the filmstrip under it; Details opens as a narrow drawer from the right (not full screen), Escape closes it
Other   Text: Your version · Versions · Style · Redraft · Checks (n to fix) · Settings: To fix (first while anything blocks Send to review) · Images: This slide · Plan (n left to draw) · Order · Review: Facts · Source check · Feed settings · Live: Details · Share · Social versions
```

**12 · Red badge** — added 17 Oct
```
See     every unavailable button's "!" badge is red; hover or Tab to it explains what to do; Escape hides it
```

**13 · Checks, last and organised** — added 17 Oct (admin)
```
Go to   a post's Text step with something to fix (e.g. a sentence not in the source)
See     the tabs end with "Checks · n to fix"; Approve's red "!" says "n to fix: open Checks"; inside Checks: To fix cards (where · what · evidence · fix), one source-check line, fit checks as a table per slide
Other   an older post with no colour saved approves with the default (no "Choose a theme first")
```

**14 · The content board scrolls inside itself** — added 17 Oct (admin, from 1024 wide)
```
Go to   /admin
See     the page stays still; the columns scroll inside the board, their headers stay on top
```

**15 · Student board words and a steady map** — added 17 Oct
```
Go to   a roadmap's board
See     Whole road's overview has "Close overview"; a route step's card has "Open route detail at this step" (opens the step's detail) and "Back to where you are"; opening Your answers does not change the map's size
```

**16 · Other courses and jobs on the map** — added 17 Oct
```
Go to   the Adelaide IT board (or Public Health, UniSA)
See     up to 3 other courses beside the study step (dashed line), job tiles beside the Graduate visa 485; a course's card: fees, years, work rights, jobs, What changes, Start a new roadmap from it; a job's card: ANZSCO, sample pay and openings, list status, way to PR, Close
Watch   labels crowding beside the 485 at Level; the phone key strip (3 rows)
```

**17 · New roadmap: the road changes first, the swap last** — added 17 Oct
```
Do      on a course you could switch to, Start a new roadmap from it
See     the road ahead turns into the new roadmap's steps (names and dates change one after another, its own options and jobs fade in), then the two course tiles swap, then the draft opens; on a phone's Road view the draft opens at once
```

**18 · Outline grouped by part** — added 17 Oct
```
Go to   a post's Outline
See     slides under Cover · Middle · N slides · Takeaway; the point as the main text (wraps, 2 lines), Job and Layout as one quiet line, icons muted until hover; a slide out of order is named in one line
```

**19 · Use the source's wording from a later step; the badge's explanation not cut off** — added 17 Oct
```
Go to   a post past Text (Images or later) with a sentence not found · Text · Checks
Do      Use the source's wording
See     it works (the post moves back to Text, as other text edits do), no "moved on"; any "!" badge sits beside its button and its explanation opens fully visible
```

**20 · Download slides, both paths** — added 17 Oct
```
Go to   a text-only post's Images once rendered, then one with drawn pictures; then Settings, Review, Live
Do      Download slides (under the slide)
See     a zip of the slides (PNG + SVG, the pictures in them), named like page_title_slides.zip, with the caption when there is one
```

**No need to click** — the stored share record (server/social.test.ts on a test database) · the share rule by role and stage (lib/workflow.test.ts) · under test.

**After deploy only**
```
Run the migrations job (0026 the share record, 0027 the refused flag on ai_call) before switching traffic → Share writes a record; refused 429s stop counting toward the daily caps
```

**Worth a glance**
- Every other disabled button in the workbench now shows the badge, not a sentence beside it: check one on Images and one on Review.
- The badge's tooltip opens to the left: a button at the left edge of a narrow area could clip a long reason.
- The tooltip closes when the mouse or focus leaves, and on Escape.

**Build report** — each dispatch as its usage report gave it
| Task | Model | Time | Tokens |
| --- | --- | --- | --- |
| 1 · disabled badge | opus | 2m 30s | 40,432 |
| 2 · one-slide carousel | opus | 3m 28s | 55,247 |
| 2 · resume: Settings only, market too | opus | 3m 11s | 80,774 |
| 3 · settings panels as tabs | opus | 4m 31s | 67,957 |
| 4 · source starts | opus | 11m 16s | 85,491 |
| 5 · share to several accounts | opus | 16m 42s | 171,240 |
| **Total** | | 41m 38s | 501,141 |
Tokens are the subagents' own; this session's context is not in them.
