// The six roads: each fills every slot of Priya's road's shape with a city, a course and a way to
// stay (or to go home) from the mock catalogue. Every figure is the catalogue's (engine cities and
// courses, the roads' visas, occupations and subjects): fees and living costs are read from it
// (figures.ts, pinned by build.test.ts); nothing here is about one student, and nothing is ranked.
// Copy reads in the board's voice: "Good for: …" / "Less good for: …", and a "because" line per
// card.

import type { Badge, BadgeId } from '@/features/road/model/road-data'
import { citySub, feesOf, livingOf } from './figures'
import { keyOf } from './road-keys'
import type { RoadSpec, SlotCopy, VisaId } from './types'

// ── Slots every road fills the same way ─────────────────────────────────────────────────────

const POINT_A: SlotCopy = {
  id: 'point-a',
  kicker: 'You',
  name: 'Point A',
  short: 'Point A',
  sub: 'Where you start',
  card: {
    kicker: 'Point A · You',
    sub: 'Where you start',
    guide: 'Built from your answers. Open them to change one.',
    because: 'Where you start',
  },
  // Its sub is written from her answers when the road is built.
  here: {
    kicker: 'You are here · Point A',
    sub: 'Where you start',
    guide: 'Your roadmap starts here. Pick a destination to draw the rest.',
    because: 'Where you start',
    primary: 'Pick a destination',
    siblingsTitle: '',
  },
}

const SEVEN_CITIES = '7 cities to choose from.'

const australia = (city: string): SlotCopy => ({
  id: 'australia',
  name: 'Australia',
  short: 'Australia · 7 cities',
  sub: SEVEN_CITIES,
  card: {
    kicker: 'Visited · Destination',
    sub: SEVEN_CITIES,
    because: 'The country on your roadmap',
    primary: 'Go to Australia',
  },
  here: {
    kicker: 'You are here · Destination',
    sub: SEVEN_CITIES,
    guide: '',
    because: 'The country on your roadmap',
    primary: `Go to ${city}`,
    siblingsTitle: '',
  },
})

const VISA_500: SlotCopy = {
  id: 'student-visa-500',
  name: 'Student visa · 500',
  short: 'Student visa',
  when: 'Late 2026',
  card: {
    sub: 'Late 2026',
    guide: 'Lodge once the offer is in hand. You must show you can pay fees and living costs.',
    because: 'The next step on your roadmap',
  },
}

const LESSON_ID = 'masters-years'

export const courseYears = (
  id: string,
  subject: string,
  when: string,
  guide: string,
): SlotCopy => ({
  id,
  name: `Master’s · ${subject}`,
  short: 'Master’s',
  when,
  card: { sub: when, guide, because: 'The course on your roadmap', lesson: LESSON_ID },
})

export const visa485 = (regional: boolean): SlotCopy => ({
  id: 'graduate-visa-485',
  name: 'Graduate visa · 485',
  short: '485',
  when: 'From 2029',
  card: {
    sub: 'From 2029',
    guide: regional
      ? 'Up to five years of work rights after regional study, in any job.'
      : 'Two years of work rights after a big-city master’s, in any job.',
    because: 'It follows the Master’s',
  },
})

/** A step on the road ahead: a look-ahead card, with no kicker or primary; on a way to stay, its visa. */
export const step = (
  id: string,
  name: string,
  short: string,
  when: string,
  guide: string,
  because: string,
  visa?: VisaId,
): SlotCopy => ({
  id,
  name,
  short,
  when,
  ...(visa && { visa }),
  card: { sub: when, guide, because },
})

export const TWO_WAYS_TO_PR = 'One of 2 ways to PR from the 485'

export const forkToPr = (guide: string): SlotCopy => ({
  id: 'two-ways-to-pr',
  name: '2 ways to PR',
  short: '2 ways to PR',
  card: { kicker: 'Fork', sub: '2031', guide, because: 'It follows the 485' },
})

export const PERMANENT_RESIDENCY: SlotCopy = {
  id: 'permanent-residency',
  kicker: 'Point B',
  name: 'Permanent residency',
  short: 'Permanent residency',
  when: '2032',
  card: { sub: 'Point B · 2032', guide: 'Point B for this road.', because: 'Where this road ends' },
}

export const regional491 = (guide: string): SlotCopy =>
  step(
    'regional-491',
    '491 · regional',
    '491 · regional',
    '2031 – 2034',
    guide,
    TWO_WAYS_TO_PR,
    '491',
  )

export const PERMANENT_191 = step(
  'permanent-191',
  '191 · permanent',
  '191 · permanent',
  '2034',
  'Permanent after three years of regional income on the 491.',
  'It follows the 491',
  '191',
)

export const employer186 = (guide: string): SlotCopy =>
  step(
    'employer-nomination-186',
    '186 · employer nomination',
    '186',
    '2031',
    guide,
    TWO_WAYS_TO_PR,
    '186',
  )

export const SKILLS_482 = step(
  'skills-in-demand-482',
  '482 · Skills in Demand',
  '482',
  '2031 – 2034',
  'An employer sponsors you for up to four years; changing employer needs a new nomination.',
  TWO_WAYS_TO_PR,
  '482',
)

