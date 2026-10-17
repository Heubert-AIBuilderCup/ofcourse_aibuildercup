/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { Staff } from '@/shared/lib/auth/access'
import { emptyPointers } from '../../model/artifacts'
import type { CurrentPost } from '../../model/current'
import type { ClaimResult } from '../../model/types'
import type { Researched, Saved } from '../../server/commands'

mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}))

const { SourceCheckPanel } = await import('./SourceCheckPanel')
type Props = Parameters<typeof SourceCheckPanel>[0]

const FOUND: ClaimResult = {
  text: 'Above 20 hours a week, pass rates fell by 11 percentage points.',
  slide: 2,
  slot: 'body',
  result: 'found',
  ref: '¶3',
}
const NOT_FOUND: ClaimResult = {
  text: 'Most students fail when they work.',
  slide: 3,
  slot: 'body',
  result: 'not_found',
  ref: null,
}

const EMPTY: CurrentPost = {
  source: null,
  facts: null,
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
}

const checked = (claims: ClaimResult[]): CurrentPost => ({
  ...EMPTY,
  sourceCheck: { id: 'sc1', body: { revisionId: 'rev1', claims, replays: [] } },
})

const VIEW: Props['view'] = {
  id: 'p1',
  title: 'Paid work',
  stage: 'rendered',
  version: 9,
  pointers: emptyPointers(),
  current: EMPTY,
  createdAt: '2026-10-05T09:12:00.000Z',
  running: [],
  draftChecks: [],
}

const saved = async (): Promise<Saved> => ({ ok: true, id: 'p1', version: 10 })
const actions = {
  checkSourceAction: mock(async (_id: unknown, _at: unknown) => saved()),
  markOpinionAction: mock(async (_id: unknown, _at: unknown, _claim: unknown) => saved()),
  removeClaimAction: mock(async (_id: unknown, _at: unknown, _claim: unknown) => saved()),
  applySourceWordingAction: mock(async (_id: unknown, _at: unknown, _claim: unknown) => saved()),
  researchClaimAction: mock(
    async (_id: unknown, _at: unknown, _sentence: unknown): Promise<Researched> => ({
      ok: true,
      sources: [],
      entryPoint: null,
    }),
  ),
  addResearchSourceAction: mock(async (_id: unknown, _at: unknown, _input: unknown) => saved()),
}

const EDITOR: Staff = { role: 'user', editor: true }

const view = (over: Partial<Props['view']> = {}) =>
  render(<SourceCheckPanel view={{ ...VIEW, ...over }} viewer={EDITOR} actions={actions} />)

afterEach(() => {
  cleanup()
  for (const a of Object.values(actions)) a.mockClear()
})

const rowOf = (text: string) => {
  const row = screen.getByText(text).closest('li')
  if (!row) throw new Error(`no row for ${text}`)
  return row
}

/** Opens the drawer that lists every other sentence, and returns it. */
const openAll = () => {
  fireEvent.click(screen.getByRole('button', { name: 'All checked sentences' }))
  return screen.getByRole('dialog', { name: 'All checked sentences' })
}
/** The drawer a row sits in, if any. */
const drawerOf = (row: HTMLElement) => row.closest('[role="dialog"]')

