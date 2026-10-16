import type { NextRequest } from 'next/server'
import { getAsset, isLiveAsset } from '@/features/content/server/store'

// A slide of a live post for anyone, signed in or not (criterion 107): the public page's images
// and its share image. Only a PNG that a live, unexpired post's approved render or market version
// names; a draft's, a post's in review, an expired post's, a social version's or an unknown id is
// "not found". No session is read. Ids are hashes of the bytes, so a URL never changes meaning, but
// a post leaves when it expires: shared caches keep a slide for an hour, not for good.

const NOT_FOUND = () => new Response(null, { status: 404 })

export async function GET(_req: NextRequest, ctx: RouteContext<'/posts/assets/[id]'>) {
  const { id } = await ctx.params
  if (!(await isLiveAsset(id))) return NOT_FOUND()
  const asset = await getAsset(id)
  if (asset?.mime !== 'image/png') return NOT_FOUND()
  return new Response(Buffer.from(asset.bytes), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
