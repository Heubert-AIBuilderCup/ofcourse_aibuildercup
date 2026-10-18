import { courseFallback } from './course-fallback'
import { courseById } from './courses'
import type { Occupation, Source, StateId } from './types'

const SOURCE: Source = { title: 'State skilled occupation lists · mock', date: 'Sep 2026' }

/** The state each catalogue city sits in. */
export const CITY_STATE: Record<string, StateId> = {
  perth: 'WA',
  adelaide: 'SA',
  sydney: 'NSW',
  wollongong: 'NSW',
  melbourne: 'VIC',
  geelong: 'VIC',
  hobart: 'TAS',
}

// A state absent from `lists` has the occupation on neither its 190 nor its 491 list.
export const OCCUPATIONS: readonly Occupation[] = [
  {
    code: '262112',
    name: 'ICT Security Specialist',
    courseIds: [
      'ecu-cyber',
      'ecu-bsc-cyber',
      'unisa-cyber',
      'uts-cyber',
      'deakin-cyber',
      'uow-cyber',
      'uts-infosec',
      'uts-forensics',
      'deakin-cyber-governance',
      'deakin-network-security',
    ],
    lists: { WA: ['190', '491'], SA: ['190', '491'], NSW: ['491'], VIC: ['491'], TAS: ['491'] },
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '261313',
    name: 'Software Engineer',
    courseIds: [
      'curtin-it',
      'unisa-it',
      'utas-it',
      'monash-it',
      'unisa-software',
      'utas-computing',
    ],
    lists: { WA: ['190', '491'], SA: ['190', '491'], NSW: ['491'], VIC: ['491'], TAS: ['491'] },
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '261112',
    name: 'Systems Analyst',
    courseIds: ['curtin-infosys', 'unisa-it', 'utas-it', 'utas-infosys'],
    lists: { WA: ['190'], SA: ['491'], TAS: ['491'] },
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '224115',
    name: 'Data Scientist',
    courseIds: ['uts-data', 'monash-data', 'ecu-data', 'utas-data'],
    lists: { WA: ['190'], SA: ['491'], TAS: ['491'] },
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '224999',
    name: 'Business Analyst',
    courseIds: ['deakin-ba', 'uts-bus-analytics', 'ecu-bus-analytics'],
    lists: { SA: ['491'], VIC: ['491'] },
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '272399',
    name: 'Psychologists nec',
    courseIds: ['swin-cyberpsych'],
    lists: {},
    employerSponsored: false,
    source: SOURCE,
  },
  {
    code: '254499',
    name: 'Registered Nurse',
    courseIds: ['unisa-nursing', 'utas-nursing'],
    lists: { SA: ['190', '491'], TAS: ['190', '491'], VIC: ['491'] },
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '251911',
    name: 'Health Promotion Officer',
    courseIds: ['monash-mph', 'unisa-mph', 'utas-mph'],
    lists: { SA: ['491'], VIC: ['491'], TAS: ['491'] },
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '411611',
    name: 'Community Worker',
    courseIds: ['monash-dip-health'],
    lists: {},
    employerSponsored: false,
    source: SOURCE,
  },
  {
    code: '233211',
    name: 'Civil Engineer',
    courseIds: ['uts-civil', 'deakin-civil'],
    lists: { NSW: ['491'], VIC: ['190', '491'] },
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '232411',
    name: 'UX Designer',
    courseIds: ['swin-ux', 'swin-design-strategy'],
    lists: {},
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '313212',
    name: 'ICT Support Technician',
    courseIds: ['tafe-cyber', 'unisa-dip-it'],
    lists: { SA: ['491'], TAS: ['491'] },
    employerSponsored: false,
    source: SOURCE,
  },
  {
    code: '511112',
    name: 'Program or Project Administrator',
    courseIds: ['deakin-dip-business'],
    lists: {},
    employerSponsored: false,
    source: SOURCE,
  },
  {
    code: '221111',
    name: 'Accountant (General)',
    courseIds: ['curtin-commerce', 'uts-accounting', 'deakin-commerce'],
    lists: { WA: ['190'], SA: ['491'], VIC: ['491'] },
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '233214',
    name: 'Structural Engineer',
    courseIds: ['uts-structural'],
    lists: { NSW: ['491'], VIC: ['190', '491'] },
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '133211',
    name: 'Engineering Manager',
    courseIds: ['uts-eng-management'],
    lists: { NSW: ['491'], VIC: ['491'] },
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '233512',
    name: 'Mechanical Engineer',
    courseIds: ['deakin-mechanical'],
    lists: { NSW: ['491'], VIC: ['190', '491'] },
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '233311',
    name: 'Electrical Engineer',
    courseIds: ['deakin-electrical'],
    lists: { NSW: ['491'], VIC: ['190', '491'] },
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '134299',
    name: 'Health and Welfare Services Manager',
    courseIds: ['unisa-health-admin'],
    lists: { SA: ['491'], TAS: ['491'] },
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '224213',
    name: 'Health Information Manager',
    courseIds: ['monash-health-informatics'],
    lists: { VIC: ['491'] },
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '272313',
    name: 'Organisational Psychologist',
    courseIds: ['monash-org-psych'],
    lists: {},
    employerSponsored: false,
    source: SOURCE,
  },
  {
    code: '232413',
    name: 'Multimedia Designer',
    courseIds: ['monash-design'],
    lists: {},
    employerSponsored: false,
    source: SOURCE,
  },
  {
    code: '133611',
    name: 'Supply and Distribution Manager',
    courseIds: ['deakin-supply-chain'],
    lists: { VIC: ['491'] },
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '241411',
    name: 'Secondary School Teacher',
    courseIds: ['ecu-teaching-secondary', 'monash-teaching'],
    lists: {
      WA: ['190', '491'],
      SA: ['190', '491'],
      NSW: ['491'],
      VIC: ['190', '491'],
      TAS: ['190', '491'],
    },
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '241111',
    name: 'Early Childhood (Pre-primary School) Teacher',
    courseIds: ['ecu-teaching-early'],
    lists: {
      WA: ['190', '491'],
      SA: ['190', '491'],
      NSW: ['491'],
      VIC: ['190', '491'],
      TAS: ['190', '491'],
    },
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '272511',
    name: 'Social Worker',
    courseIds: [
      'curtin-social-work',
      'unisa-social-work',
      'monash-social-work',
      'utas-social-work',
    ],
    lists: {
      WA: ['190', '491'],
      SA: ['190', '491'],
      NSW: ['491'],
      VIC: ['491'],
      TAS: ['190', '491'],
    },
    employerSponsored: true,
    source: SOURCE,
  },
  {
    code: '141311',
    name: 'Hotel or Motel Manager',
    courseIds: ['uts-tourism', 'deakin-tourism'],
    lists: { NSW: ['491'], VIC: ['491'], TAS: ['491'] },
    employerSponsored: true,
    source: SOURCE,
  },
]

