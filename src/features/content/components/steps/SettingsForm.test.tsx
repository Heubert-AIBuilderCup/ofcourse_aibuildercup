/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import { type ReactNode, useState } from 'react'
import type { Staff } from '@/shared/lib/auth/access'
import { emptyPointers } from '../../model/artifacts'
import type { CurrentPost } from '../../model/current'
import type { FeedSettings, Template } from '../../model/types'
import type { Saved } from '../../server/commands'
import { templateById } from '../../templates'
import { nativeOf } from '../../text/native-fixtures'

const push = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh: () => {} }),
}))

const { SettingsForm } = await import('./SettingsForm')
type Props = Parameters<typeof SettingsForm>[0]

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
  sourceCheck: { id: 'sc1', body: { revisionId: 'rev1', claims: [], replays: [] } },
  settings: null,
  sendBack: null,
  approval: null,
  market: null,
  caption: null,
  export: null,
}

const GENERAL_90: FeedSettings = {
  layer: 'general',
  audience: { mode: 'everyone', rules: [] },
  whyLine: null,
  expiry: { kind: 'days', days: 90 },
  studioLink: null,
  tags: [],
  sourcesAt: 'caption',
}

const withSettings = (s: FeedSettings): CurrentPost => ({
  ...EMPTY,
  settings: { id: 'set1', body: s },
})

const VIEW: Props['view'] = {
  id: 'p1',
  title: 'Paid work',
  stage: 'rendered',
  version: 11,
  pointers: emptyPointers(),
  current: EMPTY,
  createdAt: '2026-10-05T09:12:00.000Z',
  running: [],
  draftChecks: [],
}

const savedAt = (version: number) => async (): Promise<Saved> => ({ ok: true, id: 'p1', version })
const actions = {
  saveSettingsAction: mock(async (_id: unknown, _at: unknown, _s: unknown) => savedAt(12)()),
  sendToReviewAction: mock(async (_id: unknown, _at: unknown) => savedAt(13)()),
}

const EDITOR: Staff = { role: 'user', editor: true }

/** The form with its panel held above it by name, as the workbench holds it across saves. */
function Held(props: Omit<Props, 'tab'>) {
  const [open, onOpen] = useState<string | null>(null)
  return <SettingsForm {...props} tab={{ open, onOpen }} />
}

const view = (
  over: Partial<Props['view']> = {},
  slots: { check?: ReactNode; fixes?: ReactNode; market?: ReactNode } = {},
) => render(<Held view={{ ...VIEW, ...over }} viewer={EDITOR} actions={actions} {...slots} />)

const indicator = () => screen.getByRole('tablist', { name: 'Settings panels' })
/** Opens a panel from its tab, by its name. */
const openPanel = (name: string) =>
  fireEvent.click(within(indicator()).getByRole('tab', { name: new RegExp(`^${name}`) }))

afterEach(() => {
  cleanup()
  push.mockClear()
  for (const a of Object.values(actions)) a.mockClear()
})

