import { describe, expect, it } from 'bun:test'
import type { FeedSettings, LaidSlide } from '../model/types'
import { NATIVE_IDS, nativeOf } from '../text/native-fixtures'
import {
  applyFilters,
  cardSourceLine,
  excerptOf,
  FEATURED_PIN_MS,
  type FeedBlog,
  type FeedItem,
  type FeedPost,
  type FeedVersion,
  type Filters,
  feedCardOf,
  feedOrder,
  feedPage,
  filterHref,
  isLive,
  matchesWords,
  parseFilters,
  parseMarket,
  slideAlt,
  slideWords,
  versionOf,
} from './feed'

const NOW = new Date('2026-10-07T12:00:00.000Z')
const HOUR = 3_600_000
const DAY = 24 * HOUR
/** An ISO time this long before the fixed clock. */
const ago = (ms: number): string => new Date(NOW.getTime() - ms).toISOString()

const GENERAL: FeedSettings = {
  layer: 'general',
  audience: { mode: 'everyone', rules: [] },
  whyLine: null,
  expiry: { kind: 'none' },
  studioLink: null,
  tags: [],
  sourcesAt: 'caption',
}

const MAIN: FeedVersion = {
  excerpt: 'Main excerpt.',
  slides: [{ pngAssetId: 'png-main', alt: 'Slide 1: Main' }],
}
const NEPAL: FeedVersion = {
  excerpt: 'Nepal excerpt.',
  slides: [{ pngAssetId: 'png-np', alt: 'Slide 1: NPR 43,900 a term' }],
}
const INDIA: FeedVersion = {
  excerpt: 'India excerpt.',
  slides: [{ pngAssetId: 'png-in', alt: 'Slide 1: INR 27,800 a term' }],
}

function post(
  id: string,
  approvedAt: string,
  settings: Partial<FeedSettings> = {},
  over: Partial<FeedPost> = {},
): FeedPost {
  return {
    id,
    title: id,
    approvedAt,
    settings: { ...GENERAL, ...settings },
    sourceLine: null,
    sourceId: null,
    courseId: null,
    tags: [],
    main: MAIN,
    market: null,
    instagram: null,
    ...over,
  }
}

/** A live blog as a feed card (BR11). */
function blog(id: string, approvedAt: string, over: Partial<FeedBlog> = {}): FeedBlog {
  return {
    kind: 'blog',
    id,
    title: id,
    slug: id,
    approvedAt,
    settings: GENERAL,
    tags: [],
    cover: null,
    minutes: 4,
    text: `${id} Key takeaways`,
    ...over,
  }
}

const F = (over: Partial<Filters> = {}): Filters => ({
  destination: null,
  home: null,
  theme: null,
  age: null,
  q: '',
  ...over,
})

describe('isLive (73)', () => {
  it('is true with no expiry', () => {
    expect(isLive(post('a', ago(400 * DAY)), NOW)).toBe(true)
  })

  it('counts the days from the approval', () => {
    const days30: Partial<FeedSettings> = { expiry: { kind: 'days', days: 30 } }
    expect(isLive(post('a', ago(31 * DAY), days30), NOW)).toBe(false)
    expect(isLive(post('a', ago(29 * DAY), days30), NOW)).toBe(true)
  })

  it('leaves on the dated day: today or past is out, tomorrow is in', () => {
    const dated = (date: string): Partial<FeedSettings> => ({ expiry: { kind: 'date', date } })
    expect(isLive(post('a', ago(DAY), dated('2026-10-07')), NOW)).toBe(false)
    expect(isLive(post('a', ago(DAY), dated('2026-10-01')), NOW)).toBe(false)
    expect(isLive(post('a', ago(DAY), dated('2026-10-08')), NOW)).toBe(true)
  })
})

