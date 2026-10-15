import { describe, expect, it } from 'bun:test'
import { Lru } from './lru'

describe('Lru', () => {
  it('returns what was set, and undefined for a key it never had', () => {
    const lru = new Lru<number>(2)
    lru.set('a', 1)
    expect(lru.get('a')).toBe(1)
    expect(lru.get('b')).toBeUndefined()
  })

  it('drops the least recently used entry once it is full', () => {
    const lru = new Lru<number>(2)
    lru.set('a', 1)
    lru.set('b', 2)
    // Reading a makes b the oldest.
    expect(lru.get('a')).toBe(1)
    lru.set('c', 3)
    expect(lru.get('b')).toBeUndefined()
    expect(lru.get('a')).toBe(1)
    expect(lru.get('c')).toBe(3)
    expect(lru.size).toBe(2)
  })

  it('replaces a key in place without growing', () => {
    const lru = new Lru<number>(2)
    lru.set('a', 1)
    lru.set('a', 2)
    expect(lru.get('a')).toBe(2)
    expect(lru.size).toBe(1)
  })
})
