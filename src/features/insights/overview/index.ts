// The Insights overview's mock figures (ADR-057: a static Insights screen; ADR-079: the evidence
// gaps): a repo file parsed at load, as content/markets/index.ts does. Every figure from here is
// labelled mock where it is shown. Client-safe: JSON and zod only.

import { z } from 'zod'
import { DIMENSIONS } from '@/features/engine'
import file from './overview.json'

const Share = z.number().min(0).max(100)
const Count = z.number().int().min(0)

export const EVIDENCE_STATES = ['none', 'weak', 'out_of_date', 'conflicting'] as const

const EvidenceGapSchema = z.object({
  claim: z.string().min(1),
  shown: z.string().min(1),
  evidence: z.object({ state: z.enum(EVIDENCE_STATES), note: z.string().min(1).optional() }),
  students: Count,
})
export type EvidenceGap = z.infer<typeof EvidenceGapSchema>

const PerformanceSchema = z.object({
  title: z.string().min(1),
  views: Count,
  saves: Count,
  completion: Share,
  intoStudio: Count,
})
export type PerformanceMock = z.infer<typeof PerformanceSchema>

const OverviewSchema = z.object({
  mock: z.literal(true),
  scope: z.object({ country: z.string().min(1), window: z.string().min(1), students: Count }),
  ai: z.object({ callsPerSession: z.number().min(0), costPerStudentWeekAud: z.number().min(0) }),
  evidenceGaps: z.array(EvidenceGapSchema).min(1),
  /** The share of students weighting each engine dimension high. */
  dimensions: z.object(
    Object.fromEntries(DIMENSIONS.map((d) => [d, Share])) as {
      [K in (typeof DIMENSIONS)[number]]: typeof Share
    },
  ),
  routes: z.array(z.object({ route: z.string().min(1), students: Count, firstShare: Share })),
  blockers: z.array(z.object({ label: z.string().min(1), share: Share })),
  performance: z.array(PerformanceSchema).min(1),
  updateReach: z.object({ title: z.string().min(1), matched: Count }),
})

export const OVERVIEW = OverviewSchema.parse(file)