export const PERMANENT_186 = step(
  'permanent-186',
  '186 · permanent',
  '186 · permanent',
  '2034',
  'After about two years on the 482, the employer can nominate you for the 186.',
  'It follows the 482',
  '186',
)

/** A city on her roadmap, with the card where she stands in it. */
const city = (c: {
  id: string
  name: string
  courses: number
  sub: string
  state: string
  gains: string
  costs: string
  guide: string
  walkTo: string
}): SlotCopy => ({
  id: c.id,
  name: c.name,
  short: `${c.name} · ${c.courses} courses`,
  sub: c.sub,
  card: {
    kicker: 'Visited · City',
    sub: c.state,
    gains: c.gains,
    costs: c.costs,
    guide: c.guide,
    because: 'The city on your roadmap',
    primary: `Go to ${c.name}`,
  },
  here: {
    kicker: 'You are here · City',
    sub: c.state,
    gains: c.gains,
    costs: c.costs,
    guide: c.guide,
    because: 'The city on your roadmap',
    primary: `Walk to ${c.walkTo}`,
    siblingsTitle: 'Also in Australia',
  },
})

const altCity = (c: {
  id: string
  name: string
  sub: string
  state: string
  gains: string
  costs: string
  guide: string
}): SlotCopy => ({
  id: c.id,
  name: c.name,
  sub: c.sub,
  gains: c.gains,
  costs: c.costs,
  card: {
    kicker: 'Not visited · City',
    sub: c.state,
    gains: c.gains,
    costs: c.costs,
    guide: c.guide,
    because: 'Another city on the map: swap it onto your roadmap',
    primary: 'Swap onto your roadmap',
  },
})

const moreCities = (others: string, regional: string): SlotCopy => ({
  id: 'more-cities',
  name: '5 more cities',
  sub: regional,
  card: {
    kicker: 'Stack · City',
    sub: regional,
    guide: `The other cities on the map: ${others}.`,
    because: 'Every city you haven’t looked at yet',
    primary: 'Show 5 more cities',
  },
})

export type CourseWords = {
  id: string
  name: string
  /** "ECU · Perth" */
  sub: string
  gains: string
  costs: string
  guide: string
  /** The study step's name once it is on her roadmap. */
  step: string
}

/** Where she stands on a course: the look ahead, and the courses beside it. */
const hereOnCourse = (c: CourseWords, badges: BadgeId[], siblingsTitle: string) => ({
  kicker: 'You are here · Course',
  sub: c.sub,
  gains: c.gains,
  costs: c.costs,
  guide: c.guide,
  because: 'The course on your roadmap',
  primary: 'Look ahead: Student visa · 500',
  secondary: 'Open route detail',
  siblingsTitle,
  badges,
})

export const course = (c: CourseWords, siblingsTitle: string): SlotCopy => ({
  id: c.id,
  name: c.name,
  short: c.name,
  sub: c.sub,
  gains: c.gains,
  costs: c.costs,
  courseStepName: `Master’s · ${c.step}`,
  card: {
    kicker: 'Visited · Course',
    sub: c.sub,
    gains: c.gains,
    costs: c.costs,
    guide: c.guide,
    because: 'The course on your roadmap',
    primary: 'Swap onto your roadmap',
  },
  here: hereOnCourse(c, ['offerings', 'ielts', 'fork'], siblingsTitle),
})

export const altCourse = (c: CourseWords, cityName: string, siblingsTitle: string): SlotCopy => ({
  id: c.id,
  name: c.name,
  sub: c.sub,
  gains: c.gains,
  costs: c.costs,
  courseStepName: `Master’s · ${c.step}`,
  card: {
    kicker: 'Not visited · Course',
    sub: c.sub,
    gains: c.gains,
    costs: c.costs,
    guide: c.guide,
    because: `Another course in ${cityName}: swap it onto your roadmap`,
    primary: 'Swap onto your roadmap',
  },
  here: hereOnCourse(c, ['maths'], siblingsTitle),
})

export const moreCourses = (c: {
  id: string
  where: string
  count: number
  sub: string
  guide: string
}): SlotCopy => ({
  id: c.id,
  name: `${c.count} more in ${c.where}`,
  sub: c.sub,
  card: {
    kicker: 'Stack · Course',
    sub: c.sub,
    guide: c.guide,
    because: `Every course in ${c.where} you haven’t looked at yet`,
    primary: c.count === 1 ? 'Show 1 more course' : `Show ${c.count} more courses`,
  },
})

/** The course in the stack until she puts it on her board. */
export const stackCourse = (c: {
  id: string
  name: string
  sub: string
  step: string
  /** The catalogue course it is, whose fees its card states. */
  courseId: string
}): SlotCopy => ({
  id: c.id,
  kicker: 'Added · from your stack',
  name: c.name,
  sub: c.sub,
  courseStepName: `Master’s · ${c.step}`,
  card: {
    kicker: 'Added · from your stack · Course',
    sub: c.sub,
    guide: `On your board, beside your roadmap. About ${feesOf(c.courseId)}.`,
    because: 'You put it on your board',
    primary: 'Swap onto your roadmap',
  },
})

