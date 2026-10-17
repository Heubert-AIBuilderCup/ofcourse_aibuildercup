import { describe, expect, it } from 'bun:test'
import { liteLine, runningReason } from './running'

const at = (...steps: string[]) => runningReason(steps.map((step) => ({ step })))

describe('runningReason (122)', () => {
  it('is null while nothing runs', () => {
    expect(at()).toBeNull()
  })

  it('says each step the post runs in words', () => {
    expect(at('extract')).toBe('Facts are being read')
    expect(at('draft')).toBe('Versions are being drafted')
    expect(at('draft_slide:3')).toBe('Slide 3 is being redrafted')
    expect(at('covers')).toBe('Covers are being drawn')
    expect(at('render')).toBe('Slides are being drawn')
    expect(at('source_check')).toBe('The source check is running')
    expect(at('market')).toBe('The market version is being made')
    expect(at('ideas')).toBe('Ideas are being found')
    expect(at('nudge_version')).toBe('A version is being redrafted')
    expect(at('scene_plan')).toBe('Images are being planned')
    expect(at('images')).toBe('Images are being drawn')
    expect(at('outline')).toBe('The outline is being made')
    expect(at('research')).toBe('A sentence is being researched')
    expect(at('blog_text')).toBe('The blog is being written')
  })

  it('says a step is running for any other name', () => {
    expect(at('something_new')).toBe('A step is running')
    expect(at('draft_slide:')).toBe('A step is running')
  })

  it('names the first running step when several run', () => {
    expect(at('covers', 'source_check')).toBe('Covers are being drawn')
  })
})

describe('runningReason with progress', () => {
  it('counts the images drawn, naming the one on its way, and the versions being drafted', () => {
    const images = (done: number, total: number) =>
      runningReason([{ step: 'images', progress: { done, total } }])
    expect(images(0, 4)).toBe('Drawing image 1 of 4')
    expect(images(1, 4)).toBe('Drawing image 2 of 4')
    // Every image landed, the last render being saved.
    expect(images(4, 4)).toBe('Drawing image 4 of 4')
    expect(runningReason([{ step: 'draft', progress: { done: 0, total: 3 } }])).toBe(
      'Drafting 3 versions',
    )
    expect(runningReason([{ step: 'draft', progress: { done: 0, total: 1 } }])).toBe(
      'Drafting 1 version',
    )
  })

  it('counts the sections of a blog being written (BR3)', () => {
    expect(runningReason([{ step: 'blog_text', progress: { done: 0, total: 5 } }])).toBe(
      'Writing 5 sections',
    )
    expect(runningReason([{ step: 'blog_text', progress: { done: 0, total: 1 } }])).toBe(
      'Writing 1 section',
    )
  })

  it('falls back to the words when nothing is counted', () => {
    expect(runningReason([{ step: 'images' }])).toBe('Images are being drawn')
    expect(runningReason([{ step: 'images', progress: { done: 0, total: 0 } }])).toBe(
      'Images are being drawn',
    )
    expect(runningReason([{ step: 'ideas', progress: { done: 1, total: 2 } }])).toBe(
      'Ideas are being found',
    )
  })
})

describe('runningReason with a busy model', () => {
  it('says the model is busy, which one, how long it waits and which try comes next', () => {
    const busy = { kind: 'busy', model: 'gemini-3.8-flash', attempt: 2, waitS: 8 } as const
    expect(
      runningReason([{ step: 'blog_text', progress: { done: 0, total: 5, note: busy } }]),
    ).toBe(
      "Writing 5 sections. Google's model is busy (gemini-3.8-flash). Trying again in about 8 s (try 2)",
    )
    expect(runningReason([{ step: 'ideas', progress: { done: 0, total: 0, note: busy } }])).toBe(
      "Ideas are being found. Google's model is busy (gemini-3.8-flash). Trying again in about 8 s (try 2)",
    )
  })

  it('says it writes with Flash-Lite once Flash and Pro are busy', () => {
    const fallback = { kind: 'fallback', model: 'gemini-3.8-flash-lite' } as const
    expect(
      runningReason([{ step: 'blog_text', progress: { done: 1, total: 5, note: fallback } }]),
    ).toBe('Writing 5 sections. Flash and Pro are busy. Writing with Flash-Lite instead')
  })

  it('keeps the words as they were without a note', () => {
    expect(runningReason([{ step: 'blog_text', progress: { done: 0, total: 5 } }])).toBe(
      'Writing 5 sections',
    )
  })
})

describe("a comic's story", () => {
  it('reads as the story being written while a comic drafts, and as versions on any other post', () => {
    expect(runningReason([{ step: 'draft' }], { comic: true })).toBe('The story is being written')
    expect(runningReason([{ step: 'draft' }], { comic: false })).toBe('Versions are being drafted')
    expect(runningReason([{ step: 'source_check' }], { comic: true })).toBe(
      'The source check is running',
    )
  })
})

describe('liteLine', () => {
  it('names each step of this screen whose last run finished on Flash-Lite, leaving out one running again', () => {
    expect(liteLine(['draft', 'nudge_version', 'draft_slide:2'], [], 'text')).toBe(
      'Written with Flash-Lite because Flash and Pro were busy: the versions, a version, a slide.',
    )
    expect(liteLine(['draft', 'nudge_version'], ['draft'], 'text')).toBe(
      'Written with Flash-Lite because Flash and Pro were busy: a version.',
    )
  })

  it('says it on the screen of the step that used Flash-Lite only', () => {
    const lite = ['extract', 'ideas', 'outline', 'blog_text', 'scene_plan', 'source_check']
    const on = (screen: Parameters<typeof liteLine>[2]) => liteLine(lite, [], screen)
    expect(on('source')).toBe('Written with Flash-Lite because Flash and Pro were busy: the facts.')
    expect(on('ideas')).toBe('Written with Flash-Lite because Flash and Pro were busy: the ideas.')
    expect(on('outline')).toBe(
      'Written with Flash-Lite because Flash and Pro were busy: the outline.',
    )
    expect(on('text')).toBe(
      'Written with Flash-Lite because Flash and Pro were busy: the blog text.',
    )
    expect(on('images')).toBe(
      'Written with Flash-Lite because Flash and Pro were busy: the image plan.',
    )
    expect(on('settings')).toBe(
      'Written with Flash-Lite because Flash and Pro were busy: the source check.',
    )
    expect(on('review')).toBeNull()
    expect(on('live')).toBeNull()
  })

  it('says nothing when no step fell back, or every one runs again', () => {
    expect(liteLine([], [], 'text')).toBeNull()
    expect(liteLine(undefined, [], 'text')).toBeNull()
    expect(liteLine(['draft'], ['draft'], 'text')).toBeNull()
  })

  it('names a step it has no screen or words for as "a step", on every screen', () => {
    for (const screen of ['source', 'review'] as const) {
      expect(liteLine(['something_new'], [], screen)).toBe(
        'Written with Flash-Lite because Flash and Pro were busy: a step.',
      )
    }
  })
})
