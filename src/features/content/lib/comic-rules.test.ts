import { describe, expect, it } from 'bun:test'
import type { Fact } from '../model/types'
import {
  applyPanelOp,
  COMIC_PANELS,
  comicCaptionError,
  panelOpsError,
  searchTitleOf,
} from './comic-rules'

const fact = (text: string): Fact => ({
  id: 'f1',
  text,
  value: null,
  ref: '¶1',
  quote: text,
  supported: true,
  why: null,
  span: null,
  sentenceId: '¶1.1',
})
const facts = [fact('Living costs about AUD 30k a year; rent is lower than in Sydney.')]

describe('comicCaptionError', () => {
  it('refuses an outcome promise, naming it', () => {
    expect(comicCaptionError('You will get PR after two years', facts)).toBe(
      'Remove "You will get": a comic never promises an outcome.',
    )
  })

  it('refuses a promise before a banned phrase', () => {
    expect(comicCaptionError('Guaranteed work', facts)).toContain('Guaranteed')
  })

  it('refuses a banned phrase', () => {
    expect(comicCaptionError('The best city', facts)).toBe('Remove "best".')
  })

  it('passes plain words with no number', () => {
    expect(comicCaptionError('Rent felt lighter than in Sydney', facts)).toBeNull()
  })

  it('passes a number a fact holds and refuses one none holds', () => {
    expect(comicCaptionError('about AUD 30k a year', facts)).toBeNull()
    expect(comicCaptionError('about AUD 31k', facts)).toBe('31k is not a fact of this path.')
  })

  it('names the first number no fact holds', () => {
    expect(comicCaptionError('AUD 30k, then 99 and 98', facts)).toBe(
      '99 is not a fact of this path.',
    )
  })
})

describe('panel operations', () => {
  it('has three to six panels', () => {
    expect(COMIC_PANELS).toEqual({ min: 3, max: 6 })
  })

  it('refuses removing at the minimum and adding at the maximum', () => {
    expect(panelOpsError(3, { kind: 'remove', at: 1 })).toBe('A comic has at least 3 panels.')
    expect(panelOpsError(6, { kind: 'add', after: 1 })).toBe('A comic has at most 6 panels.')
    expect(panelOpsError(4, { kind: 'remove', at: 1 })).toBeNull()
    expect(panelOpsError(5, { kind: 'add', after: 4 })).toBeNull()
  })

  it('refuses an index out of range', () => {
    expect(panelOpsError(4, { kind: 'remove', at: 4 })).toBe('No such panel.')
    expect(panelOpsError(4, { kind: 'move', at: 0, to: -1 })).toBe('No such panel.')
    expect(panelOpsError(4, { kind: 'add', after: 4 })).toBe('No such panel.')
  })

  it('move keeps every element', () => {
    const moved = applyPanelOp(['a', 'b', 'c', 'd'], { kind: 'move', at: 0, to: 2 }, 'x')
    expect(moved).toEqual(['b', 'c', 'a', 'd'])
  })

  it('add after the last appends the blank, and add inserts after the index', () => {
    expect(applyPanelOp(['a', 'b', 'c'], { kind: 'add', after: 2 }, 'x')).toEqual([
      'a',
      'b',
      'c',
      'x',
    ])
    expect(applyPanelOp(['a', 'b', 'c'], { kind: 'add', after: 0 }, 'x')).toEqual([
      'a',
      'x',
      'b',
      'c',
    ])
  })

  it('remove drops the panel and leaves the input alone', () => {
    const slides = ['a', 'b', 'c', 'd']
    expect(applyPanelOp(slides, { kind: 'remove', at: 1 }, 'x')).toEqual(['a', 'c', 'd'])
    expect(slides).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('searchTitleOf (RC7, criterion 106)', () => {
  it('names a comic by its own title and a feed post by its source title', () => {
    const source = 'Perth, Cyber Security'
    expect(searchTitleOf({ courseId: 'ecu-cyber', title: 'Life on this path' }, source)).toBe(
      'Life on this path',
    )
    expect(searchTitleOf({ courseId: null, title: 'Paid work' }, source)).toBe(source)
  })
})
