import { describe, expect, it } from 'bun:test'
import { emptyPointers, type Pointers } from '../model/artifacts'
import type { CurrentPost } from '../model/current'
import { STAGES, type Stage } from '../model/stages'
import type { Fact, FeedSettings, FitCheck, Structure } from '../model/types'
import { templateById } from '../templates'
import { NATIVE_IDS, nativeOf } from '../text/native-fixtures'
import { comicCaptionError } from './comic-rules'
import {
  ACTION_STAGES,
  actionError,
  approveBlogTextError,
  approveStructureError,
  COVER_IDEA_MAX,
  changedSincePublished,
  coverIdeaError,
  EDITOR_ACTIONS,
  editHome,
  editWaitError,
  exportError,
  kindError,
  missingSettingError,
  normaliseSettings,
  publishError,
  REVIEWER_ACTIONS,
  renderError,
  restoreError,
  sendBackError,
  sendToReviewError,
  settingsError,
  stepRunningError,
  WORKFLOW_ERRORS,
} from './workflow'

const template = templateById('the-line')
if (!template) throw new Error('the-line template missing')

const NOT_AUTHORISED = 'Not authorised.'
const editor = { role: 'admin', editor: true }
const superadmin = { role: 'superadmin' }

const empty: CurrentPost = {
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
  sourceCheck: null,
  settings: null,
  sendBack: null,
  approval: null,
  market: null,
  caption: null,
  export: null,
}

const settings: FeedSettings = {
  layer: 'general',
  audience: { mode: 'everyone', rules: [] },
  whyLine: null,
  expiry: { kind: 'none' },
  studioLink: null,
  tags: [],
  sourcesAt: 'caption',
}
const row = (pass: boolean): FitCheck => ({
  check: 'length',
  slide: 2,
  slot: 'body',
  value: 121,
  limit: '30–70 words',
  pass,
  label: 'Slide 2 · 121 words (30–70) · Over',
})

function withCheck(result: 'found' | 'not_found' | 'opinion'): CurrentPost {
  return {
    ...empty,
    sourceCheck: {
      id: 'sc1',
      body: {
        revisionId: 'r1',
        replays: [],
        claims: [{ text: 'A claim.', slide: 2, slot: 'body', result, ref: null }],
      },
    },
  }
}

/** A market version of render rd1, which no slide vision check reads any more (103). */
const market: CurrentPost['market'] = {
  id: 'mk1',
  body: {
    revisionId: 'r1',
    renderId: 'rd1',
    market: 'NP',
    slots: [],
    feedExcerpt: 'Deciding together.',
    conversions: [],
    layout: [],
    fitChecks: [],
    slides: [],
    replays: [],
  },
}

