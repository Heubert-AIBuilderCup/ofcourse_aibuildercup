import { afterEach, describe, expect, test } from 'bun:test'
import { GET } from './route'

// The dev-only provider route e2e asks before it runs: gated like the dev login, so it answers
// only outside production, with DEV_LOGIN_SECRET set, to a request that carries it.

// Made per run, so no fixed value sits in the code.
const SECRET = crypto.randomUUID()
const saved = { ...process.env }

function request(secret: string | null): Request {
  return new Request('http://localhost/api/ai-provider', {
    headers: secret === null ? {} : { 'x-dev-login-secret': secret },
  })
}

function setEnv(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

afterEach(() => {
  setEnv({
    NODE_ENV: saved.NODE_ENV,
    DEV_LOGIN_SECRET: saved.DEV_LOGIN_SECRET,
    AI_PROVIDER: saved.AI_PROVIDER,
  })
})

describe('GET /api/ai-provider', () => {
  test('a 404 in production, even with the secret', async () => {
    setEnv({ NODE_ENV: 'production', DEV_LOGIN_SECRET: SECRET, AI_PROVIDER: 'fake' })
    expect((await GET(request(SECRET))).status).toBe(404)
  })

  test('a 404 without DEV_LOGIN_SECRET, or with a missing or wrong secret', async () => {
    setEnv({ NODE_ENV: 'development', DEV_LOGIN_SECRET: undefined, AI_PROVIDER: 'fake' })
    expect((await GET(request(''))).status).toBe(404)
    setEnv({ DEV_LOGIN_SECRET: SECRET })
    expect((await GET(request(null))).status).toBe(404)
    expect((await GET(request('wrong'))).status).toBe(404)
  })

  test('the provider the server runs, to a request with the secret', async () => {
    setEnv({ NODE_ENV: 'development', DEV_LOGIN_SECRET: SECRET, AI_PROVIDER: 'fake' })
    const fake = await GET(request(SECRET))
    expect(fake.status).toBe(200)
    expect(await fake.json()).toEqual({ provider: 'fake' })

    setEnv({ AI_PROVIDER: undefined })
    expect(await (await GET(request(SECRET))).json()).toEqual({ provider: 'vertex' })
  })
})
