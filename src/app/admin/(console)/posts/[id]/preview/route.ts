import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { draftPreviewPng, layoutPreviewPng, plannedScenes } from '@/features/content/server/preview'
import { canSeeBoard } from '@/shared/lib/auth/access'
import { getSession } from '@/shared/lib/auth/session'
import { Lru } from '@/shared/lib/lru'

// One slide of a draft (?drafts=<id>&i=<n>&slide=<k>&theme=<id>) or of an approved layout before
// render (?layout=<id>&slide=<k>, and &plan=<id> to write that image plan's scenes in the art boxes,
// GD12), drawn by the layout engine, for staff who may see the board.
// Every id, the index, the slide and the theme are in the URL, so a URL always shows the same
// picture and the browser may keep it for good. For the same reason the server keeps the last
// PREVIEWS_KEPT pictures it drew, keyed by the post and those ids, so a repeat request (another
// reviewer, a reload without the browser's cache) does not run the layout and resvg again. Only a
// drawn picture is kept, and the session is checked before the cache is read.
// A database or drawing error (every connection slot taken, 18 Oct) is a 503 the browser may try
// again in two seconds (components/SlidePreview.tsx does, once), logged in one line, never a 500.

const NOT_FOUND = () => new Response(null, { status: 404 })
const TRY_AGAIN = () =>
  new Response(null, { status: 503, headers: { 'Retry-After': '2', 'Cache-Control': 'no-store' } })

/** The most preview PNGs kept in memory: a few posts' drafts, a few hundred kilobytes each. */
const PREVIEWS_KEPT = 64
const drawn = new Lru<Uint8Array>(PREVIEWS_KEPT)

const Id = z.string().min(1).max(128)
const Count = z.coerce.number().int().min(0).max(999)
const Query = z.union([
  z.object({ drafts: Id, i: Count, slide: Count.min(1), theme: Id.nullable() }),
  z.object({ layout: Id, slide: Count.min(1), plan: Id.optional() }),
])

export async function GET(req: NextRequest, ctx: RouteContext<'/admin/posts/[id]/preview'>) {
  try {
    return await preview(req, ctx)
  } catch (error) {
    // Which kind of slide, and why, without the ids or anything the slide says.
    const what = new URL(req.url).searchParams.has('layout') ? 'layout slide' : 'draft slide'
    console.error(`[preview] ${what} failed: ${error instanceof Error ? error.message : error}`)
    return TRY_AGAIN()
  }
}

async function preview(req: NextRequest, ctx: RouteContext<'/admin/posts/[id]/preview'>) {
  const session = await getSession()
  if (!session || !canSeeBoard(session.user)) return NOT_FOUND()
  const { id } = await ctx.params
  const params = new URL(req.url).searchParams
  const query = Query.safeParse({
    drafts: params.get('drafts') ?? undefined,
    i: params.get('i') ?? undefined,
    layout: params.get('layout') ?? undefined,
    slide: params.get('slide') ?? undefined,
    theme: params.get('theme'),
    plan: params.get('plan') ?? undefined,
  })
  if (!query.success || !Id.safeParse(id).success) return NOT_FOUND()

  const q = query.data
  const key =
    'drafts' in q
      ? `${id}|drafts|${q.drafts}|${q.i}|${q.slide}|${q.theme ?? ''}`
      : `${id}|layout|${q.layout}|${q.slide}|${q.plan ?? ''}`
  let png = drawn.get(key) ?? null
  if (!png) {
    png =
      'drafts' in q
        ? await draftPreviewPng({
            postId: id,
            draftsId: q.drafts,
            index: q.i,
            slide: q.slide,
            themeId: q.theme,
          })
        : await layoutPng(id, q.layout, q.slide, q.plan)
    if (!png) return NOT_FOUND()
    drawn.set(key, png)
  }
  return new Response(Buffer.from(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  })
}

/** An approved layout's slide, with the scenes of the image plan named, when one is, in its art box. */
async function layoutPng(
  postId: string,
  layoutId: string,
  slide: number,
  planId: string | undefined,
): Promise<Uint8Array | null> {
  const planned = planId ? await plannedScenes(postId, planId, layoutId) : undefined
  if (planned === null) return null
  return layoutPreviewPng({ postId, layoutId, slide, planned })
}
