// A deterministic provider for tests and e2e, used when AI_PROVIDER=fake. Answers are built from
// `data` only, so the same request always gets the same answer and nothing is spent.
//   [fake:fail-<useCase>] anywhere in data → the call throws
//   [fake:fail-art]       in an image prompt → the call throws; any other image is an 8 × 8 grey PNG
//   [fake:art-text]       in an image prompt → an 8 × 8 red PNG, which the art check reads as text
//   [fake:bad-<useCase>]  anywhere in data → schema-invalid JSON on the first attempt only
//   [fake:market-number]  in a reworded slot → the market version carries a number no fact has
//   [fake:caption-number] anywhere in a caption's data → the caption's hook carries a number
//   [fake:fail-search]    anywhere in a search's data → the search throws; any other is
//                         grounded on the three FAKE_SOURCES, two of them redirect URIs
//   DATA.language         a copy answer in that language's script, each Latin letter one of its own
// (a retry is recognised by the problem list the ladder appends).

import { Resvg } from '@resvg/resvg-js'
import { languageById } from '../languages'
import type { Paragraph } from '../model/types'
import { bestParagraph, contentWords } from '../text/locate'
import { MIN_SCRIPT_SHARE, type Script, scriptShare, wordCount } from '../text/script'
import type { GroundedSource, Provider } from './client'
import type { UseCase } from './config'
import { RETRY_LEAD } from './prompts'

/** An answer from the request's data, and the images it carries. */
export type FakeAnswers = Partial<
  Record<UseCase, (data: unknown, images?: { base64: string }[]) => unknown>
>

/** A paragraph as EXTRACT's DATA carries it: its sentences, numbered ¶n.k. */
type ExtractParagraph = { ref: string; sentences: { id: string; text: string }[] }

type DraftSlotData = {
  key: string
  factual: boolean
  limit: { unit: 'chars' | 'words' | 'points'; min: number; max: number }
}
type DraftData = {
  template: {
    id: string
    /** A look's slides carry no slots: each slide takes a layout of its kind from `layouts`. */
    slides: { kind: string; repeat: { min: number }; slots?: DraftSlotData[] }[]
    layouts?: { id: string; kind: string; slots: DraftSlotData[] }[]
  }
  facts: { id: string; text: string }[]
  paragraphs: Paragraph[]
  /** A version to rewrite in DATA.nudge's direction (GD10), in the answer's own shape. */
  base?: {
    slides: { kind: string; layout: string | null; slots: { key: string; text: string }[] }[]
  }
  /** The editor's outline (GD32): every version has its slides, each in its layout. */
  outline?: { slides: { layout: string }[] }
}
type FakeSlot = { text: string; fact_ids: string[] }
/** OUTLINE's DATA (GD32): the look's slides by kind, the idea, the supported facts. */
type OutlineData = {
  look: { slides: { kind: string; repeat: { min: number } }[] }
  idea: { cards: { hook: string }[] }
  facts: { id: string; text: string }[]
}
type SlideData = {
  slots: {
    key: string
    factual: boolean
    limit: { unit: 'chars' | 'words' | 'points'; min: number; max: number }
    text: string
    fact_ids: string[]
  }[]
  facts: { id: string; text: string }[]
  nudge: string | null
}
type MarketSlot = {
  slide: number
  slot: string
  text: string
  limit: { unit: 'chars' | 'words'; max: number }
}

/** Where the run of letters each script's fake writes a–z as begins: Devanagari क…म, Thai ก…บ. */
const SCRIPT_START: Record<'devanagari' | 'thai', number> = { devanagari: 0x0915, thai: 0x0e01 }
const same = (text: string) => text

/** Each Latin letter a–z, of either case, as one letter of the script; every other character stays. */
function sayerIn(script: Script): (text: string) => string {
  if (script === 'latin') return same
  const start = SCRIPT_START[script]
  return (text) =>
    text.replace(/[a-z]/gi, (c) => String.fromCodePoint(start + c.toLowerCase().charCodeAt(0) - 97))
}

