// The models the Models page may choose (ADR-115), and the tiers each use case may run on. Pure:
// the page, its actions and the client read the same rules.

import { SEARCH_USE_CASES, type Tier, type UseCase } from './config'

export type KnownModel = { id: string; tiers: readonly Tier[] }

/** Every model the app knows, with the tiers it may serve. A model not here cannot be chosen. */
export const KNOWN_MODELS: readonly KnownModel[] = [
  { id: 'gemini-3.5-flash-lite', tiers: ['lite', 'flash'] },
  { id: 'gemini-3.8-flash', tiers: ['lite', 'flash'] },
  { id: 'gemini-3.1-pro-preview', tiers: ['pro'] },
  { id: 'gemini-nano-banana-2.1', tiers: ['image'] },
]

/** Whether `id` is a known model that may serve `tier`; anything else, a near match included, is not. */
export function isKnownModel(id: string, tier: Tier): boolean {
  return KNOWN_MODELS.some((m) => m.id === id && m.tiers.includes(tier))
}

/**
 * The tiers a use case may run on, lowest first: a student use case (its id starts `student_`)
 * Flash-Lite and Flash, never Pro (criterion 79); the image use case the image tier only; a search
 * use case Flash only, since searchJson always runs on Flash; every other text use case lite, flash
 * and pro.
 */
export function allowedTiers(useCase: UseCase): Tier[] {
  if (useCase === 'art') return ['image']
  if ((SEARCH_USE_CASES as readonly string[]).includes(useCase)) return ['flash']
  if (useCase.startsWith('student_')) return ['lite', 'flash']
  return ['lite', 'flash', 'pro']
}
