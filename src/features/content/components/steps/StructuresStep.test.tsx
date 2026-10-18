/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import { toast } from 'sonner'
import type { Staff } from '@/shared/lib/auth/access'
import { PAID_WORK_TEXTS, PAID_WORK_TITLE } from '../../demo-sources/paid-work'
import { type Body, emptyPointers } from '../../model/artifacts'
import type { CurrentPost } from '../../model/current'
import type { ClaimResult, Fact, FitCheck, Template } from '../../model/types'
import type { Saved } from '../../server/commands'
import * as templates from '../../templates'
import { nativeOf } from '../../text/native-fixtures'

const refresh = mock(() => {})
const push = mock((_: string) => {})
const success = spyOn(toast, 'success')
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh }),
}))

// The templates in the repo, counted before the mock below patches the module in place.
const IN_REPO = templates.TEMPLATES.length

// A fifth template file, as if added to the repo (criterion 69).
const FIFTH: Template = {
  ...structuredClone(templates.TEMPLATES[0]),
  id: 'the-fifth',
  name: 'Article carousel · The fifth',
}
mock.module('../../templates', () => ({
  ...templates,
  TEMPLATES: [...templates.TEMPLATES, FIFTH],
}))

const { StructuresStep } = await import('./StructuresStep')
type Props = Parameters<typeof StructuresStep>[0]

const template = (id: string) => {
  const t = templates.templateById(id)
  if (!t) throw new Error(`no template ${id}`)
  return t
}

const FACTS: Fact[] = [
  {
    id: 'f1',
    text: 'Above 20 hrs/week: pass rates −11 points',
    value: { number: -11, unit: 'points' },
    ref: '¶3',
    quote: 'Above 20 hours a week, pass rates fell by 11 percentage points.',
    supported: true,
    why: null,
    span: null,
  },
  {
    id: 'f2',
    text: 'Up to 20 hours a week, grades held',
    value: null,
    ref: '¶2',
    quote:
      'Students working up to 20 hours a week had grades similar to students who did not work.',
    supported: true,
    why: null,
    span: null,
  },
]

const plain = (text: string) => ({ text, factIds: [], factual: false })
const bound = (text: string, factIds: string[]) => ({ text, factIds, factual: true })
const cover = {
  kind: 'cover' as const,
  slots: { kicker: plain('Paid work'), phrase: plain('The line'), byline: plain('OfCourse') },
}
const take = { kind: 'take' as const, slots: { takeaway: plain('Keep it under 20.') } }

const DRAFTS: Body<'drafts'> = {
  factsId: 'facts1',
  attempt: 1,
  replays: [],
  emotion: null,
  note: null,
  items: [
    {
      template: template('the-long-read'),
      structure: {
        templateId: 'the-long-read',
        artPrompt: 'A quiet desk at dusk.',
        slides: [
          cover,
          {
            kind: 'body',
            slots: {
              heading: plain('What the survey found'),
              body: bound('Above 20 hours a week, pass rates fell by 11 percentage points.', [
                'f1',
              ]),
            },
          },
          {
            kind: 'body',
            slots: {
              heading: plain('Why it matters'),
              body: bound('Most students fail when they work.', []),
            },
          },
          take,
        ],
      },
    },
    // Three versions of the line (criterion 97), at the flattened indexes 1–3.
    lineVersion('The surprising number', 'Up to 20'),
    lineVersion('The practical advice', 'Keep it under 20'),
    lineVersion('The question to ask', 'How many hours?'),
  ],
}

function lineVersion(angle: string, heading: string): Body<'drafts'>['items'][number] {
  return {
    template: template('the-line'),
    angle,
    problems: [],
    structure: {
      templateId: 'the-line',
      artPrompt: 'A quiet desk at dusk.',
      slides: [
        cover,
        {
          kind: 'body',
          slots: {
            heading: plain(heading),
            body: bound(
              'Students working up to 20 hours a week had grades similar to students who did not work.',
              ['f2'],
            ),
          },
        },
        take,
      ],
    },
  }
}

const CONTRAST: FitCheck = {
  check: 'contrast',
  slide: null,
  slot: null,
  value: 14.4,
  limit: '4.5:1',
  pass: true,
  label: 'Contrast · Paper 14.4:1 · OK',
}
const OVER: FitCheck = {
  check: 'length',
  slide: 2,
  slot: 'body',
  value: 121,
  limit: '30–70 words',
  pass: false,
  label: 'Slide 2 · 121 words (30–70) · Over',
}

const current = (over: Partial<CurrentPost> = {}): CurrentPost => ({
  source: {
    id: 'src1',
    body: {
      title: PAID_WORK_TITLE,
      kind: 'research summary',
      text: PAID_WORK_TEXTS.join('\n\n'),
      paragraphs: PAID_WORK_TEXTS.map((text, i) => ({ ref: `¶${i + 1}`, text })),
      demoKey: null,
      language: 'en',
    },
  },
  facts: { id: 'facts1', body: { sourceId: 'src1', keyIdeas: [], facts: FACTS, replays: [] } },
  drafts: { id: 'd1', body: DRAFTS },
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
  ...over,
})

const VIEW: Props['view'] = {
  id: 'p1',
  title: PAID_WORK_TITLE,
  stage: 'structures',
  version: 4,
  pointers: {
    ...emptyPointers(),
    sourceId: 'src1',
    factsId: 'facts1',
    draftsId: 'd1',
    ticked: ['the-long-read', 'the-line'],
    picked: 0,
    themeId: 'paper',
  },
  current: current(),
  createdAt: '2026-10-05T09:12:00.000Z',
  running: [],
  draftChecks: [[OVER, CONTRAST], [CONTRAST]],
}

const saved = (version: number) => async (): Promise<Saved> => ({ ok: true, id: 'p1', version })
const actions = {
  tickTemplatesAction: mock(async (_id: unknown, _at: unknown, _ids: unknown) => saved(5)()),
  draftAction: mock(async (_id: unknown, _at: unknown, _again: unknown) => saved(6)()),
  pickAction: mock(async (_id: unknown, _at: unknown, _pick: unknown) => saved(5)()),
  themeAction: mock(async (_id: unknown, _at: unknown, _theme: unknown) => saved(5)()),
  fixUnboundAction: mock(async (_id: unknown, _at: unknown, _slot: unknown) => saved(5)()),
  editSlotAction: mock(async (_id: unknown, _at: unknown, _edit: unknown) => saved(5)()),
  measureSlotAction: mock(async (_id: unknown, _at: unknown, _edit: unknown) => ({
    ok: true as const,
    rows: [{ ...OVER, slide: 2, slot: 'body', label: 'Slide 2 · body · as typed · Over' }],
  })),
  redraftSlideAction: mock(async (_id: unknown, _at: unknown, _slide: unknown) => saved(5)()),
  applySourceWordingAction: mock(async (_id: unknown, _at: unknown, _claim: unknown) => saved(5)()),
  markOpinionAction: mock(async (_id: unknown, _at: unknown, _claim: unknown) => saved(5)()),
  checkSourceAction: mock(async (_id: unknown, _at: unknown) => saved(5)()),
  approveStructureAction: mock(async (_id: unknown, _at: unknown) => saved(5)()),
  backAction: mock(async (_id: unknown, _at: unknown, _to: unknown) => saved(5)()),
  choosePageAction: mock(async (_id: unknown, _at: unknown, _page: unknown) => saved(5)()),
  nudgeSlideAction: mock(async (_id: unknown, _at: unknown, _input: unknown) => saved(5)()),
  nudgeVersionAction: mock(async (_id: unknown, _at: unknown, _input: unknown) => saved(5)()),
  setSlideLayoutAction: mock(async (_id: unknown, _at: unknown, _input: unknown) => saved(5)()),
  setLookAction: mock(async (_id: unknown, _at: unknown, _input: unknown) => saved(5)()),
  setPresetAction: mock(async (_id: unknown, _at: unknown, _preset: unknown) => saved(5)()),
}

