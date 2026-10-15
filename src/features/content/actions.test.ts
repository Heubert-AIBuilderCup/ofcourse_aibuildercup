import { beforeEach, describe, expect, mock, test } from 'bun:test'
import * as nextCache from 'next/cache'
import { EMOTION_ERROR } from './emotions'
import type { Saved } from './server/commands'
import { NATIVE_IDS, nativeOf } from './text/native-fixtures'

// The actions with the session, the commands and the cache mocked: what they read from the
// session, what they refuse before any command runs, and what they refresh.

const ID = '0b0c3a52-7f6c-4c6a-9d3e-1f0a5f5f4b11'
/** The board, the post's address and each step screen by its literal path (GD27). */
const REFRESHED = [
  '/admin/board',
  `/admin/posts/${ID}`,
  ...['source', 'ideas', 'outline', 'text', 'images', 'settings', 'review', 'live', 'blog'].map(
    (s) => `/admin/posts/${ID}/${s}`,
  ),
]
const USER = { id: 'u1', role: 'user', editor: false, reviewer: true, name: 'Rae', extra: 'x' }
const SAVED = { ok: true as const, id: ID, version: 4 }
/** A record id as server/hash.ts writes them: the kind, then 32 hex characters. */
const RECORD = `drafts_${'a1'.repeat(16)}`

let session: { user: typeof USER } | null = { user: USER }
let answer: Saved | { ok: false; error: string } = SAVED
const calls: { name: string; args: unknown[] }[] = []
const revalidated: string[] = []

const record = (name: string) =>
  mock(async (...args: unknown[]) => {
    calls.push({ name, args })
    return answer
  })

mock.module('@/shared/lib/auth/session', () => ({ getSession: async () => session }))
// Next's own exports kept, so a later test file that mocks another one still finds it.
mock.module('next/cache', () => ({
  ...nextCache,
  revalidatePath: (p: string, type?: string) => revalidated.push(type ? `${p} (${type})` : p),
}))
mock.module('./server/commands', () => ({
  makePost: record('makePost'),
  tickTemplates: record('tickTemplates'),
  draftPost: record('draftPost'),
  pickStructure: record('pickStructure'),
  chooseTheme: record('chooseTheme'),
  choosePage: record('choosePage'),
  fixUnbound: record('fixUnbound'),
  editSlot: record('editSlot'),
  measureSlot: record('measureSlot'),
  redraftSlide: record('redraftSlide'),
  nudgeSlide: record('nudgeSlide'),
  nudgeVersion: record('nudgeVersion'),
  useSlide: record('useSlide'),
  setSlideLayout: record('setSlideLayout'),
  setLook: record('setLook'),
  setPreset: record('setPreset'),
  pickIdeas: record('pickIdeas'),
  pickBlogAngle: record('pickBlogAngle'),
  editBlogOutline: record('editBlogOutline'),
  writeBlog: record('writeBlog'),
  editBlogSection: record('editBlogSection'),
  approveBlogText: record('approveBlogText'),
  embedPostSlides: record('embedPostSlides'),
  makePostsFromBlog: record('makePostsFromBlog'),
  makeBlogFromPost: record('makeBlogFromPost'),
  linkToBlog: record('linkToBlog'),
  moreIdeas: record('moreIdeas'),
  editPostOutline: record('editPostOutline'),
  setOutlineFormat: record('setOutlineFormat'),
  writeSlides: record('writeSlides'),
  applySourceWording: record('applySourceWording'),
  approveStructure: record('approveStructure'),
  goBack: record('goBack'),
  withdrawFromReview: record('withdrawFromReview'),
  editLive: record('editLive'),
  discardChanges: record('discardChanges'),
  renderPost: record('renderPost'),
  retryArt: record('retryArt'),
  checkSource: record('checkSource'),
  markOpinion: record('markOpinion'),
  removeClaim: record('removeClaim'),
  saveSettings: record('saveSettings'),
  sendToReview: record('sendToReview'),
  approveAndPublish: record('approveAndPublish'),
  sendBack: record('sendBack'),
  lightEdit: record('lightEdit'),
  makeCovers: record('makeCovers'),
  chooseCover: record('chooseCover'),
  planImages: record('planImages'),
  editImageScene: record('editImageScene'),
  drawImages: record('drawImages'),
  nudgeImage: record('nudgeImage'),
  restoreVersion: record('restoreVersion'),
  makeMarket: record('makeMarket'),
  rewordMarket: record('rewordMarket'),
  addFact: record('addFact'),
  removeFact: record('removeFact'),
  remakeFromSource: record('remakeFromSource'),
  continueWithSource: record('continueWithSource'),
  suggestSources: record('suggestSources'),
  researchClaim: record('researchClaim'),
  addResearchSource: record('addResearchSource'),
}))
mock.module('./server/social', () => ({
  SOCIAL_ERRORS: {
    brand: 'Choose a page brand and a platform.',
    caption: 'Bad caption.',
    url: "Paste the post's instagram.com link.",
    set: 'The pages changed since this post was loaded. Reload and press again.',
  },
  adaptPost: record('adaptPost'),
  makeSet: record('makeSet'),
  recordPostUrl: record('recordPostUrl'),
  approveLayout: record('approveLayout'),
  renderSocial: record('renderSocial'),
  editCaption: record('editCaption'),
  checkCaption: record('checkCaption'),
  resetCaption: record('resetCaption'),
  markExported: record('markExported'),
}))

mock.module('./server/assign', () => ({ assignPost: record('assignPost') }))

const actions = await import('./actions')

const SETTINGS = {
  layer: 'general',
  audience: { mode: 'everyone', rules: [] },
  whyLine: null,
  expiry: { kind: 'none' },
  studioLink: null,
  sourcesAt: 'caption',
}

type Run = (...a: unknown[]) => Promise<unknown>

