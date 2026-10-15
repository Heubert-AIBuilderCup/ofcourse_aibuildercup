import type { NextRequest } from 'next/server'
import { getAsset } from '@/features/content/server/store'
import { canSeeBoard } from '@/shared/lib/auth/access'
import { getSession } from '@/shared/lib/auth/session'

// A stored image (an art file, a rendered slide) for staff who may see the board. Ids are hashes
// of the bytes, so a URL never changes meaning and the browser may keep it for good.

const NOT_FOUND = () => new Response(null, { status: 404 })

export async function GET(_req: NextRequest, ctx: RouteContext<'/admin/assets/[id]'>) {
  const session = await getSession()
  if (!session || !canSeeBoard(session.user)) return NOT_FOUND()
  const { id } = await ctx.params
  const asset = await getAsset(id)
  if (!asset) return NOT_FOUND()
  return new Response(Buffer.from(asset.bytes), {
    headers: {
      'Content-Type': asset.mime,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      // A slide's SVG opened on its own runs nothing, even if a field ever reached it unescaped.
      ...(asset.mime === 'image/svg+xml' ? { 'Content-Security-Policy': 'sandbox' } : {}),
    },
  })
}
