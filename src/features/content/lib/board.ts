import { ACCESS_ERRORS } from '@/shared/lib/auth/access'
import { BOARD_PATH } from '@/shared/lib/auth/gate'
import { formatWhen } from '@/shared/lib/site'
import { brandById } from '../brands'
import { LANGUAGE_IDS, type LanguageId } from '../languages'
import { marketById } from '../markets'
import { COLUMNS, type ColumnId, columnOf, STAGE_LABELS, type Stage } from '../model/stages'
import type { BoardCard } from '../server/store'
import { charCount } from '../text/script'
import { postPath } from './steps'
import { changedSincePublished } from './workflow'

// The board's view of the posts, pure: which card sits in which column, the lines that link a
// feed post to its market and social versions, the filters in its address, and the counts the
// tabs show.

export const BOARD_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'feed', label: 'Feed posts' },
  { id: 'social', label: 'Social versions' },
  { id: 'comics', label: 'Route comics' },
] as const
export type BoardFilter = (typeof BOARD_FILTERS)[number]['id']

/** The filter named by `?filter=`; anything else is All. */
export function parseFilter(value: unknown): BoardFilter {
  return BOARD_FILTERS.find((f) => f.id === value)?.id ?? 'all'
}

/** What a card is, for the Type filter: a comic is a feed post that tells a path (RC2). */
export const BOARD_TYPES = [
  { id: 'feed', label: 'Feed post' },
  { id: 'blog', label: 'Blog' },
  { id: 'comic', label: 'Comic' },
  { id: 'social', label: 'Social version' },
] as const
export type BoardType = (typeof BOARD_TYPES)[number]['id']

/** The board's filters as its address names them; each is 'any' when off. */
export type BoardParams = {
  filter: BoardFilter
  /** 'mine', 'unassigned' or a board staff member's id. */
  assignee: string
  type: BoardType | 'any'
  /** A page brand's id. */
  page: string
  lang: LanguageId | 'any'
}

export const ANY_BOARD: BoardParams = {
  filter: 'all',
  assignee: 'any',
  type: 'any',
  page: 'any',
  lang: 'any',
}

/** `?assignee=`: Mine, Unassigned or one of the board's staff by id; anything else is Any. */
export function parseAssignee(value: unknown, staffIds: readonly string[]): string {
  if (value === 'mine' || value === 'unassigned') return value
  return typeof value === 'string' && staffIds.includes(value) ? value : 'any'
}

/** `?type=`: a type of card; anything else is Any. */
export function parseType(value: unknown): BoardParams['type'] {
  return BOARD_TYPES.find((t) => t.id === value)?.id ?? 'any'
}

/** `?page=`: a page brand the registry knows; anything else is Any. */
export function parsePage(value: unknown): string {
  return typeof value === 'string' && brandById(value) ? value : 'any'
}

/** `?lang=`: one of the language file's; anything else is Any. */
export function parseLang(value: unknown): BoardParams['lang'] {
  return LANGUAGE_IDS.find((l) => l === value) ?? 'any'
}

type Query = Record<string, string | string[] | undefined>

/** The board's filters from its address, each unknown value Any. */
export function parseBoardParams(query: Query, staffIds: readonly string[]): BoardParams {
  return {
    filter: parseFilter(query.filter),
    assignee: parseAssignee(query.assignee, staffIds),
    type: parseType(query.type),
    page: parsePage(query.page),
    lang: parseLang(query.lang),
  }
}

const BOARD_KEYS = ['filter', 'assignee', 'type', 'page', 'lang'] as const
/** A value longer than any id is no filter; the board parses what is kept on arrival. */
const VALUE_MAX = 64

/** The filters that are on, as a query string without the `?`; '' when none is. */
export function boardQuery(params: BoardParams): string {
  const query = new URLSearchParams()
  for (const key of BOARD_KEYS) {
    if (params[key] !== ANY_BOARD[key]) query.set(key, params[key])
  }
  return query.toString()
}

/**
 * The board's address a post was opened from (`?from=` on its pages): only the board's own keys
 * survive, so the way back can only lead to the board; '' for the bare board.
 */
export function boardFrom(value: unknown): string {
  if (typeof value !== 'string') return ''
  const given = new URLSearchParams(value)
  const kept = new URLSearchParams()
  for (const key of BOARD_KEYS) {
    const v = given.get(key)
    if (v && v.length <= VALUE_MAX) kept.set(key, v)
  }
  return kept.toString()
}

