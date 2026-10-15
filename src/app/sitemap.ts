import type { MetadataRoute } from 'next'
import { blogSitemapEntries } from '@/features/content/lib/public-blog'
import { sitemapEntries } from '@/features/content/lib/public-post'
import { listLiveBlogSlugs, listLiveSlugs } from '@/features/content/server/store'

// Every live post's public page with its approval date (criterion 107, ADR-131), and every live
// blog's with its last publish (BR10), read on each request, so a post or a blog is listed as soon
// as it goes live, its date moves when it is republished, and it leaves when it expires.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const [posts, blogs] = await Promise.all([listLiveSlugs(), listLiveBlogSlugs()])
  return [...sitemapEntries(posts, now), ...blogSitemapEntries(blogs, now)]
}
