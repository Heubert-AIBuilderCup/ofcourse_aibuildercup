/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, beforeEach, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { Staff } from '@/shared/lib/auth/access'
import { TWIN_TEXTS, TWIN_TITLE } from '../../demo-sources/paid-work-twin'
import { type Body, emptyPointers } from '../../model/artifacts'
import type { CurrentPost } from '../../model/current'
import type { Stage } from '../../model/stages'
import type { Fact } from '../../model/types'
import type { Saved } from '../../server/commands'
import { templateById } from '../../templates'

const push = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh: () => {} }),
}))

const { SourcePane } = await import('./SourcePane')
type Props = Parameters<typeof SourcePane>[0]

afterEach(cleanup)

const P3 = TWIN_TEXTS[2]
const NINE = P3.indexOf('9')
const P3_SECOND = 'The drop was largest in the first year of study.'

const FACTS: Fact[] = [
  {
    id: 'f1',
    text: 'Above 20 hours a week, pass rates fell by 9 percentage points.',
    value: { number: 20, unit: 'hours' },
    ref: '¶3',
    quote: 'Above 20 hours a week, pass rates fell by 9 percentage points.',
    supported: true,
    why: null,
    span: null,
    sentenceId: '¶3.1',
  },
  {
    id: 'f2',
    text: TWIN_TEXTS[1],
    value: null,
    ref: '¶2',
    quote: TWIN_TEXTS[1],
    supported: true,
    why: null,
    span: null,
  },
  {
    id: 'f3',
    text: TWIN_TITLE,
    value: { number: 20, unit: 'hours' },
    ref: '¶3',
    quote: null,
    supported: false,
    why: 'The paragraph gives 9, not 11.',
    span: { ref: '¶3', start: NINE, end: NINE + 1 },
    headline: true,
  },
]

const facts = (over: Partial<Body<'facts'>> = {}): CurrentPost['facts'] => ({
  id: 'facts1',
  body: {
    sourceId: 'src1',
    keyIdeas: ['Work hours and grades', 'The 20-hour line', 'Association, not cause'],
    facts: FACTS,
    replays: [],
    ...over,
  },
})

const current = (over: Partial<CurrentPost> = {}): CurrentPost => ({
  source: {
    id: 'src1',
    body: {
      title: TWIN_TITLE,
      kind: 'research summary',
      text: TWIN_TEXTS.join('\n\n'),
      paragraphs: TWIN_TEXTS.map((text, i) => ({ ref: `¶${i + 1}`, text })),
      demoKey: 'paid-work-twin',
      language: 'en',
    },
  },
  facts: facts(),
  drafts: null,
  revision: null,
  layout: null,
  render: null,
  covers: null,
  artPlan: null,
  outline: null,
  blogOutline: null,
  blogText: null,
  blogImages: null,
  ideas: null,
  sourceCheck: null,
  settings: null,
  sendBack: null,
  approval: null,
  market: null,
  caption: null,
  export: null,
  ...over,
})

const saved = async (): Promise<Saved> => ({ ok: true, id: 'p1', version: 10 })
const actions = {
  addFactAction: mock(async (_id: unknown, _at: unknown, _sentence: unknown) => saved()),
  removeFactAction: mock(async (_id: unknown, _at: unknown, _fact: unknown) => saved()),
  remakeAction: mock(async (_id: unknown, _at: unknown, _input: unknown) => saved()),
  continueWithSourceAction: mock(async (_id: unknown, _at: unknown) => saved()),
}
beforeEach(() => {
  actions.addFactAction.mockClear()
  actions.removeFactAction.mockClear()
  actions.remakeAction.mockClear()
  actions.continueWithSourceAction.mockClear()
  push.mockClear()
})

const EDITOR: Staff = { role: 'user', editor: true }
const REVIEWER: Staff = { role: 'user', reviewer: true }