// ── Badges ──────────────────────────────────────────────────────────────────────────────────

export const offerings = (value: string, when: string): Badge => ({
  kind: 'Several offerings',
  value,
  explanation: `${when} Same course and trade-offs, so they share one tile.`,
  icon: 'layers',
})

export const english = (university: string): Badge => ({
  kind: 'Condition',
  value: 'An English test before you enrol',
  explanation: `${university} asks for an English test result, such as IELTS, before you enrol. Its course page gives the score it needs.`,
  icon: 'alert',
})

export const forkAhead = (ways: string): Badge => ({
  kind: 'Fork ahead',
  value: 'at the 485',
  explanation: `After the 485 there are two ways ${ways}.`,
  icon: 'split',
})

export const programming = (university: string): Badge => ({
  kind: 'Condition',
  value: 'Programming unit in year 1',
  explanation: `${university} asks students who have not programmed before to take a programming bridging unit.`,
  icon: 'alert',
})

// Shown once a budget under the fees is saved; applyAnswers writes its figures.
export const OVER: Badge = {
  kind: 'Condition',
  value: 'Over budget',
  explanation: 'Shown when the budget you saved is under this course’s fees.',
  icon: 'alert',
}

// ── Lesson and overview ─────────────────────────────────────────────────────────────────────

export const lesson = (units: string, city: string, regional: boolean): RoadSpec['lesson'] => ({
  id: LESSON_ID,
  kicker: 'Lesson · 3 min read · OfCourse learning',
  title: 'The Master’s years, in 3 minutes',
  points: [
    `Two years of coursework, with units such as ${units}.`,
    'While the course runs you can work up to the Student visa’s weekly cap.',
    regional
      ? `Finish in a city that counts as regional, like ${city}, and the Graduate visa (485) that follows can run up to five years.`
      : `Finish a master’s in a big city like ${city} and the Graduate visa (485) that follows runs 2 years.`,
  ],
  read: 'Lesson read. The Master’s years now show as looked at.',
})

export const overview = (
  cityRow: string,
  courseRow: string,
  endRow: string,
): RoadSpec['overview'] => ({
  title: 'You’ve looked at 4 of 13 steps',
  looked: 4,
  total: 13,
  rows: ['Australia · 7 cities · 1 looked at', cityRow, courseRow, endRow],
  note: 'Counts per city and route. What you’ve looked at stays lit; the rest waits for you.',
})

// ── The six roads ───────────────────────────────────────────────────────────────────────────

const PERTH_CYBER: RoadSpec = {
  ...keyOf('perth-cyber'),
  altCityId: 'adelaide',
  courseId: 'ecu-cyber',
  altCourseId: 'curtin-it',
  stackCourseId: 'curtin-infosys',
  prRoute: '190',
  slots: {
    'point-a': POINT_A,
    australia: australia('Perth'),
    city: city({
      id: 'perth',
      name: 'Perth',
      courses: 6,
      sub: citySub('perth'),
      state: 'Western Australia',
      gains: 'Good for: PR, work',
      costs: 'Less good for: career',
      guide:
        'Counts as regional: up to 5 years of post-study work rights, and WA nominates graduates of its own universities. About 3,400 IT job ads last quarter, vs 9,800 in Sydney.',
      walkTo: 'Cyber Security',
    }),
    'alt-city': altCity({
      id: 'adelaide',
      name: 'Adelaide',
      sub: citySub('adelaide'),
      state: 'South Australia',
      gains: 'Good for: cost, PR',
      costs: 'Less good for: career',
      guide:
        'Rent for a one-bedroom flat is about AUD 360 a week, vs 530 in Sydney. A smaller IT job market than Perth.',
    }),
    'more-cities': moreCities(
      'Sydney, Melbourne, Geelong, Hobart and Wollongong',
      '3 count as regional',
    ),
    course: course(
      {
        id: 'cyber-security-ecu-perth',
        name: 'Cyber Security',
        sub: 'ECU · Perth',
        gains: 'Good for: PR, work, career',
        costs: 'Less good for: cost',
        guide: `ECU Joondalup. About ${feesOf('ecu-cyber')}; 81% of its graduates in this field in full-time work within four months.`,
        step: 'Cyber Security',
      },
      'Also in Perth',
    ),
    'alt-course': altCourse(
      {
        id: 'information-technology-curtin-perth',
        name: 'Information Technology',
        sub: 'Curtin · Perth',
        gains: 'Good for: PR, work, career',
        costs: 'Less good for: cost',
        guide: `Curtin Bentley. About ${feesOf('curtin-it')}, with intakes in February and July.`,
        step: 'Information Technology',
      },
      'Perth',
      'Also in Perth',
    ),
    'more-courses': moreCourses({
      id: 'more-courses-perth',
      where: 'Perth',
      count: 4,
      sub: '2 at master’s level',
      guide: 'The other courses in Perth. Two aren’t at master’s level; the list says which.',
    }),
    'visa-500': VISA_500,
    'course-years': courseYears(
      'masters-cyber-security-ecu',
      'Cyber Security',
      'Feb 2027 – Dec 2028',
      'Two years of units such as ethical hacking, incident response and secure software.',
    ),
    'visa-485': visa485(true),
    fork: forkToPr('Two ways to PR from here: the 190 straight on, or the 491 and then the 191.'),
    'pr-straight': step(
      'state-nomination-190',
      '190 · state nomination',
      '190',
      '2031',
      'WA can nominate you: ICT Security Specialist is on its 190 list. You agree to live and work in WA for two years.',
      TWO_WAYS_TO_PR,
      '190',
    ),
    'pr-point': PERMANENT_RESIDENCY,
    'pr-lane': regional491(
      'A five-year provisional visa: ICT Security Specialist is on WA’s 491 list. You live and work in a regional area.',
    ),
    'pr-lane-end': PERMANENT_191,
    'stack-course': stackCourse({
      id: 'information-systems-curtin-perth',
      name: 'Information Systems',
      sub: 'Curtin · Perth',
      step: 'Information Systems',
      courseId: 'curtin-infosys',
    }),
  },
  badges: {
    offerings: offerings('2 intakes', 'February and July 2027.'),
    ielts: english('ECU'),
    fork: forkAhead('to PR'),
    maths: programming('Curtin'),
    over: OVER,
  },
  stackRows: [
    {
      name: 'Information Systems',
      sub: 'Curtin · Perth',
      courseId: 'curtin-infosys',
      tag: 'Match well',
      tileId: 'information-systems-curtin-perth',
    },
    { name: 'Data Science', sub: 'ECU · Perth', courseId: 'ecu-data', tag: 'Match well' },
    {
      name: 'Bachelor of Cyber Security',
      sub: 'ECU · Perth · 3 years',
      courseId: 'ecu-bsc-cyber',
      tag: '',
    },
    {
      name: 'Diploma of Information Technology (Cyber Security)',
      sub: 'North Metropolitan TAFE · Perth',
      courseId: 'tafe-cyber',
      tag: '',
    },
  ],
  lesson: lesson('ethical hacking, incident response and secure software', 'Perth', true),
  overview: overview(
    'Perth · 6 courses · 1 looked at',
    'Cyber Security · 2 intakes · walked',
    'Permanent residency · 2 ways from the 485',
  ),
  arrivalLine: 'Tap Perth to see its courses.',
}

