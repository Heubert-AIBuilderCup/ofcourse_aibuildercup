'use client'

// The pieces the workbench's steps share: the refusal beside a control, the status tag, the stored
// slides of a render or a market version, and the radio switch. One copy each, so the steps read
// alike.

import { ArrowDown, ArrowUp, X } from 'lucide-react'
import Link from 'next/link'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Blueprint } from '@/shared/components/Blueprint'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { Spin } from '@/shared/components/Working'
import { cn } from '@/shared/lib/utils'
import { type FailureReason, failureSentence } from '../lib/failure'
import { dailyLimitLine, stepLimitLine } from '../lib/limits'
import { sendBackLine } from '../lib/lines'
import { runningReason, type StepProgress } from '../lib/running'
import { postPath, stepPath } from '../lib/steps'
import { fitFailures, fitFixTab } from '../lib/version-status'
import { marketById } from '../markets'
import type { Body } from '../model/artifacts'
import type { CurrentPost } from '../model/current'
import type { LaidSlide } from '../model/types'
import { reasonText, tag } from './classes'
import { SlidePreview, slideWords } from './SlidePreview'
import { SlideStage } from './stage'

export { reasonText, tag } from './classes'

/** Inside the step bar's action row, where a control's reason opens from the row's end. */
const ControlAtEnd = createContext(false)

/** Which edge of its row a control's reason opens from. */
type Side = 'start' | 'end'

/** The nearest ancestor that clips or scrolls what overflows it, if any. */
function clippingAncestor(el: HTMLElement): HTMLElement | null {
  for (let at = el.parentElement; at; at = at.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(at)
    if (/auto|scroll|hidden|clip/.test(`${overflowX} ${overflowY}`)) return at
  }
  return null
}

/**
 * The side a reason opens from, measured as it shows: its own while the tooltip fits between the
 * nearest scrolling area's edges and the viewport's from there, else the other side if that fits,
 * else whichever leaves more of it in view.
 */
function sideWithRoom(row: HTMLElement, tip: HTMLElement, own: Side): Side {
  const at = row.getBoundingClientRect()
  const width = tip.getBoundingClientRect().width
  const area = clippingAncestor(row)?.getBoundingClientRect()
  const left = Math.max(area?.left ?? 0, 0)
  const right = Math.min(area?.right ?? window.innerWidth, window.innerWidth)
  // Room for the tooltip opening from the row's start (rightward) and from its end (leftward).
  const room: Record<Side, number> = { start: right - at.left, end: at.right - left }
  const other: Side = own === 'start' ? 'end' : 'start'
  if (room[own] >= width) return own
  if (room[other] >= width) return other
  return room[own] >= room[other] ? own : other
}

/**
 * A button row that says why it is unavailable (criterion 8): with a reason, a red "!" badge beside
 * the control, and the reason in a tooltip shown while the row is hovered or holds focus and
 * announced as the badge's description. Escape hides it until the pointer or focus leaves the row
 * (WCAG 1.4.13). The reason opens above the row, from its start, or from its end in the step bar
 * where the action sits at the right edge, so the panel never cuts it off, it never covers the
 * fields below, and it stays on screen in the step bar at the viewport's bottom; measured as it
 * shows (pointer or focus), it opens from the other side when its own has no room in the nearest
 * scrolling area or the viewport (`data-align` says which). The reason stays
 * in the DOM, so a step bar's action stays right-most.
 */
