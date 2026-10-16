import { describe, expect, it } from 'bun:test'
import { CITIES, PLACES } from '@/features/engine'
import { englishScores } from '@/features/roads'
import type { QuestionKey, Relative, StoredAnswer, StoredAnswers } from '@/shared/types/student'
import { impactLine as lineOf, notSureLine, personLine, impactView as viewOf } from './impact'
import {
  DEFAULTS,
  HIDDEN_QUESTIONS,
  NOT_SURE,
  parseAnswer,
  type Question,
  SCREENS,
} from './questions'

/** The catalogue's English scores, as the onboarding page hands them to the screen. */
const SCORES = englishScores()
const impactLine = (itemId: string, answers: StoredAnswers, relative: Relative | null) =>
  lineOf(itemId, answers, relative, SCORES)
const impactView = (itemId: string, answers: StoredAnswers, relative: Relative | null) =>
  viewOf(itemId, answers, relative, SCORES)

const s = (value: StoredAnswer['value']): StoredAnswer => ({ value, state: 'stated' })
/** What tapping "Not sure" stores: the default, marked assumed. */
const notSure = (key: QuestionKey): StoredAnswer => {
  const value = DEFAULTS[key]
  if (value === undefined) throw new Error(`${key} has no default`)
  return { value, state: 'assumed' }
}

const anjali: Relative = {
  placeId: 'cannington',
  place: 'Cannington',
  relationship: 'Cousin',
  name: 'Anjali',
}

describe('notSureLine', () => {
  it('says what is assumed and that it shows as a chip she can change', () => {
    expect(notSureLine('amount')).toBe(
      "Not sure: I'll assume “AUD 30k” and show it as a chip you can change.",
    )
    expect(notSureLine('where')).toBe(
      "Not sure: I'll assume “Nepal” and show it as a chip you can change.",
    )
    expect(notSureLine('earn')).toBe(
      "Not sure: I'll assume “Helpful” and show it as a chip you can change.",
    )
  })

  it('says "any field" for the field, not the stored "Any"', () => {
    expect(notSureLine('field')).toBe(
      "Not sure: I'll assume “any field” and show it as a chip you can change.",
    )
  })
})

describe('impactLine: nothing answered', () => {
  it('is null for every item', () => {
    for (const screen of SCREENS) {
      for (const item of screen.items) expect(impactLine(item.id, {}, null)).toBeNull()
    }
  })

  it('is null for an id that is not an item', () => {
    expect(impactLine('nonsense', { where: s('Nepal') }, null)).toBeNull()
  })

  it('is null when only a part of the item with no line of its own is answered', () => {
    expect(impactLine('budget', { covers: s('Fees only') }, null)).not.toBeNull()
    expect(impactLine('budget', {}, null)).toBeNull()
    expect(impactLine('timing', {}, null)).toBeNull()
  })
})

describe('impactLine: every item', () => {
  it('has a line once a valid answer is given to each of its questions', () => {
    for (const screen of SCREENS) {
      for (const item of screen.items) {
        const answers: StoredAnswers = {}
        for (const question of item.questions) {
          const first = question.options[0]
          answers[question.key] = s(question.control === 'multi' ? [String(first)] : first)
        }
        const line = impactLine(item.id, answers, null)
        expect(line, item.id).toBeString()
        expect(line?.length, item.id).toBeGreaterThan(0)
      }
    }
  })

  it('says Not sure with the question’s own assumption, wherever Not sure is offered', () => {
    // field and knows only show after the question that opens them.
    const opens: Partial<Record<QuestionKey, StoredAnswers>> = {
      field: { know: s('Something particular') },
      knows: { community: s('Yes') },
    }
    let offered = 0
    for (const screen of SCREENS) {
      for (const item of screen.items) {
        // A hidden question is never asked, so its Not sure is never said (16 Oct 2026).
        for (const question of item.questions.filter(
          (x) => x.notSure && !HIDDEN_QUESTIONS.has(x.key),
        )) {
          offered++
          const answers = { ...opens[question.key], [question.key]: notSure(question.key) }
          expect(impactLine(item.id, answers, null), question.key).toBe(notSureLine(question.key))
        }
      }
    }
    expect(offered).toBeGreaterThan(15)
  })

  it('never says an empty assumption', () => {
    for (const screen of SCREENS) {
      for (const question of screen.items.flatMap((item) => item.questions)) {
        if (question.notSure) expect(notSureLine(question.key), question.key).not.toContain('“”')
      }
    }
  })
})