const ADELAIDE_IT: RoadSpec = {
  ...keyOf('adelaide-it'),
  altCityId: 'hobart',
  courseId: 'unisa-it',
  altCourseId: 'unisa-cyber',
  stackCourseId: 'utas-it',
  prRoute: '491',
  slots: {
    'point-a': POINT_A,
    australia: australia('Adelaide'),
    city: city({
      id: 'adelaide',
      name: 'Adelaide',
      courses: 2,
      sub: citySub('adelaide'),
      state: 'South Australia',
      gains: 'Good for: cost, PR',
      costs: 'Less good for: career',
      guide:
        'Counts as regional: up to 5 years of post-study work rights, and SA nominates graduates of its own universities. Rent for a one-bedroom flat is about AUD 360 a week, vs 530 in Sydney.',
      walkTo: 'Information Technology',
    }),
    'alt-city': altCity({
      id: 'hobart',
      name: 'Hobart',
      sub: 'Counts as regional · a tight rental market',
      state: 'Tasmania',
      gains: 'Good for: PR',
      costs: 'Less good for: career',
      guide:
        'Rent for a one-bedroom flat is about AUD 420 a week, with few listings. A small IT job market: about 400 job ads last quarter.',
    }),
    'more-cities': moreCities(
      'Perth, Sydney, Melbourne, Geelong and Wollongong',
      '3 count as regional',
    ),
    course: course(
      {
        id: 'information-technology-unisa-adelaide',
        name: 'Information Technology',
        sub: 'UniSA · Adelaide',
        gains: 'Good for: cost, PR, work',
        costs: 'Less good for: career',
        guide: `UniSA City West. About ${feesOf('unisa-it')}, with intakes in February and July.`,
        step: 'Information Technology',
      },
      'Also in Adelaide and Hobart',
    ),
    'alt-course': altCourse(
      {
        id: 'cyber-security-unisa-adelaide',
        name: 'Cyber Security',
        sub: 'UniSA · Adelaide',
        gains: 'Good for: cost, PR, work',
        costs: 'Less good for: career',
        guide: `UniSA City West. About ${feesOf('unisa-cyber')}, with intakes in February and July.`,
        step: 'Cyber Security',
      },
      'Adelaide',
      'Also in Adelaide and Hobart',
    ),
    'more-courses': moreCourses({
      id: 'more-courses-hobart',
      where: 'Hobart',
      count: 2,
      sub: 'Both at master’s level',
      guide: 'Adelaide’s two courses are both on the map; these two are in Hobart.',
    }),
    'visa-500': VISA_500,
    'course-years': courseYears(
      'masters-information-technology-unisa',
      'Information Technology',
      'Feb 2027 – Dec 2028',
      'Two years of units such as software engineering, web applications and databases.',
    ),
    'visa-485': visa485(true),
    fork: forkToPr('Two ways to PR from here: the 190 straight on, or the 491 and then the 191.'),
    'pr-straight': step(
      'state-nomination-190',
      '190 · state nomination',
      '190',
      '2031',
      'SA can nominate you: Software Engineer is on its 190 list. You agree to live and work in SA for two years.',
      TWO_WAYS_TO_PR,
      '190',
    ),
    'pr-point': PERMANENT_RESIDENCY,
    'pr-lane': regional491(
      'A five-year provisional visa: Software Engineer is on SA’s 491 list. You live and work in a regional area.',
    ),
    'pr-lane-end': PERMANENT_191,
    'stack-course': stackCourse({
      id: 'information-technology-utas-hobart',
      name: 'Information Technology and Systems',
      sub: 'UTAS · Hobart',
      step: 'Information Technology and Systems',
      courseId: 'utas-it',
    }),
  },
  badges: {
    offerings: offerings('2 intakes', 'February and July 2027.'),
    ielts: english('UniSA'),
    fork: forkAhead('to PR'),
    maths: programming('UniSA'),
    over: OVER,
  },
  stackRows: [
    {
      name: 'Information Technology and Systems',
      sub: 'UTAS · Hobart',
      courseId: 'utas-it',
      tag: 'Match well',
      tileId: 'information-technology-utas-hobart',
    },
    { name: 'Data Science', sub: 'UTAS · Hobart', courseId: 'utas-data', tag: 'Match well' },
  ],
  lesson: lesson('software engineering, web applications and databases', 'Adelaide', true),
  overview: overview(
    'Adelaide · 2 courses · 1 looked at',
    'Information Technology · 2 intakes · walked',
    'Permanent residency · 2 ways from the 485',
  ),
  arrivalLine: 'Tap Adelaide to see its courses.',
}

