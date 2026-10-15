import { describe, expect, it } from 'bun:test'
import { PAGE_BRANDS } from '../brands'
import { tagsIn } from '../tags'
import { PAGE_RULES, pageBrandFor } from './index'

// The theme-to-page rule file (criterion 88, ADR-124): which page brand the Adapt step pre-selects
// for a post's theme. Data in the repo, never a model's choice; a theme it does not name
// pre-selects nothing.

describe('pageBrandFor', () => {
  it('names the page brand for each theme the rule file has', () => {
    expect(pageBrandFor('theme:work-study-life')).toBe('main')
    expect(pageBrandFor('theme:books-movies')).toBe('cerebral')
  })

  it('pre-selects nothing for no theme, or a theme the file does not name', () => {
    expect(pageBrandFor(null)).toBeNull()
    expect(pageBrandFor('theme:nope')).toBeNull()
    expect(pageBrandFor('destination:AU')).toBeNull()
  })

  it('maps only theme tags the tag file has to page brands the brand files have', () => {
    const themes = tagsIn('theme').map((t) => t.id)
    const pages = PAGE_BRANDS.map((b) => b.id)
    for (const [theme, page] of Object.entries(PAGE_RULES)) {
      expect(themes).toContain(theme)
      expect(pages).toContain(page)
    }
  })
})
