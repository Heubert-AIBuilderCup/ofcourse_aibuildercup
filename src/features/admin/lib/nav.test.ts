import { describe, expect, it } from 'bun:test'
import { ADMIN_SECTIONS, activeSection, sectionsFor } from './nav'

describe('activeSection', () => {
  it('names the section a page belongs to', () => {
    expect(activeSection('/admin/users')).toBe('/admin/users')
    expect(activeSection('/admin/users/u1')).toBe('/admin/users')
    expect(activeSection('/admin/board')).toBe('/admin/board')
    expect(activeSection('/admin/comic-gaps')).toBe('/admin/comic-gaps')
    expect(activeSection('/admin/ideas')).toBe('/admin/ideas')
    expect(activeSection('/admin/updates')).toBe('/admin/updates')
    expect(activeSection('/admin/insights')).toBe('/admin/insights')
  })

  it('counts the post workbench as the Board', () => {
    expect(activeSection('/admin/posts/p1')).toBe('/admin/board')
    expect(activeSection('/admin/posts/new')).toBe('/admin/board')
  })

  it('does not take a lookalike path for a section', () => {
    expect(activeSection('/admin/usersx')).toBe(null)
    expect(activeSection('/admin/postsx')).toBe(null)
    expect(activeSection('/admin')).toBe(null)
  })

  it('lists every admin section once', () => {
    expect(ADMIN_SECTIONS.map((s) => s.label)).toEqual([
      'Board',
      'Comic gaps',
      'Updates',
      'Ideas',
      'Insights',
      'Users',
    ])
  })
})

describe('sectionsFor', () => {
  const labels = (viewer: Parameters<typeof sectionsFor>[0]) =>
    sectionsFor(viewer).map((s) => s.label)

  it('shows an editor or a reviewer the Board and Comic gaps', () => {
    expect(labels({ role: 'user', editor: true })).toEqual([
      'Board',
      'Comic gaps',
      'Updates',
      'Ideas',
      'Insights',
    ])
    expect(labels({ role: 'user', reviewer: true })).toEqual([
      'Board',
      'Comic gaps',
      'Updates',
      'Ideas',
      'Insights',
    ])
  })

  it('shows an admin the Board, Comic gaps and Users, with or without a capability', () => {
    expect(labels({ role: 'admin' })).toEqual([
      'Board',
      'Comic gaps',
      'Updates',
      'Ideas',
      'Insights',
      'Users',
    ])
    expect(labels({ role: 'admin', editor: true })).toEqual([
      'Board',
      'Comic gaps',
      'Updates',
      'Ideas',
      'Insights',
      'Users',
    ])
    expect(labels({ role: 'superadmin' })).toEqual([
      'Board',
      'Comic gaps',
      'Updates',
      'Ideas',
      'Insights',
      'Users',
    ])
  })

  it('shows a plain user nothing', () => {
    expect(labels({ role: 'user' })).toEqual([])
  })
})