describe('feedOrder (71, 72)', () => {
  it('pins a Featured post approved within 72 h, then newest approval first', () => {
    const featuredFresh = post('featured-71h', ago(71 * HOUR), { layer: 'featured' })
    const featuredOld = post('featured-73h', ago(73 * HOUR), { layer: 'featured' })
    const generalNew = post('general-1h', ago(1 * HOUR))
    const generalOld = post('general-50h', ago(50 * HOUR))
    const ordered = feedOrder([generalOld, featuredOld, generalNew, featuredFresh], NOW)
    expect(ordered.map((p) => p.id)).toEqual([
      'featured-71h',
      'general-1h',
      'general-50h',
      'featured-73h',
    ])
  })

  it('leaves out an expired post', () => {
    const expired = post('expired', ago(31 * DAY), { expiry: { kind: 'days', days: 30 } })
    const live = post('live', ago(40 * DAY))
    expect(feedOrder([expired, live], NOW).map((p) => p.id)).toEqual(['live'])
  })

  it('pins for exactly 72 hours', () => {
    expect(FEATURED_PIN_MS).toBe(72 * HOUR)
  })
})

describe('the feed with blogs (BR11, 81)', () => {
  const ids = (items: FeedItem[]) => items.map((i) => i.id)
  const books = blog('blog-books', ago(2 * HOUR), {
    tags: ['theme:books-movies'],
    text: 'Reading lists for your first term',
  })
  const work = blog('blog-work', ago(4 * HOUR), { tags: ['theme:work-study-life'] })
  const posts = [post('post-1h', ago(HOUR)), post('post-3h', ago(3 * HOUR))]

  it('orders blogs among the posts by their last publish, and leaves out an expired one', () => {
    const expired = blog('blog-expired', ago(31 * DAY), {
      settings: { ...GENERAL, expiry: { kind: 'days', days: 30 } },
    })
    expect(ids(feedOrder([...posts, work, books, expired], NOW))).toEqual([
      'post-1h',
      'blog-books',
      'post-3h',
      'blog-work',
    ])
  })

  it('keeps a blog under a chip it carries and drops it under another, as a post', () => {
    const all: FeedItem[] = [...posts, books, work]
    expect(ids(applyFilters(all, F({ theme: 'books-movies' })))).toEqual([
      'post-1h',
      'post-3h',
      'blog-books',
    ])
    expect(ids(applyFilters(all, F({ theme: 'work-study-life' })))).toEqual([
      'post-1h',
      'post-3h',
      'blog-work',
    ])
  })

  it("matches the search words in a blog's words", () => {
    expect(ids(applyFilters([...posts, books, work], F({ q: 'READING first' })))).toEqual([
      'blog-books',
    ])
  })
})

describe('versionOf (76, 82)', () => {
  it('is the market version when the home market is its market, the main one otherwise', () => {
    const nepal = post('a', ago(HOUR), {}, { market: { id: 'NP', version: NEPAL } })
    const india = post('b', ago(HOUR), {}, { market: { id: 'IN', version: INDIA } })
    const without = post('c', ago(HOUR))
    expect(versionOf(nepal, 'NP')).toBe(NEPAL)
    expect(versionOf(india, 'IN')).toBe(INDIA)
    expect(versionOf(india, 'NP')).toBe(MAIN)
    expect(versionOf(nepal, 'IN')).toBe(MAIN)
    expect(versionOf(without, 'NP')).toBe(MAIN)
    expect(versionOf(nepal, null)).toBe(MAIN)
  })
})

describe('parseMarket', () => {
  it('reads a known market id in any case', () => {
    expect(parseMarket('NP')).toBe('NP')
    expect(parseMarket('np')).toBe('NP')
    expect(parseMarket('in')).toBe('IN')
  })

  it('is null for anything else', () => {
    expect(parseMarket('XX')).toBeNull()
    expect(parseMarket(undefined)).toBeNull()
    expect(parseMarket(['NP'])).toBeNull()
    expect(parseMarket('')).toBeNull()
  })
})

