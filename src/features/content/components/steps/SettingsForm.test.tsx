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

/** The form with its panel held above it, as the workbench holds it across saves. */
function Held(props: Omit<Props, 'panel'>) {
  const [at, onGo] = useState(0)
  return <SettingsForm {...props} panel={{ at, onGo }} />
}

const view = (
  over: Partial<Props['view']> = {},
  slots: { check?: ReactNode; market?: ReactNode } = {},
) => render(<Held view={{ ...VIEW, ...over }} viewer={EDITOR} actions={actions} {...slots} />)

const indicator = () => screen.getByRole('navigation', { name: 'Settings panels' })
/** Opens a panel from the indicator, by its name. */
const openPanel = (name: string) =>
  fireEvent.click(within(indicator()).getByRole('button', { name: new RegExp(`^${name}`) }))

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
  const progress = () => within(indicator()).getByText(/^\d of \d$/)

  it('opens on the source check, and Next and Back move one panel, in order', () => {
    view({ current: withSettings(GENERAL_90) }, slots)
    expect(progress()).toHaveTextContent('1 of 6')
    expect(screen.getByRole('region', { name: 'Source check' })).toHaveTextContent(
      'The source check',
    )
    expect(screen.queryByRole('group', { name: 'Layer' }) === null).toBe(true)
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()

    const names = ['Who sees it', 'Tags', 'Where sources go', 'Expiry', 'Market versions']
    for (const [i, name] of names.entries()) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      expect(progress()).toHaveTextContent(`${i + 2} of 6`)
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    }
    expect(screen.queryByText('The source check') === null).toBe(true)
    expect(screen.getByText('The market versions')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(progress()).toHaveTextContent('5 of 6')
    expect(screen.getByRole('region', { name: 'Expiry' })).toBeInTheDocument()
  })

  it('marks the current panel in the indicator, and each panel with a problem', () => {
    view(
      {
        current: {
          ...withSettings({ ...GENERAL_90, layer: 'personal' }),
          sourceCheck: checked('not_found'),
        },
      },
      slots,
    )
    const marks = within(indicator())
    expect(marks.getByRole('button', { name: 'Source check · needs attention' })).toHaveAttribute(
      'aria-current',
      'step',
    )
    // One word in a tag, never an exclamation mark.
    expect(
      marks.getByRole('button', { name: 'Source check · needs attention' }).textContent,
    ).toMatch(/^Source checkFix/)
    expect(indicator().textContent).not.toContain('!')
    expect(
      marks
        .getByRole('button', { name: 'Who sees it · needs attention' })
        .hasAttribute('aria-current'),
    ).toBe(false)
    for (const name of ['Tags', 'Where sources go', 'Expiry', 'Market versions']) {
      expect(marks.getByRole('button', { name })).toBeInTheDocument()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(marks.getByRole('button', { name: 'Who sees it · needs attention' })).toHaveAttribute(
      'aria-current',
      'step',
    )
    cleanup()

    // The check found every sentence and the why line is not needed; an expiry date is still to choose.
    view({ current: { ...withSettings(GENERAL_90), sourceCheck: checked('found') } }, slots)
    openPanel('Expiry')
    fireEvent.click(screen.getByRole('radio', { name: 'On a date' }))
    expect(within(indicator()).getByRole('button', { name: 'Source check' })).toBeInTheDocument()
    expect(within(indicator()).getByRole('button', { name: 'Who sees it' })).toBeInTheDocument()
    expect(
      within(indicator()).getByRole('button', { name: 'Expiry · needs attention' }),
    ).toBeInTheDocument()
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
