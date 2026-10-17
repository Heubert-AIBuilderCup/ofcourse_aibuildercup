import { describe, expect, it } from 'bun:test'
import type { ClaimResult, FitCheck } from '../../../model/types'
import { templateById } from '../../../templates'
import { NATIVE_IDS, nativeOf } from '../../../text/native-fixtures'
import { claimSummary, countOf, fitTable, type Item } from './shared'

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

// The Checks tab's fit table and source check line (17 Oct): grouped and summed, never a list.

const FIELD_NOTES = templateById('field-notes')
if (!FIELD_NOTES) throw new Error('no field-notes template')
const plain = (text: string) => ({ text, factIds: [], factual: false })
const ITEM: Item = {
  template: FIELD_NOTES,
  angle: 'Where the line is',
  problems: [],
  structure: {
    templateId: 'field-notes',
    artPrompt: 'A quiet desk at dusk.',
    slides: [
      {
        kind: 'cover',
        layout: 'cover',
        slots: { kicker: plain('Paid work'), heading: plain('The 20-hour line') },
      },
      {
        kind: 'body',
        layout: 'picture',
        slots: { heading: plain('Past 20, grades slip'), body: plain('Pass rates fell.') },
      },
    ],
  },
}

const length = (slide: number, slot: string, value: number, limit: string, verdict: string) => {
  const [range, unit] = limit.split(' ')
  return {
    check: 'length',
    slide,
    slot,
    value,
    limit,
    pass: verdict === 'OK',
    label: `Slide ${slide} · ${value} ${unit} (${range}) · ${verdict}`,
  } satisfies FitCheck
}

describe('fitTable', () => {
  it('groups the rows by slide, in slide order, each as slot · length · limit · status, the slot by its label', () => {
    const box: FitCheck = {
      check: 'box',
      slide: 1,
      slot: 'heading',
      value: 5,
      limit: '4 lines',
      pass: false,
      label: 'Slide 1 · heading · needs 5 lines, room for 4 · Over',
    }
    const groups = fitTable(ITEM, [
      length(1, 'kicker', 9, '1–24 chars', 'OK'),
      length(2, 'body', 30, '15–25 words', 'Over'),
      length(1, 'heading', 16, '1–40 chars', 'OK'),
      box,
    ])
    expect(groups).toEqual([
      {
        title: 'Slide 1',
        rows: [
          { slot: 'Kicker', length: '9 chars', limit: '1–24 chars', status: 'OK', pass: true },
          { slot: 'Heading', length: '16 chars', limit: '1–40 chars', status: 'OK', pass: true },
          { slot: 'Heading', length: '5 lines', limit: '4 lines', status: 'Over', pass: false },
        ],
      },
      {
        title: 'Slide 2',
        rows: [
          { slot: 'Body', length: '30 words', limit: '15–25 words', status: 'Over', pass: false },
        ],
      },
    ])
  })

  it('puts the contrast and legibility rows, which belong to no slide, last as the whole post', () => {
    const contrast: FitCheck = {
      check: 'contrast',
      slide: null,
      slot: null,
      value: 3.1,
      limit: '4.5:1',
      pass: false,
      label: 'Contrast · Pop block 3.1:1 · Too low',
    }
    const legibility: FitCheck = {
      check: 'legibility',
      slide: null,
      slot: null,
      value: 12.4,
      limit: '11px at 328px',
      pass: true,
      label: 'Legibility · 12.4px at 328px · OK',
    }
    const groups = fitTable(ITEM, [
      contrast,
      length(2, 'body', 20, '15–25 words', 'OK'),
      legibility,
    ])
    expect(groups.map((g) => g.title)).toEqual(['Slide 2', 'Whole post'])
    expect(groups[1].rows).toEqual([
      {
        slot: 'Contrast · Pop block',
        length: '3.1:1',
        limit: '4.5:1',
        status: 'Too low',
        pass: false,
      },
      { slot: 'Smallest text', length: '12.4px', limit: '11px at 328px', status: 'OK', pass: true },
    ])
  })
})

describe('claimSummary', () => {
  it('counts the sentences found, not found and kept as opinion, each named even at none', () => {
    const claim = (result: ClaimResult['result']): ClaimResult => ({
      text: 'A sentence.',
      slide: 2,
      slot: 'body',
      result,
      ref: null,
    })
    expect(claimSummary([claim('found'), claim('not_found'), claim('found')])).toBe(
      '2 found · 1 not found · 0 opinion',
    )
    expect(claimSummary([claim('opinion')])).toBe('0 found · 0 not found · 1 opinion')
  })
})
