import { describe, expect, it } from 'bun:test'
import { landingPath } from './landing'

describe('landingPath', () => {
  it('asks how to picture her before anything else', () => {
    expect(landingPath({ persona: null, lastStep: 'picture', seenFutures: false })).toBe('/picture')
    expect(landingPath({ persona: null, lastStep: 'living', seenFutures: true })).toBe('/picture')
  })

  it('opens screen 1 once she has answered the picture question', () => {
    expect(landingPath({ persona: 'neutral', lastStep: 'picture', seenFutures: false })).toBe(
      '/opening/facts',
    )
  })

  it('reopens the screen she left', () => {
    expect(landingPath({ persona: 'female', lastStep: 'living', seenFutures: false })).toBe(
      '/opening/living',
    )
  })

  it('opens her futures once she has seen them, wherever she was', () => {
    expect(landingPath({ persona: 'male', lastStep: 'living', seenFutures: true })).toBe('/futures')
  })

  it('opens her futures from the futures and coins screens', () => {
    expect(landingPath({ persona: 'male', lastStep: 'futures', seenFutures: false })).toBe(
      '/futures',
    )
    expect(landingPath({ persona: 'male', lastStep: 'attention', seenFutures: false })).toBe(
      '/futures',
    )
  })
})