/** The way back to the board from a post, with the filters it was opened from. */
export function boardBackHref(from: string): string {
  return from ? `${BOARD_PATH}?${from}` : BOARD_PATH
}

/** The board's address with these filters on. */
export const boardHref = (params: BoardParams) => boardBackHref(boardQuery(params))

/** Someone a post can be assigned to (server/assign.ts listBoardStaff); no email reaches the browser. */
export type BoardStaff = { id: string; name: string }

/** The longest note to a post's owner, in characters as a reader sees them (text/script.ts). */
export const NOTE_MAX = 280

export const ASSIGN_ERRORS = {
  notAuthorised: ACCESS_ERRORS.notAuthorised,
  unknown: 'Unknown post.',
  assignee: 'Choose someone who works on the board.',
  note: `Keep the note to ${NOTE_MAX} characters.`,
} as const

/** "12 of 280 characters": the note's length as the limit counts it. */
export const noteCount = (note: string) => `${charCount(note.trim())} of ${NOTE_MAX} characters`

export type BoardItem = {
  id: string
  title: string
  /** A blog's card is marked "Blog" (BR1); its links and filters are a feed post's. */
  kind: 'feed' | 'blog' | 'social' | 'market'
  /** For the Type filter; a market item is its post's. */
  type: BoardType
  stage: Stage
  href: string
  /** "Feed post · Main": what the card is (its kind, or a social version's platform) and its page. */
  overline: string
  /** On a social version: '↳ from feed post "<title>"'. */
  fromLine: string | null
  /** On a feed post: "↳ <market> · market variant", "↳ Instagram · ready". */
  linkedLines: string[]
  /** "Changed by Maya R. · 5 Oct 2026, 09:12". */
  changedLine: string
  /** On a live post: "General · Everyone · Leaves the feed in 90 days". */
  liveLine: string | null
  /** Published and worked on again: students still see what was published (criterion 116). */
  changedSincePublished: boolean
  /** The page it is made for; a market item's is its post's. */
  pageId: string | null
  /** Its post's language; a social version and a market item take their feed post's. */
  language: LanguageId
  /** The post's owner and note: a market item shows its post's, a social version its own. */
  assigneeId: string | null
  assigneeName: string | null
  assignmentNote: string | null
}

const PLATFORM_LABELS = { instagram: 'Instagram', linkedin: 'LinkedIn' } as const

const changedLine = (card: BoardCard) =>
  `${card.updatedByName ? `Changed by ${card.updatedByName}` : 'Changed'} · ${formatWhen(card.updatedAt)}`

const ownerOf = (card: BoardCard) => ({
  assigneeId: card.assigneeId,
  assigneeName: card.assigneeName,
  assignmentNote: card.assignmentNote,
})

/** A tab's cards: Route comics are the posts that tell a path, Feed posts the rest but social. */
const inTab = (filter: BoardFilter, item: BoardItem) => {
  if (filter === 'all') return true
  if (filter === 'social') return item.kind === 'social'
  if (filter === 'comics') return item.type === 'comic'
  return item.kind !== 'social' && item.type !== 'comic'
}

const KIND_LABELS = {
  feed: 'Feed post',
  blog: 'Blog',
  comic: 'Route comic',
  market: 'Market',
} as const

/** "Feed post · Main": the kind, or a social version's platform, then the page when it has one. */
function overlineOf(kind: string, pageId: string | null): string {
  const page = pageId ? brandById(pageId)?.name : null
  return page ? `${kind} · ${page}` : kind
}

/** Whether the item passes every filter but the tab. */
function matches(item: BoardItem, params: BoardParams, viewerId: string): boolean {
  const { assignee, type, page, lang } = params
  const owner =
    assignee === 'any' ||
    (assignee === 'unassigned'
      ? item.assigneeId === null
      : item.assigneeId === (assignee === 'mine' ? viewerId : assignee))
  return (
    owner &&
    (type === 'any' || item.type === type) &&
    (page === 'any' || item.pageId === page) &&
    (lang === 'any' || item.language === lang)
  )
}

/**
 * The board under its filters: items by column, the count each tab shows under the other
 * filters, the pages the cards are made for (the Page filter's choices), and whether the filters
 * hide every card.
 */
