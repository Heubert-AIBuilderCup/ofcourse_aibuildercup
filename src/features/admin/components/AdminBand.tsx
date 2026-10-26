import { Duck } from '@/shared/components/Duck'
import motion from '@/shared/components/motion.module.css'
import { cn } from '@/shared/lib/utils'

/** One of the band's numbers and what it counts; with `onSelect` it is a button. */
export type BandStat = { value: number | string; label: string; onSelect?: () => void }

const STAT =
  'flex min-w-38 flex-col items-start justify-center gap-0.5 border border-panel-foreground/45 bg-panel-foreground/6 px-4 py-2.5 text-left text-panel-foreground @max-xl:min-w-0 @max-xl:px-2.5 @max-xl:py-2'

/**
 * The blue band that opens most admin screens: the student app's brand panel (bg-panel and the
 * grid paper of motion.grid), marked light so it keeps its look in a dark page, as SignInPanel
 * does. A kicker line over the title, the duck where the screen has one, and up to four numbers
 * on the right, each a button when pressing it does something (a client component passes
 * `onSelect`). Below @xl the numbers take their own row under the title.
 */
export function AdminBand({
  kicker,
  title,
  stats = [],
  duck = false,
}: {
  kicker: string
  title: string
  stats?: BandStat[]
  duck?: boolean
}) {
  return (
    <section
      data-theme="light"
      className={cn(
        motion.grid,
        'relative flex flex-wrap items-center gap-x-8 gap-y-6 overflow-hidden px-7 py-6 text-panel-foreground @max-xl:gap-3.5 @max-xl:p-4',
      )}
    >
      {duck ? (
        <Duck
          size="3.5rem"
          className="relative size-14 shrink-0 -scale-x-100 object-contain drop-shadow-md @max-xl:size-10"
        />
      ) : null}
      <div className="relative flex min-w-56 flex-col gap-1 @max-xl:min-w-0 @max-xl:flex-1">
        <p className="font-heading text-caption font-medium tracking-widest text-panel-foreground uppercase dark:text-panel-foreground/78">
          {kicker}
        </p>
        <h2 className="font-heading text-h2 leading-tight font-semibold text-panel-foreground">
          {title}
        </h2>
      </div>
      {stats.length > 0 ? (
        <div className="relative ml-auto flex flex-wrap items-stretch gap-3 @max-xl:ml-0 @max-xl:grid @max-xl:w-full @max-xl:grid-cols-[repeat(auto-fit,minmax(min(6rem,100%),1fr))] @max-xl:gap-2">
          {stats.map((s) => {
            // The space keeps the number and its words apart in the button's name.
            const inner = (
              <>
                <span className="font-heading text-h2 leading-none font-semibold">{s.value}</span>{' '}
                <span className="text-caption text-panel-foreground dark:text-panel-foreground/78">
                  {s.label}
                </span>
              </>
            )
            return s.onSelect ? (
              <button
                key={s.label}
                type="button"
                onClick={s.onSelect}
                className={cn(
                  STAT,
                  'cursor-pointer hover:border-panel-foreground hover:bg-panel-foreground/16 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-panel-foreground motion-safe:transition motion-safe:hover:-translate-y-0.5',
                )}
              >
                {inner}
              </button>
            ) : (
              <div key={s.label} className={STAT}>
                {inner}
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