describe('where', () => {
  it('differs for a student already in Australia, which she may apply from onshore (criterion 24)', () => {
    const onshore = impactLine('where', { where: s('Australia (on a visa)') }, null)
    const nepal = impactLine('where', { where: s('Nepal') }, null)
    expect(onshore).not.toBe(nepal)
    expect(onshore).toContain('onshore')
    expect(onshore).toBe(
      "In Australia: you may apply onshore · your current visa's conditions still apply",
    )
  })

  it('names the country for an offshore one', () => {
    expect(impactLine('where', { where: s('Nepal') }, null)).toBe(
      'Nepal: visa required · study fees apply',
    )
    expect(impactLine('where', { where: s('India') }, null)).toBe(
      'India: visa required · study fees apply',
    )
  })

  it('promises no visa check when she says another country', () => {
    expect(impactLine('where', { where: s('Another country') }, null)).toBe(
      'Another country: visa required · study fees apply',
    )
  })
})

describe('budget', () => {
  it('asks whether the amount is a hard limit while only the amount is known', () => {
    expect(impactLine('budget', { amount: s(36) }, null)).toBe(
      "About AUD 36k a year. Tell me if it's a hard limit.",
    )
  })

  it('says what a hard limit really does: a course over it is marked over budget, nothing closes', () => {
    expect(impactLine('budget', { amount: s(24), hard: s('Hard limit') }, null)).toBe(
      'Hard limit at 24k: a course on your road that costs more is marked over budget.',
    )
    expect(impactLine('budget', { amount: s(42), hard: s('Hard limit') }, null)).toBe(
      'Hard limit at 42k: a course on your road that costs more is marked over budget.',
    )
  })

  it('says a rough budget is marked as rough, and keeps nothing open or closed', () => {
    expect(impactLine('budget', { amount: s(24), hard: s('Roughly') }, null)).toBe(
      'Roughly 24k: a course on your road that costs more is marked over a rough budget.',
    )
    expect(impactLine('budget', { amount: s(50), hard: s('Roughly') }, null)).toBe(
      'Roughly 50k: a course on your road that costs more is marked over a rough budget.',
    )
  })

  it('asks for the amount when it is unanswered and covers or who is stated', () => {
    const ask = 'Add an amount, and your road marks a course that costs more.'
    expect(impactLine('budget', { covers: s('Fees only') }, null)).toBe(ask)
    expect(impactLine('budget', { covers: s('Fees and living') }, null)).toBe(ask)
    expect(impactLine('budget', { who: s('Loan') }, null)).toBe(ask)
    expect(impactLine('budget', { covers: s('Fees only'), who: s('Family') }, null)).toBe(ask)
  })

  it('keeps the limit line when the limit is stated and the amount is not', () => {
    // the default amount stands in for it; this line already existed
    expect(impactLine('budget', { hard: s('Hard limit') }, null)).toStartWith('Hard limit at 30k:')
  })

  it('keeps the existing lines once the amount is answered', () => {
    expect(impactLine('budget', { amount: s(36), covers: s('Fees only') }, null)).toBe(
      "About AUD 36k a year. Tell me if it's a hard limit.",
    )
    expect(impactLine('budget', { amount: s(30), who: s('Loan'), hard: s('Roughly') }, null)).toBe(
      'Roughly 30k: a course on your road that costs more is marked over a rough budget.',
    )
  })

  it('still says Not sure first when the amount is unanswered', () => {
    expect(impactLine('budget', { covers: notSure('covers') }, null)).toBe(notSureLine('covers'))
    expect(impactLine('budget', { who: s('Loan'), hard: notSure('hard') }, null)).toBe(
      notSureLine('hard'),
    )
  })

  it('assumes the default amount when only the limit is known', () => {
    expect(impactLine('budget', { hard: s('Roughly') }, null)).toBe(
      'Roughly 30k: a course on your road that costs more is marked over a rough budget.',
    )
  })

  it('says the amount is assumed when she is not sure of it', () => {
    const line = impactLine('budget', { amount: notSure('amount') }, null)
    expect(line).toBe(notSureLine('amount'))
    expect(line).toBe("Not sure: I'll assume “AUD 30k” and show it as a chip you can change.")
  })

  it('says the limit is assumed when she is not sure of it, even after an amount', () => {
    expect(impactLine('budget', { amount: s(36), hard: notSure('hard') }, null)).toBe(
      notSureLine('hard'),
    )
  })

  it('says so when any question of the item is Not sure, the first one winning', () => {
    expect(
      impactLine(
        'budget',
        { amount: s(36), covers: notSure('covers'), hard: notSure('hard') },
        null,
      ),
    ).toBe(notSureLine('covers'))
  })
})