/**
 * The fake's words in DATA.language's script (GD37), so every length, word, digit and mark stays
 * and the checks read the answer as they read it in English. English, or no language, keeps the
 * words as they are.
 */
function sayerFor(data: unknown): (text: string) => string {
  const id = (data as { language?: { id?: string } } | null)?.language?.id
  const script = id ? languageById(id)?.script : undefined
  return script ? sayerIn(script) : same
}

/**
 * `say(text)`, its last words dropped while a 'words' limit, counting Thai by word (GD37), finds
 * more than its most: a Latin word written in Thai letters can count as two. A text the fake
 * plants over its limit keeps its own count. Any other limit is said as it is, and English never
 * loses a word.
 */
function saidWithin(
  text: string,
  limit: { unit: string; max: number },
  say: (text: string) => string,
): string {
  const most = Math.max(limit.max, words(text).length)
  let out = text
  while (limit.unit === 'words' && wordCount(say(out)) > most && /\s/.test(out.trim())) {
    out = out.replace(/\s*\S+\s*$/, '')
  }
  return say(out)
}

/** The script a claim the fake wrote is in, read from its letters; Latin when it is in none other. */
function scriptOfClaim(claim: string): Script {
  return (
    (['devanagari', 'thai'] as const).find((s) => scriptShare(claim, s) >= MIN_SCRIPT_SHARE) ??
    'latin'
  )
}

const FAKE_MARKER = /\[fake:[^\]]*\]/g
const LIMIT_LINE = 'First year is the worst time to find out where your limit is.'
/** The three versions' angles and the body heading each uses (criterion 97). */
const FAKE_ANGLES: [angle: string, heading: string][] = [
  ['The surprising number', 'Finding'],
  ['The practical advice', 'In practice'],
  ['The question to ask', 'Ask this'],
]
const words = (text: string) => text.split(/\s+/).filter(Boolean)
/** The idea cards the fake offers, in order, each angle with its hook: no number, no banned phrase. */
const FAKE_IDEAS: [angle: string, hook: string, audience: string][] = [
  [
    'The limit that works',
    'There is a point where paid work starts to cost you.',
    'First-year students',
  ],
  [
    'The practical advice',
    'Plan your shifts around your study, not the other way.',
    'Students with jobs',
  ],
  [
    'The question to ask',
    'Ask this before you take on another shift.',
    'Students looking for work',
  ],
  [
    'The surprising finding',
    'Working while you study is more common than you think.',
    'New students',
  ],
  ['The quiet cost', 'Late shifts take more than your evenings.', 'Students who work nights'],
  ['The first month', 'Your first weeks set the pace for the whole year.', 'Students starting out'],
  [
    'The family view',
    'Talk about your hours with the people who back you.',
    'Families of students',
  ],
  ['The steady week', 'A steady week beats a heroic sprint.', 'Busy students'],
  ['The money question', 'Earning more is not always worth what it takes.', 'Students on a budget'],
  ['The habit', 'Small habits keep study time safe.', 'Students who want routine'],
  ['The trade-off', 'Every shift is a choice about your week.', 'Students weighing a job'],
  ['The check-in', 'Check your hours each term, not once a year.', 'Returning students'],
]