describe('SourceCheckPanel', () => {
  it('has no button to run the check: it runs by itself, and says so while it runs (98)', () => {
    view({ running: ['source_check'] })
    expect(screen.getByText('Checking against the source…')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    cleanup()
    view({ current: checked([FOUND]) })
    expect(screen.queryByRole('button', { name: 'Run source check' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('offers "Try again" when no check of this version has landed (98)', async () => {
    view({ failed: ['source_check'] })
    expect(screen.getByText('The source check failed. Your text is kept.')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    })
    expect(actions.checkSourceAction).toHaveBeenCalledWith('p1', 9)
  })

  it("shows a flagged claim beside the source sentence and uses the source's wording (104)", async () => {
    const suggestion = {
      ref: '¶4',
      text: 'The authors note the study shows association, not cause.',
    }
    view({ current: checked([FOUND, { ...NOT_FOUND, suggestion }]) })
    const row = rowOf(NOT_FOUND.text)
    expect(within(row).getByText(`Source ¶4: ${suggestion.text}`)).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: "Use the source's wording" }))
    })
    expect(actions.applySourceWordingAction).toHaveBeenCalledWith('p1', 9, 1)
  })

  it('shows a found claim with its paragraph', () => {
    view({ current: checked([FOUND, NOT_FOUND]) })
    openAll()
    expect(within(rowOf(FOUND.text)).getByText('Found ¶3')).toBeInTheDocument()
    // Each row has a stable handle for the browser specs: the sentences not found first.
    // Compared as booleans: a failing match of two elements prints a diff the runner hangs on.
    const rows = screen.getAllByTestId('check-row')
    expect(rows).toHaveLength(2)
    expect(rows[0] === rowOf(NOT_FOUND.text)).toBe(true)
    expect(rows[1] === rowOf(FOUND.text)).toBe(true)
  })

  const OPINION: ClaimResult = {
    text: 'Working too much is a poor trade.',
    slide: 4,
    slot: 'body',
    result: 'opinion',
    ref: null,
  }
  const ALSO_FOUND: ClaimResult = { ...FOUND, text: 'One in three students works.', ref: '¶2' }

  it('sums the check up first: how many were found in the article, not found, and opinion', () => {
    view({ current: checked([FOUND, NOT_FOUND, ALSO_FOUND, OPINION]) })
    expect(screen.getByText('2 found in the article · 1 not found · 1 opinion')).toBeInTheDocument()
  })

  it('lists only the sentences not found, with their fixes; every other one waits in the "All checked sentences" drawer', () => {
    view({ current: checked([FOUND, NOT_FOUND, ALSO_FOUND, OPINION]) })
    const notFound = rowOf(NOT_FOUND.text)
    expect(drawerOf(notFound)).toBeNull()
    expect(within(notFound).getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    // Closed, the drawer is not in the page.
    for (const c of [FOUND, ALSO_FOUND, OPINION]) {
      expect(screen.queryByText(c.text) === null).toBe(true)
    }
    const all = openAll()
    for (const c of [FOUND, ALSO_FOUND, OPINION]) {
      expect(drawerOf(rowOf(c.text)) === all).toBe(true)
    }
    expect(within(all).queryByText(NOT_FOUND.text)).toBeNull()
    cleanup()

    // Every sentence found: the summary, and the list in the drawer only.
    view({ current: checked([FOUND, ALSO_FOUND]) })
    expect(screen.getByText('2 found in the article · 0 not found · 0 opinion')).toBeInTheDocument()
    expect(screen.queryByText(FOUND.text) === null).toBe(true)
    openAll()
    expect(drawerOf(rowOf(FOUND.text)) !== null).toBe(true)
  })

  it('offers "Remove" and "Mark as editorial opinion" on a claim not found', async () => {
    view({ current: checked([FOUND, NOT_FOUND]) })
    const row = rowOf(NOT_FOUND.text)
    expect(within(row).getByText('Not found')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'Remove' }))
    })
    expect(actions.removeClaimAction).toHaveBeenCalledWith('p1', 9, 1)
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'Mark as editorial opinion' }))
    })
    expect(actions.markOpinionAction).toHaveBeenCalledWith('p1', 9, 1)
  })

  it('shows an opinion claim as "Editorial opinion" with neither button', () => {
    view({ current: checked([{ ...NOT_FOUND, result: 'opinion' }]) })
    openAll()
    const row = rowOf(NOT_FOUND.text)
    expect(within(row).getByText('Editorial opinion')).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Remove' })).toBeNull()
    expect(within(row).queryByRole('button', { name: 'Mark as editorial opinion' })).toBeNull()
  })
})

