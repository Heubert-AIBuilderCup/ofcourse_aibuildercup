// Her own words on a question step, read in code (criteria 36 to 41, 72 to 74, 83, 103). The
// model proposes chips (a step's question and one of its options, with the words they came from)
// and tags (anything else, with her words); this module keeps only what her text and the step's
// questions allow. Pure: amounts and start dates are read here from her words (amounts at the mock
// rates file), "know" is filled for a field she names, and words telling the model what to do are
// neither a chip nor a tag.

import { rateFor } from '@/features/content/markets'
import { PREVIEW_TODAY } from '@/features/engine/catalogue'
import type {
  AnswerValue,
  OwnWordsStep,
  QuestionKey,
  RoadmapTag,
  StoredAnswers,
} from '@/shared/types/student'
import { formatEnglish, parseEnglish } from './english'
import { OWN_WORDS_STEP_OF, PERSON, QUESTION_STEPS } from './onboarding'
import { DRAWN_TO_AREAS, display, isVisible, PARTICULAR, questionOf } from './questions'

export type OwnWordsChip = {
  key: QuestionKey
  value: AnswerValue
  quote: string
  /** Starts unselected: she must tap it (a high-stakes field, or a change to what she said). */
  needsTap: boolean
  /** It differs from an answer she stated. */
  change: boolean
}

/** What the model returned for one reading, before any check. */
export type OwnWordsModel = {
  chips: { key: string; value: string; quote: string }[]
  tags: { text: string; quote: string; wellbeing: boolean }[]
}

/**
 * The step's questions as the model sees them: key, question, options (amounts as "AUD 30k").
 * The app's reader and the real-Gemini check both send these.
 */
export function ownWordsQuestions(step: OwnWordsStep) {
  return QUESTION_STEPS[OWN_WORDS_STEP_OF[step]].questions.flatMap((q) => {
    // Her person (step 03's "Who, and where?") is no stored answer.
    if (q.key === PERSON) return []
    const { key, options } = questionOf(q.key)
    return [
      {
        key,
        question: q.question,
        options: options.map((o) => (key === 'amount' ? `AUD ${o}k` : display(o))),
      },
    ]
  })
}

/** Fields that fill nothing until she taps (criterion 38, ADR-003). */
export const HIGH_STAKES: readonly QuestionKey[] = ['amount', 'stay', 'eng']

/**
 * Words about how she feels, in English, Romanised Nepali or Hindi, and Devanagari, matched as
 * whole words (a stem where the endings vary). JavaScript's \b knows only ASCII letters, so a word
 * here ends where no letter, mark (a Devanagari vowel sign, virama or anusvara) or digit follows.
 * A quote holding one is wellbeing whatever the model said: never a chip, always a wellbeing tag
 * (criterion 41). "dar" and डर are fear here; "dar" can also be a rate ("byaj dar"), which costs
 * only a chip: she still answers that question by tapping. "Alone" (akele, अकेले, एक्लै) is a fact,
 * her answer to "Anyone coming with you?", until it is felt or is how she is: loneliness
 * (akelapan, अकेलापन, एक्लोपन), "akela lagta", "अकेली महसूस", "एक्लो लाग्छ", "akeli hoon", "एक्लै छु".
 */
const ALONE = '(?:akel[aie]|eklo|eklai|अकेल[ाीे]|एक्लो|एक्लै)'
/** Feeling it (lag-, feel, mehsoos, लग-, लाग-, महसूस) or being it (hoon, chu, हूँ, छु). */
const FELT = String.raw`(?:lag\p{L}*|feel\p{L}*|mehs[ou]+s|hoon|hun|hu|huncha|hunchha|chu|chhu|लग[\p{L}\p{M}]*|लाग[\p{L}\p{M}]*|महसूस|ह[ुू][ँं]?|हुन्छ|छु)`
const WELLBEING_WORDS = new RegExp(
  String.raw`(?<![\p{L}\p{M}\p{N}])(?:lonel\p{L}*|stress\p{L}*|anxi\p{L}*|depress\p{L}*|homesick\p{L}*|worr\p{L}*|scared|afraid|sad|sadness|unhappy|panic\p{L}*|overwhelm\p{L}*|akela{1,2}pan|eklopan|${ALONE}\s+${FELT}|tension|dar|darr|chinta|udas\p{L}*|dukhi|pareshan\p{L}*|अकेलापन|एक्लोपन|तनाव|चिन्ता|चिंता|डर|डरा[\p{L}\p{M}]*|उदास|दुखी|दुःखी|परेशान[\p{L}\p{M}]*)(?![\p{L}\p{M}\p{N}])`,
  'iu',
)

