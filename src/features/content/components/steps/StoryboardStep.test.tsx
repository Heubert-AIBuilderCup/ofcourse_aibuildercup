/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { Staff } from '@/shared/lib/auth/access'
import { type Body, emptyPointers } from '../../model/artifacts'
import type { CurrentPost } from '../../model/current'
import type { Fact, Slide } from '../../model/types'
import type { Saved } from '../../server/commands'
import { templateById } from '../../templates'

mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}))

const { StoryboardStep } = await import('./StoryboardStep')
type Props = Parameters<typeof StoryboardStep>[0]

// The comic storyboard (RC2, RC3): each panel edited in place, its caption and its planned scene,
// and added, removed or moved within 3 to 6. The pictures are the server's; nothing here asserts
// how they look.

const comic = templateById('comic')
if (!comic) throw new Error('comic template missing')

const FACTS: Fact[] = [
  {
    id: 'f1',
    text: 'Tuition about AUD 33k a year in 2027.',
    value: { number: 33000, unit: 'AUD' },
    ref: '¶1',
    quote: null,
    supported: true,
    why: null,
    span: null,
  },
]

const panel = (caption: string, scene: string, i: number): Slide => ({
  kind: i === 0 ? 'cover' : 'body',
  slots: { caption: { text: caption, factIds: [], factual: false } },
  scene,
})
const WHEN = ['morning', 'noon', 'afternoon', 'evening', 'night', 'weekend']
const panels = (n: number) =>
  WHEN.slice(0, n).map((w, i) => panel(`Life in the ${w}.`, `A street in the ${w}.`, i))

const drafts = (slides: Slide[]): Body<'drafts'> => ({
  factsId: 'facts1',
  attempt: 1,
  replays: [],
  emotion: null,
  note: 'Storyboard drafted',
  items: [
    {
      template: comic,
      angle: 'Story',
      structure: { templateId: 'comic', artPrompt: 'A street.', slides },
    },
  ],
})

const current = (slides: Slide[] | null): CurrentPost => ({
  source: null,
  facts: { id: 'facts1', body: { sourceId: 'src1', keyIdeas: [], facts: FACTS, replays: [] } },
  drafts: slides ? { id: 'd1', body: drafts(slides) } : null,
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
})

const VIEW: Props['view'] = {
  id: 'p1',
  title: 'Life on this path',
  stage: 'structures',
  version: 4,
  courseId: 'ecu-cyber',
  pointers: {
    ...emptyPointers(),
    factsId: 'facts1',
    draftsId: 'd1',
    ticked: ['comic'],
    picked: 0,
    themeId: 'pop',
  },
  current: current(panels(4)),
  createdAt: '2026-10-05T09:12:00.000Z',
  running: [],
  draftChecks: [[]],
}

const ok = async (): Promise<Saved> => ({ ok: true, id: 'p1', version: 5 })
const actions = {
  editSlotAction: mock(async (_id: unknown, _at: unknown, _edit: unknown): Promise<Saved> => ok()),
  measureSlotAction: mock(async (_id: unknown, _at: unknown, _edit: unknown) => ({
    ok: true as const,
    rows: [],
  })),
  approveStructureAction: mock(async (_id: unknown, _at: unknown) => ok()),
  editSceneAction: mock(async (_id: unknown, _at: unknown, _input: unknown) => ok()),
  editPanelsAction: mock(async (_id: unknown, _at: unknown, _op: unknown) => ok()),
  retryStoryAction: mock(async (_id: unknown, _at: unknown) => ok()),
}

const EDITOR: Staff = { role: 'user', editor: true }

const view = (over: Partial<Props['view']> = {}) =>
  render(<StoryboardStep view={{ ...VIEW, ...over }} viewer={EDITOR} actions={actions} />)
const withPanels = (n: number) => view({ current: current(panels(n)) })
/** The film strip and the selected panel large (GD30). */
const slidesArea = () => screen.getByRole('region', { name: 'Slides' })
/** The selected panel's fields and controls, beside the film strip. */
const actionsArea = () => screen.getByRole('region', { name: 'Actions' })
const panelArea = (n: number) => within(actionsArea()).getByRole('article', { name: `Panel ${n}` })
/** Shows panel `n` large, from the film strip, with its fields and controls in the actions area. */
const select = (n: number) =>
  fireEvent.click(within(slidesArea()).getByRole('button', { name: new RegExp(`^Slide ${n} · `) }))
