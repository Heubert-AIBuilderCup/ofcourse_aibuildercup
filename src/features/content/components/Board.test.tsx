/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { Staff } from '@/shared/lib/auth/access'
import { ANY_BOARD, type BoardFilter, type BoardParams, boardView } from '../lib/board'
import { CHANGED_LINE } from '../lib/lines'
import type { BoardCard } from '../server/store'

const replace = mock((_href: string, _options?: unknown) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push: () => {}, replace, refresh: () => {} }),
}))

const { Board } = await import('./Board')

afterEach(cleanup)

const card = (over: Partial<BoardCard> & { id: string }): BoardCard => ({
  kind: 'feed',
  parentId: null,
  title: 'The 20-hour line',
  stage: 'structures',
  updatedAt: new Date('2026-10-05T09:12:00Z'),
  updatedByName: 'Maya R.',
  market: null,
  platform: null,
  brandName: null,
  liveLine: null,
  publishedApprovalId: null,
  courseId: null,
  pageId: null,
  language: 'en',
  assigneeId: null,
  assigneeName: null,
  assignmentNote: null,
  ...over,
})

const CARDS = [
  card({ id: 'p1', stage: 'live', liveLine: 'General · Everyone · Leaves the feed in 90 days' }),
  card({ id: 'p2', title: 'Second post', stage: 'ready', market: 'NP' }),
  card({
    id: 's1',
    kind: 'social',
    parentId: 'p2',
    title: 'Instagram cut',
    stage: 'ready',
    platform: 'instagram',
  }),
]

const EDITOR: Staff = { role: 'user', editor: true }
const REVIEWER: Staff = { role: 'user', reviewer: true }
const ADMIN: Staff = { role: 'admin' }
const ADMIN_EDITOR: Staff = { role: 'admin', editor: true }
const STAFF = [
  { id: 'u-ed', name: 'Ed Itor' },
  { id: 'u-rae', name: 'Rae View' },
]
let answer: { ok: true } | { ok: false; error: string } = { ok: true }
const assign = mock(async (_input: unknown) => answer)

beforeEach(() => {
  answer = { ok: true }
  assign.mockClear()
})

const board = (cards: BoardCard[], viewer: Staff = EDITOR, over: Partial<BoardParams> = {}) => {
  const params = { ...ANY_BOARD, ...over }
  return render(
    <Board
      view={boardView(cards, params, 'u-ed')}
      params={params}
      viewer={viewer}
      staff={STAFF}
      assign={assign}
    />,
  )
}
const view = (viewer: Staff, filter: BoardFilter = 'all') => board(CARDS, viewer, { filter })

const cardOf = (title: string) => {
  const found = screen.getByRole('link', { name: title }).closest('li')
  if (!found) throw new Error(`no card ${title}`)
  return within(found)
}

