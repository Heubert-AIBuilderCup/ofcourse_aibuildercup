/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />

import { afterEach, describe, expect, it, jest } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { type ReactNode, useState } from 'react'
import { SlidePreview } from './SlidePreview'
import {
  type ActionTab,
  ActionTabs,
  holdOnWork,
  SideDrawer,
  SlideStage,
  StepTabs,
  shownTab,
} from './stage'

afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

// The shared pieces of the workbench's slide steps: the stage with its filmstrip, the tabs on the
// right, and the drawer for detail opened now and then. Compared as strings and attributes.

/** A slide as the caller draws it: a picture named by its place. */
const picture = (n: number) => <span key={n} role="img" aria-label={`Picture ${n}`} />

/** The stage with its selection held above it, as a step holds it. */
function Held({ count, start = 0, below }: { count: number; start?: number; below?: ReactNode }) {
  const [selected, onSelect] = useState(start)
  const slides = Array.from({ length: count }, (_, i) => picture(i + 1))
  return (
    <>
      <SlideStage slides={slides} selected={selected} onSelect={onSelect} below={below} />
      <input aria-label="Elsewhere" />
    </>
  )
}

/** The slide shown big: the pictures a reader sees (the filmstrip's are hidden from them). */
const shown = () => screen.getAllByRole('img').map((img) => img.getAttribute('aria-label') ?? '')
const thumbs = () => within(screen.getByRole('list', { name: 'All slides' })).getAllByRole('button')
const current = () =>
  thumbs()
    .filter((t) => t.getAttribute('aria-current') === 'true')
    .map((t) => t.getAttribute('aria-label'))
const stage = () => screen.getByRole('group', { name: 'Slides, one at a time' })