const press = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}
/** Opens a slot over panel `slide`, shown large, types `text` and saves it. */
const edit = async (slide: number, label: string, text: string) => {
  select(slide)
  fireEvent.click(screen.getByRole('button', { name: `Edit Slide ${slide} · ${label}` }))
  fireEvent.change(screen.getByRole('textbox', { name: `Slide ${slide} · ${label}` }), {
    target: { value: text },
  })
  await press('Save')
}

afterEach(() => {
  cleanup()
  for (const action of Object.values(actions)) action.mockClear()
})

describe('StoryboardStep', () => {
  it('shows the panels as a film strip in the slides area, the first one selected (D1)', () => {
    view()
    const strip = within(slidesArea()).getByRole('list', { name: 'Slides' })
    const thumbs = within(strip).getAllByRole('button')
    expect(thumbs).toHaveLength(4)
    expect(thumbs[0]).toHaveAttribute('aria-pressed', 'true')
    expect(within(slidesArea()).queryByRole('textbox')).toBeNull()
  })

  it("shows the selected panel's fields and controls in the actions area, and only its (D1)", () => {
    view()
    select(3)
    const panel = panelArea(3)
    expect(within(panel).getByRole('textbox', { name: 'Caption' })).toHaveValue(
      'Life in the afternoon.',
    )
    expect(within(panel).getByRole('textbox', { name: 'Planned scene' })).toHaveValue(
      'A street in the afternoon.',
    )
    expect(within(panel).getByRole('button', { name: 'Move panel 3 up' })).toBeEnabled()
    expect(within(panel).getByRole('button', { name: 'Move panel 3 down' })).toBeEnabled()
    expect(within(panel).getByRole('button', { name: 'Remove panel 3' })).toBeEnabled()
    expect(within(panel).getByRole('button', { name: 'Add after panel 3' })).toBeEnabled()
    expect(within(actionsArea()).queryByRole('article', { name: 'Panel 2' })).toBeNull()
  })

  it('selects a moved panel where it went, and an added one (D1)', async () => {
    view()
    select(2)
    await press('Move panel 2 up')
    expect(panelArea(1)).toBeInTheDocument()
    await press('Add after panel 1')
    expect(panelArea(2)).toBeInTheDocument()
  })

  it('disables "Remove" at 3 panels and "Add after" at 6, saying why', () => {
    withPanels(3)
    expect(screen.getByRole('button', { name: 'Remove panel 1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add after panel 1' })).toBeEnabled()
    expect(screen.getByText('A comic has at least 3 panels.')).toBeInTheDocument()
    cleanup()

    withPanels(6)
    select(4)
    expect(screen.getByRole('button', { name: 'Add after panel 4' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove panel 4' })).toBeEnabled()
    expect(screen.getByText('A comic has at most 6 panels.')).toBeInTheDocument()
  })

  it('adds, removes and moves a panel by its place, never before the first or after the last', async () => {
    withPanels(4)
    expect(screen.getByRole('button', { name: 'Move panel 1 up' })).toBeDisabled()
    select(4)
    expect(screen.getByRole('button', { name: 'Move panel 4 down' })).toBeDisabled()
    select(2)
    await press('Move panel 2 up')
    expect(actions.editPanelsAction).toHaveBeenLastCalledWith('p1', 4, {
      kind: 'move',
      at: 1,
      to: 0,
    })
    select(2)
    await press('Move panel 2 down')
    expect(actions.editPanelsAction).toHaveBeenLastCalledWith('p1', 4, {
      kind: 'move',
      at: 1,
      to: 2,
    })
    select(2)
    await press('Add after panel 2')
    expect(actions.editPanelsAction).toHaveBeenLastCalledWith('p1', 4, { kind: 'add', after: 1 })
    select(3)
    await press('Remove panel 3')
    expect(actions.editPanelsAction).toHaveBeenLastCalledWith('p1', 4, { kind: 'remove', at: 2 })
  })

  it('saves the planned scene edited in the art area as a scene edit, and the caption as a slot edit', async () => {
    view()
    select(2)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Slide 2 · Planned scene' }))
    expect(screen.getByRole('textbox', { name: 'Slide 2 · Planned scene' })).toHaveValue(
      'A street in the noon.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await edit(2, 'Planned scene', 'A ferry at dawn.')
    expect(actions.editSceneAction).toHaveBeenCalledWith('p1', 4, {
      slide: 2,
      text: 'A ferry at dawn.',
    })
    expect(actions.editSlotAction).not.toHaveBeenCalled()

    await edit(3, 'Caption', 'A late bus home.')
    expect(actions.editSlotAction).toHaveBeenCalledWith('p1', 4, {
      slide: 3,
      slot: 'caption',
      text: 'A late bus home.',
    })
  })

  it('shows a refusal with the panel it was for, and the approve refusal with the panel it names', async () => {
    const slides = panels(4)
    slides[3] = { ...slides[3], scene: '' }
    view({ current: current(slides) })
    select(4)
    expect(within(panelArea(4)).getByText('Plan the scene for panel 4.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve storyboard' })).toBeDisabled()

    const refusal = 'Remove "guaranteed": a comic never promises an outcome.'
    actions.editSlotAction.mockImplementationOnce(async () => ({ ok: false, error: refusal }))
    await edit(2, 'Caption', 'A job is guaranteed.')
    expect(within(panelArea(2)).getByText(refusal)).toBeInTheDocument()
    select(3)
    expect(within(panelArea(3)).queryByText(refusal)).toBeNull()
  })

  it("edits a panel's planned scene and caption in fields beside it, counted as typed, a refusal under its field (C1)", async () => {
    view()
    select(2)
    const scene = within(panelArea(2)).getByRole('textbox', { name: 'Planned scene' })
    expect(scene).toHaveValue('A street in the noon.')
    expect(scene).toHaveAccessibleDescription('21 of 1–300 characters')
    fireEvent.change(scene, { target: { value: 'A ferry at dawn.' } })
    await act(async () => {
      fireEvent.blur(scene)
    })
    expect(actions.editSceneAction).toHaveBeenCalledWith('p1', 4, {
      slide: 2,
      text: 'A ferry at dawn.',
    })

    const refusal = 'Remove "guaranteed": a comic never promises an outcome.'
    actions.editSlotAction.mockImplementationOnce(async () => ({ ok: false, error: refusal }))
    select(3)
    const caption = within(panelArea(3)).getByRole('textbox', { name: 'Caption' })
    fireEvent.change(caption, { target: { value: 'A job is guaranteed.' } })
    expect(caption).toHaveAccessibleDescription('20 of 1–140 characters')
    await act(async () => {
      fireEvent.blur(caption)
    })
    expect(actions.editSlotAction).toHaveBeenCalledWith('p1', 4, {
      slide: 3,
      slot: 'caption',
      text: 'A job is guaranteed.',
    })
    expect(caption).toHaveAccessibleDescription(/a comic never promises an outcome/)
    expect(within(panelArea(3)).getAllByText(refusal)).toHaveLength(1)
  })

  it('approves a storyboard that passes, from the step actions bar', async () => {
    view()
    expect(
      within(screen.getByRole('region', { name: 'Step actions' })).getByRole('button', {
        name: 'Approve storyboard',
      }),
    ).toBeInTheDocument()
    await press('Approve storyboard')
    expect(actions.approveStructureAction).toHaveBeenCalledWith('p1', 4)
  })

  it('offers "Try again" on a story that failed, which writes the story again', async () => {
    view({
      current: current(null),
      pointers: { ...VIEW.pointers, draftsId: null, picked: null, ticked: [], themeId: null },
      failed: ['draft'],
    })
    await press('Try again')
    expect(actions.retryStoryAction).toHaveBeenCalledWith('p1', 4)
  })

  it('says the story is being written while it runs', () => {
    view({ current: current(null), running: ['draft'] })
    expect(screen.getByRole('status')).toHaveTextContent('The story is being written')
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })
})
