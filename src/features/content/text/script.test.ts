import { describe, expect, it } from 'bun:test'
import { languageById } from '../languages'
import { NATIVE, NATIVE_IDS, nativeOf } from './native-fixtures'
import {
  charCount,
  firstChars,
  MIN_SCRIPT_SHARE,
  nativeDigits,
  scriptProblems,
  scriptShare,
  sourceWordingRefusal,
  wordCount,
} from './script'

const NEPALI = languageById('ne')
const THAI = languageById('th')
const ENGLISH = languageById('en')
if (!NEPALI || !THAI || !ENGLISH) throw new Error('language file missing')

describe('scriptShare (GD37)', () => {
  it('counts the letters in Devanagari, its vowel signs among them', () => {
    expect(scriptShare('विद्यार्थी भिसा', 'devanagari')).toBe(1)
    expect(scriptShare('student visa', 'devanagari')).toBe(0)
    // "ECU" is three letters of fourteen, a name kept as it is.
    expect(scriptShare('ECU मा पढाइ हुन्छ', 'devanagari')).toBeCloseTo(11 / 14)
  })

  it('counts the letters in Thai', () => {
    expect(scriptShare('นักเรียน', 'thai')).toBe(1)
    expect(scriptShare('นักเรียน student', 'thai')).toBeCloseTo(8 / 15)
    expect(scriptShare('विद्यार्थी', 'thai')).toBe(0)
  })

  it('counts the letters in Latin', () => {
    expect(scriptShare('Students can work 48 hours.', 'latin')).toBe(1)
    expect(scriptShare('नमस्ते', 'latin')).toBe(0)
  })

  it('reads digits and marks as no letters, and a text with none as nothing to refuse', () => {
    expect(scriptShare('48 · 2024!', 'devanagari')).toBe(1)
    expect(scriptShare('', 'thai')).toBe(1)
    expect(scriptShare('४८ घण्टा', 'devanagari')).toBe(1)
  })
})

describe('nativeDigits (GD37)', () => {
  it('finds Devanagari and Thai digits, never 0–9', () => {
    expect(nativeDigits('४८ घण्टा, 20 दिन')).toEqual(['४', '८'])
    expect(nativeDigits('๔๘ ชั่วโมง')).toEqual(['๔', '๘'])
    expect(nativeDigits('48 hours, 20 days')).toEqual([])
  })
})

describe('scriptProblems (GD37)', () => {
  it('refuses a Nepali text under 60% Devanagari, and passes one over it', () => {
    expect(MIN_SCRIPT_SHARE).toBe(0.6)
    expect(scriptProblems('hook', [['hook', 'Work up to 48 hours a fortnight.']], NEPALI)).toEqual([
      'hook: write it in Nepali, in its own script; 0% of its letters are, and it takes at least 60%. Keep names of places, universities and visas as they are.',
    ])
    expect(scriptProblems('hook', [['hook', 'ECU मा पढाइ हुन्छ']], NEPALI)).toEqual([])
  })

  it('reads the share over all the parts together, so a part that is only a name passes', () => {
    const parts: [string, string][] = [
      ['kicker', 'OfCourse · 5 min'],
      ['body', 'विद्यार्थीले हप्तामा 20 घण्टा काम गर्न सक्छन्।'],
    ]
    expect(scriptProblems('slides', parts, NEPALI)).toEqual([])
    expect(scriptProblems('slides', [parts[0]], NEPALI)).toHaveLength(1)
  })

  it('refuses digits outside 0–9 in any language, by the part they are in', () => {
    expect(scriptProblems('slides', [['slides.1.body', '४८ घण्टा काम']], NEPALI)).toEqual([
      'slides.1.body: "४" is not a Western digit; write every number with 0–9.',
      'slides.1.body: "८" is not a Western digit; write every number with 0–9.',
    ])
    expect(scriptProblems('body', [['body', '๔๘ ชั่วโมง']], THAI)).toHaveLength(2)
    expect(scriptProblems('body', [['body', 'Up to ४८ hours']], ENGLISH)).toHaveLength(2)
  })

  it('asks nothing of an English text’s script', () => {
    expect(scriptProblems('hook', [['hook', 'नमस्ते, students']], ENGLISH)).toEqual([])
  })
})

