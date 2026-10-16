import { describe, expect, it } from 'bun:test'
import { PRIYA } from '@/features/road/model/fixture'
import { cardFor } from '@/features/road/model/press'
import type { Road } from '@/features/road/model/road-data'
import { applyAnswers, buildScene, sessionFrom } from '@/features/road/model/scene'
import type { StoredAnswers } from '@/shared/types/student'
import { ALL_PICKS, pickId } from '../data/candidates'
import { courseById } from '../data/courses'
import { FIELDS } from '../data/fields'
import { ROAD_KEYS } from '../data/road-keys'
import { ROADS, roadById } from '../data/roads'
import { type RoadSpec, SLOTS } from '../data/types'
import { buildRoad } from './build'
import { specById } from './compose'
import { expectSound } from './sound.test-helpers'
import { isWhySlot, whyTitle } from './why'

const stated = (value: string | number) => ({ value, state: 'stated' as const })

for (const spec of ROADS) {
  describe(`the ${spec.id} road`, () => {
    const road = buildRoad(spec, { answers: {} })

    it('is sound: Priya’s shape, its own ids, a card per tile, the board’s words and the catalogue’s figures', () => {
      expectSound(road, spec)
    })

    it('gives a why to the cards of the tiles her answers decided, and to no other (criterion 15)', () => {
      const scene = buildScene(road, sessionFrom({}, false))
      for (const slot of SLOTS) {
        const id = spec.slots[slot].id
        const { why, whyTitle: title } = road.cards[id]
        if (isWhySlot(slot)) {
          expect(why?.trim()).toBeTruthy()
          expect(title).toBe(whyTitle(slot))
        } else {
          expect(why).toBeUndefined()
          expect(title).toBeUndefined()
        }
        if (scene.tiles.some((t) => t.id === id)) {
          expect(cardFor(road, scene, id).why).toBe(why)
          expect(cardFor(road, scene, id).whyTitle).toBe(title)
        }
      }
      // Where she stands, her card carries its tile's why and its title too.
      const here = cardFor(road, scene, null)
      expect(here.why).toBe(road.cards[scene.here].why)
      expect(here.whyTitle).toBe(road.cards[scene.here].whyTitle)
    })

    it('measures a budget against the course’s own fees (criterion 6)', () => {
      const course = courseById(spec.courseId)!
      const scene = applyAnswers(buildScene(road, sessionFrom({}, false)), {
        amount: stated(24),
      })
      const onRoad = scene.tiles.find((t) => t.id === spec.slots.course.id)
      if (course.feeK > 24) expect(onRoad?.badges?.[0]).toBe('over')
    })

    it('starts Point A from her answers', () => {
      const answers: StoredAnswers = {
        qual: stated("Bachelor's"),
        eng: stated('IELTS 6.5'),
        amount: stated(30),
      }
      const point = spec.slots['point-a'].id
      expect(buildRoad(spec, { answers }).here[point].sub).toBe(
        "Bachelor's · IELTS 6.5 · AUD 30k a year for fees",
      )
      expect(road.here[point].sub).toBe('Where you start')
    })

    it('leaves out an answer she does not know', () => {
      const answers: StoredAnswers = { qual: stated('Unknown'), eng: stated('IELTS 6.5') }
      expect(buildRoad(spec, { answers }).here[spec.slots['point-a'].id].sub).toBe('IELTS 6.5')
    })
  })
}

describe('the six roads', () => {
  it('are six, and cover the cities, fields and ways to stay the board needs (criterion 2)', () => {
    expect(ROADS).toHaveLength(6)
    const cities = ROADS.map((r) => r.cityId)
    expect(cities).toContain('perth')
    expect(cities).toContain('adelaide')
    expect(cities.some((c) => c === 'sydney' || c === 'melbourne')).toBe(true)
    expect(new Set(ROADS.map((r) => r.field)).size).toBeGreaterThanOrEqual(3)
    const routes = ROADS.map((r) => r.prRoute)
    for (const route of ['190', '491', '186'] as const) expect(routes).toContain(route)
    expect(ROADS.filter((r) => !r.stays)).toHaveLength(1)
  })

  it('lets the road home claim no way to stay', () => {
    const home = ROADS.find((r) => !r.stays)!
    // Her coin weights name PR as a criterion; the road's own words never offer it.
    const { weights: _, ...road } = buildRoad(home, { answers: {} })
    expect(JSON.stringify(road)).not.toMatch(/\bPR\b|permanent|\b(189|190|191|491|186)\b/i)
  })

  it('take their keys from ROAD_KEYS, in its order: the keys are what matching reads', () => {
    expect(
      ROADS.map(({ id, label, stays, field, level, cityId, courseId }) => ({
        id,
        label,
        stays,
        field,
        level,
        cityId,
        courseId,
      })),
    ).toEqual([...ROAD_KEYS])
  })

  it('finds a road by its id', () => {
    for (const spec of ROADS) expect(roadById(spec.id)).toBe(spec)
    expect(roadById('nowhere')).toBeUndefined()
  })

  it('never changes Priya’s road', () => {
    const before = JSON.stringify(PRIYA)
    for (const spec of ROADS) buildRoad(spec, { answers: { amount: stated(30) } })
    expect(JSON.stringify(PRIYA)).toBe(before)
  })
})

