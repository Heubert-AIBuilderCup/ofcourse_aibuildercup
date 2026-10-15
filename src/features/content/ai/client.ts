import 'server-only'
import type { z } from 'zod'
import { canonicalJson, sha256Hex } from '../server/hash'
import { dbCache } from './cache'
import { dbCallLog } from './calls'
import {
  type AiConfig,
  aiConfig,
  SEARCH_USE_CASES,
  type SearchUseCase,
  type Tier,
  type UseCase,
} from './config'
import { makeFake } from './fake'
import { buildPrompt, type PromptSpec, retryPrompt } from './prompts'
import { toModelSchema } from './schema-guard'
import { logAiCall, type Outcome, type Usage, withGenAiSpan } from './telemetry'
import { vertexProvider } from './vertex'

export const AI_ERRORS = {
  failed: 'This step failed. Your work so far is kept.',
  dailyLimit: 'The daily limit for this step is reached.',
} as const

export type AiResult<T> =
  | { ok: true; value: T; cached: boolean }
  | { ok: false; error: string; reason: 'failed' | 'daily_limit' }

/** A searched answer (its URLs only grounded ones), the grounded pages and the entry point. */
export type SearchResult<T> =
  | { ok: true; value: T; sources: GroundedSource[]; entryPoint: string | null }
  | { ok: false; error: string; reason: 'failed' | 'daily_limit' }

/** An image sent to a model: the art to check, or a page's reference images (criterion 105). */
export type ImageData = { mime: 'image/png' | 'image/jpeg'; base64: string }

/** What a call is for: the fake answers by use case, and Vertex labels the bill by all three (SR7). */
export type CallPurpose = { useCase: UseCase; tier: Tier; promptVersion: string }

/** A page Google Search grounded an answer on, from the response's grounding chunks. */
export type GroundedSource = { url: string; title: string }

/** A grounded answer: its JSON text, the pages it rests on, Google's search entry point HTML. */
export type SearchAnswer = { text: string; sources: GroundedSource[]; entryPoint: string | null }

type JsonRequest = CallPurpose & {
  model: string
  system: string
  user: string
  temperature: number
  jsonSchema: object
  images?: ImageData[]
  signal: AbortSignal
  data: unknown
  /** Told the response's token counts, for the span and the log line (SR5, SR6). */
  onUsage?: (usage: Usage) => void
}

export type Provider = {
  json(req: JsonRequest): Promise<string>
  /** One JSON answer with the Google Search tool. A provider without it fails every search. */
  search?(req: Omit<JsonRequest, 'images'>): Promise<SearchAnswer>
  image(
    req: CallPurpose & {
      model: string
      prompt: string
      aspectRatio: string
      signal: AbortSignal
      data: unknown
      /** A page's reference images, sent as style references (criterion 105). */
      references?: ImageData[]
      onUsage?: (usage: Usage) => void
    },
  ): Promise<Uint8Array>
}

export type CallLog = {
  countToday(tier: Tier, day: string): Promise<number>
  record(row: {
    useCase: UseCase
    tier: Tier
    model: string
    promptVersion: string
    ok: boolean
    cached: boolean
    ms: number
    fallback: 'replay' | 'no_art' | null
    postId: string | null
  }): Promise<void>
  /**
   * Reserves one call of a capped tier before it is made: a pending row (not ok, not cached) that
   * counts against the day's cap at once, so calls racing for the last slot cannot both take it.
   * Null when the day's calls on that tier (or, given `useCases`, of those use cases) reached the cap.
   */
  reserve(row: {
    useCase: UseCase
    tier: 'pro' | 'image' | 'flash'
    model: string
    promptVersion: string
    postId: string | null
    day: string
    cap: number
    /** Counts these use cases' calls against the cap instead of the tier's: the search cap. */
    useCases?: readonly UseCase[]
  }): Promise<string | null>
  /** Records the outcome of a reserved call on its row. */
  settle(id: string, outcome: { ok: boolean; ms: number }): Promise<void>
}

export type Cache = {
  get(key: string): Promise<unknown | null>
  put(
    key: string,
    row: { useCase: UseCase; model: string; promptVersion: string; value: unknown },
  ): Promise<void>
}