describe('parseFilters (81, 83)', () => {
  it('reads a known tag value per group, the home market in any case, and the trimmed words', () => {
    expect(
      parseFilters({
        destination: 'AU',
        home: 'np',
        theme: 'books-movies',
        age: '21-25',
        q: '  Rent in  Manchester ',
      }),
    ).toEqual({
      destination: 'AU',
      home: 'NP',
      theme: 'books-movies',
      age: '21-25',
      q: 'Rent in  Manchester',
      chosen: true,
    })
  })

  it('says whether the URL named its filters: any filter key, even an empty one (84)', () => {
    expect(parseFilters({}).chosen).toBe(false)
    expect(parseFilters({ q: '' }).chosen).toBe(true)
    expect(parseFilters({ home: '' }).chosen).toBe(true)
    expect(parseFilters({ market: 'NP' }).chosen).toBe(false)
  })

  it('drops a value the tag file lacks, a repeated key and a missing one', () => {
    expect(
      parseFilters({ destination: 'XX', home: ['NP'], theme: 'cats', age: undefined, q: ['a'] }),
    ).toEqual(F({ chosen: true }))
    expect(parseFilters({})).toEqual(F({ chosen: false }))
  })

  it('bounds the words', () => {
    expect(parseFilters({ q: 'a'.repeat(300) }).q).toHaveLength(100)
  })

  it('bounds Nepali, Hindi or Thai words at 100 characters as a reader sees them, never cutting one (GD40)', () => {
    for (const id of NATIVE_IDS) {
      expect(parseFilters({ q: nativeOf(id, 150) }).q, id).toBe(nativeOf(id, 100))
    }
  })
})

describe('applyFilters (81, 83)', () => {
  const au = post('au', ago(HOUR), {}, { tags: ['destination:AU'] })
  const auBooks = post(
    'au-books',
    ago(2 * HOUR),
    {},
    { tags: ['destination:AU', 'theme:books-movies'] },
  )
  const uk = post('uk', ago(3 * HOUR), {}, { tags: ['destination:UK'] })
  const ukBooks = post(
    'uk-books',
    ago(4 * HOUR),
    {},
    { tags: ['destination:UK', 'theme:books-movies'] },
  )
  const untagged = post('untagged', ago(5 * HOUR))
  const all = [au, auBooks, uk, ukBooks, untagged]
  const ids = (posts: FeedPost[]) => posts.map((p) => p.id)

  it('keeps the posts tagged with the chip or untagged in its group, in their order', () => {
    expect(ids(applyFilters(all, F({ destination: 'AU' })))).toEqual(['au', 'au-books', 'untagged'])
  })

  it('combines chips across groups', () => {
    expect(ids(applyFilters(all, F({ destination: 'AU', theme: 'books-movies' })))).toEqual([
      'au',
      'au-books',
      'untagged',
    ])
    expect(ids(applyFilters(all, F({ destination: 'UK', theme: 'work-study-life' })))).toEqual([
      'uk',
      'untagged',
    ])
  })

  it('combines the words with the chips, and leaves everything with no filter', () => {
    expect(ids(applyFilters(all, F()))).toEqual(ids(all))
    expect(ids(applyFilters(all, F({ destination: 'AU', q: 'au-books' })))).toEqual(['au-books'])
    expect(applyFilters(all, F({ destination: 'AU', q: 'nothing here' }))).toEqual([])
  })
})

