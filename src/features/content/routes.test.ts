import { beforeEach, describe, expect, mock, test } from 'bun:test'

// The asset, preview and export routes with the session, the store and the preview mocked: only
// staff who may see the board get an image, only editors get an export; everyone else, and
// anything unknown, gets a 404.

type User = { id: string; role: string; editor: boolean; reviewer: boolean; name: string }
const STAFF: User = { id: 'u1', role: 'user', editor: true, reviewer: false, name: 'Ed' }
const STUDENT: User = { id: 'u2', role: 'user', editor: false, reviewer: false, name: 'Stu' }
const ADMIN: User = { id: 'u3', role: 'admin', editor: false, reviewer: false, name: 'Ada' }
const REVIEWER: User = { id: 'u4', role: 'user', editor: false, reviewer: true, name: 'Rev' }

let session: { user: User } | null = null
const BYTES = new Uint8Array([1, 2, 3])
const previews: unknown[] = []
const loaded: string[] = []

/** A social version at `stage`, its export current only when `exported`. */
function socialPost(stage: string, exported: boolean) {
  return {
    id: 'sp1',
    kind: 'social',
    stage,
    current: {
      render: { id: 'r1', body: { slides: [{ svgAssetId: 'svg1', pngAssetId: 'png1' }] } },
      caption: { id: 'c1', body: { text: 'Up to 20 hours.', hashtags: ['#study'] } },
      export: exported
        ? {
            id: 'e1',
            body: { renderId: 'r1', captionId: 'c1', fileName: 'cerebral_paid_instagram.zip' },
          }
        : null,
    },
  }
}
const POSTS: Record<string, unknown> = {
  sp1: socialPost('exported', true),
  ready: socialPost('ready', false),
  feed: { ...socialPost('exported', true), kind: 'feed' },
}
const ASSETS: Record<string, { mime: string; bytes: Uint8Array }> = {
  svg1: { mime: 'image/svg+xml', bytes: new TextEncoder().encode('<svg/>') },
  png1: { mime: 'image/png', bytes: BYTES },
}

mock.module('@/shared/lib/auth/session', () => ({ getSession: async () => session }))
mock.module('@/features/content/server/store', () => ({
  getAsset: async (id: string) =>
    id === 'known' ? { mime: 'image/webp', bytes: BYTES } : id === 'drawing' ? ASSETS.svg1 : null,
  loadPost: async (id: string) => {
    loaded.push(id)
    return POSTS[id] ?? null
  },
  getAssets: async (ids: string[]) =>
    new Map(ids.flatMap((id) => (ASSETS[id] ? [[id, ASSETS[id]] as const] : []))),
  // The feed's image route test (src/app/(feed)/feed/assets/[id]) mocks this module too: a mocked
  // module keeps the export names of whichever mock runs first, so both name the same set.
  isLiveAsset: async () => false,
  // The blog routes' tests name these too (src/app/(public)/blog).
  isLiveBlogAsset: async () => false,
  liveBlogBySlug: async () => null,
  liveBlogs: async () => [],
}))
mock.module('@/features/content/server/preview', () => ({
  draftPreviewPng: async (input: unknown) => {
    previews.push(input)
    return (input as { draftsId: string }).draftsId === 'known' ? BYTES : null
  },
  layoutPreviewPng: async (input: unknown) => {
    previews.push(input)
    return (input as { layoutId: string }).layoutId === 'known' ? BYTES : null
  },
  // A plan of the layout's text gives its scenes by slide; any other is none.
  plannedScenes: async (_postId: string, planId: string) =>
    planId.startsWith('plan') ? [`Scene of ${planId}`, null] : null,
}))

const asset = await import('../../app/admin/(console)/assets/[id]/route')
const previewRoute = await import('../../app/admin/(console)/posts/[id]/preview/route')
const exportRoute = await import('../../app/admin/(console)/posts/[id]/export/route')
const { unzipSync } = await import('fflate')

const CACHE = 'private, max-age=31536000, immutable'
const assetCtx = (id: string) => ({ params: Promise.resolve({ id }) }) as never
const get = (query: string) =>
  previewRoute.GET(
    new Request(`http://localhost/admin/posts/p1/preview?${query}`) as never,
    assetCtx('p1'),
  )

beforeEach(() => {
  session = null
  previews.length = 0
  loaded.length = 0
})

describe('GET /admin/assets/[id]', () => {
  test('no session, and a student, get 404', async () => {
    for (const s of [null, { user: STUDENT }]) {
      session = s
      const res = await asset.GET(new Request('http://localhost/x') as never, assetCtx('known'))
      expect(res.status).toBe(404)
    }
  })

  test('staff get the bytes with the mime and a year-long private cache', async () => {
    for (const user of [STAFF, ADMIN]) {
      session = { user }
      const res = await asset.GET(new Request('http://localhost/x') as never, assetCtx('known'))
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/webp')
      expect(res.headers.get('cache-control')).toBe(CACHE)
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(BYTES)
    }
  })

  test('every asset says nosniff, and an SVG is sandboxed', async () => {
    session = { user: STAFF }
    const png = await asset.GET(new Request('http://localhost/x') as never, assetCtx('known'))
    expect(png.headers.get('x-content-type-options')).toBe('nosniff')
    expect(png.headers.get('content-security-policy')).toBeNull()
    const svg = await asset.GET(new Request('http://localhost/x') as never, assetCtx('drawing'))
    expect(svg.headers.get('content-type')).toBe('image/svg+xml')
    expect(svg.headers.get('x-content-type-options')).toBe('nosniff')
    expect(svg.headers.get('content-security-policy')).toBe('sandbox')
  })

  test('an unknown asset is 404', async () => {
    session = { user: STAFF }
    const res = await asset.GET(new Request('http://localhost/x') as never, assetCtx('nope'))
    expect(res.status).toBe(404)
  })
})