const SYDNEY_DATA: RoadSpec = {
  ...keyOf('sydney-data'),
  altCityId: 'melbourne',
  courseId: 'uts-data',
  altCourseId: 'uts-cyber',
  stackCourseId: 'monash-data',
  prRoute: '186',
  slots: {
    'point-a': POINT_A,
    australia: australia('Sydney'),
    city: city({
      id: 'sydney',
      name: 'Sydney',
      courses: 2,
      sub: citySub('sydney'),
      state: 'New South Wales',
      gains: 'Good for: career',
      costs: 'Less good for: cost, PR',
      guide:
        'About 2,600 data job ads last quarter. Rent for a one-bedroom flat is about AUD 530 a week.',
      walkTo: 'Data Science and Innovation',
    }),
    'alt-city': altCity({
      id: 'melbourne',
      name: 'Melbourne',
      sub: citySub('melbourne'),
      state: 'Victoria',
      gains: 'Good for: career',
      costs: 'Less good for: cost, PR',
      guide:
        'A large data job market: about 2,200 data job ads last quarter. Rent for a one-bedroom flat is about AUD 440 a week, vs 530 in Sydney.',
    }),
    'more-cities': moreCities(
      'Perth, Adelaide, Geelong, Hobart and Wollongong',
      'All 5 count as regional',
    ),
    course: course(
      {
        id: 'data-science-uts-sydney',
        name: 'Data Science and Innovation',
        sub: 'UTS · Sydney',
        gains: 'Good for: career, time',
        costs: 'Less good for: cost, PR',
        guide: `UTS Ultimo. About ${feesOf('uts-data')}; 83% of its graduates in this field in full-time work within four months.`,
        step: 'Data Science and Innovation',
      },
      'Also in Sydney and Melbourne',
    ),
    'alt-course': altCourse(
      {
        id: 'cyber-security-uts-sydney',
        name: 'Cyber Security',
        sub: 'UTS · Sydney',
        gains: 'Good for: career, time',
        costs: 'Less good for: cost, PR',
        guide: `UTS Ultimo. About ${feesOf('uts-cyber')}; about 9,800 IT job ads in Sydney last quarter.`,
        step: 'Cyber Security',
      },
      'Sydney',
      'Also in Sydney and Melbourne',
    ),
    'more-courses': moreCourses({
      id: 'more-courses-melbourne',
      where: 'Melbourne',
      count: 2,
      sub: '1 needs a psychology degree',
      guide: 'Sydney’s two courses are both on the map; these two are in Melbourne.',
    }),
    'visa-500': VISA_500,
    'course-years': courseYears(
      'masters-data-science-uts',
      'Data Science and Innovation',
      'Feb 2027 – Dec 2028',
      'Two years of units such as statistical thinking, machine learning and data visualisation, with an industry capstone.',
    ),
    'visa-485': visa485(false),
    fork: forkToPr(
      'Two ways to PR from here, both through an employer: the 186 straight on, or the 482 and then the 186.',
    ),
    'pr-straight': employer186(
      'An employer nominates you for a real job in your occupation, usually after two years of full-time work in the field.',
    ),
    'pr-point': PERMANENT_RESIDENCY,
    'pr-lane': SKILLS_482,
    'pr-lane-end': PERMANENT_186,
    'stack-course': stackCourse({
      id: 'data-science-monash-melbourne',
      name: 'Data Science',
      sub: 'Monash · Melbourne',
      step: 'Data Science',
      courseId: 'monash-data',
    }),
  },
  badges: {
    offerings: offerings('A later intake', 'A later 2027 intake keeps it open.'),
    ielts: english('UTS'),
    fork: forkAhead('to PR'),
    maths: programming('UTS'),
    over: OVER,
  },
  stackRows: [
    {
      name: 'Data Science',
      sub: 'Monash · Melbourne',
      courseId: 'monash-data',
      tag: 'Match well',
      tileId: 'data-science-monash-melbourne',
    },
    {
      name: 'Master of Psychology (Cyberpsychology)',
      sub: 'Swinburne · Needs an accredited psychology degree',
      courseId: 'swin-cyberpsych',
      tag: 'Not yet reachable',
      blocked: true,
    },
  ],
  lesson: lesson('statistical thinking, machine learning and data visualisation', 'Sydney', false),
  overview: overview(
    'Sydney · 2 courses · 1 looked at',
    'Data Science and Innovation · a later intake · walked',
    'Permanent residency · 2 ways from the 485',
  ),
  arrivalLine: 'Tap Sydney to see its courses.',
}

