import { cn } from '@/shared/lib/utils'

/** Screens 1–6: the four opening screens, the futures and the coins. */
export const SCREEN_COUNT = 6
const SEGMENTS = Array.from({ length: SCREEN_COUNT }, (_, i) => i + 1)

/** The six segments, the first `step` filled (criterion 22). */
export function Progress({ step }: { step: number }) {
  return (
    <div
      role="progressbar"
      aria-label={`Step ${step} of ${SCREEN_COUNT}`}
      aria-valuemin={1}
      aria-valuemax={SCREEN_COUNT}
      aria-valuenow={step}
      className="grid max-w-2xl grid-cols-6 gap-1"
    >
      {SEGMENTS.map((n) => (
        <span key={n} className={cn('h-1', n <= step ? 'bg-primary' : 'bg-accent-200')} />
      ))}
    </div>
  )
}
