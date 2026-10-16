import type { CourseSubjects, Source } from './types'

const handbook = (university: string): Source => ({
  title: `${university} course handbook · mock`,
  date: 'Sep 2026',
})

const MATHS = 'A maths bridging unit in the first semester if your degree had little maths'
const PROGRAMMING = 'A programming bridging unit if you have not programmed before'

export const SUBJECTS: readonly CourseSubjects[] = [
  {
    courseId: 'ecu-cyber',
    majors: ['Network security', 'Digital forensics'],
    units: ['Ethical hacking', 'Incident response', 'Secure software', 'Security risk management'],
    conditions: [PROGRAMMING],
    source: handbook('ECU'),
  },
  {
    courseId: 'curtin-it',
    majors: ['Software development', 'Cloud computing'],
    units: ['Software engineering', 'Database systems', 'Cloud platforms', 'IT project management'],
    conditions: [PROGRAMMING],
    source: handbook('Curtin'),
  },
  {
    courseId: 'curtin-infosys',
    majors: ['Business systems', 'Data management'],
    units: ['Systems analysis', 'Enterprise systems', 'Data management', 'Digital transformation'],
    conditions: ['A bachelor degree in any field'],
    source: handbook('Curtin'),
  },
  {
    courseId: 'ecu-data',
    majors: ['Machine learning', 'Data engineering'],
    units: [
      'Statistics for data science',
      'Machine learning',
      'Data visualisation',
      'Big data tools',
    ],
    conditions: [MATHS],
    source: handbook('ECU'),
  },
  {
    courseId: 'unisa-it',
    majors: ['Software development', 'Information systems'],
    units: ['Software engineering', 'Web applications', 'Databases', 'Systems analysis'],
    conditions: [PROGRAMMING],
    source: handbook('UniSA'),
  },
  {
    courseId: 'unisa-cyber',
    majors: ['Network security', 'Security governance'],
    units: ['Ethical hacking', 'Cryptography', 'Security policy', 'Digital forensics'],
    conditions: [PROGRAMMING],
    source: handbook('UniSA'),
  },
  {
    courseId: 'uts-data',
    majors: ['Data analytics', 'Machine learning'],
    units: ['Statistical thinking', 'Machine learning', 'Data visualisation', 'Innovation project'],
    conditions: [MATHS, 'A capstone project with an industry partner in the final year'],
    source: handbook('UTS'),
  },
  {
    courseId: 'uts-cyber',
    majors: ['Cyber operations', 'Security management'],
    units: ['Penetration testing', 'Network defence', 'Cryptography', 'Security management'],
    conditions: [PROGRAMMING],
    source: handbook('UTS'),
  },
  {
    courseId: 'deakin-ba',
    majors: ['Analytics', 'Business strategy'],
    units: ['Business analytics', 'Data wrangling', 'Decision modelling', 'Analytics project'],
    conditions: ['A bachelor degree in any field', MATHS],
    source: handbook('Deakin'),
  },
  {
    courseId: 'deakin-cyber',
    majors: ['Network security', 'Cyber resilience'],
    units: ['Ethical hacking', 'Secure systems', 'Cyber risk', 'Incident response'],
    conditions: [PROGRAMMING],
    source: handbook('Deakin'),
  },
  {
    courseId: 'uow-cyber',
    majors: ['Network security', 'Digital forensics'],
    units: ['Network defence', 'Applied cryptography', 'Security operations', 'Cyber risk'],
    conditions: [PROGRAMMING],
    source: handbook('UOW'),
  },
  {
    courseId: 'utas-it',
    majors: ['Software systems', 'Data and information'],
    units: ['Software engineering', 'Databases', 'Systems design', 'IT project'],
    conditions: [PROGRAMMING],
    source: handbook('UTAS'),
  },
  {
    courseId: 'utas-data',
    majors: ['Data analytics', 'Machine learning'],
    units: [
      'Statistics for data science',
      'Machine learning',
      'Data visualisation',
      'Data project',
    ],
    conditions: [MATHS],
    source: handbook('UTAS'),
  },
  {
    courseId: 'monash-data',
    majors: ['Machine learning', 'Data engineering'],
    units: ['Statistical learning', 'Deep learning', 'Data engineering', 'Applied data project'],
    conditions: [MATHS],
    source: handbook('Monash'),
  },
  {
    courseId: 'swin-cyberpsych',
    majors: ['Cyber-psychology', 'Applied psychology'],
    units: [
      'Online behaviour',
      'Psychological assessment',
      'Human factors in security',
      'Research methods',
    ],
    conditions: [
      'An accredited psychology degree with honours-level results',
      'Supervised placement hours in the second year',
    ],
    source: handbook('Swinburne'),
  },
  {
    courseId: 'ecu-bsc-cyber',
    majors: ['Network security', 'Digital forensics'],
    units: ['Introduction to programming', 'Networks', 'Ethical hacking', 'Security fundamentals'],
    conditions: ['A senior secondary certificate; maths is helpful but not required'],
    source: handbook('ECU'),
  },
  {
    courseId: 'tafe-cyber',
    majors: ['Networking and security'],
    units: ['IT support', 'Network administration', 'Cyber security basics', 'Workplace projects'],
    conditions: [
      'A senior secondary certificate or equivalent',
      'Supervised workplace hours in the second year',
    ],
    source: handbook('North Metropolitan TAFE'),
  },
  {
    courseId: 'unisa-nursing',
    majors: ['Adult nursing', 'Mental health nursing'],
    units: ['Clinical practice', 'Pharmacology', 'Anatomy and physiology', 'Nursing research'],
    conditions: [
      'A bachelor degree in any field',
      'Clinical placement hours in both years, arranged by the university',
    ],
    source: handbook('UniSA'),
  },
  {
    courseId: 'utas-nursing',
    majors: ['Adult nursing', 'Rural and remote nursing'],
    units: ['Clinical practice', 'Pharmacology', 'Anatomy and physiology', 'Evidence-based care'],
    conditions: [
      'A bachelor degree in any field',
      'Clinical placement hours in both years, arranged by the university',
    ],
    source: handbook('UTAS'),
  },
  {
    courseId: 'monash-mph',
    majors: ['Epidemiology', 'Health policy'],
    units: ['Biostatistics', 'Epidemiology methods', 'Health systems', 'Public health practice'],
    conditions: ['A bachelor degree in any field', MATHS],
    source: handbook('Monash'),
  },
  {
    courseId: 'uts-civil',
    majors: ['Structural engineering', 'Transport and infrastructure'],
    units: [
      'Structural analysis',
      'Geotechnical engineering',
      'Water engineering',
      'Engineering project',
    ],
    conditions: [
      'A bachelor degree in engineering or a close field',
      'A capstone project with an industry partner in the final year',
    ],
    source: handbook('UTS'),
  },
  {
    courseId: 'deakin-civil',
    majors: ['Structural engineering', 'Construction management'],
    units: ['Structural design', 'Geotechnics', 'Hydrology', 'Engineering project'],
    conditions: ['A bachelor degree in engineering or a close field', MATHS],
    source: handbook('Deakin'),
  },
  {
    courseId: 'swin-ux',
    majors: ['Interaction design', 'User research'],
    units: ['Design research', 'Prototyping', 'Interface design', 'Design studio'],
    conditions: ['A bachelor degree in any field', 'A portfolio of two or three pieces of work'],
    source: handbook('Swinburne'),
  },
  {
    courseId: 'unisa-dip-it',
    majors: ['IT support', 'Web basics'],
    units: ['Computer systems', 'Introduction to programming', 'Databases', 'Workplace IT project'],
    conditions: ['A senior secondary certificate or equivalent'],
    source: handbook('UniSA College'),
  },
  {
    courseId: 'deakin-dip-business',
    majors: ['Business operations', 'Marketing basics'],
    units: ['Business communication', 'Accounting basics', 'Marketing', 'Managing people'],
    conditions: ['A senior secondary certificate or equivalent'],
    source: handbook('Deakin College'),
  },
  {
    courseId: 'monash-dip-health',
    majors: ['Health foundations', 'Community health'],
    units: ['Human body systems', 'Health communication', 'Community health', 'Health ethics'],
    conditions: [
      'A senior secondary certificate or equivalent',
      'Supervised placement hours in the second year',
    ],
    source: handbook('Monash College'),
  },
  {
    courseId: 'curtin-commerce',
    majors: ['Accounting', 'Finance'],
    units: ['Financial accounting', 'Corporate finance', 'Business law', 'Management accounting'],
    conditions: ['A bachelor degree in any field'],
    source: handbook('Curtin'),
  },
  {
    courseId: 'monash-it',
    majors: ['Software development', 'Cloud computing'],
    units: ['Software engineering', 'Cloud platforms', 'Database systems', 'IT project'],
    conditions: [PROGRAMMING],
    source: handbook('Monash'),
  },
  {
    courseId: 'uts-bus-analytics',
    majors: ['Analytics', 'Business strategy'],
    units: ['Business analytics', 'Data wrangling', 'Decision modelling', 'Analytics project'],
    conditions: ['A bachelor degree in any field', MATHS],
    source: handbook('UTS'),
  },
]

const SUBJECTS_BY_COURSE = new Map(SUBJECTS.map((s) => [s.courseId, s]))

/** The majors, units and entry conditions of a course; undefined for one the catalogue has none for. */
export function subjectsOf(courseId: string): CourseSubjects | undefined {
  return SUBJECTS_BY_COURSE.get(courseId)
}
