import { describe, expect, it } from 'bun:test'
import { cn } from './utils'

describe('cn', () => {
  it('keeps a design-system size role beside a text colour', () => {
    expect(cn('text-overline uppercase text-panel-accent')).toBe(
      'text-overline uppercase text-panel-accent',
    )
    expect(cn('m-0 text-lead text-panel-foreground/80')).toContain('text-lead')
    expect(cn('text-caption text-muted-foreground')).toContain('text-caption')
  })

  it('still lets a later size role win over an earlier one', () => {
    expect(cn('text-sm text-micro')).toBe('text-micro')
    expect(cn('text-display text-h2')).toBe('text-h2')
  })

  it('merges the spacing roles with the fixed scale', () => {
    expect(cn('p-5 p-stack')).toBe('p-stack')
    expect(cn('gap-stack gap-5')).toBe('gap-5')
  })
})
