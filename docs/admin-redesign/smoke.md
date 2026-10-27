**Smoke test — admin redesign (the frame and every admin screen)** · local dev · `http://localhost:3000`

**Before you start**
- `bun run dev` running on the branch `feat/admin-redesign`.
- Sign in at `/admin/sign-in` as an admin with editor and reviewer rights (or a superadmin).
- Steps 4 and 5 need no posts at all; the rest need posts in several stages, some assigned to you (assign a few with the cards' Assign button).
- Check 390 (phone), 1024, 1440 and 1920, light and dark, against the canvas's Admin page, round 2 boards: A2Board (1440), A2BoardPhone (390), A2Board1920.

**1 · The bar**
```
Go to   /admin/board
Do      read the top bar; open the account button (top right)
See     one row: the duck, "OfCourse Admin" with "Admin" in the accent, the tabs (Board, Comic gaps,
        Updates, Ideas, Insights, and Users, Models for an admin), the dashed AI tag ("Gemini · …" or
        "Stand-in AI"), the theme toggle, the account button (initials, name, your role: User, Admin
        or Superadmin, never Editor or Reviewer); the current tab underlined
        the menu: Dark theme (with its switch) and Sign out
```

**2 · Sign out and the theme**
```
Go to   /admin/board
Do      account menu → Dark theme; then account menu → Sign out
See     the page turns dark and back with the toggle and with the menu item; Sign out lands on
        /admin/sign-in
```

**3 · The bar on smaller screens**
```
Go to   /admin/board at 1024, then 390
Do      read the bar; scroll the tabs sideways on the phone
See     below 1280 (Tailwind's 80rem) the AI tag, your name and role hide, the initials stay, so all
        seven tabs fit at 1024; from 1280 they show
        at 390 the tabs take their own row under the brand, edge to edge, and scroll; the theme toggle
        is gone from the bar and lives in the account menu
```

**4 · Every screen's title**
```
Go to   /admin/board, /admin/comic-gaps, /admin/updates, /admin/ideas, /admin/insights,
        /admin/users, a user's page, /admin/models, /admin/page-styles, /admin/posts/new
Do      read the top of each page
See     the same block on each: a small accent kicker (Content, Route comics, Students, Queue,
        Students in aggregate, People, AI, Pages, New feed post), the h1, the one-line lede;
        Updates has "New update" with a plus icon on the right; the workbench is unchanged (part 2)
```

**5 · First run (no posts at all)**
```
Go to   /admin/board with no post in the database
Do      read; press "New feed post" in the blue band
See     the blue grid band with the duck, "No posts yet.", "Paste a source or a link and OfCourse
        makes the first post.", a white "New feed post" button, the six stages listed
        (01 Structures … 06 Live); no band of counts, no filters, no columns
        the button opens /admin/posts/new; an admin without the editor right sees no button
```

**6 · The band**
```
Go to   /admin/board with posts, some assigned to you
Do      read the blue band; press "in review"
See     "Assigned to you, <your first name>", "<n> of your posts need you" ("needs" for 1), three
        numbers: structures to pick, in review, ready to publish — only your own posts, whatever the
        filters are; a post's market version (Nepal) is not counted as a second post
        the press sets Assignee to Mine and the tab to All (other filters kept, the address shows
        ?assignee=mine) and lights the In review column for a moment; on a phone it scrolls to it
```

**7 · The type switch, filters and Clear filters**
```
Go to   /admin/board
Do      press each tab; set Assignee, Type, Page, Language; press Clear filters
See     the segmented tabs "All 9 · Feed posts 6 · Social versions 2 · Route comics 1", the pressed
        one filled; the four selects with uppercase labels; Clear filters (underlined) only while a
        select is set, and it keeps the tab; same behaviour as before
        at 390 the tabs sit two by two and the selects hide behind "Filters" ("Filters · 2" with two
        set), opening two by two
```

**8 · The columns and the gate**
```
Go to   /admin/board at 1440
Do      read the column headers; hover the blue lock tile after Structures; scroll the board
See     six columns numbered 01–06, joined by one grey road: Structures (Pick one), Approved
        (To render), Rendered (Edit and check), In review (A reviewer checks), Ready (Publish or
        export), Live (In the feed or exported), each with its count; an empty one says "Nothing
        here" in a dashed box
        the gate: a locked blue tile on the road with a blue band below, "Render gate · crossed by
        approval only"; its tooltip "Only a structure a reviewer has approved can be rendered."; no
        yellow; the headers and the tile stay put while the cards scroll
        below about 1100 (the board's own width under 64rem) the columns stack, the gate a blue
        horizontal band between Structures and Approved
        at 390 one stage at a time: a row of stage buttons (01 Structures 2 …, the lock tile after
        Structures), the pressed one filled; the gate band shows only with Approved; a band number
        switches to its stage
```

**9 · The cards**
```
Go to   /admin/board
Do      read a card in each column; open one
See     the kicker with its icon (Feed post · Main, Blog, Route comic, Instagram · Cerebral, Market),
        the title (a link to the post), one status line ("Changed by … · date"), the owner line
        (name or Unassigned, the note, Assign or Change for an editor)
        Structures cards show a dashed "Not rendered yet" above; later cards have no picture (out of
        scope: no cover in the board's data)
        a live card is framed in the accent with "● Live · …"; a feed post with social versions shows
        "n versions"; its social versions in the same column hang under it with a small elbow; no ↳
        lines
```

**10 · More**
```
Go to   /admin/board
Do      press More
See     New blog, New comic (editors), Page styles, Comic character, each with an icon; each opens
        its page
```

**11 · New feed post**
```
Go to   /admin/posts/new, then /admin/posts/new?kind=blog
Do      press "From an idea", then "From a blog"; type a link; press "Paste text instead"
See     "Start from" as two cards (link icon "From a blog · One to five links, or pasted text",
        bulb icon "From an idea · Gemini finds pages to read"), the chosen one framed in the accent
        with its dot filled; the fields unframed; "Paste text instead" an underlined text action;
        "Make post" (sparkle icon, disabled until a source) and "Cancel" back to the board
        beside the form from 1024 (under it below): the blue "What happens next" panel with the
        duck, the eight steps (1 lit) and "Nothing reaches students until a reviewer approves it."
        New blog has no panel (a blog's steps differ); every behaviour as before
```

**12 · The workbench**
```
Go to   a post's workbench, e.g. /admin/posts/<id>/text
Do      read the top; open each tab in the right panel; open the Checks tab with a problem
See     "← Board" (accent, arrow icon) / the title; the step rail: one square mark per step on a
        line, done steps ticked with the line in the accent, the current one ringed, upcoming ones
        dashed; the open screen's name underlined; done and current steps link
        the right panel: one hairline frame, equal tabs with the accent line under the open one
        (Checks, Your version, Versions, Style), the body padded inside
        the selected filmstrip slide framed in the foreground; the step bar at the bottom runs edge
        to edge, translucent with blur
        Checks: each problem a row with an outlined red "!", hairlines between; "All checks pass"
        with a filled tick; a disabled control's "!" is an outlined red tag, not filled
```

**13 · Users**
```
Go to   /admin/users (as an admin, then as a superadmin), then a user's page
Do      search, set Role and Status, toggle Online now, page through; add an email with Editor
See     the band "Right now · <n> people online" ("1 person online"), with <n> accounts, <n> staff:
        admin or superadmin, and for a superadmin <n> waiting for first sign-in — the counts stay
        the same whatever the filters
        the filters bar (search with its icon and Search button, Role, Status, a square Online now
        switch); a hairline table (heavy rule on top, initials box beside each name, role tag, dashed
        Editor/Reviewer tags, "Online" in the accent); at 390 each row stacks
        "Add by email" (checkboxes "Editor" and "Reviewer" under "Can also") and "Waiting for first
        sign-in" side by side from 1024; "No address is waiting." in a dashed box when empty
        the user's page: tags instead of filled chips; every action as before
```

**14 · Models**
```
Go to   /admin/models as a superadmin; reload after testing
Do      press Test on one row, then another; press "Test all student calls"; press Reset
See     "Reset to defaults" and "Test all student calls" in the page top; the band "Last test ·
        Not tested yet" with AI calls, passed, failed, not tested yet; after one Test "1 tested, all
        passed" (or "n tested, f failed"); the table's Last test column "Not tested yet" until a
        row is tested, then "Passed on <model> in <n> ms" or "Failed on …"
        rows grouped "For the team" and "For students" (they were a "Student/Admin" column)
        "Test all student calls" shows its lines under the band but does not change the band
        (its results are checks, not table rows); a reload shows "Not tested yet" again
        as an admin (not superadmin): everything reads "Not tested yet", no Test buttons
```

**15 · Comic gaps**
```
Go to   /admin/comic-gaps
See     the band with the duck: "Last 30 days · <n> paths have no comic yet", times shown, comics
        made (live comics), and "Mock" only while counts are mock; a hairline table with a bar for
        times shown, "Mock" tags on mock rows; "Make comic" for an editor
```

**16 · Insights**
```
Go to   /admin/insights
See     the band "AI cost and reuse · 7 days · AUD x.xx per active student a week (mock)" with calls
        per student a session (mock), answered from the cache, renders a week, AI calls a week; no
        "+" frames; evidence gaps and performance as hairline tables; every "(mock)" label kept;
        "Research this" for an editor
```

**17 · Ideas**
```
Go to   /admin/ideas
Do      accept one, dismiss one
See     each idea a plain hairline box; the expansion badge a hairline accent tag (no fill);
        sources with icons; Accept and Dismiss as before
```

**18 · Updates**
```
Go to   /admin/updates
Do      pick an update; press "New update"
See     hairline list rows, the picked one framed in the accent; "Who it reaches"; the preview is
        the student feed's own card, its badge now a hairline tag and its why line a hairline frame
        (the student feed shows the same change)
```

**19 · Page styles**
```
Go to   /admin/page-styles
Do      drag one image onto a page's drop zone; press "Choose files"
See     a dashed, hatched drop zone "Add one or two of the page's posts" that uploads as the file
        field did; "Choose files" opens the file picker; "Describe the style" as before
```

**20 · Workbench details from part 4**
```
Go to   a post's Source step, then Images
See     on Source the used paragraph in a hairline frame, a picked sentence underlined, a flagged
        one still red; on Images an empty thumbnail is a dashed frame (no grey fill)
```

**21 · The unit suite**
```
Run     bun run test:run
See     0 fail (it was 8 on main before this branch)
```
