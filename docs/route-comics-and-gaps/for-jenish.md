# For Jenish: recording what students were shown, and a comic on a futures card

A few small additions to your futures slice, for you to make when it suits you. This branch (`feat/route-comics`, and `feat/route-insights` after it) changes none of your files: nothing in `src/features/engine`, `src/features/opening` or `src/app/(app)` is touched. Everything below is yours to paste.

## 1. Recording what she was shown (RC12, RC17)

Two lines: one in the page for the first draw, one in `FuturesScreen` for each redraw. **Nothing is recorded until they are in, and they go in together**: with only the first, every redraw goes unrecorded and the Comic gaps tab's strengths and costs lean to first draws. Until then the admin's Comic gaps tab (`/admin/comic-gaps`) shows mock counts, each labelled "mock" (RC14), and no strengths or costs (RC19). Nothing else waits on them.

### The first draw (the page)

In `src/app/(app)/futures/page.tsx`, the futures are built inline at `:22` (`initial={buildFutures({ answers: profile.answers, relative })}`). Hoist them into a constant, then record what she was shown:

```tsx
const initial = buildFutures({ answers: profile.answers, relative })
await recordFuturesShown(user.id, initial, { redraw: false })
```

and pass `initial={initial}` to `FuturesScreen`.

- `recordFuturesShown` records each path shown with the future it appeared as, its `strongOn` and its `costsOn`, or, for a sealed result, each nearest route with its `overByK`. It reads your `FuturesResult` by its shape, so it imports nothing of yours, and it keeps none of her answers and no student identifier.
- It also counts each path once per student per day for the Comic gaps ranking (RC12), so it replaces the earlier `recordPathViews(user.id, courseIdsShown(initial))` line: you need only this one.
- It never throws: on a database error it logs `[insights.recordFuturesShown]` and returns, so `/futures` never breaks because of it.

### Each redraw (`FuturesScreen`)

In `src/features/opening/components/FuturesScreen.tsx`, `choose` redraws in the browser (`const result = buildFutures({ answers, relative })`, then `setView(…)`). After `setView`, send the new result:

```tsx
void recordRedrawAction(result).catch(() => {})
```

Fire and forget: don't await it, don't put it in the transition, and don't toast on failure; it never blocks the screen. `undo` redraws too (`result: buildFutures({ answers, relative })` inside `setView`); if you want an undo counted as a redraw, build the result into a constant there and send it the same way.

- `recordRedrawAction` is a server action. It takes the student from her session, never from the request, refuses anyone who is not a student, checks the result against the engine's shape and keeps only what a showing keeps. It returns an `ActionResult` and never throws; nothing on the screen needs to read it.
- A redraw adds showings but leaves the day's count of each path alone, and at most 30 redraw showings are recorded per student a day (about ten redraws); past that it returns `ok` without writing.

## 2. A comic on the card (RC16)

On the same page, after `initial`, read the live comics for the paths shown:

```tsx
const comics = await liveComicCovers(courseIdsShown(initial))
```

`comics` is a `Record<string, ComicCover>` keyed by course id: for each path, the newest-approved comic that is live and unexpired. A path with no live comic has no key. Each `ComicCover` is `{ title, href, coverSrc }`: `href` is the comic's public page (`/posts/<slug>`) and `coverSrc` its first panel on the public image route (`/posts/assets/<id>`), so a student's browser loads both without anything more.

Pass `comics` through `FuturesScreen` (a new prop, `comics: Record<string, ComicCover>`) to each `FutureCard` (`comics={comics}`, or just `comic={comics[future.courseId]}`). In `FutureCard`, show it when there is one:

```tsx
{comic && <ComicCoverLink comic={comic} />}
```

A natural place is in the "Keep options open" section (`FutureCard.tsx:185-201`), under the "Remind me" button. `ComicCoverLink` is a plain link with the panel and "Read the comic: <title>"; it holds no state, imports nothing server-only, and is safe in your `'use client'` card.

Two things to know:

- **Futures redrawn in the browser.** When she changes an answer, `FuturesScreen` redraws with `buildFutures` in the browser, and a future can then name a course that was not in `initial`; that card shows no comic until the page loads again. If you would rather cover every path, read `liveComicCovers` for all the course ids your catalogue has instead of `courseIdsShown(initial)`: it is one read either way (at most 500 live comics).
- **A failed read.** `liveComicCovers` reads the database and can throw like `getProfile` can. If you want the page to show without comics when it fails, use `await liveComicCovers(…).catch(() => ({}))`.

## Imports

```tsx
// src/app/(app)/futures/page.tsx (server)
import { courseIdsShown, recordFuturesShown } from '@/features/insights'
import { liveComicCovers } from '@/features/content/server/store'

// FuturesScreen.tsx (client)
import { recordRedrawAction } from '@/features/insights/actions'

// FuturesScreen.tsx and FutureCard.tsx (client)
import type { ComicCover } from '@/features/content/lib/public-post'
import { ComicCoverLink } from '@/features/content/components/ComicCoverLink'
```

`@/features/insights` arrives with the Insights branch (`feat/route-insights`); `courseIdsShown` is only needed there for the comics of section 2. Import `recordRedrawAction` from `@/features/insights/actions`, never from the `@/features/insights` barrel: the barrel also exports the server-only recorders, which a client component must not pull in. The content feature has no barrel, so its three come from their own modules as above. `@/features/content/server/store` is server-only: import it in the page, never in a client component.
