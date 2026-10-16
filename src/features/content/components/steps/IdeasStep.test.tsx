/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { Staff } from '@/shared/lib/auth/access'
import { PAID_WORK_TEXTS, PAID_WORK_TITLE } from '../../demo-sources/paid-work'
import { emptyPointers } from '../../model/artifacts'
import type { CurrentPost } from '../../model/current'
import type { IdeaCard } from '../../model/types'
import type { Saved } from '../../server/commands'

const push = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh: () => {} }),
}))

const { IdeasStep } = await import('./IdeasStep')
type Props = Parameters<typeof IdeasStep>[0]

const CARDS: IdeaCard[] = [
  {
    angle: 'The 20-hour line',
    hook: 'Twenty hours is where grades start to slip.',
    audience: 'First-years with a job',
    look: 'data-desk',
    slides: 5,
  },
  {
    angle: 'Work that fits study',
    hook: 'A job can sit beside your degree.',
    audience: 'Students looking for work',
    look: 'field-notes',
    slides: 6,
  },
  {
    angle: 'Ask before you sign',
    hook: 'Three questions for a new boss.',
    audience: 'New starters',
    look: 'field-notes',
    slides: 4,
  },
]

const current = (over: Partial<CurrentPost> = {}): CurrentPost => ({
  source: {
    id: 'src1',
    body: {
      title: PAID_WORK_TITLE,
      kind: 'research summary',
      text: PAID_WORK_TEXTS.join('\n\n'),
      paragraphs: PAID_WORK_TEXTS.map((text, i) => ({ ref: `¶${i + 1}`, text })),
      demoKey: null,
      language: 'en',
      framing: 'Show students how much work is too much',
    },
  },
  facts: { id: 'facts1', body: { sourceId: 'src1', keyIdeas: [], facts: [], replays: [] } },
  drafts: null,
  ideas: { id: 'ideas1', body: { factsId: 'facts1', cards: CARDS, rounds: 1 } },
  revision: null,
  layout: null,
  render: null,
  covers: null,
  artPlan: null,
  outline: null,
  blogOutline: null,
  blogText: null,
  blogImages: null,
  sourceCheck: null,
  settings: null,
  sendBack: null,
  approval: null,
  market: null,
  caption: null,
  export: null,
  ...over,
})

const VIEW: Props['view'] = {
  id: 'p1',
  title: PAID_WORK_TITLE,
  stage: 'structures',
  version: 4,
  pointers: { ...emptyPointers(), sourceId: 'src1', factsId: 'facts1', ideasId: 'ideas1' },
  current: current(),
  createdAt: '2026-10-05T09:12:00.000Z',
  running: [],
  draftChecks: [],
}

const saved = async (): Promise<Saved> => ({ ok: true, id: 'p1', version: 5 })
const actions = {
  pickIdeasAction: mock(async (_id: unknown, _at: unknown, _pick: unknown) => saved()),
  moreIdeasAction: mock(async (_id: unknown, _at: unknown) => saved()),
}

const EDITOR: Staff = { role: 'user', editor: true }
const REVIEWER: Staff = { role: 'user', reviewer: true }

const step = (over: Partial<Props['view']> = {}, viewer: Staff = EDITOR) =>
  render(<IdeasStep view={{ ...VIEW, ...over }} viewer={viewer} actions={actions} />)

const card = (angle: string) => screen.getByRole('article', { name: angle })
/** The step's actions area, beside the cards (GD30). */
const actionsArea = () => screen.getByRole('region', { name: 'Actions' })
/** The selected card's details and "Use this idea", in the actions area (D1). */
const chosen = () => within(actionsArea()).getByRole('region', { name: /^Selected (idea|angle)$/ })
/** Selects the card with this angle, from the cards. */
const select = (angle: string) =>
  fireEvent.click(within(card(angle)).getByRole('button', { name: angle }))
/** Selects the card with this angle and outlines it from the actions area. */
const use = async (angle: string, label = 'Use this idea') => {
  select(angle)
  await act(async () => {
    fireEvent.click(within(chosen()).getByRole('button', { name: label }))
  })
}

afterEach(() => {
  cleanup()
  actions.pickIdeasAction.mockClear()
  push.mockClear()
  actions.moreIdeasAction.mockClear()
})

