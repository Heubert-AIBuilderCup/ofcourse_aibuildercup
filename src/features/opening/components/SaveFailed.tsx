import { CircleAlert } from 'lucide-react'
import motion from '@/shared/components/motion.module.css'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

/**
 * A save that failed, said where it happened. With `onRetry` the alert carries its own Try again
 * (held while `pending`); without it, the screen's own action retries (step 00's Continue).
 */
export function SaveFailed({
  message,
  onRetry,
  pending,
}: {
  message: string
  onRetry?: () => void
  pending?: boolean
}) {
  return (
    <div
      role="alert"
      className={cn(
        motion.errorIn,
        onRetry ? 'flex flex-wrap items-center gap-x-2.5 gap-y-2' : 'flex items-start gap-2',
        'border border-danger-300 bg-danger-100 px-3.5 py-2.5 text-caption text-danger-800',
      )}
    >
      <CircleAlert
        aria-hidden="true"
        className={cn(!onRetry && 'icon-on-line', 'size-icon shrink-0 text-danger-700')}
      />
      <span className={onRetry ? 'min-w-45 flex-1' : undefined}>{message}</span>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onRetry}
          className="h-11 border-danger-300 px-3.5 text-danger-800 hover:bg-danger-200 hover:text-danger-800"
        >
          Try again
        </Button>
      ) : null}
    </div>
  )
}
