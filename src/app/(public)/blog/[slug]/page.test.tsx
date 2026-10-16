/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import type { LanguageId } from '@/features/content/languages'
import type { LiveBlog } from '@/features/content/server/store'

// A live blog's public page with the store mocked and nobody signed in (BR9, BR10): it renders
// for anyone, with its structured data and its canonical address; a blog the store does not read
// as live (not published, expired, or no blog at the slug) is "not found", and anything not
// shaped like a slug never reaches the store. No session is read.

const BLOG: LiveBlog = {
  id: 'b1',
  title: 'How many hours can I work on a student visa?',
  slug: 'how-many-hours',
  publishedAt: '2026-10-12T09:00:00.000Z',
  updatedAt: '2026-10-13T10:30:00.000Z',
  settings: {
    layer: 'general',
    audience: { mode: 'everyone', rules: [] },
    whyLine: 'Only for students who work.',
    expiry: { kind: 'none' },
    studioLink: null,
    tags: ['theme:work-study-life'],
    sourcesAt: 'caption',
  },
  tags: ['theme:work-study-life'],
  sections: [{ heading: 'What is the limit?', body: 'Up to 48 hours a fortnight.' }],
  takeaways: ['48 hours a fortnight in term.'],
  faq: [{ q: 'Who checks? </script>', a: 'The Department of Home Affairs.' }],
  pictures: [{ target: 'cover', assetId: 'png-cover', alt: 'A student at a café counter' }],
  embeds: [],
  sources: [],
  posts: [],
}
const RELATED: LiveBlog = { ...BLOG, id: 'b2', slug: 'rent-near-campus', title: 'Rent near campus' }

const read: string[] = []
let sessions = 0
/** The language the store reads the blog in; English unless a test says otherwise. */
let language: LanguageId = 'en'

mock.module('@/shared/components/ThemeToggle', () => ({ ThemeToggle: () => null }))
mock.module('@/shared/lib/auth/session', () => ({
  getSession: async () => {
    sessions++
    return null
  },
}))
// Other route tests mock this module too: a mocked module keeps the export names of whichever
// mock runs first, so all of them name the same set.
mock.module('@/features/content/server/store', () => ({
  isLiveAsset: async () => false,
  isLiveBlogAsset: async () => false,
  getAsset: async () => null,
  loadPost: async () => null,
  getAssets: async () => new Map(),
  liveBlogBySlug: async (slug: string) => {
    read.push(slug)
    return slug === BLOG.slug ? { ...BLOG, language } : null
  },
  liveBlogs: async () => [BLOG, RELATED],
}))

const { default: Page, generateMetadata } = await import('./page')

const props = (slug: string) => ({ params: Promise.resolve({ slug }) }) as never

/** The status a page threw through notFound(), or null when it did not. */
async function thrown(slug: string): Promise<string | null> {
  try {
    await Page(props(slug))
    return null
  } catch (error) {
    return String((error as { digest?: string }).digest)
  }
}

beforeEach(() => {
  read.length = 0
  sessions = 0
  language = 'en'
})
afterEach(cleanup)

describe('/blog/[slug]', () => {
  test('a live blog renders signed out, with its parts, its structured data and no session read', async () => {
    render(await Page(props(BLOG.slug)))
    expect(screen.getByRole('heading', { level: 1, name: BLOG.title })).toBeInTheDocument()
    expect(screen.getByText('48 hours a fortnight in term.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'What is the limit?' })).toBeInTheDocument()
    expect(screen.getByText('Who checks? </script>')).toBeInTheDocument()
    expect(screen.getByText(`To find this again, search “OfCourse ${BLOG.title}”`)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Rent near campus' })).toHaveAttribute(
      'href',
      '/blog/rent-near-campus',
    )
    expect(screen.getByRole('img', { name: 'A student at a café counter' })).toHaveAttribute(
      'src',
      '/blog/assets/png-cover',
    )
    // Never the audience, layer or why line.
    expect(screen.queryByText('Only for students who work.')).toBeNull()

    const script = document.querySelector('script[type="application/ld+json"]')
    expect(script?.innerHTML).not.toContain('</script>')
    const data = JSON.parse(script?.textContent ?? '[]') as { '@type': string }[]
    expect(data.map((d) => d['@type'])).toEqual(['Article', 'FAQPage'])
    expect(sessions).toBe(0)
  })

  test('its metadata gives the canonical address', async () => {
    const meta = await generateMetadata(props(BLOG.slug))
    expect(String(meta.alternates?.canonical)).toEndWith('/blog/how-many-hours')
  })

  test('a Nepali blog sets its language on its words and in its metadata, its search line in Nepali (GD39, GD40)', async () => {
    language = 'ne'
    render(await Page(props(BLOG.slug)))
    expect(screen.getByRole('article')).toHaveAttribute('lang', 'ne')
    expect(screen.getByText(`यो फेरि भेट्टाउन “OfCourse ${BLOG.title}” खोज्नुहोस्`)).toHaveAttribute(
      'lang',
      'ne',
    )
    const meta = await generateMetadata(props(BLOG.slug))
    expect(meta.openGraph).toMatchObject({ locale: 'ne_NP' })
  })

  test('a blog not published, expired or unknown (the store reads none) is 404', async () => {
    expect(await thrown('not-live')).toStartWith('NEXT_HTTP_ERROR_FALLBACK;404')
    expect(read).toEqual(['not-live'])
  })

  test('anything not shaped like a slug is 404 before the store is asked', async () => {
    expect(await thrown('Not A Slug')).toStartWith('NEXT_HTTP_ERROR_FALLBACK;404')
    expect(await thrown('../admin')).toStartWith('NEXT_HTTP_ERROR_FALLBACK;404')
    expect(read).toEqual([])
  })
})
