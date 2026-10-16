import { describe, expect, it } from 'bun:test'
import type { FeedSettings } from '../model/types'
import type { LiveBlog } from '../server/store'
import {
  blogAssetPath,
  blogBody,
  blogJsonLd,
  blogMetadata,
  blogSearchLine,
  blogSitemapEntries,
  feedBlogOf,
  jsonLdText,
  readingMinutes,
  relatedBlogs,
} from './public-blog'

// A live blog's public page (BR9, BR10) and its feed card (BR11): the structured data search
// engines and AI crawlers read, its canonical address, the sitemap's entries, the reading time,
// where pictures and embedded slides sit, and the related blogs.

const SITE = 'https://ofcourse.example'
const NOW = new Date('2026-10-14T12:00:00.000Z')
const DAY = 86_400_000

const GENERAL: FeedSettings = {
  layer: 'general',
  audience: { mode: 'everyone', rules: [] },
  whyLine: null,
  expiry: { kind: 'none' },
  studioLink: null,
  tags: ['theme:work-study-life'],
  sourcesAt: 'caption',
}

const BLOG: LiveBlog = {
  id: 'b1',
  title: 'How many hours can I work on a student visa?',
  slug: 'how-many-hours-can-i-work',
  publishedAt: '2026-10-12T09:00:00.000Z',
  updatedAt: '2026-10-13T10:30:00.000Z',
  settings: GENERAL,
  tags: ['theme:work-study-life'],
  sections: [
    { heading: 'What is the limit?', body: 'Up to 48 hours a fortnight while your course is on.' },
    { heading: 'What about breaks?', body: 'Unlimited hours in scheduled course breaks.' },
  ],
  takeaways: ['48 hours a fortnight in term.'],
  faq: [
    { q: 'Does volunteering count?', a: 'Only unpaid volunteering for a charity is left out.' },
    { q: 'Who checks?', a: 'The Department of Home Affairs.' },
  ],
  pictures: [
    { target: 'cover', assetId: 'png cover', alt: 'A student at a café counter' },
    { target: { after: 1 }, assetId: 'png-1', alt: 'A timesheet' },
  ],
  embeds: [],
  sources: [],
  posts: [],
}

