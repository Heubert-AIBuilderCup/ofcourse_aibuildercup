// What each card adds beyond its why (criteria 29 to 33): subjects, work, graduate jobs, the list
// status and related fields. Pure, from the catalogue.

import { describe, expect, it } from 'bun:test'
import type { StoredAnswers } from '@/shared/types/student'
import { FIELDS } from '../data/fields'
import { ROADS, roadById } from '../data/roads'
import { subjectsOf } from '../data/subjects'
import type { Occupation } from '../data/types'
import { specById } from './compose'
import { stated as a } from './demo-profiles'
import { cardDetails, detailsByTile, listLines } from './details'

/** No answers: she picked no field, so the road's own field stands for hers. */
const NONE: StoredAnswers = {}

const road = (id: string) => {
  const spec = roadById(id)
  if (!spec) throw new Error(`${id} road missing`)
  return spec
}

describe('every course on every road has subjects (29)', () => {
  it('has majors, units and conditions for each course the roads use', () => {
    const missing = ROADS.flatMap((r) => [r.courseId, r.altCourseId, r.stackCourseId]).filter(
      (id) => subjectsOf(id) === undefined,
    )
    expect(missing).toEqual([])
  })
})

describe('cardDetails: subjects (29)', () => {
  it('gives the course, the alternative and the stack their majors, units and conditions', () => {
    const spec = road('perth-cyber')
    for (const [slot, id] of [
      ['course', spec.courseId],
      ['alt-course', spec.altCourseId],
      ['stack-course', spec.stackCourseId],
    ] as const) {
      const subjects = subjectsOf(id)
      if (!subjects) throw new Error(`${id} has no subjects`)
      expect(cardDetails(spec, slot, NONE)?.subjects).toEqual({
        majors: subjects.majors,
        units: subjects.units,
        conditions: subjects.conditions,
      })
    }
  })
})

describe('cardDetails: work during the course (30)', () => {
  it('lists the placements and part-time work in the road city for its field, not graduate programs', () => {
    const work = cardDetails(road('perth-cyber'), 'course-years', NONE)?.work
    expect(work?.map((w) => w.title)).toEqual([
      'Security operations placement',
      'Help desk assistant',
    ])
    expect(work?.[0]).toEqual({
      title: 'Security operations placement',
      employer: 'Swan River Cyber',
      kind: 'placement',
      demand: 'moderate',
    })
  })

  it('uses the road city and field: Hobart IT, not Perth cyber', () => {
    const titles = cardDetails(road('hobart-it'), 'course-years', NONE)?.work?.map((w) => w.title)
    expect(titles).toEqual(['Software placement', 'IT support technician'])
  })
})

describe('cardDetails: after the course (31)', () => {
  it('gives the 485 card its graduate programs and the occupations the course leads to', () => {
    const details = cardDetails(road('perth-cyber'), 'visa-485', NONE)
    expect(details?.graduate).toEqual([
      { title: 'Graduate security analyst', employer: 'Swan River Cyber' },
    ])
    expect(details?.occupations).toEqual([{ code: '262112', name: 'ICT Security Specialist' }])
  })
})

describe('cardDetails: the list status (32)', () => {
  it('says whether the occupation is on the state list for the way to stay', () => {
    const spec = road('perth-cyber')
    const line = "ICT Security Specialist is on WA's 190 list"
    expect(cardDetails(spec, 'pr-straight', NONE)?.listStatus).toEqual([line])
    expect(cardDetails(spec, 'pr-lane', NONE)?.listStatus).toEqual([
      "ICT Security Specialist is on WA's 491 list",
    ])
  })

  it('says "is not on" when the state lacks the list, in the state the course is taught in', () => {
    // UniSA's Software Engineer and Systems Analyst: SA has 190 for one, 491 only for the other.
    const status = cardDetails(road('adelaide-it'), 'pr-straight', NONE)?.listStatus
    expect(status).toEqual([
      "Software Engineer is on SA's 190 list",
      "Systems Analyst is not on SA's 190 list",
    ])
  })

  it('reads the state the course is taught in', () => {
    // geelong-business: Deakin Geelong sits in VIC, where the BA is on the 491 only.
    const spec = road('geelong-business')
    expect(cardDetails(spec, 'pr-lane', NONE)?.listStatus).toEqual([
      "Business Analyst is on VIC's 491 list",
    ])
  })

  it('follows the tile own visa: the 191 reads the 491 list', () => {
    expect(cardDetails(road('perth-cyber'), 'pr-lane-end', NONE)?.listStatus).toEqual([
      "ICT Security Specialist is on WA's 491 list",
    ])
  })

  it('reads employer sponsorship on a 186 or 482 tile, not a state list', () => {
    const sponsored = 'Data Scientist can be employer-sponsored'
    const sydney = road('sydney-data')
    expect(cardDetails(sydney, 'pr-straight', NONE)?.listStatus).toEqual([sponsored])
    expect(cardDetails(sydney, 'pr-lane', NONE)?.listStatus).toEqual([sponsored])
    expect(cardDetails(road('geelong-business'), 'pr-straight', NONE)?.listStatus).toEqual([
      'Business Analyst can be employer-sponsored',
    ])
  })

  it('says when an occupation cannot be employer-sponsored', () => {
    const stub: Occupation = {
      code: '000000',
      name: 'Stub analyst',
      courseIds: [],
      lists: {},
      employerSponsored: false,
      source: { title: 'Stub · mock', date: 'Oct 2026' },
    }
    expect(listLines([stub], '186', 'WA')).toEqual([
      'Stub analyst is not on the employer-sponsored list',
    ])
  })

  it('has none on the road home', () => {
    const spec = road('melbourne-home')
    for (const slot of ['pr-straight', 'pr-lane', 'pr-lane-end'] as const)
      expect(cardDetails(spec, slot, NONE)).toBeNull()
  })
})

