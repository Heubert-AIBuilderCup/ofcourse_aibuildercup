import { describe, expect, it } from 'bun:test'
import { FEED_BRAND } from '../brands'
import { TEMPLATES } from '../templates'
import { NATIVE_IDS, nativeOf } from '../text/native-fixtures'
import { BODIES, emptyPointers, PointersSchema, SOURCE_ERRORS, searchTextError } from './artifacts'
import type { SlideArt } from './types'

// Records are immutable, so a field added later is optional or defaulted: a drafts or revision row
// written before emotions (criterion 100) still parses, as none chosen.

const TEMPLATE = TEMPLATES[0]
const STRUCTURE = { templateId: TEMPLATE.id, slides: [], artPrompt: 'A desk.' }
const STAMP = { userId: 'u1', name: 'Rae', at: '2026-10-05T09:12:00.000Z' }

describe('BODIES', () => {
  it('parses a drafts record written without an emotion as none chosen', () => {
    const old = { factsId: 'f', attempt: 1, items: [], replays: [] }
    expect(BODIES.drafts.parse(old).emotion).toBeNull()
    expect(BODIES.drafts.parse({ ...old, emotion: 'hopeful' }).emotion).toBe('hopeful')
  })

  it('parses a drafts record written before the history note as having none (101)', () => {
    const old = { factsId: 'f', attempt: 1, items: [], replays: [] }
    expect(BODIES.drafts.parse(old).note).toBeNull()
    expect(BODIES.drafts.parse({ ...old, note: 'Slide 2 edited' }).note).toBe('Slide 2 edited')
  })

  it('parses a revision written without an emotion as none chosen', () => {
    const old = {
      factsId: 'f',
      structure: STRUCTURE,
      template: TEMPLATE,
      brand: FEED_BRAND,
      themeId: FEED_BRAND.themes[0].id,
      by: STAMP,
      note: 'approved',
    }
    expect(BODIES.revision.parse(old).emotion).toBeNull()
    expect(BODIES.revision.parse({ ...old, emotion: 'Wistful' }).emotion).toBe('Wistful')
  })

  it('reads slides stored before planned scenes as having none, and keeps a scene up to 300 characters (RC2)', () => {
    const slide = { kind: 'cover', slots: {}, layout: 'cover' }
    const structure = { ...STRUCTURE, slides: [slide] }
    const drafts = {
      factsId: 'f',
      attempt: 1,
      items: [{ structure, template: TEMPLATE }],
      replays: [],
    }
    // Optional rather than defaulted, as `layout` is: slides built in code need not name one.
    expect(BODIES.drafts.parse(drafts).items[0].structure.slides[0].scene).toBeUndefined()
    const revision = {
      factsId: 'f',
      structure,
      template: TEMPLATE,
      brand: FEED_BRAND,
      themeId: FEED_BRAND.themes[0].id,
      by: STAMP,
      note: 'approved',
    }
    expect(BODIES.revision.parse(revision).structure.slides[0].scene).toBeUndefined()
    const planned = (scene: string) => ({
      ...revision,
      structure: { ...STRUCTURE, slides: [{ ...slide, scene }] },
    })
    expect(BODIES.revision.parse(planned('A tram at dawn.')).structure.slides[0].scene).toBe(
      'A tram at dawn.',
    )
    expect(BODIES.revision.safeParse(planned('x'.repeat(300))).success).toBe(true)
    expect(BODIES.revision.safeParse(planned('x'.repeat(301))).success).toBe(false)
  })

  it('reads a render with an image per slide or a panorama, and one without them as its single art', () => {
    const old = {
      revisionId: 'r',
      layoutId: 'l',
      art: { assetId: 'a', prompt: 'A desk.', version: 1, fallback: null },
      slides: [],
    }
    const parsed = BODIES.render.parse(old)
    expect(parsed.art.assetId).toBe('a')
    expect(parsed.slideArt).toBeUndefined()
    expect(parsed.panorama).toBeUndefined()
    const slideArt: SlideArt[] = [
      { slide: 1, assetId: 'a1', scene: 'A bench.', take: 1, nudge: null, fallback: null },
      {
        slide: 2,
        assetId: null,
        scene: 'A desk.',
        take: 2,
        nudge: 'Closer',
        fallback: 'daily_limit',
      },
    ]
    expect(BODIES.render.parse({ ...old, slideArt }).slideArt).toEqual(slideArt)
    expect(BODIES.render.parse({ ...old, panorama: { assetId: 'p' } }).panorama).toEqual({
      assetId: 'p',
    })
    expect(() =>
      BODIES.render.parse({ ...old, slideArt: [{ ...slideArt[0], fallback: 'replay' }] }),
    ).toThrow()
  })

  describe('a source (GD18–GD21)', () => {
    const stored = {
      title: 'Paid work',
      kind: 'article',
      text: 'One.\n\nTwo.',
      paragraphs: [
        { ref: '¶1', text: 'One.' },
        { ref: '¶2', text: 'Two.' },
      ],
      demoKey: null,
      url: 'https://campustimes.example/a',
      site: 'campustimes.example',
    }

    it('parses a stored single-link source, with no parts, failures, framing or notes', () => {
      const parsed = BODIES.source.parse(stored)
      expect(parsed).toEqual({ ...stored, language: 'en' })
      expect(parsed.parts).toBeUndefined()
      expect(parsed.framing).toBeUndefined()
    })

    it('reads a source stored before languages as English, and keeps a chosen one (GD36)', () => {
      expect(BODIES.source.parse(stored).language).toBe('en')
      expect(BODIES.source.parse({ ...stored, language: 'ne' }).language).toBe('ne')
      expect(BODIES.source.safeParse({ ...stored, language: 'fr' }).success).toBe(false)
    })

    it('keeps the parts read, the links that failed, the framing line and the notes', () => {
      const more = {
        ...stored,
        parts: [
          { url: 'https://a.example/1', site: 'a.example', title: 'A', from: 1, to: 1 },
          { url: 'https://b.example/2', site: 'b.example', title: 'B', from: 2, to: 2 },
        ],
        failed: [{ url: 'https://c.example/3', error: 'Could not read that page.' }],
        framing: 'Show first-year students why 20 hours is the limit',
        notes: 'I worked 25 hours in first year.',
      }
      expect(BODIES.source.parse(more)).toEqual({ ...more, language: 'en' })
    })

    it('holds a framing line to 200 characters and the notes to 2,000', () => {
      expect(BODIES.source.safeParse({ ...stored, framing: 'x'.repeat(200) }).success).toBe(true)
      expect(BODIES.source.safeParse({ ...stored, framing: 'x'.repeat(201) }).success).toBe(false)
      expect(BODIES.source.safeParse({ ...stored, notes: 'x'.repeat(2000) }).success).toBe(true)
      expect(BODIES.source.safeParse({ ...stored, notes: 'x'.repeat(2001) }).success).toBe(false)
    })

    it('holds a Nepali, Hindi or Thai title, framing line and notes to their characters as a reader sees them (GD37)', () => {
      for (const id of NATIVE_IDS) {
        const at = (n: number) => nativeOf(id, n)
        const within = { ...stored, title: at(200), framing: at(200), notes: at(2000) }
        expect(BODIES.source.safeParse(within).success, id).toBe(true)
        for (const over of [{ title: at(201) }, { framing: at(201) }, { notes: at(2001) }]) {
          expect(BODIES.source.safeParse({ ...within, ...over }).success, id).toBe(false)
        }
      }
    })
  })
})

