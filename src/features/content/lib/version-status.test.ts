import { describe, expect, it } from 'bun:test'
import type { Body } from '../model/artifacts'
import type { ClaimResult, Fact, FitCheck } from '../model/types'
import { templateById } from '../templates'
import { firstReady, versionLetter, versionStatus } from './version-status'

const FIELD_NOTES = templateById('field-notes')
if (!FIELD_NOTES) throw new Error('no field-notes template')

const FACT: Fact = {
  id: 'f1',
  text: 'Above 20 hours a week, pass rates fell by 11 percentage points.',
  value: { number: 11, unit: 'points' },
  ref: '¶3',
  quote: 'Above 20 hours a week, pass rates fell by 11 percentage points.',
  supported: true,
  why: null,
  span: null,
}

const plain = (text: string) => ({ text, factIds: [], factual: false })
const bound = (text: string, factIds: string[]) => ({ text, factIds, factual: true })

const item = (body: { text: string; factIds: string[] }): Body<'drafts'>['items'][number] => ({
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
        slots: { heading: plain('Past 20, grades slip'), body: bound(body.text, body.factIds) },
      },
    ],
  },
})

const READY = item({ text: FACT.text, factIds: ['f1'] })

const row = (over: Partial<FitCheck>): FitCheck => ({
  check: 'length',
  slide: 1,
  slot: 'heading',
  value: 10,
  limit: '1–48 chars',
  pass: true,
  label: 'Slide 1 · 10 chars (1–48) · OK',
  ...over,
})

describe('versionStatus', () => {
  it('reads a version with every check passing and every claim bound as ready, with nothing to fix', () => {
    expect(versionStatus(READY, [row({})], [FACT])).toEqual({ ready: true, problems: [] })
  })

  it('names a slot over its length in a sentence, with the shorter chip on that slide as its fix', () => {
    const over = row({
      value: 52,
      pass: false,
      label: 'Slide 1 · 52 chars (1–48) · Over',
    })
    expect(versionStatus(READY, [over], [FACT])).toEqual({
      ready: false,
      problems: [
        {
          text: 'Slide 1 heading is 52 characters; the most is 48.',
          fix: { kind: 'nudge', nudge: 'shorter', slide: 1 },
        },
      ],
    })
  })

  it('names a slot under its length, and one that overflows its box, the overflow with the shorter fix', () => {
    const under = row({
      slide: 2,
      slot: 'body',
      value: 3,
      limit: '15–25 words',
      pass: false,
      label: 'Slide 2 · 3 words (15–25) · Under',
    })
    const box = row({
      check: 'box',
      slide: 2,
      slot: 'body',
      value: 5,
      limit: '4 lines',
      pass: false,
      label: 'Slide 2 · body · needs 5 lines, room for 4 · Over',
    })
    expect(versionStatus(READY, [under, box], [FACT]).problems).toEqual([
      { text: 'Slide 2 body is 3 words; the least is 15.' },
      {
        text: 'Slide 2 body needs 5 lines; it has room for 4.',
        fix: { kind: 'nudge', nudge: 'shorter', slide: 2 },
      },
    ])
  })

  it('names a bullets slide with too many points in points, with the shorter fix (GD34)', () => {
    const base = item({ text: FACT.text, factIds: ['f1'] })
    const listed = {
      ...base,
      structure: {
        ...base.structure,
        slides: [
          base.structure.slides[0],
          {
            kind: 'body' as const,
            layout: 'bullets' as const,
            slots: { heading: plain('Before a shift'), points: bound('A\nB\nC\nD\nE\nF', ['f1']) },
          },
        ],
      },
    }
    const over = row({
      slide: 2,
      slot: 'points',
      value: 6,
      limit: '3–5 points',
      pass: false,
      label: 'Slide 2 · 6 points (3–5) · Over',
    })
    expect(versionStatus(listed, [over], [FACT]).problems).toEqual([
      {
        text: 'Slide 2 points is 6 points; the most is 5.',
        fix: { kind: 'nudge', nudge: 'shorter', slide: 2 },
      },
    ])
  })

  it('names a claim with no fact behind it', () => {
    const status = versionStatus(
      item({ text: 'Most students fail when they work.', factIds: [] }),
      [],
      [FACT],
    )
    expect(status).toEqual({
      ready: false,
      problems: [
        { text: 'Slide 2 body is not in the source: “Most students fail when they work.”' },
      ],
    })
  })

  it('names a sentence the source check could not find', () => {
    const claim: ClaimResult = {
      text: FACT.text,
      slide: 2,
      slot: 'body',
      result: 'not_found',
      ref: null,
    }
    const found: ClaimResult = { ...claim, result: 'found', ref: '¶3' }
    expect(versionStatus(READY, [], [FACT], [claim, found]).problems).toEqual([
      { text: `Slide 2 body was not found in the source: “${FACT.text}”` },
    ])
  })

  it('names the contrast and legibility rows that fail, and keeps the problems the drafting left', () => {
    const contrast = row({
      check: 'contrast',
      slide: null,
      slot: null,
      value: 3.1,
      limit: '4.5:1',
      pass: false,
      label: 'Contrast · Pop block 3.1:1 · Too low',
    })
    const legibility = row({
      check: 'legibility',
      slide: null,
      slot: null,
      value: 9.8,
      limit: '11px at 328px',
      pass: false,
      label: 'Legibility · 9.8px at 328px · Too small',
    })
    const left = { ...READY, problems: ['slides.0.slots.kicker: remove "best".'] }
    expect(versionStatus(left, [contrast, legibility], [FACT]).problems).toEqual([
      { text: 'Text on Pop block is 3.1:1; it needs 4.5:1.' },
      { text: 'The smallest text is 9.8px on a phone; it needs 11px at 328px.' },
      { text: 'slides.0.slots.kicker: remove "best".' },
    ])
  })
})

describe('versionLetter', () => {
  it('names versions A, B, C by their position, as the cards and the history notes do', () => {
    expect([0, 1, 2, 5].map(versionLetter)).toEqual(['A', 'B', 'C', 'F'])
  })
})

describe('firstReady', () => {
  const ready = { ready: true, problems: [] }
  const failing = {
    ready: false,
    problems: [{ text: 'Slide 2 body is 121 words; the most is 70.' }],
  }

  it('picks the first Ready version, passing a failing one before it (GD29)', () => {
    expect(firstReady([failing, ready, ready])).toBe(1)
    expect(firstReady([ready, failing])).toBe(0)
  })

  it('picks none when no version is Ready', () => {
    expect(firstReady([failing, failing])).toBeNull()
    expect(firstReady([])).toBeNull()
  })
})