/** What the fake's student does in each planned scene, in slide order (GD12). */
const FAKE_SCENES = [
  'walks to a library at dusk',
  'reads at a long wooden table',
  'writes in a notebook by a window',
  'talks with a friend on the library steps',
  'packs a bag beside a desk lamp',
]
/** A blog outline's section headings and FAQ questions (BR2): questions with no number. */
const FAKE_BLOG_QUESTIONS = [
  'What does this mean for you?',
  'Who does it apply to?',
  'What should you do first?',
  'Where can you check the details?',
  'What changes after that?',
]
const FAKE_BLOG_FAQ = ['Is this the same for everyone?', 'Can it change?', 'Who can I ask?']
/** About how many words of body the fake's blog text runs to, inside 600 to 1,200 (BR3). */
const FAKE_BLOG_WORDS = 700
/** The fake comic's panels after the first (RC2): plain captions, no number, scenes the art guard passes. */
const FAKE_COMIC_PANELS: [caption: string, scene: string][] = [
  [
    'Classes begin, and the student learns where the quiet desks are.',
    'The student in a grey hoodie reads at a long wooden table in a bright library, late morning light.',
  ],
  [
    'Evenings bring a part-time shift, then a late bus home.',
    'The student in a grey hoodie sits by a bus window at night, city lights passing outside.',
  ],
  [
    'At the weekend the student walks by the water and plans the weeks ahead.',
    'The student in a grey hoodie walks along a river path at sunset, the water calm and gold.',
  ],
]
const FAKE_PANORAMA =
  'A wide street at dusk, from a bus stop on the left past small shops to a lit library on the right, a student in a green scarf walking along it.'

/**
 * A nudged slot (GD10), whatever the chip: about two thirds of its words from the start, never
 * under the slot's limit; the text as it was when that would leave all of it, or too little.
 */
function nudged(text: string, limit: DraftSlotData['limit']): string {
  // A points slot keeps its points (GD34): cutting words would run them together.
  if (limit.unit === 'points') return text
  const all = words(text)
  const keep = Math.ceil((all.length * 2) / 3)
  const n = limit.unit === 'words' ? Math.max(keep, limit.min) : keep
  const cut = all.slice(0, n).join(' ')
  if (n >= all.length || Array.from(cut).length < (limit.unit === 'chars' ? limit.min : 1)) {
    return text
  }
  return cut
}

/** The fact's text, then the words of the paragraph it comes from, over and over, to `total` words. */
function fakeBody(fact: { text: string } | undefined, paragraphs: Paragraph[], total: number) {
  const out = fact ? words(fact.text) : []
  const paragraph =
    paragraphs.length === 0 ? '' : bestParagraph(fact?.text ?? '', paragraphs).paragraph.text
  const filler = words(paragraph)
  for (let i = 0; filler.length > 0 && out.length < total; i++) out.push(filler[i % filler.length])
  return out.join(' ')
}

const PLAIN_TITLE = 'Paid work and first-year grades'
const PLAIN_LINE =
  'Your first year sets the pace for the years after it, so protect your study time.'
/** A points slot's points (GD34), short and with no number. */
const PLAIN_POINTS = [
  'Check your visa work hours',
  'Ask about exam weeks early',
  'Keep one day a week free',
  'Book your shifts ahead',
  'Rest before your exams',
]

/**
 * A slot the planted answers do not name, filled from its key's data alone: inside its limit, a
 * factual slot saying (and bound to) the first fact, any other slot plain words with no number;
 * a points slot its fewest plain points, one per line.
 */
function anySlot(slot: DraftSlotData, fact: { id: string; text: string } | undefined): FakeSlot {
  const { unit, min, max } = slot.limit
  const said = slot.factual && fact ? fact.text : unit === 'words' ? PLAIN_LINE : PLAIN_TITLE
  let text: string
  if (unit === 'points') {
    text = PLAIN_POINTS.slice(0, Math.max(1, min)).join('\n')
  } else if (unit === 'words') {
    let out = words(said)
    while (out.length < min) out = [...out, ...words(said)]
    text = out.slice(0, max).join(' ')
  } else {
    text = Array.from(said).slice(0, max).join('').trimEnd()
    while (Array.from(text).length < min) text = `${text} ${said}`.slice(0, max).trimEnd()
  }
  return { text, fact_ids: slot.factual && fact ? [fact.id] : [] }
}

