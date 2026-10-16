// A live blog's public page (BR9, BR10) and its card in the feed (BR11): its addresses, its
// metadata, its structured data, its sitemap entries, its reading time, where its pictures and a
// linked post's slides sit, and the related blogs. Pure: server/store.ts reads the blogs; this
// decides what the page tells readers, search engines and AI crawlers. Only the blog's general
// content leaves here: never its audience, layer or why line.

import type { Metadata, MetadataRoute } from 'next'
import { BLOG_PATH } from '@/shared/lib/auth/gate'
import { SITE_NAME, SITE_URL } from '@/shared/lib/site'
import { type LanguageId, linesOf, SEARCH_PHRASE } from '../languages'
import type { LiveBlog } from '../server/store'
import { type FeedBlog, isLive } from './feed'
import { localeOf, type SitemapRow } from './public-post'

/** The words a reader reads in a minute, for the reading time (BR11). */
export const WORDS_PER_MINUTE = 200

/** The most related blogs a page shows. */
export const MAX_RELATED_BLOGS = 4

/** The longest description search engines show in a result. */
const DESCRIPTION_MAX = 160

/** The blog's public page. */
export const blogPath = (slug: string): string => `${BLOG_PATH}/${slug}`

/** A live blog's picture on the public image route, readable without a session. */
export const blogAssetPath = (assetId: string): string =>
  `${BLOG_PATH}/assets/${encodeURIComponent(assetId)}`

const absolute = (path: string, siteUrl: string): string => new URL(path, siteUrl).href

/** The blog's public address, absolute on the site's origin: what its posts and captions cite (BR7). */
export const blogUrl = (slug: string, siteUrl: string = SITE_URL): string =>
  absolute(blogPath(slug), siteUrl)

/** The line a post's caption ends with while its blog is live (BR7), its words in the post's language (GD39): code writes it, never the model. */
export const guideLine = (url: string, label: string = linesOf('en').guide): string =>
  `${label}: ${url}`

/**
 * The line under the blog, as on a post's last slide (ADR-131), in the blog's language (GD39):
 * "OfCourse" and the title as written. A function replaces, so a "$&" in a title stays as it is.
 */
export const blogSearchLine = (title: string, language?: LanguageId): string =>
  linesOf(language).search.replace(SEARCH_PHRASE, () => `“${SITE_NAME} ${title}”`)

type Picture = LiveBlog['pictures'][number]
type Embed = LiveBlog['embeds'][number]

/** What sits after a section: a picture, a linked post's slides in its place, or nothing. */
export type AfterSection =
  | { kind: 'picture'; picture: Picture }
  | { kind: 'slides'; embed: Embed }
  | null

/**
 * The blog's body in reading order (BR4, BR9): its cover, then each section with what sits after
 * it. A linked post's slides embedded after a section take the place of the picture planned there.
 */
export function blogBody(blog: Pick<LiveBlog, 'sections' | 'pictures' | 'embeds'>): {
  cover: Picture | null
  sections: (LiveBlog['sections'][number] & { after: AfterSection })[]
} {
  const cover = blog.pictures.find((p) => p.target === 'cover') ?? null
  const sections = blog.sections.map((section, i) => {
    const at = i + 1
    const embed = blog.embeds.find((e) => e.after === at)
    const picture = blog.pictures.find((p) => p.target !== 'cover' && p.target.after === at)
    const after: AfterSection = embed
      ? { kind: 'slides', embed }
      : picture
        ? { kind: 'picture', picture }
        : null
    return { ...section, after }
  })
  return { cover, sections }
}

/** Every word the blog shows, in reading order: takeaways, then sections, then the FAQ. */
function blogWords(blog: Pick<LiveBlog, 'sections' | 'takeaways' | 'faq'>): string {
  return [
    ...blog.takeaways,
    ...blog.sections.flatMap((s) => [s.heading, s.body]),
    ...blog.faq.flatMap((f) => [f.q, f.a]),
  ].join(' ')
}

/** Its reading time: every word it shows at WORDS_PER_MINUTE, rounded, never under a minute. */
export function readingMinutes(blog: Pick<LiveBlog, 'sections' | 'takeaways' | 'faq'>): number {
  const words = blogWords(blog).split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE))
}

