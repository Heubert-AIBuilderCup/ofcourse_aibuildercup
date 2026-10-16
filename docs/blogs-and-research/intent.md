---
title: Blogs beside posts, and posts that start from an idea
author: Nikhil
---
# Blogs beside posts, and posts that start from an idea
_Intent written 13 Oct 2026 with Nikhil, from a brainstorm during the office smoke test. No ticket. Builds on `docs/guided-post-design/intent.md` (stories 1–10) and story 14 of `docs/admin-feed-post-from-source/intent.md`._

## Problem

OfCourse's reach depends on being found. Search engines and AI answer engines (GEO) reward recency, clicks and relevance, and a carousel alone gives them little to read. A student who sees a post on Instagram has nowhere to go for depth. The website, the app and the social pages do not send people to each other. Nikhil's aim: "a user could see a post on Instagram and go to the website for a detailed blog… this will drive traffic to the website too."

Editors also cannot start without a link. When they have only an idea, they must find sources themselves before OfCourse can help, and a claim the article does not support has no way to be researched further (GD35).

## Proposed outcome

An editor can write a reviewed, fact-checked blog with the same guided steps as a post, then turn it into posts that link back to it. Or they can make a blog from a post when they choose. Blogs live on OfCourse's own site, where search and AI answer engines can read them, and in the student feed, linked both ways with the posts and the social pages. An editor with only an idea gets sources suggested by Gemini's search, picks the ones to trust, and continues as if they had pasted links.

## Affected users and systems

- **Editors and superadmins** make blogs and start posts from an idea.
- **Reviewers** approve and publish blogs as they do posts.
- **Admins** see blogs read-only.
- **Students** read blogs in the feed.
- **Signed-out readers, search engines and AI crawlers** read blogs on the public site.
- **Systems:** the content engine (`src/features/content/`), the public site (`/blog/<slug>`, the sitemap, structured data), the student feed, Gemini on Vertex AI with Google Search grounding, and the safe link reader (criterion 94).
- **Decision owner:** Nikhil.

## Scope

Admin: blogs as a content type with the guided steps; "Make a blog" on a post; "Make posts from this blog"; starting a post or blog from an idea; "Research this" on an unsupported claim. Public: `/blog/<slug>` pages and their sitemap entries. Student: blog cards in `/feed` and a blog page in the feed. Local development and the Cloud Run deployment.

## User stories

1. As an editor, I want to write a blog with the same guided steps as a post, so that a long, checked article takes no more prompting than a carousel.
2. As an editor, I want to make posts from a blog, and a blog from a post when I choose, linked both ways, so that each brings readers to the other.
3. As a student or a searcher, I want to read a blog on OfCourse's site and in the app, with its sources, its posts and a way to follow the pages, so that I get the full picture and can come back.
4. As an editor with only an idea, I want Gemini to suggest sources I can pick from, so that I can start without hunting for links.
5. As an editor, I want to research a claim the article does not support, only when I ask, so that I can back it up without spending tokens on every sentence.

## Acceptance criteria

### 1. A blog with the guided steps

BR1. Given the admin Board, when an editor chooses "New blog", then they start from links (one to five) or an idea (story 4), with a framing line and notes as for posts (GD18–GD21). A blog goes through Source, Ideas (blog angle cards, with the top three marked "Recommended"), Outline, Text, Images, Settings, Review and Live, each step its own screen, editable in place (GD27, GD28).
BR2. Given a picked blog angle, when the outline is shown, then it lists the blog's sections. Each has a question-style heading ("How many hours can I work on a student visa?") and a one-line point. The outline always ends with "Key takeaways" and an FAQ of three to five questions. The editor reorders, adds, removes or rewords sections, then presses "Write the blog".
BR3. Given an outline, when the blog is written, then each section's text is drafted from the checked facts only. Every factual sentence is checked against its source as for slides (criteria 43, 104), numbers must be in the facts (criteria 26–31, GD21), and the editor edits any section in place. The body runs about 600 to 1,200 words.
BR4. Given blog text, when the editor reaches Images, then a cover picture and up to three inline pictures are planned in words first and drawn on "Draw images" (GD12–GD14, with the progress and resume of 13 Oct). The editor can also embed slides from the blog's posts (story 2) in place of a picture.
BR5. Given a blog ready for review, when it is sent, then a reviewer approves and publishes it, or requests changes, as for posts (criteria 115, 120). Story 14's back-and-forth, "Changed since published" and "Discard changes" apply, and a live blog stays up while it is edited (criteria 116, 117).

### 2. Posts and blogs, linked both ways

