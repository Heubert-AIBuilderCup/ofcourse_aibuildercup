/// <reference lib="dom" />
// The Find panel (criteria 22 to 27): a found course's card shows its course detail when the hit
// carries it (23, 24), and nothing more when it does not (22); with the compare action, each card
// offers "Compare with my roadmap", whose comparison takes the results' place until Back (27).
// The Find card's subjects: a combined course says which subjects it combines, and one that fits
// two of her stated interests carries the "Fits both" tag. Compared as strings and counts, never
// elements.

import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { FieldId } from '@/features/engine/types'
import type { CompareRow } from '@/features/roads/data/types'
import type { CourseDetailData, FinderHit } from '../model/types'
import { type FinderCompare, FinderPanel } from './FinderPanel'
import type { FinderSearch, FinderWhyCall } from './useFinder'

afterEach(cleanup)

const hit = (n: number, fields: FieldId[], fitsBoth = false): FinderHit => ({
  courseId: `c-${n}`,
  name: `Course ${n}`,
  university: 'Uni',
  cityId: 'hobart',
  level: "Master's",
  years: 2,
  feeK: 34,
  field: fields[0],
  fields,
  fitsBoth,
  graphField: 'x',
  niche: fields.length > 1,
  definition: null,
  description: 'What it teaches.',
  score: 0.7,
  failed: [],
})

/** The panel after one search that finds `hits`; every why stays pending. */
async function found(hits: FinderHit[]) {
  const search = mock<FinderSearch>(async () => ({
    ok: true,
    result: {
      query: 'x',
      model: 'm',
      cached: false,
      searchMs: 1,
      keyword: [],
      kind: 'results',
      hits,
    },
  }))
  const why = mock<FinderWhyCall>(() => new Promise(() => {}))
  render(
    <FinderPanel
      roadmapId="r1"
      seed="people and computers"
      search={search}
      why={why}
      onClose={() => {}}
    />,
  )
  const form = document.querySelector('form')
  if (!form) throw new Error('no form')
  await act(async () => {
    fireEvent.submit(form)
  })
}

const countText = (text: string) => screen.queryAllByText(text).length

describe('FinderPanel cards', () => {
  it('says which subjects a combined course combines, two with "and", three with commas', async () => {
    await found([hit(1, ['psych', 'cyber']), hit(2, ['health', 'data', 'it']), hit(3, ['it'])])
    expect(countText('Combines Psychology and Cyber security')).toBe(1)
    expect(countText('Combines Health, Data science and Information technology')).toBe(1)
    expect(countText('Fits both')).toBe(0)
    const combines = [...document.querySelectorAll('li')].filter((li) =>
      li.textContent?.includes('Combines'),
    )
    expect(combines.length).toBe(2)
  })

  it('tags a course that fits two of her interests, the full sentence as its accessible text', async () => {
    await found([hit(1, ['psych', 'cyber'], true)])
    const tags = screen.queryAllByText('Fits both')
    expect(tags.length).toBe(1)
    expect(tags[0]?.getAttribute('aria-hidden')).toBe('true')
    expect(countText('Fits both your interests')).toBe(1)
  })
})

const DETAIL: CourseDetailData = {
  fieldsNear: [{ name: 'Information systems', definition: 'Systems that run a business.' }],
  jobGroups: [
    {
      field: 'it',
      name: 'Information technology',
      primary: true,
      jobs: [
        {
          code: '224999',
          name: 'Business Analyst',
          market: { code: '224999', cityId: 'perth', openings: 350, payLowK: 87, payHighK: 123 },
        },
      ],
    },
  ],
}

const detailHit = (n: number, detail?: CourseDetailData): FinderHit => ({
  courseId: `c-${n}`,
  name: `Course ${n}`,
  university: 'Uni',
  cityId: 'perth',
  level: "Master's",
  years: 2,
  feeK: 30,
  field: 'it',
  fields: ['it'],
  fitsBoth: false,
  graphField: 'it',
  niche: false,
  definition: null,
  description: 'What it teaches.',
  score: 0.8,
  failed: [],
  ...(detail ? { detail } : {}),
})

const search = mock<FinderSearch>(async () => ({
  ok: true,
  result: {
    kind: 'results',
    query: 'robots and puzzles',
    model: 'fake',
    cached: false,
    searchMs: 10,
    keyword: [],
    hits: [detailHit(1, DETAIL), detailHit(2)],
  },
}))
// A why that never arrives: the cards are what this test reads.
const why = mock<FinderWhyCall>(() => new Promise(() => {}))

/** The text of the card whose title is `name`. */
const cardText = (name: string) =>
  screen.getByRole('heading', { level: 3, name }).closest('li')?.textContent ?? ''

describe('a found course card', () => {
  it('shows the job market of a hit with detail, and nothing more on a hit without', async () => {
    render(
      <FinderPanel
        roadmapId="rm-1"
        seed="robots and puzzles"
        search={search}
        why={why}
        onClose={() => {}}
      />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    })
    const card = screen.getByRole('heading', { level: 3, name: 'Course 1' }).closest('li')
    const jobsTitle = card?.querySelector('section > :first-child')?.textContent
    expect(jobsTitle).toBe('Information technology roles · Job market (sample data)')
    expect(cardText('Course 1').includes('350 openings · AUD 87–123k starting · Perth')).toBe(true)
    expect(cardText('Course 2').includes('Job market (sample data)')).toBe(false)
  })

  it('draws the section titles under the card title as h4s, an h3', async () => {
    render(
      <FinderPanel
        roadmapId="rm-1"
        seed="robots and puzzles"
        search={search}
        why={why}
        onClose={() => {}}
      />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    })
    const card = screen.getByRole('heading', { level: 3, name: 'Course 1' }).closest('li')
    const titles = [...(card?.querySelectorAll('section > :first-child') ?? [])]
    expect(titles.map((t) => t.tagName)).toEqual(['H4', 'H4'])
  })
})