describe('timing', () => {
  it('counts the intakes open up to the latest start', () => {
    expect(impactLine('timing', { latest: s('Feb 2027') }, null)).toBe(
      'Latest Feb 2027: 3 intakes open · mock',
    )
    expect(impactLine('timing', { latest: s('Jul 2027') }, null)).toBe(
      'Latest Jul 2027: 5 intakes open · mock',
    )
    expect(impactLine('timing', { latest: s('Feb 2028') }, null)).toBe(
      'Latest Feb 2028: 7 intakes open · mock',
    )
  })

  it('names the most years she would give, promising no course length', () => {
    expect(impactLine('timing', { latest: s('Jul 2027'), years: s('2') }, null)).toBe(
      'Latest Jul 2027, up to 2 years: 5 intakes open · mock',
    )
    expect(impactLine('timing', { latest: s('Jul 2027'), years: s('4 or more') }, null)).toBe(
      'Latest Jul 2027, 4 or more years: 5 intakes open · mock',
    )
  })
})

describe('timing: latest unanswered', () => {
  it('names the earliest start and asks for the latest', () => {
    expect(impactLine('timing', { earliest: s('Feb 2027') }, null)).toBe(
      "From Feb 2027. Tell me the latest you'd accept.",
    )
    expect(impactLine('timing', { earliest: s('Jul 2027') }, null)).toBe(
      "From Jul 2027. Tell me the latest you'd accept.",
    )
    expect(impactLine('timing', { earliest: s('Later') }, null)).toBe(
      "Later is fine. Tell me the latest you'd accept.",
    )
  })

  it('notes the most years she would give, and asks for the latest, promising no course length', () => {
    expect(impactLine('timing', { years: s('2') }, null)).toBe(
      "Up to 2 years. Tell me the latest you'd accept.",
    )
    expect(impactLine('timing', { years: s('4 or more') }, null)).toBe(
      "4 or more years. Tell me the latest you'd accept.",
    )
  })

  it('names the earliest start and the most years when both are answered', () => {
    expect(impactLine('timing', { earliest: s('Feb 2027'), years: s('2') }, null)).toBe(
      "From Feb 2027, up to 2 years. Tell me the latest you'd accept.",
    )
    expect(impactLine('timing', { earliest: s('Feb 2027'), years: s('4 or more') }, null)).toBe(
      "From Feb 2027, 4 or more years. Tell me the latest you'd accept.",
    )
    expect(impactLine('timing', { earliest: s('Later'), years: s('3') }, null)).toBe(
      "Later is fine, up to 3 years. Tell me the latest you'd accept.",
    )
  })

  it('keeps the existing lines once the latest is answered', () => {
    expect(impactLine('timing', { earliest: s('Feb 2027'), latest: s('Jul 2027') }, null)).toBe(
      'Latest Jul 2027: 5 intakes open · mock',
    )
    expect(impactLine('timing', { years: s('2'), latest: s('Jul 2027') }, null)).toBe(
      'Latest Jul 2027, up to 2 years: 5 intakes open · mock',
    )
  })

  it('still says Not sure first', () => {
    expect(impactLine('timing', { earliest: notSure('earliest') }, null)).toBe(
      notSureLine('earliest'),
    )
    expect(impactLine('timing', { years: s('2'), earliest: notSure('earliest') }, null)).toBe(
      notSureLine('earliest'),
    )
  })
})

describe('dep', () => {
  it('says costs are for her alone when no one comes', () => {
    expect(impactLine('dep', { dep: s('No one') }, null)).toBe(
      'Just you: single living costs on every route.',
    )
  })

  it('says family is not covered yet for a partner, or a partner and children (criterion 27)', () => {
    const family =
      "Family isn't covered in this preview yet, so every route shows costs for you alone."
    expect(impactLine('dep', { dep: s('Partner') }, null)).toBe(family)
    expect(impactLine('dep', { dep: s('Partner and children') }, null)).toBe(family)
  })
})

