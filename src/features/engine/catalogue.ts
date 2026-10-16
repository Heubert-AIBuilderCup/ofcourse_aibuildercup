// The mock Australia catalogue for the preview: seven cities, their places and campuses, and
// fourteen courses. Every figure here is mock and every claim's source says so (DS-R5, DS-F43).
// Pure data, so the engine reads the same catalogue on the server and in the browser.

import type {
  Campus,
  City,
  Claim,
  Course,
  DataState,
  Effect,
  FieldId,
  LineData,
  Pips,
  Place,
} from './types'

/** The day the preview's figures are dated; months to a start are counted from it. */
export const PREVIEW_TODAY = '2026-10-01'

const claim = (
  pips: Pips,
  state: DataState,
  source: string,
  date: string,
  detail: string[],
): Claim => ({ pips, state, source: `${source} · mock`, date, detail, notSure: false })

const line = (effect: Effect, text: string, data: Claim): LineData => ({
  effect,
  text,
  claim: data,
})

const rent = (pips: Pips, detail: string): Claim =>
  claim(pips, 'estimated', 'Rental listings', 'Aug 2026', [detail])
const regionalStatus = (pips: Pips, detail: string[]): Claim =>
  claim(pips, 'confirmed', 'Home Affairs, regional postcodes', 'Sep 2026', detail)

export const CITIES: readonly City[] = [
  {
    id: 'perth',
    name: 'Perth',
    regional: true,
    livingK: 21,
    lat: -31.952,
    lng: 115.861,
    location: {
      text: 'Counts as regional; rent about AUD 160 a week lower than Sydney (about 30%)',
      claim: rent(4, 'Median rent for a one-bedroom flat: about AUD 370 a week, vs 530 in Sydney'),
    },
  },
  {
    id: 'adelaide',
    name: 'Adelaide',
    regional: true,
    livingK: 20,
    lat: -34.929,
    lng: 138.601,
    location: {
      text: 'Counts as regional; rent about 30% below Sydney',
      claim: rent(4, 'Median rent for a one-bedroom flat: about AUD 360 a week, vs 530 in Sydney'),
    },
  },
  {
    id: 'sydney',
    name: 'Sydney',
    regional: false,
    livingK: 28,
    lat: -33.869,
    lng: 151.209,
    location: {
      text: 'The highest rents in the country',
      claim: rent(1, 'Median rent for a one-bedroom flat: about AUD 530 a week'),
    },
  },
  {
    id: 'melbourne',
    name: 'Melbourne',
    regional: false,
    livingK: 25,
    lat: -37.814,
    lng: 144.963,
    location: {
      text: "A big city; rents below Sydney's",
      claim: rent(2, 'Median rent for a one-bedroom flat: about AUD 440 a week, vs 530 in Sydney'),
    },
  },
  {
    id: 'geelong',
    name: 'Geelong',
    regional: true,
    livingK: 22,
    lat: -38.149,
    lng: 144.361,
    location: {
      text: 'Counts as regional; an hour from Melbourne',
      claim: regionalStatus(4, [
        'Geelong counts as regional for visa purposes',
        'About an hour to Melbourne by train',
      ]),
    },
  },
  {
    id: 'hobart',
    name: 'Hobart',
    regional: true,
    livingK: 21,
    lat: -42.882,
    lng: 147.327,
    location: {
      text: 'Counts as regional; a small city with a tight rental market',
      claim: rent(3, 'Median rent for a one-bedroom flat: about AUD 420 a week, with few listings'),
    },
  },
  {
    id: 'wollongong',
    name: 'Wollongong',
    regional: true,
    livingK: 24,
    lat: -34.425,
    lng: 150.893,
    location: {
      text: 'Counts as regional; 90 minutes from Sydney by train',
      claim: regionalStatus(4, [
        'Wollongong counts as regional for visa purposes',
        'About 90 minutes to Sydney by train',
      ]),
    },
  },
]