describe('idea cards and image plans (GD1, GD2, GD12)', () => {
  const CARD = {
    angle: 'The limit that works',
    hook: 'There is a point where paid work starts to cost you.',
    audience: 'First-year students',
    look: 'field-notes' as const,
    slides: 5,
  }

  it('keeps the ideas shown, with the round they reached, and refuses a look that is not one', () => {
    const ideas = { factsId: 'f', cards: [CARD], rounds: 1 }
    expect(BODIES.ideas.parse(ideas)).toEqual(ideas)
    expect(
      BODIES.ideas.safeParse({ ...ideas, cards: [{ ...CARD, look: 'the-line' }] }).success,
    ).toBe(false)
  })

  it('reads a drafts record from before ideas as drafted for none, and keeps the idea it was drafted for', () => {
    const old = { factsId: 'f', attempt: 1, items: [], replays: [] }
    expect(BODIES.drafts.parse(old).idea ?? null).toBeNull()
    expect(BODIES.drafts.parse({ ...old, idea: { cards: [CARD] } }).idea).toEqual({ cards: [CARD] })
  })

  it('keeps up to four ideas combined on a drafts record and an outline, and refuses five (GD2)', () => {
    const drafts = (n: number) =>
      BODIES.drafts.safeParse({
        factsId: 'f',
        attempt: 1,
        items: [],
        replays: [],
        idea: { cards: Array(n).fill(CARD) },
      }).success
    const outline = (n: number) =>
      BODIES.post_outline.safeParse({
        factsId: 'f',
        ideas: Array(n).fill(CARD),
        format: null,
        slides: Array(3).fill({ job: 'point', layout: 'picture', point: 'A point.' }),
        note: 'Outlined',
      }).success
    expect([drafts(4), drafts(5), outline(4), outline(5)]).toEqual([true, false, true, false])
  })

  it('keeps an image plan: a scene per slide, or one panorama', () => {
    const plan = {
      revisionId: 'r',
      scenes: [{ slide: 1, scene: 'A quiet desk.' }],
      panorama: false,
    }
    expect(BODIES.art_plan.parse(plan)).toEqual(plan)
  })

  it('keeps a post outline of 3 to 10 slides, each a known job, a layout and a point (GD32)', () => {
    const slide = {
      job: 'point' as const,
      layout: 'picture' as const,
      point: 'Twenty hours a week is the line.',
    }
    const outline = {
      factsId: 'f',
      ideas: [CARD],
      format: null,
      slides: [{ ...slide, job: 'hook' as const, layout: 'cover' as const }, slide, slide],
      note: 'Outlined',
    }
    expect(BODIES.post_outline.parse(outline)).toEqual(outline)
    const withSlides = (slides: unknown[]) =>
      BODIES.post_outline.safeParse({ ...outline, slides }).success
    expect(withSlides([slide, slide])).toBe(false)
    expect(withSlides(Array(10).fill(slide))).toBe(true)
    expect(withSlides(Array(11).fill(slide))).toBe(false)
    expect(withSlides([slide, slide, { ...slide, job: 'joke' }])).toBe(false)
    expect(withSlides([slide, slide, { ...slide, layout: 'poster' }])).toBe(false)
    expect(withSlides([slide, slide, { ...slide, point: '' }])).toBe(false)
    expect(BODIES.post_outline.safeParse({ ...outline, ideas: [] }).success).toBe(false)
  })

  it("keeps an outline's format as one of the file's, an outline stored with none parsing as none (GD33)", () => {
    const outline = {
      factsId: 'f',
      ideas: [{ ...CARD, format: 'myth-vs-fact' }],
      format: null,
      slides: [
        { job: 'hook', layout: 'cover', point: 'Twenty hours.' },
        { job: 'point', layout: 'bullets', point: 'Three things.' },
        { job: 'takeaway', layout: 'takeaway', point: 'Plan it.' },
      ],
      note: 'Outlined',
    }
    expect(BODIES.post_outline.parse(outline).format).toBeNull()
    expect(BODIES.post_outline.parse({ ...outline, format: 'then-vs-now' }).format).toBe(
      'then-vs-now',
    )
    expect(BODIES.post_outline.safeParse({ ...outline, format: 'listicle' }).success).toBe(false)
    expect(
      BODIES.post_outline.safeParse({ ...outline, ideas: [{ ...CARD, format: 'listicle' }] })
        .success,
    ).toBe(false)
  })

  it('keeps the top three formats on an ideas record, and reads one from before formats as none (GD33)', () => {
    const ideas = { factsId: 'f', cards: [CARD], rounds: 1 }
    expect(BODIES.ideas.parse(ideas).formats ?? null).toBeNull()
    const top = ['myth-vs-fact', 'step-by-step', 'bullet-points'] as const
    expect(BODIES.ideas.parse({ ...ideas, formats: top }).formats).toEqual([...top])
    expect(BODIES.ideas.safeParse({ ...ideas, formats: ['listicle'] }).success).toBe(false)
  })

  it('reads pointers saved before ideas, image plans and outlines as having none', () => {
    const { ideasId, artPlanId, outlineId, ...old } = emptyPointers()
    expect(ideasId).toBeNull()
    expect(artPlanId).toBeNull()
    expect(outlineId).toBeNull()
    expect(PointersSchema.parse(old)).toMatchObject({
      ideasId: null,
      artPlanId: null,
      outlineId: null,
    })
  })
})

