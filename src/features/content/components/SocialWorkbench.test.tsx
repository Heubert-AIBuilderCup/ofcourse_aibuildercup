/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { Staff } from '@/shared/lib/auth/access'
import { type Body, emptyPointers } from '../model/artifacts'
import type { CurrentPost } from '../model/current'
import type { Saved } from '../server/commands'

const refresh = mock(() => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh }),
}))

const { SocialWorkbench } = await import('./SocialWorkbench')
type Props = Parameters<typeof SocialWorkbench>[0]

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

const LAYOUT: CurrentPost['layout'] = {
  id: 'lay1',
  body: {
    revisionId: 'rev1',
    slides: ['cover', 'body', 'take'].map((kind) => ({
      kind: kind as 'cover' | 'body' | 'take',
      lines: [],
      artBox: null,
      sourceLine: null,
      searchLine: null,
    })),
    fits: [],
    fitChecks: [],
  },
}

const RENDER: CurrentPost['render'] = {
  id: 'ren1',
  body: {
    revisionId: 'rev1',
    layoutId: 'lay1',
    art: { assetId: 'art1', prompt: 'A desk.', version: 1, fallback: null },
    slides: [
      { svgAssetId: 's1', pngAssetId: 'png1' },
      { svgAssetId: 's2', pngAssetId: 'png2' },
      { svgAssetId: 's3', pngAssetId: 'png3' },
    ],
  },
}

const TEXT = 'Students working up to 20 hours a week had similar grades.'
const caption = (over: Partial<Body<'caption'>> = {}): CurrentPost['caption'] => ({
  id: 'cap1',
  body: {
    renderId: 'ren1',
    platform: 'instagram',
    text: TEXT,
    hashtags: ['#studyabroad', '#internationalstudents'],
    approvedText: TEXT,
    approvedHashtags: ['#studyabroad', '#internationalstudents'],
    checked: true,
    notFound: [],
    ...over,
  },
})

const VIEW: Props['view'] = {
  id: 'sp1',
  title: 'Instagram · Cerebral',
  stage: 'structures',
  version: 3,
  pointers: { ...emptyPointers(), layoutId: 'lay1', revisionId: 'rev1' },
  current: { ...EMPTY, layout: LAYOUT },
  running: [],
  parentTitle: 'Paid work & grades',
  fileName: 'cerebral_paid-work-grades_instagram.zip',
  socialLink: null,
}

const saved = async (): Promise<Saved> => ({ ok: true, id: 'sp1', version: 4 })
const actions = {
  approveLayoutAction: mock(async (_id: unknown, _at: unknown) => saved()),
  renderSocialAction: mock(async (_id: unknown, _at: unknown) => saved()),
  editCaptionAction: mock(async (_id: unknown, _at: unknown, _text: unknown, _tags: unknown) =>
    saved(),
  ),
  checkCaptionAction: mock(async (_id: unknown, _at: unknown) => saved()),
  resetCaptionAction: mock(async (_id: unknown, _at: unknown) => saved()),
  markExportedAction: mock(async (_id: unknown, _at: unknown) => saved()),
  recordPostUrlAction: mock(async (_id: unknown, _at: unknown, _url: unknown) => saved()),
}

const EDITOR: Staff = { role: 'user', editor: true }
const REVIEWER: Staff = { role: 'user', reviewer: true }

const view = (over: Partial<Props['view']> = {}, viewer: Staff = EDITOR) =>
  render(
    <SocialWorkbench view={{ ...VIEW, ...over }} viewer={viewer} from="all" actions={actions} />,
  )

const READY = {
  stage: 'ready' as const,
  current: { ...EMPTY, layout: LAYOUT, render: RENDER },
}

afterEach(() => {
  cleanup()
  refresh.mockClear()
  for (const a of Object.values(actions)) a.mockClear()
})