const TAG_TEXT_MAX = 80
const TAG_QUOTE_MAX = 200
const TAGS_PER_READING = 10

type Currency = 'AUD' | 'NPR' | 'INR'

/** A year's budget outside AUD 5k to 200k is not read as one ("$30" is no amount). */
const AMOUNT_MIN = 5
const AMOUNT_MAX = 200

const MULTIPLIERS: Readonly<Record<string, number>> = {
  k: 1e3,
  thousand: 1e3,
  lakh: 1e5,
  lakhs: 1e5,
  lac: 1e5,
  lacs: 1e5,
  crore: 1e7,
  crores: 1e7,
  cr: 1e7,
  // In Devanagari (criterion 83): करोड़ is written with a nukta, combined or not, or without.
  लाख: 1e5,
  करोड: 1e7,
  करोड़: 1e7,
  करोड़: 1e7,
}

// An optional currency before (not the end of a word, as in "years 2"), a number in Latin or
// Devanagari digits (any comma grouping, lakh's included), an optional multiplier, an optional
// currency after.
const MONEY =
  /(?:(?<![a-z])(a\$|au\$|aud|npr|nrs\.?|inr|rs\.?|₹|\$)\s*)?([\d०-९][\d०-९,]*(?:\.[\d०-९]+)?)\s*(k|thousand|lakhs?|lacs?|crores?|cr|लाख|करो(?:ड़?|ड़))?(?![a-z\d०-९])\s*(aud|dollars?|npr|inr|rupees?)?/gi

/** Devanagari digits as Latin ones: "२५" is "25". */
const latinDigits = (s: string): string =>
  s.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - '०'.charCodeAt(0)))

/** Rupees, or lakh and crore with no currency named, are in the currency of where she is. */
function localCurrency(where: string | null): Currency | null {
  if (where === 'Nepal') return 'NPR'
  if (where === 'India') return 'INR'
  return null
}

function currencyOf(token: string | undefined, where: string | null): Currency | null {
  const t = token?.toLowerCase().replace(/\.$/, '')
  if (t === undefined) return null
  if (t === 'aud' || t === 'a$' || t === 'au$' || t === '$' || t.startsWith('dollar')) return 'AUD'
  if (t === 'npr' || t === 'nrs') return 'NPR'
  if (t === 'inr' || t === '₹') return 'INR'
  return localCurrency(where)
}

/**
 * The first amount of money in her words, in AUD thousands (before snapping to an option), else
 * null. A number counts as money only with a currency or a multiplier: "30k", "AUD 30,000",
 * "26 lakh" (in NPR from Nepal, INR from India), "NPR 2,640,000", "२५ लाख". NPR and INR convert
 * at the mock rates file. An implausible year's budget (under AUD 5k, over AUD 200k) is no amount.
 */
export function amountFromWords(text: string, where: string | null): number | null {
  return amountIn(text, where)?.thousands ?? null
}

/** The first amount of money in her words (amountFromWords), with the words that say it. */
function amountIn(
  text: string,
  where: string | null,
): { thousands: number; phrase: string } | null {
  for (const match of text.matchAll(MONEY)) {
    const [phrase, before, digits, multiplier, after] = match
    const scale = multiplier ? MULTIPLIERS[multiplier.toLowerCase()] : undefined
    const named = before ?? after
    if (named === undefined && scale === undefined) continue
    const currency =
      named !== undefined ? currencyOf(named, where) : scale === 1e3 ? 'AUD' : localCurrency(where)
    if (currency === null) continue
    const units = Number(latinDigits(digits).replaceAll(',', '')) * (scale ?? 1)
    const rate = currency === 'AUD' ? 1 : rateFor('AUD', currency)?.rate
    if (rate === undefined) continue
    const thousands = units / rate / 1000
    if (thousands < AMOUNT_MIN || thousands > AMOUNT_MAX) continue
    return { thousands, phrase: phrase.trim() }
  }
  return null
}

const MONTH =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const YEAR_AFTER = String.raw`\.?,?\s+(20\d\d)\b`
/** "February 2027", "Jul 2027". */
const MONTH_YEAR = new RegExp(String.raw`\b${MONTH}${YEAR_AFTER}`, 'gi')
/** "next July", "in February": the next one after the preview's today. "may" alone is no month. */
const MONTH_ONLY = new RegExp(
  String.raw`\b(?:next|this|in|from)\s+${MONTH}\b(?!${YEAR_AFTER})`,
  'gi',
)
/** "in 2028": a year alone. */
const YEAR_ONLY = /\b(?:in|from|after)\s+(20\d\d)\b/gi