describe('SlideStage', () => {
  it('shows the selected slide big and one thumbnail per slide, the selected one current', () => {
    render(<Held count={5} start={1} />)
    expect(shown()).toEqual(['Picture 2'])
    expect(thumbs().map((t) => t.getAttribute('aria-label'))).toEqual([
      'Slide 1',
      'Slide 2',
      'Slide 3',
      'Slide 4',
      'Slide 5',
    ])
    expect(current()).toEqual(['Slide 2'])
    expect(screen.getByText('Slide 2 of 5').textContent).toBe('Slide 2 of 5')
  })

  it('selects a slide by its thumbnail', () => {
    render(<Held count={5} />)
    fireEvent.click(thumbs()[3])
    expect(shown()).toEqual(['Picture 4'])
    expect(current()).toEqual(['Slide 4'])
  })

  it('moves the selection with Left and Right while the stage has focus, stopping at the ends', () => {
    render(<Held count={3} />)
    stage().focus()
    fireEvent.keyDown(stage(), { key: 'ArrowLeft' })
    expect(current()).toEqual(['Slide 1'])
    fireEvent.keyDown(stage(), { key: 'ArrowRight' })
    expect(current()).toEqual(['Slide 2'])
    fireEvent.keyDown(stage(), { key: 'ArrowRight' })
    fireEvent.keyDown(stage(), { key: 'ArrowRight' })
    expect(current()).toEqual(['Slide 3'])
    expect(shown()).toEqual(['Picture 3'])
    fireEvent.keyDown(stage(), { key: 'ArrowLeft' })
    expect(current()).toEqual(['Slide 2'])
  })

  it('from a focused thumbnail, moves the selection and the focus with it', () => {
    render(<Held count={3} />)
    thumbs()[0].focus()
    fireEvent.keyDown(thumbs()[0], { key: 'ArrowRight' })
    expect(current()).toEqual(['Slide 2'])
    expect(document.activeElement === thumbs()[1]).toBe(true)
  })

  it('leaves the arrow keys to a field inside the slide', () => {
    const moves: number[] = []
    render(
      <SlideStage
        slides={[<input key="1" aria-label="Heading" />, picture(2)]}
        selected={0}
        onSelect={(i) => moves.push(i)}
      />,
    )
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Heading' }), { key: 'ArrowRight' })
    expect(moves).toEqual([])
    fireEvent.keyDown(stage(), { key: 'ArrowRight' })
    expect(moves).toEqual([1])
  })

  it('clamps a selection beyond the slides to the last, and below the first to the first', () => {
    render(<Held count={3} start={7} />)
    expect(shown()).toEqual(['Picture 3'])
    expect(current()).toEqual(['Slide 3'])
    cleanup()
    render(<Held count={3} start={-2} />)
    expect(shown()).toEqual(['Picture 1'])
    expect(current()).toEqual(['Slide 1'])
  })

  it('names each thumbnail, and the slide shown, by the names the caller gives', () => {
    render(
      <SlideStage
        label="Pictures, one at a time"
        slides={[picture(1), picture(2)]}
        names={['Cover picture', 'Picture after section 2']}
        selected={1}
        onSelect={() => {}}
      />,
    )
    expect(thumbs().map((t) => t.getAttribute('aria-label'))).toEqual([
      'Cover picture',
      'Picture after section 2',
    ])
    expect(current()).toEqual(['Picture after section 2'])
    expect(screen.getByText('Picture after section 2 · 2 of 2').textContent).toBe(
      'Picture after section 2 · 2 of 2',
    )
  })

  it('shows what the caller puts below the slide', () => {
    render(<Held count={2} below={<p>Daily image limit reached.</p>} />)
    expect(screen.getByText('Daily image limit reached.').textContent).toBe(
      'Daily image limit reached.',
    )
  })

  it('a slide that fails to load twice says so with Retry on the stage, and a "!" in its thumbnail (18 Oct)', () => {
    jest.useFakeTimers()
    const { container } = render(
      <SlideStage
        slides={[<SlidePreview key={1} slide={1} assetId="a1" />]}
        selected={0}
        onSelect={() => {}}
      />,
    )
    const failAll = () => {
      for (const img of container.querySelectorAll('img')) fireEvent.error(img)
    }
    failAll()
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    failAll()
    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1)
    expect(screen.getAllByText("This slide's preview didn't load.")).toHaveLength(1)
    expect(screen.getAllByText('!')).toHaveLength(1)
  })
})

const TABS: ActionTab[] = [
  { name: 'Versions', badge: { text: '3' }, body: <p>The versions</p> },
  { name: 'Style', body: <p>The style</p> },
  {
    name: 'Redraft',
    badge: { text: 'Fix', label: 'needs attention', problem: true },
    body: <p>The redraft</p>,
  },
]

const tablist = () => screen.getByRole('tablist', { name: 'Text controls' })
const tabs = () => within(tablist()).getAllByRole('tab')
const selectedTab = () =>
  tabs()
    .filter((t) => t.getAttribute('aria-selected') === 'true')
    .map((t) => t.getAttribute('id'))

/** The tabs with the open one held above them. */
function HeldTabs({ start }: { start: number }) {
  const [at, onGo] = useState(start)
  return <ActionTabs label="Text controls" tabs={TABS} at={at} onGo={onGo} />
}

