/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import { toast } from 'sonner'
import type { Staff } from '@/shared/lib/auth/access'
import { FEED_BRAND } from '../../brands'
import { emptyPointers } from '../../model/artifacts'
import type { CurrentPost } from '../../model/current'
import type { LaidSlide, Structure } from '../../model/types'
import type { Saved } from '../../server/commands'
import { templateById } from '../../templates'

// The Settings step's view of a rendered post, look or legacy (criteria 55–61, 85, 87, 110): the
// Market switch with "Make market version" and "Reword for <market>" (the market versions' panel),
// and the preview beside it, with "Preview in context". The two share which version shows.

const refresh = mock(() => {})
const replace = mock((_url: string, _options?: unknown) => {})
let searchParams = new URLSearchParams()
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push: () => {}, replace, refresh }),
  usePathname: () => '/admin/posts/p1/settings',
  useSearchParams: () => searchParams,
}))

const { MarketControls, PostPreview, useShownMarket } = await import('./PostPreview')

/** Where a link sits: in the step bar ("Step actions", 18 Oct) or anywhere else. */
const place = (el: Element) => (el.closest('[aria-label="Step actions"]') ? 'bar' : 'elsewhere')
type Props = Parameters<typeof MarketControls>[0]

/** The market versions' panel and the preview, sharing the version shown, as Settings has them. */
function Both({ view, viewer, actions }: Omit<Props, 'shown' | 'onShow'>) {
  const [shown, onShow] = useShownMarket(view.current.market)
  return (
    <>
      <MarketControls view={view} viewer={viewer} actions={actions} shown={shown} onShow={onShow} />
      <PostPreview view={view} shown={shown} />
    </>
  )
}

const FIELD_NOTES = templateById('field-notes')
if (!FIELD_NOTES) throw new Error('no field-notes template')

const text = (t: string) => ({ text: t, factIds: [], factual: false })
const STRUCTURE: Structure = {
  templateId: 'field-notes',
  artPrompt: 'A quiet desk at dusk.',
  slides: [
    { kind: 'cover', layout: 'cover', slots: { heading: text('The line') } },
    { kind: 'body', layout: 'picture', slots: { body: text('Grades hold up to 20 hours.') } },
    { kind: 'take', layout: 'takeaway', slots: { heading: text('Keep to 20') } },
  ],
}

const laid = (kind: LaidSlide['kind'], over: Partial<LaidSlide> = {}): LaidSlide => ({
  kind,
  lines: [],
  artBox: null,
  sourceLine: null,
  searchLine: null,
  ...over,
})

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

/** A drawn Field Notes post: three slides, the body's source line shortened beside the frame. */
const LOOK: CurrentPost = {
  ...EMPTY,
  revision: {
    id: 'rev1',
    body: {
      factsId: 'facts1',
      structure: STRUCTURE,
      template: FIELD_NOTES,
      brand: FEED_BRAND,
      themeId: 'pop',
      by: { userId: 'u1', name: 'Ed', at: '2026-10-05T09:12:00.000Z' },
      note: 'approved',
      emotion: null,
    },
  },
  layout: {
    id: 'lay1',
    body: {
      revisionId: 'rev1',
      slides: [
        laid('cover'),
        laid('body', {
          sourceLine: 'Source: Paid work, money… · ¶1',
          fullSourceLine: 'Source: Paid work, money first · ¶1',
        }),
        laid('take'),
      ],
      fits: [],
      fitChecks: [],
    },
  },
  render: {
    id: 'ren1',
    body: {
      revisionId: 'rev1',
      layoutId: 'lay1',
      art: { assetId: null, prompt: '', version: 1, fallback: null },
      slides: [1, 2, 3].map((n) => ({ svgAssetId: `s${n}`, pngAssetId: `png${n}` })),
      slideArt: [1, 2].map((slide) => ({
        slide,
        assetId: `art${slide}`,
        scene: 'A desk.',
        take: 1,
        nudge: null,
        fallback: null,
      })),
    },
  },
}

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
    slides: [1, 2, 3].map((n) => ({ svgAssetId: `ns${n}`, pngAssetId: `npng${n}` })),
    replays: [],
  },
}
const INDIA: CurrentPost['market'] = { ...MARKET, body: { ...MARKET.body, market: 'IN' } }

const SETTINGS: CurrentPost['settings'] = {
  id: 'set1',
  body: {
    layer: 'personal',
    audience: { mode: 'matched', rules: [] },
    whyLine: 'You weighted work rights highly.',
    expiry: { kind: 'none' },
    studioLink: 'Work rights weight',
    tags: [],
    sourcesAt: 'caption',
  },
}

const VIEW: Props['view'] = {
  id: 'p1',
  title: 'Paid work, money first',
  stage: 'rendered',
  version: 7,
  pointers: { ...emptyPointers(), revisionId: 'rev1', layoutId: 'lay1', renderId: 'ren1' },
  current: LOOK,
  createdAt: '2026-10-05T09:12:00.000Z',
  running: [],
  draftChecks: [],
}

