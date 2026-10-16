import { describe, expect, it } from 'bun:test'
import { NATIVE_IDS, nativeOf } from '../../../text/native-fixtures'
import { countOf } from './shared'

// A slot's length as the text fields show it, counted the way its limit counts.

describe('countOf', () => {
  it('counts a points slot by its non-empty lines, one point each (GD34)', () => {
    const limit = { unit: 'points' as const, min: 3, max: 5 }
    expect(
      countOf('Check your visa hours\nAsk about exam weeks\n\nKeep one free day', limit),
    ).toEqual({ text: '3 of 3–5 points', over: false })
    expect(countOf('A\nB\nC\nD\nE\nF', limit)).toEqual({ text: '6 of 3–5 points', over: true })
  })

  it('counts a Thai words slot by its words, not its spaces (GD37)', () => {
    const limit = { unit: 'words' as const, min: 1, max: 5 }
    expect(countOf('นักศึกษาทำงานไม่เกิน 20 ชั่วโมงต่อสัปดาห์', limit)).toEqual({
      text: '8 of 1–5 words',
      over: true,
    })
  })

  it('counts a Nepali, Hindi or Thai characters slot as a reader sees them (GD37)', () => {
    const limit = { unit: 'chars' as const, min: 1, max: 40 }
    for (const id of NATIVE_IDS) {
      expect(countOf(nativeOf(id, 40), limit), id).toEqual({
        text: '40 of 1–40 characters',
        over: false,
      })
    }
  })
})
