/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { ActionResult } from '@/shared/types/action-result'
import type { RoadmapSummary } from '../model/roadmap'

const ok = async (): Promise<ActionResult> => ({ ok: true })
const renameRoadmapAction = mock(async (_id: string, _name: string) => ok())
const deleteRoadmapAction = mock(async (_id: string) => ok())
const restoreRoadmapAction = mock(async (_id: string) => ok())
const archiveRoadmapAction = mock(async (_id: string) => ok())
const restoreArchivedAction = mock(async (_id: string) => ok())
const startFromScratchAction = mock(ok)

const replace = mock((_: string) => {})
const push = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace, refresh: () => {}, back: () => {}, prefetch: () => {} }),
}))

const { RoadmapsPage } = await import('./RoadmapsPage')

afterEach(() => {
  cleanup()
  for (const action of [
    renameRoadmapAction,
    deleteRoadmapAction,
    restoreRoadmapAction,
    archiveRoadmapAction,
    restoreArchivedAction,
    startFromScratchAction,
  ]) {
    action.mockClear()
  }
  window.localStorage.clear()
  replace.mockClear()
  push.mockClear()
})

const at = (day: number) => new Date(2026, 9, day, 12)

const card = (over: Partial<RoadmapSummary>): RoadmapSummary => ({
  id: 'perth',
  name: 'Cyber Security in Perth',
  line: 'Cyber Security · ECU · Perth',
  pointB: 'Permanent residency · 2032',
  progress: { walked: 4, steps: 7 },
  next: 'Student visa · Late 2026',
  from: 'From onboarding',
  diffs: [],
  openedLabel: 'Opened today',
  isNew: false,
  archived: false,
  createdAt: at(1),
  lastOpenedAt: at(14),
  ...over,
})

// Last opened first, as the server reads them; made in the other order.
const THREE = [
  card({}),
  card({
    id: 'budget',
    name: 'On a AUD 30k budget',
    from: 'Copy of Cyber Security in Perth',
    diffs: ['Budget: AUD 30k'],
    openedLabel: 'Opened yesterday',
    progress: { walked: 3, steps: 7 },
    next: 'Pick a course in Perth',
    createdAt: at(5),
    lastOpenedAt: at(13),
  }),
  card({
    id: 'ds',
    name: 'Data Science instead',
    from: 'Copy of Cyber Security in Perth',
    diffs: ['Course: Data Science', 'English test: IELTS 7.5 or more'],
    openedLabel: 'Opened 3 days ago',
    createdAt: at(9),
    lastOpenedAt: at(11),
  }),
]

const FIRST_LEAD =
  'Your first roadmap is ready. Open it to explore, or make another with different answers.'
const LEAD =
  'Each roadmap is one set of answers and where it leads. Copy one and change a few answers to see another way.'

function show(roadmaps: RoadmapSummary[] = THREE, madeId: string | null = null) {
  render(
    <RoadmapsPage
      roadmaps={roadmaps}
      madeId={madeId}
      renameRoadmapAction={renameRoadmapAction}
      deleteRoadmapAction={deleteRoadmapAction}
      restoreRoadmapAction={restoreRoadmapAction}
      archiveRoadmapAction={archiveRoadmapAction}
      restoreArchivedAction={restoreArchivedAction}
      startFromScratchAction={startFromScratchAction}
    />,
  )
}