export function Control({ reason, children }: { reason: string | null; children: ReactNode }) {
  const tip = useId()
  // In the step bar the action sits at the right edge: the reason opens from the row's end there.
  const own = useContext(ControlAtEnd) ? 'end' : 'start'
  // Measured as it shows (18 Oct): a narrow scrolling area can leave its own side no room.
  const [measured, setMeasured] = useState<Side | null>(null)
  const align = measured ?? own
  const row = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const place = () => {
    if (row.current && tipRef.current) setMeasured(sideWithRoom(row.current, tipRef.current, own))
  }
  const [hovered, setHovered] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  // Keys go to the focused element, not the hovered one: while hovered, listen on the document.
  useEffect(() => {
    if (!hovered) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDismissed(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [hovered])
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the row's handlers only dismiss its tooltip; the controls inside it are the interactive ones.
    <div
      ref={row}
      className="group/control relative flex flex-wrap items-center gap-3"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setDismissed(true)
      }}
      onFocus={place}
      onPointerEnter={() => {
        place()
        setHovered(true)
      }}
      onPointerLeave={() => {
        setHovered(false)
        setDismissed(false)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDismissed(false)
      }}
    >
      {children}
      {reason && (
        // Beside the control, in the row's flow; the reason opens above the whole row.
        <>
          <button
            type="button"
            aria-label="Why this is unavailable"
            aria-describedby={tip}
            className="flex size-5 cursor-help items-center justify-center border border-destructive bg-destructive text-caption font-semibold leading-none text-destructive-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            !
          </button>
          <span
            ref={tipRef}
            id={tip}
            role="tooltip"
            data-align={align}
            data-dismissed={dismissed || undefined}
            className={cn(
              reasonText,
              'invisible absolute bottom-full z-10 mb-1 w-max max-w-xs border bg-popover px-3 py-2 text-popover-foreground',
              align === 'end' ? 'right-0' : 'left-0',
              !dismissed && 'group-focus-within/control:visible group-hover/control:visible',
            )}
          >
            {reason}
          </span>
        </>
      )}
    </div>
  )
}

/**
 * Why a move waits while a step of the post runs, in words (criterion 122), counted with the
 * progress the step records ("Drawing image 2 of 4"), or null.
 */
export const movesWait = (
  running: readonly string[],
  progress?: Readonly<Record<string, StepProgress>>,
): string | null => runningReason(running.map((step) => ({ step, progress: progress?.[step] })))

/**
 * A step's failed line ("Drafting failed. Your facts are kept."), with the sentence for why it
 * failed after it when its recorded error names a reason (lib/failure.ts).
 */
export function FailedLine({ words, reason }: { words: string; reason?: FailureReason }) {
  const limits = useContext(DailyLimitsContext)
  // A day's cap says why there is one, when it resets and who to email (lib/limits.ts).
  const why =
    reason === 'daily_limit' && limits ? stepLimitLine(limits.support) : failureSentence(reason)
  return <p className={reasonText}>{why ? `${words} ${why}` : words}</p>
}

/** One reorder control: whether it waits, and what it does. */
type ReorderMove = { disabled: boolean; onClick: () => void }

/**
 * The same reorder controls on every step (D2): icon buttons named for what they move, "Move
 * slide 2 up", "Move slide 2 down" and "Remove slide 2", each shown only when the step offers it.
 */
export function ReorderButtons(props: {
  /** What moves, as its name reads in a sentence: "slide 2", "panel 3", "section 1". */
  name: string
  up?: ReorderMove
  down?: ReorderMove
  remove?: ReorderMove
}) {
  const buttons = [
    { move: props.up, label: `Move ${props.name} up`, Icon: ArrowUp },
    { move: props.down, label: `Move ${props.name} down`, Icon: ArrowDown },
    { move: props.remove, label: `Remove ${props.name}`, Icon: X },
  ]
  return (
    <span className="flex shrink-0 flex-wrap gap-1">
      {buttons.map(({ move, label, Icon }) =>
        move ? (
          <Button
            key={label}
            variant="ghost"
            size="icon"
            aria-label={label}
            disabled={move.disabled}
            onClick={move.onClick}
          >
            <Icon aria-hidden strokeWidth={1.5} className="size-icon" />
          </Button>
        ) : null,
      )}
    </span>
  )
}

/** One of a step's two areas: it scrolls on its own beside the other; its padding keeps frame marks unclipped. */
const area = 'flex min-w-0 flex-col gap-8 @5xl:-m-2 @5xl:min-h-0 @5xl:overflow-y-auto @5xl:p-2'

/**
 * The workbench's step bar (StepBar) and its two slots, for StepBack and StepAction to put a step's
 * way back and its action in: undefined outside a workbench, each null until it is in the page.
 */
type StepBarSlots = {
  bar: HTMLElement | null
  back: HTMLElement | null
  action: HTMLElement | null
}
const StepBarTarget = createContext<StepBarSlots | undefined>(undefined)

