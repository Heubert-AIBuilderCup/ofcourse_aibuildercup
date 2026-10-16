import { ChevronLeft, ListChecks, Newspaper } from 'lucide-react'
import Link from 'next/link'
import { AccountMenu } from '@/features/opening'
import { Duck } from '@/shared/components/Duck'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import { FEED_PATH } from '@/shared/lib/auth/gate'
import { SITE_NAME } from '@/shared/lib/site'
import { ROADMAPS_PATH } from '@/shared/lib/student-paths'
import { cn } from '@/shared/lib/utils'

const ACTION = 'h-11 gap-2 px-3.5 font-sans font-medium'

/**
 * The board's header: the wordmark with the duck, the breadcrumb back to her roadmaps with this
 * one's name (below 64rem only the way back; on a phone only its chevron), the tag, Feed and Your
 * answers (side by side only: stacked, they move to the controls bar) and onboarding's menu. Your
 * answers, here and in the menu, opens them over the board (`onAnswers`).
 */
export function RoadHeader({
  roadmapName,
  onAnswers,
}: {
  roadmapName: string
  onAnswers?: () => void
}) {
  return (
    <header className="relative z-40 flex min-h-16 items-center gap-4 border-b bg-background px-6 @max-5xl:min-h-14 @max-5xl:px-4">
      <span className="flex items-center gap-2 font-heading text-h4 font-semibold">
        <Duck size="1.75rem" eager className="size-7 object-contain @max-xl:hidden" />
        {SITE_NAME}
      </span>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
        <Link
          href={ROADMAPS_PATH}
          className={cn(buttonVariants({ variant: 'text' }), 'gap-1 px-2 font-semibold')}
        >
          <ChevronLeft aria-hidden="true" strokeWidth={1.5} className="size-icon-sm" />
          <span className="@max-xl:sr-only">Your roadmaps</span>
        </Link>
        <span aria-hidden="true" className="text-muted-foreground @max-5xl:hidden">
          /
        </span>
        <span
          aria-current="page"
          className="truncate font-heading text-lead font-semibold @max-5xl:hidden"
        >
          {roadmapName}
        </span>
      </nav>
      <span className="inline-flex min-h-7 items-center border border-dashed border-foreground/40 px-2.5 text-overline whitespace-nowrap text-muted-foreground uppercase @max-xl:hidden">
        Still exploring · rank when you’re ready
      </span>
      <div className="ml-auto flex gap-2 @max-5xl:hidden">
        <Link href={FEED_PATH} className={cn(buttonVariants({ variant: 'square' }), ACTION)}>
          <Newspaper aria-hidden="true" strokeWidth={1.5} className="size-icon" />
          Feed
        </Link>
        {onAnswers ? (
          <Button type="button" variant="square" className={ACTION} onClick={onAnswers}>
            <ListChecks aria-hidden="true" strokeWidth={1.5} className="size-icon" />
            Your answers
          </Button>
        ) : null}
      </div>
      <AccountMenu band={false} onAnswers={onAnswers} className="@max-5xl:ml-auto" />
    </header>
  )
}
