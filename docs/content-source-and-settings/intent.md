---
title: Start from a blog or an idea, a calmer Settings step, disabled buttons that explain, and sharing to several accounts
author: Nikhil
requested by: Nikhil (admin feedback, 17 Oct 2026)
---

# Start from a blog or an idea, calmer Settings, explained buttons, share to several accounts

_Intent written 17 Oct 2026 from the admin feedback document and the answers in the session._

## Problem

- The Source step does not ask what the admin starts from. An admin who meant to turn an existing
  blog into a post pressed "Make blog" and found herself writing another blog (an Outline with
  "Write the blog"). "Start from an idea" only finds links; it never offers to skip the blog.
- The Settings step is clunky: the slides scroll sideways in a strip, the six Feed settings panels
  are a row of small links with the fields stacked under them, and "Send to review" sits mid-bar
  with its reason as a sentence beside it.
- A disabled button anywhere in the workbench says why only as small text beside it, which pushes
  the button out of place and is easy to miss.
- Sharing a live post means exporting a zip per version. The admin wants to share a post to
  Instagram and LinkedIn, to several Instagram accounts at once, and be told it was shared.

## Proposed outcome

The admin chooses "From a blog" or "From an idea" first; a blog link goes straight to the post's
idea cards, and an idea leads to "Write a blog first" or "Go straight to the post". Settings shows
one slide at a time with no scrolling, the panels as tabs with a mark on any that needs fixing, and
"Send to review" on the far right. Every disabled button carries a badge that explains, on hover or
focus, what to do. On a live post the admin ticks any of the page accounts and shares; a toast says
where it went and the post lists it.

## Affected users and systems

- Admins and editors in the content workbench (`/admin/posts/...`).
- Source form, Settings screen (PostPreview, SettingsForm), the shared `Control` part, the Live
  step (LivePanel), a new `share` artifact (a migration widens the artifact-kind check).
- Nothing is sent to Instagram or LinkedIn: sharing is simulated and recorded (ADR-033 stands).

## Scope

Feed posts and blogs in the admin workbench. Comics keep their own Live step.

## User stories and acceptance criteria

### S1. Start from a blog or an idea

1. Given the New post page, When it opens, Then it offers "From a blog" and "From an idea", with
   "From a blog" chosen (or "From an idea" when opened with an idea, or as New blog).
2. Given "From a blog", When the admin gives a link (or pasted text) and presses "Make post", Then
   a feed post is made from it and opens at its idea cards; no blog is written.
3. Given "From an idea", When the admin finds and ticks sources, Then she is offered "Write a blog
   first" (makes a blog) and "Go straight to the post" (makes a feed post) from those sources.
4. Given either start, Then language, the framing line, notes and page apply as today.

### S2. A calmer Settings step

5. Given the Settings step (and, since 17 Oct, every slide step), Then the preview shows the
   selected slide on top, sized to fit, and every slide as a thumbnail below it (a filmstrip), the
   selected one marked; a thumbnail or the arrow keys select a slide; no scrolling strip. _Amended
   17 Oct 2026 by the developer: the filmstrip replaces previous/next and the visible "2 of 6"; the
   position is announced to screen readers._
6. Given the Feed settings, Then the panels are tabs, each needing a fix marked with a badge, and
   the open panel's fields are grouped under their headings.
7. Given the step bar, Then "Send to review" is the right-most control.

### S3. Disabled buttons explain

8. Given a control that is unavailable for a reason, Then it shows a badge, and hovering or
   focusing the badge shows the reason; the reason is announced with the control.

### S4. Share to several accounts

9. Given a live feed post, When the admin opens Share, Then she can tick any Instagram account of
   the pages and the LinkedIn page, several at once.
10. When she shares, Then a toast says "Shared to Instagram: @a, @b" and/or "Shared to LinkedIn",
    and the post lists each share with who shared it; nothing is posted to the networks.
11. Given no account ticked, Then Share is unavailable and says why (S3).

## Edge cases

- A blog link that is one of ours is treated as any link (criterion 2); linking it is out of scope.
- A viewer who may not edit sees no Share (as Adapt today).
- Sharing the same account again records another share.

## Constraints

Submission 18 Oct 2026. Tailwind semantic tokens; tests through `scripts/capped.sh`.

## Out of scope

Real posting to Instagram or LinkedIn; several LinkedIn accounts; sharing social versions.

## Open questions

None blocking.
