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
import { allowedTiers } from './models'
import { buildPrompt, type PromptSpec, retryPrompt } from './prompts'
import { toModelSchema } from './schema-guard'
import { type AiSettings, markFailing, readSettings } from './settings'
import { logAiCall, type Outcome, type Usage, withGenAiSpan } from './telemetry'
import { vertexProvider } from './vertex'

export const AI_ERRORS = {
  failed: 'This step failed. Your work so far is kept.',
  dailyLimit: 'The daily limit for this step is reached.',
  // The last attempt was refused with a 429 (the model's per-minute limit) or ran out of time:
  // said so, and lib/failure.ts names the reason after a failed step's line.
  busy: 'The model is busy right now (429). Try again in a minute.',
  timeout: 'The model took too long (timeout). Try again.',
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
    /** 'env-default': the tier's saved model was not found or refused, so the environment's answered. */
    fallback: 'replay' | 'no_art' | 'env-default' | null
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
    /** 'env-default': the retry on the environment's model after the saved one failed. */
    fallback?: 'env-default'
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

/** The saved model settings (criteria 94–96) and where a failing saved model is reported. */
export type Settings = {
  readSettings(): Promise<AiSettings>
  /** Marks `tier` failing while it still holds `model`, the model that failed. */
  markFailing(tier: Tier, model: string, message: string): Promise<void>
}

const NO_SETTINGS_SAVED: AiSettings = Object.freeze({
  tierModels: {},
  useCaseTiers: {},
  failing: {},
})

/** No saved choice: every call runs on the environment's models, as before story 15 (criterion 99). */
const NO_SETTINGS: Settings = {
  readSettings: async () => NO_SETTINGS_SAVED,
  markFailing: async () => {},
}

/** The saved settings for a provider: none on the fake one, so tests and e2e never read the table. */
export function settingsFor(config: AiConfig): Settings {
  return config.provider === 'fake' ? NO_SETTINGS : { readSettings, markFailing }
}

/** How long a call waits for the saved settings before it runs on the environment's models. */
export const SETTINGS_READ_TIMEOUT_MS = 300

const JSON_TIMEOUT_MS = 30_000
// A search runs queries before it answers, so it gets longer than a plain JSON call.
const SEARCH_TIMEOUT_MS = 45_000
// A picture takes the image model about 23 s on Cloud Run (16 Oct): a minute leaves it room, so a
// slow picture is not abandoned, asked again and counted twice against the per-minute quota.
export const IMAGE_TIMEOUT_MS = 60_000
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
/** A rung's height, so a spec's `maxTier` can drop the rungs above it. */
const RUNG: Record<PromptSpec<z.ZodType>['tier'], number> = { lite: 0, flash: 1, pro: 2 }

const FAILED = { ok: false, reason: 'failed', error: AI_ERRORS.failed } as const

/** A failed call, saying why when its last error was a 429 or ran out of time (never a caller's abort). */
function failedFor(err: unknown): { ok: false; reason: 'failed'; error: string } {
  if (isRateLimit(err)) return { ok: false, reason: 'failed', error: AI_ERRORS.busy }
  if (err instanceof Error && err.name === 'TimeoutError')
    return { ok: false, reason: 'failed', error: AI_ERRORS.timeout }
  return FAILED
}
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

/**
 * A model Vertex does not find (404) or will not let this project use (403): @google/genai throws
 * its ApiError with the HTTP status as a number in `status`, and vertex.ts passes it on unchanged.
 */
function isModelUnavailable(err: unknown): err is Error {
  if (!(err instanceof Error)) return false
  const status = (err as { status?: unknown }).status
  return status === 404 || status === 403
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
  /** The saved model settings; none given, every call runs on the environment's models. */
  settings?: Settings
  settingsTimeoutMs?: number
}) {
  const { provider, config, calls, cache } = deps
  const logCall = deps.logCall ?? logAiCall
  const now = deps.now ?? (() => new Date())
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const settings = deps.settings ?? NO_SETTINGS
  const settingsTimeoutMs = deps.settingsTimeoutMs ?? SETTINGS_READ_TIMEOUT_MS

  /**
   * The saved settings, read for each call so a save applies to the next one (criterion 94). Fails
   * open: settings that are slow or cannot be read leave the call on the environment's models.
   */
  async function savedSettings(): Promise<AiSettings> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const late = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), settingsTimeoutMs)
    })
    try {
      const value = await Promise.race([settings.readSettings(), late])
      if (value) return value
      console.warn("[ai] the model settings were slow to read; the environment's models apply")
    } catch (err) {
      console.warn(
        "[ai] could not read the model settings; the environment's models apply",
        err instanceof Error ? err.message : err,
      )
    } finally {
      clearTimeout(timer)
    }
    return NO_SETTINGS_SAVED
  }

  /** The model a tier runs on: the one saved for it, else the environment's. */
  function modelOf(saved: AiSettings, tier: Tier): string {
    return saved.tierModels[tier] ?? config.models[tier]
  }

  /** Whether a failed attempt on `model` is retried on the environment's model (criterion 96). */
  function fallsBack(tier: Tier, model: string, err: unknown): err is Error {
    return model !== config.models[tier] && isModelUnavailable(err)
  }

  /** Shows the saved model as failing on the Models page; never costs the person their answer. */
  async function reportFailing(tier: Tier, model: string, err: Error): Promise<void> {
    try {
      await settings.markFailing(tier, model, err.message)
    } catch (e) {
      console.error('[ai] could not mark a model failing', e instanceof Error ? e.message : e)
    }
  }

  /**
   * The tier a spec starts on: the one saved for its use case when the use case allows it and the
   * spec's ceiling reaches it (criterion 95), else the spec's own.
   */
  function startTier(
    spec: PromptSpec<z.ZodType>,
    saved: AiSettings,
  ): PromptSpec<z.ZodType>['tier'] {
    const chosen = saved.useCaseTiers[spec.useCase]
    if (!chosen || chosen === 'image' || !allowedTiers(spec.useCase).includes(chosen)) {
      return spec.tier
    }
    if (spec.maxTier && RUNG[chosen] > RUNG[spec.maxTier]) return spec.tier
    return chosen
  }

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
    model: string
    promptVersion: string
    postId: string | null
    cap: number
    useCases?: readonly UseCase[]
    fallback?: 'env-default'
  }): Promise<string | null> {
    try {
      return await calls.reserve({ ...row, day: utcDay(now()) })
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
        /** False: the answer is neither looked up in ai_cache nor stored there (a person's own words). */
        cache?: boolean
        /** The start tier's model for this call only, in one attempt (as `once`): a Test before a save. */
        model?: string
        /** One attempt on the start tier: no retry, no climb, no fallback (a Test, criterion 93). */
        once?: boolean
        verify?: (value: z.infer<S>) => string[]
        /** The caller's deadline: once it aborts, the attempt in flight stops and no rung starts. */
        signal?: AbortSignal
      },
    ): Promise<AiResult<z.infer<S>>> {
      const useCache = req.cache !== false
      try {
        const saved = await savedSettings()
        const start = startTier(spec, saved)
        const jsonSchema = modelSchema(spec.schema)
        const { system, user } = buildPrompt(spec, req.data)
        const primary = req.model ?? modelOf(saved, start)
        const base = {
          useCase: spec.useCase,
          promptVersion: spec.version,
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
          if (useCache) hit = await cache.get(key)
        } catch {}
        if (hit !== null) {
          const cached = check(spec.schema, hit, req.verify)
          if (cached.ok) {
            const info = {
              useCase: spec.useCase,
              tier: start,
              promptVersion: spec.version,
              model: primary,
              cached: true,
              attempt: 0,
            }
            await withGenAiSpan(info, async () => {})
            logCall({ ...info, outcome: 'ok', ms: 0 })
            await record({
              ...base,
              tier: start,
              model: primary,
              ok: true,
              cached: true,
              ms: 0,
              fallback: null,
            })
            return { ok: true, value: cached.value, cached: true }
          }
        }

        let problems: string[] = []
        let waited = false
        // A single call (once, or a per-call model) has no next attempt, so it never waits on a 429.
        const single = req.once === true || req.model !== undefined
        /** One attempt on `model`, logged; a reserved attempt settles its slot, any other is recorded. */
        const attempt = async (
          n: number,
          tier: PromptSpec<S>['tier'],
          model: string,
          reserved: string | null,
          fallback: 'env-default' | null,
        ) => {
          const timeout = AbortSignal.timeout(req.timeoutMs ?? JSON_TIMEOUT_MS)
          const signal = req.signal ? AbortSignal.any([timeout, req.signal]) : timeout
          const started = Date.now()
          const info = {
            useCase: spec.useCase,
            tier,
            promptVersion: spec.version,
            model,
            cached: false,
            attempt: n,
          }
          let usage: Usage = {}
          let answer: Checked<z.infer<S>> | null = null
          let error: unknown = null
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
            error = err
            warn(spec.useCase, tier, n, err)
            if (isRateLimit(err) && !waited && !single) {
              waited = true
              await sleep(rateLimitWait(err))
            }
          }
          const ms = Date.now() - started
          const outcome = answer === null ? 'failed' : answer.ok ? 'ok' : 'invalid'
          logCall({ ...info, ...usage, outcome, ms })
          const ok = answer?.ok === true
          if (reserved) await settle(reserved, { ok, ms })
          else await record({ ...base, tier, model, ok, cached: false, ms, fallback })
          return { answer, error }
        }

        // 2–5. Attempt, retry with the problems, then Pro: the ladder for the start tier, with no
        // rung above the spec's maxTier (a lite spec with maxTier 'lite' makes one attempt).
        const top = spec.maxTier
        const tiers = single
          ? [start]
          : top
            ? LADDERS[start].filter((tier) => RUNG[tier] <= RUNG[top])
            : LADDERS[start]
        /** No slot below Pro (null); on Pro a reserved one, or false at the day's cap. */
        const slot = async (
          tier: PromptSpec<S>['tier'],
          model: string,
          fallback?: 'env-default',
        ): Promise<string | null | false> => {
          if (tier !== 'pro') return null
          const id = await reserve({
            useCase: spec.useCase,
            tier,
            model,
            promptVersion: spec.version,
            postId: base.postId,
            cap: config.caps.pro,
            fallback,
          })
          return id ?? false
        }
        // The tiers whose saved model failed in this call: their later rungs run on the environment's.
        const fellBack = new Set<Tier>()
        // The last attempt's error, so a ladder that ends on a 429 or a timeout says so.
        let last: unknown = null
        for (const [i, tier] of tiers.entries()) {
          // Past the caller's deadline nobody reads the answer: no rung starts.
          if (req.signal?.aborted) break
          const override = i === 0 ? req.model : undefined
          let model = override ?? (fellBack.has(tier) ? config.models[tier] : modelOf(saved, tier))
          let reserved = await slot(tier, model)
          if (reserved === false) {
            if (i === 0) return DAILY_LIMIT
            break
          }
          let { answer, error } = await attempt(i + 1, tier, model, reserved, null)
          // A saved model not found or refused: once more on the environment's (criterion 96). On
          // Pro the retry reserves a slot of its own, so it counts against the cap like any call.
          if (!override && !req.signal?.aborted && fallsBack(tier, model, error)) {
            fellBack.add(tier)
            await reportFailing(tier, model, error)
            if (!single) {
              model = config.models[tier]
              reserved = await slot(tier, model, 'env-default')
              if (reserved === false) {
                if (i === 0) return DAILY_LIMIT
                break
              }
              ;({ answer, error } = await attempt(i + 1, tier, model, reserved, 'env-default'))
            }
          }
          last = error
          if (answer?.ok) {
            try {
              if (useCache)
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
        return failedFor(last)
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
        const chosen = modelOf(await savedSettings(), 'flash')
        const reserved = await reserve({
          useCase: spec.useCase,
          tier: 'flash',
          model: chosen,
          promptVersion: spec.version,
          postId: req.postId ?? null,
          cap: config.caps.search,
          useCases: SEARCH_USE_CASES,
        })
        if (reserved === null) return DAILY_LIMIT
        const { system, user } = buildPrompt(spec, req.data)
        const attempt = async (model: string) => {
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
          let error: unknown = null
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
              return {
                value: checked.value,
                sources: answer.sources,
                entryPoint: answer.entryPoint,
              }
            })
            outcome = found ? 'ok' : 'invalid'
          } catch (err) {
            error = err
            warn(spec.useCase, 'flash', 1, err)
          }
          if (outcome === 'invalid') warn(spec.useCase, 'flash', 1, null)
          const ms = Date.now() - started
          logCall({ ...info, ...usage, outcome, ms })
          return { found, error, ms }
        }
        let result = await attempt(chosen)
        await settle(reserved, { ok: result.found !== null, ms: result.ms })
        // A saved Flash model not found or refused: once more on the environment's (criterion 96),
        // in a search slot of its own, so the retry counts against the cap like any search.
        if (fallsBack('flash', chosen, result.error)) {
          await reportFailing('flash', chosen, result.error)
          const retry = await reserve({
            useCase: spec.useCase,
            tier: 'flash',
            model: config.models.flash,
            promptVersion: spec.version,
            postId: req.postId ?? null,
            cap: config.caps.search,
            useCases: SEARCH_USE_CASES,
            fallback: 'env-default',
          })
          if (retry === null) return DAILY_LIMIT
          result = await attempt(config.models.flash)
          await settle(retry, { ok: result.found !== null, ms: result.ms })
        }
        return result.found ? { ok: true, ...result.found } : FAILED
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
      /** The image model for this call only, never falling back: a Test before a save. */
      model?: string
      /** One attempt: no fallback (a Test, criterion 93). */
      once?: boolean
    }): Promise<AiResult<Uint8Array>> {
      try {
        const chosen = req.model ?? modelOf(await savedSettings(), 'image')
        const reserved = await reserve({
          useCase: 'art',
          tier: 'image',
          model: chosen,
          promptVersion: IMAGE_PROMPT_VERSION,
          postId: req.postId ?? null,
          cap: config.caps.image,
        })
        if (reserved === null) return DAILY_LIMIT
        const attempt = async (model: string) => {
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
            return { bytes, error: null, ms }
          } catch (err) {
            warn('art', 'image', 1, err)
            const ms = Date.now() - started
            logCall({ ...info, ...usage, outcome: 'failed', ms })
            return { bytes: null, error: err, ms }
          }
        }
        let result = await attempt(chosen)
        await settle(reserved, { ok: result.bytes !== null, ms: result.ms })
        // A saved image model not found or refused: once more on the environment's (criterion 96).
        if (!req.model && fallsBack('image', chosen, result.error)) {
          await reportFailing('image', chosen, result.error)
          if (req.once) return FAILED
          // In an image slot of its own, so the retry counts against the cap like any cover.
          const retry = await reserve({
            useCase: 'art',
            tier: 'image',
            model: config.models.image,
            promptVersion: IMAGE_PROMPT_VERSION,
            postId: req.postId ?? null,
            cap: config.caps.image,
            fallback: 'env-default',
          })
          if (retry === null) return DAILY_LIMIT
          result = await attempt(config.models.image)
          await settle(retry, { ok: result.bytes !== null, ms: result.ms })
        }
        return result.bytes
          ? { ok: true, value: result.bytes, cached: false }
          : failedFor(result.error)
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

/** The configured provider, the ai_call log, the ai_cache table and the saved model settings. */
export const ai: ReturnType<typeof makeAi> = makeAi({
  provider: config.provider === 'fake' ? makeFake() : vertexProvider(config),
  config,
  calls: dbCallLog,
  cache: dbCache,
  settings: settingsFor(config),
})