describe('actionError', () => {
  it('refuses every editor action for an admin or a user without the capability (14)', () => {
    for (const viewer of [{ role: 'admin' }, { role: 'user' }]) {
      for (const action of EDITOR_ACTIONS) {
        for (const stage of ACTION_STAGES[action]) {
          expect(actionError(action, viewer, stage)).toBe(NOT_AUTHORISED)
        }
      }
    }
  })

  it('allows every editor action at its stages for an admin with the editor capability', () => {
    for (const action of EDITOR_ACTIONS) {
      for (const stage of ACTION_STAGES[action]) {
        expect(actionError(action, editor, stage)).toBeNull()
      }
    }
  })

  it('refuses the reviewer actions other than approvePublish for an editor who cannot review', () => {
    for (const action of REVIEWER_ACTIONS) {
      if (action === 'approvePublish') continue
      expect(actionError(action, editor, 'in_review')).toBe(NOT_AUTHORISED)
    }
  })

  it('lets a superadmin approve at structures and approve and publish at in_review (15)', () => {
    expect(actionError('approve', superadmin, 'structures')).toBeNull()
    expect(actionError('approvePublish', superadmin, 'in_review')).toBeNull()
  })

  it('tells an editor who cannot review that a reviewer is awaited (44)', () => {
    expect(actionError('approvePublish', { role: 'user', editor: true }, 'in_review')).toBe(
      'Waiting for a reviewer',
    )
  })

  it('refuses approvePublish for a user with no capability as not authorised', () => {
    expect(actionError('approvePublish', { role: 'user' }, 'in_review')).toBe(NOT_AUTHORISED)
  })

  it('treats an edit at in_review and a send back at live as moved on (48)', () => {
    const both = { role: 'user', editor: true, reviewer: true }
    expect(actionError('lightEdit', both, 'in_review')).toBe(WORKFLOW_ERRORS.movedOn)
    expect(actionError('sendBack', both, 'live')).toBe(WORKFLOW_ERRORS.movedOn)
  })

  it('lets only an editor add or remove a fact, at structures, or past it by moving back (95, GD28)', () => {
    const reviewer = { role: 'user', reviewer: true }
    for (const action of ['addFact', 'removeFact'] as const) {
      expect(ACTION_STAGES[action]).toEqual(['structures'])
      expect(actionError(action, editor, 'structures')).toBeNull()
      expect(actionError(action, reviewer, 'structures')).toBe(NOT_AUTHORISED)
      expect(actionError(action, { role: 'admin' }, 'structures')).toBe(NOT_AUTHORISED)
      expect(actionError(action, editor, 'source')).toBe(WORKFLOW_ERRORS.movedOn)
    }
  })

  it('lets only an editor edit a slot, before approval, or past it by moving back (98, GD28)', () => {
    const reviewer = { role: 'user', reviewer: true }
    expect(ACTION_STAGES.editSlot).toEqual(['structures'])
    expect(actionError('editSlot', editor, 'structures')).toBeNull()
    expect(actionError('editSlot', reviewer, 'structures')).toBe(NOT_AUTHORISED)
    expect(actionError('editSlot', { role: 'admin' }, 'structures')).toBe(NOT_AUTHORISED)
  })

  it('lets only an editor take another take on a slide, before approval, or past it by moving back (99, GD28)', () => {
    const reviewer = { role: 'user', reviewer: true }
    expect(ACTION_STAGES.redraftSlide).toEqual(['structures'])
    expect(actionError('redraftSlide', editor, 'structures')).toBeNull()
    expect(actionError('redraftSlide', reviewer, 'structures')).toBe(NOT_AUTHORISED)
    expect(actionError('redraftSlide', { role: 'admin' }, 'structures')).toBe(NOT_AUTHORISED)
  })

  it('lets only an editor swap a layout, change the look or choose the preset, before approval, or past it by moving back (GD4, GD5, GD9, GD28)', () => {
    const reviewer = { role: 'user', reviewer: true }
    for (const action of ['setSlideLayout', 'setLook', 'setPreset'] as const) {
      expect(ACTION_STAGES[action]).toEqual(['structures'])
      expect(actionError(action, editor, 'structures')).toBeNull()
      expect(actionError(action, reviewer, 'structures')).toBe(NOT_AUTHORISED)
      expect(actionError(action, { role: 'admin' }, 'structures')).toBe(NOT_AUTHORISED)
      expect(editHome(action, 'approved')).toBe('structures')
    }
  })

  it('lets only an editor pick an idea or ask for more, at the text versions, or past them by moving back (GD1–GD3, GD28)', () => {
    const reviewer = { role: 'user', reviewer: true }
    for (const action of ['pickIdeas', 'moreIdeas'] as const) {
      expect(ACTION_STAGES[action]).toEqual(['structures'])
      expect(actionError(action, editor, 'structures')).toBeNull()
      expect(actionError(action, reviewer, 'structures')).toBe(NOT_AUTHORISED)
      expect(actionError(action, { role: 'admin' }, 'structures')).toBe(NOT_AUTHORISED)
      expect(actionError(action, editor, 'source')).toBe(WORKFLOW_ERRORS.movedOn)
    }
  })

  it('lets only an editor change the outline or write its slides, at the text versions, or past them by moving back (GD32, GD28)', () => {
    const reviewer = { role: 'user', reviewer: true }
    for (const action of ['editOutline', 'writeSlides'] as const) {
      expect(ACTION_STAGES[action]).toEqual(['structures'])
      expect(actionError(action, editor, 'structures')).toBeNull()
      expect(actionError(action, reviewer, 'structures')).toBe(NOT_AUTHORISED)
      expect(actionError(action, { role: 'admin' }, 'structures')).toBe(NOT_AUTHORISED)
      expect(actionError(action, reviewer, 'rendered')).toBe(NOT_AUTHORISED)
      expect(actionError(action, editor, 'source')).toBe(WORKFLOW_ERRORS.movedOn)
      expect(editHome(action, 'rendered')).toBe('structures')
    }
  })

  it("lets only an editor pick a blog's angle or change its outline, at the text, or past it by moving back (BR1, BR2, GD28)", () => {
    const reviewer = { role: 'user', reviewer: true }
    for (const action of ['pickBlogAngle', 'editBlogOutline'] as const) {
      expect(ACTION_STAGES[action]).toEqual(['structures'])
      expect(actionError(action, editor, 'structures')).toBeNull()
      expect(actionError(action, reviewer, 'structures')).toBe(NOT_AUTHORISED)
      expect(actionError(action, { role: 'admin' }, 'structures')).toBe(NOT_AUTHORISED)
      expect(actionError(action, editor, 'source')).toBe(WORKFLOW_ERRORS.movedOn)
      expect(editHome(action, 'rendered')).toBe('structures')
    }
  })

  it("lets only an editor write a blog's text or edit it, at the text, or past it by moving back; and approve it at the text only (BR3, GD28)", () => {
    const reviewer = { role: 'user', reviewer: true }
    for (const action of ['writeBlog', 'editBlogText', 'approveBlogText'] as const) {
      expect(ACTION_STAGES[action]).toEqual(['structures'])
      expect(actionError(action, editor, 'structures')).toBeNull()
      expect(actionError(action, reviewer, 'structures')).toBe(NOT_AUTHORISED)
      expect(actionError(action, { role: 'admin' }, 'structures')).toBe(NOT_AUTHORISED)
      expect(actionError(action, editor, 'source')).toBe(WORKFLOW_ERRORS.movedOn)
    }
    expect(editHome('writeBlog', 'rendered')).toBe('structures')
    expect(editHome('editBlogText', 'approved')).toBe('structures')
    expect(editHome('approveBlogText', 'approved')).toBeNull()
    expect(actionError('approveBlogText', editor, 'approved')).toBe(WORKFLOW_ERRORS.movedOn)
  })

  it('lets only an editor nudge a slide or a version, or take a slide from another version, before approval, or past it by moving back (GD10, GD11, GD28)', () => {
    const reviewer = { role: 'user', reviewer: true }
    for (const action of ['nudgeSlide', 'nudgeVersion', 'useSlide'] as const) {
      expect(ACTION_STAGES[action]).toEqual(['structures'])
      expect(actionError(action, editor, 'structures')).toBeNull()
      expect(actionError(action, reviewer, 'structures')).toBe(NOT_AUTHORISED)
      expect(actionError(action, { role: 'admin' }, 'structures')).toBe(NOT_AUTHORISED)
      expect(editHome(action, 'approved')).toBe('structures')
    }
  })

  it("lets only an editor change the post's page, before approval, or past it by moving back (105, GD28)", () => {
    const reviewer = { role: 'user', reviewer: true }
    expect(ACTION_STAGES.page).toEqual(['structures'])
    expect(actionError('page', editor, 'structures')).toBeNull()
    expect(actionError('page', reviewer, 'structures')).toBe(NOT_AUTHORISED)
    expect(actionError('page', { role: 'admin' }, 'structures')).toBe(NOT_AUTHORISED)
  })

  it("lets only an editor use the source's wording, on the picked version or the rendered post (104)", () => {
    const reviewer = { role: 'user', reviewer: true }
    for (const stage of ['structures', 'rendered'] as const) {
      expect(actionError('sourceWording', editor, stage)).toBeNull()
      expect(actionError('sourceWording', reviewer, stage)).toBe(NOT_AUTHORISED)
      expect(actionError('sourceWording', { role: 'admin' }, stage)).toBe(NOT_AUTHORISED)
    }
    for (const stage of ['approved', 'in_review', 'live'] as const) {
      expect(actionError('sourceWording', editor, stage)).toBe(WORKFLOW_ERRORS.movedOn)
    }
  })

  it('lets an editor try a failed source check again wherever its results show (98)', () => {
    expect(actionError('sourceCheck', editor, 'structures')).toBeNull()
    expect(actionError('sourceCheck', editor, 'rendered')).toBeNull()
    expect(actionError('sourceCheck', { role: 'user', reviewer: true }, 'structures')).toBe(
      NOT_AUTHORISED,
    )
  })

  it('treats render at structures as moved on (33)', () => {
    expect(actionError('render', editor, 'structures')).toBe(WORKFLOW_ERRORS.movedOn)
  })

  it('treats market at in_review as moved on (61) and adapt at rendered as moved on (62)', () => {
    expect(actionError('market', editor, 'in_review')).toBe(WORKFLOW_ERRORS.movedOn)
    expect(actionError('adapt', editor, 'rendered')).toBe(WORKFLOW_ERRORS.movedOn)
  })

  it('has no slide vision check or override for anyone to run (103)', () => {
    const actions: readonly string[] = [...EDITOR_ACTIONS, ...REVIEWER_ACTIONS]
    for (const gone of ['vision', 'socialVision', 'overrideVision']) {
      expect(actions).not.toContain(gone)
    }
  })

  it('lets only an editor make covers and use one, and only on a rendered post (102)', () => {
    const reviewer = { role: 'user', reviewer: true }
    for (const action of ['makeCovers', 'chooseCover'] as const) {
      expect(actionError(action, editor, 'rendered')).toBeNull()
      expect(actionError(action, reviewer, 'rendered')).toBe(NOT_AUTHORISED)
      expect(actionError(action, { role: 'admin' }, 'rendered')).toBe(NOT_AUTHORISED)
      for (const stage of ['structures', 'approved', 'in_review', 'live'] as const) {
        expect(actionError(action, editor, stage)).toBe(WORKFLOW_ERRORS.movedOn)
      }
    }
    // "Make covers" replaces the art prompt and "Regenerate this slide only".
    expect(EDITOR_ACTIONS as readonly string[]).not.toContain('regenerateCover')
  })

  it('lets only an editor plan, edit and draw images once the text is approved, and nudge one once drawn; a scene edited in review or live moves back (GD12–GD14, GD28)', () => {
    const reviewer = { role: 'user', reviewer: true }
    for (const action of ['planImages', 'editImageScene', 'drawImages'] as const) {
      expect(ACTION_STAGES[action]).toEqual(['approved', 'rendered'])
    }
    expect(ACTION_STAGES.nudgeImage).toEqual(['rendered'])
    for (const action of ['planImages', 'editImageScene', 'drawImages', 'nudgeImage'] as const) {
      expect(actionError(action, editor, 'rendered')).toBeNull()
      expect(actionError(action, reviewer, 'rendered')).toBe(NOT_AUTHORISED)
      expect(actionError(action, { role: 'admin' }, 'rendered')).toBe(NOT_AUTHORISED)
      expect(actionError(action, editor, 'structures')).toBe(WORKFLOW_ERRORS.movedOn)
      const moves = action === 'editImageScene'
      for (const stage of ['in_review', 'live'] as const) {
        expect(actionError(action, editor, stage)).toBe(moves ? null : WORKFLOW_ERRORS.movedOn)
      }
    }
    expect(actionError('nudgeImage', editor, 'approved')).toBe(WORKFLOW_ERRORS.movedOn)
  })

  it('lets only an editor restore a version, where the text may still change; an approved one only past the gate (101)', () => {
    const reviewer = { role: 'user', reviewer: true }
    for (const stage of ['structures', 'approved', 'rendered'] as const) {
      expect(actionError('restore', editor, stage)).toBeNull()
      expect(actionError('restore', superadmin, stage)).toBeNull()
      expect(actionError('restore', reviewer, stage)).toBe(NOT_AUTHORISED)
      expect(actionError('restore', { role: 'admin' }, stage)).toBe(NOT_AUTHORISED)
    }
    for (const stage of ['source', 'in_review', 'live', 'exported'] as const) {
      expect(actionError('restore', editor, stage)).toBe(WORKFLOW_ERRORS.movedOn)
    }
    // A structure is restored at any of those stages; a revision never crosses the gate backwards.
    for (const stage of ['structures', 'approved', 'rendered'] as const) {
      expect(restoreError('drafts', stage)).toBeNull()
    }
    expect(restoreError('revision', 'approved')).toBeNull()
    expect(restoreError('revision', 'rendered')).toBeNull()
    expect(restoreError('revision', 'structures')).toBe(WORKFLOW_ERRORS.restoreGate)
  })

  it("lists no editor action at in_review but the editor's own withdraw and discard (115, 119)", () => {
    for (const action of EDITOR_ACTIONS) {
      if (action === 'withdraw' || action === 'discardChanges') continue
      expect(ACTION_STAGES[action]).not.toContain('in_review')
    }
    expect(ACTION_STAGES.withdraw).toEqual(['in_review'])
  })

  it('names only real stages', () => {
    for (const stages of Object.values(ACTION_STAGES)) {
      for (const s of stages) expect(STAGES).toContain(s)
    }
  })
})

