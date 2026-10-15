/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { Staff } from '@/shared/lib/auth/access'
import { FEED_BRAND } from '../../brands'
import { emptyPointers } from '../../model/artifacts'
import type { CurrentPost } from '../../model/current'
import type { Fact } from '../../model/types'
import type { Saved } from '../../server/commands'
import { templateById } from '../../templates'
import { nativeOf } from '../../text/native-fixtures'

const push = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh: () => {} }),
}))

const { ReviewPanel } = await import('./ReviewPanel')
type Props = Parameters<typeof ReviewPanel>[0]

const THE_LINE = templateById('the-line')
if (!THE_LINE) throw new Error('no the-line template')

const FACT: Fact = {
  id: 'f1',
  text: 'Above 20 hrs/week: pass rates −11 points',
  value: { number: -11, unit: 'points' },
  ref: '¶3',
  quote: 'Above 20 hours a week, pass rates fell by 11 percentage points.',
  supported: true,
  why: null,
  span: null,
}

const plain = (text: string) => ({ text, factIds: [], factual: false })
const BY = { userId: 'u-er', name: 'Esha R.', at: '2026-10-05T09:12:00.000Z' }

const CURRENT: CurrentPost = {
  source: {
    id: 'src1',
    body: {
      title: 'Hours of paid work and first-year results',
      kind: 'research summary',
      text: '',
      paragraphs: [],
      demoKey: null,
      language: 'en',
    },
  },
  facts: { id: 'facts1', body: { sourceId: 'src1', keyIdeas: [], facts: [FACT], replays: [] } },
  drafts: null,
  revision: {
    id: 'rev1',
    body: {
      factsId: 'facts1',
      emotion: null,
      structure: {
        templateId: 'the-line',
        artPrompt: 'A desk.',
        slides: [
          {
            kind: 'cover',
            slots: {
              kicker: plain('Paid work'),
              phrase: plain('The line'),
              byline: plain('OfCourse'),
            },
          },
          {
            kind: 'body',
            slots: {
              heading: plain('Above 20'),
              body: {
                text: 'Above 20 hours a week, pass rates fell by 11 percentage points.',
                factIds: ['f1'],
                factual: true,
              },
            },
          },
        ],
      },
      template: THE_LINE,
      brand: FEED_BRAND,
      themeId: 'paper',
      by: BY,
      note: 'approved',
    },
  },
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
  sourceCheck: {
    id: 'sc1',
    body: {
      revisionId: 'rev1',
      claims: [
        { text: 'Most students fail.', slide: 2, slot: 'body', result: 'opinion', ref: null },
      ],
      replays: [],
    },
  },
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
  approval: null,
  market: null,
  caption: null,
  export: null,
}

const VIEW: Props['view'] = {
  id: 'p1',
  title: 'Paid work',
  stage: 'in_review',
  version: 14,
  pointers: emptyPointers(),
  current: CURRENT,
  createdAt: '2026-10-05T09:12:00.000Z',
  running: [],
  draftChecks: [],
}

const saved = async (): Promise<Saved> => ({ ok: true, id: 'p1', version: 15 })
const actions = {
  approvePublishAction: mock(async (_id: unknown, _at: unknown) => saved()),
  sendBackAction: mock(async (_id: unknown, _at: unknown, _reason: unknown) => saved()),
  withdrawAction: mock(async (_id: unknown, _at: unknown) => saved()),
}

const EDITOR: Staff = { role: 'user', editor: true }
const REVIEWER: Staff = { role: 'user', reviewer: true }
const ADMIN: Staff = { role: 'admin' }

const view = (viewer: Staff, current: CurrentPost = CURRENT) =>
  render(<ReviewPanel view={{ ...VIEW, current }} viewer={viewer} actions={actions} />)

