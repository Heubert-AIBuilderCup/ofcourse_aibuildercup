/// <reference lib="dom" />
// The Find card's subjects: a combined course says which subjects it combines, and one that fits two
// of her stated interests carries the "Fits both" tag. A found course's card in the Find panel
// (criteria 23 and 24): a hit that carries the course detail shows it, as an expandable part of its
// card; a hit without it shows nothing more (22). Compared as strings and counts, never elements.
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { FieldId } from '@/features/engine/types'
import type { CourseDetailData, FinderHit } from '../model/types'
import { FinderPanel } from './FinderPanel'
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

const count = (text: string) => screen.queryAllByText(text).length

describe('FinderPanel cards', () => {
  it('says which subjects a combined course combines, two with "and", three with commas', async () => {
    await found([hit(1, ['psych', 'cyber']), hit(2, ['health', 'data', 'it']), hit(3, ['it'])])
    expect(count('Combines Psychology and Cyber security')).toBe(1)
    expect(count('Combines Health, Data science and Information technology')).toBe(1)
    expect(count('Fits both')).toBe(0)
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
    expect(count('Fits both your interests')).toBe(1)
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
