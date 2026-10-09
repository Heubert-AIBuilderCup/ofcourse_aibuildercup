# OfCourse

OfCourse shows an international student three possible futures in Australia, built around cost, staying and career, from a few taps about her situation. Nothing is ranked or recommended: she sees the futures side by side, with what each gives her and costs her, and corrects the assumptions they rest on. The product truth for each slice is in `docs/<slug>/intent.md`; the decision record it follows is in the Hackathon Handoff (SHARED-decision-record).

## Who

- **Student:** signs in with Google or an email code on the student page (`/`). One account per address, whichever way she signs in.
- **Admin:** signs in with Google only, at `/admin/sign-in`. A student account is refused there, and an admin is refused on the student page.

## The student flow

Onboarding is seven steps. Each step says why it asks, and "Not sure" is always a fine answer: it stores the default, marked assumed, which later shows as a chip she can change.

| Step | Name | URL |
| --- | --- | --- |
| — | Welcome (before step 00) | `/onboarding/welcome` |
| 00 | Your comic character (optional) | `/onboarding/character` |
| 01 | Facts about you, one question per screen | `/onboarding/facts/<question>`: `where`, `amount`, `covers`, `who-pays`, `limit`, `earliest`, `latest`, `years`, `coming`, `qualification`, `english` |
| 02 | What you'd study, one question per screen | `/onboarding/study/<question>`: `know`, `field`, `areas`, `level`, `learning`, `length` |
| 03 | Where and how you'd live, one question per screen | `/onboarding/living/<question>`: `destination`, `place`, `community`, `know-anyone`, `who-and-where`, `climate` |
| 04 | After you graduate | `/onboarding/after` |
| 05 | Three futures | `/futures` |
| 06 | Your attention (the ten coins) | `/attention` |

- URLs name steps, never number them, so a step can be added or reordered without breaking a link. Internal keys never appear: slugs map to stored keys in `src/features/opening/model/onboarding.ts`.
- `/onboarding` resumes where she left off: the welcome until step 00 is answered, the step she left (after), her first unanswered question when that step is facts, study or living, and step 04 once she has seen her futures. A bare step such as `/onboarding/facts`, `/onboarding/study` or `/onboarding/living` opens its first unanswered question.
- Every tap is saved, so she can continue on another device. Signing in lands her where she left off: the welcome until step 00 is answered, her first unanswered question partway through, her futures once she has seen them.
- Onboarding stays reachable after it is done: from the futures she can go back, change an answer, and the futures redraw. The chips on each future edit an answer in place.
- Retired paths (`/picture`, `/opening/*`) redirect permanently.

## Design

- The design source is the Claude Design canvas (Onboarding, Login, Splash pages): https://claude.ai/artifact/CvDM8Q8ZzzKcVhWTo5B4Zr. The design system is Industry (`src/design-systems/industry/DESIGN.md`).
- Layout: two breakpoints (phone below 576px, side by side from 1024px), the whole design scaling from 1440 to 1920, framed above 1920. The rule and its tokens are in CLAUDE.md and DESIGN.md.
