import { describe, expect, it } from 'bun:test'
import { type PhoneRow, phoneRows, rowFor } from './phone-road'
import { getRoad } from './road-data'
import { buildScene, NEW_SESSION, type Session } from './scene'

const road = getRoad()
const rows = (session: Partial<Session> = {}) =>
  phoneRows(road, buildScene(road, { ...NEW_SESSION, ...session }))
const step = (list: PhoneRow[], id: string) => {
  const row = list.find((r) => r.id === id)
  if (row?.kind !== 'step') throw new Error(`No step row ${id}`)
  return row
}

describe('the phone road', () => {
  it('lists the road in order, where she is in her place, and the fork at its end', () => {
    expect(rows().map((r) => `${r.kind}:${r.id}`)).toEqual([
      'step:point-a',
      'step:australia',
      'step:perth',
      'here:cyber-security-ecu-perth',
      'step:student-visa-500',
      'step:masters-cyber-security-ecu',
      'step:graduate-visa-485',
      'fork:fork',
    ])
  })

  it('leads each kicker with the step’s date, then its state and its kind word', () => {
    const list = rows()
    expect(list.flatMap((r) => (r.kind === 'step' ? [r.kicker] : []))).toEqual([
      'You',
      'Country',
      'City',
      'Late 2026 · Next · Visa',
      'Feb 2027 – Dec 2028 · Study',
      'From 2029 · Work visa',
    ])
    expect(step(list, 'perth').state).toBe('lit')
    expect(step(list, 'student-visa-500').state).toBe('next')
    expect(step(list, 'graduate-visa-485').state).toBe('fog')
  })

  it('gives a place its own line and a step its guide', () => {
    const list = rows()
    expect(step(list, 'perth').line).toBe('Curtin Bentley: about 25 min from Anjali in Cannington')
    expect(step(list, 'student-visa-500').line).toBe(
      'Lodge once the offer and health cover are in hand.',
    )
  })

  it('offers the city level under the city she reached, and the lesson on the study step', () => {
    const list = rows()
    expect(step(list, 'perth').alts.map((a) => a.name)).toEqual(['Adelaide', '17 more cities'])
    expect(step(list, 'australia').alts).toEqual([])
    expect(step(list, 'masters-cyber-security-ecu').lesson).toBe('masters-years')
  })

  it('draws the two ways to PR side by side, the thinner one dashed', () => {
    const fork = rows().at(-1)
    if (fork?.kind !== 'fork') throw new Error('No fork row')
    expect(fork.kicker).toBe('2031 – 2034 · Fork · 2 ways to PR')
    expect(fork.tiles[0]).toBe('two-ways-to-pr')
    expect(fork.ways).toEqual([
      {
        id: 'state-nomination-190',
        kicker: '2031 → 2032',
        name: '190 · state nomination',
        line: 'WA nominates you on your regional work years.',
        end: 'Permanent residency · Point B',
        thin: false,
      },
      {
        id: 'regional-491',
        kicker: '2031 → 2034',
        name: '491 · regional',
        line: 'Five-year provisional visa.',
        end: '191 · permanent',
        thin: true,
      },
    ])
  })

  it('after the lesson, its steps show as looked at and offer it no more', () => {
    const masters = step(rows({ read: true }), 'masters-cyber-security-ecu')
    expect(masters.kicker).toBe('Feb 2027 – Dec 2028 · Looked at · Study')
    expect(masters.lesson).toBeUndefined()
  })

  it('on the first arrival, Perth is next with the hint, and the course after it is dark', () => {
    const list = rows({ first: true })
    expect(list.find((r) => r.kind === 'here')?.id).toBe('australia')
    const perth = step(list, 'perth')
    expect(perth.kicker).toBe('Next · City')
    expect(perth.hint).toBe(true)
    const course = step(list, 'cyber-security-ecu-perth')
    expect(course.kicker).toBe('Course')
    expect(course.state).toBe('fog')
    expect(course.alts).toEqual([])
  })

  it('walked back to Perth, her course is next with the courses beside it', () => {
    const course = step(rows({ city: true }), 'cyber-security-ecu-perth')
    expect(course.kicker).toBe('Next · Course')
    expect(course.alts.map((a) => a.name)).toEqual(['Data Science', '13 more in Perth'])
  })
})

describe('the row a tile sits in', () => {
  it('is its own row, the row it is offered under, or where she is for the tiles beside her', () => {
    const list = rows()
    expect(rowFor(list, 'student-visa-500')?.id).toBe('student-visa-500')
    expect(rowFor(list, 'adelaide')?.id).toBe('perth')
    expect(rowFor(list, 'data-science-uwa-perth')?.kind).toBe('here')
    expect(rowFor(list, 'permanent-191')?.kind).toBe('fork')
    expect(rowFor(list, 'two-ways-to-pr')?.kind).toBe('fork')
    expect(rowFor(list, 'nowhere')).toBeUndefined()
  })
})
