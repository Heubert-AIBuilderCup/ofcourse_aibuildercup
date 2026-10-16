import type { Source, Visa, VisaId } from './types'

const source = (subclass: string): Source => ({
  title: `Home Affairs, subclass ${subclass} · mock`,
  date: 'Sep 2026',
})

export const VISAS: readonly Visa[] = [
  {
    id: '500',
    name: 'Student visa',
    stage: 'study',
    years: 'For the length of the course',
    conditions: [
      'You must be enrolled in a registered course',
      'You can work up to the weekly cap while the course is running',
      'You must show you can pay fees and living costs',
    ],
    leadsTo: ['485'],
    source: source('500'),
  },
  {
    id: '485',
    name: 'Graduate visa',
    stage: 'post-study',
    years: 'Up to 5 years after study',
    conditions: [
      'You apply within months of finishing your course',
      'Two years for a big-city master degree, longer for regional study, up to five',
      'You can work in any job while you hold it',
    ],
    leadsTo: ['190', '491', '189', '482'],
    source: source('485'),
  },
  {
    id: '190',
    name: 'State-nominated permanent visa',
    stage: 'permanent',
    years: 'Permanent',
    conditions: [
      'Your occupation must be on the state list for 190',
      'The state nominates you, and you agree to live and work there for two years',
      'You are points-tested',
    ],
    leadsTo: [],
    source: source('190'),
  },
  {
    id: '491',
    name: 'Regional provisional visa',
    stage: 'provisional',
    years: '5 years',
    conditions: [
      'Your occupation must be on the state list for 491',
      'You must live and work in a regional area',
      'It is provisional: after 3 years of regional income you can apply for the 191',
    ],
    leadsTo: ['191'],
    source: source('491'),
  },
  {
    id: '191',
    name: 'Permanent residence (regional)',
    stage: 'permanent',
    years: 'Permanent',
    conditions: [
      'You must have held a 491 for at least 3 years',
      'You must have earned a minimum income in a regional area for those 3 years',
    ],
    leadsTo: [],
    source: source('191'),
  },
  {
    id: '189',
    name: 'Points-tested permanent visa',
    stage: 'permanent',
    years: 'Permanent',
    conditions: [
      'Your occupation must be on the national skilled list',
      'No state or employer nominates you; you are invited on points alone',
      'Invitations are limited, and the points needed move between rounds',
    ],
    leadsTo: [],
    source: source('189'),
  },
  {
    id: '186',
    name: 'Employer-nominated permanent visa',
    stage: 'permanent',
    years: 'Permanent',
    conditions: [
      'An employer must nominate you for a real job in your occupation',
      'You usually need two years of full-time work with that employer or in the field',
    ],
    leadsTo: [],
    source: source('186'),
  },
  {
    id: '482',
    name: 'Skills in Demand visa',
    stage: 'provisional',
    years: 'Up to 4 years',
    conditions: [
      'An employer must sponsor you for a job on the skills in demand list',
      'You can stay with that employer; changing employer needs a new nomination',
      'After about two years it can lead to the 186',
    ],
    leadsTo: ['186'],
    source: source('482'),
  },
]

const VISA_BY_ID = new Map<VisaId, Visa>(VISAS.map((v) => [v.id, v]))

export function visaById(id: VisaId): Visa {
  const visa = VISA_BY_ID.get(id)
  if (!visa) throw new Error(`No visa ${id}`)
  return visa
}
