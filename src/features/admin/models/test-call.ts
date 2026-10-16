import 'server-only'
import type { z } from 'zod'
import { coverPrompt } from '@/features/content/ai/art'
import { dbCache } from '@/features/content/ai/cache'
import { dbCallLog } from '@/features/content/ai/calls'
import { makeAi, type Provider, settingsFor } from '@/features/content/ai/client'
import { aiConfig, ERROR_MAX, type Tier, type UseCase } from '@/features/content/ai/config'
import { makeFake } from '@/features/content/ai/fake'
import { allowedTiers } from '@/features/content/ai/models'
import {
  ART_CHECK,
  BLOG_OUTLINE,
  BLOG_TEXT,
  CAPTION,
  CHARACTER_PLAN,
  COMIC_STORY,
  DESIGN_LANGUAGE,
  DRAFT,
  DRAFT_SLIDE,
  EXTRACT,
  IDEAS,
  MARKET,
  OUTLINE,
  type PromptSpec,
  SCENE_PLAN,
  SOURCE_CHECK,
  STUDENT_ASK,
  STUDENT_WHY,
  STUDENT_WORDS,
} from '@/features/content/ai/prompts'
import { recording } from '@/features/content/ai/recording'
import { RESEARCH_CLAIM, SUGGEST_SOURCES } from '@/features/content/ai/search'
import { vertexProvider } from '@/features/content/ai/vertex'
import { CHECK_CASES, type Pin } from '@/features/roads/evals/check-cases'

// The Models page's Test (criteria 93, 94): exactly one live call through a client of its own
// around the app's provider, on the use case's own tier (or the override's): no retry, no climb, no
// fallback, so a failing tier shows as failed. The provider is wrapped so the call's model, time
// and error are seen (AiResult carries none). The client keeps the app's call log, so the daily
// caps hold and the call is logged; the cache is off. A search use case is tested through
// generateJson on its spec, without the search tool: it checks the Flash model answers, not the
// search.

/** What a Test shows: ok or failed, the model, the time and the first 500 characters of any error. */
export type TestResult = { ok: boolean; model: string; ms: number; error?: string }

/** One line of "Test all student calls": a check case by its label. */
export type StudentCallRow = TestResult & { label: string }

/** A model not yet saved, tried on its tier for this one call. */
export type TierOverride = { tier: Tier; model: string }

type TextUseCase = Exclude<UseCase, 'art'>

const SPECS: Record<TextUseCase, PromptSpec<z.ZodType>> = {
  extract: EXTRACT,
  draft: DRAFT,
  draft_slide: DRAFT_SLIDE,
  source_check: SOURCE_CHECK,
  art_check: ART_CHECK,
  market: MARKET,
  caption: CAPTION,
  design_language: DESIGN_LANGUAGE,
  ideas: IDEAS,
  scene_plan: SCENE_PLAN,
  outline: OUTLINE,
  blog_outline: BLOG_OUTLINE,
  blog_text: BLOG_TEXT,
  comic_story: COMIC_STORY,
  character_plan: CHARACTER_PLAN,
  student_why: STUDENT_WHY,
  student_ask: STUDENT_ASK,
  student_words: STUDENT_WORDS,
  suggest_sources: SUGGEST_SOURCES,
  research_claim: RESEARCH_CLAIM,
}

/** The tier a use case starts on with no choice saved: its spec's, or the image tier for art. */
export function defaultTier(useCase: UseCase): Tier {
  return useCase === 'art' ? 'image' : SPECS[useCase].tier
}

/** The cover the art Test draws: a scene and words like a post's, built as a cover's prompt is. */
const ART_PROMPT = coverPrompt({
  scene: 'A student reading at a desk by a window in morning light',
  message: 'Plan your first week',
  angle: null,
  emotion: null,
  idea: null,
})

/** A tier the use case does not allow (criterion 95); the page's actions refuse with it too. */
export const OFF_TIER = 'This use case does not run on that tier.'

const cut = (message: string) => message.slice(0, ERROR_MAX)
const messageOf = (err: unknown) => cut(err instanceof Error ? err.message : String(err))

type Deps = Pick<
  Parameters<typeof makeAi>[0],
  'provider' | 'config' | 'calls' | 'cache' | 'settings' | 'logCall'
>

type Seen = { model: string; error?: string }