it('shows each card with its angle and hook under the framing line, and the selected one’s audience, look and slide count beside them (GD1, GD20, D1)', () => {
  step()
  const first = card('The 20-hour line')
  expect(within(first).getByRole('heading', { name: 'The 20-hour line' })).toBeInTheDocument()
  expect(within(first).getByText('Twenty hours is where grades start to slip.')).toBeInTheDocument()
  expect(within(chosen()).getByText('For: First-years with a job')).toBeInTheDocument()
  expect(within(chosen()).getByText('Data Desk · 5 slides')).toBeInTheDocument()
  const framing = screen.getByText('Show students how much work is too much')
  expect(framing.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('keeps the cards in the slides area and the idea’s actions in the actions area (D1)', () => {
  step()
  const slides = screen.getByRole('region', { name: 'Slides' })
  expect(within(slides).getAllByRole('article')).toHaveLength(3)
  expect(within(slides).queryByRole('button', { name: 'Use this idea' })).toBeNull()
  expect(within(actionsArea()).getByRole('button', { name: 'Use this idea' })).toBeInTheDocument()
  expect(within(actionsArea()).getByRole('button', { name: 'More ideas' })).toBeInTheDocument()
})

it('shows the details of the card selected, marking it (D1)', () => {
  step()
  select('Work that fits study')
  expect(card('Work that fits study')).toHaveAttribute('aria-current', 'true')
  expect(card('The 20-hour line')).not.toHaveAttribute('aria-current')
  expect(within(chosen()).getByText('For: Students looking for work')).toBeInTheDocument()
  expect(within(chosen()).getByText('Field Notes · 6 slides')).toBeInTheDocument()
  expect(within(chosen()).queryByText('For: First-years with a job')).toBeNull()
})

it('outlines a card with "Use this idea", by its place, and opens the outline (GD2, GD32)', async () => {
  step()
  await use('Work that fits study')
  expect(actions.pickIdeasAction).toHaveBeenCalledWith('p1', 4, { cards: [1] })
  // Outlined, the post is at its outline: its screen opens (GD27, GD32).
  expect(push).toHaveBeenCalledWith('/admin/posts/p1/outline')
})

it('shows "Combine" once two cards are ticked, keeps a third tick disabled, and combines the two (GD2)', async () => {
  step()
  expect(screen.queryByRole('button', { name: 'Combine' })).toBeNull()
  const tick = (angle: string) => within(card(angle)).getByRole('checkbox', { name: /^Combine/ })
  fireEvent.click(tick('Ask before you sign'))
  expect(screen.queryByRole('button', { name: 'Combine' })).toBeNull()
  fireEvent.click(tick('The 20-hour line'))
  expect(tick('Work that fits study')).toBeDisabled()
  expect(tick('The 20-hour line')).toBeEnabled()
  await act(async () => {
    fireEvent.click(within(actionsArea()).getByRole('button', { name: 'Combine' }))
  })
  expect(actions.pickIdeasAction).toHaveBeenCalledWith('p1', 4, { cards: [0, 2] })
})

it('keeps the pre-selected "Use this idea" the one filled button once "Combine" shows', () => {
  step()
  const tick = (angle: string) => within(card(angle)).getByRole('checkbox', { name: /^Combine/ })
  fireEvent.click(tick('Ask before you sign'))
  fireEvent.click(tick('The 20-hour line'))
  expect(screen.getByRole('button', { name: 'Combine' })).toBeInTheDocument()
  const filled = document.querySelectorAll('.bg-primary-strong')
  expect(filled).toHaveLength(1)
  expect(filled[0]).toHaveTextContent('Use this idea')
})

it('asks for more cards with "More ideas" (GD3)', async () => {
  step()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'More ideas' }))
  })
  expect(actions.moreIdeasAction).toHaveBeenCalledWith('p1', 4)
})

it('shows the ideas step running in words, with its buttons waiting', () => {
  step({ running: ['ideas'] })
  expect(screen.getByText('Ideas are being found')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Running…' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'More ideas' })).toBeNull()
  cleanup()
  step({ running: ['outline'] })
  expect(screen.getByText('The outline is being made')).toBeInTheDocument()
  for (const use of screen.getAllByRole('button', { name: 'Use this idea' })) {
    expect(use).toBeDisabled()
  }
})

it('shows a loader with the words where the cards will appear while they are found, and while a pick is outlined', () => {
  step({ running: ['ideas'] })
  const status = screen.getByRole('status')
  expect(status).toHaveTextContent('Ideas are being found')
  expect(status.querySelector('svg')).not.toBeNull()
  cleanup()
  step({ running: ['outline'] })
  expect(screen.getByRole('status')).toHaveTextContent('The outline is being made')
})

it('after a failed ideas step keeps the facts and finds them again from "Try again"', async () => {
  step({ failed: ['ideas'], current: current({ ideas: null }) })
  expect(screen.getByText('Finding ideas failed. Your facts are kept.')).toBeInTheDocument()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  })
  expect(actions.moreIdeasAction).toHaveBeenCalledWith('p1', 4)
})