const EDITOR: Staff = { role: 'user', editor: true }
const ADMIN: Staff = { role: 'admin' }

const onBackToIdeas = mock(() => {})
const view = (over: Partial<Props['view']> = {}, viewer: Staff = EDITOR) =>
  render(
    <StructuresStep
      view={{ ...VIEW, ...over }}
      viewer={viewer}
      actions={actions}
      onBackToIdeas={onBackToIdeas}
    />,
  )

/** The picked version's editor: its status, the selected slide's text and what changes it (GD24). */
const editor = () => screen.getByRole('region', { name: /^Your version/ })
/** The picked version's selected slide large over its filmstrip, beside its editor (GD30). */
const large = () => screen.getByRole('region', { name: 'Slides' })
/** Shows slide `n` of the picked version large, from its filmstrip. */
const select = (n: number) =>
  fireEvent.click(within(large()).getByRole('button', { name: `Slide ${n}` }))
/** Opens a tab of the step's controls by its name (a badge, if any, follows it). */
const openTab = (name: string) =>
  fireEvent.click(screen.getByRole('tab', { name: new RegExp(`^${name}( · |$)`) }))
/** Opens the "Checks" tab, the last (17 Oct): the picked version's problems first, each a card with its fix. */
const checksTab = () => {
  openTab('Checks')
  return screen.getByRole('tabpanel', { name: /^Checks/ })
}
/** The card in the Checks tab's "To fix" list that holds `text`. */
const fixCard = (text: string) => {
  const card = within(checksTab()).getByText(text).closest('li')
  if (!card) throw new Error(`no card for ${text}`)
  return card
}
/** A table's rows, header first, each as its cells' text. */
const cells = (table: HTMLElement) =>
  [...table.querySelectorAll('tr')].map((tr) =>
    [...tr.querySelectorAll('th, td')].map((c) => c.textContent ?? ''),
  )
/** Whether the tab whose name starts `name` is the open one. */
const isOpen = (name: string) =>
  screen.getByRole('tab', { name: new RegExp(`^${name}( · |$)`) }).getAttribute('aria-selected')
/** Opens the drawer behind a button in `scope` ("Details") and returns it. */
const drawer = (scope: HTMLElement, trigger = 'Details') => {
  fireEvent.click(within(scope).getByRole('button', { name: trigger }))
  return screen.getByRole('dialog')
}

afterEach(() => {
  cleanup()
  refresh.mockClear()
  push.mockClear()
  onBackToIdeas.mockClear()
  success.mockClear()
  for (const a of Object.values(actions)) a.mockClear()
})

