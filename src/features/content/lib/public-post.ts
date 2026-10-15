// A live post's public page (criterion 107, ADR-131): its slug, its metadata and its sitemap entry.
// Pure: the store reads the posts and stores each slug once, when the post goes live; this decides
// what the slug is and what the page tells search engines and share previews. Only the post's
// general content leaves here: never its audience, layer or why line.

import type { Metadata, MetadataRoute } from 'next'
import { POSTS_PATH } from '@/shared/lib/auth/gate'
import { SITE_NAME, SITE_URL } from '@/shared/lib/site'
import { type LanguageId, labelledLanguage } from '../languages'
import { type FeedPost, isLive } from './feed'

/** A live post as its public page shows it: the feed's post with its slug and its search line. */
export type PublicPost = FeedPost & {
  slug: string
  /** The last slide's "To find this again, search …" line; none on posts laid out before ADR-131. */
  searchLine: string | null
}

/**
 * A live comic as a futures card shows it (RC16): its title, its public page and its first panel
 * on the public image route, both readable without a session.
 */
export type ComicCover = { title: string; href: string; coverSrc: string }

/** The longest slug a title makes, before a number is added for a second post with the title. */
export const SLUG_MAX = 80

/** Slugs a post never gets: the image route sits beside the post pages. */
const RESERVED = new Set(['assets'])

/** The longest description search engines show in a result. */
const DESCRIPTION_MAX = 160

/** The 1080 × 1350 canvas every slide is drawn on. */
const SLIDE = { width: 1080, height: 1350 } as const

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * The title as a URL segment: accents dropped to their plain letters, lowercase, every run of
 * anything but a-z and 0-9 one hyphen, none at either end, at most SLUG_MAX characters; "post" when
 * nothing is left. Migration 0006 backfills live posts with the same steps in SQL.
 */
export function slugOf(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '')
  return slug || 'post'
}

/** `base` when no post has it, else `base-2`, `base-3`, … the first that is free. */
export function freeSlug(base: string, taken: readonly string[]): string {
  const used = new Set(taken)
  const free = (slug: string) => !used.has(slug) && !RESERVED.has(slug)
  if (free(base)) return base
  let n = 2
  while (!free(`${base}-${n}`)) n++
  return `${base}-${n}`
}

/** A value shaped like a slug, so anything else is "not found" before the database is asked. */
export function isSlug(value: string): boolean {
  return value.length <= SLUG_MAX + 8 && SLUG.test(value)
}

/** The post's public page. */
export const postPath = (slug: string): string => `${POSTS_PATH}/${slug}`

/** A live post's slide on the public image route, readable without a session. */
export const postAssetPath = (assetId: string): string =>
  `${POSTS_PATH}/assets/${encodeURIComponent(assetId)}`

const absolute = (path: string, siteUrl: string): string => new URL(path, siteUrl).href

/**
 * The Open Graph locale of a page not in English (GD40), its language and home country ("ne_NP"),
 * to spread into its `openGraph`; none for English.
 */
export function localeOf(id: LanguageId | undefined): { locale?: string } {
  const language = labelledLanguage(id)
  return language?.home ? { locale: `${language.id}_${language.home}` } : {}
}

function describe(post: PublicPost): string {
  const excerpt = post.main.excerpt.trim()
  if (!excerpt) return `${post.title}, on ${SITE_NAME}.`
  return excerpt.length <= DESCRIPTION_MAX
    ? excerpt
    : `${excerpt.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…`
}

/**
 * The page title a reader searches for ("<title> | OfCourse"), the excerpt as its description,
 * its canonical URL on the site, and the cover slide as the share image on Open Graph and Twitter,
 * through the public image route, with its language when it is not English (GD40). Every URL
 * absolute, from the site's origin.
 */
export function postMetadata(post: PublicPost, siteUrl: string = SITE_URL): Metadata {
  const title = `${post.title} | ${SITE_NAME}`
  const description = describe(post)
  const url = absolute(postPath(post.slug), siteUrl)
  const cover = post.main.slides[0]
  const image = cover ? absolute(postAssetPath(cover.pngAssetId), siteUrl) : null
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
      ...localeOf(post.language),
      images: image && cover ? [{ url: image, ...SLIDE, alt: cover.alt }] : [],
    },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : [] },
  }
}

/** A live post as the sitemap reads it. */
export type SitemapRow = Pick<FeedPost, 'approvedAt' | 'settings'> & { slug: string }

/** Every post still live at `now`, at its page's URL, last changed when it was approved. */
export function sitemapEntries(
  rows: readonly SitemapRow[],
  now: Date,
  siteUrl: string = SITE_URL,
): MetadataRoute.Sitemap {
  return rows
    .filter((row) => isLive(row, now))
    .map((row) => ({ url: absolute(postPath(row.slug), siteUrl), lastModified: row.approvedAt }))
}