// A 'words' limit counts Thai, written without spaces between words, by word (GD37, GD38).
describe('wordCount', () => {
  it('counts Thai by its words, not its spaces', () => {
    expect(wordCount('ฉันกินข้าว')).toBe(3)
    expect(wordCount('นักศึกษาทำงานไม่เกิน 20 ชั่วโมงต่อสัปดาห์')).toBe(8)
  })

  it('counts any other text by its spaces, as it always did', () => {
    expect(wordCount('Keep paid work — modest.')).toBe(5)
    expect(wordCount('  काम 20 घण्टा  ')).toBe(3)
    expect(wordCount('')).toBe(0)
  })
})

// Every character limit counts characters as a reader sees them, so a Devanagari conjunct or a
// Thai letter with its marks is one, not three or four (GD36–GD40).
describe('charCount', () => {
  it('counts a conjunct and a letter with its marks as one character', () => {
    expect(charCount('क्ष')).toBe(1)
    expect(charCount('विद्यार्थी')).toBe(3)
    expect(charCount('हफ़्ते')).toBe(2)
    expect(charCount('ที่')).toBe(1)
    expect(charCount('การศึกษา')).toBe(7)
  })

  it('counts Nepali, Hindi and Thai as typed', () => {
    for (const id of NATIVE_IDS) expect(charCount(nativeOf(id, 120))).toBe(120)
  })

  it('counts English as it always did', () => {
    expect(charCount('Keep paid work modest.')).toBe(22)
    expect(charCount('')).toBe(0)
  })
})

describe('firstChars', () => {
  it('keeps the first characters as a reader sees them, never cutting one', () => {
    expect(firstChars('विद्यार्थी', 2)).toBe('विद्या')
    expect(firstChars('ที่นี่', 1)).toBe('ที่')
    for (const id of NATIVE_IDS) {
      expect(firstChars(`${nativeOf(id, 30)}${NATIVE[id]}`, 30)).toBe(nativeOf(id, 30))
    }
  })

  it('leaves a text within the limit as it is, and cuts English as before', () => {
    expect(firstChars('หนังสือ', 10)).toBe('หนังสือ')
    expect(firstChars('Keep paid work modest.', 9)).toBe('Keep paid')
  })
})

describe('sourceWordingRefusal', () => {
  const ENGLISH = 'Balance is something you keep adjusting.'
  const THAI_LINE = 'สมดุลคือกระบวนการ'

  it("takes the source's wording only when it is in the post's script", () => {
    expect(sourceWordingRefusal(ENGLISH, 'en')).toBeNull()
    expect(sourceWordingRefusal(THAI_LINE, 'th')).toBeNull()
    expect(sourceWordingRefusal(NATIVE.ne, 'ne')).toBeNull()
  })

  it('refuses an English source sentence on a Thai, Nepali or Hindi post, naming its language', () => {
    expect(sourceWordingRefusal(ENGLISH, 'th')).toBe(
      'The source is in English; edit the slide in Thai instead.',
    )
    expect(sourceWordingRefusal(ENGLISH, 'ne')).toBe(
      'The source is in English; edit the slide in Nepali instead.',
    )
    expect(sourceWordingRefusal(ENGLISH, 'hi')).toBe(
      'The source is in English; edit the slide in Hindi instead.',
    )
  })

  it('refuses a sentence in another script on an English post; a post with no language is English', () => {
    expect(sourceWordingRefusal(THAI_LINE, 'en')).toBe(
      'The source is not in English; edit the slide in English instead.',
    )
    expect(sourceWordingRefusal(THAI_LINE, undefined)).toBe(
      'The source is not in English; edit the slide in English instead.',
    )
  })
})
