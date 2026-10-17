import { describe, expect, it } from 'bun:test'
import type { Body } from '../model/artifacts'
import type { ClaimResult, Fact, FitCheck } from '../model/types'
import { templateById } from '../templates'
import {
  claimFitError,
  draftChoices,
  firstReady,
  fitFailures,
  themeOrDefault,
  versionLetter,
  versionStatus,
} from './version-status'

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
          where: 'Slide 1 · Heading',
          what: 'Too long',
          evidence: ['52 characters · limit 1–48'],
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
      {
        text: 'Slide 2 body is 3 words; the least is 15.',
        where: 'Slide 2 · Body',
        what: 'Too short',
        evidence: ['3 words · limit 15–25'],
      },
      {
        text: 'Slide 2 body needs 5 lines; it has room for 4.',
        where: 'Slide 2 · Body',
        what: 'Does not fit its box',
        evidence: ['Needs 5 lines · room for 4'],
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
        where: 'Slide 2 · Points',
        what: 'Too long',
        evidence: ['6 points · limit 3–5'],
        fix: { kind: 'nudge', nudge: 'shorter', slide: 2 },
      },
    ])
  })

  it('names a claim with no fact behind it, with a supported fact bound in its place as its fix', () => {
    const status = versionStatus(
      item({ text: 'Most students fail when they work.', factIds: [] }),
      [],
      [FACT],
    )
    expect(status).toEqual({
      ready: false,
      problems: [
        {
          text: 'Slide 2 body is not in the source: “Most students fail when they work.”',
          where: 'Slide 2 · Body',
          what: 'Not in the source',
          evidence: ['“Most students fail when they work.”'],
          fix: { kind: 'bind', slide: 2, slot: 'body' },
        },
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
      {
        text: `Slide 2 body was not found in the source: “${FACT.text}”`,
        where: 'Slide 2 · Body',
        what: 'Not found in the source',
        evidence: [`“${FACT.text}”`],
      },
    ])
  })

  it("offers the source's wording as the fix of a sentence not found, by its place in the check, when the check found one", () => {
    const claim: ClaimResult = {
      text: 'Pass rates fell a lot.',
      slide: 2,
      slot: 'body',
      result: 'not_found',
      ref: null,
      suggestion: { ref: '¶3', text: FACT.text },
    }
    const found: ClaimResult = {
      text: FACT.text,
      slide: 2,
      slot: 'body',
      result: 'found',
      ref: '¶3',
    }
    expect(versionStatus(READY, [], [FACT], [found, claim]).problems).toEqual([
      {
        text: 'Slide 2 body was not found in the source: “Pass rates fell a lot.”',
        where: 'Slide 2 · Body',
        what: 'Not found in the source',
        // The source's paragraph it should match, the evidence its fix puts in its place.
        evidence: ['“Pass rates fell a lot.”', `Source ¶3: ${FACT.text}`],
        fix: { kind: 'wording', claim: 1 },
      },
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
      {
        text: 'Text on Pop block is 3.1:1; it needs 4.5:1.',
        where: 'Colours · Pop block',
        what: 'Contrast too low',
        evidence: ['3.1:1 · needs 4.5:1'],
      },
      {
        text: 'The smallest text is 9.8px on a phone; it needs 11px at 328px.',
        where: 'Smallest text',
        what: 'Too small on a phone',
        evidence: ['9.8px · needs 11px at 328px'],
      },
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

describe('draftChoices: what is chosen for the editor when versions are drafted', () => {
  const LINE = templateById('the-line')
  if (!LINE) throw new Error('no the-line template')
  const line = { ...READY, template: LINE }
  const failing = { ...READY, problems: ['slides.0.slots.kicker: remove "best".'] }
  const none = { picked: null, themeId: null }

  it('picks version A and the brand’s first theme for templates, Pop for looks, when nothing was chosen', () => {
    expect(draftChoices(none, [line, line, line])).toEqual({ picked: 0, themeId: 'paper' })
    expect(draftChoices(none, [READY, READY, READY])).toEqual({ picked: 0, themeId: 'pop' })
  })

  it('keeps her pick and her colours while they still exist among the new versions', () => {
    expect(draftChoices({ picked: 2, themeId: 'ink' }, [line, line, line])).toEqual({
      picked: 2,
      themeId: 'ink',
    })
    expect(draftChoices({ picked: 1, themeId: 'subdued' }, [READY, READY])).toEqual({
      picked: 1,
      themeId: 'subdued',
    })
  })

  it('starts again from the defaults when her pick or her colours no longer fit the versions', () => {
    expect(draftChoices({ picked: 5, themeId: 'pop' }, [line, line, line])).toEqual({
      picked: 0,
      themeId: 'paper',
    })
    expect(draftChoices({ picked: 0, themeId: 'ink' }, [READY])).toEqual({
      picked: 0,
      themeId: 'pop',
    })
  })

  it('never picks a version the drafting left with problems: the first clean one, or none', () => {
    expect(draftChoices(none, [failing, READY, READY]).picked).toBe(1)
    expect(draftChoices({ picked: 0, themeId: null }, [failing, READY]).picked).toBe(1)
    expect(draftChoices(none, [failing, failing]).picked).toBeNull()
  })
})

describe('themeOrDefault: the colours of a post drafted before draftChoices, shown and approved', () => {
  const LINE = templateById('the-line')
  if (!LINE) throw new Error('no the-line template')
  const line = { ...READY, template: LINE }

  it('reads no theme as the default draftChoices gives: Pop for looks, the brand’s first theme for templates', () => {
    expect(themeOrDefault(null, [READY, READY])).toBe('pop')
    expect(themeOrDefault(null, [line])).toBe('paper')
  })

  it('keeps the theme she chose', () => {
    expect(themeOrDefault('subdued', [READY])).toBe('subdued')
    expect(themeOrDefault('ink', [line])).toBe('ink')
  })
})

describe('fitFailures: the failing fit rows, each named by its slide, slot and what is wrong', () => {
  it('names only the failing rows, as "Slide 2 · Body · Too short"', () => {
    const under = row({ slide: 2, slot: 'body', value: 3, limit: '15–25 words', pass: false })
    const box = row({
      check: 'box',
      slide: 2,
      slot: 'body',
      value: 5,
      limit: '4 lines',
      pass: false,
    })
    expect(fitFailures(READY, [row({}), under, box]).map((p) => `${p.where} · ${p.what}`)).toEqual([
      'Slide 2 · Body · Too short',
      'Slide 2 · Body · Does not fit its box',
    ])
  })
})

describe('claimFitError: a claim removed or reworded never leaves a slot failing that passed', () => {
  const body = (over: Partial<FitCheck>) =>
    row({ slide: 2, slot: 'body', value: 20, limit: '15–25 words', ...over })
  const passing = [row({}), body({})]

  it('refuses a removal that leaves a slot too short, naming it and the ways to fix it', () => {
    expect(
      claimFitError('remove', READY, passing, [row({}), body({ value: 9, pass: false })]),
    ).toBe(
      "Removing it would leave Slide 2 · Body too short. Use the source's wording, or edit it on Text.",
    )
  })

  it("refuses the source's wording when it leaves a slot too long or over its box", () => {
    expect(
      claimFitError('wording', READY, passing, [row({}), body({ value: 30, pass: false })]),
    ).toBe(
      "The source's wording would leave Slide 2 · Body too long. Remove the sentence, or edit it on Text.",
    )
    const box = row({
      check: 'box',
      slide: 2,
      slot: 'body',
      value: 5,
      limit: '4 lines',
      pass: false,
    })
    expect(claimFitError('wording', READY, passing, [...passing, box])).toBe(
      "The source's wording would leave Slide 2 · Body over its box. Remove the sentence, or edit it on Text.",
    )
  })

  it('lets a change through when every row still passes, or a row failed already before it', () => {
    expect(claimFitError('remove', READY, passing, passing)).toBeNull()
    const failing = [row({}), body({ value: 9, pass: false })]
    expect(claimFitError('remove', READY, failing, failing)).toBeNull()
  })
})
