import { describe, expect, it } from 'bun:test'
import { initialsOf } from './initials'

describe('initialsOf', () => {
  it('takes the first letters of the first two words, in capitals', () => {
    expect(initialsOf('Maya Rai')).toBe('MR')
    expect(initialsOf('maya rai sharma')).toBe('MR')
    expect(initialsOf('Asha')).toBe('A')
  })

  it('ignores spaces around and between the words', () => {
    expect(initialsOf('  maya   rai ')).toBe('MR')
    expect(initialsOf('   ')).toBe('')
  })
})