/** The occupations a course leads to; for a course the lists do not name, any the server registered. */
export function occupationsFor(courseId: string): Occupation[] {
  const own = OCCUPATIONS.filter((o) => o.courseIds.includes(courseId))
  return own.length > 0 ? own : courseFallback().occupationsFor(courseId)
}

export type StayingRoute = '190' | '491' | '186' | 'none'

/**
 * A staying road's way to PR, for a course taught in a city (endings.ts composes it, candidates.ts
 * labels it, so the two agree): none when the catalogue gives the course no clear road to PR (its
 * PR score is 0), or none of its occupations is on a list in the city's state or sponsored by
 * employers; else a 190 on the state's 190 list, a 491 on its 491 list, else an employer's 186.
 */
export function stayingRoute(courseId: string, cityId: string): StayingRoute {
  return routeFor(occupationsFor(courseId), cityId, courseById(courseId)?.prScore)
}

/** The staying route for any course, from its occupations and PR score (stayingRoute's rule). */
export function routeFor(
  occupations: readonly Occupation[],
  cityId: string,
  prScore: number | undefined,
): StayingRoute {
  const state = CITY_STATE[cityId]
  const on = (list: '190' | '491') => occupations.some((o) => (o.lists[state] ?? []).includes(list))
  const someWay = occupations.some((o) => (o.lists[state] ?? []).length > 0 || o.employerSponsored)
  if (prScore === 0 || !someWay) return 'none'
  return on('190') ? '190' : on('491') ? '491' : '186'
}

/** The way to stay as a road's label ends: "190", or "no clear PR". */
export const routeWord = (route: StayingRoute): string => (route === 'none' ? 'no clear PR' : route)