const GEELONG_BUSINESS: RoadSpec = {
  ...keyOf('geelong-business'),
  altCityId: 'wollongong',
  courseId: 'deakin-ba',
  altCourseId: 'deakin-cyber',
  stackCourseId: 'uow-cyber',
  prRoute: '491',
  slots: {
    'point-a': POINT_A,
    australia: australia('Geelong'),
    city: city({
      id: 'geelong',
      name: 'Geelong',
      courses: 2,
      sub: 'Counts as regional · an hour from Melbourne',
      state: 'Victoria',
      gains: 'Good for: PR, work',
      costs: 'Less good for: career',
      guide: `Counts as regional: up to 5 years of post-study work rights, and Victoria nominates graduates who study and work in its regional cities. About ${livingOf('geelong')}; Melbourne is an hour away by train.`,
      walkTo: 'Business Analytics',
    }),
    'alt-city': altCity({
      id: 'wollongong',
      name: 'Wollongong',
      sub: 'Counts as regional · 90 minutes from Sydney',
      state: 'New South Wales',
      gains: 'Good for: PR, work',
      costs: 'Less good for: cost',
      guide: `About ${livingOf('wollongong')}. Security roles nearby, and Sydney’s job market 90 minutes away by train.`,
    }),
    'more-cities': moreCities(
      'Perth, Adelaide, Sydney, Melbourne and Hobart',
      '3 count as regional',
    ),
    course: course(
      {
        id: 'business-analytics-deakin-geelong',
        name: 'Business Analytics',
        sub: 'Deakin · Geelong',
        gains: 'Good for: PR, work',
        costs: 'Less good for: cost, career',
        guide: `Deakin Waurn Ponds. About ${feesOf('deakin-ba')}; about 150 analytics job ads in Geelong last quarter, 1,900 in Melbourne.`,
        step: 'Business Analytics',
      },
      'Also in Geelong and Wollongong',
    ),
    'alt-course': altCourse(
      {
        id: 'cyber-security-deakin-geelong',
        name: 'Cyber Security',
        sub: 'Deakin · Geelong',
        gains: 'Good for: PR, work',
        costs: 'Less good for: cost, career',
        guide: `Deakin Waurn Ponds. About ${feesOf('deakin-cyber')}, with intakes in March and July.`,
        step: 'Cyber Security',
      },
      'Geelong',
      'Also in Geelong and Wollongong',
    ),
    'more-courses': moreCourses({
      id: 'more-courses-wollongong',
      where: 'Wollongong',
      count: 1,
      sub: 'At master’s level',
      guide: 'Geelong’s two courses are both on the map; this one is in Wollongong.',
    }),
    'visa-500': VISA_500,
    'course-years': courseYears(
      'masters-business-analytics-deakin',
      'Business Analytics',
      'Mar 2027 – Dec 2028',
      'Two years of units such as business analytics, data wrangling and decision modelling.',
    ),
    'visa-485': visa485(true),
    fork: forkToPr(
      'Two ways to PR from here: an employer’s 186 straight on, or the 491 and then the 191.',
    ),
    'pr-straight': employer186(
      'An employer nominates you for a real job as a Business Analyst, usually after two years of full-time work in the field. It is on Victoria’s 491 list, not its 190.',
    ),
    'pr-point': PERMANENT_RESIDENCY,
    'pr-lane': regional491(
      'A five-year provisional visa: Business Analyst is on Victoria’s 491 list. You live and work in a regional area.',
    ),
    'pr-lane-end': PERMANENT_191,
    'stack-course': stackCourse({
      id: 'cyber-security-uow-wollongong',
      name: 'Cyber Security',
      sub: 'UOW · Wollongong',
      step: 'Cyber Security',
      courseId: 'uow-cyber',
    }),
  },
  badges: {
    offerings: offerings('2 intakes', 'March and July 2027.'),
    ielts: english('Deakin'),
    fork: forkAhead('to PR'),
    maths: programming('Deakin'),
    over: OVER,
  },
  stackRows: [
    {
      name: 'Cyber Security',
      sub: 'UOW · Wollongong',
      courseId: 'uow-cyber',
      tag: 'Match well',
      tileId: 'cyber-security-uow-wollongong',
    },
  ],
  lesson: lesson('business analytics, data wrangling and decision modelling', 'Geelong', true),
  overview: overview(
    'Geelong · 2 courses · 1 looked at',
    'Business Analytics · 2 intakes · walked',
    'Permanent residency · 2 ways from the 485',
  ),
  arrivalLine: 'Tap Geelong to see its courses.',
}