/** A month counted from year 0, so two can be compared: 2027 * 12 + 1 is February 2027. */
const monthIndex = (year: number, month: number): number => year * 12 + month

/**
 * Her earliest start as one of its options, with the words that say it, read in code from the
 * preview's today (criterion 73): an intake's own month ("Feb 2027", "next July"), "Later" for any
 * month or year after the last intake; null for anything else (a month between intakes, a past
 * date, a year that holds an intake).
 */
function earliestIn(text: string): { value: AnswerValue; phrase: string } | null {
  const options = questionOf('earliest').options.map(String)
  const intakes = options.flatMap((option) => {
    const [name, year] = option.toLowerCase().split(' ')
    const month = MONTHS.indexOf(name ?? '')
    return month < 0 ? [] : [{ option, at: monthIndex(Number(year), month) }]
  })
  const last = Math.max(...intakes.map((i) => i.at))
  const later = options.find((o) => !intakes.some((i) => i.option === o))
  const [todayYear, todayMonth] = PREVIEW_TODAY.split('-').map(Number)
  const today = monthIndex(todayYear, todayMonth - 1)
  const at = (month: number, year: number): AnswerValue | null => {
    const when = monthIndex(year, month)
    if (when > last) return later ?? null
    return intakes.find((i) => i.at === when)?.option ?? null
  }
  const monthOf = (name: string): number => MONTHS.indexOf(name.slice(0, 3).toLowerCase())

  for (const m of text.matchAll(MONTH_YEAR)) {
    const value = at(monthOf(m[1]), Number(m[2]))
    if (value !== null) return { value, phrase: m[0].trim() }
  }
  for (const m of text.matchAll(MONTH_ONLY)) {
    const month = monthOf(m[1])
    const year = monthIndex(todayYear, month) > today ? todayYear : todayYear + 1
    const value = at(month, year)
    if (value !== null) return { value, phrase: m[0].trim() }
  }
  for (const m of text.matchAll(YEAR_ONLY)) {
    const year = Number(m[1])
    // Every month of the year after the last intake, else none.
    if (monthIndex(year, 0) > last && later) return { value: later, phrase: m[0].trim() }
  }
  return null
}

/** Telling the model to drop what it was told. */
const DROP = '(?:ignore|disregard|forget|override)'
/** Words that make rules the model's: "your rules", "all previous rules", never "the visa rules". */
const THEIRS = '(?:your|all|any|previous|prior|earlier|above|system|these|those)'
/** What the model was told, right after DROP: its instructions or prompt, "the above", its rules. */
const TOLD = String.raw`(?:(?:(?:the|${THEIRS})\s+)*(?:instructions?|prompts?)|(?:the|everything|anything|all)\s+(?:text\s+)?above|(?:the\s+)?(?:${THEIRS}\s+)+(?:the\s+)?rules?)`
/** The same in Hinglish, either side of its verb: "tumhare rules", "pichhle saare instructions". */
const HINGLISH_THEIRS =
  '(?:tumhare|tumhara|tumhari|tere|tera|teri|aapke|aapka|aapki|apke|apka|apki|apne|apna|apni|saare|sare|sab|sabhi|pichhle|pichle|system)'
const HINGLISH_TOLD = String.raw`(?:(?:${HINGLISH_THEIRS}\s+)*(?:instructions?|prompts?|nirdesh\p{L}*)|(?:${HINGLISH_THEIRS}\s+)+(?:rules?|niyam\p{L}*))`
const HINGLISH_DROP = String.raw`(?:ignore|bhool|bhul|chhod|chod|override|forget|mat\s+maa?n\p{L}*)`
/**
 * Words aimed at the model (criterion 74): dropping its instructions, rules, prompt or "the above"
 * (Hinglish puts the object first: "tumhare rules bhool jao"), the system prompt, "you are now",
 * acting as an AI, "from now on you", pretending to be someone or that it is. Never her own
 * sentences: "I won't pretend I'm a top student", "I will never ignore the rules of my visa", "my
 * dad set my budget", "I'd say that I prefer a city", "my brother will act as my sponsor".
 */