// Each action, the command it calls, and arguments after (id, version) that pass.
const CASES: [string, Run, string, unknown[]][] = [
  ['tickTemplates', actions.tickTemplatesAction as Run, 'tickTemplates', [['the-line']]],
  ['draft', actions.draftAction as Run, 'draftPost', [true]],
  ['pick', actions.pickAction as Run, 'pickStructure', [1]],
  ['theme', actions.themeAction as Run, 'chooseTheme', ['paper']],
  ['page', actions.choosePageAction as Run, 'choosePage', ['cerebral']],
  [
    'fixUnbound',
    actions.fixUnboundAction as Run,
    'fixUnbound',
    [{ slide: 2, slot: 'title', factId: 'f1' }],
  ],
  [
    'editSlot',
    actions.editSlotAction as Run,
    'editSlot',
    [{ slide: 2, slot: 'body', text: 'Most students who work keep their grades.' }],
  ],
  ['redraftSlide', actions.redraftSlideAction as Run, 'redraftSlide', [2]],
  ['nudgeSlide', actions.nudgeSlideAction as Run, 'nudgeSlide', [{ slide: 2, nudge: 'shorter' }]],
  [
    'nudgeVersion',
    actions.nudgeVersionAction as Run,
    'nudgeVersion',
    [{ index: 1, nudge: 'warmer' }],
  ],
  ['useSlide', actions.takeSlideAction as Run, 'useSlide', [{ from: 1, slide: 3 }]],
  [
    'setSlideLayout',
    actions.setSlideLayoutAction as Run,
    'setSlideLayout',
    [{ index: 0, slide: 2, layout: 'number' }],
  ],
  ['setLook', actions.setLookAction as Run, 'setLook', [{ index: 1, look: 'data-desk' }]],
  ['setPreset', actions.setPresetAction as Run, 'setPreset', ['subdued']],
  ['pickIdeas', actions.pickIdeasAction as Run, 'pickIdeas', [{ cards: [1] }]],
  ['moreIdeas', actions.moreIdeasAction as Run, 'moreIdeas', []],
  [
    'editOutline',
    actions.editOutlineAction as Run,
    'editPostOutline',
    [{ op: 'change', slide: 2, point: 'A sharper point.' }],
  ],
  ['outlineFormat', actions.outlineFormatAction as Run, 'setOutlineFormat', ['then-vs-now']],
  ['pickBlogAngle', actions.pickBlogAngleAction as Run, 'pickBlogAngle', [{ card: 1 }]],
  [
    'editBlogOutline',
    actions.editBlogOutlineAction as Run,
    'editBlogOutline',
    [{ op: 'reword', section: 2, point: 'A sharper point.' }],
  ],
  ['writeBlog', actions.writeBlogAction as Run, 'writeBlog', []],
  [
    'editBlogSection',
    actions.editBlogSectionAction as Run,
    'editBlogSection',
    [{ part: 'section', index: 1, field: 'body', text: 'Most students work.' }],
  ],
  ['approveBlogText', actions.approveBlogTextAction as Run, 'approveBlogText', []],
  [
    'embedPostSlides',
    actions.embedPostSlidesAction as Run,
    'embedPostSlides',
    [{ postId: ID, at: 2 }],
  ],
  [
    'makePostsFromBlog',
    actions.makePostsFromBlogAction as Run,
    'makePostsFromBlog',
    [{ requestId: ID }],
  ],
  [
    'makeBlogFromPost',
    actions.makeBlogFromPostAction as Run,
    'makeBlogFromPost',
    [{ requestId: ID }],
  ],
  ['linkToBlog', actions.linkToBlogAction as Run, 'linkToBlog', [{ blogId: ID }]],
  ['writeSlides', actions.writeSlidesAction as Run, 'writeSlides', []],
  ['applySourceWording', actions.applySourceWordingAction as Run, 'applySourceWording', [1]],
  ['approveStructure', actions.approveStructureAction as Run, 'approveStructure', []],
  ['back', actions.backAction as Run, 'goBack', ['source']],
  ['withdraw', actions.withdrawAction as Run, 'withdrawFromReview', []],
  ['editLive', actions.editLiveAction as Run, 'editLive', []],
  ['discardChanges', actions.discardChangesAction as Run, 'discardChanges', []],
  ['remake', actions.remakeAction as Run, 'remakeFromSource', [{ text: 'A changed source.' }]],
  ['continue', actions.continueWithSourceAction as Run, 'continueWithSource', []],
  ['render', actions.renderAction as Run, 'renderPost', []],
  ['retryArt', actions.retryArtAction as Run, 'retryArt', []],
  ['checkSource', actions.checkSourceAction as Run, 'checkSource', []],
  ['markOpinion', actions.markOpinionAction as Run, 'markOpinion', [0]],
  ['removeClaim', actions.removeClaimAction as Run, 'removeClaim', [0]],
  ['saveSettings', actions.saveSettingsAction as Run, 'saveSettings', [SETTINGS]],
  ['sendToReview', actions.sendToReviewAction as Run, 'sendToReview', []],
  ['approvePublish', actions.approvePublishAction as Run, 'approveAndPublish', []],
  ['sendBack', actions.sendBackAction as Run, 'sendBack', ['Wrong number on slide 2.', 'covers']],
  [
    'lightEdit',
    actions.lightEditAction as Run,
    'lightEdit',
    [{ kind: 'phrase', slide: 1, slot: 'phrase', text: 'Side jobs' }],
  ],
  ['makeCovers', actions.makeCoversAction as Run, 'makeCovers', ['A rainy window']],
  ['chooseCover', actions.chooseCoverAction as Run, 'chooseCover', [2]],
  ['planImages', actions.planImagesAction as Run, 'planImages', []],
  [
    'editImageScene',
    actions.editImageSceneAction as Run,
    'editImageScene',
    [{ slide: 2, text: 'A student reads by a window.' }],
  ],
  ['drawImages', actions.drawImagesAction as Run, 'drawImages', []],
  ['nudgeImage', actions.nudgeImageAction as Run, 'nudgeImage', [{ slide: 2, nudge: 'closer' }]],
  ['restoreVersion', actions.restoreVersionAction as Run, 'restoreVersion', [RECORD]],
  ['makeMarket', actions.makeMarketAction as Run, 'makeMarket', ['NP']],
  ['rewordMarket', actions.rewordMarketAction as Run, 'rewordMarket', []],
  ['addFact', actions.addFactAction as Run, 'addFact', ['¶2.3']],
  ['removeFact', actions.removeFactAction as Run, 'removeFact', ['f4']],
  [
    'addResearchSource',
    actions.addResearchSourceAction as Run,
    'addResearchSource',
    [{ claim: 'Most students work.', url: 'https://example.com/a', sentence: 'Most do.' }],
  ],
  [
    'adapt',
    actions.adaptAction as Run,
    'adaptPost',
    [{ brandId: 'cerebral', platform: 'instagram', requestId: ID }],
  ],
  [
    'makeSet',
    actions.makeSetAction as Run,
    'makeSet',
    [{ requestIds: { cerebral: ID, quote: ID } }],
  ],
  ['approveLayout', actions.approveLayoutAction as Run, 'approveLayout', []],
  ['renderSocial', actions.renderSocialAction as Run, 'renderSocial', []],
  ['editCaption', actions.editCaptionAction as Run, 'editCaption', ['New words.', ['#study']]],
  ['checkCaption', actions.checkCaptionAction as Run, 'checkCaption', []],
  ['resetCaption', actions.resetCaptionAction as Run, 'resetCaption', []],
  ['markExported', actions.markExportedAction as Run, 'markExported', []],
  [
    'recordPostUrl',
    actions.recordPostUrlAction as Run,
    'recordPostUrl',
    ['https://www.instagram.com/p/C-abc123/'],
  ],
]

