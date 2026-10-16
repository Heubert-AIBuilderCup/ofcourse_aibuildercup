// Courses the roads need beyond the engine's COURSES. They stay out of the engine's list because
// the admin's Updates and Comic gaps read that one. Same Course shape, existing campuses.

import { COURSES } from '@/features/engine/catalogue'
import type { Claim, Course, DataState, LineData, Pips } from '@/features/engine/types'

const claim = (
  pips: Pips,
  state: DataState,
  source: string,
  date: string,
  detail: string[],
): Claim => ({ pips, state, source: `${source} · mock`, date, detail, notSure: false })

const line = (effect: LineData['effect'], text: string, data: Claim): LineData => ({
  effect,
  text,
  claim: data,
})

const fee = (university: string, feeK: number): Claim =>
  claim(feeK <= 30 ? 4 : 3, 'confirmed', `${university} 2027 fees page`, 'Sep 2026', [
    `Tuition about AUD ${feeK}k a year in 2027`,
  ])

const waWork = line(
  'gives',
  'Perth counts as regional: longer post-study work rights',
  claim(4, 'confirmed', 'Home Affairs, subclass 485', 'Sep 2026', [
    'Perth counts as regional: up to 5 years of post-study work rights',
  ]),
)
const waPr = line(
  'gives',
  'Western Australia nominates its own graduates',
  claim(4, 'estimated', 'WA skilled list 2025–26', 'Jul 2026', [
    "A band, not a number: we don't predict this for you",
    'Western Australia nominates IT and data graduates of its own universities (190)',
  ]),
)
const waTime = (intakes: string) =>
  line(
    'gives',
    `About 5 years to permanent residency · intakes in ${intakes}`,
    claim(3, 'estimated', 'WA state nomination guide', 'Jul 2026', [
      '190 nomination after about 1–3 years of work in WA',
    ]),
  )
const perthCareer = (text: string, detail: string) =>
  line(
    'gives',
    text,
    claim(3, 'estimated', 'Job-ad counts, Jul–Sep 2026', 'Sep 2026', [
      'Perth IT job market: ~3,400 postings last quarter',
      detail,
    ]),
  )

const BAND = "A band, not a number: we don't predict this for you"

const market = (effect: LineData['effect'], text: string, pips: Pips, detail: string[]) =>
  line(effect, text, claim(pips, 'estimated', 'Job-ad counts, Jul–Sep 2026', 'Sep 2026', detail))
const graduates = (university: string, share: number) =>
  `Graduates in this field from ${university}: ${share}% in full-time work within four months · graduate outcomes survey 2025`

const regionalWork = line(
  'gives',
  'Regional study: up to 5 years of post-study work rights',
  claim(4, 'confirmed', 'Home Affairs, subclass 485', 'Sep 2026', [
    'Up to 5 years of post-study work rights for regional study',
  ]),
)
const metroWork = line(
  'costs',
  'Metro: 2 years of post-study work rights',
  claim(2, 'confirmed', 'Home Affairs, subclass 485', 'Sep 2026', [
    "A master's in a big city: 2 years of post-study work rights",
  ]),
)
const sixYearsTime = (intakes: string) =>
  line(
    'costs',
    `About 6 years to permanent residency · ${intakes}`,
    claim(2, 'estimated', 'Home Affairs processing times', 'Aug 2026', [
      '491 is 3 years provisional, then 191',
    ]),
  )
const firstJobTime = (intakes: string) =>
  line(
    'gives',
    `A fast road to a first job · ${intakes}`,
    claim(3, 'estimated', 'Job-ad counts, Jul–Sep 2026', 'Sep 2026', [
      'A large graduate intake; many roles open to 485 holders',
    ]),
  )
const statePr = (text: string, source: string, rule: string) =>
  line('gives', text, claim(3, 'estimated', source, 'Aug 2026', [BAND, rule]))
