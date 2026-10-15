import type { NextRequest } from 'next/server'
import { getAsset, isLiveAsset } from '@/features/content/server/store'
import { getSession } from '@/shared/lib/auth/session'

// A slide of a live feed post, for any signed-in account (criteria 73, 77): only a PNG that a live,
// unexpired post's approved render or market version names; a draft's, a post's in review, an
// expired post's, a social version's or an unknown id is "not found". Ids are hashes of the bytes,
// so a URL never changes meaning and the browser may keep it for good. The (feed) layout does not
// cover route handlers, so the session is read here.

const NOT_FOUND = () => new Response(null, { status: 404 })

export async function GET(_req: NextRequest, ctx: RouteContext<'/feed/assets/[id]'>) {
  if (!(await getSession())) return NOT_FOUND()
  const { id } = await ctx.params
  if (!(await isLiveAsset(id))) return NOT_FOUND()
  const asset = await getAsset(id)
  if (asset?.mime !== 'image/png') return NOT_FOUND()
  return new Response(Buffer.from(asset.bytes), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
