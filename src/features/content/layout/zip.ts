// The social export: a zip of the render's stored slides and the caption, and its file name.
// Pure: it packs the bytes it is given, so the zip holds exactly what was rendered and checked.

import { strToU8, zipSync } from 'fflate'

/** Lower-case ASCII words joined by dashes: accents dropped, everything else a separator. */
function slug(text: string, fallback: string): string {
  const out = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return out || fallback
}

/**
 * `<page>_<post>_<platform>.zip`, or `<page>_<post>_slides.zip` for a feed post's slides (Images
 * on), safe to put in a Content-Disposition header as it is.
 */
export function exportName(
  page: string,
  postTitle: string,
  platform: 'instagram' | 'linkedin' | 'slides',
): string {
  return `${slug(page, 'page')}_${slug(postTitle, 'post')}_${platform}.zip`
}

/** slide-1.svg, slide-1.png, …, then caption.txt when there is a caption. */
export function exportZip(files: {
  svgs: string[]
  pngs: Uint8Array[]
  caption?: string
}): Uint8Array {
  const entries: Record<string, Uint8Array> = {}
  files.svgs.forEach((svg, i) => {
    entries[`slide-${i + 1}.svg`] = strToU8(svg)
    entries[`slide-${i + 1}.png`] = files.pngs[i]
  })
  if (files.caption !== undefined) entries['caption.txt'] = strToU8(files.caption)
  return zipSync(entries)
}