/** The blog as a card in the feed (BR11), ordered by its last publish. */
export function feedBlogOf(blog: LiveBlog): FeedBlog {
  const cover = blogBody(blog).cover
  return {
    kind: 'blog',
    id: blog.id,
    title: blog.title,
    slug: blog.slug,
    approvedAt: blog.updatedAt,
    settings: blog.settings,
    tags: blog.tags,
    cover: cover ? { assetId: cover.assetId, alt: cover.alt } : null,
    minutes: readingMinutes(blog),
    text: `${blog.title} ${blogWords(blog)}`,
    language: blog.language,
  }
}

function describe(blog: LiveBlog): string {
  const text = (blog.takeaways[0] ?? blog.sections[0]?.body ?? '').trim()
  if (!text) return `${blog.title}, on ${SITE_NAME}.`
  return text.length <= DESCRIPTION_MAX ? text : `${text.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…`
}

/**
 * The page title a reader searches for ("<title> | OfCourse"), its first takeaway as the
 * description, its canonical URL on the site (BR10), its dates and the cover as the share image on
 * Open Graph and Twitter, through the public image route, with its language when it is not English
 * (GD40). Every URL absolute, from the site's origin.
 */
export function blogMetadata(blog: LiveBlog, siteUrl: string = SITE_URL): Metadata {
  const title = `${blog.title} | ${SITE_NAME}`
  const description = describe(blog)
  const url = blogUrl(blog.slug, siteUrl)
  const cover = blogBody(blog).cover
  const image = cover ? absolute(blogAssetPath(cover.assetId), siteUrl) : null
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      siteName: SITE_NAME,
      publishedTime: blog.publishedAt,
      modifiedTime: blog.updatedAt,
      ...localeOf(blog.language),
      images: image && cover ? [{ url: image, alt: cover.alt }] : [],
    },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : [] },
  }
}

/**
 * The structured data search engines and AI crawlers read (BR10): an Article by OfCourse with its
 * dates, its cover and its canonical page, then a FAQPage of its questions when it has any.
 */
export function blogJsonLd(blog: LiveBlog, siteUrl: string = SITE_URL): object[] {
  const organization = { '@type': 'Organization', name: SITE_NAME, url: absolute('/', siteUrl) }
  const cover = blogBody(blog).cover
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: blog.title,
    datePublished: blog.publishedAt,
    dateModified: blog.updatedAt,
    author: organization,
    publisher: organization,
    ...(cover ? { image: [absolute(blogAssetPath(cover.assetId), siteUrl)] } : {}),
    mainEntityOfPage: { '@type': 'WebPage', '@id': blogUrl(blog.slug, siteUrl) },
  }
  if (blog.faq.length === 0) return [article]
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: blog.faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }
  return [article, faq]
}

/**
 * JSON for a `<script type="application/ld+json">`: the characters that could close the script or
 * open markup (`<`, `>`, `&`) and the two line separators written as unicode escapes, so text from
 * a blog can never leave the script. JSON.parse reads it back unchanged.
 */
export function jsonLdText(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/** Every blog still live at `now`, at its page's URL, last modified when it was last published. */
export function blogSitemapEntries(
  rows: readonly SitemapRow[],
  now: Date,
  siteUrl: string = SITE_URL,
): MetadataRoute.Sitemap {
  return rows
    .filter((row) => isLive(row, now))
    .map((row) => ({ url: blogUrl(row.slug, siteUrl), lastModified: row.approvedAt }))
}

/** Whether `other` carries a tag of `group` that `blog` carries too. */
const shares = (blog: LiveBlog, other: LiveBlog, group: 'theme' | 'destination'): boolean =>
  blog.tags.some((t) => t.startsWith(`${group}:`) && other.tags.includes(t))

/**
 * Other live blogs (BR9): those sharing a theme tag first, then those sharing a destination tag,
 * at most MAX_RELATED_BLOGS, never the blog itself; within each the order of `all` holds. The
 * caller passes live blogs only.
 */
export function relatedBlogs(blog: LiveBlog, all: readonly LiveBlog[]): LiveBlog[] {
  const others = all.filter((b) => b.id !== blog.id)
  const theme = others.filter((b) => shares(blog, b, 'theme'))
  const destination = others.filter((b) => !theme.includes(b) && shares(blog, b, 'destination'))
  return [...theme, ...destination].slice(0, MAX_RELATED_BLOGS)
}

const DAY = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** A date as the blog page shows it, "14 Oct 2026", the same on the server and in the browser. */
export const formatDay = (at: string): string => DAY.format(new Date(at))
