import { describe, expect, it } from 'bun:test'
import theLine from '../templates/the-line.json'
import { NATIVE_IDS, nativeOf } from '../text/native-fixtures'
import {
  FeedSettingsSchema,
  LAYOUT_IDS,
  OutlineSlideSchema,
  POINT_MAX,
  SlideSchema,
  TemplateSchema,
} from './types'

describe('layouts in the schema (GD4, GD8)', () => {
  it('names the eight layouts every look shares', () => {
    expect(LAYOUT_IDS).toEqual([
      'cover',
      'picture',
      'number',
      'bars',
      'quote',
      'checklist',
      'bullets',
      'takeaway',
    ])
  })

  it('reads a slide stored before layouts with no layout, and refuses an unknown one', () => {
    expect(SlideSchema.parse({ kind: 'body', slots: {} }).layout ?? null).toBeNull()
    expect(SlideSchema.parse({ kind: 'body', slots: {}, layout: null }).layout).toBeNull()
    expect(SlideSchema.parse({ kind: 'body', slots: {}, layout: 'bars' }).layout).toBe('bars')
    expect(SlideSchema.safeParse({ kind: 'body', slots: {}, layout: 'poster' }).success).toBe(false)
  })

  it('reads an old template as no look, its slides on the base surface with no panel', () => {
    const t = TemplateSchema.parse(theLine)
    expect(t.look).toBe(false)
    expect(t.layouts).toBeUndefined()
    for (const { spec } of t.slides) expect([spec.surface, spec.panel]).toEqual(['base', false])
  })
})

describe('FeedSettingsSchema', () => {
  const settings = {
    layer: 'personal',
    audience: { mode: 'matched', rules: ['home:NP'] },
    whyLine: null,
    expiry: { kind: 'none' },
    studioLink: null,
  }

  it('holds a Nepali, Hindi or Thai why line to 140 characters as a reader sees them (GD37)', () => {
    for (const id of NATIVE_IDS) {
      expect(
        FeedSettingsSchema.safeParse({ ...settings, whyLine: nativeOf(id, 140) }).success,
        id,
      ).toBe(true)
      expect(
        FeedSettingsSchema.safeParse({ ...settings, whyLine: nativeOf(id, 141) }).success,
        id,
      ).toBe(false)
    }
    expect(FeedSettingsSchema.safeParse({ ...settings, whyLine: 'x'.repeat(141) }).success).toBe(
      false,
    )
  })
})

describe('an outline slide’s point and a slide’s scene, stored (GD32, RC2)', () => {
  it('hold Nepali, Hindi or Thai to their limits in characters as a reader sees them (GD37)', () => {
    for (const id of NATIVE_IDS) {
      const outline = (point: string) => ({ job: 'point', layout: 'picture', point })
      expect(OutlineSlideSchema.safeParse(outline(nativeOf(id, POINT_MAX))).success, id).toBe(true)
      expect(OutlineSlideSchema.safeParse(outline(nativeOf(id, POINT_MAX + 1))).success, id).toBe(
        false,
      )
      const slide = (scene: string) => ({ kind: 'body', slots: {}, scene })
      expect(SlideSchema.safeParse(slide(nativeOf(id, 300))).success, id).toBe(true)
      expect(SlideSchema.safeParse(slide(nativeOf(id, 301))).success, id).toBe(false)
    }
  })
})
