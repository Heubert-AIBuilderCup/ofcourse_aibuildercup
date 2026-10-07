// sendSignInCode: the email provider when RESEND_API_KEY and EMAIL_FROM are set, the console
// outside production, and a refusal in production without a provider. No request leaves the test:
// fetch is replaced by a mock.

import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

// sign-in-code.ts is 'server-only', which throws outside Next's server build.
mock.module('server-only', () => ({}))

const { sendSignInCode } = await import('./sign-in-code')

const env = process.env as Record<string, string | undefined>
const KEYS = ['RESEND_API_KEY', 'EMAIL_FROM', 'NODE_ENV'] as const
const realFetch = globalThis.fetch
let saved: Record<string, string | undefined> = {}

const replaceFetch = (response: { ok: boolean; status: number }) => {
  const fetchMock = mock(async (_url: string, _init: RequestInit) => response as Response)
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

describe('sendSignInCode', () => {
  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((key) => [key, env[key]]))
  })

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete env[key]
      else env[key] = saved[key]
    }
    globalThis.fetch = realFetch
    mock.restore()
  })

  test('with a provider, sends the code to the address through Resend', async () => {
    env.RESEND_API_KEY = 'test-key-not-real'
    env.EMAIL_FROM = 'OfCourse <codes@ofcourse.test>'
    const fetchMock = replaceFetch({ ok: true, status: 200 })

    await sendSignInCode('a@b.test', '123456')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer test-key-not-real' })
    const body = JSON.parse(init.body as string)
    expect(body.from).toBe('OfCourse <codes@ofcourse.test>')
    expect(body.to).toEqual(['a@b.test'])
    expect(body.text).toContain('123456')
  })

  test('rejects when the provider refuses the email', async () => {
    env.RESEND_API_KEY = 'test-key-not-real'
    env.EMAIL_FROM = 'OfCourse <codes@ofcourse.test>'
    replaceFetch({ ok: false, status: 422 })

    await expect(sendSignInCode('a@b.test', '123456')).rejects.toThrow('422')
  })

  test('without a provider outside production, logs the code instead', async () => {
    delete env.RESEND_API_KEY
    delete env.EMAIL_FROM
    env.NODE_ENV = 'test'
    const fetchMock = replaceFetch({ ok: true, status: 200 })
    const info = spyOn(console, 'info').mockImplementation(() => {})

    await sendSignInCode('a@b.test', '123456')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalledTimes(1)
    expect(String(info.mock.calls[0][0])).toContain('123456')
  })

  test('without a provider in production, refuses', async () => {
    delete env.RESEND_API_KEY
    delete env.EMAIL_FROM
    env.NODE_ENV = 'production'

    await expect(sendSignInCode('a@b.test', '123456')).rejects.toThrow(/No email provider/)
  })
})