/** A Nepal version beside the render, which no slide vision check reads any more (103). */
const MARKET: CurrentPost['market'] = {
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

afterEach(() => {
  cleanup()
  push.mockClear()
  for (const a of Object.values(actions)) a.mockClear()
})

describe('ReviewPanel', () => {
  it('shows the stored slides, the fact chips, the source check and the settings', () => {
    view(REVIEWER)
    expect(screen.getByRole('img', { name: /^Slide 2\b/ })).toHaveAttribute(
      'src',
      '/admin/assets/png2',
    )
    expect(
      screen.getByText(
        'Above 20 hrs/week: pass rates −11 points · ¶3 · Hours of paid work and first-year results · checked 5 Oct 2026',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Editorial opinion')).toBeInTheDocument()
    expect(screen.getByText('General · Everyone · Leaves the feed in 90 days')).toBeInTheDocument()
    expect(screen.getByText('India · Books and movies')).toBeInTheDocument()
  })

  it('says the post is for everyone when no tag is ticked (80)', () => {
    const settings = CURRENT.settings as NonNullable<CurrentPost['settings']>
    view(REVIEWER, { ...CURRENT, settings: { ...settings, body: { ...settings.body, tags: [] } } })
    expect(screen.getByText('For everyone')).toBeInTheDocument()
  })

  it('gives each stored slide its laid-out words as its alt, for a reviewer who cannot see it', () => {
    const line = (slot: string, text: string) => ({
      slot,
      text,
      x: 0,
      y: 0,
      fontPx: 40,
      font: 'body' as const,
      mark: 'none' as const,
      width: 100,
    })
    const laid = (lines: ReturnType<typeof line>[]) => ({
      kind: 'body' as const,
      lines,
      artBox: null,
      sourceLine: null,
      searchLine: null,
    })
    view(REVIEWER, {
      ...CURRENT,
      layout: {
        id: 'lay1',
        body: {
          revisionId: 'rev1',
          slides: [
            laid([line('phrase', 'The line')]),
            laid([
              line('heading', 'Above 20'),
              line('body', 'Above 20 hours a week, pass'),
              line('body', 'rates fell by 11 points.'),
            ]),
          ],
          fits: [],
          fitChecks: [],
        },
      },
    })
    const alt = screen.getAllByRole('img')[1]?.getAttribute('alt') ?? ''
    expect(alt.startsWith('Slide 2: ')).toBe(true)
    expect(alt).toContain('Above 20')
    expect(alt).toContain('Above 20 hours a week, pass rates fell by 11 points.')
  })

  it('keeps "Approve and publish" unavailable to an editor, waiting for a reviewer', () => {
    view(EDITOR)
    expect(screen.getByRole('button', { name: 'Approve and publish' })).toBeDisabled()
    expect(screen.getByText('Waiting for a reviewer')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send back' })).toBeNull()
  })

  it('lets a reviewer approve and publish, from the step actions bar', async () => {
    view(REVIEWER)
    expect(
      within(screen.getByRole('region', { name: 'Step actions' })).getByRole('button', {
        name: 'Approve and publish',
      }),
    ).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Approve and publish' }))
    })
    expect(actions.approvePublishAction).toHaveBeenCalledWith('p1', 14)
    // Published, the post is live: its screen opens (GD27).
    expect(push).toHaveBeenCalledWith('/admin/posts/p1/live')
  })

  it('reads "Request changes", and needs a note and the step it names before it sends (120)', async () => {
    view(REVIEWER)
    expect(screen.queryByRole('button', { name: 'Send back' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Request changes' }))
    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Request changes' })
    expect(confirm).toBeDisabled()
    const note = within(dialog).getByRole('textbox', { name: 'Note' })
    fireEvent.change(note, { target: { value: '   ' } })
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Covers' }))
    expect(confirm).toBeDisabled()
    fireEvent.change(note, { target: { value: 'Slide 2 is too long' } })
    expect(confirm).toBeEnabled()
    await act(async () => {
      fireEvent.click(confirm)
    })
    expect(actions.sendBackAction).toHaveBeenCalledWith('p1', 14, 'Slide 2 is too long', 'covers')
    // Back at rendered, the post's current step is the images (GD27).
    expect(push).toHaveBeenCalledWith('/admin/posts/p1/images')
  })

  it('takes a Nepali note of 200 characters as a reader sees them, holding the field to it (GD37)', async () => {
    view(REVIEWER)
    fireEvent.click(screen.getByRole('button', { name: 'Request changes' }))
    const dialog = screen.getByRole('dialog')
    const note = within(dialog).getByRole('textbox', { name: 'Note' })
    const reason = nativeOf('ne', 200)
    fireEvent.change(note, { target: { value: `${reason}।` } })
    expect(note).toHaveValue(reason)
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Covers' }))
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Request changes' }))
    })
    expect(actions.sendBackAction).toHaveBeenCalledWith('p1', 14, reason, 'covers')
  })

  it('opens the step a request for changes names: Settings for settings (120)', async () => {
    view(REVIEWER)
    fireEvent.click(screen.getByRole('button', { name: 'Request changes' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Note' }), {
      target: { value: 'Expiry is too long' },
    })
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Settings' }))
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Request changes' }))
    })
    expect(actions.sendBackAction).toHaveBeenCalledWith('p1', 14, 'Expiry is too long', 'settings')
    expect(push).toHaveBeenCalledWith('/admin/posts/p1/settings')
  })

  it('keeps "Request changes" disabled with a note and no step chosen (120)', () => {
    view(REVIEWER)
    fireEvent.click(screen.getByRole('button', { name: 'Request changes' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Note' }), {
      target: { value: 'Slide 2 is too long' },
    })
    expect(within(dialog).getByRole('button', { name: 'Request changes' })).toBeDisabled()
  })

  it('offers no wording, structure or settings control', () => {
    view(REVIEWER)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('shows no vision check and no override; a reviewer approves the post and its Nepal version (103)', () => {
    view(REVIEWER, { ...CURRENT, market: MARKET })
    expect(screen.queryByText(/vision check/i)).toBeNull()
    expect(screen.queryByText('Not checked')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Override/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Approve and publish' })).toBeEnabled()
  })

  it('lets an editor withdraw the post from review (115)', async () => {
    view(EDITOR)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Withdraw from review' }))
    })
    expect(actions.withdrawAction).toHaveBeenCalledWith('p1', 14)
    expect(push).toHaveBeenCalledWith('/admin/posts/p1/images')
  })

  it('shows "Withdraw from review" disabled with the running step in words while one runs (122)', () => {
    render(
      <ReviewPanel view={{ ...VIEW, running: ['render'] }} viewer={EDITOR} actions={actions} />,
    )
    expect(screen.getByRole('button', { name: 'Withdraw from review' })).toBeDisabled()
    expect(screen.getByText('Slides are being drawn')).toBeInTheDocument()
  })

  it('offers a reviewer who is not an editor no withdraw', () => {
    view(REVIEWER)
    expect(screen.queryByRole('button', { name: 'Withdraw from review' })).toBeNull()
  })

  it('shows the review of a live post as a summary, with no button for anyone (111)', () => {
    const viewers: Staff[] = [EDITOR, REVIEWER, { role: 'user', editor: true, reviewer: true }]
    for (const viewer of viewers) {
      render(<ReviewPanel view={{ ...VIEW, stage: 'live' }} viewer={viewer} actions={actions} />)
      expect(
        screen.getByText('General · Everyone · Leaves the feed in 90 days'),
      ).toBeInTheDocument()
      expect(screen.queryAllByRole('button')).toHaveLength(0)
      cleanup()
    }
  })

  it('offers an admin no button', () => {
    view(ADMIN)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('shows the Default and Nepal versions side by side when there is one (60)', () => {
    view(REVIEWER, { ...CURRENT, market: MARKET })
    const defaults = within(screen.getByRole('region', { name: 'Default' }))
    const nepal = within(screen.getByRole('region', { name: 'Nepal' }))
    expect(defaults.getByRole('img', { name: /^Slide 2\b/ })).toHaveAttribute(
      'src',
      '/admin/assets/png2',
    )
    expect(nepal.getByRole('img', { name: /^Slide 2\b/ })).toHaveAttribute(
      'src',
      '/admin/assets/npng2',
    )
    expect(
      nepal.getByText("Deciding with your family how many hours you'll work?"),
    ).toBeInTheDocument()
  })

  it('says whether the market version was reworded, so the reviewer knows what the model touched (110)', () => {
    view(REVIEWER, { ...CURRENT, market: MARKET })
    const nepal = () => within(screen.getByRole('region', { name: 'Nepal' }))
    expect(nepal().getByText('Approved wording, money converted')).toBeInTheDocument()
    cleanup()

    view(REVIEWER, { ...CURRENT, market: { ...MARKET, body: { ...MARKET.body, reworded: true } } })
    expect(nepal().getByText('Reworded for Nepal')).toBeInTheDocument()
    expect(nepal().queryByText('Approved wording, money converted')).toBeNull()
  })

  it('shows the post large, one slide at a time in a strip that swipes, for each version', () => {
    view(REVIEWER)
    expect(screen.getAllByRole('group', { name: 'Slides, one at a time' })).toHaveLength(1)
    cleanup()
    view(REVIEWER, { ...CURRENT, market: MARKET })
    for (const version of ['Default', 'Nepal']) {
      expect(
        within(screen.getByRole('region', { name: version })).getByRole('group', {
          name: 'Slides, one at a time',
        }),
      ).toHaveAttribute('aria-roledescription', 'carousel')
    }
  })

  it('shows one version when there is no Nepal version', () => {
    view(REVIEWER)
    expect(screen.queryByRole('region', { name: 'Nepal' })).toBeNull()
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })
})
