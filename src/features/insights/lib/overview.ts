import { DIMENSION_LABELS, DIMENSIONS, type Dimension } from '@/features/engine'
import type { MockStudent } from '@/features/updates'
import { type AudienceRule, matchAudience } from '@/features/updates/lib/audience'
import type { EvidenceGap, PerformanceMock } from '../overview'

// The Insights overview's shaping, pure: the evidence gaps ranked by the students who saw each
// claim, their evidence tags, the bars' order and widths, the share of AI calls the cache
// answered, and the performance table's rows.

/** The claims ranked by the students who saw each, most first, numbered from 1 (ADR-079). */
export function rankEvidenceGaps(gaps: readonly EvidenceGap[]): (EvidenceGap & { rank: number })[] {
  return [...gaps]
    .sort((a, b) => b.students - a.students)
    .map((gap, i) => ({ ...gap, rank: i + 1 }))
}

const EVIDENCE_WORDS: Record<EvidenceGap['evidence']['state'], string> = {
  none: 'No source',
  weak: 'Weak',
  out_of_date: 'Out of date',
  conflicting: 'Conflicting',
}

/** "Weak · one 2024 listings sample": the state, then its note when it has one. */
export function evidenceTag(evidence: EvidenceGap['evidence']): string {
  const word = EVIDENCE_WORDS[evidence.state]
  return evidence.note ? `${word} · ${evidence.note}` : word
}

/** Bars, most first, each as wide as its share of the track, held to 0–100%. */
export function barRows<T extends { share: number }>(
  rows: readonly T[],
): (T & { width: string })[] {
  return [...rows]
    .sort((a, b) => b.share - a.share)
    .map((row) => ({ ...row, width: `${Math.min(100, Math.max(0, row.share))}%` }))
}

/** The engine's dimensions by their labels, ordered by the share of students weighting each high. */
export function dimensionBars(shares: Record<Dimension, number>) {
  return barRows(DIMENSIONS.map((d) => ({ id: d, label: DIMENSION_LABELS[d], share: shares[d] })))
}

/** The whole-number share of AI calls the cache answered, with no new call; none with no calls. */
export function cacheShare({ calls, cached }: { calls: number; cached: number }): number | null {
  return calls === 0 ? null : Math.round((cached / calls) * 100)
}

export type PerformanceRow = Omit<PerformanceMock, 'title'> & { key: string; title: string }

/**
 * The portal feed's table: the real live posts' titles beside the mock figures, by order, as many
 * as there are figures; the mock rows themselves when no post is live.
 */
export function performanceRows(
  live: readonly { id: string; title: string }[],
  mock: readonly PerformanceMock[],
): PerformanceRow[] {
  if (live.length === 0) return mock.map((m, i) => ({ ...m, key: `mock-${i}` }))
  return live
    .slice(0, mock.length)
    .map((post, i) => ({ ...mock[i], key: post.id, title: post.title }))
}

/**
 * "Update reach": the latest live update's title and the mock students its rule matches; the
 * overview file's mock reach while no update is live.
 */
export function updateReach(
  latest: { title: string; audience: AudienceRule } | null,
  fallback: { title: string; matched: number },
  students: readonly MockStudent[],
): { title: string; matched: number } {
  if (!latest) return fallback
  return { title: latest.title, matched: matchAudience(latest.audience, students).length }
}
