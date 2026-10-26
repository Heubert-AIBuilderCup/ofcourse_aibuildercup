'use client'

// The pieces every slide step of the workbench is built from, so Text, Images, Settings, Review and
// Live read alike and fit the step's frame without the page scrolling: the stage on the left (the
// selected slide big, the filmstrip under it), the tabs on the right (one group of controls at a
// time), and the drawer for detail opened now and then (never a fold-out that pushes the page).

import { type ReactNode, useId, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/shared/components/ui/sheet'
import { cn } from '@/shared/lib/utils'
import { tag } from './classes'
import { SlideThumbnail } from './SlidePreview'

/** A selection kept inside `0 … count - 1`: a newer render may have fewer slides than it was counted on. */
const clamp = (at: number, count: number) => Math.min(Math.max(at, 0), count - 1)

/** The keys that move the stage's selection, by one slide, stopping at the ends. */
const STAGE_KEYS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 }

/**
 * The left area of a slide step: the selected slide on top, centred, as large as the height left
 * after the filmstrip allows (from @5xl, where the step's frame bounds the area; one column of a
 * form card's width below it), anything the caller puts below it (a "Limit" line), then the
 * filmstrip, one thumbnail per slide, eight to a row, centred, the selected one marked. A click on
 * a thumbnail selects it; Left and Right move the selection while the stage or a thumbnail has focus (never from a
 * field inside the slide). The thumbnails are the slides themselves, scaled, unless the caller
 * draws its own; they are hidden from screen readers, which hear each by its button's name.
 */
