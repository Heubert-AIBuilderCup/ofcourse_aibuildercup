import 'server-only'
// A provider that records each JSON attempt (its model, use case, time and the first 500
// characters of any error) and holds a script's one attempt counter: at the cap it refuses
// before the provider is called. The client's AiResult carries none of these, so a script that
// measures the models wraps its provider with this.

import type { Provider } from './client'
import type { UseCase } from './config'

export type Attempt = { useCase: UseCase; model: string; ms: number; ok: boolean; error?: string }

const ERROR_MAX = 500

export function recording(
  provider: Provider,
  opts: { cap: number },
): { provider: Provider; attempts: Attempt[] } {
  const attempts: Attempt[] = []
  // Counted when an attempt starts, not when it ends, so attempts made at once share the cap.
  let started = 0
  return {
    attempts,
    provider: {
      async json(req) {
        if (started >= opts.cap) throw new Error('Budget spent')
        started++
        const startedAt = Date.now()
        const attempt = (ok: boolean, error?: string): Attempt => ({
          useCase: req.useCase,
          model: req.model,
          ms: Date.now() - startedAt,
          ok,
          ...(error !== undefined && { error }),
        })
        try {
          const text = await provider.json(req)
          attempts.push(attempt(true))
          return text
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          attempts.push(attempt(false, message.slice(0, ERROR_MAX)))
          throw err
        }
      },
      ...(provider.search && { search: provider.search.bind(provider) }),
      image: provider.image.bind(provider),
    },
  }
}
