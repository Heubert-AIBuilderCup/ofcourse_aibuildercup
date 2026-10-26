/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />

import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Body } from '../model/artifacts'
import {
  Control,
  DailyLimits,
  FailedLine,
  MarketSlides,
  Move,
  RenderedSlides,
  StepAction,
} from './parts'

afterEach(cleanup)

const CONFIRM = { question: 'Go back to source?', body: <p>Kept</p>, go: 'Go back' }

describe('Move with a confirm', () => {
  it('moves focus to "Stay" when the confirm opens, and back to the trigger when Stay closes it', () => {
    const onGo = mock(() => {})
    render(
      <Move label="Back to source" waiting={null} pending={false} onGo={onGo} confirm={CONFIRM} />,
    )
    const trigger = screen.getByRole('button', { name: 'Back to source' })
    trigger.focus()
    fireEvent.click(trigger)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Stay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }))
    expect(screen.queryByRole('button', { name: 'Stay' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Back to source' }))
    expect(onGo).not.toHaveBeenCalled()
  })
})

describe('Control', () => {
  it('opens its reason from the start of its row, or from the end in the step bar (never off the panel)', () => {
    render(
      <Control reason="Plan the character first.">
        <button type="button" disabled>
          Draw
        </button>
      </Control>,
    )
    expect(screen.getByRole('tooltip', { hidden: true }).getAttribute('data-align')).toBe('start')
    cleanup()
    render(
      <StepAction>
        <Control reason="Remove each claim the source check could not find.">
          <button type="button" disabled>
            Send to review
          </button>
        </Control>
      </StepAction>,
    )
    expect(screen.getByRole('tooltip', { hidden: true }).getAttribute('data-align')).toBe('end')
  })

  it('with a reason, shows one badge whose description is the reason in a tooltip', () => {
    render(
      <Control reason="Plan the character first.">
        <button type="button" disabled>
          Draw
        </button>
      </Control>,
    )
    const badges = screen.getAllByRole('button', { name: 'Why this is unavailable' })
    expect(badges.length).toBe(1)
    const id = badges[0]?.getAttribute('aria-describedby') ?? ''
    const tip = id ? document.getElementById(id) : null
    expect(tip?.textContent).toBe('Plan the character first.')
    expect(tip?.getAttribute('role')).toBe('tooltip')
  })

  const reasonRow = () =>
    render(
      <Control reason="Plan the character first.">
        <button type="button" disabled>
          Draw
        </button>
      </Control>,
    )
  const badge = () => screen.getByRole('button', { name: 'Why this is unavailable' })
  const tooltip = () => screen.getByRole('tooltip', { hidden: true })

  it('hides the reason on Escape from the badge until focus leaves the row (WCAG 1.4.13)', () => {
    reasonRow()
    expect(tooltip().hasAttribute('data-dismissed')).toBe(false)
    badge().focus()
    fireEvent.keyDown(badge(), { key: 'Escape' })
    expect(tooltip().hasAttribute('data-dismissed')).toBe(true)
    fireEvent.blur(badge(), { relatedTarget: null })
    expect(tooltip().hasAttribute('data-dismissed')).toBe(false)
  })

  it('hides the reason on Escape while the row is hovered, until the pointer leaves', () => {
    const { container } = reasonRow()
    const row = container.firstElementChild as HTMLElement
    fireEvent.pointerEnter(row)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(tooltip().hasAttribute('data-dismissed')).toBe(true)
    fireEvent.pointerLeave(row)
    expect(tooltip().hasAttribute('data-dismissed')).toBe(false)
  })

  it('keeps the reason for any other key', () => {
    reasonRow()
    fireEvent.keyDown(badge(), { key: 'Enter' })
    expect(tooltip().hasAttribute('data-dismissed')).toBe(false)
  })

  describe('measured on show: it opens toward the side with room in its scrolling area (18 Oct)', () => {
    type Box = { left: number; right: number }
    const stub = (el: Element, { left, right }: Box) => {
      el.getBoundingClientRect = () =>
        ({ left, right, width: right - left, top: 0, bottom: 20, height: 20 }) as DOMRect
    }
    /** A row inside a scrolling area, each box stubbed, the tooltip 200px wide. */
    const measured = (row: Box, area: Box, inBar = false) => {
      const control = (
        <Control reason="Fix the failing fit checks before rendering.">
          <button type="button" disabled>
            Draw images
          </button>
        </Control>
      )
      render(
        <div data-testid="area" style={{ overflowY: 'auto' }}>
          {inBar ? <StepAction>{control}</StepAction> : control}
        </div>,
      )
      stub(screen.getByTestId('area'), area)
      stub(tooltip().parentElement as Element, row)
      stub(tooltip(), { left: 0, right: 200 })
    }

    it('opens from the end when the start would run past the area’s right edge', () => {
      measured({ left: 300, right: 400 }, { left: 0, right: 420 })
      expect(tooltip().getAttribute('data-align')).toBe('start')
      fireEvent.pointerEnter(tooltip().parentElement as Element)
      expect(tooltip().getAttribute('data-align')).toBe('end')
    })

    it('opens from the start in the step bar when the end would run past the area’s left edge, on focus too', () => {
      measured({ left: 20, right: 120 }, { left: 0, right: 900 }, true)
      expect(tooltip().getAttribute('data-align')).toBe('end')
      fireEvent.focus(badge())
      expect(tooltip().getAttribute('data-align')).toBe('start')
    })

    it('keeps its own side while that side has room', () => {
      measured({ left: 300, right: 400 }, { left: 0, right: 900 })
      fireEvent.pointerEnter(tooltip().parentElement as Element)
      expect(tooltip().getAttribute('data-align')).toBe('start')
    })
  })

  it('without a reason, shows only the control', () => {
    render(
      <Control reason={null}>
        <button type="button">Draw</button>
      </Control>,
    )
    expect(screen.queryAllByRole('button', { name: 'Why this is unavailable' }).length).toBe(0)
    expect(screen.queryAllByRole('tooltip', { hidden: true }).length).toBe(0)
  })
})