/** Per-use-case answers; Tasks 12–14, 26 and 27 add theirs. */
export const FAKE_ANSWERS: FakeAnswers = {
  /** Each paragraph's first sentence as a fact, by its id; key ideas from ¶1–¶3, each whole (GD26). */
  extract(data) {
    const { paragraphs } = data as { paragraphs: ExtractParagraph[] }
    const firsts = paragraphs.flatMap((p) => p.sentences.slice(0, 1))
    return {
      key_ideas: firsts.slice(0, 3).map((s) => s.text),
      facts: firsts.map((s) => s.id),
    }
  },
  /**
   * Four cards from the pool whose hooks DATA.avoid does not list, in order; Field Notes and Data
   * Desk by turns, the third card Postcard when DATA.places names a place, ranked in order. Fewer
   * when the pool runs low. The first three of DATA.formats are the top three (GD33), the cards
   * taking them by turns, so the best card has the first.
   */
  ideas(data) {
    const { avoid, places, formats } = data as {
      avoid: string[]
      places: string[]
      formats?: { id: string }[]
    }
    const shown = new Set(avoid.map((h) => h.toLowerCase()))
    const say = sayerFor(data)
    const fresh = FAKE_IDEAS.filter(([, hook]) => !shown.has(say(hook).toLowerCase())).slice(0, 4)
    const top = (formats ?? []).slice(0, 3).map((f) => f.id)
    return {
      cards: fresh.map(([angle, hook, audience], i) => ({
        angle: say(angle),
        hook: say(hook),
        audience: say(audience),
        look: i === 2 && places.length > 0 ? 'postcard' : i % 2 === 0 ? 'field-notes' : 'data-desk',
        format: top[i % top.length] ?? '',
        slides: 5 + (i % 2),
        rank: i + 1,
      })),
      formats: top,
    }
  },
  /**
   * The look's fewest slides (GD32): the cover as the hook saying the first card's hook, each
   * middle slide a picture saying the next supported fact (cut to a whole word under 120
   * characters), and the takeaway.
   */
  outline(data) {
    const { look, idea, facts } = data as OutlineData
    const point = (text: string) =>
      Array.from(text).length <= 120 ? text : text.slice(0, 120).replace(/\s+\S*$/, '')
    const slides: { job: string; layout: string; point: string }[] = []
    let middle = 0
    for (const { kind, repeat } of look.slides) {
      for (let i = 0; i < repeat.min; i++) {
        if (kind === 'cover') {
          slides.push({ job: 'hook', layout: 'cover', point: idea.cards[0]?.hook ?? PLAIN_TITLE })
        } else if (kind === 'take') {
          slides.push({ job: 'takeaway', layout: 'takeaway', point: PLAIN_LINE })
        } else {
          const fact = facts.length > 0 ? facts[middle % facts.length] : undefined
          middle++
          slides.push({ job: 'point', layout: 'picture', point: point(fact?.text ?? PLAIN_LINE) })
        }
      }
    }
    const say = sayerFor(data)
    return { slides: slides.map((s) => ({ ...s, point: say(s.point) })) }
  },
  /**
   * A blog's outline (BR2): a section per supported fact, three to five, each a question from the
   * pool answered by the next fact (cut to a whole word under 200 characters); the first three
   * facts as the takeaways, and three questions answered the same way.
   */
  blog_outline(data) {
    const { facts } = data as { facts: { text: string }[] }
    const say = sayerFor(data)
    const point = (i: number) => {
      const text = facts.length > 0 ? facts[i % facts.length].text : PLAIN_LINE
      return say(Array.from(text).length <= 200 ? text : text.slice(0, 200).replace(/\s+\S*$/, ''))
    }
    const count = Math.min(Math.max(facts.length, 3), FAKE_BLOG_QUESTIONS.length)
    return {
      sections: FAKE_BLOG_QUESTIONS.slice(0, count).map((heading, i) => ({
        heading: say(heading),
        point: point(i),
      })),
      takeaways: [0, 1, 2].map(point),
      faq: FAKE_BLOG_FAQ.map((q, i) => ({ q: say(q), point: point(i) })),
    }
  },
  /**
   * A blog's text (BR3): each section's body the supported facts word for word, from the
   * section's own on and round again, until the bodies reach about 700 words in all, each bound to
   * the facts it says; the outline's takeaways as they are; each answer the next fact, bound to it.
   */
  blog_text(data) {
    const { outline, facts } = data as {
      outline: { sections: unknown[]; takeaways: string[]; faq: unknown[] }
      facts: { id: string; text: string }[]
    }
    const say = sayerFor(data)
    const perSection = Math.ceil(FAKE_BLOG_WORDS / Math.max(outline.sections.length, 1))
    return {
      sections: outline.sections.map((_, i) => {
        const said: { id: string; text: string }[] = []
        let count = 0
        for (let k = i; facts.length > 0 && count < perSection; k++) {
          const fact = facts[k % facts.length]
          said.push(fact)
          count += words(fact.text).length
        }
        return {
          body: say(said.length > 0 ? said.map((f) => f.text).join(' ') : PLAIN_LINE),
          fact_ids: [...new Set(said.map((f) => f.id))],
        }
      }),
      takeaways: outline.takeaways.map(say),
      faq: outline.faq.map((_, i) => {
        const fact = facts.length > 0 ? facts[i % facts.length] : undefined
        return fact ? { a: say(fact.text), fact_ids: [fact.id] } : { a: '', fact_ids: [] }
      }),
    }
  },
  /**
   * A scene per slide in DATA.slides, the same student in each doing the next thing in the
   * pool; one wide street for a panorama. No digit, quote mark or brand, each under 200 characters.
   */
  scene_plan(data) {
    const { slides, panorama } = data as { slides: { slide: number }[]; panorama: boolean }
    if (panorama) return { scenes: [{ slide: 1, scene: FAKE_PANORAMA }] }
    return {
      scenes: slides.map(({ slide }, i) => ({
        slide,
        scene: `A student in a green scarf ${FAKE_SCENES[i % FAKE_SCENES.length]}, soft daylight.`,
      })),
    }
  },
  /** A comic's story (RC2): four panels, the path's label in the first caption, no number anywhere. */
  comic_story(data) {
    const { path } = data as { path: string }
    const say = sayerFor(data)
    return {
      title: say('Life on this path'),
      panels: [
        {
          caption: say(`The student starts a new life here: ${path}.`),
          scene:
            'The student in a grey hoodie steps off a train into a bright city street, a backpack on, morning light.',
        },
        ...FAKE_COMIC_PANELS.map(([caption, scene]) => ({ caption: say(caption), scene })),
      ],
    }
  },
  /** The comic character's views (RC9): five, the same clothes in each, no number anywhere. */
  character_plan() {
    const clothes = 'a grey hoodie, dark jeans and white trainers'
    return {
      views: [
        { label: 'Front', scene: `Standing facing us, relaxed, short dark hair, ${clothes}.` },
        { label: 'Side', scene: `In profile, walking to the left, ${clothes}, a backpack on.` },
        { label: 'Back', scene: `Seen from behind, ${clothes}, the backpack on both shoulders.` },
        { label: 'Smiling', scene: 'Head and shoulders, a wide smile, the grey hood down.' },
        { label: 'Thinking', scene: 'Head and shoulders, eyes up, one hand at the chin.' },
      ],
    }
  },
  /** Supported when one paragraph holds at least 60% of the claim's content words; ref is that paragraph. */
  source_check(data) {
    const { claim, paragraphs } = data as { claim: string; paragraphs: Paragraph[] }
    // A claim the fake wrote in a post's language (GD37) is read against the paragraphs as the
    // fake would write them in that script: the same meaning, by the fake's measure.
    const say = sayerIn(scriptOfClaim(claim))
    const best = bestParagraph(
      claim,
      paragraphs.map((p) => ({ ...p, text: say(p.text) })),
    )
    const supported = contentWords(claim).size > 0 && best.overlap >= 0.6
    return {
      supported,
      ref: supported ? best.paragraph.ref : null,
      why: supported ? 'Supported.' : 'No paragraph says this.',
    }
  },
  /**
   * Three versions, each `repeat.min` of each slide, or the outline's slides when DATA.outline is
   * given (GD32), bodies bound one fact each, with each template's planted trait in every version;
   * the versions differ by angle and body heading.
   */
  draft(data) {
    const { template, facts, paragraphs, base, outline } = data as DraftData
    const say = sayerFor(data)
    // A version in a nudge's direction (GD10): DATA.base back as one version, every slot nudged.
    if (base) {
      const limitOf = (slide: { kind: string; layout: string | null }, key: string) =>
        (slide.layout
          ? template.layouts?.find((l) => l.id === slide.layout)?.slots
          : template.slides.find((s) => s.kind === slide.kind)?.slots
        )?.find((s) => s.key === key)?.limit
      return {
        versions: [
          {
            ...base,
            slides: base.slides.map((slide) => ({
              ...slide,
              slots: slide.slots.map((slot) => {
                const limit = limitOf(slide, slot.key)
                return { ...slot, text: say(limit ? nudged(slot.text, limit) : slot.text) }
              }),
            })),
          },
        ],
      }
    }
    const ids = (fact?: { id: string }) => (fact ? [fact.id] : [])
    const twenty = facts.find((f) => f.text.includes('20 hours')) ?? facts[0]
    const fixed: Record<string, FakeSlot> = {
      kicker: { text: 'Research, briefly', fact_ids: [] },
      phrase: { text: '20-hour', fact_ids: [] },
      byline: { text: 'OfCourse · 5 min read', fact_ids: [] },
      takeaway: { text: 'Keep paid work under 20 hours a week in first year.', fact_ids: [] },
      pre: { text: 'Working', fact_ids: [] },
      underline: { text: 'up to 20 hours', fact_ids: ids(twenty) },
      post: { text: "a week didn't hurt grades.", fact_ids: ids(twenty) },
      aphorism: { text: "It isn't the job. It's the 21st hour.", fact_ids: [] },
      credit: { text: 'Survey of international students (mock)', fact_ids: ids(facts[0]) },
    }
    const body = (n: number, heading: string, cap: number): Record<string, FakeSlot> => {
      const fact = facts.length > 0 ? facts[(n - 1) % facts.length] : undefined
      const total = template.id === 'the-long-read' && n === 1 ? 121 : Math.min(40, cap)
      let text = fakeBody(fact, paragraphs, total)
      // The filler stops mid-sentence; close it so the planted line is a sentence of its own.
      if (template.id === 'the-line' && n === 2)
        text = `${text.replace(/[.!?]?$/, '.')} ${LIMIT_LINE}`
      const unbound = template.id === 'the-question' && n === 1
      return {
        heading: { text: `${heading} ${n}`, fact_ids: [] },
        body: { text, fact_ids: unbound ? [] : ids(fact) },
      }
    }
    // Each slide's kind and its slots: the outline's slides with their layouts (GD32), else each
    // kind `repeat.min` times, a look's slide in its kind's first layout (cover, picture, takeaway).
    const planned: { kind: string; layout: string | null; slots: DraftSlotData[] }[] = outline
      ? outline.slides.flatMap(({ layout: id }) => {
          const layout = template.layouts?.find((l) => l.id === id)
          return layout ? [{ kind: layout.kind, layout: id, slots: layout.slots }] : []
        })
      : template.slides.flatMap(({ kind, repeat, ...drafting }) => {
          const layout = template.layouts?.find((l) => l.kind === kind)
          const slots = layout?.slots ?? drafting.slots ?? []
          return Array.from({ length: repeat.min }, () => ({
            kind,
            layout: layout?.id ?? null,
            slots,
          }))
        })
    const slidesOf = (heading: string) => {
      let bodies = 0
      return planned.map(({ kind, layout, slots }) => {
        // A body's words stay inside its slot's word limit (a look takes 25 at most).
        const cap = slots.find((s) => s.key === 'body' && s.limit.unit === 'words')?.limit.max ?? 40
        const n = kind === 'body' ? ++bodies : 0
        const filled = kind === 'body' ? body(n, heading, cap) : fixed
        return {
          kind,
          layout,
          slots: slots.map((slot) => {
            const filledSlot = filled[slot.key] ?? anySlot(slot, facts[0])
            return {
              key: slot.key,
              ...filledSlot,
              text: saidWithin(filledSlot.text, slot.limit, say),
            }
          }),
        }
      })
    }
    const markers = JSON.stringify(paragraphs).match(FAKE_MARKER) ?? []
    const art_prompt = [
      'An open notebook beside a small desk clock, ink line on a paper texture.',
      ...markers,
    ].join(' ')
    return {
      versions: FAKE_ANGLES.map(([angle, heading]) => ({
        angle,
        slides: slidesOf(heading),
        art_prompt,
      })),
    }
  },
  /**
   * Another take on one slide: every slot prefixed "Another take: ", a factual slot saying its
   * first fact, over again until the slot's minimum; each cut to its limit. With a nudge (GD10),
   * every slot nudged instead.
   */
  draft_slide(data) {
    const { slots, facts, nudge } = data as SlideData
    const say = sayerFor(data)
    if (nudge) {
      return {
        slots: slots.map(({ key, text, limit }) => ({ key, text: say(nudged(text, limit)) })),
      }
    }
    return {
      slots: slots.map(({ key, factual, limit, text, fact_ids }) => {
        const fact = facts.find((f) => f.id === fact_ids[0])
        // A points slot: each point taken again, one per line (GD34).
        if (limit.unit === 'points') {
          const points = text.split('\n').filter((line) => line.trim() !== '')
          return { key, text: say(points.map((p) => `Another take: ${p}`).join('\n')) }
        }
        let out = `Another take: ${factual && fact ? fact.text : text}`
        if (limit.unit === 'words') {
          while (fact && words(out).length < limit.min) out = `${out} ${fact.text}`
          out = words(out).slice(0, limit.max).join(' ')
        } else {
          out = Array.from(out).slice(0, limit.max).join('').trimEnd()
        }
        return { key, text: saidWithin(out, limit, say) }
      }),
    }
  },
  /** Each presentational slot prefixed "With your family: ", cut to its limit, in DATA.language's script; [fake:market-number] adds " 999" to the first. */
  market(data) {
    const { slots } = data as { slots: MarketSlot[] }
    const say = sayerFor(data)
    const marked = JSON.stringify(data).includes('[fake:market-number]')
    return {
      slots: slots.map(({ slide, slot, text, limit }, i) => {
        const framed = `With your family: ${text}`
        const cut =
          limit.unit === 'words'
            ? words(framed).slice(0, limit.max).join(' ')
            : Array.from(framed).slice(0, limit.max).join('').trimEnd()
        const said = saidWithin(cut, limit, say)
        return { slide, slot, text: marked && i === 0 ? `${said} 999` : said }
      }),
      feed_excerpt: say("Deciding with your family how many hours you'll work?"),
    }
  },
  /** The same hook and call to action for any post; [fake:caption-number] puts " 999" in the hook. */
  caption(data) {
    const say = sayerFor(data)
    const marked = JSON.stringify(data).includes('[fake:caption-number]')
    const hook = 'Before you decide, read what the research says.'
    return {
      hook: say(marked ? `${hook} 999` : hook),
      call_to_action: say('Save this for later and share it with a friend who needs it.'),
    }
  },
  /** The same short look and voice for any images; the first template in DATA as the closest. */
  design_language(data) {
    const { templates } = data as { templates: { id: string }[] }
    return {
      art_style: 'Clean ink line on a pale ground, one subject per frame, wide margins.',
      copy_style: 'Short plain sentences, one idea per slide, spoken to the reader as you.',
      closest_template_id: templates[0]?.id ?? '',
    }
  },
  /** A page on each site FAKE_SOURCES grounds, official, named by title and site with no address (BR12). */
  suggest_sources() {
    return {
      sources: [
        {
          title: 'Work while you study',
          site: 'studyaustralia.gov.au',
          why: 'The government guide to working on a student visa.',
          official: true,
        },
        {
          title: 'Student visa (subclass 500)',
          site: 'immi.homeaffairs.gov.au',
          why: 'The visa and its conditions, work among them.',
          official: true,
        },
        {
          title: 'International education data and research',
          site: 'education.gov.au',
          why: 'Figures on international students in Australia.',
          official: true,
        },
      ],
    }
  },
  /** A page on each site FAKE_SOURCES grounds, named by title and site, each quoted as stating DATA.claim (BR14). */
  research_claim(data) {
    const { claim } = data as { claim: string }
    return {
      sources: [
        { title: 'Work while you study', site: 'studyaustralia.gov.au', sentence: claim },
        { title: 'Student visa (subclass 500)', site: 'immi.homeaffairs.gov.au', sentence: claim },
        {
          title: 'International education data and research',
          site: 'education.gov.au',
          sentence: claim,
        },
      ],
    }
  },
  /** Text in the art only for the red square [fake:art-text] paints. */
  art_check(_data, images) {
    const red = Buffer.from(fakeImage(TEXT_FILL)).toString('base64')
    return { has_text: images?.[0]?.base64 === red }
  },
}

