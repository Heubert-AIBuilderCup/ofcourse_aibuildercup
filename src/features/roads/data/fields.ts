import { RETIRED_AREAS } from '@/features/opening/model/questions'
import type { Field, FieldEdge } from './types'

export const FIELDS: readonly Field[] = [
  {
    id: 'it',
    name: 'Information technology',
    definition:
      'Building and running the computer systems, software and networks that organisations rely on.',
    niche: false,
  },
  {
    id: 'cyber',
    name: 'Cyber security',
    definition:
      'Protecting systems and data from attack, and finding the weak points before someone else does.',
    niche: false,
  },
  {
    id: 'data',
    name: 'Data science',
    definition:
      'Using statistics and code to find patterns in large amounts of data and explain what they mean.',
    niche: false,
  },
  {
    id: 'business',
    name: 'Business',
    definition:
      'How organisations plan, spend, sell and decide, and how information helps them do it.',
    niche: false,
  },
  {
    id: 'psych',
    name: 'Psychology',
    definition:
      'The study of how people think, feel and behave, and how that can be measured and supported.',
    niche: false,
  },
  {
    id: 'software',
    name: 'Software engineering',
    definition: 'Designing, writing and testing the programs that apps and services are made of.',
    niche: false,
  },
  {
    id: 'networks',
    name: 'Networks and cloud',
    definition:
      'Connecting computers and running services on shared infrastructure that stays up and fast.',
    niche: false,
  },
  {
    id: 'info-systems',
    name: 'Information systems',
    definition:
      'Fitting technology to how an organisation works, between the business and the IT team.',
    niche: false,
  },
  {
    id: 'business-analytics',
    name: 'Business analytics',
    definition:
      'Turning the numbers an organisation keeps into clear answers for managers, using data tools.',
    niche: false,
  },
  {
    id: 'ai-ml',
    name: 'Machine learning and AI',
    definition:
      'Teaching software to recognise patterns and make predictions from examples, not fixed rules.',
    niche: false,
  },
  {
    id: 'data-engineering',
    name: 'Data engineering',
    definition:
      'Building the pipelines and stores that move data to where analysts and models can use it.',
    niche: false,
  },
  {
    id: 'security-governance',
    name: 'Security governance and risk',
    definition:
      'Setting the rules, policies and checks that keep an organisation secure and compliant.',
    niche: false,
  },
  {
    id: 'digital-forensics',
    name: 'Digital forensics',
    definition:
      'Recovering and examining digital evidence after an incident or crime, so it stands up to review.',
    niche: true,
  },
  {
    id: 'cyber-psychology',
    name: 'Cyber-psychology',
    definition:
      'The psychology of how people think, feel and behave online: trust, habits, wellbeing and risk.',
    niche: true,
  },
  {
    id: 'health-informatics',
    name: 'Health informatics',
    definition:
      'Managing and analysing health records and data so clinics and hospitals can care for people better.',
    niche: true,
  },
  {
    id: 'health',
    name: 'Health',
    definition:
      'Caring for people and for the health of a community: nursing, public health and the services around them.',
    niche: false,
  },
  {
    id: 'engineering',
    name: 'Engineering',
    definition:
      'Designing and building the structures, machines and systems people depend on, to a standard that is checked.',
    niche: false,
  },
  {
    id: 'design',
    name: 'Design',
    definition:
      'Shaping how products and services look and work for the people who use them, from research to the final screen.',
    niche: false,
  },
  {
    id: 'education',
    name: 'Education and teaching',
    definition:
      'Planning lessons, teaching classes and helping children or teenagers learn, at school or before it.',
    niche: false,
  },
  {
    id: 'social-work',
    name: 'Social work',
    definition:
      'Supporting people and families through hardship, and linking them with the services and rights they need.',
    niche: false,
  },
  {
    id: 'hospitality',
    name: 'Hospitality and tourism',
    definition:
      'Running hotels, restaurants, events and travel experiences, and the business side that keeps them going.',
    niche: false,
  },
  {
    id: 'ot-security',
    name: 'Industrial and critical infrastructure security',
    definition:
      'Protecting the computers that run power grids, water plants and factories, where an attack can stop real machines.',
    niche: true,
  },
  {
    id: 'cyber-strategy',
    name: 'Cyber policy and strategy',
    definition:
      'How governments and companies plan for cyber threats, write the laws and rules, and handle attacks between countries.',
    niche: true,
  },
  {
    id: 'bioinformatics',
    name: 'Bioinformatics',
    definition:
      'Using code and statistics to read DNA and other biological data, to understand diseases and find new treatments.',
    niche: true,
  },
  {
    id: 'spatial-data-science',
    name: 'Geospatial science (GIS)',
    definition:
      'Working with maps, satellite images and location data to plan cities, track the environment and respond to disasters.',
    niche: true,
  },
  {
    id: 'actuarial-studies',
    name: 'Actuarial studies',
    definition:
      'Using maths and statistics to measure risk and price insurance, super and pensions so they stay affordable.',
    niche: true,
  },
  {
    id: 'fintech',
    name: 'Financial technology (FinTech)',
    definition:
      'Building and running the tech behind modern money: payment apps, online banking, digital lending and blockchain.',
    niche: true,
  },
  {
    id: 'hci',
    name: 'Human-computer interaction',
    definition:
      'Studying how people use technology and testing designs so apps and devices are easy, safe and pleasant to use.',
    niche: true,
  },
  {
    id: 'game-development',
    name: 'Game development',
    definition:
      'Designing and programming video games, from the rules and levels to the graphics engine that runs them.',
    niche: true,
  },
  {
    id: 'organisational-psychology',
    name: 'Organisational psychology',
    definition:
      'Using psychology at work: hiring the right people, building good teams and keeping staff well and motivated.',
    niche: true,
  },
  {
    id: 'human-factors',
    name: 'Human factors and safety science',
    definition:
      'Designing equipment, jobs and systems around how people actually think and make mistakes, so work is safer.',
    niche: true,
  },
  {
    id: 'biostatistics',
    name: 'Biostatistics and epidemiology',
    definition:
      'Using statistics to track how diseases spread and to test whether medicines and health programs really work.',
    niche: true,
  },
  {
    id: 'genetic-counselling',
    name: 'Genetic counselling',
    definition:
      'Helping families understand genetic test results and inherited health risks, and make decisions about them.',
    niche: true,
  },
  {
    id: 'renewable-energy-engineering',
    name: 'Renewable energy engineering',
    definition:
      'Designing solar, wind, battery and grid systems that produce clean power and keep it reliable.',
    niche: true,
  },
  {
    id: 'biomedical-engineering',
    name: 'Biomedical engineering',
    definition:
      'Designing medical devices like implants, prosthetics and scanners that help doctors diagnose and treat people.',
    niche: true,
  },
  {
    id: 'robotics',
    name: 'Robotics and mechatronics',
    definition:
      'Building machines that sense, move and decide for themselves, mixing mechanics, electronics and code.',
    niche: true,
  },
  {
    id: 'service-design',
    name: 'Service design',
    definition:
      'Designing the whole experience of a service, like a hospital visit or a bank account, not just one screen.',
    niche: true,
  },
  {
    id: 'design-strategy',
    name: 'Design strategy and innovation',
    definition:
      'Using design thinking to help organisations spot new ideas, test them quickly and turn them into products.',
    niche: true,
  },
]