describe('an edit at a passed step moves the post back by itself (GD28)', () => {
  const TEXT_EDITS = [
    'tick',
    'addFact',
    'removeFact',
    'draft',
    'pick',
    'theme',
    'fixUnbound',
    'editSlot',
    'redraftSlide',
    'nudgeSlide',
    'nudgeVersion',
    'useSlide',
    'pickIdeas',
    'moreIdeas',
    'editOutline',
    'writeSlides',
    'setSlideLayout',
    'setLook',
    'setPreset',
    'page',
    // A page found by "Research this" added as a source, its sentence a fact (BR14).
    'addResearchSource',
    // A comic's planned scene and its panels, changed on the storyboard (RC3).
    'editScene',
    'editPanels',
  ] as const
  const PASSED = ['approved', 'rendered', 'in_review', 'live'] as const

  it('moves a text edit back to the text versions from every later stage of a feed post', () => {
    for (const action of TEXT_EDITS) {
      expect(editHome(action, 'structures')).toBeNull()
      for (const stage of PASSED) {
        expect(editHome(action, stage)).toBe('structures')
        expect(actionError(action, editor, stage)).toBeNull()
      }
    }
  })

  it('moves a changed source back to the source from the text versions on', () => {
    expect(editHome('remake', 'source')).toBeNull()
    for (const stage of ['structures', ...PASSED] as const) {
      expect(editHome('remake', stage)).toBe('source')
      expect(actionError('remake', editor, stage)).toBeNull()
    }
  })

  it('keeps "Continue with this source" at the source: it changes nothing, so moves nothing back (113)', () => {
    expect(ACTION_STAGES.continueSource).toEqual(['source'])
    expect(actionError('continueSource', editor, 'source')).toBeNull()
    for (const stage of ['structures', ...PASSED] as const) {
      expect(editHome('continueSource', stage)).toBeNull()
      expect(actionError('continueSource', editor, stage)).toBe(WORKFLOW_ERRORS.movedOn)
    }
  })

  it('moves a scene edit back to the images from review or live; before approval it is moved on', () => {
    for (const stage of ['approved', 'rendered'] as const) {
      expect(editHome('editImageScene', stage)).toBeNull()
    }
    for (const stage of ['in_review', 'live'] as const) {
      expect(editHome('editImageScene', stage)).toBe('rendered')
      expect(actionError('editImageScene', editor, stage)).toBeNull()
    }
    expect(editHome('editImageScene', 'structures')).toBeNull()
    expect(actionError('editImageScene', editor, 'structures')).toBe(WORKFLOW_ERRORS.movedOn)
  })

  it('runs "Research this" where the source check shows, moving nothing: it saves nothing (BR14)', () => {
    for (const stage of ['structures', 'rendered'] as const) {
      expect(actionError('researchClaim', editor, stage)).toBeNull()
    }
    for (const stage of STAGES) {
      expect(editHome('researchClaim', stage)).toBeNull()
      expect(actionError('researchClaim', { role: 'user', reviewer: true }, stage)).toBe(
        NOT_AUTHORISED,
      )
    }
    for (const stage of ['source', 'approved', 'in_review', 'live'] as const) {
      expect(actionError('researchClaim', editor, stage)).toBe(WORKFLOW_ERRORS.movedOn)
    }
  })

  it('never moves a post back before its home, nor a social version (ready, exported)', () => {
    for (const action of ['editSlot', 'addFact'] as const) {
      expect(editHome(action, 'source')).toBeNull()
      expect(actionError(action, editor, 'source')).toBe(WORKFLOW_ERRORS.movedOn)
    }
    for (const stage of ['ready', 'exported'] as const) {
      for (const action of [...TEXT_EDITS, 'remake', 'editImageScene'] as const) {
        expect(editHome(action, stage)).toBeNull()
        expect(actionError(action, editor, stage)).toBe(WORKFLOW_ERRORS.movedOn)
      }
    }
  })

  it('leaves every other action where it runs: approve, render, review and the moves', () => {
    for (const action of [
      'approve',
      'render',
      'sendToReview',
      'drawImages',
      'lightEdit',
    ] as const) {
      for (const stage of STAGES) expect(editHome(action, stage)).toBeNull()
    }
    expect(actionError('approve', editor, 'rendered')).toBe(WORKFLOW_ERRORS.movedOn)
    expect(actionError('drawImages', editor, 'in_review')).toBe(WORKFLOW_ERRORS.movedOn)
  })

  it('refuses a reviewer or an admin without editor at a passed step as not authorised', () => {
    for (const stage of PASSED) {
      expect(actionError('editSlot', { role: 'user', reviewer: true }, stage)).toBe(NOT_AUTHORISED)
      expect(actionError('editSlot', { role: 'admin' }, stage)).toBe(NOT_AUTHORISED)
    }
  })
})

