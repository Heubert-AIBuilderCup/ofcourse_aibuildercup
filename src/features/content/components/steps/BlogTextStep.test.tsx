/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { Staff } from '@/shared/lib/auth/access'
import { PAID_WORK_TEXTS, PAID_WORK_TITLE } from '../../demo-sources/paid-work'
import { emptyPointers } from '../../model/artifacts'
import type { CurrentPost } from '../../model/current'
import type { Fact } from '../../model/types'
import type { Saved } from '../../server/commands'
import { nativeOf } from '../../text/native-fixtures'

const push = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh: () => {} }),
}))

const { BlogTextStep } = await import('./BlogTextStep')
type Props = Parameters<typeof BlogTextStep>[0]

const fact = (id: string, text: string, sentenceId: string): Fact => ({
  id,
  text,
  value: null,
  ref: sentenceId.split('.')[0],
  quote: text,
  supported: true,
  why: null,
  span: null,
  sentenceId,
})
const FACTS = [
  fact('f1', 'Students may work 20 hours a week in term.', '¶1.1'),
  fact('f2', 'Working more than 20 hours lowers grades.', '¶2.1'),
]

type Text = NonNullable<CurrentPost['blogText']>['body']
const TEXT: Text = {
  outlineId: 'bo1',
  sections: [
    {
      heading: 'How many hours can I work?',
      body: 'You may work 20 hours a week in term.',
      factIds: ['f1'],
    },
    {
      heading: 'Does work hurt grades?',
      body: 'More than 20 hours a week lowers grades.',
      factIds: ['f2'],
    },
  ],
  takeaways: ['Twenty hours in term.', 'Grades come first.', 'Plan your shifts.'],
  faq: [
    { q: 'Can I work two jobs?', a: 'Yes, within 20 hours.', factIds: ['f1'] },
    { q: 'Who checks my hours?', a: 'Your visa does.', factIds: [] },
    { q: 'Do breaks count?', a: 'Official breaks are different.', factIds: [] },
  ],
  emotion: null,
  note: 'Written',
}

const current = (text: Text = TEXT): CurrentPost => ({
  source: {
    id: 'src1',
    body: {
      title: PAID_WORK_TITLE,
      kind: 'research summary',
      text: PAID_WORK_TEXTS.join('\n\n'),
      paragraphs: PAID_WORK_TEXTS.map((t, i) => ({ ref: `¶${i + 1}`, text: t })),
      demoKey: null,
      language: 'en',
    },
  },
  facts: { id: 'facts1', body: { sourceId: 'src1', keyIdeas: [], facts: FACTS, replays: [] } },
  drafts: null,
  ideas: null,
  outline: null,
  blogOutline: null,
  blogText: { id: 'bt1', body: text },
  blogImages: null,
  revision: null,
  layout: null,
  render: null,
  covers: null,
  artPlan: null,
  sourceCheck: {
    id: 'sc1',
    body: {
      revisionId: null,
      blogTextId: 'bt1',
      claims: [
        {
          text: 'You may work 20 hours a week in term.',
          slide: 1,
          slot: 'section',
          result: 'found',
          ref: '¶1.1',
        },
      ],
      replays: [],
    },
  },
  settings: null,
  sendBack: null,
  approval: null,
  market: null,
  caption: null,
  export: null,
})

const VIEW: Props['view'] = {
  id: 'p1',
  kind: 'blog',
  title: 'Work hours, in full',
  stage: 'structures',
  version: 6,
  pointers: { ...emptyPointers(), sourceId: 'src1', factsId: 'facts1', blogTextId: 'bt1' },
  current: current(),
  createdAt: '2026-10-05T09:12:00.000Z',
  running: [],
  draftChecks: [],
}

const saved = async (): Promise<Saved> => ({ ok: true, id: 'p1', version: 7 })
const actions = {
  editBlogSectionAction: mock(async (_id: unknown, _at: unknown, _edit: unknown) => saved()),
  approveBlogTextAction: mock(async (_id: unknown, _at: unknown) => saved()),
}

const EDITOR: Staff = { role: 'user', editor: true }
const REVIEWER: Staff = { role: 'user', reviewer: true }

const step = (over: Partial<Props['view']> = {}, viewer: Staff = EDITOR) =>
  render(<BlogTextStep view={{ ...VIEW, ...over }} viewer={viewer} actions={actions} />)
const fields = () => screen.getByRole('region', { name: 'Actions' })

afterEach(() => {
  cleanup()
  actions.editBlogSectionAction.mockClear()
  actions.approveBlogTextAction.mockClear()
  push.mockClear()
})

it("shows the article, and saves the selected section's body when it is changed in place, and nothing when it is not (BR3)", async () => {
  step()
  const article = screen.getByRole('region', { name: 'Slides' })
  expect(within(article).getByRole('heading', { name: 'Does work hurt grades?' })).toBeVisible()
  expect(within(article).getByText('Grades come first.')).toBeInTheDocument()
  expect(within(article).getByText('Who checks my hours?')).toBeInTheDocument()

  const body = within(fields()).getByRole('textbox', { name: 'Body' })
  fireEvent.blur(body)
  expect(actions.editBlogSectionAction).not.toHaveBeenCalled()
  fireEvent.change(body, { target: { value: 'You may work up to 20 hours a week in term.' } })
  await act(async () => {
    fireEvent.blur(body)
  })
  expect(actions.editBlogSectionAction).toHaveBeenCalledWith('p1', 6, {
    part: 'section',
    index: 0,
    field: 'body',
    text: 'You may work up to 20 hours a week in term.',
  })
})

