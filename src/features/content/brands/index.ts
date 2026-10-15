// The brand registry. Adding a brand is one JSON file plus one import line here.
// The hex values in these files are brand data drawn into posts, not admin UI colours,
// so the semantic-token rule for the interface does not apply to them.

import { type Brand, BrandSchema } from '../model/types'
import cerebral from './cerebral.json'
import comics from './comics.json'
import feed from './feed.json'
import infographics from './infographics.json'
import main from './main.json'

export const FEED_BRAND: Brand = BrandSchema.parse(feed)

/** The Comics page (RC8): a page brand like the others, though no theme sends a feed post to it. */
export const COMICS_BRAND_ID = 'comics'

/** The art style of comic pictures while the Comics page has no design language of its own. */
export const DEFAULT_COMIC_STYLE =
  'Warm hand-drawn graphic-novel style, clean ink lines, soft flat colours, natural light, expressive faces'

export const PAGE_BRANDS: readonly Brand[] = [main, cerebral, infographics, comics].map((raw) =>
  BrandSchema.parse(raw),
)

/** The pages a feed post may go on or be adapted for: every page but Comics, which takes only comics. */
export const FEED_POST_PAGES: readonly Brand[] = PAGE_BRANDS.filter((b) => b.id !== COMICS_BRAND_ID)

/** Whether the id names a page brand (an Instagram page), not the feed brand or nothing. */
export function isPageBrand(id: string | null | undefined): id is string {
  return PAGE_BRANDS.some((b) => b.id === id)
}

/** Whether a feed post may be made for the page: a page brand, but never Comics (RC7). */
export function isFeedPostPage(id: string | null | undefined): id is string {
  return FEED_POST_PAGES.some((b) => b.id === id)
}

/**
 * The page a post's quote card goes on (criterion 108): the post's own page, or the first page
 * when it has none or its page is Comics, which takes only comics (RC7).
 */
export function quoteCardBrand(pageBrandId: string | null): Brand {
  return FEED_POST_PAGES.find((b) => b.id === pageBrandId) ?? FEED_POST_PAGES[0]
}

export function brandById(id: string): Brand | null {
  return [FEED_BRAND, ...PAGE_BRANDS].find((b) => b.id === id) ?? null
}
