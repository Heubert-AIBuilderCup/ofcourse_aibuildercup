import { describe, expect, it } from 'bun:test'
import { type FeedRoadmap, ROADMAP_EFFECTS, roadmapLinks } from './roadmap-lines'

const sydney: FeedRoadmap = { name: 'Sydney · Data science', destinations: ['AU'] }
const london: FeedRoadmap = { name: 'London · Psychology', destinations: ['UK'] }
const open: FeedRoadmap = { name: 'Open to others', destinations: [] }
const au = (name: string): FeedRoadmap => ({ name, destinations: ['AU'] })

describe('roadmapLinks (the post on her roadmaps, a sample)', () => {
  it('names each roadmap whose destination the post is tagged with, in her order', () => {
    expect(roadmapLinks(['destination:AU', 'destination:UK'], [london, open, sydney])).toEqual({
      effect: ROADMAP_EFFECTS.general,
      all: false,
      names: ['London · Psychology', 'Sydney · Data science'],
      more: 0,
    })
  })

  it('says the effect once, from the post’s theme, the same every time', () => {
    const work = roadmapLinks(['destination:AU', 'theme:work-study-life'], [sydney, au('Perth')])
    const books = roadmapLinks(['theme:books-movies', 'destination:AU'], [sydney])
    expect(work?.effect).toBe(ROADMAP_EFFECTS['work-study-life'])
    expect(books?.effect).toBe(ROADMAP_EFFECTS['books-movies'])
    expect(work?.effect).not.toBe(books?.effect)
  })

  it('collapses copies and repeated names into one', () => {
    const nursing = 'Nursing (graduate entry) in Adelaide'
    const links = roadmapLinks(
      ['destination:AU'],
      [au(`Copy of Copy of ${nursing}`), au(`Copy of ${nursing}`), au(nursing), sydney, sydney],
    )
    expect(links?.names).toEqual([nursing, 'Sydney · Data science'])
    expect(links?.more).toBe(0)
  })

  it('shows at most three names, then how many more', () => {
    const many = ['A', 'B', 'C', 'D', 'E'].map(au)
    expect(roadmapLinks(['destination:AU'], many)).toMatchObject({
      names: ['A', 'B', 'C'],
      more: 2,
    })
  })

  it('applies a post with no destination to all her roadmaps', () => {
    expect(roadmapLinks(['theme:books-movies'], [sydney, open])).toEqual({
      effect: ROADMAP_EFFECTS['books-movies'],
      all: true,
      names: ['Sydney · Data science', 'Open to others'],
      more: 0,
    })
  })

  it('names none when the post’s destination matches none of her roadmaps', () => {
    expect(roadmapLinks(['destination:NZ'], [sydney, open])).toMatchObject({
      all: false,
      names: [],
      more: 0,
    })
  })

  it('is null without any roadmap, so the section is left out', () => {
    expect(roadmapLinks(['destination:AU'], [])).toBeNull()
  })
})
