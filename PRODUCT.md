# OfCourse

OfCourse shows an international student three possible futures in Australia, built around cost, staying and career, from a few taps about her situation. Nothing is ranked or recommended: she sees the futures side by side, with what each gives her and costs her, and corrects the assumptions they rest on. The product truth for each slice is in `docs/<slug>/intent.md`; the decision record it follows is in the Hackathon Handoff (SHARED-decision-record).

## Who

- **Student:** signs in with Google or an email code on the student page (`/`). One account per address, whichever way she signs in.
- **Admin:** signs in with Google only, at `/admin/sign-in`. A student account is refused there, and an admin is refused on the student page.

## The student flow

Onboarding is six steps, 00 to 05, then "You're all set". Each step says why it asks, and "Not sure" is always a fine answer: it stores the default, marked assumed, which later shows as a chip she can change.

| Step | Name | URL |
| --- | --- | --- |
| — | Welcome (before step 00) | `/onboarding/welcome` |
| 00 | Your comic character (optional) | `/onboarding/character` |
| 01 | Facts about you, one question per screen | `/onboarding/facts/<question>`: `where`, `amount`, `covers`, `who-pays`, `limit`, `earliest`, `latest`, `years`, `coming`, `qualification`, `english` |
| 02 | What you'd study, one question per screen | `/onboarding/study/<question>`: `know`, `field`, `areas`, `level`, `learning`, `length` |
| 03 | Where and how you'd live, one question per screen | `/onboarding/living/<question>`: `destination`, `place`, `community`, `know-anyone`, `who-and-where`, `climate` |
| 04 | After you graduate, one question per screen | `/onboarding/after/<question>`: `stay`, `focus`, `earning`, `long-term` |
| 05 | Your attention (the ten coins) | `/onboarding/attention` |
| — | You're all set (the end) | `/onboarding/done` |
| — | Your road (after onboarding) | `/road` |

The three futures are parked outside onboarding, with no page: `/futures` is not a route, and nothing links there.

- URLs name steps, never number them, so a step can be added or reordered without breaking a link. Internal keys never appear: slugs map to stored keys in `src/features/opening/model/onboarding.ts`.
- `/onboarding` resumes where she left off: her road (`/road`) once she has pressed "Go to your road"; before that, the welcome until step 00 is answered, her first unanswered question in the step she left when that step is facts, study, living or after, step 05 (`/onboarding/attention`) once she has reached it (or the futures, for a student who reached them before they left onboarding), and the end (`/onboarding/done`) once her coins are stored, spent or left for later. A bare step such as `/onboarding/facts`, `/onboarding/study`, `/onboarding/living` or `/onboarding/after` opens its first unanswered question.
- Every tap is saved, so she can continue on another device. Signing in lands her where she left off: the welcome until step 00 is answered, where `/onboarding` resumes partway through, the end (`/onboarding/done`) once her coins are stored, her road once she has pressed "Go to your road". Never the futures.
- Done (exactly ten coins) or "Spend them later" leads to "You're all set"; coins never change her routes. Until she presses "Go to your road" there, onboarding stays open: she can go back to her coins and any step opens by its URL, and `/road` sends her back to where she left off. Pressing it records that she finished and locks onboarding: from then `/`, sign-in, `/start`, `/onboarding` and every `/onboarding/...` URL, "You're all set" included, take her to `/road`, and Back from her road never shows onboarding again.
- Retired paths (`/picture`, `/opening/*`, `/attention`) redirect permanently.

## Design

- The design source is the Claude Design canvas (Onboarding, Login, Splash pages): https://claude.ai/artifact/CvDM8Q8ZzzKcVhWTo5B4Zr. The design system is Industry (`src/design-systems/industry/DESIGN.md`).
- Layout: two breakpoints (phone below 576px, side by side from 1024px), the whole design scaling from 1440 to 1920, framed above 1920. The rule and its tokens are in CLAUDE.md and DESIGN.md.
