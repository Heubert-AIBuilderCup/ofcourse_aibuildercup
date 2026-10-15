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
import type { ActionResult } from '@/shared/types/action-result'
import type { RoadmapChoices, StoredAnswers } from '@/shared/types/student'
import type { BoardRoadmap } from './RoadBoard'

const BOARD = '/roadmaps/rm-1'
let query = ''
// The route below the roadmap's layout: [] at /roadmaps/rm-1, ['learn', id] over the lesson,
// ['route', id].
let segments: string[] = []
const LESSON = ['learn', 'masters-years']
const router = { push: mock(), replace: mock(), refresh: mock(), back: mock(), prefetch: mock() }
mock.module('next/navigation', () => ({
  ...navigation,
  useSearchParams: () => new URLSearchParams(query),
  usePathname: () => [BOARD, ...segments].join('/'),
  useSelectedLayoutSegments: () => segments,
  useRouter: () => router,
}))
mock.module('@/shared/lib/theme-actions', () => ({ setThemeChoice: async () => {} }))

/** The board's save, as the layout passes it: saved unless a test says otherwise. */
const saveChoicesAction = mock(
  async (_id: string, _choices: RoadmapChoices): Promise<ActionResult> => ({ ok: true }),
)

/** Her answers' save, as the layout passes it: saved unless a test says otherwise. */
const saveRoadmapAnswersAction = mock(
  async (_id: string, _answers: StoredAnswers): Promise<ActionResult> => ({ ok: true }),
)

const { Providers } = await import('@/shared/components/Providers')
const { getRoad } = await import('../model/road-data')
const { RoadBoard } = await import('./RoadBoard')

const road = getRoad()
/** A roadmap she has opened before, its board untouched, on a budget that covers the course. */
const ROADMAP: BoardRoadmap = {
  id: 'rm-1',
  name: 'Cyber Security in Perth',
  choices: {},
  firstVisit: false,
  answers: { amount: { value: 36, state: 'stated' } },
  relative: null,
}
const actions = { saveChoicesAction, saveRoadmapAnswersAction }
const props = { roadmap: ROADMAP, ...actions }

// The map measures itself: give every element a 1440 × 900 box, as on a laptop.
const box = (name: 'clientWidth' | 'clientHeight', px: number) =>
  Object.defineProperty(HTMLElement.prototype, name, { configurable: true, get: () => px })
const realMatchMedia = window.matchMedia
// next/image resolves its src against the page's URL; happy-dom starts on about:blank.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => {
  dom.setURL(`http://localhost:3000${BOARD}`)
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
  saveChoicesAction.mockClear()
  saveRoadmapAnswersAction.mockClear()
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

