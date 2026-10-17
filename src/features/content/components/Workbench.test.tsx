/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { Staff } from '@/shared/lib/auth/access'
import { FEED_BRAND } from '../brands'
import { PAID_WORK_TEXTS, PAID_WORK_TITLE } from '../demo-sources/paid-work'
import { CHANGED_LINE } from '../lib/lines'
import { emptyPointers } from '../model/artifacts'
import type { Saved } from '../server/commands'
import { templateById } from '../templates'

const push = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh: () => {} }),
}))

const { Workbench } = await import('./Workbench')
type Props = Parameters<typeof Workbench>[0]

const ok = async (): Promise<Saved> => ({ ok: true, id: 'p1', version: 2 })
const actions: Props['actions'] = {
  tickTemplatesAction: ok,
  draftAction: ok,
  pickAction: ok,
  themeAction: ok,
  choosePageAction: ok,
  fixUnboundAction: ok,
  editSlotAction: ok,
  measureSlotAction: async () => ({ ok: true, rows: [] }),
  redraftSlideAction: ok,
  nudgeSlideAction: ok,
  nudgeVersionAction: ok,
  setSlideLayoutAction: ok,
  setLookAction: ok,
  setPresetAction: ok,
  pickIdeasAction: ok,
  moreIdeasAction: ok,
  editOutlineAction: ok,
  pickBlogAngleAction: ok,
  editBlogOutlineAction: ok,
  writeBlogAction: ok,
  editBlogSectionAction: ok,
  approveBlogTextAction: ok,
  embedPostSlidesAction: ok,
  makePostsFromBlogAction: ok,
  makeBlogFromPostAction: ok,
  linkToBlogAction: ok,
  outlineFormatAction: ok,
  writeSlidesAction: ok,
  applySourceWordingAction: ok,
  researchClaimAction: async () => ({ ok: true, sources: [], entryPoint: null }),
  addResearchSourceAction: ok,
  addFactAction: ok,
  removeFactAction: ok,
  approveStructureAction: ok,
  backAction: ok,
  withdrawAction: ok,
  editLiveAction: ok,
  discardChangesAction: mock(async (_id: unknown, _at: unknown) => ok()),
  remakeAction: ok,
  continueWithSourceAction: ok,
  renderAction: ok,
  retryArtAction: ok,
  checkSourceAction: ok,
  markOpinionAction: ok,
  removeClaimAction: ok,
  saveSettingsAction: ok,
  sendToReviewAction: ok,
  approvePublishAction: ok,
  sendBackAction: ok,
  lightEditAction: ok,
  makeCoversAction: ok,
  chooseCoverAction: ok,
  planImagesAction: ok,
  editImageSceneAction: ok,
  drawImagesAction: ok,
  skipPicturesAction: ok,
  nudgeImageAction: ok,
  restoreVersionAction: ok,
  makeMarketAction: ok,
  rewordMarketAction: ok,
  adaptAction: ok,
  makeSetAction: async () => ({ ok: true, id: 'p1', version: 2, versions: [] }),
  approveLayoutAction: ok,
  renderSocialAction: ok,
  editCaptionAction: ok,
  checkCaptionAction: ok,
  resetCaptionAction: ok,
  markExportedAction: ok,
  recordPostUrlAction: ok,
  sharePostAction: ok,
  editSceneAction: ok,
  editPanelsAction: ok,
  retryStoryAction: ok,
}

const VIEW: Props['view'] = {
  id: 'p1',
  title: PAID_WORK_TITLE,
  stage: 'structures',
  version: 1,
  pointers: { ...emptyPointers(), sourceId: 'src1', factsId: 'facts1' },
  current: {
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
    facts: { id: 'facts1', body: { sourceId: 'src1', keyIdeas: [], facts: [], replays: [] } },
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
    sourceCheck: null,
    settings: null,
    sendBack: null,
    approval: null,
    market: null,
    caption: null,
    export: null,
  },
  createdAt: '2026-10-05T09:12:00.000Z',
  running: [],
  draftChecks: [],
}

afterEach(() => {
  cleanup()
  push.mockClear()
})

const EDITOR: Staff = { role: 'user', editor: true }
const REVIEWER: Staff = { role: 'user', reviewer: true }

it('goes back to the board with the filters it came from', () => {
  render(
    <Workbench
      view={VIEW}
      viewer={EDITOR}
      from="filter=social&assignee=mine"
      actions={actions}
      step="text"
    />,
  )
  expect(screen.getByRole('link', { name: '← Board' })).toHaveAttribute(
    'href',
    '/admin/board?filter=social&assignee=mine',
  )
})

it('at the text step, shows the title, the step bar and the versions, and no source pane (GD25, GD27)', () => {
  render(<Workbench view={VIEW} viewer={EDITOR} from="all" actions={actions} step="text" />)
  expect(screen.getByRole('heading', { level: 1, name: PAID_WORK_TITLE })).toBeInTheDocument()
  const bar = screen.getByRole('list', { name: 'Stages' })
  expect(bar).toHaveTextContent(/Source.*Text.*Images/)
  expect(within(bar).getByRole('link', { name: 'Text' })).toHaveAttribute(
    'href',
    '/admin/posts/p1/text?from=all',
  )
  for (const gone of ['Gate locked', 'Gate open', 'Structures']) {
    expect(screen.queryByText(gone)).toBeNull()
  }
  expect(screen.getByRole('heading', { level: 2, name: 'Text' })).toBeInTheDocument()
  expect(screen.queryByText('¶1')).toBeNull()
  expect(screen.queryByRole('complementary', { name: 'Source' })).toBeNull()
  expect(screen.queryByRole('heading', { name: 'History' })).toBeNull()
})