describe('Board', () => {
  it("shows six column headings in the design's words and the render gate after the first", () => {
    view(EDITOR)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(6)
    expect(screen.getByRole('heading', { level: 2, name: /^Structures\b/ })).toBeInTheDocument()
    expect(screen.getByText('Render gate · crossed by approval only')).toBeInTheDocument()
  })

  it('has no row that scrolls sideways', () => {
    const { container } = view(EDITOR)
    expect(container.querySelector('.overflow-x-auto')).toBeNull()
  })

  it('shows the tabs with their counts and marks the current one, keeping the other filters', () => {
    board(
      [...CARDS, card({ id: 'c1', title: 'Hobart vs Melbourne', courseId: 'course-1' })],
      EDITOR,
      {
        filter: 'social',
        lang: 'en',
      },
    )
    const nav = screen.getByRole('navigation', { name: 'Board filters' })
    expect(within(nav).getByRole('link', { name: /^All · 5$/ })).toHaveAttribute(
      'href',
      '/admin/board?lang=en',
    )
    expect(within(nav).getByRole('link', { name: /^Feed posts · 3$/ })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: /^Route comics · 1$/ })).toHaveAttribute(
      'href',
      '/admin/board?filter=comics&lang=en',
    )
    const social = within(nav).getByRole('link', { name: /^Social versions · 1$/ })
    expect(social).toHaveAttribute('aria-current', 'page')
    expect(social).toHaveAttribute('href', '/admin/board?filter=social&lang=en')
    expect(within(nav).getByRole('link', { name: /^All/ })).not.toHaveAttribute('aria-current')
  })

  it('links a card to its post with the filters it came from', () => {
    view(EDITOR, 'feed')
    expect(screen.getByRole('link', { name: 'Second post' })).toHaveAttribute(
      'href',
      '/admin/posts/p2?from=filter%3Dfeed',
    )
  })

  it('shows the stage, the lines and who changed it, and says when a column is empty', () => {
    view(EDITOR)
    expect(screen.getByText('General · Everyone · Leaves the feed in 90 days')).toBeInTheDocument()
    expect(screen.getByText('↳ Nepal · market variant')).toBeInTheDocument()
    expect(screen.getByText('↳ from feed post "Second post"')).toBeInTheDocument()
    expect(screen.getAllByText('Changed by Maya R. · 5 Oct 2026, 09:12').length).toBeGreaterThan(0)
    // Approved, Rendered and In review hold nothing.
    expect(screen.getAllByText('Nothing here')).toHaveLength(4)
  })

  it('offers a new feed post to an editor and to an admin who is an editor', () => {
    view(EDITOR)
    expect(screen.getByRole('link', { name: '+ New feed post' })).toHaveAttribute(
      'href',
      '/admin/posts/new',
    )
    cleanup()
    view(ADMIN_EDITOR)
    expect(screen.getByRole('link', { name: '+ New feed post' })).toBeInTheDocument()
  })

  it('offers no new feed post to an admin without a capability', () => {
    view(ADMIN)
    expect(screen.queryByRole('link', { name: '+ New feed post' })).toBeNull()
  })

  const openMore = () => fireEvent.click(screen.getByRole('button', { name: 'More' }))

  it('keeps a new blog and a new comic in More for an editor, and none for an admin without a capability (BR1, RC1)', () => {
    view(EDITOR)
    openMore()
    expect(screen.getByRole('link', { name: '+ New blog' })).toHaveAttribute(
      'href',
      '/admin/posts/new?kind=blog',
    )
    expect(screen.getByRole('link', { name: '+ New comic' })).toHaveAttribute(
      'href',
      '/admin/comics/new',
    )
    cleanup()
    view(ADMIN)
    openMore()
    expect(screen.getByRole('link', { name: 'Page styles' })).toHaveAttribute(
      'href',
      '/admin/page-styles',
    )
    expect(screen.getByRole('link', { name: 'Comic character' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '+ New blog' })).toBeNull()
    expect(screen.queryByRole('link', { name: '+ New comic' })).toBeNull()
  })

  it('marks a blog\'s card "Blog", and a feed post\'s not (BR1)', () => {
    board([
      card({ id: 'b1', kind: 'blog', title: 'Work hours, in full' }),
      card({ id: 'f1', title: 'The 20-hour line' }),
    ])
    expect(cardOf('Work hours, in full').getByText('Blog')).toBeInTheDocument()
    expect(cardOf('The 20-hour line').getByText('Feed post')).toBeInTheDocument()
    expect(cardOf('The 20-hour line').queryByText('Blog')).toBeNull()
  })

  it('says "Changed since published" on a live post being edited, and not on one still live (116, 119)', () => {
    board([
      card({ id: 'e1', title: 'Being edited', stage: 'structures', publishedApprovalId: 'a1' }),
      card({ id: 'l1', title: 'Still live', stage: 'live', publishedApprovalId: 'a2' }),
      card({ id: 'n1', title: 'Never published', stage: 'rendered' }),
    ])
    // One word in the tag, the sentence beside it (Industry: status is one word in a tag).
    expect(cardOf('Being edited').getByText('Changed', { selector: 'span' })).toBeInTheDocument()
    expect(cardOf('Being edited').getByText(CHANGED_LINE)).toBeInTheDocument()
    // Criterion 116's "Live" tag beside it, in its working column.
    expect(cardOf('Being edited').getByText('Live')).toBeInTheDocument()
    expect(cardOf('Still live').queryAllByText(CHANGED_LINE)).toHaveLength(0)
    expect(cardOf('Never published').queryAllByText(CHANGED_LINE)).toHaveLength(0)
    expect(cardOf('Never published').queryAllByText('Live')).toHaveLength(0)
  })
})