export const PLACES: readonly Place[] = [
  { id: 'perth-cbd', name: 'Perth CBD', cityId: 'perth', lat: -31.952, lng: 115.861 },
  { id: 'cannington', name: 'Cannington', cityId: 'perth', lat: -32.017, lng: 115.935 },
  { id: 'joondalup', name: 'Joondalup', cityId: 'perth', lat: -31.745, lng: 115.766 },
  { id: 'bentley', name: 'Bentley', cityId: 'perth', lat: -32.001, lng: 115.9 },
  { id: 'adelaide-cbd', name: 'Adelaide CBD', cityId: 'adelaide', lat: -34.929, lng: 138.601 },
  { id: 'mawson-lakes', name: 'Mawson Lakes', cityId: 'adelaide', lat: -34.81, lng: 138.61 },
  { id: 'sydney-cbd', name: 'Sydney CBD', cityId: 'sydney', lat: -33.869, lng: 151.209 },
  { id: 'parramatta', name: 'Parramatta', cityId: 'sydney', lat: -33.815, lng: 151.001 },
  { id: 'strathfield', name: 'Strathfield', cityId: 'sydney', lat: -33.873, lng: 151.094 },
  { id: 'melbourne-cbd', name: 'Melbourne CBD', cityId: 'melbourne', lat: -37.814, lng: 144.963 },
  { id: 'footscray', name: 'Footscray', cityId: 'melbourne', lat: -37.8, lng: 144.9 },
  { id: 'clayton', name: 'Clayton', cityId: 'melbourne', lat: -37.915, lng: 145.129 },
  { id: 'geelong', name: 'Geelong', cityId: 'geelong', lat: -38.149, lng: 144.361 },
  { id: 'waurn-ponds', name: 'Waurn Ponds', cityId: 'geelong', lat: -38.21, lng: 144.3 },
  { id: 'hobart', name: 'Hobart', cityId: 'hobart', lat: -42.882, lng: 147.327 },
  { id: 'sandy-bay', name: 'Sandy Bay', cityId: 'hobart', lat: -42.904, lng: 147.325 },
  { id: 'wollongong', name: 'Wollongong', cityId: 'wollongong', lat: -34.425, lng: 150.893 },
]

export const CAMPUSES: readonly Campus[] = [
  { id: 'ecu-joondalup', name: 'ECU Joondalup', cityId: 'perth', lat: -31.752, lng: 115.77 },
  { id: 'curtin-bentley', name: 'Curtin Bentley', cityId: 'perth', lat: -32.006, lng: 115.894 },
  { id: 'tafe-perth', name: 'TAFE Perth', cityId: 'perth', lat: -31.949, lng: 115.858 },
  {
    id: 'unisa-city-west',
    name: 'UniSA City West',
    cityId: 'adelaide',
    lat: -34.924,
    lng: 138.592,
  },
  { id: 'uts-ultimo', name: 'UTS Ultimo', cityId: 'sydney', lat: -33.883, lng: 151.2 },
  {
    id: 'monash-clayton',
    name: 'Monash Clayton',
    cityId: 'melbourne',
    lat: -37.911,
    lng: 145.134,
  },
  {
    id: 'swinburne-hawthorn',
    name: 'Swinburne Hawthorn',
    cityId: 'melbourne',
    lat: -37.822,
    lng: 145.039,
  },
  {
    id: 'deakin-waurn-ponds',
    name: 'Deakin Waurn Ponds',
    cityId: 'geelong',
    lat: -38.198,
    lng: 144.298,
  },
  { id: 'utas-sandy-bay', name: 'UTAS Sandy Bay', cityId: 'hobart', lat: -42.903, lng: 147.325 },
  {
    id: 'uow-wollongong',
    name: 'UOW Wollongong',
    cityId: 'wollongong',
    lat: -34.405,
    lng: 150.878,
  },
]

// ── Lines shared by several courses ─────────────────────────────────────────────────────────

/** A PR claim's first detail line: the outlook is a band, never a number (DS-R6). */
const BAND_NOT_NUMBER = "A band, not a number: we don't predict this for you"
const JOB_ADS = 'Job-ad counts, Jul–Sep 2026'
const graduates = (university: string, share: number) =>
  `Graduates in this field from ${university}: ${share}% in full-time work within four months · graduate outcomes survey 2025`
