/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test'
import { nestedScroll, wheelGate } from './wheel'

describe('wheelGate: one wheel gesture moves one post, as TikTok does', () => {
  test('the first event of a gesture steps by its direction', () => {
    const gate = wheelGate()
    expect(gate(1000, 40)).toBe(1)
    expect(wheelGate()(1000, -40)).toBe(-1)
  })

  test("a trackpad's long tail of events, each close to the last, steps once", () => {
    const gate = wheelGate()
    const steps = [0, 16, 32, 48, 120, 260, 400, 560, 700, 850].map((dt, i) =>
      gate(1000 + dt, 60 - i * 5),
    )
    expect(steps.filter((s) => s !== 0).length).toBe(1)
  })

  test('a new gesture after a pause steps again', () => {
    const gate = wheelGate()
    expect(gate(1000, 40)).toBe(1)
    expect(gate(1100, 30)).toBe(0)
    expect(gate(1800, 40)).toBe(1)
  })

  test('two flicks closer together than the step takes to land move one post', () => {
    const gate = wheelGate()
    expect(gate(1000, 40)).toBe(1)
    // A pause long enough to end the gesture, but the first step is still landing.
    expect(gate(1300, 40)).toBe(0)
  })

  test('a tiny nudge moves nothing and starts no gesture', () => {
    const gate = wheelGate()
    expect(gate(1000, 2)).toBe(0)
    expect(gate(1010, 40)).toBe(1)
  })
})

/** An element in the page, where its computed style is read. */
function attached(tag: string): HTMLElement {
  const el = document.createElement(tag)
  document.body.append(el)
  return el
}

/** An element that scrolls along `axis`: `size` of content in a 100 box, at `at`. */
function scroller(axis: 'x' | 'y', size: number, at: number): HTMLElement {
  const el = document.createElement('div')
  el.style[axis === 'y' ? 'overflowY' : 'overflowX'] = 'auto'
  const [scroll, client, pos] =
    axis === 'y'
      ? ['scrollHeight', 'clientHeight', 'scrollTop']
      : ['scrollWidth', 'clientWidth', 'scrollLeft']
  Object.defineProperty(el, scroll, { value: size, configurable: true })
  Object.defineProperty(el, client, { value: 100, configurable: true })
  Object.defineProperty(el, pos, { value: at, configurable: true, writable: true })
  return el
}

describe('nestedScroll: a scroller inside the feed takes the wheel while it can still move', () => {
  afterEach(() => document.body.replaceChildren())
  test('an overflowing box between the target and the feed, not at that end, takes it', () => {
    const feed = attached('section')
    const panel = scroller('y', 400, 0)
    const text = document.createElement('p')
    panel.append(text)
    feed.append(panel)
    expect(nestedScroll(text, feed, 'y', 40)).toBe(true)
    expect(nestedScroll(text, feed, 'y', -40)).toBe(false)
  })

  test('at its end in the gesture’s direction it leaves the wheel to the feed', () => {
    const feed = attached('section')
    const panel = scroller('y', 400, 300)
    feed.append(panel)
    expect(nestedScroll(panel, feed, 'y', 40)).toBe(false)
    expect(nestedScroll(panel, feed, 'y', -40)).toBe(true)
  })

  test('a box that overflows without scrolling, or fits, never takes it', () => {
    const feed = attached('section')
    const visible = scroller('y', 400, 0)
    visible.style.overflowY = 'visible'
    const fits = scroller('y', 100, 0)
    feed.append(visible, fits)
    expect(nestedScroll(visible, feed, 'y', 40)).toBe(false)
    expect(nestedScroll(fits, feed, 'y', 40)).toBe(false)
  })

  test('sideways, for a post’s slides, by the same rule', () => {
    const strip = attached('ol')
    const inner = scroller('x', 400, 0)
    strip.append(inner)
    expect(nestedScroll(inner, strip, 'x', 40)).toBe(true)
    expect(nestedScroll(inner, strip, 'y', 40)).toBe(false)
  })

  test('stops at the feed: the feed itself is never asked', () => {
    const feed = scroller('y', 400, 0)
    const text = document.createElement('p')
    feed.append(text)
    expect(nestedScroll(text, feed, 'y', 40)).toBe(false)
  })
})