/** A drawn post of three slides, no fallback on its cover. */
const RENDER: Body<'render'> = {
  revisionId: 'rev1',
  layoutId: 'lay1',
  art: { assetId: null, prompt: '', version: 1, fallback: null },
  slides: [1, 2, 3].map((n) => ({ svgAssetId: `s${n}`, pngAssetId: `png${n}` })),
}

/** Its Nepal version, three slides of its own. */
const MARKET: Body<'market'> = {
  revisionId: 'rev1',
  renderId: 'ren1',
  market: 'NP',
  slots: [],
  feedExcerpt: 'Deciding with your family?',
  conversions: [],
  layout: [],
  fitChecks: [],
  slides: [1, 2, 3].map((n) => ({ svgAssetId: `ns${n}`, pngAssetId: `npng${n}` })),
  replays: [],
}

const shownSrc = () => screen.getAllByRole('img').map((img) => img.getAttribute('src') ?? '')
/** The filmstrip's thumbnail of slide `n`, and which one is marked as shown. */
const thumb = (n: number) => screen.getByRole('button', { name: `Slide ${n}` })
const currentThumb = () =>
  screen
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-current') === 'true')
    .map((b) => b.getAttribute('aria-label'))

describe('the selected slide over a filmstrip on Settings, with `stage` (criterion 5)', () => {
  it('opens a render on its first slide alone, a thumbnail per slide, the first marked', () => {
    render(<RenderedSlides render={RENDER} stage />)
    const group = screen.getByRole('group', { name: 'Slides, one at a time' })
    expect(group.getAttribute('aria-roledescription')).toBe('carousel')
    expect(group.className.includes('overflow-x-auto')).toBe(false)
    expect(shownSrc()).toEqual(['/admin/assets/png1'])
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Slide 1',
      'Slide 2',
      'Slide 3',
    ])
    expect(currentThumb()).toEqual(['Slide 1'])
  })

  it('shows the slide whose thumbnail is pressed', () => {
    render(<RenderedSlides render={RENDER} stage />)
    fireEvent.click(thumb(2))
    expect(shownSrc()).toEqual(['/admin/assets/png2'])
    expect(currentThumb()).toEqual(['Slide 2'])
    fireEvent.click(thumb(3))
    expect(shownSrc()).toEqual(['/admin/assets/png3'])
  })

  it('says the cover’s fallback under the cover only', () => {
    const replayed: Body<'render'> = { ...RENDER, art: { ...RENDER.art, fallback: 'replay' } }
    render(<RenderedSlides render={replayed} stage />)
    expect(screen.getByText('Replay').textContent).toBe('Replay')
    fireEvent.click(thumb(2))
    expect(screen.queryByText('Replay') === null).toBe(true)
  })

  it('steps through a market version the same way, its feed excerpt still under it', () => {
    render(<MarketSlides market={MARKET} stage />)
    expect(shownSrc()).toEqual(['/admin/assets/npng1'])
    expect(currentThumb()).toEqual(['Slide 1'])
    fireEvent.click(thumb(2))
    expect(shownSrc()).toEqual(['/admin/assets/npng2'])
    expect(screen.getByText('Deciding with your family?').textContent).toBe(
      'Deciding with your family?',
    )
  })

  it('shows the slide the caller holds, and hands a pressed thumbnail to it', () => {
    const picked: number[] = []
    const replayed: Body<'render'> = { ...RENDER, art: { ...RENDER.art, fallback: 'replay' } }
    render(<RenderedSlides render={replayed} stage selected={1} onSelect={(i) => picked.push(i)} />)
    expect(shownSrc()).toEqual(['/admin/assets/png2'])
    expect(currentThumb()).toEqual(['Slide 2'])
    expect(screen.queryByText('Replay') === null).toBe(true)
    fireEvent.click(thumb(3))
    expect(picked).toEqual([2])
    // The caller moves it: until then the stage stays where it was.
    expect(shownSrc()).toEqual(['/admin/assets/png2'])
  })

  it('steps a market version the caller holds the same way', () => {
    const picked: number[] = []
    render(<MarketSlides market={MARKET} stage selected={2} onSelect={(i) => picked.push(i)} />)
    expect(shownSrc()).toEqual(['/admin/assets/npng3'])
    fireEvent.click(thumb(1))
    expect(picked).toEqual([0])
  })
})

