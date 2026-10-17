import { describe, expect, it } from 'bun:test'
import { callNotes, noteLite, withWaitNotes } from './wait-notes'

describe('wait notes', () => {
  it('reach the run they are reported in, across awaits', async () => {
    const notes: unknown[] = []
    const lite: string[] = []
    await withWaitNotes({ note: (n) => notes.push(n), lite: (m) => lite.push(m) }, async () => {
      const note = callNotes()
      note({ kind: 'busy', model: 'flash', attempt: 2, waitS: 8 })
      await Promise.resolve()
      note({ kind: 'fallback', model: 'lite' })
      noteLite('lite')
      note(null)
    })
    expect(notes).toEqual([
      { kind: 'busy', model: 'flash', attempt: 2, waitS: 8 },
      { kind: 'fallback', model: 'lite' },
      null,
    ])
    expect(lite).toEqual(['lite'])
  })

  it('go nowhere outside a run, and never into another run', async () => {
    const notes: unknown[] = []
    callNotes()({ kind: 'fallback', model: 'lite' })
    noteLite('lite')
    await withWaitNotes({ note: (n) => notes.push(n), lite: () => {} }, async () => {})
    callNotes()({ kind: 'fallback', model: 'lite' })
    expect(notes).toEqual([])
  })

  it('keep a call’s busy note while a sibling call in the same run answers', async () => {
    const notes: unknown[] = []
    const waiting = { kind: 'busy', model: 'image', attempt: 2, waitS: 4 } as const
    await withWaitNotes({ note: (n) => notes.push(n), lite: () => {} }, async () => {
      const first = callNotes()
      const second = callNotes()
      first(waiting)
      second({ kind: 'busy', model: 'flash', attempt: 2, waitS: 2 })
      // The second answers: the first still waits, so its note is what the run shows.
      second(null)
      expect(notes.at(-1)).toEqual(waiting)
      first(null)
    })
    expect(notes.at(-1)).toBeNull()
  })
})