describe('quals', () => {
  it('says how many courses her IELTS meets, from each course’s own entry score (criterion 62)', () => {
    // Six courses ask for 7.0 (UTS cyber, data and business analytics, Swinburne, both Nursing),
    // five for 6.0 (the four Diplomas and ECU's Bachelor), the rest 6.5.
    for (const eng of ['IELTS 7.0', 'IELTS 7.5 or more', 'IELTS 7.5']) {
      expect(impactLine('quals', { eng: s(eng) }, null)).toBe(
        `${eng}: meets the English score of every course in this preview · mock`,
      )
    }
    expect(impactLine('quals', { eng: s('IELTS 6.5') }, null)).toBe(
      'IELTS 6.5: meets the English score of 23 of the 29 courses in this preview · mock',
    )
    expect(impactLine('quals', { eng: s('IELTS 6.0') }, null)).toBe(
      'IELTS 6.0: meets the English score of 5 of the 29 courses in this preview · mock',
    )
    expect(impactLine('quals', { eng: s('IELTS 5.5') }, null)).toBe(
      'IELTS 5.5: below the English score of every course in this preview · mock',
    )
  })

  it('reads PTE and TOEFL through their mock IELTS equivalent', () => {
    expect(impactLine('quals', { eng: s('PTE 58') }, null)).toBe(
      'PTE 58: about IELTS 6.5, which meets the English score of 23 of the 29 courses in this preview · mock',
    )
    expect(impactLine('quals', { eng: s('TOEFL 85') }, null)).toBe(
      'TOEFL 85: about IELTS 6.5, which meets the English score of 23 of the 29 courses in this preview · mock',
    )
    expect(impactLine('quals', { eng: s('TOEFL 40') }, null)).toBe(
      'TOEFL 40: about IELTS 5.0, which is below the English score of every course in this preview · mock',
    )
  })

  it('says her road shows the English condition as not met until she sits the test', () => {
    expect(impactLine('quals', { eng: s('Not taken yet') }, null)).toBe(
      'Not taken yet: your road shows its English condition as not met until you sit it.',
    )
  })

  it('notes the qualification alone for entry requirements', () => {
    expect(impactLine('quals', { qual: s("Bachelor's") }, null)).toBe(
      "Bachelor's: noted for entry requirements.",
    )
  })

  it('speaks of the English test first when both are answered', () => {
    expect(impactLine('quals', { qual: s("Bachelor's"), eng: s('IELTS 6.0') }, null)).toBe(
      'IELTS 6.0: meets the English score of 5 of the 29 courses in this preview · mock',
    )
  })
})

describe('know', () => {
  it('starts wide for "Suggest me"', () => {
    expect(impactLine('know', { know: s('Suggest me') }, null)).toBe(
      "Suggest me: we'll start wide, with futures from every field in this preview.",
    )
  })

  it('uses the field she names', () => {
    expect(
      impactLine('know', { know: s('Something particular'), field: s('Cyber security') }, null),
    ).toBe(
      'Particular: your futures use Cyber security courses; you can change the field on each one.',
    )
  })

  it('asks for the field until she picks one', () => {
    expect(impactLine('know', { know: s('Something particular') }, null)).toBe(
      'Particular: pick the field.',
    )
  })

  it('says her road is matched to a course in one of the areas, never side by side', () => {
    expect(
      impactLine(
        'know',
        { know: s("A few areas I'm drawn to"), areas: s(['Data', 'Business']) },
        null,
      ),
    ).toBe('Data · Business: your road is matched to a course in one of them.')
    expect(
      impactLine(
        'know',
        { know: s("A few areas I'm drawn to"), areas: s(['IT and computing', 'Data', 'Design']) },
        null,
      ),
    ).toBe('IT and computing · Data · Design: your road is matched to a course in one of them.')
  })

  it('asks for the areas until she picks some', () => {
    expect(impactLine('know', { know: s("A few areas I'm drawn to") }, null)).toBe(
      'Pick up to three areas.',
    )
  })

  it('ignores an answer to a question that is no longer shown', () => {
    // she switched from "Something particular" to "Suggest me"; her old Not sure on the field stays stored
    const line = impactLine('know', { know: s('Suggest me'), field: notSure('field') }, null)
    expect(line).toStartWith('Suggest me:')
  })
})