function pane(
  over: {
    current?: CurrentPost
    picked?: number | null
    stage?: Stage
    viewer?: Staff
    running?: string[]
  } = {},
) {
  const view: Props['view'] = {
    id: 'p1',
    version: 9,
    stage: over.stage ?? 'structures',
    current: over.current ?? current(),
    pointers: { ...emptyPointers(), picked: over.picked ?? null },
    running: over.running ?? [],
  }
  return render(<SourcePane view={view} viewer={over.viewer ?? EDITOR} actions={actions} />)
}

const factsList = () => within(screen.getByRole('region', { name: 'Facts' }))
/** Unfolds the article past its first lines (GD26). */
const openArticle = () => fireEvent.click(screen.getByRole('button', { name: 'Show article' }))

it('folds the article to its first lines with "Show article", and shows it whole on a press (GD26)', () => {
  pane()
  expect(screen.getByText(TWIN_TEXTS[0], { exact: false })).toBeInTheDocument()
  expect(screen.queryByText(P3_SECOND, { exact: false })).toBeNull()
  expect(screen.queryByText('¶5')).toBeNull()
  const show = screen.getByRole('button', { name: 'Show article' })
  expect(show).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(show)
  expect(screen.getByText(P3_SECOND, { exact: false })).toBeInTheDocument()
  for (const ref of ['¶4', '¶5']) expect(screen.getByText(ref)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Hide article' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
})

it('shows a key idea of 200 characters whole, never cut (GD26)', () => {
  const IDEA =
    `Students who work more than twenty hours a week ${'see their first-year grades slip '.repeat(5)}`.slice(
      0,
      200,
    )
  expect(IDEA).toHaveLength(200)
  pane({ current: current({ facts: facts({ keyIdeas: [IDEA] }) }) })
  expect(screen.getByText(IDEA)).toBeInTheDocument()
})

it('opens the article from "Add a fact from the article" and says to select a sentence (GD26, 95)', () => {
  pane()
  fireEvent.click(screen.getByRole('button', { name: 'Add a fact from the article' }))
  expect(
    screen.getByText('Select a sentence in the article to add it as a fact.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: P3_SECOND })).toBeInTheDocument()
  cleanup()
  pane({ viewer: REVIEWER })
  expect(screen.queryByRole('button', { name: 'Add a fact from the article' })).toBeNull()
})

it('numbers the paragraphs and lists the key ideas and facts', () => {
  pane()
  openArticle()
  for (const ref of ['¶1', '¶2', '¶3', '¶4', '¶5']) {
    expect(screen.getAllByText(ref).length).toBeGreaterThan(0)
  }
  expect(screen.getByText('The 20-hour line')).toBeInTheDocument()
  expect(factsList().getByText(TWIN_TEXTS[1])).toBeInTheDocument()
})

it('lists a title no paragraph supports as a headline claim not in the article, with why, and marks its span (96, 24)', () => {
  const { container } = pane()
  openArticle()
  const row = factsList().getByText(TWIN_TITLE).closest('li')
  if (!row) throw new Error('no headline row')
  expect(within(row).getByText('Headline claim not in the article')).toBeInTheDocument()
  expect(within(row).getByText('The paragraph gives 9, not 11.')).toBeInTheDocument()
  expect(within(row).getByText('Title')).toBeInTheDocument()
  expect(screen.queryByText('Not supported')).toBeNull()
  const marks = container.querySelectorAll('mark')
  expect(marks).toHaveLength(1)
  expect(marks[0]).toHaveTextContent(/^9$/)
})

it('says "Not supported" for an unsupported fact that is not the headline', () => {
  const plain = FACTS.map((f) => (f.headline ? { ...f, headline: undefined } : f))
  pane({ current: current({ facts: facts({ facts: plain }) }) })
  expect(screen.getByText('Not supported')).toBeInTheDocument()
  expect(screen.queryByText('Headline claim not in the article')).toBeNull()
})

it('tags a step that came from a recording', () => {
  pane()
  expect(screen.queryByText('Replay')).toBeNull()
  cleanup()
  pane({ current: current({ facts: facts({ replays: ['extract'] }) }) })
  expect(screen.getByText('Replay')).toBeInTheDocument()
})

it('offers "Add as fact" for a selected sentence, and saves it by its id (95)', async () => {
  pane()
  openArticle()
  expect(screen.queryByRole('button', { name: 'Add as fact' })).toBeNull()
  const sentence = screen.getByRole('button', { name: P3_SECOND })
  fireEvent.click(sentence)
  expect(sentence).toHaveAttribute('aria-pressed', 'true')
  const add = screen.getByRole('button', { name: 'Add as fact' })
  await act(async () => {
    fireEvent.click(add)
  })
  expect(actions.addFactAction).toHaveBeenCalledWith('p1', 9, '¶3.2')
})

it('refuses "Add as fact" for a sentence that is already a fact, saying so', () => {
  pane()
  openArticle()
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Above 20 hours a week, pass rates fell by 9 percentage points.',
    }),
  )
  expect(screen.getByRole('button', { name: 'Add as fact' })).toBeDisabled()
  expect(screen.getByText('Already a fact.')).toBeInTheDocument()
  cleanup()
  // A fact from before sentence ids counts by its text.
  pane()
  openArticle()
  fireEvent.click(screen.getByRole('button', { name: TWIN_TEXTS[1] }))
  expect(screen.getByRole('button', { name: 'Add as fact' })).toBeDisabled()
})

