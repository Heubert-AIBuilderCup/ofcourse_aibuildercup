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
  checkSourceAction: mock(async (_id: unknown, _at: unknown) => saved(5)()),
  approveStructureAction: mock(async (_id: unknown, _at: unknown) => saved(5)()),
  backAction: mock(async (_id: unknown, _at: unknown, _to: unknown) => saved(5)()),
  choosePageAction: mock(async (_id: unknown, _at: unknown, _page: unknown) => saved(5)()),
  nudgeSlideAction: mock(async (_id: unknown, _at: unknown, _input: unknown) => saved(5)()),
  nudgeVersionAction: mock(async (_id: unknown, _at: unknown, _input: unknown) => saved(5)()),
  takeSlideAction: mock(async (_id: unknown, _at: unknown, _input: unknown) => saved(5)()),
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
/** The picked version's film strip and its selected slide large, beside its editor (GD30). */
const large = () => screen.getByRole('region', { name: 'Slides' })
/** Shows slide `n` of the picked version large, from its film strip. */
const select = (n: number) =>
  fireEvent.click(within(large()).getByRole('button', { name: new RegExp(`^Slide ${n} · `) }))

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
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Draft again' }))
    })
    expect(actions.tickTemplatesAction).not.toHaveBeenCalled()
    expect(actions.draftAction).toHaveBeenCalledWith('p1', 4, true, null)
  })

  it('drafts with the pressed emotion chip, or with the editor’s own word in its place (100)', async () => {
    view()
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
    expect(screen.getByRole('button', { name: 'Calm' })).toHaveAttribute('aria-pressed', 'true')
    cleanup()
    view({ current: current({ drafts: { id: 'd1', body: { ...DRAFTS, emotion: 'Wistful' } } }) })
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
    const details = within(editor()).getByText('Details').closest('details')
    if (!details) throw new Error('no details')
    const chips = within(details).getAllByRole('button', { name: '¶3' })
    expect(chips).toHaveLength(1)
    fireEvent.click(chips[0])
    expect(
      screen.getByText('Hours of paid work and first-year results · ¶3 · checked 5 Oct 2026'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/not a fact/)).toBeNull()
  })

  it('labels an unbound slot "Not in the source" and offers a supported fact in its place (GD23)', async () => {
    view()
    expect(within(editor()).getByText('Not in the source')).toBeInTheDocument()
    expect(screen.queryByText('No source')).toBeNull()
    const select = screen.getByRole('combobox', { name: 'Supported fact' })
    fireEvent.change(select, { target: { value: 'f2' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Fix unbound claim' }))
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
    // The long read's slide 4, picked: in its film strip, as its card gives way to the editor.
    expect(screen.getAllByRole('img', { name: /^Slide 4\b/ })).toHaveLength(1)
  })

  it('lays a template’s versions side by side in one row, each labelled by its angle, and picks by the flattened index (97)', async () => {
    view()
    const versions = [
      'Article carousel · The line · The surprising number',
      'Article carousel · The line · The practical advice',
      'Article carousel · The line · The question to ask',
    ].map((name) => screen.getByRole('article', { name }))
    const row = versions[0].parentElement
    if (!row) throw new Error('no version row')
    expect(versions.every((v) => v.parentElement === row)).toBe(true)
    // criterion 29: versions sit side by side, not wrapped 2 + 1; a fourth would scroll in the row.
    expect(row).toHaveClass('grid', 'grid-flow-col', 'overflow-x-auto')
    expect(row.className).toContain('auto-cols-[minmax(16rem,1fr)]')
    expect(row.className).not.toMatch(/grid-cols-|auto-fit|auto-fill/)
    expect(within(versions[1]).getByText('The practical advice')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(within(versions[1]).getByRole('button', { name: 'Use this version' }))
    })
    expect(actions.pickAction).toHaveBeenCalledWith('p1', 4, 2)
  })

  it('loads an older drafts record, one structure per template, as one version named by its template', () => {
    view()
    expect(within(editor()).getByText('Article carousel · The long read')).toBeInTheDocument()
    cleanup()
    view({ pointers: { ...VIEW.pointers, picked: 1 } })
    const legacy = screen.getByRole('article', { name: 'Article carousel · The long read' })
    expect(
      within(legacy).getByRole('heading', { name: 'Article carousel · The long read' }),
    ).toBeInTheDocument()
  })

  it('shows a version that failed verification with its problems and no "Use this version"', () => {
    const problem = 'slides.0.slots.kicker: remove "best".'
    const items = DRAFTS.items.map((item, i) => (i === 3 ? { ...item, problems: [problem] } : item))
    view({ current: current({ drafts: { id: 'd1', body: { ...DRAFTS, items } } }) })
    const failed = screen.getByRole('article', {
      name: 'Article carousel · The line · The question to ask',
    })
    expect(within(failed).getByText(problem)).toBeInTheDocument()
    expect(within(failed).queryByRole('button', { name: 'Use this version' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Use this version' })).toHaveLength(2)
  })

  it("shows a draft's failing fit row before approval", () => {
    view()
    const row = screen.getByText('Slide 2 · 121 words (30–70) · Over').closest('li')
    if (!row) throw new Error('no fit row')
    expect(within(row).getByText('Fail')).toBeInTheDocument()
  })

  it('names the themes without their contrast ratios, which stay in the checks (GD25)', () => {
    view()
    for (const name of ['Paper', 'Ink', 'Signal']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    expect(screen.queryByText(/^(Paper|Ink|Signal) \d/)).toBeNull()
    expect(within(editor()).getByText('Contrast · Paper 14.4:1 · OK')).toBeInTheDocument()
  })

  it("changes the post's page, None as null, for the drafts and covers made after (105)", async () => {
    view({ pointers: { ...VIEW.pointers, pageBrandId: 'cerebral' } })
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
    expect(screen.queryByLabelText('Page')).toBeNull()
    expect(screen.getByText('Page: None')).toBeInTheDocument()
  })

  it('keeps "Approve text" unavailable with the unbound reason', () => {
    view()
    expect(screen.getByRole('button', { name: 'Approve text → Images' })).toBeDisabled()
    expect(screen.getByText('A claim has no source. Fix it before approving.')).toBeInTheDocument()
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

  it('offers an admin no control at all, only the fact chips to read', () => {
    view({}, ADMIN)
    const controls = screen.queryAllByRole('button').filter((b) => !/^¶/.test(b.textContent ?? ''))
    expect(controls).toHaveLength(0)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.getByText('Paper')).toBeInTheDocument()
  })

  it('shows a running draft as "Running…" with Draft disabled', () => {
    view({ running: ['draft'] })
    expect(screen.queryByRole('button', { name: 'Draft versions' })).toBeNull()
    for (const button of screen.getAllByRole('button', { name: 'Running…' })) {
      expect(button).toBeDisabled()
    }
  })

  describe('editing the picked version on its slides, checked as it goes (98, 104)', () => {
    const picked = editor
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
      expect(within(editor()).getAllByRole('button', { name: /^Another take/ })).toHaveLength(1)
      await act(async () => {
        fireEvent.click(within(editor()).getByRole('button', { name: 'Another take · Slide 2' }))
      })
      expect(actions.redraftSlideAction).toHaveBeenCalledWith('p1', 4, 2)
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
      expect(within(editor()).getByRole('button', { name: 'Running…' })).toBeDisabled()
      expect(within(editor()).queryByRole('button', { name: 'Another take · Slide 2' })).toBeNull()
      select(3)
      expect(within(editor()).getByRole('button', { name: 'Another take · Slide 3' })).toBeEnabled()
      cleanup()
      view({ failed: ['draft_slide:3'] })
      select(3)
      expect(within(editor()).getByRole('button', { name: 'Try again · Slide 3' })).toBeEnabled()
      expect(
        within(editor()).getByText('Another take failed. Your slide is kept.'),
      ).toBeInTheDocument()
      select(2)
      expect(within(editor()).getByRole('button', { name: 'Another take · Slide 2' })).toBeEnabled()
    })

    it('edits only the picked version', () => {
      view()
      const other = screen.getByRole('article', {
        name: 'Article carousel · The line · The surprising number',
      })
      expect(within(other).queryByRole('button', { name: /^Edit Slide/ })).toBeNull()
    })

    it("shows a flagged sentence beside the source sentence, and uses the source's wording in one click", async () => {
      view({ current: checked([FOUND, FLAGGED]) })
      const row = within(picked()).getByText(`Source ¶3: ${SUGGESTION}`).closest('li')
      if (!row) throw new Error('no flagged row')
      expect(within(row).getByText(FLAGGED.text)).toBeInTheDocument()
      expect(within(row).getByText('Not found')).toBeInTheDocument()
      await act(async () => {
        fireEvent.click(within(row).getByRole('button', { name: "Use the source's wording" }))
      })
      expect(actions.applySourceWordingAction).toHaveBeenCalledWith('p1', 4, 1)
      // The found sentence is not flagged.
      expect(within(picked()).getAllByText('Not found')).toHaveLength(1)
    })

    it('says the check is running, then that every sentence was found', () => {
      view({ running: ['source_check'] })
      expect(within(picked()).getByText('Checking against the source…')).toBeInTheDocument()
      expect(within(picked()).queryByRole('button', { name: 'Try again' })).toBeNull()
      cleanup()
      view({ current: checked([FOUND]) })
      expect(within(picked()).getByText('Every sentence found in the source')).toBeInTheDocument()
    })

    it('offers "Try again" when the check failed, and no "Run source check" ever', async () => {
      view({ failed: ['source_check'] })
      expect(screen.queryByRole('button', { name: 'Run source check' })).toBeNull()
      await act(async () => {
        fireEvent.click(within(picked()).getByRole('button', { name: 'Try again' }))
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
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('at a passed step, keeps the edit controls disabled with the running step in words while one runs (122)', () => {
    view({ stage: 'rendered', running: ['covers'] })
    expect(screen.getAllByText('Covers are being drawn').length).toBeGreaterThan(0)
    select(2)
    expect(within(editor()).getByRole('button', { name: 'Another take · Slide 2' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Draft again' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Page' })).toBeDisabled()
    cleanup()
    view({ stage: 'rendered' })
    select(2)
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
    for (const angle of ['What it costs', 'What to do']) {
      expect(within(card(angle)).getByText('For: The 20-hour line')).toBeInTheDocument()
    }
  })

  it('switches the colour preset, Pop or Subdued, in place of the themes (GD9)', async () => {
    view(LOOK)
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
      fireEvent.click(
        within(card('What it costs')).getByRole('button', { name: 'Warmer · Version B' }),
      )
    })
    expect(actions.nudgeVersionAction).toHaveBeenCalledWith('p1', 4, { index: 1, nudge: 'warmer' })
    await act(async () => {
      fireEvent.click(within(editor()).getByRole('radio', { name: 'Data Desk' }))
    })
    expect(actions.setLookAction).toHaveBeenCalledWith('p1', 4, { index: 0, look: 'data-desk' })
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

  it('puts another version’s slide in my version from "Use here", and says why one does not fit (GD11)', async () => {
    view(LOOK)
    select(2)
    const others = within(editor()).getByRole('region', { name: 'From the other versions' })
    expect(
      within(others).getByRole('button', { name: 'Use slide 2 of version C in my version' }),
    ).toBeDisabled()
    expect(
      within(others).getByText('Slide 2 of version C does not fit this version.'),
    ).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(
        within(others).getByRole('button', { name: 'Use slide 2 of version B in my version' }),
      )
    })
    expect(actions.takeSlideAction).toHaveBeenCalledWith('p1', 4, { from: 1, slide: 2 })
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
    expect(
      within(card('What it costs')).getByRole('button', { name: 'Warmer · Version B' }),
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

  it('shows each version with its status tag and its problems as sentences, its slot list and checks under a closed "Details" (GD22)', () => {
    view({ ...LOOK, draftChecks: [[CONTRAST], [overBody(2), CONTRAST], [CONTRAST]] })
    const costs = card('What it costs')
    expect(within(costs).getByText('1 to fix')).toBeInTheDocument()
    expect(within(costs).getByText('Slide 2 body is 30 words; the most is 25.')).toBeInTheDocument()
    const ready = card('What to do')
    expect(within(ready).getByText('Ready')).toBeInTheDocument()
    const details = ready.querySelector('details')
    if (!details) throw new Error('no details')
    expect(details.open).toBe(false)
    expect(within(ready).getByRole('group', { name: 'Details' })).toBe(details)
    expect(within(details).getByText('Contrast · Paper 14.4:1 · OK')).toBeInTheDocument()
    expect(within(details).getAllByText('Heading').length).toBeGreaterThan(0)
  })

  it('fixes an overlong slot of the picked version with "Shorten it", the shorter chip on that slide (GD22)', async () => {
    view({ ...LOOK, draftChecks: [[overBody(2), CONTRAST], [CONTRAST], [CONTRAST]] })
    expect(within(editor()).getByText('1 to fix')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(within(editor()).getByRole('button', { name: 'Shorten it' }))
    })
    expect(actions.nudgeSlideAction).toHaveBeenCalledWith('p1', 4, { slide: 2, nudge: 'shorter' })
  })

  it('shows the selected slide’s text with its counts and its fact chips beside it (GD24)', () => {
    view(LOOK)
    select(2)
    const fields = within(editor()).getByRole('group', { name: 'Slide 2 text' })
    expect(within(fields).getByText('16 of 1–40 characters')).toBeInTheDocument()
    expect(within(fields).getByText('12 of 15–25 words')).toBeInTheDocument()
    expect(within(editor()).getAllByRole('button', { name: '¶3' }).length).toBeGreaterThan(0)
  })

  it('keeps the step actions bar with the check summary, "See checks" and "Approve text" (GD24)', async () => {
    view(LOOK)
    const bar = screen.getByRole('region', { name: 'Step actions' })
    expect(within(bar).getByText('All checks pass')).toBeInTheDocument()
    const checks = within(editor()).getByText('Details').closest('details')
    if (!checks) throw new Error('no details')
    expect(checks.open).toBe(false)
    fireEvent.click(within(bar).getByRole('button', { name: 'See checks' }))
    expect(checks.open).toBe(true)
    await act(async () => {
      fireEvent.click(within(bar).getByRole('button', { name: 'Approve text → Images' }))
    })
    expect(actions.approveStructureAction).toHaveBeenCalledWith('p1', 4)
    cleanup()
    view({ ...LOOK, draftChecks: [[overBody(2), CONTRAST], [CONTRAST], [CONTRAST]] })
    expect(
      within(screen.getByRole('region', { name: 'Step actions' })).getByText('1 to fix'),
    ).toBeInTheDocument()
  })

  it('folds the other versions into a closed "Choose another version" once one is picked, and shows them open before', () => {
    view(LOOK)
    const fold = screen.getByRole('group', { name: 'Choose another version' })
    expect(fold.tagName).toBe('DETAILS')
    expect((fold as HTMLDetailsElement).open).toBe(false)
    for (const angle of ['What it costs', 'What to do']) expect(fold).toContainElement(card(angle))
    cleanup()
    view({ ...LOOK, pointers: { ...LOOK.pointers, picked: null } as Props['view']['pointers'] })
    expect(screen.queryByRole('group', { name: 'Choose another version' }) === null).toBe(true)
    expect(card('Where the line is').closest('details') === null).toBe(true)
  })

  it('gives the chosen version one chip row, the selected slide’s, and keeps its look switch', () => {
    view(LOOK)
    expect(within(editor()).getByRole('button', { name: 'Warmer · Slide 1' })).toBeInTheDocument()
    expect(within(editor()).queryByRole('button', { name: 'Warmer · Version A' }) === null).toBe(
      true,
    )
    expect(within(editor()).getByRole('radio', { name: 'Data Desk' })).toBeInTheDocument()
    // The cards keep their look switch and their whole-version chips.
    expect(
      within(card('What it costs')).getByRole('button', { name: 'Warmer · Version B' }),
    ).toBeInTheDocument()
    expect(
      within(card('What it costs')).getByRole('radio', { name: 'Data Desk' }),
    ).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: 'Draft versions' })).toBeInTheDocument()
    expect(document.querySelectorAll('.bg-primary-strong')).toHaveLength(1)
  })

  it('keeps a legacy post on its template ticks and themes, with no chips or presets (GD8)', () => {
    view()
    // Its own ticked templates stay in the list, ticked; the looks are not offered to it.
    expect(screen.getByRole('checkbox', { name: /The line/ })).toBeChecked()
    expect(screen.queryByRole('checkbox', { name: /Field Notes/ })).toBeNull()
    expect(screen.getByRole('button', { name: /^Paper/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pop' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Shorter/ })).toBeNull()
    expect(screen.queryByText(/^For: /)).toBeNull()
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
    const slot = screen.getByText(LONG)
    expect(slot.closest('.wrap-anywhere')).not.toBeNull()
    expect(slot.closest('article')).toHaveClass('min-w-0')
  })
})
