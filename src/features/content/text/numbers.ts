/** A currency the reader knows by its code or symbol before the number; a bare "$" is none of them. */
export type CurrencyUnit = 'aud' | 'gbp' | 'nzd' | 'usd' | 'npr' | 'inr' | 'thb'

export type FoundNumber = {
  value: number
  unit: 'percent' | CurrencyUnit | null
  start: number
  end: number
}

type WordKind = 'unit' | 'teen' | 'tens' | 'hundred' | 'scale'

const WORDS: Record<string, { value: number; kind: WordKind }> = {
  zero: { value: 0, kind: 'unit' },
  one: { value: 1, kind: 'unit' },
  two: { value: 2, kind: 'unit' },
  three: { value: 3, kind: 'unit' },
  four: { value: 4, kind: 'unit' },
  five: { value: 5, kind: 'unit' },
  six: { value: 6, kind: 'unit' },
  seven: { value: 7, kind: 'unit' },
  eight: { value: 8, kind: 'unit' },
  nine: { value: 9, kind: 'unit' },
  ten: { value: 10, kind: 'teen' },
  eleven: { value: 11, kind: 'teen' },
  twelve: { value: 12, kind: 'teen' },
  thirteen: { value: 13, kind: 'teen' },
  fourteen: { value: 14, kind: 'teen' },
  fifteen: { value: 15, kind: 'teen' },
  sixteen: { value: 16, kind: 'teen' },
  seventeen: { value: 17, kind: 'teen' },
  eighteen: { value: 18, kind: 'teen' },
  nineteen: { value: 19, kind: 'teen' },
  twenty: { value: 20, kind: 'tens' },
  thirty: { value: 30, kind: 'tens' },
  forty: { value: 40, kind: 'tens' },
  fifty: { value: 50, kind: 'tens' },
  sixty: { value: 60, kind: 'tens' },
  seventy: { value: 70, kind: 'tens' },
  eighty: { value: 80, kind: 'tens' },
  ninety: { value: 90, kind: 'tens' },
  hundred: { value: 100, kind: 'hundred' },
  thousand: { value: 1000, kind: 'scale' },
  million: { value: 1_000_000, kind: 'scale' },
}

/** Which kind of word may follow which, so "twenty one" is 21 but "eight nine" is 8 and 9. */
const FOLLOWS: Record<WordKind, WordKind[]> = {
  unit: ['hundred', 'scale'],
  teen: ['hundred', 'scale'],
  tens: ['unit', 'scale'],
  hundred: ['unit', 'teen', 'tens', 'scale'],
  scale: ['unit', 'teen', 'tens', 'hundred'],
}

const WORD_PATTERN = Object.keys(WORDS).join('|')
const SUFFIX_MULTIPLIERS: Record<string, number> = {
  k: 1000,
  hundred: 100,
  thousand: 1000,
  million: 1_000_000,
  lakh: 100_000,
  lakhs: 100_000,
  crore: 10_000_000,
  crores: 10_000_000,
}

// Digits (with thousands separators and decimals) or a number word, one at a time.
const FIND = new RegExp(
  `(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)|\\b(${WORD_PATTERN})\\b`,
  'giu',
)
const NEXT_WORD = new RegExp(`[-\\s]+(${WORD_PATTERN})\\b`, 'iuy')
const MULTIPLIER = /(?:k\b|\s+(?:hundred|thousand|million|lakhs?|crores?)\b)/iy
const PERCENT = /\s*(?:%|percent\b|per\s*cent\b|percentage\s+points?\b)/iy
/**
 * The code or symbol that ends the text just before a number, per currency. A bare "$" matches
 * none: it is ambiguous (ADR-123). Anchored at the end, so a caller may test the text up to the
 * number's start.
 */