/** The step actions bar: always in view at the bottom of the viewport, the way back on the left, the action on the right. */
const stepBar =
  'sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-4 border-t bg-background py-3'

/**
 * One step action bar for every step (A4): the workbench's screen, then the bar that holds the
 * step's way back on the left and its primary action on the right, sticky at the bottom of the
 * viewport. Each step puts them in it with StepBack and StepAction, so navigation and the action
 * sit in the same place on every step; a bar with neither is hidden.
 */
export function StepBar({ children }: { children: ReactNode }) {
  const [bar, setBar] = useState<HTMLElement | null>(null)
  const [back, setBack] = useState<HTMLElement | null>(null)
  const [action, setAction] = useState<HTMLElement | null>(null)
  return (
    <StepBarTarget value={{ bar, back, action }}>
      {/* No gap above the bar: StepAreas' frame ends where the bar begins. */}
      <div className="flex min-w-0 flex-col">
        {children}
        <section
          ref={setBar}
          aria-label="Step actions"
          className={cn(stepBar, 'hidden has-[>:not(:empty)]:flex')}
        >
          <div ref={setBack} className="flex flex-wrap items-center gap-4 empty:hidden" />
          <div
            ref={setAction}
            className="ml-auto flex flex-1 flex-wrap items-center justify-end gap-4 empty:hidden"
          />
        </section>
      </div>
    </StepBarTarget>
  )
}

/**
 * A step's way back (an outline button to the step before, or to the screen it came from), shown
 * on the left of the workbench's step bar. A step shown outside a workbench shows it in place.
 */
export function StepBack({ children }: { children: ReactNode }) {
  const slots = useContext(StepBarTarget)
  const row = <div className="flex flex-wrap items-center gap-4">{children}</div>
  if (slots === undefined) return row
  return slots.back ? createPortal(row, slots.back) : null
}

/**
 * A step's primary action (and what goes with it: its checks, its refusal), shown on the right of
 * the workbench's step bar. With `lead`, it goes before every other action there, whenever it
 * mounts ("Download slides", 18 Oct). A step shown outside a workbench gets a bar of its own in
 * place.
 */
export function StepAction({ children, lead = false }: { children: ReactNode; lead?: boolean }) {
  const slots = useContext(StepBarTarget)
  const row = (
    <ControlAtEnd value>
      <div
        className={cn(
          'flex flex-wrap items-center justify-end gap-4',
          // In the bar's slot the rows pack to its end; alone in a bar of its own, it fills it.
          slots === undefined && 'flex-1',
          lead && 'order-first',
        )}
      >
        {children}
      </div>
    </ControlAtEnd>
  )
  if (slots === undefined) {
    return (
      <section aria-label="Step actions" className={stepBar}>
        {row}
      </section>
    )
  }
  return slots.action ? createPortal(row, slots.action) : null
}

/**
 * A step's screen as two areas (GD30): the slides or the article being worked on, and the actions
 * and fields that change them. From @5xl of the workbench's container they sit side by side, each
 * scrolling on its own, in a frame as tall as the viewport less what is above it (the header,
 * measured) and the step bar, so both areas and the bar stay in view; below it they stack.
 */
export function StepAreas({ slides, actions }: { slides: ReactNode; actions: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null)
  const bar = useContext(StepBarTarget)?.bar
  useEffect(() => {
    const el = frame.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const fit = () => {
      const top = el.getBoundingClientRect().top + window.scrollY
      const below = bar?.offsetHeight ?? 0
      el.style.setProperty('--step-frame', `max(20rem, calc(100dvh - ${top}px - ${below}px))`)
    }
    fit()
    // The header above grows and shrinks (a note, the width); the bar wraps on narrow screens.
    const watch = new ResizeObserver(fit)
    watch.observe(document.body)
    if (bar) watch.observe(bar)
    return () => watch.disconnect()
  }, [bar])
  return (
    <div
      ref={frame}
      className="grid min-w-0 items-start gap-8 @5xl:max-h-[var(--step-frame,100dvh)] @5xl:grid-cols-2 @5xl:grid-rows-1 @5xl:items-stretch"
    >
      <section aria-label="Slides" className={area}>
        {slides}
      </section>
      <section aria-label="Actions" className={area}>
        {actions}
      </section>
    </div>
  )
}