it('offers "Remove" on each fact, the headline too, and saves without it (95)', async () => {
  pane()
  const rows = factsList().getAllByRole('listitem')
  expect(rows).toHaveLength(FACTS.length)
  for (const row of rows) expect(within(row).getByRole('button', { name: 'Remove' })).toBeEnabled()
  await act(async () => {
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Remove' }))
  })
  expect(actions.removeFactAction).toHaveBeenCalledWith('p1', 9, 'f2')
})

it('shows a reviewer the source read-only', () => {
  for (const [props, buttons] of [[{ viewer: REVIEWER }, ['Show article']]] as const) {
    pane(props)
    expect(screen.queryAllByRole('button').map((b) => b.textContent)).toEqual([...buttons])
    openArticle()
    expect(screen.getByText(P3_SECOND, { exact: false })).toBeInTheDocument()
    cleanup()
  }
})

const pickedDraft = (): CurrentPost['drafts'] => {
  const template = templateById('the-line')
  if (!template) throw new Error('no template')
  return {
    id: 'd1',
    body: {
      factsId: 'facts1',
      attempt: 1,
      replays: [],
      emotion: null,
      note: null,
      items: [
        {
          template,
          structure: {
            templateId: 'the-line',
            artPrompt: 'A quiet desk at dusk.',
            slides: [
              {
                kind: 'body',
                slots: {
                  heading: { text: 'Up to 20', factIds: [], factual: false },
                  body: { text: TWIN_TEXTS[1], factIds: ['f2'], factual: true },
                },
              },
            ],
          },
        },
      ],
    },
  }
}

// The accent ramp (bg-accent-100 …) does not switch with [data-theme]: it stays a light colour on
// the dark theme, so a highlight on it read as a white bar with pale text. bg-muted and
// text-foreground switch.
const FIXED = /accent-\d{3}|\bbg-white\b|\btext-destructive\b|\btext-red|\bbg-red|\bbg-pink/

it('highlights the paragraph the picked draft rests on with theme tokens, text in the foreground', () => {
  const { container } = pane({ current: current({ drafts: pickedDraft() }), picked: 0 })
  openArticle()
  const used = screen.getAllByText('¶2')[0].closest('li')
  if (!used) throw new Error('no paragraph row')
  expect(used).toHaveClass('bg-muted', 'text-foreground')
  expect(used.className).not.toMatch(FIXED)
  const plain = screen.getAllByText('¶1')[0].closest('li')
  expect(plain).not.toHaveClass('bg-muted')
  expect(container.querySelectorAll('ol > li.bg-muted')).toHaveLength(1)
})

