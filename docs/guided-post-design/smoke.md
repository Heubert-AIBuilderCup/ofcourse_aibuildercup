# Smoke test · guided post design · branch `feat/guided-post-design`

_Built overnight 12–13 Oct 2026 (Tasks 1–15, 19 commits on top of story 14). Local, `bun run dev` on localhost:3000. Test story 14's steps (`docs/admin-feed-post-from-source/smoke.md`, S16–S22) on this branch too: it holds both._

**Smoke test — guided post design** · local · `http://localhost:3000`

**Before you start**
- Restart `bun run dev`. Migrations 0008 (story 14) and 0009 (idea cards) are already applied to your database; the restart reloads the code.
- `AI_PROVIDER=vertex` to see real looks, ideas and scenes. Images count against `AI_DAILY_CAP_IMAGE` (60): Field Notes spends 3–4 a post, Data Desk and Postcard 1.
- An editor and a reviewer account (or a superadmin).

**G1 · Make post from links, a framing line and notes** — GD18, GD19, GD21
```
Go to   /admin/posts/new
Do      read the placeholders and help lines · paste two article links and one broken one · write a framing line · add a note · Make post
See     the broken link listed "Could not read this page" while the others are read; facts come from both articles; slides name "Sources: a, b"
```

**G2 · Idea cards** — GD1, GD3, GD7, GD20
```
Go to   the post after Make post (it opens on /ideas)
Do      read the cards · press "More ideas"
See     your framing line above 4–6 cards (angle, hook, for whom, look, slides); Postcard offered only when the articles name a place; more cards added, old ones kept
```

**G3 · Pick an idea; the versions** — GD2, GD4, GD22, GD23, GD25
```
Go to   /ideas
Do      "Use this idea" (or tick two and "Combine")
See     /text opens: three versions drawn in that look, each with readable slides in a strip, "Ready" or "<n> to fix" with the fix named, Details closed, facts as ¶ chips; step bar reads Source · Ideas · Text · Images · Review · Live
```

**G4 · Look and colour, no Gemini call** — GD4, GD9
```
Go to   /text
Do      switch a version between Field Notes, Data Desk and Postcard · switch Pop and Subdued
See     the slides redraw at once in the new look and colours (blue and yellow), with no wait for Gemini
```

**G5 · Edit the chosen version** — GD5, GD10, GD11, GD24
```
Go to   /text · "Use this version"
Do      pick a slide in the film strip · open Layout · press "Shorter" · "Use here" on a slide from another version
See     the large slide with its fields; Number and Bars disabled with "needs a number from a fact on this slide" where true; Shorter redrafts only that slide; the slide from the other version replaces yours; the bar shows "All checks pass" and "Approve text → Images"
```

**G6 · Plan the images in words** — GD12, GD15, GD27
```
Go to   "Approve text → Images" (opens /images)
Do      "Plan images" · edit one planned scene in its picture area
See     each picture slide shows "Planned scene" and the words in its art area, no image yet; "Draw images (<n> images)" shows the count before anything is spent
```

**G7 · Draw, tint and nudge** — GD6, GD13, GD14, GD16
```
Go to   /images
Do      "Draw images" · press "Closer" on one image · "Swap image" back to the first take
See     every picture in the brand's blue-and-yellow treatment (Pop) or light wash (Subdued); only the nudged image changes; slide dots and "Swipe" on every slide but the last
Other   at the daily limit, drawn images stay and the rest read "Daily image limit reached" with "Draw remaining"
```

**G8 · One screen per step** — GD27
```
Go to   /admin/posts/<id>
Do      it redirects to the current step · click "Source" and "Text" in the step bar · try typing /review in the address
See     passed steps open read-only with "Back to …"; steps not reached are greyed; an unreached address opens the current step
```

**G9 · The source pane** — GD26
```
Go to   /source
Do      "Show article"
See     the article folded to its first lines until opened; key ideas shown whole; facts as numbered rows with "Add a fact from the article"
```

**G10 · Instagram version of a look post; old posts unchanged** — GD8, GD4
```
Go to   a published look post · Make Instagram version for a page
See     the version keeps the look, colours and the post's pictures
Other   open a post made before today (The line): it renders and adapts exactly as before, with "Make covers"
```

**No need to click** — GD15 and GD17 (the guideline in every prompt and a changed guideline flowing into presets, prompts and checks: `guideline.test.ts`, `draft.test.ts`, `caption.test.ts`, `art.test.ts`) · GD21 (a number only in your notes is refused: `commands.test.ts`) · under test.

