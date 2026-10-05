import { describe, expect, it } from 'bun:test'
import { devLoginAllowed, devLoginInput } from './dev-login'

const SECRET = 'a-long-test-secret-0123456789'

describe('devLoginAllowed', () => {
  it('lets a request with the matching secret through in development', () => {
    expect(devLoginAllowed({ nodeEnv: 'development', secret: SECRET }, SECRET)).toBe(true)
    expect(devLoginAllowed({ nodeEnv: 'test', secret: SECRET }, SECRET)).toBe(true)
  })

  it('is closed in production, even with the matching secret', () => {
    expect(devLoginAllowed({ nodeEnv: 'production', secret: SECRET }, SECRET)).toBe(false)
  })

  it('is closed when no secret is configured', () => {
    expect(devLoginAllowed({ nodeEnv: 'development', secret: undefined }, '')).toBe(false)
    expect(devLoginAllowed({ nodeEnv: 'development', secret: '' }, '')).toBe(false)
    expect(devLoginAllowed({ nodeEnv: 'development', secret: '  ' }, '  ')).toBe(false)
  })

  it('refuses a missing or wrong secret', () => {
    expect(devLoginAllowed({ nodeEnv: 'development', secret: SECRET }, null)).toBe(false)
    expect(devLoginAllowed({ nodeEnv: 'development', secret: SECRET }, 'wrong')).toBe(false)
    expect(devLoginAllowed({ nodeEnv: 'development', secret: SECRET }, `${SECRET}x`)).toBe(false)
  })
})

describe('devLoginInput', () => {
  it('takes an email and an optional name', () => {
    expect(devLoginInput.parse({ email: 'User@Example.test' })).toEqual({
      email: 'user@example.test',
    })
    expect(devLoginInput.parse({ email: 'a@b.test', name: ' Asha ' })).toEqual({
      email: 'a@b.test',
      name: 'Asha',
    })
  })

  it('refuses anything that is not an email', () => {
    expect(devLoginInput.safeParse({ email: 'nope' }).success).toBe(false)
    expect(devLoginInput.safeParse({}).success).toBe(false)
    expect(devLoginInput.safeParse({ email: `${'a'.repeat(250)}@b.test` }).success).toBe(false)
  })
})
