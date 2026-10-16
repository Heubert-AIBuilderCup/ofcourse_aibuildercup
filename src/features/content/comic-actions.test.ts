import { beforeEach, describe, expect, mock, test } from 'bun:test'
import * as nextCache from 'next/cache'

// The comic actions with the session, the command and the cache mocked: what they read from the
// session, what they refuse before the command runs, and what they refresh. The command applies
// the access and input rules (server/comics.test.ts).

const USER = { id: 'u1', role: 'user', editor: true, reviewer: false, name: 'Ed', extra: 'x' }
const ACTOR = { id: 'u1', role: 'user', editor: true, reviewer: false, name: 'Ed' }
const ID = '0b0c3a52-7f6c-4c6a-9d3e-1f0a5f5f4b11'
const INPUT = { courseId: 'a-course', premise: null, emotion: 'hopeful', requestId: ID }
let session: { user: typeof USER } | null = { user: USER }
const calls: unknown[][] = []
const revalidated: string[] = []

mock.module('@/shared/lib/auth/session', () => ({ getSession: async () => session }))
// Next's own exports kept, so a later test file that mocks another one still finds it.
mock.module('next/cache', () => ({
  ...nextCache,
  revalidatePath: (p: string) => revalidated.push(p),
}))
const saved = (name: string) =>
  mock(async (...args: unknown[]) => {
    calls.push([name, ...args])
    return { ok: true, id: ID, version: 8 }
  })
mock.module('./server/commands/comic', () => ({
  COMIC_ERRORS: { path: 'Choose a path.' },
  makeComic: mock(async (...args: unknown[]) => {
    calls.push(args)
    return { ok: true, id: ID }
  }),
  editScene: saved('editScene'),
  editPanels: saved('editPanels'),
  retryStory: saved('retryStory'),
}))

const done = (name: string) =>
  mock(async (...args: unknown[]) => {
    calls.push([name, ...args])
    return { ok: true }
  })
mock.module('./server/character', () => ({
  CHARACTER_ERRORS: {
    description: 'Describe the character in 1 to 200 characters.',
    view: 'Unknown view.',
    note: 'Keep the note to 80 characters.',
  },
  planCharacter: done('planCharacter'),
  editCharacterView: done('editCharacterView'),
  drawCharacter: done('drawCharacter'),
  approveCharacter: done('approveCharacter'),
}))

const {
  approveCharacterAction,
  drawCharacterAction,
  editCharacterViewAction,
  editPanelsAction,
  editSceneAction,
  makeComicAction,
  planCharacterAction,
  retryStoryAction,
} = await import('./comic-actions')

beforeEach(() => {
  session = { user: USER }
  calls.length = 0
  revalidated.length = 0
})

describe('makeComicAction', () => {
  test('with no session says Not authorised. and makes nothing', async () => {
    session = null
    expect(await makeComicAction(INPUT)).toEqual({ ok: false, error: 'Not authorised.' })
    expect(calls).toEqual([])
  })

  test('input that is not a comic request makes nothing', async () => {
    expect(await makeComicAction({ ...INPUT, requestId: 'not-a-uuid' })).toEqual({
      ok: false,
      error: 'Choose a path.',
    })
    expect(calls).toEqual([])
  })

  test('hands the session actor and the input to the command, then refreshes the board', async () => {
    expect(await makeComicAction({ ...INPUT, extra: 'dropped' })).toEqual({ ok: true, id: ID })
    expect(calls).toEqual([[ACTOR, INPUT]])
    expect(revalidated).toEqual(['/admin/board'])
  })
})