beforeEach(() => {
  session = { user: USER }
  answer = SAVED
  calls.length = 0
  revalidated.length = 0
})

describe('with no session', () => {
  test('every action says Not authorised. and runs no command (16)', async () => {
    session = null
    const results = [
      await actions.makePostAction({ requestId: ID, title: 'T', kind: 'article', text: 'x' }),
      await actions.suggestSourcesAction({ idea: 'Working while you study' }),
      await actions.researchClaimAction(ID, 3, 'Most students work.'),
      ...(await Promise.all(CASES.map(([, run, , args]) => run(ID, 3, ...args)))),
    ]
    for (const r of results) expect(r).toEqual({ ok: false, error: 'Not authorised.' })
    expect(calls).toEqual([])
    expect(revalidated).toEqual([])
  })
})

describe('input checks', () => {
  test('a bad id or version is Unknown post. before any command runs', async () => {
    for (const [, run, , args] of CASES) {
      expect(await run('not-a-uuid', 3, ...args)).toEqual({ ok: false, error: 'Unknown post.' })
      expect(await run(ID, 0, ...args)).toEqual({ ok: false, error: 'Unknown post.' })
      expect(await run(ID, 1.5, ...args)).toEqual({ ok: false, error: 'Unknown post.' })
      expect(await run(undefined, '3', ...args)).toEqual({ ok: false, error: 'Unknown post.' })
    }
    expect(calls).toEqual([])
  })

  test('bad settings are refused before the command runs', async () => {
    const result = await actions.saveSettingsAction(ID, 3, { ...SETTINGS, layer: 'everything' })
    expect(result.ok).toBe(false)
    expect(calls).toEqual([])
  })

  test('a tag the tag file does not have is refused before the command runs (80)', async () => {
    for (const tags of [['theme:nope'], ['home:IN', 'destination:XX'], 'home:IN']) {
      const result = await actions.saveSettingsAction(ID, 3, { ...SETTINGS, tags })
      expect(result.ok).toBe(false)
    }
    expect(calls).toEqual([])
    await actions.saveSettingsAction(ID, 3, {
      ...SETTINGS,
      tags: ['home:IN', 'theme:books-movies'],
    })
    expect(calls).toHaveLength(1)
    expect(calls[0].args[3]).toEqual({ ...SETTINGS, tags: ['home:IN', 'theme:books-movies'] })
  })

  test('a custom emotion with a digit, a quote or over 30 characters is refused before the command runs (100)', async () => {
    for (const emotion of ['calm2', 'a'.repeat(31), 'so "calm"', '-hopeful', 42, '']) {
      expect(await actions.draftAction(ID, 3, false, emotion)).toEqual({
        ok: false,
        error: EMOTION_ERROR,
      })
    }
    expect(calls).toEqual([])
    // A chip's id, the editor's own word trimmed, and none, each reach the command as stored.
    // A Nepali, Hindi or Thai word of 30 characters as a reader sees them is a word of 30.
    const native = NATIVE_IDS.map((id) => nativeOf(id, 30))
    for (const word of native) await actions.draftAction(ID, 3, false, word)
    await actions.draftAction(ID, 3, false, 'hopeful')
    await actions.draftAction(ID, 3, true, '  Wistful ')
    await actions.draftAction(ID, 3, false, null)
    await actions.draftAction(ID, 3, false)
    expect(calls.map((c) => [c.name, ...c.args.slice(1)])).toEqual([
      ...native.map((word) => ['draftPost', ID, 3, false, word]),
      ['draftPost', ID, 3, false, 'hopeful'],
      ['draftPost', ID, 3, true, 'Wistful'],
      ['draftPost', ID, 3, false, null],
      ['draftPost', ID, 3, false, null],
    ])
  })

  test('a malformed light edit or prompt is refused before the command runs', async () => {
    for (const edit of [
      { kind: 'phrase', slide: 1, slot: 'kicker', text: 'Hi' },
      { kind: 'reorder', from: 1 },
      { kind: 'swapImage', image: {} },
      { kind: 'swapImage', slide: 0, image: { assetId: 'a1' } },
      { kind: 'rewrite' },
    ]) {
      expect(await actions.lightEditAction(ID, 3, edit)).toEqual({
        ok: false,
        error: 'This post has moved on. Reload to see where it is.',
      })
    }
    expect(calls).toEqual([])
    // A look post's swap names the slide whose image goes back to an earlier take (GD13).
    const swap = { kind: 'swapImage', slide: 2, image: { assetId: 'a1' } }
    await actions.lightEditAction(ID, 3, swap)
    expect(calls.map((c) => [c.name, ...c.args.slice(1)])).toEqual([['lightEdit', ID, 3, swap]])
  })

  test('a cover option that is not one is refused before the command runs; an idea that is not text is none (102)', async () => {
    for (const option of [-1, 1.5, '1', null, 1000]) {
      expect(await actions.chooseCoverAction(ID, 3, option)).toEqual({
        ok: false,
        error: 'This post has moved on. Reload to see where it is.',
      })
    }
    expect(calls).toEqual([])
    // Any text reaches the command, which owns the idea rules; anything else is no idea.
    await actions.makeCoversAction(ID, 3, 42)
    await actions.makeCoversAction(ID, 3, 'A rainy window')
    expect(calls.map((c) => [c.name, ...c.args.slice(1)])).toEqual([
      ['makeCovers', ID, 3, ''],
      ['makeCovers', ID, 3, 'A rainy window'],
    ])
  })

  test('a version to restore that is not a text record id is refused before the command runs (101)', async () => {
    for (const record of [
      42,
      null,
      '',
      'drafts_',
      `render_${'a1'.repeat(16)}`,
      `drafts_${'g'.repeat(32)}`,
    ]) {
      expect(await actions.restoreVersionAction(ID, 3, record)).toEqual({
        ok: false,
        error: 'This post has moved on. Reload to see where it is.',
      })
    }
    expect(calls).toEqual([])
    await actions.restoreVersionAction(ID, 3, `revision_${'0'.repeat(32)}`)
    expect(calls.map((c) => [c.name, ...c.args.slice(1)])).toEqual([
      ['restoreVersion', ID, 3, `revision_${'0'.repeat(32)}`],
    ])
  })

  test('a malformed adapt or caption is refused before the command runs', async () => {
    for (const input of [
      { brandId: 'cerebral', platform: 'tiktok', requestId: ID },
      { brandId: 'cerebral', platform: 'instagram', requestId: 'x' },
      null,
    ]) {
      expect(await actions.adaptAction(ID, 3, input)).toEqual({
        ok: false,
        error: 'Choose a page brand and a platform.',
      })
    }
    expect(await actions.editCaptionAction(ID, 3, 42, [])).toMatchObject({ ok: false })
    expect(await actions.editCaptionAction(ID, 3, 'Text.', 'not a list')).toMatchObject({
      ok: false,
    })
    // A set's request ids are post ids, one per key (108).
    for (const input of [{ requestIds: { quote: 'x' } }, { requestIds: [ID] }, null]) {
      expect(await actions.makeSetAction(ID, 3, input)).toEqual({
        ok: false,
        error: 'The pages changed since this post was loaded. Reload and press again.',
      })
    }
    expect(calls).toEqual([])
  })

  test('a post link that is not text is refused before the command runs; the command owns the URL rule (89)', async () => {
    for (const url of [42, null, { url: 'https://www.instagram.com/p/x/' }, 'x'.repeat(2049)]) {
      expect(await actions.recordPostUrlAction(ID, 3, url)).toEqual({
        ok: false,
        error: "Paste the post's instagram.com link.",
      })
    }
    expect(calls).toEqual([])
    await actions.recordPostUrlAction(ID, 3, ' https://example.com ')
    expect(calls.map((c) => [c.name, ...c.args.slice(1)])).toEqual([
      ['recordPostUrl', ID, 3, 'https://example.com'],
    ])
  })

  test('a sentence id or fact id that is not one is refused before the command runs (95)', async () => {
    for (const sentence of ['¶2', '2.3', '¶2.3; drop', 42, null, `¶${'9'.repeat(20)}.1`]) {
      expect(await actions.addFactAction(ID, 3, sentence)).toEqual({
        ok: false,
        error: 'This post has moved on. Reload to see where it is.',
      })
    }
    for (const fact of [42, null, '', 'f'.repeat(65)]) {
      expect(await actions.removeFactAction(ID, 3, fact)).toEqual({
        ok: false,
        error: 'This post has moved on. Reload to see where it is.',
      })
    }
    expect(calls).toEqual([])
    await actions.addFactAction(ID, 3, '¶12.4')
    await actions.removeFactAction(ID, 3, 'f2')
    expect(calls.map((c) => [c.name, ...c.args.slice(1)])).toEqual([
      ['addFact', ID, 3, '¶12.4'],
      ['removeFact', ID, 3, 'f2'],
    ])
  })

  test('a slot edit or a claim that is not one is refused before the command runs (98, 104)', async () => {
    const moved = {
      ok: false as const,
      error: 'This post has moved on. Reload to see where it is.',
    }
    for (const at of [
      { slide: 0, slot: 'body', text: 'x' },
      { slide: 2, slot: 'b'.repeat(65), text: 'x' },
      { slide: 2, slot: 'body', text: 42 },
      { slide: 2, slot: 'body', text: 'x'.repeat(10_001) },
      'body',
      null,
    ]) {
      expect(await actions.editSlotAction(ID, 3, at)).toEqual(moved)
    }
    for (const claim of [-1, 1.5, '1', null]) {
      expect(await actions.applySourceWordingAction(ID, 3, claim)).toEqual(moved)
    }
    expect(calls).toEqual([])
    // The command owns the text's own rules: it gets the text as typed.
    await actions.editSlotAction(ID, 3, { slide: 2, slot: 'body', text: '  New words.  ' })
    expect(calls.map((c) => c.args.slice(1))).toEqual([
      [ID, 3, { slide: 2, slot: 'body', text: '  New words.  ' }],
    ])
  })

  test('a step to go back to that is not source or text versions is refused before the command runs (112)', async () => {
    for (const to of ['render', 'review', '', null, 42, ['source']]) {
      expect(await actions.backAction(ID, 3, to)).toEqual({
        ok: false,
        error: 'This post has moved on. Reload to see where it is.',
      })
    }
    expect(calls).toEqual([])
    await actions.backAction(ID, 3, 'source')
    await actions.backAction(ID, 3, 'structures')
    expect(calls.map((c) => [c.name, ...c.args.slice(1)])).toEqual([
      ['goBack', ID, 3, 'source'],
      ['goBack', ID, 3, 'structures'],
    ])
  })

  test('a request for changes naming no step, or one it cannot name, is refused before the command runs (120)', async () => {
    for (const step of ['render', '', null, undefined, 3, ['covers']]) {
      expect(await actions.sendBackAction(ID, 3, 'Calmer cover.', step)).toEqual({
        ok: false,
        error: 'Choose the step that needs changes.',
      })
    }
    expect(calls).toEqual([])
    for (const step of ['structures', 'covers', 'settings']) {
      await actions.sendBackAction(ID, 3, 'Calmer cover.', step)
    }
    expect(calls.map((c) => [c.name, ...c.args.slice(1)])).toEqual([
      ['sendBack', ID, 3, 'Calmer cover.', 'structures'],
      ['sendBack', ID, 3, 'Calmer cover.', 'covers'],
      ['sendBack', ID, 3, 'Calmer cover.', 'settings'],
    ])
  })

  test('a changed source that is not text or links is refused before the command runs; one that is passes field by field (113, GD18)', async () => {
    for (const input of [
      null,
      'A changed source.',
      { text: 42 },
      { links: 'https://example.com/a' },
      { links: [null] },
      { url: 'https://example.com/a' },
      { text: 'x'.repeat(100_001) },
      { links: Array.from({ length: 21 }, () => 'https://example.com/a') },
      { text: 'A changed source.', framing: 7 },
    ]) {
      expect(await actions.remakeAction(ID, 3, input)).toEqual({
        ok: false,
        error: 'Give the source a title, a kind and its text, or its link.',
      })
    }
    expect(calls).toEqual([])
    await actions.remakeAction(ID, 3, { text: 'A changed source.' })
    const links = { links: ['https://example.com/a'], framing: 'Why', notes: 'Mine.' }
    await actions.remakeAction(ID, 3, links)
    expect(calls.map((c) => [c.name, ...c.args.slice(1)])).toEqual([
      ['remakeFromSource', ID, 3, { text: 'A changed source.' }],
      ['remakeFromSource', ID, 3, links],
    ])
  })

  test('a slide number that is not one is refused before another take runs (99)', async () => {
    for (const slide of [0, -1, 1.5, 100, '2', null]) {
      expect(await actions.redraftSlideAction(ID, 3, slide)).toEqual({
        ok: false,
        error: 'This post has moved on. Reload to see where it is.',
      })
    }
    expect(calls).toEqual([])
  })

  test('a malformed chip or slide take is refused before the command runs; a good one passes as typed (GD10, GD11)', async () => {
    const moved = {
      ok: false as const,
      error: 'This post has moved on. Reload to see where it is.',
    }
    for (const at of [{ slide: 0, nudge: 'shorter' }, { slide: 2, nudge: 7 }, { slide: 2 }, null]) {
      expect(await actions.nudgeSlideAction(ID, 3, at)).toEqual(moved)
    }
    for (const at of [
      { index: -1, nudge: 'shorter' },
      { index: 0, nudge: 'x'.repeat(65) },
    ]) {
      expect(await actions.nudgeVersionAction(ID, 3, at)).toEqual(moved)
    }
    for (const at of [{ from: 1.5, slide: 2 }, { from: 1, slide: 100 }, { from: 1 }]) {
      expect(await actions.takeSlideAction(ID, 3, at)).toEqual(moved)
    }
    expect(calls).toEqual([])
    await actions.nudgeSlideAction(ID, 3, { slide: 2, nudge: 'simpler' })
    await actions.nudgeVersionAction(ID, 3, { index: 2, nudge: 'practical' })
    await actions.takeSlideAction(ID, 3, { from: 0, slide: 4 })
    expect(calls.map((c) => [c.name, ...c.args.slice(1)])).toEqual([
      ['nudgeSlide', ID, 3, { slide: 2, nudge: 'simpler' }],
      ['nudgeVersion', ID, 3, { index: 2, nudge: 'practical' }],
      ['useSlide', ID, 3, { from: 0, slide: 4 }],
    ])
  })

  test('a malformed scene edit or image chip is refused before the command runs; a good one passes as typed (GD12, GD13)', async () => {
    const moved = {
      ok: false as const,
      error: 'This post has moved on. Reload to see where it is.',
    }
    for (const at of [
      { slide: 0, text: 'A desk.' },
      { slide: 2, text: 7 },
      { slide: 2, text: 'x'.repeat(10_001) },
      { slide: 2 },
      null,
    ]) {
      expect(await actions.editImageSceneAction(ID, 3, at)).toEqual(moved)
    }
    for (const at of [
      { slide: 1.5, nudge: 'closer' },
      { slide: 2, nudge: 'x'.repeat(65) },
      { slide: 2 },
      'closer',
    ]) {
      expect(await actions.nudgeImageAction(ID, 3, at)).toEqual(moved)
    }
    expect(calls).toEqual([])
    await actions.editImageSceneAction(ID, 3, { slide: 1, text: ' A desk by a window. ' })
    await actions.nudgeImageAction(ID, 3, { slide: 4, nudge: 'wider' })
    // "New picture": the same scene again, with no chip.
    await actions.nudgeImageAction(ID, 3, { slide: 2, nudge: null })
    expect(calls.map((c) => [c.name, ...c.args.slice(1)])).toEqual([
      ['editImageScene', ID, 3, { slide: 1, text: ' A desk by a window. ' }],
      ['nudgeImage', ID, 3, { slide: 4, nudge: 'wider' }],
      ['nudgeImage', ID, 3, { slide: 2, nudge: null }],
    ])
  })

  test('a layout, look or preset that is not one is refused before the command runs; one that is passes as typed (GD4, GD5, GD9)', async () => {
    const moved = {
      ok: false as const,
      error: 'This post has moved on. Reload to see where it is.',
    }
    for (const at of [
      { index: 0, slide: 2, layout: 'poster' },
      { index: -1, slide: 2, layout: 'number' },
      { index: 0, slide: 0, layout: 'number' },
      null,
    ]) {
      expect(await actions.setSlideLayoutAction(ID, 3, at)).toEqual(moved)
    }
    for (const at of [{ index: 0, look: 42 }, { index: 1.5, look: 'postcard' }, 'postcard']) {
      expect(await actions.setLookAction(ID, 3, at)).toEqual({
        ok: false,
        error: 'Choose Field Notes, Data Desk or Postcard.',
      })
    }
    for (const preset of ['paper', '', null, ['pop']]) {
      expect(await actions.setPresetAction(ID, 3, preset)).toEqual({
        ok: false,
        error: 'Choose Pop or Subdued.',
      })
    }
    expect(calls).toEqual([])
    await actions.setSlideLayoutAction(ID, 3, { index: 0, slide: 2, layout: 'checklist' })
    await actions.setLookAction(ID, 3, { index: 1, look: 'postcard' })
    await actions.setPresetAction(ID, 3, 'pop')
    expect(calls.map((c) => [c.name, ...c.args.slice(1)])).toEqual([
      ['setSlideLayout', ID, 3, { index: 0, slide: 2, layout: 'checklist' }],
      ['setLook', ID, 3, { index: 1, look: 'postcard' }],
      ['setPreset', ID, 3, { preset: 'pop' }],
    ])
  })

  test('a pick that is not one or two card indexes is refused before the command runs; one that is passes as typed (GD2)', async () => {
    for (const pick of [
      { cards: [] },
      { cards: [0, 1, 2] },
      { cards: [-1] },
      { cards: [1.5] },
      { cards: ['1'] },
      [1],
      null,
    ]) {
      expect(await actions.pickIdeasAction(ID, 3, pick)).toEqual({
        ok: false,
        error: 'Pick one idea, or two to combine.',
      })
    }
    expect(calls).toEqual([])
    await actions.pickIdeasAction(ID, 3, { cards: [2] })
    await actions.pickIdeasAction(ID, 3, { cards: [3, 0] })
    expect(calls.map((c) => [c.name, ...c.args.slice(1)])).toEqual([
      ['pickIdeas', ID, 3, { cards: [2] }],
      ['pickIdeas', ID, 3, { cards: [3, 0] }],
    ])
  })

  test('an outline change that is not one is refused before the command runs; one that is passes as typed (GD32)', async () => {
    for (const op of [
      { op: 'shuffle', slide: 2 },
      { op: 'move', slide: 2 },
      { op: 'move', slide: 1.5, to: 2 },
      { op: 'remove', slide: '2' },
      { op: 'change', slide: 2, job: 'joke' },
      { op: 'change', slide: 2, layout: 'poster' },
      { op: 'change', slide: 2, point: 42 },
      { op: 'change', slide: 2, point: 'x'.repeat(10_001) },
      { op: 'add', at: 2, slide: { job: 'point', layout: 'picture' } },
      { op: 'remove', slide: 2, extra: true },
      null,
    ]) {
      expect(await actions.editOutlineAction(ID, 3, op)).toEqual({
        ok: false,
        error: 'This post has moved on. Reload to see where it is.',
      })
    }
    expect(calls).toEqual([])
    const ops = [
      { op: 'move', slide: 3, to: 2 },
      { op: 'add', at: 5, slide: { job: 'step', layout: 'checklist', point: 'Plan it.' } },
      { op: 'remove', slide: 4 },
      { op: 'change', slide: 2, job: 'proof', layout: 'number' },
    ]
    for (const op of ops) await actions.editOutlineAction(ID, 3, op)
    expect(calls.map((c) => [c.name, ...c.args.slice(1)])).toEqual(
      ops.map((op) => ['editPostOutline', ID, 3, op]),
    )
  })

  test("a blog's angle that is not one card index is refused before the command runs; one that is passes as typed (BR1)", async () => {
    for (const pick of [{ card: -1 }, { card: 1.5 }, { card: '1' }, { cards: [1] }, 1, null]) {
      expect(await actions.pickBlogAngleAction(ID, 3, pick)).toEqual({
        ok: false,
        error: 'Pick one of the angles.',
      })
    }
    expect(calls).toEqual([])
    await actions.pickBlogAngleAction(ID, 3, { card: 2 })
    expect(calls.map((c) => [c.name, ...c.args.slice(1)])).toEqual([
      ['pickBlogAngle', ID, 3, { card: 2 }],
    ])
  })

  test("a change to a blog's sections that is not one is refused before the command runs; one that is passes as typed (BR2)", async () => {
    for (const op of [
      { op: 'shuffle', section: 2 },
      { op: 'move', section: 2 },
      { op: 'move', section: 1.5, to: 2 },
      { op: 'remove', section: '2' },
      { op: 'reword', section: 2, heading: 42 },
      { op: 'reword', section: 2, point: 'x'.repeat(10_001) },
      { op: 'add', at: 2, section: { heading: 'Who?' } },
      { op: 'remove', section: 2, extra: true },
      null,
    ]) {
      expect(await actions.editBlogOutlineAction(ID, 3, op)).toEqual({
        ok: false,
        error: 'This post has moved on. Reload to see where it is.',
      })
    }
    expect(calls).toEqual([])
    const ops = [
      { op: 'move', section: 3, to: 1 },
      { op: 'add', at: 2, section: { heading: 'Who checks it?', point: 'The school.' } },
      { op: 'remove', section: 4 },
      { op: 'reword', section: 1, heading: 'Can I work more?' },
    ]
    for (const op of ops) await actions.editBlogOutlineAction(ID, 3, op)
    expect(calls.map((c) => [c.name, ...c.args.slice(1)])).toEqual(
      ops.map((op) => ['editBlogOutline', ID, 3, op]),
    )
  })

  test("a blog's text edit, embed, request or link that is not one is refused before the command runs (BR3, BR4, BR6, BR8)", async () => {
    for (const edit of [
      { part: 'intro', index: 0, text: 'x' },
      { part: 'section', index: 0, field: 'body' },
      { part: 'section', index: 0, field: 'body', text: 'x', extra: true },
      null,
    ]) {
      expect((await actions.editBlogSectionAction(ID, 3, edit)).ok).toBe(false)
    }
    for (const embed of [{ postId: ID }, { postId: ID, at: 0 }, { postId: 42, at: 1 }, null]) {
      expect((await actions.embedPostSlidesAction(ID, 3, embed)).ok).toBe(false)
    }
    for (const request of [{ requestId: 'p1' }, {}, null]) {
      expect((await actions.makePostsFromBlogAction(ID, 3, request)).ok).toBe(false)
      expect((await actions.makeBlogFromPostAction(ID, 3, request)).ok).toBe(false)
    }
    for (const link of [{ blogId: 'not-a-blog' }, { blogId: 42 }, {}, null]) {
      expect(await actions.linkToBlogAction(ID, 3, link)).toEqual({
        ok: false,
        error: 'Choose one of the blogs.',
      })
    }
    expect(calls).toEqual([])
    await actions.linkToBlogAction(ID, 3, { blogId: null })
    await actions.editBlogSectionAction(ID, 3, { part: 'faq', index: 2, remove: true })
    expect(calls.map((c) => [c.name, ...c.args.slice(1)])).toEqual([
      ['linkToBlog', ID, 3, { blogId: null }],
      ['editBlogSection', ID, 3, { part: 'faq', index: 2, remove: true }],
    ])
  })

  test('a format that is not one of the ten is refused before the command runs; one that is passes as typed (GD33)', async () => {
    for (const format of ['listicle', 'Myth vs fact', '', 42, null, { format: 'then-vs-now' }]) {
      expect(await actions.outlineFormatAction(ID, 3, format)).toEqual({
        ok: false,
        error: 'Choose one of the formats.',
      })
    }
    expect(calls).toEqual([])
    await actions.outlineFormatAction(ID, 3, 'myth-vs-fact')
    expect(calls.map((c) => [c.name, ...c.args.slice(1)])).toEqual([
      ['setOutlineFormat', ID, 3, { format: 'myth-vs-fact' }],
    ])
  })

  test('a start whose links are not a list of text, or with no request id, is refused before the command runs', async () => {
    for (const input of [
      { requestId: ID, links: 'https://example.com/' },
      { requestId: ID, links: [42] },
      { requestId: ID, links: Array.from({ length: 21 }, () => 'https://example.com/') },
      { requestId: ID, text: 'x', framing: 42 },
      { requestId: 'p1', links: ['https://example.com/'] },
    ]) {
      const result = await actions.makePostAction(input)
      expect(result.ok).toBe(false)
    }
    expect(calls).toEqual([])
  })
})

