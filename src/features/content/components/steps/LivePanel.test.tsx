/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock, setSystemTime } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import { buttonVariants } from '@/shared/components/ui/button'
import type { Staff } from '@/shared/lib/auth/access'
import { emptyPointers } from '../../model/artifacts'
import type { CurrentPost } from '../../model/current'
import type { Saved } from '../../server/commands'
import type { MadeSet } from '../../server/social'

const refresh = mock(() => {})
const push = mock((_: string) => {})
let searchParams = new URLSearchParams()
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh }),
  useSearchParams: () => searchParams,
}))

const { LivePanel } = await import('./LivePanel')

type Props = Parameters<typeof LivePanel>[0]

const RAVI = { userId: 'u-ravi', name: 'Ravi K.', at: '2026-10-05T11:00:00.000Z' }

const CURRENT: CurrentPost = {
  source: null,
  facts: null,
  drafts: null,
  revision: null,
  layout: null,
  render: {
    id: 'ren1',
    body: {
      revisionId: 'rev1',
      layoutId: 'lay1',
      art: { assetId: 'art1', prompt: 'A desk.', version: 1, fallback: null },
      slides: [
        { svgAssetId: 's1', pngAssetId: 'png1' },
        { svgAssetId: 's2', pngAssetId: 'png2' },
      ],
    },
  },
  covers: null,
  artPlan: null,
  outline: null,
  blogOutline: null,
  blogText: null,
  blogImages: null,
  ideas: null,
  sourceCheck: null,
  settings: {
    id: 'set1',
    body: {
      layer: 'general',
      audience: { mode: 'everyone', rules: [] },
      whyLine: null,
      expiry: { kind: 'days', days: 90 },
      studioLink: null,
      tags: ['home:IN', 'theme:books-movies'],
      sourcesAt: 'caption',
    },
  },
  sendBack: null,
  approval: {
    id: 'ap1',
    body: {
      revisionId: 'rev1',
      renderId: 'ren1',
      sourceCheckId: 'sc1',
      settingsId: 'set1',
      visionId: null,
      overrideId: null,
      marketId: null,
      by: RAVI,
      selfReviewed: false,
    },
  },
  market: null,
  caption: null,
  export: null,
}

const VIEW: Props['view'] = {
  id: 'p1',
  title: 'Paid work',
  stage: 'live',
  version: 16,
  pointers: emptyPointers(),
  current: CURRENT,
  createdAt: '2026-10-05T09:12:00.000Z',
  running: [],
  draftChecks: [],
}

const actions = {
  adaptAction: mock(
    async (_id: unknown, _at: unknown, _input: unknown): Promise<Saved> => ({
      ok: true,
      id: 'sp1',
      version: 1,
    }),
  ),
  editLiveAction: mock(
    async (_id: unknown, _at: unknown): Promise<Saved> => ({ ok: true, id: 'p1', version: 17 }),
  ),
  makeSetAction: mock(
    async (_id: unknown, _at: unknown, _input: unknown): Promise<MadeSet> => ({
      ok: true,
      id: 'p1',
      version: 16,
      versions: [
        {
          id: 'sp1',
          title: 'Instagram · Cerebral',
          brandId: 'cerebral',
          kind: 'page',
          stage: 'ready',
          error: null,
          ownCover: false,
        },
        {
          id: 'sp2',
          title: 'Quote card · Main',
          brandId: 'main',
          kind: 'quote',
          stage: 'ready',
          error: null,
          ownCover: false,
        },
      ],
    }),
  ),
}
const EDITOR: Staff = { role: 'user', editor: true }
const REVIEWER: Staff = { role: 'user', reviewer: true }

afterEach(() => {
  setSystemTime()
  cleanup()
  refresh.mockClear()
  push.mockClear()
  actions.adaptAction.mockClear()
  actions.makeSetAction.mockClear()
  actions.editLiveAction.mockClear()
})

