---
title: Let an editor turn a source into a checked feed post
author: Nikhil
requested by: Nikhil
---

# Let an editor turn a source into a checked feed post

_Intent written 5 Oct 2026 with Nikhil, from a brainstorm over the Hackathon Handoff pack (`Downloads/Hackathon Handoff` on Nikhil's machine: `Hackathon Admin Panel Handoff.zip` → `OfCourse Admin - specification.dc.html` and `Admin app - round 2.dc.html`). No Jira idea; this folder is the record. This is the first admin slice; the student opening is Jenish's (`docs/student-opening-three-futures/intent.md`)._

## Problem

OfCourse has no way to make student content. The admin today is the starter's users admin only (`src/features/admin/lib/nav.ts`: one section, Users). The marketing team's core job, turning a checked source into a feed post that stays true to it (spec §1, AD-F6 to AD-F25; handover §1 "Admin app"), cannot be done.

It matters now for two reasons. A marketing staff member tests the admin on 8–9 Oct (handover §6). And the competition scores Technical Merit and Gen AI Implementation at 40% (handover §0b): the feed post from a source is working case 1, and the planted hallucination caught and blocked is the item the handover says to keep if time runs short (§0c).

## Proposed outcome

On 8 Oct a marketer signs in to the deployed admin, pastes a source, and gets back its facts, each tied to the paragraph it came from, with any claim the source does not support marked and blocked. They pick templates, get structures drafted by the model, approve one, see the fit checks, and render a post whose art comes from the image model and whose every word and number comes from the approved structure. The source check catches the planted claim. A reviewer, who may be the same person, approves and publishes it, and it shows as live on the board.

By submission (about 14 Oct) the same post also gets a Nepal version that keeps every fact, an Instagram or LinkedIn version exported as files, light edits and single-slide regeneration, a vision check on every render, and a preview of the post as a student would see it.

Every model step is a real call, and none can leave the marketer stuck or show a fact that isn't in the source.

## Affected users and systems

- **Editors.** Marketing staff who make posts. A new role.
- **Reviewers.** Staff who approve and publish. A new role. One account can hold both.
- **Superadmins.** Assign the two new roles and can act as editor and reviewer.
- **Admins.** Keep the users admin. They see the board read-only unless they also hold editor or reviewer (ADR-108).
- **Students.** Not touched in this slice. Published posts reach the student feed in a later slice.
- **Surfaces.** The admin's Board tab, the post workbench, the users admin (role assignment), the admin sign-in page and the student sign-in page (who may sign in where).
- **Data.** Accounts and their roles, including roles waiting for an address; sources split into paragraphs; facts; structures; renders; source-check results; feed settings; review records; market variants; social versions; templates and brands (repo files); the exchange-rate fact.
- **Systems.** Gemini on Vertex AI (extraction, judge, structure drafting, market framing, captions, vision check); Vertex AI image generation (cover art). Both on the Google Cloud project on Jenish's account.
- **Decision owner.** Nikhil, the PM, owns this slice and its build choices, the model calls included (decided in this brainstorm; see Open questions).

## Scope

- **Roles.** Editor, reviewer, superadmin (acting as either), admin (read-only on the board unless it also holds editor or reviewer).
- **Surfaces.** Admin Board and workbench; users admin for role assignment; both sign-in pages for who is let in.
- **Content.** Feed posts only, with their Nepal variant and their Instagram and LinkedIn versions.
- **Markets.** Default and Nepal.
- **Sources.** Any pasted source. Two are rehearsed: "Paid work and grades" (which contains a money figure) and "How much do you love your future self?" (ADR-080), plus a twin of one of them with a planted wrong figure.
- **Templates and brands.** Whatever is in the repo; to start, the four designed feed templates (Sketch insight, The line, The question, The long read), one mock feed brand and the mock page brands (Main, Cerebral, Infographics).
- **Devices.** Desktop and laptop, 1280 px wide and up. The in-context preview shows a phone-sized frame inside the page.
- **Environments.** Local development and the one deployed environment on Google Cloud shared with the student app.
- **Timing.** Stories 1–7 and 10 by 8 Oct, except the criteria marked "By submission". Stories 8 and 9, and the marked criteria, by submission.

## User stories

1. As a superadmin, I want to make an account an editor, a reviewer or both, so that the marketing team can work in the admin without managing users.
2. As an editor, I want one board showing every post and the stage it has reached, so that I can see what needs doing and pick up anyone's work.
3. As an editor, I want to paste a source and get its facts, each tied to its paragraph, with unsupported claims caught, so that nothing reaches a post that the source does not say.
4. As an editor, I want structures drafted from templates I choose, with every factual slot bound to a fact, so that I approve the wording before anything is rendered.
5. As an editor, I want fit checks before render and a render whose words come from the approved structure, so that what students read is exactly what was approved and readable on a phone.
6. As a reviewer, I want to see the post, its facts, its source check and its settings together, and approve and publish it or send it back with a reason, so that regulated content always has a second look.
7. As an editor, I want to set who sees the post, why, and for how long, so that it reaches the students it is for.
8. As an editor, I want a Nepal version that keeps every fact, so that families in Nepal read it in their terms.
9. As an editor, I want an Instagram or LinkedIn version of a live post, exported as files, so that the social team can post it without retyping or rechecking it.
10. As the product owner, I want to add templates and update the brand as files, so that the content can grow and match the brand guidelines without a new screen.

## Acceptance criteria

### Across all stories

1. Given any admin screen in this slice, when it is shown, then it reads "OfCourse Admin", and no screen, label, export or file name names Heubert, Expert, Edge or a CRM (AD-R18).
2. Given any account that can open the admin, when the admin is shown, then the only tabs are Board and, for admin and superadmin, Users. There is no Comic gaps, Updates, Ideas, Insights, Maintenance or Parsing tab, and no control on any admin screen does nothing when pressed (AD-E27).
3. Given any change of a post's state in the workbench, when it happens, then one line confirms it (for example "Structure approved · card crossed the render gate") (AD-F54).
4. Given a model step (extraction, judge, structure drafting, market framing, caption, vision check) on one of the two demo sources or the twin, when the call fails or times out, then a recorded result for that source is shown, marked "Replay".
5. Given a model step on any other source, when the call fails or times out, then the step says it failed, everything done before it is kept, and "Try again" reruns only that step.
6. Given the day's cap on image calls or on Pro-class calls has been reached, when a step needs that call, then the step says the daily limit is reached and behaves as a failed call (criteria 4 and 5, and 37 for art).
7. Given a browser window 1280 px wide or wider, when any admin screen in this slice is shown, then nothing is clipped or overlapping and nothing needs sideways scrolling, except the board's columns.

### 1. Roles

8. Given a superadmin in the users admin, when they open an account, then they can give or remove editor and reviewer, and the account can hold both at once.
9. Given a superadmin in the users admin, when they leave editor, reviewer or both waiting for an address with no account, then that address gets those roles at its first sign-in on the admin sign-in page.
10. Given an admin who is not a superadmin, when they open an account in the users admin, then giving or removing editor or reviewer is unavailable with "Only a superadmin can change roles."
11. Given an account with editor or reviewer, when it signs in on the admin sign-in page, then it reaches the Board.
12. Given an account with editor or reviewer, when it signs in on the student sign-in page, then it is refused with the message that the page is for students, and it is not signed in to the student app.
13. Given an account with editor or reviewer and neither admin nor superadmin, when the admin is shown, then there is no Users tab, and opening the users admin's address directly is refused.
14. Given an admin who is not a superadmin and holds neither editor nor reviewer, when they open the Board or a post, then they see every post and its state, and no action that changes a post is offered.
15. Given a superadmin, when they open the Board or a post, then every editor action and every reviewer action is available to them.
16. Given an editor or reviewer whose role is removed while they have a post open, when they next act on it, then the action is refused with "Not authorised." and the post does not change.

### 2. The board

17. Given the Board, when it is shown, then it has the columns Structures, the render gate, Approved · to render, Rendered · edit & check, In review, Ready · publish or export, and Live in feed · exported, and a filter All / Feed posts / Social versions with a count on each. Every card is a real post; there are no sample cards. (16 Oct 2026, Nikhil: the first column reads "Structures", without "· pick one": the columns are to-do lists, not instructions.)
18. Given a feed post with a Nepal variant or a social version, when the Board is shown, then each sits indented under its post with "↳ from feed post <title>", and the post's card lists them (for example "↳ Nepal · market variant", "↳ Instagram · ready").
19. Given a card, when it is shown, then it says who changed the post last and when.
20. Given a card, when it is opened, then the workbench replaces the board at full width with a stage rail showing the render gate as locked or open, and "← Board" returns to the board with the filter as it was.
21. Given two people with the same post open, when the second saves a change made after the first person's save, then the save is refused with "Changed by <name> just now", the latest version loads, and nothing is overwritten.

### 3. Source and facts

22. Given "+ New feed post", when the editor pastes a source and presses "Extract ideas", then the source shows as numbered paragraphs ¶1 to ¶n, with three key ideas and a list of facts, each linked to its paragraph.
23. Given an extracted fact whose quote is not in its paragraph, or whose number is not in its quote, when the judge finds the paragraph does not support it, then the fact is marked "Not supported" in red with its span highlighted, and it cannot be bound to any slot.
24. Given the twin source, in which one paragraph's figure differs from a claim in the pasted text, when extraction runs, then that claim is marked "Not supported" with the differing span highlighted.

### 4. Structures

25. Given extracted facts, when the editor goes to draft structures, then every template in the repo is listed with its name and format, and the editor ticks one to three. "Draft structures" is unavailable with none ticked or more than three.
26. Given ticked templates, when "Draft structures" runs, then one structure per ticked template appears as a blueprint, and nothing is rendered.
27. Given a drafted structure, when it is shown, then each factual slot shows a chip with the fact text · ¶ · source · check date, each non-factual slot shows "not a fact · checked", and the source pane highlights the paragraphs that structure uses.
28. Given a structure with a claim that has no supported fact behind it, when it is shown, then the claim reads "No source", "Approve structure" is unavailable with that reason, and "Fix unbound claim" offers a supported fact from the source in its place.
29. Given drafted structures, when the editor compares them, then they show side by side and "Pick this structure" chooses one.
30. Given a picked structure, when the editor chooses a theme, then the brand's themes are listed beside it, each with its contrast ratio. The theme cannot be changed after render.
31. Given a picked structure, when the editor approves it, then its wording and fact bindings are locked, the card crosses the render gate, and the rail shows the gate open.
32. Given an approved structure, when the editor presses "Reopen structures", then the post goes back to picking, the gate locks again, and the bindings unlock.
33. Given a structure that is not approved, when the editor looks for a render action, then there is none (AD-R1).

### 5. Fit checks and render

34. Given an approved structure, when the fit checks run, then each slot's length is checked against the template's limits, the theme's contrast against 4.5:1, and the smallest text against the legibility minimum at phone width. Each row shows its value, its limit, and pass or fail.
35. Given any fit check fails, when the checks show, then Render is unavailable and the failing row names the slide and the count (for example "Slide 2 · 121 words (30–70) · Over").
36. Given all fit checks pass, when the editor renders, then the cover's art comes from the image model, every word, number and source line is laid out from the approved structure, text slides carry no art, and the slides show in the brand.
37. Given a render whose art fails or takes more than 20 seconds, when the render finishes, then a demo source uses its pre-rendered cover marked "Replay", and any other source gets a text-only cover labelled "No art" with "Try again".
38. Given an art prompt containing a digit, a quotation or a brand name, when it would be sent, then it is refused before generation with the reason (AD-R3).
39. **By submission.** Given a finished render, when the vision check runs, then three results show: caption readable at phone size, every figure matches an approved fact, no stray text in the artwork. If any fails, the render is flagged and cannot be published unless a reviewer overrides it, and the override is recorded.
40. **By submission.** Given a rendered post, when the editor edits the highlighted or underlined phrase, swaps the cover image or reorders the body slides, then the change shows and no fact or binding changes.
41. **By submission.** Given a rendered post, when the editor edits the cover's art prompt and presses "Regenerate this slide only", then only the cover's art changes, captions and other slides stay the same, and the cover's version count goes up by one.

### 6. Source check and review

42. Given a rendered post, when the editor presses "Run source check", then every claim in the post is listed as "Found ¶n" or "Not found", checked against the pasted source.
43. Given a claim marked "Not found", when the editor looks to send the post to review, then sending is unavailable until they remove the claim or mark it "Editorial opinion". The reviewer sees the opinion mark.
44. Given an account with editor and not reviewer, when it looks for the approve action on its post, then approving is unavailable with "Waiting for a reviewer" (AD-E7).
45. Given a post in review, when a reviewer opens it, then they see the slides, the fact chips, the source-check results, the feed settings, the Nepal version if there is one and any vision-check flag, and "Approve and publish" makes the post live and records "Reviewed by <name> · facts locked".
46. Given a post made and approved by the same account, when its review record is shown, then it reads "self-reviewed".
47. Given a post in review, when the reviewer presses "Send back", then a one-line reason is required, and the post returns to Rendered · edit & check with the reason shown to the editor.
48. Given a post in review, when a reviewer has it open, then there is no way for them to edit its wording, structure or settings (AD-P7).

### 7. Feed settings and publish

49. Given a rendered post, when the editor opens feed settings, then they choose a layer (General, Featured: pinned 72 h to everyone, or Personal: "For you"), an audience (Everyone, or Matched group with its rules and a count), an expiry (none, 30 days, 90 days or a date), and an optional Studio link.
50. Given the Featured layer, when it is chosen, then the audience is Everyone and Matched group is greyed with "Featured posts go to everyone".
51. Given the Personal layer or a matched audience with no why line, when the editor looks to send the post to review, then sending is unavailable with "Personal and matched posts always say why". With General and Everyone, the why line field is hidden.
52. Given feed settings that are not complete, when the editor looks to send the post to review, then sending is unavailable and the missing setting is named.
53. Given an audience count, when it is shown, then it is labelled mock.
54. Given a post the reviewer approved and published, when the Board is shown, then its card is in Live in feed · exported, reading "<layer> · <audience> · Leaves the feed in <n> days" (or no expiry), and its settings cannot be changed.
55. **By submission.** Given a rendered post, when the editor switches from Slides to "Preview in context", then the post shows in a phone-sized feed card with its layer tag, why line, Studio link and source line, with the settings summary beside it.

### 8. Nepal version (by submission)

56. Given a rendered post that is not yet in review, when the editor switches Market from Default to Nepal for the first time, then a linked card "<title> · Nepal" appears under the post on the Board.
57. Given a source that contains a money figure, when the Nepal version is shown, then the slide carrying it reads the figure with NPR beside it (for example "AUD 499 (≈ NPR 43,900)"), worked out from the exchange-rate fact, with the rate's source and date on that slide ("NPR at 88 per AUD · mock rate · 1 Oct 2026", ADR-097).
58. Given a source with no money figure, when the Nepal version is shown, then no currency figure appears and nothing is added to the source (AD-R8).
59. Given the Nepal version, when it is shown, then the cover kicker, takeaway, aphorism and feed excerpt frame the post as a family decision, and every fact and number is the same as in the default version. A model output that carries any other number is rejected and treated as a failed call.
60. Given a post with a Nepal version, when the reviewer approves and publishes, then both versions go live together.
61. Given a post in review or live, when the editor opens Market, then the existing versions show, and a new variant cannot be added.

### 9. Instagram and LinkedIn versions (by submission)

62. Given a feed post that is not live, when the editor looks for "Adapt", then it is unavailable (AD-R11).
63. Given a live feed post, when the editor chooses a page brand and a platform (Instagram carousel or LinkedIn post) and presses "Create social version", then a linked card "<platform> · <brand> ↳ from feed post" appears on the Board.
64. Given a social version, when it is opened, then its facts are those of the feed post, locked, with no new source check, and its layout is re-skinned in the page brand, with "Quick approve layout" before render.
65. Given a rendered social version, when its text is written, then Instagram gets a caption of up to 150 words and up to 8 hashtags, and LinkedIn gets post text. Both use only the feed post's facts, and a caption with a number that matches no fact value is rejected and treated as a failed call.
66. Given an edited caption, when the editor looks for "Export", then it is unavailable until the source check runs again on the new wording, and "Reset to approved wording" restores the approved text.
67. Given a social version ready to export, when the editor presses "Export", then a zip named `<page>_<post>_<platform>.zip` downloads with an SVG and a PNG per slide and a `caption.txt`, and the card moves to Live in feed · exported.
68. Given any social version, when it is exported, then nothing is posted to any platform (AD-R13).

### 10. Templates and brands as files

69. Given a new feed template file added to the repo and deployed, when an editor next drafts structures, then the new template is in the list (criterion 25).
70. Given the mock brand file changed and deployed, when a post is next rendered, then the render uses the changed fonts, colours and tone, and the fit checks use the changed theme colours.

### 11. The student feed (added 7 Oct 2026)

_As a student, I want to read the posts the reviewer published, on my phone or a desktop, so that the content engine reaches me and not only the admin._ Decided by Nikhil on 7 Oct 2026: the feed joins this slice; audience matching stays mock, and the feed is not the student home.

71. Given a signed-in account (a student or a staff member), when it opens `/feed` at phone width (360 px) or on a desktop, then it sees every live feed post (stage live or exported; never a social version, a post in review or a draft) as a phone-sized card with its approved cover, title, excerpt, layer tag ("Featured", "For you", none for General), why line, Studio call to action and source line, newest approval first. Nothing the reviewer did not approve appears.
72. Given a Featured post approved within the last 72 hours, when the feed is shown, then it is pinned above the other posts; after 72 hours it takes its place by approval time.
73. Given a post whose expiry has passed (its days counted from the approval, or its date), when the feed is shown, then the post is not in it, and its page answers "not found".
74. Given no live posts, when the feed is shown, then it reads "Nothing in the feed yet."
75. Given a card, when it is opened (`/feed/<id>`), then the page shows every slide of the approved render in order, one slide per swipe at phone width and side by side on a desktop, with the layer tag, why line, Studio call to action and source line, and each slide carries the alt text "Slide n: <its text>".
76. Given the "Nepal prices" switch turned on, when the feed or a post page is shown, then a post with an approved Nepal version shows that version's slides and excerpt, any other post shows its main version, and the switch is kept in the URL (`?market=np`) between the feed and its pages.
77. Given an image that no live post's approved render or Nepal version names, when it is requested from the feed's image route, then the response is "not found"; the images of live posts are served with long-lived caching.
78. Given a signed-out visitor, when they open `/feed` or `/feed/<id>`, then they are sent to sign in and return to that page after it.
79. Given a Matched or Personal post, when it is live, then it shows to every signed-in account with its tag, because profile matching does not exist yet (the audience is mock, criterion 53).

_Amended the same day: the switch in criterion 76 is the home-country chip of criterion 82 (`?home=NP`), not a separate `?market=np`._

### 12. Targeting, search, the Instagram loop and related posts (added 7 Oct 2026)

_As a student, I want the feed to show what fits my destination and home country, to find posts by theme or by words, to reach OfCourse's Instagram pages, and to move from one post to the posts connected to it, so that the curated feed does what Instagram cannot._ Decided by Nikhil on 7 Oct 2026, with the markets, tags, rates and pages as repo files (ADR-110's rule).