const employerPr = line(
  'costs',
  'No regional points; depends on an employer',
  claim(2, 'out of date', 'Employer-sponsored visa data 2024–25', 'Jul 2025', [
    BAND,
    'After the 485, staying usually needs an employer to sponsor you',
  ]),
)
const noPr = (why: string) =>
  line(
    'costs',
    'No clear road to permanent residency',
    claim(1, 'estimated', 'Home Affairs skilled occupation lists', 'Sep 2026', [BAND, why]),
  )
/** A diploma's four lines: two years, short work rights, no nomination, entry-level roles. */
const diplomaLines = (provider: string, careerLine: LineData): Course['lines'] => ({
  time: line(
    'costs',
    'Two years of diploma, then a degree on top',
    claim(3, 'estimated', `${provider} course page`, 'Sep 2026', [
      'A 2-year diploma; the degree pathway adds about 2 more years',
    ]),
  ),
  work: line(
    'neutral',
    'A diploma alone earns short post-study work rights',
    claim(3, 'estimated', 'Home Affairs, subclass 485', 'Sep 2026', [
      'A diploma alone earns short post-study work rights; longer ones follow a degree',
    ]),
  ),
  pr: noPr('A diploma alone does not lead to nomination; the degree after it might'),
  career: careerLine,
})
const SA_PR = statePr(
  'Regional points, then a 491 to 191 path',
  'SA nomination pattern 2025–26',
  'South Australia nominates graduates of its own universities for the 491',
)
const VIC_REGIONAL_PR = statePr(
  'Regional points in Geelong, then a 491 to 191 path',
  'Victorian nomination pattern 2025–26',
  'Victoria nominates graduates who study and work in its regional cities',
)
const TAS_PR = statePr(
  'Tasmania nominates its own graduates for the 491, then a 191',
  'Tasmanian nomination guide',
  'Tasmania nominates graduates who studied and live in the state',
)

