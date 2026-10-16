import { describe, expect, it } from 'bun:test'
import { FEED_BRAND } from '../brands'
import type { Fact, Slide, Slot, Structure, Template } from '../model/types'
import { templateById } from '../templates'
import { layoutStructure } from './engine'
import { fitChecks } from './fit'
import { layoutOptions, relayout } from './relayout'

const fact = (id: string, text: string, value: Fact['value']): Fact => ({
  id,
  text,
  value,
  ref: '¶1',
  quote: text,
  supported: true,
  why: null,
  span: null,
})
const TWENTY = fact('f1', 'Students who worked up to 20 hours a week kept their grades.', {
  number: 20,
  unit: 'number',
})
const ELEVEN = fact('f2', 'Grades fell by 11% for those working more.', {
  number: 11,
  unit: 'percent',
})
const PLAIN = fact('f3', 'Most students said work taught them to plan their week.', null)
const FACTS = [TWENTY, ELEVEN, PLAIN]

const slot = (text: string, factIds: string[] = [], factual = false): Slot => ({
  text,
  factIds,
  factual,
})
const BODY = 'Students worked part time. Most kept their grades. Few fell behind.'
const picture = (factIds: string[]): Slide => ({
  kind: 'body',
  layout: 'picture',
  slots: { heading: slot('Work and grades'), body: slot(BODY, factIds, true) },
})
const option = (s: Slide, id: string, place?: { first: boolean; last: boolean }) =>
  layoutOptions(s, FACTS, place).find((o) => o.id === id)

describe('layoutOptions (GD5)', () => {
  it('disables big number and bars with one shared reason when no fact on the slide has a number', () => {
    const reason =
      'Big number and Comparison bars need a number from a fact on this slide; bars need two.'
    expect(option(picture(['f3']), 'number')).toEqual({ id: 'number', ok: false, reason })
    expect(option(picture(['f3']), 'bars')).toEqual({ id: 'bars', ok: false, reason })
    expect(option(picture(['f1']), 'number')).toEqual({ id: 'number', ok: true })
  })

  it('needs two numbers for bars, two points for a checklist and a bound sentence for a quote; picture always fits', () => {
    expect(option(picture(['f1']), 'bars')).toEqual({
      id: 'bars',
      ok: false,
      reason: 'Bars need two numbers from facts on this slide.',
    })
    expect(option(picture(['f1', 'f2']), 'bars')).toEqual({ id: 'bars', ok: true })
    const onePoint: Slide = { ...picture([]), slots: { body: slot('Only one point here.') } }
    expect(option(onePoint, 'checklist')).toMatchObject({
      ok: false,
      reason: 'A checklist needs two or more points.',
    })
    expect(option(picture([]), 'checklist')).toEqual({ id: 'checklist', ok: true })
    expect(option(picture([]), 'quote')).toMatchObject({
      ok: false,
      reason: 'A quote needs a sentence from the source.',
    })
    expect(option(picture(['f3']), 'quote')).toEqual({ id: 'quote', ok: true })
    expect(option(onePoint, 'picture')).toEqual({ id: 'picture', ok: true })
  })

  it('offers cover only at the first place and takeaway only at the last', () => {
    const middle = { first: false, last: false }
    expect(option(picture([]), 'cover', middle)).toMatchObject({ ok: false })
    expect(option(picture([]), 'takeaway', middle)).toMatchObject({ ok: false })
    expect(option(picture([]), 'cover', { first: true, last: false })).toMatchObject({ ok: true })
    expect(option(picture([]), 'takeaway', { first: false, last: true })).toMatchObject({
      ok: true,
    })
  })
})