80. Given feed settings, when the editor opens them, then they can tick any number of tags from the repo's tag file in four groups: destination (Australia, United Kingdom, New Zealand, United States), home country (Nepal, India, Thailand), theme (Work and study life, Books and movies) and age band (under 21, 21–25, over 25); a group with nothing ticked means the post is for everyone in that group; the tags show in the settings summary and lock at approval with the rest (criterion 54).
81. Given the chips on the feed, when the student picks a destination, a home country, a theme or an age band, then only the live posts tagged with it, or untagged in that group, remain; picks in several groups combine; the picks stay in the URL between the feed and its pages.
82. Given a home country picked (`?home=NP`), when a post has an approved market version for that country, then the feed and its page show that version's slides and excerpt; other posts show their main version.
83. Given words typed in the feed's search box, when the student searches, then the live posts whose title, excerpt or slide text contain every word (case-insensitive) remain, combined with the chips, and no match reads "No posts match."
84. Given a student profile that records home country, destinations and age band (Jenish's slice, by the profile contract ADR), when the student opens the feed with no chip in the URL, then those values pre-select the chips. Until his slice lands, the chips start empty.
85. Given the markets file (Nepal · NPR, India · INR, Thailand · THB) and the rate file (a mock, dated rate from each of AUD, GBP, NZD and USD into each market currency), when an editor presses "Make market version" and picks a market, then the version is reworded for that market and every money figure is converted from its own currency at the file's rate, with the line "<market currency> at <rate> per <source currency> · mock rate · <date>" under it; a post has at most one market version in this slice. Criteria 56–61 hold for every market as they hold for Nepal.
86. Given a source whose money is in GBP, NZD or USD, when the market version is made, then that currency's rate row is used; a figure with no currency code or symbol is left unconverted; a currency pair with no row refuses with "No rate for <pair>".
87. Given the board, the review panel and the live panel, when a market version exists, then they name its market ("<title> · India"), never "Nepal" for another market.
88. Given the brand files, when each page brand carries an Instagram handle and URL, then every feed page ends with "Follow OfCourse on Instagram" listing the pages, and the Adapt step pre-selects the page brand the theme rule file names for the post's theme, which the editor may change.
89. Given an exported Instagram version, when an editor pastes the post's Instagram URL (https, on instagram.com), then it is kept as a new immutable record on that version and shown in the social workbench with who added it; it is not a settings change, so criterion 54 holds. Any other URL is refused.
90. Given a feed post whose Instagram version has a recorded URL, when its page is shown, then it shows "See this post on Instagram" linking there and "Follow @<handle>" for that version's page.
91. Given a post page, when it is shown, then a "Related" section lists up to four other live posts, each with why it is there: "built on the same source", "also about <theme>", "also for <destination>", strongest first; with none, no section. Computed from the records, never by a model.
92. Given the tags, markets, rates or pages file changed and deployed, when the admin and the feed next load, then the new values are in their lists (as criteria 69 and 70).

### 13. Make a post without writing a prompt (added 9 Oct 2026)

_As an editor, I want to turn a source or a link into a finished post by choosing, never by writing prompts, with the text settled before any image is made, so that posts come out faster, on-voice and consistent; and as a student who saw a post on Instagram, I want to find it again by searching "OfCourse <title>"._ Decided by Nikhil on 9 Oct 2026 after the first live Gemini runs (ADR-129 to ADR-132). Gemini runs where only a model can do the job; code does everything it can check, and the editor never types a prompt (the two free-text inputs are optional and short).

**The flow**
93. Given pasted text or a link, when the editor presses "Make post", then extraction, three draft versions and the text checks run one after another with no further press, and the workbench stops at the versions with each step's state shown; a failed step keeps everything made before it and offers "Try again" for that step only.
94. Given an https link, when "Make post" runs, then the page is fetched on the server, cleaned to its title and paragraphs, and the source line names the site and keeps the address. A link to a private or local address, a non-HTML page, a page over 2 MB or one that does not answer within 10 seconds is refused with "Could not read that page", and the editor can paste the text instead.

**Facts by pointing (replaces the judge; settles review round 2's open questions A, B and C)**
95. Given a source, when facts are extracted, then every fact is the exact text of one source sentence, chosen by Gemini by the sentence's number; code copies the sentence, so a fact's wording and numbers always match its paragraph, and no model judges a paraphrase. The editor can add any sentence as a fact by selecting it in the source, and remove any fact.
96. Given a source title that states something no paragraph says (for example "Joining a sports club improves grades" over an article that only finds a link), when facts are extracted, then the title is listed as "Headline claim not in the article" and cannot be bound to a slide.

**Versions and editing before images**
97. Given extracted facts and a template, when drafts are made, then three versions appear side by side as slide previews (text drawn, art not yet made), each a different angle on the same facts, labelled by its angle. The editor picks one; the others stay available.
98. Given a picked version, when the editor clicks a text slot on a slide preview, then they edit it in place; the fit checks update as they type, and a factual sentence that changed is source-checked automatically when they leave the slot.
99. Given a slide, when the editor presses "Another take" on it, then only that slide's wording is redrafted, and the version history keeps the old wording.
100. Given drafts, when the editor picks an emotion (Hopeful, Calm, Curious, Reassuring, Urgent, Playful, or their own word up to 30 characters), then it is used by the drafts and by the covers, and recorded on the version.
101. Given a post with versions, when the editor opens its history, then every saved version is listed with who made it and when, and "Restore" makes it the current version again as a new version; nothing is ever lost.

**Covers**
102. Given settled text, when the editor presses "Make covers", then three cover options are drawn under the slide's text, in the page's design language, and the editor picks one. An optional "Cover idea" (up to 120 characters) steers them; an idea that asks for text, numbers or a brand is refused before any call (as criterion 38). "Another set" makes three more; each image counts against the daily image limit.
103. Given a generated cover, when it arrives, then it is checked automatically for text in the art; one with text is never offered (another is made once in its place, else "No art"). The editor never runs a vision check, and review and publish are no longer gated on a slide vision check (amends criterion 39).

**Checks the editor can act on**
104. Given text in a slide, when the source check runs (automatically after text changes), then each flagged sentence shows the source sentence it should match beside it, with "Use the source's wording", which replaces the slide sentence in one click.

**The page's design language**
105. Given a page brand, when an editor uploads one or two reference images (PNG or JPEG, up to 5 MB each), then Gemini writes the page's design language as short fields (art style, copy style, closest template); the editor edits and saves them, and from then on that page's drafts and covers follow them, with the reference images passed to the image model as style references. Colours and fonts still come from the brand file.

**Findable again**
106. Given any post, when its slides are laid out, then its last slide ends with the line `To find this again, search “OfCourse <title>”`, drawn by code, counted by the fit checks, and present on market and social versions too.
107. Given a live post, when anyone opens `/posts/<slug>` (signed in or not), then the post shows with its slides, title and source line and a call to join OfCourse, under the page title "<title> | OfCourse" with the cover as its share image; it is listed in `/sitemap.xml`. Its audience and why line are never shown there; an expired or unpublished post answers "not found".

**Social, captions and markets, narrowed**
108. Given a live post, when the editor presses "Make the set", then an Instagram version is made for each page brand that has a design language, plus a single quote card from the post's strongest fact, each with its caption, ready to export.
109. Given a caption, when it is made, then Gemini writes only the opening hook and the call to action; the body is the post's own checked lines, and the hashtags come from the post's tags. The editor can edit it (criterion 66 still applies).
110. Given a live post, when the editor makes a market version, then it is made at once with the money converted by code; "Reword for <market>" is an optional extra step.

### 14. Move back and forth between the steps (added 12 Oct 2026)

_As an editor, I want to see every step a post has been through and take it back to any of them to change something, without losing work and without taking a live post down, so that a mistake found late is a quick fix, not a new post._ Decided by Nikhil on 12 Oct 2026 during the office smoke test ("they can't go back and edit anything if needed").

111. Given a post on the admin workbench, when it has passed a step (source and facts, text versions, covers and render, review), then that step stays visible as a read-only summary, and the stage bar shows each passed step as a link that scrolls to it; steps not yet reached are not links.
112. Given a passed step shown read-only, when an editor presses "Back to <step>" on it, then the post returns to that step with its records kept, the steps after it show as not yet reached, and any approval or review for the post's working version is cleared; "Back to text versions" replaces "Reopen structures" and is offered from the render, review-ready and covers steps.
113. Given a post at its text versions, when an editor presses "Back to source", then the source text (or link) and the facts are editable again; saving a changed source runs facts, three versions and the text checks again, as "Make post" does (criterion 93), and the facts and versions made from the old source stay in the history and can be restored (criterion 101).
114. Given a post taken back to an earlier step and brought forward again, when it is rendered, then covers made before are reused only when the approved text is the same as when they were made; otherwise covers are made again (criteria 102, 103).
115. Given a post in review, when an editor presses "Withdraw from review", then it returns to rendered with no reason needed, and the reviewer's board no longer shows it as waiting.
116. Given a live post, when an editor presses "Edit", then the post goes back to its text versions as a working copy while students keep seeing the live version in the feed, on `/feed/<id>` and on `/posts/<slug>` (same slug, same slides); the board shows it in its working column with a "Live" badge.
117. Given a live post being edited, when the new version is reviewed and published, then it replaces the live version at the same slug and address; until then, nothing the editor changes reaches students.
118. Given a step running for a post (the step lock), when an editor presses any "Back to <step>", "Withdraw from review" or "Edit", then it is refused with the running step named, as other actions are.
119. Given a live post being edited, when the board or its workbench is shown, then it reads "Changed since published", and "Discard changes" returns the post to its live version (its published records, stage live) after a confirm, keeping the discarded work in the history.
120. Given a post in review, when the reviewer chooses "Request changes" (the button "Send back" becomes), then a note of up to 200 characters is required and shows on the workbench beside the step it names (text versions, covers or settings); the note stays visible while the editor goes back to any step and moves forward again, until the post is sent to review again (a post in review never carries a note, so withdrawing does not arise; corrected 13 Oct 2026 after review round 3).
121. Given a passed step, when an editor presses "Back to <step>", then a confirm lists what is kept (the versions in the history, covers that still match) and what will be made again, and only "Go back" moves the post; viewing a passed step from the stage bar needs no confirm.
122. Given a step running for a post, when the workbench is shown, then every move back is shown disabled with the running step in words ("Covers are being drawn"), not refused only after a press.

## Edge cases

- **The planted claim**: caught at extraction and blocked. Criteria 23 and 24. From the build plan (G2) and handover §0c.
- **A claim with no source behind it** blocks approval of the structure. Criterion 28. From the spec, AD-E1 and AD-R2.
- **A slot over its limit, a theme under 4.5:1, text too small on a phone**: Render blocked, naming what failed. Criteria 34 and 35. From the spec, AD-E2, AD-E3 and AD-R4.
- **The source check can't find a claim**: removed or marked opinion before review. Criterion 43. From the spec, AD-E6 and AD-R10.
- **An editor tries to approve**: refused. Criterion 44. From the spec, AD-E7.
- **One account makes and approves a post**: allowed and recorded. Criterion 46. From the PM.
- **The reviewer won't approve**: sent back with a required reason. Criterion 47. From the PM; the spec's AD-P7.
- **Two editors on one post**: the later save is refused and nothing is overwritten. Criterion 21. From the PM.
- **A role removed mid-work**: the next action is refused. Criterion 16. From the code's pattern, where every admin action re-checks the role (`src/shared/lib/auth/access.ts`).
- **A model call fails or times out**: replay for the demo sources, "Try again" for any other; nothing lost or made up. Criteria 4 and 5. From the PM.
- **The daily cap is reached**: treated as a failed call. Criterion 6. From the build plan, Part D.
- **Art fails or is slow**: pre-rendered cover for the demo, text-only cover otherwise. Criterion 37. From the build plan (G4) and the PM.
- **An art prompt with text, numbers or a brand**: refused. Criterion 38. From the spec, AD-R3.
- **A render with unreadable text, a wrong figure or stray text in the art**: flagged, publishable only by a reviewer override. Criterion 39. From the build plan (G8).
- **Featured layer**: audience forced to everyone. Criterion 50. From the spec, AD-E9.
- **Personal or matched post with no why line**: cannot be sent. Criterion 51. From the spec, AD-E8 and AD-R12.
- **A structure reopened after approval**: the gate locks again. Criterion 32. From the spec, AD-E24.
- **One slide regenerated**: only its art changes. Criterion 41. From the spec, AD-E25.
- **Nepal version of a source with no money figure**: no conversion, nothing added. Criterion 58. From the spec, AD-E11, and ADR-083.
- **The model changes a number in the Nepal version or a caption**: rejected. Criteria 59 and 65. From the build plan (G5, G6) and AD-R6.
- **Adding a variant after review**: not possible. Criterion 61. From the PM (variants are reviewed with their post).
- **A social caption edited**: export blocked until rechecked. Criterion 66. From the spec, AD-E10.
- **Adapt on a post that isn't live**: unavailable. Criterion 62. From the spec, AD-R11.
- **Editors and reviewers on the student sign-in page**: refused. Criterion 12. From the PM; changes Jenish's criterion 16 (see Dependencies).
- **An admin changing content roles**: refused. Criterion 10. From the PM and the code (`canManageRoles`).
- **The market reviewer for Nepal** (AD-F23, AD-Q13): decided out of scope by Nikhil.
- **Phone-width admin screens**: decided out of scope by Nikhil.
- **An expired post** (feed): gone from the feed, its page "not found". Criterion 73. From the settings' expiry rule (criterion 54) and the PM.
- **A Featured post older than 72 hours** (feed): no longer pinned. Criterion 72. From criterion 49's "pinned 72 h".
- **The Nepal switch on a post with no Nepal version**: the main version shows. Criterion 76. From the PM.
- **An image of a draft, a post in review or a social version requested through the feed's image route**: "not found". Criterion 77. From the code (the admin's asset route is staff-only; students need a route that serves approved renders alone).
- **A Studio link with no Studio built yet**: the call to action is text, not a link. Criterion 71. From the code (nothing to link to).
- **Audience matching**: every live post shows to every account. Criterion 79. Decided by Nikhil, 7 Oct 2026: profile rules are a later slice.
- **A money figure with no currency** ("about 500 a week"): not converted in a market version. Criterion 86. From the code (`numbersIn` reads the unit from the code or symbol before the number).
- **A currency pair with no rate row**: the market version is refused with the pair named, never converted at a guessed rate. Criterion 86. From ADR-097's rule that every rate is a labelled fact.
- **An Instagram URL off instagram.com, or not https**: refused. Criterion 89. From the PM.
- **A post with no tag in a group**: shows under every chip of that group. Criterion 81. From the PM.
- **A profile with values and a URL with chips**: the URL wins; the profile only fills empty chips. Criterion 84. From the PM.
- **Related posts**: never the post itself, never a post that is not live, at most four. Criterion 91. From the PM.
- **A theme with no entry in the pages rule file**: the Adapt step pre-selects nothing and the editor chooses. Criterion 88. From the code (the rule file is data).
- **Going back while a step runs**: refused, naming the step. Criterion 118. From the code (the step lock, `server/steps.ts`).
- **Going back past an approval**: the approval and any review stop counting for the working version only; a live version stays live. Criteria 112, 116. From the PM.
- **Covers after a text change**: made again; kept when the text is unchanged. Criterion 114. From the code (the restore rule, criterion 101).
- **Instagram versions made from a live post that is then edited**: stay as they were exported. Decided out of scope for change by Nikhil, 12 Oct 2026.
- **A reviewer's "Send back"**: unchanged; criterion 115 adds the editor's own move. From the PM.

## Constraints

- **Deadline.** Stories 1–7 and 10 were live by 8 Oct. The user test moved to **12 Oct** (Nikhil, 7 Oct 2026): the student feed (story 11) is in it. Everything else by the submission deadline, **18 Oct 2026** (verified on aibuildercup.com, 7 Oct).
- **Hosting.** The same deployed Google Cloud environment as the student app, on the Google Cloud project on Jenish's account.
- **Models.** Every model step is a real call to Gemini or Vertex AI image generation, with the fallbacks in criteria 4–6 and 37. The model returns structured output checked by code; it never decides a published fact (build plan, "Rule for every use case"; ADR-077).
- **Cost.** A per-day cap on image calls and on Pro-class calls, set in configuration (build plan, Part D).
- **Sign-in.** The repo's existing authentication (Better Auth). Editors and reviewers use the admin sign-in page that Jenish's slice builds.
- **Design.** The Industry design system (`src/design-systems/industry/DESIGN.md`) for the admin itself. The frozen "Admin app - round 2" frames are the visual reference. Posts render in the brand from the repo's brand files.
- **Record.** The decision record wins over the spec and the design. Where this intent departs from the record, a new ADR records it (see Open questions).
- **Name.** "OfCourse Admin", with no internal names anywhere (AD-R18).
- **Data.** Audience counts are mock and labelled. The exchange rate is mock and labelled.

## Out of scope

- **Route comics** and the comic gap list (AD-F27 to F33). A later admin slice.
- **Targeted updates** such as the scholarship (AD-F34 to F37). A later admin slice.
- **Insights, Ideas, Maintenance and Parsing** (AD-F38 to F52), and the research agent (G7). Later slices.
- **Audience matching from student profiles.** The feed (story 11, added 7 Oct 2026) shows every live post to every account; the chips and the profile pre-selection of story 12 narrow it, matching rules do not exist. **The feed as the student home**: the dashboard stays the home until Jenish's opening slice decides it.
- **Several market versions per post**, **embedding similarity between posts** and **a map view of connected posts**: after the submission. Story 12 ships one market version per post, explicit Related edges and chips.
- **Real audience counts** from student accounts.
- **The market reviewer** for Nepal (ADR-063, AD-F23).
- **A Templates or Brands editor** in the app. Templates and brands are repo files (the Brands editor stays cut, ADR-057).
- **Roles and budgets screens** (AD-F53) and the answers approval screen (AD-F55).
- **Editor-only publishing** for lifestyle and self-help posts (AD-P3). Every post is reviewed in this slice.
- **Posting to social platforms.** Export only (ADR-033).
- **Phone-width admin screens.**
- **The counsellor role** (ADR-020).
- **Unpublishing a live post**, and going back on a comic (the comics slice, `docs/route-comics-and-gaps/`, takes the same pattern for its path, storyboard and panels). Decided by Nikhil, 12 Oct 2026.

## Dependencies

- **Jenish's admin sign-in page** (`docs/student-opening-three-futures/intent.md`, criteria 17–19). This slice builds on it, and changes his criterion 16 (editors and reviewers are refused on the student page too) and criterion 18 (editors and reviewers are let in on the admin page).
- **Google Cloud access**: Nikhil is an owner of the project on Jenish's account (ADR-098). It needs Vertex AI enabled and the image-model quota granted (Jenish's open question 8).
- **The demo sources**, written by Nikhil: "Paid work and grades", with its money figure in the source itself (AD-Q4), "How much do you love your future self?", and a twin of one with a planted wrong figure (build plan, Part C).
- **The mock brand files**: the feed brand and the page brands Main, Cerebral and Infographics (fonts, colours, themes, tone), written by Nikhil.
- **The four feed templates** as files, with their slots and limits, taken from the frozen design.
- **The exchange-rate fact** for Nepal: mock 88 NPR per AUD, shown as "NPR at 88 per AUD · mock rate · 1 Oct 2026" (ADR-097); from 7 Oct 2026, a rate file with twelve mock rows (AUD, GBP, NZD, USD into NPR, INR, THB), all labelled mock.
- **The student profile contract** (an ADR agreed with Jenish, 7 Oct 2026): his slice stores `homeMarket`, `destinations` and `ageBand` under those names; the feed reads them when present (criterion 84).
- **The Instagram pages** @ofcourse_ai, @ofcourse_philosophy and @ofcourse_selfhelp, created by Nikhil; the links show before the pages exist.

