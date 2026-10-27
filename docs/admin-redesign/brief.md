Rebuild the admin's look (/admin/*) from the round 2 design on the OfCourse canvas, without changing what any screen does.

This replaces `admin-polish-brief.md`, which only tidied the old look.

## The design

- Canvas: https://claude.ai/code/artifact/60828ddf-c380-4cdc-ac53-d05a393fea6d (page "Admin"). Read it with the Artifact tool's `read` action, never WebFetch. List its files first.
- Build from **round 2** (artboards `project/A2*.dc.html`). Round 1 (`project/AdminBoard*.dc.html`) is superseded.
- Every round 2 artboard imports one prototype, `project/AdminApp.dc.html`, with a `screen` attribute. That file holds all screens, their copy and their mock data; `project/admin.css` and `project/admin2.css` hold the look. Read those three; the artboard files are only wrappers.
- Sizes drawn: every screen at 1440; Board, New feed post, Workbench and Users also at 390 (phone); Board also at 1920.
- The canvas's round 2 note carries three build notes, repeated in the work list below.

## Read first

1. `CLAUDE.md` and `src/design-systems/industry/DESIGN.md`.
2. The design files above.

## Rules for translating it

- The prototype's CSS is a reference for the look, not code to copy. Build with the repo's Tailwind semantic tokens and roles (`text-h1`…`text-caption`, `gap-block`, `gap-stack`, `px-gutter`, `py-section`), container queries (`@max-xl:`, `@5xl:`), no hex values, no px except hairlines and icon sizes, Lucide icons at `strokeWidth={1.5}` sized with `size-icon-sm`/`size-icon`/`size-icon-lg`.
- **The blue band** that opens most screens is the student app's brand panel. Reuse it, don't redraw it: `bg-panel text-panel-foreground`, the grid from `motion.grid` in `src/shared/components/motion.module.css`, and `data-theme="light"` on the band so it keeps its look in dark mode. `src/features/auth/components/SignInPanel.tsx` is the working example. Make one shared component for the band (title, a kicker line, and up to four numbers that can be buttons) in `src/features/admin/components/` and use it on every screen that has one.
- Copy: use the product's own labels wherever the prototype differs. Known cases: the Text step's per-slide button is "Another take" (and "Redraft" after a failure); the "Add by email" checkboxes are "Editor" and "Reviewer" (the prototype says "Edit" and "Review").
- The prototype's mock data (people, posts, numbers) is illustration. Every number on screen comes from the real data.

## Branch and scope

- Branch `feat/admin-redesign` from `main`.
- Look and layout only. No new features and no behaviour changes, except the few marked **new** below. Every changed line must trace to an item here.
- Tests: run only the test files of components you touch, through `bash scripts/capped.sh bun test <file>`, and keep them green. Update a test only where it asserts copy or structure you deliberately changed.
- Suggested order, one review each: (1) frame and Board, (2) New feed post and Workbench, (3) Users and Models, (4) Comic gaps, Ideas, Updates, Insights, Page styles.

## The work

### 1. The frame — `src/features/admin/components/AdminChrome.tsx`, `AdminNav.tsx` (done)

- One header bar as drawn: the duck, "OfCourse" with "Admin" in the accent, the section tabs on the same row, then the AI tag, theme toggle and the account button (avatar, name). Below 576 the tabs drop to their own row and scroll, as on the phone artboards.
- The account button: show the viewer's real role (User, Admin, Superadmin) or nothing; editor and reviewer are capabilities, not roles.
- Every screen's title through one shared page header (the kicker, the h1, the lede), as the prototype's `ad-top` block draws it.

### 2. Board — `src/features/content/components/Board.tsx`, `BoardFrame.tsx`, `BoardFilters.tsx`, `BoardMore.tsx`, `src/features/content/lib/board.ts` (done)

