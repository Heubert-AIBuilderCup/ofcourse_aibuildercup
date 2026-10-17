'use client'

import { CircleAlert, Eye, Info, Layers, Minus, Plus, Split } from 'lucide-react'
import { type ReactNode, useId, useMemo, useRef, useState } from 'react'
import { Duck } from '@/shared/components/Duck'
import motion from '@/shared/components/motion.module.css'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { useMapCamera } from '../hooks/useMapCamera'
import { useSwapMotion } from '../hooks/useSwapMotion'
import { type Camera, type Layout, type MapSize, stepStop } from '../model/camera'
import {
  depthOrder,
  drawTile,
  duckOn,
  iconOn,
  type LabelDraw,
  labelOf,
  type RoadKind,
  roadLines,
  rulerOf,
  type TileDraw,
  toScreen,
} from '../model/drawing'
import { ICONS, type IconName, kindOf } from '../model/kinds'
import type { MatchLine } from '../model/match-line'
import {
  type BadgeId,
  type Road,
  STOP_NAMES,
  STOPS,
  type Stop,
  type Tile,
  type TileState,
} from '../model/road-data'
import type { RoadState } from '../model/road-url'
import { POINT_A, type Scene } from '../model/scene'
import { KeyStrip } from './KeyStrip'
import { LessonLink } from './LessonLink'
import { MatchStrip } from './MatchStrip'
import { MockTag } from './MockTag'
import styles from './road-map.module.css'

/** A pressed tile lifts this much (px); a hovered one rises about as far by CSS (road-map.module.css). */
const LIFT = 6

const STATE_WORDS: Record<TileState, string> = {
  lit: 'visited',
  here: 'you are here',
  alt: 'not visited',
  next: 'not visited, next',
  fog: 'unexplored',
  seen: 'looked at',
  unknown: 'not picked yet',
}

const ROAD_CLASS: Record<RoadKind, string> = {
  level: styles.level,
  open: styles.open,
  fog: styles.fog,
  fork: styles.fork,
  next: styles.next,
  lit: styles.lit,
}

const BADGE_ICONS = { layers: Layers, alert: CircleAlert, split: Split }

const px = (v: number) => `${v.toFixed(1)}px`

/** A control over the map: translucent ink on the field; the map does not pan from it. */
const MAP_BUTTON =
  'h-11 gap-2 px-3.5 font-sans font-medium border-panel-foreground/50 bg-panel-foreground/10 text-panel-foreground backdrop-blur-xs hover:border-panel-foreground/70 hover:bg-panel-foreground/20 focus-visible:ring-panel-foreground focus-visible:ring-offset-panel'

type Props = {
  road: Road
  scene: Scene
  state: RoadState
  /** The board's layout, from its width: the camera's caps and padding follow it. */
  layout: Layout
  onPress: (tileId: string) => void
  onZoom: (stop: Stop) => void
  /** The lesson link was followed from the map. */
  onLesson: () => void
  /** The key strip shows (the board's: on her first visit, then Map key's). */
  keyShown: boolean
  onKeyShown: (shown: boolean) => void
  /**
   * Her answers are open: the map is their preview. Presses wait; on a phone, under their sheet,
   * the map drops its controls, names only what would change and where she is, and frames it.
   */
  answering?: boolean
  /**
   * Why this road, when it is not exactly hers (the closest, or the illustrative one): folded
   * into the map's top-left "Why this road?" button; none, no button.
   */
  match?: MatchLine | null
  /** Over the map: the toast, or the phone's peek. */
  children?: ReactNode
}

/**
 * The map: the road as isometric tiles on the brand field, an SVG of tile faces and roads with
 * HTML over it for the year ruler, the labels, the duck and the controls, and an invisible real
 * button over each tile (44px or more, clipped to its shape). Each tile says what it is: an icon
 * on its top face and its kind word over its name. A press opens the tile in the card; hovering
 * lifts it (its button stays put) and names an unlabelled tile, nothing more. Map key shows and
 * hides the key strip. The camera is useMapCamera's. A pick in her answers not saved yet draws
 * what would change as dashed rings with "If you save" on their labels, under a "Preview · not
 * saved" tag.
 */
