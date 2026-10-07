import type { ReactNode } from 'react'
import type { SealedRoute } from '@/features/engine'

/**
 * Every route is over her hard limit: the nearest roads, drawn sealed, each with how far over it
 * is, beside the budget and hard-limit chips. Never blank.
 */
export function SealedView({
  budgetK,
  nearest,
  chips,
}: {
  budgetK: number
  nearest: SealedRoute[]
  /** The budget and hard-limit chips, with their editor (ChipList). */
  chips: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="m-0 font-heading text-h3">Sealed at your hard limit</h2>
        <p className="m-0">
          {`Nothing in this preview fits AUD ${budgetK}k a year. The nearest roads:`}
        </p>
      </div>
      <ul className="m-0 grid list-none items-start gap-stack p-0 @min-[64rem]:grid-cols-3">
        {nearest.map((road) => (
          <li
            key={road.courseId}
            className="flex flex-col gap-1 border border-dashed border-foreground p-4 text-muted-foreground"
          >
            <p className="m-0 font-heading text-h4">{road.route}</p>
            <p className="m-0 text-caption">{`AUD ${road.overByK}k over your hard limit`}</p>
          </li>
        ))}
      </ul>
      {chips}
    </section>
  )
}
