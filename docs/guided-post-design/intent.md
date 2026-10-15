---
title: Make a well-designed post by choosing and nudging, never prompting
author: Nikhil
---
# Make a well-designed post by choosing and nudging, never prompting
_Intent written 12 Oct 2026 with Nikhil, from a brainstorm during the office smoke test. No ticket. Builds on story 13 of `docs/admin-feed-post-from-source/intent.md` (criteria 93–110)._

## Problem

OfCourse's editors are strong at research and at deciding what students need to know, and only fair at visual design. Today's flow makes them work like prompt writers when a result is not right, which wastes their time, their effort and model tokens. Nikhil named three places this happens (12 Oct 2026):
- **The starting point.** With a source in hand, the editor has to know which post to make: the angle, the length and the look. Today "Make post" drafts three versions with angles the model guessed (criterion 97). When none fits, the editor has no way to say what they wanted except to redraft.
- **Text versions that are close but not right.** The only steers are "Another take" on a slide (criterion 99) and editing by hand.
- **Images that miss.** Covers come back off-brief, and the remedies are "Another set" or rewording the cover idea (criteria 102, 103). Each try spends images against the daily limit of 60.

The slides are also plain. Only the cover has art, and body slides are a heading and a paragraph on one colour, with most of the slide empty. This was checked by rendering every template on 12 Oct 2026. The research in this brainstorm found that strong educational carousels carry a visual anchor on every slide (a picture, a big number, a chart or a colour block) and keep body text to 15–25 words. Sources: Sprout Social, Hootsuite, Canva and Adobe Express guidance; summary in the design board below.

Design board with the three looks: https://claude.ai/artifact/F6D5AWxdEdLZRzwruohB99

## Proposed outcome

An editor goes from a source to a polished, on-brand carousel by choosing and nudging. They pick an idea, a look and a colour preset. They swap slide layouts and nudge text and images with chips. They never write a prompt, and they get ideas they had not thought of on the way. Each correction is a targeted change, not a fresh round of generation, so fewer model calls and images are spent per finished post.

## Affected users and systems

- **Editors and superadmins** make posts (choosing ideas, looks, layouts and chips).
- **Reviewers** see the result as today.
- **Students** see better-designed slides in the feed, on public pages and on Instagram.
- **Systems:** the content engine's drafting, templates, layout and rendering (`src/features/content/`); covers and images; the brand files; social versions (Instagram, LinkedIn); the daily image limit.
- **Decision owner:** Nikhil.

## Scope

Feed posts in the admin, from "Make post" to render, and the social versions made from them. Both colour presets on every look. Posts made before this change keep their old templates and still load, render and export. Comics keep their own template (`docs/route-comics-and-gaps/`).

## User stories

1. As an editor, I want post ideas offered from my source, so that I start from an angle I chose instead of guessing what to ask for.
2. As an editor, I want to pick a look and swap any slide's layout with a click, so that the post looks designed without my designing it.
3. As an editor, I want the brand's colours in two presets, Pop and Subdued, so that every post is on brand and I only choose the mood.
4. As an editor, I want to steer text with chips and take a slide from another version, so that a near miss becomes right without rewriting or prompting.
5. As an editor, I want to see and edit what each image will show before it is drawn, then nudge one image with chips, so that images land on brief without spending tries.

## Acceptance criteria

### 1. Idea cards first

GD1. Given a source pasted or read from a link on the admin's "Make post", when its facts are extracted, then Gemini offers 4 to 6 idea cards, each showing an angle, a hook line, who it is for, a suggested look and a suggested number of slides; a source with too little in it for four distinct ideas offers as many as it supports, at least 2.
GD2. Given the idea cards, when the editor picks one, or ticks two and presses "Combine", then the text versions are drafted for that idea (or both together), and each version shows which idea it serves.
GD3. Given the idea cards, when the editor presses "More ideas", then up to 4 more cards are offered that differ from those shown; the cards shown stay.

### 2. Three looks, slide layouts that swap