const JSON_TIMEOUT_MS = 30_000
// A search runs queries before it answers, so it gets longer than a plain JSON call.
const SEARCH_TIMEOUT_MS = 45_000
const IMAGE_TIMEOUT_MS = 20_000
const MAX_RATE_LIMIT_WAIT_MS = 5_000
// Bounds the retry prompt, however many issues an answer has.
const MAX_PROBLEMS = 20
const IMAGE_PROMPT_VERSION = 'image.v1'
/**
 * The attempts for a spec, by its first tier: again with the problems on the next rung, then Pro.
 * A lite spec climbs a tier each time (SR8); Flash asks itself twice; Pro has nowhere higher to go.
 */
const LADDERS: Record<PromptSpec<z.ZodType>['tier'], Array<'lite' | 'flash' | 'pro'>> = {
  lite: ['lite', 'flash', 'pro'],
  flash: ['flash', 'flash', 'pro'],
  pro: ['pro', 'pro'],
}

const FAILED = { ok: false, reason: 'failed', error: AI_ERRORS.failed } as const
const DAILY_LIMIT = { ok: false, reason: 'daily_limit', error: AI_ERRORS.dailyLimit } as const

const modelSchemas = new WeakMap<z.ZodType, object>()
function modelSchema(schema: z.ZodType): object {
  let out = modelSchemas.get(schema)
  if (!out) {
    out = toModelSchema(schema)
    modelSchemas.set(schema, out)
  }
  return out
}

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function isRateLimit(err: unknown): err is Error {
  if (!(err instanceof Error)) return false
  return (
    (err as { status?: unknown }).status === 429 || /\b429\b|RESOURCE_EXHAUSTED/.test(err.message)
  )
}

/** The server's retryDelay ("12s"), capped at 5 s; 5 s when it gives none. */
function rateLimitWait(err: Error): number {
  const match = /retryDelay"?\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(err.message)
  const ms = match ? Number(match[1]) * 1000 : MAX_RATE_LIMIT_WAIT_MS
  return Math.min(ms, MAX_RATE_LIMIT_WAIT_MS)
}

/** Settles with the promise, or rejects when the signal aborts, even if the provider ignores it. */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason)
    if (signal.aborted) return onAbort()
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (err) => {
        signal.removeEventListener('abort', onAbort)
        reject(err)
      },
    )
  })
}

type Checked<T> = { ok: true; value: T } | { ok: false; problems: string[] }

/** Schema, then the caller's own checks. Every problem is one line the model can act on. */
function check<S extends z.ZodType>(
  schema: S,
  raw: unknown,
  verify?: (value: z.infer<S>) => string[],
): Checked<z.infer<S>> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues
        .slice(0, MAX_PROBLEMS)
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    }
  }
  const problems = verify ? verify(parsed.data) : []
  if (problems.length > 0) return { ok: false, problems: problems.slice(0, MAX_PROBLEMS) }
  return { ok: true, value: parsed.data }
}

function parseJson(text: string): { ok: true; raw: unknown } | { ok: false } {
  try {
    return { ok: true, raw: JSON.parse(text) }
  } catch {
    return { ok: false }
  }
}

const URL_LIKE = /^https?:\/\//i

/**
 * The answer with every URL Google Search did not ground dropped: from a list, the URL or the item
 * whose `url` it is; from an object, its key, so a required URL fails the schema. Only a grounding
 * chunk's URI, exactly as given (a redirect URI included), counts as grounded.
 */
function groundedOnly(raw: unknown, grounded: ReadonlySet<string>): unknown {
  const ungrounded = (value: unknown) =>
    typeof value === 'string' && URL_LIKE.test(value.trim()) && !grounded.has(value)
  if (Array.isArray(raw)) {
    return raw
      .filter((item) => {
        if (ungrounded(item)) return false
        const url = item && typeof item === 'object' && 'url' in item ? item.url : undefined
        return url === undefined || (typeof url === 'string' && grounded.has(url))
      })
      .map((item) => groundedOnly(item, grounded))
  }
  if (raw && typeof raw === 'object') {
    return Object.fromEntries(
      Object.entries(raw)
        .filter(([, value]) => !ungrounded(value))
        .map(([key, value]) => [key, groundedOnly(value, grounded)]),
    )
  }
  return raw
}

