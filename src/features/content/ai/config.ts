// The model layer's settings, read from the environment. Pure: no secret is held here, since the
// Vertex client authenticates with Application Default Credentials.

export type Tier = 'lite' | 'flash' | 'pro' | 'image'
export type UseCase =
  | 'extract'
  | 'draft'
  | 'draft_slide'
  | 'source_check'
  | 'art'
  | 'art_check'
  | 'market'
  | 'caption'
  | 'design_language'
  | 'ideas'
  | 'scene_plan'
  | 'outline'
  | 'blog_outline'
  | 'blog_text'
  | 'comic_story'
  | 'character_plan'
  | 'student_why'
  | 'student_ask'
  | 'student_words'
  | SearchUseCase

/** The calls made with Google Search: they share the search cap, counted by these use cases. */
export const SEARCH_USE_CASES = ['suggest_sources', 'research_claim'] as const
export type SearchUseCase = (typeof SEARCH_USE_CASES)[number]

export type AiConfig = {
  /** 'fake' only when AI_PROVIDER says so; anything else runs the real models. */
  provider: 'fake' | 'vertex'
  project: string | null
  location: string
  models: { lite: string; flash: string; pro: string; image: string }
  /** Calls allowed per UTC day. Lite and Flash have no cap; a search on Flash has its own. */
  caps: { pro: number; image: number; search: number }
}

/** A missing or invalid cap reads as 0, which refuses that tier: safer than unlimited. */
function cap(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value.trim())) return 0
  return Number(value.trim())
}

/** Searches a day when AI_DAILY_CAP_SEARCH is not set, so search works out of the box. */
const DEFAULT_SEARCH_CAP = 20

export function aiConfig(env: Record<string, string | undefined>): AiConfig {
  const search = env.AI_DAILY_CAP_SEARCH
  return {
    provider: env.AI_PROVIDER === 'fake' ? 'fake' : 'vertex',
    project: env.GOOGLE_CLOUD_PROJECT || null,
    location: env.GOOGLE_CLOUD_LOCATION || 'global',
    models: {
      // The cheap steps' model (SR8); the Flash model when none is set, so an older .env keeps working.
      lite: env.GEMINI_LITE_MODEL || env.GEMINI_FLASH_MODEL || '',
      flash: env.GEMINI_FLASH_MODEL ?? '',
      pro: env.GEMINI_PRO_MODEL ?? '',
      image: env.GEMINI_IMAGE_MODEL ?? '',
    },
    caps: {
      pro: cap(env.AI_DAILY_CAP_PRO),
      image: cap(env.AI_DAILY_CAP_IMAGE),
      search: search?.trim() ? cap(search) : DEFAULT_SEARCH_CAP,
    },
  }
}
