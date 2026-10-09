# Welcome: the screen before step 00

Written 8 Oct 2026 by Jenish, in the repo (no ticket). Design source: the Claude Design canvas https://claude.ai/artifact/CvDM8Q8ZzzKcVhWTo5B4Zr, Onboarding page, "Welcome · before step 00" (Welcome, WelcomeTablet, WelcomePhone, Welcome1920, the WLNoName state) and Dark mode page (DKWelcome, DKWelcomePhone); styles in `pq.css` ("Welcome" block) and the shared panel, menu and action rules.

## Problem

A new student's first screen after signing in is step 00, a question. Nothing tells her how long the questions take, what they are for, or that "Not sure" and Skip are always fine, so the first question arrives without context.

## Proposed outcome

One welcome screen before step 00 says how long it takes, what the answers shape, what she controls, and what comes first, with a single action, Start, that opens step 00. A returning student never sees it again once she has answered or skipped step 00.

## Affected users and systems

- Students on their first visit; the landing rule in `src/features/opening/model/landing.ts` (`landingPath`, `onboardingResumePath`); the onboarding shell, panel and header menu; PRODUCT.md's URL map.

## Scope

In: the screen at `/onboarding/welcome` on the onboarding shell; the panel's "before anything" state (every step listed, none current; the band says "Not started yet · about 10 min / First: Your comic character"); the landing change; both themes; the e2e flows that start at `/` updated.
Out: timing the steps (the "about 10 minutes" is the canvas's placeholder until steps 04–06 are designed); any change to step 00 itself; storing that she saw the welcome (she sees it whenever she lands with step 00 unanswered).

## Acceptance criteria

1. Given a student whose comic character is not yet answered (persona null), when she lands on `/` or `/onboarding`, then she opens `/onboarding/welcome`.
2. Given a student who has answered or skipped step 00, when she lands, then she never sees the welcome: `/onboarding/welcome` sends her on to where `onboardingResumePath` says.
3. Given the welcome, when shown, then it greets her by first name ("Welcome, Sita.") or "Welcome." when the account has no name, and its heading reads "About 10 minutes, then three futures" with the lede "Your answers shape three futures you'll see at the end: what you'd study, where you'd live, and what could come after."
4. Given the welcome, when shown, then it lists three points, each with an icon: "Six short steps, one question at a time" / "Everything saves as you go, so you can stop and pick up where you left off."; "Each question says why it asks" / "“Not sure” and Skip are always fine. I'll assume a sensible default and show it as a chip you can change."; "Three futures, side by side" / "Nothing is ranked or recommended. You compare them and decide what matters to you."
5. Given the welcome, when shown, then a note headed "First · optional" reads "How your comic character is drawn. It only sets the drawing in the comics, and you can skip it.", and one primary action, Start, opens `/onboarding/character`. There is no Back and no Skip.
6. Given the steel panel on the welcome, when side by side, then its heading is "Before we start" with the lead "Here's the whole way through. Each step says why it asks.", the step list shows 00–06 with none marked current and 00 tagged "Optional"; when stacked or on a phone, the seven segments are all unlit and the text reads "Not started yet · about 10 min" and "First: Your comic character".
7. Given the welcome, when shown, then the header menu (Dark theme, Sign out) is present as on every onboarding step, and the screen reads correctly in both themes, matching the dark boards.
8. Given the welcome at 390, 768, 1440 and 1920, when compared with the canvas boards, then it matches; 360, 1024, 1366, 1536 and 2560 are checked in screenshots.
9. Given keyboard use, when the welcome opens, then focus lands on the heading and Tab reaches the menu button and Start; the existing unit and end-to-end suites still pass, with the flows that began at `/` now passing through Start.
10. Given PRODUCT.md and CLAUDE.md, when read, then the URL map and the landing rule include the welcome.

## Edge cases

- A student signed in with an email code has no name: "Welcome." (criterion 3).
- Opening `/onboarding/character` directly with step 00 unanswered still works; the welcome is not forced.
- Reduced motion: the entrance motion is off; nothing else changes.

## Constraints

- CLAUDE.md: the onboarding system (shell, panel, menu), container-query layout rules, type and spacing roles, px icons, no size per breakpoint; URLs under `/onboarding/<step>`; `bun run test:db` never run; no dev server started by the agent.

## Open questions

None blocking. Decided for this pass: "about 10 minutes" stays as the canvas's placeholder; the welcome is not remembered (it is the landing while step 00 is unanswered).

## Verification — 2026-10-08 · the welcome
Branch `feat/onboarding-welcome` at `c300f99` (docs on top) · local dev server `http://localhost:3000` · QA ran the suite (no second test set): unit 718 pass · 75 skip · 0 fail; e2e serial 121 passed, 0 failed (e2e/onboarding-welcome.e2e.ts: 9).

| Criterion | Result |
| --- | --- |
| 1 · `/` and `/onboarding` land on the welcome while step 00 is unanswered | pass |
| 2 · never again once step 00 is answered; `/onboarding/welcome` sends her on | pass |
| 3 · greeting with and without a name; heading and lede | pass |
| 4 · the three points | pass |
| 5 · the "First · optional" note; Start opens step 00; no Back or Skip | pass |
| 6 · the panel: none current, 00 Optional; band "Not started yet · about 10 min" | pass |
| 7 · menu present; both themes | pass (DOM); the look is a person check |
| 8 · matches the boards | checked in screenshots at ten widths, nothing to fix; a person check |
| 9 · focus on the heading, Tab order; suites green; flows through Start | pass |
| 10 · PRODUCT.md and CLAUDE.md | pass |

**Person checks:** 7, all "Could not check: one-shot run" (e2e/onboarding-welcome/onboarding-welcome.manual.md).
