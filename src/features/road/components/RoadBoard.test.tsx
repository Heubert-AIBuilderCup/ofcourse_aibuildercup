/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  mock,
  spyOn,
} from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'

let query = ''
// The route below /road's layout: [] at /road, ['learn', id] over the lesson, ['route', id].
let segments: string[] = []
const LESSON = ['learn', 'masters-years']
const router = { push: mock(), replace: mock(), refresh: mock(), back: mock(), prefetch: mock() }
mock.module('next/navigation', () => ({
  ...navigation,
  useSearchParams: () => new URLSearchParams(query),
  usePathname: () => ['/road', ...segments].join('/'),
  useSelectedLayoutSegments: () => segments,
  useRouter: () => router,
}))
mock.module('@/shared/lib/theme-actions', () => ({ setThemeChoice: async () => {} }))

const { Providers } = await import('@/shared/components/Providers')
const { getRoad } = await import('../model/road-data')
const { RoadBoard } = await import('./RoadBoard')
const { ARRIVED_KEY } = await import('../hooks/useFirstArrival')

const road = getRoad()

// The map measures itself: give every element a 1440 × 900 box, as on a laptop.
const box = (name: 'clientWidth' | 'clientHeight', px: number) =>
  Object.defineProperty(HTMLElement.prototype, name, { configurable: true, get: () => px })
const realMatchMedia = window.matchMedia
// next/image resolves its src against the page's URL; happy-dom starts on about:blank.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => {
  dom.setURL('http://localhost:3000/road')
  box('clientWidth', 1440)
  box('clientHeight', 900)
})
afterAll(() => {
  dom.setURL(startUrl)
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
  Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight')
})

let replace: ReturnType<typeof spyOn>
let push: ReturnType<typeof spyOn>
let back: ReturnType<typeof spyOn>
beforeEach(() => {
  // She has been here before: no first arrival unless a test asks for one.
  localStorage.setItem(ARRIVED_KEY, '1')
  push = spyOn(window.history, 'pushState').mockImplementation(() => {})
  back = spyOn(window.history, 'back').mockImplementation(() => {})
  for (const fn of Object.values(router)) fn.mockClear()
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
  replace = spyOn(window.history, 'replaceState').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  window.matchMedia = realMatchMedia
  replace.mockRestore()
  push.mockRestore()
  back.mockRestore()
  localStorage.clear()
  jest.useRealTimers()
  query = ''
  segments = []
})

const board = (children: ReactNode = null) =>
  render(
    <Providers initialChoice="light" systemTheme={null}>
      <RoadBoard road={road}>{children}</RoadBoard>
    </Providers>,
  )

