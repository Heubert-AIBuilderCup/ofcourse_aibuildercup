import type { ReactNode } from 'react'
import { AdminBand, AdminPageHeader } from '@/features/admin'
import { hairlineTable } from '@/shared/components/classes'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import { cn } from '@/shared/lib/utils'
import { barRows, cacheShare, dimensionBars, type PerformanceRow } from '../lib/overview'
import type { OVERVIEW } from '../overview'
import type { WeekFigures } from '../server/overview'
import { EvidenceGaps } from './EvidenceGaps'

const { table, head, body, th, tr, td } = hairlineTable
const caption = 'text-caption text-muted-foreground'
const n = (value: number) => value.toLocaleString('en-AU')

type Overview = typeof OVERVIEW

/**
 * The Insights overview: what is happening, read-only. Real where the app keeps the figures (the
 * week's renders and AI calls, the live posts' titles, an update's reach once one is live); every
 * other figure is the overview file's and says "mock".
 */
export function InsightsOverview({
  data,
  week,
  gaps,
  performance,
  livePosts,
  reach,
  editable,
}: {
  data: Overview
  week: WeekFigures
  gaps: Parameters<typeof EvidenceGaps>[0]['gaps']
  performance: PerformanceRow[]
  /** Whether the performance rows name real live posts (their figures are mock either way). */
  livePosts: boolean
  /** The latest live update's reach, or the mock one. */
  reach: { title: string; matched: number; mock: boolean }
  editable: boolean
}) {
  const reuse = cacheShare(week)
  const { scope } = data
  return (
    <div className="@container flex flex-col gap-block">
      <div className="flex flex-col gap-6">
        <AdminPageHeader
          kicker="Students, in aggregate"
          title="Insights"
          lede={`${scope.country} · ${scope.window} · ${n(scope.students)} students · aggregated (mock)`}
        />
        <AdminBand
          kicker="AI cost and reuse · 7 days"
          title={`AUD ${data.ai.costPerStudentWeekAud.toFixed(2)} per active student a week (mock)`}
          stats={[
            {
              value: String(data.ai.callsPerSession),
              label: 'AI calls per student a session (mock)',
            },
            {
              value: reuse === null ? '—' : `${reuse}%`,
              label:
                reuse === null
                  ? 'answered from the cache: no calls this week'
                  : 'answered from the cache, no new call',
            },
            { value: n(week.renders), label: 'renders a week' },
            { value: n(week.calls), label: 'AI calls a week' },
          ]}
        />
      </div>

      <Section
        id="insights-gaps"
        title="Evidence gaps (mock)"
        help={
          <>
            Claims shown with weak or no evidence, ranked by students who saw them. Students see
            "we're not sure about this yet".
          </>
        }
      >
        <EvidenceGaps gaps={gaps} editable={editable} />
        <p className={caption}>
          Attaching a source updates every future card and route that uses the claim. Research tasks
          also go to the Ideas queue.
        </p>
      </Section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(18rem,100%),1fr))] gap-block">
        <Section
          id="insights-dimensions"
          title="Most-weighted dimensions (mock)"
          help="Share of students weighting each one high"
        >
          <Bars rows={dimensionBars(data.dimensions).map((b) => ({ key: b.id, ...b }))} />
        </Section>
        <Section
          id="insights-routes"
          title="Most-ranked routes (mock)"
          help="Students with the route in their ranked list · ranked 1st"
        >
          <ol className="flex flex-col">
            {data.routes.map((r, i) => (
              <li
                key={r.route}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto_2.5rem] items-center gap-3 border-b py-2.5"
              >
                <span className="font-heading font-semibold text-muted-foreground">{i + 1}</span>
                <span>{r.route}</span>
                <span className="text-right font-heading font-semibold">{n(r.students)}</span>
                <span className="text-right text-muted-foreground">{`${r.firstShare}%`}</span>
              </li>
            ))}
          </ol>
        </Section>
        <Section
          id="insights-blockers"
          title="Why courses are not yet reachable (mock)"
          help="Share of sealed courses, by first blocker"
        >
          <Bars rows={barRows(data.blockers).map((b) => ({ key: b.label, ...b }))} />
        </Section>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(24rem,100%),1fr))] gap-block">
        <Section
          id="insights-performance"
          title="Content performance · portal feed"
          help={
            livePosts
              ? 'Live posts; views, saves and completion are mock.'
              : 'No post is live yet: mock rows.'
          }
        >
          <Table className={table}>
            <TableHeader className={head}>
              <TableRow className="hover:bg-transparent">
                <TableHead className={th}>Post</TableHead>
                <TableHead className={cn(th, 'text-right')}>Views</TableHead>
                <TableHead className={cn(th, 'text-right')}>Saves</TableHead>
                <TableHead className={cn(th, 'text-right')}>Completion</TableHead>
                <TableHead className={cn(th, 'text-right')}>Into the studio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={body}>
              {performance.map((row) => (
                <TableRow key={row.key} className={tr}>
                  <TableCell className={cn(td, 'font-heading font-semibold')}>
                    {row.title}
                  </TableCell>
                  <Num label="views">{n(row.views)}</Num>
                  <Num label="saves">{n(row.saves)}</Num>
                  <Num label="completion">{`${row.completion}%`}</Num>
                  <Num label="into the studio">{n(row.intoStudio)}</Num>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
        <Section
          id="insights-reach"
          title={`Update reach · ${reach.title}${reach.mock ? ' (mock)' : ''}`}
        >
          <div className="flex items-baseline justify-between gap-2 border-b py-2.5">
            <span>Matched</span>
            <span className="font-heading text-h3 font-semibold">{n(reach.matched)}</span>
          </div>
        </Section>
      </div>
    </div>
  )
}

/** A figure in the performance table; below @xl, where the head hides, it says what it counts. */
function Num({ label, children }: { label: string; children: string }) {
  return (
    <TableCell
      className={cn(td, 'text-right font-heading font-semibold tabular-nums @max-xl:text-left')}
    >
      {children}
      <span className="sr-only font-sans font-normal text-muted-foreground @max-xl:not-sr-only">{` ${label}`}</span>
    </TableCell>
  )
}

/** One part of the overview: its heading, a line on what it counts, and its content. No frame. */
function Section({
  id,
  title,
  help,
  children,
}: {
  id: string
  title: string
  help?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={id} className="text-h3 leading-tight font-semibold">
          {title}
        </h2>
        {help ? <p className={caption}>{help}</p> : null}
      </div>
      {children}
    </section>
  )
}

function Bars({ rows }: { rows: { key: string; label: string; share: number; width: string }[] }) {
  return (
    <ul className="flex flex-col">
      {rows.map((r) => (
        <li
          key={r.key}
          className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_2.75rem] items-center gap-3 py-1.5"
        >
          <span>{r.label}</span>
          <span className="relative h-2 bg-foreground/8">
            <span className="absolute inset-y-0 left-0 bg-accent-600" style={{ width: r.width }} />
          </span>
          <span className="text-right font-heading font-semibold">{`${r.share}%`}</span>
        </li>
      ))}
    </ul>
  )
}
