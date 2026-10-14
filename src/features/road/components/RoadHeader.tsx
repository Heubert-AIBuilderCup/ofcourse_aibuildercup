import { Columns2, MessageCircle } from 'lucide-react'
import { AccountMenu } from '@/features/opening'
import { Duck } from '@/shared/components/Duck'
import { Button } from '@/shared/components/ui/button'
import { SITE_NAME } from '@/shared/lib/site'

const ACTION = 'h-11 gap-2 px-3.5 font-sans font-medium'

/**
 * The board's header: the wordmark with the duck, the tag, "Ask · 1" and "Compare" (side by side
 * only: stacked, they move to the controls bar) and onboarding's menu. Ask and Compare do nothing
 * this round.
 */
export function RoadHeader() {
  return (
    <header className="relative z-40 flex min-h-16 items-center gap-4 border-b bg-background px-6 @max-5xl:min-h-14 @max-5xl:px-4">
      <span className="flex items-center gap-2 font-heading text-h4 font-semibold">
        <Duck size="1.75rem" eager className="size-7 object-contain @max-xl:hidden" />
        {SITE_NAME}
      </span>
      <span className="inline-flex min-h-7 items-center border border-dashed border-foreground/40 px-2.5 text-overline whitespace-nowrap text-muted-foreground uppercase @max-xl:hidden">
        Still exploring · rank when you’re ready
      </span>
      <div className="ml-auto flex gap-2 @max-5xl:hidden">
        <Button type="button" variant="square" className={ACTION}>
          <MessageCircle aria-hidden="true" strokeWidth={1.5} className="size-icon" />
          Ask · 1
        </Button>
        <Button type="button" variant="square" className={ACTION}>
          <Columns2 aria-hidden="true" strokeWidth={1.5} className="size-icon" />
          Compare
        </Button>
      </div>
      <AccountMenu band={false} className="@max-5xl:ml-auto" />
    </header>
  )
}