// A "combines" edge runs from the combined field to each field it is made of.
export const FIELD_EDGES: readonly FieldEdge[] = [
  { from: 'software', to: 'it', kind: 'is-a' },
  { from: 'networks', to: 'it', kind: 'is-a' },
  { from: 'ai-ml', to: 'data', kind: 'is-a' },
  { from: 'data-engineering', to: 'data', kind: 'is-a' },
  { from: 'digital-forensics', to: 'cyber', kind: 'is-a' },
  { from: 'security-governance', to: 'cyber', kind: 'is-a' },
  { from: 'info-systems', to: 'it', kind: 'combines' },
  { from: 'info-systems', to: 'business', kind: 'combines' },
  { from: 'business-analytics', to: 'data', kind: 'combines' },
  { from: 'business-analytics', to: 'business', kind: 'combines' },
  { from: 'cyber-psychology', to: 'cyber', kind: 'combines' },
  { from: 'cyber-psychology', to: 'psych', kind: 'combines' },
  { from: 'health-informatics', to: 'data', kind: 'combines' },
  { from: 'health-informatics', to: 'it', kind: 'combines' },
  { from: 'data-engineering', to: 'it', kind: 'related' },
  { from: 'cyber', to: 'it', kind: 'related' },
  { from: 'cyber', to: 'networks', kind: 'related' },
  { from: 'security-governance', to: 'business', kind: 'related' },
  { from: 'ai-ml', to: 'software', kind: 'related' },
  { from: 'data', to: 'business', kind: 'related' },
  { from: 'health-informatics', to: 'health', kind: 'combines' },
  { from: 'health', to: 'data', kind: 'related' },
  { from: 'psych', to: 'health', kind: 'related' },
  { from: 'engineering', to: 'it', kind: 'related' },
  { from: 'design', to: 'it', kind: 'related' },
  { from: 'education', to: 'psych', kind: 'related' },
  { from: 'social-work', to: 'psych', kind: 'related' },
  { from: 'social-work', to: 'health', kind: 'related' },
  { from: 'social-work', to: 'education', kind: 'related' },
  { from: 'hospitality', to: 'business', kind: 'related' },
  { from: 'ot-security', to: 'cyber', kind: 'is-a' },
  { from: 'ot-security', to: 'engineering', kind: 'related' },
  { from: 'ot-security', to: 'networks', kind: 'related' },
  { from: 'cyber-strategy', to: 'cyber', kind: 'is-a' },
  { from: 'cyber-strategy', to: 'security-governance', kind: 'related' },
  { from: 'bioinformatics', to: 'data', kind: 'combines' },
  { from: 'bioinformatics', to: 'health', kind: 'combines' },
  { from: 'spatial-data-science', to: 'data', kind: 'is-a' },
  { from: 'spatial-data-science', to: 'engineering', kind: 'related' },
  { from: 'actuarial-studies', to: 'business', kind: 'combines' },
  { from: 'actuarial-studies', to: 'data', kind: 'combines' },
  { from: 'fintech', to: 'business', kind: 'combines' },
  { from: 'fintech', to: 'it', kind: 'combines' },
  { from: 'fintech', to: 'software', kind: 'related' },
  { from: 'hci', to: 'it', kind: 'combines' },
  { from: 'hci', to: 'design', kind: 'combines' },
  { from: 'hci', to: 'psych', kind: 'related' },
  { from: 'game-development', to: 'it', kind: 'is-a' },
  { from: 'game-development', to: 'software', kind: 'related' },
  { from: 'game-development', to: 'design', kind: 'related' },
  { from: 'organisational-psychology', to: 'psych', kind: 'combines' },
  { from: 'organisational-psychology', to: 'business', kind: 'combines' },
  { from: 'human-factors', to: 'psych', kind: 'combines' },
  { from: 'human-factors', to: 'engineering', kind: 'combines' },
  { from: 'human-factors', to: 'design', kind: 'related' },
  { from: 'biostatistics', to: 'health', kind: 'combines' },
  { from: 'biostatistics', to: 'data', kind: 'combines' },
  { from: 'genetic-counselling', to: 'health', kind: 'is-a' },
  { from: 'genetic-counselling', to: 'psych', kind: 'related' },
  { from: 'renewable-energy-engineering', to: 'engineering', kind: 'is-a' },
  { from: 'biomedical-engineering', to: 'engineering', kind: 'combines' },
  { from: 'biomedical-engineering', to: 'health', kind: 'combines' },
  { from: 'robotics', to: 'engineering', kind: 'is-a' },
  { from: 'robotics', to: 'ai-ml', kind: 'related' },
  { from: 'robotics', to: 'software', kind: 'related' },
  { from: 'service-design', to: 'design', kind: 'is-a' },
  { from: 'service-design', to: 'business', kind: 'related' },
  { from: 'design-strategy', to: 'design', kind: 'combines' },
  { from: 'design-strategy', to: 'business', kind: 'combines' },
]

