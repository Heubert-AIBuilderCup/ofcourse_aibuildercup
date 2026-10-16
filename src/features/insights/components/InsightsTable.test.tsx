/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import type { InsightRow, ShowingStats } from '../lib/rank'
import { InsightsTable } from './InsightsTable'

afterEach(cleanup)

const row = (id: string, over: Partial<InsightRow> = {}): InsightRow => ({
  path: { id, label: `Path ${id}`, city: 'City', course: 'Course', university: 'University' },
  count: 10,
  mock: false,
  status: 'none',
  showing: null,
  lines: [],
  ...over,
})

const MOCK_LINE = 'Counts marked mock are examples until real views build up.'

it('links "Make comic" to a new comic with the row’s path chosen, for an editor', () => {
  render(<InsightsTable rows={[row('ecu-cyber'), row('uts-data')]} canMake />)
  const links = screen.getAllByRole('link', { name: /Make comic/ })
  expect(links.map((l) => l.getAttribute('href'))).toEqual([
    '/admin/comics/new?path=ecu-cyber',
    '/admin/comics/new?path=uts-data',
  ])
})

it('offers no "Make comic" to someone who cannot make one', () => {
  render(<InsightsTable rows={[row('ecu-cyber')]} canMake={false} />)
  expect(screen.queryByRole('link', { name: /Make comic/ })).toBeNull()
})

it('says what mock counts are only when a row is mock', () => {
  const { rerender } = render(<InsightsTable rows={[row('a'), row('b')]} canMake={false} />)
  expect(screen.queryByText(MOCK_LINE)).toBeNull()
  rerender(<InsightsTable rows={[row('a'), row('b', { mock: true })]} canMake={false} />)
  expect(screen.getByText(MOCK_LINE)).toBeInTheDocument()
  expect(screen.getByText('Mock')).toBeInTheDocument()
})

const zero = { cost: 0, time: 0, work: 0, pr: 0, location: 0, career: 0 }
const SHOWN: ShowingStats = {
  showings: 5,
  byFuture: { cost: 2, staying: 1, career: 0 },
  strongOn: { ...zero, time: 40, cost: 80 },
  costsOn: { ...zero, pr: 60, career: 20 },
  outOfReach: { count: 2, avgOverK: 7 },
}
const LINES: InsightRow['lines'] = [
  { dim: 'time', text: 'About 5 years to permanent residency' },
  { dim: 'work', text: 'Part-time work near campus' },
  { dim: 'pr', text: 'State nomination, then PR' },
  { dim: 'career', text: 'Steady demand for security roles' },
]
const NOT_SHOWN = 'Not shown to students yet'
const details = (label: string) => screen.getByRole('group', { name: `Details of ${label}` })

it('details a shown path: by future, strengths and costs as shares, out of reach, its lines', () => {
  render(<InsightsTable rows={[row('a', { showing: SHOWN, lines: LINES })]} canMake={false} />)
  const box = details('Path a')
  expect(box).toHaveTextContent('Shown 5 times in the last 30 days')
  expect(box).toHaveTextContent('As a future Cost 2 · Staying 1 · Career 0')
  expect(box).toHaveTextContent(
    'Strong on, of the times it was shown as a future Cost 80% · Time 40%',
  )
  expect(box).toHaveTextContent(
    'Costs on, of the times it was shown as a future PR 60% · Career 20%',
  )
  expect(box).toHaveTextContent('Out of reach 2 times, AUD 7k over the hard limit on average')
  for (const line of LINES) expect(box).toHaveTextContent(line.text)
  expect(box).not.toHaveTextContent(NOT_SHOWN)
})

it('reads "Not shown to students yet" for a path never shown or mock-counted, with no strengths or costs', () => {
  render(
    <InsightsTable
      rows={[row('a', { lines: LINES }), row('b', { mock: true, lines: LINES })]}
      canMake={false}
    />,
  )
  for (const label of ['Path a', 'Path b']) {
    const box = details(label)
    expect(box).toHaveTextContent(NOT_SHOWN)
    expect(box).not.toHaveTextContent(/Strong on|Costs on|Out of reach|As a future/)
    expect(box).toHaveTextContent(LINES[0].text)
  }
})

it('says when a shown path had no strength, no cost, or was never out of reach', () => {
  const plain = { ...SHOWN, strongOn: zero, costsOn: zero, outOfReach: { count: 0, avgOverK: 0 } }
  render(<InsightsTable rows={[row('a', { showing: plain })]} canMake={false} />)
  const box = details('Path a')
  expect(box).toHaveTextContent('Strong on, of the times it was shown as a future None')
  expect(box).toHaveTextContent('Costs on, of the times it was shown as a future None')
  expect(box).toHaveTextContent('Out of reach Never')
})
