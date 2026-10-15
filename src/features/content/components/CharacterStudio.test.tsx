/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { Staff } from '@/shared/lib/auth/access'
import type { Character } from '../server/character'

const refresh = mock(() => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh }),
}))

const { CharacterStudio } = await import('./CharacterStudio')

const okay = async (_input?: unknown) => ({ ok: true as const })
const actions = {
  planCharacterAction: mock(okay),
  editCharacterViewAction: mock(okay),
  drawCharacterAction: mock(okay),
  approveCharacterAction: mock(async () => ({ ok: true as const })),
}

const PLANNED: Character = {
  description: 'A student with round glasses',
  views: [
    { label: 'Front', scene: 'Standing facing us, a grey hoodie.' },
    { label: 'Side', scene: 'In profile, walking left.' },
    { label: 'Back', scene: 'Seen from behind.' },
    { label: 'Smiling', scene: 'A wide smile.' },
  ],
  sheetAssetId: null,
  sheetNote: null,
  approvedAssetId: null,
  approvedBy: null,
  approvedAt: null,
}
const DRAWN: Character = {
  ...PLANNED,
  sheetAssetId: 'sheet-2',
  approvedAssetId: 'sheet-1',
  approvedBy: 'u1',
  approvedAt: '2026-10-14T09:00:00.000Z',
}

const EDITOR: Staff = { role: 'user', editor: true }
const REVIEWER: Staff = { role: 'user', reviewer: true }
const ADMIN: Staff = { role: 'admin' }

const view = (viewer: Staff, character: Character | null) =>
  render(<CharacterStudio viewer={viewer} character={character} actions={actions} />)

afterEach(() => {
  cleanup()
  refresh.mockClear()
  for (const a of Object.values(actions)) a.mockClear()
})

describe('CharacterStudio (RC9)', () => {
  it('shows reviewers and admins the character, its sheet and the approved one, with no control', () => {
    for (const viewer of [REVIEWER, ADMIN]) {
      view(viewer, DRAWN)
      expect(screen.queryAllByRole('button')).toHaveLength(0)
      expect(screen.queryAllByRole('textbox')).toHaveLength(0)
      expect(screen.getByText(PLANNED.views[1].scene)).toBeInTheDocument()
      expect(screen.getByRole('img', { name: 'The drawn sheet' })).toHaveAttribute(
        'src',
        '/admin/assets/sheet-2',
      )
      expect(screen.getByRole('img', { name: 'The approved sheet' })).toHaveAttribute(
        'src',
        '/admin/assets/sheet-1',
      )
      cleanup()
    }
  })

  it('plans the sheet from the default description when there is no character yet', async () => {
    view(EDITOR, null)
    expect(screen.getByRole('button', { name: 'Approve this character' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Draw the sheet' })).toBeDisabled()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Plan the sheet' }))
    })
    expect(actions.planCharacterAction).toHaveBeenCalledWith({
      description: 'A gender-neutral student in their early twenties, casual clothes',
    })
    expect(refresh).toHaveBeenCalled()
  })

  it('keeps "Approve this character" disabled until a sheet is drawn, and the drawn one once approved', () => {
    view(EDITOR, PLANNED)
    expect(screen.getByRole('button', { name: 'Approve this character' })).toBeDisabled()
    cleanup()
    view(EDITOR, DRAWN)
    expect(screen.getByRole('button', { name: 'Approve this character' })).toBeEnabled()
    cleanup()
    view(EDITOR, { ...DRAWN, approvedAssetId: 'sheet-2' })
    expect(screen.getByRole('button', { name: 'Approve this character' })).toBeDisabled()
  })

  it('fills only the next action: plan, then draw, then approve, then none', () => {
    const filled = () =>
      [...document.querySelectorAll('.bg-primary-strong')].map((b) => b.textContent)
    view(EDITOR, null)
    expect(filled()).toEqual(['Plan the sheet'])
    cleanup()
    view(EDITOR, PLANNED)
    expect(filled()).toEqual(['Draw the sheet'])
    cleanup()
    view(EDITOR, DRAWN)
    expect(filled()).toEqual(['Approve this character'])
    cleanup()
    view(EDITOR, { ...DRAWN, approvedAssetId: 'sheet-2' })
    expect(filled()).toEqual([])
  })

  it('saves a view as edited on its card', async () => {
    view(EDITOR, PLANNED)
    const card = within(screen.getByRole('article', { name: 'View 2' }))
    fireEvent.change(card.getByLabelText('Label'), { target: { value: 'Walking' } })
    fireEvent.change(card.getByLabelText('Scene'), { target: { value: 'Mid stride.' } })
    await act(async () => {
      fireEvent.click(card.getByRole('button', { name: 'Save view' }))
    })
    expect(actions.editCharacterViewAction).toHaveBeenCalledWith({
      index: 1,
      label: 'Walking',
      scene: 'Mid stride.',
    })
  })

  it('draws without a note, and redraws with the note once one is written', async () => {
    view(EDITOR, DRAWN)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Draw the sheet' }))
    })
    expect(actions.drawCharacterAction).toHaveBeenLastCalledWith({ note: null })
    const redraw = screen.getByRole('button', { name: 'Redraw with a note' })
    expect(redraw).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Make the hoodie blue' } })
    await act(async () => {
      fireEvent.click(redraw)
    })
    expect(actions.drawCharacterAction).toHaveBeenLastCalledWith({ note: 'Make the hoodie blue' })
  })

  it("shows the server's refusal", async () => {
    actions.approveCharacterAction.mockImplementationOnce(
      async () => ({ ok: false, error: 'Draw the character first.' }) as never,
    )
    view(EDITOR, DRAWN)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Approve this character' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Draw the character first.')
  })
})
