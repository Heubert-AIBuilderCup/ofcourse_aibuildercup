import { describe, expect, it } from 'bun:test'
import { initialsOf } from './initials'

describe('initialsOf', () => {
  it('takes the first letters of the first two words, uppercased', () => {
    expect(initialsOf('Sujan Rai')).toBe('SR')
    expect(initialsOf('sujan kumar rai')).toBe('SK')
  })

  it('takes one letter from a single name', () => {
    expect(initialsOf('Sujan')).toBe('S')
  })

  it('skips punctuation and extra spaces', () => {
    expect(initialsOf('  (Sujan)   rai ')).toBe('SR')
  })

  it('is empty when there is nothing to take', () => {
    expect(initialsOf('')).toBe('')
    expect(initialsOf(null)).toBe('')
    expect(initialsOf('— ·')).toBe('')
  })
})