describe('applyFilters by language (GD40)', () => {
  const nepali = post('ne', ago(HOUR), {}, { language: 'ne', tags: ['home:NP'] })
  const english = post('en', ago(2 * HOUR), {}, { language: 'en' })
  const ids = (items: FeedItem[]) => items.map((i) => i.id)

  it('shows a Nepali post under home NP and not under IN; an English post under both', () => {
    expect(ids(applyFilters([nepali, english], F({ home: 'NP' })))).toEqual(['ne', 'en'])
    expect(ids(applyFilters([nepali, english], F({ home: 'IN' })))).toEqual(['en'])
  })

  it('shows a Nepali post only under its home chip, without one and with its tag removed', () => {
    const untagged = post('ne-untagged', ago(HOUR), {}, { language: 'ne' })
    expect(ids(applyFilters([nepali, untagged, english], F()))).toEqual(['en'])
    expect(ids(applyFilters([untagged], F({ home: 'NP' })))).toEqual(['ne-untagged'])
    expect(ids(applyFilters([untagged], F({ home: 'TH' })))).toEqual([])
  })

  it('reads a Thai blog card as a Thai post', () => {
    const thai = blog('blog-th', ago(HOUR), { language: 'th' })
    expect(ids(applyFilters([thai], F({ home: 'TH' })))).toEqual(['blog-th'])
    expect(ids(applyFilters([thai], F({ home: 'NP' })))).toEqual([])
  })
})

describe('matchesWords (83)', () => {
  const rent = post(
    'rent',
    ago(HOUR),
    {},
    { title: 'Rent in Manchester', market: { id: 'NP', version: NEPAL } },
  )

  it('needs every word, in the title, the excerpt or a slide, whatever the case', () => {
    expect(matchesWords(rent, null, 'rent manchester')).toBe(true)
    expect(matchesWords(rent, null, 'RENT')).toBe(true)
    expect(matchesWords(rent, null, 'main excerpt')).toBe(true)
    expect(matchesWords(rent, null, 'rent london')).toBe(false)
    expect(matchesWords(rent, null, '')).toBe(true)
  })

  it('finds a Hindi word typed with its nukta letter in one code point or two, and a Thai word inside a line (GD40)', () => {
    // ज़ written as ज + ़ in the post and as the single letter ज़ (U+095B) in the search, and back.
    const hindi = post('hi', ago(HOUR), {}, { title: 'ज़रूरी काम के घंटे' })
    expect(matchesWords(hindi, null, 'ज़रूरी')).toBe(true)
    expect(matchesWords(hindi, null, 'ज़रूरी घंटे')).toBe(true)
    const precomposed = post('hi2', ago(HOUR), {}, { title: 'ज़रूरी काम' })
    expect(matchesWords(precomposed, null, 'ज़रूरी')).toBe(true)
    const thai = post('th', ago(HOUR), {}, { title: 'นักศึกษาทำงานพิเศษได้' })
    expect(matchesWords(thai, null, 'ทำงานพิเศษ')).toBe(true)
  })

  it("reads the version shown: the Nepal version's slide text under home=NP, the main one otherwise", () => {
    expect(matchesWords(rent, 'NP', 'npr')).toBe(true)
    expect(matchesWords(rent, 'NP', 'nepal excerpt')).toBe(true)
    expect(matchesWords(rent, null, 'npr')).toBe(false)
    expect(matchesWords(rent, 'IN', 'npr')).toBe(false)
    expect(matchesWords(rent, 'NP', 'main excerpt')).toBe(false)
  })
})

describe('filterHref (81)', () => {
  it('changes one filter and keeps the others, in a fixed order', () => {
    expect(filterHref('/feed', F({ home: 'NP', q: 'rent' }), { theme: 'books-movies' })).toBe(
      '/feed?home=NP&theme=books-movies&q=rent',
    )
    expect(filterHref('/feed/p1', F({ home: 'NP' }), {})).toBe('/feed/p1?home=NP')
  })

  it('leaves out a cleared or empty filter and encodes the words', () => {
    expect(filterHref('/feed/p1', F({ home: 'NP', q: 'rent' }), { home: null })).toBe(
      '/feed/p1?q=rent',
    )
    expect(filterHref('/feed', F(), {})).toBe('/feed')
    expect(filterHref('/feed', F(), { q: 'rent & bills' })).toBe('/feed?q=rent+%26+bills')
  })

  it('keeps naming the filters once the student chose, so an emptied URL is not a bare one (84)', () => {
    // Clear on the last chip, and any link from a page whose URL named its filters.
    expect(filterHref('/feed/p1', F({ home: 'NP' }), { home: null })).toBe('/feed/p1?q=')
    expect(filterHref('/feed/p1', F({ chosen: true }), {})).toBe('/feed/p1?q=')
    // A page opened bare links bare.
    expect(filterHref('/feed/p1', F({ chosen: false }), {})).toBe('/feed/p1')
  })
})