## Open questions

1. **Is there a decision record newer than ADR-091?** The copy in the handoff pack stops at ADR-091 (2 Oct); Jenish's intent cites ADR-092 to 099. Owner: Nikhil. Does not block.
   - 5 Oct 2026, answered: yes, `Downloads/SHARED-decision-record.html` (ADR-092 to ADR-104, 3 Oct). Reconciled with this intent in ADR-105 to ADR-112.
2. **Record the decisions this brainstorm made as new ADRs.** Owner: Nikhil. Does not block. The decisions:
   - Editor and reviewer are account roles; one account can hold both; a superadmin can act as either.
   - Self-review is allowed and recorded.
   - The editor sets feed settings before review, and the reviewer publishes (settles AD-Q7).
   - Every post is reviewed in this slice.
   - The editor chooses one to three templates per drafting run.
   - Templates and brands are repo files.
   - Variants are reviewed with their post.
   - Nikhil owns this slice's model calls (the build plan gave G2 to G8 to Jenish).
   - 5 Oct 2026, answered: recorded as ADR-108 (roles), ADR-109 (review and publishing), ADR-110 (templates and brands), ADR-111 (immutable records, one layout engine) and ADR-112 (AI in the admin, owner Nikhil). Jenish's decisions are ADR-105 to ADR-107.