describe('editWaitError: an edit at a passed step waits while a step runs (criterion 122)', () => {
  const waiting = 'Covers are being drawn'

  it('gives the running step in words for an edit at a passed step, and nothing when none runs', () => {
    expect(editWaitError('editSlot', editor, 'rendered', waiting)).toBe(waiting)
    expect(editWaitError('remake', editor, 'live', waiting)).toBe(waiting)
    expect(editWaitError('editSlot', editor, 'rendered', null)).toBeNull()
  })

  it('leaves an action at its own step as actionError says, running or not', () => {
    expect(editWaitError('editSlot', editor, 'structures', waiting)).toBeNull()
    expect(editWaitError('approve', editor, 'rendered', waiting)).toBe(WORKFLOW_ERRORS.movedOn)
  })

  it('refuses a viewer who may not edit as not authorised, before any wait', () => {
    expect(editWaitError('editSlot', { role: 'user', reviewer: true }, 'rendered', waiting)).toBe(
      NOT_AUTHORISED,
    )
  })
})

describe('the moves back (112, 115, 116, 118)', () => {
  const MOVES = {
    backToSource: ['structures', 'approved', 'rendered'],
    backToStructures: ['approved', 'rendered'],
    withdraw: ['in_review'],
    editLive: ['live'],
  } as const

  it('runs each move at its stages only', () => {
    for (const [action, stages] of Object.entries(MOVES) as [
      keyof typeof MOVES,
      readonly string[],
    ][]) {
      expect(ACTION_STAGES[action]).toEqual(stages as never)
      for (const stage of STAGES) {
        expect(actionError(action, editor, stage)).toBe(
          stages.includes(stage) ? null : WORKFLOW_ERRORS.movedOn,
        )
      }
    }
  })

  it('lets only an editor move a post back; a reviewer or an admin without editor is refused', () => {
    for (const [action, stages] of Object.entries(MOVES) as [
      keyof typeof MOVES,
      readonly Stage[],
    ][]) {
      expect(EDITOR_ACTIONS as readonly string[]).toContain(action)
      for (const stage of stages) {
        expect(actionError(action, { role: 'user', reviewer: true }, stage)).toBe(NOT_AUTHORISED)
        expect(actionError(action, { role: 'admin' }, stage)).toBe(NOT_AUTHORISED)
        expect(actionError(action, superadmin, stage)).toBeNull()
      }
    }
  })

  it('names the running step in the refusal as the disabled moves say it (118, 122)', () => {
    expect(stepRunningError('covers')).toBe('Covers are being drawn. Wait for it to finish.')
    expect(stepRunningError('source_check')).toBe(
      'The source check is running. Wait for it to finish.',
    )
    expect(stepRunningError('draft_slide:3')).toBe(
      'Slide 3 is being redrafted. Wait for it to finish.',
    )
    // A step with no words of its own still refuses.
    expect(stepRunningError('something_new')).toBe('A step is running. Wait for it to finish.')
  })
})

