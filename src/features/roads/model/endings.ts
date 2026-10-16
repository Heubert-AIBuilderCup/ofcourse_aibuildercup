// A road's ending after the 485. Staying: from the course's occupations and the lists of the state
// its city is in: the fork, the way straight on (a 190 when an occupation is on the state's 190
// list, else an employer's 186) and the lane (the 491 then the 191 when one is on its 491 list,
// else an employer's 482 then the 186). Each step names the occupation it rests on, and says so
// when the occupation is on no list there. A course the catalogue gives no clear road to PR
// (stayingRoute's 'none') stays true to it: the 485's two ways, home or longer work, with the
// catalogue's reason on the fork, and no visa that leads to PR. Going home: melbourne-home's two
// ways home, with the 485 the course and the city give (criteria 59, 89), and no visa that leads
// to staying. Pure.

import { cityById } from '@/features/engine/catalogue'
import type { Level } from '@/features/engine/types'
import type { Badge } from '@/features/road/model/road-data'
import { courseById } from '../data/courses'
import { CITY_STATE, occupationsFor, stayingRoute } from '../data/occupations'
import {
  employer186,
  forkAhead,
  forkToPr,
  PERMANENT_186,
  PERMANENT_191,
  PERMANENT_RESIDENCY,
  regional491,
  SKILLS_482,
  step,
  TWO_WAYS_TO_PR,
} from '../data/roads'
import type { Occupation, RoadSpec, StateId } from '../data/types'

export type Ending = {
  slots: Pick<RoadSpec['slots'], 'fork' | 'pr-straight' | 'pr-point' | 'pr-lane' | 'pr-lane-end'>
  prRoute: RoadSpec['prRoute']
  /** The course card's "Fork ahead" badge. */
  fork: Badge
  /** The overview's last row. */
  endRow: string
}

/** A state as the roads' copy names it. */
const STATE_NAME: Record<StateId, string> = {
  WA: 'WA',
  SA: 'SA',
  NSW: 'NSW',
  VIC: 'Victoria',
  TAS: 'Tasmania',
}

const FORK: Record<string, string> = {
  '190-491': 'Two ways to PR from here: the 190 straight on, or the 491 and then the 191.',
  '190-482':
    'Two ways to PR from here: the 190 straight on, or an employer’s 482 and then the 186.',
  '186-491':
    'Two ways to PR from here: an employer’s 186 straight on, or the 491 and then the 191.',
  '186-482':
    'Two ways to PR from here, both through an employer: the 186 straight on, or the 482 and then the 186.',
}

const onList = (o: Occupation, state: StateId, list: '190' | '491') =>
  (o.lists[state] ?? []).includes(list)

/** The employer's 186, with what the lists there say of the course's occupation. */
function employerStep(occupation: Occupation | undefined, state: StateId) {
  const name = STATE_NAME[state]
  if (!occupation) {
    return employer186(
      'An employer nominates you for a real job in your occupation, usually after two years of full-time work in the field.',
    )
  }
  const o = occupation.name
  const lists = occupation.lists[state] ?? []
  const where =
    lists.length === 0
      ? `${o} is on no ${name} list.`
      : `${o} is on ${name}’s 491 list, not its 190.`
  const sponsor = occupation.employerSponsored
    ? ''
    : ' It is not on the lists employers sponsor from.'
  return employer186(
    `An employer nominates you for a real job in your occupation, ${o}, usually after two years of full-time work in the field. ${where}${sponsor}`,
  )
}