describe('StructuresStep', () => {
  it('lists every template and keeps "Draft versions" disabled at none or four ticks', () => {
    view({ pointers: { ...VIEW.pointers, ticked: [] }, current: current({ drafts: null }) })
    const draft = screen.getByRole('button', { name: 'Draft versions' })
    expect(draft).toBeDisabled()
    expect(screen.getByText('Tick one to three templates.')).toBeInTheDocument()

    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(IN_REPO + 1)
    for (const box of boxes.slice(0, 3)) fireEvent.click(box)
    expect(draft).toBeEnabled()
    fireEvent.click(boxes[3])
    expect(draft).toBeDisabled()
    expect(screen.getByText('Tick one to three templates.')).toBeInTheDocument()
  })

  it('lists a template added to the repo', () => {
    view({ pointers: { ...VIEW.pointers, ticked: [] }, current: current({ drafts: null }) })
    expect(screen.getByRole('checkbox', { name: /The fifth/ })).toBeInTheDocument()
  })

  it('saves new ticks, then drafts on the version they made', async () => {
    view({ pointers: { ...VIEW.pointers, ticked: [] }, current: current({ drafts: null }) })
    fireEvent.click(screen.getByRole('checkbox', { name: /Field Notes/ }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Draft versions' }))
    })
    expect(actions.tickTemplatesAction).toHaveBeenCalledWith('p1', 4, ['field-notes'])
    expect(actions.draftAction).toHaveBeenCalledWith('p1', 5, false, null)
  })

  it('after a failed draft step says so, keeps the facts, and drafts again from "Try again" (93)', async () => {
    view({
      pointers: { ...VIEW.pointers, ticked: ['the-line'] },
      current: current({ drafts: null }),
      failed: ['draft'],
    })
    expect(screen.getByText('Drafting failed. Your facts are kept.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Draft versions' })).toBeNull()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    })
    expect(actions.tickTemplatesAction).not.toHaveBeenCalled()
    expect(actions.draftAction).toHaveBeenCalledWith('p1', 4, false, null)
  })

  it('asks for fresh drafts with "Draft again"', async () => {
    view()
    openTab('Redraft')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Draft again' }))
    })
    expect(actions.tickTemplatesAction).not.toHaveBeenCalled()
    expect(actions.draftAction).toHaveBeenCalledWith('p1', 4, true, null)
  })

  it('drafts with the pressed emotion chip, or with the editor’s own word in its place (100)', async () => {
    view()
    openTab('Redraft')
    const hopeful = screen.getByRole('button', { name: 'Hopeful' })
    fireEvent.click(hopeful)
    expect(hopeful).toHaveAttribute('aria-pressed', 'true')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Draft again' }))
    })
    expect(actions.draftAction).toHaveBeenLastCalledWith('p1', 4, true, 'hopeful')

    fireEvent.change(screen.getByRole('textbox', { name: 'Your own word' }), {
      target: { value: 'Wistful' },
    })
    expect(hopeful).toHaveAttribute('aria-pressed', 'false')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Draft again' }))
    })
    expect(actions.draftAction).toHaveBeenLastCalledWith('p1', 4, true, 'Wistful')
  })

  it('takes the editor’s own word in Thai up to 30 characters as a reader sees them, and drafts with it (GD37)', async () => {
    view()
    openTab('Redraft')
    const word = nativeOf('th', 30)
    const field = screen.getByRole('textbox', { name: 'Your own word' })
    fireEvent.change(field, { target: { value: `${word}ก` } })
    expect(field).toHaveValue(word)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Draft again' }))
    })
    expect(actions.draftAction).toHaveBeenLastCalledWith('p1', 4, true, word)
  })

  it('shows the drafts’ recorded emotion as the pressed chip, or as the editor’s word', () => {
    view({ current: current({ drafts: { id: 'd1', body: { ...DRAFTS, emotion: 'calm' } } }) })
    openTab('Redraft')
    expect(screen.getByRole('button', { name: 'Calm' })).toHaveAttribute('aria-pressed', 'true')
    cleanup()
    view({ current: current({ drafts: { id: 'd1', body: { ...DRAFTS, emotion: 'Wistful' } } }) })
    openTab('Redraft')
    expect(screen.getByRole('textbox', { name: 'Your own word' })).toHaveValue('Wistful')
    expect(screen.getByRole('button', { name: 'Calm' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reads "Text" as the step heading (GD25)', () => {
    view()
    expect(screen.getByRole('heading', { level: 2, name: 'Text' })).toBeInTheDocument()
    expect(screen.queryByText('Structures')).toBeNull()
  })

  it('shows each bound fact once per slide as its numbered chip, opening its sentence, and never "not a fact · checked" (GD23)', () => {
    view()
    select(2)
    openTab('Your version')
    const chips = within(editor()).getAllByRole('button', { name: '¶3' })
    expect(chips).toHaveLength(1)
    fireEvent.click(chips[0])
    expect(
      screen.getByText('Hours of paid work and first-year results · ¶3 · checked 5 Oct 2026'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/not a fact/)).toBeNull()
  })

  it('labels an unbound slot "Not in the source" and offers a supported fact in its place in "Checks" (GD23)', async () => {
    view()
    select(3)
    openTab('Your version')
    expect(within(editor()).getByText('Not in the source')).toBeInTheDocument()
    expect(screen.queryByText('No source')).toBeNull()
    // Its card: where, what is wrong, the sentence at fault, and its fix.
    const row = fixCard('“Most students fail when they work.”')
    expect(row.textContent).toContain('Slide 3 · Body')
    expect(row.textContent).toContain('Not in the source')
    const fact = within(row).getByRole('combobox', { name: 'Supported fact' })
    fireEvent.change(fact, { target: { value: 'f2' } })
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'Fix unbound claim' }))
    })
    expect(actions.fixUnboundAction).toHaveBeenCalledWith('p1', 4, {
      slide: 3,
      slot: 'body',
      factId: 'f2',
    })
  })

  it('draws each slide of a draft from the preview route with the chosen theme', () => {
    view()
    const first = screen.getAllByRole('img', { name: /^Slide 1\b/ })[0]
    expect(first).toHaveAttribute(
      'src',
      '/admin/posts/p1/preview?drafts=d1&i=0&slide=1&theme=paper',
    )
    // The long read's slide 4, picked: once, in its filmstrip (whose thumbnails a reader skips), as
    // its card gives way to the editor; the other versions' cards show their first slide.
    expect(screen.getAllByRole('img', { name: /^Slide 4\b/, hidden: true })).toHaveLength(1)
    openTab('Versions')
    expect(screen.getAllByRole('img', { name: /^Slide 4\b/, hidden: true })).toHaveLength(1)
  })

  it('puts a template’s versions in one row, each labelled by its angle, and picks by the flattened index (97)', async () => {
    view()
    openTab('Versions')
    const versions = [
      'Article carousel · The line · The surprising number',
      'Article carousel · The line · The practical advice',
      'Article carousel · The line · The question to ask',
    ].map((name) => screen.getByRole('article', { name }))
    const row = versions[0].parentElement
    if (!row) throw new Error('no version row')
    expect(versions.every((v) => v.parentElement === row)).toBe(true)
    expect(within(versions[1]).getByText('The practical advice')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(within(versions[1]).getByRole('button', { name: 'Use this version' }))
    })
    expect(actions.pickAction).toHaveBeenCalledWith('p1', 4, 2)
  })

  it('loads an older drafts record, one structure per template, as one version named by its template', () => {
    view()
    openTab('Your version')
    expect(within(editor()).getByText('Article carousel · The long read')).toBeInTheDocument()
    cleanup()
    view({ pointers: { ...VIEW.pointers, picked: 1 } })
    openTab('Versions')
    const legacy = screen.getByRole('article', { name: 'Article carousel · The long read' })
    expect(
      within(legacy).getByRole('heading', { name: 'Article carousel · The long read' }),
    ).toBeInTheDocument()
  })

  it('shows a version that failed verification with its problems and no "Use this version"', () => {
    const problem = 'slides.0.slots.kicker: remove "best".'
    const items = DRAFTS.items.map((item, i) => (i === 3 ? { ...item, problems: [problem] } : item))
    view({ current: current({ drafts: { id: 'd1', body: { ...DRAFTS, items } } }) })
    openTab('Versions')
    const failed = screen.getByRole('article', {
      name: 'Article carousel · The line · The question to ask',
    })
    expect(within(failed).getByText(problem)).toBeInTheDocument()
    expect(within(failed).queryByRole('button', { name: 'Use this version' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Use this version' })).toHaveLength(2)
  })

  it("shows a draft's fit rows before approval as a table per slide, with no Pass or Fail to press", () => {
    view()
    const panel = checksTab()
    const slide = within(panel).getByRole('table', { name: 'Slide 2' })
    expect(cells(slide)).toEqual([
      ['Slot', 'Length', 'Limit', 'Status'],
      ['Body', '121 words', '30–70 words', 'Over'],
    ])
    expect(within(panel).getByRole('table', { name: 'Whole post' })).toBeInTheDocument()
    expect(within(panel).queryAllByRole('button', { name: /^(Pass|Fail)$/ })).toHaveLength(0)
    expect(document.querySelector('details') === null).toBe(true)
  })

  it('names the themes without their contrast ratios, which stay in the checks (GD25)', () => {
    view()
    openTab('Style')
    for (const name of ['Paper', 'Ink', 'Signal']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    expect(screen.queryByText(/^(Paper|Ink|Signal) \d/)).toBeNull()
    const post = within(checksTab()).getByRole('table', { name: 'Whole post' })
    expect(cells(post)).toContainEqual(['Contrast · Paper', '14.4:1', '4.5:1', 'OK'])
  })

  it("changes the post's page, None as null, for the drafts and covers made after (105)", async () => {
    view({ pointers: { ...VIEW.pointers, pageBrandId: 'cerebral' } })
    openTab('Style')
    const page = screen.getByLabelText('Page')
    expect(page).toHaveValue('cerebral')
    // A feed post never goes on the Comics page, which takes only comics (RC7).
    expect([...(page as HTMLSelectElement).options].map((o) => o.value)).toEqual([
      '',
      'main',
      'cerebral',
      'infographics',
    ])
    await act(async () => {
      fireEvent.change(page, { target: { value: 'main' } })
    })
    expect(actions.choosePageAction).toHaveBeenLastCalledWith('p1', 4, 'main')
    await act(async () => {
      fireEvent.change(page, { target: { value: '' } })
    })
    expect(actions.choosePageAction).toHaveBeenLastCalledWith('p1', 4, null)
  })

  it('shows an admin the page without a control, and a post from before pages as None (105)', () => {
    const { pageBrandId: _, ...older } = VIEW.pointers
    view({ pointers: older as Props['view']['pointers'] }, ADMIN)
    openTab('Style')
    expect(screen.queryByLabelText('Page')).toBeNull()
    expect(screen.getByText('Page: None')).toBeInTheDocument()
  })

  it('keeps "Approve text" unavailable while a claim has no source, its reason counting what is left and pointing to Checks', () => {
    view()
    expect(screen.getByRole('button', { name: 'Approve text → Images' })).toBeDisabled()
    // The unbound claim and the overlong body: two to fix, named in the Checks tab.
    expect(screen.getByText('2 to fix: open Checks')).toBeInTheDocument()
    expect(screen.queryByText('A claim has no source. Fix it before approving.')).toBeNull()
  })

  it('shows a post drafted before draftChoices, with no theme stored, in the default one, chosen, and never asks for one', () => {
    const none = { ...VIEW.pointers, themeId: null }
    view({ pointers: none })
    openTab('Style')
    expect(screen.getByRole('button', { name: 'Paper' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByText('Choose a theme first.')).toBeNull()
    expect(screen.getAllByRole('img', { name: /^Slide 1\b/ })[0].getAttribute('src')).toContain(
      'theme=paper',
    )
    cleanup()
    // A version with nothing to fix and no theme stored is approved as it is.
    view({ pointers: { ...none, picked: 1 } })
    expect(screen.getByRole('button', { name: 'Approve text → Images' })).toBeEnabled()
  })

  it('approves a structure whose claims all stand, even with a failing fit row', async () => {
    view({ pointers: { ...VIEW.pointers, picked: 1 } })
    const approve = screen.getByRole('button', { name: 'Approve text → Images' })
    expect(approve).toBeEnabled()
    await act(async () => {
      fireEvent.click(approve)
    })
    expect(actions.approveStructureAction).toHaveBeenCalledWith('p1', 4)
    expect(refresh).toHaveBeenCalled()
  })

  it('goes on to the images screen once "Approve text" succeeds, and stays when it is refused (GD27)', async () => {
    view({ pointers: { ...VIEW.pointers, picked: 1 } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Approve text → Images' }))
    })
    expect(push).toHaveBeenCalledWith('/admin/posts/p1/images')
    push.mockClear()
    actions.approveStructureAction.mockImplementationOnce(async () => ({
      ok: false as const,
      error: 'This post has moved on. Reload to see where it is.',
    }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Approve text → Images' }))
    })
    expect(push).not.toHaveBeenCalled()
  })

  it('offers an admin no control at all: only the slides to look through and the details to read', () => {
    view({}, ADMIN)
    // Each tab, its buttons by name: none that changes the post.
    const controls = () =>
      screen
        .queryAllByRole('button')
        .map((b) => b.getAttribute('aria-label') ?? b.textContent ?? '')
        .filter((name) => !/^(Details|Slide \d+)$/.test(name))
    for (const tab of ['Versions', 'Style', 'Redraft']) {
      openTab(tab)
      expect(controls()).toEqual([])
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    }
    openTab('Style')
    expect(screen.getByText('Paper')).toBeInTheDocument()
    // The details hold the fact chips to read, and no control either.
    openTab('Versions')
    const details = drawer(screen.getAllByRole('article')[0])
    const inside = within(details)
      .queryAllByRole('button')
      .map((b) => b.textContent ?? '')
      .filter((name) => !/^(¶\d+|Close)$/.test(name))
    expect(inside).toEqual([])
  })

  it('shows a running draft as "Running…" with Draft disabled', () => {
    view({ running: ['draft'] })
    openTab('Redraft')
    expect(screen.queryByRole('button', { name: 'Draft versions' })).toBeNull()
    for (const button of screen.getAllByRole('button', { name: 'Running…' })) {
      expect(button).toBeDisabled()
    }
  })

  describe('editing the picked version on its slides, checked as it goes (98, 104)', () => {
    const SUGGESTION = 'Above 20 hours a week, pass rates fell by 11 percentage points.'
    const checked = (claims: ClaimResult[]) =>
      current({
        sourceCheck: {
          id: 'sc1',
          body: { revisionId: null, draft: { draftsId: 'd1', index: 0 }, claims, replays: [] },
        },
      })
    const FOUND: ClaimResult = {
      text: SUGGESTION,
      slide: 2,
      slot: 'body',
      result: 'found',
      ref: '¶3',
    }
    const FLAGGED: ClaimResult = {
      text: 'Most students fail when they work.',
      slide: 3,
      slot: 'body',
      result: 'not_found',
      ref: null,
      suggestion: { ref: '¶3', text: SUGGESTION },
    }

    it('edits a slot of the picked version in place on its large slide and saves the text as typed', async () => {
      view()
      select(2)
      fireEvent.click(within(large()).getByRole('button', { name: 'Edit Slide 2 · Body' }))
      const field = within(large()).getByRole('textbox', { name: 'Slide 2 · Body' })
      expect(field).toHaveValue('Above 20 hours a week, pass rates fell by 11 percentage points.')
      fireEvent.change(field, { target: { value: 'Pass rates fell by 11 points above 20 hours.' } })
      await act(async () => {
        fireEvent.click(within(large()).getByRole('button', { name: 'Save' }))
      })
      expect(actions.editSlotAction).toHaveBeenCalledWith('p1', 4, {
        slide: 2,
        slot: 'body',
        text: 'Pass rates fell by 11 points above 20 hours.',
      })
    })

    it('measures the slot as the editor types, by the post and its version, and shows the rows (98)', async () => {
      view()
      select(2)
      fireEvent.click(within(large()).getByRole('button', { name: 'Edit Slide 2 · Body' }))
      const field = within(large()).getByRole('textbox', { name: 'Slide 2 · Body' })
      fireEvent.change(field, { target: { value: 'Pass rates fell.' } })
      const fit = await within(large()).findByRole('list', { name: 'Fit as typed' })
      expect(fit).toHaveTextContent('Slide 2 · body · as typed · Over')
      expect(actions.measureSlotAction).toHaveBeenCalledWith('p1', 4, {
        slide: 2,
        slot: 'body',
        text: 'Pass rates fell.',
      })
    })

    it("edits the selected slide's text in fields beside it, counted as typed, saved when a field is left (C1)", async () => {
      view()
      select(2)
      openTab('Your version')
      const heading = within(editor()).getByRole('textbox', { name: 'Heading' })
      expect(heading).toHaveValue('What the survey found')
      expect(heading).toHaveAccessibleDescription('21 of 1–24 characters')
      fireEvent.change(heading, { target: { value: 'What we found' } })
      expect(heading).toHaveAccessibleDescription('13 of 1–24 characters')
      await act(async () => {
        fireEvent.blur(heading)
      })
      expect(actions.editSlotAction).toHaveBeenCalledWith('p1', 4, {
        slide: 2,
        slot: 'heading',
        text: 'What we found',
      })
      // The slide's own targets stay a second way in.
      expect(
        within(large()).getByRole('button', { name: 'Edit Slide 2 · Heading' }),
      ).toBeInTheDocument()
    })

    it("says a refusal of a field's save under that field, and not under the others (C1)", async () => {
      const refusal = 'Keep every number from a fact on this slide'
      actions.editSlotAction.mockImplementationOnce(async () => ({ ok: false, error: refusal }))
      view()
      select(2)
      openTab('Your version')
      const body = within(editor()).getByRole('textbox', { name: 'Body' })
      fireEvent.change(body, { target: { value: 'Above 20 hours a week, pass rates fell by 47.' } })
      await act(async () => {
        fireEvent.blur(body)
      })
      expect(body).toHaveAccessibleDescription(new RegExp(refusal))
      expect(
        within(editor()).getByRole('textbox', { name: 'Heading' }),
      ).not.toHaveAccessibleDescription(new RegExp(refusal))
    })

    it('offers "Another take" on the selected slide of a legacy post’s picked version only, naming the slide (99)', async () => {
      view()
      select(2)
      openTab('Your version')
      expect(within(editor()).getAllByRole('button', { name: /^Another take/ })).toHaveLength(1)
      await act(async () => {
        fireEvent.click(within(editor()).getByRole('button', { name: 'Another take · Slide 2' }))
      })
      expect(actions.redraftSlideAction).toHaveBeenCalledWith('p1', 4, 2)
      openTab('Versions')
      const other = screen.getByRole('article', {
        name: 'Article carousel · The line · The surprising number',
      })
      expect(within(other).queryByRole('button', { name: /^Another take/ })).toBeNull()
      cleanup()
      view({}, ADMIN)
      expect(screen.queryByRole('button', { name: /^Another take/ })).toBeNull()
    })

    it('shows a take running on its slide, and "Try again" on a slide whose take failed (99)', () => {
      view({ running: ['draft_slide:2'] })
      select(2)
      openTab('Your version')
      expect(within(editor()).getByRole('button', { name: 'Running…' })).toBeDisabled()
      expect(within(editor()).queryByRole('button', { name: 'Another take · Slide 2' })).toBeNull()
      select(3)
      expect(within(editor()).getByRole('button', { name: 'Another take · Slide 3' })).toBeEnabled()
      cleanup()
      view({ failed: ['draft_slide:3'] })
      select(3)
      openTab('Your version')
      expect(within(editor()).getByRole('button', { name: 'Try again · Slide 3' })).toBeEnabled()
      expect(
        within(editor()).getByText('Another take failed. Your slide is kept.'),
      ).toBeInTheDocument()
      select(2)
      expect(within(editor()).getByRole('button', { name: 'Another take · Slide 2' })).toBeEnabled()
    })

    it('edits only the picked version', () => {
      view()
      openTab('Versions')
      const other = screen.getByRole('article', {
        name: 'Article carousel · The line · The surprising number',
      })
      expect(within(other).queryByRole('button', { name: /^Edit Slide/ })).toBeNull()
    })

    it("shows a flagged sentence in Checks as a card with the source's paragraph, and uses the source's wording in one click", async () => {
      view({ current: checked([FOUND, FLAGGED]) })
      const row = fixCard(`Source ¶3: ${SUGGESTION}`)
      expect(row.textContent).toContain('Slide 3 · Body')
      expect(row.textContent).toContain('Not found in the source')
      expect(row.textContent).toContain(`“${FLAGGED.text}”`)
      await act(async () => {
        fireEvent.click(within(row).getByRole('button', { name: "Use the source's wording" }))
      })
      expect(actions.applySourceWordingAction).toHaveBeenCalledWith('p1', 4, 1)
      // The found sentence is not flagged.
      expect(within(checksTab()).queryByText(`“${SUGGESTION}”`)).toBeNull()
    })

    it("marks a sentence not found as the editor's opinion from its card in Checks, beside the source's wording, with the post's usual toast", async () => {
      const NO_SUGGESTION: ClaimResult = { ...FLAGGED, slide: 2, suggestion: undefined }
      view({ current: checked([FOUND, FLAGGED, NO_SUGGESTION]) })
      const row = fixCard(`Source ¶3: ${SUGGESTION}`)
      expect(
        within(row)
          .getAllByRole('button')
          .map((b) => b.textContent),
      ).toEqual(["Use the source's wording", "Mark as editor's opinion"])
      await act(async () => {
        fireEvent.click(within(row).getByRole('button', { name: "Mark as editor's opinion" }))
      })
      expect(actions.markOpinionAction).toHaveBeenCalledWith('p1', 4, 1)
      expect(success).toHaveBeenCalledWith('Marked as editorial opinion')
      // A sentence with no source sentence to use is still offered as opinion, by its own place.
      const bare = within(checksTab())
        .getAllByText('Not found in the source')
        .map((what) => what.closest('li'))
        .find((li) => li?.textContent?.includes('Slide 2 · Body'))
      if (!bare) throw new Error('no card for the bare sentence')
      await act(async () => {
        fireEvent.click(within(bare).getByRole('button', { name: "Mark as editor's opinion" }))
      })
      expect(actions.markOpinionAction).toHaveBeenLastCalledWith('p1', 4, 2)
    })

    it('on a Thai post, an English source sentence is not offered as the wording: the card says to edit the slide in Thai, and Edit opens Your version', () => {
      const thai = checked([FOUND, FLAGGED])
      if (!thai.source) throw new Error('no source')
      thai.source.body.language = 'th'
      view({ current: thai })
      const row = fixCard(`Source ¶3: ${SUGGESTION}`)
      expect(
        within(row).queryAllByRole('button', { name: "Use the source's wording" }).length,
      ).toBe(0)
      expect(row.textContent).toContain('The source is in English; edit the slide in Thai instead.')
      // Opinion is not a matter of the post's language.
      expect(
        within(row).queryAllByRole('button', { name: "Mark as editor's opinion" }).length,
      ).toBe(1)
      fireEvent.click(within(row).getByRole('button', { name: 'Edit the slide' }))
      expect(isOpen('Your version')).toBe('true')
      // At the flagged sentence's slide.
      expect(within(large()).queryAllByRole('button', { name: 'Edit Slide 3 · Body' }).length).toBe(
        1,
      )
    })

    it('sums the source check in one line and lists the sentences not found only in To fix', () => {
      view({ current: checked([FOUND, FLAGGED]) })
      const panel = checksTab()
      const source = within(panel).getByRole('region', { name: 'Source check' })
      expect(within(source).getByText('1 found · 1 not found · 0 opinion')).toBeInTheDocument()
      expect(source.textContent).not.toContain(FLAGGED.text)
      // Counted once each in To fix: the overlong body, the unbound claim and the sentence not found.
      const toFix = within(panel).getByRole('list', { name: 'To fix' })
      expect(within(toFix).getAllByRole('listitem').length).toBe(3)
      expect(screen.getByRole('tab', { name: 'Checks · 3 to fix' })).toBeInTheDocument()
    })

    it('says the check is running, then that every sentence was found', () => {
      view({ running: ['source_check'] })
      expect(within(checksTab()).getByText('Checking against the source…')).toBeInTheDocument()
      expect(within(checksTab()).queryByRole('button', { name: 'Try again' })).toBeNull()
      cleanup()
      view({ current: checked([FOUND]) })
      expect(within(checksTab()).getByText('1 found · 0 not found · 0 opinion')).toBeInTheDocument()
    })

    it('offers "Try again" when the check failed, and no "Run source check" ever', async () => {
      view({ failed: ['source_check'] })
      expect(screen.queryByRole('button', { name: 'Run source check' })).toBeNull()
      const retry = within(checksTab()).getByRole('button', { name: 'Try again' })
      await act(async () => {
        fireEvent.click(retry)
      })
      expect(actions.checkSourceAction).toHaveBeenCalledWith('p1', 4)
    })
  })

  it('shows a passed Text step editable in place, with no "Back to text versions" and no approval to press (GD28)', () => {
    for (const stage of ['approved', 'rendered', 'in_review', 'live'] as const) {
      view({ stage })
      select(2)
      expect(
        within(large()).getByRole('button', { name: 'Edit Slide 2 · Body' }),
      ).toBeInTheDocument()
      openTab('Versions')
      expect(screen.getAllByRole('button', { name: 'Use this version' }).length).toBeGreaterThan(0)
      expect(screen.queryByRole('button', { name: 'Back to text versions' })).toBeNull()
      expect(screen.queryByRole('region', { name: /^Go back/ })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Approve text → Images' })).toBeNull()
      cleanup()
    }
  })

  it('saves an edit at a passed step straight away and shows the note of what will be made again (GD28)', async () => {
    const note = 'Text changed: the slides will be rendered again'
    actions.editSlotAction.mockImplementationOnce(async () => ({
      ok: true,
      id: 'p1',
      version: 5,
      note,
    }))
    view({ stage: 'rendered' })
    select(2)
    fireEvent.click(within(large()).getByRole('button', { name: 'Edit Slide 2 · Body' }))
    const field = within(large()).getByRole('textbox', { name: 'Slide 2 · Body' })
    fireEvent.change(field, { target: { value: 'Pass rates fell by 11 points above 20 hours.' } })
    await act(async () => {
      fireEvent.click(within(large()).getByRole('button', { name: 'Save' }))
    })
    expect(actions.editSlotAction).toHaveBeenCalledWith('p1', 4, {
      slide: 2,
      slot: 'body',
      text: 'Pass rates fell by 11 points above 20 hours.',
    })
    expect(success).toHaveBeenCalledWith('Text saved', { description: note })
  })

  it("shows a reviewer's request for changes naming the text versions in this step (120)", () => {
    const by = { userId: 'u-ravi', name: 'Ravi K.', at: '2026-10-05T09:12:00.000Z' }
    const sendBack = (step: 'structures' | 'covers') => ({
      id: 'sb1',
      body: { revisionId: 'r1', reason: 'Say who pays.', by, step },
    })
    view({ current: { ...VIEW.current, sendBack: sendBack('structures') } })
    expect(screen.getByText(/Changes requested by Ravi K\..*Say who pays\./)).toBeInTheDocument()
    cleanup()
    view({ current: { ...VIEW.current, sendBack: sendBack('covers') } })
    expect(screen.queryByText(/Say who pays\./)).toBeNull()
  })

  it('shows a passed Text step read-only to a viewer who may not edit: the approved version alone', () => {
    view({ stage: 'approved' }, ADMIN)
    expect(screen.queryByRole('region', { name: /^Your version/ })).toBeNull()
    // One group of controls, the versions, so no tabs: the approved version's card in plain view.
    expect(screen.queryByRole('tablist') === null).toBe(true)
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('at a passed step, keeps the edit controls disabled with the running step in words while one runs (122)', () => {
    view({ stage: 'rendered', running: ['covers'] })
    expect(screen.getAllByText('Covers are being drawn').length).toBeGreaterThan(0)
    select(2)
    openTab('Your version')
    expect(within(editor()).getByRole('button', { name: 'Another take · Slide 2' })).toBeDisabled()
    openTab('Redraft')
    expect(screen.getByRole('button', { name: 'Draft again' })).toBeDisabled()
    openTab('Style')
    expect(screen.getByRole('combobox', { name: 'Page' })).toBeDisabled()
    cleanup()
    view({ stage: 'rendered' })
    select(2)
    openTab('Your version')
    expect(within(editor()).getByRole('button', { name: 'Another take · Slide 2' })).toBeEnabled()
  })
})

describe('StructuresStep picks a version by itself (GD29)', () => {
  const unpicked = { ...VIEW.pointers, picked: null }
  const shown = async (over: Partial<Props['view']>) => {
    await act(async () => {
      view(over)
    })
  }

  it('picks the first Ready version when versions arrive, passing a failing one before it', async () => {
    // Version 0 is over its words and claims a fact it lacks; version 1 is Ready.
    await shown({ pointers: unpicked })
    expect(actions.pickAction).toHaveBeenCalledTimes(1)
    expect(actions.pickAction).toHaveBeenCalledWith('p1', 4, 1)
  })

  it('picks nothing when a version is picked already, none is Ready, or the drafting runs', async () => {
    const over = { ...OVER, slide: 2 }
    for (const props of [
      {},
      { pointers: unpicked, draftChecks: [[OVER], [over], [over], [over]] },
      { pointers: unpicked, running: ['draft'] },
    ]) {
      await shown(props)
      cleanup()
    }
    expect(actions.pickAction).not.toHaveBeenCalled()
  })
})

describe('StructuresStep for a look post (GD2, GD4, GD5, GD9–GD11)', () => {
  const IDEA = {
    angle: 'The 20-hour line',
    hook: 'Twenty hours is where grades start to slip.',
    audience: 'First-years with a job',
    look: 'field-notes' as const,
    slides: 3,
  }
  const lookCover = {
    kind: 'cover' as const,
    layout: 'cover' as const,
    slots: { kicker: plain('Paid work'), heading: plain('The 20-hour line') },
  }
  const picture = (heading: string) => ({
    kind: 'body' as const,
    layout: 'picture' as const,
    slots: {
      heading: plain(heading),
      body: bound('Above 20 hours a week, pass rates fell by 11 percentage points.', ['f1']),
    },
  })
  const lookTake = {
    kind: 'take' as const,
    layout: 'takeaway' as const,
    slots: {
      heading: plain('Keep it under 20'),
      body: plain('Twenty hours is the line to watch.'),
    },
  }
  const version = (
    angle: string,
    slides: Body<'drafts'>['items'][number]['structure']['slides'],
  ): Body<'drafts'>['items'][number] => ({
    template: template('field-notes'),
    angle,
    problems: [],
    structure: { templateId: 'field-notes', artPrompt: 'A quiet desk at dusk.', slides },
  })
  const LOOK_DRAFTS: Body<'drafts'> = {
    factsId: 'facts1',
    attempt: 1,
    replays: [],
    emotion: null,
    note: 'Drafted',
    idea: { cards: [IDEA] },
    items: [
      version('Where the line is', [lookCover, picture('Up to 20 is fine'), lookTake]),
      version('What it costs', [lookCover, picture('Past 20, grades slip'), lookTake]),
      // Its second slide is a takeaway: it cannot go at slide 2 of a version whose slide 2 is a body.
      version('What to do', [lookCover, lookTake, lookTake]),
    ],
  }
  const LOOK: Partial<Props['view']> = {
    pointers: {
      ...VIEW.pointers,
      ideasId: 'ideas1',
      ticked: ['field-notes'],
      picked: 0,
      themeId: 'pop',
    },
    current: current({
      drafts: { id: 'd1', body: LOOK_DRAFTS },
      ideas: { id: 'ideas1', body: { factsId: 'facts1', cards: [IDEA], rounds: 1 } },
    }),
    draftChecks: [[CONTRAST], [CONTRAST], [CONTRAST]],
  }
  const card = (angle: string) => screen.getByRole('article', { name: `Field Notes · ${angle}` })

  it('shows the idea above the versions with "Back to ideas", and no template ticks', () => {
    view(LOOK)
    expect(screen.getAllByText('For: The 20-hour line').length).toBeGreaterThan(0)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Back to ideas' }))
    expect(onBackToIdeas).toHaveBeenCalled()
  })

  it('names on each version card the idea it serves (GD2)', () => {
    view(LOOK)
    openTab('Versions')
    for (const angle of ['What it costs', 'What to do']) {
      expect(within(card(angle)).getByText('For: The 20-hour line')).toBeInTheDocument()
    }
  })

  it('switches the colour preset, Pop or Subdued, in place of the themes (GD9)', async () => {
    view(LOOK)
    openTab('Style')
    expect(screen.queryByRole('button', { name: /^Paper/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Pop' })).toHaveAttribute('aria-pressed', 'true')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Subdued' }))
    })
    expect(actions.setPresetAction).toHaveBeenCalledWith('p1', 4, 'subdued')
  })

  it('nudges the selected slide of the picked version with a text chip, by its id (GD10)', async () => {
    view(LOOK)
    select(2)
    await act(async () => {
      fireEvent.click(within(editor()).getByRole('button', { name: 'Shorter · Slide 2' }))
    })
    expect(actions.nudgeSlideAction).toHaveBeenCalledWith('p1', 4, { slide: 2, nudge: 'shorter' })
    expect(within(editor()).queryByRole('button', { name: /^Another take/ })).toBeNull()
  })

  it('nudges a whole version with a text chip, and moves it to another look (GD4, GD10)', async () => {
    view(LOOK)
    await act(async () => {
      fireEvent.click(within(editor()).getByRole('radio', { name: 'Data Desk' }))
    })
    expect(actions.setLookAction).toHaveBeenCalledWith('p1', 4, { index: 0, look: 'data-desk' })
    // Another version's chips and look switch are in its details.
    openTab('Versions')
    const details = drawer(card('What it costs'))
    expect(screen.getByRole('dialog', { name: 'Version B · What it costs' }) === details).toBe(true)
    await act(async () => {
      fireEvent.click(within(details).getByRole('button', { name: 'Warmer · Version B' }))
    })
    expect(actions.nudgeVersionAction).toHaveBeenCalledWith('p1', 4, { index: 1, nudge: 'warmer' })
    await act(async () => {
      fireEvent.click(within(details).getByRole('radio', { name: 'Postcard' }))
    })
    expect(actions.setLookAction).toHaveBeenLastCalledWith('p1', 4, { index: 1, look: 'postcard' })
  })

  it('lays the selected slide out again from the layout picker, and shows why a layout cannot fill it (GD5)', async () => {
    view(LOOK)
    select(2)
    expect(within(editor()).getByRole('button', { name: /^Comparison bars/ })).toBeDisabled()
    expect(
      within(editor()).getByText('Bars need two numbers from facts on this slide.'),
    ).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(within(editor()).getByRole('button', { name: /^Big number/ }))
    })
    expect(actions.setSlideLayoutAction).toHaveBeenCalledWith('p1', 4, {
      index: 0,
      slide: 2,
      layout: 'number',
    })
  })

  it('leaves the other versions to the Versions tab: "Your version" has no slides from them and no drawer of its own (17 Oct)', () => {
    view(LOOK)
    select(2)
    expect(within(editor()).queryByRole('region', { name: 'From the other versions' })).toBeNull()
    expect(within(editor()).queryByRole('button', { name: /^Use slide/ })).toBeNull()
    expect(within(editor()).queryByRole('button', { name: 'Details' })).toBeNull()
    openTab('Versions')
    expect(within(card('What it costs')).getByRole('button', { name: 'Details' })).toBeEnabled()
  })

  it('puts a slot’s hotspot over its text where the layout moved it down (Postcard’s card)', () => {
    const body = template('field-notes').layouts?.picture?.slots.find((s) => s.key === 'body')
    if (!body) throw new Error('no body slot')
    const top = (button: HTMLElement) => Number.parseFloat(button.style.top)
    view({ ...LOOK, draftShifts: [[0, 120, 0], [], []] })
    select(2)
    const hotspot = within(large()).getByRole('button', { name: 'Edit Slide 2 · Body' })
    expect(top(hotspot)).toBeCloseTo(((body.box.y + 120) / 1350) * 100, 5)
    cleanup()
    view(LOOK)
    select(2)
    expect(top(within(large()).getByRole('button', { name: 'Edit Slide 2 · Body' }))).toBeCloseTo(
      (body.box.y / 1350) * 100,
      5,
    )
  })

  it('waits while a chip runs on the slide or on a version', () => {
    view({ ...LOOK, running: ['draft_slide:2'] })
    select(2)
    expect(within(editor()).getByRole('button', { name: 'Shorter · Slide 2' })).toBeDisabled()
    cleanup()
    view({ ...LOOK, running: ['nudge_version'] })
    openTab('Versions')
    expect(
      within(drawer(card('What it costs'))).getByRole('button', { name: 'Warmer · Version B' }),
    ).toBeDisabled()
  })

  const overBody = (slide: number): FitCheck => ({
    check: 'length',
    slide,
    slot: 'body',
    value: 30,
    limit: '15–25 words',
    pass: false,
    label: `Slide ${slide} · 30 words (15–25) · Over`,
  })

  it('shows each version with its status tag and its problems as sentences, its slot list and checks in a closed "Details" drawer (GD22)', () => {
    view({ ...LOOK, draftChecks: [[CONTRAST], [overBody(2), CONTRAST], [CONTRAST]] })
    openTab('Versions')
    const costs = card('What it costs')
    expect(within(costs).getByText('1 to fix')).toBeInTheDocument()
    expect(within(costs).getByText('Slide 2 body is 30 words; the most is 25.')).toBeInTheDocument()
    const ready = card('What to do')
    expect(within(ready).getByText('Ready')).toBeInTheDocument()
    // Closed until its button opens it, and never a fold-out in the card.
    expect(ready.querySelector('details') === null).toBe(true)
    expect(within(ready).queryByText('Contrast · Paper 14.4:1 · OK') === null).toBe(true)
    expect(screen.queryByRole('dialog') === null).toBe(true)
    const details = drawer(ready)
    expect(screen.getByRole('dialog', { name: 'Version C · What to do' }) === details).toBe(true)
    expect(cells(within(details).getByRole('table', { name: 'Whole post' }))).toContainEqual([
      'Contrast · Paper',
      '14.4:1',
      '4.5:1',
      'OK',
    ])
    expect(within(details).getAllByText('Heading').length).toBeGreaterThan(0)
  })

  it('fixes an overlong slot of the picked version from "Checks" with "Shorten it", the shorter chip on that slide (GD22)', async () => {
    view({ ...LOOK, draftChecks: [[overBody(2), CONTRAST], [CONTRAST], [CONTRAST]] })
    // Its card: where, what is wrong, its length against its limit, and the fix.
    const row = fixCard('30 words · limit 15–25')
    expect(row.textContent).toContain('Slide 2 · Body')
    expect(row.textContent).toContain('Too long')
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'Shorten it' }))
    })
    expect(actions.nudgeSlideAction).toHaveBeenCalledWith('p1', 4, { slide: 2, nudge: 'shorter' })
  })

  it('fixes a colour pair too faint to read from "Checks" by opening Style, where the colours are chosen (18 Oct)', () => {
    const faint: FitCheck = {
      ...CONTRAST,
      value: 3.1,
      pass: false,
      label: 'Contrast · Pop block 3.1:1 · Too low',
    }
    view({ ...LOOK, draftChecks: [[faint], [CONTRAST], [CONTRAST]] })
    const row = fixCard('Contrast too low')
    expect(row.textContent).toContain('Colours · Pop block')
    fireEvent.click(within(row).getByRole('button', { name: 'Pick other colours in Style' }))
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(
      screen.getByRole('tab', { name: 'Style' }).id,
    )
  })

  it('shows the selected slide’s text with its counts and its fact chips beside it (GD24)', () => {
    view(LOOK)
    select(2)
    const fields = within(editor()).getByRole('group', { name: 'Slide 2 text' })
    expect(within(fields).getByText('16 of 1–40 characters')).toBeInTheDocument()
    expect(within(fields).getByText('12 of 15–25 words')).toBeInTheDocument()
    expect(within(editor()).getAllByRole('button', { name: '¶3' }).length).toBeGreaterThan(0)
  })

  it('keeps the step actions bar to "Back to ideas" and "Approve text": the checks are in their tab (GD24, 17 Oct)', async () => {
    for (const draftChecks of [
      [[CONTRAST], [CONTRAST], [CONTRAST]],
      [[overBody(2), CONTRAST], [CONTRAST], [CONTRAST]],
    ]) {
      view({ ...LOOK, draftChecks })
      const bar = screen.getByRole('region', { name: 'Step actions' })
      expect(within(bar).queryByText(/to fix|All checks pass/) === null).toBe(true)
      expect(within(bar).queryByRole('button', { name: 'See checks' }) === null).toBe(true)
      expect(within(bar).getByRole('button', { name: 'Approve text → Images' })).toBeEnabled()
      cleanup()
    }
    view({ ...LOOK, draftChecks: [[overBody(2), CONTRAST], [CONTRAST], [CONTRAST]] })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Approve text → Images' }))
    })
    expect(actions.approveStructureAction).toHaveBeenCalledWith('p1', 4)
  })

  it('puts "Checks" last, its badge counting what is left to fix as a problem, and opens on "Your version" all the same (17 Oct)', () => {
    view({ ...LOOK, draftChecks: [[overBody(2), CONTRAST], [CONTRAST], [CONTRAST]] })
    expect(screen.getAllByRole('tab').at(-1)?.id).toBe(
      screen.getByRole('tab', { name: 'Checks · 1 to fix' }).id,
    )
    expect(isOpen('Your version')).toBe('true')
    expect(isOpen('Checks')).toBe('false')
    // Its problems first, then the source check, then the fit table.
    const text = checksTab().textContent ?? ''
    expect(text.indexOf('To fix')).toBeLessThan(text.indexOf('Source check'))
    expect(text.indexOf('Source check')).toBeLessThan(text.indexOf('Fit checks'))
  })

  it('keeps "Checks" as the last tab saying every check passes, with no badge, when nothing is left', () => {
    view(LOOK)
    expect(isOpen('Your version')).toBe('true')
    expect(screen.getAllByRole('tab').at(-1)?.textContent).toBe('Checks')
    const panel = checksTab()
    expect(within(panel).getByText('All checks pass')).toBeInTheDocument()
    expect(within(panel).queryByRole('list', { name: 'To fix' })).toBeNull()
  })

  it('shows a look post with no theme stored in Pop, chosen (the default draftChoices gives)', () => {
    view({ ...LOOK, pointers: { ...(LOOK.pointers as Props['view']['pointers']), themeId: null } })
    openTab('Style')
    expect(screen.getByRole('button', { name: 'Pop' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Subdued' }).getAttribute('aria-pressed')).toBe(
      'false',
    )
  })

  it('keeps the tab the editor opened while checks come and go, and the "Your version" tab carries no "Fix" now', () => {
    const onOpen = mock((_: string) => {})
    const held = (open: string | null, draftChecks: FitCheck[][]) =>
      render(
        <StructuresStep
          view={{ ...VIEW, ...LOOK, draftChecks }}
          viewer={EDITOR}
          actions={actions}
          tab={{ open, onOpen }}
        />,
      )
    held(null, [[CONTRAST], [CONTRAST], [CONTRAST]])
    openTab('Versions')
    const versions = onOpen.mock.calls.at(-1)?.[0] ?? null
    expect(versions).toBe('Versions')
    cleanup()
    // A problem appears after a save: Versions stays open.
    held(versions, [[overBody(2), CONTRAST], [CONTRAST], [CONTRAST]])
    expect(isOpen('Versions')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Your version' }).textContent).toBe('Your version')
  })

  it('holds the tab it opens on once she works in it, so a problem her own edit brings does not take her from "Your version"', () => {
    const onOpen = mock((_: string) => {})
    const held = (open: string | null, draftChecks: FitCheck[][]) =>
      render(
        <StructuresStep
          view={{ ...VIEW, ...LOOK, draftChecks }}
          viewer={EDITOR}
          actions={actions}
          tab={{ open, onOpen }}
        />,
      )
    held(null, [[CONTRAST], [CONTRAST], [CONTRAST]])
    expect(isOpen('Your version')).toBe('true')
    expect(onOpen.mock.calls.length).toBe(0)
    // Her edit starts with a key or a click in the step: the tab it opened on is held then.
    fireEvent.keyDown(screen.getByRole('tabpanel'), { key: 'a' })
    const yours = onOpen.mock.calls.at(-1)?.[0] ?? null
    expect(yours).toBe('Your version')
    cleanup()
    held(yours, [[overBody(2), CONTRAST], [CONTRAST], [CONTRAST]])
    expect(isOpen('Your version')).toBe('true')
    expect(isOpen('Checks')).toBe('false')
  })

  it('keeps the other versions in the Versions tab, every version counted on it, once one is picked, and opens on them before (no fold-out)', () => {
    view(LOOK)
    expect(screen.queryByRole('group', { name: 'Choose another version' }) === null).toBe(true)
    expect(document.querySelector('details') === null).toBe(true)
    expect(screen.queryAllByRole('article')).toHaveLength(0)
    openTab('Versions')
    expect(screen.getByRole('tab', { name: 'Versions · 3' }).getAttribute('aria-selected')).toBe(
      'true',
    )
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual([
      'Field Notes · What it costs',
      'Field Notes · What to do',
    ])
    cleanup()
    view({ ...LOOK, pointers: { ...LOOK.pointers, picked: null } as Props['view']['pointers'] })
    // None picked: no "Your version" tab, and the versions are what opens.
    expect(screen.queryByRole('tab', { name: /^Your version/ }) === null).toBe(true)
    expect(screen.getByRole('tab', { name: 'Versions · 3' }).getAttribute('aria-selected')).toBe(
      'true',
    )
    expect(card('Where the line is').textContent).toContain('Where the line is')
  })

  it('works with the one version a draft writes: Versions counts it and says a redraft adds another, and "Approve text" goes on to the images', async () => {
    const drafted = (n: number): Partial<Props['view']> => ({
      ...LOOK,
      current: current({
        drafts: { id: 'd1', body: { ...LOOK_DRAFTS, items: LOOK_DRAFTS.items.slice(0, n) } },
        ideas: { id: 'ideas1', body: { factsId: 'facts1', cards: [IDEA], rounds: 1 } },
      }),
      draftChecks: LOOK_DRAFTS.items.slice(0, n).map(() => [CONTRAST]),
    })
    view(drafted(1))
    openTab('Versions')
    expect(isOpen('Versions · 1')).toBe('true')
    const panel = screen.getByRole('tabpanel', { name: /^Versions/ })
    expect(panel.textContent).toBe(
      'Your version is the only one so far. Draft again, in Redraft, adds another.',
    )
    const approve = screen.getByRole('button', { name: 'Approve text → Images' })
    expect(approve).toBeEnabled()
    await act(async () => {
      fireEvent.click(approve)
    })
    expect(actions.approveStructureAction).toHaveBeenCalledWith('p1', 4)
    expect(push.mock.calls.at(-1)?.[0]).toBe('/admin/posts/p1/images')
    cleanup()
    // A redraft added one: both counted, the other one listed to pick.
    view(drafted(2))
    openTab('Versions')
    expect(isOpen('Versions · 2')).toBe('true')
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual([
      'Field Notes · What it costs',
    ])
  })

  it('opens the tab held above it (a save keeps it), and tells it which one opens next', () => {
    const onOpen = mock((_: string) => {})
    const held = (open: string | null) =>
      render(
        <StructuresStep
          view={{ ...VIEW, ...LOOK }}
          viewer={EDITOR}
          actions={actions}
          tab={{ open, onOpen }}
        />,
      )
    held(null)
    openTab('Style')
    const style = onOpen.mock.calls.at(-1)?.[0] ?? null
    openTab('Redraft')
    const redraft = onOpen.mock.calls.at(-1)?.[0] ?? null
    expect([style, redraft]).toEqual(['Style', 'Redraft'])
    cleanup()
    held(style)
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(
      screen.getByRole('tab', { name: 'Style' }).id,
    )
    cleanup()
    held(redraft)
    expect(isOpen('Redraft')).toBe('true')
  })

  it('gives the chosen version one chip row, the selected slide’s, and keeps its look switch', () => {
    view(LOOK)
    expect(within(editor()).getByRole('button', { name: 'Warmer · Slide 1' })).toBeInTheDocument()
    expect(within(editor()).queryByRole('button', { name: 'Warmer · Version A' }) === null).toBe(
      true,
    )
    expect(within(editor()).getByRole('radio', { name: 'Data Desk' })).toBeInTheDocument()
    // The other versions keep their look switch and their whole-version chips, in their details.
    openTab('Versions')
    const details = drawer(card('What it costs'))
    expect(within(details).getByRole('button', { name: 'Warmer · Version B' })).toBeInTheDocument()
    expect(within(details).getByRole('radio', { name: 'Data Desk' })).toBeInTheDocument()
  })

  it('fills only "Approve text": "Use this version" on the other cards and "Draft again" are outlined', () => {
    view({ ...LOOK, pointers: { ...LOOK.pointers, picked: null } as Props['view']['pointers'] })
    expect(screen.getAllByRole('button', { name: 'Use this version' }).length).toBeGreaterThan(1)
    const filled = document.querySelectorAll('.bg-primary-strong')
    expect(filled).toHaveLength(1)
    expect(filled[0]).toHaveTextContent('Approve text → Images')
    cleanup()
    // A legacy post with versions drafted: "Draft versions" is a redo now, not the step's action.
    view()
    openTab('Redraft')
    expect(screen.getByRole('button', { name: 'Draft versions' })).toBeInTheDocument()
    expect(document.querySelectorAll('.bg-primary-strong')).toHaveLength(1)
  })

  it('keeps a legacy post on its template ticks and themes, with no chips or presets (GD8)', () => {
    view()
    expect(screen.queryByRole('button', { name: /^Shorter/ })).toBeNull()
    expect(screen.queryByText(/^For: /)).toBeNull()
    // Its own ticked templates stay in the list, ticked; the looks are not offered to it.
    openTab('Redraft')
    expect(screen.getByRole('checkbox', { name: /The line/ })).toBeChecked()
    expect(screen.queryByRole('checkbox', { name: /Field Notes/ })).toBeNull()
    openTab('Style')
    expect(screen.getByRole('button', { name: /^Paper/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pop' })).toBeNull()
  })
})

describe('StructuresStep on long unbroken text (smoke test, 12 Oct)', () => {
  it("wraps a version's slot text anywhere, inside a card that may shrink", () => {
    const LONG = `https://example.com/${'a'.repeat(100)}`
    expect(LONG).toHaveLength(120)
    const item = DRAFTS.items[0]
    const slides = item.structure.slides.map((s, i) =>
      i === 1 ? { ...s, slots: { ...s.slots, body: bound(LONG, ['f1']) } } : s,
    )
    const drafts: Body<'drafts'> = {
      ...DRAFTS,
      items: [{ ...item, structure: { ...item.structure, slides } }, ...DRAFTS.items.slice(1)],
    }
    const facts = [{ ...FACTS[0], text: LONG }, FACTS[1]]
    view({
      pointers: { ...VIEW.pointers, picked: 1 },
      current: current({
        drafts: { id: 'd1', body: drafts },
        facts: { id: 'facts1', body: { sourceId: 'src1', keyIdeas: [], facts, replays: [] } },
      }),
    })
    openTab('Versions')
    const card = screen.getByRole('article', { name: 'Article carousel · The long read' })
    const slot = within(drawer(card)).getByText(LONG)
    expect(slot.closest('.wrap-anywhere')).not.toBeNull()
  })
})
