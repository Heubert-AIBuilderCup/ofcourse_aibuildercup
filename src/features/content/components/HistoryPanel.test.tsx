/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { Staff } from '@/shared/lib/auth/access'
import { FEED_BRAND } from '../brands'
import { WORKFLOW_ERRORS } from '../lib/workflow'
import type { CurrentPost } from '../model/current'
import type { Saved } from '../server/commands'
import type { HistoryEntry } from '../server/store'
import { templateById } from '../templates'

mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}))

const { HistoryPanel } = await import('./HistoryPanel')
type Props = Parameters<typeof HistoryPanel>[0]

const THE_LINE = templateById('the-line')
if (!THE_LINE) throw new Error('no the-line template')

const STRUCTURE = { templateId: 'the-line', artPrompt: 'A desk.', slides: [] }
const BY = { userId: 'u-er', name: 'Esha R.', at: '2026-10-05T09:12:00.000Z' }

/** Two structures and a revision, newest first; the oldest structure was made from earlier facts. */
const HISTORY: HistoryEntry[] = [
  {
    id: 'rev1',
    kind: 'revision',
    note: 'light edit: phrase',
    at: '2026-10-05T09:12:00.000Z',
    by: 'Esha R.',
    factsId: 'facts1',
  },
  {
    id: 'd2',
    kind: 'drafts',
    note: 'Slide 2 edited',
    at: '2026-10-05T09:10:00.000Z',
    by: 'Esha R.',
    factsId: 'facts1',
  },
  { id: 'd1', kind: 'drafts', note: null, at: '2026-10-04T08:00:00.000Z', by: null, factsId: 'f0' },
]

const DRAFTS: CurrentPost['drafts'] = {
  id: 'd2',
  body: { factsId: 'facts1', attempt: 1, items: [], replays: [], emotion: null, note: null },
}
const REVISION: CurrentPost['revision'] = {
  id: 'rev1',
  body: {
    factsId: 'facts1',
    emotion: null,
    structure: STRUCTURE,
    template: THE_LINE,
    brand: FEED_BRAND,
    themeId: 'paper',
    by: BY,
    note: 'light edit: phrase',
  },
}

const CURRENT: CurrentPost = {
  source: null,
  facts: { id: 'facts1', body: { sourceId: 'src1', keyIdeas: [], facts: [], replays: [] } },
  drafts: DRAFTS,
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

const saved = async (): Promise<Saved> => ({ ok: true, id: 'p1', version: 15 })
const actions = {
  restoreVersionAction: mock(async (_id: unknown, _at: unknown, _record: unknown) => saved()),
}

const EDITOR: Staff = { role: 'user', editor: true }
const REVIEWER: Staff = { role: 'user', reviewer: true }
const ADMIN: Staff = { role: 'admin' }

const view = (
  viewer: Staff,
  stage: Props['view']['stage'],
  current: CurrentPost = CURRENT,
  history: HistoryEntry[] = HISTORY,
) =>
  render(
    <HistoryPanel
      view={{ id: 'p1', version: 14, stage, current, history }}
      viewer={viewer}
      actions={actions}
    />,
  )

const items = () => screen.getAllByRole('listitem')

afterEach(() => {
  cleanup()
  actions.restoreVersionAction.mockClear()
})

describe('HistoryPanel', () => {
  it('lists every version newest first, with what changed, who and when, and Saved for one with no note (101)', () => {
    view(REVIEWER, 'structures')
    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument()
    const rows = items()
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByText('Light edit')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Esha R. · 5 Oct 2026, 09:12')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Slide 2 edited')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Saved')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Someone · 4 Oct 2026, 08:00')).toBeInTheDocument()
  })

  it('marks the structure the post points at as current before approval, and the revision after', () => {
    view(EDITOR, 'structures')
    expect(within(items()[1]).getByText('Current')).toBeInTheDocument()
    expect(within(items()[0]).queryByText('Current')).toBeNull()
    cleanup()
    view(EDITOR, 'rendered', { ...CURRENT, revision: REVISION })
    expect(within(items()[0]).getByText('Current')).toBeInTheDocument()
    expect(within(items()[1]).queryByText('Current')).toBeNull()
  })

  it('restores an earlier version for an editor, and never the current one', async () => {
    view(EDITOR, 'rendered', { ...CURRENT, revision: REVISION })
    expect(within(items()[0]).queryByRole('button', { name: 'Restore' })).toBeNull()
    await act(async () => {
      fireEvent.click(within(items()[1]).getByRole('button', { name: 'Restore' }))
    })
    expect(actions.restoreVersionAction).toHaveBeenCalledWith('p1', 14, 'd2')
  })

  it('keeps Restore unavailable, saying why, for a revision at structures and for a revision made from earlier facts', () => {
    view(EDITOR, 'structures')
    const revision = within(items()[0])
    expect(revision.getByRole('button', { name: 'Restore' })).toBeDisabled()
    expect(revision.getByText(WORKFLOW_ERRORS.restoreGate)).toBeInTheDocument()
    cleanup()
    const earlierRevision: HistoryEntry = { ...HISTORY[0], id: 'rev0', factsId: 'f0' }
    view(EDITOR, 'rendered', { ...CURRENT, revision: REVISION }, [...HISTORY, earlierRevision])
    const earlier = within(items()[3])
    expect(earlier.getByRole('button', { name: 'Restore' })).toBeDisabled()
    expect(earlier.getByText(WORKFLOW_ERRORS.earlierFacts)).toBeInTheDocument()
  })

  it('restores a structure made from earlier facts, as one from before the source was remade (113)', async () => {
    view(EDITOR, 'structures')
    const earlier = within(items()[2])
    expect(earlier.queryByText(WORKFLOW_ERRORS.earlierFacts)).toBeNull()
    // Its facts differ from the current ones: restoring brings them back, and it says so.
    expect(earlier.getByText('Brings back the facts it was made from')).toBeInTheDocument()
    expect(within(items()[1]).queryByText('Brings back the facts it was made from')).toBeNull()
    const restore = earlier.getByRole('button', { name: 'Restore' })
    expect(restore).toBeEnabled()
    await act(async () => {
      fireEvent.click(restore)
    })
    expect(actions.restoreVersionAction).toHaveBeenCalledWith('p1', 14, 'd1')
  })

  it('shows a reviewer and an admin the history read-only, and an editor once the text is in review or live', () => {
    for (const [viewer, stage] of [
      [REVIEWER, 'rendered'],
      [ADMIN, 'structures'],
      [EDITOR, 'in_review'],
      [EDITOR, 'live'],
    ] as const) {
      view(viewer, stage)
      expect(items()).toHaveLength(3)
      expect(screen.queryAllByRole('button')).toHaveLength(0)
      cleanup()
    }
  })

  it('says when nothing has been saved yet', () => {
    view(EDITOR, 'structures', CURRENT, [])
    expect(screen.getByText('No versions saved yet.')).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })
})
