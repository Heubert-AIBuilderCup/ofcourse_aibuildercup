import { describe, expect, it } from 'bun:test'
import { artifactId, assetId, canonicalJson, sha256Hex } from './hash'

describe('canonicalJson', () => {
  it('sorts object keys at every depth with no whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(
      '{"a":{"c":[3,{"e":5,"f":4}],"d":2},"b":1}',
    )
  })
})

describe('sha256Hex', () => {
  it('hashes text and bytes the same way', () => {
    expect(sha256Hex('abc')).toBe(sha256Hex(new TextEncoder().encode('abc')))
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})

describe('artifactId', () => {
  const x = { title: 'T', nested: { a: 1, b: [1, 2] } }

  it('is the same for key-reordered copies of the body', () => {
    const reordered = { nested: { b: [1, 2], a: 1 }, title: 'T' }
    expect(artifactId('settings', 'p1', x)).toBe(artifactId('settings', 'p1', reordered))
  })

  it('differs for another post, kind or body', () => {
    expect(artifactId('settings', 'p1', x)).not.toBe(artifactId('settings', 'p2', x))
    expect(artifactId('settings', 'p1', x)).not.toBe(artifactId('source', 'p1', x))
    expect(artifactId('settings', 'p1', x)).not.toBe(
      artifactId('settings', 'p1', { ...x, title: 'U' }),
    )
  })

  it('reads "<kind>_<32 hex>"', () => {
    expect(artifactId('settings', 'p1', x)).toMatch(/^settings_[0-9a-f]{32}$/)
  })
})

describe('assetId', () => {
  it('is the same for the same bytes and differs for other bytes', () => {
    expect(assetId(new Uint8Array([1, 2, 3]))).toBe(assetId(new Uint8Array([1, 2, 3])))
    expect(assetId(new Uint8Array([1, 2, 3]))).not.toBe(assetId(new Uint8Array([1, 2, 4])))
    expect(assetId(new Uint8Array([1, 2, 3]))).toMatch(/^a_[0-9a-f]{32}$/)
  })
})
