// What changes, row by row (criteria 26–28): her road beside another city's or another course's,
// read through the same rules the roads use, so an alternative on a road says what that road says.

import { beforeAll, describe, expect, mock, test } from 'bun:test'
import { routeWord } from '@/features/roads/data/occupations'
import { roadById } from '@/features/roads/data/roads'
import type { RoadSpec } from '@/features/roads/data/types'
import { composeRoad, workRightsLine } from '@/features/roads/model/compose'
import { stated } from '@/features/roads/model/demo-profiles'
import { nextRoad } from '@/features/roads/model/next-road'
import { otherCourses, otherCourseTileId } from '@/features/roads/model/options'
import type { StoredAnswers } from '@/shared/types/student'
import { FINDER_COURSES } from '../data/catalogue'
import {
  alternativeForCity,
  alternativeForCourse,
  compareByTile,
  compareRows,
  draftPin,
  pinOf,
} from './compare'

mock.module('server-only', () => ({}))

/** Loads the server module afresh under a key of its own (Bun caches a module by its specifier, query
 * included), so finder courses resolve whichever test file ran first. */
let loads = 0
const loadRoadCourses = () => import(`../server/road-courses?compare=${++loads}`)

/** The Perth demo road: Master of Cyber Security at ECU, AUD 33k a year, staying by a 190. */
const perth = roadById('perth-cyber') as RoadSpec
/** The same field in Sydney: UTS, AUD 47k a year, a 491. */
const sydney = composeRoad({ cityId: 'sydney', courseId: 'uts-cyber', stays: true })
const noBudget = stated({ stay: 'Yes', field: 'Cyber security', level: "Master's" })

const row = (rows: ReturnType<typeof compareRows>, key: string) => {
  const found = rows.find((r) => r.key === key)
  if (!found) throw new Error(`No row "${key}"`)
  return found
}

describe('compareRows', () => {
  test('six rows, in order', () => {
    expect(compareRows(perth, sydney, noBudget, 'sydney').map((r) => r.key)).toEqual([
      'money',
      'time',
      'pr',
      'career',
      'subjects',
      'city',
    ])
  })

  test('money: fees a year, in all, and the city’s living; no budget stated, no verdict', () => {
    const money = row(compareRows(perth, sydney, noBudget, 'sydney'), 'money')
    expect(money.current).toBe('AUD 33k a year · AUD 66k in all · living about AUD 21k a year')
    expect(money.alternative).toBe('AUD 47k a year · AUD 94k in all · living about AUD 28k a year')
    expect(money.changed).toBe(true)
  })

  test('money: a stated budget says which fits, by the finder’s fee rule', () => {
    const feesOnly: StoredAnswers = stated({ amount: 36, covers: 'Fees only' })
    const money = row(compareRows(perth, sydney, feesOnly, 'sydney'), 'money')
    expect(money.current).toEndWith(' · fits your budget')
    expect(money.alternative).toEndWith(' · over your budget')
  })

  test('money: with living covered, the city’s living counts against the budget', () => {
    const withLiving: StoredAnswers = stated({ amount: 54, covers: 'Fees and living' })
    const money = row(compareRows(perth, sydney, withLiving, 'sydney'), 'money')
    expect(money.current).toEndWith(' · fits your budget')
    expect(money.alternative).toEndWith(' · over your budget')
  })

  test('money: an assumed budget is not hers and gives no verdict', () => {
    const assumed: StoredAnswers = { amount: { value: 24, state: 'assumed' } }
    expect(row(compareRows(perth, sydney, assumed, 'sydney'), 'money').alternative).toBe(
      'AUD 47k a year · AUD 94k in all · living about AUD 28k a year',
    )
  })

  test('time: the course’s years, then its work rights by the roads’ rule', () => {
    const time = row(compareRows(perth, sydney, noBudget, 'sydney'), 'time')
    expect(time.current).toBe(`2 years · ${workRightsLine('perth', "Master's", 2)}`)
    expect(time.alternative).toBe(`2 years · ${workRightsLine('sydney', "Master's", 2)}`)
  })

  test('PR: the way to stay as the road says it, and Home on a road home', () => {
    const pr = row(compareRows(perth, sydney, noBudget, 'sydney'), 'pr')
    expect(pr.current).toBe('190')
    expect(pr.alternative).toBe(routeWord(sydney.prRoute))
    const home = composeRoad({ cityId: 'sydney', courseId: 'uts-cyber', stays: false })
    expect(row(compareRows(perth, home, noBudget, 'sydney'), 'pr').alternative).toBe('Home')
  })

  test('career: each job with its sample pay and openings in that city', () => {
    const career = row(compareRows(perth, sydney, noBudget, 'sydney'), 'career')
    expect(career.current).toBe(
      'ICT Security Specialist · AUD 103–141k · 310 openings in Perth (sample)',
    )
    expect(career.alternative).toBe(
      'ICT Security Specialist · AUD 104–142k · 620 openings in Sydney (sample)',
    )
    expect(career.changed).toBe(true)
  })

  test('subjects: the first three majors and units', () => {
    const subjects = row(compareRows(perth, sydney, noBudget, 'sydney'), 'subjects')
    expect(subjects.current).toBe('Network security, Digital forensics, Ethical hacking')
    expect(subjects.alternative).toBe('Cyber operations, Security management, Penetration testing')
  })

  test('city: its name and whether it counts as regional', () => {
    const city = row(compareRows(perth, sydney, noBudget, 'sydney'), 'city')
    expect(city.current).toBe('Perth · counts as regional')
    expect(city.alternative).toBe('Sydney · not regional')
  })

  test('changed is false wherever both sides read the same', () => {
    const rows = compareRows(perth, perth, noBudget, 'perth')
    expect(rows.filter((r) => r.changed)).toHaveLength(0)
    const vsSydney = compareRows(perth, sydney, noBudget, 'sydney')
    expect(vsSydney.filter((r) => !r.changed).map((r) => r.key)).toEqual([])
  })

  test('no course of her field there: course rows say so, the city is still compared', () => {
    const rows = compareRows(perth, null, noBudget, 'melbourne')
    for (const r of rows.filter((x) => x.key !== 'city')) {
      expect(r.alternative).toBe('No course of your field there in our catalogue')
      expect(r.changed).toBe(true)
    }
    expect(row(rows, 'city').alternative).toBe('Melbourne · not regional')
  })
})

