import { describe, expect, it } from 'bun:test'
import { DEMO_DRAFT, parseUpdateInput, UPDATE_ERRORS, updateStatusLine } from './update'

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