const INSTRUCTION = new RegExp(
  [
    String.raw`\b${DROP}\s+(?:about\s+)?${TOLD}\b`,
    String.raw`\b${HINGLISH_TOLD}\s+(?:ko\s+)?${HINGLISH_DROP}`,
    String.raw`\b${HINGLISH_DROP}\s+(?:(?:karo|kar\s+do|jao|do)\s+)?${HINGLISH_TOLD}`,
    String.raw`\bsystem prompt\b`,
    String.raw`\byou are now\b`,
    String.raw`\bact as (?:an?\s+|the\s+)?(?:ai|assistant|model|system|chatbot|bot|llm|gpt)\b`,
    String.raw`\bfrom now on,?\s+(?:you|answer|reply|respond)\b`,
    String.raw`(?:^|[.!?;:,]\s*|\b(?:you|please|and|now|just)\s+)pretend\s+to\s+be\b`,
    String.raw`\bpretend\s+(?:that\s+)?you(?:'re|’re|\s+are)\b`,
  ].join('|'),
  'iu',
)

/** Her text as sentences. */
const sentencesOf = (text: string): string[] =>
  text
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s !== '')

/** Numbers in her words: "6.5 in IELTS" holds 6.5. */
const numbersIn = (s: string): number[] => (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)

/** Whether her words name a test (letters only) as a word: "PTE" in "PTE58", not in "accepted". */
const namesTest = (said: string, test: string): boolean =>
  new RegExp(`(?<![a-z])${test}(?![a-z])`, 'i').test(said)

/** Lower case, spaces collapsed: how a quote is matched against her text. */
const loose = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** At most `max` characters, cut back to the last whole word. */
function cut(s: string, max: number): string {
  const trimmed = s.trim()
  if (trimmed.length <= max) return trimmed
  const head = trimmed.slice(0, max + 1)
  const space = head.lastIndexOf(' ')
  return (space > 0 ? head.slice(0, space) : trimmed.slice(0, max)).trimEnd()
}

function nearest(options: readonly AnswerValue[], amount: number): number {
  let best = options[0] as number
  for (const option of options as readonly number[]) {
    if (Math.abs(option - amount) < Math.abs(best - amount)) best = option
  }
  return best
}

/**
 * The chip's value as one of its question's options, else null. English also takes her exact
 * score in its stored form ("PTE 58", criterion 103) when the quote holds that score and her words
 * name the test.
 */
function chipValue(
  key: QuestionKey,
  chip: { value: string; quote: string },
  where: string | null,
  said: string,
): AnswerValue | null {
  const question = questionOf(key)
  if (key === 'amount') {
    const amount = amountFromWords(chip.quote, where)
    return amount === null ? null : nearest(question.options, amount)
  }
  if (key === 'eng' && !question.options.includes(chip.value)) {
    const english = parseEnglish(chip.value)
    if (english === null || !numbersIn(chip.quote).includes(english.score)) return null
    if (!namesTest(said, english.test)) return null
    return formatEnglish(english.test, english.score)
  }
  if (!question.options.includes(chip.value)) return null
  return question.control === 'multi' ? [chip.value] : chip.value
}

/**
 * What the model read from her words on a step, kept only where it holds: a chip answers one of
 * the step's visible questions with one of its options, quotes her text, and is not a wellbeing
 * statement; a tag quotes her text. Nothing is kept from a sentence telling the model what to do,
 * and every chip of a reading that holds one needs her tap. Code reads the amount and the earliest
 * start itself when no chip holds them, and adds the "know" a field or areas chip needs. Amount,
 * stay and English need a tap, and so do what code read alone and a change to an answer she
 * stated; a chip that repeats a stated answer is dropped.
 */
