// The recording provider: each JSON attempt with its model, use case, time and error, and a
// shared counter that stops a script at its cap before the provider is called. A stub provider.

import { describe, expect, it, mock } from 'bun:test'
import type { Provider } from './client'

mock.module('server-only', () => ({}))

const { recording } = await import('./recording')

type JsonReq = Parameters<Provider['json']>[0]

function request(model: string): JsonReq {
  return {
    model,
    system: 'system',
    user: 'user',
    temperature: 0,
    jsonSchema: {},
    signal: AbortSignal.timeout(1000),
    data: {},
    useCase: 'student_why',
    tier: 'lite',
    promptVersion: 'student_why.v4',
  }
}

function stub(answer: () => Promise<string>) {
  let calls = 0
  const provider: Provider = {
    json: () => {
      calls++
      return answer()
    },
    image: async () => new Uint8Array(),
  }
  return { provider, calls: () => calls }
}

describe('recording', () => {
  it('records a passing attempt with its model, use case and ok', async () => {
    const { provider } = stub(async () => '{"why":"x"}')
    const rec = recording(provider, { cap: 5 })

    expect(await rec.provider.json(request('lite-model'))).toBe('{"why":"x"}')
    expect(rec.attempts.length).toBe(1)
    expect(rec.attempts[0].model).toBe('lite-model')
    expect(rec.attempts[0].useCase).toBe('student_why')
    expect(rec.attempts[0].ok).toBe(true)
    expect(rec.attempts[0].error).toBeUndefined()
    expect(typeof rec.attempts[0].ms).toBe('number')
  })

  it('records a throwing attempt with its error cut to 500 characters, and still throws', async () => {
    const { provider } = stub(async () => {
      throw new Error('x'.repeat(800))
    })
    const rec = recording(provider, { cap: 5 })

    await expect(rec.provider.json(request('lite-model'))).rejects.toThrow('x'.repeat(800))
    expect(rec.attempts.length).toBe(1)
    expect(rec.attempts[0].ok).toBe(false)
    expect(rec.attempts[0].error).toBe('x'.repeat(500))
  })

  it('throws "Budget spent" once the cap is reached, without calling the provider', async () => {
    const { provider, calls } = stub(async () => '{}')
    const rec = recording(provider, { cap: 2 })

    await rec.provider.json(request('a'))
    await rec.provider.json(request('b'))
    await expect(rec.provider.json(request('c'))).rejects.toThrow('Budget spent')
    expect(calls()).toBe(2)
    expect(rec.attempts.length).toBe(2)
  })

  it('counts an attempt from its start, so calls made at once cannot pass the cap', async () => {
    const { provider, calls } = stub(async () => '{}')
    const rec = recording(provider, { cap: 1 })

    const results = await Promise.allSettled([
      rec.provider.json(request('a')),
      rec.provider.json(request('b')),
    ])
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected'])
    expect(calls()).toBe(1)
  })
})
