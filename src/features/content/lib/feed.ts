// The student feed's rules over the live posts: which are still in it, their order, which version
// the home chip shows, and which posts the chips and the search words leave (ADR-122). Pure and
// client-safe: the model's types and its list of share accounts, nothing server-side.
// server/store.ts reads the posts; this decides what the feed does with them.

import { SITE_NAME } from '@/shared/lib/site'
import { brandById, COMICS_BRAND_ID } from '../brands'
import { type LanguageId, labelledLanguage } from '../languages'
import { MARKET_IDS, type MarketId } from '../markets'
import { instagramLabels } from '../model/share'
import { type FeedSettings, type LaidSlide, SEARCH_SLOT, type Structure } from '../model/types'
import { pageBrandFor } from '../pages'
import { TAG_GROUPS, type TagGroup, tagsIn } from '../tags'
import { firstChars } from '../text/script'
import { expiresAt } from './lines'
import { type FeedRoadmap, type RoadmapLinks, roadmapLinks } from './roadmap-lines'
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
  /** The Instagram account ids it was shared to (model/share.ts), each once; absent or empty is none. */
  sharedTo?: string[]
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

/**
 * The feed's filters, all kept in the URL (81, 83): the values chosen per tag group (several, the
 * key repeated: `?destination=AU&destination=UK`), and the search words. Home holds one market,
 * since it also picks the version a post shows (82) and which languages show (GD40).
 */
