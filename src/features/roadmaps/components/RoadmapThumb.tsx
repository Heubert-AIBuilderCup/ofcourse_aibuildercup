import { Duck } from '@/shared/components/Duck'
import motion from '@/shared/components/motion.module.css'
import { cn } from '@/shared/lib/utils'
import styles from './roadmaps.module.css'

// The card's small drawing of its road, from the reference's thumb(): seven tiles on a diagonal in
// a 260 × 132 box, lit up to where she is, the next one dim, the rest dark; when she swapped her
// course, the one swapped off sits dim beside her; the duck stands on her tile; its place is named
// in the corner.

const W = 260
const H = 132
type Point = [number, number]
type TileState = 'lit' | 'next' | 'fog' | 'alt'

const POINTS: Point[] = [0, 1, 2, 3, 4, 5, 6].map((i) => [46 + i * 32, 42 + i * 13])
const ROAD = `M${POINTS.map(([x, y]) => `${x} ${y}`).join(' L')}`

const points = (list: Point[]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

/** One tile's three faces around its centre. */
function faces([cx, cy]: Point) {
  const w = 17
  const h = 8.5
  const d = 5
  const t: Point = [cx, cy - h]
  const r: Point = [cx + w, cy]
  const b: Point = [cx, cy + h]
  const l: Point = [cx - w, cy]
  return {
    top: points([t, r, b, l]),
    left: points([l, b, [b[0], b[1] + d], [l[0], l[1] + d]]),
    right: points([b, r, [r[0], r[1] + d], [b[0], b[1] + d]]),
  }
}

function tiles(here: number, alt: boolean) {
  const list = POINTS.map((p, i) => ({
    key: `t${i}`,
    state: (i <= here ? 'lit' : i === here + 1 ? 'next' : 'fog') as TileState,
    ...faces(p),
  }))
  if (alt) {
    const [x, y] = POINTS[here]
    list.splice(here, 0, { key: 'alt', state: 'alt', ...faces([x + 30, y - 26]) })
  }
  return list
}

export function RoadmapThumb({ here, alt, place }: { here: number; alt: boolean; place: string }) {
  const [x, y] = POINTS[here]
  return (
    <span
      aria-hidden="true"
      className="relative block h-38 overflow-hidden border-b border-foreground/22"
    >
      {/* The field keeps Industry's light tokens inside a dark page, as the board's map does. */}
      <span data-theme="light" className={cn(motion.grid, styles.thumb, 'absolute inset-0')}>
        <span className="absolute top-2.5 left-3 z-1 font-heading text-overline font-medium tracking-widest text-panel-foreground uppercase">
          {place}
        </span>
        <span className={styles.stage}>
          <span className={styles.frame}>
            <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
              <path className={styles.road} d={ROAD} />
              {tiles(here, alt).map((t) => (
                <g key={t.key} className={styles.tile} data-state={t.state}>
                  <polygon className={styles.left} points={t.left} />
                  <polygon className={styles.right} points={t.right} />
                  <polygon className={styles.top} points={t.top} />
                </g>
              ))}
            </svg>
            <span
              className={styles.duck}
              style={{ left: `${((x - 9) / W) * 100}%`, top: `${((y - 26) / H) * 100}%` }}
            >
              <Duck size="1.75rem" className="block h-auto w-full" />
            </span>
          </span>
        </span>
      </span>
    </span>
  )
}