it('reads the unsupported span in the foreground colour, and marks only the span', () => {
  const { container } = pane()
  openArticle()
  const mark = container.querySelector('mark')
  if (!mark) throw new Error('no mark')
  expect(mark).toHaveClass('text-foreground', 'bg-destructive/20')
  expect(mark.className).not.toMatch(FIXED)
  const paragraph = mark.closest('p')
  expect(paragraph).toHaveClass('text-foreground')
  expect(paragraph?.querySelectorAll('mark')).toHaveLength(1)
  expect(paragraph).toHaveTextContent(P3)
  expect(mark.textContent).toBe('9')
})

it('wraps a long unbroken address anywhere in the title, paragraphs, key ideas and facts (smoke test, 12 Oct)', () => {
  const LONG = `https://example.com/${'a'.repeat(100)}`
  expect(LONG).toHaveLength(120)
  const fact: Fact = {
    ...FACTS[1],
    id: 'f9',
    text: LONG,
    quote: LONG,
    ref: '¶1',
    sentenceId: '¶1.1',
  }
  const base = current()
  const source = base.source as NonNullable<CurrentPost['source']>
  pane({
    current: current({
      source: {
        ...source,
        body: { ...source.body, title: LONG, text: LONG, paragraphs: [{ ref: '¶1', text: LONG }] },
      },
      facts: facts({ keyIdeas: [LONG], facts: [fact] }),
    }),
  })
  openArticle()
  const shown = screen.getAllByText(LONG)
  expect(shown).toHaveLength(4)
  for (const el of shown) expect(el.closest('.wrap-anywhere')).not.toBeNull()
})

it('at the source step, keeps "Save and remake" disabled until the text changes, then remakes from the changed text (113)', async () => {
  pane({ stage: 'source' })
  const field = screen.getByRole('textbox', { name: 'Source' })
  const text = TWIN_TEXTS.join('\n\n')
  expect(field).toHaveValue(text)
  const remake = screen.getByRole('button', { name: 'Save and remake' })
  expect(remake).toBeDisabled()
  // Space around the same text is no change.
  fireEvent.change(field, { target: { value: `${text}  ` } })
  expect(remake).toBeDisabled()
  fireEvent.change(field, { target: { value: 'A changed source.' } })
  expect(remake).toBeEnabled()
  await act(async () => {
    fireEvent.click(remake)
  })
  expect(actions.remakeAction).toHaveBeenCalledWith('p1', 9, {
    links: [],
    text: 'A changed source.',
    framing: '',
    notes: '',
    language: 'en',
  })
  expect(push).toHaveBeenCalledWith('/admin/posts/p1')
})

it('at the source step, edits the link of a source read from one, and remakes from the changed link (113)', async () => {
  const base = current()
  const source = base.source as NonNullable<CurrentPost['source']>
  const url = 'https://campustimes.example/news/paid-work'
  pane({
    stage: 'source',
    current: current({
      source: { ...source, body: { ...source.body, url, site: 'campustimes.example' } },
    }),
  })
  expect(screen.queryByRole('textbox', { name: 'Source' })).toBeNull()
  const field = screen.getByRole('textbox', { name: 'Links' })
  expect(field).toHaveValue(url)
  const remake = screen.getByRole('button', { name: 'Save and remake' })
  expect(remake).toBeDisabled()
  fireEvent.change(field, { target: { value: 'https://campustimes.example/news/other' } })
  await act(async () => {
    fireEvent.click(remake)
  })
  expect(actions.remakeAction).toHaveBeenCalledWith('p1', 9, {
    links: ['https://campustimes.example/news/other'],
    text: '',
    framing: '',
    notes: '',
    language: 'en',
  })
})