const ROWS: CompareRow[] = [
  {
    key: 'money',
    label: 'Money',
    current: 'AUD 33k a year',
    alternative: 'AUD 30k a year',
    changed: true,
  },
]
const COMPARED = { ok: true as const, rows: ROWS, pinnable: true }
const COMPARE = 'Compare with my roadmap'
const BACK = 'Back to results'

/** A compare call whose answers arrive when the test says, in the order they were asked. */
function deferredCompare() {
  const pending: ((answer: Awaited<ReturnType<FinderCompare>>) => void)[] = []
  const compare = mock<FinderCompare>(() => new Promise((resolve) => pending.push(resolve)))
  const answer = (i: number, a: Awaited<ReturnType<FinderCompare>> = COMPARED) =>
    act(async () => pending[i]?.(a))
  return { compare, answer }
}

/** The panel with its two found courses on show. */
async function showResults(compare?: FinderCompare) {
  render(
    <FinderPanel
      roadmapId="rm-1"
      seed="robots and puzzles"
      search={search}
      why={why}
      compare={compare}
      onClose={() => {}}
    />,
  )
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  })
}

/** The Compare button on the card whose title is `name`. */
const compareOn = (name: string) => {
  const card = screen.getByRole('heading', { level: 3, name }).closest('li')
  if (!card) throw new Error(`no card "${name}"`)
  return within(card).getByRole('button', { name: COMPARE })
}

const press = (el: HTMLElement) =>
  act(async () => {
    fireEvent.click(el)
  })

const count = (role: string, name: string) => screen.queryAllByRole(role, { name }).length
const statusText = () => screen.getByRole('status').textContent ?? ''

describe('Compare with my roadmap on a found course (criterion 27)', () => {
  it('has no Compare button without the compare action (criterion 25), one per card with it', async () => {
    await showResults()
    expect(count('button', COMPARE)).toBe(0)
    cleanup()
    await showResults(deferredCompare().compare)
    expect(count('button', COMPARE)).toBe(2)
  })

  it('drops an answer that arrives after Back to results, or after another course was asked', async () => {
    const { compare, answer } = deferredCompare()
    await showResults(compare)
    await press(compareOn('Course 1'))
    expect(statusText()).toBe('Comparing…')
    await press(screen.getByRole('button', { name: BACK }))
    await answer(0)
    expect(count('button', BACK)).toBe(0)
    expect(count('heading', 'Course 1')).toBe(1)

    await press(compareOn('Course 2'))
    await answer(0)
    expect(screen.queryAllByText('What changes').length).toBe(0)
    expect(statusText()).toBe('Comparing…')
    await answer(1)
    expect(screen.queryAllByText('What changes').length).toBe(1)
    expect(count('heading', 'Course 2')).toBe(1)
  })

  it('says what went wrong when the comparison is refused or throws', async () => {
    const { compare, answer } = deferredCompare()
    await showResults(compare)
    await press(compareOn('Course 1'))
    await answer(0, { ok: false, error: 'Not found' })
    expect(statusText()).toBe('Not found')
    cleanup()

    await showResults(
      mock<FinderCompare>(async () => {
        throw new Error('network')
      }),
    )
    await press(compareOn('Course 1'))
    expect(statusText()).toBe("Couldn't compare right now")
    expect(screen.queryAllByText('What changes').length).toBe(0)
  })

  it('Back to results gives the same results back, without searching again', async () => {
    const { compare, answer } = deferredCompare()
    await showResults(compare)
    const searches = search.mock.calls.length
    await press(compareOn('Course 1'))
    await answer(0)
    expect(screen.queryAllByText('What changes').length).toBe(1)
    expect(count('heading', 'Course 2')).toBe(0)
    await press(screen.getByRole('button', { name: BACK }))
    expect(count('heading', 'Course 1')).toBe(1)
    expect(count('heading', 'Course 2')).toBe(1)
    expect(cardText('Course 1').includes('350 openings · AUD 87–123k starting · Perth')).toBe(true)
    expect(search.mock.calls.length).toBe(searches)
  })

  it("moves focus to the comparison's title, and back to the pressed card's Compare on Back", async () => {
    const { compare, answer } = deferredCompare()
    await showResults(compare)
    await press(compareOn('Course 2'))
    const title = screen.getByRole('heading', { level: 2, name: 'Course 2' })
    expect(document.activeElement === title).toBe(true)
    await answer(0)
    expect(document.activeElement === title).toBe(true)
    await press(screen.getByRole('button', { name: BACK }))
    expect(document.activeElement === compareOn('Course 2')).toBe(true)
  })

  it('keeps one status region mounted in both views, so what it says is announced', async () => {
    await showResults(deferredCompare().compare)
    const region = screen.getByRole('status')
    await press(compareOn('Course 1'))
    expect(screen.getByRole('status') === region).toBe(true)
    await press(screen.getByRole('button', { name: BACK }))
    expect(screen.getByRole('status') === region).toBe(true)
  })
})