export function SlideStage({
  slides,
  thumbs = slides,
  names,
  selected,
  onSelect,
  below,
  label = 'Slides, one at a time',
}: {
  /** Each slide as the caller draws it, in order. */
  slides: ReactNode[]
  /** The filmstrip's thumbnails, in the same order; the slides scaled by default. */
  thumbs?: ReactNode[]
  /** Each slide's name, in the same order ("Cover picture"); "Slide n" by default. */
  names?: string[]
  selected: number
  onSelect: (index: number) => void
  /** Shown under the selected slide, above the filmstrip. */
  below?: ReactNode
  /** The stage's name for a screen reader. */
  label?: string
}) {
  const ids = useId()
  const strip = useRef<HTMLUListElement>(null)
  if (slides.length === 0) return null
  const at = clamp(selected, slides.length)
  const thumbId = (i: number) => `${ids}-thumb-${i}`
  const name = (i: number) => names?.[i] ?? `Slide ${i + 1}`
  // Where it is, in words: "Slide 2 of 5", or by its name, "Cover picture · 1 of 4".
  const where = names
    ? `${name(at)} · ${at + 1} of ${slides.length}`
    : `Slide ${at + 1} of ${slides.length}`

  return (
    // biome-ignore lint/a11y/useSemanticElements: a carousel is a group of slides (the APG carousel pattern), not a form's fieldset.
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the stage takes focus so Left and Right move the selection.
      tabIndex={0}
      className="flex w-full min-w-0 flex-col items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring @5xl:min-h-0 @5xl:flex-1"
      onKeyDown={(e) => {
        const step = STAGE_KEYS[e.key]
        if (!step) return
        const onThumb = strip.current?.contains(e.target as Node) ?? false
        if (e.target !== e.currentTarget && !onThumb) return
        const next = at + step
        if (next < 0 || next >= slides.length) return
        e.preventDefault()
        onSelect(next)
        if (onThumb) document.getElementById(thumbId(next))?.focus()
      }}
    >
      {/* From @5xl the slide takes the height the filmstrip leaves, its width following its 4:5 shape. */}
      <div className="flex w-full justify-center @5xl:min-h-0 @5xl:flex-1">
        <div className="mx-auto aspect-4/5 w-full max-w-sm @5xl:h-full @5xl:w-auto @5xl:max-w-full">
          {slides[at]}
        </div>
      </div>
      {below}
      <p aria-live="polite" className="sr-only">
        {where}
      </p>
      <ul
        ref={strip}
        aria-label="All slides"
        className="flex w-full shrink-0 flex-wrap justify-center gap-2"
      >
        {thumbs.map((thumb, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a slide is its position; two may share bytes.
          <li key={i} className="basis-[calc((100%-3.5rem)/8)]">
            <button
              id={thumbId(i)}
              type="button"
              aria-label={name(i)}
              aria-current={i === at ? 'true' : undefined}
              className={cn(
                'block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                // The selected one: a 1px outline in the brand colour, clear of the slide's own hairline.
                i === at
                  ? 'outline outline-offset-2 outline-primary'
                  : 'opacity-70 hover:opacity-100',
              )}
              onClick={() => onSelect(i)}
            >
              <span aria-hidden="true" inert className="pointer-events-none block">
                {/* A thumbnail that fails to load shows a small "!", not words and a Retry. */}
                <SlideThumbnail>{thumb}</SlideThumbnail>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A tab's tag after its name: "Fix" for something to fix, or a count. */
export type TabBadge = {
  /** What the tag shows: one word or a number. */
  text: string
  /** What a screen reader hears after the name ("needs attention"); the text itself by default. */
  label?: string
  /** Something to fix: the tag in the error colour. */
  problem?: boolean
}

/** One group of a step's controls, as a tab. */
export type ActionTab = { name: string; badge?: TabBadge; body: ReactNode }

/** The keys that move between tabs (the WAI-ARIA tabs pattern), from tab `i` of `n`, wrapping. */
const TAB_KEYS: Record<string, (i: number, n: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
}

/**
 * The right area of a slide step: its groups of controls as tabs, a row of them wrapping on a
 * narrow screen, the open one selected and only its panel rendered (the WAI-ARIA tabs pattern:
 * one tab in the tab order, the arrow keys, Home and End moving between them and opening the
 * one they land on). A tab can carry a badge ("Fix", a count). Held by the caller with `at` and
 * `onGo` (so a save keeps the open tab), or by itself from the first.
 */
export function ActionTabs({
  label,
  tabs,
  at,
  onGo,
}: {
  /** The tablist's name for a screen reader ("Settings panels"). */
  label: string
  tabs: ActionTab[]
  at?: number
  onGo?: (at: number) => void
}) {
  const ids = useId()
  const [own, setOwn] = useState(0)
  const go = onGo ?? setOwn
  const tabId = (i: number) => `${ids}-tab-${i}`
  const panelId = `${ids}-panel`
  if (tabs.length === 0) return null
  const here = clamp(at ?? own, tabs.length)
  // A key opens the tab it lands on, and the focus follows it.
  const move = (i: number) => {
    go(i)
    document.getElementById(tabId(i))?.focus()
  }
  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label={label} className="flex flex-wrap border-b">
        {tabs.map((t, i) => (
          <button
            key={t.name}
            id={tabId(i)}
            type="button"
            role="tab"
            aria-selected={i === here}
            aria-controls={i === here ? panelId : undefined}
            tabIndex={i === here ? 0 : -1}
            className={cn(
              // The open tab: a hairline in the primary colour over the list's, and weight.
              '-mb-px inline-flex items-center gap-2 border-b px-3 py-2 text-caption transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              i === here
                ? 'border-primary font-semibold text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() => go(i)}
            onKeyDown={(e) => {
              const to = TAB_KEYS[e.key]
              if (!to) return
              e.preventDefault()
              move(to(i, tabs.length))
            }}
          >
            {t.name}
            {t.badge && (
              <>
                <span
                  aria-hidden
                  className={cn(tag, t.badge.problem && 'border-destructive text-destructive')}
                >
                  {t.badge.text}
                </span>
                <span className="sr-only">{` · ${t.badge.label ?? t.badge.text}`}</span>
              </>
            )}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId(here)}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the APG tabs pattern makes the panel focusable, so Tab from the tablist lands in it.
        tabIndex={0}
        className="flex flex-col gap-8"
      >
        {tabs[here].body}
      </div>
    </div>
  )
}

/**
 * A step's open tab by its name, held above the step's version key (Workbench), so a save keeps
 * it: null until she opens one or works in the step.
 */
export type TabHold = { open: string | null; onOpen: (name: string) => void }

/** The selected slide by its number (1 the first), held above the step's version key as `TabHold` is. */
export type SlideHold = { selected: number; onSelect: (slide: number) => void }

/**
 * The slide and the tab a step shows: the workbench's when it passes them, so a save keeps them
 * (GD24), else the step's own; the slide as the stage's place, 0 the first.
 */
export function useHolds(slide?: SlideHold, tab?: TabHold) {
  const [ownSlide, setOwnSlide] = useState(1)
  const [ownTab, setOwnTab] = useState<string | null>(null)
  const held = slide ?? { selected: ownSlide, onSelect: setOwnSlide }
  return {
    at: held.selected - 1,
    onSelect: (index: number) => held.onSelect(index + 1),
    tab: tab ?? { open: ownTab, onOpen: setOwnTab },
  }
}

/**
 * The place of the tab shown: the held one while it shows, else `initial`, the one the step needs
 * first (the source check, while it holds something to fix), else the first.
 */
export function shownTab(
  tabs: readonly { name: string }[],
  open: string | null,
  initial?: string,
): number {
  const held = tabs.findIndex((t) => t.name === open)
  if (held >= 0) return held
  return Math.max(
    0,
    tabs.findIndex((t) => t.name === initial),
  )
}

/**
 * Holds the tab shown once she works in the step (a click or a key inside it, before it acts), so
 * a change of her own that brings a tab needed first (Checks, on Text) does not take her from
 * it: the handlers for the step's root. A tab she opens with that click or key is held after it.
 */
export function holdOnWork(hold: TabHold, shown: string | undefined) {
  const pin = () => {
    if (shown !== undefined && hold.open !== shown) hold.onOpen(shown)
  }
  return { onClickCapture: pin, onKeyDownCapture: pin }
}

/**
 * A step's right area: its groups as tabs (ActionTabs), the open one held by its name, so it stays
 * open while groups come and go (the first picture lands, a slide is selected), and `initial`
 * while none is held (shownTab); a step with one group shows it without tabs, and one with none
 * shows nothing.
 */
export function StepTabs({
  label,
  tabs,
  open,
  initial,
  onOpen,
}: {
  label: string
  tabs: ActionTab[]
  open: string | null
  /** The tab the step needs first, computed by the step; the first tab when none. */
  initial?: string
  onOpen: (name: string) => void
}) {
  if (tabs.length === 0) return null
  if (tabs.length === 1) return tabs[0].body
  return (
    <ActionTabs
      label={label}
      tabs={tabs}
      at={shownTab(tabs, open, initial)}
      onGo={(i) => onOpen(tabs[i].name)}
    />
  )
}

/**
 * Detail opened now and then (a claim list, a version's slots), in a drawer from the right that
 * never takes the whole screen (at most a form card's width and a half, `max-w-md`; a phone's
 * width on a phone): opened by its own outline button, with its title and Close, Escape closing
 * it, and the focus back on the button after (the shared Sheet). It replaces the fold-outs that
 * pushed the step's page down.
 */
export function SideDrawer({
  title,
  trigger,
  children,
}: {
  /** The drawer's heading, and its name. */
  title: string
  /** What the button that opens it says. */
  trigger: ReactNode
  children: ReactNode
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="self-start">
          {trigger}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-describedby={undefined}
        // The shared sheet caps a side at max-w-sm from sm; this one is max-w-md at every width.
        className="workbench flex w-full max-w-md flex-col gap-6 overflow-y-auto sm:max-w-md"
      >
        <div className="flex items-start justify-between gap-4">
          <SheetTitle className="text-h4">{title}</SheetTitle>
          <SheetClose asChild>
            <Button variant="outline" size="sm">
              Close
            </Button>
          </SheetClose>
        </div>
        {children}
      </SheetContent>
    </Sheet>
  )
}