export const CURRENCY_BEFORE: Record<CurrencyUnit, RegExp> = {
  aud: /(?:\bAUD|(?<!\p{L})A\$)\s*$/iu,
  gbp: /(?:\bGBP|£)\s*$/iu,
  nzd: /(?:\bNZD|(?<!\p{L})NZ\$)\s*$/iu,
  usd: /(?:\bUSD|(?<!\p{L})US\$)\s*$/iu,
  npr: /(?:\bNPR|\bRs)\.?\s*$/iu,
  inr: /(?:\bINR|₹)\s*$/iu,
  thb: /(?:\bTHB|฿)\s*$/iu,
}
const CURRENCIES = Object.entries(CURRENCY_BEFORE) as [CurrencyUnit, RegExp][]

/** Reads a run of number words from `from`: its value and where it ends. */
function readWords(text: string, first: string, from: number): { value: number; end: number } {
  let { value: current, kind } = WORDS[first.toLowerCase()]
  let total = 0
  let end = from + first.length
  while (true) {
    NEXT_WORD.lastIndex = end
    const next = NEXT_WORD.exec(text)
    if (!next) break
    const word = WORDS[next[1].toLowerCase()]
    if (word.value === 0 || !FOLLOWS[kind].includes(word.kind)) break
    if (word.kind === 'hundred') current *= 100
    else if (word.kind === 'scale') {
      total += current * word.value
      current = 0
    } else current += word.value
    kind = word.kind
    end += next[0].length
  }
  return { value: total + current, end }
}

function unitAround(text: string, start: number, end: number): FoundNumber['unit'] {
  const before = text.slice(Math.max(0, start - 8), start)
  for (const [unit, pattern] of CURRENCIES) if (pattern.test(before)) return unit
  PERCENT.lastIndex = end
  return PERCENT.test(text) ? 'percent' : null
}

/**
 * Every number written in the text, with where it sits:
 * - digits with thousands separators and decimals: "3,100", "24.95"
 * - a sign or the minus character dropped: "−11" is 11
 * - number words zero to twenty, the tens, hundred, thousand, million: "eight" is 8, "twenty-one" is 21
 * - a "k" suffix (×1,000), "lakh" (×100,000), "crore" (×10,000,000): "36k" is 36000, "25 lakh" is 2500000
 * - "%", "percent" and "percentage points" set unit percent; a currency code or symbol before the
 *   number sets its unit (CURRENCY_BEFORE: "AUD"/"A$" aud, "£" gbp, "NZ$" nzd, "US$" usd, "NPR"/"Rs" npr,
 *   "₹" inr, "฿" thb); a bare "$" sets none
 * - a range "30–70" gives two numbers
 */
export function numbersIn(text: string): FoundNumber[] {
  const found: FoundNumber[] = []
  let consumed = 0
  for (const match of text.matchAll(FIND)) {
    const start = match.index
    if (start < consumed) continue
    let value: number
    let end: number
    if (match[1] !== undefined) {
      value = Number.parseFloat(match[1].replaceAll(',', ''))
      end = start + match[1].length
    } else {
      ;({ value, end } = readWords(text, match[2], start))
    }
    MULTIPLIER.lastIndex = end
    const multiplier = MULTIPLIER.exec(text)
    if (multiplier) {
      value *= SUFFIX_MULTIPLIERS[multiplier[0].trim().toLowerCase()]
      end += multiplier[0].length
    }
    found.push({ value, unit: unitAround(text, start, end), start, end })
    consumed = end
  }
  return found
}

const SAME = 1e-9

function matches(a: FoundNumber, b: FoundNumber): boolean {
  return (
    Math.abs(a.value - b.value) < SAME && (a.unit === null || b.unit === null || a.unit === b.unit)
  )
}

/** The claim's numbers that the paragraph does not contain (value equal; unit equal when both have one). */
export function missingNumbers(claim: string, paragraph: string): FoundNumber[] {
  const have = numbersIn(paragraph)
  return numbersIn(claim).filter((wanted) => !have.some((n) => matches(wanted, n)))
}
