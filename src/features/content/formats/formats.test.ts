import { describe, expect, it } from 'bun:test'
import { FORMAT_IDS, OUTLINE_JOBS } from '../model/types'
import { FORMATS, formatById, parseFormats, rankedFormats } from './index'

// The format file (GD33): ten formats a post can take, each with a one-line description and the
// slide jobs it starts from, parsed at load as the emotions and nudges are.

describe('formats', () => {
  it('lists the ten formats in order, each with a one-line description and its slide jobs', () => {
    expect(FORMATS.map((f) => f.id)).toEqual([...FORMAT_IDS])
    expect(FORMATS).toHaveLength(10)
    expect(FORMATS.map((f) => f.label)).toEqual([
      'Myth vs fact',
      'N things nobody tells you',
      'This or that',
      'Step by step',
      'Informative, one idea per slide',
      'Bullet points',
      'A day in the life',
      'Question and answer',
      'Before you go (checklist)',
      'Then vs now (timeline)',
    ])
    for (const f of FORMATS) {
      expect(f.description.length, f.id).toBeGreaterThan(10)
      expect(f.description, f.id).not.toContain('\n')
      expect(f.jobs.length, f.id).toBeGreaterThanOrEqual(3)
      for (const job of f.jobs) expect(OUTLINE_JOBS, f.id).toContain(job)
    }
  })

  it('refuses a file whose ids repeat, miss one of the ten, or name a job no outline has', () => {
    const one = (id: string) => ({
      id,
      label: 'A format',
      description: 'One line about it.',
      jobs: ['hook', 'point', 'takeaway'],
    })
    const all = FORMAT_IDS.map(one)
    expect(parseFormats(all).map((f) => f.id)).toEqual([...FORMAT_IDS])
    expect(() => parseFormats([...all, one('myth-vs-fact')])).toThrow()
    expect(() => parseFormats(all.slice(1))).toThrow()
    expect(() =>
      parseFormats([{ ...all[0], jobs: ['hook', 'joke', 'takeaway'] }, ...all.slice(1)]),
    ).toThrow()
    expect(() => parseFormats([{ ...all[0], description: '' }, ...all.slice(1)])).toThrow()
  })

  it('finds a format by id, null for an unknown one', () => {
    expect(formatById('bullet-points')?.label).toBe('Bullet points')
    expect(formatById('Bullet points')).toBeNull()
    expect(formatById('')).toBeNull()
  })

  it("puts the model's top three first, marked recommended, then the rest in the file's order (GD33)", () => {
    const ranked = rankedFormats(['then-vs-now', 'myth-vs-fact', 'bullet-points'])
    expect(ranked.map((r) => r.format.id)).toEqual([
      'then-vs-now',
      'myth-vs-fact',
      'bullet-points',
      'things-nobody-tells-you',
      'this-or-that',
      'step-by-step',
      'one-idea-per-slide',
      'day-in-the-life',
      'question-and-answer',
      'before-you-go',
    ])
    expect(ranked.map((r) => r.recommended)).toEqual([true, true, true, ...Array(7).fill(false)])
    // Ideas found before formats were ranked: the file's order, none recommended.
    const unranked = rankedFormats(undefined)
    expect(unranked.map((r) => r.format.id)).toEqual([...FORMAT_IDS])
    expect(unranked.some((r) => r.recommended)).toBe(false)
  })
})
