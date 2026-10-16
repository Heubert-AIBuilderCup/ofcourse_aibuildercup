import type { NextRequest } from 'next/server'
import { getAsset, isLiveBlogAsset } from '@/features/content/server/store'

// A live blog's picture for anyone, signed in or not (BR9, BR10): the blog page's cover and inline
// pictures and its share image. Only a PNG that a live, unexpired blog's published pictures name as
// a tinted copy; a draft's, an expired blog's, an original, a post's slide (served on
// /posts/assets) or an unknown id is "not found". No session is read; the proxy rate-limits it with
// the posts' images. Ids are hashes of the bytes, but a blog leaves when it expires: shared caches
// keep a picture for an hour, not for good.

const NOT_FOUND = () => new Response(null, { status: 404 })

export async function GET(_req: NextRequest, ctx: RouteContext<'/blog/assets/[id]'>) {
  const { id } = await ctx.params
  if (!(await isLiveBlogAsset(id))) return NOT_FOUND()
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
