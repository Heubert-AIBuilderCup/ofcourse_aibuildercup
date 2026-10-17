// The judges' stories: each one's answers land on its own road, so a catalogue change that makes a
// story drift to another road fails here, and each is a set onboarding could have stored.

import { describe, expect, test } from 'bun:test'
import { cityById } from '@/features/engine/catalogue'
import { parseAnswer } from '@/features/opening/model/questions'
import { matchLine } from '@/features/road/model/match-line'
import {
  coinsSchema,
  type QuestionKey,
  relativeSchema,
  storedAnswersSchema,
} from '@/shared/types/student'
import { askFacts } from '../model/ask'
import { courseConditions } from '../model/conditions'
import { type RoadFor, roadFor } from '../model/road-for'
import { whyTemplate } from '../model/why'
import { courseById } from './courses'
import { relatedFields } from './fields'
import { JUDGE_STORIES, judgeStoryById } from './judge-stories'

/** Each story's road: its kind, city, course and ending (the PR route it stays on, or home). */
const ROADS: Record<
  string,
  { kind: RoadFor['kind']; id: string; city: string; course: string; ending: string }
> = {
  priya: { kind: 'matched', id: 'perth-cyber', city: 'perth', course: 'ecu-cyber', ending: '190' },
  aarav: {
    kind: 'matched',
    id: 'sydney-uts-civil-stay',
    city: 'sydney',
    course: 'uts-civil',
    ending: '491',
  },
  sita: {
    kind: 'matched',
    id: 'adelaide-unisa-nursing-stay',
    city: 'adelaide',
    course: 'unisa-nursing',
    ending: '190',
  },
  meera: {
    kind: 'matched',
    id: 'melbourne-swin-ux-home',
    city: 'melbourne',
    course: 'swin-ux',
    ending: 'home',
  },
  // He'd stay, and the road stays, but psychology leads to no occupation on a state list or
  // sponsored by an employer: the closest road, with the strip saying so.
  rohan: {
    kind: 'nearest',
    id: 'melbourne-swin-cyberpsych-stay',
    city: 'melbourne',
    course: 'swin-cyberpsych',
    ending: 'none',
  },
}

/** A story, and the road roadFor gives its answers. */
const roadForStory = (id: string) => {
  const story = judgeStoryById(id)
  if (!story) throw new Error(`No story "${id}"`)
  return { story, r: roadFor({ answers: story.answers, relative: story.relative }, {}) }
}

const roadOf = (id: string) => {
  const { r } = roadForStory(id)
  return {
    kind: r.kind,
    id: r.spec?.id,
    city: r.spec?.cityId,
    course: r.spec?.courseId,
    ending: r.spec ? (r.spec.stays ? r.spec.prRoute : 'home') : undefined,
  }
}

