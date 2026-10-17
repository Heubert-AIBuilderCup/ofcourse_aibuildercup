# Source starts, calmer Settings, explained buttons, sharing — Implementation Plan

**Intent:** docs/content-source-and-settings/intent.md
**Goal:** the four admin changes of the intent, test-first, on `feat/content-source-and-settings`.
**Approach:** UI changes stay in the content feature's components; the explained-button badge is one
change to the shared `Control` part, so every step gets it. Sharing is a new immutable `share`
artifact written by a server command, like `recordPostUrl` writes `social_link`.
**Test layers:** unit and component tests (`bun test`, happy-dom) for every criterion; criterion 10's
stored record also through the server command's test in `src/features/content/server/social.test.ts`
(it runs against the command with its database fake, as the neighbouring tests do). Layout (one slide
in view, the bar's order) is checked in the smoke test.
**Constraints:**
- Run every test through `bash scripts/capped.sh bun test <file>`; compare strings, counts and attributes, never DOM elements.
- Server actions return `ActionResult` and never throw.
- Tailwind 4 semantic tokens only, rem not px, no arbitrary breakpoints.
- Never commit or push without approval: tasks leave their changes uncommitted; one commit after the developer's smoke test.

## Files
| Path | Create or modify | Responsibility |
| --- | --- | --- |
| src/features/content/components/parts.tsx | modify | `Control`: badge + hover/focus explanation; `RenderedSlides` swipe → one slide at a time |
| src/features/content/components/steps/SettingsForm.tsx | modify | `Panels` as tabs with fix badges |
| src/features/content/components/steps/SourceForm.tsx | modify | "From a blog" / "From an idea"; the idea's two makes |
| src/shared/lib/db/content-shapes.ts | modify | `share` artifact kind |
| src/shared/lib/db/migrations/0026_*.sql | create (db:generate) | widen `content_artifact_kind_check` |
| src/features/content/model/artifacts.ts | modify | `ShareBody` schema |
| src/features/content/model/share.ts | create | `SHARE_ACCOUNTS`, `shareLine` |
| src/features/content/server/social.ts | modify | `sharePost` command |
| src/features/content/actions.ts | modify | `sharePostAction` |
| src/features/content/components/steps/LivePanel.tsx | modify | Share section |

## Task 1: disabled controls explain with a badge
**Delivers:** 7, 8. **Kind:** judgement.
- `Control({ reason, children })` keeps its signature. With a reason: the children, then a small
  badge button (`aria-label="Why this is unavailable"`, text "!"), positioned at the top-right corner
  of the children, and the reason in an element with `role="tooltip"` and an id, shown on hover or
  focus of the wrapper (CSS `group-hover`/`group-focus-within`, no JS), referenced by the badge's
  `aria-describedby`. The reason text stays in the DOM (existing tests find it by text). No reason:
  only the children. The reason no longer sits beside the button, so a step bar's action is right-most.
- Tests in `components/parts.test.tsx`: with a reason, one button named "Why this is unavailable",
  its `aria-describedby` pointing at an element whose text is the reason and whose role is tooltip;
  without, no such button. Then run `Workbench.test.tsx`, `SettingsForm.test.tsx` and the steps'
  tests: any that relied on layout only, not text, stay green.

## Task 2: one slide at a time on Settings
**Delivers:** 5. **Kind:** judgement.
- `RenderedSlides` with `swipe` shows one slide (index state, starting at 0), "Previous slide" and
  "Next slide" buttons (disabled at the ends) and "{n} of {count}" text; the carousel group keeps its
  role and label. No `overflow-x-auto` strip. Check every `swipe` caller (`grep -rn "swipe" src/features/content`).
- Tests (`parts.test.tsx` or `PostPreview.test.tsx`): "1 of N" at first, Next → "2 of N", Previous
  disabled at the first and Next at the last.

## Task 3: Feed settings panels as tabs
**Delivers:** 6. **Kind:** judgement.
- `Panels` (SettingsForm.tsx:198): the panel names as a `role="tablist"` row of tab buttons
  (`role="tab"`, `aria-selected`), each with a destructive "Fix" badge when `problem`, wrapping on
  narrow widths; the "N of M" line stays; the body in `role="tabpanel"` labelled by its tab, with its
  fieldsets spaced and headed. Back / Next stay under the panel.
- Update `SettingsForm.test.tsx` where it reads the panel buttons by `aria-current`: tabs by
  `aria-selected`. Assert a panel with a problem has a tab whose text includes "Fix".

## Task 4: start from a blog or an idea
**Delivers:** 1–4. **Kind:** judgement.
- `SourceForm`: a `role="radiogroup"` "Start from" with "From a blog" and "From an idea"
  (`aria-checked`). Initial: idea when `idea` is given or `postKind === 'blog'`, else blog.
- From a blog: the Links field labelled "Blog link" (the rest of `SourceFields` as today, paste text
  included), page, and "Make post" — always `postKind: 'feed'`.
- From an idea: language, framing and notes as today, the idea box (`IdeaSources`) whose "Use these"
  becomes two buttons, "Write a blog first" (`postKind: 'blog'`) and "Go straight to the post"
  (`postKind: 'feed'`), each making with the ticked links; the Links field is hidden.
- Tests (`SourceForm.test.tsx`): the two starts with blog checked by default; Make post from a blog
  link sends `postKind: 'feed'`; from an idea, after Find sources, each button sends the ticked links
  with its kind; opened with `postKind="blog"` the idea start is checked.

## Task 5: share to several accounts
**Delivers:** 9–11. **Kind:** judgement.
- `content-shapes.ts`: add `'share'` to `ARTIFACT_KINDS`; `bun run db:generate` makes the migration
  (the kind check), committed with it.
- `model/share.ts`: `SHARE_ACCOUNTS: { instagram: { id: string; label: string }[]; linkedin: … }` —
  Instagram: every `PAGE_BRANDS` page with `instagram`, label `@handle`; LinkedIn: the main page only,
  label "OfCourse". `shareLine(body)`: "Shared to Instagram: @a, @b · LinkedIn: OfCourse · by Name".
- `ShareBody`: `{ instagram: string[]; linkedin: string[]; by: Stamp }` (ids from SHARE_ACCOUNTS;
  at least one in all).
- `server/social.ts` `sharePost(actor, id, version, accounts)`: only a live (or exported) feed post,
  only known ids, at least one; writes a `share` artifact, keeps the stage; `fail` otherwise.
  `actions.ts` `sharePostAction` as its neighbours (ActionResult, never throws).
- `LivePanel`: for an editor of a non-comic feed post, a "Share" section: checkboxes under
  "Instagram" (one per account) and "LinkedIn"; "Share" disabled with reason "Tick at least one
  account." (via Control) until one is ticked; on success `toast.success` with "Shared to Instagram:
  @a, @b" and/or "Shared to LinkedIn"; the post's shares listed with `shareLine`.
- Tests: `social.test.ts` (writes one share with the ids; refuses unknown ids, none, a post not
  live); `LivePanel.test.tsx` (several Instagram ticks send those ids; the toast text; Share
  unavailable with none ticked; no Share for a viewer who may not edit).

## Criteria coverage
| Criterion | Task | Test |
| --- | --- | --- |
| 1–4 | 4 | SourceForm.test.tsx |
| 5 | 2 | parts.test.tsx / PostPreview.test.tsx |
| 6 | 3 | SettingsForm.test.tsx |
| 7 | 1 | smoke (bar order) |
| 8 | 1 | parts.test.tsx |
| 9–11 | 5 | social.test.ts, LivePanel.test.tsx |