GD4. Given a picked idea on the admin workbench, when versions are drafted, then they use the idea's suggested look: Field Notes, Data Desk or Postcard. Each look is a set of slide layouts: cover, picture and text, big number, comparison bars, quote, checklist and takeaway. The editor can change the look for a version, and its slides are laid out again in the new look with no model call.
GD5. Given a slide in a version, when the editor opens its layouts, then the layouts its content can fill are offered as small previews, and choosing one lays the slide out again with no model call. A layout the slide cannot fill is shown disabled with the reason; for example, "Big number needs a number from a fact on this slide".
GD6. Given any look, when a slide is laid out, then it carries the frame: slide dots, a swipe cue on the slides before the last, the source line where the slide states a fact, and the search line on the last slide (criterion 106).
GD7. Given a source whose facts name no place, when idea cards and looks are offered, then Postcard is not suggested. It can still be chosen, with its picture showing a general campus or city scene.
GD8. Given posts made before this change, when they are opened, rendered or exported, then they keep their original templates and look the same as before.

### 3. Two colour presets

GD9. Given any look, when the editor chooses "Pop" or "Subdued" on the workbench, then the version is laid out in that preset's brand colours, Pop with blue and yellow blocks and Subdued with light backgrounds and accent details, and the fit, legibility and contrast checks pass in both (criteria 34, 35).

### 4. Steer text with chips, and mix slides

GD10. Given a text version or one slide in it, when the editor presses a chip (Shorter, Simpler words, More personal, More surprising, More practical, Warmer), then only that version or slide is redrafted in that direction. Its facts, bindings and checks hold as for any draft (criteria 26–31), and the previous wording stays in the history (criterion 101).
GD11. Given two or more versions, when the editor presses "Use this slide in my version" on a slide of another version, then that slide replaces the slide at the same place in the picked version, keeping its bound facts; the fit checks update.

### 5. Plan images in words, then nudge

GD12. Given approved text, when the editor reaches images, then each art box (the cover and any picture slide) shows its planned scene in words, written by Gemini from the slide, the idea and the look, and the editor can edit it in place. Nothing is drawn until the editor presses "Draw images", which approves the plans.
GD13. Given a drawn image, when the editor presses a nudge chip (Closer, Wider, More people, Fewer things, Warmer light, Calmer), then only that image is drawn again with the nudge, as another take that keeps the earlier one to go back to; the other images do not change.
GD14. Given the daily image limit, when images are drawn or nudged, then each counts against it. A look's images per post are shown before "Draw images": Field Notes 3 to 4, Data Desk 1, Postcard 1. At the limit, the images drawn so far are kept and the rest read "Daily image limit reached".

### 6. On brand by construction (added 12 Oct 2026)

_As the brand owner, I want Gemini's images and copy to keep to the brand guideline without editors correcting them, so that every post looks and sounds like OfCourse._ Code already draws every word, the fonts, the layout and the slide colours; this story covers what Gemini still decides.

