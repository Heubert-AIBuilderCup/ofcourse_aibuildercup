/// <reference lib="dom" />
// The section titles of a card's details: h2 on the board, where nothing sits above them. A
// finder card's own level (h4) is asserted through the real path in FinderPanel.test.tsx.

import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import { CardDetails } from './CardDetails'

afterEach(cleanup)

const JOBS = [
  {
    code: '224999',
    name: 'Business Analyst',
    market: { code: '224999', cityId: 'perth', openings: 350, payLowK: 87, payHighK: 123 },
  },
]
const FIELDS = [{ name: 'Information systems', definition: 'Systems that run a business.' }]

const titleTags = (container: HTMLElement) =>
  [...container.querySelectorAll('section > :first-child')].map((t) => t.tagName)

describe('card section headings', () => {
  it('default to h2, so the board is unchanged', () => {
    const { container } = render(
      <CardDetails
        details={{
          subjects: { majors: ['Data'], units: [], conditions: [] },
          occupations: JOBS,
          fieldsNear: FIELDS,
        }}
      />,
    )
    expect(titleTags(container)).toEqual(['H2', 'H2', 'H2', 'H2'])
  })
})

describe('a job’s card', () => {
  it('shows its code, its sample pay and openings in her city, its lists and its way to PR', () => {
    const { container } = render(
      <CardDetails
        details={{
          job: {
            code: '261313',
            name: 'Software Engineer',
            city: 'Adelaide',
            market: {
              code: '261313',
              cityId: 'adelaide',
              openings: 360,
              payLowK: 88,
              payHighK: 128,
            },
            lists: ["Software Engineer is on SA's 190 list"],
            prWay: 'Supports a 190 state nomination in SA',
          },
        }}
      />,
    )
    const text = container.textContent ?? ''
    expect(text).toContain('ANZSCO 261313')
    expect(text).toContain('AUD 88–128k starting')
    expect(text).toContain('360 openings in Adelaide')
    expect(text).toContain("Software Engineer is on SA's 190 list")
    expect(text).toContain('Supports a 190 state nomination in SA')
    expect(text).toContain('sample data')
  })

  it('says when there are no sample figures for her city', () => {
    const { container } = render(
      <CardDetails
        details={{
          job: { code: '1', name: 'J', city: 'Hobart', market: null, lists: [], prWay: 'x' },
        }}
      />,
    )
    expect(container.textContent).toContain('No sample figures for Hobart')
  })
})
