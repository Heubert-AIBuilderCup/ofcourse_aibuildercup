// The one layout of a market version (Nepal's NPR in these fixtures, any market alike): reworded
// slots and converted figures laid out and checked by the same engine as the default version.

import { describe, expect, it } from 'bun:test'
import { FEED_BRAND } from '../brands'
import { conversionsFor } from '../lib/market'
import { type Market, marketById } from '../markets'
import type { Body } from '../model/artifacts'
import type { Fact, Structure, Template } from '../model/types'
import { templateById } from '../templates'
import { layoutMarket } from './market'

const theLine = templateById('the-line') as Template

// The takeaway box is cut to one line at the legibility floor, 380 wide: it holds "Pay AUD 499." but
// not the same words with " (≈ NPR 43,900)" after the figure.
const narrow = {
  ...theLine,
  slides: theLine.slides.map((slide) =>
    slide.spec.kind === 'take'
      ? {
          ...slide,
          spec: {
            ...slide.spec,
            slots: slide.spec.slots.map((slot) =>
              slot.key === 'takeaway' ? { ...slot, box: { ...slot.box, w: 380, h: 50 } } : slot,
            ),
          },
        }
      : slide,
  ),
} as Template

const FACT: Fact = {
  id: 'f1',
  text: 'The course costs AUD 499.',
  value: { number: 499, unit: 'aud' },
  ref: '¶1',
  quote: null,
  supported: true,
  why: null,
  span: null,
}

const plain = (text: string, factIds: string[] = []) => ({ text, factIds, factual: false })
const structure: Structure = {
  templateId: 'the-line',
  artPrompt: 'A desk.',
  slides: [
    {
      kind: 'cover',
      slots: { kicker: plain('Research'), phrase: plain('The line'), byline: plain('OfCourse') },
    },
    { kind: 'take', slots: { takeaway: plain('Pay AUD 499.', ['f1']) } },
  ],
}

function revision(template: Template): Body<'revision'> {
  return {
    factsId: 'facts1',
    structure,
    template,
    brand: FEED_BRAND,
    themeId: 'paper',
    by: { userId: 'u1', name: 'Editor', at: '2026-10-05T00:00:00.000Z' },
    note: 'approved',
  } as Body<'revision'>
}

const NEPAL = marketById('NP') as Market
const converted = conversionsFor(structure, [FACT], NEPAL)
if (!converted.ok) throw new Error(converted.error)

const laid = (template: Template, slots: { slide: number; slot: string; text: string }[] = []) =>
  layoutMarket({
    revision: revision(template),
    slots,
    conversions: converted.conversions,
    facts: [FACT],
    sourceTitle: 'A source',
  })

describe('layoutMarket', () => {
  it('lays out the original wording with the NPR figure beside the AUD one', () => {
    const { slides, fitChecks } = laid(theLine)
    const take = slides[1].lines.filter((l) => l.slot === 'takeaway')
    expect(take.map((l) => l.text).join(' ')).toBe('Pay AUD 499 (≈ NPR 43,900).')
    expect(fitChecks.every((c) => c.pass)).toBe(true)
  })

  it('lays out a reworded slot in place of the original', () => {
    const { slides } = laid(theLine, [{ slide: 1, slot: 'kicker', text: 'With your family' }])
    expect(slides[0].lines.filter((l) => l.slot === 'kicker').map((l) => l.text)).toEqual([
      'With your family',
    ])
  })

  it('gives a failing box row when a conversion pushes a slot over its box', () => {
    // Without the conversion the slot fits.
    const plainLayout = layoutMarket({
      revision: revision(narrow),
      slots: [],
      conversions: [],
      facts: [FACT],
      sourceTitle: 'A source',
    })
    expect(plainLayout.fitChecks.filter((c) => c.check === 'box')).toEqual([])
    const { fitChecks } = laid(narrow)
    expect(fitChecks.filter((c) => c.check === 'box' && !c.pass)).toMatchObject([
      { slide: 2, slot: 'takeaway', value: 2, limit: '1 lines' },
    ])
  })

  it('ends a Nepali post’s market version with the search line in Nepali (GD39)', () => {
    const { slides } = layoutMarket({
      revision: revision(theLine),
      slots: [],
      conversions: converted.conversions,
      facts: [FACT],
      sourceTitle: 'A source',
      language: 'ne',
    })
    expect(slides.at(-1)?.searchLine).toBe('यो फेरि भेट्टाउन “OfCourse A source” खोज्नुहोस्')
  })

  it('reports the slots a conversion changed', () => {
    expect(Object.keys(laid(theLine).converted)).toEqual(['2:takeaway'])
  })

  it("checks a look's contrast on its preset's surfaces (GD9)", () => {
    const look = templateById('field-notes') as Template
    const lookStructure: Structure = {
      templateId: look.id,
      artPrompt: 'A desk.',
      slides: [
        { kind: 'cover', slots: { kicker: plain('Research'), heading: plain('The line') } },
        { kind: 'take', slots: { heading: plain('Pay AUD 499.'), body: plain('Plan it early.') } },
      ],
    }
    const { fitChecks } = layoutMarket({
      revision: { ...revision(look), structure: lookStructure, themeId: 'subdued' },
      slots: [],
      conversions: [],
      facts: [FACT],
      sourceTitle: 'A source',
    })
    const contrast = fitChecks.filter((c) => c.check === 'contrast').map((c) => c.label)
    expect(contrast.length).toBeGreaterThan(0)
    for (const label of contrast) expect(label).toStartWith('Contrast · Subdued ')
  })
})
