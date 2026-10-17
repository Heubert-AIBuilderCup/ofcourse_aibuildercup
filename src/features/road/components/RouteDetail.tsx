import Link from 'next/link'
import type { CardDetails as Details } from '@/features/roads/client'
import { Duck } from '@/shared/components/Duck'
import { buttonVariants } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { useBoardPath } from '../hooks/useBoardPath'
import type { Road, Tile } from '../model/road-data'
import { routePath } from '../model/routes'
import type { Scene } from '../model/scene'
import { CardDetails } from './CardDetails'
import { MockTag } from './MockTag'

/**
 * A route step's detail over the board (`<board>/route/<route-id>`): when it is, the guide's words
 * for it and why it is on her road; what the road knows of it (the visa's facts and conditions,
 * the work and jobs it opens, whether its occupation is on the state's list); then the route
 * ahead, step by step with when each is, this one marked and every other step a link to its own
 * detail; and the way back to the roadmap.
 */
export function RouteDetail({
  step,
  road,
  scene,
  details,
}: {
  step: Tile
  road: Road
  scene: Scene
  details?: Details
}) {
  const board = useBoardPath()
  const copy = road.cards[step.id]
  const when = step.when ?? copy?.sub
  const ahead = scene.ahead
    .map((id) => scene.tiles.find((t) => t.id === id))
    .filter((t): t is Tile => !!t)

  return (
    <section aria-label={step.name} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="m-0 text-overline text-muted-foreground uppercase">
          Route detail{when ? ` · ${when}` : ''}
        </p>
        <h2 className="m-0 text-h2 leading-none">{step.name}</h2>
      </div>

      {copy?.guide ? (
        <div className="flex flex-col gap-2 border bg-muted p-4">
          <p className="m-0 flex items-center gap-2 text-overline text-muted-foreground uppercase">
            <Duck size="1.75rem" className="size-7 object-contain" />
            Your guide
          </p>
          <p className="m-0">{copy.guide}</p>
          <p className="m-0 flex items-center gap-1 text-caption text-muted-foreground">
            Source: OfCourse preview data ·
            <MockTag />
          </p>
        </div>
      ) : null}
      {copy?.because ? (
        <p className="m-0">
          <span className="text-muted-foreground">On your board because:</span> {copy.because}
        </p>
      ) : null}

      {details ? <CardDetails details={details} /> : null}

      <section className="flex flex-col gap-2">
        <h3
          id={`${step.id}-ahead`}
          className="m-0 font-sans text-overline font-normal text-muted-foreground uppercase"
        >
          The route ahead
        </h3>
        <ol aria-labelledby={`${step.id}-ahead`} className="m-0 flex list-none flex-col p-0">
          {ahead.map((t) => {
            const current = t.id === step.id
            const words = (
              <>
                <span className="font-medium">{t.name}</span>
                {t.when ? (
                  <span className="block text-caption text-muted-foreground">{t.when}</span>
                ) : null}
              </>
            )
            return (
              <li
                key={t.id}
                aria-current={current ? 'step' : undefined}
                className="border-t border-l-4 border-l-transparent aria-[current=step]:border-l-brand aria-[current=step]:bg-muted"
              >
                {t.routeId && !current ? (
                  <Link
                    href={routePath(board, t.routeId)}
                    className="block px-3 py-2.5 hover:bg-muted"
                  >
                    {words}
                  </Link>
                ) : (
                  <span className="block px-3 py-2.5">{words}</span>
                )}
              </li>
            )
          })}
        </ol>
      </section>

      <Link href={board} className={cn(buttonVariants({ variant: 'outline' }), 'self-start')}>
        Back to your roadmap
      </Link>
    </section>
  )
}
