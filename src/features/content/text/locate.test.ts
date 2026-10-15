import { describe, expect, it } from 'bun:test'
import type { Paragraph } from '../model/types'
import { PAID_WORK_PARAGRAPHS, TWIN_PARAGRAPHS } from './fixtures'
import { bestParagraph, contentWords, numberVerdict } from './locate'

const paidWork = PAID_WORK_PARAGRAPHS
const twin3 = TWIN_PARAGRAPHS[2]

describe('contentWords', () => {
  it('keeps lower-case words over three letters, minus stop words', () => {
    expect([...contentWords('The Rates fell, and they were with 20 hours')].sort()).toEqual([
      'fell',
      'hours',
      'rates',
    ])
  })
})

describe('bestParagraph', () => {
  it('finds the paragraph the claim rests on', () => {
    const best = bestParagraph('Past 20 hours a week, pass rates drop 11 points', paidWork)
    expect(best.paragraph.ref).toBe('¶3')
    expect(best.overlap).toBeGreaterThan(0.5)
  })

  it('takes the earlier paragraph on a tie', () => {
    const tied: Paragraph[] = [
      { ref: '¶1', text: 'rates fell' },
      { ref: '¶2', text: 'rates fell' },
    ]
    expect(bestParagraph('rates fell', tied).paragraph.ref).toBe('¶1')
  })

  it('gives overlap 0 when nothing is shared', () => {
    expect(bestParagraph('zebra crossing', paidWork).overlap).toBe(0)
  })
})

describe('numberVerdict', () => {
  it('rejects a digit the paragraph lacks, naming the nearest number and its place', () => {
    const verdict = numberVerdict('pass rates drop 11 points', twin3)
    expect(verdict.ok).toBe(false)
    if (verdict.ok) return
    expect(verdict.why).toBe('The paragraph gives 9, not 11.')
    expect(verdict.span.ref).toBe('¶3')
    expect(twin3.text.slice(verdict.span.start, verdict.span.end)).toBe('9')
  })

  it('accepts a claim whose numbers the paragraph has', () => {
    expect(numberVerdict('pass rates fell by 11 percentage points', paidWork[2])).toEqual({
      ok: true,
    })
  })

  it('says the paragraph gives no such number, over the whole paragraph, when no number has that unit', () => {
    const para: Paragraph = { ref: '¶4', text: 'Pay was AUD 20 an hour.' }
    const verdict = numberVerdict('rates fell 11 percent', para)
    expect(verdict.ok).toBe(false)
    if (verdict.ok) return
    expect(verdict.why).toBe('The paragraph does not give 11.')
    expect(verdict.span).toEqual({ ref: '¶4', start: 0, end: para.text.length })
  })

  it('does not reject a number the claim writes as a word', () => {
    expect(numberVerdict('seven universities', { ref: '¶1', text: 'Nothing here.' })).toEqual({
      ok: true,
    })
  })
})