/** Says what failed without the request or the answer, which may carry pasted text. */
function warn(useCase: UseCase, tier: Tier, attempt: number, err: unknown): void {
  const what =
    err instanceof Error ? `${err.name}: ${err.message.slice(0, 300)}` : 'an invalid answer'
  console.warn(`[ai] ${useCase} attempt ${attempt} on ${tier} failed: ${what}`)
}

export function makeAi(deps: {
  provider: Provider
  config: AiConfig
  calls: CallLog
  cache: Cache
  now?: () => Date
  sleep?: (ms: number) => Promise<void>
  /** Where each finished call's log line goes (SR6): stdout, which Cloud Logging reads. */
  logCall?: typeof logAiCall
}) {
  const { provider, config, calls, cache } = deps
  const logCall = deps.logCall ?? logAiCall
  const now = deps.now ?? (() => new Date())
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))

  // The log and the cache never cost the person their answer.
  async function record(row: Parameters<CallLog['record']>[0]): Promise<void> {
    try {
      await calls.record(row)
    } catch (err) {
      console.error('[ai] could not log a call', err instanceof Error ? err.message : err)
    }
  }

  /** A reserved slot under the day's cap, or null. A log that cannot reserve refuses: safer than unlimited. */
  async function reserve(row: {
    useCase: UseCase
    tier: 'pro' | 'image' | 'flash'
    promptVersion: string
    postId: string | null
    cap: number
    useCases?: readonly UseCase[]
  }): Promise<string | null> {
    try {
      return await calls.reserve({
        ...row,
        model: config.models[row.tier],
        day: utcDay(now()),
      })
    } catch {
      return null
    }
  }

  async function settle(id: string, outcome: { ok: boolean; ms: number }): Promise<void> {
    try {
      await calls.settle(id, outcome)
    } catch (err) {
      console.error('[ai] could not settle a call', err instanceof Error ? err.message : err)
    }
  }

  return {
    async generateJson<S extends z.ZodType>(
      spec: PromptSpec<S>,
      req: {
        data: unknown
        images?: ImageData[]
        postId?: string
        timeoutMs?: number
        attemptKey?: number
        verify?: (value: z.infer<S>) => string[]
      },
    ): Promise<AiResult<z.infer<S>>> {
      try {
        const jsonSchema = modelSchema(spec.schema)
        const { system, user } = buildPrompt(spec, req.data)
        const primary = config.models[spec.tier]
        const base = {
          useCase: spec.useCase,
          promptVersion: spec.version,
          fallback: null,
          postId: req.postId ?? null,
        }
        const key = sha256Hex(
          canonicalJson({
            model: primary,
            version: spec.version,
            system,
            user,
            schema: jsonSchema,
            temperature: spec.temperature,
            images: req.images?.map((image) => sha256Hex(image.base64)) ?? null,
            attemptKey: req.attemptKey ?? 0,
          }),
        )

        // 1. Cache: checked again, so a stale or tampered row is a miss, not an answer.
        let hit: unknown = null
        try {
          hit = await cache.get(key)
        } catch {}
        if (hit !== null) {
          const cached = check(spec.schema, hit, req.verify)
          if (cached.ok) {
            const info = {
              useCase: spec.useCase,
              tier: spec.tier,
              promptVersion: spec.version,
              model: primary,
              cached: true,
              attempt: 0,
            }
            await withGenAiSpan(info, async () => {})
            logCall({ ...info, outcome: 'ok', ms: 0 })
            await record({
              ...base,
              tier: spec.tier,
              model: primary,
              ok: true,
              cached: true,
              ms: 0,
            })
            return { ok: true, value: cached.value, cached: true }
          }
        }

        // 2–5. Attempt, retry with the problems, then Pro: the ladder for the spec's tier.
        const tiers = LADDERS[spec.tier]
        let problems: string[] = []
        let waited = false
        for (const [i, tier] of tiers.entries()) {
          const reserved =
            tier === 'pro'
              ? await reserve({
                  useCase: spec.useCase,
                  tier,
                  promptVersion: spec.version,
                  postId: base.postId,
                  cap: config.caps.pro,
                })
              : null
          if (tier === 'pro' && reserved === null) {
            if (i === 0) return DAILY_LIMIT
            break
          }
          const model = config.models[tier]
          const signal = AbortSignal.timeout(req.timeoutMs ?? JSON_TIMEOUT_MS)
          const started = Date.now()
          const info = {
            useCase: spec.useCase,
            tier,
            promptVersion: spec.version,
            model,
            cached: false,
            attempt: i + 1,
          }
          let usage: Usage = {}
          let answer: Checked<z.infer<S>> | null = null
          try {
            answer = await withGenAiSpan(info, async (span) => {
              const text = await untilAborted(
                provider.json({
                  model,
                  system,
                  user: problems.length > 0 ? retryPrompt(user, problems) : user,
                  temperature: spec.temperature,
                  jsonSchema,
                  images: req.images,
                  signal,
                  useCase: spec.useCase,
                  tier,
                  promptVersion: spec.version,
                  data: req.data,
                  onUsage: (reported) => {
                    usage = reported
                    span.setUsage(reported)
                  },
                }),
                signal,
              )
              const parsed = parseJson(text)
              const checked: Checked<z.infer<S>> = parsed.ok
                ? check(spec.schema, parsed.raw, req.verify)
                : { ok: false, problems: ['The answer was not valid JSON.'] }
              if (!checked.ok) span.setOutcome('invalid')
              return checked
            })
          } catch (err) {
            warn(spec.useCase, tier, i + 1, err)
            if (isRateLimit(err) && !waited) {
              waited = true
              await sleep(rateLimitWait(err))
            }
          }
          const ms = Date.now() - started
          const outcome = answer === null ? 'failed' : answer.ok ? 'ok' : 'invalid'
          logCall({ ...info, ...usage, outcome, ms })
          if (reserved) await settle(reserved, { ok: answer?.ok === true, ms })
          else await record({ ...base, tier, model, ok: answer?.ok === true, cached: false, ms })
          if (answer?.ok) {
            try {
              await cache.put(key, {
                useCase: spec.useCase,
                model,
                promptVersion: spec.version,
                value: answer.value,
              })
            } catch {}
            return { ok: true, value: answer.value, cached: false }
          }
          if (answer) {
            warn(spec.useCase, tier, i + 1, null)
            problems = answer.problems
          }
        }
        return FAILED
      } catch (err) {
        console.error('[ai] generateJson', err instanceof Error ? err.message : err)
        return FAILED
      }
    },

    /**
     * One JSON answer on Flash with Google Search, under the search cap: one attempt, never
     * cached, since a search is asked for fresh. Every URL in the answer that the grounding chunks
     * do not hold is dropped before the schema check.
     */
    async searchJson<S extends z.ZodType>(
      spec: PromptSpec<S> & { useCase: SearchUseCase; tier: 'flash' },
      req: { data: unknown; postId?: string },
    ): Promise<SearchResult<z.infer<S>>> {
      try {
        const search = provider.search?.bind(provider)
        if (!search) return FAILED
        const reserved = await reserve({
          useCase: spec.useCase,
          tier: 'flash',
          promptVersion: spec.version,
          postId: req.postId ?? null,
          cap: config.caps.search,
          useCases: SEARCH_USE_CASES,
        })
        if (reserved === null) return DAILY_LIMIT
        const { system, user } = buildPrompt(spec, req.data)
        const model = config.models.flash
        const signal = AbortSignal.timeout(SEARCH_TIMEOUT_MS)
        const started = Date.now()
        const info = {
          useCase: spec.useCase,
          tier: 'flash',
          promptVersion: spec.version,
          model,
          cached: false,
          attempt: 1,
        } as const
        let usage: Usage = {}
        let outcome: Outcome = 'failed'
        let found: {
          value: z.infer<S>
          sources: GroundedSource[]
          entryPoint: string | null
        } | null = null
        try {
          found = await withGenAiSpan(info, async (span) => {
            const answer = await untilAborted(
              search({
                model,
                system,
                user,
                temperature: spec.temperature,
                jsonSchema: modelSchema(spec.schema),
                signal,
                useCase: spec.useCase,
                tier: 'flash',
                promptVersion: spec.version,
                data: req.data,
                onUsage: (reported) => {
                  usage = reported
                  span.setUsage(reported)
                },
              }),
              signal,
            )
            const parsed = parseJson(answer.text)
            const grounded = new Set(answer.sources.map((s) => s.url))
            const checked = parsed.ok
              ? check(spec.schema, groundedOnly(parsed.raw, grounded))
              : null
            if (!checked?.ok) {
              span.setOutcome('invalid')
              return null
            }
            return { value: checked.value, sources: answer.sources, entryPoint: answer.entryPoint }
          })
          outcome = found ? 'ok' : 'invalid'
        } catch (err) {
          warn(spec.useCase, 'flash', 1, err)
        }
        if (outcome === 'invalid') warn(spec.useCase, 'flash', 1, null)
        const ms = Date.now() - started
        logCall({ ...info, ...usage, outcome, ms })
        await settle(reserved, { ok: found !== null, ms })
        return found ? { ok: true, ...found } : FAILED
      } catch (err) {
        console.error('[ai] searchJson', err instanceof Error ? err.message : err)
        return FAILED
      }
    },

    async generateImage(req: {
      prompt: string
      aspectRatio: '4:5' | '1:1' | '21:9' | '16:9' | '4:3'
      postId?: string
      data: unknown
      references?: ImageData[]
    }): Promise<AiResult<Uint8Array>> {
      try {
        const reserved = await reserve({
          useCase: 'art',
          tier: 'image',
          promptVersion: IMAGE_PROMPT_VERSION,
          postId: req.postId ?? null,
          cap: config.caps.image,
        })
        if (reserved === null) return DAILY_LIMIT
        const model = config.models.image
        const signal = AbortSignal.timeout(IMAGE_TIMEOUT_MS)
        const started = Date.now()
        const info = {
          useCase: 'art',
          tier: 'image',
          promptVersion: IMAGE_PROMPT_VERSION,
          model,
          cached: false,
          attempt: 1,
        } as const
        let usage: Usage = {}
        try {
          const bytes = await withGenAiSpan(info, (span) =>
            untilAborted(
              provider.image({
                model,
                prompt: req.prompt,
                aspectRatio: req.aspectRatio,
                signal,
                useCase: 'art',
                tier: 'image',
                promptVersion: IMAGE_PROMPT_VERSION,
                data: req.data,
                references: req.references,
                onUsage: (reported) => {
                  usage = reported
                  span.setUsage(reported)
                },
              }),
              signal,
            ),
          )
          const ms = Date.now() - started
          logCall({ ...info, ...usage, outcome: 'ok', ms })
          await settle(reserved, { ok: true, ms })
          return { ok: true, value: bytes, cached: false }
        } catch (err) {
          warn('art', 'image', 1, err)
          const ms = Date.now() - started
          logCall({ ...info, ...usage, outcome: 'failed', ms })
          await settle(reserved, { ok: false, ms })
          return FAILED
        }
      } catch (err) {
        console.error('[ai] generateImage', err instanceof Error ? err.message : err)
        return FAILED
      }
    },
  }
}

const config = aiConfig(process.env)

/**
 * The provider and project `ai` below was built with, read once when the server started: what the
 * admin header shows. No credential is held here (Vertex uses Application Default Credentials).
 */
export const aiInUse: Pick<AiConfig, 'provider' | 'project'> = {
  provider: config.provider,
  project: config.project,
}

/** The configured provider, the ai_call log and the ai_cache table. */
export const ai: ReturnType<typeof makeAi> = makeAi({
  provider: config.provider === 'fake' ? makeFake() : vertexProvider(config),
  config,
  calls: dbCallLog,
  cache: dbCache,
})
