# Content source and settings — Code Review

**Approve with changes.** 0 CRITICAL · 0 HIGH · 1 MEDIUM · 6 LOW

| | |
| --- | --- |
| Blocking | nothing |
| Branch | `feat/content-source-and-settings`, uncommitted work on `2cb16dc` over `main` · 26 code files, +1161 −274 (plus intent and plan) · 2026-10-17 |
| Reviewed against | security · security-web · performance · CLAUDE.md · `tailwind-v4-best-practices (SKILL.md)` · `vercel-react-best-practices (SKILL.md)` · DESIGN.md (grep, for class choices) |
| Scans | secrets N/A (gitleaks not installed) · dependencies N/A (no manifest or lockfile change) · code N/A (semgrep not installed) |
| Not applicable | `security-llm.md` (no prompt or model change) · `fdd-architecture`, `vercel-composition-patterns` (not loaded, per dispatch) |
| Failed to load | none |
| Read outside the diff | 9, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | A | — | — |
| Performance | A | LOW · `0026_content_artifact_share.sql:2` · table lock | optional |
| CLAUDE.md | A | LOW · `SettingsForm.tsx:249` · 2px border | optional |
| tailwind-v4-best-practices | A | — | — |
| vercel-react-best-practices | A | — | — |
| Quality (tests, accessibility) | B | MEDIUM · `parts.tsx:47` · tooltip not dismissible | Escape hides the tooltip |
| Criteria | A | 1 manual (7) | — |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | Both starts offered, blog chosen; idea with an idea or on New blog | `SourceForm.test.tsx:263`, `:270` | covered |
| 2 | From a blog, "Make post" makes a feed post | `SourceForm.test.tsx:283` | covered |
| 3 | From an idea: "Write a blog first" makes a blog, "Go straight to the post" a feed post | `SourceForm.test.tsx:371` | covered |
| 4 | Language, framing, notes, page apply in either start | `SourceForm.test.tsx:361`, `:371` | covered |
| 5 | One slide, Previous/Next, "n of N", no strip | `parts.test.tsx:85` | covered |
| 6 | Panels as tabs, "Fix" badge, fields under headings | `SettingsForm.test.tsx:381`, `:420` | covered |
| 7 | "Send to review" right-most | manual (smoke) | not automatable |
| 8 | Badge; hover or focus shows the reason; reason announced | `parts.test.tsx:31`, `LivePanel.test.tsx:571` | covered |
| 9 | Tick several Instagram accounts and LinkedIn | `LivePanel.test.tsx:536`, `workflow.test.ts:299`, `share.test.ts` | covered |
| 10 | Toast text; post lists each share with who | `LivePanel.test.tsx:536`, `:558`, `:590`, `social.test.ts:597` | covered |
| 11 | None ticked: Share unavailable, says why | `LivePanel.test.tsx:571` | covered |

Criterion 2's "opens at its idea cards" rests on the existing push assertions; `social.test.ts:597` runs only with `DB_TESTS=1`; criteria 6 (headings) and 8 (shown on hover/focus) are CSS, checked by eye.

## Read outside the diff
- `components/**` grep `<Control` — 60 callers in 20 files; signature unchanged and the reason stays in the DOM, so no caller loses its text.
- `BlogTextStep.tsx:195`, `ImagesStep.tsx:363` — running reasons (criterion 122) now sit behind the badge; where a step of the screen runs, `Working` still shows the progress.
- grep `swipe` — `LivePanel.tsx:382`, `ReviewPanel.tsx:186-196`, `Workbench.tsx:283` keep `swipe`; only `PostPreview` takes `carousel`.
- `server/commands/shared.ts:169` `open()` and `:151` `attempt()` — share is gated per request by role, stage, kind and version; throws become a message.
- `lib/workflow.ts:372`, `shared/lib/auth/access.ts:159` — share needs an editor or superadmin; an admin without the editor flag is refused, as for Adapt.
- `actions.ts:333` `onPost` — actor from the session, id and version parsed before the command.
- `shared/lib/db/schema.ts:331` — `listShares` is served by `content_artifact_post_id_idx`; per-post rows are few.
- `server/commands/source.ts:200`, `:503` — a failed make deletes its placeholder; an existing post past source is returned whatever its kind.
- `e2e/helpers/content.ts:59`, `e2e/content-feed-post.e2e.ts:376` — the e2e source flow (default start, paste, "Make post") and slide counts (Images, `swipe`) still hold.

## Findings, by file

### `src/features/content/components/parts.tsx`

**MEDIUM · line 47 · tooltip not dismissible**
- What: The reason shows on hover of the whole row or focus within it, by CSS alone; nothing dismisses it while hovered or focused, and, absolutely placed under the row, it can cover the fields below.
- Why: Content shown on hover or focus must be dismissible without moving pointer or focus (WCAG 2.2 SC 1.4.13, AA); criterion 8 builds every disabled control in the workbench on this.
- Rule: WCAG 1.4.13, criterion 8 · a test would have caught it: yes, a keyDown Escape on the badge asserting the tooltip is hidden.
- Fix: Escape on the wrapper sets a `data-dismissed` attribute (cleared on pointer leave or blur) that hides the tooltip, alongside the existing `group-hover`/`group-focus-within` classes.

### `src/features/content/components/steps/SourceForm.tsx`