const saved = async (): Promise<Saved> => ({ ok: true, id: 'p1', version: 8 })
const actions = {
  makeMarketAction: mock(async (_id: unknown, _at: unknown, _market: unknown) => saved()),
  rewordMarketAction: mock(async (_id: unknown, _at: unknown) => saved()),
}

const EDITOR: Staff = { role: 'user', editor: true }
const ADMIN: Staff = { role: 'admin' }

const view = (
  over: { stage?: Props['view']['stage']; current?: Partial<CurrentPost>; running?: string[] } = {},
  viewer: Staff = EDITOR,
) =>
  render(
    <Both
      view={{
        ...VIEW,
        stage: over.stage ?? VIEW.stage,
        running: over.running ?? [],
        current: { ...LOOK, ...over.current },
      }}
      viewer={viewer}
      actions={actions}
    />,
  )

const slide = (n: number) => screen.getByRole('img', { name: new RegExp(`^Slide ${n}\\b`) })
/** The preview's buttons by name: the filmstrip's alone, no way to make or reword a version. */
const buttonNames = () =>
  screen.queryAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent ?? '')
const marketSelect = () => screen.getByRole('combobox', { name: 'For market' })
const makeButton = () => screen.getByRole('button', { name: 'Make market version' })
/** The filmstrip's thumbnail of slide `n`, and the one marked as shown. */
const thumb = (n: number) => screen.getByRole('button', { name: `Slide ${n}` })
const currentThumb = () =>
  screen
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-current') === 'true')
    .map((b) => b.getAttribute('aria-label'))
const FILMSTRIP = ['Slide 1', 'Slide 2', 'Slide 3']

afterEach(() => {
  cleanup()
  refresh.mockClear()
  replace.mockClear()
  searchParams = new URLSearchParams()
  for (const a of Object.values(actions)) a.mockClear()
})