describe('excerptOf (71)', () => {
  const slot = (text: string) => ({ text, factIds: [], factual: false })
  const structure = (...bodies: string[]) => ({
    templateId: 'the-line',
    artPrompt: 'A desk.',
    slides: [
      { kind: 'cover' as const, slots: { headline: slot('Headline') } },
      ...bodies.map((text) => ({ kind: 'body' as const, slots: { body: slot(text) } })),
    ],
  })

  it('is the first body slot with words, as the card and the phone preview show it', () => {
    expect(excerptOf(structure('', 'The first words.', 'Later words.'))).toBe('The first words.')
  })

  it('is empty when no slide has a body slot with words', () => {
    expect(excerptOf(structure())).toBe('')
    expect(excerptOf(structure(''))).toBe('')
  })
})

describe('slide alt text (75)', () => {
  const laid: LaidSlide = {
    kind: 'body',
    lines: [
      {
        slot: 'body',
        text: 'Grades hold',
        x: 0,
        y: 0,
        fontPx: 40,
        font: 'body',
        mark: 'none',
        width: 1,
      },
      {
        slot: 'body',
        text: 'up to 20 hours a week.',
        x: 0,
        y: 1,
        fontPx: 40,
        font: 'body',
        mark: 'none',
        width: 1,
      },
      {
        slot: 'search',
        text: 'To find this again, search',
        x: 0,
        y: 2,
        fontPx: 38,
        font: 'body',
        mark: 'none',
        width: 1,
      },
      {
        slot: 'search',
        text: '“OfCourse Study”',
        x: 0,
        y: 3,
        fontPx: 38,
        font: 'body',
        mark: 'none',
        width: 1,
      },
    ],
    artBox: null,
    sourceLine: 'Source: Study',
    searchLine: 'To find this again, search “OfCourse Study”',
  }

  it('reads each line, then the source line, then the search line once (criterion 106)', () => {
    expect(slideWords(laid)).toEqual([
      'Grades hold',
      'up to 20 hours a week.',
      'Source: Study',
      'To find this again, search “OfCourse Study”',
    ])
    expect(slideWords({ ...laid, searchLine: null, lines: laid.lines.slice(0, 2) })).toEqual([
      'Grades hold',
      'up to 20 hours a week.',
      'Source: Study',
    ])
    expect(slideWords(undefined)).toEqual([])
  })

  it('names the slide by its words, or by its number alone', () => {
    expect(slideAlt(2, slideWords(laid))).toBe(
      'Slide 2: Grades hold up to 20 hours a week. Source: Study To find this again, search “OfCourse Study”',
    )
    expect(slideAlt(1, undefined)).toBe('Slide 1')
    expect(slideAlt(1, ['  '])).toBe('Slide 1')
  })
})

describe('cardSourceLine (71)', () => {
  const laid = (sourceLine: string | null, fullSourceLine?: string): LaidSlide => ({
    kind: 'body',
    lines: [],
    artBox: null,
    sourceLine,
    searchLine: null,
    ...(fullSourceLine ? { fullSourceLine } : {}),
  })

  it('shows the whole line a slide had to shorten beside its frame: the card has room for it', () => {
    expect(
      cardSourceLine([
        laid(null),
        laid('Source: Paid work, money firs… · ¶1', 'Source: Paid work, money first · ¶1'),
        laid('Source: Paid work, money first'),
      ]),
    ).toBe('Source: Paid work, money first · ¶1')
  })

  it('shows the drawn line when it was whole, and none when no slide has one', () => {
    expect(cardSourceLine([laid(null), laid('Source: Guide · ¶2')])).toBe('Source: Guide · ¶2')
    expect(cardSourceLine([laid(null)])).toBeNull()
  })
})

