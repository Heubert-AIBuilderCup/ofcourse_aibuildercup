# The pitch: video script and deck content

_Draft, 11 Oct 2026, for Nikhil and Jenish. Delivers SR12 of docs/submission-readiness/intent.md. Written for the AI Builder Cup judges (40% technical merit and Google Cloud architectural depth, 25% problem alignment, 25% innovation, 10% UX). Every claim below is taken from README.md (d1a7b0c), docs/architecture.svg, PRODUCT.md, docs/decisions/000-context.md, the admin intent (stories 11 to 13) and the live runs on `applyims`, 9 to 11 Oct 2026. Theme: **Media, Content & Digital Experiences** (ADR-128, **proposed**: Jenish has not confirmed it yet; change the title slide and scene 2 if the theme changes)._

Placeholders in square brackets, starting `[from the 12 Oct test: …]`, are filled from the user test notes (`docs/admin-feed-post-from-source/user-test.md`). `[live URL]` is filled after the deploy. Nothing else in the script should change without checking it against the README.

## 1. The video script

Under three minutes: 426 spoken words (the scene 7 placeholder counted as three) at about 150 words a minute is 2:50; the scene times below add up to **2:52**. Record the voice first, then cut the screen recording to it. Speak the product name as "Of Course". Burn in captions (the judges may watch without sound).