describe('choices with one line each', () => {
  const cases: [string, QuestionKey, string, string][] = [
    [
      'level',
      'level',
      'Diploma',
      "Diploma: 1–2 years; some give credit towards a bachelor's · mock",
    ],
    ['level', 'level', "Bachelor's", "Bachelor's: 3 years; a second degree at your level · mock"],
    [
      'level',
      'level',
      "Master's",
      "Master's: 18 months to 2 years, building on your degree · mock",
    ],
    [
      'learn',
      'learn',
      'Hands-on with placements',
      'Placements: noted; it shapes what each future is drawn around.',
    ],
    [
      'learn',
      'learn',
      'Mostly classroom and research',
      "Classroom and research: noted; it doesn't change your futures in this preview.",
    ],
    [
      'learn',
      'learn',
      'No preference',
      "No preference: placements shown, but they don't move anything.",
    ],
    [
      'length',
      'length',
      'As short as possible',
      'Short: noted; it shapes what each future is drawn around. 18-month courses can lose the 2-year work-rights bonus · mock',
    ],
    [
      'length',
      'length',
      'Fine with longer if it opens more',
      'Longer is fine: 2-year courses keep full post-study work rights · mock',
    ],
    ['place', 'place', 'City', "City: noted; it doesn't change your road in this preview."],
    ['place', 'place', 'Suburban', "Suburban: noted; it doesn't change your road in this preview."],
    [
      'place',
      'place',
      'Regional',
      'Regional: your road leans to a regional city, Perth or Adelaide.',
    ],
    [
      'focus',
      'focus',
      'Career-focused',
      'Career-focused: your road can lean to Sydney, for its job market.',
    ],
    ['focus', 'focus', 'Academic', "Academic: noted; it doesn't change your road in this preview."],
    [
      'earn',
      'earn',
      'Yes',
      'Yes: your futures weigh work heavily; part-time rules shown on every route.',
    ],
    ['earn', 'earn', 'Helpful', 'Helpful: part-time rules shown on every route.'],
    ['earn', 'earn', 'No', 'No: your futures weigh work lightly.'],
  ]
  for (const [id, key, choice, expected] of cases) {
    it(`${key}: ${choice}`, () => {
      expect(impactLine(id, { [key]: s(choice) }, null)).toBe(expected)
    })
  }
})

describe('dest', () => {
  it('counts the cities in the preview for Australia', () => {
    expect(impactLine('dest', { dest: s('Australia') }, null)).toBe(
      `Australia: ${CITIES.length} cities in this preview · mock`,
    )
  })

  it('says only Australia is covered when she is open to others (criterion 28)', () => {
    expect(impactLine('dest', { dest: s('Open to others') }, null)).toBe(
      'Only Australia is covered in this preview, so your futures will be Australian.',
    )
  })
})

describe('community', () => {
  it('says what each answer does: it opens "Do you know anyone…", nothing more', () => {
    expect(impactLine('community', { community: s('Yes') }, null)).toBe(
      'Yes: next, I’ll ask whether you know anyone in Australia.',
    )
    expect(impactLine('community', { community: s('A little') }, null)).toBe(
      'A little: next, I’ll ask whether you know anyone in Australia.',
    )
    expect(impactLine('community', { community: s('No') }, null)).toBe(
      "No: noted; it won't change your futures.",
    )
  })

  it('is the community choice alone, whoever she knows', () => {
    const knows = { community: s('Yes'), knows: s('Yes') }
    expect(impactLine('community', knows, anjali)).toBe(
      'Yes: next, I’ll ask whether you know anyone in Australia.',
    )
  })
})

describe('knows', () => {
  const yes = { community: s('Yes'), knows: s('Yes') }
  const ask = 'Yes: next, tell me who and where, and your road can lean to their city.'

  it('notes a No as changing nothing', () => {
    expect(impactLine('knows', { community: s('Yes'), knows: s('No') }, null)).toBe(
      "No: noted; it won't change your futures.",
    )
  })

  it('asks who and where after a Yes, until her person has a place', () => {
    expect(impactLine('knows', yes, null)).toBe(ask)
    const noPlace: Relative = { placeId: null, place: null, relationship: 'Cousin', name: null }
    expect(impactLine('knows', yes, noPlace)).toBe(ask)
  })

  it('is her person line once her person has a place of either kind', () => {
    expect(impactLine('knows', yes, anjali)).toBe(personLine(anjali))
    const blank: Relative = { placeId: null, place: '', relationship: 'Friend', name: null }
    expect(impactLine('knows', yes, blank)).toBe(personLine(blank))
  })

  it('says so when she is not sure whether she knows someone', () => {
    expect(impactLine('knows', { community: s('Yes'), knows: notSure('knows') }, anjali)).toBe(
      notSureLine('knows'),
    )
    expect(notSureLine('knows')).toBe(
      "Not sure: I'll assume “No” and show it as a chip you can change.",
    )
  })
})