it('says a step was written with Flash-Lite on that step’s screen only', () => {
  const line = 'Written with Flash-Lite because Flash and Pro were busy: the versions.'
  const lite = { ...VIEW, lite: ['draft'] }
  render(<Workbench view={lite} viewer={EDITOR} from="all" actions={actions} step="text" />)
  expect(screen.getByText(line).textContent).toBe(line)
  cleanup()
  render(<Workbench view={lite} viewer={EDITOR} from="all" actions={actions} step="source" />)
  expect(screen.queryByText(line) === null).toBe(true)
})

it('at the source step, shows the source pane and the history, and no step after it (GD27)', () => {
  render(<Workbench view={VIEW} viewer={EDITOR} from="all" actions={actions} step="source" />)
  expect(screen.getByRole('complementary', { name: 'Source' })).toHaveTextContent('¶1')
  expect(screen.getByRole('heading', { level: 2, name: 'History' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { level: 2, name: 'Text' })).toBeNull()
})

it('at the images step of a rendered post, shows the pictures only: no source check, settings or Send to review', () => {
  render(
    <Workbench
      view={{ ...VIEW, stage: 'rendered' }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="images"
    />,
  )
  // A post from before the looks: its Images screen reads as the bar does (GD25).
  expect(screen.getByRole('heading', { level: 2, name: 'Images' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /Render/ })).toBeNull()
  expect(screen.queryByRole('heading', { level: 2, name: /Source check/ })).toBeNull()
  expect(screen.queryByRole('heading', { level: 2, name: /Feed settings/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /^Send to review/ })).toBeNull()
  // Nothing drawn yet: the settings wait for the pictures.
  expect(screen.queryByRole('button', { name: 'Next: Settings →' })).toBeNull()
  expect(screen.queryByRole('heading', { level: 2, name: 'Text' })).toBeNull()
})

/** Opens a settings panel from its tab. */
const openPanel = (name: string) =>
  fireEvent.click(
    within(screen.getByRole('tablist', { name: 'Settings panels' })).getByRole('tab', {
      name: new RegExp(`^${name}`),
    }),
  )

it('at the settings step, shows the source check, the feed settings and Send to review, with "← Images" back', () => {
  render(
    <Workbench
      view={{ ...VIEW, stage: 'rendered' }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="settings"
    />,
  )
  // No check of this version yet: "To fix" opens first, with the check to run (17 Oct).
  const panel = () => screen.getByRole('tabpanel')
  expect(panel().getAttribute('aria-labelledby')).toBe(
    screen.getByRole('tab', { name: 'To fix · 1 to fix' }).id,
  )
  expect(within(panel()).getByRole('button', { name: 'Run source check' })).toBeEnabled()
  openPanel('Source check')
  expect(screen.getByRole('heading', { level: 2, name: /Source check/ })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: /Feed settings/ })).toBeInTheDocument()
  openPanel('Expiry')
  expect(screen.getByRole('button', { name: 'Send to review → Review' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { level: 2, name: 'Images' })).toBeNull()
  // The way back sits in the step bar, before the step's action, as on every step.
  const bar = within(screen.getByRole('region', { name: 'Step actions' }))
  const back = bar.getByRole('button', { name: '← Images' })
  const send = bar.getByRole('button', { name: 'Send to review → Review' })
  expect(back.compareDocumentPosition(send) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getAllByRole('button', { name: '← Images' })).toHaveLength(1)
  fireEvent.click(back)
  expect(push).toHaveBeenCalledWith('/admin/posts/p1/images')
})

it('reads Source · Ideas · Text · Images · Settings · Review · Live on the step bar of a post with ideas', () => {
  render(
    <Workbench
      view={{ ...VIEW, stage: 'rendered', pointers: { ...VIEW.pointers, ideasId: 'ideas1' } }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="images"
    />,
  )
  const bar = screen.getByRole('list', { name: 'Stages' })
  expect(
    within(bar)
      .getAllByRole('listitem')
      .map((li) => li.textContent),
  ).toEqual(['1Source', '2Ideas', '3Text', '4Images', '5Settings', '6Review', '7Live'])
})

const IDEA = {
  angle: 'The 20-hour line',
  hook: 'Twenty hours is where grades start to slip.',
  audience: 'First-years with a job',
  look: 'field-notes' as const,
  slides: 3,
}
const IDEAS = { id: 'ideas1', body: { factsId: 'facts1', cards: [IDEA], rounds: 1 } }

it('at the ideas step, shows the idea cards and not the versions (GD1)', () => {
  render(
    <Workbench
      view={{
        ...VIEW,
        pointers: { ...VIEW.pointers, ideasId: 'ideas1' },
        current: { ...VIEW.current, ideas: IDEAS },
      }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="ideas"
    />,
  )
  expect(screen.getByRole('article', { name: 'The 20-hour line' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Ideas' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Text' })).toBeNull()
})

const FIELD_NOTES = templateById('field-notes')
if (!FIELD_NOTES) throw new Error('no field-notes template')

const FIELD_NOTES_STRUCTURE = {
  templateId: 'field-notes',
  artPrompt: 'A quiet desk at dusk.',
  slides: [
    {
      kind: 'cover' as const,
      layout: 'cover' as const,
      slots: { heading: { text: 'The line', factIds: [], factual: false } },
    },
  ],
}

/** A look post at its text versions, drafted from its one idea card. */
const DRAFTED: Props['view'] = {
  ...VIEW,
  pointers: { ...VIEW.pointers, ideasId: 'ideas1', draftsId: 'd1' },
  current: {
    ...VIEW.current,
    ideas: IDEAS,
    drafts: {
      id: 'd1',
      body: {
        factsId: 'facts1',
        attempt: 1,
        replays: [],
        emotion: null,
        note: 'Drafted',
        idea: { cards: [IDEA] },
        items: [
          {
            template: FIELD_NOTES,
            angle: 'Where the line is',
            problems: [],
            structure: FIELD_NOTES_STRUCTURE,
          },
        ],
      },
    },
  },
}

it('goes "Back to ideas" from the versions to the ideas screen, and "Back to versions" from it (GD2, GD27)', () => {
  render(<Workbench view={DRAFTED} viewer={EDITOR} from="all" actions={actions} step="text" />)
  expect(screen.queryByRole('article', { name: 'The 20-hour line' })).toBeNull()
  const bar = () => within(screen.getByRole('region', { name: 'Step actions' }))
  fireEvent.click(bar().getByRole('button', { name: 'Back to ideas' }))
  expect(push).toHaveBeenCalledWith('/admin/posts/p1/ideas')
  cleanup()
  render(<Workbench view={DRAFTED} viewer={EDITOR} from="all" actions={actions} step="ideas" />)
  expect(screen.getByRole('article', { name: 'The 20-hour line' })).toBeInTheDocument()
  fireEvent.click(bar().getByRole('button', { name: 'Back to versions' }))
  expect(push).toHaveBeenCalledWith('/admin/posts/p1/text')
})

it('keeps the selected slide of the picked version through a save, which opens the screen at the next version (GD24)', () => {
  const heading = (text: string) => ({ heading: { text, factIds: [], factual: false } })
  const slides = [
    { kind: 'cover' as const, layout: 'cover' as const, slots: heading('The line') },
    { kind: 'body' as const, layout: 'picture' as const, slots: heading('Hours') },
    { kind: 'body' as const, layout: 'picture' as const, slots: heading('Grades') },
  ]
  const drafts = DRAFTED.current.drafts as NonNullable<Props['view']['current']['drafts']>
  const picked: Props['view'] = {
    ...DRAFTED,
    pointers: { ...DRAFTED.pointers, picked: 0, themeId: 'pop' },
    current: {
      ...DRAFTED.current,
      drafts: {
        ...drafts,
        body: {
          ...drafts.body,
          items: [{ ...drafts.body.items[0], structure: { ...FIELD_NOTES_STRUCTURE, slides } }],
        },
      },
    },
  }
  const { rerender } = render(
    <Workbench view={picked} viewer={EDITOR} from="all" actions={actions} step="text" />,
  )
  const strip = () => within(screen.getByRole('list', { name: 'All slides' }))
  const pressed = (n: number) =>
    strip()
      .getByRole('button', { name: `Slide ${n}` })
      .getAttribute('aria-current') ?? 'false'
  fireEvent.click(strip().getByRole('button', { name: 'Slide 2' }))
  expect(pressed(2)).toBe('true')
  rerender(
    <Workbench
      view={{ ...picked, version: picked.version + 1 }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="text"
    />,
  )
  expect([pressed(1), pressed(2)]).toEqual(['false', 'true'])
})

const THE_LINE = templateById('the-line')
if (!THE_LINE) throw new Error('no the-line template')

/** A post past the gate: one approved version of the line, its theme chosen. */
const PAST_GATE: Props['view'] = {
  ...VIEW,
  pointers: { ...VIEW.pointers, draftsId: 'd1', picked: 0, themeId: 'paper' },
  current: {
    ...VIEW.current,
    drafts: {
      id: 'd1',
      body: {
        factsId: 'facts1',
        attempt: 1,
        replays: [],
        emotion: null,
        note: null,
        items: [
          {
            template: THE_LINE,
            structure: {
              templateId: 'the-line',
              artPrompt: 'A quiet desk at dusk.',
              slides: [
                {
                  kind: 'body',
                  slots: { heading: { text: 'Up to 20', factIds: [], factual: false } },
                },
              ],
            },
          },
        ],
      },
    },
  },
}

it('at a passed step, shows an editor its controls with no "Back to <step>", and the way on to the current step (111, GD27, GD28)', () => {
  const rendered = { ...PAST_GATE, stage: 'rendered' as const }
  render(<Workbench view={rendered} viewer={EDITOR} from="all" actions={actions} step="text" />)
  const text = screen.getByRole('region', { name: /^Text/ })
  expect(within(text).getByRole('region', { name: /^Your version/ })).toBeInTheDocument()
  expect(within(text).queryByRole('button', { name: 'Back to text versions' })).toBeNull()
  expect(screen.queryByRole('button', { name: /^Approve text/ })).toBeNull()
  expect(screen.getByRole('link', { name: /^Continue at / })).toBeInTheDocument()
  cleanup()
  render(<Workbench view={rendered} viewer={EDITOR} from="all" actions={actions} step="source" />)
  expect(screen.queryByRole('button', { name: 'Back to source' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Change the source' })).toBeInTheDocument()
})

it('in review, shows a reviewer the passed text step with no control at all (111)', () => {
  render(
    <Workbench
      view={{ ...PAST_GATE, stage: 'in_review' }}
      viewer={REVIEWER}
      from="all"
      actions={actions}
      step="text"
    />,
  )
  const text = screen.getByRole('region', { name: /^Text/ })
  for (const role of ['checkbox', 'textbox', 'combobox'] as const) {
    expect(within(text).queryAllByRole(role)).toHaveLength(0)
  }
  // Only the buttons that look: a slide of the filmstrip, a version's details.
  const buttons = within(text)
    .queryAllByRole('button')
    .map((b) => b.getAttribute('aria-label') ?? b.textContent ?? '')
  expect(buttons.filter((name) => !/^(Details|Slide \d+)$/.test(name))).toEqual([])
})

it('once live, shows the live post at its step, and the review as a summary at its own (111)', () => {
  const live = { ...PAST_GATE, stage: 'live' as const }
  render(<Workbench view={live} viewer={REVIEWER} from="all" actions={actions} step="live" />)
  expect(screen.getByRole('region', { name: /^Live/ })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: /^Review/ })).toBeNull()
  cleanup()
  render(<Workbench view={live} viewer={REVIEWER} from="all" actions={actions} step="review" />)
  const review = screen.getByRole('region', { name: /^Review/ })
  expect(within(review).queryAllByRole('button')).toHaveLength(0)
})

it('at the images step of a look post, shows its images step and no render or covers (GD12)', () => {
  render(
    <Workbench
      view={{
        ...DRAFTED,
        stage: 'approved',
        pointers: { ...DRAFTED.pointers, picked: 0, revisionId: 'r1' },
        current: {
          ...DRAFTED.current,
          revision: {
            id: 'r1',
            body: {
              factsId: 'facts1',
              structure: FIELD_NOTES_STRUCTURE,
              template: FIELD_NOTES,
              brand: FEED_BRAND,
              themeId: 'pop',
              by: { userId: 'u1', name: 'Ed', at: '2026-10-05T09:12:00.000Z' },
              note: 'approved',
              emotion: null,
            },
          },
        },
      }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="images"
    />,
  )
  expect(screen.getByRole('heading', { level: 2, name: 'Images' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Plan images' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { level: 2, name: /Render/ })).toBeNull()
})

it('at the images step of a rendered post from before the looks, offers "Make covers" as before (GD8)', () => {
  render(
    <Workbench
      view={{
        ...PAST_GATE,
        stage: 'rendered',
        current: {
          ...PAST_GATE.current,
          render: {
            id: 'ren1',
            body: {
              revisionId: 'r1',
              layoutId: 'lay1',
              art: { assetId: 'art1', prompt: 'A desk.', version: 1, fallback: null },
              slides: [{ svgAssetId: 's1', pngAssetId: 'png1' }],
            },
          },
        },
      }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="images"
    />,
  )
  expect(screen.getByRole('button', { name: 'Make covers' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^(Plan|Draw) images/ })).toBeNull()
})

it('offers "Next: Settings →" on the Images screen once the pictures are drawn, which opens Settings', () => {
  const item = (PAST_GATE.current.drafts as NonNullable<Props['view']['current']['drafts']>).body
    .items[0]
  render(
    <Workbench
      view={{
        ...PAST_GATE,
        stage: 'rendered',
        current: {
          ...PAST_GATE.current,
          revision: {
            id: 'r1',
            body: {
              factsId: 'facts1',
              structure: item.structure,
              template: item.template,
              brand: FEED_BRAND,
              themeId: 'paper',
              by: { userId: 'u1', name: 'Ed', at: '2026-10-05T09:12:00.000Z' },
              note: 'approved',
              emotion: null,
            },
          },
          render: {
            id: 'ren1',
            body: {
              revisionId: 'r1',
              layoutId: 'lay1',
              art: { assetId: 'art1', prompt: 'A desk.', version: 1, fallback: null },
              slides: [{ svgAssetId: 's1', pngAssetId: 'png1' }],
            },
          },
        },
      }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="images"
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Next: Settings →' }))
  expect(push).toHaveBeenCalledWith('/admin/posts/p1/settings')
})

/** A rendered post from before the looks with its cover art: its pictures are drawn. */
function drawnLegacy(): Props['view'] {
  const item = (PAST_GATE.current.drafts as NonNullable<Props['view']['current']['drafts']>).body
    .items[0]
  return {
    ...PAST_GATE,
    stage: 'rendered',
    current: {
      ...PAST_GATE.current,
      revision: {
        id: 'r1',
        body: {
          factsId: 'facts1',
          structure: item.structure,
          template: item.template,
          brand: FEED_BRAND,
          themeId: 'paper',
          by: { userId: 'u1', name: 'Ed', at: '2026-10-05T09:12:00.000Z' },
          note: 'approved',
          emotion: null,
        },
      },
      render: {
        id: 'ren1',
        body: {
          revisionId: 'r1',
          layoutId: 'lay1',
          art: { assetId: 'art1', prompt: 'A desk.', version: 1, fallback: null },
          slides: [{ svgAssetId: 's1', pngAssetId: 'png1' }],
        },
      },
    },
  }
}

it('fills one button on a passed Images step: "Continue at", with "Next: Settings →" outlined', () => {
  render(
    <Workbench view={drawnLegacy()} viewer={EDITOR} from="all" actions={actions} step="images" />,
  )
  expect(screen.getByRole('button', { name: 'Next: Settings →' })).toBeInTheDocument()
  const filled = document.querySelectorAll('.bg-primary-strong')
  expect(filled).toHaveLength(1)
  expect(filled[0]).toHaveTextContent('Continue at Settings →')
})

it('shows the market versions in their panel and "Preview in context" beside them on Settings, not on Images (55, 56, 85)', () => {
  const { rerender } = render(
    <Workbench view={drawnLegacy()} viewer={EDITOR} from="all" actions={actions} step="settings" />,
  )
  const preview = screen.getByRole('region', { name: 'Preview' })
  expect(within(preview).getByRole('radio', { name: 'Preview in context' })).toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: 'For market' }) === null).toBe(true)
  openPanel('Market versions')
  const markets = screen.getByRole('tabpanel', { name: 'Market versions' })
  expect(within(markets).getByRole('combobox', { name: 'For market' })).toBeInTheDocument()
  expect(within(markets).getByRole('button', { name: 'Make market version' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send to review → Review' })).toBeInTheDocument()
  // A save keeps the panel the editor is on.
  rerender(
    <Workbench
      view={{ ...drawnLegacy(), version: drawnLegacy().version + 1 }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="settings"
    />,
  )
  expect(screen.getByRole('tabpanel', { name: 'Market versions' })).toBeInTheDocument()
  cleanup()

  render(
    <Workbench view={drawnLegacy()} viewer={EDITOR} from="all" actions={actions} step="images" />,
  )
  expect(screen.queryByRole('combobox', { name: 'For market' })).toBeNull()
  expect(screen.queryByRole('radio', { name: 'Preview in context' })).toBeNull()
})

it('reads "Changed since published" on a published post being worked on, discards the changes only after the confirm, and opens the live post (119)', async () => {
  const discard = actions.discardChangesAction as ReturnType<typeof mock>
  discard.mockClear()
  render(
    <Workbench
      view={{ ...PAST_GATE, stage: 'rendered', version: 7, publishedApprovalId: 'approval_1' }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="images"
    />,
  )
  expect(screen.getByText('Changed', { selector: 'span' })).toBeInTheDocument()
  expect(screen.getByText(CHANGED_LINE)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
  const ask = screen.getByRole('region', { name: 'Discard your changes?' })
  expect(
    within(ask).getByText(
      'Students keep seeing the live version; your changes stay in the history.',
    ),
  ).toBeInTheDocument()
  expect(discard).not.toHaveBeenCalled()
  await act(async () => {
    fireEvent.click(within(ask).getByRole('button', { name: 'Discard changes' }))
  })
  expect(discard).toHaveBeenCalledWith('p1', 7)
  expect(push).toHaveBeenCalledWith('/admin/posts/p1/live')
})

it('offers no "Discard changes" on a post never published, on the live post itself, or to a reviewer (119)', () => {
  for (const [view, viewer] of [
    [{ ...PAST_GATE, stage: 'rendered' as const }, EDITOR],
    [{ ...PAST_GATE, stage: 'live' as const, publishedApprovalId: 'approval_1' }, EDITOR],
    [{ ...PAST_GATE, stage: 'rendered' as const, publishedApprovalId: 'approval_1' }, REVIEWER],
  ] as const) {
    render(<Workbench view={view} viewer={viewer} from="all" actions={actions} step="text" />)
    expect(screen.queryByRole('button', { name: 'Discard changes' })).toBeNull()
    cleanup()
  }
})

it('shows "Discard changes" disabled with the running step in words while one runs (122)', () => {
  render(
    <Workbench
      view={{ ...PAST_GATE, stage: 'structures', running: ['draft'], publishedApprovalId: 'a1' }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="text"
    />,
  )
  expect(screen.getByRole('button', { name: 'Discard changes' })).toBeDisabled()
})

const RAVI = { userId: 'u-ravi', name: 'Ravi K.', at: '2026-10-05T09:12:00.000Z' }
const askedFor = (step: 'structures' | 'covers' | 'settings' | null) => ({
  id: 'sb1',
  body: { revisionId: 'r1', reason: 'Name the survey year.', by: RAVI, step },
})

it('shows a request for changes beside the step it names: settings in the feed settings (120)', () => {
  render(
    <Workbench
      view={{
        ...PAST_GATE,
        stage: 'rendered',
        current: { ...PAST_GATE.current, sendBack: askedFor('settings') },
      }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="settings"
    />,
  )
  const notes = screen.getAllByText(/Changes requested by Ravi K\..*Name the survey year\./)
  expect(notes).toHaveLength(1)
  expect(screen.getByRole('region', { name: 'Feed settings' })).toContainElement(notes[0])
})

it('shows a request for changes at the top when it names no step, or a step not on the screen (120)', () => {
  const cases = [
    [askedFor(null), 'text'],
    [askedFor('covers'), 'text'],
    [askedFor('settings'), 'text'],
    [askedFor('structures'), 'source'],
  ] as const
  for (const [sendBack, step] of cases) {
    render(
      <Workbench
        view={{ ...PAST_GATE, current: { ...PAST_GATE.current, sendBack } }}
        viewer={EDITOR}
        from="all"
        actions={actions}
        step={step}
      />,
    )
    const notes = screen.getAllByText(/Name the survey year\./)
    expect(notes).toHaveLength(1)
    const text = screen.queryByRole('region', { name: 'Text' })
    expect(text?.contains(notes[0]) ?? false).toBe(false)
    cleanup()
  }
})

/** A look post approved, so its current step is Images. */
const APPROVED_LOOK: Props['view'] = {
  ...DRAFTED,
  stage: 'approved',
  pointers: { ...DRAFTED.pointers, picked: 0, revisionId: 'r1' },
  current: {
    ...DRAFTED.current,
    revision: {
      id: 'r1',
      body: {
        factsId: 'facts1',
        structure: FIELD_NOTES_STRUCTURE,
        template: FIELD_NOTES,
        brand: FEED_BRAND,
        themeId: 'pop',
        by: { userId: 'u1', name: 'Ed', at: '2026-10-05T09:12:00.000Z' },
        note: 'approved',
        emotion: null,
      },
    },
  },
}

it('at a passed step, offers "Continue at <current step> →" to the step the post is at, and not at the current step', () => {
  render(
    <Workbench view={APPROVED_LOOK} viewer={EDITOR} from="all" actions={actions} step="text" />,
  )
  expect(screen.getByRole('link', { name: 'Continue at Images →' })).toHaveAttribute(
    'href',
    '/admin/posts/p1/images',
  )
  cleanup()
  render(
    <Workbench view={APPROVED_LOOK} viewer={EDITOR} from="all" actions={actions} step="images" />,
  )
  expect(screen.queryByRole('link', { name: /^Continue at/ })).toBeNull()
})

it('shows every step as two areas, the slides or the article and their actions (GD30)', () => {
  const steps: [Props['step'], Props['view']][] = [
    ['source', VIEW],
    ['ideas', { ...DRAFTED, current: { ...DRAFTED.current, drafts: null } }],
    ['text', DRAFTED],
    ['images', APPROVED_LOOK],
    ['images', drawnLegacy()],
    ['settings', drawnLegacy()],
    ['review', { ...PAST_GATE, stage: 'in_review' }],
    ['live', { ...PAST_GATE, stage: 'live' }],
  ]
  for (const [step, view] of steps) {
    render(<Workbench view={view} viewer={EDITOR} from="all" actions={actions} step={step} />)
    expect(screen.getByRole('region', { name: 'Slides' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Actions' })).toBeInTheDocument()
    cleanup()
  }
})

/** A look post with its three pictures drawn: three slides on the stage, two of them to reorder. */
function drawnLook(): Props['view'] {
  const heading = (text: string) => ({ heading: { text, factIds: [], factual: false } })
  const revision = APPROVED_LOOK.current.revision as NonNullable<
    Props['view']['current']['revision']
  >
  const laid = {
    kind: 'body' as const,
    lines: [],
    artBox: { x: 0, y: 0, w: 1080, h: 540 },
    sourceLine: null,
    searchLine: null,
  }
  const scenes = [1, 2, 3].map((slide) => ({ slide, scene: `Scene ${slide}` }))
  return {
    ...APPROVED_LOOK,
    stage: 'rendered',
    pointers: { ...APPROVED_LOOK.pointers, layoutId: 'lay1', artPlanId: 'plan1' },
    current: {
      ...APPROVED_LOOK.current,
      revision: {
        ...revision,
        body: {
          ...revision.body,
          structure: {
            ...FIELD_NOTES_STRUCTURE,
            slides: [
              { kind: 'cover' as const, layout: 'cover' as const, slots: heading('The line') },
              { kind: 'body' as const, layout: 'picture' as const, slots: heading('Hours') },
              { kind: 'body' as const, layout: 'picture' as const, slots: heading('Grades') },
            ],
          },
        },
      },
      layout: {
        id: 'lay1',
        body: { revisionId: 'r1', slides: [laid, laid, laid], fits: [], fitChecks: [] },
      },
      artPlan: { id: 'plan1', body: { revisionId: 'r1', scenes, panorama: false } },
      render: {
        id: 'ren1',
        body: {
          revisionId: 'r1',
          layoutId: 'lay1',
          art: { assetId: null, prompt: '', version: 1, fallback: null },
          slides: [1, 2, 3].map((n) => ({ svgAssetId: `s${n}`, pngAssetId: `png${n}` })),
          slideArt: scenes.map(({ slide, scene }) => ({
            slide,
            assetId: `art${slide}`,
            scene,
            take: 1,
            nudge: null,
            fallback: null,
          })),
        },
      },
    },
  }
}

/** The open tab beside the slides, by its words. */
const openTabs = () =>
  screen
    .queryAllByRole('tab')
    .filter((t) => t.getAttribute('aria-selected') === 'true')
    .map((t) => t.textContent)

it('keeps the selected slide and the open tab of Images through a save, as a drawn picture lands (GD24)', () => {
  const { rerender } = render(
    <Workbench view={drawnLook()} viewer={EDITOR} from="all" actions={actions} step="images" />,
  )
  const strip = () => within(screen.getByRole('list', { name: 'All slides' }))
  const pressed = (n: number) =>
    strip()
      .getByRole('button', { name: `Slide ${n}` })
      .getAttribute('aria-current') ?? 'false'
  fireEvent.click(strip().getByRole('button', { name: 'Slide 3' }))
  fireEvent.click(screen.getByRole('tab', { name: 'Order' }))
  expect([pressed(1), pressed(3)]).toEqual(['false', 'true'])
  expect(openTabs()).toEqual(['Order'])
  rerender(
    <Workbench
      view={{ ...drawnLook(), version: drawnLook().version + 1 }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="images"
    />,
  )
  expect([pressed(1), pressed(3)]).toEqual(['false', 'true'])
  expect(openTabs()).toEqual(['Order'])
})

it('keeps the open tab of a post from before the looks through a save on Images', () => {
  const { rerender } = render(
    <Workbench view={drawnLegacy()} viewer={EDITOR} from="all" actions={actions} step="images" />,
  )
  // The covers open first (criterion 102).
  expect(openTabs()).toEqual(['Covers'])
  fireEvent.click(screen.getByRole('tab', { name: 'This slide' }))
  rerender(
    <Workbench
      view={{ ...drawnLegacy(), version: drawnLegacy().version + 1 }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="images"
    />,
  )
  expect(openTabs()).toEqual(['This slide'])
})

it('keeps Share open on Live after a share saves, its new share in sight (10)', () => {
  const { rerender } = render(
    <Workbench view={LIVE_FEED} viewer={EDITOR} from="all" actions={actions} step="live" />,
  )
  expect(openTabs()).toEqual(['Details'])
  fireEvent.click(screen.getByRole('tab', { name: 'Share' }))
  const by = { userId: 'u1', name: 'Rae', at: '2026-10-17T09:00:00.000Z' }
  rerender(
    <Workbench
      view={{
        ...LIVE_FEED,
        version: LIVE_FEED.version + 1,
        shares: [{ id: 'share_1', body: { instagram: [], linkedin: ['main'], by } }],
      }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="live"
    />,
  )
  expect(openTabs()).toEqual(['Share'])
  expect(within(screen.getByRole('list', { name: 'Shares' })).getAllByRole('listitem').length).toBe(
    1,
  )
})

it('puts the picked version’s film strip in the slides area, and its fields in the actions area (GD30)', () => {
  render(
    <Workbench
      view={{ ...DRAFTED, pointers: { ...DRAFTED.pointers, picked: 0, themeId: 'pop' } }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="text"
    />,
  )
  const slides = screen.getByRole('region', { name: 'Slides' })
  const actionsArea = screen.getByRole('region', { name: 'Actions' })
  expect(within(slides).getByRole('list', { name: 'All slides' })).toBeInTheDocument()
  expect(within(actionsArea).queryByRole('list', { name: 'All slides' })).toBeNull()
  expect(within(actionsArea).getByRole('region', { name: /^Your version/ })).toBeInTheDocument()
  expect(within(actionsArea).getByRole('group', { name: 'Slide 1 text' })).toBeInTheDocument()
  // The approval is the step's own action: it sits in the step actions bar (A4), not in this area.
  expect(
    within(actionsArea).queryByRole('button', { name: 'Approve text → Images' }) === null,
  ).toBe(true)
})

it('puts the preview in the slides area of Settings, and the check and the feed settings in its actions area (GD30)', () => {
  render(
    <Workbench view={drawnLegacy()} viewer={EDITOR} from="all" actions={actions} step="settings" />,
  )
  const slides = screen.getByRole('region', { name: 'Slides' })
  const actionsArea = screen.getByRole('region', { name: 'Actions' })
  expect(within(slides).getByRole('region', { name: 'Preview' })).toBeInTheDocument()
  openPanel('Source check')
  expect(within(actionsArea).getByRole('heading', { name: /Source check/ })).toBeInTheDocument()
  expect(within(actionsArea).getByRole('region', { name: 'Feed settings' })).toBeInTheDocument()
  // Sending is the step's own action: it sits in the step actions bar (A4), not in this area.
  openPanel('Market versions')
  expect(within(actionsArea).getByRole('button', { name: 'Save settings' })).toBeInTheDocument()
  expect(
    within(actionsArea).queryByRole('button', { name: 'Send to review → Review' }) === null,
  ).toBe(true)
})

const BLOG_TEXT = {
  id: 'bt1',
  body: {
    outlineId: 'bo1',
    sections: [{ heading: 'How many hours can I work?', body: 'Twenty in term.', factIds: [] }],
    takeaways: ['Twenty hours in term.', 'Grades first.', 'Plan shifts.'],
    faq: [],
    emotion: null,
    note: 'Written',
  },
}
const BLOG_OUTLINE = {
  id: 'bo1',
  body: {
    factsId: 'facts1',
    idea: IDEA,
    sections: [{ heading: 'How many hours can I work?', point: 'Twenty in term.' }],
    takeaways: ['Twenty hours in term.', 'Grades first.', 'Plan shifts.'],
    faq: [
      { q: 'Two jobs?', point: 'Yes.' },
      { q: 'Who checks?', point: 'The visa.' },
      { q: 'Breaks?', point: 'Official ones.' },
    ],
    note: 'Outlined',
  },
}

it("opens a blog's own screens: its sections at the outline, its article at the text, and its posts once live (BR1–BR3, BR6)", () => {
  const blog = { ...VIEW, kind: 'blog' as const }
  const outlined = { ...blog.current, blogOutline: BLOG_OUTLINE }
  render(
    <Workbench
      view={{ ...blog, current: outlined }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="outline"
    />,
  )
  expect(screen.getByRole('listitem', { name: 'Section 1' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Write the blog' })).toBeInTheDocument()
  cleanup()
  render(
    <Workbench
      view={{ ...blog, current: { ...outlined, blogText: BLOG_TEXT } }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="text"
    />,
  )
  expect(screen.getByRole('button', { name: 'Approve text → Images' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /Versions/ })).toBeNull()
  cleanup()
  render(
    <Workbench
      view={{
        ...blog,
        stage: 'live',
        current: { ...outlined, blogText: BLOG_TEXT },
        publishedApprovalId: 'a1',
        blogPosts: [{ id: 'p9', title: 'The 20-hour line', live: true }],
      }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="live"
    />,
  )
  expect(screen.getByRole('heading', { name: 'How many hours can I work?' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Make posts from this blog' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Create social version' })).toBeNull()
})

/** A live feed post, with a blog it may be linked to. */
const LIVE_FEED: Props['view'] = {
  ...VIEW,
  kind: 'feed',
  stage: 'live',
  blogs: [{ id: 'b1', title: 'Work hours, in full' }],
}

it('offers a live feed post "Make a blog" and "Link to an existing blog" on its Blog step, the last (BR8)', () => {
  render(<Workbench view={LIVE_FEED} viewer={EDITOR} from="all" actions={actions} step="blog" />)
  const bar = screen.getByRole('list', { name: 'Stages' })
  expect(within(bar).getAllByRole('listitem').at(-1)).toHaveTextContent('Blog')
  expect(screen.getByRole('button', { name: 'Make a blog' })).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Link to an existing blog' })).toBeInTheDocument()
  // Blog follows Live: there is no step to continue at from it.
  expect(screen.queryByRole('link', { name: /^Continue at/ }) === null).toBe(true)
})

it('shows a live feed post’s slides on its Blog step as the selected slide over a filmstrip', () => {
  render(
    <Workbench
      view={{ ...drawnLegacy(), kind: 'feed', stage: 'live', blogs: LIVE_FEED.blogs }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="blog"
    />,
  )
  const slides = within(screen.getByRole('region', { name: 'Slides' }))
  expect(
    slides
      .getByRole('group', { name: 'Slides, one at a time' })
      .getAttribute('aria-roledescription'),
  ).toBe('carousel')
  expect(slides.queryAllByRole('list', { name: 'All slides' }).length).toBe(1)
})

it('finishes a live feed post at Live, the blog offered as optional, and lets its Blog step be skipped', () => {
  render(<Workbench view={LIVE_FEED} viewer={EDITOR} from="all" actions={actions} step="live" />)
  expect(screen.getByRole('link', { name: 'Add a blog (optional) →' }).getAttribute('href')).toBe(
    '/admin/posts/p1/blog',
  )
  expect(screen.getByRole('link', { name: 'Done · back to the board' }).getAttribute('href')).toBe(
    '/admin/board?all',
  )
  cleanup()
  render(<Workbench view={LIVE_FEED} viewer={EDITOR} from="all" actions={actions} step="blog" />)
  expect(
    screen.getByRole('link', { name: 'Skip the blog · back to the board' }).getAttribute('href'),
  ).toBe('/admin/board?all')
  cleanup()
  render(<Workbench view={LIVE_FEED} viewer={EDITOR} from="all" actions={actions} step="live" />)
  expect(screen.queryByRole('button', { name: 'Make a blog' }) === null).toBe(true)
  cleanup()

  render(
    <Workbench
      view={{ ...drawnLegacy(), kind: 'feed', blogs: LIVE_FEED.blogs }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="settings"
    />,
  )
  openPanel('Market versions')
  expect(screen.queryByRole('button', { name: 'Make a blog' }) === null).toBe(true)
  expect(screen.queryByRole('combobox', { name: 'Link to an existing blog' }) === null).toBe(true)
  cleanup()

  // A comic has no Blog step.
  render(
    <Workbench
      view={{ ...LIVE_FEED, courseId: 'c1' }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="live"
    />,
  )
  expect(screen.queryByRole('link', { name: 'Add a blog (optional) →' }) === null).toBe(true)
})

it('puts each step’s primary action in one "Step actions" bar, outside the two areas (A4)', () => {
  const bar = () => screen.getByRole('region', { name: 'Step actions' })
  render(
    <Workbench
      view={{ ...DRAFTED, pointers: { ...DRAFTED.pointers, picked: 0, themeId: 'pop' } }}
      viewer={EDITOR}
      from="all"
      actions={actions}
      step="text"
    />,
  )
  expect(screen.getAllByRole('region', { name: 'Step actions' })).toHaveLength(1)
  expect(within(bar()).getByRole('button', { name: 'Approve text → Images' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Actions' })).not.toContainElement(bar())
  cleanup()

  render(
    <Workbench view={drawnLegacy()} viewer={EDITOR} from="all" actions={actions} step="images" />,
  )
  expect(within(bar()).getByRole('button', { name: 'Next: Settings →' })).toBeInTheDocument()
  expect(within(bar()).getByRole('link', { name: 'Continue at Settings →' })).toBeInTheDocument()
  cleanup()

  // Settings sends from the bar on any panel, not only the last.
  render(
    <Workbench view={drawnLegacy()} viewer={EDITOR} from="all" actions={actions} step="settings" />,
  )
  expect(within(bar()).getByRole('button', { name: 'Send to review → Review' })).toBeInTheDocument()
  cleanup()

  render(<Workbench view={LIVE_FEED} viewer={EDITOR} from="all" actions={actions} step="live" />)
  expect(within(bar()).queryAllByRole('link', { name: 'Done · back to the board' }).length).toBe(1)
})
