/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterAll, afterEach, beforeAll, describe, expect, it, mock, spyOn } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { ActionResult } from '@/shared/types/action-result'
import type { RoadmapSummary } from '../model/roadmap'

const ok = async (): Promise<ActionResult> => ({ ok: true })
const renameRoadmapAction = mock(async (_id: string, _name: string) => ok())
const deleteRoadmapAction = mock(async (_id: string) => ok())
const restoreRoadmapAction = mock(async (_id: string) => ok())
const startFromScratchAction = mock(ok)

const replace = mock((_: string) => {})
const push = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace, refresh: () => {}, back: () => {}, prefetch: () => {} }),
}))

const { RoadmapsPage } = await import('./RoadmapsPage')

// next/image resolves its src against the page's URL in development; happy-dom starts on
// about:blank, which cannot be a base.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => dom.setURL('http://localhost:3000/roadmaps'))
afterAll(() => dom.setURL(startUrl))

afterEach(() => {
  cleanup()
  for (const action of [
    renameRoadmapAction,
    deleteRoadmapAction,
    restoreRoadmapAction,
    startFromScratchAction,
  ]) {
    action.mockClear()
  }
  replace.mockClear()
  push.mockClear()
})

const card = (over: Partial<RoadmapSummary>): RoadmapSummary => ({
  id: 'perth',
  name: 'Cyber Security in Perth',
  line: 'Master’s · ECU · Perth',
  pointB: 'Permanent residency · 2032',
  place: 'Australia · Perth',
  from: 'From onboarding',
  diffs: [],
  openedLabel: 'Opened today',
  isNew: false,
  thumb: { here: 3, alt: false },
  ...over,
})

const THREE = [
  card({}),
  card({
    id: 'budget',
    name: 'On a AUD 30k budget',
    from: 'Copy of Cyber Security in Perth',
    diffs: ['Budget: AUD 30k'],
    openedLabel: 'Opened yesterday',
  }),
  card({
    id: 'ds',
    name: 'Data Science instead',
    from: 'Copy of Cyber Security in Perth',
    diffs: ['Course: Data Science', 'English test: IELTS 7.5 or more'],
    openedLabel: 'Opened 3 days ago',
    thumb: { here: 3, alt: true },
  }),
]

const FIRST_LEAD =
  'Your first roadmap is ready. Open it to explore, or make another with different answers.'
const LEAD =
  'Each roadmap is one set of answers and the road it draws. Copy one and change a few answers to see another way.'

function show(roadmaps: RoadmapSummary[] = THREE, madeId: string | null = null) {
  render(
    <RoadmapsPage
      roadmaps={roadmaps}
      madeId={madeId}
      renameRoadmapAction={renameRoadmapAction}
      deleteRoadmapAction={deleteRoadmapAction}
      restoreRoadmapAction={restoreRoadmapAction}
      startFromScratchAction={startFromScratchAction}
    />,
  )
}

const list = () => screen.getByRole('list', { name: 'Your roadmaps, last opened first' })
const cardNames = () =>
  within(list())
    .getAllByRole('link')
    .map((a) => a.getAttribute('aria-label') ?? a.textContent)
const more = (name: string) => screen.getByRole('button', { name: `More for ${name}` })
const click = (el: HTMLElement) =>
  act(async () => {
    fireEvent.click(el)
  })
const key = (el: HTMLElement, k: string) =>
  act(async () => {
    fireEvent.keyDown(el, { key: k })
  })
const openMenu = (name: string) => click(more(name))
/** Radix gives focus back a tick after a dialog closes. */
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const item = (name: string) => screen.getByRole('menuitem', { name })

describe('the list', () => {
  it('shows one card per roadmap in the order given, each opening its board', () => {
    show()
    const links = within(list()).getAllByRole('link')
    expect(links).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Cyber Security in Perth' })).toHaveAttribute(
      'href',
      '/roadmaps/perth',
    )
    expect(screen.getByRole('link', { name: 'On a AUD 30k budget' })).toHaveAttribute(
      'href',
      '/roadmaps/budget',
    )
    expect(screen.getByRole('link', { name: 'Data Science instead' })).toHaveAttribute(
      'href',
      '/roadmaps/ds',
    )
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/roadmaps/perth',
      '/roadmaps/budget',
      '/roadmaps/ds',
    ])
  })

  it('reads the first-visit lead with one roadmap she has never opened', () => {
    show([card({ isNew: true, openedLabel: 'Made just now' })])
    expect(screen.getByText(FIRST_LEAD)).toBeInTheDocument()
    expect(screen.queryByText(LEAD)).not.toBeInTheDocument()
  })

  it('reads the default lead with one roadmap she has opened, and with several', () => {
    show([card({})])
    expect(screen.getByText(LEAD)).toBeInTheDocument()
    cleanup()
    show([card({ isNew: true }), card({ id: 'b', name: 'B' })])
    expect(screen.getByText(LEAD)).toBeInTheDocument()
    expect(screen.queryByText(FIRST_LEAD)).not.toBeInTheDocument()
  })

  it('tags a never-opened roadmap New, and only that one', () => {
    show([card({ id: 'a', name: 'A', isNew: true }), card({ id: 'b', name: 'B' })])
    const items = within(list()).getAllByRole('listitem')
    expect(within(items[0]).getByText('New')).toBeInTheDocument()
    expect(within(items[1]).queryByText('New')).not.toBeInTheDocument()
  })

  it('shows one chip per answer that differs from its source, and no list when none differ', () => {
    show()
    const chipLists = screen.getAllByRole('list', {
      name: 'Different from the roadmap it was copied from',
    })
    expect(chipLists).toHaveLength(2)
    expect(
      within(chipLists[0])
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Budget: AUD 30k'])
    expect(
      within(chipLists[1])
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Course: Data Science', 'English test: IELTS 7.5 or more'])
  })
})