describe('discardChanges (119)', () => {
  const STAGES_ALLOWED = ['source', 'structures', 'approved', 'rendered', 'in_review'] as const

  it('runs for an editor at the working stages, in review too, and nowhere else', () => {
    expect(ACTION_STAGES.discardChanges).toEqual(STAGES_ALLOWED as never)
    for (const stage of STAGES) {
      expect(actionError('discardChanges', editor, stage)).toBe(
        (STAGES_ALLOWED as readonly string[]).includes(stage) ? null : WORKFLOW_ERRORS.movedOn,
      )
    }
  })

  it('refuses a reviewer or an admin without editor', () => {
    for (const stage of STAGES_ALLOWED) {
      expect(actionError('discardChanges', { role: 'user', reviewer: true }, stage)).toBe(
        NOT_AUTHORISED,
      )
      expect(actionError('discardChanges', { role: 'admin' }, stage)).toBe(NOT_AUTHORISED)
    }
  })
})

describe('changedSincePublished (116, 119)', () => {
  it('is true for a published post at a working stage, false live, exported or never published', () => {
    for (const stage of STAGES) {
      const working = stage !== 'live' && stage !== 'exported'
      expect(changedSincePublished(stage, 'approval-1')).toBe(working)
      expect(changedSincePublished(stage, null)).toBe(false)
    }
  })
})

describe('settingsError and normaliseSettings', () => {
  it('refuses missing settings (50)', () => {
    expect(settingsError(null)).toBe(WORKFLOW_ERRORS.missingSetting)
  })

  it('refuses Featured with matched (51)', () => {
    expect(
      settingsError({ ...settings, layer: 'featured', audience: { mode: 'matched', rules: [] } }),
    ).toBe(WORKFLOW_ERRORS.featuredEveryone)
  })

  it('refuses Personal or matched with a blank why line (52)', () => {
    expect(settingsError({ ...settings, layer: 'personal', whyLine: '  ' })).toBe(
      WORKFLOW_ERRORS.whyLine,
    )
    expect(
      settingsError({ ...settings, audience: { mode: 'matched', rules: [] }, whyLine: null }),
    ).toBe(WORKFLOW_ERRORS.whyLine)
  })

  it('accepts a general post for everyone and a personal one with a why line', () => {
    expect(settingsError(settings)).toBeNull()
    expect(
      settingsError({ ...settings, layer: 'personal', whyLine: 'Because you study.' }),
    ).toBeNull()
  })

  it('forces Featured to Everyone', () => {
    const featured = normaliseSettings({
      ...settings,
      layer: 'featured',
      audience: { mode: 'matched', rules: ['a'] },
    })
    expect(featured.audience).toEqual({ mode: 'everyone', rules: [] })
  })

  it('drops the why line from General with Everyone', () => {
    expect(normaliseSettings({ ...settings, whyLine: 'Because.' }).whyLine).toBeNull()
  })

  it('clears the rules of any audience that is everyone', () => {
    const general = normaliseSettings({ ...settings, audience: { mode: 'everyone', rules: ['a'] } })
    expect(general.audience).toEqual({ mode: 'everyone', rules: [] })
    expect(general.whyLine).toBeNull()
  })
})