describe('ActionTabs', () => {
  it('names each tab with its badge, opens the first, and renders only the open panel', () => {
    render(<ActionTabs label="Text controls" tabs={TABS} />)
    expect(within(tablist()).getByRole('tab', { name: 'Versions · 3' })).toBeInTheDocument()
    const redraft = within(tablist()).getByRole('tab', { name: 'Redraft · needs attention' })
    expect(redraft.textContent).toContain('Fix')
    const versions = within(tablist()).getByRole('tab', { name: 'Versions · 3' })
    expect(versions.getAttribute('aria-selected')).toBe('true')
    const panel = screen.getByRole('tabpanel', { name: 'Versions · 3' })
    expect(panel.id).toBe(versions.getAttribute('aria-controls') ?? 'none')
    expect(panel.textContent).toBe('The versions')
    expect(screen.queryByText('The style') === null).toBe(true)
    expect(screen.queryAllByRole('tabpanel').length).toBe(1)
  })

  it('opens a tab on click', () => {
    render(<ActionTabs label="Text controls" tabs={TABS} />)
    fireEvent.click(within(tablist()).getByRole('tab', { name: 'Style' }))
    expect(screen.getByRole('tabpanel', { name: 'Style' }).textContent).toBe('The style')
    expect(screen.queryByText('The versions') === null).toBe(true)
  })

  it('moves with the arrow keys, Home and End, wrapping, the focus following; only the open tab is in the tab order', () => {
    render(<HeldTabs start={0} />)
    const ids = tabs().map((t) => t.getAttribute('id'))
    expect(tabs().map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1'])
    fireEvent.keyDown(tabs()[0], { key: 'ArrowRight' })
    expect(selectedTab()).toEqual([ids[1]])
    expect(document.activeElement === tabs()[1]).toBe(true)
    expect(tabs().map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '0', '-1'])
    fireEvent.keyDown(tabs()[1], { key: 'End' })
    expect(selectedTab()).toEqual([ids[2]])
    fireEvent.keyDown(tabs()[2], { key: 'ArrowRight' })
    expect(selectedTab()).toEqual([ids[0]])
    fireEvent.keyDown(tabs()[0], { key: 'ArrowLeft' })
    expect(selectedTab()).toEqual([ids[2]])
    fireEvent.keyDown(tabs()[2], { key: 'Home' })
    expect(selectedTab()).toEqual([ids[0]])
    expect(document.activeElement === tabs()[0]).toBe(true)
  })

  it('makes the panel focusable, so Tab from the tablist lands in it', () => {
    render(<ActionTabs label="Text controls" tabs={TABS} />)
    expect(screen.getByRole('tabpanel').getAttribute('tabindex')).toBe('0')
  })

  it('clamps an open tab beyond the tabs to the last', () => {
    render(<HeldTabs start={9} />)
    expect(screen.getByRole('tabpanel').textContent).toBe('The redraft')
  })
})

/** The step's tabs with the open one held by its name, over the groups it is given. */
function HeldStepTabs({
  groups,
  start,
  initial,
}: {
  groups: ActionTab[]
  start: string | null
  initial?: string
}) {
  const [open, onOpen] = useState(start)
  return (
    <StepTabs label="Text controls" tabs={groups} open={open} initial={initial} onOpen={onOpen} />
  )
}

describe('StepTabs', () => {
  it('keeps the open tab by its name while the groups before it come and go', () => {
    const { rerender } = render(<HeldStepTabs groups={TABS.slice(1)} start="Style" />)
    fireEvent.click(within(tablist()).getByRole('tab', { name: 'Redraft · needs attention' }))
    rerender(<HeldStepTabs groups={TABS} start="Style" />)
    expect(screen.getByRole('tabpanel').textContent).toBe('The redraft')
  })

  it('opens the first when the open one is gone', () => {
    render(<HeldStepTabs groups={TABS} start="Gone" />)
    expect(screen.getByRole('tabpanel').textContent).toBe('The versions')
  })

  it('opens on the tab the step needs first while none is held, or the held one is gone', () => {
    render(<HeldStepTabs groups={TABS} start={null} initial="Redraft" />)
    expect(screen.getByRole('tabpanel').textContent).toBe('The redraft')
    cleanup()
    render(<HeldStepTabs groups={TABS} start="Gone" initial="Style" />)
    expect(screen.getByRole('tabpanel').textContent).toBe('The style')
    cleanup()
    render(<HeldStepTabs groups={TABS} start={null} initial="Gone" />)
    expect(screen.getByRole('tabpanel').textContent).toBe('The versions')
  })

  it('shows a single group without tabs, and nothing for none', () => {
    const { container, rerender } = render(<HeldStepTabs groups={TABS.slice(1, 2)} start="" />)
    expect(screen.queryAllByRole('tablist').length).toBe(0)
    expect(container.textContent).toBe('The style')
    rerender(<HeldStepTabs groups={[]} start="" />)
    expect(container.textContent).toBe('')
  })
})