describe('relayout (GD5)', () => {
  it('picture to number fills the number and label from the fact and keeps the body', () => {
    const out = relayout(picture(['f1']), 'number', FACTS)
    expect(out.layout).toBe('number')
    expect(out.kind).toBe('body')
    expect(Object.keys(out.slots).sort()).toEqual(['body', 'label', 'number'])
    expect(out.slots.number).toMatchObject({ text: '20', factIds: ['f1'] })
    expect(out.slots.label).toMatchObject({
      text: 'hours a week kept their grades',
      factIds: ['f1'],
    })
    expect(out.slots.body).toEqual(slot(BODY, ['f1'], true))
  })

  it('picture to checklist splits the body into one item per line, and back joins them', () => {
    const list = relayout(picture(['f3']), 'checklist', FACTS)
    expect(Object.keys(list.slots).sort()).toEqual(['heading', 'items'])
    expect(list.slots.heading.text).toBe('Work and grades')
    expect(list.slots.items.text).toBe(
      'Students worked part time.\nMost kept their grades.\nFew fell behind.',
    )
    const back = relayout(list, 'picture', FACTS)
    expect(back.slots.body.text).toBe(BODY)
    expect(back.slots.body.factual).toBe(true)
    expect(back.layout).toBe('picture')
  })

  it('keeps the fact ids the slide is bound to', () => {
    const list = relayout(picture(['f3']), 'checklist', FACTS)
    expect(list.slots.items.factIds).toEqual(['f3'])
    expect(relayout(list, 'picture', FACTS).slots.body.factIds).toEqual(['f3'])
  })

  it('bars take their labels and values from two facts, a quote its fact sentence, and the kind follows the layout', () => {
    const bars = relayout(picture(['f1', 'f2']), 'bars', FACTS)
    expect(bars.slots.valueA).toMatchObject({ text: '20', factIds: ['f1'] })
    expect(bars.slots.labelA).toMatchObject({
      text: 'hours a week kept their grades',
      factIds: ['f1'],
    })
    expect(bars.slots.valueB).toMatchObject({ text: '11%', factIds: ['f2'] })
    expect(bars.slots.labelB).toMatchObject({ text: 'for those working more', factIds: ['f2'] })
    const quote = relayout(picture(['f3']), 'quote', FACTS)
    expect(quote.slots.quote).toEqual(slot(PLAIN.text, ['f3'], true))
    expect(relayout(picture([]), 'takeaway', FACTS).kind).toBe('take')
  })

  it('derives labels by code within their slot limits, so a swap to number or bars passes its length rows', () => {
    const long = fact(
      'f4',
      'Students in their first year who worked more than 20 hours each week during term saw their grades fall.',
      { number: 20, unit: 'number' },
    )
    const ending = fact('f5', 'The share of students who kept every grade was 64%.', {
      number: 64,
      unit: 'percent',
    })
    const facts = [...FACTS, long, ending]
    const template = templateById('field-notes') as Template
    for (const to of ['number', 'bars'] as const) {
      const slide = relayout(picture(['f4', 'f5']), to, facts)
      const structure: Structure = {
        templateId: template.id,
        artPrompt: 'A desk.',
        slides: [slide],
      }
      const layout = layoutStructure({
        structure,
        template,
        brand: FEED_BRAND,
        sourceTitle: 'Work and grades',
        facts,
      })
      const rows = fitChecks({
        structure,
        template,
        theme: FEED_BRAND.themes[0],
        brand: FEED_BRAND,
        layout,
      }).filter((r) => r.check === 'length' && r.slot?.startsWith('label'))
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.filter((r) => !r.pass).map((r) => r.label)).toEqual([])
    }
    // Cut at a word, never inside one; a figure at the end of its sentence takes the words before it.
    const number = relayout(picture(['f4']), 'number', facts)
    expect(number.slots.label.text).toBe('hours each week during term saw their')
    const bars = relayout(picture(['f4', 'f5']), 'bars', facts)
    expect(bars.slots.labelB.text).toBe('who kept every grade was')
  })
})

describe('the bullets layout in relayout (GD34)', () => {
  const bullets = (points: string[], factIds: string[] = []): Slide => ({
    kind: 'body',
    layout: 'bullets',
    slots: { heading: slot('Before a shift'), points: slot(points.join('\n'), factIds, true) },
  })

  it('takes three to five points, and says why not otherwise', () => {
    expect(option(picture([]), 'bullets')).toEqual({ id: 'bullets', ok: true })
    const reason = 'Bullet points need three to five points.'
    const two: Slide = { ...picture([]), slots: { body: slot('One point. Another point.') } }
    expect(option(two, 'bullets')).toEqual({ id: 'bullets', ok: false, reason })
    const six: Slide = {
      ...picture([]),
      slots: { body: slot('Work less. Sleep more. Eat well. Plan ahead. Ask early. Rest often.') },
    }
    expect(option(six, 'bullets')).toEqual({ id: 'bullets', ok: false, reason })
    expect(option(bullets(['a', 'b', 'c', 'd', 'e']), 'bullets')).toEqual({
      id: 'bullets',
      ok: true,
    })
  })

  it('maps a body’s sentences to one point each, and back to the same body', () => {
    const list = relayout(picture(['f3']), 'bullets', FACTS)
    expect(list.layout).toBe('bullets')
    expect(list.kind).toBe('body')
    expect(Object.keys(list.slots).sort()).toEqual(['heading', 'points'])
    expect(list.slots.heading.text).toBe('Work and grades')
    expect(list.slots.points).toEqual(
      slot('Students worked part time.\nMost kept their grades.\nFew fell behind.', ['f3'], true),
    )
    const back = relayout(list, 'picture', FACTS)
    expect(back.slots.body).toEqual(slot(BODY, ['f3'], true))
  })

  it('closes each point with a stop when it becomes a body, so its sentences split back into the same points', () => {
    const points = ['Check your visa hours', 'Ask about exam weeks?', 'Keep one free day']
    const body = relayout(bullets(points, ['f1']), 'picture', FACTS)
    expect(body.slots.body).toEqual(
      slot('Check your visa hours. Ask about exam weeks? Keep one free day.', ['f1'], true),
    )
    expect(relayout(body, 'bullets', FACTS).slots.points.text).toBe(
      'Check your visa hours.\nAsk about exam weeks?\nKeep one free day.',
    )
  })

  it('moves a checklist’s items to points and back, line for line', () => {
    const items = 'Check your visa hours\nAsk about exam weeks\nKeep one free day'
    const checklist: Slide = {
      kind: 'body',
      layout: 'checklist',
      slots: { heading: slot('Before a shift'), items: slot(items, ['f1']) },
    }
    const list = relayout(checklist, 'bullets', FACTS)
    expect(list.slots.points).toEqual(slot(items, ['f1'], true))
    expect(relayout(list, 'checklist', FACTS).slots.items).toEqual(slot(items, ['f1']))
  })
})