**LOW · line 560 · start switch loses and keeps the wrong state**
- What: Switching "Start from" unmounts `IdeaSources`, dropping the sources found (a paid search), while `error` and `failed` from the other start stay and show at line 569.
- Why: An admin who peeks at the other start loses her search and sees a refusal that is no longer hers.
- Rule: Quality, surfaced errors · a test would have caught it: yes, switch starts after a failure and assert no alert.
- Fix: Clear `error` and `failed` in the radio's `onChange`; keep the found list in `SourceForm` state, or keep `IdeaSources` mounted and hidden.

**LOW · line 408 · one request id for both kinds**
- What: The single request id is shared by "Make post", "Write a blog first" and "Go straight to the post"; after a lost response to a successful blog make, the other button returns that blog (`source.ts:200` returns an existing post whatever its kind).
- Why: An edge case only (network loss), but the admin then lands on the wrong kind.
- Rule: Quality · a test would have caught it: no, it needs the server's idempotency path.
- Fix: Make a new request id when the kind pressed differs from the last one's, or have `makePost` refuse a kind mismatch.

### `src/features/content/components/steps/SettingsForm.tsx`

**LOW · line 276 · tabpanel not focusable**
- What: The `tabpanel` has no `tabIndex={0}`; the Source check panel can open on text alone.
- Why: The APG tabs pattern makes the panel focusable when its first content is not, so Tab from the tablist lands in it.
- Rule: WAI-ARIA APG tabs · a test would have caught it: yes, an attribute assertion.
- Fix: `tabIndex={0}` on the panel.

**LOW · line 249 · 2px border**
- What: The selected tab's underline is `border-b-2`, a 2px rule.
- Why: CLAUDE.md allows px only for 1px hairlines.
- Rule: CLAUDE.md, rem not px · a test would have caught it: no, a convention.
- Fix: Keep it and note the exception, or mark the selected tab with a hairline and weight alone.

### `src/shared/lib/db/migrations/0026_content_artifact_share.sql`

**LOW · line 2 · check re-validated under lock**
- What: `ADD CONSTRAINT … CHECK` scans every `content_artifact` row while holding an ACCESS EXCLUSIVE lock; the cost grows with the artifact count.
- Why: Harmless at today's size; a long lock on the busiest table once it grows.
- Rule: `performance.md` §4 · a test would have caught it: no.
- Fix: Optional: `ADD CONSTRAINT … NOT VALID`, then `VALIDATE CONSTRAINT` in a second statement.

### `src/features/content/model/share.test.ts`

**LOW · line 38 · constant asserted**
- What: `expect(SHARE_ERRORS.none).toBe('Tick at least one account.')` pins a constant to its own literal.
- Why: Test bloat; `LivePanel.test.tsx:571` already pins the text where it is shown.
- Rule: Quality, test the brain · a test would have caught it: n/a.
- Fix: Delete the line.

## Top 3 priority fixes
1. `parts.tsx:47` — Escape dismisses the reason tooltip.
2. `SourceForm.tsx:560` — clear `error`/`failed` on start change and keep the found sources.
3. `SourceForm.tsx:408` — a fresh request id when the kind changes after a failure.

## Done well
- Sharing is enforced on the server: `open()` checks role, stage, kind and version per request, `shareChoice` allowlists ids server-side, the action bounds the input at the edge and drops extra keys, and each refusal is tested.
- The tabs follow the APG pattern (roving tabindex, arrows, Home/End, `aria-controls`/`aria-labelledby`), tested by attributes and `document.activeElement`, as the project's test rules ask.
- `carousel` is a separate prop, so the swipe strip on Images, Review and Live is untouched, and a test pins that.

## Built but not asked for
- Nothing. Share at `exported` as well as `live` follows the plan.

## Blind spots
- The tooltip's placement inside scrolling or `overflow-hidden` step frames, and on touch (iOS Safari does not focus a tapped button): screenshots at the listed widths and a tablet check.
- Criterion 7's bar order: the smoke test, or an assertion that "Send to review" is the last button in the Step actions region.
- `sharePost` against the database runs only with `DB_TESTS=1`: run `DB_TESTS=1 DATABASE_URL=… bash scripts/capped.sh bun test src/features/content/server/social.test.ts` (not `test:db`, which wipes the dev database), and `bun run type-check`, neither of which this review ran.

---
Stack: TypeScript, React 19 / Next.js (App Router, server actions), Tailwind 4, zod, Drizzle on Postgres, bun test with happy-dom. Passes applied shallowly: none; accessibility judged by reading, not with a screen reader.

## Applied (17 Oct 2026, the developer said "fix all valid")
- MEDIUM parts.tsx:47: Escape hides the reason until the pointer or focus leaves the row; the tooltip opens above the badge, clear of the fields below (the step bar is pinned to the bottom).
- LOW SourceForm.tsx:560: switching "Start from" clears the refusal and the unread links; the idea, the pages found and the ticks are kept in the form's state.
- LOW SourceForm.tsx:408: one request id per kind, made when the form mounts, so the other button never returns the first kind's post; the same kind pressed again keeps its own id (a lost response still makes one post).
- LOW SettingsForm.tsx:276: the tabpanel takes `tabIndex={0}` (biome-ignore with the APG reason).
- LOW SettingsForm.tsx:249: the selected tab is marked with a 1px line in the primary colour and the weight.
- LOW 0026 migration: `ADD CONSTRAINT … NOT VALID`, then `VALIDATE CONSTRAINT`; checked from scratch on a fresh database (constraint validated, `share` allowed).
- LOW share.test.ts:38: the constant-against-itself line removed.
- Left: nothing. Full unit suite 4,260 pass, 0 fail; type-check and lint clean.