describe('shownTab', () => {
  it('is the held tab while it shows, else the one needed first, else the first', () => {
    expect(shownTab(TABS, 'Style', 'Redraft')).toBe(1)
    expect(shownTab(TABS, null, 'Redraft')).toBe(2)
    expect(shownTab(TABS, 'Gone', 'Redraft')).toBe(2)
    expect(shownTab(TABS, null, 'Gone')).toBe(0)
    expect(shownTab(TABS, null)).toBe(0)
  })
})

/** A step whose open tab is held by name above it, pinned once she works in it. */
function Working({ initial }: { initial: string }) {
  const [open, onOpen] = useState<string | null>(null)
  const shown = TABS[shownTab(TABS, open, initial)]?.name
  return (
    <section aria-label="Step" {...holdOnWork({ open, onOpen }, shown)}>
      <output aria-label="Held">{open ?? 'none'}</output>
      <input aria-label="A field" />
      <StepTabs label="Text controls" tabs={TABS} open={open} initial={initial} onOpen={onOpen} />
    </section>
  )
}

describe('holdOnWork', () => {
  const held = () => screen.getByRole('status', { name: 'Held' }).textContent

  it('holds nothing until she works in the step (a focus alone is no work), then the tab shown', () => {
    render(<Working initial="Style" />)
    expect(held()).toBe('none')
    fireEvent.focus(screen.getByRole('textbox', { name: 'A field' }))
    expect(held()).toBe('none')
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'A field' }), { key: 'a' })
    expect(held()).toBe('Style')
  })

  it('holds the tab she moves to with a key, not the one it moved from', () => {
    render(<Working initial="Versions" />)
    fireEvent.keyDown(within(tablist()).getByRole('tab', { name: 'Versions · 3' }), {
      key: 'ArrowRight',
    })
    expect(held()).toBe('Style')
  })

  it('holds the tab shown on a press inside the step, and the one she opens after it', () => {
    render(<Working initial="Style" />)
    fireEvent.click(screen.getByRole('textbox', { name: 'A field' }))
    expect(held()).toBe('Style')
    fireEvent.click(within(tablist()).getByRole('tab', { name: 'Versions · 3' }))
    expect(held()).toBe('Versions')
  })
})

describe('SideDrawer', () => {
  const drawer = () => screen.queryByRole('dialog', { name: 'All checked sentences' })
  const opener = () => screen.getByRole('button', { name: 'All checked sentences' })

  const open = () => {
    render(
      <SideDrawer title="All checked sentences" trigger="All checked sentences">
        <p>Three sentences</p>
      </SideDrawer>,
    )
    expect(drawer() === null).toBe(true)
    opener().focus()
    fireEvent.click(opener())
  }

  it('opens from its button, with its title and its content', () => {
    open()
    const dialog = drawer()
    if (!dialog) throw new Error('no drawer')
    expect(within(dialog).getByText('Three sentences').textContent).toBe('Three sentences')
  })

  it('closes on Escape and gives the focus back to its button', async () => {
    open()
    const dialog = drawer()
    if (!dialog) throw new Error('no drawer')
    await act(async () => {
      fireEvent.keyDown(dialog, { key: 'Escape' })
    })
    expect(drawer() === null).toBe(true)
    // The sheet gives the focus back once it has unmounted, on the next task.
    await waitFor(() => expect(document.activeElement === opener()).toBe(true))
  })

  it('closes from its own Close button', async () => {
    open()
    const dialog = drawer()
    if (!dialog) throw new Error('no drawer')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    })
    expect(drawer() === null).toBe(true)
    await waitFor(() => expect(document.activeElement === opener()).toBe(true))
  })
})