describe('cardDetails: related to what she picked (33)', () => {
  const field = (id: string) => {
    const f = FIELDS.find((x) => x.id === id)
    if (!f) throw new Error(`${id} field missing`)
    return { field: f.name, definition: f.definition }
  }

  it('marks the alternative course when its field neighbours hers, with its definition', () => {
    // perth-cyber's alternative is Curtin's IT: IT neighbours cyber security.
    const details = cardDetails(road('perth-cyber'), 'alt-course', a({ field: 'Cyber security' }))
    expect(details?.related).toEqual(field('it'))
    expect(details?.subjects).toBeDefined()
  })

  it('marks the stack card the same way', () => {
    // perth-cyber's stack is Curtin's Information Systems, an IT course.
    const details = cardDetails(road('perth-cyber'), 'stack-course', a({ field: 'Cyber security' }))
    expect(details?.related).toEqual(field('it'))
  })

  it('reads her field, not the road: Data science on the cyber road leaves IT unmarked', () => {
    const details = cardDetails(road('perth-cyber'), 'alt-course', a({ field: 'Data science' }))
    expect(details?.related).toBeUndefined()
  })

  it('reads the areas she is drawn to', () => {
    const drawn = (areas: string[]) => a({ know: "A few areas I'm drawn to", areas })
    // hobart-it's alternative is UTAS Data Science: data neighbours business.
    expect(cardDetails(road('hobart-it'), 'alt-course', drawn(['Business']))?.related).toEqual(
      field('data'),
    )
    // geelong-business's alternative is Deakin Cyber Security: cyber does not neighbour data.
    const data = drawn(['Data'])
    expect(cardDetails(road('geelong-business'), 'alt-course', data)?.related).toBeUndefined()
  })

  it('takes the road field when she picked none', () => {
    expect(cardDetails(road('perth-cyber'), 'alt-course', NONE)?.related).toEqual(field('it'))
  })

  it('leaves a course in her own field unmarked', () => {
    // adelaide-it's alternative is UniSA Cyber Security.
    const details = cardDetails(road('adelaide-it'), 'alt-course', a({ field: 'Cyber security' }))
    expect(details?.related).toBeUndefined()
  })

  it('lists no courses from other cities: the more-courses card adds nothing', () => {
    expect(cardDetails(road('perth-cyber'), 'more-courses', NONE)).toBeNull()
  })
})

describe('cardDetails: other slots', () => {
  it('is null for every slot the card has nothing to add to', () => {
    const spec = road('perth-cyber')
    for (const slot of [
      'point-a',
      'australia',
      'city',
      'alt-city',
      'more-cities',
      'visa-500',
      'fork',
      'pr-point',
    ] as const)
      expect(cardDetails(spec, slot, NONE)).toBeNull()
  })
})

describe('detailsByTile: the layout sends one entry per tile that has something to show', () => {
  it('keys each slot with details by its tile id and leaves the others out', () => {
    const spec = road('perth-cyber')
    const byTile = detailsByTile(spec, NONE)
    expect(cardDetails(spec, 'course', NONE)).toEqual(byTile[spec.slots.course.id])
    expect(cardDetails(spec, 'visa-485', NONE)).toEqual(byTile[spec.slots['visa-485'].id])
    expect(spec.slots['point-a'].id in byTile).toBe(false)
    expect(Object.values(byTile).every((d) => d !== null)).toBe(true)
  })
})

describe('cardDetails on a composed road (criterion 56)', () => {
  const NURSING = specById('adelaide-unisa-nursing-stay')
  if (!NURSING) throw new Error('adelaide-unisa-nursing-stay missing')

  it('gives its course card the subjects of its own course', () => {
    const subjects = subjectsOf(NURSING.courseId)
    if (!subjects) throw new Error(`${NURSING.courseId} has no subjects`)
    expect(cardDetails(NURSING, 'course', NONE)?.subjects).toEqual({
      majors: subjects.majors,
      units: subjects.units,
      conditions: subjects.conditions,
    })
  })

  it('reads its way-to-stay tile’s visa from the slot, whatever the tile’s id', () => {
    const slot = NURSING.slots['pr-straight']
    const renamed = {
      ...NURSING,
      slots: { ...NURSING.slots, 'pr-straight': { ...slot, id: 'pr-way' } },
    }
    const lines = cardDetails(renamed, 'pr-straight', NONE)?.listStatus
    expect(lines).toEqual(cardDetails(NURSING, 'pr-straight', NONE)?.listStatus)
    expect(lines?.[0]).toBe(`Registered Nurse is on SA's ${slot.visa} list`)
  })
})