describe('the stack rows marked related to what she picked (33)', () => {
  const rows = (id: string, answers: StoredAnswers) => {
    const spec = roadById(id)
    if (!spec) throw new Error(`${id} road missing`)
    return buildRoad(spec, { answers }).stackRows
  }
  const marked = (id: string, answers: StoredAnswers) =>
    rows(id, answers)
      .filter((r) => r.related)
      .map((r) => r.name)
  const itField = FIELDS.find((f) => f.id === 'it')

  it('marks the rows whose course neighbours her field, with that field and its definition', () => {
    const perth = rows('perth-cyber', { field: stated('Cyber security') })
    expect(perth.filter((r) => r.related).map((r) => r.name)).toEqual(['Information Systems'])
    expect(perth[0].related).toEqual({
      field: 'Information technology',
      definition: itField?.definition as string,
    })
  })

  it('reads her field, not the road: on the IT road, cyber security marks the IT row', () => {
    expect(marked('hobart-it', { field: stated('Cyber security') })).toEqual([
      'Information Technology',
    ])
    expect(marked('hobart-it', {})).toEqual(['Cyber Security'])
  })

  it('names a course the catalogue has on every row of every road', () => {
    const missing = ROADS.flatMap((spec) =>
      spec.stackRows
        .filter((row) => !courseById(row.courseId))
        .map((row) => `${spec.id}: ${row.name}`),
    )
    expect(missing).toEqual([])
  })
})

describe('the English and entry conditions on the course card (61, 62)', () => {
  const specOf = (courseId: string, stays = true) => {
    const pick = ALL_PICKS.find((p) => p.courseId === courseId && p.stays === stays)
    const spec = pick && specById(pickId(pick))
    if (!spec) throw new Error(`${courseId} road missing`)
    return spec
  }
  const courseTile = (road: Road, spec: RoadSpec) =>
    road.tiles.find((t) => t.id === spec.slots.course.id)
  const altTile = (road: Road, spec: RoadSpec) =>
    road.tiles.find((t) => t.id === spec.slots['alt-course'].id)

  it('names the course’s own score and reads it against her English answer', () => {
    const nursing = specOf('unisa-nursing')
    const value = (eng?: string) =>
      buildRoad(nursing, { answers: eng ? { eng: stated(eng) } : {} }).badges.ielts
    expect(value().value).toBe('IELTS 7.0 overall')
    expect(value().explanation).toBe('Take the test before you enrol')
    expect(value('IELTS 7.0').value).toBe('IELTS 7.0 overall')
    expect(value('IELTS 7.0').explanation).toBe('You have 7.0, so it is met')
    expect(value('IELTS 6.5').value).toBe('Not met: IELTS 7.0 overall')
    expect(value('IELTS 6.5').explanation).toBe("You have 6.5, so it isn't met yet")
    expect(value('Not taken yet').value).toBe('Not met: IELTS 7.0 overall')
    expect(buildRoad(specOf('ecu-cyber'), { answers: {} }).badges.ielts.value).toBe(
      'IELTS 6.5 overall',
    )
  })

  it('gives the course tile its own IELTS score, so a preview reads the requirement, not the badge', () => {
    const nursing = specOf('unisa-nursing')
    const road = buildRoad(nursing, { answers: { eng: stated('IELTS 6.5') } })
    expect(courseTile(road, nursing)?.ielts).toBe(7)
  })

  it('leaves the "Not taken yet" mark to say Not met once', () => {
    const spec = specOf('unisa-nursing')
    const answers = { eng: stated('Not taken yet') }
    const road = buildRoad(spec, { answers })
    const scene = buildScene(road, sessionFrom({}, false), answers)
    expect(scene.badges.ielts.value).toBe('Not met: IELTS 7.0 overall')
    expect(scene.badges.ielts.explanation).toBe('Take the test before you enrol')
  })

  it('puts the engineering degree condition on the Master of Engineering’s own card', () => {
    const spec = specOf('uts-civil')
    const road = buildRoad(spec, { answers: {} })
    expect(road.badges.maths.value).toBe('Needs a bachelor’s degree in engineering')
    expect(courseTile(road, spec)?.badges).toContain('maths')
    expect(road.here[spec.slots.course.id].badges).toContain('maths')
    expect(altTile(road, spec)?.badges ?? []).not.toContain('maths')
    expect(road.here[spec.slots['alt-course'].id].badges).not.toContain('maths')
  })

  it('puts no degree condition on the Master of Nursing: graduate entry', () => {
    const spec = specOf('unisa-nursing')
    const road = buildRoad(spec, { answers: {} })
    expect(courseTile(road, spec)?.badges).not.toContain('maths')
    expect(road.here[spec.slots.course.id].badges).not.toContain('maths')
    expect(road.badges.maths).toEqual(spec.badges.maths)
    expect(JSON.stringify(road)).not.toMatch(/degree in (nursing|health)/i)
  })
})