describe('personLine', () => {
  const person = (more: Partial<Relative>): Relative => ({
    placeId: null,
    place: null,
    relationship: null,
    name: null,
    ...more,
  })

  it('is nothing without a person', () => {
    expect(personLine(null)).toBeNull()
  })

  it('names the two nearest campuses in her city with the minutes to each (criterion 10)', () => {
    // Perth has three campuses; ECU Joondalup, about 75 min out, is the one left off.
    expect(personLine(anjali)).toBe(
      'Anjali in Cannington, Perth: Curtin Bentley is about 20 min away, TAFE Perth about 30 min · estimate. Your road can lean to Perth.',
    )
  })

  it('measures from the place to every campus of the city, so each place has a line', () => {
    for (const place of PLACES) {
      const relative: Relative = { ...anjali, placeId: place.id, place: place.name }
      expect(personLine(relative), place.id).toMatch(/^Anjali in .+: .+ is about \d+ min away/)
    }
  })

  it('names the one campus of a city that has only one', () => {
    const maya = person({
      placeId: 'sandy-bay',
      place: 'Sandy Bay',
      relationship: 'Friend',
      name: 'Maya',
    })
    expect(personLine(maya)).toBe(
      'Maya in Sandy Bay, Hobart: UTAS Sandy Bay is about 10 min away · estimate. Your road can lean to Hobart.',
    )
  })

  it('does not name the city twice when the place is the city', () => {
    const hobart: Relative = { ...anjali, placeId: 'hobart', place: 'Hobart', name: 'Maya' }
    expect(personLine(hobart)).toStartWith('Maya in Hobart: UTAS Sandy Bay')
    const cbd: Relative = { ...anjali, placeId: 'perth-cbd', place: 'Perth CBD', name: 'Maya' }
    expect(personLine(cbd)).toStartWith('Maya in Perth CBD: ')
  })

  it('calls her contact by relationship, else the person you know', () => {
    const at = { placeId: 'cannington', place: 'Cannington' }
    const cases: [Relative['relationship'], string][] = [
      ['Cousin', 'your cousin'],
      ['Sibling', 'your sibling'],
      ['Aunt or uncle', 'your aunt or uncle'],
      ['Friend', 'your friend'],
      ['Other', 'the person you know'],
      [null, 'the person you know'],
    ]
    for (const [relationship, who] of cases) {
      const line = personLine(person({ ...at, relationship }))
      expect(line, who).toStartWith(
        `${who.charAt(0).toUpperCase()}${who.slice(1)} in Cannington, Perth: `,
      )
      expect(line, who).toEndWith(' · estimate. Your road can lean to Perth.')
    }
  })

  it('promises nothing for "Somewhere else": the place is not in the preview (criterion 10)', () => {
    expect(personLine(person({ place: 'Darwin', relationship: 'Cousin', name: 'Anjali' }))).toBe(
      "Anjali in Darwin: that place isn't in this preview, so your road doesn't change.",
    )
    expect(personLine(person({ place: '', relationship: 'Sibling' }))).toBe(
      "Your sibling: that place isn't in this preview, so your road doesn't change.",
    )
    expect(personLine(person({ place: '' }))).toBe(
      "The person you know: that place isn't in this preview, so your road doesn't change.",
    )
  })

  it('treats a place that has left the catalogue as somewhere else', () => {
    const gone: Relative = { ...anjali, placeId: 'no-such-place', place: 'Atlantis' }
    expect(personLine(gone)).toBe(
      "Anjali in Atlantis: that place isn't in this preview, so your road doesn't change.",
    )
  })

  it('asks for a city or suburb while there is no place', () => {
    expect(personLine(person({ relationship: 'Cousin' }))).toBe(
      'Pick a city or suburb for your cousin, and your road can lean to it.',
    )
    expect(personLine(person({ name: 'Anjali' }))).toBe(
      'Pick a city or suburb for Anjali, and your road can lean to it.',
    )
    expect(personLine(person({}))).toBe(
      'Pick a city or suburb for the person you know, and your road can lean to it.',
    )
  })
})

describe('climate', () => {
  it('is noted but changes nothing in this preview', () => {
    expect(impactLine('climate', { climate: s('Mild') }, null)).toBe(
      "Mild: noted; climate doesn't change your futures in this preview.",
    )
    expect(impactLine('climate', { climate: s('No preference') }, null)).toBe(
      "No preference: noted; climate doesn't change your futures in this preview.",
    )
  })

  it('does not promise that any city rises', () => {
    for (const choice of ['Mild', 'Warm', 'No preference']) {
      expect(impactLine('climate', { climate: s(choice) }, null)).not.toMatch(/\brise\b/)
    }
  })
})

describe('stay', () => {
  it('says whether her road stays or goes home, sealing nothing', () => {
    expect(impactLine('stay', { stay: s('Yes') }, null)).toBe(
      'Yes: your road stays in Australia after you graduate.',
    )
    expect(impactLine('stay', { stay: s('No') }, null)).toBe(
      'No: your road goes home after you graduate.',
    )
  })

  it('says Not sure is a real answer here: her road stays, for now', () => {
    expect(impactLine('stay', { stay: s('Not sure') }, null)).toBe(
      'Not sure: your road stays in Australia, for now.',
    )
  })
})

