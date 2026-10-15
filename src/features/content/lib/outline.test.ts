import { describe, expect, it } from 'bun:test'
import { type LayoutId, type OutlineJob, type OutlineSlide, POINT_MAX } from '../model/types'
import { templateById } from '../templates'
import { NATIVE_IDS, nativeOf } from '../text/native-fixtures'
import { editOutline, OUTLINE_ERRORS, outlineRange, outlineShape } from './outline'

const found = templateById('field-notes')
if (!found) throw new Error('field-notes missing')
const look = found

const slide = (layout: LayoutId, job: OutlineJob = 'point', point = 'A point.'): OutlineSlide => ({
  job,
  layout,
  point,
})
/** A Field Notes outline at its fewest slides: the cover, three middle slides, the takeaway. */
const FIVE = [
  slide('cover', 'hook', 'Paid work has a limit.'),
  slide('picture', 'point', 'Most students work.'),
  slide('number', 'proof', 'Twenty hours a week is the line.'),
  slide('checklist', 'step', 'Plan your shifts.'),
  slide('takeaway', 'takeaway', 'Protect your study time.'),
]
const SIX = [...FIVE.slice(0, 4), slide('quote', 'proof', 'A student says it.'), FIVE[4]]
const COUNT = 'A Field Notes post has 5 to 7 slides.'
const ORDER = "Keep the slides in the look's order: cover, then middle, then takeaway."

const edited = (slides: OutlineSlide[], op: Parameters<typeof editOutline>[2]) => {
  const res = editOutline(look, slides, op)
  if (!res.ok) throw new Error(res.error)
  return res.slides
}

describe('outlineRange and outlineShape (GD32)', () => {
  it("takes a look's slide count from its slides' repeats", () => {
    expect(outlineRange(look)).toEqual({ min: 5, max: 7 })
  })

  it("accepts an outline in the look's counts and order", () => {
    expect(
      outlineShape(
        look,
        FIVE.map((s) => s.layout),
      ),
    ).toEqual([])
  })

  it('names a count outside the look, a kind over its repeat, a layout it lacks and slides out of order', () => {
    expect(outlineShape(look, ['cover', 'picture', 'takeaway'])).toEqual([
      COUNT,
      'Field Notes takes 3 to 5 middle slides; this outline has 1.',
    ])
    expect(outlineShape(look, ['cover', 'cover', 'picture', 'number', 'takeaway'])).toEqual([
      'Field Notes takes 1 cover slide; this outline has 2.',
      'Field Notes takes 3 to 5 middle slides; this outline has 2.',
    ])
    expect(
      outlineShape(look, ['picture', 'cover', 'number', 'quote', 'takeaway'] as LayoutId[]),
    ).toEqual([ORDER])
    expect(outlineShape(look, ['cover', 'poster', 'number', 'quote', 'takeaway'] as never)).toEqual(
      expect.arrayContaining(['Field Notes has no poster layout.']),
    )
  })
})

describe('editOutline (GD32)', () => {
  it('moves a slide to another place', () => {
    expect(edited(FIVE, { op: 'move', slide: 3, to: 2 }).map((s) => s.layout)).toEqual([
      'cover',
      'number',
      'picture',
      'checklist',
      'takeaway',
    ])
  })

  it('adds a slide at a place, its point trimmed', () => {
    const added = edited(FIVE, {
      op: 'add',
      at: 5,
      slide: { job: 'compare', layout: 'bars', point: '  Two figures side by side. ' },
    })
    expect(added).toHaveLength(6)
    expect(added[4]).toEqual({ job: 'compare', layout: 'bars', point: 'Two figures side by side.' })
    expect(added[5]).toEqual(FIVE[4])
  })

  it('removes a slide', () => {
    expect(edited(SIX, { op: 'remove', slide: 5 })).toEqual(FIVE)
  })

  it("changes a slide's job, layout or point, leaving the rest", () => {
    const changed = edited(FIVE, { op: 'change', slide: 2, job: 'compare', layout: 'bars' })
    expect(changed[1]).toEqual({ job: 'compare', layout: 'bars', point: 'Most students work.' })
    const pointed = edited(FIVE, { op: 'change', slide: 3, point: ' Under twenty hours. ' })
    expect(pointed[2]).toEqual({ ...FIVE[2], point: 'Under twenty hours.' })
    expect(pointed.filter((_, i) => i !== 2)).toEqual(FIVE.filter((_, i) => i !== 2))
  })

  it("refuses an edit that leaves the look's counts or order: under or over its slides, a second cover, the cover moved", () => {
    expect(editOutline(look, FIVE, { op: 'remove', slide: 2 })).toEqual({ ok: false, error: COUNT })
    const seven = [...SIX.slice(0, 5), slide('picture'), SIX[5]]
    expect(editOutline(look, seven, { op: 'add', at: 2, slide: slide('picture') })).toEqual({
      ok: false,
      error: COUNT,
    })
    expect(editOutline(look, FIVE, { op: 'change', slide: 2, layout: 'cover' })).toEqual({
      ok: false,
      error: 'Field Notes takes 1 cover slide; this outline has 2.',
    })
    expect(editOutline(look, FIVE, { op: 'move', slide: 1, to: 2 })).toEqual({
      ok: false,
      error: ORDER,
    })
  })

  it('refuses a point that is empty or over 120 characters', () => {
    for (const point of ['', '   ', 'x'.repeat(121)]) {
      expect(editOutline(look, FIVE, { op: 'change', slide: 2, point })).toEqual({
        ok: false,
        error: OUTLINE_ERRORS.point,
      })
      expect(
        editOutline(look, FIVE, { op: 'add', at: 2, slide: slide('picture', 'point', point) }),
      ).toEqual({
        ok: false,
        error: OUTLINE_ERRORS.point,
      })
    }
    expect(edited(FIVE, { op: 'change', slide: 2, point: 'x'.repeat(120) })[1].point).toHaveLength(
      120,
    )
  })

  it('takes a Nepali, Hindi or Thai point of 120 characters as a reader sees them, and refuses one over (GD37)', () => {
    for (const id of NATIVE_IDS) {
      const point = nativeOf(id, POINT_MAX)
      expect(edited(FIVE, { op: 'change', slide: 2, point })[1].point, id).toBe(point)
      expect(editOutline(look, FIVE, { op: 'change', slide: 2, point: `${point}.` }), id).toEqual({
        ok: false,
        error: OUTLINE_ERRORS.point,
      })
    }
  })

  it('refuses a slide or a place that is not in the outline', () => {
    for (const n of [0, 6, 1.5, -1]) {
      for (const op of [
        { op: 'move', slide: n, to: 2 },
        { op: 'move', slide: 2, to: n },
        { op: 'remove', slide: n },
        { op: 'change', slide: n, point: 'A point.' },
      ] as const) {
        expect(editOutline(look, FIVE, op)).toEqual({
          ok: false,
          error: OUTLINE_ERRORS.slide,
        })
      }
    }
    for (const at of [0, 7, 2.5]) {
      expect(editOutline(look, FIVE, { op: 'add', at, slide: slide('picture') })).toEqual({
        ok: false,
        error: OUTLINE_ERRORS.slide,
      })
    }
  })
})
