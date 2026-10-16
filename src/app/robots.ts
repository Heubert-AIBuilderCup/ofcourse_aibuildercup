import type { MetadataRoute } from 'next'
import { ADMIN_PATH, BLOG_PATH, FEED_PATH, POSTS_PATH } from '@/shared/lib/auth/gate'
import { SITE_URL } from '@/shared/lib/site'

// Crawlers may read the live posts' and blogs' public pages and their images (criterion 107,
// ADR-131, BR10), and never the admin, the signed-in feed or the API; the sitemap lists the posts
// and blogs. Built per request, so the sitemap's origin is the running site's (SITE_URL), not the
// build machine's.
export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: [`${POSTS_PATH}/`, `${BLOG_PATH}/`],
      disallow: [ADMIN_PATH, FEED_PATH, '/api'],
    },
    sitemap: new URL('/sitemap.xml', SITE_URL).href,
  }
}
