import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { BlogArticle, RelatedBlogs } from '@/features/content/components/feed/BlogArticle'
import { FollowPages } from '@/features/content/components/feed/FollowPages'
import {
  blogAssetPath,
  blogJsonLd,
  blogMetadata,
  blogPath,
  blogSearchLine,
  jsonLdText,
  relatedBlogs,
} from '@/features/content/lib/public-blog'
import { isSlug, postAssetPath, postPath } from '@/features/content/lib/public-post'
import { type LiveBlog, liveBlogBySlug, liveBlogs } from '@/features/content/server/store'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { buttonVariants } from '@/shared/components/ui/button'
import { SIGNIN_PATH } from '@/shared/lib/auth/gate'
import { SITE_NAME } from '@/shared/lib/site'
import { cn } from '@/shared/lib/utils'

/**
 * The live, unexpired blog at this slug, or null; anything not shaped like a slug never reaches
 * the database. Cached per request, so the metadata and the page share one read.
 */
const publicBlog = cache(
  async (slug: string): Promise<LiveBlog | null> => (isSlug(slug) ? liveBlogBySlug(slug) : null),
)

export async function generateMetadata({ params }: PageProps<'/blog/[slug]'>): Promise<Metadata> {
  const blog = await publicBlog((await params).slug)
  return blog ? blogMetadata(blog) : { title: `Not found | ${SITE_NAME}` }
}

/**
 * A live blog's public page, for anyone, signed in or not, and for search engines and AI crawlers
 * (BR9, BR10): the article (title, dates, takeaways, sections, pictures, linked posts' slides, FAQ,
 * sources, its live posts at /posts/<slug>), the related blogs, its search line (both in and marked
 * as its language, GD39, GD40), "Follow us" and a
 * way to join, with its Article and FAQPage structured data and its canonical address in the
 * metadata. A blog not published, an
 * expired one, a feed post's slug or an unknown one is "not found". The pictures come from the
 * blog image route, the embedded posts' slides from the post one. No session is read.
 */
export default async function PublicBlogPage({ params }: PageProps<'/blog/[slug]'>) {
  const blog = await publicBlog((await params).slug)
  if (!blog) notFound()
  const related = relatedBlogs(blog, await liveBlogs())
  return (
    <div className="@container flex min-h-dvh flex-col bg-background text-foreground">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD, escaped by jsonLdText so no text can leave the script.
        dangerouslySetInnerHTML={{ __html: jsonLdText(blogJsonLd(blog)) }}
      />
      <header className="border-b">
        <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between gap-4 px-gutter">
          <Link href={SIGNIN_PATH} className="font-heading font-semibold">
            {SITE_NAME}
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-section px-gutter py-section">
        <BlogArticle
          blog={blog}
          pictureHref={blogAssetPath}
          slideHref={postAssetPath}
          postHref={(p) => (p.slug ? postPath(p.slug) : null)}
        />
        <RelatedBlogs blogs={related} href={(b) => blogPath(b.slug)} />
        <p lang={blog.language ?? 'en'} className="max-w-prose text-muted-foreground">
          {blogSearchLine(blog.title, blog.language)}
        </p>
        <FollowPages linkedin />
        <section
          aria-label={`Join ${SITE_NAME}`}
          className="flex max-w-prose flex-col items-start gap-stack @max-xl:sticky @max-xl:bottom-0 @max-xl:items-stretch @max-xl:border-t @max-xl:bg-background @max-xl:py-4"
        >
          <p className="text-lead">
            Three possible futures in Australia, built from a few taps about you, and more guides
            like this one.
          </p>
          <Link href={SIGNIN_PATH} className={cn(buttonVariants({ variant: 'strong' }))}>
            Join {SITE_NAME}
          </Link>
        </section>
      </main>
    </div>
  )
}
