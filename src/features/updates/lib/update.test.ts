import { describe, expect, it } from 'bun:test'
import { MOCK_STUDENTS, MOCK_UPDATES } from '..'
import { ALL_INSTITUTIONS, INSTITUTIONS } from './audience'
import {
  DEMO_DRAFT,
  feedWords,
  overlineOf,
  parseUpdateInput,
  previewWords,
  UPDATE_ERRORS,
  type UpdateInput,
  updateStatusLine,
} from './update'

describe('parseUpdateInput', () => {
  it('keeps a complete update, trimmed, with no apply-by date as none', () => {
    const res = parseUpdateInput({ ...DEMO_DRAFT, title: '  ECU scholarship  ', applyBy: '' })
    expect(res).toEqual({
      ok: true,
      value: { ...DEMO_DRAFT, title: 'ECU scholarship', applyBy: null },
    })
  })

  it('refuses each missing or unknown field by name', () => {
    expect(parseUpdateInput({ ...DEMO_DRAFT, title: ' ' })).toEqual({
      ok: false,
      error: UPDATE_ERRORS.title,
    })
    expect(parseUpdateInput({ ...DEMO_DRAFT, institution: 'Hogwarts' })).toEqual({
      ok: false,
      error: UPDATE_ERRORS.institution,
    })
    expect(
      parseUpdateInput({ ...DEMO_DRAFT, audience: { institution: 'Nowhere', homeCountry: null } }),
    ).toEqual({ ok: false, error: UPDATE_ERRORS.audience })
    expect(parseUpdateInput({ ...DEMO_DRAFT, applyBy: '30 Nov' })).toEqual({
      ok: false,
      error: UPDATE_ERRORS.date,
    })
    expect(parseUpdateInput({ ...DEMO_DRAFT, kind: 'gossip' })).toEqual({
      ok: false,
      error: UPDATE_ERRORS.kind,
    })
    expect(parseUpdateInput('nonsense')).toEqual({ ok: false, error: UPDATE_ERRORS.kind })
  })
})

describe('updateStatusLine', () => {
  it("says an update's status in one word with its reach", () => {
    expect(updateStatusLine('draft', 7)).toBe('Draft · reaches 7 students (mock)')
    expect(updateStatusLine('in_review', 1)).toBe('In review · reaches 1 student (mock)')
    expect(updateStatusLine('live', 1920)).toBe('Live · 1,920 students (mock)')
  })
})

describe('parseUpdateInput: all institutions', () => {
  it('keeps an update for all institutions, from everywhere or one home country', () => {
    const all = {
      ...DEMO_DRAFT,
      institution: ALL_INSTITUTIONS,
      audience: { institution: ALL_INSTITUTIONS, homeCountry: 'Nepal' },
    }
    expect(parseUpdateInput(all)).toEqual({ ok: true, value: all })
  })
})

describe('previewWords', () => {
  it('frames the preview for the admin: the student by name, matched, and why she sees it', () => {
    const [priya] = MOCK_STUDENTS
    expect(previewWords({ student: priya, why: 'Because you ranked ECU Cyber Security' })).toEqual({
      heading: `Student preview · ${priya.name} (mock student)`,
      badge: 'Matched student',
      why: `Why ${priya.name} sees this: Because you ranked ECU Cyber Security`,
    })
  })
})

describe('the sample updates', () => {
  const group = (u: UpdateInput) => (u.kind === 'rule_change' ? 'Rule change' : u.category)

  it('has at least two of each kind of news, every one labelled mock and dated', () => {
    for (const name of ['Rule change', 'Scholarship', 'New program', 'Government grant']) {
      expect(MOCK_UPDATES.filter((u) => group(u) === name).length).toBeGreaterThanOrEqual(2)
    }
    for (const u of MOCK_UPDATES) {
      expect(u.title).toContain('(mock)')
      expect(u.body).toContain('mock')
      expect(u.sourceTitle).toContain('mock')
      expect(u.status).not.toBe('')
    }
  })

  it('each one fills the form: it parses as an update', () => {
    for (const { id: _id, status: _status, ...fields } of MOCK_UPDATES) {
      expect(parseUpdateInput(fields)).toEqual({ ok: true, value: fields })
    }
  })

  it('aims rule changes at all institutions, and scholarships at one in the catalogue', () => {
    for (const u of MOCK_UPDATES.filter((u) => u.kind === 'rule_change')) {
      expect(u.audience.institution).toBe(ALL_INSTITUTIONS)
    }
    for (const u of MOCK_UPDATES.filter((u) => u.category === 'Scholarship')) {
      expect(INSTITUTIONS).toContain(u.audience.institution)
    }
  })

  it('reads a new program as an opportunity, and a rule change as an impact', () => {
    const program = MOCK_UPDATES.find((u) => u.category === 'New program')
    const rule = MOCK_UPDATES.find((u) => u.kind === 'rule_change')
    if (!program || !rule) throw new Error('samples missing')
    expect(overlineOf(program)).toBe('Opportunity · New program')
    expect(overlineOf(rule)).toBe('Impact · Rule change')
  })
})

describe('feedWords', () => {
  it('frames the card for the student herself: for you, and why you are seeing it', () => {
    expect(feedWords('Because ECU is on your roadmap "Cyber Security in Perth"')).toEqual({
      badge: 'For you',
      why: `Why you're seeing this: Because ECU is on your roadmap "Cyber Security in Perth"`,
    })
  })
})
