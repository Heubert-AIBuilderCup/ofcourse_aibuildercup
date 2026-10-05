import { describe, expect, it } from 'bun:test'
import { parseReason } from './reason'

// The account guards (roles, your own account) are pinned in src/shared/lib/auth/access.test.ts.

describe('parseReason', () => {
  it('takes a trimmed reason of up to 200 characters', () => {
    expect(parseReason('  Shared account ')).toEqual({
      ok: true,
      reason: 'Shared account',
    })
    expect(parseReason('  ').ok).toBe(false)
    expect(parseReason('x'.repeat(201)).ok).toBe(false)
  })
})
