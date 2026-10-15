import { describe, expect, it } from 'bun:test'
import { ideaPostHref, parseIdeaStart } from './idea-start'

describe('ideaPostHref', () => {
  it('opens New post started from the idea, with the idea text and, from the queue, its id', () => {
    expect(ideaPostHref({ text: 'Perth on a student budget' })).toBe(
      '/admin/posts/new?idea=Perth+on+a+student+budget',
    )
    expect(ideaPostHref({ text: 'Rent', ideaId: 'perth-budget' })).toBe(
      '/admin/posts/new?idea=Rent&ideaId=perth-budget',
    )
  })

  it('keeps the idea to the 200 characters the idea field takes', () => {
    const href = ideaPostHref({ text: 'a'.repeat(250) })
    expect(new URL(href, 'https://x.test').searchParams.get('idea')).toBe('a'.repeat(200))
  })
})

describe('parseIdeaStart', () => {
  const known = ['perth-budget']

  it('reads the idea text and a known idea id back', () => {
    expect(parseIdeaStart({ idea: 'Rent', ideaId: 'perth-budget' }, known)).toEqual({
      text: 'Rent',
      ideaId: 'perth-budget',
    })
  })

  it('drops an unknown id, keeps the text to 200 characters, and is null with no idea', () => {
    expect(parseIdeaStart({ idea: 'Rent', ideaId: 'nope' }, known)).toEqual({
      text: 'Rent',
      ideaId: null,
    })
    expect(parseIdeaStart({ idea: 'b'.repeat(300) }, known)?.text).toBe('b'.repeat(200))
    expect(parseIdeaStart({}, known)).toBeNull()
    expect(parseIdeaStart({ idea: '   ' }, known)).toBeNull()
    expect(parseIdeaStart({ idea: ['Rent'] }, known)).toBeNull()
  })
})
