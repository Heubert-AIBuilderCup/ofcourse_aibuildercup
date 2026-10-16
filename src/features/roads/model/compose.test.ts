import { describe, expect, it } from 'bun:test'
import { COURSES, cityById, cityOf } from '@/features/engine/catalogue'
import type { Level } from '@/features/engine/types'
import { ALL_PICKS, pickId, type RoadPick } from '../data/candidates'
import { courseById, EXTRA_COURSES } from '../data/courses'
import { relatedFields } from '../data/fields'
import { CITY_STATE, occupationsFor } from '../data/occupations'
import { ROAD_KEYS } from '../data/road-keys'
import { ROADS, roadById } from '../data/roads'
import { SKELETONS } from '../data/skeletons'
import type { RoadSpec, SlotCopy } from '../data/types'
import { buildRoad } from './build'
import { composeRoad, specById } from './compose'
import { courseWords } from './course-words'
import { expectSound, strings } from './sound.test-helpers'

const handWritten = (p: RoadPick) =>
  ROAD_KEYS.some((k) => k.cityId === p.cityId && k.courseId === p.courseId && k.stays === p.stays)
const COMPOSED = ALL_PICKS.filter((p) => !handWritten(p))
const pick = (cityId: string, courseId: string): RoadPick => ({ cityId, courseId, stays: true })
const home = (cityId: string, courseId: string): RoadPick => ({ cityId, courseId, stays: false })
const levelOf = (p: RoadPick): Level => courseById(p.courseId)!.level
/** The catalogue gives the course no clear road to PR: its PR score is 0. */
const NO_CLEAR_PR = (p: RoadPick) => courseById(p.courseId)!.prScore === 0
const AFTER_485 = ['fork', 'pr-straight', 'pr-point', 'pr-lane', 'pr-lane-end'] as const
// Each pick is composed once, the first time a test reads it.
const SPECS = new Map<string, RoadSpec>()
function specOf(p: RoadPick): RoadSpec {
  const id = pickId(p)
  const spec = SPECS.get(id) ?? composeRoad(p)
  SPECS.set(id, spec)
  return spec
}