/** The in-page question a move asks before it runs: never window.confirm (criteria 119, 121). */
export type Confirm = { question: string; body: ReactNode; go: string }

/**
 * A move, "Withdraw", "Edit" or "Discard changes": disabled with the running step in words beside
 * it while one runs (criterion 122), and, when it has a confirm ("Discard changes"; an edit at a
 * passed step never asks, GD28), asking it in the page with its own button and "Stay" before
 * anything moves. The trigger is disabled while it asks, so
 * focus moves to "Stay", the safe choice, and back to the trigger when Stay closes the confirm.
 */
export function Move(props: {
  label: string
  /** The running step in words (movesWait), or null. */
  waiting: string | null
  pending: boolean
  /** Its own run is going: the trigger waits as "Running…" with the loader. */
  working?: boolean
  onGo: () => void
  confirm?: Confirm
  className?: string
}) {
  const { label, waiting, pending, onGo, confirm, working = false } = props
  const [asking, setAsking] = useState(false)
  const ids = useId()
  const blocked = pending || waiting !== null
  const trigger = useRef<HTMLButtonElement>(null)
  const stay = useRef<HTMLButtonElement>(null)
  const stayed = useRef(false)
  useEffect(() => {
    if (asking) stay.current?.focus()
    else if (stayed.current) {
      stayed.current = false
      trigger.current?.focus()
    }
  }, [asking])
  return (
    <div className={cn('flex flex-col gap-3', props.className)}>
      <Control reason={waiting}>
        <Button
          ref={trigger}
          variant="outline"
          size="sm"
          disabled={blocked || asking}
          onClick={() => (confirm ? setAsking(true) : onGo())}
        >
          {working && <Spin />}
          {working ? 'Running…' : label}
        </Button>
      </Control>
      {confirm && asking && (
        <Blueprint
          as="section"
          aria-labelledby={`${ids}-question`}
          className="flex max-w-sm flex-col gap-3 p-4"
        >
          <h3 id={`${ids}-question`} className="text-h4">
            {confirm.question}
          </h3>
          {confirm.body}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={blocked}
              onClick={() => {
                setAsking(false)
                onGo()
              }}
            >
              {confirm.go}
            </Button>
            <Button
              ref={stay}
              size="sm"
              variant="outline"
              onClick={() => {
                stayed.current = true
                setAsking(false)
              }}
            >
              Stay
            </Button>
          </div>
        </Blueprint>
      )}
    </div>
  )
}

/** A reviewer's request for changes, with who and when, beside the step it names (criterion 120). */
export function ChangesNote({ sendBack }: { sendBack: Body<'send_back'> }) {
  return <p className="border px-3 py-2 text-foreground">{sendBackLine(sendBack)}</p>
}

/** What a cover with no generated art says in its tag, one word each, by its fallback (criteria 6, 37, 103). */
export const FALLBACK_LABELS = {
  replay: 'Replay',
  no_art: 'No art',
  daily_limit: 'Limit',
} as const

/** The sentence beside the "Limit" tag, and in its place where no tag shows, when no cap is known. */
export const LIMIT_LINE = 'Daily image limit reached.'

/** The day's image cap and the support address, read on the server (ai/config.ts) for the screens. */
const DailyLimitsContext = createContext<{ imageCap: number; support: string | null } | null>(null)

/** Gives the workbench the image cap and who to email, so the "Limit" line says both. */
export function DailyLimits({
  imageCap,
  support,
  children,
}: {
  imageCap: number
  support: string | null
  children: ReactNode
}) {
  return <DailyLimitsContext value={{ imageCap, support }}>{children}</DailyLimitsContext>
}

/** The sentence beside the "Limit" tag: the full daily-limit line (lib/limits.ts), or LIMIT_LINE. */
export function useImageLimitLine(): string {
  const limits = useContext(DailyLimitsContext)
  return limits
    ? dailyLimitLine({ what: 'images', cap: limits.imageCap, support: limits.support })
    : LIMIT_LINE
}