describe('PostPreview: the market (56–61, 85, 87, 110)', () => {
  it('offers the markets in a select, Nepal first, beside "Make market version" on a drawn look post', async () => {
    const success = spyOn(toast, 'success')
    view()
    expect(screen.getByRole('radio', { name: 'Default' })).toBeChecked()
    expect(screen.queryByRole('radio', { name: 'Nepal' })).toBeNull()
    expect(
      within(marketSelect())
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Nepal', 'India', 'Thailand'])
    expect(marketSelect()).toHaveValue('NP')
    await act(async () => {
      fireEvent.click(makeButton())
    })
    expect(actions.makeMarketAction).toHaveBeenCalledWith('p1', 7, 'NP')
    expect(success).toHaveBeenCalledWith('Nepal version made · linked card on the board')
    // The page shows the market version after the refresh.
    expect(replace).toHaveBeenCalledWith('/admin/posts/p1/settings?market=NP', { scroll: false })
    success.mockRestore()
  })

  it('says a refused market version beside "Make market version", and stays on the default', async () => {
    const refusal = 'Slide 2 · body · needs 18 lines, room for 17 · Over'
    actions.makeMarketAction.mockImplementationOnce(async () => ({ ok: false, error: refusal }))
    view()
    await act(async () => {
      fireEvent.click(makeButton())
    })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(refusal)
    expect(alert.parentElement?.contains(makeButton())).toBe(true)
    expect(replace).not.toHaveBeenCalled()
  })

  it('makes the chosen market, and says which', async () => {
    const success = spyOn(toast, 'success')
    view()
    fireEvent.change(marketSelect(), { target: { value: 'IN' } })
    await act(async () => {
      fireEvent.click(makeButton())
    })
    expect(actions.makeMarketAction).toHaveBeenCalledWith('p1', 7, 'IN')
    expect(success).toHaveBeenCalledWith('India version made · linked card on the board')
    success.mockRestore()
  })

  it('switches between the stored slides and the market version’s, with its feed excerpt, and offers no second version', () => {
    view({ current: { market: MARKET } })
    expect(screen.queryByRole('button', { name: 'Make market version' })).toBeNull()
    // One slide at a time on Settings (criterion 5): the second's thumbnail shows it.
    fireEvent.click(thumb(2))
    expect(slide(2)).toHaveAttribute('src', '/admin/assets/png2')
    fireEvent.click(screen.getByRole('radio', { name: 'Nepal' }))
    expect(currentThumb()).toEqual(['Slide 1'])
    fireEvent.click(thumb(2))
    expect(slide(2)).toHaveAttribute('src', '/admin/assets/npng2')
    expect(
      screen.getByText("Deciding with your family how many hours you'll work?"),
    ).toBeInTheDocument()
    expect(screen.getByText('Approved wording, money converted')).toBeInTheDocument()
    expect(actions.makeMarketAction).not.toHaveBeenCalled()
  })

  it('offers "Reword for <market>" once a version exists, until it is reworded', async () => {
    view({ current: { market: INDIA } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reword for India' }))
    })
    expect(actions.rewordMarketAction).toHaveBeenCalledWith('p1', 7)
    expect(replace).toHaveBeenCalledWith('/admin/posts/p1/settings?market=IN', { scroll: false })
    cleanup()

    view({ current: { market: { ...MARKET, body: { ...MARKET.body, reworded: true } } } })
    expect(screen.queryByRole('button', { name: /^Reword/ })).toBeNull()
  })

  it('shows a market version being made or reworded as "Running…"', () => {
    view({ current: { market: MARKET }, running: ['market'] })
    expect(screen.queryByRole('button', { name: 'Reword for Nepal' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Running…' })).toBeDisabled()
  })

  it('keeps "Running…" outlined like the button it stands in for, filling nothing', () => {
    view({ current: { market: MARKET }, running: ['market'] })
    expect(screen.getByRole('button', { name: 'Running…' })).toBeInTheDocument()
    expect(document.querySelectorAll('.bg-primary-strong')).toHaveLength(0)
    cleanup()
    view({ running: ['market'] })
    expect(screen.getByRole('button', { name: 'Running…' })).toBeInTheDocument()
    expect(document.querySelectorAll('.bg-primary-strong')).toHaveLength(0)
  })

  it('opens on the market version from the board link (87)', () => {
    searchParams = new URLSearchParams('market=NP')
    view({ current: { market: MARKET } })
    expect(screen.getByRole('radio', { name: 'Nepal' })).toBeChecked()
    expect(slide(1)).toHaveAttribute('src', '/admin/assets/npng1')
  })

  it('shows only the versions that exist past rendered or to a viewer who may not make one (61)', () => {
    view({ stage: 'in_review', current: { market: MARKET } })
    expect(screen.getByRole('radio', { name: 'Nepal' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'For market' })).toBeNull()
    expect(buttonNames()).toEqual(FILMSTRIP)
    cleanup()

    view({}, ADMIN)
    expect(screen.getByRole('radio', { name: 'Default' })).toBeInTheDocument()
    expect(buttonNames()).toEqual(FILMSTRIP)
  })

  it('shows a post from before the looks the same way', () => {
    const legacy = {
      revision: null,
      render: {
        id: 'ren1',
        body: {
          revisionId: 'rev1',
          layoutId: 'lay1',
          art: { assetId: 'art1', prompt: 'A desk.', version: 1, fallback: null },
          slides: [1, 2, 3].map((n) => ({ svgAssetId: `s${n}`, pngAssetId: `png${n}` })),
        },
      },
    }
    view({ current: legacy })
    expect(makeButton()).toBeEnabled()
    expect(screen.getByRole('radio', { name: 'Preview in context' })).toBeInTheDocument()
  })
})

describe('PostPreview: preview in context (55)', () => {
  it('shows the slides first, then the phone card with the whole source line and the settings summary', () => {
    view({ current: { settings: SETTINGS } })
    expect(screen.getByRole('radio', { name: 'Slides' })).toBeChecked()
    // One slide in view, the first of the three marked in the filmstrip (criterion 5).
    expect(screen.getAllByRole('img').length).toBe(1)
    expect(currentThumb()).toEqual(['Slide 1'])
    fireEvent.click(screen.getByRole('radio', { name: 'Preview in context' }))
    const card = screen.getByRole('img', { name: 'Cover of Paid work, money first' })
    expect(card).toHaveAttribute('src', '/admin/assets/png1')
    expect(screen.queryByRole('img', { name: /^Slide \d+\b/ })).toBeNull()
    expect(screen.getByText('For you')).toBeInTheDocument()
    expect(screen.getByText('You weighted work rights highly.')).toBeInTheDocument()
    expect(screen.getByText('Source: Paid work, money first · ¶1')).toBeInTheDocument()
    expect(screen.getByText('Personal · 1,284 matched students · No expiry')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Slides' }))
    expect(screen.getAllByRole('img').length).toBe(1)
  })

  it('says "No feed settings yet" before any are saved', () => {
    view()
    fireEvent.click(screen.getByRole('radio', { name: 'Preview in context' }))
    expect(screen.getByText('No feed settings yet')).toBeInTheDocument()
  })

  it('hides the view switch while the market version shows', () => {
    view({ current: { market: MARKET } })
    fireEvent.click(screen.getByRole('radio', { name: 'Nepal' }))
    expect(screen.queryByRole('radio', { name: 'Preview in context' })).toBeNull()
  })
})

describe('PostPreview: Download slides', () => {
  it('offers the rendered slides to download in the step bar (18 Oct)', () => {
    view()
    expect(
      screen
        .queryAllByRole('link', { name: 'Download slides' })
        .map((a) => `${a.getAttribute('href')} ${a.hasAttribute('download')} ${place(a)}`),
    ).toEqual(['/admin/posts/p1/slides true bar'])
  })
})