describe('a signed-in call', () => {
  test('approvePublishAction passes the session as the actor and version 3', async () => {
    expect(await actions.approvePublishAction(ID, 3)).toEqual(SAVED)
    expect(calls).toEqual([
      {
        name: 'approveAndPublish',
        args: [{ id: 'u1', role: 'user', editor: false, reviewer: true, name: 'Rae' }, ID, 3],
      },
    ])
  })

  test('each success refreshes the board and the post', async () => {
    for (const [, run, command, args] of CASES) {
      calls.length = 0
      revalidated.length = 0
      expect(await run(ID, 3, ...args)).toEqual(SAVED)
      expect(calls.map((c) => c.name)).toEqual([command])
      expect(revalidated).toEqual(REFRESHED)
    }
  })

  test('"Make post" passes the text or the links, the framing line and the notes, field by field, and refreshes the board and the new post (93, 94, GD18)', async () => {
    const input = {
      requestId: ID,
      title: '',
      kind: 'article',
      text: '',
      links: ['https://example.com/a', 'https://example.com/b'],
      framing: 'Why 20 hours is the limit',
      notes: 'I worked 25 hours.',
    }
    expect(await actions.makePostAction({ ...input, reader: 'x' })).toEqual(SAVED)
    // The browser names no page reader: the command reads with its own.
    expect(calls[0]?.args).toEqual([
      { id: 'u1', role: 'user', editor: false, reviewer: true, name: 'Rae' },
      input,
    ])
    expect(revalidated).toEqual(REFRESHED)
  })

  test('"Make blog" passes the kind of post to make; one that is neither a feed post nor a blog is refused before the command runs (BR1)', async () => {
    const input = { requestId: ID, title: 'T', kind: 'article', text: 'x', links: [] }
    expect(await actions.makePostAction({ ...input, postKind: 'blog' })).toEqual(SAVED)
    expect(calls.map((c) => (c.args[1] as { postKind?: unknown }).postKind)).toEqual(['blog'])
    calls.length = 0
    expect((await actions.makePostAction({ ...input, postKind: 'social' })).ok).toBe(false)
    expect(calls).toEqual([])
  })

  test('"Make post" passes the page chosen, and None as null (105)', async () => {
    const input = { requestId: ID, title: 'T', kind: 'article', text: 'x', links: [] }
    expect(await actions.makePostAction({ ...input, pageBrandId: 'cerebral' })).toEqual(SAVED)
    expect(await actions.makePostAction({ ...input, pageBrandId: null })).toEqual(SAVED)
    expect(calls.map((c) => (c.args[1] as { pageBrandId?: unknown }).pageBrandId)).toEqual([
      'cerebral',
      null,
    ])
  })

  test('"Find sources" passes the idea alone to the command and refreshes nothing; anything but text is refused before it (BR12)', async () => {
    const found = { ok: true as const, sources: [], entryPoint: null }
    answer = found as unknown as Saved
    expect(
      await actions.suggestSourcesAction({ idea: 'Working while you study', read: 'x' }),
    ).toEqual(found)
    // The browser names no page reader: the command reads with its own.
    expect(calls).toEqual([
      {
        name: 'suggestSources',
        args: [
          { id: 'u1', role: 'user', editor: false, reviewer: true, name: 'Rae' },
          { idea: 'Working while you study' },
        ],
      },
    ])
    expect(revalidated).toEqual([])
    calls.length = 0
    for (const input of [{ idea: 42 }, {}, 'an idea', { idea: 'x'.repeat(10_001) }]) {
      expect((await actions.suggestSourcesAction(input)).ok).toBe(false)
    }
    expect(calls).toEqual([])
  })

  test('"Research this" passes the sentence alone to the command and refreshes nothing; anything but text is refused before it (BR14)', async () => {
    const found = { ok: true as const, sources: [], entryPoint: null }
    answer = found as unknown as Saved
    expect(await actions.researchClaimAction(ID, 3, 'Most students work.')).toEqual(found)
    // The browser names no page reader: the command reads with its own.
    expect(calls).toEqual([
      {
        name: 'researchClaim',
        args: [
          { id: 'u1', role: 'user', editor: false, reviewer: true, name: 'Rae' },
          ID,
          3,
          { sentence: 'Most students work.' },
        ],
      },
    ])
    expect(revalidated).toEqual([])
    calls.length = 0
    for (const sentence of [42, { sentence: 'x' }, undefined, 'x'.repeat(10_001)]) {
      expect((await actions.researchClaimAction(ID, 3, sentence)).ok).toBe(false)
    }
    expect(await actions.researchClaimAction('not-a-uuid', 3, 'x')).toEqual({
      ok: false,
      error: 'Unknown post.',
    })
    expect(calls).toEqual([])
  })

  test('"Add as a source" passes the sentence, the page and its sentence, field by field; anything else is refused before the command (BR14)', async () => {
    const input = {
      claim: 'Most students work.',
      url: 'https://example.com/a',
      sentence: 'Most do.',
    }
    expect(await actions.addResearchSourceAction(ID, 3, { ...input, read: 'x' })).toEqual(SAVED)
    expect(calls[0]?.args.slice(1)).toEqual([ID, 3, input])
    calls.length = 0
    for (const bad of [{ ...input, url: 42 }, { claim: 'x' }, 'https://example.com/a']) {
      expect((await actions.addResearchSourceAction(ID, 3, bad)).ok).toBe(false)
    }
    expect(calls).toEqual([])
  })

  test('six links reach the command, which refuses them by name (GD18)', async () => {
    const links = Array.from({ length: 6 }, (_, i) => `https://example.com/${i}`)
    await actions.makePostAction({ requestId: ID, links })
    expect(calls.map((c) => (c.args[1] as { links?: unknown }).links)).toEqual([links])
  })

  test('the page passes as a string or null; anything else is refused before the command (105)', async () => {
    expect(await actions.choosePageAction(ID, 3, null)).toEqual(SAVED)
    expect(calls[0]?.args.slice(1)).toEqual([ID, 3, null])
    calls.length = 0
    for (const bad of [42, { id: 'main' }, 'x'.repeat(65)]) {
      expect(await actions.choosePageAction(ID, 3, bad)).toEqual({
        ok: false,
        error: 'Choose one of the pages, or None.',
      })
    }
    expect(calls).toEqual([])
  })

  test('a refusal from the command is returned and nothing is refreshed', async () => {
    answer = { ok: false, error: 'Changed by Sam just now' }
    expect(await actions.renderAction(ID, 3)).toEqual(answer)
    expect(revalidated).toEqual([])
  })
})