describe('SettingsForm', () => {
  it('labels the audience counts as mock and lists the match rules', () => {
    view()
    expect(screen.getByText('18,420 (mock)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /Matched/ }))
    expect(screen.getByText('1,284 matched (mock)')).toBeInTheDocument()
    expect(screen.getByText('Destination: Australia')).toBeInTheDocument()
    expect(screen.getByText('Work rights weight ≥ medium')).toBeInTheDocument()
  })

  it('disables Matched for a featured post, with the reason', () => {
    view()
    fireEvent.click(screen.getByRole('radio', { name: /Featured/ }))
    expect(screen.getByRole('radio', { name: /Matched/ })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /Everyone/ })).toBeChecked()
    expect(screen.getByText('Featured posts go to everyone')).toBeInTheDocument()
  })

  it('hides the why line for General and Everyone only', () => {
    view()
    expect(screen.queryByRole('textbox', { name: 'Why line' })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: /Personal/ }))
    expect(screen.getByRole('textbox', { name: 'Why line' })).toBeInTheDocument()
  })

  it('holds the why line to 140 characters as a reader sees them, a Hindi line whole (GD37)', () => {
    view()
    fireEvent.click(screen.getByRole('radio', { name: /Personal/ }))
    const field = screen.getByRole('textbox', { name: 'Why line' })
    fireEvent.change(field, { target: { value: `${nativeOf('hi', 140)}।` } })
    expect(field).toHaveValue(nativeOf('hi', 140))
  })

  it('keeps "Send to review" unavailable for a personal post with no why line', () => {
    view({ current: withSettings({ ...GENERAL_90, layer: 'personal' }) })
    openPanel('Expiry')
    expect(screen.getByRole('button', { name: 'Send to review → Review' })).toBeDisabled()
    // Said where it is fixed, and the button's reason points there.
    expect(screen.getByRole('tooltip').textContent).toBe(
      'Personal and matched posts always say why: open Who sees it',
    )
    openPanel('Who sees it')
    expect(screen.getByText('Personal and matched posts always say why')).toBeInTheDocument()
  })

  it('opens a post with no settings pre-filled from its facts, and saves them only on "Save settings" (GD29)', async () => {
    const fact = {
      id: 'f1',
      text: 'Students in Perth who work up to 20 hours a week kept their grades.',
      value: null,
      ref: '¶1',
      quote: null,
      supported: true,
      why: null,
      span: null,
    }
    view({
      current: {
        ...EMPTY,
        facts: {
          id: 'facts1',
          body: { sourceId: 'src1', keyIdeas: [], facts: [fact], replays: [] },
        },
      },
    })
    expect(screen.getByRole('radio', { name: /General/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Everyone/ })).toBeChecked()
    openPanel('Tags')
    expect(screen.getByRole('checkbox', { name: 'Australia' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Work and study life' })).toBeChecked()
    openPanel('Expiry')
    expect(screen.getByRole('radio', { name: '90 days' })).toBeChecked()
    expect(actions.saveSettingsAction).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    })
    expect(actions.saveSettingsAction).toHaveBeenCalledWith('p1', 11, {
      ...GENERAL_90,
      tags: ['destination:AU', 'theme:work-study-life'],
    })
  })

  it('opens a Nepali post with no settings tagged for students from Nepal (GD40)', () => {
    view({
      current: {
        ...EMPTY,
        source: {
          id: 'src1',
          body: {
            title: 'Paid work',
            kind: 'research summary',
            text: 'Students work.',
            paragraphs: [{ ref: '¶1', text: 'Students work.' }],
            demoKey: null,
            language: 'ne',
            framing: null,
          },
        },
      },
    })
    openPanel('Tags')
    expect(screen.getByRole('checkbox', { name: 'Nepal' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'India' })).not.toBeChecked()
  })

  it('still names the expiry when "On a date" has no date yet (52)', () => {
    view()
    openPanel('Expiry')
    fireEvent.click(screen.getByRole('radio', { name: 'On a date' }))
    expect(screen.getByText('Choose the expiry before sending to review.')).toBeInTheDocument()
  })

  it('offers "Send to review" with no slide vision check to wait on (103)', () => {
    view({ current: withSettings(GENERAL_90) })
    openPanel('Expiry')
    expect(screen.getByRole('button', { name: 'Send to review → Review' })).toBeEnabled()
    expect(screen.queryByText(/vision check/i)).toBeNull()
  })

  it('saves the chosen settings', async () => {
    view()
    fireEvent.change(screen.getByRole('combobox', { name: 'Studio link' }), {
      target: { value: 'Compare view' },
    })
    openPanel('Expiry')
    fireEvent.click(screen.getByRole('radio', { name: '90 days' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    })
    expect(actions.saveSettingsAction).toHaveBeenCalledWith('p1', 11, {
      ...GENERAL_90,
      studioLink: 'Compare view',
    })
  })

  it('asks where the sources go, the caption by default, and saves the choice (GD31)', async () => {
    view({ current: withSettings({ ...GENERAL_90, sourcesAt: 'last_slide' }) })
    openPanel('Where sources go')
    expect(screen.getByRole('radio', { name: /Last slide/ })).toBeChecked()
    cleanup()
    view()
    openPanel('Where sources go')
    expect(screen.getByRole('radio', { name: /Caption only/ })).toBeChecked()
    fireEvent.click(screen.getByRole('radio', { name: /sources slide/ }))
    openPanel('Expiry')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    })
    expect(actions.saveSettingsAction).toHaveBeenCalledWith('p1', 11, {
      ...GENERAL_90,
      sourcesAt: 'sources_slide',
    })
  })

  it('offers a post from before the looks only the caption for its sources, since its slides keep their source lines (GD8, GD31)', () => {
    const revisionOf = (template: Template) =>
      ({ id: 'rev1', body: { template } }) as unknown as CurrentPost['revision']
    view({ current: { ...EMPTY, revision: revisionOf(templateById('the-line') as Template) } })
    openPanel('Where sources go')
    expect(
      screen.getAllByRole('radio', { name: /Caption only|Last slide|sources slide/ }),
    ).toHaveLength(1)
    expect(screen.getByRole('radio', { name: /Caption only/ })).toBeChecked()
    cleanup()
    view({ current: { ...EMPTY, revision: revisionOf(templateById('field-notes') as Template) } })
    openPanel('Where sources go')
    expect(
      screen.getAllByRole('radio', { name: /Caption only|Last slide|sources slide/ }),
    ).toHaveLength(3)
  })

  it('sends saved settings to review', async () => {
    view({ current: withSettings(GENERAL_90) })
    openPanel('Expiry')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send to review → Review' }))
    })
    expect(actions.saveSettingsAction).not.toHaveBeenCalled()
    expect(actions.sendToReviewAction).toHaveBeenCalledWith('p1', 11)
    // Sent, the post is in review: its screen opens (GD27).
    expect(push).toHaveBeenCalledWith('/admin/posts/p1/review')
  })

  it('offers the four tag groups, none required (80, 52)', () => {
    view({ current: withSettings(GENERAL_90) })
    openPanel('Tags')
    for (const legend of ['Destination', 'Home country', 'Theme', 'Age']) {
      expect(screen.getByRole('group', { name: legend })).toBeInTheDocument()
    }
    expect(screen.getByRole('checkbox', { name: 'Australia' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: '21–25' })).not.toBeChecked()
    openPanel('Expiry')
    expect(screen.getByRole('button', { name: 'Send to review → Review' })).toBeEnabled()
  })

  it('saves the ticked tags by id (80)', async () => {
    view()
    openPanel('Tags')
    fireEvent.click(screen.getByRole('checkbox', { name: 'India' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Books and movies' }))
    expect(screen.getByRole('checkbox', { name: 'India' })).toBeChecked()
    openPanel('Expiry')
    fireEvent.click(screen.getByRole('radio', { name: '90 days' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    })
    expect(actions.saveSettingsAction).toHaveBeenCalledWith('p1', 11, {
      ...GENERAL_90,
      tags: ['home:IN', 'theme:books-movies'],
    })
  })

  it('shows saved tags ticked and unticks one', async () => {
    view({ current: withSettings({ ...GENERAL_90, tags: ['home:IN', 'theme:books-movies'] }) })
    openPanel('Tags')
    expect(screen.getByRole('checkbox', { name: 'India' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Books and movies' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Nepal' })).not.toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: 'India' }))
    openPanel('Expiry')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    })
    expect(actions.saveSettingsAction).toHaveBeenCalledWith('p1', 11, {
      ...GENERAL_90,
      tags: ['theme:books-movies'],
    })
  })

  it('saves changed settings before sending them to review', async () => {
    view({ current: withSettings(GENERAL_90) })
    openPanel('Expiry')
    fireEvent.click(screen.getByRole('radio', { name: '30 days' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send to review → Review' }))
    })
    expect(actions.saveSettingsAction).toHaveBeenCalledWith('p1', 11, {
      ...GENERAL_90,
      expiry: { kind: 'days', days: 30 },
    })
    expect(actions.sendToReviewAction).toHaveBeenCalledWith('p1', 12)
  })
})

