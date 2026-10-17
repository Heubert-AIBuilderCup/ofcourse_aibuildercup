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