3. **Agree the changes to Jenish's criteria 16 and 18.** Owners: Nikhil and Jenish. Blocks criteria 11 and 12 only.
   - 5 Oct 2026, answered: agreed with Jenish. His admin sign-in page is at `/admin/sign-in`, outside the staff layout; his student page refuses content roles (ADR-105, ADR-108).
4. **Which source and date does the mock exchange rate carry?** Owner: Nikhil. Blocks criterion 57 only; until answered, the slide reads "88 NPR per AUD · mock rate · 1 Oct 2026".
   - 5 Oct 2026, answered: the mock rate stays, shown as "NPR at 88 per AUD · mock rate · 1 Oct 2026" under the converted figure (ADR-097, ADR-112).
5. **Can an admin account also hold editor or reviewer?** Owner: Nikhil. Does not block; until answered, it cannot.
   - 5 Oct 2026, answered: yes, an admin may also hold editor or reviewer (ADR-108).
6. **What is the legibility minimum for feed posts at phone width?** The spec gives 11 px at 328 px for comics (AD-F29) and no figure for feed posts. Owner: Nikhil. Does not block; the comic figure is used until answered.
   - 5 Oct 2026, answered: 11 px at a 328 px phone width (ADR-112).
7. **Do social versions get fit checks before render?** (AD-F26, AD-Q14.) Owner: Nikhil. Does not block; until answered, the same checks as criterion 34 run on the re-skinned layout.
   - 5 Oct 2026, answered: left for now. Social versions get no fit checks in this slice (ADR-109).

