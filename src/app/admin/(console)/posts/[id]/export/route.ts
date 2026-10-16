import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { exportZip } from '@/features/content/layout/zip'
import { getAssets, loadPost } from '@/features/content/server/store'
import { canEdit } from '@/shared/lib/auth/access'
import { getSession } from '@/shared/lib/auth/session'

// The export download of a social version (criterion 67), for editors only: the zip of the
// slides its export record names, from the render's stored SVG and PNG assets, and that caption.
// Nothing is drawn or written again here, and nothing is posted anywhere (criterion 68).

const NOT_FOUND = () => new Response(null, { status: 404 })
const Id = z.string().min(1).max(128)
// Keeps a leading byte-order mark, so the SVG goes into the zip exactly as stored.
const decoder = new TextDecoder('utf-8', { ignoreBOM: true })

export async function GET(_req: NextRequest, ctx: RouteContext<'/admin/posts/[id]/export'>) {
  const session = await getSession()
  if (!session || !canEdit(session.user)) return NOT_FOUND()
  const { id } = await ctx.params
  if (!Id.safeParse(id).success) return NOT_FOUND()

  const post = await loadPost(id)
  if (post?.kind !== 'social' || post.stage !== 'exported') return NOT_FOUND()
  // current() keeps the export only while it names the current render and caption.
  const { export: exported, render, caption } = post.current
  if (!exported || !render || !caption) return NOT_FOUND()

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
  const { text, hashtags } = caption.body
  const zip = exportZip({
    svgs,
    pngs,
    caption: hashtags.length > 0 ? `${text}\n\n${hashtags.join(' ')}` : text,
  })
  return new Response(Buffer.from(zip), {
    headers: {
      'Content-Type': 'application/zip',
      // exportName keeps the name to lower-case letters, digits, dashes and underscores.
      'Content-Disposition': `attachment; filename="${exported.body.fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