describe('missingSettingError (52)', () => {
  it('names exactly the settings that are missing, in the order layer, audience, expiry', () => {
    expect(missingSettingError(['expiry'])).toBe('Choose the expiry before sending to review.')
    expect(missingSettingError(['expiry', 'audience'])).toBe(
      'Choose the audience and expiry before sending to review.',
    )
    expect(missingSettingError(['expiry', 'layer', 'audience'])).toBe(
      WORKFLOW_ERRORS.missingSetting,
    )
    expect(WORKFLOW_ERRORS.missingSetting).toBe(
      'Choose the layer, audience and expiry before sending to review.',
    )
  })
})

describe('sendToReviewError', () => {
  const withSettings = { id: 's1', body: settings }

  it('refuses missing settings first', () => {
    expect(sendToReviewError(withCheck('found'))).toBe(WORKFLOW_ERRORS.missingSetting)
  })

  it('asks for the source check when there is no current one', () => {
    expect(sendToReviewError({ ...empty, settings: withSettings })).toBe(WORKFLOW_ERRORS.checkFirst)
  })

  it('refuses a claim the check could not find (43)', () => {
    expect(sendToReviewError({ ...withCheck('not_found'), settings: withSettings })).toBe(
      WORKFLOW_ERRORS.notFound,
    )
  })

  it('passes when every claim is found or marked opinion (43)', () => {
    const checked = { settings: withSettings }
    expect(sendToReviewError({ ...withCheck('found'), ...checked })).toBeNull()
    expect(sendToReviewError({ ...withCheck('opinion'), ...checked })).toBeNull()
  })

  it('never waits on a slide vision check, with a market version too (103)', () => {
    expect(sendToReviewError({ ...withCheck('found'), settings: withSettings, market })).toBeNull()
  })
})

describe('approveStructureError', () => {
  const fact: Fact = {
    id: 'f1',
    text: 'Pass rates fell by 11 percentage points.',
    value: { number: 11, unit: 'percent' },
    ref: '¶1',
    quote: null,
    supported: true,
    why: null,
    span: null,
  }
  const structure = (body: string): Structure => ({
    templateId: 'the-line',
    artPrompt: 'A desk.',
    slides: [
      {
        kind: 'body',
        slots: {
          heading: { text: 'Finding', factIds: [], factual: false },
          body: { text: body, factIds: ['f1'], factual: true },
        },
      },
    ],
  })
  const post = (body: string): CurrentPost => ({
    ...empty,
    facts: { id: 'facts1', body: { sourceId: 's', keyIdeas: [], facts: [fact], replays: [] } },
    drafts: {
      id: 'd1',
      body: {
        factsId: 'facts1',
        attempt: 1,
        items: [{ structure: structure(body), template }],
        replays: [],
        emotion: null,
        note: null,
      },
    },
  })
  const pointers = (p: Partial<Pointers>): Pointers => ({
    ...emptyPointers(),
    picked: 0,
    themeId: 'ink',
    ...p,
  })

  it('asks for a pick, then a theme', () => {
    expect(approveStructureError(pointers({ picked: null }), post('Fell by 11 points.'))).toBe(
      WORKFLOW_ERRORS.noPick,
    )
    expect(approveStructureError(pointers({ themeId: null }), post('Fell by 11 points.'))).toBe(
      WORKFLOW_ERRORS.noTheme,
    )
  })

  it('refuses a slot stating a number its fact does not (28)', () => {
    expect(approveStructureError(pointers({}), post('Fell by 12 points.'))).toBe(
      WORKFLOW_ERRORS.unbound,
    )
  })

  it('passes a correctly bound pick', () => {
    expect(approveStructureError(pointers({}), post('Fell by 11 points.'))).toBeNull()
  })

  it('reads as moved on when the picked draft is gone', () => {
    expect(approveStructureError(pointers({ picked: 5 }), post('Fell by 11 points.'))).toBe(
      WORKFLOW_ERRORS.movedOn,
    )
  })
})

