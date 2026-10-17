// The judges' stories: each one's answers land on its own road, so a catalogue change that makes a
// story drift to another road fails here, and each is a set onboarding could have stored.

import { describe, expect, test } from 'bun:test'
import { parseAnswer } from '@/features/opening/model/questions'
import {
  coinsSchema,
  type QuestionKey,
  relativeSchema,
  storedAnswersSchema,
} from '@/shared/types/student'
import { type RoadFor, roadFor } from '../model/road-for'
import { JUDGE_STORIES, judgeStoryById } from './judge-stories'

/** Each story's road: its kind, city, course and ending (the PR route it stays on, or home). */
const ROADS: Record<
  string,
  { kind: RoadFor['kind']; id: string; city: string; course: string; ending: string }
> = {
  priya: { kind: 'matched', id: 'perth-cyber', city: 'perth', course: 'ecu-cyber', ending: '190' },
  aarav: { kind: 'matched', id: 'sydney-data', city: 'sydney', course: 'uts-data', ending: '186' },
  sita: { kind: 'matched', id: 'adelaide-it', city: 'adelaide', course: 'unisa-it', ending: '491' },
  meera: {
    kind: 'matched',
    id: 'melbourne-home',
    city: 'melbourne',
    course: 'monash-data',
    ending: 'home',
  },
  // She'd stay, and the road stays, but a Diploma gives no clear road to PR: the closest road,
  // with the strip saying so.
  rohan: {
    kind: 'nearest',
    id: 'perth-tafe-cyber-stay',
    city: 'perth',
    course: 'tafe-cyber',
    ending: 'none',
  },
}

const roadOf = (id: string) => {
  const story = judgeStoryById(id)
  if (!story) throw new Error(`No story "${id}"`)
  const r = roadFor({ answers: story.answers, relative: story.relative }, {})
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
    const story = judgeStoryById('rohan')
    if (!story) throw new Error('No Rohan')
    const r = roadFor({ answers: story.answers, relative: story.relative }, {})
    expect(r.differences.map((d) => `${d.key}: ${d.road}`)).toEqual(['stay: No clear PR'])
  })

  test('each lands on a road of its own', () => {
    const ids = JUDGE_STORIES.map((s) => roadOf(s.id).id)
    expect(new Set(ids).size).toBe(JUDGE_STORIES.length)
  })

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
