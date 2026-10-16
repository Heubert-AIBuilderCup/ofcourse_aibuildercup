import { Button } from '@/shared/components/ui/button'
import type { Overview as OverviewData } from '../model/road-data'
import { PanelHead } from './PanelHead'

/** Whole road's card: how much of the road she has looked at, and "Back to the walk" (Level). */
export function Overview({ overview, onBack }: { overview: OverviewData; onBack: () => void }) {
  const { looked, total } = overview
  return (
    <section aria-label="Overview" className="flex flex-col gap-4">
      <PanelHead kicker="Overview · Whole road" title={overview.title} />
      <div
        role="img"
        aria-label={`${looked} of ${total} routes looked at`}
        className="h-2 bg-neutral-300"
      >
        <i
          className="block h-full bg-accent-600"
          style={{ width: `${Math.round((looked / total) * 100)}%` }}
        />
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {overview.rows.map((row) => (
          <li key={row} className="border-t py-3">
            {row}
          </li>
        ))}
      </ul>
      <p className="m-0 text-sm text-muted-foreground">{overview.note}</p>
      <Button type="button" variant="outline" className="h-12 w-full" onClick={onBack}>
        Back to the walk
      </Button>
    </section>
  )
}
