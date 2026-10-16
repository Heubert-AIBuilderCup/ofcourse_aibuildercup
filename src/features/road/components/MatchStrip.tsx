import { cn } from '@/shared/lib/utils'
import type { MatchLine } from '../model/match-line'
import { MockTag } from './MockTag'
import styles from './road-map.module.css'

// The roadmaps list's dashed chip, for an answer the road differs from, in the map's ink.
const CHIP = 'border border-dashed border-panel-foreground/55 px-2 py-0.5 text-caption leading-snug'

/**
 * Why this road, over the map's top left under its button: "Closest road to your answers" with a
 * chip per answer the road differs from, or the illustrative road's line; then mock. In the key
 * strip's look; on a phone it spans the map under the top controls.
 */
export function MatchStrip({ line, id }: { line: MatchLine; id?: string }) {
  return (
    <div
      id={id}
      role="note"
      aria-label="Why this road"
      data-map-control
      className={cn(
        styles.key,
        'absolute top-18 left-4 z-30 flex max-w-md flex-col gap-2 p-3 text-panel-foreground',
        '@max-xl:top-16 @max-xl:right-3 @max-xl:left-3 @max-xl:max-w-none',
      )}
    >
      <p className="text-caption">{line.title}</p>
      {line.chips.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {line.chips.map((chip) => (
            <li key={chip} className={CHIP}>
              {chip}
            </li>
          ))}
        </ul>
      ) : null}
      <MockTag className="self-start border-panel-foreground/60" />
    </div>
  )
}
