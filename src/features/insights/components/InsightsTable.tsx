import Link from 'next/link'
import { DIMENSION_LABELS, DIMENSIONS, type Dimension } from '@/features/engine'
import { tag } from '@/shared/components/classes'
import { buttonVariants } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import { FUTURE_IDS, type FutureId } from '@/shared/types/student'
import type { InsightRow, ShowingStats } from '../lib/rank'

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

/** The paths, most shown first, with each one's comic; "Make comic" for those who may make one. */
export function InsightsTable({ rows, canMake }: { rows: InsightRow[]; canMake: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {rows.some((r) => r.mock) && (
        <p className="text-caption text-muted-foreground">
          Counts marked mock are examples until real views build up.
        </p>
      )}
      <Card>
        <Table>
          <TableCaption className="sr-only">Paths by times shown</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Path</TableHead>
              <TableHead>Times shown</TableHead>
              <TableHead>Comic</TableHead>
              {canMake && (
                <TableHead>
                  <span className="sr-only">Make comic</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.path.id} className="*:align-top">
                <TableCell className="tabular-nums">{i + 1}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-2">
                    {r.path.label}
                    <PathDetails row={r} />
                  </div>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2 tabular-nums">
                    {r.count}
                    {r.mock && <span className={tag}>Mock</span>}
                  </span>
                </TableCell>
                <TableCell>
                  {r.status === 'none' ? (
                    <span className="text-muted-foreground">{STATUS_LABELS.none}</span>
                  ) : (
                    <span className={tag}>{STATUS_LABELS[r.status]}</span>
                  )}
                </TableCell>
                {canMake && (
                  <TableCell>
                    <Link
                      href={`/admin/comics/new?path=${encodeURIComponent(r.path.id)}`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      Make comic<span className="sr-only"> about {r.path.label}</span>
                    </Link>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