- The band: "Assigned to you, <first name>", then "<n> of your posts need you", with three numbers: Structures, In review, Ready. **New:** the counts are the viewer's own posts (the board's existing `assignee: 'mine'` filter) in those three stages. Pressing a number sets the Assignee filter to Mine and highlights that column.
- The type switch, filters and "Clear filters" restyled as drawn; behaviour unchanged.
- Columns: numbered (1–6), each with its one-line sub, joined as one road.
- The render gate: a locked blue tile on the road (the band's panel style), with the lock icon and the explanation in a `title`: "Only a structure a reviewer has approved can be rendered." No yellow.
- Cards: four lines, as drawn, plus a versions count where a post has social versions. Social versions hang under their feed post. The ↳ lines and the linked-version tags go.
- Card thumbnails: before the gate, the dashed "Not rendered yet" draft. After the gate, real thumbnails are out of scope (the board query carries no cover).
- First run (no posts at all): the blue band with the duck, "No posts yet.", the lede, the "New feed post" button and the six stages listed.
- A live card: the accent border and the "Live" status line; no one-sided bar.

### 3. New feed post — `src/features/content/components/steps/SourceForm.tsx`

- "Start from" as two option cards, as drawn; the same choices and behaviour as today.
- The blue "What happens next" panel beside the form: the eight workbench steps and the reviewer lock, as drawn.
- "Make post" stays disabled until there is a source (already true).

### 4. Workbench — `src/features/content/components/Workbench.tsx`, `StageRail.tsx`, `stage.tsx`, `parts.tsx`, `steps/StructuresStep.tsx`

- The stage rail (Source, Ideas, Outline, Text, Images, Settings, Review, Live) shows done, current and upcoming the way the student app's loader does.
- The slide stage over its filmstrip, the tabbed panel on the right and the sticky bar at the bottom are already built: restyle them as drawn, behaviour unchanged.
- The Text step's tabs keep their real names and order logic: Checks, Your version, Versions, Style. The prototype's Checks list is invented; the real one lists slot lengths, overflow, glyphs the font lacks, contrast, numbers not in the facts and "Headline claim not in the article". Restyle the real list.

### 5. Users — `src/features/admin/components/UsersList.tsx`, `UserPage.tsx`, `Field.tsx`, `Pager.tsx`

- The band, the hairline table, the filters and the two "Add by email" / "Waiting for first sign-in" areas, as drawn.
- Role tags: User, Admin, Superadmin. Editor and Reviewer as dashed capability tags beside the role.
- Type sizes onto the roles (today `text-xs`/`text-sm`/`text-3xl`); `lg:grid-cols-2` becomes a container query. Replace the rounded filled chips (`chip`, `chipStrong` in `styles.ts`) with tags, and delete `styles.ts` once nothing imports it (`ModelsScreen.tsx` does today).

### 6. Models — `src/features/admin/models/components/ModelsScreen.tsx`

- The band and the use-case table as drawn, with a **Last test** column: "Not tested yet" until a row is tested, then the row's result line as the screen already words it ("Passed on <model> in <n> ms", or "Failed on … : <error>").
- The band follows the same rule: "Not tested yet" until something is tested, then "<n> tested, all passed" (or the failures), with passed, failed and not-tested counts.
- Results live in the page's state, as each row's `TestResult` does today; they are not stored, so a reload shows "Not tested yet" again. That is the honest state; do not imply a monitor.
- The "Falling back" tag loses `rounded-md`.

### 7. Comic gaps, Ideas, Updates, Insights, Page styles

`src/features/content/components/InsightsTable.tsx` (or `src/features/insights/components/InsightsTable.tsx`), `IdeasQueue.tsx`, `PageStyles.tsx`; `src/features/updates/components/UpdatesScreen.tsx`, `UpdateCard.tsx`; `src/features/insights/components/InsightsOverview.tsx`, `EvidenceGaps.tsx`.

- Comic gaps, Insights: the band with their numbers (from the real or labelled-mock data the screens already use; keep the "(mock)" labels).
- Hairline tables and rows with role or status tags, no "+" corner marks on tables; bars where drawn (Comic gaps' "times shown").
- Updates: the preview drawn the way students see the card in their feed; reuse the student feed's card if one exists rather than drawing a second.
- Page styles: the drop zone for reference images, wired to the upload the screen already has.
- Filled badges become hairline tags (`UpdateCard.tsx:29`, `IdeasQueue.tsx:95`, the "!" badge in `parts.tsx`); `bg-muted` fills become hairline frames (`UpdateCard.tsx:39`, `SourcePane.tsx`, `ImagesStep.tsx`), except the red highlight on a flagged sentence.

## Check

- Look at every admin screen at 390, 1024, 1440 and 1920, light and dark, and compare each with its round 2 artboard.
- Check the empty states: a board with no posts, a Models page before any test, Users with one account.
- `bun run lint` and `bun run type-check` pass.
- Report per screen: what changed, with file paths; what you left out and why; and any place where the design and the product disagreed and which you followed.
