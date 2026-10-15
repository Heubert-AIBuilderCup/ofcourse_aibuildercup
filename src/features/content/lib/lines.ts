// The one-line summaries a post's settings, review and send-back read as, on the board and in the
// workbench alike. Pure and client-safe: type-only imports from the model, nothing server-side.

import { formatWhen } from '@/shared/lib/site'
import type { Body } from '../model/artifacts'
import type { FeedSettings } from '../model/types'
import { tagById } from '../tags'

/** Mock audience sizes, always labelled "(mock)" where shown (criterion 53). */
export const AUDIENCE_COUNTS = { everyone: 18420, matched: 1284 } as const
export const MATCH_RULES = [
  'Destination: Australia',
  'Stage: before first year',
  'Work rights weight ≥ medium',
] as const
export const STUDIO_LINKS = ['Work rights weight', 'Compare view'] as const

export const LAYER_LABELS: Record<FeedSettings['layer'], string> = {
  general: 'General',
  featured: 'Featured',
  personal: 'Personal',
}

/** "18,420": the same digits on the server and in the browser. */
export const formatCount = (n: number): string => n.toLocaleString('en-GB')

/** A calendar date as the admin shows dates: "31 Mar 2027". */
const formatDay = (date: string): string => formatWhen(`${date}T00:00:00Z`).split(', ')[0]

const DAY_MS = 86_400_000

/**
 * When the post leaves the feed as epoch ms, or null for no expiry: the days counted from the
 * approval, or midnight UTC on the date. The feed and the live line agree through this.
 */
export function expiresAt(expiry: FeedSettings['expiry'], approvedAt: string): number | null {
  if (expiry.kind === 'none') return null
  if (expiry.kind === 'date') return Date.parse(`${expiry.date}T00:00:00Z`)
  return Date.parse(approvedAt) + expiry.days * DAY_MS
}

/**
 * The expiry as configured, or, once approved, as time left: days counted from the approval,
 * "tomorrow" on the last day, and the day it left once past.
 */
function expiryText(
  expiry: FeedSettings['expiry'],
  approvedAt: string | undefined,
  now: Date,
): string {
  if (expiry.kind === 'none') return 'No expiry'
  const ends = approvedAt === undefined ? null : expiresAt(expiry, approvedAt)
  if (expiry.kind === 'date') {
    const past = ends !== null && now.getTime() >= ends
    return `${past ? 'Left' : 'Leaves'} the feed on ${formatDay(expiry.date)}`
  }
  if (ends === null) return `Leaves the feed in ${expiry.days} days`
  const left = Math.ceil((ends - now.getTime()) / DAY_MS)
  if (left <= 0) return `Left the feed on ${formatWhen(ends).split(', ')[0]}`
  return left === 1 ? 'Leaves the feed tomorrow' : `Leaves the feed in ${left} days`
}

/**
 * "General · Everyone · Leaves the feed in 90 days" · "Personal · 1,284 matched students · No
 * expiry" · "… · Leaves the feed on 31 Mar 2027". Given the approval's time it counts down:
 * "… · Leaves the feed in 37 days", "… · Leaves the feed tomorrow", "… · Left the feed on 4 Jan 2027".
 */
export function liveLine(s: FeedSettings, approvedAt?: string, now: Date = new Date()): string {
  const audience =
    s.audience.mode === 'everyone'
      ? 'Everyone'
      : `${formatCount(AUDIENCE_COUNTS.matched)} matched students`
  return `${LAYER_LABELS[s.layer]} · ${audience} · ${expiryText(s.expiry, approvedAt, now)}`
}

/**
 * "India · Books and movies": the ticked tags' labels, or "For everyone" with none (criterion 80).
 * An id the tag file no longer has is skipped (criterion 92).
 */
export function tagsLine(s: FeedSettings): string {
  const labels = s.tags.flatMap((id) => tagById(id)?.label ?? [])
  return labels.length === 0 ? 'For everyone' : labels.join(' · ')
}

/** "Reviewed by Ravi K. · facts locked", plus " · self-reviewed" when it was. */
export function reviewLine(a: Body<'approval'>): string {
  const line = `Reviewed by ${a.by.name} · facts locked`
  return a.selfReviewed ? `${line} · self-reviewed` : line
}

/**
 * The sentence beside the "Changed" tag on a published post being worked on again, on the board
 * and in the workbench (criteria 116, 119).
 */
export const CHANGED_LINE = 'Changed since published. Students keep seeing the live version.'

/** "Changes requested by Ravi K. · 5 Oct 2026, 10:12: <reason>" (criterion 120). */
export function sendBackLine(s: Body<'send_back'>): string {
  return `Changes requested by ${s.by.name} · ${formatWhen(s.by.at)}: ${s.reason}`
}

/** The terse notes the render stage writes on a revision, spelt out for the history. */
const HISTORY_NOTES: Record<string, string> = {
  'light edit: phrase': 'Light edit',
  reorder: 'Slides reordered',
  'remove claim': 'Claim removed',
  'source wording': 'Source wording used',
}

/** What a saved version changed, in one line (criterion 101): its note in sentence case; "Saved" for a record written before notes. */
export function historyLine(note: string | null): string {
  if (note === null || note.trim() === '') return 'Saved'
  const known = HISTORY_NOTES[note]
  if (known) return known
  return note.charAt(0).toUpperCase() + note.slice(1)
}
