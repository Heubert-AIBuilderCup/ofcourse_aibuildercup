import { describe, expect, it } from 'bun:test'
import type { Fact } from '../model/types'
import { NATIVE_IDS, nativeOf } from '../text/native-fixtures'
import { BLOG_POINT_MAX, HEADING_MAX } from './blog-outline'
import {
  BLOG_ANSWER_MAX,
  BLOG_TEXT_ERRORS,
  type BlogText,
  type BlogTextEdit,
  blogClaims,
  blogTextNote,
  editBlogText,
  unansweredQuestions,
} from './blog-text'

const fact = (over: Partial<Fact> = {}): Fact => ({
  id: 'f1',
  text: 'Students on a student visa can work up to 48 hours a fortnight.',
  value: null,
  ref: '¶1',
  quote: null,
  supported: true,
  why: null,
  span: null,
  ...over,
})

const text = (): BlogText => ({
  sections: [
    {
      heading: 'How many hours can I work?',
      body: 'You can work up to 48 hours a fortnight. Plan your shifts.',
      factIds: ['f1'],
    },
    { heading: 'When can I start?', body: 'Once your course has begun.', factIds: ['f2', 'f3'] },
  ],
  takeaways: ['Count your hours.', 'Wait for the course.', 'Plan around classes.'],
  faq: [
    { q: 'Can I work before my course?', a: 'No. Work starts with the course.', factIds: ['f2'] },
    { q: 'Is it weekly?', a: 'It is counted per fortnight.', factIds: ['f1'] },
    { q: 'Who checks it?', a: '', factIds: [] },
  ],
})

describe('blogClaims (BR3)', () => {
  it("reads each sentence of the bodies, the takeaways and the answers, each with its part's supported bound facts as evidence; headings and questions are not claims", () => {
    const facts = [
      fact(),
      fact({ id: 'f2', text: 'Work rights start once the course has begun.', ref: '¶2' }),
      fact({ id: 'f3', text: 'One in 3 skipped classes.', ref: '¶3', supported: false }),
    ]
    const claims = blogClaims(text(), facts)
    expect(claims.map(({ slide, slot, text }) => ({ slide, slot, text }))).toEqual([
      { slide: 1, slot: 'section', text: 'You can work up to 48 hours a fortnight.' },
      { slide: 1, slot: 'section', text: 'Plan your shifts.' },
      { slide: 2, slot: 'section', text: 'Once your course has begun.' },
      { slide: 1, slot: 'takeaway', text: 'Count your hours.' },
      { slide: 2, slot: 'takeaway', text: 'Wait for the course.' },
      { slide: 3, slot: 'takeaway', text: 'Plan around classes.' },
      { slide: 1, slot: 'faq', text: 'No.' },
      { slide: 1, slot: 'faq', text: 'Work starts with the course.' },
      { slide: 2, slot: 'faq', text: 'It is counted per fortnight.' },
    ])
    expect(claims[0].evidence).toEqual([{ ref: '¶1', text: facts[0].text }])
    // The unsupported fact is no evidence; a takeaway binds none, so it is read against the source.
    expect(claims[2].evidence).toEqual([{ ref: '¶2', text: facts[1].text }])
    expect(claims[3].evidence).toEqual([])
  })
})

describe('unansweredQuestions (BR3)', () => {
  it('lists the questions the facts did not answer, by place from 1', () => {
    expect(unansweredQuestions(text())).toEqual([3])
    const answered = text()
    answered.faq[2].a = 'Your school does.'
    expect(unansweredQuestions(answered)).toEqual([])
  })
})