describe('alternativeForCity', () => {
  test('the first course there of the same field, level and ending', () => {
    const alt = alternativeForCity(perth, 'sydney')
    expect(alt?.courseId).toBe('uts-cyber')
    expect(alt?.stays).toBe(true)
  })

  test('the same field at another level when that city has none at hers', () => {
    const diploma = composeRoad({ cityId: 'perth', courseId: 'tafe-cyber', stays: false })
    const alt = alternativeForCity(diploma, 'sydney')
    expect(alt?.courseId).toBe('uts-cyber')
    expect(alt?.stays).toBe(false)
  })

  test('null when that city teaches nothing of her field', () => {
    const psych = composeRoad({ cityId: 'melbourne', courseId: 'swin-cyberpsych', stays: true })
    expect(alternativeForCity(psych, 'perth')).toBeNull()
  })
})

describe('alternativeForCourse (criteria 27 and 28)', () => {
  beforeAll(loadRoadCourses)

  const finderId = 'f-master-of-data-science-ecu-joondalup'

  test('a found course becomes a road in its own city, ending as hers does', () => {
    const alt = alternativeForCourse(perth, finderId)
    expect(alt?.courseId).toBe(finderId)
    expect(alt?.cityId).toBe('perth')
    expect(alt?.stays).toBe(true)
  })

  test('its PR route and work rights are what its road shows', () => {
    const alt = alternativeForCourse(perth, finderId) as RoadSpec
    const road = composeRoad({ cityId: 'perth', courseId: finderId, stays: true })
    const rows = compareRows(perth, alt, noBudget, alt.cityId)
    expect(row(rows, 'pr').alternative).toBe(routeWord(road.prRoute))
    const rights = row(rows, 'time').alternative.replace(/^2 years · /, '')
    expect(road.slots.city.card.guide).toStartWith(`${rights}.`)
  })

  test('null for a course the catalogue does not have', () => {
    expect(alternativeForCourse(perth, 'no-such-course')).toBeNull()
  })
})

