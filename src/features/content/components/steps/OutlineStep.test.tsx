/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { Staff } from '@/shared/lib/auth/access'
import { PAID_WORK_TEXTS, PAID_WORK_TITLE } from '../../demo-sources/paid-work'
import { HEADING_MAX } from '../../lib/blog-outline'
import { emptyPointers } from '../../model/artifacts'
import type { CurrentPost } from '../../model/current'
import type { IdeaCard, OutlineSlide } from '../../model/types'
import type { Saved } from '../../server/commands'
import { nativeOf } from '../../text/native-fixtures'

const push = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh: () => {} }),
}))

const { BlogOutlineStep, OutlineStep } = await import('./OutlineStep')
type Props = Parameters<typeof OutlineStep>[0]

const CARD: IdeaCard = {
  angle: 'The 20-hour line',
  hook: 'Twenty hours is where grades start to slip.',
  audience: 'First-years with a job',
  look: 'field-notes',
  slides: 5,
}
/** A Field Notes outline at its fewest slides. */
const SLIDES: OutlineSlide[] = [
  { job: 'hook', layout: 'cover', point: 'Paid work has a limit.' },
  { job: 'point', layout: 'picture', point: 'Most students work.' },
  { job: 'proof', layout: 'number', point: 'Twenty hours a week is the line.' },
  { job: 'step', layout: 'checklist', point: 'Plan your shifts.' },
  { job: 'takeaway', layout: 'takeaway', point: 'Protect your study time.' },
]

const current = (slides = SLIDES): CurrentPost => ({
  source: {
    id: 'src1',
    body: {
      title: PAID_WORK_TITLE,
      kind: 'research summary',
      text: PAID_WORK_TEXTS.join('\n\n'),
      paragraphs: PAID_WORK_TEXTS.map((text, i) => ({ ref: `¶${i + 1}`, text })),
      demoKey: null,
      language: 'en',
    },
  },
  facts: { id: 'facts1', body: { sourceId: 'src1', keyIdeas: [], facts: [], replays: [] } },
  drafts: null,
  ideas: { id: 'ideas1', body: { factsId: 'facts1', cards: [CARD], rounds: 1 } },
  outline: {
    id: 'o1',
    body: { factsId: 'facts1', ideas: [CARD], format: null, slides, note: 'Outlined' },
  },
  blogOutline: null,
  blogText: null,
  blogImages: null,
  revision: null,
  layout: null,
  render: null,
  covers: null,
  artPlan: null,
  sourceCheck: null,
  settings: null,
  sendBack: null,
  approval: null,
  market: null,
  caption: null,
  export: null,
})

const VIEW: Props['view'] = {
  id: 'p1',
  title: PAID_WORK_TITLE,
  stage: 'structures',
  version: 4,
  pointers: { ...emptyPointers(), sourceId: 'src1', factsId: 'facts1', outlineId: 'o1' },
  current: current(),
  createdAt: '2026-10-05T09:12:00.000Z',
  running: [],
  draftChecks: [],
}

const saved = async (): Promise<Saved> => ({ ok: true, id: 'p1', version: 5 })
const actions = {
  editOutlineAction: mock(async (_id: unknown, _at: unknown, _op: unknown) => saved()),
  writeSlidesAction: mock(async (_id: unknown, _at: unknown) => saved()),
  outlineFormatAction: mock(async (_id: unknown, _at: unknown, _format: unknown) => saved()),
}

const EDITOR: Staff = { role: 'user', editor: true }
const REVIEWER: Staff = { role: 'user', reviewer: true }

const step = (over: Partial<Props['view']> = {}, viewer: Staff = EDITOR) =>
  render(<OutlineStep view={{ ...VIEW, ...over }} viewer={viewer} actions={actions} />)

const row = (n: number) => screen.getByRole('listitem', { name: `Slide ${n}` })

afterEach(() => {
  cleanup()
  actions.editOutlineAction.mockClear()
  actions.writeSlidesAction.mockClear()
  actions.outlineFormatAction.mockClear()
  push.mockClear()
})

it("saves a slide's point when it is changed in place, and nothing when it is not (GD32)", async () => {
  step()
  const point = within(row(2)).getByRole('textbox', { name: 'Point' })
  fireEvent.blur(point)
  expect(actions.editOutlineAction).not.toHaveBeenCalled()
  fireEvent.change(point, { target: { value: 'Most students who work keep up.' } })
  await act(async () => {
    fireEvent.blur(point)
  })
  expect(actions.editOutlineAction).toHaveBeenCalledWith('p1', 4, {
    op: 'change',
    slide: 2,
    point: 'Most students who work keep up.',
  })
})

