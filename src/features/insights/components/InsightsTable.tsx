import { PanelsTopLeft } from 'lucide-react'
import Link from 'next/link'
import { AdminBand } from '@/features/admin'
import { DIMENSION_LABELS, DIMENSIONS, type Dimension } from '@/features/engine'
import { hairlineTable, tag } from '@/shared/components/classes'
import { buttonVariants } from '@/shared/components/ui/button'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import { cn } from '@/shared/lib/utils'
import { FUTURE_IDS, type FutureId } from '@/shared/types/student'
import type { InsightRow, ShowingStats } from '../lib/rank'

const { table, head, body, th, tr, td } = hairlineTable

const STATUS_LABELS: Record<InsightRow['status'], string> = {
  none: 'None',
  in_progress: 'In progress',
  live: 'Live',
}

/** The futures a path can be shown as, by what each is built around (the futures screen's "Built around cost"). */
const FUTURE_LABELS: Record<FutureId, string> = {
  cost: 'Cost',
  staying: 'Staying',
  career: 'Career',
}

const times = (n: number) => `${n} ${n === 1 ? 'time' : 'times'}`

/** The band's title: how many paths still have no comic. */
function gapsTitle(rows: InsightRow[]): string {
  const none = rows.filter((r) => r.status === 'none').length
  if (none === 0) return 'Every path has a comic'
  return `${none} ${none === 1 ? 'path has' : 'paths have'} no comic yet`
}

/** The dimensions seen, largest share first, as "Cost 80% · Time 40%"; "None" when none was. */
function shares(byDimension: Record<Dimension, number>): string {
  const seen = DIMENSIONS.filter((dim) => byDimension[dim] > 0).sort(
    (a, b) => byDimension[b] - byDimension[a],
  )
  if (seen.length === 0) return 'None'
  return seen.map((dim) => `${DIMENSION_LABELS[dim]} ${byDimension[dim]}%`).join(' · ')
}

/** One fact of the details: its name, then its value. */
function Fact({ term, children }: { term: string; children: string }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-muted-foreground">{term}</dt> <dd>{children}</dd>
    </div>
  )
}

/** How the path was shown (RC18), from recorded showings only. */
function Showing({ showing }: { showing: ShowingStats }) {
  const { count, avgOverK } = showing.outOfReach
  return (
    <div className="flex flex-col gap-2">
      <p>{`Shown ${times(showing.showings)} in the last 30 days`}</p>
      <dl className="flex flex-col gap-1">
        <Fact term="As a future">
          {FUTURE_IDS.map((id) => `${FUTURE_LABELS[id]} ${showing.byFuture[id]}`).join(' · ')}
        </Fact>
        <Fact term="Strong on, of the times it was shown as a future">
          {shares(showing.strongOn)}
        </Fact>
        <Fact term="Costs on, of the times it was shown as a future">
          {shares(showing.costsOn)}
        </Fact>
        <Fact term="Out of reach">
          {count === 0
            ? 'Never'
            : `${times(count)}, AUD ${avgOverK}k over the hard limit on average`}
        </Fact>
      </dl>
    </div>
  )
}

/** A path's "Details", closed by default: how it was shown, or that it was not, and its lines. */
function PathDetails({ row }: { row: InsightRow }) {
  return (
    <details aria-label={`Details of ${row.path.label}`}>
      <summary className="cursor-pointer font-heading text-caption text-muted-foreground hover:text-foreground">
        Details
      </summary>
      <div className="mt-4 flex max-w-prose flex-col gap-4 text-caption whitespace-normal">
        {row.showing ? (
          <Showing showing={row.showing} />
        ) : (
          <p className="text-muted-foreground">Not shown to students yet</p>
        )}
        {row.lines.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-overline uppercase text-muted-foreground">Lines students see</p>
            <dl className="flex flex-col gap-1">
              {row.lines.map((line) => (
                <Fact key={line.dim} term={DIMENSION_LABELS[line.dim]}>
                  {line.text}
                </Fact>
              ))}
            </dl>
          </div>
        )}
      </div>
    </details>
  )
}

/**
 * The paths, most shown first, with each one's comic; "Make comic" for those who may make one. The
 * band above counts the paths still without a comic, the times they were shown and the comics
 * made (live), and says when the counts are mock.
 */
export function InsightsTable({ rows, canMake }: { rows: InsightRow[]; canMake: boolean }) {
  const shown = rows.reduce((sum, r) => sum + r.count, 0)
  const made = rows.filter((r) => r.status === 'live').length
  const most = Math.max(0, ...rows.map((r) => r.count))
  return (
    <div className="flex flex-col gap-6">
      <AdminBand
        kicker="Last 30 days"
        title={gapsTitle(rows)}
        duck
        stats={[
          {
            value: shown.toLocaleString('en-AU'),
            label: shown === 1 ? 'time shown' : 'times shown',
          },
          { value: made, label: made === 1 ? 'comic made' : 'comics made' },
          ...(rows.some((r) => r.mock)
            ? [{ value: 'Mock', label: 'counts until real views build up' }]
            : []),
        ]}
      />
      <Table className={table}>
        <TableCaption className="sr-only">Paths by times shown</TableCaption>
        <TableHeader className={head}>
          <TableRow className="hover:bg-transparent">
            <TableHead className={th}>Rank</TableHead>
            <TableHead className={th}>Path</TableHead>
            <TableHead className={th}>Times shown</TableHead>
            <TableHead className={th}>Comic</TableHead>
            {canMake && (
              <TableHead className={th}>
                <span className="sr-only">Make comic</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody className={body}>
          {rows.map((r, i) => (
            <TableRow key={r.path.id} className={cn(tr, '*:align-top')}>
              <TableCell
                className={cn(
                  td,
                  'w-12 font-heading font-semibold text-muted-foreground tabular-nums',
                )}
              >
                {i + 1}
              </TableCell>
              <TableCell className={td}>
                <div className="flex flex-col gap-2">
                  <span className="font-heading text-h4 leading-tight font-semibold">
                    {r.path.label}
                  </span>
                  <PathDetails row={r} />
                </div>
              </TableCell>
              <TableCell className={td}>
                <span className="flex min-w-48 items-center gap-3 tabular-nums">
                  <span className="relative h-2 flex-1 bg-foreground/8">
                    <span
                      data-bar
                      className="absolute inset-y-0 left-0 bg-accent-600"
                      style={{ width: `${most === 0 ? 0 : Math.round((r.count / most) * 100)}%` }}
                    />
                  </span>
                  <span className="min-w-8 font-heading font-semibold">{r.count}</span>
                  {r.mock && <span className={tag}>Mock</span>}
                </span>
              </TableCell>
              <TableCell className={td}>
                {r.status === 'none' ? (
                  <span className="text-muted-foreground">{STATUS_LABELS.none}</span>
                ) : (
                  <span className={tag}>{STATUS_LABELS[r.status]}</span>
                )}
              </TableCell>
              {canMake && (
                <TableCell className={td}>
                  <Link
                    href={`/admin/comics/new?path=${encodeURIComponent(r.path.id)}`}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    <PanelsTopLeft aria-hidden="true" strokeWidth={1.5} className="size-icon-sm" />
                    Make comic<span className="sr-only"> about {r.path.label}</span>
                  </Link>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