describe('the owner of a post', () => {
  const OWNED = [
    card({
      id: 'o1',
      title: 'Owned',
      assigneeId: 'u-rae',
      assigneeName: 'Rae View',
      assignmentNote: 'Check the numbers on slide 2',
    }),
    card({ id: 'f1', title: 'Free' }),
  ]

  it("shows the owner's name and the note, or Unassigned", () => {
    board(OWNED)
    expect(cardOf('Owned').getByText('Rae View')).toBeInTheDocument()
    expect(cardOf('Owned').getByText('Check the numbers on slide 2')).toBeInTheDocument()
    expect(cardOf('Free').getByText('Unassigned')).toBeInTheDocument()
  })

  it('offers an editor Assign, or Change when assigned, and a reviewer neither', () => {
    board(OWNED)
    expect(cardOf('Free').getByRole('button', { name: 'Assign' })).toBeInTheDocument()
    expect(cardOf('Owned').getByRole('button', { name: 'Change' })).toBeInTheDocument()
    cleanup()
    board(OWNED, REVIEWER)
    expect(cardOf('Owned').getByText('Rae View')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^(Assign|Change)$/ })).toBeNull()
  })

  it('saves the chosen owner and the note through the action, counting the note as it is typed', async () => {
    board(OWNED)
    fireEvent.click(cardOf('Free').getByRole('button', { name: 'Assign' }))
    const form = screen.getByRole('form', { name: 'Assign Free' })
    const owner = form.querySelector('select')
    if (!owner) throw new Error('no owner select in the form')
    fireEvent.change(owner, { target: { value: 'u-rae' } })
    fireEvent.change(within(form).getByLabelText('Note'), {
      target: { value: 'किताब पढ' },
    })
    expect(within(form).getByText('6 of 280 characters')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Save' }))
    })
    expect(assign).toHaveBeenCalledWith({ postId: 'f1', assigneeId: 'u-rae', note: 'किताब पढ' })
  })

  it('saves Unassigned as no owner, and shows a refusal under the field', async () => {
    answer = { ok: false, error: 'Choose someone who works on the board.' }
    board(OWNED)
    fireEvent.click(cardOf('Owned').getByRole('button', { name: 'Change' }))
    const form = screen.getByRole('form', { name: 'Assign Owned' })
    const owner = form.querySelector('select')
    if (!owner) throw new Error('no owner select in the form')
    fireEvent.change(owner, { target: { value: 'none' } })
    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Save' }))
    })
    expect(assign).toHaveBeenCalledWith({
      postId: 'o1',
      assigneeId: null,
      note: 'Check the numbers on slide 2',
    })
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'Choose someone who works on the board.',
    )
  })
})

describe('the filters', () => {
  it('says nothing matches when the filters hide every card, with a way to clear them', () => {
    board(CARDS, EDITOR, { lang: 'th' })
    expect(screen.getByText('Nothing matches these filters')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute(
      'href',
      '/admin/board',
    )
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0)
  })

  it('offers Clear filters beside the selects only while a filter is set, keeping the tab', () => {
    board(CARDS, EDITOR, { filter: 'feed', lang: 'en' })
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute(
      'href',
      '/admin/board?filter=feed',
    )
    cleanup()
    board(CARDS, EDITOR, { filter: 'feed' })
    expect(screen.queryByRole('link', { name: 'Clear filters' })).toBeNull()
  })

  it('shows the columns, not the line, when nothing is filtered', () => {
    board([])
    expect(screen.queryByText('Nothing matches these filters')).toBeNull()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(6)
  })
})