describe('editBlogText (BR3)', () => {
  const edited = (edit: Parameters<typeof editBlogText>[1]) => {
    const result = editBlogText(text(), edit)
    if (!result.ok) throw new Error(result.error)
    return result.text
  }

  it("changes one section's heading or body, trimmed, its facts kept, the rest as it was", () => {
    const body = edited({ part: 'section', index: 1, field: 'body', text: '  Once it begins. ' })
    expect(body.sections[1]).toEqual({
      heading: 'When can I start?',
      body: 'Once it begins.',
      factIds: ['f2', 'f3'],
    })
    expect(body.sections[0]).toEqual(text().sections[0])
    expect(body.takeaways).toEqual(text().takeaways)
    expect(body.faq).toEqual(text().faq)
    const heading = edited({ part: 'section', index: 0, field: 'heading', text: 'How long?' })
    expect(heading.sections[0].heading).toBe('How long?')
  })

  it('changes a takeaway, a question or an answer', () => {
    expect(edited({ part: 'takeaway', index: 2, text: 'Plan.' }).takeaways[2]).toBe('Plan.')
    expect(edited({ part: 'faq', index: 2, field: 'q', text: 'Who counts?' }).faq[2]).toEqual({
      q: 'Who counts?',
      a: '',
      factIds: [],
    })
    expect(edited({ part: 'faq', index: 2, field: 'a', text: 'Your school.' }).faq[2].a).toBe(
      'Your school.',
    )
  })

  it('removes a takeaway or a question, never below three', () => {
    const four = { ...text(), takeaways: [...text().takeaways, 'Rest.'] }
    const removed = editBlogText(four, { part: 'takeaway', index: 0, remove: true })
    expect(removed.ok && removed.text.takeaways).toEqual([
      'Wait for the course.',
      'Plan around classes.',
      'Rest.',
    ])
    expect(editBlogText(text(), { part: 'takeaway', index: 0, remove: true })).toEqual({
      ok: false,
      error: BLOG_TEXT_ERRORS.fewestTakeaways,
    })
    const extra = { q: 'Can it change?', a: 'It can.', factIds: ['f1'] }
    const five = { ...text(), faq: [...text().faq, extra] }
    const gone = editBlogText(five, { part: 'faq', index: 2, remove: true })
    expect(gone.ok && gone.text.faq.map((f) => f.q)).toEqual([
      'Can I work before my course?',
      'Is it weekly?',
      'Can it change?',
    ])
    expect(editBlogText(text(), { part: 'faq', index: 2, remove: true })).toEqual({
      ok: false,
      error: BLOG_TEXT_ERRORS.fewestQuestions,
    })
  })

  it('refuses a part that is not there, a heading or question that is not one, and empty or long text', () => {
    const refused = (edit: Parameters<typeof editBlogText>[1]) => {
      const result = editBlogText(text(), edit)
      return result.ok ? 'saved' : result.error
    }
    for (const index of [-1, 2, 1.5]) {
      expect(refused({ part: 'section', index, field: 'body', text: 'A.' })).toBe(
        BLOG_TEXT_ERRORS.part,
      )
    }
    expect(refused({ part: 'takeaway', index: 3, text: 'A.' })).toBe(BLOG_TEXT_ERRORS.part)
    expect(refused({ part: 'faq', index: 3, remove: true })).toBe(BLOG_TEXT_ERRORS.part)
    expect(refused({ part: 'section', index: 0, field: 'heading', text: 'Hours' })).toBe(
      BLOG_TEXT_ERRORS.heading,
    )
    expect(refused({ part: 'faq', index: 0, field: 'q', text: 'Working early' })).toBe(
      BLOG_TEXT_ERRORS.question,
    )
    expect(refused({ part: 'section', index: 0, field: 'body', text: '  ' })).toBe(
      BLOG_TEXT_ERRORS.body,
    )
    expect(refused({ part: 'section', index: 0, field: 'body', text: 'a'.repeat(10_001) })).toBe(
      BLOG_TEXT_ERRORS.body,
    )
    expect(refused({ part: 'takeaway', index: 0, text: 'a'.repeat(201) })).toBe(
      BLOG_TEXT_ERRORS.takeaway,
    )
    expect(refused({ part: 'faq', index: 0, field: 'a', text: '' })).toBe(BLOG_TEXT_ERRORS.answer)
  })
})

describe('editBlogText in Nepali, Hindi and Thai (GD37)', () => {
  // Each part with its limit and its refusal; the text is the post's language, at the limit.
  const PARTS = [
    [
      (t: string) => ({ part: 'section', index: 0, field: 'heading', text: t }),
      HEADING_MAX,
      BLOG_TEXT_ERRORS.heading,
    ],
    [
      (t: string) => ({ part: 'takeaway', index: 0, text: t }),
      BLOG_POINT_MAX,
      BLOG_TEXT_ERRORS.takeaway,
    ],
    [
      (t: string) => ({ part: 'faq', index: 0, field: 'q', text: t }),
      HEADING_MAX,
      BLOG_TEXT_ERRORS.question,
    ],
    [
      (t: string) => ({ part: 'faq', index: 0, field: 'a', text: t }),
      BLOG_ANSWER_MAX,
      BLOG_TEXT_ERRORS.answer,
    ],
  ] as const satisfies readonly [(t: string) => BlogTextEdit, number, string][]

  it('takes a heading, question or line at its limit in characters as a reader sees them, a question without "?", and refuses one over', () => {
    for (const id of NATIVE_IDS) {
      for (const [edit, max, error] of PARTS) {
        const words = nativeOf(id, max)
        expect(editBlogText(text(), edit(words), id).ok, `${id} ${error}`).toBe(true)
        expect(editBlogText(text(), edit(`${words}?`), id), id).toEqual({ ok: false, error })
      }
    }
  })
})

describe('blogTextNote', () => {
  it('says what changed, numbered from 1', () => {
    expect(blogTextNote({ part: 'section', index: 1, field: 'body', text: 'A.' })).toBe(
      'Section 2 edited',
    )
    expect(blogTextNote({ part: 'section', index: 0, field: 'heading', text: 'A?' })).toBe(
      'Section 1 heading edited',
    )
    expect(blogTextNote({ part: 'takeaway', index: 2, text: 'A.' })).toBe('Takeaway 3 edited')
    expect(blogTextNote({ part: 'faq', index: 0, field: 'q', text: 'A?' })).toBe(
      'Question 1 edited',
    )
    expect(blogTextNote({ part: 'faq', index: 0, field: 'a', text: 'A.' })).toBe('Answer 1 edited')
    expect(blogTextNote({ part: 'takeaway', index: 3, remove: true })).toBe('Takeaway 4 removed')
    expect(blogTextNote({ part: 'faq', index: 4, remove: true })).toBe('Question 5 removed')
  })
})