export type Filters = {
  destination: string[]
  home: MarketId | null
  theme: string[]
  age: string[]
  q: string
  /**
   * The kinds the Show group leaves ticked, in SHOW_KINDS order; absent is all three. Updates are
   * already targeted to her roadmaps, so only this narrows them, never the chips or the words.
   */
  show?: ShowKind[]
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

/** The query keys, in the order every feed URL carries them, after `show`. */
const FILTER_KEYS = [...TAG_GROUPS, 'q'] as const

/** What the Show group can tick, in its order: her updates, the posts, the blogs. */
export const SHOW_KINDS = ['updates', 'posts', 'blogs'] as const
export type ShowKind = (typeof SHOW_KINDS)[number]

/** Whether the Show group leaves this kind ticked: every kind when the URL named none. */
export const shows = (f: Filters, kind: ShowKind): boolean => !f.show || f.show.includes(kind)

/** The kinds a `show` value names, of one value or several: each once, in SHOW_KINDS order. */
function knownShowKinds(value: string | string[]): ShowKind[] {
  const asked = new Set(Array.isArray(value) ? value : [value])
  return SHOW_KINDS.filter((k) => asked.has(k))
}

/** The change that unticks a kind shown, or ticks one hidden. */
export function toggledShow(f: Filters, kind: ShowKind): Partial<Filters> {
  return { show: SHOW_KINDS.filter((k) => (k === kind ? !shows(f, k) : shows(f, k))) }
}

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

/**
 * The values of `group` the tag file has, of one value or several: each once, in the file's
 * order, so a set of choices has one URL. Anything else is dropped.
 */
export function knownTagValues(group: TagGroup, value: unknown): string[] {
  const asked = new Set(Array.isArray(value) ? value : [value])
  return tagsIn(group)
    .map((t) => tagValue(t.id))
    .filter((v) => asked.has(v))
}

/**
 * The filters the URL asks for: only values the tag file knows, and the words trimmed and bounded.
 * Without a `show` key every kind shows, so a link from elsewhere misses nothing; with one, only
 * the kinds it names (an empty one names none).
 */
export function parseFilters(searchParams: Record<string, string | string[] | undefined>): Filters {
  const { q, show } = searchParams
  return {
    chosen: ['show', ...FILTER_KEYS].some((key) => searchParams[key] !== undefined),
    ...(show === undefined ? {} : { show: knownShowKinds(show) }),
    destination: knownTagValues('destination', searchParams.destination),
    home: parseMarket(searchParams.home),
    theme: knownTagValues('theme', searchParams.theme),
    age: knownTagValues('age', searchParams.age),
    q: typeof q === 'string' ? firstChars(q.trim(), MAX_QUERY_LENGTH) : '',
  }
}

/** A group's chosen values, home's as a list of none or one. */
export const chosenIn = (f: Filters, group: TagGroup): string[] =>
  group === 'home' ? (f.home ? [f.home] : []) : f[group]

/**
 * The change that adds `value` to a group's filter, or takes it away when chosen. Home holds one
 * value: choosing another replaces it, choosing it again clears it.
 */
export function toggled(f: Filters, group: TagGroup, value: string): Partial<Filters> {
  if (group === 'home') return { home: f.home === value ? null : parseMarket(value) }
  const values = f[group].includes(value)
    ? f[group].filter((v) => v !== value)
    : [...f[group], value]
  return { [group]: knownTagValues(group, values) }
}

/** Within a group a post passes when it carries any chosen value's tag or has no tag of that group. */
function passesChip(post: Pick<FeedItem, 'tags'>, group: TagGroup, values: string[]): boolean {
  if (values.length === 0) return true
  const prefix = `${group}:`
  const inGroup = post.tags.filter((t) => t.startsWith(prefix))
  return inGroup.length === 0 || values.some((v) => inGroup.includes(`${prefix}${v}`))
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
 * Chips combine across groups (AND); within a group a post or a blog passes when it carries any
 * chosen tag or has no tag of that group (criterion 81, BR11), and one not in English only under its
 * language's home chip (GD40). The words read a blog's own words. Posts or blogs the Show group
 * unticked are left out.
 */
export function applyFilters<T extends FeedItem>(items: T[], f: Filters): T[] {
  return items.filter(
    (p) =>
      shows(f, isFeedBlog(p) ? 'blogs' : 'posts') &&
      TAG_GROUPS.every((g) => passesChip(p, g, chosenIn(f, g))) &&
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
 * `show` comes first, a key per kind ticked, left out when all three are and empty when none is.
 */
export function filterHref(path: string, f: Filters, change: Partial<Filters>): string {
  const next = { ...f, ...change }
  const params = new URLSearchParams()
  const show = next.show ?? SHOW_KINDS
  if (show.length === 0) params.append('show', '')
  else if (show.length < SHOW_KINDS.length) for (const k of show) params.append('show', k)
  for (const key of FILTER_KEYS) {
    const value = next[key]
    for (const v of Array.isArray(value) ? value : [value]) if (v) params.append(key, v)
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

/** How many cards the feed shows at a time: the server's first page, then each page the scroll asks for. */
export const FEED_PAGE_SIZE = 8

/**
 * One page of the feed: `size` entries from `offset` of what the filters leave, in the order
 * given (feedOrder's). The feed stops asking once a page comes back short.
 */
export function feedPage<T extends FeedItem>(
  items: T[],
  f: Filters,
  offset: number,
  size: number,
): T[] {
  return applyFilters(items, f).slice(offset, offset + size)
}

/** The main page (brands/main.json): who posted a post with nothing else to go on. */
const MAIN_BRAND_ID = 'main'

/** An Instagram handle as the feed shows it. */
const at = (handle: string) => `@${handle}`

/** The page brand a post went out under by the rules: a comic's page, else the one its theme picks (ADR-124). */
function pageBrandOf(post: FeedPost): string | null {
  if (post.courseId) return COMICS_BRAND_ID
  return post.tags.map(pageBrandFor).find((id) => id !== null) ?? null
}

/**
 * The Instagram accounts that posted a post, as its panel names them: the accounts it was shared
 * to (model/share.ts), else the page its exported Instagram version went out under, else the page
 * its rules pick (a comic's, its theme's), else the main page. Never empty.
 */
export function postingAccounts(post: FeedPost): string[] {
  const shared = instagramLabels(post.sharedTo ?? [])
  if (shared.length > 0) return shared
  if (post.instagram) return [at(post.instagram.handle)]
  const page =
    brandById(pageBrandOf(post) ?? MAIN_BRAND_ID)?.instagram ?? brandById(MAIN_BRAND_ID)?.instagram
  return [page ? at(page.handle) : SITE_NAME]
}

/**
 * A feed card: what the card draws and nothing more, since a page of them is all the browser is
 * sent. A post in the version the home chip asks for (criterion 82), with the Instagram accounts
 * that posted it, its whole excerpt as the caption, and how it bears on her roadmaps (null
 * without roadmaps); a blog as its card (BR11).
 */
export type FeedCard =
  | {
      kind: 'post'
      id: string
      title: string
      /** The Instagram accounts that posted it (postingAccounts), the first shown, never empty. */
      accounts: string[]
      layer: FeedSettings['layer']
      whyLine: string | null
      language?: LanguageId
      caption: string
      slides: FeedSlide[]
      sourceLine: string | null
      roadmapLinks: RoadmapLinks | null
    }
  | ({ kind: 'blog' } & Pick<FeedBlog, 'id' | 'title' | 'cover' | 'language' | 'minutes'>)

/** The card of a post or a blog, under the home chip `home`, for a student with these roadmaps. */
export function feedCardOf(
  item: FeedItem,
  home: HomeMarket,
  roadmaps: readonly FeedRoadmap[] = [],
): FeedCard {
  if (isFeedBlog(item)) {
    const { id, title, cover, language, minutes } = item
    return { kind: 'blog', id, title, cover, language, minutes }
  }
  const version = versionOf(item, home)
  return {
    kind: 'post',
    id: item.id,
    title: item.title,
    accounts: postingAccounts(item),
    layer: item.settings.layer,
    whyLine: item.settings.whyLine,
    language: item.language,
    caption: version.excerpt,
    slides: version.slides,
    sourceLine: item.sourceLine,
    roadmapLinks: roadmapLinks(item.tags, roadmaps),
  }
}