const list = () => screen.getByRole('list', { name: 'Your roadmaps' })
/** The list's rows (its own items, not their chips). */
const rows = () => [...list().children] as HTMLElement[]
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

  it('counts her roadmaps out of the archive above the title', () => {
    show()
    expect(screen.getByText('3 roadmaps')).toBeInTheDocument()
    cleanup()
    show([card({}), card({ id: 'budget', name: 'On a AUD 30k budget', archived: true })])
    expect(screen.getByText('1 roadmap')).toBeInTheDocument()
  })

  it('marks the one she opened last, and only that one', () => {
    show()
    const items = rows()
    expect(items[0]).toHaveAttribute('data-last-opened')
    expect(items[1]).not.toHaveAttribute('data-last-opened')
    expect(items[2]).not.toHaveAttribute('data-last-opened')
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
    const items = rows()
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

describe("a row's description", () => {
  it('reads its chips and where it came from, as cards and as a table, after its name', async () => {
    show([card({ id: 'a', name: 'A', isNew: true }), ...THREE.slice(1)])
    expect(screen.getByRole('link', { name: 'On a AUD 30k budget' })).toHaveAccessibleDescription(
      /Budget: AUD 30k.*Copy of Cyber Security in Perth · Opened yesterday/,
    )
    await click(
      within(screen.getByRole('group', { name: 'Show as' })).getByRole('button', { name: 'Table' }),
    )
    expect(screen.getByRole('link', { name: 'A' })).toHaveAccessibleDescription(
      /^New From onboarding/,
    )
    expect(screen.getByRole('link', { name: 'On a AUD 30k budget' })).toHaveAccessibleDescription(
      'Copy of Cyber Security in Perth Budget: AUD 30k',
    )
  })
})

describe('Sort', () => {
  const sortBy = async (label: string) => {
    await click(screen.getByRole('combobox', { name: 'Sort' }))
    await click(screen.getByRole('option', { name: label }))
  }

  it('starts on last opened', () => {
    show()
    expect(screen.getByRole('combobox', { name: 'Sort' })).toHaveTextContent('Last opened')
  })

  it('orders the list by name, A to Z', async () => {
    show()
    await sortBy('Name')
    expect(cardNames()).toEqual([
      'Cyber Security in Perth',
      'Data Science instead',
      'On a AUD 30k budget',
    ])
  })

  it('orders the list by date made, newest first, and back by last opened', async () => {
    show()
    await sortBy('Date made')
    expect(cardNames()).toEqual([
      'Data Science instead',
      'On a AUD 30k budget',
      'Cyber Security in Perth',
    ])
    await sortBy('Last opened')
    expect(cardNames()).toEqual([
      'Cyber Security in Perth',
      'On a AUD 30k budget',
      'Data Science instead',
    ])
  })
})

describe('Show as a table', () => {
  const showAs = (label: string) =>
    within(screen.getByRole('group', { name: 'Show as' })).getByRole('button', { name: label })
  const table = () => screen.getByRole('table', { name: 'Your roadmaps' })
  const bodyRows = () => within(table()).getAllByRole('row').slice(1)
  const rowNames = () =>
    bodyRows().map((r) => within(r).getAllByRole('link')[0].getAttribute('aria-label'))
  const header = (name: string) => within(table()).getByRole('columnheader', { name })

  it('starts as cards; Table swaps the cards for a table, pressed', async () => {
    show()
    expect(showAs('Cards')).toHaveAttribute('aria-pressed', 'true')
    expect(showAs('Table')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await click(showAs('Table'))
    expect(showAs('Table')).toHaveAttribute('aria-pressed', 'true')
    expect(showAs('Cards')).toHaveAttribute('aria-pressed', 'false')
    expect(table()).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Your roadmaps' })).not.toBeInTheDocument()
  })

  it('has a row per roadmap: course and city, progress, next, Point B, last opened', async () => {
    show()
    await click(showAs('Table'))
    expect(rowNames()).toEqual([
      'Cyber Security in Perth',
      'On a AUD 30k budget',
      'Data Science instead',
    ])
    const cells = (i: number) =>
      within(bodyRows()[i])
        .getAllByRole('cell')
        .map((c) => c.textContent)
    expect(cells(0)).toEqual([
      'Cyber Security · ECU · Perth',
      '4 of 7 steps walked',
      'Student visa · Late 2026',
      'Permanent residency · 2032',
      'Opened today',
      '',
    ])
    expect(cells(1)[2]).toBe('Pick a course in Perth')
    expect(within(bodyRows()[1]).getByRole('rowheader')).toHaveTextContent(
      'Copy of Cyber Security in Perth',
    )
    expect(bodyRows()[0]).toHaveAttribute('data-last-opened')
    expect(bodyRows()[1]).not.toHaveAttribute('data-last-opened')
  })

  it('sorts from the Roadmap and Last opened headers, which say how they are sorted', async () => {
    show()
    await click(showAs('Table'))
    expect(header('Last opened')).toHaveAttribute('aria-sort', 'descending')
    expect(header('Roadmap')).toHaveAttribute('aria-sort', 'none')

    await click(within(header('Roadmap')).getByRole('button', { name: 'Roadmap' }))
    expect(header('Roadmap')).toHaveAttribute('aria-sort', 'ascending')
    expect(header('Last opened')).toHaveAttribute('aria-sort', 'none')
    expect(rowNames()).toEqual([
      'Cyber Security in Perth',
      'Data Science instead',
      'On a AUD 30k budget',
    ])
    expect(screen.getByRole('combobox', { name: 'Sort' })).toHaveTextContent('Name')

    await click(within(header('Last opened')).getByRole('button', { name: 'Last opened' }))
    expect(rowNames()[0]).toBe('Cyber Security in Perth')
    expect(header('Last opened')).toHaveAttribute('aria-sort', 'descending')
  })

  it('opens on the table when she chose it last time', () => {
    window.localStorage.setItem('ofcourse:roadmaps-view', 'table')
    show()
    expect(table()).toBeInTheDocument()
  })

  it('lists archived roadmaps in their own table in the fold, each row restoring', async () => {
    show([card({}), card({ id: 'budget', name: 'On a AUD 30k budget', archived: true })])
    await click(showAs('Table'))
    expect(within(table()).getAllByRole('row')).toHaveLength(2)
    await click(screen.getByRole('button', { name: 'Archived (1)' }))
    const archived = screen.getByRole('table', { name: 'Archived roadmaps' })
    await click(within(archived).getByRole('button', { name: 'Restore On a AUD 30k budget' }))
    expect(restoreArchivedAction).toHaveBeenCalledWith('budget')
    expect(within(table()).getAllByRole('row')).toHaveLength(3)
  })
})

describe('the … menu', () => {
  it('offers Open, Copy and change answers, Rename, Archive and Delete', async () => {
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
    ).toEqual(['Open', 'Copy and change answers', 'Rename', 'Archive', 'Delete'])
    expect(item('Open')).toHaveAttribute('href', '/roadmaps/budget')
    expect(item('Copy and change answers')).toHaveAttribute('href', '/roadmaps/new?from=budget')
    // Opening focuses the first item.
    expect(item('Open')).toHaveFocus()
  })

  it('has no Archive and no Delete while one roadmap is out of the archive', async () => {
    show([card({}), card({ id: 'budget', name: 'On a AUD 30k budget', archived: true })])
    await openMenu('Cyber Security in Perth')
    expect(
      within(screen.getByRole('menu'))
        .getAllByRole('menuitem')
        .map((m) => m.textContent),
    ).toEqual(['Open', 'Copy and change answers', 'Rename'])
  })

  it('offers Restore and Delete on an archived roadmap, even beside her only other one', async () => {
    show([card({}), card({ id: 'budget', name: 'On a AUD 30k budget', archived: true })])
    await click(screen.getByRole('button', { name: 'Archived (1)' }))
    await openMenu('On a AUD 30k budget')
    expect(
      within(screen.getByRole('menu'))
        .getAllByRole('menuitem')
        .map((m) => m.textContent),
    ).toEqual(['Restore', 'Delete'])
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

describe('Archive', () => {
  const ARCHIVED = 'Archived. Restore it any time from Archived.'
  const fold = (n: number) => screen.getByRole('button', { name: `Archived (${n})` })
  const archive = async (name: string) => {
    await openMenu(name)
    await click(item('Archive'))
  }

  it('folds it away: out of the list and the count, said with Undo, the fold closed', async () => {
    show()
    await archive('On a AUD 30k budget')
    expect(archiveRoadmapAction).toHaveBeenCalledWith('budget')
    expect(cardNames()).toEqual(['Cyber Security in Perth', 'Data Science instead'])
    expect(screen.getByText('2 roadmaps')).toBeInTheDocument()
    expect(screen.getByText(ARCHIVED)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    expect(fold(1)).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: 'Archived roadmaps' })).not.toBeInTheDocument()
    // Its "…" button went with it: focus waits on the fold. (Compared as text: a failing
    // toHaveFocus prints the whole page here, which never ends.)
    expect(document.activeElement?.textContent).toBe('Archived (1)')
  })

  it('the fold opens on its archived roadmaps, faded, each row restoring it', async () => {
    show()
    await archive('On a AUD 30k budget')
    await click(fold(1))
    expect(fold(1)).toHaveAttribute('aria-expanded', 'true')
    const archived = screen.getByRole('list', { name: 'Archived roadmaps' })
    const restore = within(archived).getByRole('button', { name: 'Restore On a AUD 30k budget' })
    expect(restore.closest('li')).toHaveClass('opacity-75')
    expect(within(archived).queryByRole('link')).not.toBeInTheDocument()

    await click(restore)
    expect(restoreArchivedAction).toHaveBeenCalledWith('budget')
    expect(screen.getByText('Restored.')).toBeInTheDocument()
    expect(cardNames()).toEqual([
      'Cyber Security in Perth',
      'On a AUD 30k budget',
      'Data Science instead',
    ])
    expect(screen.queryByRole('button', { name: /^Archived/ })).not.toBeInTheDocument()
    // The fold went with the last of them: focus goes to the title.
    expect(document.activeElement?.textContent).toBe('Your roadmaps')
  })

  it('Undo on its toast puts it back in its place', async () => {
    show()
    await archive('On a AUD 30k budget')
    await click(screen.getByRole('button', { name: 'Undo' }))
    expect(restoreArchivedAction).toHaveBeenCalledWith('budget')
    expect(cardNames()).toEqual([
      'Cyber Security in Perth',
      'On a AUD 30k budget',
      'Data Science instead',
    ])
    expect(screen.queryByText(ARCHIVED)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Archived/ })).not.toBeInTheDocument()
  })

  it('keeps the row and says why when the archive is refused', async () => {
    archiveRoadmapAction.mockImplementationOnce(async () => ({
      ok: false,
      error: 'Keep one roadmap out of the archive.',
    }))
    show()
    await archive('On a AUD 30k budget')
    expect(screen.getByText('Keep one roadmap out of the archive.')).toBeInTheDocument()
    expect(cardNames()).toHaveLength(3)
    expect(screen.queryByRole('button', { name: /^Archived/ })).not.toBeInTheDocument()
  })

  it('moves the last-opened mark to the next one when the marked one is archived', async () => {
    show()
    await archive('Cyber Security in Perth')
    const items = rows()
    expect(items[0]).toHaveAttribute('data-last-opened')
    expect(within(items[0]).getByRole('link', { name: 'On a AUD 30k budget' })).toBeVisible()
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

  it('offers copying, from the first roadmap, with every roadmap to pick from, or starting from scratch', async () => {
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

  it('never offers an archived roadmap to copy', async () => {
    show([THREE[0], { ...THREE[1], archived: true }, THREE[2]])
    const dialog = await openNew()
    const from = within(dialog).getByRole('radiogroup', { name: 'Copy which roadmap?' })
    expect(
      within(from)
        .getAllByRole('radio')
        .map((r) => r.closest('label')?.textContent),
    ).toEqual(['Cyber Security in Perth', 'Data Science instead'])
  })

  it('copies the roadmap she picks: on to the draft of a copy of it', async () => {
    show()
    const dialog = await openNew()
    await click(within(dialog).getByRole('radio', { name: 'Data Science instead' }))
    await click(within(dialog).getByRole('button', { name: 'Copy and change answers' }))
    expect(replace).toHaveBeenCalledWith('/roadmaps/new?from=ds')
  })

  it('from scratch: no roadmap to pick, and Start the questions opens onboarding, one question a screen', async () => {
    show()
    const dialog = await openNew()
    await click(within(dialog).getByRole('radio', { name: SCRATCH }))
    expect(
      within(dialog).queryByRole('radiogroup', { name: 'Copy which roadmap?' }),
    ).not.toBeInTheDocument()
    await click(within(dialog).getByRole('button', { name: 'Start the questions' }))
    expect(startFromScratchAction).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledTimes(1)
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