export function RoadMap({
  road,
  scene,
  state,
  layout,
  onPress,
  onZoom,
  onLesson,
  keyShown,
  onKeyShown,
  answering = false,
  match = null,
  children,
}: Props) {
  const mapRef = useRef<HTMLElement>(null)
  const { drawn, moving } = useSwapMotion(scene)
  const stop = state.zoom
  // On a phone her answers' sheet covers the map's foot: only the preview is left over it.
  const under = answering && layout === 'phone'
  const previewing = scene.tiles.some((t) => t.prev !== undefined)
  const { cam, size, dragging } = useMapCamera({
    mapRef,
    layout,
    scene,
    stop,
    focusId: state.tile,
    sheet: under,
    onStep: (dir) => onZoom(stepStop(stop, dir)),
  })
  const [hover, setHover] = useState<string | null>(null)
  const keyRef = useRef<HTMLButtonElement>(null)
  // Why this road and the key share the map's top left: opening one closes the other.
  const [whyShown, setWhyShown] = useState(false)
  const whyId = useId()
  const showWhy = (shown: boolean) => {
    setWhyShown(shown)
    if (shown) onKeyShown(false)
  }
  const showKey = (shown: boolean) => {
    onKeyShown(shown)
    if (shown) setWhyShown(false)
  }

  // The camera re-renders the map every frame of a move: look tiles up by id, once per scene.
  const tiles = useMemo(() => new Map(scene.tiles.map((t) => [t.id, t])), [scene.tiles])
  const byId = (id: string | null) => (id === null ? undefined : tiles.get(id))
  const here = byId(scene.here)
  const open = byId(state.tile)
  const ahead =
    stop === 'level' &&
    !!open &&
    (open.state === 'fog' || open.state === 'seen') &&
    !scene.levelIds.includes(open.id)

  return (
    <section
      ref={mapRef}
      aria-label="Your roadmap, map"
      // The field keeps Industry's light tokens inside a dark page, as the onboarding panel does.
      data-theme="light"
      data-dragging={dragging || undefined}
      data-answering={answering || undefined}
      className={cn(
        motion.grid,
        styles.map,
        'relative min-h-0 min-w-0 flex-1 overflow-hidden text-panel-foreground',
      )}
    >
      {cam && size ? (
        <Drawing
          scene={drawn}
          hintLine={road.arrival.line}
          cam={cam}
          size={size}
          stop={stop}
          openId={state.tile}
          hover={hover}
          ahead={ahead}
          badges={scene.badges}
          under={under}
          answering={answering}
          onPress={onPress}
          onHover={setHover}
        />
      ) : null}

      {cam && size && here && stop === 'level' && !ahead ? (
        <AheadPlate
          scene={scene}
          here={here}
          cam={cam}
          size={size}
          lessonId={road.lesson.id}
          onLesson={onLesson}
        />
      ) : null}

      {match && !under ? (
        <>
          <Button
            type="button"
            variant="square"
            data-map-control
            aria-expanded={whyShown}
            aria-controls={whyId}
            onClick={() => showWhy(!whyShown)}
            className={cn(
              MAP_BUTTON,
              'absolute top-4 left-4 z-30 aria-expanded:bg-panel-foreground/16 @max-xl:top-3 @max-xl:right-3 @max-xl:left-auto',
            )}
          >
            <Info aria-hidden="true" strokeWidth={1.5} className="size-icon" />
            Why this road?
          </Button>
          {whyShown ? <MatchStrip id={whyId} line={match} /> : null}
        </>
      ) : null}
      {keyShown && !under ? (
        <KeyStrip
          className={match ? 'top-18' : undefined}
          onClose={() => {
            onKeyShown(false)
            // Its Got it goes with it: keyboard focus lands on Map key, not the page.
            keyRef.current?.focus()
          }}
        />
      ) : null}
      <Button
        ref={keyRef}
        type="button"
        variant="square"
        data-map-control
        aria-pressed={keyShown}
        onClick={() => showKey(!keyShown)}
        className={cn(
          MAP_BUTTON,
          'absolute top-4 right-4 z-30 aria-pressed:bg-panel-foreground/16 @max-xl:top-3 @max-xl:right-auto @max-xl:left-3',
          under && 'hidden',
        )}
      >
        <span
          aria-hidden="true"
          className="inline-grid size-icon place-items-center rounded-full border border-current text-micro leading-none font-bold"
        >
          ?
        </span>
        Map key
      </Button>

      {moving ? (
        <span
          role="status"
          className="absolute top-4 left-1/2 z-30 inline-flex min-h-11 -translate-x-1/2 items-center bg-background px-4 font-semibold text-brand-hover shadow-lg @max-xl:top-18"
        >
          Swapping onto your roadmap
        </span>
      ) : answering && previewing ? (
        <span
          role="status"
          className="absolute top-4 left-1/2 z-30 inline-flex min-h-11 -translate-x-1/2 items-center gap-2 border border-dashed border-brand bg-background px-4 font-semibold whitespace-nowrap text-brand-hover shadow-lg @max-xl:top-2 @max-xl:min-h-9 @max-xl:text-sm"
        >
          <Eye aria-hidden="true" strokeWidth={1.5} className="size-icon-sm" />
          Preview · not saved
        </span>
      ) : under ? null : (
        <span className="absolute top-18 left-3 z-30 hidden min-h-7 items-center border border-dashed border-panel-foreground/60 bg-panel/80 px-2.5 text-micro whitespace-nowrap uppercase @max-xl:inline-flex">
          Still exploring · ranking optional
        </span>
      )}

      <Button
        type="button"
        variant="square"
        data-map-control
        aria-label="Weighing. Adjust weights"
        className="absolute bottom-4 left-4 z-30 h-auto w-50 flex-col items-stretch gap-2.5 bg-background p-3 font-sans text-foreground shadow-md hover:bg-background @max-5xl:hidden"
      >
        <span className="flex items-baseline justify-between text-micro uppercase">
          <span className="text-muted-foreground">Weighing</span>
          <span className="font-semibold text-brand-hover">Adjust</span>
        </span>
        <span className="grid h-15 grid-cols-6 gap-1">
          {road.weights.map((w) => (
            <span key={w.name} className="flex min-w-0 flex-col items-center justify-end gap-1">
              <i
                className="block min-h-1 w-3 bg-brand"
                style={{ height: `${Math.round((w.weight / 3) * 100)}%` }}
              />
              <span className="text-micro font-normal tracking-normal text-muted-foreground">
                {w.name}
              </span>
            </span>
          ))}
        </span>
      </Button>

      {scene.ruler.ticks.length ? (
        <p className="absolute bottom-5 left-60 z-30 m-0 flex items-center gap-1.5 text-caption @max-5xl:left-4 @max-xl:hidden">
          Years after 2028 are a guide ·
          <MockTag className="border-panel-foreground/60" />
        </p>
      ) : null}

      {scene.empty || under ? null : <ZoomControl stop={stop} onZoom={onZoom} />}
      {children}
    </section>
  )
}

