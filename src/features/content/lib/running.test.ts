import { describe, expect, it } from 'bun:test'
import { runningReason } from './running'

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

describe("a comic's story", () => {
  it('reads as the story being written while a comic drafts, and as versions on any other post', () => {
    expect(runningReason([{ step: 'draft' }], { comic: true })).toBe('The story is being written')
    expect(runningReason([{ step: 'draft' }], { comic: false })).toBe('Versions are being drafted')
    expect(runningReason([{ step: 'source_check' }], { comic: true })).toBe(
      'The source check is running',
    )
  })
})
