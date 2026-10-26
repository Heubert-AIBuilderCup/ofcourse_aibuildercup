# Student tweaks, admin loaders, feed and Skip pictures: requirements

_Asked for by Nikhil on 16 Oct 2026, in the session. There is no separate intent; this note collects the asks the review checks against. The task briefs (`.heubert/task-L1-brief.md`, `task-F1-brief.md`, `task-S1-brief.md`, gitignored) hold the detail._

## Student side
1. **Onboarding.** On a single-choice question, a tap answers and moves on with no Continue. This holds on a step's last question too (on to the next step), and for tapping the answer already given. Arrow keys still pick without leaving. Multi-choice questions and the person form keep Continue.
2. **Onboarding.** "Tell me in your own words" sits under the answer options, not above them.
3. **The board.** "Closest road to your answers" folds into a "Why this road?" map button (top left, Map key's style) that opens and closes a panel with the chips and the mock tag. The row under the header goes. No button when the road is exactly hers.
4. **The board.** Ask and Compare are removed from the header and the phone bar; Feed takes their place.
5. **The feed.**
   - It keeps the student navigation: the header with Your roadmaps and Feed marked current. Staff keep their bar.
   - The layout is Instagram-style: one column of cards with swipeable slides.
   - The next cards load as she scrolls.
   - The filters are one row: search plus a dropdown per group, the same filter rules as before.

## Admin side
6. **Loaders.** Every control that calls Gemini shows a spinner and a line saying what is happening while it waits, on the pressed control only. Image changes show it on the slide being redrawn. Background steps keep their polled loader without a gap.
7. **Failures.**
   - A background step that fails says so: Images plan and draw included.
   - It says why: the model busy (429), too slow (timeout), or the daily limit.
   - A slide's "Could not draw" names its reason.
8. **Skip pictures.**
   - It saves every slide as it looks, in the post's own format, with no image call, and the post moves on.
   - It keeps the pictures already drawn.
   - It is gated like Draw images.
   - Skipped slides read as text-only, never as failed.
   - No migration.
9. **Images.** An image call waits 60 s, since the model takes about 23 s on Cloud Run; at 20 s every call timed out and the retries ran into the 429 quota.

## Rules that bind
`CLAUDE.md`:
- test the brain, not the beauty;
- tests compare strings, counts and attributes, never DOM elements;
- Tailwind 4 semantic tokens and container queries; no arbitrary breakpoints;
- server actions return `ActionResult`;
- access rules in `access.ts`;
- the redirect rules.

`src/design-systems/industry/DESIGN.md` for the markup.
