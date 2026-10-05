import { describe, expect, it } from 'bun:test'
import { ADMIN_SECTIONS, activeSection } from './nav'

describe('activeSection', () => {
  it('names the section a page belongs to', () => {
    expect(activeSection('/admin/users')).toBe('/admin/users')
    expect(activeSection('/admin/users/u1')).toBe('/admin/users')
  })

  it('does not take a lookalike path for a section', () => {
    expect(activeSection('/admin/usersx')).toBe(null)
    expect(activeSection('/admin')).toBe(null)
  })

  it('lists every admin section once', () => {
    expect(ADMIN_SECTIONS.map((s) => s.label)).toEqual(['Users'])
  })
})