| # | Seconds | On screen | Said |
| --- | --- | --- | --- |
| 1 | 0:00–0:21 | A student's phone, then the OfCourse sign-in at `/`. A caption: "Study in Australia, and stay if I can." | A student in Nepal wants to study in Australia, and stay if she can. Course search tells her what she can study. She is asking what happens to her life for the next six years. When the advice she reads is wrong, she can't tell, until it costs her money or an application. |
| 2 | 0:21–0:36 | `/futures`: the three futures side by side, the chips under each. Then a cut to the admin Board. | OfCourse shows her three possible futures side by side, built around cost, staying and career, with nothing ranked. Around it sits a content engine, so that what she reads in the feed stays true to its source. |
| 3 | 0:36–0:53 | The new post screen: a link pasted, "Make post" pressed. The steps tick over. The source pane with numbered sentences (¶2.3) and the facts list. Then the three versions side by side. | An editor pastes a link and presses Make post. There is no prompt box. Gemini 3.8 Flash points at the sentences that state facts, and our code copies them word for word. Then Flash drafts three versions, each from a different angle. |
| 4 | 0:53–1:06 | The editor picks a version, clicks a slot on the slide and types; the fit-check row changes as they type. "Another take" on one slide. The history panel with "Restore". | The editor picks one and edits right on the slide, with the fit checks updating as they type. Another take redrafts a single slide. Every version is kept and can be restored. |
| 5 | 1:06–1:29 | The planted error: the editor changes one figure on a slide (use a figure from the actual demo source; the eval's example is "45 days" changed to "54 days") and clicks away. The sentence is flagged "Not found", with the source sentence beside it. "Send to review" is unavailable. "Use the source's wording" is pressed and the flag clears. | Now a planted error. The source says forty-five days; the editor types fifty-four. On leaving the slot, the source checker flags it and shows the sentence it should match. A number the source doesn't contain is rejected by code, whatever the model says. One click restores the source's wording; until then, the post can't go to review. |
| 6 | 1:29–1:45 | "Make covers": three cover options under the settled text. One is picked. | Once the text is settled, it draws covers: three options from Nano Banana, in the page's own style. A second check rejects any cover with text in it, because every word on a slide is drawn by our code. |
| 7 | 1:45–2:01 | The review panel: slides, facts, source-check results, feed settings. "Approve and publish". The card moves to Live on the Board. | A reviewer sees the slides, facts and source check together, and publishes. What was approved is pinned, and that is exactly what students see. In our user test, a marketer went from link to published in [from the 12 Oct test: time from link to published]. |
| 8 | 2:01–2:20 | `/feed` at phone width: the destination and home-country chips; the Nepal version with the rate line under a price. The post's last slide with "To find this again, search “OfCourse <title>”". The title typed into the feed search; the post found. The public `/posts/<slug>` page, signed out. | In the feed, the student filters by destination and home country, and sees prices in rupees, converted by code. The last slide tells her to search OfCourse and the title: every live post has a public page under that title, and the feed search finds it too. |
| 9 | 2:20–2:44 | docs/architecture.svg, full screen, then the Cloud Trace waterfall of one post and the eval result in the terminal. | It runs as one service on Cloud Run, with Cloud SQL and Secret Manager. Gemini runs on Vertex AI, with no API key. Pro and image calls are capped per day, and every call is traced in Cloud Trace and labelled for billing. On our eval, the source check caught ten of ten planted errors, with no false alarms. |
| 10 | 2:44–2:52 | The OfCourse logo and `[live URL]`. | Gemini where only a model can help. Code for everything it can check. A person before anything is published. That's OfCourse. |

**Notes for the recording**

- Scene 1 says "a student in Nepal": Nepal, India and Thailand are the home markets in `src/features/content/markets/markets.json`. She is an illustration, not a tester.
- Scene 3: "There is no prompt box" is ADR-129. The two optional fields (a cover idea, the editor's own word for the emotion) are not prompts to the model; do not show them as if they were.
- Scene 5 must show a figure the source does not contain. A changed wording with the same numbers goes to the model, which may judge it supported; only a changed number is ruled "not found" by code alone.
- Scene 7's test line is cut if the 12 Oct test did not time a full post. Then the scene runs 4 seconds shorter.
- Scene 8: Google indexing takes days to weeks after launch (ADR-131), so show the search in the OfCourse feed, never a Google results page that does not yet exist.
- Scene 9's Cloud Trace shot needs `OTEL_ENABLED=1` on the deployed service. If tracing was not on when the post was made, show Cloud Logging's `ai_call` lines instead and say "logged in Cloud Logging" for "traced in Cloud Trace".

## 2. The deck, slide by slide

Twelve slides, exported as a PDF. Industry design system colours and Barlow, as in the app. One message per slide; the speaker note is what the presenter says if the deck is presented live.

### 1. OfCourse

- **Message:** Checked content for students deciding where and what to study abroad. Entry under Media, Content & Digital Experiences [theme proposed in ADR-128: confirm before export].
- **Visual:** The OfCourse logo over a phone showing a feed post; the team's names; `[live URL]` and the GitHub link.
- **Speaker note:** OfCourse helps international students decide where and what to study, starting with Australia, and makes the content they read stay true to its source.

### 2. The problem

- **Message:** Students ask "what happens to my life for the next six years?", and every tool answers "what can I study?". When the advice is wrong, they cannot tell.
- **Visual:** Two speech bubbles: "What can I study?" (course search) against "What happens to my life?" (the student). Below, the three failures from the decision record: comparison is impossible, the route is invisible, profiling is extractive.
- **Speaker note:** Cost, visa, work rights and family all move together and nothing shows them moving together. A student does not know enough to spot a wrong number until it has cost them money or an application.

### 3. Who it is for

- **Message:** Three groups, one product.
- **Visual:** Three columns with an icon each. **Students** from Nepal, India and Thailand choosing a course and a route abroad (`/`, the opening, the futures, the feed). **Editors and reviewers** on the marketing team (`/admin`, Google sign-in). **Anyone** who finds a post on Instagram or Google (`/posts/<slug>`, no sign-in).
- **Speaker note:** The student is the audience; the marketing team is who the content engine serves; the public page is how a post found elsewhere leads back to OfCourse.

### 4. The solution

- **Message:** Three futures side by side for the student, and a content engine that keeps every post true to its source.
- **Visual:** Left: `/futures` with the three futures (cost, staying, career) and their chips. Right: the pipeline in one line: source → facts → three versions → edit → source check → covers → review → live.
- **Speaker note:** The futures are rules in code over a mock Australia catalogue, with no model call. The content engine uses Gemini only where a model is needed, and a person approves every post.

### 5. The demo: from a link to a post a student finds again

- **Message:** An editor turns a link into a published post by choosing, never by writing a prompt.
- **Visual:** Six screenshots in a row, numbered: (1) link pasted, "Make post"; (2) three versions; (3) edit on the slide; (4) the planted error flagged with the source sentence beside it; (5) the reviewer's "Approve and publish"; (6) the feed and the last slide's line "To find this again, search “OfCourse <title>”".
- **Speaker note:** The three versions came back in 14.8 seconds in our live smoke run. In the user test, a marketer went from link to published in [from the 12 Oct test: time from link to published]. [from the 12 Oct test: one quote from the marketer, with their consent.]

### 6. Eight agents, and what code checks

- **Message:** Each agent does one job with its own versioned prompt, and code checks every answer before it is used.
- **Visual:** The README's agents table, shortened to three columns:

  | Agent | Model | What code checks |
  | --- | --- | --- |
  | Extractor | 3.8 Flash | Points at sentence numbers; code copies the sentence, so a fact is exact source text. A headline no paragraph supports cannot be used. |
  | Drafter | 3.8 Flash | Every slot filled in order and within limits; factual slots cite real facts and only their numbers. |
  | Source checker | 3.5 Flash-Lite | A number the source lacks is "not found", whatever the model says. |
  | Illustrator | Nano Banana 2.1 | Code builds the prompt; a digit, quote or brand name is refused before the call. |
  | Art checker | 3.5 Flash-Lite | A cover with text is never offered. |
  | Localiser | Code; 3.5 Flash-Lite rewording | Money converted by code at a dated rate; the rewording may not change a number. |
  | Captioner | 3.5 Flash-Lite | Writes only the hook and the call to action; no numbers. |
  | Style reader | 3.5 Flash-Lite | A page's design language from reference images; the template must exist. |

- **Speaker note:** These are steps in a pipeline our code runs, not autonomous agents: none calls another or picks its own tools. That is deliberate: every step can be checked.

### 7. A person approves every post

- **Message:** Three human checkpoints, and what the reviewer approved is exactly what is published.
- **Visual:** The three checkpoints from the architecture diagram: (1) the editor picks a version and edits it; (2) the editor picks a cover; (3) the reviewer approves and publishes. Beside them: "A sentence the source check did not find blocks sending to review." "An editor without the reviewer right cannot approve; a post approved by its maker is labelled self-reviewed." "What was approved is pinned by id."
- **Speaker note:** Posts are immutable records. The feed and the public page serve only the version the reviewer approved, so nothing changes after approval.

### 8. Google Cloud architecture

- **Message:** One Cloud Run service, Cloud SQL, Secret Manager, and Gemini on Agent Platform, with every call visible in Cloud Trace, Cloud Logging and billing.
- **Visual:** docs/architecture.svg, full slide.
- **Speaker note:** One Next.js 16 app on Cloud Run, migrations as a Cloud Run job from the same image, built by Cloud Build and stored in Artifact Registry. Postgres 17 on Cloud SQL holds every record, the model call log and the answer cache. Secrets come from Secret Manager at start-up; Gemini is reached through a service account, with no API key.

### 9. Gemini where only a model can help, and the eval

- **Message:** Four Gemini models by tier, one retry ladder, and an accuracy eval: 10 of 10 planted errors caught, 0 false alarms.
- **Visual:** Left: the tiers (Flash-Lite for checks and short text; 3.8 Flash for extraction and drafts; 3.1 Pro as the last rung, capped; Nano Banana 2.1 for covers, capped). The ladder: cache → first model → retry with the list of problems → Pro. Right, large: "10 / 10 planted errors caught · 0 false alarms" with the line "30 claims over 5 sources; 10 planted: a changed number, a changed unit, a generalisation, a claim only in the title. Source check on 3.5 Flash-Lite. Pass bar: 10 of 10, at most 2 false alarms."
- **Speaker note:** The eval runs live with `bun run ai:eval`. The source check runs on Flash-Lite: 1.1 seconds in the smoke run.

### 10. Cost and safety

- **Message:** Code decides whatever can be checked; the model proposes.
- **Visual:** Four tiles. **Facts and numbers are code:** facts are exact source sentences; money is converted from a dated rate file. **Code draws every word:** slides are laid out and rendered by our layout engine, never by the image model. **Daily caps:** Pro and image calls reserve a slot under a cap counted in the database; no cap set means no call. **Labels and telemetry:** every Gemini request carries billing labels (app, use case, tier, prompt version, env), one span in Cloud Trace and one log line, never a prompt, an answer or a user id.
- **Speaker note:** Pasted sources are sent as data with a rule that they are never instructions. An identical request is answered from the cache in Postgres, and the tests run on a fake provider that never spends.

### 11. Impact, and what comes next

- **Message:** What we measured, and what we build next.
- **Visual:** Left, measured: the eval (10 of 10, 0 false alarms); the smoke run (each live use case answered in 1 to 15 seconds); [from the 12 Oct test: time from link to published]; [from the 12 Oct test: how many of the three students found a post again from its title]; [from the 12 Oct test: one student or counsellor quote, with consent]. Right, next (decided, not built): the research agent on ADK TypeScript (ADR-118); course matching with retrieval in Postgres (ADR-117); the feed chips pre-set from the student's profile (ADR-126); briefs for the counsellor and the family at submission (ADR-064).
- **Speaker note:** The decision record names the measures we will track: posts per editor per week and cost per post, from the model call log and the billing labels.

### 12. The team

- **Message:** Who built OfCourse.
- **Visual:** A photo and one line each. **Nikhil**: product, the content engine and the admin. **Jenish**: the student opening and the futures. [confirm names, titles and photos against the roster locked on 11 Oct.]
- **Speaker note:** Thank you. The repository, the live site and this deck are linked on the first slide.

## 3. Shots to capture

During the deploy and the 12 Oct test, so the video and deck can be cut from real screens. Record at 1440 or 1920 wide for the admin and at 390 wide for the feed. Before recording, ask each tester's consent to be quoted or shown; show no tester's email or face without it. Never record a secret's value, a terminal with environment variables printed, or the dev-login header.

**From the deploy**

- [ ] `gcloud run deploy --source .` finishing, with the service URL.
- [ ] The Cloud Run service page for `ofcourse` (revision, region, the Cloud SQL connection).
- [ ] The Cloud SQL instance overview (PostgreSQL 17).
- [ ] Secret Manager's list of secret names (names only).
- [ ] A Cloud Trace waterfall of one post being made, with the `gen_ai` spans and their attributes (needs `OTEL_ENABLED=1`).
- [ ] Cloud Logging filtered to `jsonPayload.event="ai_call"`, a few lines expanded.
- [ ] A Cloud Billing report grouped by the `use_case` label (billing data can lag by a day; capture it last).
- [ ] The terminal at the end of `bun run ai:eval` showing 10 of 10 planted and 0 false alarms.

**From the user test (marketer and reviewer)**

- [ ] The Board with real posts in their columns.
- [ ] The link pasted and "Make post" pressed; the steps ticking over.
- [ ] The source pane with numbered sentences and the facts list.
- [ ] The three versions side by side.
- [ ] A slot edited on the slide with the fit checks changing; "Another take" on one slide; the history panel.
- [ ] The planted error: a changed figure flagged "Not found" beside its source sentence, "Send to review" unavailable, then "Use the source's wording". (Stage this after the test if the marketer does not trigger it.)
- [ ] "Make covers" with three options; one picked.
- [ ] The review panel, "Approve and publish", and the card moving to Live.
- [ ] The time from link pasted to published, noted with a clock, for the placeholder in scene 7 and slide 5.
- [ ] One sentence from the marketer about not writing a prompt, if they say one.

**From the user test (students and counsellor)**

- [ ] `/futures` with three futures, at phone and desktop width.
- [ ] `/feed` at 390 wide: the chips, a picked destination and home country.
- [ ] A market version with the rate line under a price.
- [ ] A post page: slides, the related posts, the last slide's search line.
- [ ] The title typed into the feed search and the post found; how many of the three students found it.
- [ ] A public `/posts/<slug>` page opened signed out.
- [ ] One quote from a student or the counsellor about trusting the content.
