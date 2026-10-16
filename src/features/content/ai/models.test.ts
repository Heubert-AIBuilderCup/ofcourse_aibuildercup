import { describe, expect, test } from 'bun:test'
import { SEARCH_USE_CASES, type Tier } from './config'
import { allowedTiers, isKnownModel, KNOWN_MODELS } from './models'
import * as prompts from './prompts'

const TIERS: Tier[] = ['lite', 'flash', 'pro', 'image']

/** Every prompt spec in prompts.ts: the text use cases and the ceiling each one sets. */
const SPECS = Object.values(prompts).filter(
  (v): v is prompts.PromptSpec<never> =>
    typeof v === 'object' && v !== null && 'useCase' in v && 'tier' in v,
)

describe('KNOWN_MODELS', () => {
  test('lists the models of ADR-115 with the tiers each may serve', () => {
    expect(KNOWN_MODELS.map((m) => [m.id, [...m.tiers]])).toEqual([
      ['gemini-3.5-flash-lite', ['lite', 'flash']],
      ['gemini-3.8-flash', ['lite', 'flash']],
      ['gemini-3.1-pro-preview', ['pro']],
      ['gemini-nano-banana-2.1', ['image']],
    ])
  })
})

describe('isKnownModel', () => {
  test('is true only for a listed model on a tier it may serve', () => {
    const allowed = new Set(KNOWN_MODELS.flatMap((m) => m.tiers.map((t) => `${m.id}|${t}`)))
    for (const m of KNOWN_MODELS) {
      for (const tier of TIERS) {
        expect(isKnownModel(m.id, tier)).toBe(allowed.has(`${m.id}|${tier}`))
      }
    }
    expect(isKnownModel('gemini-3.1-pro-preview', 'lite')).toBe(false)
    expect(isKnownModel('gemini-nano-banana-2.1', 'flash')).toBe(false)
  })

  test('refuses an unknown or near-miss id', () => {
    for (const id of [
      '',
      'gemini-3.8-flash ',
      'GEMINI-3.8-FLASH',
      'gemini-2.5-flash',
      'toString',
    ]) {
      expect(isKnownModel(id, 'flash')).toBe(false)
    }
  })
})

describe('allowedTiers', () => {
  test('a student use case allows Flash-Lite and Flash, never Pro', () => {
    expect(allowedTiers('student_why')).toEqual(['lite', 'flash'])
    expect(allowedTiers('student_ask')).toEqual(['lite', 'flash'])
    expect(allowedTiers('student_words')).toEqual(['lite', 'flash'])
  })

  test('the image use case allows only the image tier', () => {
    expect(allowedTiers('art')).toEqual(['image'])
  })

  test('a search use case allows only Flash, the one tier searchJson runs on', () => {
    for (const useCase of SEARCH_USE_CASES) {
      expect(`${useCase}:${allowedTiers(useCase)}`).toBe(`${useCase}:flash`)
    }
  })

  test('every other text use case allows lite, flash and pro', () => {
    for (const useCase of ['draft', 'extract', 'caption'] as const) {
      expect(allowedTiers(useCase)).toEqual(['lite', 'flash', 'pro'])
    }
  })

  test('agrees with each spec: its first tier is allowed, its ceiling is the highest allowed', () => {
    expect(SPECS.length).toBeGreaterThan(10)
    for (const spec of SPECS) {
      const tiers = allowedTiers(spec.useCase)
      expect(tiers).toContain(spec.tier)
      expect(`${spec.useCase}:${tiers.at(-1)}`).toBe(`${spec.useCase}:${spec.maxTier ?? 'pro'}`)
    }
  })
})