/** The art the fake paints: an 8 × 8 square, #CCCCCC, or #CC0000 for art "with text"; each drawn by resvg once. */
const fakeArt = new Map<string, Uint8Array>()
function fakeImage(fill = '#CCCCCC'): Uint8Array {
  let art = fakeArt.get(fill)
  if (!art) {
    art = new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${fill}"/></svg>`,
    )
      .render()
      .asPng()
    fakeArt.set(fill, art)
  }
  return new Uint8Array(art)
}
const TEXT_FILL = '#CC0000'

/** The three pages every fake search is grounded on, the first and last as Vertex gives them: a redirect URI titled by its domain. */
export const FAKE_SOURCES: GroundedSource[] = [
  {
    url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/fake-study-australia',
    title: 'studyaustralia.gov.au',
  },
  {
    url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500',
    title: 'Student visa (subclass 500)',
  },
  {
    url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/fake-education-data',
    title: 'education.gov.au',
  },
]
/** The fake's search entry point: inert markup in the place of Google's search chips. */
export const FAKE_ENTRY_POINT = '<div class="fake-search-entry-point">Search suggestions</div>'

export function makeFake(answers: FakeAnswers = FAKE_ANSWERS): Provider {
  return {
    async json(req) {
      const text = JSON.stringify(req.data) ?? ''
      if (text.includes(`[fake:fail-${req.useCase}]`)) {
        throw new Error(`Fake failure for ${req.useCase}`)
      }
      if (text.includes(`[fake:bad-${req.useCase}]`) && !req.user.includes(RETRY_LEAD)) {
        return JSON.stringify('[fake:bad] not the schema')
      }
      const answer = answers[req.useCase]
      if (!answer) throw new Error(`Unknown fake use case: ${req.useCase}`)
      return JSON.stringify(answer(req.data, req.images ?? []))
    },
    /** The use case's answer, grounded on FAKE_SOURCES; [fake:fail-search] in data throws. */
    async search(req) {
      if ((JSON.stringify(req.data) ?? '').includes('[fake:fail-search]')) {
        throw new Error('Fake failure for search')
      }
      const answer = answers[req.useCase]
      if (!answer) throw new Error(`Unknown fake use case: ${req.useCase}`)
      return {
        text: JSON.stringify(answer(req.data)),
        sources: FAKE_SOURCES,
        entryPoint: FAKE_ENTRY_POINT,
      }
    },
    async image(req) {
      const marked = [req.prompt, JSON.stringify(req.data) ?? ''].some((t) =>
        t.includes('[fake:fail-art]'),
      )
      if (marked) throw new Error('Fake failure for art')
      return fakeImage(req.prompt.includes('[fake:art-text]') ? TEXT_FILL : undefined)
    },
  }
}