const board = (children: ReactNode = null, roadmap: Partial<BoardRoadmap> = {}) =>
  render(
    <Providers initialChoice="light" systemTheme={null}>
      <RoadBoard road={road} roadmap={{ ...ROADMAP, ...roadmap }} {...actions}>
        {children}
      </RoadBoard>
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
    // Where she starts opens her answers, and says so.
    expect(tile('Point A, visited. Open your answers')).toBeInTheDocument()
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
    expect(replace).toHaveBeenLastCalledWith(null, '', `${BOARD}?tile=data-science-uwa-perth`)
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

  /** The map's label for a tile: the plate whose name line is `name`. */
  const labelFor = (name: string) => {
    const plate = screen
      .getAllByText(name, { exact: true })
      .map((el) => el.closest('[aria-hidden="true"]'))
      .find((el) => el?.tagName === 'DIV')
    if (!plate) throw new Error(`No label for ${name}`)
    return plate as HTMLElement
  }

  it('heads every label with its kind word, over its name', () => {
    board()
    for (const [word, name] of [
      ['Course', 'Cyber Security'],
      ['Other course', 'Data Science'],
      ['Not looked at', '13 more in Perth'],
      ['Country', 'Australia'],
    ]) {
      const label = labelFor(name)
      const kind = within(label).getByText(word)
      const named = within(label).getByText(name)
      expect(kind.compareDocumentPosition(named) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('prints each tile’s icon on its top face, hidden from assistive tech', () => {
    const { container } = board()
    const icon = (id: string, name: string) =>
      container.querySelector(`g[data-tile="${id}"] [data-icon="${name}"]`)
    const course = icon('cyber-security-ecu-perth', 'course')
    expect(course?.querySelectorAll('path')).toHaveLength(3)
    expect(course?.closest('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(icon('australia', 'globe')).not.toBeNull()
    expect(icon('perth', 'city')).not.toBeNull()
    expect(icon('more-courses-perth', 'more')).not.toBeNull()
    expect(icon('student-visa-500', 'visa')).not.toBeNull()
  })

  it('lifts a hovered tile, never its button: the hit area stays where the tile rests', () => {
    const { container } = board()
    const hit = tile('Data Science, not visited. Open in the card')
    const before = hit.getAttribute('style')
    act(() => {
      fireEvent.pointerEnter(hit)
    })
    expect(container.querySelector('g[data-tile="data-science-uwa-perth"]')).toHaveAttribute(
      'data-lift',
    )
    expect(hit).not.toHaveAttribute('data-lift')
    expect(hit.getAttribute('style')).toBe(before)
  })

  it('pressed while hovered, hands the hover’s rise to the drawn lift, marked so it does not ease', () => {
    const { container } = board()
    const g = () => container.querySelector('g[data-tile="data-science-uwa-perth"]')
    const hit = tile('Data Science, not visited. Open in the card')
    act(() => {
      fireEvent.pointerEnter(hit)
    })
    expect(g()).not.toHaveAttribute('data-pressed')
    press(hit)
    expect(g()).toHaveAttribute('data-pressed')
    expect(g()).not.toHaveAttribute('data-hover')
    expect(g()).toHaveAttribute('data-lift')
  })

  it('names an unlabelled tile while it is hovered', () => {
    board()
    const hit = tile('Graduate visa · 485, unexplored. Open in the card')
    expect(screen.queryByText('Graduate visa · 485')).not.toBeInTheDocument()
    act(() => {
      fireEvent.pointerEnter(hit)
    })
    expect(labelFor('Graduate visa · 485')).toBeInTheDocument()
    act(() => {
      fireEvent.pointerLeave(hit)
    })
    expect(screen.queryByText('Graduate visa · 485')).not.toBeInTheDocument()
  })

  it('has no Back and no View over the map: the header’s Your roadmaps leaves the board', () => {
    query = 'zoom=tile'
    board()
    expect(screen.queryByRole('button', { name: /^Back to Perth$|^Back$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument()
  })

  it('closes the card with its Cancel, back to where she is', () => {
    query = 'tile=adelaide'
    board()
    press(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('You are here · Course')).toBeInTheDocument()
    expect(replace).toHaveBeenLastCalledWith(null, '', `${BOARD}`)
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
    expect(replace).toHaveBeenLastCalledWith(null, '', `${BOARD}?zoom=tile`)
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
          <RoadBoard road={road} {...props}>
            {null}
          </RoadBoard>
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
        <RoadBoard road={road} {...props}>
          {null}
        </RoadBoard>
      </Providers>,
    )
    expect(screen.queryByText('The Master’s years, in 3 minutes')).not.toBeInTheDocument()
  })

  it('shows a route step’s placeholder with a way back to the road', () => {
    segments = ['route', 'student-visa-500']
    board()
    expect(screen.getByText('Route detail comes in the next round.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to your roadmap' })).toHaveAttribute(
      'href',
      `${BOARD}`,
    )
  })
})

const SWAP_TOAST = 'Data Science is on your roadmap now. The road ahead re-routed through it.'
const ADD_TOAST =
  'Information Systems is on your board, beside your roadmap. Data Science folded into the stack.'
const READ_TOAST = 'Lesson read. The Master’s years now show as looked at.'

describe('the card’s actions', () => {
  it('swaps the alternative onto her road, says so with Undo, and Undo puts it back', () => {
    reduceMotion()
    query = 'tile=data-science-uwa-perth'
    board()
    press(button('Swap onto your roadmap'))

    expect(heading()).toHaveTextContent('Data Science')
    expect(screen.getByText('You are here · Course')).toBeInTheDocument()
    expect(tile('Data Science, you are here. Open in the card')).toBeInTheDocument()
    expect(screen.getByText(SWAP_TOAST)).toBeInTheDocument()
    expect(replace).toHaveBeenLastCalledWith(null, '', `${BOARD}`)

    press(button('Undo'))
    expect(tile('Cyber Security, you are here. Open in the card')).toBeInTheDocument()
    expect(screen.queryByText(SWAP_TOAST)).not.toBeInTheDocument()
  })

  it('moves the two tiles on the arc with the tag, then settles; under reduced motion it jumps', () => {
    jest.useFakeTimers()
    query = 'tile=data-science-uwa-perth'
    board()
    press(button('Swap onto your roadmap'))
    expect(screen.getByText('Swapping onto your roadmap')).toBeInTheDocument()
    act(() => {
      jest.advanceTimersByTime(650)
    })
    expect(screen.queryByText('Swapping onto your roadmap')).not.toBeInTheDocument()

    cleanup()
    reduceMotion()
    board()
    press(button('Swap onto your roadmap'))
    expect(screen.queryByText('Swapping onto your roadmap')).not.toBeInTheDocument()
  })

  it('looks ahead at the next step, and Back to Cyber Security returns to where she is', () => {
    board()
    press(button(/^Look ahead: Student visa · 500/))
    expect(screen.getByText('Look ahead · the duck stays · Route step')).toBeInTheDocument()
    expect(heading()).toHaveTextContent('Student visa · 500')
    expect(screen.getByRole('link', { name: 'Open route detail at this step' })).toHaveAttribute(
      'href',
      `${BOARD}/route/student-visa-500`,
    )

    press(button('Back to Cyber Security'))
    expect(screen.getByText('You are here · Course')).toBeInTheDocument()
  })

  it('links where she is to the next step’s route detail', () => {
    board()
    expect(screen.getByRole('link', { name: 'Open route detail' })).toHaveAttribute(
      'href',
      `${BOARD}/route/student-visa-500`,
    )
  })

  it('links a step’s lesson to /road/learn/masters-years', () => {
    query = 'tile=masters-cyber-security-ecu'
    board()
    expect(screen.getByRole('link', { name: 'What happens here · 3-min lesson' })).toHaveAttribute(
      'href',
      `${BOARD}/learn/masters-years`,
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

  it('walks back to her country from its card, with Undo, and on to her city', () => {
    query = 'tile=australia'
    board()
    press(button('Go to Australia'))
    expect(screen.getByText('You are here · Destination')).toBeInTheDocument()
    expect(screen.getByText('Walked to Australia')).toBeInTheDocument()

    press(button(/^Go to Perth/))
    expect(screen.getByText('You are here · City')).toBeInTheDocument()
  })

  it('at her country, pressing Perth on the map and then its Go to Perth walks her there', () => {
    query = 'tile=australia'
    board()
    press(button('Go to Australia'))
    press(screen.getByRole('button', { name: /^Perth,/ }))
    press(button(/^Go to Perth/))
    expect(screen.getByText('You are here · City')).toBeInTheDocument()
    expect(screen.getByText('Walked to Perth')).toBeInTheDocument()
  })
})

describe('the stack', () => {
  it('opens its list from the card, pushing open=list so Back closes it', () => {
    query = 'tile=more-courses-perth'
    board()
    press(button('Show 13 more courses'))
    expect(push).toHaveBeenLastCalledWith(null, '', `${BOARD}?tile=more-courses-perth&open=list`)
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
        <RoadBoard road={road} {...props}>
          {null}
        </RoadBoard>
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
    expect(replace).toHaveBeenLastCalledWith(null, '', `${BOARD}?tile=more-courses-perth`)
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
    expect(router.replace).toHaveBeenCalledWith(`${BOARD}`)
    expect(router.back).not.toHaveBeenCalled()
  })

  it('opened from the board, Done reading and Later go back in history', () => {
    query = 'tile=masters-cyber-security-ecu'
    const { rerender } = board()
    fireEvent.click(screen.getByRole('link', { name: 'What happens here · 3-min lesson' }))
    segments = LESSON
    rerender(
      <Providers initialChoice="light" systemTheme={null}>
        <RoadBoard road={road} {...props}>
          {null}
        </RoadBoard>
      </Providers>,
    )
    press(button('Later'))
    expect(router.back).toHaveBeenCalled()
    expect(screen.queryByText(READ_TOAST)).not.toBeInTheDocument()
  })

  it('a tile pressed over it leaves the lesson for that tile’s card', () => {
    lesson()
    press(tile('Data Science, not visited. Open in the card'))
    expect(router.replace).toHaveBeenCalledWith(`${BOARD}?tile=data-science-uwa-perth`)
  })

  it('a zoom over it leaves the lesson for /road at that stop, never writing onto the lesson’s path', () => {
    lesson()
    press(within(zoom()).getByRole('button', { name: 'Tile' }))
    expect(router.replace).toHaveBeenCalledWith(`${BOARD}?zoom=tile`)
    expect(replace).not.toHaveBeenCalled()
  })

  it('Later closes it without reading', () => {
    lesson()
    press(button('Later'))
    expect(router.replace).toHaveBeenCalledWith(`${BOARD}`)
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

describe('the map key', () => {
  const keyButton = () => button('Map key')
  const strip = () => screen.queryByRole('note', { name: 'How to read the map' })

  it('on her first visit shows the strip, pressed; Got it hides it and Map key brings it back', () => {
    board(null, { firstVisit: true })
    expect(strip()).toBeInTheDocument()
    expect(keyButton()).toHaveAttribute('aria-pressed', 'true')

    press(within(strip()!).getByRole('button', { name: 'Got it' }))
    expect(strip()).not.toBeInTheDocument()
    expect(keyButton()).toHaveAttribute('aria-pressed', 'false')
    // Keyboard focus is not lost with the strip: it lands on Map key.
    expect(document.activeElement === keyButton()).toBe(true)

    press(keyButton())
    expect(strip()).toBeInTheDocument()
    expect(keyButton()).toHaveAttribute('aria-pressed', 'true')
  })

  it('after her first visit stays hidden until Map key, which toggles it', () => {
    board()
    expect(strip()).not.toBeInTheDocument()
    expect(keyButton()).toHaveAttribute('aria-pressed', 'false')
    press(keyButton())
    expect(strip()).toBeInTheDocument()
    press(keyButton())
    expect(strip()).not.toBeInTheDocument()
  })
})

const LATER_TOAST = 'Ask and Compare come in a later round.'

describe('Ask and Compare', () => {
  it('say in a toast that they come later', () => {
    board()
    const header = screen.getByRole('banner')
    press(within(header).getByRole('button', { name: 'Ask · 1' }))
    expect(screen.getByText(LATER_TOAST)).toBeInTheDocument()
    press(within(header).getByRole('button', { name: 'Compare' }))
    expect(screen.getByText(LATER_TOAST)).toBeInTheDocument()
  })
})

const tradeLines = (gains: string, costs: string, within_: HTMLElement = document.body) => {
  const g = within(within_).getByText(gains, { exact: true })
  const c = within(within_).getByText(costs, { exact: true })
  // Two lines of their own: nothing joins them.
  expect(g.parentElement).toBe(c.parentElement)
  expect(g.parentElement?.textContent).toBe(gains + costs)
}

describe('trade-offs', () => {
  it('sit on two lines in the card where she is, and in a pressed card', () => {
    board()
    tradeLines(
      'Good for what matters most to you: PR, career',
      'Less good for: cost (only AUD 3k spare) and location (far from the east-coast job market).',
    )
    cleanup()
    query = 'tile=data-science-uwa-perth'
    board()
    tradeLines('Good for: career', 'Less good for: cost, PR', screen.getByRole('complementary'))
  })

  it('sit on two lines in a sibling', () => {
    board()
    const sibling = button(/^Data Science ·/)
    tradeLines('Good for: career', 'Less good for: cost, PR', sibling)
  })
})

describe('toasts', () => {
  it('with Undo stay about 4.5 s; without, 3.2 s', () => {
    jest.useFakeTimers()
    reduceMotion()
    query = 'tile=data-science-uwa-perth'
    board()
    press(button('Swap onto your roadmap'))
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
    press(button('Swap onto your roadmap'))
    expect(screen.getByText(SWAP_TOAST).closest('[role="status"]')).toHaveAttribute(
      'aria-live',
      'polite',
    )
  })
})

describe('the first arrival', () => {
  it('on her first visit, shows the duck at Australia with the hint on Perth; any press ends it', () => {
    board(null, { firstVisit: true })
    expect(screen.getByText('Tap Perth to see its courses.')).toBeInTheDocument()
    expect(tile('Australia, you are here. Open in the card')).toBeInTheDocument()

    press(tile('Perth, not visited, next. Open in the card'))
    expect(screen.queryByText('Tap Perth to see its courses.')).not.toBeInTheDocument()
    // Ending the arrival is not a choice: nothing is saved.
    expect(saveChoicesAction).not.toHaveBeenCalled()
  })

  it('a zoom press ends the hint too', () => {
    board(null, { firstVisit: true })
    press(within(zoom()).getByRole('button', { name: 'Tile' }))
    expect(screen.queryByText('Tap Perth to see its courses.')).not.toBeInTheDocument()
  })

  it('Go to Perth walks her to Perth', () => {
    board(null, { firstVisit: true })
    press(button(/^Go to Perth/))
    expect(screen.getByText('You are here · City')).toBeInTheDocument()
    expect(screen.getByText('Walked to Perth')).toBeInTheDocument()
  })
})

describe('an empty road', () => {
  it('shows where she starts and asks for a destination, with no zoom to use', () => {
    render(
      <Providers initialChoice="light" systemTheme={null}>
        <RoadBoard road={{ ...road, tiles: [] }} {...props}>
          {null}
        </RoadBoard>
      </Providers>,
    )
    expect(heading()).toHaveTextContent('Point A')
    expect(screen.getByText('You are here · Point A')).toBeInTheDocument()
    expect(
      screen.getByText('Your roadmap starts here. Pick a destination to draw the rest.'),
    ).toBeInTheDocument()
    expect(button('Pick a destination')).toBeInTheDocument()
    expect(tile('Point A, you are here. Open your answers')).toBeInTheDocument()
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

  const switcher = () => screen.getByRole('group', { name: 'Show your roadmap as' })
  const roadList = () => screen.getByRole('list', { name: 'Your roadmap' })
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
    expect(screen.queryByRole('region', { name: 'Your roadmap, map' })).not.toBeInTheDocument()

    press(within(switcher()).getByRole('button', { name: 'Map' }))
    expect(replace).toHaveBeenLastCalledWith(null, '', `${BOARD}?view=map`)
    expect(screen.getByRole('region', { name: 'Your roadmap, map' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Your roadmap' })).not.toBeInTheDocument()

    press(within(switcher()).getByRole('button', { name: 'Road' }))
    expect(replace).toHaveBeenLastCalledWith(null, '', `${BOARD}`)
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
    expect(screen.getByText('Late 2026 · Next · Visa')).toBeInTheDocument()
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
    expect(replace).toHaveBeenLastCalledWith(null, '', `${BOARD}?tile=student-visa-500`)

    act(() => {
      fireEvent.keyDown(sheet, { key: 'Escape' })
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(replace).toHaveBeenLastCalledWith(null, '', `${BOARD}`)

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
    tradeLines('Good for: PR, career', 'Less good for: location', peek)
    expect(
      within(peek).getByRole('button', { name: 'Look ahead: Student visa · 500' }),
    ).toBeInTheDocument()
    expect(within(peek).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()

    press(tile('Data Science, not visited. Open in the card'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    peek = screen.getByRole('region', { name: 'The tile you pressed' })
    expect(within(peek).getByText('Not visited · Course')).toBeInTheDocument()
    tradeLines('Good for: career', 'Less good for: cost, PR', peek)
    expect(within(peek).getByRole('button', { name: 'Swap onto your roadmap' })).toBeInTheDocument()

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
    expect(scrolled.at(-1)?.textContent).toContain('Feb 2027 – Dec 2028 · Looked at · Study')
  })

  it('opens the stack’s list and the overview as sheets', () => {
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
    expect(replace).toHaveBeenLastCalledWith(null, '', `${BOARD}?view=map`)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('says Ask and Compare come later from the controls bar', () => {
    board()
    const controls = screen.getByRole('navigation', { name: 'Controls' })
    press(within(controls).getByRole('button', { name: 'Ask · 1' }))
    expect(screen.getByText(LATER_TOAST)).toBeInTheDocument()
  })
})

const NOTHING_CHOSEN = { swapped: false, added: false, read: false, city: false, country: false }
const SAVE_NOTE = "We couldn't save that change."
/** Lets the save's answer arrive. */
const settle = () => act(async () => {})

describe('her roadmap’s choices', () => {
  it('start the board where she left it: swapped, Data Science is where she is', () => {
    board(null, { choices: { swapped: true } })
    expect(tile('Data Science, you are here. Open in the card')).toBeInTheDocument()
    expect(screen.queryByText('Tap Perth to see its courses.')).not.toBeInTheDocument()
  })

  it('are saved after a swap and after its Undo, every key, never the first arrival', async () => {
    reduceMotion()
    query = 'tile=data-science-uwa-perth'
    board()
    press(button('Swap onto your roadmap'))
    await settle()
    expect(saveChoicesAction).toHaveBeenLastCalledWith('rm-1', { ...NOTHING_CHOSEN, swapped: true })

    press(button('Undo'))
    await settle()
    expect(saveChoicesAction).toHaveBeenLastCalledWith('rm-1', NOTHING_CHOSEN)
    expect(saveChoicesAction).toHaveBeenCalledTimes(2)
  })

  it('saves one change at a time, in order: Undo is sent only once the swap is saved', async () => {
    reduceMotion()
    query = 'tile=data-science-uwa-perth'
    board()
    let answerSwap: (result: ActionResult) => void = () => {}
    saveChoicesAction.mockImplementationOnce(
      () => new Promise<ActionResult>((resolve) => (answerSwap = resolve)),
    )
    press(button('Swap onto your roadmap'))
    press(button('Undo'))
    await settle()
    // The Undo waits, so it can never land before the swap it undoes.
    expect(saveChoicesAction).toHaveBeenCalledTimes(1)

    // The swap's late failure is not the last word: the Undo after it saved.
    await act(async () => answerSwap({ ok: false, error: 'Could not save. Please try again.' }))
    expect(saveChoicesAction).toHaveBeenCalledTimes(2)
    expect(saveChoicesAction).toHaveBeenLastCalledWith('rm-1', NOTHING_CHOSEN)
    expect(screen.queryByText(SAVE_NOTE)).not.toBeInTheDocument()
  })

  it('a failed save keeps the change and its toast, says so, and the next change retries', async () => {
    reduceMotion()
    query = 'tile=data-science-uwa-perth'
    board()
    saveChoicesAction.mockImplementationOnce(async () => ({
      ok: false,
      error: 'Could not save. Please try again.',
    }))
    press(button('Swap onto your roadmap'))
    await settle()
    expect(screen.getByText(SWAP_TOAST)).toBeInTheDocument()
    expect(screen.getByText(SAVE_NOTE)).toBeInTheDocument()
    expect(tile('Data Science, you are here. Open in the card')).toBeInTheDocument()

    press(button('Undo'))
    await settle()
    expect(saveChoicesAction).toHaveBeenLastCalledWith('rm-1', NOTHING_CHOSEN)
    expect(screen.queryByText(SAVE_NOTE)).not.toBeInTheDocument()
  })

  it('a save that cannot reach the server says so too', async () => {
    query = 'tile=perth'
    board()
    saveChoicesAction.mockImplementationOnce(async () => {
      throw new Error('Failed to fetch')
    })
    press(button('Go to Perth'))
    await settle()
    expect(screen.getByText('Walked to Perth')).toBeInTheDocument()
    expect(screen.getByText(SAVE_NOTE)).toBeInTheDocument()
  })
})

describe('Your answers', () => {
  const AMOUNT = 'Your budget per year · Amount'
  const BUDGET_TOAST = 'Budget changed. Cyber Security now goes AUD 3.5k a year over it.'
  const COSTS = 'Less good for: cost (AUD 3.5k a year over budget)'
  const OVER = /^Condition · Over budget by AUD 3\.5k/
  const panel = () => screen.queryByRole('complementary', { name: 'Your answers' })
  const openMenu = () => press(button('Menu: theme and sign out'))
  /** A row's button, by the question it starts with. */
  const row = (question: string) => button(new RegExp(`^${question}`))
  const pick = (question: string, option: RegExp) =>
    press(
      within(screen.getByRole('radiogroup', { name: question })).getByRole('radio', {
        name: option,
      }),
    )
  /** The map's label for a tile: the plate whose name line is `name`. */
  const labelFor = (name: string) =>
    screen
      .getAllByText(name, { exact: true })
      .map((el) => el.closest('[aria-hidden="true"]'))
      .find((el) => el?.tagName === 'DIV') as HTMLElement

  it('opens over the board from the menu, pushing open=answers', () => {
    board()
    openMenu()
    press(screen.getByRole('menuitem', { name: 'Your answers' }))
    expect(push).toHaveBeenLastCalledWith(null, '', `${BOARD}?open=answers`)
    const answers = panel()!
    expect(within(answers).getByText('From onboarding · change any of them')).toBeInTheDocument()
    expect(within(answers).getByRole('heading', { level: 2 })).toHaveTextContent('Your answers')
    expect(
      within(answers).getByText(
        'Pick one to change it. Your roadmap shows what would move before anything moves.',
      ),
    ).toBeInTheDocument()
  })

  it('opens from a press on Point A', () => {
    board()
    press(tile('Point A, visited. Open your answers'))
    expect(push).toHaveBeenLastCalledWith(null, '', `${BOARD}?open=answers`)
    expect(panel()).toBeInTheDocument()
  })

  it('while open, every tile but Point A is named for the wait; a pressed one waits and says why', () => {
    query = 'open=answers'
    board()
    const labels = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? '')
    expect(labels.filter((l) => l.endsWith('. Open in the card'))).toEqual([])
    expect(
      labels.filter((l) => l.endsWith('. Close your answers to open it')).length,
    ).toBeGreaterThan(5)
    expect(labels).toContain('Point A, visited. Open your answers')
    press(tile('Data Science, not visited. Close your answers to open it'))
    expect(screen.getByText('Close your answers to open a tile.')).toHaveAttribute(
      'aria-live',
      'polite',
    )
    expect(panel()).toBeInTheDocument()
    expect(screen.queryByText('Not visited · Course')).not.toBeInTheDocument()
  })

  it('previews a budget pick on the map: the tag, dashed rings and "If you save"', () => {
    query = 'open=answers'
    const { container } = board()
    expect(screen.queryByText('Preview · not saved')).not.toBeInTheDocument()
    press(row(AMOUNT))
    pick(AMOUNT, /^AUD 30k/)
    expect(screen.getByText('Preview · not saved')).toBeInTheDocument()
    for (const id of ['perth', 'cyber-security-ecu-perth'])
      expect(container.querySelector(`g[data-tile="${id}"] [data-preview]`)).not.toBeNull()
    expect(container.querySelector('g[data-tile="adelaide"] [data-preview]')).toBeNull()
    expect(labelFor('Perth')).toHaveTextContent('If you save · A stretch on your budget')
    expect(labelFor('Cyber Security')).toHaveTextContent(
      'If you save · AUD 3.5k a year over budget',
    )
  })

  it('saves to the roadmap, says so with Undo, marks the course; Undo saves the answers before', async () => {
    query = 'open=answers'
    board()
    press(row(AMOUNT))
    pick(AMOUNT, /^AUD 30k/)
    press(button('Save changes'))
    await settle()
    expect(saveRoadmapAnswersAction).toHaveBeenLastCalledWith('rm-1', {
      amount: { value: 30, state: 'stated' },
    })
    expect(router.refresh).toHaveBeenCalled()
    expect(screen.getByText(BUDGET_TOAST)).toBeInTheDocument()
    expect(screen.queryByText('Preview · not saved')).not.toBeInTheDocument()

    // Closed, the card where she is shows the mark.
    press(button('Close'))
    const card = screen.getByRole('complementary', { name: 'Where you are' })
    expect(within(card).getByRole('button', { name: OVER })).toBeInTheDocument()
    expect(within(card).getByText(COSTS)).toBeInTheDocument()

    press(button('Undo'))
    await settle()
    expect(saveRoadmapAnswersAction).toHaveBeenLastCalledWith('rm-1', ROADMAP.answers)
    expect(screen.queryByRole('button', { name: OVER })).not.toBeInTheDocument()
    expect(screen.queryByText(COSTS)).not.toBeInTheDocument()
  })

  it('"Changed just now" stays through the save, and goes with its Undo', async () => {
    query = 'open=answers'
    board()
    press(row(AMOUNT))
    pick(AMOUNT, /^AUD 30k/)
    press(button('Save changes'))
    await settle()
    const amount = () => row(AMOUNT).closest('li') as HTMLElement
    expect(within(amount()).getByText('Changed just now')).toBeInTheDocument()

    press(button('Undo'))
    await settle()
    expect(within(amount()).queryByText('Changed just now')).not.toBeInTheDocument()
  })

  it('a save that changes nothing on the road says so, without Undo', async () => {
    query = 'open=answers'
    board()
    press(row('How you like to learn'))
    pick('How you like to learn', /^Mostly classroom and research/)
    press(button('Save changes'))
    await settle()
    expect(screen.getByText('Saved. Nothing on your roadmap changes.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('closes when Back takes open=answers off the query', () => {
    query = 'open=answers'
    const { rerender } = board()
    expect(panel()).toBeInTheDocument()
    query = ''
    rerender(
      <Providers initialChoice="light" systemTheme={null}>
        <RoadBoard road={road} {...props}>
          {null}
        </RoadBoard>
      </Providers>,
    )
    expect(panel()).not.toBeInTheDocument()
    expect(screen.getByText('You are here · Course')).toBeInTheDocument()
  })

  it('on a phone, opens on the Map view in a sheet, the switch gone', () => {
    box('clientWidth', 390)
    try {
      board()
      openMenu()
      press(screen.getByRole('menuitem', { name: 'Your answers' }))
      expect(push).toHaveBeenLastCalledWith(null, '', `${BOARD}?view=map&open=answers`)
      const sheet = screen.getByRole('dialog', { name: 'Your answers' })
      expect(within(sheet).getByText('From onboarding · change any of them')).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Your roadmap, map' })).toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'Show your roadmap as' })).not.toBeInTheDocument()
    } finally {
      box('clientWidth', 1440)
    }
  })
})

describe('a new roadmap’s draft', () => {
  const AMOUNT = 'Your budget per year · Amount'
  const SOURCE = { id: 'rm-1', name: 'Cyber Security in Perth' }
  const createRoadmapAction = mock(
    async (_input: {
      fromId?: string
      answers: StoredAnswers
    }): Promise<ActionResult<{ id: string }>> => ({ ok: true, id: 'rm-new' }),
  )
  beforeEach(() => createRoadmapAction.mockClear())

  const draftBoard = () =>
    render(
      <Providers initialChoice="light" systemTheme={null}>
        <RoadBoard
          road={road}
          roadmap={ROADMAP}
          draft={{ from: SOURCE, answers: ROADMAP.answers }}
          createRoadmapAction={createRoadmapAction}
        >
          {null}
        </RoadBoard>
      </Providers>,
    )
  const panel = () => screen.getByRole('complementary', { name: 'Your answers' })
  const pickAmount = () => {
    press(button(new RegExp(`^${AMOUNT}`)))
    press(
      within(screen.getByRole('radiogroup', { name: AMOUNT })).getByRole('radio', {
        name: /^AUD 30k/,
      }),
    )
  }

  it('opens on the source’s board with its answers open in draft mode, under "New roadmap"', () => {
    draftBoard()
    expect(
      within(panel()).getByText('New roadmap · a copy of Cyber Security in Perth'),
    ).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(
      'Your roadmaps/New roadmap',
    )
    // Nothing is pushed: the draft is the page.
    expect(push).not.toHaveBeenCalled()
  })

  it('while drafting, a pressed tile waits and says why', () => {
    draftBoard()
    press(tile('Data Science, not visited. Close your answers to open it'))
    expect(screen.getByText('Close your answers to open a tile.')).toBeInTheDocument()
    expect(panel()).toBeInTheDocument()
  })

  it('previews a pick on the map, as Your answers does', () => {
    draftBoard()
    pickAmount()
    expect(screen.getByText('Preview · not saved')).toBeInTheDocument()
  })

  it('a zoom keeps the draft’s source in the URL', () => {
    query = 'from=rm-1'
    draftBoard()
    press(within(zoom()).getByRole('button', { name: 'Tile' }))
    expect(replace).toHaveBeenLastCalledWith(null, '', `${BOARD}?from=rm-1&zoom=tile`)
  })

  it('Create makes the roadmap as the loader’s first step, then lands on the list with it marked', async () => {
    jest.useFakeTimers()
    reduceMotion()
    draftBoard()
    pickAmount()
    press(button('Create roadmap'))
    expect(screen.getByText('Drawing your new roadmap')).toBeInTheDocument()
    expect(createRoadmapAction).toHaveBeenCalledWith({
      fromId: 'rm-1',
      answers: { amount: { value: 30, state: 'stated' } },
    })
    for (let i = 0; i < 3; i++)
      await act(async () => {
        jest.advanceTimersByTime(700)
      })
    expect(router.replace).toHaveBeenCalledWith('/roadmaps/rm-new')
  })

  it('a refused Create stops the loader and lands nowhere', async () => {
    jest.useFakeTimers()
    reduceMotion()
    createRoadmapAction.mockImplementationOnce(async () => ({ ok: false, error: 'Not found' }))
    draftBoard()
    pickAmount()
    press(button('Create roadmap'))
    await act(async () => {
      jest.advanceTimersByTime(700)
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't draw this roadmap. Nothing is created yet.",
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('Cancel, after Discard, goes back to her roadmaps; nothing is made', () => {
    draftBoard()
    pickAmount()
    press(button('Cancel'))
    press(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    expect(router.replace).toHaveBeenCalledWith('/roadmaps')
    expect(createRoadmapAction).not.toHaveBeenCalled()
  })
})

describe('a new roadmap from scratch', () => {
  const createRoadmapAction = mock(
    async (_input: {
      fromId?: string
      answers: StoredAnswers
    }): Promise<ActionResult<{ id: string }>> => ({ ok: true, id: 'rm-new' }),
  )
  beforeEach(() => createRoadmapAction.mockClear())

  const scratchBoard = () =>
    render(
      <Providers initialChoice="light" systemTheme={null}>
        <RoadBoard
          road={{ ...road, tiles: [] }}
          roadmap={{ ...ROADMAP, id: 'new', name: 'New roadmap', answers: {} }}
          draft={{ from: null, answers: {} }}
          createRoadmapAction={createRoadmapAction}
        >
          {null}
        </RoadBoard>
      </Providers>,
    )
  const panel = () => screen.getByRole('complementary', { name: 'Your answers' })

  it('draws the empty road, Point A and a destination not picked yet, under the blank draft', () => {
    scratchBoard()
    expect(tile('Point A, you are here. Open your answers')).toBeInTheDocument()
    // The destination is an outline, not a tile to press.
    expect(screen.getAllByText('Not picked yet').length).toBeGreaterThan(0)
    expect(within(panel()).getByText('New roadmap · from scratch')).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(
      'Your roadmaps/New roadmap',
    )
  })

  it('Create makes it with her answers and no source, then lands on the list with it marked', async () => {
    jest.useFakeTimers()
    reduceMotion()
    scratchBoard()
    const AMOUNT = 'Your budget per year · Amount'
    press(button(new RegExp(`^${AMOUNT}`)))
    press(
      within(screen.getByRole('radiogroup', { name: AMOUNT })).getByRole('radio', {
        name: /^AUD 30k/,
      }),
    )
    press(button('Create roadmap'))
    expect(createRoadmapAction).toHaveBeenCalledWith({
      answers: { amount: { value: 30, state: 'stated' } },
    })
    for (let i = 0; i < 3; i++)
      await act(async () => {
        jest.advanceTimersByTime(700)
      })
    expect(router.replace).toHaveBeenCalledWith('/roadmaps/rm-new')
  })
})