/** The ending of a road that stays, for a course taught in a city. */
export function prEnding(courseId: string, cityId: string): Ending {
  const state = CITY_STATE[cityId]
  const name = STATE_NAME[state]
  const occupations = occupationsFor(courseId)
  const course = courseById(courseId)
  const route = stayingRoute(courseId, cityId)
  if (course && route === 'none') {
    // The catalogue's own reason when it gives one (its PR line), else what the lists say.
    const why =
      course.prScore === 0
        ? (course.lines.pr.claim.detail.at(-1) ?? course.lines.pr.text)
        : `the jobs it leads to are on no ${name} list, and employers do not sponsor them`
    return noClearPrEnding(cityId, course.level, why)
  }
  const on190 = occupations.find((o) => onList(o, state, '190'))
  const on491 = occupations.find((o) => onList(o, state, '491'))

  const straight = on190
    ? step(
        'state-nomination-190',
        '190 · state nomination',
        '190',
        '2031',
        `${name} can nominate you: ${on190.name} is on its 190 list. You agree to live and work in ${name} for two years.`,
        TWO_WAYS_TO_PR,
        '190',
      )
    : employerStep(occupations[0], state)
  const lane = on491
    ? regional491(
        `A five-year provisional visa: ${on491.name} is on ${name}’s 491 list. You live and work in a regional area.`,
      )
    : SKILLS_482

  return {
    slots: {
      fork: forkToPr(FORK[`${on190 ? '190' : '186'}-${on491 ? '491' : '482'}`]),
      'pr-straight': straight,
      'pr-point': PERMANENT_RESIDENCY,
      'pr-lane': lane,
      'pr-lane-end': on491 ? PERMANENT_191 : PERMANENT_186,
    },
    prRoute: route,
    fork: forkAhead('to PR'),
    endRow: 'Permanent residency · 2 ways from the 485',
  }
}

const TWO_WAYS_HOME = 'One of 2 ways home from the 485'

const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1)

/**
 * The ending of a staying road whose course has no clear road to PR: the 485's two ways (home when
 * it ends, or longer work first), with the reason on the fork.
 */
function noClearPrEnding(cityId: string, level: Level, why: string): Ending {
  const home = homeEnding(cityId, level)
  return {
    ...home,
    slots: {
      ...home.slots,
      fork: {
        ...home.slots.fork,
        id: 'no-clear-road-to-pr',
        name: 'No clear road to PR',
        short: 'No clear PR',
        card: {
          ...home.slots.fork.card,
          guide: `No clear road to permanent residency from here: ${lowerFirst(why)}. Two ways on from the 485: home when it ends, or more years of work in Australia first.`,
        },
      },
    },
    endRow: 'No clear road to PR · 2 ways from the 485',
  }
}

/** The 485 a road home rests on, said three ways, by the course's level and the city. */
function homeWorkRights(cityId: string, level: Level) {
  const city = cityById(cityId)
  if (level === 'Diploma') {
    return {
      years: '18 months',
      rights: 'about 18 months of work rights after a diploma',
      runs: 'After a diploma the 485 runs about 18 months',
    }
  }
  if (city.regional) {
    const where = `a master’s in ${city.name}, which counts as regional`
    return {
      years: 'up to five years',
      rights: `up to five years of work rights after ${where}`,
      runs: `After ${where}, the 485 can run up to five years`,
    }
  }
  return {
    years: 'two years',
    rights: '2 years of work rights after a big-city master’s',
    runs: 'After a big-city master’s the 485 runs 2 years',
  }
}

/** The ending of a road home, for a course of this level in this city. */
export function homeEnding(cityId: string, level: Level): Ending {
  const { years, rights, runs } = homeWorkRights(cityId, level)
  return {
    slots: {
      fork: {
        id: 'two-ways-home',
        name: 'Two ways home',
        short: '2 ways home',
        card: {
          kicker: 'Fork',
          sub: '2031',
          guide:
            'Two ways home from here: home when the 485 ends, or more years of work in Australia first.',
          because: 'It follows the 485',
        },
      },
      'pr-straight': step(
        'home-with-work',
        `Home with ${years} of Australian work`,
        'Home with work',
        '2031',
        `Home when the 485 ends: ${rights}.`,
        TWO_WAYS_HOME,
        '485',
      ),
      'pr-point': {
        id: 'home',
        kicker: 'Point B',
        name: 'Home',
        short: 'Home',
        when: '2031',
        card: {
          sub: 'Point B · Home, 2031',
          guide: 'Point B for this road.',
          because: 'Where this road ends',
        },
      },
      'pr-lane': step(
        'stay-on-485',
        'Stay on the 485 longer',
        'Stay longer',
        '2031 – 2034',
        `More years of work in Australia before going home. ${runs}; staying on after it needs another visa, such as one an employer sponsors.`,
        TWO_WAYS_HOME,
        '485',
      ),
      'pr-lane-end': step(
        'home-later',
        'Home, later',
        'Home, later',
        '2034',
        'Home with more years of Australian work behind you.',
        'It follows the longer stay',
        '485',
      ),
    },
    prRoute: 'none',
    fork: forkAhead('home'),
    endRow: 'Home · 2 ways from the 485',
  }
}
