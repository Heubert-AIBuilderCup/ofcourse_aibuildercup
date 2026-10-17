import { describe, expect, it } from 'bun:test'
import { aiConfig } from './config'

describe('aiConfig supportEmail', () => {
  it('reads SUPPORT_EMAIL, trimmed', () => {
    expect(aiConfig({ SUPPORT_EMAIL: '  nikhil@heubert.com ' }).supportEmail).toBe(
      'nikhil@heubert.com',
    )
  })

  it('is null when SUPPORT_EMAIL is unset, blank or does not look like an email', () => {
    expect(aiConfig({}).supportEmail).toBeNull()
    expect(aiConfig({ SUPPORT_EMAIL: '   ' }).supportEmail).toBeNull()
    expect(aiConfig({ SUPPORT_EMAIL: 'nikhil' }).supportEmail).toBeNull()
    expect(aiConfig({ SUPPORT_EMAIL: 'a b@heubert.com' }).supportEmail).toBeNull()
    expect(aiConfig({ SUPPORT_EMAIL: 'nikhil@heubert' }).supportEmail).toBeNull()
  })
})
