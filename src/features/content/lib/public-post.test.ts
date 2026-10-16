import { describe, expect, it } from 'bun:test'
import type { FeedSettings } from '../model/types'
import {
  freeSlug,
  isSlug,
  type PublicPost,
  postAssetPath,
  postMetadata,
  SLUG_MAX,
  sitemapEntries,
  slugOf,
} from './public-post'

// A live post's public page (criterion 107, ADR-131): its slug from the title, its metadata (the
// page title Google shows and the cover as the share image) and the sitemap's entries.

const SITE = 'https://ofcourse.example'
const NOW = new Date('2026-10-09T12:00:00.000Z')
const DAY = 86_400_000

const GENERAL: FeedSettings = {
  layer: 'general',
  audience: { mode: 'everyone', rules: [] },
  whyLine: null,
  expiry: { kind: 'none' },
  studioLink: null,
  tags: [],
  sourcesAt: 'caption',
}

const POST: PublicPost = {
  id: 'p1',
  slug: 'paid-work-in-the-feed',
  title: 'Paid work, in the feed',
  approvedAt: '2026-10-08T09:00:00.000Z',
  settings: GENERAL,
  sourceLine: 'Source: Paid work · ¶1',
  searchLine: 'To find this again, search “OfCourse Paid work, in the feed”',
  sourceId: null,
  courseId: null,
  tags: [],
  main: {
    excerpt: 'Up to 48 hours a fortnight while your course is on.',
    slides: [
      { pngAssetId: 'png cover', alt: 'Slide 1: Paid work' },
      { pngAssetId: 'png-2', alt: 'Slide 2: 48 hours' },
    ],
  },
  market: null,
  instagram: null,
}

describe('slugOf', () => {
  it('is the title in lowercase ascii words joined by hyphens', () => {
    expect(slugOf('Paid work, in the feed')).toBe('paid-work-in-the-feed')
    expect(slugOf('  Rent: “bond” & 4 weeks — what to ask?  ')).toBe(
      'rent-bond-4-weeks-what-to-ask',
    )
  })

  it('keeps accented letters as their plain ones', () => {
    expect(slugOf('Café naïve résumé')).toBe('cafe-naive-resume')
  })

  it('is "post" when the title has no ascii letter or digit', () => {
    expect(slugOf('日本の家賃')).toBe('post')
    expect(slugOf('—')).toBe('post')
  })

  it(`stops at ${SLUG_MAX} characters, never on a hyphen`, () => {
    const slug = slugOf(`${'word '.repeat(40)}end`)
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX)
    expect(slug.endsWith('-')).toBe(false)
    expect(slug.startsWith('word-word')).toBe(true)
  })
})

describe('freeSlug', () => {
  it('is the base when no post has it', () => {
    expect(freeSlug('rent', [])).toBe('rent')
    expect(freeSlug('rent', ['rent-2'])).toBe('rent')
  })

  it('numbers the second post with the same title from 2, taking the first free number', () => {
    expect(freeSlug('rent', ['rent'])).toBe('rent-2')
    expect(freeSlug('rent', ['rent', 'rent-2', 'rent-4'])).toBe('rent-3')
  })

  it('never hands out "assets", the image route beside the post pages', () => {
    expect(freeSlug('assets', [])).toBe('assets-2')
  })
})

describe('isSlug', () => {
  it('accepts what slugOf and freeSlug make', () => {
    expect(isSlug('paid-work-in-the-feed')).toBe(true)
    expect(isSlug('rent-2')).toBe(true)
    expect(isSlug('post')).toBe(true)
  })

  it('refuses anything else before the database is asked', () => {
    for (const value of ['', 'Rent', 'rent--2', '-rent', 'rent-', 'a/b', 'r%20', 'x'.repeat(100)]) {
      expect(isSlug(value)).toBe(false)
    }
  })
})

describe('postMetadata', () => {
  const meta = postMetadata(POST, SITE)
  const cover = `${SITE}/posts/assets/png%20cover`

  it('titles the page "<title> | OfCourse", the words a reader searches for', () => {
    expect(meta.title).toBe('Paid work, in the feed | OfCourse')
  })

  it('describes it with the excerpt and names its canonical URL on the site', () => {
    expect(meta.description).toBe(POST.main.excerpt)
    expect(meta.alternates?.canonical).toBe(`${SITE}/posts/paid-work-in-the-feed`)
  })

  it('shares the cover slide through the public image route, on Open Graph and Twitter', () => {
    expect(meta.openGraph).toMatchObject({
      title: 'Paid work, in the feed | OfCourse',
      url: `${SITE}/posts/paid-work-in-the-feed`,
      siteName: 'OfCourse',
      images: [{ url: cover, width: 1080, height: 1350, alt: 'Slide 1: Paid work' }],
    })
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image', images: [cover] })
  })

  it('cuts a long excerpt to a search snippet, and falls back to the title without one', () => {
    const long = postMetadata(
      { ...POST, main: { ...POST.main, excerpt: 'word '.repeat(60) } },
      SITE,
    )
    expect(String(long.description).length).toBeLessThanOrEqual(160)
    expect(String(long.description).endsWith('…')).toBe(true)
    const none = postMetadata({ ...POST, main: { ...POST.main, excerpt: '' } }, SITE)
    expect(none.description).toBe('Paid work, in the feed, on OfCourse.')
  })

  it('names a Nepali, Hindi or Thai page’s language and country for share previews, none for English (GD40)', () => {
    expect(postMetadata({ ...POST, language: 'ne' }, SITE).openGraph).toMatchObject({
      locale: 'ne_NP',
    })
    expect(postMetadata({ ...POST, language: 'th' }, SITE).openGraph).toMatchObject({
      locale: 'th_TH',
    })
    expect(meta.openGraph).not.toHaveProperty('locale')
  })

  it('never carries the audience, the layer or the why line', () => {
    const personal = postMetadata(
      {
        ...POST,
        settings: {
          ...GENERAL,
          layer: 'personal',
          whyLine: 'Because you plan to work',
          audience: { mode: 'matched', rules: [] },
        },
      },
      SITE,
    )
    const text = JSON.stringify(personal)
    expect(text).not.toContain('Because you plan to work')
    expect(text).not.toContain('personal')
    expect(text).not.toContain('matched')
  })
})

describe('postAssetPath', () => {
  it('is the public image route, the id encoded', () => {
    expect(postAssetPath('a/b c')).toBe('/posts/assets/a%2Fb%20c')
  })
})

describe('sitemapEntries', () => {
  it('lists each live post at its URL with its approval date, and leaves an expired one out', () => {
    const rows = [
      { slug: 'kept', approvedAt: '2026-10-01T00:00:00.000Z', settings: GENERAL },
      {
        slug: 'expired',
        approvedAt: '2026-09-01T00:00:00.000Z',
        settings: { ...GENERAL, expiry: { kind: 'days' as const, days: 30 as const } },
      },
      {
        slug: 'running',
        approvedAt: new Date(NOW.getTime() - 2 * DAY).toISOString(),
        settings: { ...GENERAL, expiry: { kind: 'days' as const, days: 30 as const } },
      },
    ]
    expect(sitemapEntries(rows, NOW, SITE)).toEqual([
      { url: `${SITE}/posts/kept`, lastModified: '2026-10-01T00:00:00.000Z' },
      { url: `${SITE}/posts/running`, lastModified: rows[2].approvedAt },
    ])
  })
})
