/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { Staff } from '@/shared/lib/auth/access'
import type { PageStyle } from '../server/page-style'

const refresh = mock(() => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh }),
}))

const { PageStyles } = await import('./PageStyles')
type Props = Parameters<typeof PageStyles>[0]

const FIELDS = {
  artStyle: 'Clean ink line on a pale ground.',
  copyStyle: 'Short plain sentences.',
  closestTemplateId: 'data-desk',
}
let uploaded = 0
const actions = {
  uploadReferenceAction: mock(async (_data: unknown) => ({
    ok: true as const,
    assetId: `asset-${++uploaded}`,
  })),
  describePageStyleAction: mock(async (_brand: unknown, _ids: unknown) => ({
    ok: true as const,
    fields: FIELDS,
  })),
  savePageStyleAction: mock(async (_input: unknown) => ({ ok: true as const })),
}

const SAVED: PageStyle = {
  brandId: 'cerebral',
  artStyle: 'Charcoal sketches, close crops.',
  copyStyle: 'One question per slide.',
  closestTemplateId: 'the-line',
  referenceAssetIds: ['asset-old'],
  updatedAt: '2026-10-09T09:00:00.000Z',
  updatedByName: 'Ed',
}

const EDITOR: Staff = { role: 'user', editor: true }
const REVIEWER: Staff = { role: 'user', reviewer: true }

const view = (viewer: Staff = EDITOR, styles: Props['styles'] = {}) =>
  render(<PageStyles viewer={viewer} styles={styles} actions={actions} />)

const card = (name: string) => {
  const heading = screen.getByRole('heading', { name })
  const section = heading.closest('section')
  if (!section) throw new Error('no card')
  return within(section)
}

const png = (name: string) => new File([new Uint8Array([0x89, 0x50])], name, { type: 'image/png' })

afterEach(() => {
  cleanup()
  uploaded = 0
  refresh.mockClear()
  for (const a of Object.values(actions)) a.mockClear()
})

describe('PageStyles (105)', () => {
  it('uploads two images, describes the style, and saves the fields as edited', async () => {
    view()
    const main = card('Main')
    expect(main.getByText('No design language yet')).toBeInTheDocument()
    await act(async () => {
      fireEvent.change(main.getByLabelText('Reference images'), {
        target: { files: [png('a.png'), png('b.png')] },
      })
    })
    expect(actions.uploadReferenceAction).toHaveBeenCalledTimes(2)
    const sent = actions.uploadReferenceAction.mock.calls[0][0] as FormData
    expect(sent.get('brandId')).toBe('main')
    expect((sent.get('file') as File).name).toBe('a.png')

    await act(async () => {
      fireEvent.click(main.getByRole('button', { name: 'Describe the style' }))
    })
    expect(actions.describePageStyleAction).toHaveBeenCalledWith('main', ['asset-1', 'asset-2'])
    expect(main.getByLabelText('Art style')).toHaveValue(FIELDS.artStyle)
    expect(main.getByLabelText('Copy style')).toHaveValue(FIELDS.copyStyle)
    expect(main.getByLabelText('Closest template')).toHaveValue('data-desk')

    fireEvent.change(main.getByLabelText('Art style'), { target: { value: 'Soft pencil.' } })
    await act(async () => {
      fireEvent.click(main.getByRole('button', { name: 'Save' }))
    })
    expect(actions.savePageStyleAction).toHaveBeenCalledWith({
      brandId: 'main',
      artStyle: 'Soft pencil.',
      copyStyle: FIELDS.copyStyle,
      closestTemplateId: 'data-desk',
      referenceAssetIds: ['asset-1', 'asset-2'],
    })
    expect(refresh).toHaveBeenCalled()
  })

  it('refuses a third image before any upload', async () => {
    view()
    const main = card('Main')
    await act(async () => {
      fireEvent.change(main.getByLabelText('Reference images'), {
        target: { files: [png('a.png'), png('b.png'), png('c.png')] },
      })
    })
    expect(actions.uploadReferenceAction).not.toHaveBeenCalled()
    expect(main.getByRole('alert')).toHaveTextContent('Upload one or two images.')
  })

  it("shows the server's refusal of an image and keeps the page's saved images", async () => {
    actions.uploadReferenceAction.mockImplementationOnce(
      async () => ({ ok: false, error: 'Upload PNG or JPEG images only.' }) as never,
    )
    view(EDITOR, { cerebral: SAVED })
    const cerebral = card('Cerebral')
    await act(async () => {
      fireEvent.change(cerebral.getByLabelText('Reference images'), {
        target: { files: [png('a.gif')] },
      })
    })
    expect(cerebral.getByRole('alert')).toHaveTextContent('Upload PNG or JPEG images only.')
    await act(async () => {
      fireEvent.click(cerebral.getByRole('button', { name: 'Save' }))
    })
    expect(actions.savePageStyleAction).toHaveBeenCalledWith({
      brandId: 'cerebral',
      artStyle: SAVED.artStyle,
      copyStyle: SAVED.copyStyle,
      closestTemplateId: 'the-line',
      referenceAssetIds: ['asset-old'],
    })
  })

  it('shows a reviewer the saved design language with no control', () => {
    view(REVIEWER, { cerebral: SAVED })
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryByLabelText('Reference images')).toBeNull()
    const cerebral = card('Cerebral')
    expect(cerebral.getByText(SAVED.artStyle)).toBeInTheDocument()
    expect(cerebral.getByText(SAVED.copyStyle)).toBeInTheDocument()
    expect(card('Main').getByText('No design language yet')).toBeInTheDocument()
  })
})