describe('the comic storyboard (RC3–RC5)', () => {
  const comic = templateById('comic')
  if (!comic) throw new Error('comic template missing')
  const fee: Fact = {
    id: 'f1',
    text: 'Tuition is AUD 30k a year.',
    value: { number: 30000, unit: 'AUD' },
    ref: '¶1',
    quote: null,
    supported: true,
    why: null,
    span: null,
  }
  const panel = (caption: string, scene: string | null) => ({
    kind: 'body' as 'cover' | 'body',
    slots: { caption: { text: caption, factIds: [], factual: false } },
    scene,
  })
  const story = (panels: ReturnType<typeof panel>[]): CurrentPost => ({
    ...empty,
    facts: { id: 'facts1', body: { sourceId: 's', keyIdeas: [], facts: [fee], replays: [] } },
    drafts: {
      id: 'd1',
      body: {
        factsId: 'facts1',
        attempt: 1,
        items: [
          {
            structure: {
              templateId: 'comic',
              artPrompt: 'A campus.',
              slides: panels.map((p, i) => (i === 0 ? { ...p, kind: 'cover' as const } : p)),
            },
            template: comic,
          },
        ],
        replays: [],
        emotion: null,
        note: null,
      },
    },
  })
  const pointers = { ...emptyPointers(), picked: 0, themeId: 'pop' }
  const fine = (when: string) => panel(`Classes start in the ${when}.`, `A street in the ${when}.`)

  it('makes a scene edit and a panel change editor actions on the storyboard only', () => {
    const reviewer = { role: 'user', reviewer: true }
    for (const action of ['editScene', 'editPanels'] as const) {
      expect(EDITOR_ACTIONS as readonly string[]).toContain(action)
      expect(ACTION_STAGES[action]).toEqual(['structures'])
      expect(actionError(action, editor, 'structures')).toBeNull()
      expect(actionError(action, reviewer, 'structures')).toBe(NOT_AUTHORISED)
      expect(actionError(action, { role: 'admin' }, 'structures')).toBe(NOT_AUTHORISED)
      expect(actionError(action, editor, 'source')).toBe(WORKFLOW_ERRORS.movedOn)
    }
  })

  it('approves a storyboard whose every panel has a scene and a caption the rules pass', () => {
    const ok = story([
      fine('morning'),
      panel('It costs AUD 30k a year.', 'A desk.'),
      fine('evening'),
    ])
    expect(approveStructureError(pointers, ok)).toBeNull()
  })

  it('refuses an empty scene, naming its panel', () => {
    for (const scene of ['', '   ', null]) {
      const post = story([
        fine('morning'),
        fine('afternoon'),
        fine('evening'),
        panel('After class.', scene),
      ])
      expect(approveStructureError(pointers, post)).toBe('Plan the scene for panel 4.')
    }
  })

  it('refuses an empty caption, naming its panel', () => {
    for (const caption of ['', '   ']) {
      const post = story([fine('morning'), panel(caption, 'A desk.'), fine('evening')])
      expect(approveStructureError(pointers, post)).toBe('Write a caption for panel 2.')
    }
  })

  it('sends a comic to review once every panel is drawn, with no source check to wait on (RC4, RC6)', () => {
    const slides = [fine('morning'), fine('afternoon'), fine('evening')].map((p, i) =>
      i === 0 ? { ...p, kind: 'cover' as const } : p,
    )
    const drawn = (assets: (string | null)[]): CurrentPost => ({
      ...empty,
      settings: { id: 's1', body: settings },
      revision: {
        id: 'r1',
        body: {
          factsId: 'facts1',
          structure: { templateId: 'comic', artPrompt: 'A campus.', slides },
          template: comic,
          brand: {} as never,
          themeId: 'pop',
          by: { userId: 'u1', name: 'Ed', at: '2026-10-14T09:00:00.000Z' },
          note: 'approved',
          emotion: null,
        },
      },
      render: {
        id: 'ren1',
        body: {
          revisionId: 'r1',
          layoutId: 'l1',
          art: { assetId: null, fallback: null, prompt: '', version: 1 },
          slides: [],
          slideArt: assets.map((assetId, i) => ({
            slide: i + 1,
            assetId,
            scene: 'A street.',
            take: 1,
            nudge: null,
            fallback: assetId ? null : ('daily_limit' as const),
          })),
        },
      },
    })
    expect(sendToReviewError(drawn(['a1', 'a2', null]))).toBe('Draw every panel first.')
    expect(sendToReviewError(drawn(['a1', 'a2']))).toBe('Draw every panel first.')
    expect(sendToReviewError(drawn(['a1', 'a2', 'a3']))).toBeNull()
    expect(sendToReviewError({ ...drawn(['a1', 'a2', 'a3']), settings: null })).toBe(
      WORKFLOW_ERRORS.missingSetting,
    )
  })

  it("refuses a caption the comic rules refuse, with the rule's words after its panel", () => {
    const promise = story([fine('morning'), panel('PR is guaranteed.', 'A desk.'), fine('evening')])
    expect(approveStructureError(pointers, promise)).toBe(
      `Panel 2: ${comicCaptionError('PR is guaranteed.', [fee])}`,
    )
    const figure = story([
      fine('morning'),
      fine('afternoon'),
      panel('Rent is AUD 400 a week.', 'A flat.'),
    ])
    expect(approveStructureError(pointers, figure)).toBe(
      `Panel 3: ${comicCaptionError('Rent is AUD 400 a week.', [fee])}`,
    )
  })
})

describe('renderError', () => {
  const layout = (checks: FitCheck[]): CurrentPost => ({
    ...empty,
    layout: { id: 'l1', body: { revisionId: 'r1', slides: [], fits: [], fitChecks: checks } },
  })

  it('reads as moved on with no current layout', () => {
    expect(renderError(empty)).toBe(WORKFLOW_ERRORS.movedOn)
  })

  it('refuses a failing fit row (35) and passes when all pass', () => {
    expect(renderError(layout([row(true), row(false)]))).toBe(WORKFLOW_ERRORS.fitFailed)
    expect(renderError(layout([row(true)]))).toBeNull()
  })
})

describe('publishError', () => {
  it('waits for a reviewer when the viewer cannot review', () => {
    expect(publishError(editor)).toBe(WORKFLOW_ERRORS.waitingForReviewer)
  })

  it('lets a reviewer publish, with no slide vision check to wait on (103)', () => {
    expect(publishError(superadmin)).toBeNull()
  })
})

describe('coverIdeaError (102)', () => {
  it('takes no idea, or one of up to 120 characters, and refuses a longer one', () => {
    expect(COVER_IDEA_MAX).toBe(120)
    expect(coverIdeaError('')).toBeNull()
    expect(coverIdeaError('A rainy window at dusk')).toBeNull()
    expect(coverIdeaError(`  ${'x'.repeat(120)}  `)).toBeNull()
    expect(coverIdeaError('x'.repeat(121))).toBe(WORKFLOW_ERRORS.coverIdea)
  })

  it('counts a Nepali, Hindi or Thai idea in characters as a reader sees them (GD37)', () => {
    for (const id of NATIVE_IDS) {
      expect(coverIdeaError(nativeOf(id, 120)), id).toBeNull()
      expect(coverIdeaError(nativeOf(id, 121)), id).toBe(WORKFLOW_ERRORS.coverIdea)
    }
  })
})