describe('"Research this" on a sentence not found (BR14)', () => {
  const PAGE = {
    url: 'https://www.studyaustralia.gov.au/en/work',
    site: 'studyaustralia.gov.au',
    title: 'Work while you study',
    sentence: 'Most students who work too many hours see their grades fall.',
  }
  const OTHER = {
    ...PAGE,
    url: 'https://www.education.gov.au/data',
    site: 'education.gov.au',
    title: 'Data',
  }
  const research = (over: Partial<typeof actions> = {}) =>
    render(
      <SourceCheckPanel
        view={{ ...VIEW, current: checked([FOUND, NOT_FOUND]) }}
        viewer={EDITOR}
        actions={{ ...actions, ...over }}
      />,
    )

  it('searches only when pressed, says so while it searches, then shows each page with its sentence', async () => {
    let answer: (r: Awaited<ReturnType<typeof actions.researchClaimAction>>) => void = () => {}
    const researchClaimAction = mock(
      (_id: unknown, _at: unknown, _sentence: unknown) =>
        new Promise<Awaited<ReturnType<typeof actions.researchClaimAction>>>((r) => {
          answer = r
        }),
    )
    research({ researchClaimAction })
    expect(researchClaimAction).not.toHaveBeenCalled()
    const row = rowOf(NOT_FOUND.text)
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'Research this' }))
    })
    expect(researchClaimAction).toHaveBeenCalledTimes(1)
    expect(researchClaimAction).toHaveBeenCalledWith('p1', 9, NOT_FOUND.text)
    expect(within(row).getByRole('status')).toHaveTextContent('Searching Google for support…')
    expect(within(row).queryByRole('button', { name: 'Research this' })).toBeNull()

    await act(async () => answer({ ok: true, sources: [PAGE, OTHER], entryPoint: '<p>Chips</p>' }))
    const pages = within(row).getAllByRole('listitem')
    expect(pages).toHaveLength(2)
    expect(within(pages[0]).getByRole('link', { name: PAGE.title })).toHaveAttribute(
      'href',
      PAGE.url,
    )
    expect(within(pages[0]).getByText(PAGE.site, { exact: false })).toBeInTheDocument()
    expect(within(pages[0]).getByText(PAGE.sentence, { exact: false })).toBeInTheDocument()
    expect(within(row).getByTitle('Google Search suggestions')).toBeInTheDocument()
  })

  it('adds a page as a source with its sentence, and dismisses another', async () => {
    const researchClaimAction = mock(async (_id: unknown, _at: unknown, _sentence: unknown) => ({
      ok: true as const,
      sources: [PAGE, OTHER],
      entryPoint: null,
    }))
    research({ researchClaimAction })
    const row = rowOf(NOT_FOUND.text)
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'Research this' }))
    })
    const second = within(row).getAllByRole('listitem')[1]
    await act(async () => {
      fireEvent.click(within(second).getByRole('button', { name: 'Dismiss' }))
    })
    expect(within(row).queryByText(OTHER.title)).toBeNull()
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'Add as a source' }))
    })
    expect(actions.addResearchSourceAction).toHaveBeenCalledWith('p1', 9, {
      claim: NOT_FOUND.text,
      url: PAGE.url,
      sentence: PAGE.sentence,
    })
    // With every page dismissed, it can be researched again; nothing says no page was found.
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'Dismiss' }))
    })
    expect(within(row).getByRole('button', { name: 'Research this' })).toBeInTheDocument()
    expect(within(row).queryByText('No page found that supports this sentence.')).toBeNull()
  })

  it('says when no page supports the sentence, and passes a refusal on', async () => {
    research({
      researchClaimAction: mock(async (_id: unknown, _at: unknown, _sentence: unknown) => ({
        ok: true as const,
        sources: [],
        entryPoint: null,
      })),
    })
    let row = rowOf(NOT_FOUND.text)
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'Research this' }))
    })
    expect(within(row).getByText('No page found that supports this sentence.')).toBeInTheDocument()
    cleanup()

    research({
      researchClaimAction: mock(async (_id: unknown, _at: unknown, _sentence: unknown) => ({
        ok: false as const,
        error: 'The daily limit for this step is reached.',
      })),
    })
    row = rowOf(NOT_FOUND.text)
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'Research this' }))
    })
    expect(within(row).getByRole('alert')).toHaveTextContent(
      'The daily limit for this step is reached.',
    )
    // It can be pressed again: each press is one search.
    expect(within(row).getByRole('button', { name: 'Research this' })).toBeInTheDocument()
  })
})

describe('SourceCheckPanel, only what keeps the post from review (the Settings "To fix" tab)', () => {
  const fixes = (over: Partial<Props['view']> = {}) =>
    render(
      <SourceCheckPanel view={{ ...VIEW, ...over }} viewer={EDITOR} actions={actions} fixesOnly />,
    )

  it('lists each sentence not found with its fixes, and nothing else: no summary, no other sentence', async () => {
    fixes({ current: checked([FOUND, NOT_FOUND]) })
    expect(screen.getAllByTestId('check-row')).toHaveLength(1)
    expect(screen.queryByText(FOUND.text) === null).toBe(true)
    expect(screen.queryByText(/found in the article/) === null).toBe(true)
    expect(screen.queryByRole('button', { name: 'All checked sentences' }) === null).toBe(true)
    const row = rowOf(NOT_FOUND.text)
    for (const name of ['Remove', 'Mark as editorial opinion', 'Research this']) {
      expect(within(row).getByRole('button', { name })).toBeEnabled()
    }
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'Remove' }))
    })
    expect(actions.removeClaimAction).toHaveBeenCalledWith('p1', 9, 1)
  })

  it('offers to run the check when none of this version has landed, and says nothing once every sentence is found', async () => {
    fixes()
    expect(screen.getByText('Not checked on this version yet.')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Run source check' }))
    })
    expect(actions.checkSourceAction).toHaveBeenCalledWith('p1', 9)
    cleanup()
    const { container } = fixes({ current: checked([FOUND]) })
    expect(container.textContent).toBe('')
  })
})
