import { describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { viewerKey } from './viewer-key'

const SECRET = randomUUID()

describe('viewerKey', () => {
  test('the same student on the same day gives the same key', () => {
    expect(viewerKey('user-1', '2026-10-14', SECRET)).toBe(
      viewerKey('user-1', '2026-10-14', SECRET),
    )
  })

  test('another day gives another key, so days cannot be linked', () => {
    expect(viewerKey('user-1', '2026-10-15', SECRET)).not.toBe(
      viewerKey('user-1', '2026-10-14', SECRET),
    )
  })

  test('another student gives another key', () => {
    expect(viewerKey('user-2', '2026-10-14', SECRET)).not.toBe(
      viewerKey('user-1', '2026-10-14', SECRET),
    )
  })

  test('the key never contains the user id and is 32 hex characters', () => {
    const userId = 'abc123'
    const key = viewerKey(userId, '2026-10-14', SECRET)
    expect(key).toMatch(/^[0-9a-f]{32}$/)
    expect(key).not.toContain(userId)
  })
})