const jobMarket = (pips: Pips, detail: string[]): Claim =>
  claim(pips, 'estimated', JOB_ADS, 'Sep 2026', detail)

const METRO_WORK = line(
  'costs',
  'Metro: 2 years of post-study work rights',
  claim(2, 'confirmed', 'Home Affairs, subclass 485', 'Sep 2026', [
    "A master's in a big city: 2 years of post-study work rights",
  ]),
)
const REGIONAL_WORK = line(
  'gives',
  'Regional study: up to 5 years of post-study work rights',
  claim(4, 'confirmed', 'Home Affairs, subclass 485', 'Sep 2026', [
    'Up to 5 years of post-study work rights for regional study',
  ]),
)
const PERTH_WORK = line(
  'gives',
  'Perth counts as regional: longer post-study work rights',
  claim(4, 'confirmed', 'Home Affairs, subclass 485', 'Sep 2026', [
    'Perth counts as regional: up to 5 years of post-study work rights',
  ]),
)

const WA_PR = line(
  'gives',
  'Western Australia nominates its own graduates',
  claim(4, 'estimated', 'WA skilled list 2025–26', 'Jul 2026', [
    BAND_NOT_NUMBER,
    'Western Australia nominates IT and security graduates of its own universities (190)',
  ]),
)
const regionalPr = (text: string, source: string, rule: string) =>
  line('gives', text, claim(3, 'estimated', source, 'Aug 2026', [BAND_NOT_NUMBER, rule]))
const EMPLOYER_PR = line(
  'costs',
  'No regional points; depends on an employer',
  claim(2, 'out of date', 'Employer-sponsored visa data 2024–25', 'Jul 2025', [
    BAND_NOT_NUMBER,
    'After the 485, staying usually needs an employer to sponsor you',
  ]),
)
const noPr = (why: string) =>
  line(
    'costs',
    'No clear road to permanent residency',
    claim(1, 'estimated', 'Home Affairs skilled occupation lists', 'Sep 2026', [
      BAND_NOT_NUMBER,
      why,
    ]),
  )

const WA_TIME = claim(3, 'estimated', 'WA state nomination guide', 'Jul 2026', [
  '190 nomination after about 1–3 years of work in WA',
])
const sixYears491 = (state: DataState, extra: string) =>
  claim(2, state, 'Home Affairs processing times', 'Aug 2026', [
    `491 is 3 years provisional, then 191${extra}`,
  ])

const ADELAIDE_LINES: Course['lines'] = {
  time: line(
    'costs',
    'About 6 years to permanent residency · a later intake keeps it open',
    sixYears491('unknown', '; processing times vary widely'),
  ),
  work: REGIONAL_WORK,
  pr: regionalPr(
    'Regional points, then a 491 to 191 path',
    'SA nomination pattern 2025–26',
    'South Australia nominates graduates of its own universities for the 491',
  ),
  // R1, the Adelaide job-market claim: the one claim marked "not sure" (criterion 39).
  career: {
    effect: 'costs',
    text: 'A smaller IT job market than Perth',
    claim: {
      pips: 2,
      state: 'estimated',
      source: `${JOB_ADS} · mock figure`,
      date: 'Sep 2026',
      detail: [
        'Adelaide IT job market: moderate · ~2,100 postings last quarter vs 3,400 in Perth',
        graduates('UniSA', 78),
      ],
      notSure: true,
    },
  },
}

const GEELONG_TIME = line(
  'costs',
  'About 6 years to permanent residency · intakes in March and July',
  sixYears491('estimated', ''),
)
const GEELONG_PR = regionalPr(
  'Regional points in Geelong, then a 491 to 191 path',
  'Victorian nomination pattern 2025–26',
  'Victoria nominates graduates who study and work in its regional cities',
)

const SYDNEY_FIRST_JOB = (field: string) =>
  line(
    'gives',
    `The fastest road to a first job${field} · a later intake keeps it open`,
    jobMarket(4, ['The biggest graduate intake; most roles open to 485 holders']),
  )