it('at the source step, prefills the remake form with every link read, the framing line and the notes, lists the links not read, and remakes once one changes (113, GD18)', async () => {
  const base = current()
  const source = base.source as NonNullable<CurrentPost['source']>
  const a = 'https://www.abc.example/a'
  const b = 'https://www.studyaustralia.example/b'
  pane({
    stage: 'source',
    current: current({
      source: {
        ...source,
        body: {
          ...source.body,
          parts: [
            { url: a, site: 'abc.example', title: 'A', from: 1, to: 2 },
            { url: b, site: 'studyaustralia.example', title: 'B', from: 3, to: 5 },
          ],
          failed: [{ url: 'https://c.example/c', error: 'Could not read that page.' }],
          framing: 'Why 20 hours',
          notes: 'I worked 25.',
        },
      },
    }),
  })
  expect(screen.getByRole('textbox', { name: 'Links' })).toHaveValue(`${a}\n${b}`)
  const framing = screen.getByRole('textbox', { name: 'What do you want this post to say?' })
  expect(framing).toHaveValue('Why 20 hours')
  expect(screen.getByRole('textbox', { name: 'Your own notes' })).toHaveValue('I worked 25.')
  expect(screen.getByRole('list', { name: 'Links not read' })).toHaveTextContent(
    'https://c.example/c: Could not read this page',
  )
  const remake = screen.getByRole('button', { name: 'Save and remake' })
  expect(remake).toBeDisabled()
  fireEvent.change(framing, { target: { value: 'Why the 20-hour line matters' } })
  await act(async () => {
    fireEvent.click(remake)
  })
  expect(actions.remakeAction).toHaveBeenCalledWith('p1', 9, {
    links: [a, b],
    text: '',
    framing: 'Why the 20-hour line matters',
    notes: 'I worked 25.',
    language: 'en',
  })
})

it("at the source step, opens with the source's language, and remakes once only the language changes (GD36, GD28)", async () => {
  const base = current()
  const source = base.source as NonNullable<CurrentPost['source']>
  pane({
    stage: 'source',
    current: current({ source: { ...source, body: { ...source.body, language: 'hi' } } }),
  })
  const language = screen.getByLabelText('Language')
  expect(language).toHaveValue('hi')
  const remake = screen.getByRole('button', { name: 'Save and remake' })
  expect(remake).toBeDisabled()
  fireEvent.change(language, { target: { value: 'th' } })
  expect(remake).toBeEnabled()
  await act(async () => {
    fireEvent.click(remake)
  })
  expect(actions.remakeAction).toHaveBeenCalledWith('p1', 9, {
    links: [],
    text: TWIN_TEXTS.join('\n\n'),
    framing: '',
    notes: '',
    language: 'th',
  })
})

it('at the source step, says "Up to five links." and keeps "Save and remake" disabled on a sixth link (GD18)', () => {
  pane({ stage: 'source' })
  const six = Array.from({ length: 6 }, (_, i) => `https://example.com/${i}`)
  fireEvent.change(screen.getByRole('textbox', { name: 'Links' }), {
    target: { value: six.join('\n') },
  })
  expect(screen.getByText('Up to five links.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save and remake' })).toBeDisabled()
})

it('at the source step, refuses a link added beside the pasted text, rather than dropping it (GD18)', () => {
  pane({ stage: 'source' })
  fireEvent.change(screen.getByRole('textbox', { name: 'Links' }), {
    target: { value: 'https://example.com/a' },
  })
  expect(screen.getByText('Use either links or pasted text.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save and remake' })).toBeDisabled()
})

