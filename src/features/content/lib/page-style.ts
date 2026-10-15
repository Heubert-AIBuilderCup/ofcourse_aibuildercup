// A page's design language (criterion 105): the limits the Page styles screen and the server
// share. Pure and client-safe; the server checks every one of them again (server/page-style.ts).

/** The longest art or copy style: "short strings", one or two sentences. */
export const STYLE_MAX = 240
/** The most reference images a page keeps. */
export const REFERENCES_MAX = 2
/** The largest reference image: 5 MB. */
export const REFERENCE_MAX_BYTES = 5 * 1024 * 1024
/** The reference images a page takes, by MIME type. */
export const REFERENCE_TYPES = ['image/png', 'image/jpeg'] as const
export type ReferenceType = (typeof REFERENCE_TYPES)[number]

export const PAGE_STYLE_ERRORS = {
  brand: 'Choose one of the pages.',
  images: 'Upload one or two images.',
  type: 'Upload PNG or JPEG images only.',
  size: 'Each image is at most 5 MB.',
  fields:
    'Write the art style and the copy style, up to 240 characters each, and choose a template.',
  artStyle: 'The art style carries no numbers, quotation marks or brand names.',
} as const