describe('SettingsForm: one panel at a time, the post beside it', () => {
  const claim = (result: 'found' | 'not_found') => ({
    text: 'Grades hold up to 20 hours.',
    slide: 2,
    slot: 'body',
    result,
    ref: result === 'found' ? '¶1' : null,
  })
  const checked = (result: 'found' | 'not_found'): CurrentPost['sourceCheck'] => ({
    id: 'sc1',
    body: { revisionId: 'rev1', claims: [claim(result)], replays: [] },
  })
  const slots = { check: <p>The source check</p>, market: <p>The market versions</p> }
  const progress = () => screen.getByText(/^\d of \d$/)

  it('opens on the source check, and Next and Back move one panel, in order', () => {
    view({ current: withSettings(GENERAL_90) }, slots)
    expect(progress()).toHaveTextContent('1 of 6')
    expect(screen.getByRole('tabpanel', { name: 'Source check' })).toHaveTextContent(
      'The source check',
    )
    // Tab from the tablist lands in the panel, even one that opens on text (APG tabs).
    expect(screen.getByRole('tabpanel', { name: 'Source check' }).getAttribute('tabindex')).toBe(
      '0',
    )
    expect(screen.queryByRole('group', { name: 'Layer' }) === null).toBe(true)
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()

    const names = ['Who sees it', 'Tags', 'Where sources go', 'Expiry', 'Market versions']
    for (const [i, name] of names.entries()) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      expect(progress()).toHaveTextContent(`${i + 2} of 6`)
      expect(screen.getByRole('tabpanel', { name })).toBeInTheDocument()
    }
    expect(screen.queryByText('The source check') === null).toBe(true)
    expect(screen.getByText('The market versions')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(progress()).toHaveTextContent('5 of 6')
    expect(screen.getByRole('tabpanel', { name: 'Expiry' })).toBeInTheDocument()
  })

  it('shows the panels as tabs, the open one selected and each with a problem marked "Fix" (6)', () => {
    view(
      {
        current: {
          ...withSettings({ ...GENERAL_90, layer: 'personal' }),
          sourceCheck: checked('not_found'),
        },
      },
      slots,
    )
    const tab = (name: string) => within(indicator()).getByRole('tab', { name })
    // The source check opens first while it holds something to fix, counted; the others say "Fix".
    expect(tab('Source check · 1 to fix').getAttribute('aria-selected')).toBe('true')
    // One word in a tag, never an exclamation mark.
    expect(tab('Source check · 1 to fix').textContent).toContain('1')
    expect(indicator().textContent).not.toContain('!')
    expect(tab('Who sees it · needs attention').getAttribute('aria-selected')).toBe('false')
    expect(tab('Who sees it · needs attention').textContent).toContain('Fix')
    for (const name of ['Tags', 'Where sources go', 'Expiry', 'Market versions']) {
      expect(tab(name).textContent).not.toContain('Fix')
      expect(tab(name).getAttribute('aria-selected')).toBe('false')
    }
    // The open panel is its tab's, and named by it.
    expect(screen.getByRole('tabpanel', { name: 'Source check · 1 to fix' }).id).toBe(
      tab('Source check · 1 to fix').getAttribute('aria-controls') ?? 'none',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(tab('Who sees it · needs attention').getAttribute('aria-selected')).toBe('true')
    expect(tab('Source check · 1 to fix').getAttribute('aria-selected')).toBe('false')
    cleanup()

    // The check found every sentence and the why line is not needed; an expiry date is still to choose.
    view({ current: { ...withSettings(GENERAL_90), sourceCheck: checked('found') } }, slots)
    openPanel('Expiry')
    fireEvent.click(screen.getByRole('radio', { name: 'On a date' }))
    expect(tab('Source check').textContent).not.toContain('Fix')
    expect(tab('Who sees it').textContent).not.toContain('Fix')
    expect(tab('Expiry · needs attention').textContent).toContain('Fix')
  })

  it('moves between the tabs with the arrow keys, Home and End, only the open tab in the tab order', () => {
    view({ current: { ...withSettings(GENERAL_90), sourceCheck: checked('found') } }, slots)
    const tabs = () => within(indicator()).getAllByRole('tab')
    const selected = () =>
      tabs()
        .filter((t) => t.getAttribute('aria-selected') === 'true')
        .map((t) => t.textContent)
    expect(tabs().map((t) => t.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
      '-1',
      '-1',
      '-1',
    ])
    fireEvent.keyDown(tabs()[0], { key: 'ArrowRight' })
    expect(selected()).toEqual(['Who sees it'])
    expect(document.activeElement === tabs()[1]).toBe(true)
    fireEvent.keyDown(tabs()[1], { key: 'End' })
    expect(selected()).toEqual(['Market versions'])
    fireEvent.keyDown(tabs()[5], { key: 'ArrowRight' })
    expect(selected()).toEqual(['Source check'])
    fireEvent.keyDown(tabs()[0], { key: 'ArrowLeft' })
    expect(selected()).toEqual(['Market versions'])
    fireEvent.keyDown(tabs()[5], { key: 'Home' })
    expect(selected()).toEqual(['Source check'])
    expect(document.activeElement === tabs()[0]).toBe(true)
    expect(progress()).toHaveTextContent('1 of 6')
  })

  it('keeps "Send to review" in the step actions bar on every panel, which sends the post (A4)', async () => {
    view({ current: { ...withSettings(GENERAL_90), sourceCheck: checked('found') } }, slots)
    const send = () =>
      within(screen.getByRole('region', { name: 'Step actions' })).getByRole('button', {
        name: 'Send to review → Review',
      })
    expect(send()).toBeEnabled()
    openPanel('Expiry')
    expect(send()).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.queryByRole('button', { name: 'Next' }) === null).toBe(true)
    await act(async () => {
      fireEvent.click(send())
    })
    expect(actions.sendToReviewAction).toHaveBeenCalledWith('p1', 11)
  })

  it('jumps to any panel from the indicator', () => {
    view({ current: withSettings(GENERAL_90) }, slots)
    openPanel('Tags')
    expect(progress()).toHaveTextContent('3 of 6')
    expect(screen.getByRole('group', { name: 'Destination' })).toBeInTheDocument()
    openPanel('Source check')
    expect(progress()).toHaveTextContent('1 of 6')
    expect(screen.getByText('The source check')).toBeInTheDocument()
  })
})

