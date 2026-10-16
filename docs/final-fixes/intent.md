# Final fixes before the hackathon demo

Three small changes on one branch, `chore/final-fixes`, 16 Oct 2026. Each has its own commit.

## 1. Snapshots of the dev database (chore)

A `db:reset` on 16 Oct wiped Jenish's dev data with no way back. Two scripts so it does not happen again.

- `bun run db:dump` writes the Docker Postgres (docker-compose.yml) to `db-dumps/<date-time>.sql`, or to a file named as the argument. The folder is git-ignored.
- `bun run db:restore` loads the newest snapshot, or the named file, replacing everything in the database, migration history included. With no snapshot it says so and exits 1.
- Both start Postgres if it is down. Documented on CLAUDE.md's commands line.

## 2. The loader stays until the next page has replaced it (bug)

Reported: after onboarding, "Go to your roadmaps" showed the loader, which faded out to the onboarding screen, then the page jumped to /roadmaps.

Cause: after the last step the loader faded for 0.45 s and only then called `onDone`, which starts the server refresh and the navigation (two round trips). Faded, it showed the page it was hiding until the next one arrived. The same held for Create roadmap on the board.

- Acceptance: as the last step ticks, `onDone` is called and the loader stays in full until the route swap removes it; no fade, no onboarding screen in between. Under reduced motion the same.
- `LOADER_FADE_MS` and the `fading` state are gone; the intent's loader section and the smoke note say the loader stays.

## 3. The student sign-in page per the canvas's Login page, Google only (feature)

The brief (Claude Design canvas, Login page; reference Main.dc.html and login.css's four cells; copy, behaviour and styles from it, not its markup):

- Brand: OfCourse with the duck mark (the same asset as the app header), replacing the placeholder name and icon.
- Hero: kicker "Study abroad, planned"; headline "See where your plans lead."; lead "Answer a few questions and OfCourse draws your roadmap: the city, the course, the visa and the way to PR."
- The four squares under the hero, in order City, Course, Visa, Goal: an uppercase label top-left and the board's tile icon centred (buildings, graduation cap, document with tick, flag; the board's own lucide-style set). The highlight keeps stepping left to right; none with reduced motion. Hidden on phones (below 576). aria-hidden.
- Form: subtitle "Use the email you signed up with."; email placeholder and validation message use you@example.com; "Sign in with Google" with Google's brand mark in place of "Sign in with SSO".
- Below the form: "New to OfCourse? Create an account". Footer: "© 2026 OfCourse".
- Done when phone, tablet, 1440 and 1920 match the canvas and Google sign-in works.

Decisions taken with Jenish on the way:

- Email codes are switched off on the page (`codes={false}` in src/app/page.tsx) because no email provider is configured and a code that never arrives is a minus point for the demo. The code path stays for when a provider exists; its unit tests still run with codes on; the end-to-end cases that type a code are skipped with the reason. PRODUCT.md and README say so.
- With codes off, Google is the one way in and takes the design's primary (blue) button. "Create an account" starts the same Google sign-in, since with Google a new account is the same flow.
- The admin sign-in shares the panel and the Google button: it gets the duck mark and the "Sign in with Google" label, keeps its own headline and the outlined button.
