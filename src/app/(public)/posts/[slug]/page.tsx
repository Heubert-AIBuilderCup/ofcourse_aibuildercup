import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { PostSources } from '@/features/content/components/feed/PostSources'
import { SlideStrip } from '@/features/content/components/feed/SlideStrip'
import { LanguageTag } from '@/features/content/components/PhoneFeedCard'
import { linesOf } from '@/features/content/languages'
import { blogPath } from '@/features/content/lib/public-blog'
import {
  isSlug,
  type PublicPost,
  postAssetPath,
  postMetadata,
} from '@/features/content/lib/public-post'
import { liveBySlug } from '@/features/content/server/store'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { buttonVariants } from '@/shared/components/ui/button'
import { SIGNIN_PATH } from '@/shared/lib/auth/gate'
import { SITE_NAME } from '@/shared/lib/site'
import { cn } from '@/shared/lib/utils'

/**
 * The live, unexpired post at this slug, or null; anything not shaped like a slug never reaches
 * the database. Cached per request, so the metadata and the page share one read.
 */
const publicPost = cache(
  async (slug: string): Promise<PublicPost | null> => (isSlug(slug) ? liveBySlug(slug) : null),
)

export async function generateMetadata({ params }: PageProps<'/posts/[slug]'>): Promise<Metadata> {
  const post = await publicPost((await params).slug)
  return post ? postMetadata(post) : { title: `Not found | ${SITE_NAME}` }
}

/**
 * A live post's public page, for anyone, signed in or not (criterion 107, ADR-131): its title, the
 * slides of its main version, its sources with their links (GD31; the source line of a post read
 * before them), "Read the full guide" while its blog is live (BR7), those lines in the post's language (GD39), the last slide's search line
 * and a way to join. The post is marked as its language and, when not English, labelled with it (GD40).
 * Only the post's general content: never its audience, layer, why line or settings, and never a
 * market version. A draft, a post in review, an expired post, a social version or an unknown slug
 * is "not found". The page follows its own width: on a phone the join button stays in reach at
 * the bottom.
 */
export default async function PublicPostPage({ params }: PageProps<'/posts/[slug]'>) {
  const post = await publicPost((await params).slug)
  if (!post) notFound()
  // The lines code writes, in the post's language (GD39).
  const fixed = linesOf(post.language)
  return (
    <div className="@container flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between gap-4 px-gutter">
          <Link href={SIGNIN_PATH} className="font-heading font-semibold">
            {SITE_NAME}
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-section px-gutter py-section">
        <article lang={post.language ?? 'en'} className="flex flex-col gap-stack">
          <LanguageTag language={post.language} />
          <h1 className="max-w-2xl text-h1 font-semibold tracking-tight">{post.title}</h1>
          <SlideStrip slides={post.main.slides} assetHref={postAssetPath} />
          {post.sources?.length ? (
            <PostSources sources={post.sources} heading={fixed.sources} />
          ) : (
            post.sourceLine && (
              <p className="max-w-prose text-caption text-muted-foreground">{post.sourceLine}</p>
            )
          )}
          {post.guide && (
            <Link
              href={blogPath(post.guide.slug)}
              className="self-start font-heading underline-offset-4 hover:underline"
            >
              {fixed.guide}
            </Link>
          )}
          {post.searchLine && (
            <p className="max-w-prose text-muted-foreground">{post.searchLine}</p>
          )}
        </article>
        <section
          aria-label={`Join ${SITE_NAME}`}
          className="flex max-w-prose flex-col items-start gap-stack @max-xl:sticky @max-xl:bottom-0 @max-xl:items-stretch @max-xl:border-t @max-xl:bg-background @max-xl:py-4"
        >
          <p className="text-lead">
            Three possible futures in Australia, built from a few taps about you, and more posts
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