/** The SVG and the HTML layers over it, for one camera. */
function Drawing({
  scene,
  hintLine,
  cam,
  size,
  stop,
  openId,
  hover,
  ahead,
  badges,
  under,
  answering,
  onPress,
  onHover,
}: {
  scene: Scene
  hintLine: string
  cam: Camera
  size: MapSize
  stop: Stop
  openId: string | null
  hover: string | null
  ahead: boolean
  badges: Road['badges']
  /** Under her answers' sheet on a phone: only what would change, and where she is, are named. */
  under: boolean
  /** Her answers are open: a press on a tile other than Point A waits. */
  answering: boolean
  onPress: (tileId: string) => void
  onHover: (tileId: string | null) => void
}) {
  const ruler = scene.ruler.ticks.length ? rulerOf(scene, cam, stop) : null
  // Drawn every frame of a camera move: the depth order and each tile's place in it, once per scene.
  const order = useMemo(() => depthOrder(scene.tiles), [scene.tiles])
  const depth = useMemo(() => new Map(order.map((t, i) => [t.id, i])), [order])
  // What each tile is (its word and icon) depends on the scene alone, not the camera.
  const kinds = useMemo(() => new Map(scene.tiles.map((t) => [t.id, kindOf(t, scene)])), [scene])
  const drawn = new Map<string, { tile: Tile; draw: TileDraw; label: LabelDraw | null }>()
  for (const t of order) {
    const isHere = t.id === scene.here
    // Pressed, it is drawn lifted; hovered, it rises by CSS, so its button and label stay put.
    const lift = t.id === openId && !isHere ? LIFT : 0
    const draw = drawTile(t, cam, lift)
    const named = !under || isHere || t.prev !== undefined
    const label = !named
      ? null
      : labelOf(t, draw, cam, {
          stop,
          here: isHere,
          hovered: t.id === hover,
          ahead,
          openLevel: scene.openLevel,
          phone: size.layout === 'phone',
          lift,
          pressed: t.id === openId,
          rem: 16 * size.rs,
          map: { width: size.width, height: size.height },
          kind: kinds.get(t.id)!.word,
        })
    drawn.set(t.id, { tile: t, draw, label })
  }
  const here = drawn.get(scene.here)?.tile
  const duck = here ? duckOn(here, cam, size.rs) : null
  const hinted = scene.hint ? drawn.get(scene.hint) : undefined

  return (
    <>
      <svg
        aria-hidden="true"
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        className={cn(styles.svg, 'absolute inset-0 block overflow-visible')}
      >
        {ruler ? (
          <>
            <path className={styles.ruler} d={ruler.d} strokeWidth={ruler.width} />
            {ruler.ticks.map((d) => (
              <path key={d} className={styles.ruler} d={d} strokeWidth={ruler.width} />
            ))}
          </>
        ) : null}
        {roadLines(scene, cam).map((r) => (
          <path key={r.id} className={ROAD_CLASS[r.kind]} d={r.d} strokeWidth={r.width} />
        ))}
        {order.map((t) => {
          const { draw } = drawn.get(t.id)!
          const isHere = t.id === scene.here
          const pressed = t.id === openId
          const hovered = t.id === hover && !pressed && !isHere
          return (
            <g
              key={t.id}
              className={styles.tile}
              data-tile={t.id}
              data-state={isHere ? 'here' : t.state}
              data-lift={hovered || (pressed && !isHere) ? '' : undefined}
              data-hover={hovered ? '' : undefined}
              // Drawn lifted, it does not ease (road-map.module.css): pressed while hovered, it stays put.
              data-pressed={pressed && !isHere ? '' : undefined}
            >
              {t.id === scene.hint ? (
                <polygon className={styles.hint} points={draw.ring(1.6)} />
              ) : null}
              {draw.layers.map((l) => (
                <g key={l.top}>
                  <polygon className={styles.left} points={l.left} />
                  <polygon className={styles.right} points={l.right} />
                  <polygon className={styles.top} points={l.top} />
                </g>
              ))}
              <TileIcon tile={t} icon={kinds.get(t.id)!.icon} draw={draw} cam={cam} />
              {t.prev !== undefined ? (
                <polygon
                  className={styles.prevRing}
                  data-preview=""
                  points={draw.ring(isHere ? 1.75 : 1.5)}
                />
              ) : null}
              {isHere || pressed ? (
                <polygon
                  className={styles.ring}
                  data-pressed={isHere ? undefined : ''}
                  points={draw.ring(isHere ? 1.45 : 1.3)}
                />
              ) : null}
            </g>
          )
        })}
      </svg>

      {ruler ? (
        <>
          <Year at={ruler.now} now>
            Now
          </Year>
          {ruler.years.map((y) => (
            <Year key={y.year} at={y.at}>
              {y.year}
            </Year>
          ))}
        </>
      ) : null}

      {/* In road order, so Tab walks the road; each tile's depth decides which is on top. */}
      <div className="absolute inset-0 isolate z-10">
        {scene.tiles.map((t) => {
          // Not picked yet: an outline of what comes, not a tile on her road.
          if (t.state === 'unknown') return null
          const { hit } = drawn.get(t.id)!.draw
          const state = t.id === scene.here ? 'here' : t.state
          // What a press does: Point A opens her answers; while they are open, the others wait.
          const does =
            t.id === POINT_A
              ? 'Open your answers'
              : answering
                ? 'Close your answers to open it'
                : 'Open in the card'
          return (
            <button
              key={t.id}
              type="button"
              aria-label={`${t.name}, ${STATE_WORDS[state]}. ${does}`}
              aria-pressed={t.id === openId}
              onClick={() => onPress(t.id)}
              onPointerEnter={() => onHover(t.id)}
              onPointerLeave={() => onHover(null)}
              onFocus={() => onHover(t.id)}
              onBlur={() => onHover(null)}
              className={cn(styles.hit, 'absolute cursor-pointer border-0 bg-transparent p-0')}
              style={{
                left: px(hit.x),
                top: px(hit.y),
                width: px(hit.width),
                height: px(hit.height),
                zIndex: depth.get(t.id),
              }}
            />
          )
        })}
      </div>

      {order.map((t) => {
        const { label } = drawn.get(t.id)!
        return label ? (
          <Label
            key={t.id}
            label={label}
            tile={t}
            here={t.id === scene.here}
            stop={stop}
            badges={badges}
          />
        ) : null
      })}

      {here && duck ? (
        <div
          role="img"
          aria-label={`You are here: ${here.name}`}
          className="pointer-events-none absolute z-20"
          style={{ left: px(duck.x), top: px(duck.y), width: px(duck.width) }}
        >
          {/* Drawn 34–76px wide by the camera (duckOn); 5rem covers it. */}
          <Duck size="5rem" eager className={cn(styles.duck, 'block h-auto w-full')} />
        </div>
      ) : null}

      {hinted ? (
        <p
          className={cn(
            styles.bubble,
            'pointer-events-none absolute z-20 m-0 flex items-center gap-2 bg-background py-2 pr-3 pl-2 font-medium whitespace-nowrap text-foreground shadow-lg',
          )}
          style={{
            left: px(hinted.draw.centre[0] + 2 * hinted.draw.size * cam.u + 14),
            top: px(hinted.draw.centre[1] + 0.2 * cam.u),
          }}
        >
          <Duck size="1.5rem" className="size-6 -scale-x-100 object-contain" />
          {hintLine}
        </p>
      ) : null}
    </>
  )
}