**Live, by hand** — `bun run ai:smoke` now includes `ideas`, `scene_plan (field notes)` and `draft_slide (shorter)`; run it once on `applyims`.

**Needs a decision** — from Nikhil
1. **Brand blue and contrast.** White text on #1877F2 is 4.2:1, under the 4.5:1 the checks need. Blue text panels use a stand-in "deep blue" #1260D8 until your guideline says otherwise; the brand blue stays for images and tints. Keep, or send the guideline's rule.
2. **Key ideas cut off** in your 12 Oct screenshot: the cut found and removed was in the stand-in AI. If that screenshot was on real Gemini, tell me and I'll trace the other cut.
3. **Browser test scripts** (`bun run test:e2e`) still expect the old labels and the one long page; they are not run unless asked. Update them before the push, or leave for QA?

**Worth a glance**
- Swapping a slide's layout can leave a slot empty or over its limit (the slide then shows "1 to fix"): no Gemini call is spent, so you fill it.
- On Subdued, the second comparison bar is light blue on paper and reads faintly.
- "Plan images" shows only before a plan; there is no "Plan again" yet (edit scenes instead).
- Choosing a colour preset leaves no line in History.
- The art, voice and never-show values in `brands/guideline.json` are stand-ins until the guideline arrives.

**Verification, run by the controller on 13 Oct 2026**
```
bun run lint         Checked 549 files. No fixes applied.
bun run type-check   clean
bun run test:run     1913 pass · 291 skip · 0 fail · Ran 2204 tests across 175 files
DB suites            208 pass · 0 fail · Ran 208 tests across 11 files (src/features/content/server + ai/store-backed, one process, app_guided)
bun run build        Compiled successfully
```

**Build report** · each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 1 · brand guideline file, Pop and Subdued | sonnet | 2m 55s | 33,542 | `101b4b2` |
| 2 · three looks, layouts, surfaces, frame | opus | 19m 10s | 189,791 | `00ca70f` |
| 2 · fix: specs by layout everywhere, fake drafts any look, drawn bars | opus | 7m 57s | 48,677 | `e079a20` |
| 3 · image per slide, panorama, tint, planned scene | opus | 10m 48s | 132,281 | `69ea573` |
| 4 · swap layout, change look, choose preset | opus | 14m 15s | 195,515 | `91b9fa7` |
| 5 · the guideline in every prompt | sonnet | 7m 23s | 91,692 | `12c6c86` |
| 13 · links in, framing line, notes as opinion | opus | 21m 51s | 217,396 | `89ebd33` |
| 13 · fix: prompt test, link wording | sonnet | 3m 43s | 35,336 | `5e1f39c` |
| 6 · idea cards | opus | 22m 39s | 323,142 | `dbd7a0f` |
| 6 · fix: ideas through remake and draft again, cap, current | opus | 7m 26s | 32,301 | `099894f` |
| 7 · text chips, use a slide from another version | opus | 14m 13s | 188,084 | `ba2fc9f` |
| 8 · plan, draw and nudge images | opus | 23m 03s | 270,789 | `b9132bf` |
| 8 · fix: pictures kept through every redraw | opus | 11m 09s | 54,647 | `52e0376` |
| 9 + 14 · ideas and versions screens, slides-first workbench | opus | 49m 49s | 363,653 | `fb19ac0`, `fb3d829` |
| 15 · one screen per step | opus | 19m 20s | 207,020 | `66e4ae8` |
| 10 · the images screen | opus | 8m 35s | 130,778 | `3e167b9` |
| 11 · social versions keep look, preset, pictures | opus | 6m 22s | 93,916 | `251af4c` |
| 12 · new prompts in the live smoke run | sonnet | 2m 02s | 45,507 | `4bf4542` |
| **Total** | | **4h 12m** | **2,654,067** | **19** |
Tokens are the subagents' own; this session's context is not in them. Intent and plan by the controller (`07c374e`).

---

## After review round 3 (13 Oct 2026) · what changed on screen

Run these instead of the matching steps above; the rest stand as written.

**G1 · Links and pasted text** — GD18, GD19
```
Go to   /admin/posts/new
Do      paste two links · then also open "Paste text instead" and type something
See     "Use either links or pasted text." and Make post disabled; with links only, each fact row on the Source step shows its site, and the article view marks where each article starts (site · title)
```

**G3 · Versions name their idea** — GD2
```
Go to   /text after picking an idea
See     each version card reads "For: <angle>"; the legacy buttons read "Draft versions" / "No versions drafted yet."
```

