/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, jest, mock } from 'bun:test'
import { act, cleanup, render, screen } from '@testing-library/react'
import * as navigation from 'next/navigation'

let pathname = '/'
mock.module('next/navigation', () => ({ ...navigation, usePathname: () => pathname }))

const { Splash } = await import('./Splash')
const { SPLASH_SEEN_KEY } = await import('../model/splash-seen')

const realMatchMedia = window.matchMedia

// next/image resolves its src against the page's URL in development; happy-dom starts on
// about:blank, which cannot be a base.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => dom.setURL('http://localhost:3000/'))
afterAll(() => dom.setURL(startUrl))

// The quack is a <video> that loops muted from the page's start; as the duck grabs the f (1.62 s) it is unmuted and played
// once. play() records the element's state at the call; the browser's answer is set per test.
type PlayCall = { muted: boolean; loop: boolean; currentTime: number }
const calls: PlayCall[] = []
let answer: () => Promise<void> = () => Promise.resolve()
const realPlay = HTMLMediaElement.prototype.play
const quackVideo = () =>
  document.querySelector('[data-testid="splash"] video') as HTMLVideoElement | null

beforeEach(() => {
  pathname = '/'
  calls.length = 0
  answer = () => Promise.resolve()
  HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
    calls.push({ muted: this.muted, loop: this.loop, currentTime: this.currentTime })
    return answer()
  }
  jest.useFakeTimers()
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
  sessionStorage.clear()
  document.body.innerHTML = ''
  window.matchMedia = realMatchMedia
  HTMLMediaElement.prototype.play = realPlay
})

const reduceMotion = () => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('reduce'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms)
  })

/** The login page's left panel, where the splash lands. */
function target() {
  const panel = document.createElement('section')
  panel.setAttribute('data-splash-target', '')
  panel.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 512, height: 768, right: 512, bottom: 768, x: 0, y: 0 }) as DOMRect
  document.body.appendChild(panel)
}

it('plays on the first page of a tab', () => {
  render(<Splash />)
  const splash = screen.getByTestId('splash')
  expect(splash).toHaveAttribute('data-splash', 'play')
  expect(splash).toHaveAttribute('aria-hidden', 'true')
  expect(splash).toHaveTextContent('Of Course')
})

it('remembers it played only at the handover, at 3.25 s', async () => {
  render(<Splash />)
  await advance(3249)
  expect(sessionStorage.getItem(SPLASH_SEEN_KEY)).toBeNull()
  await advance(1)
  expect(sessionStorage.getItem(SPLASH_SEEN_KEY)).not.toBeNull()
})

it('plays again in full when its page is replaced mid-intro (a redirect that loads a new page)', async () => {
  render(<Splash />)
  await advance(400)
  cleanup()
  render(<Splash />)
  expect(screen.getByTestId('splash')).toHaveAttribute('data-splash', 'play')
})

it('removes itself at once when the tab has already seen it, and loads no sound', () => {
  sessionStorage.setItem(SPLASH_SEEN_KEY, 'seen')
  render(<Splash />)
  expect(screen.queryByTestId('splash')).toBeNull()
  expect(calls).toHaveLength(0)
})

it('never shows under /admin, and leaves the tab unmarked', () => {
  pathname = '/admin/sign-in'
  render(<Splash />)
  expect(screen.queryByTestId('splash')).toBeNull()
  expect(sessionStorage.getItem(SPLASH_SEEN_KEY)).toBeNull()
})

it('under reduced motion holds the final frame for 1.2 s, silent, then cuts', async () => {
  reduceMotion()
  render(<Splash />)
  expect(screen.getByTestId('splash')).toHaveAttribute('data-splash', 'still')
  await advance(1199)
  expect(screen.getByTestId('splash')).toBeInTheDocument()
  expect(sessionStorage.getItem(SPLASH_SEEN_KEY)).toBeNull()
  await advance(1)
  expect(screen.queryByTestId('splash')).toBeNull()
  expect(sessionStorage.getItem(SPLASH_SEEN_KEY)).not.toBeNull()
  await advance(5000)
  expect(quackVideo()).toBeNull()
  expect(calls).toHaveLength(0)
})

it('starts the quack muted and looping with the page, so the browser lets it be unmuted later', () => {
  render(<Splash />)
  const video = quackVideo()
  expect(video).not.toBeNull()
  // In the markup from the first paint: React would leave `muted` out of server HTML.
  for (const attr of ['autoplay', 'muted', 'loop', 'playsinline'])
    expect(video).toHaveAttribute(attr)
  expect(video).toHaveAttribute('src', '/brand/quack.mp4')
  // Hidden by size and opacity, never display:none, which would stop it playing.
  expect(video?.style.display).not.toBe('none')
  expect(video?.style.opacity).toBe('0')
})

it('as the duck grabs the f, at 1.62 s, plays the quack once from the start, unmuted', async () => {
  render(<Splash />)
  await advance(1619)
  expect(calls.some((c) => !c.muted)).toBe(false)
  await advance(1)
  expect(calls.at(-1)).toEqual({ muted: false, loop: false, currentTime: 0 })
  await act(async () => {
    await Promise.resolve()
  })
  expect(quackVideo()?.muted).toBe(false)
})

it('when the browser refuses the sound, mutes it again and stays silent, without an error', async () => {
  answer = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'))
  const errors = mock((..._: unknown[]) => {})
  const realError = console.error
  console.error = errors
  const unhandled = mock((_: unknown) => {})
  process.on('unhandledRejection', unhandled)
  try {
    render(<Splash />)
    await advance(1620)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(quackVideo()?.muted).toBe(true)
    expect(unhandled).not.toHaveBeenCalled()
    expect(errors).not.toHaveBeenCalled()
  } finally {
    console.error = realError
    process.off('unhandledRejection', unhandled)
  }
})

it('at 3.25 s shrinks onto the login panel, and is gone 1.3 s later', async () => {
  target()
  render(<Splash />)
  await advance(3249)
  expect(screen.getByTestId('splash')).toHaveAttribute('data-splash', 'play')
  await advance(1)
  const splash = screen.getByTestId('splash')
  expect(splash).toHaveAttribute('data-splash', 'morph')
  // The ground lands on the panel's box: a transform from the whole viewport, never a clip.
  const ground = splash.querySelector('[data-splash-ground]') as HTMLElement
  expect(ground.style.getPropertyValue('--splash-to')).toBe(
    `translate(0px, 0px) scale(${512 / window.innerWidth}, ${768 / window.innerHeight})`,
  )
  await advance(1299)
  expect(screen.getByTestId('splash')).toBeInTheDocument()
  await advance(1)
  expect(screen.queryByTestId('splash')).toBeNull()
})

it('with no login panel to land on (a deep link), fades out instead', async () => {
  render(<Splash />)
  await advance(3250)
  expect(screen.getByTestId('splash')).toHaveAttribute('data-splash', 'fade')
  await advance(349)
  expect(screen.getByTestId('splash')).toBeInTheDocument()
  await advance(1)
  expect(screen.queryByTestId('splash')).toBeNull()
})