describe('the image Limit line on a cover the day’s cap refused', () => {
  const LIMITED: Body<'render'> = { ...RENDER, art: { ...RENDER.art, fallback: 'daily_limit' } }
  const caption = () => screen.getByText('Limit').closest('figcaption')?.textContent ?? ''

  it('says the cap, why, when it resets and who to email, given a support address', () => {
    render(
      <DailyLimits imageCap={600} support="nikhil@heubert.com">
        <RenderedSlides render={LIMITED} />
      </DailyLimits>,
    )
    expect(caption()).toBe(
      "LimitToday's limit of 600 images is used up. OfCourse caps paid AI calls a day to keep costs down. It resets at 05:30 IST (midnight UTC). Need it sooner? Email nikhil@heubert.com.",
    )
  })

  it('without a support address, says only to wait', () => {
    render(
      <DailyLimits imageCap={600} support={null}>
        <RenderedSlides render={LIMITED} />
      </DailyLimits>,
    )
    expect(caption().includes('Email')).toBe(false)
    expect(caption().includes('It resets at 05:30 IST (midnight UTC).')).toBe(true)
  })
})

describe('FailedLine', () => {
  const words = 'Writing failed. Your outline is kept.'

  it('says why a daily limit exists, when it resets and who to email, under the workbench', () => {
    render(
      <DailyLimits imageCap={600} support="nikhil@heubert.com">
        <FailedLine words={words} reason="daily_limit" />
      </DailyLimits>,
    )
    const text = screen.getByText(/^Writing failed/).textContent ?? ''
    expect(text).toContain('OfCourse caps paid AI calls a day to keep costs down.')
    expect(text).toContain('It resets at 05:30 IST (midnight UTC).')
    expect(text).toContain('Email nikhil@heubert.com.')
  })

  it('keeps the short sentence outside the workbench, and for other reasons', () => {
    render(<FailedLine words={words} reason="daily_limit" />)
    expect(screen.getByText(/^Writing failed/).textContent).not.toContain('Email')
    cleanup()
    render(
      <DailyLimits imageCap={600} support="nikhil@heubert.com">
        <FailedLine words={words} reason="busy" />
      </DailyLimits>,
    )
    expect(screen.getByText(/^Writing failed/).textContent).not.toContain('caps paid AI calls')
  })
})
