// The script's own pictures reach "Draw images" through the art cache (commands/shared.ts
// artDeps): the key it keeps them under must be the very key ai/art.ts coverArt looks up, or the
// image model would be asked instead. In memory: no network, no database.

import { describe, expect, it, mock } from 'bun:test'

process.env.AI_PROVIDER = 'fake'
process.env.GEMINI_IMAGE_MODEL = 'image-test'

mock.module('server-only', () => ({}))
mock.module('../src/features/content/ai/calls', () => ({
  dbCallLog: {
    countToday: async () => 0,
    record: async () => {},
    reserve: async () => {
      throw new Error('the image model was asked')
    },
    settle: async () => {},
  },
}))
mock.module('../src/features/content/ai/cache', () => ({
  dbCache: { get: async () => null, put: async () => {} },
}))

const { coverArt } = await import('../src/features/content/ai/art')
const { artKey, svgToPng } = await import('./make-posts-art')

const ours = new Uint8Array([1, 2, 3])
const input = { scene: 'A jug filling one round flask', emotion: null, slide: 2, set: 1 }

/** coverArt for the slide as drawImages calls it, with an art cache holding only `key`. */
async function drawnWith(key: string, aspectRatio: '1:1' | '4:5') {
  const { slidePrompt } = await import('../src/features/content/ai/art')
  const asked: string[] = []
  const res = await coverArt(
    {
      prompt: slidePrompt({ scene: input.scene, emotion: null, nudge: null, artStyle: null }),
      demoKey: null,
      postId: 'p',
      set: input.set,
      option: input.slide,
      aspectRatio,
    },
    {
      cached: async (k) => {
        asked.push(k)
        return k === key ? ours : null
      },
      remember: async () => {},
    },
  )
  return { bytes: res.ok ? res.art.bytes : null, asked }
}

describe('artKey', () => {
  it('is the key Draw images reads, so the picture is ours and no model is asked', async () => {
    const { bytes, asked } = await drawnWith(artKey({ ...input, aspectRatio: '1:1' }), '1:1')
    expect(asked.length).toBe(1)
    expect(bytes === ours).toBe(true)
  })

  it('is built by coverArt’s own key builder, not a copy of it', async () => {
    const { artCacheKey, slidePrompt } = await import('../src/features/content/ai/art')
    const prompt = slidePrompt({ scene: input.scene, emotion: null, nudge: null, artStyle: null })
    expect(artKey({ ...input, aspectRatio: '4:5' })).toBe(
      artCacheKey({ prompt, aspectRatio: '4:5', set: 1, option: 2, attempt: 1, references: [] }),
    )
  })

  it('names the shape, so a picture kept for one shape is not read for another', () => {
    expect(artKey({ ...input, aspectRatio: '1:1' })).not.toBe(
      artKey({ ...input, aspectRatio: '4:5' }),
    )
  })
})

describe('svgToPng', () => {
  it('draws the SVG at the art box width', () => {
    const png = svgToPng(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="540"><rect width="1080" height="540" fill="#FFFFFF"/></svg>',
      1080,
    )
    const view = Buffer.from(png)
    expect(view.toString('latin1', 12, 16)).toBe('IHDR')
    expect(`${view.readUInt32BE(16)}x${view.readUInt32BE(20)}`).toBe('1080x540')
  })
})