describe('LivePanel', () => {
  it('shows the live line, the review line and the published slides', () => {
    setSystemTime(new Date('2026-10-05T12:00:00.000Z'))
    render(<LivePanel view={VIEW} viewer={REVIEWER} actions={actions} />)
    expect(screen.getByText('General · Everyone · Leaves the feed in 90 days')).toBeInTheDocument()
    expect(screen.getByText('India · Books and movies')).toBeInTheDocument()
    expect(screen.getByText('Reviewed by Ravi K. · facts locked')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Slide 1\b/ })).toHaveAttribute(
      'src',
      '/admin/assets/png1',
    )
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('shows the live post large, one slide at a time in a strip that swipes', () => {
    render(<LivePanel view={VIEW} viewer={REVIEWER} actions={actions} />)
    expect(screen.getByRole('group', { name: 'Slides, one at a time' })).toHaveAttribute(
      'aria-roledescription',
      'carousel',
    )
  })

  it('counts the days left from the approval (54)', () => {
    setSystemTime(new Date('2026-11-27T12:00:00.000Z'))
    render(<LivePanel view={VIEW} viewer={REVIEWER} actions={actions} />)
    expect(screen.getByText('General · Everyone · Leaves the feed in 37 days')).toBeInTheDocument()
  })

  it('offers only the Default version when there is no Nepal version (61)', () => {
    render(<LivePanel view={VIEW} viewer={REVIEWER} actions={actions} />)
    expect(screen.getByRole('radio', { name: 'Default' })).toBeChecked()
    expect(screen.queryByRole('radio', { name: 'Nepal' })).toBeNull()
  })

  it('shows the approved Nepal version beside the Default one, and no way to make one (60, 61)', () => {
    const market: CurrentPost['market'] = {
      id: 'mk1',
      body: {
        revisionId: 'rev1',
        renderId: 'ren1',
        market: 'NP',
        slots: [],
        feedExcerpt: "Deciding with your family how many hours you'll work?",
        conversions: [],
        layout: [],
        fitChecks: [],
        slides: [
          { svgAssetId: 'ns1', pngAssetId: 'npng1' },
          { svgAssetId: 'ns2', pngAssetId: 'npng2' },
        ],
        replays: [],
      },
    }
    const approval = CURRENT.approval
    if (!approval) throw new Error('no approval')
    render(
      <LivePanel
        viewer={EDITOR}
        actions={actions}
        view={{
          ...VIEW,
          current: {
            ...CURRENT,
            market,
            approval: { ...approval, body: { ...approval.body, marketId: 'mk1' } },
          },
        }}
      />,
    )
    expect(screen.getByRole('radio', { name: 'Default' })).toBeChecked()
    expect(screen.getByRole('img', { name: /^Slide 1\b/ })).toHaveAttribute(
      'src',
      '/admin/assets/png1',
    )
    fireEvent.click(screen.getByRole('radio', { name: 'Nepal' }))
    expect(screen.getByRole('img', { name: /^Slide 1\b/ })).toHaveAttribute(
      'src',
      '/admin/assets/npng1',
    )
    expect(
      screen.getByText("Deciding with your family how many hours you'll work?"),
    ).toBeInTheDocument()
    // The market version shows large too, one slide at a time in a strip that swipes.
    expect(screen.getByRole('group', { name: 'Slides, one at a time' })).toHaveAttribute(
      'aria-roledescription',
      'carousel',
    )
    expect(screen.queryByRole('button', { name: /nepal/i })).toBeNull()
    cleanup()

    // The board's market card opens the live post on its market version (87).
    searchParams = new URLSearchParams('market=NP')
    try {
      render(
        <LivePanel
          viewer={EDITOR}
          actions={actions}
          view={{ ...VIEW, current: { ...CURRENT, market } }}
        />,
      )
      expect(screen.getByRole('radio', { name: 'Nepal' })).toBeChecked()
      expect(screen.getByRole('img', { name: /^Slide 1\b/ })).toHaveAttribute(
        'src',
        '/admin/assets/npng1',
      )
    } finally {
      searchParams = new URLSearchParams()
    }
  })

  it('adapts the live post for a page brand and a platform, the Comics page left out (63, RC7)', async () => {
    render(<LivePanel view={VIEW} viewer={EDITOR} actions={actions} />)
    const brand = screen.getByLabelText('Page brand')
    expect([...(brand as HTMLSelectElement).options].map((o) => o.text)).toEqual([
      'Choose a page brand',
      'Main',
      'Cerebral',
      'Infographics',
    ])
    fireEvent.change(brand, { target: { value: 'cerebral' } })
    fireEvent.change(screen.getByLabelText('Platform'), { target: { value: 'linkedin' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create social version' }))
    })
    expect(actions.adaptAction).toHaveBeenCalledTimes(1)
    const [id, at, input] = actions.adaptAction.mock.calls[0]
    expect([id, at]).toEqual(['p1', 16])
    expect(input).toMatchObject({ brandId: 'cerebral', platform: 'linkedin' })
    expect((input as { requestId: string }).requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(refresh).toHaveBeenCalled()
  })

  it('pre-selects the page brand the rule file names for the post’s theme, which the editor may change (88)', () => {
    // The settings carry theme:books-movies, which the rule file sends to Cerebral.
    render(<LivePanel view={VIEW} viewer={EDITOR} actions={actions} />)
    expect(screen.getByLabelText('Page brand')).toHaveValue('cerebral')
    expect(screen.getByRole('button', { name: 'Create social version' })).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Page brand'), { target: { value: 'main' } })
    expect(screen.getByLabelText('Page brand')).toHaveValue('main')
  })

  it('pre-selects nothing for a post whose theme the rule file does not name, and waits for a choice (88)', async () => {
    const settings = CURRENT.settings
    if (!settings) throw new Error('no settings')
    render(
      <LivePanel
        viewer={EDITOR}
        actions={actions}
        view={{
          ...VIEW,
          current: {
            ...CURRENT,
            settings: { ...settings, body: { ...settings.body, tags: ['home:IN'] } },
          },
        }}
      />,
    )
    expect(screen.getByLabelText('Page brand')).toHaveValue('')
    const create = screen.getByRole('button', { name: 'Create social version' })
    await act(async () => {
      fireEvent.click(create)
    })
    expect(actions.adaptAction).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Page brand'), { target: { value: 'infographics' } })
    await act(async () => {
      fireEvent.click(create)
    })
    expect(actions.adaptAction).toHaveBeenCalledTimes(1)
    expect(actions.adaptAction.mock.calls[0][2]).toMatchObject({ brandId: 'infographics' })
  })

  it('lets an editor edit the live post as a working copy, saying students keep this version (116)', async () => {
    render(<LivePanel view={VIEW} viewer={EDITOR} actions={actions} />)
    expect(
      screen.getByText('Students keep seeing this version until the new one is published.'),
    ).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    })
    expect(actions.editLiveAction).toHaveBeenCalledWith('p1', 16)
    // A working copy is at its text versions: their screen opens (GD27).
    expect(push).toHaveBeenCalledWith('/admin/posts/p1/text')
  })

  it('shows "Edit" disabled with the running step in words while one runs (122)', () => {
    render(<LivePanel view={{ ...VIEW, running: ['market'] }} viewer={EDITOR} actions={actions} />)
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled()
    expect(screen.getByText('The market version is being made')).toBeInTheDocument()
  })

  it('offers a reviewer, and an exported post, no "Edit"', () => {
    render(<LivePanel view={VIEW} viewer={REVIEWER} actions={actions} />)
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    cleanup()
    render(<LivePanel view={{ ...VIEW, stage: 'exported' }} viewer={EDITOR} actions={actions} />)
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  })

  it('offers a reviewer no way to adapt or to make the set', () => {
    render(<LivePanel view={VIEW} viewer={REVIEWER} actions={actions} />)
    expect(screen.queryByRole('button', { name: 'Create social version' })).toBeNull()
    expect(screen.queryByLabelText('Page brand')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Make the set' })).toBeNull()
    expect(screen.queryByRole('list', { name: 'The set' })).toBeNull()
  })

  it('lists an Instagram version per page with a design language, "No design language yet" for the rest, and the quote card on the post’s page or Main; never the Comics page (108, RC7)', () => {
    render(
      <LivePanel
        view={{ ...VIEW, styledPages: ['cerebral', 'comics'] }}
        viewer={EDITOR}
        actions={actions}
      />,
    )
    const items = within(screen.getByRole('list', { name: 'The set' })).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual([
      'Main · No design language yet',
      'Cerebral · Instagram version',
      'Infographics · No design language yet',
      'Quote card · Main',
    ])
    expect(screen.getByRole('button', { name: 'Make the set' })).toBeEnabled()

    cleanup()
    render(
      <LivePanel
        view={{
          ...VIEW,
          styledPages: ['cerebral'],
          pointers: { ...VIEW.pointers, pageBrandId: 'cerebral' },
        }}
        viewer={EDITOR}
        actions={actions}
      />,
    )
    expect(
      within(screen.getByRole('list', { name: 'The set' })).getByText('Quote card · Cerebral'),
    ).toBeInTheDocument()
  })

  it('makes the set with one request id per styled page and one for the quote card, then lists each version made (108)', async () => {
    render(
      <LivePanel
        view={{ ...VIEW, styledPages: ['cerebral', 'comics'] }}
        viewer={EDITOR}
        actions={actions}
      />,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Make the set' }))
    })
    expect(actions.makeSetAction).toHaveBeenCalledTimes(1)
    const [id, at, input] = actions.makeSetAction.mock.calls[0]
    expect([id, at]).toEqual(['p1', 16])
    const { requestIds } = input as { requestIds: Record<string, string> }
    expect(Object.keys(requestIds).sort()).toEqual(['cerebral', 'quote'])
    for (const requestId of Object.values(requestIds)) {
      expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
    }
    expect(refresh).toHaveBeenCalled()

    const made = within(screen.getByRole('list', { name: 'Versions made' })).getAllByRole(
      'listitem',
    )
    expect(made.map((li) => li.textContent)).toEqual([
      'Instagram · Cerebral · Ready to export · with this post’s art (daily image limit reached or no clean cover)',
      'Quote card · Main · Ready to export',
    ])
    expect(screen.getByRole('link', { name: 'Instagram · Cerebral' })).toHaveAttribute(
      'href',
      '/admin/posts/sp1',
    )
  })

  it('says why a version of the set stopped short, and makes the next set with new request ids', async () => {
    actions.makeSetAction.mockResolvedValueOnce({
      ok: true,
      id: 'p1',
      version: 16,
      versions: [
        {
          id: 'sp3',
          title: 'Quote card · Main',
          brandId: 'main',
          kind: 'quote',
          stage: 'approved',
          error: 'Could not save. Please try again.',
          ownCover: false,
        },
      ],
    })
    render(<LivePanel view={VIEW} viewer={EDITOR} actions={actions} />)
    const button = screen.getByRole('button', { name: 'Make the set' })
    await act(async () => {
      fireEvent.click(button)
    })
    expect(
      within(screen.getByRole('list', { name: 'Versions made' })).getByRole('listitem').textContent,
    ).toBe('Quote card · Main · Images · Could not save. Please try again.')
    await act(async () => {
      fireEvent.click(button)
    })
    expect(actions.makeSetAction).toHaveBeenCalledTimes(2)
    const first = (actions.makeSetAction.mock.calls[0][2] as { requestIds: Record<string, string> })
      .requestIds
    const second = (
      actions.makeSetAction.mock.calls[1][2] as { requestIds: Record<string, string> }
    ).requestIds
    expect(Object.keys(first)).toEqual(['quote'])
    expect(second.quote).not.toBe(first.quote)
  })

  it('leaves the way on ("Next: Blog →") the one filled button; adapting and the set are outlined', () => {
    const next = (
      <a href="/admin/posts/p1/blog" className={buttonVariants()}>
        Next: Blog →
      </a>
    )
    render(
      <LivePanel
        view={{ ...VIEW, styledPages: ['cerebral'] }}
        viewer={EDITOR}
        actions={actions}
        links={next}
      />,
    )
    expect(screen.getByRole('button', { name: 'Make the set' })).toBeInTheDocument()
    let filled = document.querySelectorAll('.bg-primary-strong')
    expect(filled).toHaveLength(1)
    expect(filled[0]).toHaveTextContent('Next: Blog →')
    cleanup()
    render(
      <LivePanel
        view={{ ...VIEW, courseId: 'c1' }}
        viewer={EDITOR}
        actions={actions}
        links={next}
      />,
    )
    filled = document.querySelectorAll('.bg-primary-strong')
    expect(filled).toHaveLength(1)
    expect(filled[0]).toHaveTextContent('Next: Blog →')
  })

  it('offers a comic one "Make Instagram version for Comics", with no page choice and no set (RC7)', async () => {
    render(
      <LivePanel
        view={{ ...VIEW, courseId: 'c1', styledPages: ['cerebral', 'comics'] }}
        viewer={EDITOR}
        actions={actions}
      />,
    )
    expect(screen.queryByLabelText('Page brand')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Create social version' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Make the set' })).toBeNull()
    expect(screen.queryByRole('list', { name: 'The set' })).toBeNull()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Make Instagram version for Comics' }))
    })
    expect(actions.adaptAction).toHaveBeenCalledTimes(1)
    const [id, at, input] = actions.adaptAction.mock.calls[0]
    expect([id, at]).toEqual(['p1', 16])
    expect(input).toMatchObject({ brandId: 'comics', platform: 'instagram' })
    expect((input as { requestId: string }).requestId).toMatch(/^[0-9a-f-]{36}$/)
    cleanup()

    // A reviewer is offered none.
    render(<LivePanel view={{ ...VIEW, courseId: 'c1' }} viewer={REVIEWER} actions={actions} />)
    expect(screen.queryByRole('button', { name: 'Make Instagram version for Comics' })).toBeNull()
  })
})