describe('settle', () => {
  it('is noted as shaping what she sees later', () => {
    expect(impactLine('settle', { settle: s('Settle long-term') }, null)).toBe(
      'Settle long-term: noted; it shapes what we show you later.',
    )
    expect(impactLine('settle', { settle: s('Come home eventually') }, null)).toBe(
      'Come home eventually: noted; it shapes what we show you later.',
    )
  })
})

// ── Every line she can see ──────────────────────────────────────────────────────────────────

/** Every answer a question can store: each option, "Not sure" where offered, and unanswered. */
function storedOf(question: Question): (StoredAnswer | undefined)[] {
  const raws: unknown[] =
    question.control === 'multi'
      ? [...question.options.map((o) => [o]), question.options.slice(0, 3)]
      : [...question.options, ...(question.notSure ? [NOT_SURE] : [])]
  return [undefined, ...raws.map((raw) => parseAnswer(question.key, raw) ?? undefined)]
}

const unmeasured: Relative = {
  placeId: null,
  place: 'Darwin',
  relationship: 'Friend',
  name: null,
}

/** A person with every part blank but the place still to pick. */
const placeless: Relative = { placeId: null, place: null, relationship: 'Other', name: null }

/** Every item with every combination of its answers, and every kind of relative. */
const CASES: { itemId: string; answers: StoredAnswers; relative: Relative | null }[] =
  SCREENS.flatMap((screen) =>
    screen.items.flatMap((item) => {
      let combos: StoredAnswers[] = [{}]
      for (const question of item.questions) {
        combos = combos.flatMap((answers) =>
          storedOf(question).map((stored) =>
            stored ? { ...answers, [question.key]: stored } : answers,
          ),
        )
      }
      return combos.flatMap((answers) =>
        [null, anjali, unmeasured, placeless].map((relative) => ({
          itemId: item.id,
          answers,
          relative,
        })),
      )
    }),
  )

/**
 * The line with her own answers to the item taken out (an unanswered one counts as its default,
 * which is what she sees assumed): what is left is the preview's to say. A figure goes only where
 * it stands alone, so her "3" never hides a "3 intakes".
 */
function withoutHerAnswers(line: string, itemId: string, answers: StoredAnswers): string {
  const item = SCREENS.flatMap((screen) => screen.items).find((x) => x.id === itemId)
  const own = (item?.questions ?? [])
    .flatMap(({ key }) => [answers[key]?.value ?? DEFAULTS[key]].flat())
    .filter((value) => value !== undefined)
    .map(String)
    .sort((a, b) => b.length - a.length)
  const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return own.reduce(
    (rest, value) =>
      rest.replace(new RegExp(`(?<![\\d.])${literal(value)}(?!\\d|\\.\\d)`, 'g'), ''),
    line,
  )
}

describe('impactLine: every line she can see', () => {
  it('covers every item', () => {
    expect(new Set(CASES.map((c) => c.itemId)).size).toBe(
      SCREENS.flatMap((screen) => screen.items).length,
    )
  })

  it('labels every figure that is not her own answer as mock or an estimate (criterion 3)', () => {
    for (const { itemId, answers, relative } of CASES) {
      const line = impactLine(itemId, answers, relative)
      if (line === null || !/\d/.test(withoutHerAnswers(line, itemId, answers))) continue
      expect(line, JSON.stringify(answers)).toMatch(/mock|estimate|Source:/)
    }
  })

  it('promises nothing this preview does not do: nothing rises, leads, ranks or sorts', () => {
    const promises =
      /\b(rise|rises|lead|leads|rank|sort)\b|profile|type or pick|offered later|community size/
    for (const { itemId, answers, relative } of CASES) {
      const line = impactLine(itemId, answers, relative) ?? ''
      expect(line, JSON.stringify(answers)).not.toMatch(promises)
      // Nothing seals a route, closes a city or keeps one open: no line says so.
      expect(line, JSON.stringify(answers)).not.toMatch(/\bseals?\b|stays? open|closes/)
    }
  })
})