export const EXTRA_COURSES: readonly Course[] = [
  {
    id: 'curtin-infosys',
    name: 'Master of Information Systems',
    university: 'Curtin',
    campusId: 'curtin-bentley',
    field: 'it',
    level: "Master's",
    feeK: 32,
    years: 2,
    route: '190 state nomination, then PR',
    prScore: 3,
    careerScore: 3,
    placements: true,
    feeClaim: fee('Curtin', 32),
    lines: {
      time: waTime('February and July'),
      work: waWork,
      pr: waPr,
      career: perthCareer(
        'Steady demand for systems roles in WA',
        'Graduates in this field from Curtin: 79% in full-time work within four months · graduate outcomes survey 2025',
      ),
    },
    keepOpen: { text: 'Ask Curtin about the July intake now', doors: 'keeps 1 door open' },
  },
  {
    id: 'ecu-data',
    name: 'Master of Data Science',
    university: 'ECU',
    campusId: 'ecu-joondalup',
    field: 'data',
    level: "Master's",
    feeK: 34,
    years: 2,
    route: '190 state nomination, then PR',
    prScore: 3,
    careerScore: 3,
    placements: true,
    feeClaim: fee('ECU', 34),
    lines: {
      time: waTime('February and July'),
      work: waWork,
      pr: waPr,
      career: perthCareer(
        'Growing demand for data roles in WA',
        'Graduates in this field from ECU: 80% in full-time work within four months · graduate outcomes survey 2025',
      ),
    },
    keepOpen: { text: 'Apply to two intakes (Feb and Jul 2027)', doors: 'keeps 2 doors open' },
  },
  {
    id: 'utas-data',
    name: 'Master of Data Science',
    university: 'UTAS',
    campusId: 'utas-sandy-bay',
    field: 'data',
    level: "Master's",
    feeK: 29,
    years: 2,
    route: '491 regional visa, then PR',
    prScore: 3,
    careerScore: 1,
    placements: false,
    feeClaim: fee('UTAS', 29),
    lines: {
      time: line(
        'neutral',
        'About 5 years to permanent residency · a small July intake',
        claim(3, 'estimated', 'Tasmanian nomination guide', 'Jul 2026', [
          'Tasmania nominates graduates for the 491 after two years of study in the state',
        ]),
      ),
      work: line(
        'gives',
        'Regional study: up to 5 years of post-study work rights',
        claim(4, 'confirmed', 'Home Affairs, subclass 485', 'Sep 2026', [
          'Up to 5 years of post-study work rights for regional study',
        ]),
      ),
      pr: line(
        'gives',
        'Tasmania nominates its own graduates for the 491, then a 191',
        claim(3, 'estimated', 'Tasmanian nomination guide', 'Aug 2026', [
          "A band, not a number: we don't predict this for you",
          'Tasmania nominates graduates who studied and live in the state',
        ]),
      ),
      career: line(
        'costs',
        'A small data job market in Hobart',
        claim(1, 'estimated', 'Job-ad counts, Jul–Sep 2026', 'Sep 2026', [
          'Hobart IT job market: ~400 postings last quarter',
          'Graduates in this field from UTAS: 73% in full-time work within four months · graduate outcomes survey 2025',
        ]),
      ),
    },
    keepOpen: { text: 'Ask about the July intake', doors: 'keeps 1 door open' },
  },
  {
    id: 'unisa-nursing',
    name: 'Master of Nursing (graduate entry)',
    university: 'UniSA',
    campusId: 'unisa-city-west',
    field: 'health',
    level: "Master's",
    feeK: 31,
    years: 2,
    route: '491 regional visa, then PR',
    prScore: 3,
    careerScore: 3,
    placements: true,
    feeClaim: fee('UniSA', 31),
    lines: {
      time: sixYearsTime('a February and a July intake'),
      work: regionalWork,
      pr: SA_PR,
      career: market('gives', 'Steady demand for nurses in South Australia', 3, [
        'Adelaide health job market: ~2,900 postings last quarter, ~900 for nurses',
        graduates('UniSA', 88),
      ]),
    },
    keepOpen: {
      text: 'Ask UniSA when clinical placements are arranged',
      doors: 'keeps 1 door open',
    },
  },
  {
    id: 'utas-nursing',
    name: 'Master of Nursing (graduate entry)',
    university: 'UTAS',
    campusId: 'utas-sandy-bay',
    field: 'health',
    level: "Master's",
    feeK: 30,
    years: 2,
    route: '491 regional visa, then PR',
    prScore: 3,
    careerScore: 2,
    placements: true,
    feeClaim: fee('UTAS', 30),
    lines: {
      time: sixYearsTime('a small July intake'),
      work: regionalWork,
      pr: TAS_PR,
      career: market('gives', 'Hospitals in Tasmania hire nurses steadily, in a small market', 2, [
        'Hobart health job market: ~700 postings last quarter, ~250 for nurses',
        graduates('UTAS', 86),
      ]),
    },
    keepOpen: { text: 'Ask about the July intake', doors: 'keeps 1 door open' },
  },
  {
    id: 'monash-mph',
    name: 'Master of Public Health',
    university: 'Monash',
    campusId: 'monash-clayton',
    field: 'health',
    level: "Master's",
    feeK: 44,
    years: 2,
    route: '485, then employer sponsorship',
    prScore: 1,
    careerScore: 3,
    placements: true,
    feeClaim: fee('Monash', 44),
    lines: {
      time: firstJobTime('February and July intakes'),
      work: metroWork,
      pr: employerPr,
      career: market('gives', 'Government and community health teams hire in Melbourne', 3, [
        'Melbourne public health roles: ~380 postings last quarter',
        graduates('Monash', 79),
      ]),
    },
    keepOpen: { text: 'Apply before the 30 Nov round', doors: 'keeps 2 doors open' },
  },
  {
    id: 'uts-civil',
    name: 'Master of Engineering (civil)',
    university: 'UTS',
    campusId: 'uts-ultimo',
    field: 'engineering',
    level: "Master's",
    feeK: 46,
    years: 2,
    route: '485, then employer sponsorship',
    prScore: 1,
    careerScore: 4,
    placements: true,
    feeClaim: fee('UTS', 46),
    lines: {
      time: firstJobTime('February and July intakes'),
      work: metroWork,
      pr: employerPr,
      career: market('gives', 'A large civil and construction market in Sydney', 4, [
        'Sydney civil and construction roles: ~1,800 postings last quarter',
        graduates('UTS', 82),
      ]),
    },
    keepOpen: { text: 'Ask UTS whether you can defer a year', doors: 'keeps 1 door open' },
  },
  {
    id: 'deakin-civil',
    name: 'Master of Engineering (civil)',
    university: 'Deakin',
    campusId: 'deakin-waurn-ponds',
    field: 'engineering',
    level: "Master's",
    feeK: 37,
    years: 2,
    route: '491 regional visa, then PR',
    prScore: 3,
    careerScore: 2,
    placements: true,
    feeClaim: fee('Deakin', 37),
    lines: {
      time: sixYearsTime('intakes in March and July'),
      work: regionalWork,
      pr: VIC_REGIONAL_PR,
      career: market('costs', 'A smaller engineering market; Melbourne is an hour away', 2, [
        'Geelong engineering roles: ~110 postings last quarter, ~1,500 in Melbourne',
        graduates('Deakin', 78),
      ]),
    },
    keepOpen: { text: 'Apply to two intakes (Mar and Jul 2027)', doors: 'keeps 2 doors open' },
  },
  {
    id: 'swin-ux',
    name: 'Master of Interaction Design',
    university: 'Swinburne',
    campusId: 'swinburne-hawthorn',
    field: 'design',
    level: "Master's",
    feeK: 41,
    years: 2,
    route: '485, no clear road to PR',
    prScore: 0,
    careerScore: 3,
    placements: true,
    feeClaim: fee('Swinburne', 41),
    lines: {
      time: line(
        'costs',
        'Two years of study, then a 485 with no clear next step',
        claim(2, 'estimated', 'Home Affairs, subclass 485', 'Sep 2026', [
          "A 2-year master's, then 2 years of post-study work rights",
        ]),
      ),
      work: metroWork,
      pr: noPr('Design roles are not on the lists states nominate from'),
      career: market('gives', 'Product teams in Melbourne hire interaction designers', 3, [
        'Melbourne UX and product design roles: ~520 postings last quarter',
        graduates('Swinburne', 77),
      ]),
    },
    keepOpen: { text: 'Ask Swinburne about portfolio entry', doors: 'keeps 1 door open' },
  },
  {
    id: 'unisa-dip-it',
    name: 'Diploma of Information Technology',
    university: 'UniSA College',
    campusId: 'unisa-city-west',
    field: 'it',
    level: 'Diploma',
    feeK: 17,
    years: 2,
    route: 'Diploma, then a degree pathway',
    prScore: 0,
    careerScore: 2,
    placements: false,
    feeClaim: fee('UniSA College', 17),
    lines: diplomaLines(
      'UniSA College',
      market('costs', 'Entry-level IT support roles first; a degree opens more', 2, [
        'Adelaide IT support roles: ~500 postings last quarter',
        'Most developer roles in Adelaide ask for a degree',
      ]),
    ),
    keepOpen: { text: 'Ask about the pathway into a degree', doors: 'keeps 1 door open' },
  },
  {
    id: 'deakin-dip-business',
    name: 'Diploma of Business',
    university: 'Deakin College',
    campusId: 'deakin-waurn-ponds',
    field: 'business',
    level: 'Diploma',
    feeK: 18,
    years: 2,
    route: 'Diploma, then a degree pathway',
    prScore: 0,
    careerScore: 2,
    placements: true,
    feeClaim: fee('Deakin College', 18),
    lines: diplomaLines(
      'Deakin College',
      market('costs', 'Office and administration roles first; a degree opens more', 2, [
        'Geelong business support roles: ~320 postings last quarter',
        'Analyst roles in Geelong usually ask for a degree',
      ]),
    ),
    keepOpen: { text: 'Ask about credit towards a degree', doors: 'keeps 1 door open' },
  },
  {
    id: 'monash-dip-health',
    name: 'Diploma of Health Science',
    university: 'Monash College',
    campusId: 'monash-clayton',
    field: 'health',
    level: 'Diploma',
    feeK: 20,
    years: 2,
    route: 'Diploma, then a degree pathway',
    prScore: 0,
    careerScore: 2,
    placements: false,
    feeClaim: fee('Monash College', 20),
    lines: diplomaLines(
      'Monash College',
      market('costs', 'Support roles in health first; clinical roles ask for a degree', 2, [
        'Melbourne health support roles: ~700 postings last quarter',
        'Clinical roles in Melbourne ask for a degree',
      ]),
    ),
    keepOpen: { text: 'Ask about the pathway into a degree', doors: 'keeps 1 door open' },
  },
  {
    id: 'curtin-commerce',
    name: 'Master of Commerce',
    university: 'Curtin',
    campusId: 'curtin-bentley',
    field: 'business',
    level: "Master's",
    feeK: 33,
    years: 2,
    route: '190 state nomination, then PR',
    prScore: 3,
    careerScore: 3,
    placements: true,
    feeClaim: fee('Curtin', 33),
    lines: {
      time: waTime('February and July'),
      work: waWork,
      pr: line(
        'gives',
        'Western Australia nominates its own graduates',
        claim(4, 'estimated', 'WA skilled list 2025–26', 'Jul 2026', [
          BAND,
          'Western Australia nominates accounting and business graduates of its own universities (190)',
        ]),
      ),
      career: market('gives', 'Steady demand for finance and business roles in WA', 3, [
        'Perth business and finance roles: ~2,300 postings last quarter',
        graduates('Curtin', 80),
      ]),
    },
    keepOpen: { text: 'Ask Curtin about the July intake now', doors: 'keeps 1 door open' },
  },
  {
    id: 'monash-it',
    name: 'Master of Information Technology',
    university: 'Monash',
    campusId: 'monash-clayton',
    field: 'it',
    level: "Master's",
    feeK: 44,
    years: 2,
    route: '485, then employer sponsorship',
    prScore: 1,
    careerScore: 4,
    placements: false,
    feeClaim: fee('Monash', 44),
    lines: {
      time: firstJobTime('February and July intakes'),
      work: metroWork,
      pr: employerPr,
      career: market('gives', 'A large IT job market in Melbourne', 4, [
        'Melbourne IT job market: ~5,600 postings last quarter',
        graduates('Monash', 81),
      ]),
    },
    keepOpen: { text: 'Apply before the 30 Nov round', doors: 'keeps 2 doors open' },
  },
  {
    id: 'uts-bus-analytics',
    name: 'Master of Business Analytics',
    university: 'UTS',
    campusId: 'uts-ultimo',
    field: 'business',
    level: "Master's",
    feeK: 45,
    years: 2,
    route: '485, then employer sponsorship',
    prScore: 1,
    careerScore: 4,
    placements: true,
    feeClaim: fee('UTS', 45),
    lines: {
      time: firstJobTime('February and July intakes'),
      work: metroWork,
      pr: employerPr,
      career: market('gives', 'A large analytics and business job market in Sydney', 4, [
        'Sydney business analytics roles: ~2,400 postings last quarter',
        graduates('UTS', 81),
      ]),
    },
    keepOpen: { text: 'Ask UTS whether you can defer a year', doors: 'keeps 1 door open' },
  },
]

const EXTRA_BY_ID = new Map(EXTRA_COURSES.map((c) => [c.id, c]))

/** A course by id: the engine's first, then the roads' own. */
export function courseById(id: string): Course | undefined {
  return COURSES.find((c) => c.id === id) ?? EXTRA_BY_ID.get(id)
}