/** The fields one step away over any kind of edge, in either direction. */
export function relatedFields(id: string): string[] {
  const out = new Set<string>()
  for (const e of FIELD_EDGES) {
    if (e.from === id) out.add(e.to)
    if (e.to === id) out.add(e.from)
  }
  return [...out]
}

/** The fields each "Which field?" option names. */
export const FIELD_OF_OPTION: Readonly<Record<string, string>> = {
  'Cyber security': 'cyber',
  'Data science': 'data',
  'Business analytics': 'business',
  'Information technology': 'it',
  Psychology: 'psych',
}

/** The fields each area of study reaches. Data went into IT and computing. */
export const AREA_FIELDS: Readonly<Record<string, readonly string[]>> = {
  'IT and computing': ['it', 'cyber', 'data'],
  Business: ['business'],
  Health: ['health'],
  Engineering: ['engineering'],
  Design: ['design'],
  Psychology: ['psych'],
  'Education / Teaching': ['education'],
  'Social work': ['social-work'],
  'Hospitality & tourism': ['hospitality'],
}

/** The fields an area reaches; one an earlier onboarding offered reads as the area that took it in. */
export function areaFields(area: string): readonly string[] {
  const today = Object.hasOwn(RETIRED_AREAS, area) ? RETIRED_AREAS[area] : area
  return Object.hasOwn(AREA_FIELDS, today) ? AREA_FIELDS[today] : []
}

/** Every field an answer can name, through a field option or an area. */
export const ANSWERED_FIELDS: ReadonlySet<string> = new Set([
  ...Object.values(FIELD_OF_OPTION),
  ...Object.values(AREA_FIELDS).flat(),
])
