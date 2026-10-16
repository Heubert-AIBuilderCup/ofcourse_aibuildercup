import Link from 'next/link'
import { ideaPostHref } from '@/features/content/lib/idea-start'
import { buttonVariants } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { evidenceTag } from '../lib/overview'
import type { EvidenceGap } from '../overview'

const head = 'text-overline text-muted-foreground uppercase'
const row =
  'grid gap-x-4 gap-y-1 py-2 @5xl:grid-cols-[2rem_minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] @5xl:items-center'

/**
 * Evidence gaps (ADR-079): claims students are shown with weak or no evidence, ranked by the
 * students who saw each. An editor's "Research this" opens New post started from the claim, the
 * Ideas queue's own path (lib/idea-start.ts). One row per claim; the columns stack below @5xl.
 */
export function EvidenceGaps({
  gaps,
  editable,
}: {
  gaps: (EvidenceGap & { rank: number })[]
  editable: boolean
}) {
  return (
    <div className="flex flex-col">
      <div className={cn(row, 'hidden border-b @5xl:grid')} aria-hidden="true">
        <span className={head}>#</span>
        <span className={head}>Claim</span>
        <span className={head}>Where it's shown</span>
        <span className={head}>Evidence</span>
        <span className={cn(head, '@5xl:text-right')}>Students who saw it</span>
        <span />
      </div>
      <ol className="flex flex-col">
        {gaps.map((gap) => (
          <li key={gap.claim} className={cn(row, 'border-b')}>
            <span className="text-caption text-muted-foreground">{gap.rank}</span>
            <span className="font-heading font-semibold">{`“${gap.claim}”`}</span>
            <span className="text-caption">{gap.shown}</span>
            <span>
              <span
                className={cn(
                  'border px-1.5 text-caption',
                  gap.evidence.state === 'none'
                    ? 'border-destructive text-destructive'
                    : 'text-muted-foreground',
                )}
              >
                {evidenceTag(gap.evidence)}
              </span>
            </span>
            <span className="font-heading text-h4 @5xl:text-right">
              {gap.students.toLocaleString('en-AU')}
              <span className="sr-only"> students saw it</span>
            </span>
            <span className="@5xl:text-right">
              {editable && (
                <Link
                  href={ideaPostHref({ text: gap.claim })}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  Research this
                </Link>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