describe('SocialWorkbench', () => {
  it('shows the facts locked to the feed post, and the layout before render (64)', () => {
    view()
    expect(screen.getByText('Facts locked · from feed post Paid work & grades')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Slide 1\b/ })).toHaveAttribute(
      'src',
      '/admin/posts/sp1/preview?layout=lay1&slide=1',
    )
    expect(screen.queryByRole('button', { name: 'Render' })).toBeNull()
  })

  it('quick-approves the layout, then renders', async () => {
    view()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Quick approve layout' }))
    })
    expect(actions.approveLayoutAction).toHaveBeenCalledWith('sp1', 3)
    cleanup()

    view({ stage: 'approved' })
    expect(screen.queryByRole('button', { name: 'Quick approve layout' })).toBeNull()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Render' }))
    })
    expect(actions.renderSocialAction).toHaveBeenCalledWith('sp1', 3)
  })

  it('shows the stored slides, the caption and its hashtags when ready, and exports', async () => {
    view({ ...READY, current: { ...READY.current, caption: caption() } })
    expect(screen.getByRole('img', { name: /^Slide 2\b/ })).toHaveAttribute(
      'src',
      '/admin/assets/png2',
    )
    expect(screen.getByLabelText('Caption')).toHaveValue(TEXT)
    expect(screen.getByLabelText('Hashtags')).toHaveValue('#studyabroad #internationalstudents')
    const exportButton = screen.getByRole('button', { name: 'Export' })
    expect(exportButton).toBeEnabled()
    await act(async () => {
      fireEvent.click(exportButton)
    })
    expect(actions.markExportedAction).toHaveBeenCalledWith('sp1', 3)
  })

  it('looks again while a step runs, so its result shows when it lands', () => {
    const ticks: (() => void)[] = []
    const realSetInterval = globalThis.setInterval
    globalThis.setInterval = ((tick: () => void) => {
      ticks.push(tick)
      return 0
    }) as unknown as typeof setInterval
    try {
      view({ ...READY, running: ['render'] })
    } finally {
      globalThis.setInterval = realSetInterval
    }
    expect(ticks).toHaveLength(1)
    ticks[0]()
    expect(refresh).toHaveBeenCalled()
  })

  it('shows no vision check, and exports once the caption is checked (103)', () => {
    view({ ...READY, current: { ...READY.current, caption: caption() } })
    expect(screen.queryByText(/vision check/i)).toBeNull()
    expect(screen.queryByText('Not checked')).toBeNull()
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled()
  })

  it('keeps Export disabled after an edit until the source check runs again (66)', async () => {
    view({
      ...READY,
      current: { ...READY.current, caption: caption({ text: 'Edited.', checked: false }) },
    })
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled()
    expect(
      screen.getByText('Run the source check on the new wording before exporting.'),
    ).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Run source check' }))
    })
    expect(actions.checkCaptionAction).toHaveBeenCalledWith('sp1', 3)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reset to approved wording' }))
    })
    expect(actions.resetCaptionAction).toHaveBeenCalledWith('sp1', 3)
  })

  it('disables Export while the caption has unsaved changes, and saves them', async () => {
    view({ ...READY, current: { ...READY.current, caption: caption() } })
    fireEvent.change(screen.getByLabelText('Caption'), { target: { value: 'New words.' } })
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save caption' }))
    })
    expect(actions.editCaptionAction).toHaveBeenCalledWith('sp1', 3, 'New words.', [
      '#studyabroad',
      '#internationalstudents',
    ])
  })

  it('lists the sentences the source check could not find', () => {
    view({
      ...READY,
      current: {
        ...READY.current,
        caption: caption({ text: 'Edited.', checked: false, notFound: ['Edited.'] }),
      },
    })
    expect(screen.getByText('Not found in the source')).toBeInTheDocument()
    expect(screen.getByText('Edited.', { selector: 'li' })).toBeInTheDocument()
  })

  it('offers a reviewer no controls', () => {
    view({ ...READY, current: { ...READY.current, caption: caption() } }, REVIEWER)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByLabelText('Caption')).toHaveAttribute('readonly')
  })

  const exported: CurrentPost['export'] = {
    id: 'exp1',
    body: {
      renderId: 'ren1',
      captionId: 'cap1',
      fileName: 'cerebral_paid-work-grades_instagram.zip',
      by: { userId: 'u1', name: 'Ed', at: '2026-10-06T09:00:00.000Z' },
    },
  }
  const EXPORTED = {
    stage: 'exported' as const,
    pointers: {
      ...VIEW.pointers,
      social: { brandId: 'cerebral', platform: 'instagram' as const },
    },
    current: { ...READY.current, caption: caption(), export: exported },
  }

  it('links the download once exported', () => {
    view(EXPORTED)
    expect(
      screen.getByRole('link', { name: 'Download cerebral_paid-work-grades_instagram.zip' }),
    ).toHaveAttribute('href', '/admin/posts/sp1/export')
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull()
  })

  it('takes the post’s Instagram link once exported, from an editor only (89)', async () => {
    view(EXPORTED)
    expect(screen.queryByText(/^Posted:/)).toBeNull()
    fireEvent.change(screen.getByLabelText('Instagram link'), {
      target: { value: 'https://www.instagram.com/p/C-abc123/' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save link' }))
    })
    expect(actions.recordPostUrlAction).toHaveBeenCalledWith(
      'sp1',
      3,
      'https://www.instagram.com/p/C-abc123/',
    )
    cleanup()

    view(EXPORTED, REVIEWER)
    expect(screen.queryByLabelText('Instagram link')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save link' })).toBeNull()
  })

  it('offers no link field before export, or on a LinkedIn version', () => {
    view({ ...READY, current: { ...READY.current, caption: caption() } })
    expect(screen.queryByLabelText('Instagram link')).toBeNull()
    cleanup()

    view({
      ...EXPORTED,
      pointers: { ...EXPORTED.pointers, social: { brandId: 'cerebral', platform: 'linkedin' } },
      current: { ...EXPORTED.current, caption: caption({ platform: 'linkedin', hashtags: [] }) },
    })
    expect(screen.queryByLabelText('Instagram link')).toBeNull()
  })

  it('shows the recorded link and who added it (89)', () => {
    view({
      ...EXPORTED,
      socialLink: {
        url: 'https://www.instagram.com/p/C-abc123/',
        by: { userId: 'u1', name: 'Ed', at: '2026-10-07T09:00:00.000Z' },
      },
    })
    expect(screen.getByText(/^Posted:/)).toHaveTextContent(
      'Posted: https://www.instagram.com/p/C-abc123/ · by Ed',
    )
    expect(
      screen.getByRole('link', { name: 'https://www.instagram.com/p/C-abc123/' }),
    ).toHaveAttribute('href', 'https://www.instagram.com/p/C-abc123/')
  })
})
