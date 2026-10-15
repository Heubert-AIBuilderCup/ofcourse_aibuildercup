import { describe, expect, it } from 'bun:test'
import { NATIVE_IDS, nativeOf } from '../text/native-fixtures'
import {
  BLOG_OUTLINE_ERRORS,
  BLOG_POINT_MAX,
  type BlogSection,
  blogOutlineNote,
  editBlogSections,
  HEADING_MAX,
  isQuestion,
} from './blog-outline'

const section = (n: number): BlogSection => ({
  heading: `Question ${n}?`,
  point: `Point ${n}.`,
})
const sections = (count: number) => Array.from({ length: count }, (_, i) => section(i + 1))
const headings = (edited: ReturnType<typeof editBlogSections>) =>
  edited.ok ? edited.sections.map((s) => s.heading) : edited.error

describe('isQuestion', () => {
  it('takes a heading that ends with a question mark, spaces aside', () => {
    expect(isQuestion('How many hours can I work on a student visa?')).toBe(true)
    expect(isQuestion('Who pays?  ')).toBe(true)
    expect(isQuestion('Working hours on a student visa')).toBe(false)
    expect(isQuestion('?')).toBe(false)
  })

  // Thai asks with a particle (ไหม) and Devanagari may close with a danda (।), so a post not in
  // English takes a heading without a question mark (GD37).
  it('takes any heading in a post not in English, with a question mark or without', () => {
    expect(isQuestion('के म पढाइसँगै काम गर्न सक्छु?', 'ne')).toBe(true)
    expect(isQuestion('विद्यार्थीले कति घण्टा काम गर्न पाउँछन्।', 'ne')).toBe(true)
    expect(isQuestion('क्या मैं पढ़ाई के साथ काम कर सकता हूँ', 'hi')).toBe(true)
    expect(isQuestion('ฉันทำงานพิเศษได้ไหม', 'th')).toBe(true)
    expect(isQuestion('ฉันทำงานพิเศษได้ไหม?', 'th')).toBe(true)
    expect(isQuestion(' ', 'th')).toBe(false)
    expect(isQuestion('Working hours on a student visa', 'en')).toBe(false)
  })
})

describe('editBlogSections (BR2)', () => {
  it('moves a section to another place', () => {
    expect(headings(editBlogSections(sections(3), { op: 'move', section: 3, to: 1 }))).toEqual([
      'Question 3?',
      'Question 1?',
      'Question 2?',
    ])
  })

  it('adds a section at a place, trimmed', () => {
    const added = editBlogSections(sections(2), {
      op: 'add',
      at: 2,
      section: { heading: '  Who checks it?  ', point: ' The school does. ' },
    })
    expect(added).toEqual({
      ok: true,
      sections: [section(1), { heading: 'Who checks it?', point: 'The school does.' }, section(2)],
    })
  })

  it('removes a section', () => {
    expect(headings(editBlogSections(sections(3), { op: 'remove', section: 2 }))).toEqual([
      'Question 1?',
      'Question 3?',
    ])
  })

  it('rewords a heading or a point, keeping the other', () => {
    expect(
      editBlogSections(sections(2), { op: 'reword', section: 2, heading: 'Can I work more?' }),
    ).toEqual({
      ok: true,
      sections: [section(1), { heading: 'Can I work more?', point: 'Point 2.' }],
    })
    expect(editBlogSections(sections(2), { op: 'reword', section: 1, point: 'Sharper.' })).toEqual({
      ok: true,
      sections: [{ heading: 'Question 1?', point: 'Sharper.' }, section(2)],
    })
  })

  it('never goes above eight sections or below one', () => {
    const add = { op: 'add', at: 9, section: section(9) } as const
    expect(editBlogSections(sections(8), add)).toEqual({
      ok: false,
      error: BLOG_OUTLINE_ERRORS.most,
    })
    expect(editBlogSections(sections(1), { op: 'remove', section: 1 })).toEqual({
      ok: false,
      error: BLOG_OUTLINE_ERRORS.fewest,
    })
  })

  it('refuses a heading that is not a question, an empty or long point, and a section not there', () => {
    const fail = (error: string) => ({ ok: false as const, error })
    expect(
      editBlogSections(sections(2), { op: 'reword', section: 1, heading: 'Work hours' }),
    ).toEqual(fail(BLOG_OUTLINE_ERRORS.heading))
    expect(
      editBlogSections(sections(2), {
        op: 'add',
        at: 1,
        section: { heading: `${'Why '.repeat(40)}?`, point: 'A point.' },
      }),
    ).toEqual(fail(BLOG_OUTLINE_ERRORS.heading))
    expect(editBlogSections(sections(2), { op: 'reword', section: 1, point: '   ' })).toEqual(
      fail(BLOG_OUTLINE_ERRORS.point),
    )
    expect(
      editBlogSections(sections(2), { op: 'reword', section: 1, point: 'x'.repeat(201) }),
    ).toEqual(fail(BLOG_OUTLINE_ERRORS.point))
    for (const op of [
      { op: 'remove', section: 3 },
      { op: 'move', section: 1, to: 3 },
      { op: 'move', section: 0, to: 1 },
      { op: 'reword', section: 1.5, point: 'A point.' },
      { op: 'add', at: 4, section: section(4) },
    ] as const) {
      expect(editBlogSections(sections(2), op)).toEqual(fail(BLOG_OUTLINE_ERRORS.section))
    }
  })
})

describe('editBlogSections in Nepali, Hindi and Thai (GD37)', () => {
  it('takes a heading and a point at their limits in characters as a reader sees them, and refuses one over', () => {
    for (const id of NATIVE_IDS) {
      const heading = nativeOf(id, HEADING_MAX)
      const point = nativeOf(id, BLOG_POINT_MAX)
      expect(
        editBlogSections(sections(1), { op: 'add', at: 2, section: { heading, point } }, id),
        id,
      ).toEqual({ ok: true, sections: [section(1), { heading, point }] })
      expect(
        editBlogSections(sections(1), { op: 'reword', section: 1, heading: `${heading}?` }, id),
        id,
      ).toEqual({ ok: false, error: BLOG_OUTLINE_ERRORS.heading })
      expect(
        editBlogSections(sections(1), { op: 'reword', section: 1, point: `${point}.` }, id),
        id,
      ).toEqual({ ok: false, error: BLOG_OUTLINE_ERRORS.point })
    }
  })
})

describe('blogOutlineNote', () => {
  it('says what changed, as the history lists it', () => {
    expect(blogOutlineNote({ op: 'move', section: 3, to: 1 })).toBe('Section 3 moved')
    expect(blogOutlineNote({ op: 'add', at: 2, section: section(2) })).toBe('Section added')
    expect(blogOutlineNote({ op: 'remove', section: 2 })).toBe('Section 2 removed')
    expect(blogOutlineNote({ op: 'reword', section: 4, point: 'x' })).toBe('Section 4 reworded')
  })
})