export function makeTestCalls(deps: Deps) {
  /**
   * A client of its own whose provider reports its one attempt, every call made `once`; the
   * recording's budget of one is a second guard. An override's settings hold no use-case tier, so
   * the pinned tier is the one tried.
   */
  function client(override?: TierOverride) {
    const rec = recording(deps.provider, { cap: 1 })
    const images: Seen[] = []
    const provider: Provider = {
      ...rec.provider,
      async image(req) {
        try {
          const bytes = await deps.provider.image(req)
          images.push({ model: req.model })
          return bytes
        } catch (err) {
          images.push({ model: req.model, error: messageOf(err) })
          throw err
        }
      },
    }
    const saved = deps.settings
    const settings =
      override && saved
        ? {
            ...saved,
            readSettings: async () => ({ ...(await saved.readSettings()), useCaseTiers: {} }),
          }
        : saved
    const app = makeAi({ ...deps, provider, settings })
    const ai: typeof app = {
      ...app,
      generateJson: (spec, req) => app.generateJson(spec, { ...req, once: true }),
      generateImage: (req) => app.generateImage({ ...req, once: true }),
    }
    /** The last attempt made, or null when none was. */
    const last = (): Seen | null => images.at(-1) ?? rec.attempts.at(-1) ?? null
    return { ai, last }
  }

  async function testUseCase(useCase: UseCase, override?: TierOverride): Promise<TestResult> {
    const started = Date.now()
    if (override && !allowedTiers(useCase).includes(override.tier)) {
      return { ok: false, model: override.model, ms: 0, error: OFF_TIER }
    }
    const { ai, last } = client(override)
    const res =
      useCase === 'art'
        ? await ai.generateImage({
            prompt: ART_PROMPT,
            aspectRatio: '1:1',
            data: { prompt: ART_PROMPT },
            ...(override && { model: override.model }),
          })
        : await ai.generateJson(pinned(SPECS[useCase], override), {
            data: SPECS[useCase].example.data,
            cache: false,
            ...(override && { model: override.model }),
          })
    const ms = Date.now() - started
    const seen = last()
    const model = seen?.model ?? override?.model ?? ''
    if (res.ok) return { ok: true, model, ms }
    return { ok: false, model, ms, error: seen?.error ?? res.error }
  }

  async function testStudentCalls(): Promise<StudentCallRow[]> {
    // As a student's call runs: the spec as it is, on the tiers the page chose, in one attempt.
    const pin: Pin = (spec) => spec
    const rows: StudentCallRow[] = []
    for (const c of CHECK_CASES) {
      const started = Date.now()
      const { ai, last } = client()
      let problems: string[]
      try {
        problems = await c.run(ai, pin)
      } catch (err) {
        problems = [messageOf(err)]
      }
      const seen = last()
      const ms = Date.now() - started
      const ok = problems.length === 0 && seen !== null
      rows.push({
        label: c.label,
        ok,
        model: seen?.model ?? '',
        ms,
        ...(!ok && { error: cut(problems.join(' ') || seen?.error || 'No call was made.') }),
      })
    }
    return rows
  }

  return { testUseCase, testStudentCalls }
}

/** An override's spec starts and stops on the override's tier, so the new model is all it tries. */
function pinned(spec: PromptSpec<z.ZodType>, override?: TierOverride): PromptSpec<z.ZodType> {
  if (!override || override.tier === 'image') return spec
  return { ...spec, tier: override.tier, maxTier: override.tier }
}

let app: ReturnType<typeof makeTestCalls> | null = null

/** The app's provider, call log and saved settings, as the app's `ai` has them. */
function appTestCalls() {
  if (!app) {
    const config = aiConfig(process.env)
    app = makeTestCalls({
      provider: config.provider === 'fake' ? makeFake() : vertexProvider(config),
      config,
      calls: dbCallLog,
      cache: dbCache,
      settings: settingsFor(config),
    })
  }
  return app
}

/** One live call of a use case on its spec's example, or on `override`'s model (criteria 93, 94). */
export function testUseCase(useCase: UseCase, override?: TierOverride): Promise<TestResult> {
  return appTestCalls().testUseCase(useCase, override)
}

/** Every case of the real-Gemini check once, as a student's call would run (criterion 93). */
export function testStudentCalls(): Promise<StudentCallRow[]> {
  return appTestCalls().testStudentCalls()
}
