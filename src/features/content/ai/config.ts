// The model layer's settings, read from the environment. Pure: no secret is held here, since the
// Vertex client authenticates with Application Default Credentials.

/** Every tier, lowest first: the list the settings, the actions and the Models page read. */
export const TIERS = ['lite', 'flash', 'pro', 'image'] as const
export type Tier = (typeof TIERS)[number]

/** How much of a model's error is kept and shown: its first 500 characters (criterion 93). */
export const ERROR_MAX = 500

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
  | 'student_finder_why'
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
  /** Who to email for more when a day's cap is used up (SUPPORT_EMAIL); null when none is set. */
  supportEmail: string | null
}

const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** SUPPORT_EMAIL trimmed, or null when it is unset or does not look like an email. */
function email(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return EMAIL_LIKE.test(trimmed) ? trimmed : null
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
    supportEmail: email(env.SUPPORT_EMAIL),
  }
}