/** The icon printed flat on a tile's top face (iconOn), in the tile's state's ink. */
function TileIcon({
  tile,
  icon,
  draw,
  cam,
}: {
  tile: Tile
  icon: IconName
  draw: TileDraw
  cam: Camera
}) {
  return (
    <g className={styles.icon} data-icon={icon} transform={iconOn(draw, tile, cam)}>
      {ICONS[icon].map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  )
}

function Year({
  at,
  now = false,
  children,
}: {
  at: [number, number]
  now?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        styles.year,
        'pointer-events-none absolute z-10 text-overline font-medium whitespace-nowrap opacity-90',
        now && 'uppercase tracking-widest',
      )}
      style={{ left: px(at[0]), top: px(at[1]) }}
    >
      {children}
    </span>
  )
}

const PLACE: Record<LabelDraw['place'], string> = {
  above: '-translate-x-1/2 -translate-y-full',
  below: '-translate-x-1/2',
  left: '-translate-x-full -translate-y-1/2 items-end text-right',
  right: '-translate-y-1/2 items-start text-left max-w-60',
}

/**
 * A tile's label, hung on a short line from its tile: its kind word, its name, its sub and
 * trade-off as the stop asks; its plate of the field, white where she is; the full label at the
 * Tile stop. A hovered tile's name fades in.
 */