it('marks the recommended cards "Recommended" and pre-selects the first, drafting nothing by itself (GD29)', () => {
  const ranked = [
    { ...CARDS[0], recommended: true },
    { ...CARDS[1], recommended: true },
    { ...CARDS[2], recommended: false },
  ]
  step({
    current: current({
      ideas: { id: 'ideas1', body: { factsId: 'facts1', cards: ranked, rounds: 1 } },
    }),
  })
  expect(within(card('The 20-hour line')).getByText('Recommended')).toBeInTheDocument()
  expect(within(card('Work that fits study')).getByText('Recommended')).toBeInTheDocument()
  expect(within(card('Ask before you sign')).queryByText('Recommended')).toBeNull()
  expect(card('The 20-hour line')).toHaveAttribute('aria-current', 'true')
  expect(card('Work that fits study')).not.toHaveAttribute('aria-current')
  expect(actions.pickIdeasAction).not.toHaveBeenCalled()
})

it('at a passed step, keeps every card control disabled with the running step in words while one runs (122)', () => {
  step({ stage: 'rendered', running: ['covers'] })
  expect(screen.getAllByText('Covers are being drawn').length).toBeGreaterThan(0)
  for (const use of screen.getAllByRole('button', { name: 'Use this idea' })) {
    expect(use).toBeDisabled()
  }
  for (const tick of screen.getAllByRole('checkbox')) expect(tick).toBeDisabled()
  expect(screen.getByRole('button', { name: 'More ideas' })).toBeDisabled()
})

it('shows a viewer who may not edit the cards with no control but the choice of which to read', () => {
  step({}, REVIEWER)
  expect(card('The 20-hour line')).toBeInTheDocument()
  expect(screen.queryAllByRole('button').map((b) => b.textContent)).toEqual(
    CARDS.map((c) => c.angle),
  )
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  select('Ask before you sign')
  expect(within(chosen()).getByText('For: New starters')).toBeInTheDocument()
})

const tryAgain = () => screen.getByRole('button', { name: 'Try again' })

it('after "Use this idea" fails, keeps the facts and outlines that idea again from "Try again" (93, GD32)', async () => {
  actions.pickIdeasAction.mockImplementationOnce(async () => ({
    ok: false,
    error: 'The model call failed.',
  }))
  const { rerender } = step()
  await use('Work that fits study')
  expect(push).not.toHaveBeenCalled()
  // The refresh after the failure shows the outline step failed.
  rerender(<IdeasStep view={{ ...VIEW, failed: ['outline'] }} viewer={EDITOR} actions={actions} />)
  expect(screen.getByText('Outlining failed. Your facts are kept.')).toBeInTheDocument()
  await act(async () => {
    fireEvent.click(tryAgain())
  })
  expect(actions.pickIdeasAction).toHaveBeenCalledTimes(2)
  expect(actions.pickIdeasAction).toHaveBeenLastCalledWith('p1', 4, { cards: [1] })
  expect(push).toHaveBeenCalledWith('/admin/posts/p1/outline')
})

it('on a page opened after a failed outline, "Try again" outlines the idea the post is outlined for (93, GD32)', async () => {
  const outline: CurrentPost['outline'] = {
    id: 'o1',
    body: {
      factsId: 'facts1',
      ideas: [CARDS[2], CARDS[0]],
      format: null,
      slides: [],
      note: 'Outlined',
    },
  }
  step({ failed: ['outline'], current: current({ outline }) })
  await act(async () => {
    fireEvent.click(tryAgain())
  })
  expect(actions.pickIdeasAction).toHaveBeenCalledWith('p1', 4, { cards: [2, 0] })
})

it('offers no "Try again" for a failed outline when no idea is known, nor while it runs', () => {
  step({ failed: ['outline'] })
  expect(screen.getByText('Outlining failed. Your facts are kept.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  expect(screen.getAllByRole('button', { name: 'Use this idea' })[0]).toBeEnabled()
})

it('outlines a blog angle with "Use this angle", by its place, with no combining, and opens the outline (BR1, BR2)', async () => {
  const pickBlogAngleAction = mock(async (_id: unknown, _at: unknown, _pick: unknown) => saved())
  render(
    <IdeasStep
      view={{ ...VIEW, kind: 'blog' }}
      viewer={EDITOR}
      actions={{ ...actions, pickBlogAngleAction }}
    />,
  )
  expect(screen.queryByRole('checkbox')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Use this idea' })).toBeNull()
  await use('Work that fits study', 'Use this angle')
  expect(pickBlogAngleAction).toHaveBeenCalledWith('p1', 4, { card: 1 })
  expect(actions.pickIdeasAction).not.toHaveBeenCalled()
  expect(push).toHaveBeenCalledWith('/admin/posts/p1/outline')
})
