// Which link a paragraph came from, for a source read from several (GD19). Pure and client-safe:
// the layout engine's source line, the fact rows and chips, and the source pane read the same parts.

/** The parts of a source read from links, as far as the sites need them (model/artifacts.ts). */
export type SitedSource = {
  parts?: { site: string; title?: string; from: number; to: number }[]
} & Record<string, unknown>

/** The paragraph number of a ref: ¶4 and the sentence ¶4.2 are both 4; anything else none. */
function paragraphNumber(ref: string): number | null {
  const n = /^¶(\d+)(?:\.\d+)?$/.exec(ref)?.[1]
  return n === undefined ? null : Number(n)
}

/** The site of the part whose paragraphs hold `ref` (GD19); none for a source with no parts. */
export function paragraphSite(source: SitedSource, ref: string): string | null {
  const n = paragraphNumber(ref)
  if (n === null) return null
  return source.parts?.find((p) => n >= p.from && n <= p.to)?.site ?? null
}

/** Every paragraph of the source's parts to its site, for `layoutStructure`; none with no parts. */
export function paragraphSites(source: SitedSource): Record<string, string> | undefined {
  if (!source.parts?.length) return undefined
  const sites: Record<string, string> = {}
  for (const part of source.parts) {
    for (let n = part.from; n <= part.to; n++) sites[`¶${n}`] = part.site
  }
  return sites
}

/** "<site> · <title>" where an article starts at the paragraph `ref`, with two or more articles; else null. */
export function articleStart(source: SitedSource, ref: string): string | null {
  const parts = source.parts ?? []
  if (parts.length < 2) return null
  const part = parts.find((p) => `¶${p.from}` === ref)
  if (!part) return null
  return part.title ? `${part.site} · ${part.title}` : part.site
}

/** One source of a post as readers see it (GD31): its site, its title, its link when it has one. */
export type PostSource = { site: string | null; title: string; url: string | null }

/** Only a web address is a link; anything else stored as one is shown as plain text. */
function webLink(url: string | undefined): string | null {
  if (!url) return null
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

/**
 * The post's sources in the order they were read: one per link of a source read from several
 * (GD19), the same link once; else the one source, by its site and link when read from a link,
 * by its title alone when pasted.
 */
export function postSources(source: {
  title: string
  url?: string
  site?: string
  parts?: { url: string; site: string; title: string }[]
}): PostSource[] {
  if (source.parts?.length) {
    const seen = new Set<string>()
    return source.parts.flatMap((p) => {
      if (seen.has(p.url)) return []
      seen.add(p.url)
      return [{ site: p.site, title: p.title, url: webLink(p.url) }]
    })
  }
  return [{ site: source.site ?? null, title: source.title, url: webLink(source.url) }]
}

/** The names "Sources: …" lists: each source's site, or its title when it has none, each once. */
export function sourceNames(sources: readonly PostSource[]): string[] {
  return [...new Set(sources.map((s) => s.site ?? s.title))]
}

/** A source as the sources slide and the post pages name it: "site · title", or the title. */
export const sourceLabel = (s: PostSource): string =>
  s.site && s.site !== s.title ? `${s.site} · ${s.title}` : s.title