const UTS_DEFER = { text: 'Ask UTS whether you can defer a year', doors: 'keeps 1 door open' }
const FEB_JUL = { text: 'Apply to two intakes (Feb and Jul 2027)', doors: 'keeps 2 doors open' }
const MAR_JUL = { text: 'Apply to two intakes (Mar and Jul 2027)', doors: 'keeps 2 doors open' }

// ── Courses ─────────────────────────────────────────────────────────────────────────────────

/** Fee strength: the cheaper the course, the stronger it is on cost. */
const feePips = (feeK: number): Pips =>
  feeK <= 20 ? 5 : feeK <= 30 ? 4 : feeK <= 35 ? 3 : feeK <= 42 ? 2 : 1

/** A course, its fee claim drawn from its fee. */
const course = (c: Omit<Course, 'feeClaim'>): Course => ({
  ...c,
  feeClaim: claim(feePips(c.feeK), 'confirmed', `${c.university} 2027 fees page`, 'Sep 2026', [
    `Tuition about AUD ${c.feeK}k a year in 2027`,
  ]),
})

export const COURSES: readonly Course[] = [
  course({
    id: 'ecu-cyber',
    name: 'Master of Cyber Security',
    university: 'ECU',
    campusId: 'ecu-joondalup',
    field: 'cyber',
    level: "Master's",
    feeK: 33,
    years: 2,
    route: '190 state nomination, then PR',
    prScore: 3,
    careerScore: 3,
    placements: true,
    lines: {
      time: line(
        'gives',
        'About 5 years to permanent residency · a later intake keeps it open',
        WA_TIME,
      ),
      work: PERTH_WORK,
      pr: WA_PR,
      career: line(
        'gives',
        'Steady demand for security roles in WA',
        jobMarket(3, [
          'Perth IT job market: ~3,400 postings last quarter, ~280 of them in security',
          graduates('ECU', 81),
        ]),
      ),
    },
    keepOpen: {
      text: 'Sit the IELTS before 30 Nov',
      doors: 'keeps 2 doors open: the February and July intakes',
    },
  }),
  course({
    id: 'curtin-it',
    name: 'Master of Information Technology',
    university: 'Curtin',
    campusId: 'curtin-bentley',
    field: 'it',
    level: "Master's",
    feeK: 34,
    years: 2,
    route: '190 state nomination, then PR',
    prScore: 3,
    careerScore: 3,
    placements: true,
    lines: {
      time: line(
        'gives',
        'About 5 years to permanent residency · intakes in February and July',
        WA_TIME,
      ),
      work: PERTH_WORK,
      pr: WA_PR,
      career: line(
        'gives',
        'Steady demand for IT roles in WA',
        jobMarket(3, [
          'Perth IT job market: ~3,400 postings last quarter',
          graduates('Curtin', 80),
        ]),
      ),
    },
    keepOpen: { text: 'Ask Curtin about the July intake now', doors: 'keeps 1 door open' },
  }),
  course({
    id: 'unisa-cyber',
    name: 'Master of Cyber Security',
    university: 'UniSA',
    campusId: 'unisa-city-west',
    field: 'cyber',
    level: "Master's",
    feeK: 27,
    years: 2,
    route: '491 regional visa, then PR',
    prScore: 3,
    careerScore: 2,
    placements: false,
    lines: ADELAIDE_LINES,
    keepOpen: FEB_JUL,
  }),
  course({
    id: 'unisa-it',
    name: 'Master of Information Technology',
    university: 'UniSA',
    campusId: 'unisa-city-west',
    field: 'it',
    level: "Master's",
    feeK: 29,
    years: 2,
    route: '491 regional visa, then PR',
    prScore: 3,
    careerScore: 2,
    placements: false,
    lines: ADELAIDE_LINES,
    keepOpen: FEB_JUL,
  }),
  course({
    id: 'uts-cyber',
    name: 'Master of Cyber Security',
    university: 'UTS',
    campusId: 'uts-ultimo',
    field: 'cyber',
    level: "Master's",
    feeK: 47,
    years: 2,
    route: '485, then employer sponsorship',
    prScore: 1,
    careerScore: 5,
    placements: true,
    lines: {
      time: SYDNEY_FIRST_JOB(''),
      work: METRO_WORK,
      pr: EMPLOYER_PR,
      career: line(
        'gives',
        'The biggest job market in Australia',
        jobMarket(5, ['Sydney IT job market: ~9,800 postings last quarter', graduates('UTS', 84)]),
      ),
    },
    keepOpen: UTS_DEFER,
  }),
  course({
    id: 'uts-data',
    name: 'Master of Data Science and Innovation',
    university: 'UTS',
    campusId: 'uts-ultimo',
    field: 'data',
    level: "Master's",
    feeK: 49,
    years: 2,
    route: '485, then employer sponsorship',
    prScore: 1,
    careerScore: 5,
    placements: true,
    lines: {
      time: SYDNEY_FIRST_JOB(' in data'),
      work: METRO_WORK,
      pr: EMPLOYER_PR,
      career: line(
        'gives',
        'The biggest data job market in Australia',
        jobMarket(5, [
          'Sydney data job market: ~2,600 postings last quarter',
          graduates('UTS', 83),
        ]),
      ),
    },
    keepOpen: UTS_DEFER,
  }),
  course({
    id: 'monash-data',
    name: 'Master of Data Science',
    university: 'Monash',
    campusId: 'monash-clayton',
    field: 'data',
    level: "Master's",
    feeK: 45,
    years: 2,
    route: '485, then employer sponsorship',
    prScore: 1,
    careerScore: 4,
    placements: false,
    lines: {
      time: line(
        'gives',
        'A fast road to a first job · February and July intakes',
        jobMarket(3, ['A large graduate intake; many roles open to 485 holders']),
      ),
      work: METRO_WORK,
      pr: EMPLOYER_PR,
      career: line(
        'gives',
        'A large data job market in Melbourne',
        jobMarket(4, [
          'Melbourne data job market: ~2,200 postings last quarter',
          graduates('Monash', 82),
        ]),
      ),
    },
    keepOpen: { text: 'Apply before the 30 Nov round', doors: 'keeps 2 doors open' },
  }),
  course({
    id: 'deakin-ba',
    name: 'Master of Business Analytics',
    university: 'Deakin',
    campusId: 'deakin-waurn-ponds',
    field: 'business',
    level: "Master's",
    feeK: 36,
    years: 2,
    route: '491 regional visa, then PR',
    prScore: 3,
    careerScore: 2,
    placements: true,
    lines: {
      time: GEELONG_TIME,
      work: REGIONAL_WORK,
      pr: GEELONG_PR,
      career: line(
        'costs',
        'A smaller analytics job market; Melbourne is an hour away',
        jobMarket(2, [
          'Geelong analytics roles: ~150 postings last quarter, ~1,900 in Melbourne',
          graduates('Deakin', 76),
        ]),
      ),
    },
    keepOpen: MAR_JUL,
  }),
  course({
    id: 'deakin-cyber',
    name: 'Master of Cyber Security',
    university: 'Deakin',
    campusId: 'deakin-waurn-ponds',
    field: 'cyber',
    level: "Master's",
    feeK: 35,
    years: 2,
    route: '491 regional visa, then PR',
    prScore: 3,
    careerScore: 2,
    placements: true,
    lines: {
      time: GEELONG_TIME,
      work: REGIONAL_WORK,
      pr: GEELONG_PR,
      career: line(
        'costs',
        'A smaller security job market; Melbourne is an hour away',
        jobMarket(2, [
          'Geelong security roles: ~90 postings last quarter, ~1,300 in Melbourne',
          graduates('Deakin', 77),
        ]),
      ),
    },
    keepOpen: MAR_JUL,
  }),
  course({
    id: 'utas-it',
    name: 'Master of Information Technology and Systems',
    university: 'UTAS',
    campusId: 'utas-sandy-bay',
    field: 'it',
    level: "Master's",
    feeK: 28,
    years: 2,
    route: '491 regional visa, then PR',
    prScore: 3,
    careerScore: 1,
    placements: false,
    lines: {
      time: line(
        'neutral',
        'About 5 years to permanent residency · a small July intake',
        claim(3, 'estimated', 'Tasmanian nomination guide', 'Jul 2026', [
          'Tasmania nominates graduates for the 491 after two years of study in the state',
        ]),
      ),
      work: REGIONAL_WORK,
      pr: regionalPr(
        'Tasmania nominates its own graduates for the 491, then a 191',
        'Tasmanian nomination guide',
        'Tasmania nominates graduates who studied and live in the state',
      ),
      career: line(
        'costs',
        'A small IT job market in Hobart',
        jobMarket(1, ['Hobart IT job market: ~400 postings last quarter', graduates('UTAS', 74)]),
      ),
    },
    keepOpen: { text: 'Ask about the July intake', doors: 'keeps 1 door open' },
  }),
  course({
    id: 'uow-cyber',
    name: 'Master of Cyber Security',
    university: 'UOW',
    campusId: 'uow-wollongong',
    field: 'cyber',
    level: "Master's",
    feeK: 38,
    years: 2,
    route: '491 regional visa, then PR',
    prScore: 3,
    careerScore: 3,
    placements: true,
    lines: {
      time: line(
        'costs',
        'About 6 years to permanent residency · a later intake keeps it open',
        sixYears491('estimated', ''),
      ),
      work: REGIONAL_WORK,
      pr: regionalPr(
        'Regional points in Wollongong, then a 491 to 191 path',
        'NSW regional nomination pattern 2025–26',
        'New South Wales nominates graduates who live and work in its regional cities',
      ),
      career: line(
        'gives',
        "Security roles nearby, and Sydney's job market 90 minutes away",
        jobMarket(3, [
          'Wollongong security roles: ~120 postings last quarter, ~2,100 in Sydney',
          graduates('UOW', 80),
        ]),
      ),
    },
    keepOpen: FEB_JUL,
  }),
  course({
    id: 'swin-cyberpsych',
    name: 'Master of Psychology (Cyberpsychology)',
    university: 'Swinburne',
    campusId: 'swinburne-hawthorn',
    field: 'psych',
    level: "Master's",
    feeK: 40,
    years: 2,
    route: '485, no clear road to PR',
    prScore: 0,
    careerScore: 3,
    placements: true,
    lines: {
      time: line(
        'costs',
        'Two years of study, then a 485 with no clear next step',
        claim(2, 'estimated', 'Home Affairs, subclass 485', 'Sep 2026', [
          "A 2-year master's, then 2 years of post-study work rights",
        ]),
      ),
      work: METRO_WORK,
      pr: noPr('Roles this course leads to are not on the lists states nominate from'),
      career: line(
        'gives',
        'A niche field: security teams hire people who understand behaviour',
        jobMarket(3, [
          'Melbourne roles asking for psychology and security: ~140 postings last quarter',
          graduates('Swinburne', 75),
        ]),
      ),
    },
    keepOpen: { text: 'Ask Swinburne about credit for your degree', doors: 'keeps 1 door open' },
  }),
  course({
    id: 'ecu-bsc-cyber',
    name: 'Bachelor of Cyber Security',
    university: 'ECU',
    campusId: 'ecu-joondalup',
    field: 'cyber',
    level: "Bachelor's",
    feeK: 32,
    years: 3,
    route: '190 state nomination, then PR',
    prScore: 3,
    careerScore: 3,
    placements: true,
    lines: {
      time: line(
        'costs',
        'Three years of study before post-study work starts',
        claim(2, 'confirmed', 'ECU course page', 'Sep 2026', [
          "A 3-year bachelor's, with intakes in February and July",
        ]),
      ),
      work: PERTH_WORK,
      pr: WA_PR,
      career: line(
        'gives',
        'Steady demand for security roles in WA',
        jobMarket(3, [
          'Perth IT job market: ~3,400 postings last quarter, ~280 of them in security',
          graduates('ECU', 79),
        ]),
      ),
    },
    keepOpen: FEB_JUL,
  }),
  course({
    id: 'tafe-cyber',
    name: 'Diploma of Information Technology (Cyber Security)',
    university: 'North Metropolitan TAFE',
    campusId: 'tafe-perth',
    field: 'cyber',
    level: 'Diploma',
    feeK: 15,
    years: 2,
    route: 'Diploma, then a degree pathway',
    prScore: 0,
    careerScore: 2,
    placements: true,
    lines: {
      time: line(
        'costs',
        'Two years of diploma, then a degree on top',
        claim(3, 'estimated', 'North Metropolitan TAFE course page', 'Sep 2026', [
          'A 2-year diploma; the degree pathway adds about 2 more years',
        ]),
      ),
      work: line(
        'gives',
        'Perth counts as regional: longer work rights once the degree is done',
        claim(3, 'estimated', 'Home Affairs, subclass 485', 'Sep 2026', [
          'A diploma alone earns short post-study work rights; the regional extension follows a degree',
        ]),
      ),
      pr: noPr('A diploma alone does not lead to nomination; the degree after it might'),
      career: line(
        'costs',
        'Entry-level IT roles first; security roles usually ask for a degree',
        jobMarket(2, [
          'Perth IT support roles: ~600 postings last quarter',
          'Most security roles in Perth ask for a degree',
        ]),
      ),
    },
    keepOpen: { text: 'Ask about the pathway into a degree', doors: 'keeps 1 door open' },
  }),
]