const tile = (name: string) => screen.getByRole('button', { name })
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const heading = () => screen.getByRole('heading', { level: 1 })
const reduceMotion = () => {
  window.matchMedia = ((q: string) => ({
    matches: q.includes('reduce'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}
const zoom = () => screen.getByRole('group', { name: 'Zoom' })
const press = (el: HTMLElement) =>
  act(() => {
    fireEvent.click(el)
  })

describe('the map', () => {
  it('names each tile by its state and what a press does', () => {
    board()
    expect(tile('Cyber Security, you are here. Open in the card')).toBeInTheDocument()
    expect(tile('Perth, visited. Open in the card')).toBeInTheDocument()
    expect(tile('Data Science, not visited. Open in the card')).toBeInTheDocument()
    expect(tile('Student visa · 500, not visited, next. Open in the card')).toBeInTheDocument()
    expect(tile('Permanent residency, unexplored. Open in the card')).toBeInTheDocument()
  })

  it('opens a pressed tile in the card, and marks only that tile pressed', () => {
    board()
    expect(screen.getByText('You are here · Course')).toBeInTheDocument()

    press(tile('Data Science, not visited. Open in the card'))

    expect(screen.getByText('Not visited · Course')).toBeInTheDocument()
    expect(screen.queryByText('You are here · Course')).not.toBeInTheDocument()
    const pressed = screen
      .getAllByRole('button', { name: /\. Open in the card$/ })
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressed.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Data Science, not visited. Open in the card',
    ])
    expect(replace).toHaveBeenLastCalledWith(null, '', '/road?tile=data-science-uwa-perth')
  })

  it('at Whole road, a press first brings the camera to Level, then opens the tile', () => {
    query = 'zoom=whole'
    board()
    expect(within(zoom()).getByRole('button', { name: 'Whole road' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    press(tile('Adelaide, not visited. Open in the card'))

    expect(within(zoom()).getByRole('button', { name: 'Level' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('Not visited · City')).toBeInTheDocument()
  })

  it('closes the card with its Cancel, back to where she is', () => {
    query = 'tile=adelaide'
    board()
    press(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('You are here · Course')).toBeInTheDocument()
    expect(replace).toHaveBeenLastCalledWith(null, '', '/road')
  })
})

describe('zoom', () => {
  it('is a group with the current stop pressed, and says each change in the live region', () => {
    board()
    const group = zoom()
    expect(within(group).getByRole('button', { name: 'Level' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    press(within(group).getByRole('button', { name: 'Tile' }))

    expect(within(group).getByRole('button', { name: 'Tile' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(group).getByRole('button', { name: 'Level' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByText('Zoom: Tile')).toHaveAttribute('aria-live', 'polite')
    expect(replace).toHaveBeenLastCalledWith(null, '', '/road?zoom=tile')
  })

  it('steps one stop out with −, and holds at Whole road', () => {
    board()
    const out = within(zoom()).getByRole('button', { name: 'Zoom out' })
    press(out)
    expect(screen.getByText('Zoom: Whole road')).toBeInTheDocument()
    expect(out).toHaveAttribute('aria-disabled', 'true')
  })
})

describe('the card column', () => {
  it('a deep link to the lesson or a route step shows it in the first render (the server’s HTML)', () => {
    const firstRender = () =>
      renderToString(
        <Providers initialChoice="light" systemTheme={null}>
          <RoadBoard road={road}>{null}</RoadBoard>
        </Providers>,
      )
    segments = ['learn', 'masters-years']
    expect(firstRender()).toContain('The Master’s years, in 3 minutes')
    segments = ['route', 'student-visa-500']
    expect(firstRender()).toContain('Route detail comes in the next round.')
  })

  it('shows the lesson its route names, and closes it when the route leaves it (Back)', () => {
    segments = LESSON
    const { rerender } = board()
    expect(screen.getByText('The Master’s years, in 3 minutes')).toBeInTheDocument()

    segments = []
    rerender(
      <Providers initialChoice="light" systemTheme={null}>
        <RoadBoard road={road}>{null}</RoadBoard>
      </Providers>,
    )
    expect(screen.queryByText('The Master’s years, in 3 minutes')).not.toBeInTheDocument()
  })

  it('shows a route step’s placeholder with a way back to the road', () => {
    segments = ['route', 'student-visa-500']
    board()
    expect(screen.getByText('Route detail comes in the next round.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to your road' })).toHaveAttribute('href', '/road')
  })
})

const SWAP_TOAST = 'Data Science is on your road now. The road ahead re-routed through it.'
const ADD_TOAST =
  'Information Systems is on your board, beside your road. Data Science folded into the stack.'
const READ_TOAST = 'Lesson read. The Master’s years now show as looked at.'

describe('the card’s actions', () => {
  it('swaps the alternative onto her road, says so with Undo, and Undo puts it back', () => {
    reduceMotion()
    query = 'tile=data-science-uwa-perth'
    board()
    press(button('Swap onto your road'))

    expect(heading()).toHaveTextContent('Data Science')
    expect(screen.getByText('You are here · Course')).toBeInTheDocument()
    expect(tile('Data Science, you are here. Open in the card')).toBeInTheDocument()
    expect(screen.getByText(SWAP_TOAST)).toBeInTheDocument()
    expect(replace).toHaveBeenLastCalledWith(null, '', '/road')

    press(button('Undo'))
    expect(tile('Cyber Security, you are here. Open in the card')).toBeInTheDocument()
    expect(screen.queryByText(SWAP_TOAST)).not.toBeInTheDocument()
  })

  it('moves the two tiles on the arc with the tag, then settles; under reduced motion it jumps', () => {
    jest.useFakeTimers()
    query = 'tile=data-science-uwa-perth'
    board()
    press(button('Swap onto your road'))
    expect(screen.getByText('Swapping onto your road')).toBeInTheDocument()
    act(() => {
      jest.advanceTimersByTime(650)
    })
    expect(screen.queryByText('Swapping onto your road')).not.toBeInTheDocument()

    cleanup()
    reduceMotion()
    board()
    press(button('Swap onto your road'))
    expect(screen.queryByText('Swapping onto your road')).not.toBeInTheDocument()
  })

  it('looks ahead at the next step, and Back to Cyber Security returns to where she is', () => {
    board()
    press(button(/^Look ahead: Student visa · 500/))
    expect(screen.getByText('Look ahead · the duck stays · Route step')).toBeInTheDocument()
    expect(heading()).toHaveTextContent('Student visa · 500')
    expect(screen.getByRole('link', { name: 'Open route detail at this step' })).toHaveAttribute(
      'href',
      '/road/route/student-visa-500',
    )

    press(button('Back to Cyber Security'))
    expect(screen.getByText('You are here · Course')).toBeInTheDocument()
  })

  it('links where she is to the next step’s route detail', () => {
    board()
    expect(screen.getByRole('link', { name: 'Open route detail' })).toHaveAttribute(
      'href',
      '/road/route/student-visa-500',
    )
  })

  it('links a step’s lesson to /road/learn/masters-years', () => {
    query = 'tile=masters-cyber-security-ecu'
    board()
    expect(screen.getByRole('link', { name: 'What happens here · 3-min lesson' })).toHaveAttribute(
      'href',
      '/road/learn/masters-years',
    )
  })

  it('walks back to her city from its card, with Undo, and on to her course', () => {
    query = 'tile=perth'
    board()
    press(button('Go to Perth'))
    expect(screen.getByText('You are here · City')).toBeInTheDocument()
    expect(screen.getByText('Walked to Perth')).toBeInTheDocument()

    press(button(/^Walk to Cyber Security/))
    expect(screen.getByText('You are here · Course')).toBeInTheDocument()
  })

  it('goes back to the tile before where she is: its card, at Level', () => {
    query = 'zoom=tile'
    board()
    press(button('Back to Perth'))
    expect(screen.getByText('Visited · City')).toBeInTheDocument()
    expect(replace).toHaveBeenLastCalledWith(null, '', '/road?tile=perth')
  })
})

describe('the stack', () => {
  it('opens its list from the card, pushing open=list so Back closes it', () => {
    query = 'tile=more-courses-perth'
    board()
    press(button('Show 13 more courses'))
    expect(push).toHaveBeenLastCalledWith(null, '', '/road?tile=more-courses-perth&open=list')
    expect(screen.getByRole('heading', { name: '13 more in Perth' })).toBeInTheDocument()
    expect(screen.getByText('Information Systems')).toBeInTheDocument()

    press(button('Close'))
    expect(back).toHaveBeenCalled()
  })

  it('closes when Back takes open=list off the query', () => {
    query = 'tile=more-courses-perth&open=list'
    const { rerender } = board()
    expect(screen.getByRole('heading', { name: '13 more in Perth' })).toBeInTheDocument()
    query = 'tile=more-courses-perth'
    rerender(
      <Providers initialChoice="light" systemTheme={null}>
        <RoadBoard road={road}>{null}</RoadBoard>
      </Providers>,
    )
    expect(screen.queryByRole('group', { name: 'Filter' })).not.toBeInTheDocument()
    expect(screen.getByText('Stack · Course')).toBeInTheDocument()
  })

  it('opened by a link, its Close replaces the entry instead of leaving the page', () => {
    query = 'tile=more-courses-perth&open=list'
    board()
    press(button('Close'))
    expect(back).not.toHaveBeenCalled()
    expect(replace).toHaveBeenLastCalledWith(null, '', '/road?tile=more-courses-perth')
  })

  it('filters its rows', () => {
    query = 'tile=more-courses-perth&open=list'
    board()
    const filter = screen.getByRole('group', { name: 'Filter' })
    press(within(filter).getByRole('button', { name: 'Not yet reachable' }))
    expect(screen.getByText('Master of Nursing')).toBeInTheDocument()
    expect(screen.queryByText('Information Systems')).not.toBeInTheDocument()
  })

  it('puts a course on her board, says so with Undo, and Undo takes it off', () => {
    query = 'tile=more-courses-perth&open=list'
    board()
    const row = screen.getByText('Information Systems').closest('li') as HTMLElement
    press(within(row).getByRole('button', { name: 'Put on my board' }))

    expect(screen.getByText(ADD_TOAST)).toBeInTheDocument()
    expect(tile('Information Systems, not visited. Open in the card')).toBeInTheDocument()
    press(button('Undo'))
    expect(tile('Data Science, not visited. Open in the card')).toBeInTheDocument()
  })
})

describe('the lesson', () => {
  const lesson = () => {
    segments = LESSON
    board()
  }

  it('Done reading marks the steps looked at, says so, and goes back to the board', () => {
    lesson()
    press(button('Done reading'))
    expect(screen.getByText(READ_TOAST)).toBeInTheDocument()
    expect(tile('Master’s · Cyber Security, looked at. Open in the card')).toBeInTheDocument()
    // Opened by a link, not from the board: back to /road without leaving the site.
    expect(router.replace).toHaveBeenCalledWith('/road')
    expect(router.back).not.toHaveBeenCalled()
  })

  it('opened from the board, Done reading and Later go back in history', () => {
    query = 'tile=masters-cyber-security-ecu'
    const { rerender } = board()
    fireEvent.click(screen.getByRole('link', { name: 'What happens here · 3-min lesson' }))
    segments = LESSON
    rerender(
      <Providers initialChoice="light" systemTheme={null}>
        <RoadBoard road={road}>{null}</RoadBoard>
      </Providers>,
    )
    press(button('Later'))
    expect(router.back).toHaveBeenCalled()
    expect(screen.queryByText(READ_TOAST)).not.toBeInTheDocument()
  })

  it('a tile pressed over it leaves the lesson for that tile’s card', () => {
    lesson()
    press(tile('Data Science, not visited. Open in the card'))
    expect(router.replace).toHaveBeenCalledWith('/road?tile=data-science-uwa-perth')
  })

  it('a zoom over it leaves the lesson for /road at that stop, never writing onto the lesson’s path', () => {
    lesson()
    press(within(zoom()).getByRole('button', { name: 'Tile' }))
    expect(router.replace).toHaveBeenCalledWith('/road?zoom=tile')
    expect(replace).not.toHaveBeenCalled()
  })

  it('Later closes it without reading', () => {
    lesson()
    press(button('Later'))
    expect(router.replace).toHaveBeenCalledWith('/road')
    expect(tile('Master’s · Cyber Security, unexplored. Open in the card')).toBeInTheDocument()
  })
})

describe('Whole road', () => {
  it('shows the overview, and Back to the walk returns to Level', () => {
    query = 'zoom=whole'
    board()
    expect(
      screen.getByRole('heading', { name: 'You’ve looked at 3 of 11 routes' }),
    ).toBeInTheDocument()
    press(button('Back to the walk'))
    expect(within(zoom()).getByRole('button', { name: 'Level' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.queryByText('You’ve looked at 3 of 11 routes')).not.toBeInTheDocument()
  })
})

describe('View', () => {
  it('opens its menu; Escape closes it and gives focus back to View', () => {
    board()
    const view = button('View')
    press(view)
    const menu = screen.getByRole('menu', { name: 'View' })
    expect(within(menu).getByRole('menuitem', { name: 'Pick a goal' })).toBeInTheDocument()
    expect(
      within(menu).getByRole('menuitem', { name: 'Layers · off by default' }),
    ).toBeInTheDocument()

    act(() => {
      fireEvent.keyDown(menu, { key: 'Escape' })
    })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(view)
  })

  it('opens the map key', () => {
    board()
    press(button('View'))
    press(screen.getByRole('menuitem', { name: 'Map key' }))
    const key = screen.getByRole('dialog', { name: 'Map key' })
    expect(within(key).getByText('What you can press')).toBeInTheDocument()
    expect(within(key).getByText('What the light means')).toBeInTheDocument()
    press(within(key).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('toasts', () => {
  it('with Undo stay about 4.5 s; without, 3.2 s', () => {
    jest.useFakeTimers()
    reduceMotion()
    query = 'tile=data-science-uwa-perth'
    board()
    press(button('Swap onto your road'))
    act(() => {
      jest.advanceTimersByTime(4400)
    })
    expect(screen.getByText(SWAP_TOAST)).toBeInTheDocument()
    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(screen.queryByText(SWAP_TOAST)).not.toBeInTheDocument()

    cleanup()
    query = ''
    segments = LESSON
    board()
    press(button('Done reading'))
    act(() => {
      jest.advanceTimersByTime(3100)
    })
    expect(screen.getByText(READ_TOAST)).toBeInTheDocument()
    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(screen.queryByText(READ_TOAST)).not.toBeInTheDocument()
  })

  it('are polite', () => {
    reduceMotion()
    query = 'tile=data-science-uwa-perth'
    board()
    press(button('Swap onto your road'))
    expect(screen.getByText(SWAP_TOAST).closest('[role="status"]')).toHaveAttribute(
      'aria-live',
      'polite',
    )
  })
})

describe('the first arrival', () => {
  it('shows the duck at Australia with the hint on Perth once; any press ends it', () => {
    localStorage.clear()
    board()
    expect(screen.getByText('Tap Perth to see its courses.')).toBeInTheDocument()
    expect(tile('Australia, you are here. Open in the card')).toBeInTheDocument()

    press(tile('Perth, not visited, next. Open in the card'))
    expect(screen.queryByText('Tap Perth to see its courses.')).not.toBeInTheDocument()

    cleanup()
    board()
    expect(screen.queryByText('Tap Perth to see its courses.')).not.toBeInTheDocument()
  })

  it('a zoom press ends the hint too', () => {
    localStorage.clear()
    board()
    press(within(zoom()).getByRole('button', { name: 'Tile' }))
    expect(screen.queryByText('Tap Perth to see its courses.')).not.toBeInTheDocument()
  })

  it('Go to Perth walks her to Perth', () => {
    localStorage.clear()
    board()
    press(button(/^Go to Perth/))
    expect(screen.getByText('You are here · City')).toBeInTheDocument()
    expect(screen.getByText('Walked to Perth')).toBeInTheDocument()
  })
})

describe('an empty road', () => {
  it('shows where she starts and asks for a destination, with no zoom to use', () => {
    render(
      <Providers initialChoice="light" systemTheme={null}>
        <RoadBoard road={{ ...road, tiles: [] }}>{null}</RoadBoard>
      </Providers>,
    )
    expect(heading()).toHaveTextContent('Point A')
    expect(screen.getByText('You are here · Point A')).toBeInTheDocument()
    expect(
      screen.getByText('Your road starts here. Pick a destination to draw the rest.'),
    ).toBeInTheDocument()
    expect(button('Pick a destination')).toBeInTheDocument()
    expect(tile('Point A, you are here. Open in the card')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Zoom' })).not.toBeInTheDocument()
  })
})

describe('on a phone', () => {
  // Every element the road scrolls into view, in order.
  let scrolled: Element[] = []
  const realScroll = HTMLElement.prototype.scrollIntoView
  beforeEach(() => {
    box('clientWidth', 390)
    scrolled = []
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
      scrolled.push(this)
    }
  })
  afterEach(() => {
    box('clientWidth', 1440)
    HTMLElement.prototype.scrollIntoView = realScroll
  })

  const switcher = () => screen.getByRole('group', { name: 'Show your road as' })
  const roadList = () => screen.getByRole('list', { name: 'Your road' })
  const rowButtons = () =>
    within(roadList())
      .getAllByRole('button', { name: /\. Open$/ })
      .map((b) => b.getAttribute('aria-label'))

  it('switches between Road and Map, replacing the entry', () => {
    board()
    expect(within(switcher()).getByRole('button', { name: 'Road' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(roadList()).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Your road, map' })).not.toBeInTheDocument()

    press(within(switcher()).getByRole('button', { name: 'Map' }))
    expect(replace).toHaveBeenLastCalledWith(null, '', '/road?view=map')
    expect(screen.getByRole('region', { name: 'Your road, map' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Your road' })).not.toBeInTheDocument()

    press(within(switcher()).getByRole('button', { name: 'Road' }))
    expect(replace).toHaveBeenLastCalledWith(null, '', '/road')
  })

  it('lists the road in order, dates leading each kicker, where she is as the card', () => {
    board()
    expect(rowButtons()).toEqual([
      'Point A, visited. Open',
      'Australia, visited. Open',
      'Perth, visited. Open',
      'Student visa · 500, next. Open',
      'Master’s · Cyber Security, unexplored. Open',
      'Graduate visa · 485, unexplored. Open',
    ])
    expect(screen.getByText('Late 2026 · Next · Route step')).toBeInTheDocument()
    const here = within(roadList()).getAllByRole('listitem')[3]
    expect(within(here).getByRole('heading', { level: 1 })).toHaveTextContent('Cyber Security')
    expect(within(here).getByText('You are here · Course')).toBeInTheDocument()
    expect(within(here).getByText('Also in Perth')).toBeInTheDocument()
    const controls = screen.getByRole('navigation', { name: 'Controls' })
    for (const name of ['Ask · 1', 'Weights', 'Compare'])
      expect(within(controls).getByRole('button', { name })).toBeInTheDocument()
  })

  it('opens a pressed row in a bottom sheet; Escape and its Cancel close it', () => {
    board()
    press(button('Student visa · 500, next. Open'))
    const sheet = screen.getByRole('dialog', { name: 'Student visa · 500' })
    expect(within(sheet).getByText('Look ahead · the duck stays · Route step')).toBeInTheDocument()
    expect(replace).toHaveBeenLastCalledWith(null, '', '/road?tile=student-visa-500')

    act(() => {
      fireEvent.keyDown(sheet, { key: 'Escape' })
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(replace).toHaveBeenLastCalledWith(null, '', '/road')

    press(button('Adelaide'))
    press(
      within(screen.getByRole('dialog', { name: 'Adelaide' })).getByRole('button', {
        name: 'Cancel',
      }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('on the map, the peek shows where she is, or the pressed tile with Cancel', () => {
    query = 'view=map'
    board()
    let peek = screen.getByRole('region', { name: 'Where you are' })
    expect(within(peek).getByText('You are here · Course')).toBeInTheDocument()
    expect(
      within(peek).getByText('▲ Strong on PR, Career · ▼ Costs you on: Location'),
    ).toBeInTheDocument()
    expect(
      within(peek).getByRole('button', { name: 'Look ahead: Student visa · 500' }),
    ).toBeInTheDocument()
    expect(within(peek).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()

    press(tile('Data Science, not visited. Open in the card'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    peek = screen.getByRole('region', { name: 'The tile you pressed' })
    expect(within(peek).getByText('Not visited · Course')).toBeInTheDocument()
    expect(
      within(peek).getByText('▲ Strong on Career · ▼ Costs you on: Cost, PR'),
    ).toBeInTheDocument()
    expect(within(peek).getByRole('button', { name: 'Swap onto your road' })).toBeInTheDocument()

    press(within(peek).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('region', { name: 'Where you are' })).toBeInTheDocument()
  })

  it('a deep link to a tile scrolls to its row and opens its sheet', () => {
    query = 'tile=data-science-uwa-perth'
    board()
    expect(screen.getByRole('dialog', { name: 'Data Science' })).toBeInTheDocument()
    expect(scrolled.at(-1)?.textContent).toContain('Also in Perth')
  })

  it('on arrival scrolls to where she is; once the lesson is read, to the steps looked at', () => {
    segments = LESSON
    board()
    expect(scrolled.at(-1)?.textContent).toContain('You are here · Course')

    const lesson = screen.getByRole('dialog', { name: 'The Master’s years, in 3 minutes' })
    press(within(lesson).getByRole('button', { name: 'Done reading' }))
    expect(scrolled.at(-1)?.textContent).toContain('Feb 2027 – Dec 2028 · Looked at · Route step')
  })

  it('opens the stack’s list, the overview and the map key as sheets', () => {
    query = 'tile=more-courses-perth&open=list'
    board()
    expect(screen.getByRole('dialog', { name: '13 more in Perth' })).toBeInTheDocument()

    cleanup()
    query = 'view=map&zoom=whole'
    board()
    const overview = screen.getByRole('dialog', { name: 'Overview' })
    act(() => {
      fireEvent.keyDown(overview, { key: 'Escape' })
    })
    expect(replace).toHaveBeenLastCalledWith(null, '', '/road?view=map')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    press(button('View'))
    press(screen.getByRole('menuitem', { name: 'Map key' }))
    const key = screen.getByRole('dialog', { name: 'Map key' })
    expect(within(key).getByText('What you can press')).toBeInTheDocument()
    act(() => {
      fireEvent.keyDown(key, { key: 'Escape' })
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