BR6. Given a live blog, when an editor presses "Make posts from this blog", then a new post starts with the blog as its source. Its idea cards are drawn from the blog's sections (one post per section, or a summary post), and any number of posts can be made.
BR7. Given a post made from a blog, when it is published, then its feed page, its public page and its caption carry "Read the full guide" linking to the blog. The blog lists the post under "From this guide", and can embed its slides.
BR8. Given a post, when an editor presses "Make a blog", then a new blog starts with the post's sources and facts. When an editor chooses "Link to an existing blog", the post is linked to that blog both ways. Neither happens unless the editor asks.

### 3. Reading a blog

BR9. Given a live blog, when anyone opens `/blog/<slug>` signed out, then it shows:
- the title, the published date and the "Updated <date>" date;
- the key takeaways, then the sections with their headings, then the FAQ;
- the embedded slides and pictures;
- the sources with their links;
- "From this guide" (its posts) and related blogs;
- "Follow us" links to the Instagram and LinkedIn pages;
- the line `To find this again, search “OfCourse <title>”`.
BR10. Given a live blog, when search engines and AI crawlers read it, then:
- the page carries structured data for an article (title, dates, author as OfCourse) and for its FAQ;
- the page has a canonical address;
- the sitemap lists it with its last-updated date;
- robots allow `/blog/`.
Editing and republishing updates "Updated" and the sitemap date.
BR11. Given a live blog, when a student opens the feed, then it appears as a blog card (title, the cover picture, the reading time), matched by the feed's chips as posts are (criterion 81). Opening it shows the blog in the app with its posts.

### 4. Start from an idea

BR12. Given "New post" or "New blog", when the editor chooses "Start from an idea" and types the idea (up to 200 characters), then Gemini searches with Google Search and suggests five to eight sources. Each shows its title, site and a line on why it fits, with official sources first (government, universities, regulators).
BR13. Given suggested sources, when the editor ticks some and presses "Use these", then those pages are read safely (criterion 94) and the post or blog continues exactly as from links (GD19). Nothing is used without the editor's tick. A page that cannot be read is listed and the others go on.

### 5. Research a claim, when asked

BR14. Given a sentence the source check marks "Not found in the article", when the editor presses "Research this", then Gemini searches with Google Search for support and shows up to three sources with the sentence each one supports. The editor can "Add as a source" (read safely, its facts added, the check run again) or dismiss them. It runs only when pressed (GD35).

## Edge cases

- **An idea too vague to search**: fewer suggestions, at least one, or "Try a more specific idea" when none (BR12). From the PM.
- **No suggested source can be read**: nothing is made; the list shows which failed (BR13). From the code (criterion 94).
- **A research result whose page does not state the claim**: not offered as support (BR14). From the code (facts are exact sentences).
- **A blog with no posts yet**: "From this guide" is hidden (BR9). From the PM.
- **A post linked to a blog that is later unpublished**: the post's "Read the full guide" link is hidden (BR7). From the code.
- **The daily image limit while drawing a blog's pictures**: drawn ones kept, the rest resume (BR4). From the code.
- **A blog's FAQ question with no answer in the facts**: refused for that question, and the editor rewords or removes it (BR2, BR3). From the code (numbers and facts rules).
- **Grounded search cost**: one search per idea and per "Research this" press, never automatic (BR12, BR14). From the PM.

## Constraints

- **Deadline:** built overnight on 13–14 Oct 2026; demo video 16 Oct; submission 17 Oct.
- **Model rules:** the editor never writes a prompt (ADR-129). Facts are exact source sentences and code checks them (ADR-112). Gemini draws pictures only, with no text in them (ADR-008).
- **Google Search grounding:** used through Vertex AI. Its display requirements for search suggestions are met in the admin where its results are shown.
- **Brand:** the brand guideline file (GD15) governs blog copy and pictures.
- **Cost:** grounded searches only on the editor's press. Blog pictures count against the daily image limit.

## Out of scope

- A separate marketing website (blogs live on this app's site).
- Blogs made automatically for every post (Nikhil, 13 Oct 2026: "not by default").
- Comments on blogs, newsletters, and RSS.
- The weekly student question and the games (after submission).

## Dependencies

- Guided post design (stories 1–10) and story 14, on `feat/guided-post-design`.
- Today's fixes for background progress and resume (13 Oct 2026).
- The LinkedIn page addresses for "Follow us" (placeholder until Nikhil sends them).

## Open questions

1. The LinkedIn page addresses for each page brand. Owner: Nikhil. Does not block (placeholders).
2. Whether the blog's author line names a person or "OfCourse". Owner: Nikhil. Does not block ("OfCourse" by default).