// ── Fields ──────────────────────────────────────────────────────────────────────────────────

/** Screen 2's "Which field?" options. */
export const FIELD_OF_OPTION: Readonly<Record<string, FieldId>> = {
  'Cyber security': 'cyber',
  'Data science': 'data',
  'Business analytics': 'business',
  'Information technology': 'it',
}

export const FIELD_LABELS: Record<FieldId, string> = {
  cyber: 'cyber security',
  data: 'data science',
  business: 'business analytics',
  it: 'information technology',
  psych: 'psychology',
  health: 'health',
  engineering: 'engineering',
  design: 'design',
}

/**
 * Screen 2's areas. An area the preview has no courses for borrows the nearest field, and
 * `substitutedFrom` names what it stands in for (criterion 44).
 */
export const AREA_FIELDS: Readonly<
  Record<string, { fields: FieldId[]; substitutedFrom?: string }>
> = {
  'IT and computing': { fields: ['it', 'cyber'] },
  Business: { fields: ['business'] },
  Data: { fields: ['data'] },
  Health: { fields: ['psych'], substitutedFrom: 'health' },
  Engineering: { fields: ['it'], substitutedFrom: 'engineering' },
  Design: { fields: ['it'], substitutedFrom: 'design' },
}

// ── Lookups ─────────────────────────────────────────────────────────────────────────────────

const CITY_BY_ID = new Map(CITIES.map((c) => [c.id, c]))
const CAMPUS_BY_ID = new Map(CAMPUSES.map((c) => [c.id, c]))
const PLACE_BY_ID = new Map(PLACES.map((p) => [p.id, p]))

/** A city the catalogue itself names (a campus's or a place's). */
export function cityById(id: string): City {
  const city = CITY_BY_ID.get(id)
  if (!city) throw new Error(`No city ${id}`)
  return city
}

export function campusOf(course: Course): Campus {
  const campus = CAMPUS_BY_ID.get(course.campusId)
  if (!campus) throw new Error(`No campus ${course.campusId}`)
  return campus
}

export function cityOf(course: Course): City {
  return cityById(campusOf(course).cityId)
}

/** "Cannington, Perth"; a place already named for its city reads once ("Hobart", "Perth CBD"). */
export function placeLabel(place: Place): string {
  const city = cityById(place.cityId).name
  return place.name.startsWith(city) ? place.name : `${place.name}, ${city}`
}

/** A place she picked; undefined for an id the preview does not have. */
export function placeById(id: string): Place | undefined {
  return PLACE_BY_ID.get(id)
}