function Label({
  label,
  tile,
  here,
  stop,
  badges,
}: {
  label: LabelDraw
  tile: Tile
  here: boolean
  stop: Stop
  badges: Road['badges']
}) {
  const { full } = label
  const small = stop === 'whole' || tile.kind === 'step' || tile.state === 'fog'
  return (
    <div
      aria-hidden="true"
      data-state={tile.state}
      data-here={here || undefined}
      data-place={label.place}
      data-hint={label.hint || undefined}
      className={cn(
        styles.label,
        'pointer-events-none absolute z-20 flex w-max max-w-52 flex-col items-center gap-0.5 px-2 py-1 text-center',
        PLACE[label.place],
        label.hint && 'opacity-95',
        full && 'max-w-68 items-start gap-1.5 px-3 py-2.5 text-left shadow-lg',
      )}
      style={{ left: px(label.x), top: px(label.y) }}
    >
      {label.kicker ? (
        <span className="font-heading text-overline font-medium uppercase opacity-90">
          {label.kicker}
        </span>
      ) : null}
      {label.when ? <span className="text-overline uppercase opacity-80">{label.when}</span> : null}
      <span
        className={cn(
          'font-heading leading-tight font-semibold',
          full ? 'text-h4' : !(small && !here) && 'text-lead',
          tile.state === 'fog' && 'font-medium',
        )}
      >
        {label.name}
      </span>
      {label.sub ? (
        <span className={cn('text-caption', full ? 'text-muted-foreground' : 'opacity-90')}>
          {label.sub}
        </span>
      ) : null}
      {label.badges.length ? <LabelBadges ids={label.badges} badges={badges} /> : null}
      {label.gains || label.costs ? (
        <span className={cn('flex flex-col text-caption', full && 'border-t pt-1.5')}>
          {label.gains ? <span>{label.gains}</span> : null}
          {label.costs ? <span>{label.costs}</span> : null}
        </span>
      ) : null}
      {tile.prev !== undefined ? (
        <span className={cn(styles.prev, 'mt-1 px-1.5 py-0.5 text-caption')}>
          <b className="font-semibold">If you save</b> · {tile.prev}
        </span>
      ) : null}
    </div>
  )
}

