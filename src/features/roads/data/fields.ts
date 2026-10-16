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
      'How people behave online and why they fall for attacks; used to design safer systems and training.',
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
}

/** The fields each area of study reaches. */
export const AREA_FIELDS: Readonly<Record<string, readonly string[]>> = {
  'IT and computing': ['it', 'cyber'],
  Business: ['business'],
  Data: ['data'],
  Health: ['health'],
  Engineering: ['engineering'],
  Design: ['design'],
}

/** Every field an answer can name, through a field option or an area. */
export const ANSWERED_FIELDS: ReadonlySet<string> = new Set([
  ...Object.values(FIELD_OF_OPTION),
  ...Object.values(AREA_FIELDS).flat(),
])
