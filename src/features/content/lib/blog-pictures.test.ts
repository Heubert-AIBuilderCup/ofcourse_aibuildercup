import { describe, expect, it } from 'bun:test'
import { BLOG_PICTURE_ERRORS, blogAspect, blogPictureTargets, withEmbed } from './blog-pictures'

describe('blogPictureTargets: a cover and up to three pictures between sections (BR4)', () => {
  const afters = (sections: number) =>
    blogPictureTargets(sections).map(({ slide, target }) => [
      slide,
      target === 'cover' ? 'cover' : target.after,
    ])

  it('gives a one-section blog its cover only', () => {
    expect(afters(1)).toEqual([[1, 'cover']])
  })

  it('spreads the inline pictures evenly, never after the last section, numbered after the cover', () => {
    expect(afters(2)).toEqual([
      [1, 'cover'],
      [2, 1],
    ])
    expect(afters(3)).toEqual([
      [1, 'cover'],
      [2, 1],
      [3, 2],
    ])
    expect(afters(5)).toEqual([
      [1, 'cover'],
      [2, 2],
      [3, 3],
      [4, 4],
    ])
    expect(afters(8)).toEqual([
      [1, 'cover'],
      [2, 2],
      [3, 4],
      [4, 6],
    ])
  })
})

describe('blogAspect: wide pictures (BR4)', () => {
  it('draws the cover at 16:9 and a picture between sections at 4:3', () => {
    expect(blogAspect('cover')).toBe('16:9')
    expect(blogAspect({ after: 2 })).toBe('4:3')
  })
})

describe("withEmbed: a linked post's slides after a section (BR4)", () => {
  it('adds the post after a section, in section order', () => {
    expect(withEmbed([{ after: 3, postId: 'a' }], { after: 1, postId: 'b' }, 4)).toEqual({
      ok: true,
      embeds: [
        { after: 1, postId: 'b' },
        { after: 3, postId: 'a' },
      ],
    })
  })

  it('moves a post already embedded, and puts a post where another sat in its place', () => {
    expect(withEmbed([{ after: 1, postId: 'a' }], { after: 2, postId: 'a' }, 4)).toEqual({
      ok: true,
      embeds: [{ after: 2, postId: 'a' }],
    })
    expect(withEmbed([{ after: 2, postId: 'a' }], { after: 2, postId: 'b' }, 4)).toEqual({
      ok: true,
      embeds: [{ after: 2, postId: 'b' }],
    })
  })

  it('refuses a place that is not one of the sections, and a fourth post', () => {
    for (const after of [0, 5, 1.5]) {
      expect(withEmbed([], { after, postId: 'a' }, 4)).toEqual({
        ok: false,
        error: BLOG_PICTURE_ERRORS.at,
      })
    }
    const three = [1, 2, 3].map((after) => ({ after, postId: `p${after}` }))
    expect(withEmbed(three, { after: 4, postId: 'd' }, 4)).toEqual({
      ok: false,
      error: BLOG_PICTURE_ERRORS.many,
    })
    // Moving one of the three is not a fourth.
    expect(withEmbed(three, { after: 4, postId: 'p1' }, 4).ok).toBe(true)
  })
})