describe('GET /admin/posts/[id]/preview', () => {
  test('no session, and a student, get 404 before anything is drawn', async () => {
    for (const s of [null, { user: STUDENT }]) {
      session = s
      expect((await get('drafts=known&i=0&slide=1&theme=paper')).status).toBe(404)
      expect((await get('layout=known&slide=1')).status).toBe(404)
    }
    expect(previews).toEqual([])
  })

  test('staff get a draft preview PNG from the ids in the URL', async () => {
    session = { user: STAFF }
    const res = await get('drafts=known&i=2&slide=3&theme=paper')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toBe(CACHE)
    expect(previews).toEqual([
      { postId: 'p1', draftsId: 'known', index: 2, slide: 3, themeId: 'paper' },
    ])
  })

  test('a repeat of the same preview URL is served without drawing it again', async () => {
    session = { user: STAFF }
    const first = await get('drafts=known&i=1&slide=2&theme=night')
    const again = await get('drafts=known&i=1&slide=2&theme=night')
    expect(previews).toHaveLength(1)
    expect(new Uint8Array(await again.arrayBuffer())).toEqual(
      new Uint8Array(await first.arrayBuffer()),
    )
    // Another post's URL with the same ids is its own entry, read and checked against that post.
    await previewRoute.GET(
      new Request(
        'http://localhost/admin/posts/p2/preview?drafts=known&i=1&slide=2&theme=night',
      ) as never,
      assetCtx('p2'),
    )
    expect(previews).toHaveLength(2)
    // The session is checked before the cache: a student still gets nothing.
    session = { user: STUDENT }
    expect((await get('drafts=known&i=1&slide=2&theme=night')).status).toBe(404)
  })

  test('a draft preview with no theme asks for the brand default', async () => {
    session = { user: STAFF }
    await get('drafts=known&i=0&slide=1')
    expect(previews).toEqual([
      { postId: 'p1', draftsId: 'known', index: 0, slide: 1, themeId: null },
    ])
  })

  test('staff get a layout preview PNG', async () => {
    session = { user: STAFF }
    const res = await get('layout=known&slide=2')
    expect(res.status).toBe(200)
    expect(previews).toEqual([{ postId: 'p1', layoutId: 'known', slide: 2 }])
  })

  test('a layout preview with an image plan writes that plan’s scenes, each plan its own picture; another text’s plan is 404 (GD12)', async () => {
    session = { user: STAFF }
    expect((await get('layout=known&slide=1&plan=plan1')).status).toBe(200)
    expect((await get('layout=known&slide=1&plan=plan2')).status).toBe(200)
    expect((await get('layout=known&slide=1&plan=plan1')).status).toBe(200)
    expect(previews).toEqual([
      { postId: 'p1', layoutId: 'known', slide: 1, planned: ['Scene of plan1', null] },
      { postId: 'p1', layoutId: 'known', slide: 1, planned: ['Scene of plan2', null] },
    ])
    previews.length = 0
    expect((await get('layout=known&slide=1&plan=other')).status).toBe(404)
    expect(previews).toEqual([])
  })

  test('missing or bad parameters, and unknown records, are 404', async () => {
    session = { user: STAFF }
    for (const q of [
      '',
      'slide=1',
      'drafts=known&slide=1',
      'drafts=known&i=-1&slide=1',
      'drafts=known&i=0&slide=0',
      'drafts=known&i=x&slide=1',
      'layout=known',
      'layout=known&slide=1.5',
      'layout=nope&slide=1',
      'drafts=nope&i=0&slide=1',
    ]) {
      expect((await get(q)).status).toBe(404)
    }
  })
})

describe('GET /admin/posts/[id]/export', () => {
  const download = (id: string) =>
    exportRoute.GET(new Request(`http://localhost/admin/posts/${id}/export`) as never, assetCtx(id))

  test('no session, a student, a reviewer and an admin get 404 before any post is read', async () => {
    for (const s of [null, { user: STUDENT }, { user: REVIEWER }, { user: ADMIN }]) {
      session = s
      expect((await download('sp1')).status).toBe(404)
    }
    expect(loaded).toEqual([])
  })

  test('an unknown post, a feed post and a social version not yet exported are 404', async () => {
    session = { user: STAFF }
    for (const id of ['nope', 'feed', 'ready']) expect((await download(id)).status).toBe(404)
  })

  test('an editor gets the zip of the stored slides and the caption, as an attachment', async () => {
    session = { user: STAFF }
    const res = await download('sp1')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/zip')
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="cerebral_paid_instagram.zip"',
    )
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()))
    expect(files['slide-1.png']).toEqual(BYTES)
    expect(new TextDecoder().decode(files['slide-1.svg'])).toBe('<svg/>')
    expect(new TextDecoder().decode(files['caption.txt'])).toBe('Up to 20 hours.\n\n#study')
  })
})