export function checkOwnWords(
  step: OwnWordsStep,
  text: string,
  model: OwnWordsModel,
  answers: StoredAnswers,
  where: string | null,
): { chips: OwnWordsChip[]; tags: RoadmapTag[] } {
  const said = loose(text)
  const quoted = (quote: string): boolean => {
    const q = loose(quote)
    return q !== '' && said.includes(q)
  }
  // A quote is instruction-like when it says so, or lies in (or holds) a sentence that does. Her
  // other sentences keep their answers and tags.
  const sentences = sentencesOf(text)
  const instructions = sentences.filter((s) => INSTRUCTION.test(s)).map(loose)
  const instructed = (quote: string): boolean => {
    const q = loose(quote)
    return INSTRUCTION.test(quote) || instructions.some((s) => s.includes(q) || q.includes(s))
  }

  const tags: RoadmapTag[] = model.tags
    .filter((tag) => quoted(tag.quote) && tag.text.trim() !== '' && !instructed(tag.quote))
    .map((tag) => ({
      text: cut(tag.text, TAG_TEXT_MAX),
      quote: cut(tag.quote, TAG_QUOTE_MAX),
      step,
      wellbeing: tag.wellbeing || WELLBEING_WORDS.test(tag.quote),
    }))
  const wellbeing = tags.filter((tag) => tag.wellbeing).map((tag) => loose(tag.quote))

  // Her person (step 03's "Who, and where?") is no stored answer: no chip fills it.
  const keys = new Set<string>(
    QUESTION_STEPS[OWN_WORDS_STEP_OF[step]].questions.map((q) => q.key).filter((k) => k !== PERSON),
  )
  // Rupees and lakh are read in the currency of a where read in these same words, before hers.
  const whereChip = keys.has('where')
    ? model.chips.find(
        (c) =>
          c.key === 'where' &&
          quoted(c.quote) &&
          !instructed(c.quote) &&
          !WELLBEING_WORDS.test(c.quote) &&
          chipValue('where', c, null, said) !== null,
      )
    : undefined
  const currencyWhere = whereChip?.value ?? where
  const aboutWellbeing = (quote: string): boolean => {
    const q = loose(quote)
    return wellbeing.some((w) => w.includes(q) || q.includes(w))
  }
  /** The chip for a value she gave, or null when it repeats what she stated. */
  const offer = (key: QuestionKey, value: AnswerValue, quote: string): OwnWordsChip | null => {
    const stored = answers[key]
    const stated = stored?.state === 'stated' ? stored.value : undefined
    const change = stated !== undefined
    if (change && display(stated) === display(value)) return null
    return {
      key,
      value,
      quote: quote.trim(),
      needsTap: change || HIGH_STAKES.includes(key),
      change,
    }
  }

  const usable = (quote: string): boolean => quoted(quote) && !instructed(quote)
  // Wellbeing the model read as an answer is kept as hers, as a wellbeing tag, never a chip. Every
  // such span is known before any chip is judged, so the model's order changes nothing.
  for (const chip of model.chips) {
    if (!usable(chip.quote) || !WELLBEING_WORDS.test(chip.quote) || aboutWellbeing(chip.quote))
      continue
    const quote = cut(chip.quote, TAG_QUOTE_MAX)
    tags.push({ text: cut(chip.quote, TAG_TEXT_MAX), quote, step, wellbeing: true })
    wellbeing.push(loose(quote))
  }

  const chips: OwnWordsChip[] = []
  for (const chip of model.chips) {
    if (!usable(chip.quote) || aboutWellbeing(chip.quote)) continue
    if (!keys.has(chip.key) || chips.some((c) => c.key === chip.key)) continue
    const key = chip.key as QuestionKey
    const value = chipValue(key, chip, currencyWhere, said)
    if (value === null) continue
    const offered = offer(key, value, chip.quote)
    if (offered) chips.push(offered)
  }

  // Amounts and the earliest start are read in code, from the sentences that tell the model
  // nothing, when no chip of the model's holds them (criterion 73). The model did not read them as
  // her answer, so each needs her tap: "my brother moved in July" is no start of hers.
  const plain = sentences.filter((s) => !INSTRUCTION.test(s)).join('\n')
  const readInCode = (key: QuestionKey, found: { value: AnswerValue; phrase: string } | null) => {
    if (!keys.has(key) || chips.some((c) => c.key === key) || !found) return
    if (aboutWellbeing(found.phrase)) return
    const offered = offer(key, found.value, found.phrase)
    if (offered) chips.push({ ...offered, needsTap: true })
  }
  const amount = amountIn(plain, currencyWhere)
  readInCode(
    'amount',
    amount && {
      value: nearest(questionOf('amount').options, amount.thousands),
      phrase: amount.phrase,
    },
  )
  readInCode('earliest', earliestIn(plain))

  // A field or areas chip with no "know" beside it gets the "know" that opens it (criterion 72).
  const opened = chips.findIndex((c) => c.key === 'field' || c.key === 'areas')
  if (keys.has('know') && opened >= 0 && !chips.some((c) => c.key === 'know')) {
    const { key, quote } = chips[opened]
    const know = offer('know', key === 'field' ? PARTICULAR : DRAWN_TO_AREAS, quote)
    if (know) chips.splice(opened, 0, know)
  }

  // A question is shown by her answers and the rest of this reading: "know" read as "Something
  // particular" opens the field read beside it.
  const read: StoredAnswers = { ...answers }
  for (const chip of chips) read[chip.key] = { value: chip.value, state: 'stated' }
  const shown = chips.filter((chip) => isVisible(chip.key, read))
  return {
    // Words that told the model what to do may have steered the rest of its reading: nothing of
    // it fills an answer until she taps.
    chips: instructions.length > 0 ? shown.map((chip) => ({ ...chip, needsTap: true })) : shown,
    tags: tags.slice(0, TAGS_PER_READING),
  }
}
