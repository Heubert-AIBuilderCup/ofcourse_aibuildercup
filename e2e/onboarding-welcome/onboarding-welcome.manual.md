# Person checks: the welcome before step 00 (onboarding-welcome)

QA ran the suite rather than writing a second set of tests (CLAUDE.md). These are the checks only a person can judge.

## From the smoke test, not run by hand
- [ ] AC 8 (smoke 1, 4): at 390, 768, 1440 and 1920 the welcome matches the canvas's Welcome boards: the three point rows with their icon boxes and hairlines, the "First · optional" note's left rule, Start left-aligned (full width in the phone's sticky bar), the panel's "Optional" tag on 00 and the band's "Not started yet · about 10 min".
- [ ] AC 7 (smoke 5): in dark, the steel panel is unchanged, the note's tint is dark, the icon boxes and hairlines read, nothing light-themed remains; the menu button sits top-right in both placements.
- [ ] AC 9 (smoke 7): the focus ring on the heading is not visible on load (the heading is focused programmatically), and is visible on Start after Tab.
- [ ] Reduced motion (OS setting): no entrance motion on the welcome; nothing else changes.
- [ ] The eight widths beyond the boards: 360, 1024, 1280, 1366, 1536 and 2560 look right (the build's shots are at `scratchpad/welcome-shots/`).

## What no test can judge
- [ ] The copy reads naturally to a student from Nepal, India or Bangladesh: "About 10 minutes, then three futures", the three points, the note.
- [ ] "About 10 minutes" is believable once steps 04–06 exist; it is the canvas's placeholder until they are timed.