/** A fallback in words where it shows as text, not a tag: the sentence for the day's limit. */
export const fallbackLine = (fallback: keyof typeof FALLBACK_LABELS, limitLine = LIMIT_LINE) =>
  fallback === 'daily_limit' ? limitLine : FALLBACK_LABELS[fallback]

/** Which slide a stage shows, when the caller holds it (both versions of a review show the same one). */
type Selection = { selected?: number; onSelect?: (index: number) => void }

/**
 * A SlideStage of a post's slides (criterion 5): the selection the caller holds, or its own from
 * the first slide; switching versions then starts again from the first.
 */
function HeldStage({
  slides,
  below,
  selected,
  onSelect,
}: Selection & { slides: ReactNode[]; below?: (at: number) => ReactNode }) {
  const [own, setOwn] = useState(0)
  const at = Math.max(0, Math.min(selected ?? own, slides.length - 1))
  return (
    <SlideStage slides={slides} selected={at} onSelect={onSelect ?? setOwn} below={below?.(at)} />
  )
}

/** The stored PNGs of a render, with "Replay", "No art" or "Limit" on the cover (criteria 6, 37), and anything the caller shows under a slide. */
export function RenderedSlides({
  render,
  layout,
  below,
  stage = false,
  selected,
  onSelect,
}: Selection & {
  render: Body<'render'>
  /** The render's laid-out slides, whose words each image carries as its alt. */
  layout?: LaidSlide[]
  below?: (index: number) => ReactNode
  /** The selected slide over a filmstrip (SlideStage); three to a row without it. */
  stage?: boolean
}) {
  const fallback = render.art.fallback
  const limitLine = useImageLimitLine()
  const pictures = render.slides.map((s, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: a slide is its position; two may share bytes.
    <SlidePreview key={i} slide={i + 1} assetId={s.pngAssetId} text={slideWords(layout?.[i])} />
  ))
  const fallbackTag = fallback && (
    <>
      <span className={tag}>{FALLBACK_LABELS[fallback]}</span>
      {fallback === 'daily_limit' && <span className={reasonText}>{limitLine}</span>}
    </>
  )
  if (stage) {
    // The cover's fallback goes under the cover while it is the one shown, not into its thumbnail.
    return (
      <HeldStage
        slides={pictures}
        selected={selected}
        onSelect={onSelect}
        below={(at) =>
          (at === 0 && fallbackTag) || below ? (
            <div className="flex flex-col items-center gap-1">
              {at === 0 && fallbackTag && (
                <p className="flex flex-wrap items-center gap-2">{fallbackTag}</p>
              )}
              {below?.(at)}
            </div>
          ) : null
        }
      />
    )
  }
  const slides = pictures.map((picture, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: a slide is its position; two may share bytes.
    <figure key={i} className="flex flex-col gap-1">
      {picture}
      {i === 0 && fallbackTag && (
        <figcaption className="flex flex-wrap items-center gap-2">{fallbackTag}</figcaption>
      )}
      {below?.(i)}
    </figure>
  ))
  return <div className="grid grid-cols-3 gap-2">{slides}</div>
}

/** Where a failing fit row is fixed on the Text step, by its tab, as its link reads. */
const FIX_LINKS = {
  Checks: 'Fix it on Text · Checks',
  Style: 'Pick other colours on Text · Style',
  Versions: 'Pick another version on Text · Versions',
} as const

/**
 * Why the slides wait on their fit checks (18 Oct): each failing check by slide, slot and what is
 * wrong, with its numbers, and the way to fix each, the Text step with the tab that fixes it open:
 * Checks for the words, Style for the colours, Versions for the template's smallest text. Nothing
 * when every check passes.
 */