/** Up to two badges on the full label, then "+n". */
function LabelBadges({ ids, badges }: { ids: BadgeId[]; badges: Road['badges'] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {ids.slice(0, 2).map((id) => {
        const b = badges[id]
        const Icon = BADGE_ICONS[b.icon]
        return (
          <span
            key={id}
            className="inline-flex min-h-5.5 items-center gap-1 border border-foreground/28 px-1.5 text-micro whitespace-nowrap"
          >
            <Icon aria-hidden="true" strokeWidth={2} className="size-icon-xs text-brand-hover" />
            <b>{b.kind} ·</b> {b.value}
          </span>
        )
      })}
      {ids.length > 2 ? (
        <span className="inline-flex min-h-5.5 items-center border border-foreground/28 px-1.5 text-micro font-bold">
          +{ids.length - 2}
        </span>
      ) : null}
    </span>
  )
}

/** The road ahead, counted, with its lesson; on the map beside the start of the study step. */
function AheadPlate({
  scene,
  here,
  cam,
  size,
  lessonId,
  onLesson,
}: {
  scene: Scene
  here: Tile
  cam: Camera
  size: MapSize
  lessonId: string
  onLesson: () => void
}) {
  const step = scene.tiles.find((t) => t.id === scene.courseStep)
  if (!step || step.state === 'seen' || here.kind !== 'course') return null
  const [x, y] = toScreen(cam)(step.gx + 0.9, step.gy + 0.95)
  const left = Math.min(x, size.width - 17 * 16 * size.rs)
  const more = scene.ahead.length - 1
  return (
    <div
      data-map-control
      className={cn(
        styles.plate,
        'absolute z-20 flex flex-col items-start gap-1.5 px-2.5 py-2 @max-xl:hidden',
      )}
      style={{ left: px(left), top: px(y) }}
    >
      <span className="font-heading font-semibold">
        {more} more steps{scene.fork ? ' · 2 ways to PR' : ''}
      </span>
      <LessonLink
        lessonId={lessonId}
        onFollow={onLesson}
        className="border-panel-foreground/50 text-panel-foreground hover:bg-panel-foreground/12"
      />
    </div>
  )
}

/** Zoom: the three stops by name, − and + either side; the current stop is pressed. */
function ZoomControl({ stop, onZoom }: { stop: Stop; onZoom: (stop: Stop) => void }) {
  const STEP =
    'h-11 min-w-11 rounded-none px-0 text-foreground aria-disabled:text-foreground/35 aria-disabled:hover:bg-transparent @max-xl:hidden'
  return (
    <fieldset
      aria-label="Zoom"
      data-map-control
      className="absolute right-4 bottom-4 z-30 m-0 flex min-w-0 border bg-background p-0 text-foreground shadow-md @max-xl:top-4 @max-xl:right-3 @max-xl:bottom-auto"
    >
      <Button
        type="button"
        variant="ghost"
        aria-label="Zoom out"
        aria-disabled={stop === 'whole'}
        onClick={() => onZoom(stepStop(stop, -1))}
        className={STEP}
      >
        <Minus aria-hidden="true" strokeWidth={1.5} className="size-icon" />
      </Button>
      {STOPS.map((s) => (
        <Button
          key={s}
          type="button"
          variant="ghost"
          aria-pressed={s === stop}
          onClick={() => onZoom(s)}
          className="h-11 rounded-none border-l px-3 font-sans font-medium @max-xl:px-2 aria-pressed:bg-brand aria-pressed:text-brand-foreground aria-pressed:shadow-[inset_0_-3px_0_var(--color-brand-active)] aria-pressed:hover:bg-brand-hover"
        >
          {STOP_NAMES[s]}
        </Button>
      ))}
      <Button
        type="button"
        variant="ghost"
        aria-label="Zoom in"
        aria-disabled={stop === 'tile'}
        onClick={() => onZoom(stepStop(stop, 1))}
        className={cn(STEP, 'border-l')}
      >
        <Plus aria-hidden="true" strokeWidth={1.5} className="size-icon" />
      </Button>
    </fieldset>
  )
}