describe('compareByTile (criterion 26)', () => {
  const byTile = compareByTile(perth, noBudget)
  const cityTile = perth.slots['alt-city'].id
  const courseTile = perth.slots['alt-course'].id
  const stackTile = perth.slots['stack-course'].id

  const optionTiles = otherCourses(perth).map(otherCourseTileId)

  test('the other-city, other-course, stack-course and other-course-beside-the-study tiles, no other', () => {
    expect(Object.keys(byTile).sort()).toEqual(
      [cityTile, courseTile, stackTile, ...optionTiles].sort(),
    )
  })

  test('each course beside the study step: her road beside it, it to pin', () => {
    for (const courseId of otherCourses(perth)) {
      const alt = alternativeForCourse(perth, courseId) as RoadSpec
      const compared = byTile[otherCourseTileId(courseId)]
      expect(compared?.rows).toEqual(compareRows(perth, alt, noBudget, alt.cityId))
      expect(compared?.pin).toBe(courseId)
    }
  })

  test('the course she puts on her board from the stack: her road beside it, it to pin', () => {
    const alt = alternativeForCourse(perth, perth.stackCourseId) as RoadSpec
    expect(byTile[stackTile]?.rows).toEqual(compareRows(perth, alt, noBudget, alt.cityId))
    expect(byTile[stackTile]?.pin).toBe(perth.stackCourseId)
  })

  test('the other city: her road beside the same field there, its course to pin', () => {
    const alt = alternativeForCity(perth, perth.altCityId)
    expect(byTile[cityTile]?.rows).toEqual(compareRows(perth, alt, noBudget, perth.altCityId))
    expect(byTile[cityTile]?.pin).toBe('unisa-cyber')
  })

  test('the other course: her road beside that course in its own city, it to pin', () => {
    const alt = alternativeForCourse(perth, perth.altCourseId) as RoadSpec
    expect(byTile[courseTile]?.rows).toEqual(compareRows(perth, alt, noBudget, alt.cityId))
    expect(byTile[courseTile]?.pin).toBe(perth.altCourseId)
  })

  test('a city that teaches nothing of her field still compares, with nothing to pin', () => {
    const psych = composeRoad({ cityId: 'melbourne', courseId: 'swin-cyberpsych', stays: true })
    const elsewhere = { ...psych, altCityId: 'perth' }
    const city = compareByTile(elsewhere, noBudget)[psych.slots['alt-city'].id]
    expect(city?.rows).toEqual(compareRows(elsewhere, null, noBudget, 'perth'))
    expect(city?.pin).toBeNull()
    expect(city?.next).toBeUndefined()
  })

  test('each tile with a course to pin carries the road a new roadmap around it would draw', () => {
    const alt = alternativeForCourse(perth, perth.altCourseId) as RoadSpec
    expect(byTile[courseTile]?.next).toEqual(nextRoad(perth, alt, noBudget))
    for (const [tileId, compared] of Object.entries(byTile))
      expect([tileId, compared.next !== undefined]).toEqual([tileId, compared.pin !== null])
  })
})

describe('pinOf: the one check a pin passes, from the draft and from Create (criterion 29)', () => {
  beforeAll(loadRoadCourses)

  const oneYear = FINDER_COURSES.find((c) => c.years === 1)?.id ?? ''

  test('a known two-year course pins in its own city', () => {
    expect(pinOf('uts-cyber')).toEqual({ courseId: 'uts-cyber', cityId: 'sydney' })
    expect(pinOf('uts-cyber', 'sydney')).toEqual({ courseId: 'uts-cyber', cityId: 'sydney' })
    expect(pinOf('f-master-of-data-science-ecu-joondalup')).toEqual({
      courseId: 'f-master-of-data-science-ecu-joondalup',
      cityId: 'perth',
    })
  })

  test('null for an unknown course, a one-year one and another city', () => {
    expect(pinOf('no-such-course')).toBeNull()
    expect(oneYear).not.toBe('')
    expect(pinOf(oneYear)).toBeNull()
    expect(pinOf('uts-cyber', 'perth')).toBeNull()
  })
})

describe("draftPin: the pin a new roadmap's draft carries", () => {
  const stored = { courseId: 'uts-cyber', cityId: 'sydney' }

  test('the pin ?pin= asks for, with the compare switch on', () => {
    expect(draftPin('uts-cyber', undefined, true)).toEqual(stored)
    expect(draftPin('no-such-course', undefined, true)).toBeNull()
  })

  test('with the compare switch off, ?pin= is not found: no new pin', () => {
    expect(draftPin('uts-cyber', undefined, false)).toBeNull()
  })

  test("a copy keeps its source's pin while it still resolves, switch on or off", () => {
    expect(draftPin(undefined, stored, true)).toBe(stored)
    expect(draftPin(undefined, stored, false)).toBe(stored)
  })

  test('a copy of a roadmap whose stored pin is stale is drafted unpinned', () => {
    expect(
      draftPin(undefined, { courseId: 'f-gone-from-the-catalogue', cityId: 'perth' }, true),
    ).toBeUndefined()
    expect(draftPin(undefined, { courseId: 'uts-cyber', cityId: 'perth' }, true)).toBeUndefined()
    expect(draftPin(undefined, undefined, true)).toBeUndefined()
  })
})
