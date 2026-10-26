import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import styles from './road-map.module.css'

/** A small isometric tile, 30 × 20, its faces `drop` deep, `y` down from the top. */
function Faces({ drop = 3.5, y = 0 }: { drop?: number; y?: number }) {
  const at = (pts: number[][]) => pts.map(([x, py]) => `${x},${py + y}`).join(' ')
  return (
    <>
      <polygon
        className={styles.left}
        points={at([
          [2, 8],
          [15, 14.5],
          [15, 14.5 + drop],
          [2, 8 + drop],
        ])}
      />
      <polygon
        className={styles.right}
        points={at([
          [15, 14.5],
          [28, 8],
          [28, 8 + drop],
          [15, 14.5 + drop],
        ])}
      />
      <polygon
        className={styles.top}
        points={at([
          [15, 1.5],
          [28, 8],
          [15, 14.5],
          [2, 8],
        ])}
      />
    </>
  )
}

/** A swatch: one tile in a state's fills, three stacked, or a small one (a job). */
function Swatch({
  state,
  stacked = false,
  small = false,
}: {
  state: 'lit' | 'alt' | 'fog'
  stacked?: boolean
  small?: boolean
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox={stacked ? '0 0 30 22' : '0 0 30 20'}
      className="h-5.5 w-7.5 flex-none overflow-visible"
    >
      {stacked ? (
        [5, 2, 0].map((y) => (
          <g key={y} className={styles.tile} data-state={state}>
            <Faces drop={2} y={y} />
          </g>
        ))
      ) : (
        <g
          className={styles.tile}
          data-state={state}
          transform={small ? 'translate(5 3.5) scale(0.66)' : undefined}
        >
          <Faces />
        </g>
      )}
    </svg>
  )
}

const LINES = [
  { label: 'On your roadmap', state: 'lit' },
  { label: 'Other options', state: 'alt' },
  { label: 'More to look at', state: 'alt', stacked: true },
  { label: 'Jobs it leads to', state: 'alt', small: true },
  { label: 'Ahead, not open yet', state: 'fog' },
] as const

/**
 * How to read the map, in one strip over its top left: the five kinds of tile, drawn as the map
 * draws them, and Got it. On her first visit it shows by itself; Map key shows and hides it. On a
 * phone it sits under the top controls, two columns with Got it beside every row.
 */
export function KeyStrip({ onClose, className }: { onClose: () => void; className?: string }) {
  return (
    <div
      role="note"
      aria-label="How to read the map"
      data-map-control
      className={cn(
        styles.key,
        'absolute top-4 left-4 z-30 flex items-center gap-x-3 gap-y-1 py-1 pr-1 pl-2.5 text-caption whitespace-nowrap',
        '@max-xl:top-26 @max-xl:right-3 @max-xl:left-3 @max-xl:grid @max-xl:grid-cols-[1fr_1fr_auto] @max-xl:whitespace-normal',
        className,
      )}
    >
      {LINES.map((l) => (
        <span key={l.label} className="inline-flex items-center gap-2">
          <Swatch state={l.state} stacked={'stacked' in l} small={'small' in l} />
          {l.label}
        </span>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={onClose}
        className="h-11 border-panel-foreground/55 bg-transparent px-3.5 font-sans font-medium text-panel-foreground hover:bg-panel-foreground/12 hover:text-panel-foreground focus-visible:ring-panel-foreground focus-visible:ring-offset-panel @max-xl:col-start-3 @max-xl:row-span-3 @max-xl:row-start-1 @max-xl:self-center"
      >
        Got it
      </Button>
    </div>
  )
}