it("opens another section's fields with its facts as ¶ chips, and saves its heading (BR3)", async () => {
  step()
  fireEvent.click(screen.getByRole('button', { name: 'Edit section 2' }))
  expect(within(fields()).getByRole('button', { name: '¶2.1' })).toBeInTheDocument()
  expect(within(fields()).queryByRole('button', { name: '¶1.1' })).toBeNull()
  const heading = within(fields()).getByRole('textbox', { name: 'Heading' })
  expect(heading).toHaveValue('Does work hurt grades?')
  fireEvent.change(heading, { target: { value: 'Will work hurt my grades?' } })
  await act(async () => {
    fireEvent.blur(heading)
  })
  expect(actions.editBlogSectionAction).toHaveBeenCalledWith('p1', 6, {
    part: 'section',
    index: 1,
    field: 'heading',
    text: 'Will work hurt my grades?',
  })
})

it("counts a section's heading and body as typed, and says a refusal of the save under its field (C1)", async () => {
  step()
  fireEvent.click(screen.getByRole('button', { name: 'Edit section 2' }))
  const heading = within(fields()).getByRole('textbox', { name: 'Heading' })
  expect(heading).toHaveAccessibleDescription('22 of 1–120 characters')
  const body = within(fields()).getByRole('textbox', { name: 'Body' })
  expect(body).toHaveAccessibleDescription(/^\d+ of 1–10000 characters$/)
  const refusal = 'Write the heading as a question of 1 to 120 characters, ending with "?".'
  actions.editBlogSectionAction.mockImplementationOnce(async () => ({ ok: false, error: refusal }))
  fireEvent.change(heading, { target: { value: 'Work and grades' } })
  expect(heading).toHaveAccessibleDescription('15 of 1–120 characters')
  await act(async () => {
    fireEvent.blur(heading)
  })
  expect(heading).toHaveAccessibleDescription(`15 of 1–120 characters ${refusal}`)
  expect(body).not.toHaveAccessibleDescription(/question/)
})

it('holds a heading to 120 characters as a reader sees them, a Nepali heading whole (GD37)', () => {
  step()
  fireEvent.click(screen.getByRole('button', { name: 'Edit section 2' }))
  const heading = within(fields()).getByRole('textbox', { name: 'Heading' })
  fireEvent.change(heading, { target: { value: `${nativeOf('ne', 120)}?` } })
  expect(heading).toHaveValue(nativeOf('ne', 120))
})

it('edits a takeaway and an answer, and removes a question, each as its own change (BR3)', async () => {
  step({
    current: current({
      ...TEXT,
      faq: [...TEXT.faq, { q: 'Is tutoring work?', a: 'Yes.', factIds: [] }],
    }),
  })
  const takeaway = within(fields()).getByRole('textbox', { name: 'Takeaway 2' })
  fireEvent.change(takeaway, { target: { value: 'Your grades come first.' } })
  await act(async () => {
    fireEvent.blur(takeaway)
  })
  const answer = within(fields()).getByRole('textbox', { name: 'Answer 2' })
  fireEvent.change(answer, { target: { value: 'Your visa conditions say.' } })
  await act(async () => {
    fireEvent.blur(answer)
  })
  await act(async () => {
    fireEvent.click(within(fields()).getByRole('button', { name: 'Remove question 4' }))
  })
  expect(actions.editBlogSectionAction.mock.calls.map((c) => c[2])).toEqual([
    { part: 'takeaway', index: 1, text: 'Your grades come first.' },
    { part: 'faq', index: 1, field: 'a', text: 'Your visa conditions say.' },
    { part: 'faq', index: 3, remove: true },
  ])
  // At three takeaways none may go.
  expect(within(fields()).getByRole('button', { name: 'Remove takeaway 1' })).toBeDisabled()
})

it('approves the text and opens the images, and waits with the reason while a question is unanswered (BR3)', async () => {
  step()
  expect(
    within(screen.getByRole('region', { name: 'Step actions' })).getByRole('button', {
      name: 'Approve text → Images',
    }),
  ).toBeInTheDocument()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Approve text → Images' }))
  })
  expect(actions.approveBlogTextAction).toHaveBeenCalledWith('p1', 6)
  expect(push).toHaveBeenCalledWith('/admin/posts/p1/images')
  cleanup()
  const unanswered = { ...TEXT, faq: [{ ...TEXT.faq[0], a: '' }, ...TEXT.faq.slice(1)] }
  step({ current: current(unanswered) })
  expect(screen.getByRole('button', { name: 'Approve text → Images' })).toBeDisabled()
  expect(
    screen.getAllByText('Answer or remove each question the facts do not answer.').length,
  ).toBeGreaterThan(0)
})

it('shows a viewer who may not edit the article with no control', () => {
  step({}, REVIEWER)
  expect(screen.getByRole('heading', { name: 'How many hours can I work?' })).toBeInTheDocument()
  expect(screen.queryAllByRole('textbox')).toHaveLength(0)
  expect(screen.queryByRole('button', { name: /Edit section|Approve|Remove/ })).toBeNull()
})