describe("feedPage (the feed's infinite scroll)", () => {
  const ids = (items: FeedItem[]) => items.map((i) => i.id)
  const ten = Array.from({ length: 10 }, (_, i) => post(`p${i}`, ago((i + 1) * HOUR)))

  it('keeps the order it is given and takes `size` items from `offset`', () => {
    expect(ids(feedPage(ten, F(), 0, 4))).toEqual(['p0', 'p1', 'p2', 'p3'])
    expect(ids(feedPage(ten, F(), 4, 4))).toEqual(['p4', 'p5', 'p6', 'p7'])
    expect(ids(feedPage([...ten].reverse(), F(), 0, 2))).toEqual(['p9', 'p8'])
  })

  it('applies the filters before slicing, so the offset counts only what the filters leave', () => {
    const tagged = ten.map((p, i) => ({
      ...p,
      tags: [i % 2 ? 'theme:books-movies' : 'theme:work-study-life'],
    }))
    // Under Books and movies only the odd ones stay: p1, p3, p5, p7, p9.
    expect(ids(feedPage(tagged, F({ theme: 'books-movies' }), 0, 2))).toEqual(['p1', 'p3'])
    expect(ids(feedPage(tagged, F({ theme: 'books-movies' }), 2, 2))).toEqual(['p5', 'p7'])
  })

  it('returns a short last page, and nothing past the end', () => {
    expect(ids(feedPage(ten, F(), 8, 4))).toEqual(['p8', 'p9'])
    expect(feedPage(ten, F(), 12, 4)).toEqual([])
  })
})

describe('feedCardOf (what a feed card shows, and all the browser is sent)', () => {
  it('shapes a post with the version the home chip asks for and the first line of its excerpt', () => {
    const p = post(
      'p1',
      ago(HOUR),
      { layer: 'personal', whyLine: 'You weighted work rights.' },
      {
        title: 'Paid work',
        sourceLine: 'Source: Guide · ¶2',
        language: 'ne',
        main: { excerpt: 'First line.\nSecond line.', slides: MAIN.slides },
        market: { id: 'NP', version: NEPAL },
        sources: [{ site: null, title: 'Guide', url: 'https://example.org' }],
      },
    )
    expect(feedCardOf(p, null)).toEqual({
      kind: 'post',
      id: 'p1',
      title: 'Paid work',
      page: 'OfCourse',
      layer: 'personal',
      whyLine: 'You weighted work rights.',
      language: 'ne',
      line: 'First line.',
      slides: MAIN.slides,
      sourceLine: 'Source: Guide · ¶2',
    })
    expect(feedCardOf(p, 'NP')).toMatchObject({ line: 'Nepal excerpt.', slides: NEPAL.slides })
  })

  it('names the Instagram page a post went out under, else OfCourse', () => {
    const instagram = {
      url: 'https://www.instagram.com/p/x/',
      handle: 'ofcourse.main',
      pageUrl: 'https://www.instagram.com/ofcourse.main/',
    }
    expect(feedCardOf(post('p1', ago(HOUR), {}, { instagram }), null)).toMatchObject({
      page: '@ofcourse.main',
    })
  })

  it('shapes a blog with its cover and reading time, without its words or settings', () => {
    const b = blog('b1', ago(HOUR), {
      title: 'How many hours?',
      cover: { assetId: 'png-cover', alt: 'A café counter' },
      minutes: 6,
      language: 'th',
    })
    expect(feedCardOf(b, 'NP')).toEqual({
      kind: 'blog',
      id: 'b1',
      title: 'How many hours?',
      cover: { assetId: 'png-cover', alt: 'A café counter' },
      language: 'th',
      minutes: 6,
    })
  })
})
