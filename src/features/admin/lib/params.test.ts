import { describe, expect, it } from 'bun:test'
import { containsPattern, pageCount, parseUsersParams } from './params'

describe('parseUsersParams', () => {
  it('gives everyone on page 0 for an empty address', () => {
    expect(parseUsersParams({})).toEqual({
      q: '',
      role: 'all',
      status: 'all',
      online: false,
      page: 0,
    })
  })

  it('reads every filter it knows', () => {
    expect(
      parseUsersParams({
        q: 'asha',
        role: 'admin',
        status: 'suspended',
        online: '1',
        page: '3',
      }),
    ).toEqual({
      q: 'asha',
      role: 'admin',
      status: 'suspended',
      online: true,
      page: 3,
    })
  })

  it('falls back to all for an unknown role or status filter', () => {
    const p = parseUsersParams({ role: 'root', status: 'banned' })
    expect([p.role, p.status]).toEqual(['all', 'all'])
  })

  it('reads online as on only for 1', () => {
    expect(parseUsersParams({ online: '1' }).online).toBe(true)
    expect(parseUsersParams({ online: 'true' }).online).toBe(false)
  })

  it('trims the search and caps it at 100 characters', () => {
    expect(parseUsersParams({ q: '  asha  ' }).q).toBe('asha')
    expect(parseUsersParams({ q: ` ${'x'.repeat(500)}` }).q).toHaveLength(100)
  })

  it('reads a negative or unreadable page as 0, and the first of repeated values', () => {
    expect(parseUsersParams({ page: '-2' }).page).toBe(0)
    expect(parseUsersParams({ page: 'abc' }).page).toBe(0)
    expect(parseUsersParams({ role: ['user', 'admin'] }).role).toBe('user')
  })
})

describe('pageCount', () => {
  it('is at least one page', () => {
    expect(pageCount(0, 25)).toBe(1)
    expect(pageCount(25, 25)).toBe(1)
    expect(pageCount(26, 25)).toBe(2)
  })
})

describe('containsPattern', () => {
  it('wraps the search for ilike and escapes its wildcards', () => {
    expect(containsPattern('asha')).toBe('%asha%')
    expect(containsPattern('50%_off\\')).toBe('%50\\%\\_off\\\\%')
  })
})