describe('the … menu', () => {
  it('offers Open, Copy and change answers, Rename and Delete', async () => {
    show()
    const button = more('On a AUD 30k budget')
    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await openMenu('On a AUD 30k budget')
    expect(button).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu')
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((m) => m.textContent),
    ).toEqual(['Open', 'Copy and change answers', 'Rename', 'Delete'])
    expect(item('Open')).toHaveAttribute('href', '/roadmaps/budget')
    expect(item('Copy and change answers')).toHaveAttribute('href', '/roadmaps/new?from=budget')
    // Opening focuses the first item.
    expect(item('Open')).toHaveFocus()
  })

  it('has no Delete when she has only one roadmap', async () => {
    show([card({})])
    await openMenu('Cyber Security in Perth')
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
    expect(item('Rename')).toBeInTheDocument()
  })

  it('closes on Escape and gives focus back to its … button', async () => {
    show()
    await openMenu('Data Science instead')
    await key(screen.getByRole('menu'), 'Escape')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(more('Data Science instead')).toHaveFocus()
    expect(more('Data Science instead')).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('Rename', () => {
  const openRename = async (name: string) => {
    await openMenu(name)
    await click(item('Rename'))
    return screen.getByRole('dialog', { name: 'Rename roadmap' })
  }

  it('opens with her name in a field of at most 60 characters', async () => {
    show()
    const dialog = await openRename('On a AUD 30k budget')
    const field = within(dialog).getByRole('textbox', { name: 'Name' })
    expect(field).toHaveValue('On a AUD 30k budget')
    expect(field).toHaveAttribute('maxLength', '60')
  })

  it('saves the new name and shows it on the card', async () => {
    show()
    const dialog = await openRename('On a AUD 30k budget')
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Cheaper Perth' },
    })
    await click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(renameRoadmapAction).toHaveBeenCalledWith('budget', 'Cheaper Perth')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(cardNames()).toEqual([
      'Cyber Security in Perth',
      'Cheaper Perth',
      'Data Science instead',
    ])
  })

  it('keeps the dialog and says why when the save is refused', async () => {
    renameRoadmapAction.mockImplementationOnce(async () => ({
      ok: false,
      error: 'A name has 1 to 60 characters.',
    }))
    show()
    const dialog = await openRename('On a AUD 30k budget')
    await click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('A name has 1 to 60 characters.')
    await click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(cardNames()).toContain('On a AUD 30k budget')
  })

  it('closes on Cancel without saving, focus back on the … button', async () => {
    show()
    const dialog = await openRename('On a AUD 30k budget')
    await click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(renameRoadmapAction).not.toHaveBeenCalled()
    await tick()
    expect(more('On a AUD 30k budget')).toHaveFocus()
  })

  it('closes on Escape without saving', async () => {
    show()
    const dialog = await openRename('On a AUD 30k budget')
    await key(dialog, 'Escape')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(renameRoadmapAction).not.toHaveBeenCalled()
  })
})

describe('Delete', () => {
  const openDelete = async (name: string) => {
    await openMenu(name)
    await click(item('Delete'))
    return screen.getByRole('dialog', { name: `Delete “${name}”?` })
  }

  it('asks first, saying what goes and what stays', async () => {
    show()
    const dialog = await openDelete('On a AUD 30k budget')
    expect(
      within(dialog).getByText(
        'Its answers and its board go with it. Your other roadmaps stay as they are.',
      ),
    ).toBeInTheDocument()
    await click(within(dialog).getByRole('button', { name: 'Keep it' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deleteRoadmapAction).not.toHaveBeenCalled()
    expect(cardNames()).toHaveLength(3)
  })

  it('deletes, says so with Undo, and Undo puts the card back in its place', async () => {
    show()
    const dialog = await openDelete('On a AUD 30k budget')
    await click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(deleteRoadmapAction).toHaveBeenCalledWith('budget')
    expect(cardNames()).toEqual(['Cyber Security in Perth', 'Data Science instead'])
    expect(screen.getByText('Roadmap deleted.')).toBeInTheDocument()

    await click(screen.getByRole('button', { name: 'Undo' }))
    expect(restoreRoadmapAction).toHaveBeenCalledWith('budget')
    expect(cardNames()).toEqual([
      'Cyber Security in Perth',
      'On a AUD 30k budget',
      'Data Science instead',
    ])
    expect(screen.queryByText('Roadmap deleted.')).not.toBeInTheDocument()
  })

  it('keeps the card and says why when the delete is refused', async () => {
    deleteRoadmapAction.mockImplementationOnce(async () => ({
      ok: false,
      error: "We couldn't find that roadmap. Reload the page and try again.",
    }))
    show()
    const dialog = await openDelete('On a AUD 30k budget')
    await click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent("We couldn't find that roadmap.")
    await click(within(dialog).getByRole('button', { name: 'Keep it' }))
    expect(cardNames()).toHaveLength(3)
  })
})

describe('New roadmap', () => {
  const openNew = async () => {
    await click(screen.getByRole('button', { name: 'New roadmap' }))
    return screen.getByRole('dialog', { name: 'How do you want to start?' })
  }
  const COPY = 'Copy a roadmap and change some answers'
  const SCRATCH = 'Start from scratch'

  it('starts on copying, from the first roadmap, with every roadmap to pick from', async () => {
    show()
    const dialog = await openNew()
    expect(within(dialog).getByRole('radio', { name: COPY })).toBeChecked()
    expect(within(dialog).getByRole('radio', { name: SCRATCH })).not.toBeChecked()
    const from = within(dialog).getByRole('radiogroup', { name: 'Copy which roadmap?' })
    const rows = within(from).getAllByRole('radio')
    expect(
      rows.map((r) => r.getAttribute('aria-label') ?? r.closest('label')?.textContent),
    ).toEqual(['Cyber Security in Perth', 'On a AUD 30k budget', 'Data Science instead'])
    expect(within(from).getByRole('radio', { name: 'Cyber Security in Perth' })).toBeChecked()
    expect(within(dialog).getByRole('button', { name: 'Copy and change answers' })).toBeVisible()
  })

  it('copies the roadmap she picks: on to the draft of a copy of it', async () => {
    show()
    const dialog = await openNew()
    await click(within(dialog).getByRole('radio', { name: 'Data Science instead' }))
    await click(within(dialog).getByRole('button', { name: 'Copy and change answers' }))
    expect(replace).toHaveBeenCalledWith('/roadmaps/new?from=ds')
    expect(startFromScratchAction).not.toHaveBeenCalled()
  })

  it('from scratch: no list to copy from, and Start the questions opens onboarding at 00', async () => {
    show()
    const dialog = await openNew()
    await click(within(dialog).getByRole('radio', { name: SCRATCH }))
    expect(
      within(dialog).queryByRole('radiogroup', { name: 'Copy which roadmap?' }),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: 'Copy and change answers' }),
    ).not.toBeInTheDocument()
    await click(within(dialog).getByRole('button', { name: 'Start the questions' }))
    expect(startFromScratchAction).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/onboarding/character')
  })

  it('stays and says why when a new roadmap cannot be started', async () => {
    startFromScratchAction.mockImplementationOnce(async () => ({
      ok: false,
      error: "You're already answering a new roadmap.",
    }))
    show()
    const dialog = await openNew()
    await click(within(dialog).getByRole('radio', { name: SCRATCH }))
    await click(within(dialog).getByRole('button', { name: 'Start the questions' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('already answering')
    expect(replace).not.toHaveBeenCalled()
  })

  it('closes on Cancel and on Escape, focus back on New roadmap', async () => {
    show()
    let dialog = await openNew()
    await click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await tick()
    expect(screen.getByRole('button', { name: 'New roadmap' })).toHaveFocus()
    dialog = await openNew()
    await key(dialog, 'Escape')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })
})

describe('a new roadmap, just made', () => {
  const READY = 'Your new roadmap is ready.'

  it('says it is ready, and Open it opens its board in place of the list', async () => {
    const history = spyOn(window.history, 'replaceState').mockImplementation(() => {})
    try {
      show([card({ id: 'rm-9', name: 'Copy of Perth', isNew: true }), ...THREE], 'rm-9')
      expect(screen.getByText(READY)).toBeInTheDocument()
      await click(screen.getByRole('button', { name: 'Open it' }))
      expect(replace).toHaveBeenCalledWith('/roadmaps/rm-9')
    } finally {
      history.mockRestore()
    }
  })

  it('drops ?made= from the address once shown, so a reload does not say it again', () => {
    const history = spyOn(window.history, 'replaceState').mockImplementation(() => {})
    try {
      show(THREE, 'budget')
      expect(history).toHaveBeenCalledWith(null, '', '/roadmaps')
    } finally {
      history.mockRestore()
    }
  })

  it('says nothing and leaves the address alone when none was just made', () => {
    const history = spyOn(window.history, 'replaceState').mockImplementation(() => {})
    try {
      show()
      expect(screen.queryByText(READY)).not.toBeInTheDocument()
      expect(history).not.toHaveBeenCalled()
    } finally {
      history.mockRestore()
    }
  })
})