## Changes

- 5 Oct 2026, Nikhil, before building: reconciled with the decision record (ADR-092 to ADR-104) and recorded as ADR-105 to ADR-112. Admins may also hold editor or reviewer, so criterion 14 now reads "holds neither editor nor reviewer". Criterion 57 names the rate line from ADR-097. Open questions 1–7 answered.
- 6 Oct 2026, Nikhil, during the smoke test: a post's title is checked as a claim only when it states a number (a label like "Test Feed" is not a fact; the planted twin title is still caught).
- 6 Oct 2026, Nikhil, after the branch review: criteria 11 and 12 are delivered with Jenish's sign-in pages (ADR-105, ADR-108). This branch provides `isStudent` and lets `/admin/sign-in` through the proxy; the criteria are proven by his e2e tests once his pages land.
- 7 Oct 2026, Nikhil, after the research on the current Google stack (`reports/Google AI stack for OfCourse.md`, `docs/hackathon/decisions-2026-10-07.md`): Imagen is shut down, so cover art moves to `gemini-nano-banana-2.1` through `generateContent` on the `global` location (criteria 6, 36, 37, 38 unchanged, provider only); sentences keep abbreviations and initials whole (criteria 23, 42, 65, fewer false claims); the fit check fails a slot whose characters the brand font cannot draw (criteria 34, 35 extended). Plan Tasks 29–32. _Criterion numbers corrected 11 Oct 2026 (review round 2): this entry first read 13 for the provider and 14 and 20 for the sentences._
- 7 Oct 2026, Nikhil, scope: the student feed joins this slice as story 11 (criteria 71–79): `/feed` for every signed-in account, a post page with the slides, a "Nepal prices" switch, a student-safe image route; audience matching stays mock and the feed is not the home. Plan Tasks 33–35.
- 7 Oct 2026, Nikhil, scope: story 12 (criteria 80–92): tags in four groups from a repo file, feed chips and search, the home-country chip as the market-version switch (amends criterion 76), markets and a twelve-row mock rate file for Nepal, India and Thailand against AUD, GBP, NZD and USD (one market version per post), Instagram pages in the brand files with a post-publish URL record, and a Related section from explicit edges. The user test moves to 12 Oct. Plan Tasks 36–42.
- 9 Oct 2026, Nikhil, after the first live Gemini runs: story 13 (criteria 93–110). One "Make post" flow from text or a link; facts are exact source sentences chosen by Gemini (the paraphrase judge goes; a headline claim the article does not make is shown, unbindable); three draft versions as slide previews, edited in place before any image; emotion chips; three cover options with an optional idea and an automatic text-in-art check (the slide vision check leaves the editor's flow; amends criterion 39); flags show the source sentence with a one-click fix; a design language per page from reference images; a standard last-slide search line and a public, indexable page per live post; one source to a set; captions limited to hook and call to action; market versions instant with rewording optional. Supersedes review round 2's open questions A, B and C. ADR-129 to ADR-132.
- 9 Oct 2026, Nikhil, building Task 53 (criterion 105): how a post is "on a page". The page is chosen at "Make post" (None, or one of the page brands) and can be changed in the structures step until approval; it is stored on the post's pointers (`pageBrandId`, none on older posts), not on the source record, because the source record is immutable and hashed into the facts and drafts. When that page has a design language, the drafts and "Another take" carry its copy style, and every cover (the render's, "Try again", "Make covers") uses its art style in place of the brand tone, with its reference images sent to the image model as style references; with no page, or a page with none, everything is as before. A social version on the post's own page reuses the post's art; on another page that has a design language it draws its own cover in that page's style (falling back to the post's art), and its caption follows that page's copy style. Colours and fonts still come from the brand file.
- 11 Oct 2026, Nikhil, after review round 2: a new market is a code change, on purpose. A stored market version names its market from a fixed list in code (`MARKET_IDS` in `src/features/content/markets/index.ts`, the `market` field of the market record), so a record always names a market the code knows how to convert and label. Criterion 92 holds for edits to the markets, rates, tags and pages files (names, notes, rates, labels); adding a market means adding its id to that list, and its currency to `MARKET_CURRENCIES` beside it, in the same change as its rows in `markets.json` and `rates.json` and its `home:` tag in `tags.json`; a file edit alone fails the parse at load. Nothing in this slice derives the lists from the files.
- 11 Oct 2026, Nikhil, three small calls with the review round 2 fixes: a title sentence becomes a headline claim (criterion 96) only when it has a verb or a number, so a label such as "Test Feed" or "Paid work and grades" is no claim and is never checked, while "Joining a sports club improves grades" still is; the fit rows of a slot being edited in place update as the editor types (criterion 98), measured on the server with the render's fonts once typing pauses, the saved drafts staying the authority; and `/posts/<slug>` and `/posts/assets/<id>` (criterion 107) allow about 60 requests a minute per client address each, then answer 429 with `Retry-After`, counted in the server's own memory (right for the one Cloud Run instance).
- 12 Oct 2026, Nikhil, during the office smoke test: story 14 (criteria 111–118). Every passed step stays visible and linked from the stage bar; "Back to <step>" from any step ("Back to text versions" replaces "Reopen structures"); a changed source remakes facts and versions, the old ones kept in the history; an editor can withdraw a post from review; "Edit" on a live post works on a copy while the live version stays up until the new one is published. Plan Tasks 60–64. Same day, after research on Contentful, Sanity, Webflow, Canva, Figma and Buffer (their patterns for drafts beside published items, approvals and step wizards): criteria 119–122 add "Changed since published" with "Discard changes", "Request changes" with a note at the step it names, a confirm on going back, and moves shown disabled with the reason while a step runs. Later the same day, Nikhil asked for one screen per step instead of one long scroll: criterion 111's "passed steps stay visible and the stage bar scrolls to them" becomes "each step is its own screen; the step bar opens a passed step read-only", delivered by `docs/guided-post-design/intent.md` GD27.
