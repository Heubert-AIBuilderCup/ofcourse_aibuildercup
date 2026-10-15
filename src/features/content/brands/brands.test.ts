import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { BrandSchema } from '../model/types'
import { PAGE_RULES } from '../pages'
import {
  brandById,
  COMICS_BRAND_ID,
  FEED_BRAND,
  isFeedPostPage,
  isPageBrand,
  PAGE_BRANDS,
  quoteCardBrand,
} from './index'

const FONTS_DIR = join(import.meta.dir, '..', 'assets', 'fonts')

describe('brands', () => {
  it('parse with BrandSchema', () => {
    for (const b of [FEED_BRAND, ...PAGE_BRANDS])
      expect(BrandSchema.safeParse(b).success).toBe(true)
  })

  it('gives the feed its three themes and the page brands one each', () => {
    expect(FEED_BRAND.themes.map((t) => t.name)).toEqual(['Paper', 'Ink', 'Signal'])
    expect(PAGE_BRANDS.map((b) => b.id)).toEqual(['main', 'cerebral', 'infographics', 'comics'])
    for (const b of PAGE_BRANDS) expect(b.themes).toHaveLength(1)
  })

  it('puts the quote card on the post’s own page, or the first page when it has none (108)', () => {
    expect(quoteCardBrand('cerebral').id).toBe('cerebral')
    expect(quoteCardBrand(null).id).toBe('main')
    expect(quoteCardBrand('feed').id).toBe('main')
  })

  it('never puts a feed post’s quote card on the Comics page (RC7)', () => {
    expect(quoteCardBrand(COMICS_BRAND_ID).id).toBe('main')
  })

  it('lets a feed post go on every page but Comics, and nothing that is not a page (RC7)', () => {
    for (const id of ['main', 'cerebral', 'infographics']) expect(isFeedPostPage(id)).toBe(true)
    for (const id of [COMICS_BRAND_ID, 'feed', 'nope', null, undefined])
      expect(isFeedPostPage(id)).toBe(false)
  })

  it('gives each page brand its Instagram handle and URL, and the feed none (88, ADR-124)', () => {
    expect(PAGE_BRANDS.map((b) => [b.id, b.instagram?.handle])).toEqual([
      ['main', 'ofcourse_ai'],
      ['cerebral', 'ofcourse_philosophy'],
      ['infographics', 'ofcourse_selfhelp'],
      ['comics', 'ofcourse_comics'],
    ])
    for (const b of PAGE_BRANDS) {
      expect(b.instagram?.url).toBe(`https://www.instagram.com/${b.instagram?.handle}/`)
    }
    expect(FEED_BRAND.instagram).toBeNull()
  })

  it('refuses a handle Instagram would not have, and reads a brand saved without one as none', () => {
    const [main] = PAGE_BRANDS
    for (const handle of ['Of Course', 'ofcourse-ai', '', 'a'.repeat(31)]) {
      const parsed = BrandSchema.safeParse({
        ...main,
        instagram: { handle, url: 'https://www.instagram.com/x/' },
      })
      expect(parsed.success).toBe(false)
    }
    const { instagram: _dropped, ...frozen } = main
    expect(BrandSchema.parse(frozen).instagram).toBeNull()
  })

  it('gives each page brand a LinkedIn page over https, the feed none, and reads a brand without one as none (BR9)', () => {
    for (const b of PAGE_BRANDS) {
      expect(b.linkedin?.url).toStartWith('https://www.linkedin.com/company/')
    }
    expect(FEED_BRAND.linkedin).toBeNull()
    const [main] = PAGE_BRANDS
    for (const url of ['javascript:alert(1)', 'http://www.linkedin.com/company/x/', 'nope']) {
      expect(BrandSchema.safeParse({ ...main, linkedin: { url } }).success).toBe(false)
    }
    const { linkedin: _dropped, ...frozen } = main
    expect(BrandSchema.parse(frozen).linkedin).toBeNull()
  })

  it('lists the Comics page with the pages, in Main’s fonts and theme, and sends no feed post to it (RC8)', () => {
    const comics = brandById(COMICS_BRAND_ID)
    expect(comics?.kind).toBe('page')
    expect(isPageBrand(COMICS_BRAND_ID)).toBe(true)
    expect(comics?.fonts).toEqual(brandById('main')?.fonts)
    expect(comics?.themes).toEqual(brandById('main')?.themes)
    expect(Object.values(PAGE_RULES)).not.toContain(COMICS_BRAND_ID)
  })

  it('finds a brand by id', () => {
    expect(brandById('feed')).toBe(FEED_BRAND)
    expect(brandById('cerebral')?.name).toBe('Cerebral')
    expect(brandById('nope')).toBeNull()
  })

  it('has every font file on disk', () => {
    for (const b of [FEED_BRAND, ...PAGE_BRANDS]) {
      expect(existsSync(join(FONTS_DIR, b.fonts.heading.file))).toBe(true)
      expect(existsSync(join(FONTS_DIR, b.fonts.body.file))).toBe(true)
    }
    expect(existsSync(join(FONTS_DIR, 'OFL.txt'))).toBe(true)
  })
})