describe('the storyboard actions (RC3)', () => {
  const MOVED_ON = 'This post has moved on. Reload to see where it is.'

  test('with no session say Not authorised. and run nothing', async () => {
    session = null
    expect(await editSceneAction(ID, 7, { slide: 1, text: 'A desk.' })).toEqual({
      ok: false,
      error: 'Not authorised.',
    })
    expect(await editPanelsAction(ID, 7, { kind: 'add', after: 0 })).toEqual({
      ok: false,
      error: 'Not authorised.',
    })
    expect(await retryStoryAction(ID, 7)).toEqual({ ok: false, error: 'Not authorised.' })
    expect(calls).toEqual([])
  })

  test('an id or version that is not one is an unknown post', async () => {
    expect(await editSceneAction('nope', 7, { slide: 1, text: 'A desk.' })).toEqual({
      ok: false,
      error: 'Unknown post.',
    })
    expect(await editPanelsAction(ID, 0, { kind: 'add', after: 0 })).toEqual({
      ok: false,
      error: 'Unknown post.',
    })
    expect(await retryStoryAction(ID, 'x')).toEqual({ ok: false, error: 'Unknown post.' })
    expect(calls).toEqual([])
  })

  test('input that is not a scene edit or a panel change runs nothing', async () => {
    for (const input of [null, { slide: 0, text: 'A desk.' }, { slide: 1, text: 5 }]) {
      expect(await editSceneAction(ID, 7, input)).toEqual({ ok: false, error: MOVED_ON })
    }
    const ops = [
      { kind: 'add' },
      { kind: 'remove', at: -1 },
      { kind: 'move', at: 1 },
      { kind: 'swap', at: 1, to: 2 },
      { kind: 'add', after: 1.5 },
    ]
    for (const op of ops) {
      expect(await editPanelsAction(ID, 7, op)).toEqual({ ok: false, error: MOVED_ON })
    }
    expect(calls).toEqual([])
    expect(revalidated).toEqual([])
  })

  test('hand the session actor, the post, its version and the input to the command, then refresh the post', async () => {
    const res = { ok: true as const, id: ID, version: 8 }
    expect(await editSceneAction(ID, 7, { slide: 2, text: 'A desk.', extra: 1 })).toEqual(res)
    expect(await editPanelsAction(ID, 7, { kind: 'move', at: 2, to: 0 })).toEqual(res)
    expect(await retryStoryAction(ID, 7)).toEqual(res)
    expect(calls).toEqual([
      ['editScene', ACTOR, ID, 7, { slide: 2, text: 'A desk.' }],
      ['editPanels', ACTOR, ID, 7, { kind: 'move', at: 2, to: 0 }],
      ['retryStory', ACTOR, ID, 7],
    ])
    expect(revalidated).toContain('/admin/board')
    expect(revalidated).toContain(`/admin/posts/${ID}`)
    expect(revalidated).toContain(`/admin/posts/${ID}/text`)
  })
})

describe('the comic character actions (RC9)', () => {
  const PAGE = '/admin/comics/character'

  test('with no session say Not authorised. and run nothing', async () => {
    session = null
    const refused = { ok: false, error: 'Not authorised.' }
    expect(await planCharacterAction({ description: 'A student' })).toEqual(refused)
    expect(await editCharacterViewAction({ index: 0, label: 'Front', scene: 'Standing.' })).toEqual(
      refused,
    )
    expect(await drawCharacterAction({ note: null })).toEqual(refused)
    expect(await approveCharacterAction()).toEqual(refused)
    expect(calls).toEqual([])
  })

  test('input that is not a description, a view or a note runs nothing', async () => {
    for (const input of [null, {}, { description: 5 }, { description: 'x'.repeat(1001) }]) {
      expect(await planCharacterAction(input)).toEqual({
        ok: false,
        error: 'Describe the character in 1 to 200 characters.',
      })
    }
    for (const input of [
      null,
      { index: -1, label: 'Front', scene: 'Standing.' },
      { index: 0.5, label: 'Front', scene: 'Standing.' },
      { index: 0, label: 5, scene: 'Standing.' },
      { index: 0, label: 'Front' },
    ]) {
      expect(await editCharacterViewAction(input)).toEqual({ ok: false, error: 'Unknown view.' })
    }
    for (const input of [null, {}, { note: 5 }, { note: 'x'.repeat(1001) }]) {
      expect(await drawCharacterAction(input)).toEqual({
        ok: false,
        error: 'Keep the note to 80 characters.',
      })
    }
    expect(calls).toEqual([])
    expect(revalidated).toEqual([])
  })

  test('hand the session actor and the input to the command, then refresh the character page', async () => {
    expect(await planCharacterAction({ description: 'A student', extra: 1 })).toEqual({ ok: true })
    expect(
      await editCharacterViewAction({ index: 2, label: 'Back', scene: 'From behind.', extra: 1 }),
    ).toEqual({ ok: true })
    expect(await drawCharacterAction({ note: 'Bluer', extra: 1 })).toEqual({ ok: true })
    expect(await approveCharacterAction()).toEqual({ ok: true })
    expect(calls).toEqual([
      ['planCharacter', ACTOR, { description: 'A student' }],
      ['editCharacterView', ACTOR, { index: 2, label: 'Back', scene: 'From behind.' }],
      ['drawCharacter', ACTOR, { note: 'Bluer' }],
      ['approveCharacter', ACTOR],
    ])
    expect(revalidated).toEqual([PAGE, PAGE, PAGE, PAGE])
  })
})
