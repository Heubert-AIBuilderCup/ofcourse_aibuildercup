import { z } from 'zod'
import { HOME_COUNTRIES } from '..'
import {
  ALL_INSTITUTIONS,
  ALL_TOPICS,
  type AudienceRule,
  INSTITUTIONS,
  type Match,
  TOPIC_IDS,
} from './audience'

// A targeted update's fields and their rules, pure: what the form sends, what the server keeps,
// the words for its kind, its status, its admin preview and its card on a student's feed, and the
// demo scholarship the form opens with.

export const UPDATE_KINDS = ['opportunity', 'rule_change', 'intake'] as const
export type UpdateKind = (typeof UPDATE_KINDS)[number]
export const UPDATE_STATUSES = ['draft', 'in_review', 'live'] as const
export type UpdateStatus = (typeof UPDATE_STATUSES)[number]

export const KIND_LABELS: Record<UpdateKind, string> = {
  opportunity: 'Opportunity',
  rule_change: 'Rule change',
  intake: 'Intake',
}
export const STATUS_WORDS: Record<UpdateStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  live: 'Live',
}

export const UPDATE_LIMITS = { category: 40, title: 120, body: 600, source: 200 } as const

export const UPDATE_ERRORS = {
  kind: 'Choose what kind of update this is.',
  category: `Give it a category, up to ${UPDATE_LIMITS.category} characters.`,
  institution: 'Choose an institution from the catalogue.',
  title: `Give it a title, up to ${UPDATE_LIMITS.title} characters.`,
  body: `Write what it says, up to ${UPDATE_LIMITS.body} characters.`,
  date: 'Give dates as a calendar date.',
  source: `Name its source, up to ${UPDATE_LIMITS.source} characters.`,
  audience: 'Choose who it reaches: an institution, a topic, and a home country or everyone.',
} as const

export type UpdateInput = {
  kind: UpdateKind
  category: string
  institution: string
  title: string
  body: string
  /** `YYYY-MM-DD`, or none. */
  applyBy: string | null
  sourceTitle: string
  /** `YYYY-MM-DD`. */
  sourceCheckedAt: string
  audience: AudienceRule
}

/** The demo scholarship (ADR-057: the scholarship in Updates targets ECU routes). */
export const DEMO_DRAFT: UpdateInput = {
  kind: 'opportunity',
  category: 'Scholarship',
  institution: 'ECU',
  title: 'ECU International Scholarship',
  body: '20% off tuition for the full course (mock) if you hold an offer for an ECU postgraduate course.',
  applyBy: '2026-11-30',
  sourceTitle: 'ECU international scholarships page',
  sourceCheckedAt: '2026-10-01',
  audience: { institution: 'ECU', homeCountry: null, topic: ALL_TOPICS },
}

const text = (max: number) => z.string().trim().min(1).max(max)
const day = z.iso.date()
/** A catalogue institution, or all of them (a rule change, a national grant). */
const institution = z.enum([ALL_INSTITUTIONS, ...INSTITUTIONS] as [string, ...string[]])
const FIELDS = [
  ['kind', z.enum(UPDATE_KINDS), UPDATE_ERRORS.kind],
  ['category', text(UPDATE_LIMITS.category), UPDATE_ERRORS.category],
  ['institution', institution, UPDATE_ERRORS.institution],
  ['title', text(UPDATE_LIMITS.title), UPDATE_ERRORS.title],
  ['body', text(UPDATE_LIMITS.body), UPDATE_ERRORS.body],
  [
    'applyBy',
    z.union([z.literal('').transform(() => null), z.null(), day]).default(null),
    UPDATE_ERRORS.date,
  ],
  ['sourceTitle', text(UPDATE_LIMITS.source), UPDATE_ERRORS.source],
  ['sourceCheckedAt', day, UPDATE_ERRORS.date],
  [
    'audience',
    z.object({
      institution,
      homeCountry: z.enum(HOME_COUNTRIES as [string, ...string[]]).nullable(),
      topic: z.enum([ALL_TOPICS, ...TOPIC_IDS]).default(ALL_TOPICS),
    }),
    UPDATE_ERRORS.audience,
  ],
] as const

/** The form's fields checked one by one, in the form's order; the first that fails is named. */
export function parseUpdateInput(
  input: unknown,
): { ok: true; value: UpdateInput } | { ok: false; error: string } {
  if (typeof input !== 'object' || input === null) return { ok: false, error: UPDATE_ERRORS.kind }
  const given = input as Record<string, unknown>
  const value: Record<string, unknown> = {}
  for (const [key, schema, error] of FIELDS) {
    const parsed = schema.safeParse(given[key])
    if (!parsed.success) return { ok: false, error }
    value[key] = parsed.data
  }
  return { ok: true, value: value as UpdateInput }
}

const students = (n: number) => `${n.toLocaleString('en-AU')} student${n === 1 ? '' : 's'}`

/** "Live · 1,920 students (mock)": the status in one word, and the mock students it reaches. */
export function updateStatusLine(status: UpdateStatus, reach: number): string {
  return status === 'live'
    ? `Live · ${students(reach)} (mock)`
    : `${STATUS_WORDS[status]} · reaches ${students(reach)} (mock)`
}

/** An update as stored: its fields, its id and where it is in review. */
export type StoredUpdate = UpdateInput & { id: string; status: UpdateStatus }

/** "30 Nov 2026" from `2026-11-30`. */
export const longDate = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

/** "Opportunity · Scholarship", "Impact · Rule change": what kind of news it is. */
export const overlineOf = (u: UpdateInput) =>
  u.kind === 'opportunity' ? `Opportunity · ${u.category}` : `Impact · ${KIND_LABELS[u.kind]}`

/**
 * The preview's words, for the admin looking at it: whose feed it is (a mock student), the badge
 * that marks her as matched, and why she sees it.
 */
export function previewWords(match: Match): { heading: string; badge: string; why: string } {
  const { name } = match.student
  return {
    heading: `Student preview · ${name} (mock student)`,
    badge: 'Matched student',
    why: `Why ${name} sees this: ${match.why}`,
  }
}

/** The card's words on her own feed: the badge that marks it as hers, and why she sees it. */
export function feedWords(why: string): { badge: string; why: string } {
  return { badge: 'For you', why: `Why you're seeing this: ${why}` }
}

/** What an update's card shows: its kind and category, who it is from, what it says, its source. */
export type CardUpdate = Pick<
  UpdateInput,
  | 'kind'
  | 'category'
  | 'institution'
  | 'title'
  | 'body'
  | 'applyBy'
  | 'sourceTitle'
  | 'sourceCheckedAt'
>
