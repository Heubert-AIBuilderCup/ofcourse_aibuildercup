import type { Ref } from 'react'
import { Button } from '@/shared/components/ui/button'

/**
 * A panel's head in the card column: its kicker and title, and Close when it has one. With
 * `titleRef`, the title takes focus from code (never from Tab), for a panel that swaps its view.
 */
export function PanelHead({
  kicker,
  title,
  titleRef,
  onClose,
}: {
  kicker?: string
  title: string
  titleRef?: Ref<HTMLHeadingElement>
  onClose?: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        {kicker ? (
          <p className="m-0 text-overline text-muted-foreground uppercase">{kicker}</p>
        ) : null}
        <h2
          ref={titleRef}
          tabIndex={titleRef ? -1 : undefined}
          className="m-0 text-h3 leading-tight outline-none"
        >
          {title}
        </h2>
      </div>
      {onClose ? (
        <Button
          type="button"
          variant="square"
          onClick={onClose}
          className="h-11 shrink-0 px-3.5 font-sans font-medium"
        >
          Close
        </Button>
      ) : null}
    </div>
  )
}