describe('SettingsForm: one Source check tab for the check, each other problem on its own tab (18 Oct)', () => {
  const notFound = (n: number): CurrentPost['sourceCheck'] => ({
    id: 'sc1',
    body: {
      revisionId: 'rev1',
      claims: Array.from({ length: n }, (_, i) => ({
        text: `Sentence ${i + 1}.`,
        slide: 2,
        slot: 'body',
        result: 'not_found' as const,
        ref: null,
      })),
      replays: [],
    },
  })
  const slots = { check: <p>The source check</p>, market: <p>The market versions</p> }
  const tabs = () => within(indicator()).getAllByRole('tab')
  const named = (name: string) => within(indicator()).getByRole('tab', { name })
  const panel = () => screen.getByRole('tabpanel')
  const reason = () => screen.getByRole('tooltip').textContent

  it('offers "Send to review" on untouched defaults, and sending saves them first, as Save does', async () => {
    view()
    const send = screen.getByRole('button', { name: 'Send to review → Review' })
    expect(send).toBeEnabled()
    await act(async () => {
      fireEvent.click(send)
    })
    expect(actions.saveSettingsAction).toHaveBeenCalledWith('p1', 11, GENERAL_90)
    expect(actions.sendToReviewAction).toHaveBeenCalledWith('p1', 12)
  })

  it('has no "To fix" tab: the Source check opens first, counting the sentences not found, and Send points to it', () => {
    view({ current: { ...withSettings(GENERAL_90), sourceCheck: notFound(2) } }, slots)
    expect(tabs().map((t) => t.textContent)).toEqual([
      'Source check2 · 2 to fix',
      'Who sees it',
      'Tags',
      'Where sources go',
      'Expiry',
      'Market versions',
    ])
    expect(named('Source check · 2 to fix').getAttribute('aria-selected')).toBe('true')
    expect(panel().textContent).toContain('The source check')
    expect(reason()).toBe('2 to fix: open Source check')
  })

  it('counts a check not run yet as one to fix', () => {
    view({ current: { ...withSettings(GENERAL_90), sourceCheck: null } }, slots)
    expect(named('Source check · 1 to fix').getAttribute('aria-selected')).toBe('true')
    expect(reason()).toBe('1 to fix: open Source check')
  })

  it('marks a why line still to write on Who sees it, says it there, and points Send to it', () => {
    view(
      {
        current: {
          ...withSettings({ ...GENERAL_90, layer: 'personal' }),
          sourceCheck: notFound(0),
        },
      },
      slots,
    )
    expect(named('Source check').getAttribute('aria-selected')).toBe('true')
    expect(reason()).toBe('Personal and matched posts always say why: open Who sees it')
    openPanel('Who sees it')
    expect(named('Who sees it · needs attention').getAttribute('aria-selected')).toBe('true')
    expect(panel().textContent).toContain('Personal and matched posts always say why')
  })

  it('marks an expiry still to choose on Expiry, keeping the panel the editor is on', () => {
    view({ current: { ...withSettings(GENERAL_90), sourceCheck: notFound(0) } }, slots)
    openPanel('Expiry')
    fireEvent.click(screen.getByRole('radio', { name: 'On a date' }))
    expect(panel().getAttribute('aria-labelledby')).toBe(named('Expiry · needs attention').id)
    expect(named('Source check').textContent).toBe('Source check')
    expect(reason()).toBe('Choose the expiry before sending to review: open Expiry')
  })
})