it("changes a slide's job and layout, and moves and removes slides (GD32)", async () => {
  step({ current: current([...SLIDES.slice(0, 4), SLIDES[1], SLIDES[4]]) })
  await act(async () => {
    fireEvent.change(within(row(3)).getByRole('combobox', { name: 'Layout' }), {
      target: { value: 'bars' },
    })
  })
  await act(async () => {
    fireEvent.change(within(row(3)).getByRole('combobox', { name: 'Job' }), {
      target: { value: 'compare' },
    })
  })
  await act(async () => {
    fireEvent.click(within(row(3)).getByRole('button', { name: 'Move slide 3 up' }))
  })
  await act(async () => {
    fireEvent.click(within(row(5)).getByRole('button', { name: 'Remove slide 5' }))
  })
  expect(actions.editOutlineAction.mock.calls.map((c) => c[2])).toEqual([
    { op: 'change', slide: 3, layout: 'bars' },
    { op: 'change', slide: 3, job: 'compare' },
    { op: 'move', slide: 3, to: 2 },
    { op: 'remove', slide: 5 },
  ])
})

it('keeps a change the look does not take disabled with the reason: no removing at its fewest slides, the cover stays first (GD32)', () => {
  step()
  const remove = within(row(2)).getByRole('button', { name: 'Remove slide 2' })
  expect(remove).toBeDisabled()
  expect(screen.getAllByText('A Field Notes post has 5 to 7 slides.').length).toBeGreaterThan(0)
  expect(within(row(1)).getByRole('button', { name: 'Move slide 1 down' })).toBeDisabled()
  expect(within(row(1)).queryByRole('button', { name: 'Move slide 1 up' })).toBeNull()
})

it('adds a slide with its point before the takeaway (GD32)', async () => {
  step()
  fireEvent.change(screen.getByRole('textbox', { name: "New slide's point" }), {
    target: { value: 'Ask about exam weeks.' },
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Add a slide' }))
  })
  expect(actions.editOutlineAction).toHaveBeenCalledWith('p1', 4, {
    op: 'add',
    at: 5,
    slide: { job: 'point', layout: 'picture', point: 'Ask about exam weeks.' },
  })
})

it('writes the slides to the outline and opens the text versions (GD32)', async () => {
  step()
  expect(screen.getByText('Field Notes')).toBeInTheDocument()
  expect(
    within(screen.getByRole('region', { name: 'Step actions' })).getByRole('button', {
      name: 'Write the slides',
    }),
  ).toBeInTheDocument()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Write the slides' }))
  })
  expect(actions.writeSlidesAction).toHaveBeenCalledWith('p1', 4)
  expect(push).toHaveBeenCalledWith('/admin/posts/p1/text')
})

it('shows the drafting in words while the slides are written, every control waiting, and a failed draft with "Try again"', async () => {
  step({ running: ['draft'], progress: { draft: { done: 0, total: 3 } } })
  expect(screen.getByRole('status')).toHaveTextContent('Drafting 3 versions')
  expect(screen.getByRole('button', { name: 'Write the slides' })).toBeDisabled()
  expect(within(row(2)).getByRole('textbox', { name: 'Point' })).toBeDisabled()
  cleanup()
  step({ failed: ['draft'] })
  expect(screen.getByText('Drafting failed. Your outline is kept.')).toBeInTheDocument()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  })
  expect(actions.writeSlidesAction).toHaveBeenCalledWith('p1', 4)
})

/** The post at its outline in `format`, its ideas' top three formats `top` (GD33). */
const withFormat = (format: string | null, top?: string[]): CurrentPost => {
  const now = current()
  return {
    ...now,
    ideas: now.ideas && { ...now.ideas, body: { ...now.ideas.body, formats: top as never } },
    outline: now.outline && {
      ...now.outline,
      body: { ...now.outline.body, format: format as never },
    },
  }
}

it("offers the ten formats, the model's top three first and marked Recommended, the outline's chosen with its description; another outlines again (GD33)", async () => {
  step({ current: withFormat('myth-vs-fact', ['then-vs-now', 'myth-vs-fact', 'bullet-points']) })
  const select = screen.getByRole('combobox', { name: 'Format' })
  const options = within(select).getAllByRole('option')
  expect(options.map((o) => o.getAttribute('value'))).toEqual([
    'then-vs-now',
    'myth-vs-fact',
    'bullet-points',
    'things-nobody-tells-you',
    'this-or-that',
    'step-by-step',
    'one-idea-per-slide',
    'day-in-the-life',
    'question-and-answer',
    'before-you-go',
  ])
  expect(options.slice(0, 3).every((o) => o.textContent?.endsWith('Recommended'))).toBe(true)
  expect(options.slice(3).some((o) => o.textContent?.includes('Recommended'))).toBe(false)
  expect(select).toHaveValue('myth-vs-fact')
  expect(
    screen.getByText('Each slide names a common belief, then what the facts say instead.'),
  ).toBeInTheDocument()
  await act(async () => {
    fireEvent.change(select, { target: { value: 'step-by-step' } })
  })
  expect(actions.outlineFormatAction).toHaveBeenCalledWith('p1', 4, 'step-by-step')
})

