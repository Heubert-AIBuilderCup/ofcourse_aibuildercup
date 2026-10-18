import { describe, expect, test } from 'bun:test'
import { wheelGate } from './wheel'

describe('wheelGate: one wheel gesture moves one post, as TikTok does', () => {
  test('the first event of a gesture steps by its direction', () => {
    const gate = wheelGate()
    expect(gate(1000, 40)).toBe(1)
    expect(wheelGate()(1000, -40)).toBe(-1)
  })

  test("a trackpad's long tail of events, each close to the last, steps once", () => {
    const gate = wheelGate()
    const steps = [0, 16, 32, 48, 120, 260, 400, 560, 700, 850].map((dt, i) =>
      gate(1000 + dt, 60 - i * 5),
    )
    expect(steps.filter((s) => s !== 0).length).toBe(1)
  })

  test('a new gesture after a pause steps again', () => {
    const gate = wheelGate()
    expect(gate(1000, 40)).toBe(1)
    expect(gate(1100, 30)).toBe(0)
    expect(gate(1800, 40)).toBe(1)
  })

  test('two flicks closer together than the step takes to land move one post', () => {
    const gate = wheelGate()
    expect(gate(1000, 40)).toBe(1)
    // A pause long enough to end the gesture, but the first step is still landing.
    expect(gate(1300, 40)).toBe(0)
  })

  test('a tiny nudge moves nothing and starts no gesture', () => {
    const gate = wheelGate()
    expect(gate(1000, 2)).toBe(0)
    expect(gate(1010, 40)).toBe(1)
  })
})
