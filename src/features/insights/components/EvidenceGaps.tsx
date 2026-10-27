import Link from 'next/link'
import { ideaPostHref } from '@/features/content/lib/idea-start'
import { hairlineTable } from '@/shared/components/classes'
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
import { evidenceTag } from '../lib/overview'
import type { EvidenceGap } from '../overview'

const { table, head, body, th, tr, td } = hairlineTable

/**
 * Evidence gaps (ADR-079): claims students are shown with weak or no evidence, ranked by the
 * students who saw each. An editor's "Research this" opens New post started from the claim, the
 * Ideas queue's own path (lib/idea-start.ts). One row per claim, in the admin's hairline table.
 */
export function EvidenceGaps({
  gaps,
  editable,
}: {
  gaps: (EvidenceGap & { rank: number })[]
  editable: boolean
}) {
  return (
    <Table className={table}>
      <TableCaption className="sr-only">Evidence gaps by students who saw the claim</TableCaption>
      <TableHeader className={head}>
        <TableRow className="hover:bg-transparent">
          <TableHead className={th}>#</TableHead>
          <TableHead className={th}>Claim</TableHead>
          <TableHead className={th}>Where it's shown</TableHead>
          <TableHead className={th}>Evidence</TableHead>
          <TableHead className={cn(th, 'text-right')}>Students who saw it</TableHead>
          {editable && (
            <TableHead className={th}>
              <span className="sr-only">Research this</span>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody className={body}>
        {gaps.map((gap) => (
          <TableRow key={gap.claim} className={tr}>
            <TableCell
              className={cn(
                td,
                'w-12 font-heading font-semibold text-muted-foreground tabular-nums',
              )}
            >
              {gap.rank}
            </TableCell>
            <TableCell
              className={cn(td, 'font-heading font-semibold')}
            >{`“${gap.claim}”`}</TableCell>
            <TableCell className={cn(td, 'text-caption')}>{gap.shown}</TableCell>
            <TableCell className={td}>
              <span
                className={cn(
                  'inline-flex border px-2 py-0.5 text-caption whitespace-nowrap',
                  gap.evidence.state === 'none'
                    ? 'border-destructive text-destructive'
                    : 'border-dashed border-foreground/30',
                )}
              >
                {evidenceTag(gap.evidence)}
              </span>
            </TableCell>
            <TableCell
              className={cn(
                td,
                'text-right font-heading text-h4 font-semibold tabular-nums @max-xl:text-left',
              )}
            >
              {gap.students.toLocaleString('en-AU')}
              <span className="sr-only"> students saw it</span>
            </TableCell>
            {editable && (
              <TableCell className={cn(td, 'text-right @max-xl:text-left')}>
                <Link
                  href={ideaPostHref({ text: gap.claim })}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  Research this
                </Link>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
