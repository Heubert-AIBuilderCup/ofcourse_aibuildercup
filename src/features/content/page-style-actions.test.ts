import { beforeEach, describe, expect, mock, test } from 'bun:test'
import * as nextCache from 'next/cache'
import { PAGE_STYLE_ERRORS, REFERENCE_MAX_BYTES } from './lib/page-style'

// The Page styles actions with the session, the page-style module and the cache mocked: what they
// read from the session, what they refuse before the module runs, and what they refresh. The
// module applies the access and content rules (server/page-style.test.ts).

const USER = { id: 'u1', role: 'user', editor: true, reviewer: false, name: 'Ed', extra: 'x' }
const ACTOR = { id: 'u1', role: 'user', editor: true, reviewer: false, name: 'Ed' }
let session: { user: typeof USER } | null = { user: USER }
const calls: { name: string; args: unknown[] }[] = []
const revalidated: string[] = []
const answers: Record<string, unknown> = {
  uploadReference: { ok: true, assetId: 'asset-1' },
  describePageStyle: {
    ok: true,
    fields: { artStyle: 'Ink.', copyStyle: 'Short.', closestTemplateId: 'the-line' },
  },
  savePageStyle: { ok: true },
}
const record = (name: string) =>
  mock(async (...args: unknown[]) => {
    calls.push({ name, args })
    return answers[name]
  })

mock.module('@/shared/lib/auth/session', () => ({ getSession: async () => session }))
// Next's own exports kept, so a later test file that mocks another one still finds it.
mock.module('next/cache', () => ({
  ...nextCache,
  revalidatePath: (p: string) => revalidated.push(p),
}))
mock.module('./server/page-style', () => ({
  uploadReference: record('uploadReference'),
  describePageStyle: record('describePageStyle'),
  savePageStyle: record('savePageStyle'),
}))

const actions = await import('./page-style-actions')

const form = (entries: Record<string, string | Blob>) => {
  const data = new FormData()
  for (const [k, v] of Object.entries(entries)) data.set(k, v)
  return data
}
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])
const SAVE = {
  brandId: 'cerebral',
  artStyle: 'Ink.',
  copyStyle: 'Short.',
  closestTemplateId: 'the-line',
  referenceAssetIds: ['asset-1'],
}

beforeEach(() => {
  session = { user: USER }
  calls.length = 0
  revalidated.length = 0
})

describe('with no session', () => {
  test('every action says Not authorised. and runs nothing', async () => {
    session = null
    const results = [
      await actions.uploadReferenceAction(
        form({ brandId: 'cerebral', file: new File([PNG], 'a.png') }),
      ),
      await actions.describePageStyleAction('cerebral', ['asset-1']),
      await actions.savePageStyleAction(SAVE),
    ]
    for (const r of results) expect(r).toEqual({ ok: false, error: 'Not authorised.' })
    expect(calls).toEqual([])
    expect(revalidated).toEqual([])
  })
})

describe('uploading', () => {
  test("passes the file's bytes and the session as the actor, never the browser's name or type", async () => {
    const file = new File([PNG], 'evil.gif', { type: 'image/gif' })
    expect(await actions.uploadReferenceAction(form({ brandId: 'cerebral', file }))).toEqual({
      ok: true,
      assetId: 'asset-1',
    })
    expect(calls[0].args[0]).toEqual(ACTOR)
    expect(calls[0].args[1]).toBe('cerebral')
    expect(Array.from(calls[0].args[2] as Uint8Array)).toEqual(Array.from(PNG))
    expect(calls[0].args).toHaveLength(3)
  })

  test('refuses no file and one over 5 MB before reading it', async () => {
    expect(await actions.uploadReferenceAction(form({ brandId: 'cerebral' }))).toEqual({
      ok: false,
      error: PAGE_STYLE_ERRORS.type,
    })
    expect(
      await actions.uploadReferenceAction(form({ brandId: 'cerebral', file: 'not a file' })),
    ).toEqual({ ok: false, error: PAGE_STYLE_ERRORS.type })
    const big = new File([new Uint8Array(REFERENCE_MAX_BYTES + 1)], 'big.png')
    expect(await actions.uploadReferenceAction(form({ brandId: 'cerebral', file: big }))).toEqual({
      ok: false,
      error: PAGE_STYLE_ERRORS.size,
    })
    expect(await actions.uploadReferenceAction('nope')).toEqual({
      ok: false,
      error: PAGE_STYLE_ERRORS.type,
    })
    expect(calls).toEqual([])
  })
})

describe('describing and saving', () => {
  test('describing passes the ids as strings; a bad list is refused before the module', async () => {
    const res = await actions.describePageStyleAction('cerebral', ['asset-1', 'asset-2'])
    expect(res).toEqual(answers.describePageStyle as Awaited<typeof res>)
    expect(calls[0].args).toEqual([ACTOR, 'cerebral', ['asset-1', 'asset-2']])
    calls.length = 0
    for (const bad of ['asset-1', [1], ['a', 'b', 'c'], null]) {
      expect(await actions.describePageStyleAction('cerebral', bad)).toEqual({
        ok: false,
        error: PAGE_STYLE_ERRORS.images,
      })
    }
    expect(calls).toEqual([])
  })

  test('saving maps the fields one by one and refreshes the Page styles screen', async () => {
    expect(await actions.savePageStyleAction({ ...SAVE, updatedByUserId: 'someone' })).toEqual({
      ok: true,
    })
    expect(calls[0].args).toEqual([ACTOR, SAVE])
    expect(revalidated).toEqual(['/admin/page-styles'])
    calls.length = 0
    revalidated.length = 0
    expect(await actions.savePageStyleAction({ ...SAVE, artStyle: 3 })).toEqual({
      ok: false,
      error: PAGE_STYLE_ERRORS.fields,
    })
    expect(calls).toEqual([])
    expect(revalidated).toEqual([])
  })

  test('a refusal from the module is returned and nothing is refreshed', async () => {
    answers.savePageStyle = { ok: false, error: 'Not authorised.' }
    expect(await actions.savePageStyleAction(SAVE)).toEqual({ ok: false, error: 'Not authorised.' })
    expect(revalidated).toEqual([])
    answers.savePageStyle = { ok: true }
  })
})