const HOBART_IT: RoadSpec = {
  ...keyOf('hobart-it'),
  altCityId: 'adelaide',
  courseId: 'utas-it',
  altCourseId: 'utas-data',
  stackCourseId: 'unisa-it',
  prRoute: '491',
  slots: {
    'point-a': POINT_A,
    australia: australia('Hobart'),
    city: city({
      id: 'hobart',
      name: 'Hobart',
      courses: 2,
      sub: 'Counts as regional · a tight rental market',
      state: 'Tasmania',
      gains: 'Good for: PR, work',
      costs: 'Less good for: career',
      guide:
        'Counts as regional: up to 5 years of post-study work rights, and Tasmania nominates graduates who studied and live in the state. Rent for a one-bedroom flat is about AUD 420 a week, with few listings.',
      walkTo: 'Information Technology and Systems',
    }),
    'alt-city': altCity({
      id: 'adelaide',
      name: 'Adelaide',
      sub: citySub('adelaide'),
      state: 'South Australia',
      gains: 'Good for: cost, PR',
      costs: 'Less good for: career',
      guide:
        'Rent for a one-bedroom flat is about AUD 360 a week, vs 530 in Sydney. A smaller IT job market than Perth.',
    }),
    'more-cities': moreCities(
      'Perth, Sydney, Melbourne, Geelong and Wollongong',
      '3 count as regional',
    ),
    course: course(
      {
        id: 'information-technology-utas-hobart',
        name: 'Information Technology and Systems',
        sub: 'UTAS · Hobart',
        gains: 'Good for: cost, PR, work',
        costs: 'Less good for: career',
        guide: `UTAS Sandy Bay. About ${feesOf('utas-it')}; about 400 IT job ads in Hobart last quarter.`,
        step: 'Information Technology and Systems',
      },
      'Also in Hobart and Adelaide',
    ),
    'alt-course': altCourse(
      {
        id: 'data-science-utas-hobart',
        name: 'Data Science',
        sub: 'UTAS · Hobart',
        gains: 'Good for: cost, PR, work',
        costs: 'Less good for: career',
        guide: `UTAS Sandy Bay. About ${feesOf('utas-data')}, with a small July intake.`,
        step: 'Data Science',
      },
      'Hobart',
      'Also in Hobart and Adelaide',
    ),
    'more-courses': moreCourses({
      id: 'more-courses-adelaide',
      where: 'Adelaide',
      count: 2,
      sub: 'Both at master’s level',
      guide: 'Hobart’s two courses are both on the map; these two are in Adelaide.',
    }),
    'visa-500': VISA_500,
    'course-years': courseYears(
      'masters-information-technology-utas',
      'Information Technology and Systems',
      'Feb 2027 – Dec 2028',
      'Two years of units such as software engineering, databases and systems design.',
    ),
    'visa-485': visa485(true),
    fork: forkToPr(
      'Two ways to PR from here: an employer’s 186 straight on, or the 491 and then the 191.',
    ),
    'pr-straight': employer186(
      'An employer nominates you for a real job in your occupation, usually after two years of full-time work in the field. Software Engineer is on Tasmania’s 491 list, not its 190.',
    ),
    'pr-point': PERMANENT_RESIDENCY,
    'pr-lane': regional491(
      'A five-year provisional visa: Tasmania nominates graduates who studied and live in the state. You live and work in a regional area.',
    ),
    'pr-lane-end': PERMANENT_191,
    'stack-course': stackCourse({
      id: 'information-technology-unisa-adelaide',
      name: 'Information Technology',
      sub: 'UniSA · Adelaide',
      step: 'Information Technology',
      courseId: 'unisa-it',
    }),
  },
  badges: {
    offerings: offerings('A small July intake', 'A small July 2027 intake beside February.'),
    ielts: english('UTAS'),
    fork: forkAhead('to PR'),
    maths: {
      kind: 'Condition',
      value: 'Maths unit in year 1',
      explanation:
        'UTAS asks students whose degree had little maths to take a maths bridging unit in the first semester.',
      icon: 'alert',
    },
    over: OVER,
  },
  stackRows: [
    {
      name: 'Information Technology',
      sub: 'UniSA · Adelaide',
      courseId: 'unisa-it',
      tag: 'Match well',
      tileId: 'information-technology-unisa-adelaide',
    },
    { name: 'Cyber Security', sub: 'UniSA · Adelaide', courseId: 'unisa-cyber', tag: 'Match well' },
  ],
  lesson: lesson('software engineering, databases and systems design', 'Hobart', true),
  overview: overview(
    'Hobart · 2 courses · 1 looked at',
    'Information Technology and Systems · Feb and July · walked',
    'Permanent residency · 2 ways from the 485',
  ),
  arrivalLine: 'Tap Hobart to see its courses.',
}

