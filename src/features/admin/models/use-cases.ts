// The use cases the Models page lists and tests, in its order. Pure, so the page's screen and its
// server actions read the same list; the Record makes a new UseCase fail to compile until it is here.

import type { UseCase } from '@/features/content/ai/config'

const LISTED: Record<UseCase, true> = {
  art: true,
  extract: true,
  draft: true,
  draft_slide: true,
  source_check: true,
  art_check: true,
  market: true,
  caption: true,
  design_language: true,
  ideas: true,
  scene_plan: true,
  outline: true,
  blog_outline: true,
  blog_text: true,
  comic_story: true,
  character_plan: true,
  student_why: true,
  student_ask: true,
  student_words: true,
  student_finder_why: true,
  suggest_sources: true,
  research_claim: true,
}

/** Every use case the page lists and tests. */
export const USE_CASES = Object.keys(LISTED) as readonly UseCase[]