describe('blogs: their outline, text and links (BR1–BR11)', () => {
  const CARD = {
    angle: 'The limit that works',
    hook: 'There is a point where paid work starts to cost you.',
    audience: 'First-year students',
    look: 'field-notes' as const,
    slides: 5,
  }
  const section = { heading: 'How many hours can you work?', point: 'Twenty a week in term.' }
  const faq = { q: 'Can I work more in the holidays?', point: 'Yes, full time.' }
  const outline = {
    factsId: 'f',
    idea: CARD,
    sections: [section, section],
    takeaways: ['One.', 'Two.', 'Three.'],
    faq: [faq, faq, faq],
    note: 'Outlined',
  }

  it('keeps a blog outline of 1 to 8 sections, 3 to 5 takeaways and 3 to 5 questions', () => {
    expect(BODIES.blog_outline.parse(outline)).toEqual(outline)
    expect(BODIES.blog_outline.parse({ ...outline, idea: null, note: null }).idea).toBeNull()
    const ok = (over: Record<string, unknown>) =>
      BODIES.blog_outline.safeParse({ ...outline, ...over }).success
    expect(ok({ sections: [section] })).toBe(true)
    expect(ok({ sections: Array(8).fill(section) })).toBe(true)
    expect(ok({ sections: Array(9).fill(section) })).toBe(false)
    expect(ok({ sections: [] })).toBe(false)
    expect(ok({ takeaways: ['One.', 'Two.'] })).toBe(false)
    expect(ok({ takeaways: Array(6).fill('One.') })).toBe(false)
    expect(ok({ faq: [faq, faq] })).toBe(false)
    expect(ok({ faq: Array(6).fill(faq) })).toBe(false)
  })

  it('keeps blog text: sections and answers with the facts they rest on, an emotion and a note', () => {
    const text = {
      outlineId: 'o',
      sections: [
        { heading: section.heading, body: 'Most students may work twenty.', factIds: ['F1'] },
      ],
      takeaways: ['One.', 'Two.', 'Three.'],
      faq: [{ q: faq.q, a: 'Yes, full time.', factIds: ['F2'] }],
      emotion: null,
      note: null,
    }
    expect(BODIES.blog_text.parse(text)).toEqual(text)
    expect(BODIES.blog_text.safeParse({ ...text, outlineId: '' }).success).toBe(false)
  })

  it('keeps a link between a blog and a post, made from the blog, linked to it or unlinked from it (BR8)', () => {
    const link = { kind: 'from_blog' as const, blogId: 'b', postId: 'p' }
    expect(BODIES.blog_link.parse(link)).toEqual(link)
    expect(BODIES.blog_link.parse({ ...link, kind: 'linked' }).kind).toBe('linked')
    expect(BODIES.blog_link.parse({ ...link, kind: 'unlinked' }).kind).toBe('unlinked')
    expect(BODIES.blog_link.safeParse({ ...link, kind: 'moved' }).success).toBe(false)
  })

  it("keeps a blog's image plan, linked to its text with each picture's place, and refuses one linked to both a revision and a text, or to neither (BR4)", () => {
    const plan = {
      blogTextId: 't',
      scenes: [
        { slide: 1, scene: 'A quiet desk at dawn.', target: 'cover' as const },
        { slide: 2, scene: 'A tram stop in the rain.', target: { after: 2 } },
      ],
      panorama: false,
    }
    expect(BODIES.art_plan.parse(plan)).toEqual(plan)
    expect(BODIES.art_plan.safeParse({ ...plan, revisionId: 'r' }).success).toBe(false)
    const { blogTextId, ...neither } = plan
    expect(BODIES.art_plan.safeParse(neither).success).toBe(false)
    const nowhere = [{ slide: 2, scene: 'A tram stop.', target: { after: 0 } }]
    expect(BODIES.art_plan.safeParse({ ...plan, scenes: nowhere }).success).toBe(false)
  })

  it("keeps a blog's pictures, each with its place and its tinted copy, and the slides of up to three linked posts (BR4)", () => {
    const picture = {
      slide: 1,
      target: 'cover' as const,
      scene: 'A quiet desk at dawn.',
      take: 1,
      nudge: null,
      fallback: null,
      assetId: 'a1',
      tintedAssetId: 'a2',
    }
    const images = {
      blogTextId: 't',
      version: 1,
      images: [picture, { ...picture, slide: 2, target: { after: 3 } }],
      embeds: [{ after: 2, postId: 'p' }],
    }
    expect(BODIES.blog_images.parse(images)).toEqual(images)
    const embeds = [1, 2, 3, 4].map((after) => ({ after, postId: `p${after}` }))
    expect(BODIES.blog_images.safeParse({ ...images, embeds }).success).toBe(false)
    expect(BODIES.blog_images.safeParse({ ...images, blogTextId: '' }).success).toBe(false)
  })

  it("keeps a blog's approval, pinning its text, pictures and settings with no revision or render, and refuses one pinning both or neither (BR5)", () => {
    const pinned = {
      sourceCheckId: 'c',
      settingsId: 's',
      visionId: null,
      overrideId: null,
      marketId: null,
      by: STAMP,
      selfReviewed: false,
    }
    const blog = { ...pinned, blogTextId: 't', blogImagesId: 'i' }
    expect(BODIES.approval.parse(blog)).toEqual(blog)
    const feed = { ...pinned, revisionId: 'r', renderId: 'd' }
    expect(BODIES.approval.parse(feed)).toEqual(feed)
    expect(BODIES.approval.safeParse({ ...feed, blogTextId: 't' }).success).toBe(false)
    expect(BODIES.approval.safeParse(pinned).success).toBe(false)
    expect(BODIES.approval.safeParse({ ...pinned, revisionId: 'r' }).success).toBe(false)
  })

  it("keeps a reviewer's request for changes on a blog's text, and refuses one naming both a revision and a text, or neither (BR5)", () => {
    const asked = { reason: 'Shorter intro.', by: STAMP, step: 'structures' as const }
    expect(BODIES.send_back.parse({ ...asked, blogTextId: 't' })).toEqual({
      ...asked,
      blogTextId: 't',
    })
    expect(BODIES.send_back.parse({ ...asked, revisionId: 'r' }).revisionId).toBe('r')
    expect(BODIES.send_back.safeParse({ ...asked, revisionId: 'r', blogTextId: 't' }).success).toBe(
      false,
    )
    expect(BODIES.send_back.safeParse(asked).success).toBe(false)
  })

  it('keeps a Nepali, Hindi or Thai request for changes of 200 characters as a reader sees them (GD37)', () => {
    for (const id of NATIVE_IDS) {
      const asked = { reason: nativeOf(id, 200), by: STAMP, step: null, revisionId: 'r' }
      expect(BODIES.send_back.safeParse(asked).success, id).toBe(true)
      expect(BODIES.send_back.safeParse({ ...asked, reason: nativeOf(id, 201) }).success).toBe(
        false,
      )
    }
  })

  it('reads pointers saved before blog pictures as having none', () => {
    const { blogImagesId, ...old } = emptyPointers()
    expect(blogImagesId).toBeNull()
    expect(PointersSchema.parse(old).blogImagesId).toBeNull()
  })

  it('reads pointers saved before blogs as having no blog outline or text', () => {
    const { blogOutlineId, blogTextId, ...old } = emptyPointers()
    expect(blogOutlineId).toBeNull()
    expect(blogTextId).toBeNull()
    expect(PointersSchema.parse(old)).toMatchObject({ blogOutlineId: null, blogTextId: null })
  })
})