it('offers "Continue with this source" whenever the post has its facts, with versions or without (113)', async () => {
  pane({ stage: 'source', current: current({ facts: null }) })
  expect(screen.queryByRole('button', { name: 'Continue with this source' })).toBeNull()
  for (const drafts of [pickedDraft(), null]) {
    cleanup()
    actions.continueWithSourceAction.mockClear()
    pane({ stage: 'source', current: current({ drafts }) })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue with this source' }))
    })
    expect(actions.continueWithSourceAction).toHaveBeenCalledWith('p1', 9)
    // The post's own address opens whichever step it is then at: ideas or text (GD27).
    expect(push).toHaveBeenLastCalledWith('/admin/posts/p1')
  }
})

it('offers no source edit before the source step, nor to a reviewer at it', () => {
  for (const props of [
    { stage: 'structures' as const, current: current({ drafts: pickedDraft() }) },
    { stage: 'source' as const, viewer: REVIEWER, current: current({ drafts: pickedDraft() }) },
  ]) {
    pane(props)
    expect(screen.queryByRole('button', { name: 'Save and remake' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Continue with this source' })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    cleanup()
  }
})

it('at a passed step, an editor changes the source in place, with no "Back to source" and no confirm (GD28)', async () => {
  for (const stage of ['structures', 'rendered', 'live'] as const) {
    pane({ stage })
    expect(screen.queryByRole('button', { name: 'Back to source' })).toBeNull()
    expect(factsList().getAllByRole('button', { name: 'Remove' })).toHaveLength(FACTS.length)
    fireEvent.click(screen.getByRole('button', { name: 'Change the source' }))
    const field = screen.getByRole('textbox', { name: 'Source' })
    expect(field).toHaveValue(TWIN_TEXTS.join('\n\n'))
    expect(screen.queryByRole('button', { name: 'Continue with this source' })).toBeNull()
    fireEvent.change(field, { target: { value: 'A changed source.' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save and remake' }))
    })
    expect(screen.queryByRole('region', { name: /^Go back/ })).toBeNull()
    expect(actions.remakeAction).toHaveBeenCalledWith('p1', 9, {
      links: [],
      text: 'A changed source.',
      framing: '',
      notes: '',
      language: 'en',
    })
    cleanup()
    actions.remakeAction.mockClear()
  }
})

it('at a passed step, keeps the source and fact edits disabled with the running step in words while one runs (122)', () => {
  pane({ stage: 'rendered', running: ['source_check'] })
  expect(screen.getAllByText('The source check is running').length).toBeGreaterThan(0)
  expect(screen.getByRole('button', { name: 'Change the source' })).toBeDisabled()
  for (const remove of factsList().getAllByRole('button', { name: 'Remove' })) {
    expect(remove).toBeDisabled()
  }
  expect(screen.getByRole('button', { name: 'Add a fact from the article' })).toBeDisabled()
})

it('offers a reviewer no source change at a passed step', () => {
  pane({ stage: 'rendered', viewer: REVIEWER })
  expect(screen.queryByRole('button', { name: 'Change the source' })).toBeNull()
})

it('names the site each fact came from, and marks where each article starts, for a source read from several links (GD19)', () => {
  const base = current()
  const source = base.source as NonNullable<CurrentPost['source']>
  pane({
    current: current({
      source: {
        ...source,
        body: {
          ...source.body,
          parts: [
            { url: 'https://abc.example/a', site: 'abc.example', title: 'Work A', from: 1, to: 2 },
            {
              url: 'https://study.example/b',
              site: 'study.example',
              title: 'Rights B',
              from: 3,
              to: TWIN_TEXTS.length,
            },
          ],
        },
      },
    }),
  })
  const rows = within(screen.getByRole('region', { name: 'Facts' })).getAllByRole('listitem')
  expect(within(rows[0]).getByText('study.example')).toBeInTheDocument()
  expect(within(rows[1]).getByText('abc.example')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Show article' }))
  expect(screen.getByText('abc.example · Work A')).toBeInTheDocument()
  expect(screen.getByText('study.example · Rights B')).toBeInTheDocument()
})