describe('the judges’ stories', () => {
  test('are Priya, Aarav, Sita, Meera and Rohan, in that order', () => {
    expect(JUDGE_STORIES.map((s) => s.id)).toEqual(['priya', 'aarav', 'sita', 'meera', 'rohan'])
  })

  for (const [id, road] of Object.entries(ROADS)) {
    test(`${id}'s answers land on ${road.id}`, () => {
      expect(roadOf(id)).toEqual(road)
    })
  }

  test("Rohan's road differs from his answers only in its way to PR", () => {
    const { r } = roadForStory('rohan')
    expect(r.differences.map((d) => `${d.key}: ${d.road}`)).toEqual(['stay: No clear PR'])
  })

  test('Rohan’s board shows "Why this road?" on Cyberpsychology, its chip naming the way to PR', () => {
    const { r } = roadForStory('rohan')
    expect(courseById(r.spec?.courseId ?? '')?.name).toBe('Master of Psychology (Cyberpsychology)')
    const line = matchLine(r)
    expect(line?.title).toBe('Closest road to your answers')
    expect(line?.chips).toEqual([
      "Staying: this road has no clear road to PR (you said you'd stay)",
    ])
  })

  for (const id of Object.keys(ROADS)) {
    test(`${id}'s alternative and stacked course are in the story's field or a related one`, () => {
      const { r } = roadForStory(id)
      const field = courseById(r.spec?.courseId ?? '')?.field ?? ''
      const near = (courseId: string) => {
        const other = courseById(courseId)?.field ?? ''
        return other === field || relatedFields(field).includes(other)
      }
      const alt = r.spec?.altCourseId ?? ''
      const stack = r.spec?.stackCourseId ?? ''
      expect(`${id}: ${alt} ${near(alt)} · ${stack} ${near(stack)}`).toBe(
        `${id}: ${alt} true · ${stack} true`,
      )
    })
  }

  test('each lands on a road of its own', () => {
    const ids = JUDGE_STORIES.map((s) => roadOf(s.id).id)
    expect(new Set(ids).size).toBe(JUDGE_STORIES.length)
  })

  test('the five are on five courses, in at least four fields', () => {
    const courses = JUDGE_STORIES.map((s) => roadOf(s.id).course ?? '')
    expect(new Set(courses).size).toBe(5)
    expect(new Set(courses.map((id) => courseById(id)?.field)).size).toBeGreaterThanOrEqual(4)
  })

  test("Sita's English misses Nursing's stricter score, so her course card shows it unmet", () => {
    const { story, r } = roadForStory('sita')
    const english = courseConditions(r.spec?.courseId ?? '', story.answers).find(
      (c) => c.id === 'english',
    )
    expect(`${english?.text} · ${english?.met}`).toBe('Needs IELTS 7.0 · false')
  })

  for (const id of Object.keys(ROADS)) {
    test(`${id}'s course tile has catalogue facts for Ask, and a why from the template`, () => {
      const { story, r } = roadForStory(id)
      if (!r.spec) throw new Error(`No road for ${id}`)
      const course = courseById(r.spec.courseId)
      const ids = askFacts(r.spec, 'course', story.answers, []).rows.map((row) => row.id)
      for (const row of ['course-fees', 'course-units', 'course-entry-english', 'ask-1'])
        expect(`${id}: ${row} ${ids.includes(row)}`).toBe(`${id}: ${row} true`)
      expect(ids.some((row) => row.startsWith('occupation-'))).toBe(true)
      const why = whyTemplate(r.spec, 'course', story.answers, {
        differences: r.differences,
        relative: story.relative,
      })
      expect(why.startsWith('On your roadmap: ')).toBe(true)
      expect(why).toContain(`${course?.name} at ${course?.university}`)
    })
  }

  test('each is a set onboarding could have stored: answers, person and coins', () => {
    for (const story of JUDGE_STORIES) {
      const keys = Object.keys(story.answers) as QuestionKey[]
      const refused = keys.filter((key) => {
        const answer = story.answers[key]
        return parseAnswer(key, answer?.value)?.state !== 'stated'
      })
      expect(`${story.id}: ${refused.join(', ')}`).toBe(`${story.id}: `)
      expect(Object.keys(storedAnswersSchema.parse(story.answers)).length).toBe(keys.length)
      if (story.relative) expect(relativeSchema.safeParse(story.relative).success).toBe(true)
      expect(coinsSchema.safeParse(story.coins).success).toBe(true)
    }
  })

  test('an unknown id is no story', () => {
    expect(judgeStoryById('nobody')).toBeUndefined()
  })
})

describe('the judges’ stories: their budgets', () => {
  // A year's cost for her answers: the course's fees, plus the city's living costs when her budget
  // covers living too. Only two stories show the over-budget condition, each a different kind.
  const gap = (id: string) => {
    const story = judgeStoryById(id)!
    const answers = story.answers as Record<string, { value: unknown } | undefined>
    const spec = roadFor({ answers: story.answers, relative: story.relative }, {}).spec!
    const course = courseById(spec.courseId)!
    const living = answers.covers?.value === 'Fees and living' ? cityById(spec.cityId).livingK : 0
    return {
      over: course.feeK + living - (answers.amount?.value as number),
      hard: answers.hard?.value,
    }
  }

  test('Priya, Meera and Rohan are within their budgets', () => {
    for (const id of ['priya', 'meera', 'rohan']) expect(gap(id).over).toBeLessThanOrEqual(0)
  })

  test('Aarav is a little over a rough budget, and Sita just over a hard limit', () => {
    const aarav = gap('aarav')
    expect(aarav.over > 0 && aarav.over <= 5).toBe(true)
    expect(aarav.hard).toBe('Roughly')
    const sita = gap('sita')
    expect(sita.over > 0 && sita.over <= 2).toBe(true)
    expect(sita.hard).toBe('Hard limit')
  })
})
