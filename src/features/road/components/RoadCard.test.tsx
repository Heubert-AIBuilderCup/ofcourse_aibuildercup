/// <reference lib="dom" />
// The course card's blocks (18 Oct): the guide, then its conditions (the condition badges and the
// course's own), then Ask, then Study, Careers and Related fields, each with one source line.
// Strings and counts only: never an element in an assertion.

import { afterAll, afterEach, beforeAll, describe, expect, it, mock } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import type { CardDetails } from '@/features/roads/client'
import { cardFor } from '../model/press'
import { getRoad } from '../model/road-data'
import { buildScene, sessionFrom } from '../model/scene'
import { RoadCard } from './RoadCard'

afterEach(cleanup)

// next/image (the guide's duck) resolves its src against the page's URL; happy-dom starts on about:blank.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => dom.setURL('http://localhost:3000/roadmaps/rm-1'))
afterAll(() => dom.setURL(startUrl))

const road = getRoad()
const scene = buildScene(road, sessionFrom({}, false))
const SOURCE = { title: 'ECU course handbook · mock', date: 'Sep 2026' }

const DETAILS: CardDetails = {
  subjects: {
    majors: ['Network security', 'Digital forensics'],
    units: ['Ethical hacking', 'Incident response'],
    conditions: ['A programming bridging unit if you have not programmed before'],
  },
  occupations: [
    {
      code: '262112',
      name: 'ICT Security Specialist',
      market: { code: '262112', cityId: 'perth', openings: 420, payLowK: 95, payHighK: 130 },
    },
    { code: '263299', name: 'ICT Support Engineer', market: null },
  ],
  fieldsNear: [
    { name: 'Information technology', definition: 'Running computer systems.' },
    { name: 'Data science', definition: 'Patterns in data.' },
    { name: 'Networks', definition: 'Connecting computers.' },
    { name: 'Software', definition: 'Writing programs.' },
    { name: 'Business', definition: 'How organisations decide.' },
  ],
}

/** Her own course's card (Cyber Security at ECU: intakes, an IELTS condition, a fork ahead). */
function renderCard(details: CardDetails = DETAILS) {
  return render(
    <RoadCard
      road={road}
      scene={scene}
      card={cardFor(road, scene, null)}
      onOpen={mock()}
      onClose={mock()}
      onLesson={mock()}
      ask={{
        roadmapId: 'rm-1',
        tileId: scene.here,
        asks: [{ question: 'Can I work while I study?', answer: 'Yes (mock).', source: SOURCE }],
      }}
      details={details}
    />,
  )
}

/** The card's blocks by their titles, in the order they are drawn. */
function blocks(): string[] {
  const named: [string, Element][] = [
    ['Your guide', screen.getByText('Your guide')],
    ['Ask about it', screen.getByRole('region', { name: 'Ask about it' })],
    ...screen
      .getAllByRole('heading', { level: 2 })
      .map((h): [string, Element] => [h.textContent ?? '', h]),
  ]
  return named
    .sort(([, a], [, b]) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    )
    .map(([name]) => name)
}

/** The text of a block, by its heading. */
const block = (title: string) =>
  screen.getByRole('heading', { level: 2, name: title }).closest('section')

describe('the course card', () => {
  it('reads guide, conditions, Ask, then Study, Careers and Related fields', () => {
    renderCard()
    expect(blocks()).toEqual([
      'Your guide',
      'Conditions',
      'Ask about it',
      'Study',
      'Careers',
      'Related fields',
    ])
  })

  it('puts the condition badges and the course’s own conditions together, the other badges after', () => {
    renderCard()
    const conditions = block('Conditions')?.textContent ?? ''
    expect(conditions).toContain('IELTS 6.5 by March')
    expect(conditions).toContain('A programming bridging unit if you have not programmed before')
    expect(conditions.includes('Several offerings') || conditions.includes('Fork ahead')).toBe(
      false,
    )
    expect(block('Study')?.textContent?.includes('programming bridging')).toBe(false)
    const card = document.body.textContent ?? ''
    expect(card.includes('Several offerings') && card.includes('Fork ahead')).toBe(true)
  })

  it('says each group’s source once, with its mock tag', () => {
    renderCard()
    for (const title of ['Conditions', 'Study', 'Careers', 'Related fields']) {
      const sources = [...(block(title)?.querySelectorAll('p') ?? [])]
        .map((p) => p.textContent ?? '')
        .filter((text) => text.startsWith('Source:'))
      expect(sources.length, title).toBe(1)
      expect(sources[0]?.endsWith('mock'), title).toBe(true)
    }
  })

  it('names each occupation once, with its sample job market where there is one', () => {
    renderCard()
    const careers = [...(block('Careers')?.querySelectorAll('li') ?? [])].map(
      (li) => li.textContent,
    )
    expect(careers).toEqual([
      'ICT Security Specialist ANZSCO 262112420 openings · AUD 95–130k starting · Perth',
      'ICT Support Engineer ANZSCO 263299No sample figures for this city',
    ])
    expect(block('Careers')?.textContent).toContain('sample data')
  })

  it('lists three related fields and says how many more', () => {
    renderCard()
    const fields = [...(block('Related fields')?.querySelectorAll('li') ?? [])].map(
      (li) => li.textContent,
    )
    expect(fields).toEqual([
      'Information technologyRunning computer systems.',
      'Data sciencePatterns in data.',
      'NetworksConnecting computers.',
      'and 2 more',
    ])
  })

  it('draws no conditions block when the course has none', () => {
    renderCard({ subjects: { majors: ['Data'], units: [], conditions: [] } })
    // Her own course still carries its IELTS condition badge.
    expect(blocks().slice(0, 3)).toEqual(['Your guide', 'Conditions', 'Ask about it'])
    expect(block('Conditions')?.textContent?.includes('bridging')).toBe(false)
  })
})
