/// <reference lib="dom" />
// The Find card's subjects: a combined course says which subjects it combines, and one that fits two
// of her stated interests carries the "Fits both" tag. Compared as strings and counts, never elements.
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { FieldId } from '@/features/engine/types'
import type { FinderHit } from '../model/types'
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