describe('searchTextError: an idea or a claim searched with Google (BR12, BR14)', () => {
  const IDEA = {
    empty: SOURCE_ERRORS.ideaEmpty,
    length: SOURCE_ERRORS.ideaLength,
    link: SOURCE_ERRORS.ideaLink,
  }
  const idea = (text: string) => searchTextError(text, IDEA)

  it('takes words with digits and quote marks: it is search text, not an image prompt', () => {
    expect(idea('20 hours a week on a student visa')).toBeNull()
    expect(idea('Student visa (subclass 500) "work rights"')).toBeNull()
    expect(idea(`  ${'a'.repeat(200)}  `)).toBeNull()
  })

  it('refuses no text, over 200 characters once trimmed, and a link with nothing else', () => {
    expect(idea('   ')).toBe(SOURCE_ERRORS.ideaEmpty)
    expect(idea('a'.repeat(201))).toBe(SOURCE_ERRORS.ideaLength)
    expect(idea(' https://www.studyaustralia.gov.au/work ')).toBe(SOURCE_ERRORS.ideaLink)
    expect(idea('Work rights on https://www.studyaustralia.gov.au/work')).toBeNull()
  })

  it('counts a Nepali, Hindi or Thai idea in characters as a reader sees them (GD37)', () => {
    for (const id of NATIVE_IDS) {
      expect(idea(nativeOf(id, 200)), id).toBeNull()
      expect(idea(nativeOf(id, 201)), id).toBe(SOURCE_ERRORS.ideaLength)
    }
  })
})
