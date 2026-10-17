import { describe, expect, test } from 'bun:test'
import { keptFor } from './kept-for'

// The scroll pages' copy of the live feed list (server/feed.ts): a read kept for its time to
// live. The store is a counting fake, so this needs no database and mocks no module.

const TTL = 30_000
const at = (ms: number) => new Date(Date.UTC(2026, 9, 16) + ms)

function counted() {
  let reads = 0
  const kept = keptFor(TTL, async (now) => {
    reads++
    return `read at ${now.getTime()}`
  })
  return { kept, reads: () => reads }
}

describe('keptFor', () => {
  test('two page reads within the time to live read the store once; after it, afresh', async () => {
    const { kept, reads } = counted()
    const first = await kept.recent(at(0))
    expect(await kept.recent(at(TTL - 1))).toBe(first)
    expect(reads()).toBe(1)
    expect(await kept.recent(at(TTL))).not.toBe(first)
    expect(reads()).toBe(2)
  })

  test('a fresh read always reads, and the reads after it reuse it', async () => {
    const { kept, reads } = counted()
    await kept.fresh(at(0))
    const page = await kept.fresh(at(1))
    expect(reads()).toBe(2)
    expect(await kept.recent(at(2))).toBe(page)
    expect(reads()).toBe(2)
  })
})
