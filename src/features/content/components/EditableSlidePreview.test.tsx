/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { FitCheck } from '../model/types'
import { EditableSlidePreview } from './EditableSlidePreview'

// Editing in place on a slide preview (criterion 98): a text field over the slot, saved by the
// caller. The picture itself is the server's, so nothing here asserts how it looks.

type Props = Parameters<typeof EditableSlidePreview>[0]

const BOX = { x: 96, y: 300, w: 888, h: 600 }
const SLOTS: Props['slots'] = [
  { key: 'heading', label: 'Heading', box: { ...BOX, y: 120, h: 120 }, text: 'Up to 20' },
  {
    key: 'body',
    label: 'Body',
    box: BOX,
    text: 'Students working up to 20 hours a week did fine.',
  },
]

const onSave = mock((_slot: string, _text: string) => {})

const view = (over: Partial<Props> = {}) =>
  render(
    <EditableSlidePreview
      slide={2}
      draft={{ postId: 'p1', draftsId: 'd1', index: 0, themeId: 'paper' }}
      slots={SLOTS}
      onSave={onSave}
      {...over}
    />,
  )

afterEach(() => {
  cleanup()
  onSave.mockClear()
})

describe('EditableSlidePreview', () => {
  it('opens a text field over the clicked slot with its text, and saves what the editor typed', () => {
    view()
    expect(screen.queryByRole('textbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Slide 2 · Body' }))
    const field = screen.getByRole('textbox', { name: 'Slide 2 · Body' })
    expect(field).toHaveValue(SLOTS[1].text)
    fireEvent.change(field, { target: { value: 'Most students who work keep their grades.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith('body', 'Most students who work keep their grades.')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('keeps the in-slide Save outlined: the step bar holds the screen’s filled action', () => {
    view()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Slide 2 · Body' }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(document.querySelectorAll('.bg-primary-strong')).toHaveLength(0)
  })

  it('saves nothing on Cancel, or when the text is unchanged', () => {
    view()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Slide 2 · Heading' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Changed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('textbox')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Slide 2 · Heading' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Up to 20 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves with Ctrl+Enter and closes with Escape', () => {
    view()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Slide 2 · Heading' }))
    const field = screen.getByRole('textbox')
    fireEvent.change(field, { target: { value: 'Under 20' } })
    fireEvent.keyDown(field, { key: 'Enter', ctrlKey: true })
    expect(onSave).toHaveBeenCalledWith('heading', 'Under 20')

    fireEvent.click(screen.getByRole('button', { name: 'Edit Slide 2 · Heading' }))
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('offers no editing while it cannot save', () => {
    view({ disabled: true })
    expect(screen.queryByRole('button', { name: /^Edit Slide/ })).toBeNull()
  })

  it("edits a planned scene over the art area, saved as 'scene' and never measured as text (GD12)", async () => {
    const measure = mock(async (_slot: string, _text: string) => [])
    view({
      measure,
      slots: [{ kind: 'scene', key: 'scene', label: 'Scene', box: BOX, text: 'A desk at dusk.' }],
    })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Slide 2 · Scene' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A cafe counter.' } })
    await new Promise((r) => setTimeout(r, 200))
    expect(measure).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith('scene', 'A cafe counter.')
  })
})

describe('fit rows as the editor types (98)', () => {
  const row = (value: number, pass: boolean): FitCheck => ({
    check: 'length',
    slide: 2,
    slot: 'body',
    value,
    limit: '30–70 words',
    pass,
    label: `Slide 2 · body · ${value} words (30–70) · ${pass ? 'OK' : 'Under'}`,
  })

  it('measures the slot once the typing pauses, with the last text only, and shows its rows before Save', async () => {
    const measure = mock(async (_slot: string, text: string) => [
      row(text.split(' ').length, false),
    ])
    view({ measure })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Slide 2 · Body' }))
    const field = screen.getByRole('textbox')
    for (const value of ['Most', 'Most students', 'Most students work']) {
      fireEvent.change(field, { target: { value } })
    }
    expect(measure).not.toHaveBeenCalled()

    const fit = await screen.findByRole('list', { name: 'Fit as typed' })
    expect(fit).toHaveTextContent('Slide 2 · body · 3 words (30–70) · Under')
    expect(fit).toHaveTextContent('Fail')
    expect(measure).toHaveBeenCalledTimes(1)
    expect(measure).toHaveBeenCalledWith('body', 'Most students work')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('drops an answer for text the slot no longer holds: closed and opened again, it shows none', async () => {
    let answer = (_rows: FitCheck[]) => {}
    const measure = mock(
      (_slot: string, _text: string) =>
        new Promise<FitCheck[] | null>((resolve) => {
          answer = resolve
        }),
    )
    view({ measure })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Slide 2 · Body' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Most students' } })
    await waitFor(() => expect(measure).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit Slide 2 · Body' }))
    answer([row(2, false)])
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByRole('list', { name: 'Fit as typed' })).toBeNull()
  })
})