export function boardView(
  cards: BoardCard[],
  params: BoardParams,
  viewerId: string,
): {
  columns: { id: ColumnId; label: string; items: BoardItem[] }[]
  counts: Record<BoardFilter, number>
  pages: { id: string; name: string }[]
  empty: boolean
} {
  const feeds = new Set(cards.filter((c) => c.kind !== 'social').map((c) => c.id))
  const socialOf = new Map<string, BoardCard[]>()
  for (const c of cards) {
    if (c.kind === 'social' && c.parentId && feeds.has(c.parentId)) {
      socialOf.set(c.parentId, [...(socialOf.get(c.parentId) ?? []), c])
    }
  }

  // A post's address opens the step it is at; a market item opens it there on its market version,
  // which the Settings, Review and Live steps show. Each carries the board's address back.
  const from = boardQuery(params)
  const href = (path: string, market?: string) => {
    const query = new URLSearchParams(market ? { market } : {})
    if (from) query.set('from', from)
    const q = query.toString()
    return q ? `${path}?${q}` : path
  }
  const ordered: BoardItem[] = []
  for (const c of cards) {
    if (c.kind === 'social') {
      // A social version follows its parent; one whose parent is gone keeps its own place.
      if (!c.parentId || !feeds.has(c.parentId)) ordered.push(socialItem(c, null))
      continue
    }
    const children = socialOf.get(c.id) ?? []
    const market = c.market ? marketById(c.market) : null
    const linkedLines = [
      ...(market ? [`↳ ${market.name} · market variant`] : []),
      ...children.map(
        (s) =>
          `↳ ${s.platform ? PLATFORM_LABELS[s.platform] : 'Social'} · ${STAGE_LABELS[s.stage].toLowerCase()}`,
      ),
    ]
    const type: BoardType = c.kind === 'blog' ? 'blog' : c.courseId ? 'comic' : 'feed'
    ordered.push({
      id: c.id,
      title: c.title,
      kind: c.kind === 'blog' ? 'blog' : 'feed',
      type,
      overline: overlineOf(KIND_LABELS[type], c.pageId),
      stage: c.stage,
      href: href(postPath(c.id)),
      fromLine: null,
      linkedLines,
      changedLine: changedLine(c),
      liveLine: c.liveLine,
      changedSincePublished: changedSincePublished(c.stage, c.publishedApprovalId),
      pageId: c.pageId,
      language: c.language,
      ...ownerOf(c),
    })
    if (market) {
      ordered.push({
        id: c.id,
        title: `${c.title} · ${market.name}`,
        kind: 'market',
        type,
        overline: overlineOf(KIND_LABELS.market, c.pageId),
        stage: c.stage,
        href: href(postPath(c.id), market.id),
        fromLine: null,
        linkedLines: [],
        changedLine: changedLine(c),
        liveLine: null,
        changedSincePublished: false,
        pageId: c.pageId,
        language: c.language,
        ...ownerOf(c),
      })
    }
    for (const s of children) ordered.push(socialItem(s, c))
  }

  function socialItem(s: BoardCard, parent: BoardCard | null): BoardItem {
    return {
      id: s.id,
      title: s.title,
      kind: 'social',
      type: 'social',
      overline: overlineOf(s.platform ? PLATFORM_LABELS[s.platform] : 'Social version', s.pageId),
      stage: s.stage,
      href: href(postPath(s.id)),
      fromLine: parent ? `↳ from feed post "${parent.title}"` : null,
      linkedLines: [],
      changedLine: changedLine(s),
      liveLine: s.liveLine,
      changedSincePublished: false,
      pageId: s.pageId,
      language: parent?.language ?? s.language,
      ...ownerOf(s),
    }
  }

  const filtered = ordered.filter((i) => matches(i, params, viewerId))
  const shown = filtered.filter((i) => inTab(params.filter, i))
  const pages = new Map<string, string>()
  for (const i of ordered) {
    const brand = i.pageId ? brandById(i.pageId) : null
    if (brand) pages.set(brand.id, brand.name)
  }
  return {
    columns: COLUMNS.map((col) => ({
      id: col.id,
      label: col.label,
      items: shown.filter((i) => columnOf(i.stage) === col.id),
    })),
    counts: {
      all: filtered.length,
      feed: filtered.filter((i) => inTab('feed', i)).length,
      social: filtered.filter((i) => inTab('social', i)).length,
      comics: filtered.filter((i) => inTab('comics', i)).length,
    },
    pages: [...pages]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    empty: shown.length === 0 && boardQuery(params) !== '',
  }
}