describe('sendBackError', () => {
  it('requires a reason of one to 200 characters (47)', () => {
    expect(sendBackError('  ')).toBe(WORKFLOW_ERRORS.reasonRequired)
    expect(sendBackError('x'.repeat(201))).toBe(WORKFLOW_ERRORS.reasonRequired)
    expect(sendBackError('Wrong number on slide 2.')).toBeNull()
    for (const id of NATIVE_IDS) {
      expect(sendBackError(nativeOf(id, 200)), id).toBeNull()
      expect(sendBackError(nativeOf(id, 201)), id).toBe(WORKFLOW_ERRORS.reasonRequired)
    }
  })
})

describe('exportError', () => {
  const caption = (checked: boolean): CurrentPost => ({
    ...empty,
    caption: {
      id: 'c1',
      body: {
        renderId: 'rd1',
        platform: 'instagram',
        text: 't',
        hashtags: [],
        approvedText: 't',
        approvedHashtags: [],
        checked,
        notFound: [],
      },
    },
  })

  it('asks for the check when the caption is missing or unchecked (66)', () => {
    expect(exportError(empty)).toBe(WORKFLOW_ERRORS.captionCheck)
    expect(exportError(caption(false))).toBe(WORKFLOW_ERRORS.captionCheck)
    expect(exportError(caption(true))).toBeNull()
  })
})

describe('kindError: a blog runs its own text steps, a feed post its slides (BR1–BR3)', () => {
  const SLIDE_ACTIONS = [
    'tick',
    'draft',
    'pick',
    'theme',
    'fixUnbound',
    'editSlot',
    'redraftSlide',
    'nudgeSlide',
    'nudgeVersion',
    'useSlide',
    'pickIdeas',
    'editOutline',
    'writeSlides',
    'setSlideLayout',
    'setLook',
    'approve',
  ] as const
  const BLOG_ACTIONS = [
    'pickBlogAngle',
    'editBlogOutline',
    'writeBlog',
    'editBlogText',
    'approveBlogText',
    'embedPostSlides',
  ] as const

  it('refuses every slide, idea, outline, chip and slide approval action on a blog as moved on', () => {
    for (const action of SLIDE_ACTIONS) {
      expect(kindError(action, 'blog')).toBe(WORKFLOW_ERRORS.movedOn)
      expect(kindError(action, 'feed')).toBeNull()
    }
  })

  it('refuses every blog action on a feed post or a social version as moved on', () => {
    for (const action of BLOG_ACTIONS) {
      expect(kindError(action, 'feed')).toBe(WORKFLOW_ERRORS.movedOn)
      expect(kindError(action, 'social')).toBe(WORKFLOW_ERRORS.movedOn)
      expect(kindError(action, 'blog')).toBeNull()
    }
  })

  it("embeds a linked post's slides at a blog's images, for an editor only (BR4)", () => {
    for (const stage of ['approved', 'rendered'] as const) {
      expect(actionError('embedPostSlides', editor, stage)).toBeNull()
      expect(actionError('embedPostSlides', { role: 'user', reviewer: true }, stage)).toBe(
        NOT_AUTHORISED,
      )
    }
    expect(actionError('embedPostSlides', editor, 'structures')).toBe(WORKFLOW_ERRORS.movedOn)
    expect(actionError('embedPostSlides', editor, 'in_review')).toBe(WORKFLOW_ERRORS.movedOn)
  })

  it('leaves the steps both share to either: the source, more ideas, research and the moves', () => {
    for (const action of [
      'remake',
      'moreIdeas',
      'addFact',
      'researchClaim',
      'sourceCheck',
      'backToSource',
    ] as const) {
      expect(kindError(action, 'blog')).toBeNull()
      expect(kindError(action, 'feed')).toBeNull()
    }
  })
})

describe('approveBlogTextError (BR3, criterion 43)', () => {
  const blogText = (unanswered = false): CurrentPost['blogText'] => ({
    id: 'bt1',
    body: {
      outlineId: 'bo1',
      sections: [{ heading: 'How long?', body: 'Up to 48 hours.', factIds: ['f1'] }],
      takeaways: ['A.', 'B.', 'C.'],
      faq: [
        { q: 'Who?', a: 'Students.', factIds: ['f1'] },
        { q: 'When?', a: 'Now.', factIds: ['f1'] },
        { q: 'Where?', a: unanswered ? '' : 'Here.', factIds: unanswered ? [] : ['f1'] },
      ],
      emotion: null,
      note: 'Written',
    },
  })
  const checked = (
    ...results: ('found' | 'not_found' | 'opinion')[]
  ): CurrentPost['sourceCheck'] => ({
    id: 'sc1',
    body: {
      revisionId: null,
      blogTextId: 'bt1',
      replays: [],
      claims: results.map((result) => ({
        text: 'A.',
        slide: 1,
        slot: 'section',
        result,
        ref: null,
      })),
    },
  })

  it('asks for the text, then an answer to every question, then the check, then every sentence found', () => {
    expect(approveBlogTextError(empty)).toBe(WORKFLOW_ERRORS.writeFirst)
    expect(
      approveBlogTextError({ ...empty, blogText: blogText(true), sourceCheck: checked('found') }),
    ).toBe(WORKFLOW_ERRORS.unanswered)
    expect(approveBlogTextError({ ...empty, blogText: blogText() })).toBe(
      WORKFLOW_ERRORS.checkFirst,
    )
    expect(
      approveBlogTextError({
        ...empty,
        blogText: blogText(),
        sourceCheck: checked('found', 'not_found'),
      }),
    ).toBe(WORKFLOW_ERRORS.blogNotFound)
  })

  it('passes a clean check: every sentence found, or marked opinion', () => {
    expect(
      approveBlogTextError({
        ...empty,
        blogText: blogText(),
        sourceCheck: checked('found', 'opinion'),
      }),
    ).toBeNull()
  })
})