// The road for a student who goes home: two ways home after the 485, and no slot claims a way to
// stay for good.
const TWO_WAYS_HOME = 'One of 2 ways home from the 485'

const MELBOURNE_HOME: RoadSpec = {
  ...keyOf('melbourne-home'),
  altCityId: 'sydney',
  courseId: 'monash-data',
  altCourseId: 'swin-cyberpsych',
  stackCourseId: 'uts-data',
  prRoute: 'none',
  slots: {
    'point-a': POINT_A,
    australia: australia('Melbourne'),
    city: city({
      id: 'melbourne',
      name: 'Melbourne',
      courses: 2,
      sub: citySub('melbourne'),
      state: 'Victoria',
      gains: 'Good for: career',
      costs: 'Less good for: cost',
      guide:
        'A large data job market: about 2,200 data job ads last quarter. Rent for a one-bedroom flat is about AUD 440 a week, vs 530 in Sydney.',
      walkTo: 'Data Science',
    }),
    'alt-city': altCity({
      id: 'sydney',
      name: 'Sydney',
      sub: citySub('sydney'),
      state: 'New South Wales',
      gains: 'Good for: career',
      costs: 'Less good for: cost',
      guide:
        'About 2,600 data job ads last quarter. Rent for a one-bedroom flat is about AUD 530 a week.',
    }),
    'more-cities': moreCities(
      'Perth, Adelaide, Geelong, Hobart and Wollongong',
      'All 5 count as regional',
    ),
    course: course(
      {
        id: 'data-science-monash-melbourne',
        name: 'Data Science',
        sub: 'Monash · Melbourne',
        gains: 'Good for: career, time',
        costs: 'Less good for: cost',
        guide: `Monash Clayton. About ${feesOf('monash-data')}; 82% of its graduates in this field in full-time work within four months.`,
        step: 'Data Science',
      },
      'Also in Melbourne and Sydney',
    ),
    'alt-course': altCourse(
      {
        id: 'cyberpsychology-swinburne-melbourne',
        name: 'Cyberpsychology',
        sub: 'Swinburne · Melbourne',
        gains: 'Good for: career',
        costs: 'Less good for: cost',
        guide: `Swinburne Hawthorn. About ${feesOf('swin-cyberpsych')}. A niche field: security teams hire people who understand behaviour.`,
        step: 'Cyberpsychology',
      },
      'Melbourne',
      'Also in Melbourne and Sydney',
    ),
    'more-courses': moreCourses({
      id: 'more-courses-sydney',
      where: 'Sydney',
      count: 2,
      sub: 'Both at master’s level',
      guide: 'Melbourne’s two courses are both on the map; these two are in Sydney.',
    }),
    'visa-500': VISA_500,
    'course-years': courseYears(
      'masters-data-science-monash',
      'Data Science',
      'Feb 2027 – Dec 2028',
      'Two years of units such as statistical learning, deep learning and data engineering.',
    ),
    'visa-485': visa485(false),
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
      'Home with two years of Australian work',
      'Home with work',
      '2031',
      'Home when the 485 ends: 2 years of work rights after a big-city master’s.',
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
      'More years of work in Australia before going home. After a big-city master’s the 485 runs 2 years; staying on after it needs another visa, such as an employer’s 482.',
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
    'stack-course': stackCourse({
      id: 'data-science-uts-sydney',
      name: 'Data Science and Innovation',
      sub: 'UTS · Sydney',
      step: 'Data Science and Innovation',
      courseId: 'uts-data',
    }),
  },
  badges: {
    offerings: offerings('2 intakes', 'February and July 2027.'),
    ielts: english('Monash'),
    fork: forkAhead('home'),
    maths: {
      kind: 'Condition',
      value: 'An accredited psychology degree',
      explanation:
        'Swinburne asks for an accredited psychology degree with honours-level results, and supervised placement hours in the second year.',
      icon: 'alert',
    },
    over: OVER,
  },
  stackRows: [
    {
      name: 'Data Science and Innovation',
      sub: 'UTS · Sydney',
      courseId: 'uts-data',
      tag: 'Match well',
      tileId: 'data-science-uts-sydney',
    },
    { name: 'Cyber Security', sub: 'UTS · Sydney', courseId: 'uts-cyber', tag: '' },
  ],
  lesson: lesson('statistical learning, deep learning and data engineering', 'Melbourne', false),
  overview: overview(
    'Melbourne · 2 courses · 1 looked at',
    'Data Science · 2 intakes · walked',
    'Home · 2 ways from the 485',
  ),
  arrivalLine: 'Tap Melbourne to see its courses.',
}

export const ROADS: readonly RoadSpec[] = [
  PERTH_CYBER,
  ADELAIDE_IT,
  SYDNEY_DATA,
  GEELONG_BUSINESS,
  HOBART_IT,
  MELBOURNE_HOME,
]

const ROAD_BY_ID = new Map(ROADS.map((r) => [r.id, r]))

export function roadById(id: string): RoadSpec | undefined {
  return ROAD_BY_ID.get(id)
}
