const QUOTES: Record<string, string> = {
  '‘': "'",
  '’': "'",
  '‚': "'",
  '‛': "'",
  '“': '"',
  '”': '"',
  '„': '"',
}
const DASHES = /[‐‑‒–—―−]/

/** The normalised text with, for each of its characters, where that character starts in the original and how long it is there. */
function normaliseWithMap(text: string): { text: string; starts: number[]; ends: number[] } {
  let out = ''
  const starts: number[] = []
  const ends: number[] = []
  let pendingSpace: { start: number; end: number } | null = null
  let index = 0
  for (const char of text) {
    const start = index
    index += char.length
    if (/\s/u.test(char)) {
      pendingSpace = pendingSpace
        ? { start: pendingSpace.start, end: index }
        : { start, end: index }
      continue
    }
    if (pendingSpace && out.length > 0) {
      out += ' '
      starts.push(pendingSpace.start)
      ends.push(pendingSpace.end)
    }
    pendingSpace = null
    const plain = QUOTES[char] ?? (DASHES.test(char) ? '-' : char.toLowerCase())
    for (let i = 0; i < plain.length; i++) {
      out += plain[i]
      starts.push(start)
      ends.push(index)
    }
  }
  return { text: out, starts, ends }
}

/** Lower-cased, whitespace collapsed, curly quotes and dashes made plain. */
export function normalise(text: string): string {
  return normaliseWithMap(text).text
}

/** Where the quote sits in the paragraph (offsets into the original text), or null. */
export function findQuote(quote: string, paragraph: string): { start: number; end: number } | null {
  const needle = normalise(quote)
  if (needle.length === 0) return null
  const hay = normaliseWithMap(paragraph)
  const at = hay.text.indexOf(needle)
  if (at === -1) return null
  return { start: hay.starts[at], end: hay.ends[at + needle.length - 1] }
}