describe('impactView', () => {
  it('is the line as plain text, with no chips', () => {
    expect(impactView('budget', { amount: s(36) }, null)).toEqual({
      text: "About AUD 36k a year. Tell me if it's a hard limit.",
      kind: 'plain',
      tag: null,
      chips: [],
    })
  })

  it('is an assume line for a Not sure', () => {
    expect(impactView('budget', { amount: notSure('amount') }, null)).toEqual({
      text: "Not sure: I'll assume “AUD 30k” and show it as a chip you can change.",
      kind: 'assume',
      tag: null,
      chips: [],
    })
  })

  it('offers the other Not sure answers of the item as chips, in the item order', () => {
    const view = impactView(
      'budget',
      { amount: notSure('amount'), covers: notSure('covers') },
      null,
    )
    expect(view?.kind).toBe('assume')
    expect(view?.text).toBe(notSureLine('amount'))
    expect(view?.chips).toEqual(['Fees only'])
  })

  it('stays quiet about a Not sure stored for a hidden question (16 Oct 2026)', () => {
    const view = impactView('budget', { amount: s(36), who: notSure('who') }, null)
    expect(view?.text).toBe("About AUD 36k a year. Tell me if it's a hard limit.")
    expect(view?.kind).toBe('plain')
    const assumed = impactView('budget', { amount: notSure('amount'), who: notSure('who') }, null)
    expect(assumed?.chips).toEqual([])
  })

  it('has no chips for a Not sure on a question she is no longer shown', () => {
    const view = impactView('know', { know: s('Suggest me'), field: notSure('field') }, null)
    expect(view?.kind).toBe('plain')
    expect(view?.chips).toEqual([])
  })

  it('limits for a partner, or a partner and children, and not for no one (criterion 27)', () => {
    const text =
      "Family isn't covered in this preview yet, so every route shows costs for you alone."
    for (const dep of ['Partner', 'Partner and children']) {
      expect(impactView('dep', { dep: s(dep) }, null)).toEqual({
        text,
        kind: 'limit',
        tag: null,
        chips: [],
      })
    }
    expect(impactView('dep', { dep: s('No one') }, null)?.kind).toBe('plain')
  })

  it('limits for "Open to others", and not for Australia', () => {
    expect(impactView('dest', { dest: s('Open to others') }, null)).toEqual({
      text: 'Only Australia is covered in this preview, so your futures will be Australian.',
      kind: 'limit',
      tag: null,
      chips: [],
    })
    expect(impactView('dest', { dest: s('Australia') }, null)?.kind).toBe('plain')
  })

  it('takes the mock tag apart, with nothing after it (criterion 3)', () => {
    expect(impactView('level', { level: s("Master's") }, null)).toEqual({
      text: "Master's: 18 months to 2 years, building on your degree",
      kind: 'plain',
      tag: { text: 'mock', after: '' },
      chips: [],
    })
  })

  it('takes the estimate tag apart, with the sentence after it', () => {
    expect(impactView('knows', { community: s('Yes'), knows: s('Yes') }, anjali)).toEqual({
      text: 'Anjali in Cannington, Perth: Curtin Bentley is about 20 min away, TAFE Perth about 30 min',
      kind: 'plain',
      tag: { text: 'estimate', after: '. Your road can lean to Perth.' },
      chips: [],
    })
  })

  it('gives the person screen her person line', () => {
    const cousin: Relative = { placeId: null, place: null, relationship: 'Cousin', name: null }
    expect(impactView('person', {}, cousin)).toEqual({
      text: 'Pick a city or suburb for your cousin, and your road can lean to it.',
      kind: 'plain',
      tag: null,
      chips: [],
    })
    expect(impactView('person', {}, anjali)?.tag).toEqual({
      text: 'estimate',
      after: '. Your road can lean to Perth.',
    })
    expect(impactView('person', {}, null)).toBeNull()
  })

  it('finds no tag in a place she typed, whatever it says', () => {
    const typed: Relative = {
      placeId: null,
      place: 'Darwin · estimate',
      relationship: 'Cousin',
      name: null,
    }
    const line =
      "Your cousin in Darwin · estimate: that place isn't in this preview, so your road doesn't change."
    expect(impactView('person', {}, typed)).toEqual({
      text: line,
      kind: 'plain',
      tag: null,
      chips: [],
    })
    const answers = { community: s('Yes'), knows: s('Yes') }
    expect(impactView('knows', answers, typed)?.tag).toBeNull()
  })

  it('is null when there is no line', () => {
    expect(impactView('where', {}, null)).toBeNull()
    expect(impactView('nope', {}, null)).toBeNull()
  })

  it('never changes a line: the text plus the tag is the line', () => {
    for (const { itemId, answers, relative } of CASES) {
      const view = impactView(itemId, answers, relative)
      const line = impactLine(itemId, answers, relative)
      const tag = view?.tag ? ` · ${view.tag.text}${view.tag.after}` : ''
      expect(view === null ? null : view.text + tag, itemId).toBe(line)
    }
  })
})