describe('blogJsonLd (BR10)', () => {
  it('is an Article by OfCourse with its dates, cover and canonical page, then its FAQ', () => {
    const [article, faq] = blogJsonLd(BLOG, SITE)
    expect(article).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: BLOG.title,
      datePublished: BLOG.publishedAt,
      dateModified: BLOG.updatedAt,
      author: { '@type': 'Organization', name: 'OfCourse', url: `${SITE}/` },
      publisher: { '@type': 'Organization', name: 'OfCourse', url: `${SITE}/` },
      image: [`${SITE}/blog/assets/png%20cover`],
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}/blog/how-many-hours-can-i-work` },
    })
    expect(faq).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Does volunteering count?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Only unpaid volunteering for a charity is left out.',
          },
        },
        {
          '@type': 'Question',
          name: 'Who checks?',
          acceptedAnswer: { '@type': 'Answer', text: 'The Department of Home Affairs.' },
        },
      ],
    })
  })

  it('has no FAQPage without questions, and no image without a cover', () => {
    const data = blogJsonLd({ ...BLOG, faq: [], pictures: [] }, SITE)
    expect(data).toHaveLength(1)
    expect(data[0]).not.toHaveProperty('image')
  })
})

describe('jsonLdText (BR10)', () => {
  it('escapes what could end the script or start markup, and still parses to the same data', () => {
    const data = { headline: '</script><script>alert(1)</script> & more\u2028\u2029' }
    const text = jsonLdText(data)
    expect(text).not.toContain('<')
    expect(text).not.toContain('>')
    expect(text).not.toContain('&')
    expect(text).not.toContain('\u2028')
    expect(text).not.toContain('\u2029')
    expect(JSON.parse(text)).toEqual(data)
  })
})

describe('readingMinutes (BR11)', () => {
  const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ')
  const blog = (n: number) => ({
    sections: [{ heading: words(10), body: words(n - 30) }],
    takeaways: [words(10)],
    faq: [{ q: words(5), a: words(5) }],
  })

  it('is every word read, takeaways, headings, sections and FAQ, at 200 a minute, rounded', () => {
    expect(readingMinutes(blog(1000))).toBe(5)
    expect(readingMinutes(blog(1099))).toBe(5)
    expect(readingMinutes(blog(1100))).toBe(6)
  })

  it('is never less than a minute', () => {
    expect(readingMinutes(blog(30))).toBe(1)
  })
})

describe('blogBody (BR4, BR9)', () => {
  const post = (postId: string) => ({ postId, title: postId, slides: [] })

  it('puts each picture after its section, and a post’s slides in place of the picture there', () => {
    const body = blogBody({
      ...BLOG,
      pictures: [...BLOG.pictures, { target: { after: 2 }, assetId: 'png-2', alt: 'A calendar' }],
      embeds: [{ after: 2, ...post('p1') }],
    })
    expect(body.cover).toEqual(BLOG.pictures[0])
    expect(body.sections.map((s) => s.after)).toEqual([
      { kind: 'picture', picture: BLOG.pictures[1] },
      { kind: 'slides', embed: { after: 2, ...post('p1') } },
    ])
  })

  it('has no cover and nothing after a section without one', () => {
    const body = blogBody({ ...BLOG, pictures: [] })
    expect(body.cover).toBeNull()
    expect(body.sections.map((s) => s.after)).toEqual([null, null])
  })
})

describe('blogMetadata (BR10)', () => {
  it('names the page, gives its canonical address on the site, and the cover to share', () => {
    const meta = blogMetadata(BLOG, SITE)
    expect(meta.title).toBe(`${BLOG.title} | OfCourse`)
    expect(meta.description).toBe('48 hours a fortnight in term.')
    expect(meta.alternates?.canonical).toBe(`${SITE}/blog/how-many-hours-can-i-work`)
    expect(meta.openGraph).toMatchObject({
      type: 'article',
      url: `${SITE}/blog/how-many-hours-can-i-work`,
      publishedTime: BLOG.publishedAt,
      modifiedTime: BLOG.updatedAt,
      images: [{ url: `${SITE}/blog/assets/png%20cover`, alt: 'A student at a café counter' }],
    })
    expect(meta.openGraph).not.toHaveProperty('locale')
  })

  it('names a Hindi blog’s language and country for share previews (GD40)', () => {
    expect(blogMetadata({ ...BLOG, language: 'hi' }, SITE).openGraph).toMatchObject({
      locale: 'hi_IN',
    })
  })
})

describe('blogSearchLine (ADR-131, GD39)', () => {
  it('is the search line of the blog’s language, "OfCourse" and the title as written', () => {
    expect(blogSearchLine('Paid work')).toBe('To find this again, search “OfCourse Paid work”')
    expect(blogSearchLine('काम $& पढाइ', 'ne')).toBe('यो फेरि भेट्टाउन “OfCourse काम $& पढाइ” खोज्नुहोस्')
  })
})

describe('blogSitemapEntries (BR10)', () => {
  it('lists every blog still live at its page, last modified when it was last published', () => {
    const rows = [
      { slug: 'kept', approvedAt: '2026-10-13T10:30:00.000Z', settings: GENERAL },
      {
        slug: 'gone',
        approvedAt: new Date(NOW.getTime() - 31 * DAY).toISOString(),
        settings: { ...GENERAL, expiry: { kind: 'days' as const, days: 30 as const } },
      },
    ]
    expect(blogSitemapEntries(rows, NOW, SITE)).toEqual([
      { url: `${SITE}/blog/kept`, lastModified: '2026-10-13T10:30:00.000Z' },
    ])
  })
})

describe('blogAssetPath', () => {
  it('is the public picture route, the id encoded', () => {
    expect(blogAssetPath('a/b c')).toBe('/blog/assets/a%2Fb%20c')
  })
})

describe('feedBlogOf (BR11)', () => {
  it('is the blog as a card: its cover, reading time, tags and the words the search reads', () => {
    const card = feedBlogOf(BLOG)
    expect(card).toMatchObject({
      kind: 'blog',
      id: 'b1',
      title: BLOG.title,
      approvedAt: BLOG.updatedAt,
      settings: GENERAL,
      tags: ['theme:work-study-life'],
      cover: { assetId: 'png cover', alt: 'A student at a café counter' },
      minutes: 1,
    })
    expect(card.text).toContain('What about breaks?')
    expect(card.text).toContain('48 hours a fortnight in term.')
    // Its language, so the feed shows a Thai blog under the Thailand chip (GD40).
    expect(feedBlogOf({ ...BLOG, language: 'th' }).language).toBe('th')
  })
})

describe('relatedBlogs (BR9)', () => {
  const other = (id: string, tags: string[]): LiveBlog => ({ ...BLOG, id, slug: id, tags })

  it('is other blogs sharing a theme, then a destination, at most four, never itself', () => {
    const blog = { ...BLOG, tags: ['theme:work-study-life', 'destination:AU'] }
    const all = [
      blog,
      other('au', ['destination:AU']),
      other('none', ['theme:books-movies']),
      other('t1', ['theme:work-study-life']),
      other('t2', ['theme:work-study-life']),
      other('t3', ['theme:work-study-life']),
      other('t4', ['theme:work-study-life']),
    ]
    expect(relatedBlogs(blog, all).map((b) => b.id)).toEqual(['t1', 't2', 't3', 't4'])
    expect(relatedBlogs(blog, all.slice(0, 4)).map((b) => b.id)).toEqual(['t1', 'au'])
  })
})
