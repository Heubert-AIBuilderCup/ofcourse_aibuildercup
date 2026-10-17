import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { brandById } from '@/features/content/brands'
import { exportName, exportZip } from '@/features/content/layout/zip'
import { getAssets, loadPost } from '@/features/content/server/store'
import { canSeeBoard } from '@/shared/lib/auth/access'
import { getSession } from '@/shared/lib/auth/session'

// "Download slides", from Images on, for everyone who may see the board (as the workbench is): the
// zip of a feed post's (a blog's post's too) current render, text only or with its pictures, from
// the render's stored SVG and PNG assets, with its caption when it has one. Nothing is drawn or
// written here. A social version's export is its own route (../export).

const NOT_FOUND = () => new Response(null, { status: 404 })
const Id = z.string().min(1).max(128)
// Keeps a leading byte-order mark, so the SVG goes into the zip exactly as stored.
const decoder = new TextDecoder('utf-8', { ignoreBOM: true })

export async function GET(_req: NextRequest, ctx: RouteContext<'/admin/posts/[id]/slides'>) {
  const session = await getSession()
  if (!session || !canSeeBoard(session.user)) return NOT_FOUND()
  const { id } = await ctx.params
  if (!Id.safeParse(id).success) return NOT_FOUND()

  const post = await loadPost(id)
  if (post?.kind !== 'feed') return NOT_FOUND()
  const { render, caption, revision } = post.current
  if (!render) return NOT_FOUND()

  const slides = render.body.slides
  const assets = await getAssets(slides.flatMap((s) => [s.svgAssetId, s.pngAssetId]))
  const svgs: string[] = []
  const pngs: Uint8Array[] = []
  for (const slide of slides) {
    const svg = assets.get(slide.svgAssetId)
    const png = assets.get(slide.pngAssetId)
    if (!svg || !png) return NOT_FOUND()
    svgs.push(decoder.decode(svg.bytes))
    pngs.push(png.bytes)
  }
  // The caption as the social export writes it, when the post has one; none otherwise.
  const tags = caption?.body.hashtags.join(' ')
  const words = caption && (tags ? `${caption.body.text}\n\n${tags}` : caption.body.text)
  const zip = exportZip({ svgs, pngs, caption: words ?? undefined })
  // The post's page, or the brand its text was frozen with when it has none.
  const pageId = post.pointers.pageBrandId ?? null
  const page = (pageId ? brandById(pageId)?.name : undefined) ?? revision?.body.brand.name ?? ''
  return new Response(Buffer.from(zip), {
    headers: {
      'Content-Type': 'application/zip',
      // exportName keeps the name to lower-case letters, digits, dashes and underscores.
      'Content-Disposition': `attachment; filename="${exportName(page, post.title, 'slides')}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