describe('measureSlotAction (98)', () => {
  const typed = { slide: 2, slot: 'body', text: 'Most students who work keep their grades.' }

  test('with no session says Not authorised. and measures nothing', async () => {
    session = null
    expect(await actions.measureSlotAction(ID, 3, typed)).toEqual({
      ok: false,
      error: 'Not authorised.',
    })
    expect(calls).toEqual([])
  })

  test('a bad id, version or slot is refused before the command runs', async () => {
    expect(await actions.measureSlotAction('not-a-uuid', 3, typed)).toEqual({
      ok: false,
      error: 'Unknown post.',
    })
    expect(await actions.measureSlotAction(ID, 0, typed)).toEqual({
      ok: false,
      error: 'Unknown post.',
    })
    for (const bad of [null, { ...typed, slide: 0 }, { ...typed, text: 42 }]) {
      expect(await actions.measureSlotAction(ID, 3, bad)).toEqual({
        ok: false,
        error: 'This post has moved on. Reload to see where it is.',
      })
    }
    expect(calls).toEqual([])
  })

  test('passes the session, the post and the typed text to the command, and refreshes nothing: it saves nothing', async () => {
    const measured = { ok: true as const, rows: [] }
    answer = measured as unknown as Saved
    expect(await actions.measureSlotAction(ID, 3, typed)).toEqual(measured)
    expect(calls).toEqual([
      {
        name: 'measureSlot',
        args: [
          { id: 'u1', role: 'user', editor: false, reviewer: true, name: 'Rae' },
          ID,
          3,
          typed,
        ],
      },
    ])
    expect(revalidated).toEqual([])
  })
})

describe('assignPostAction', () => {
  const INPUT = { postId: ID, assigneeId: 'u2', note: 'Draw the cover' }

  test('with no session says Not authorised. and assigns nothing', async () => {
    session = null
    expect(await actions.assignPostAction(INPUT)).toEqual({ ok: false, error: 'Not authorised.' })
    expect(calls).toEqual([])
    expect(revalidated).toEqual([])
  })

  test('refuses a bad post id or a note too long to be one before the module runs', async () => {
    for (const bad of [
      { ...INPUT, postId: 'nope' },
      { ...INPUT, assigneeId: 7 },
      { ...INPUT, note: 'a'.repeat(10_001) },
      null,
    ]) {
      expect((await actions.assignPostAction(bad)).ok).toBe(false)
    }
    expect(calls).toEqual([])
  })

  test('passes the session as the actor and the values, and refreshes the board', async () => {
    expect(await actions.assignPostAction(INPUT)).toEqual(SAVED)
    expect(calls).toEqual([
      {
        name: 'assignPost',
        args: [{ id: 'u1', role: 'user', editor: false, reviewer: true, name: 'Rae' }, INPUT],
      },
    ])
    expect(revalidated).toEqual(['/admin/board'])
  })
})
