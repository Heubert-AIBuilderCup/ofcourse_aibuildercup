import { describe, expect, it } from 'bun:test'
import { IMAGE_NUDGES, imageNudge, parseNudges, TEXT_NUDGES, textNudge } from './index'

// The nudge chips (GD10, GD13): six that steer a version's or a slide's wording, six that steer an
// image, in one repo file parsed at load as emotions/index.ts does.

describe('nudges', () => {
  it('lists the six text chips and the six image chips in order, each with a one-line instruction', () => {
    expect(TEXT_NUDGES.map((n) => [n.id, n.label])).toEqual([
      ['shorter', 'Shorter'],
      ['simpler', 'Simpler words'],
      ['personal', 'More personal'],
      ['surprising', 'More surprising'],
      ['practical', 'More practical'],
      ['warmer', 'Warmer'],
    ])
    expect(IMAGE_NUDGES.map((n) => n.id)).toEqual([
      'closer',
      'wider',
      'more-people',
      'fewer-things',
      'warmer-light',
      'calmer',
    ])
    for (const n of [...TEXT_NUDGES, ...IMAGE_NUDGES]) {
      expect(n.instruction.length, n.id).toBeGreaterThan(10)
      expect(n.instruction, n.id).not.toContain('\n')
    }
  })

  it('refuses a file whose ids repeat, or a chip with no instruction', () => {
    const chip = { id: 'shorter', label: 'Shorter', instruction: 'Cut each slot down.' }
    expect(() => parseNudges({ text: [chip, chip], image: [] })).toThrow()
    expect(() => parseNudges({ text: [chip], image: [{ ...chip, label: 'Closer' }] })).toThrow()
    expect(() => parseNudges({ text: [{ ...chip, instruction: '' }], image: [] })).toThrow()
    expect(parseNudges({ text: [chip], image: [] }).text).toEqual([chip])
  })

  it('finds a text chip and an image chip by id, null for an unknown one or the other kind', () => {
    expect(textNudge('shorter')?.label).toBe('Shorter')
    expect(imageNudge('closer')?.id).toBe('closer')
    expect(textNudge('closer')).toBeNull()
    expect(imageNudge('shorter')).toBeNull()
    expect(textNudge('')).toBeNull()
  })
})