export function FitFailures({ postId, current }: { postId: string; current: CurrentPost }) {
  const { revision, layout } = current
  if (!layout || layout.body.fitChecks.every((c) => c.pass)) return null
  const failing = revision ? fitFailures(revision.body, layout.body.fitChecks) : []
  const tabs = [...new Set(layout.body.fitChecks.filter((c) => !c.pass).map(fitFixTab))]
  return (
    <div className="flex flex-col gap-2">
      {failing.length > 0 && (
        <ul aria-label="Failing fit checks" className="flex flex-col gap-1">
          {failing.map((p) => (
            <li key={p.text} className="text-caption text-destructive">
              {p.where ? [p.where, p.what, ...(p.evidence ?? [])].join(' · ') : p.text}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab}
            href={`${stepPath(postId, 'text')}?tab=${tab}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            {FIX_LINKS[tab]}
          </Link>
        ))}
      </div>
    </div>
  )
}

/**
 * "Download slides" (Images on): the zip of a feed post's rendered slides, PNG and SVG, text only
 * or with their pictures, from src/app/admin/(console)/posts/[id]/slides. Shown in the step bar,
 * before the step's action, wherever the post's rendered slides are on the stage.
 */
export function DownloadSlides({ postId }: { postId: string }) {
  return (
    <StepAction lead>
      <a
        href={`${postPath(postId)}/slides`}
        download
        className={buttonVariants({ variant: 'outline' })}
      >
        Download slides
      </a>
    </StepAction>
  )
}

/** The stored PNGs of a market version, with the feed excerpt it goes out with and whether the model reworded it (criterion 110). */
export function MarketSlides({
  market,
  stage = false,
  selected,
  onSelect,
}: Selection & {
  market: Body<'market'>
  /** The selected slide over a filmstrip (SlideStage); three to a row without it. */
  stage?: boolean
}) {
  const wording =
    (market.reworded ?? false)
      ? `Reworded for ${marketName(market.market)}`
      : 'Approved wording, money converted'
  const pictures = market.slides.map((s, i) => (
    <SlidePreview
      // biome-ignore lint/suspicious/noArrayIndexKey: a slide is its position; two may share bytes.
      key={i}
      slide={i + 1}
      assetId={s.pngAssetId}
      text={slideWords(market.layout[i])}
    />
  ))
  return (
    // On a stage, it takes the height its area leaves, so the slide fits the step's frame.
    <div className={cn('flex flex-col gap-4', stage && '@5xl:min-h-0 @5xl:flex-1')}>
      {stage ? (
        <HeldStage slides={pictures} selected={selected} onSelect={onSelect} />
      ) : (
        <div className="grid grid-cols-3 gap-2">{pictures}</div>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-overline uppercase text-muted-foreground">Feed excerpt</p>
        <p className="text-caption">{market.feedExcerpt}</p>
        <p className="text-caption text-muted-foreground">{wording}</p>
      </div>
    </div>
  )
}

/** Which version a step shows: the default render, or the post's one market version. */
export type Shown = 'default' | 'market'

/** A market's name for a label, from the markets file; the id itself if the file lost it. */
export const marketName = (id: string) => marketById(id)?.name ?? id

/** The Market switch's options: Default, then the market version by its market's name when there is one (criterion 87). */
export function shownOptions(
  market: Body<'market'> | null | undefined,
): { value: Shown; label: string }[] {
  return [
    { value: 'default', label: 'Default' },
    ...(market ? [{ value: 'market' as const, label: marketName(market.market) }] : []),
  ]
}

/** A switch between ways of seeing the post: radios, so it stays a choice and not another action. */
export function Toggle<T extends string>(props: {
  legend: string
  /** The legend shows as a label; otherwise it is for screen readers only. */
  showLegend?: boolean
  options: { value: T; label: string; disabled?: boolean }[]
  value: T
  onChange: (v: T) => void
}) {
  const name = useId()
  return (
    <fieldset className="flex flex-wrap items-center gap-4">
      <legend
        className={props.showLegend ? 'float-left text-caption text-muted-foreground' : 'sr-only'}
      >
        {props.legend}
      </legend>
      {props.options.map((v) => (
        <div key={v.value} className="flex items-center gap-2">
          <input
            id={`${name}-${v.value}`}
            type="radio"
            name={name}
            className="size-4 accent-primary"
            checked={props.value === v.value}
            disabled={v.disabled}
            onChange={() => props.onChange(v.value)}
          />
          <Label htmlFor={`${name}-${v.value}`}>{v.label}</Label>
        </div>
      ))}
    </fieldset>
  )
}
