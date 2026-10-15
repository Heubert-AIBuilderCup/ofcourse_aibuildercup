import { describe, expect, it } from 'bun:test'
import { LOADER_STEPS, loaderError, loaderSteps } from './loader'

const states = (done: number, failed = false) =>
  loaderSteps('first', { done, failed }).map((s) => s.state)

describe('the loader steps', () => {
  it('names three steps for a first roadmap and three for a new one', () => {
    expect(LOADER_STEPS.first).toEqual([
      'Reading your answers',
      'Drawing your first roadmap',
      'Opening your roadmaps',
    ])
    expect(LOADER_STEPS.new).toEqual([
      'Reading your answers',
      'Drawing your new roadmap',
      'Adding it to your roadmaps',
    ])
  })

  it("gives each step its kind's words", () => {
    expect(loaderSteps('new', { done: 0, failed: false }).map((s) => s.text)).toEqual([
      ...LOADER_STEPS.new,
    ])
  })

  it('marks the steps done before the current one, the current now, the rest next', () => {
    expect(states(0)).toEqual(['now', 'next', 'next'])
    expect(states(1)).toEqual(['done', 'now', 'next'])
    expect(states(2)).toEqual(['done', 'done', 'now'])
    expect(states(3)).toEqual(['done', 'done', 'done'])
  })

  it('marks the step that failed bad, the earlier ones done, the later ones next', () => {
    expect(states(0, true)).toEqual(['bad', 'next', 'next'])
    expect(states(1, true)).toEqual(['done', 'bad', 'next'])
    expect(states(2, true)).toEqual(['done', 'done', 'bad'])
  })
})

describe('the loader words', () => {
  it('says the answers are saved when a roadmap could not be drawn', () => {
    expect(loaderError('first')).toBe("We couldn't draw your roadmap. Your answers are saved.")
    expect(loaderError('new')).toBe("We couldn't draw this roadmap. Your answers are saved.")
  })
})
