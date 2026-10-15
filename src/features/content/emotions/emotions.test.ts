import { describe, expect, it } from 'bun:test'
import { NATIVE_IDS, nativeOf } from '../text/native-fixtures'
import { EMOTION_ERROR, EMOTION_MAX, EMOTIONS, emotionById, emotionError, emotionOf } from './index'

// The emotion file (criterion 100, ADR-129): six chips with a tone note each, or the editor's own
// word (≤30 characters, letters, spaces and hyphens). One accessor resolves what a record stores.

describe('emotions', () => {
  it('lists the six chips in order, each with a one-line tone note', () => {
    expect(EMOTIONS.map((e) => [e.id, e.label])).toEqual([
      ['hopeful', 'Hopeful'],
      ['calm', 'Calm'],
      ['curious', 'Curious'],
      ['reassuring', 'Reassuring'],
      ['urgent', 'Urgent'],
      ['playful', 'Playful'],
    ])
    for (const e of EMOTIONS) {
      expect(e.tone.length, e.id).toBeGreaterThan(10)
      expect(e.tone, e.id).not.toContain('\n')
    }
  })

  it('finds a chip by id, null for an unknown one', () => {
    expect(emotionById('calm')?.label).toBe('Calm')
    expect(emotionById('Calm')).toBeNull()
    expect(emotionById('')).toBeNull()
  })

  it('accepts a custom word of letters, spaces and hyphens up to 30 characters', () => {
    expect(EMOTION_MAX).toBe(30)
    for (const word of ['Wistful', 'quietly proud', 'matter-of-fact', 'Élan', 'a'.repeat(30)]) {
      expect(emotionError(word), word).toBeNull()
    }
  })

  it('accepts a Nepali, Hindi or Thai word, its vowel signs and marks among its letters, up to 30 characters as a reader sees them', () => {
    for (const word of ['खुसी', 'आशावादी', 'उत्साहित', 'थोड़ा चिंतित', 'ตื่นเต้น', 'มีความหวัง']) {
      expect(emotionError(word), word).toBeNull()
    }
    for (const id of NATIVE_IDS) {
      expect(emotionError(nativeOf(id, 30)), id).toBeNull()
      expect(emotionError(nativeOf(id, 31)), id).toBe(EMOTION_ERROR)
    }
    expect(emotionOf('ตื่นเต้น')).toEqual({
      id: 'ตื่นเต้น',
      label: 'ตื่นเต้น',
      tone: 'Write in a ตื่นเต้น tone throughout.',
    })
  })

  it('refuses a native digit, or a mark with no letter under it', () => {
    for (const word of ['खुसी२', 'ตื่นเต้น๒', 'ि', 'खुसी -ी']) {
      expect(emotionError(word), word).toBe(EMOTION_ERROR)
    }
  })

  it('refuses a word with a digit, a quote mark, nothing in it or over 30 characters', () => {
    for (const word of ['calm2', 'so "calm"', '', ' ', 'a'.repeat(31), '-hopeful', 'hope  ful']) {
      expect(emotionError(word), JSON.stringify(word)).toBe(EMOTION_ERROR)
    }
  })

  it('resolves a stored value: a chip by id, a custom word as its own emotion, null otherwise', () => {
    expect(emotionOf('urgent')).toEqual(EMOTIONS[4])
    expect(emotionOf('Wistful')).toEqual({
      id: 'Wistful',
      label: 'Wistful',
      tone: 'Write in a wistful tone throughout.',
    })
    expect(emotionOf(null)).toBeNull()
    expect(emotionOf(undefined)).toBeNull()
    expect(emotionOf('calm2')).toBeNull()
  })
})
