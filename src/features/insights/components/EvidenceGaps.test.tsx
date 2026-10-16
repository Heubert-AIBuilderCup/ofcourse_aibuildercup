/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { ideaPostHref } from '@/features/content/lib/idea-start'
import { rankEvidenceGaps } from '../lib/overview'
import { EvidenceGaps } from './EvidenceGaps'

afterEach(cleanup)

const GAPS = rankEvidenceGaps([
  {
    claim: 'A smaller IT job market than Perth',
    shown: 'Trade-off card · Adelaide vs Perth',
    evidence: { state: 'none' },
    students: 1284,
  },
  {
    claim: 'Regional rent about 30% lower',
    shown: 'Future card · built around cost',
    evidence: { state: 'weak', note: 'one 2024 listings sample' },
    students: 962,
  },
])

describe('EvidenceGaps', () => {
  it('offers an editor "Research this", opening New post started from the claim', () => {
    render(<EvidenceGaps gaps={GAPS} editable />)
    const links = screen.getAllByRole('link', { name: 'Research this' })
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute(
      'href',
      ideaPostHref({ text: 'A smaller IT job market than Perth' }),
    )
  })

  it('shows a reviewer the gaps without "Research this"', () => {
    render(<EvidenceGaps gaps={GAPS} editable={false} />)
    expect(screen.getByText('“A smaller IT job market than Perth”')).toBeInTheDocument()
    expect(screen.queryAllByRole('link', { name: 'Research this' }).length).toBe(0)
  })
})