GD15. Given a brand guideline file in the repo, when any draft, idea, scene-plan, caption or image request is made, then its prompt carries the guideline parts that call needs, compiled by code in the same words every time: for images, the palette by name and hex, the art style, the dos and don'ts and the never-show list; for copy, the voice rules. The editor never sees or edits the compiled prompt, and changing the file changes every later prompt without a code change.
GD16. Given an image Gemini drew for a post, when it is placed in a slide, then code first maps its colours onto the brand palette: Pop as a strong blue-and-yellow treatment, Subdued as a light brand wash. The slide shows the mapped image, the original is kept, and no model call is spent.
GD17. Given the brand guideline file, when it is changed (for example, when Nikhil's guideline replaces the stand-in values), then the Pop and Subdued presets (GD9), the image mapping (GD16) and the prompts (GD15) all follow it, and the fit, legibility and contrast checks run against the new colours.

### 7. Links in, points out, framed by one line (added 12 Oct 2026)

_As an editor, I want to paste one or more links and say in a line what I want the post to say, and have Gemini pull the points from the articles, so that I never have to write the source content myself; my own opinions stay mine, kept apart from the facts._ Decided by Nikhil on 12 Oct 2026: "the content needs to be extracted from the link by gemini with the help of an accompanying command from the user to frame their narrative."

GD18. Given the admin's "Make post", when it opens, then it starts with a links field (one to five links, one per line), a framing line ("What do you want this post to say?", up to 200 characters, optional), and an optional "Your own notes" box. Each field carries a placeholder and a one-line help text saying what to put there. "Paste text instead" opens the text box for a source with no link.
GD19. Given one or more links, when "Make post" runs, then each link is read (criterion 94's safe reading applies to each), and Gemini extracts the points from each article as exact sentences (criterion 95). Each fact names the link it came from, and a slide's source line names the sites its facts come from. A link that cannot be read is listed with "Could not read this page" while the others go on.
GD20. Given a framing line, when ideas and versions are made, then the framing line steers them as the editor's intent (GD1, GD2), and it is shown above the idea cards. With none, ideas come from the articles alone.
GD21. Given text in "Your own notes", when facts and versions are made, then the notes are kept as the editor's opinion. They may be used as opinion on a slide (marked "Editorial opinion", criterion 43), and they never become facts or support a number.

### 8. A workbench that shows the slides, not a wall of text (added 12 Oct 2026)

_As an editor, I want the slides to be the main thing on the workbench and to see only what needs my attention, so that I can judge and fix a post at a glance._ From Nikhil's screenshots of the text-versions step on 12 Oct 2026: every slot written out under small previews, "not a fact · checked" on every slot, each fact quote repeated per slot, about fifteen "Pass" rows per version, internal step names, and the approve button at the far bottom. Redesign: https://claude.ai/artifact/RxBz892AziFiYckdLp1Pxb

GD22. Given versions on the admin workbench, when they are shown, then each version shows its slides as readable previews in a strip that scrolls sideways, its angle as the title, and one status tag: "Ready", or "<n> to fix" with each problem named in a sentence and a one-click fix where one exists (for example "Shorten it" on a slot over its limit). The slot text, the facts per slide and every check row sit under "Details", closed by default.
GD23. Given a fact bound to a slot, when it is shown on the workbench, then it appears once as a numbered chip (¶1) that opens the source sentence. A slot shows a label only when it needs attention ("Not in the source", "Opinion"); "not a fact · checked" is never shown.
GD24. Given the version the editor chose, when it is edited, then the workbench shows a strip of its slides and one slide large, with its text fields, the text chips (GD10) and the layout picker (GD5) beside it. Slides from the other versions are listed with "Use here" (GD11), and an action bar that stays in view holds the check summary ("All checks pass" with "See checks") and "Approve text".
GD25. Given any post on the admin workbench, when the stage bar and step titles are shown, then they read Source, Ideas (look posts only), Text, Images, Review and Live. "Structures", "Render gate", "Gate locked" and contrast ratios in names are not shown, and colour presets and themes are named without numbers.
GD27. Given a post on the admin, when it is opened, then each step is its own screen at its own address (`/admin/posts/<id>/source`, `/ideas`, `/text`, `/images`, `/review`, `/live`), and `/admin/posts/<id>` opens the step the post is at. The numbered step bar switches screens: a passed step opens read-only with its "Back to <step>" (story 14, criteria 112, 121), the current step is marked, and steps not reached are shown but not clickable. Each step's action bar names the way forward ("Approve text → Images") and the way back. The source and history live on the Source step, not beside every step. This replaces story 14's one long page (criterion 111: passed steps stay reachable, now one click away instead of scrolled to). An address for a step not reached opens the current step.
GD26. Given the source pane, when it is shown, then the article is folded to its first lines with "Show article", key ideas are shown whole (never cut mid-word; today's previews end in "littl"), and facts are short numbered rows with "Add a fact from the article".

### 9. A smoother workbench (added 13 Oct 2026, from Nikhil's smoke test)

_As an editor, I want to change anything at any step without Back buttons and confirms, with sensible defaults chosen for me and everything I am working on in view at once, so that making a post feels like editing, not a wizard._

GD28. Given a passed step on the admin workbench, when the editor changes something on it (text on Text, a scene on Images, a fact on Source), then the step is editable in place, and the change moves the post back to that step by itself, with a one-line note of what will be redone ("Changing text re-plans the pictures of changed slides"). There is no "Back to …" press and no confirm, and History undoes it. (Amends criteria 111, 112 and 121 and GD27.)
GD29. Given any choice the system can make for the editor, when a step opens, then a default is pre-selected: the top recommended idea and format (of the top three Gemini marks), the first version that is Ready, the post's look and preset, and the feed settings from the post's tags. The editor only changes what they disagree with.
GD30. Given any step, when it is shown at desktop width, then the slides being worked on and their actions are both in view without scrolling the page: the slides in one area, the actions and fields in another beside it, each scrolling on its own if long.
GD31. Given a post's Settings, when the editor chooses "Where sources go", then the options are the caption only, the last slide (site names, never full links), or a separate sources slide at the end (for several links). The caption always lists the sources, and the feed post and public page list them with their links.

### 10. More control over the narrative (added 13 Oct 2026)

_As an editor, I want to shape a post slide by slide before any text is written, and to choose from formats that are trending, each explained in a line, so that the drafts come out the way I meant first time._

GD32. Given a picked idea, when the editor continues, then they see its slide-by-slide outline: each slide's job (hook, point, proof, takeaway…), its layout and its one-line point. They can reorder, add, remove or change a slide's layout or point, and "Write the slides" drafts the text to that outline.
GD33. Given the idea cards, when they are shown, then each offers a format from this list, each with a one-line description: myth vs fact; N things nobody tells you; this or that; step by step; informative, one idea per slide; bullet points; a day in the life; question and answer; before you go (checklist); then vs now (timeline). Gemini ranks its top three formats for the source: they are shown first, marked "Recommended", with the first pre-selected.
GD34. Given any look, when slides are laid out, then a bullet-points layout (three to five short points) is one of the layouts, swappable like the others (GD5).
GD35. Given a sentence the source check marks "Not found in the article", when the editor presses "Research this", then Gemini looks for support beyond the article with Google Search and shows what it found with links, for the editor to accept as a new source or not. It runs only when pressed, to keep token use down. (Built with the start-from-an-idea work, which shares the research.)

### 11. Posts in Nepali, Hindi and Thai (added 14 Oct 2026)

_As an editor, I want to make a post or a blog in Nepali, Hindi or Thai from English sources, with every fact still checked, so that students from Nepal, India and Thailand read it in their own language._ Decided by Nikhil on 14 Oct 2026.

GD36. Given "Make post" or "New blog", when the editor starts, then they choose a language: English (the default), Nepali, Hindi or Thai. The choice is kept on the post and can be changed at the Source step (which remakes from there, GD28).
GD37. Given a non-English post, when ideas, the outline, slide text, captions and blog text are made, then they are written in the chosen language. Source articles stay as they are, facts are the source's exact sentences, and the source check judges each sentence in the chosen language against its English fact by meaning. Numbers use Western digits (0–9), so the number checks apply unchanged (criteria 26–31, GD21). The admin screens stay in English.
GD38. Given a non-English post, when its slides are laid out and drawn, then the text uses Noto Sans Devanagari (Nepali, Hindi) or Noto Sans Thai (Thai) beside the brand fonts for Latin, and the fit, glyph, legibility and contrast checks run with those fonts.
GD39. Given a non-English post, when code writes its fixed lines (the search line, "Read the full guide", "Sources", the swipe cue), then they are written in the chosen language. The search phrase keeps "OfCourse" and the title as written.
GD40. Given a published non-English post, when students open the feed, then it shows for students whose home country matches its language (Nepali → Nepal, Hindi → India, Thai → Thailand) through the home chip, with a language label on its card. English posts show to everyone, as before.

## Edge cases

- **A source too thin for four ideas**: 2 or 3 cards (GD1). From the PM.
- **A layout the slide cannot fill**: disabled with the reason (GD5). From the PM.
- **No place in the facts**: Postcard not suggested (GD7). From the PM.
- **An idea card or chip call that fails**: the earlier state stays, and the step offers "Try again" (criterion 93's rule). From the code.
- **A chip that would change a number**: refused by the existing number checks, and the slide keeps its wording (GD10; criteria 26–31). From the code.
- **A nudge or planned scene asking for text, a number or a brand in the picture**: refused before any call (the art-prompt guard, criterion 102). From the code.
- **The daily image limit mid-draw**: drawn images kept (GD14). From the code.
- **A colour preset that fails contrast on a layout**: the fit check fails with the row named, as today (GD9). From the code.
- **Old posts**: unchanged (GD8). From the PM.
- **Starting from a topic with no source**: decided out of scope by Nikhil, 12 Oct 2026.
- **Per-post custom colours**: decided out of scope by Nikhil ("we already have a brand guideline").
- **A Nepali post showing prices in rupees by default** (rather than through the separate market version): open, owner Nikhil, does not block (GD36–GD40).
- **Six or more links**: refused with "Up to five links." (GD18). From the PM's "even allow multiple links"; the cap keeps reading time and cost bounded.
- **Every link fails to read**: nothing is made; the form keeps the links and says which failed (GD19). From the code (criterion 94).
- **The same sentence in two articles**: two facts, one per link, each with its own source (GD19). From the code (facts are exact sentences).
- **A note that states a number**: kept as opinion; it cannot support a factual slot's number (GD21; criteria 26–31). From the code.

## Constraints

- **Deadline:** demo video 16 Oct, submission 17 Oct 2026.
- **Cost:** images count against the daily limit (60 today); Field Notes spends the most.
- **Model rules:** the editor never writes a prompt from scratch (ADR-129). Code draws every word and number; Gemini draws pictures only, with no text in them (ADR-008, ADR-054). Facts are checked by code (ADR-112).
- **Brand:** colours come from the brand guideline. Nikhil will provide it; until then, the blue and yellow in the brand files. Fonts stay Barlow and Barlow Condensed.
- **Legibility:** 11 px at 328 px phone width (ADR-112); body text near 15–25 words a slide.

## Out of scope

- Starting from a topic with no source, and suggesting sources to look for: its own intent, built 13 Oct 2026 with the blog beside each post.
- The weekly student question or digest: after submission, split with Jenish (the admin side here, the student screens in his slice).
- Two simple games made with Gemini's help, after submission (Nikhil, 12 Oct 2026). **Connections:** Gemini proposes four groups of four from a topic or recent posts; code checks the groups; the editor edits; a reviewer publishes. **A 5×5 mini crossword:** Gemini suggests themed words, code fills the grid (topping up from an open-licence word list), Gemini writes the clues, and code checks each clue against its answer. Students play from a card in `/feed`, with no leaderboard yet. The football versus quiz is a late add-on, outside the hackathon.
- Colours beyond the two presets; per-post colour choices.
- Comments on slides, and comparing versions side by side.
- A fixed set of brand reference images sent with every image call, a code-measured brand check with one retry, learning from approved posts, and a brand score in the eval run: proposed 12 Oct 2026, kept for after the demo by Nikhil.
- Comics: their storyboard and panels follow `docs/route-comics-and-gaps/`, which this intent's GD12–GD13 replace for feed-post covers (that plan's Task 11).

## Dependencies

- Nikhil's brand guideline, for the exact Pop and Subdued colours (GD9).
- Story 13's records and flow (versions, history, covers, page styles) on `feat/submission-readiness`.
- Per-slide art (one image per art box), shared with the comics plan's Task 4.

## Open questions

1. The brand guideline's colours, art style, never-show list, voice rules and any rules for blue and yellow use (they fill the guideline file, GD15–GD17). Owner: Nikhil. Does not block (the brand files' colours and today's tone lines stand in).
2. Whether "Combine" (two ideas in one post) is needed for the demo or can follow. Owner: Nikhil. Does not block.
3. Build order against 16–17 Oct: story 14, this intent, and the comics slice. Owner: Nikhil. Blocks the build tonight.

## Changes

- 13 Oct 2026, Nikhil, before the smoke test (after review round 3):
  - **Blue text panels:** they use the darker blue (#1260D8) behind white text; the brand blue (#1877F2) stays for images, tints and accents, until the guideline says otherwise.
  - **Highlights on Pop's deep blue:** a yellow chip with ink text.
  - **Colour preset:** Pop stays the default.
  - **Images per post:** Field Notes keeps 3–4 images a post.
  - **Caption voice:** captions for every page brand use the guideline's one voice plus the page's copy style.
  - **Old covers:** covers made before 13 Oct are not reused after going back and forth.
  - **Settings step:** the editor's steps become Source · Ideas · Text · Images · Settings · Review · Live. Images holds the pictures only. Settings holds the source check, the feed settings and "Send to review" (amends GD25 and GD27).
  - **Drawing in the background:** "Draw images" returns at once; each slide fills in as its picture lands, with the same daily-limit behaviour (amends GD12 and GD14).
  - **Keeping pictures:** after going back to Text, a slide whose text and planned scene are unchanged keeps its picture; only changed slides are planned and drawn again (extends criterion 114 to look posts).