**G5 · The chosen slide stays put; swaps that fit** — GD5, GD24
```
Go to   /text · "Use this version" · select slide 3
Do      press "Shorter" · swap slide 3 to Big number
See     slide 3 stays selected after each change; the big number's label is short and passes its length check
```

**G6 · Scenes planned on arrival; Plan again; way back** — GD12, GD27
```
Go to   "Approve text → Images"
See     the planned scenes are already in each picture area, no press needed; "Plan again" (asks first if you edited a scene); "← Back to text" with its confirm
Other   an old (The line) post's Images screen is titled "Images" and has the same way back
```

**G7 · Readable foot row** — GD9
```
Go to   a drawn Data Desk post on Pop, and a Postcard post
See     the source and search lines are readable on yellow (dark stone); on Postcard the white card covers the bottom row, so it never sits on the picture
```

**S22 (story 14) · Discard and the Board badge** — AC 116, 119
```
Go to   a live post · "Edit" · "Back to source"
See     "Discard changes" is offered here too; the Board card shows "Live" beside "Changed since published"; after discard, the page and colour theme are the published ones
```

**No need to click** — GD21 (a figure only in your notes, written into a heading, sends the draft back: `commands.test.ts`) · Pop/Subdued refused on an old-template post (`commands.test.ts`) · confirms move focus to "Stay" (`parts.test.tsx`).

**Review round 3** — `docs/admin-feed-post-from-source/review-3.md` (0 high · 5 medium · 6 low), `docs/guided-post-design/review-1.md` (3 high · 2 medium · 8 low), `review-2.md` (2 high · 5 medium · 5 low). All valid findings fixed; left with reasons: images drawn in sequence (deliberate), migration 0009 lock (applied, not edited), page tone in captions (deliberate under GD15, flagged to Nikhil).

**Verification after the fixes, 13 Oct 2026**
```
bun run test:run     1929 pass · 0 fail · Ran 2226 tests across 176 files
DB files (app_guided) commands 110 · images 14 · social 13 · store 29 · page-style 12 · preview 4 · schema 4 · all 0 fail
lint, type-check     clean · bun run build: Compiled successfully
```

| Dispatch | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| review · story 14 | opus | 6m 59s | 217,101 | — |
| review · guided part A | opus | 8m 03s | 278,417 | — |
| review · guided part B | opus | 8m 06s | 387,847 | — |
| fix · all 35 valid findings | opus | 57m 02s | 400,917 | `d90a62d`, `2ded400`, `24ace42`, `322aa38` |

---

## After the 13 Oct decisions · re-issued steps

Run these in place of G6, G7 and the old Images-screen settings; the rest stand.

**G6 · Images: planned on arrival, drawn in the background** — GD12, GD14
```
Go to   "Approve text → Images"
Do      "Draw images (<n> images)"
See     the press returns at once; "Images are being drawn" and the button disabled; each slide's picture appears as it lands; then "Next: Settings →"
Other   "← Back to text" · change one slide's text · approve: only that slide is planned and drawn again, the others keep their pictures
```

**G7 · Brand colours** — GD9, GD16
```
Go to   a drawn post on Pop with a deep-blue slide
See     highlighted words on deep blue are a yellow chip with dark text; source and search lines readable on yellow; on Postcard the card covers the bottom row
```

**G11 · The Settings step** — GD25, GD27
```
Go to   "Next: Settings →" (the step bar now reads Source · Ideas · Text · Images · Settings · Review · Live)
Do      check the source check · set the feed settings · "Send to review → Review"
See     the check, settings and send are here, not on Images; "← Images" goes back; after sending, Review opens
```

**S21 (story 14) · Request changes opens the step it names** — AC 120
```
Go to   a post in review, as the reviewer
Do      "Request changes" · choose Settings · write a note
See     as the editor, the post opens on Settings with the note beside it (Covers opens Images, Text versions opens Text)
```

**Worth a glance** — "Withdraw from review" opens Images (one click to Settings from there) · one combined database run in three showed a single failure that did not repeat (the image tests alone passed three times in a row).

**Verification, 13 Oct 2026, after the decisions**
```
bun run test:run     1948 pass · 0 fail
DB suites            221 pass · 0 fail (one process, app_guided)
lint, type-check     clean · bun run build: Compiled successfully
```

| Dispatch | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| fix · keep unchanged slide pictures | opus | 13m 07s | 121,842 | `99bbb3b` |
| Settings step · background drawing · yellow chip | opus | 39m 38s | 202,832 | `8fd3a99`, `56f46e0`, `af86410` |
| fix · request for changes opens its step | sonnet | 3m 28s | 34,928 | `fc458c0` |
