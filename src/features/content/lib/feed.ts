// The student feed's rules over the live posts: which are still in it, their order, which version
// the home chip shows, and which posts the chips and the search words leave (ADR-122). Pure and
// client-safe: type-only imports from the model, nothing server-side. server/store.ts reads the
// posts; this decides what the feed does with them.

import { type LanguageId, labelledLanguage } from '../languages'
import { MARKET_IDS, type MarketId } from '../markets'
import { type FeedSettings, type LaidSlide, SEARCH_SLOT, type Structure } from '../model/types'
import { TAG_GROUPS, type TagGroup, tagsIn } from '../tags'
import { firstChars } from '../text/script'
import { expiresAt } from './lines'
import type { PostSource } from './sites'

export { MARKET_IDS, type MarketId }
/** The home market the `home` query asks for, or null for the main version. */
export type HomeMarket = MarketId | null

export type FeedSlide = { pngAssetId: string; alt: string }
export type FeedVersion = { excerpt: string; slides: FeedSlide[] }
export type FeedPost = {
  id: string
  title: string
  approvedAt: string
  settings: FeedSettings
  sourceLine: string | null
  /** The source record the post was made from, for related posts (criterion 91). */
  sourceId: string | null
  /** The path a comic tells (RC2), a catalogue course id; null on every other post. */
  courseId: string | null
  /** Tag ids from the pinned settings (ADR-122); none in a group means everyone in that group. */
  tags: string[]
  main: FeedVersion
  /** The approved market version and the market it is for, or null (criterion 82). */
  market: { id: MarketId; version: FeedVersion } | null
  /** Where the post's exported Instagram version was posted, and its page (criterion 90), or null. */
  instagram: { url: string; handle: string; pageUrl: string } | null
  /** The sources the published facts were made from, with their links (GD31); absent is none. */
  sources?: PostSource[]
  /** The blog the post is linked to, while it is live (BR7): "Read the full guide". Absent is none. */
  guide?: BlogGuide | null
  /** The language the post is written in (GD36), its source's; absent is English. */
  language?: LanguageId
}

/** A live blog as a post links to it (BR7): its id in the app, its slug on the public site. */
export type BlogGuide = { id: string; slug: string }

/**
 * A live blog as the feed shows it (BR11): a card with its cover and reading time, matched by the
 * same chips as the posts (criterion 81). `approvedAt` is its last publish, which orders it and
 * from which its expiry counts; `text` is every word it shows, which the search words read.
 */
export type FeedBlog = {
  kind: 'blog'
  id: string
  title: string
  slug: string
  approvedAt: string
  settings: FeedSettings
  tags: string[]
  /** Its drawn cover, or null when it has none. */
  cover: { assetId: string; alt: string } | null
  /** The language it is written in (GD40), its source's; absent is English. */
  language?: LanguageId
  /** Its reading time in whole minutes, at least one. */
  minutes: number
  text: string
}

/** One entry of the feed: a post, or a blog card. */
export type FeedItem = FeedPost | FeedBlog

/** Whether this entry of the feed is a blog card. */
export const isFeedBlog = (item: FeedItem): item is FeedBlog =>
  'kind' in item && item.kind === 'blog'

/** The feed's filters: one chip per tag group and the search words, all kept in the URL (81, 83). */
export type Filters = {
  destination: string | null
  home: MarketId | null
  theme: string | null
  age: string | null
  q: string
  /**
   * The URL named its filters: any filter key, even an empty one (parseFilters). The student chose,
   * so the profile stays out (criterion 84, lib/profile-contract.ts) and links keep naming them.
   */
  chosen?: boolean
}

/** How long a Featured post stays pinned above the rest (criterion 72). */
export const FEATURED_PIN_MS = 72 * 3_600_000

/** The most characters of search the feed reads, as a reader sees them; the rest is dropped. */
export const MAX_QUERY_LENGTH = 100

/** The query keys, in the order every feed URL carries them. */
const FILTER_KEYS = [...TAG_GROUPS, 'q'] as const

/** A known market id for the `home` query value (case-insensitive), null for anything else. */
export function parseMarket(value: unknown): HomeMarket {
  if (typeof value !== 'string') return null
  const upper = value.toUpperCase()
  return MARKET_IDS.find((id) => id === upper) ?? null
}

/** A tag's value: the part of its id after the group, "AU" of "destination:AU". */
export function tagValue(id: string): string {
  return id.slice(id.indexOf(':') + 1)
}

/** `value` when the tag file has a tag of `group` with it, null for anything else. */
export function knownTagValue(group: TagGroup, value: unknown): string | null {
  if (typeof value !== 'string') return null
  return tagsIn(group).some((t) => tagValue(t.id) === value) ? value : null
}

/** The filters the URL asks for: only values the tag file knows, and the words trimmed and bounded. */
export function parseFilters(searchParams: Record<string, string | string[] | undefined>): Filters {
  const q = searchParams.q
  return {
    chosen: FILTER_KEYS.some((key) => searchParams[key] !== undefined),
    destination: knownTagValue('destination', searchParams.destination),
    home: parseMarket(searchParams.home),
    theme: knownTagValue('theme', searchParams.theme),
    age: knownTagValue('age', searchParams.age),
    q: typeof q === 'string' ? firstChars(q.trim(), MAX_QUERY_LENGTH) : '',
  }
}