it('shows the outlining in words while a format is outlined, every control waiting, and a failed outline with "Try again" in the format last chosen (GD33)', async () => {
  step({ current: withFormat('myth-vs-fact'), running: ['outline'] })
  expect(screen.getByRole('combobox', { name: 'Format' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Write the slides' })).toBeDisabled()
  expect(within(row(2)).getByRole('textbox', { name: 'Point' })).toBeDisabled()
  cleanup()
  actions.outlineFormatAction.mockImplementationOnce(async () => ({
    ok: false as const,
    error: 'Outlining failed.',
  }))
  const { rerender } = step({ current: withFormat('myth-vs-fact') })
  await act(async () => {
    fireEvent.change(screen.getByRole('combobox', { name: 'Format' }), {
      target: { value: 'then-vs-now' },
    })
  })
  rerender(
    <OutlineStep
      view={{ ...VIEW, current: withFormat('myth-vs-fact'), failed: ['outline'] }}
      viewer={EDITOR}
      actions={actions}
    />,
  )
  expect(screen.getByText('Outlining failed. Your outline is kept.')).toBeInTheDocument()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  })
  expect(actions.outlineFormatAction.mock.calls.map((c) => c[2])).toEqual([
    'then-vs-now',
    'then-vs-now',
  ])
})

it('shows a viewer who may not edit the outline with no control', () => {
  step({}, REVIEWER)
  expect(row(2)).toHaveTextContent('Most students work.')
  expect(screen.queryAllByRole('button')).toHaveLength(0)
  expect(screen.queryAllByRole('textbox')).toHaveLength(0)
  expect(screen.queryAllByRole('combobox')).toHaveLength(0)
})

describe("a blog's outline (BR2)", () => {
  const SECTIONS = [
    { heading: 'How many hours can I work?', point: 'Twenty a week in term.' },
    { heading: 'Does work hurt grades?', point: 'Past twenty hours, it can.' },
    { heading: 'What about the holidays?', point: 'Full time is allowed.' },
  ]
  const blogCurrent = (sections = SECTIONS): CurrentPost => ({
    ...current(),
    outline: null,
    blogOutline: {
      id: 'bo1',
      body: {
        factsId: 'facts1',
        idea: CARD,
        sections,
        takeaways: ['Twenty hours in term.', 'Full time in holidays.', 'Grades come first.'],
        faq: [
          { q: 'Can I work two jobs?', point: 'Yes, within the hours.' },
          { q: 'Who checks my hours?', point: 'Your visa conditions.' },
          { q: 'Do breaks count?', point: 'Official breaks only.' },
        ],
        note: 'Outlined',
      },
    },
  })
  const blogActions = {
    editBlogOutlineAction: mock(async (_id: unknown, _at: unknown, _op: unknown) => saved()),
    writeBlogAction: mock(async (_id: unknown, _at: unknown) => saved()),
  }
  const blogStep = (over: Partial<Props['view']> = {}, viewer: Staff = EDITOR) =>
    render(
      <BlogOutlineStep
        view={{ ...VIEW, kind: 'blog', current: blogCurrent(), ...over }}
        viewer={viewer}
        actions={blogActions}
      />,
    )
  const section = (n: number) => screen.getByRole('listitem', { name: `Section ${n}` })

  afterEach(() => {
    blogActions.editBlogOutlineAction.mockClear()
    blogActions.writeBlogAction.mockClear()
  })

  it('moves, removes and adds sections with the operation for each', async () => {
    blogStep()
    await act(async () => {
      fireEvent.click(within(section(2)).getByRole('button', { name: 'Move section 2 up' }))
    })
    await act(async () => {
      fireEvent.click(within(section(1)).getByRole('button', { name: 'Move section 1 down' }))
    })
    await act(async () => {
      fireEvent.click(within(section(3)).getByRole('button', { name: 'Remove section 3' }))
    })
    fireEvent.change(screen.getByRole('textbox', { name: "New section's heading" }), {
      target: { value: 'Can I work from home?' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: "New section's point" }), {
      target: { value: 'Remote work counts the same.' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add a section' }))
    })
    expect(blogActions.editBlogOutlineAction.mock.calls.map((c) => [c[0], c[1], c[2]])).toEqual([
      ['p1', 4, { op: 'move', section: 2, to: 1 }],
      ['p1', 4, { op: 'move', section: 1, to: 2 }],
      ['p1', 4, { op: 'remove', section: 3 }],
      [
        'p1',
        4,
        {
          op: 'add',
          at: 4,
          section: { heading: 'Can I work from home?', point: 'Remote work counts the same.' },
        },
      ],
    ])
  })

  it("rewords a section's heading or point when it is changed in place, and refuses a heading that is not a question", async () => {
    blogStep()
    const heading = within(section(1)).getByRole('textbox', { name: 'Heading' })
    fireEvent.blur(heading)
    expect(blogActions.editBlogOutlineAction).not.toHaveBeenCalled()
    fireEvent.change(heading, { target: { value: 'Hours in term' } })
    fireEvent.blur(heading)
    expect(blogActions.editBlogOutlineAction).not.toHaveBeenCalled()
    expect(within(section(1)).getByText(/Write the heading as a question/)).toBeInTheDocument()
    fireEvent.change(heading, { target: { value: 'How long can I work in term?' } })
    await act(async () => {
      fireEvent.blur(heading)
    })
    const point = within(section(2)).getByRole('textbox', { name: 'Point' })
    fireEvent.change(point, { target: { value: 'More than twenty hours can.' } })
    await act(async () => {
      fireEvent.blur(point)
    })
    expect(blogActions.editBlogOutlineAction.mock.calls.map((c) => c[2])).toEqual([
      { op: 'reword', section: 1, heading: 'How long can I work in term?' },
      { op: 'reword', section: 2, point: 'More than twenty hours can.' },
    ])
  })

  it('takes a Thai heading without "?" and a Nepali one at the limit in characters as a reader sees them, holding a field to it (GD37)', async () => {
    const inLanguage = (language: 'ne' | 'th'): CurrentPost => {
      const post = blogCurrent()
      if (!post.source) throw new Error('no source')
      return { ...post, source: { ...post.source, body: { ...post.source.body, language } } }
    }
    blogStep({ current: inLanguage('th') })
    const thai = within(section(1)).getByRole('textbox', { name: 'Heading' })
    fireEvent.change(thai, { target: { value: 'ฉันทำงานพิเศษได้ไหม' } })
    await act(async () => {
      fireEvent.blur(thai)
    })
    cleanup()
    blogStep({ current: inLanguage('ne') })
    const nepali = within(section(1)).getByRole('textbox', { name: 'Heading' })
    fireEvent.change(nepali, { target: { value: `${nativeOf('ne', HEADING_MAX)}?` } })
    expect(nepali).toHaveValue(nativeOf('ne', HEADING_MAX))
    await act(async () => {
      fireEvent.blur(nepali)
    })
    expect(blogActions.editBlogOutlineAction.mock.calls.map((c) => c[2])).toEqual([
      { op: 'reword', section: 1, heading: 'ฉันทำงานพิเศษได้ไหม' },
      { op: 'reword', section: 1, heading: nativeOf('ne', HEADING_MAX) },
    ])
  })

  it('keeps the last section, shows the takeaways and FAQ, and writes the blog', async () => {
    blogStep({ current: blogCurrent(SECTIONS.slice(0, 1)) })
    expect(within(section(1)).getByRole('button', { name: 'Remove section 1' })).toBeDisabled()
    expect(screen.getByText('Grades come first.')).toBeInTheDocument()
    expect(screen.getByText('Who checks my hours?')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Write the blog' }))
    })
    expect(blogActions.writeBlogAction).toHaveBeenCalledWith('p1', 4)
  })

  it('shows the writing in words while the blog is written, and a failed writing with "Try again"', async () => {
    blogStep({ running: ['blog_text'], progress: { blog_text: { done: 0, total: 3 } } })
    expect(screen.getByRole('status')).toHaveTextContent('Writing 3 sections')
    expect(screen.getByRole('button', { name: 'Write the blog' })).toBeDisabled()
    cleanup()
    blogStep({ failed: ['blog_text'] })
    expect(screen.getByText('Writing failed. Your outline is kept.')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    })
    expect(blogActions.writeBlogAction).toHaveBeenCalledWith('p1', 4)
  })

  it('shows a viewer who may not edit the sections with no control', () => {
    blogStep({}, REVIEWER)
    expect(section(2)).toHaveTextContent('Does work hurt grades?')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
  })
})