describe('the candidate roads', () => {
  it('take only two-year courses: the three-year Bachelor at ECU is on no road (criteria 55, 56)', () => {
    for (const p of ALL_PICKS) expect(courseById(p.courseId)?.years).toBe(2)
    expect(ALL_PICKS.some((p) => p.courseId === 'ecu-bsc-cyber')).toBe(false)
  })

  it('are every city with a skeleton × every two-year course taught there (Master’s and Diploma) × staying and going home, the six hand-written roads among them', () => {
    const cities = Object.keys(SKELETONS)
    const expected = cities.flatMap((cityId) =>
      [...COURSES, ...EXTRA_COURSES]
        .filter((c) => c.years === 2 && cityOf(c).id === cityId)
        .flatMap((c) => [true, false].map((stays) => pickId({ cityId, courseId: c.id, stays }))),
    )
    expect(ALL_PICKS.map(pickId).sort()).toEqual([...expected].sort())
    for (const cityId of cities) {
      const masters = ALL_PICKS.filter(
        (p) => p.cityId === cityId && p.stays && levelOf(p) === "Master's",
      )
      expect(masters.length).toBeGreaterThanOrEqual(3)
    }
    for (const id of ['tafe-cyber', 'unisa-dip-it', 'deakin-dip-business', 'monash-dip-health']) {
      const cityId = cityOf(courseById(id)!).id
      expect(ALL_PICKS).toContainEqual({ cityId, courseId: id, stays: true })
      expect(ALL_PICKS).toContainEqual({ cityId, courseId: id, stays: false })
    }
    for (const key of ROAD_KEYS) {
      expect(ALL_PICKS).toContainEqual({
        cityId: key.cityId,
        courseId: key.courseId,
        stays: key.stays,
      })
    }
    expect(ALL_PICKS.filter((p) => p.stays)).toContainEqual(pick('adelaide', 'unisa-nursing'))
    expect(ALL_PICKS.filter((p) => p.stays)).toContainEqual(pick('melbourne', 'swin-ux'))
  })

  it('start from a skeleton per city, one per hand-written road, that assumes no way home and no level', () => {
    expect(Object.keys(SKELETONS).sort()).toEqual([...new Set(ROADS.map((r) => r.cityId))].sort())
    for (const skeleton of Object.values(SKELETONS)) {
      const text = JSON.stringify(skeleton)
      expect(text).not.toMatch(/\bhome\b|\b485\b|Master’s/i)
    }
  })

  it('each have their own id; a hand-written combination keeps its road’s id', () => {
    const ids = ALL_PICKS.map(pickId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(pickId(pick('perth', 'ecu-data'))).toBe('perth-ecu-data-stay')
    expect(pickId({ cityId: 'perth', courseId: 'ecu-data', stays: false })).toBe(
      'perth-ecu-data-home',
    )
    for (const key of ROAD_KEYS) {
      expect(pickId({ cityId: key.cityId, courseId: key.courseId, stays: key.stays })).toBe(key.id)
    }
  })
})

describe('every candidate road (criterion 55)', () => {
  for (const p of ALL_PICKS) {
    it(`${pickId(p)} is sound`, () => {
      const spec = specOf(p)
      expect(spec.id).toBe(pickId(p))
      expect([spec.cityId, spec.courseId, spec.stays]).toEqual([p.cityId, p.courseId, p.stays])
      expect(spec.field).toBe(courseById(p.courseId)!.field)
      expect(spec.level).toBe(levelOf(p))
      expectSound(buildRoad(spec, { answers: {} }), spec)
    })
  }
})

describe('hand-written text wins (criterion 57)', () => {
  for (const road of ROADS) {
    it(`${road.id}: its city, course and stay give back its own spec`, () => {
      const p = { cityId: road.cityId, courseId: road.courseId, stays: road.stays }
      expect(composeRoad(p)).toEqual(roadById(road.id)!)
    })
  }
})

describe('the template’s text is impersonal (criterion 58)', () => {
  it('names no relative, no degree she holds and no English score', () => {
    expect(COMPOSED.length).toBeGreaterThan(0)
    for (const p of COMPOSED) {
      const text = JSON.stringify(composeRoad(p))
      expect(text).not.toMatch(
        /\b(mother|father|parents?|brother|sister|uncle|aunt|cousin|relatives?|family)\b/i,
      )
      expect(text).not.toMatch(/\byour (degree|bachelor|diploma|qualification)\b|\byou hold\b/i)
      expect(text).not.toMatch(/IELTS \d|PTE \d|TOEFL \d|\bscore of\b/i)
    }
  })
})

describe('a staying ending follows her course’s occupation', () => {
  const ending = (p: RoadPick) => {
    const { slots, prRoute } = composeRoad(p)
    return {
      prRoute,
      straight: slots['pr-straight'].visa,
      lane: slots['pr-lane'].visa,
      laneEnd: slots['pr-lane-end'].visa,
    }
  }

  it('is a 190 when the occupation is on the state’s 190 list, then the 491 and 191 when on its 491 list', () => {
    // Registered Nurse is on SA's 190 and 491 lists.
    expect(ending(pick('adelaide', 'unisa-nursing'))).toEqual({
      prRoute: '190',
      straight: '190',
      lane: '491',
      laneEnd: '191',
    })
    // Accountant (General) is on WA's 190 list only.
    expect(ending(pick('perth', 'curtin-commerce'))).toEqual({
      prRoute: '190',
      straight: '190',
      lane: '482',
      laneEnd: '186',
    })
  })

  it('is an employer’s 186 when the occupation is on no 190 list there', () => {
    // Civil Engineer is on NSW's 491 list, not its 190.
    expect(ending(pick('sydney', 'uts-civil'))).toEqual({
      prRoute: '491',
      straight: '186',
      lane: '491',
      laneEnd: '191',
    })
    // Data Scientist is on no Victorian list, and employers sponsor it: the steps say so.
    expect(ending(pick('melbourne', 'monash-data'))).toEqual({
      prRoute: '186',
      straight: '186',
      lane: '482',
      laneEnd: '186',
    })
    const data = composeRoad(pick('melbourne', 'monash-data')).slots['pr-straight'].card.guide
    expect(data).toContain('Data Scientist is on no Victoria list')
  })

  it('reads the city’s own state for every composed road, and names the occupation it rests on', () => {
    for (const p of COMPOSED.filter((c) => c.stays && !NO_CLEAR_PR(c))) {
      const state = CITY_STATE[p.cityId]
      const lists = occupationsFor(p.courseId).flatMap((o) => o.lists[state] ?? [])
      const { straight, lane, laneEnd } = ending(p)
      expect(straight).toBe(lists.includes('190') ? '190' : '186')
      expect([lane, laneEnd]).toEqual(lists.includes('491') ? ['491', '191'] : ['482', '186'])
    }
    const nurse = composeRoad(pick('hobart', 'utas-nursing')).slots
    expect(nurse['pr-straight'].card.guide).toContain('Registered Nurse is on its 190 list')
    expect(nurse['pr-lane'].card.guide).toContain('Registered Nurse is on Tasmania’s 491 list')
  })

  it('claims no road to PR when the catalogue gives the course none, and says why (criterion 58)', () => {
    const stays = ALL_PICKS.filter((p) => p.stays && NO_CLEAR_PR(p))
    expect(stays.map(pickId)).toEqual(
      expect.arrayContaining([
        'perth-tafe-cyber-stay',
        'adelaide-unisa-dip-it-stay',
        'geelong-deakin-dip-business-stay',
        'melbourne-swin-ux-stay',
      ]),
    )
    for (const p of stays) {
      const spec = specOf(p)
      const course = courseById(p.courseId)!
      // Its one mention of permanent residency is the fork saying there is no clear road to it.
      const text = strings(AFTER_485.map((s) => spec.slots[s]))
        .join(' ')
        .replace('No clear road to permanent residency', '')
      const claimsPr = /\b(190|491|191|186|482)\b|ways to PR|[Pp]ermanent/.test(text)
      expect([pickId(p), claimsPr]).toEqual([pickId(p), false])
      expect(spec.prRoute).toBe('none')
      expect(spec.label).toEndWith(' · no clear PR')
      expect(spec.slots.fork.card.guide).toContain(
        `No clear road to permanent residency from here: ${course.lines.pr.claim.detail.at(-1)?.toLowerCase()}`,
      )
      expect(spec.overview.rows.at(-1)).toBe('No clear road to PR · 2 ways from the 485')
    }
  })

  it('never offers an employer’s path on an occupation employers do not sponsor', () => {
    for (const p of COMPOSED.filter((c) => c.stays)) {
      const spec = specOf(p)
      const visas = AFTER_485.map((s) => spec.slots[s].visa)
      const sponsored = occupationsFor(p.courseId).some((o) => o.employerSponsored)
      expect([pickId(p), visas.includes('186') && !sponsored]).toEqual([pickId(p), false])
    }
  })
})

describe('the 485 comes from the course words', () => {
  for (const road of ROADS) {
    it(`a composed Master’s road in ${road.cityId} has the 485 of its hand-written road`, () => {
      const p = COMPOSED.find((c) => c.cityId === road.cityId && levelOf(c) === "Master's")!
      expect(composeRoad(p).slots['visa-485']).toEqual(road.slots['visa-485'])
    })
  }
})

describe('a Diploma road is named for its own level (criterion 89)', () => {
  const DIPLOMAS = ALL_PICKS.filter((p) => levelOf(p) === 'Diploma')
  const MASTERS = /Master['’]s|master['’]s/

  it('calls the course step and the course years “Diploma · <subject>”, never Master’s', () => {
    expect(DIPLOMAS.length).toBe(8)
    for (const p of DIPLOMAS) {
      const spec = specOf(p)
      const subject = courseById(p.courseId)!.name.replace(/^Diploma of /, '')
      expect(spec.slots.course.courseStepName).toBe(`Diploma · ${subject}`)
      expect(spec.slots['course-years'].name).toBe(`Diploma · ${subject}`)
      expect(spec.slots['course-years'].short).toBe('Diploma')
      for (const s of strings([spec.slots.course, spec.slots['course-years'], spec.lesson])) {
        expect(s).not.toMatch(MASTERS)
      }
      expect(spec.lesson.title).toBe('The Diploma years, in 3 minutes')
    }
    const it = specOf(home('adelaide', 'unisa-dip-it'))
    expect(it.slots.course.courseStepName).toBe('Diploma · Information Technology')
    expect(it.label).toBe('Adelaide · Diploma of Information Technology · home')
  })

  it('has a 485 in the post-vocational stream, about 18 months, wherever the city', () => {
    for (const p of DIPLOMAS) {
      const visa = specOf(p).slots['visa-485']
      const text = strings(visa).join(' ')
      expect(visa.id).toBe('graduate-visa-485')
      expect(text).toContain('post-vocational stream')
      expect(text).toContain('18 months')
      expect(text).not.toMatch(MASTERS)
      expect(text).not.toMatch(/five years|2 years/i)
      expect(visa.card.because).toBe('It follows the Diploma')
    }
  })

  it('says the diploma’s work rights on the city cards, never a master’s', () => {
    for (const p of DIPLOMAS) {
      const { slots } = specOf(p)
      for (const slot of ['city', 'alt-city'] as const) {
        expect(strings(slots[slot]).join(' ')).not.toMatch(MASTERS)
        expect(slots[slot].card.guide).toContain('18 months of post-study work rights')
      }
    }
  })

  it('keeps the graduate stream on a Master’s road', () => {
    const spec = specOf(pick('perth', 'curtin-it'))
    expect(spec.slots['visa-485'].card.guide).toBe(
      'Up to five years of work rights after regional study, in any job.',
    )
    expect(spec.slots['visa-485'].card.because).toBe('It follows the Master’s')
    expect(spec.slots.course.courseStepName).toBe('Master’s · Information Technology')
  })
})

describe('the road home (criterion 59)', () => {
  const HOMES = COMPOSED.filter((p) => !p.stays)
  const MELBOURNE_HOME = roadById('melbourne-home')!

  it('claims no way to stay after the 485 on any road home', () => {
    expect(HOMES.length).toBe(26)
    for (const p of HOMES) {
      const spec = specOf(p)
      const text = strings(AFTER_485.map((s) => spec.slots[s])).join(' ')
      expect(text).not.toMatch(/\bPR\b|\b(190|491|191|186|482)\b|[Pp]ermanent/)
      expect(spec.prRoute).toBe('none')
      expect(spec.label).toEndWith(' · home')
      expect(spec.badges.fork).toEqual(MELBOURNE_HOME.badges.fork)
      expect(spec.overview.rows.at(-1)).toBe('Home · 2 ways from the 485')
      for (const s of AFTER_485) expect(spec.slots[s].id).toBe(MELBOURNE_HOME.slots[s].id)
    }
  })

  it('reads as melbourne-home’s road home in a big city after a master’s', () => {
    const { slots, label } = specOf(home('melbourne', 'monash-it'))
    expect(label).toBe('Melbourne · Information Technology · home')
    for (const s of ['fork', 'pr-straight', 'pr-point', 'pr-lane-end'] as const) {
      expect(slots[s]).toEqual(MELBOURNE_HOME.slots[s])
    }
    const { card, ...lane } = slots['pr-lane']
    const { card: writtenCard, ...writtenLane } = MELBOURNE_HOME.slots['pr-lane']
    expect(lane).toEqual(writtenLane)
    expect(card.guide).toBe(
      'More years of work in Australia before going home. After a big-city master’s the 485 runs 2 years; staying on after it needs another visa, such as one an employer sponsors.',
    )
    expect({ ...card, guide: '' }).toEqual({ ...writtenCard, guide: '' })
    expect(specOf(home('sydney', 'uts-civil')).slots['pr-straight']).toEqual(
      MELBOURNE_HOME.slots['pr-straight'],
    )
  })

  it('names the city and its longer 485 in a regional city, and the 18 months after a diploma', () => {
    const perth = specOf(home('perth', 'curtin-it')).slots
    expect(perth['pr-straight'].name).toBe('Home with up to five years of Australian work')
    expect(perth['pr-straight'].card.guide).toBe(
      'Home when the 485 ends: up to five years of work rights after a master’s in Perth, which counts as regional.',
    )
    expect(perth['pr-lane'].card.guide).toContain(
      'After a master’s in Perth, which counts as regional, the 485 can run up to five years',
    )
    const diploma = specOf(home('geelong', 'deakin-dip-business')).slots
    expect(diploma['pr-straight'].name).toBe('Home with 18 months of Australian work')
    expect(diploma['pr-straight'].card.guide).toBe(
      'Home when the 485 ends: about 18 months of work rights after a diploma.',
    )
    expect(diploma['pr-lane'].card.guide).toContain('After a diploma the 485 runs about 18 months')
  })
})

/** A field's words in copy; "IT" only in capitals, so the word "it" is not read as one. */
const FIELD_WORDS: Record<string, RegExp> = {
  it: /\bIT\b|[Ii]nformation [Tt]echnology/,
  cyber: /[Cc]yber|[Ss]ecurity/,
  data: /\b[Dd]ata\b/,
  business: /[Bb]usiness|[Aa]nalytic/,
  health: /[Hh]ealth|[Nn]urs/,
  engineering: /[Ee]ngineer/,
  design: /[Dd]esign|\bUX\b/,
  psych: /[Pp]sycholog/,
}

describe('the cities on a composed road', () => {
  it('name no field but her course’s own, in the city and the other city', () => {
    for (const p of COMPOSED) {
      const course = courseById(p.courseId)!
      const { slots } = specOf(p)
      const text = strings([slots.city, slots['alt-city']])
        .join(' ')
        .replaceAll(course.name, '')
        .replaceAll(course.name.replace(/^Master of /, ''), '')
      for (const [field, words] of Object.entries(FIELD_WORDS)) {
        const named = field !== course.field && words.test(text)
        expect(named ? `${pickId(p)} names ${field}: ${text}` : '').toBe('')
      }
    }
  })

  it('weigh PR as the city’s own facts have it on a staying road, and not at all on a road home', () => {
    const trades = (copy: SlotCopy) =>
      [copy, copy.card, ...(copy.here ? [copy.here] : [])]
        .flatMap((c) => [c.gains, c.costs])
        .filter(Boolean)
    for (const p of COMPOSED) {
      const spec = specOf(p)
      const cities = [
        ['city', spec.cityId],
        ['alt-city', spec.altCityId],
      ] as const
      for (const [slot, cityId] of cities) {
        const copy = spec.slots[slot]
        if (!p.stays) {
          for (const t of trades(copy)) expect(t).not.toMatch(/\bPR\b/)
          continue
        }
        const side = cityById(cityId).regional ? copy.card.gains : copy.card.costs
        expect(side).toMatch(/\bPR\b/)
      }
    }
    const melbourne = specOf(pick('melbourne', 'swin-ux')).slots
    expect(melbourne.city.card.costs).toBe('Less good for: cost, PR')
    expect(melbourne.city.here?.costs).toBe('Less good for: cost, PR')
    expect(melbourne['alt-city'].costs).toBe('Less good for: cost, PR')
    expect(specOf(home('sydney', 'uts-civil')).slots.city.card.costs).toBe('Less good for: cost')
    expect(specOf(home('perth', 'curtin-it')).slots.city.card.gains).toBe('Good for: work')
    expect(specOf(home('adelaide', 'unisa-nursing')).slots['alt-city'].card.gains).toBeUndefined()
  })
})

describe('the courses around her course', () => {
  const RANK: Record<Level, number> = { Diploma: 0, "Bachelor's": 1, "Master's": 2 }
  const gap = (a: string, b: string) =>
    Math.abs(RANK[courseById(a)!.level] - RANK[courseById(b)!.level])

  it('takes the alternative and the stack course at her course’s level first, then the nearest level', () => {
    for (const p of COMPOSED) {
      const spec = specOf(p)
      const others = [
        ...new Set(
          ALL_PICKS.filter((o) => o.cityId === p.cityId && o.courseId !== p.courseId).map(
            (o) => o.courseId,
          ),
        ),
      ]
      const nearest = Math.min(...others.map((id) => gap(id, p.courseId)))
      expect(gap(spec.altCourseId, p.courseId)).toBe(nearest)
      if (others.filter((id) => gap(id, p.courseId) === nearest).length > 1) {
        expect(gap(spec.stackCourseId, p.courseId)).toBe(nearest)
      }
    }
    // Public Health's own field in Melbourne is the Diploma of Health Science: a Master's road
    // never puts a Diploma beside it while the city has other Master's courses.
    expect(specOf(pick('melbourne', 'monash-mph')).altCourseId).not.toBe('monash-dip-health')
    // Adelaide has no other Diploma, so its Diploma's nearest are Master's, its own field first.
    expect(specOf(pick('adelaide', 'unisa-dip-it')).altCourseId).toBe('unisa-it')
  })

  it('marks a stack row “Match well” only at her course’s level', () => {
    for (const p of COMPOSED) {
      for (const row of specOf(p).stackRows.filter((r) => r.tag === 'Match well')) {
        expect(`${pickId(p)}: ${courseById(row.courseId)!.level}`).toBe(
          `${pickId(p)}: ${levelOf(p)}`,
        )
      }
    }
    const tafe = specOf(pick('perth', 'curtin-it')).stackRows.find(
      (r) => r.courseId === 'tafe-cyber',
    )
    expect(tafe?.tag).toBe('')
  })

  it('takes the alternative from her course’s field or a related one first, in the same city', () => {
    for (const p of COMPOSED) {
      const spec = specOf(p)
      const course = courseById(p.courseId)!
      const alt = courseById(spec.altCourseId)!
      const stack = courseById(spec.stackCourseId)!
      expect(cityOf(alt).id).toBe(p.cityId)
      expect(cityOf(stack).id).toBe(p.cityId)
      expect(new Set([course.id, alt.id, stack.id]).size).toBe(3)
      const near = (id: string) => {
        const f = courseById(id)!.field
        return f === course.field || relatedFields(course.field).includes(f)
      }
      const others = ALL_PICKS.filter(
        (o) => o.cityId === p.cityId && o.courseId !== course.id && levelOf(o) === alt.level,
      )
      if (others.some((o) => near(o.courseId))) expect(near(alt.id)).toBe(true)
    }
    // Data science's neighbour in Perth is business (Commerce); civil engineering has none in
    // Sydney, so its alternative is the city's other course, in catalogue order.
    expect(composeRoad(pick('perth', 'ecu-data')).altCourseId).toBe('curtin-commerce')
    expect(composeRoad(pick('sydney', 'uts-civil')).altCourseId).toBe('uts-cyber')
  })

  it('stacks the alternative again when the city has only two courses, and says so', () => {
    const words = courseWords('adelaide', 'unisa-it', ['unisa-it', 'unisa-cyber'])
    expect(words.altCourseId).toBe('unisa-cyber')
    expect(words.stackCourseId).toBe('unisa-cyber')
    expect(words.slots['stack-course'].id).not.toBe(words.slots['alt-course'].id)
    const row = words.stackRows.find((r) => r.tileId === words.slots['stack-course'].id)
    expect(row?.sub).toContain('the only other course in Adelaide')
  })
})

describe('specById: the one lookup for any road (criterion 56)', () => {
  it('gives each hand-written road by its id, as written', () => {
    for (const road of ROADS) expect(specById(road.id)).toEqual(road)
  })

  it('gives every composed road by its pick’s id, composed', () => {
    for (const p of COMPOSED) expect(specById(pickId(p))).toEqual(specOf(p))
  })

  it('is null for an id no pick has, even one shaped like a pick’s', () => {
    expect(specById('nowhere')).toBeNull()
    expect(specById('perth-uts-data-stay')).toBeNull()
    expect(specById('adelaide-unisa-nursing-later')).toBeNull()
  })
})