/** Within a group a post passes when it carries the chip's tag or has no tag of that group. */
function passesChip(post: Pick<FeedItem, 'tags'>, group: TagGroup, value: string | null): boolean {
  if (value === null) return true
  const prefix = `${group}:`
  const inGroup = post.tags.filter((t) => t.startsWith(prefix))
  return inGroup.length === 0 || inGroup.includes(`${prefix}${value}`)
}

/**
 * A post or blog in a language with a home country (Nepali, Hindi, Thai) shows only under that
 * home chip, whatever its tags; English shows under every chip and without one (GD40).
 */
function reachesHome(item: FeedItem, home: MarketId | null): boolean {
  const own = labelledLanguage(item.language)?.home ?? null
  return own === null || own === home
}

/**
 * Chips combine across groups (AND); within a group a post or a blog passes when it carries the
 * tag or has no tag of that group (criterion 81, BR11), and one not in English only under its
 * language's home chip (GD40). The words read a blog's own words.
 */
export function applyFilters<T extends FeedItem>(items: T[], f: Filters): T[] {
  return items.filter(
    (p) =>
      TAG_GROUPS.every((g) => passesChip(p, g, f[g])) &&
      reachesHome(p, f.home) &&
      (isFeedBlog(p) ? hasWords(p.text, f.q) : matchesWords(p, f.home, f.q)),
  )
}

/**
 * Every word of q (case-insensitive) appears in the text; any text has no words. Both are read in
 * one Unicode form (NFC), so a letter typed as one code point finds it written as two: Hindi ज़ as
 * U+095B, or as ज with its nukta.
 */
function hasWords(text: string, q: string): boolean {
  const lower = text.normalize('NFC').toLowerCase()
  return q
    .normalize('NFC')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => lower.includes(w))
}

/** The words a slide's alt carries, without its "Slide 2:" prefix. */
const slideText = (slide: FeedSlide): string => slide.alt.replace(/^Slide \d+:?\s*/, '')

/** Every word of q (case-insensitive) appears in the title, excerpt or a slide's text of the version shown. */
export function matchesWords(post: FeedPost, home: MarketId | null, q: string): boolean {
  if (!q.trim()) return true
  const version = versionOf(post, home)
  return hasWords([post.title, version.excerpt, ...version.slides.map(slideText)].join(' '), q)
}

/**
 * The feed or post URL with one filter changed and the others kept. A URL that named its filters
 * keeps naming them, and so does a change such as Clear: with every filter empty it carries an
 * empty `q`, never a bare path, so the profile does not fill the chips again (criterion 84).
 */
export function filterHref(path: string, f: Filters, change: Partial<Filters>): string {
  const next = { ...f, ...change }
  const params = new URLSearchParams()
  for (const key of FILTER_KEYS) {
    const value = next[key]
    if (value) params.set(key, value)
  }
  const chose = f.chosen === true || Object.keys(change).length > 0
  if (params.toString() === '' && chose) params.set('q', '')
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

/**
 * A post's excerpt: the first body slot with words, the one rule the feed card (server/store.ts),
 * the workbench's phone preview (RenderStep) and an instant market version (criterion 110) share.
 */
export const excerptOf = (structure: Structure): string =>
  structure.slides.map((s) => s.slots.body?.text).find((t) => t) ?? ''

/** Not yet expired at `now` (criterion 73). */
export function isLive(post: Pick<FeedPost, 'settings' | 'approvedAt'>, now: Date): boolean {
  const ends = expiresAt(post.settings.expiry, post.approvedAt)
  return ends === null || now.getTime() < ends
}

/** Live posts and blogs only: Featured ones approved within FEATURED_PIN_MS first, then newest approval first (criteria 71, 72, BR11). */
export function feedOrder<T extends FeedItem>(posts: T[], now: Date): T[] {
  const pinned = (p: T): number =>
    p.settings.layer === 'featured' && now.getTime() - Date.parse(p.approvedAt) < FEATURED_PIN_MS
      ? 1
      : 0
  return posts
    .filter((p) => isLive(p, now))
    .sort((a, b) => pinned(b) - pinned(a) || Date.parse(b.approvedAt) - Date.parse(a.approvedAt))
}

/** The version the home chip asks for: the market version when it is for that market, the main one otherwise (criteria 76, 82). */
export function versionOf(post: FeedPost, home: HomeMarket): FeedVersion {
  return post.market && post.market.id === home ? post.market.version : post.main
}

/** The words a laid-out slide draws, in order: each line, then its source line, then its search line as one line (not its drawn rows). */
export function slideWords(laid: LaidSlide | undefined): string[] {
  if (!laid) return []
  return [
    ...laid.lines.filter((l) => l.slot !== SEARCH_SLOT).map((l) => l.text),
    ...(laid.sourceLine ? [laid.sourceLine] : []),
    ...(laid.searchLine ? [laid.searchLine] : []),
  ]
}

/**
 * The source line a post's card shows: the first slide's that has one, whole even where the slide
 * had to shorten it beside its frame, since the card's line wraps (criterion 71).
 */
export function cardSourceLine(slides: readonly LaidSlide[]): string | null {
  const slide = slides.find((s) => s.sourceLine)
  return slide ? (slide.fullSourceLine ?? slide.sourceLine) : null
}

/** "Slide 2: <its words>", or "Slide 2" when the caller has no words for it (criterion 75). */
export function slideAlt(slide: number, text: string[] | undefined): string {
  const words = (text ?? []).join(' ').trim()
  return words ? `Slide ${slide}: ${words}` : `Slide ${slide}`
}
