import { describe, expect, it } from 'bun:test'
import { IDEAS, ideaById, ideaText, queueRows } from '.'

describe('the suggested ideas file', () => {
  it('holds the six mock ideas: five content research topics and one event', () => {
    expect(IDEAS).toHaveLength(6)
    expect(IDEAS.filter((i) => i.group === 'content')).toHaveLength(5)
    const event = IDEAS.find((i) => i.kind === 'event')
    expect(event?.group).toBe('expansion')
    expect(event?.deliveredBy?.length).toBeGreaterThan(0)
    expect(new Set(IDEAS.map((i) => i.id)).size).toBe(6)
  })

  it('finds an idea by id, and nothing for an unknown one', () => {
    expect(ideaById(IDEAS[0].id)).toBe(IDEAS[0])
    expect(ideaById('nope')).toBeNull()
  })

  it("starts a post from the idea's title and evidence", () => {
    const idea = IDEAS[0]
    expect(ideaText(idea)).toBe(`${idea.title}. ${idea.evidence}`)
  })
})

describe('queueRows', () => {
  const [a, b, c] = IDEAS

  it('hides a dismissed idea and marks an accepted one with its post', () => {
    const rows = queueRows(IDEAS.slice(0, 3), [
      { ideaId: a.id, decision: 'dismissed', postId: null },
      { ideaId: b.id, decision: 'accepted', postId: 'p1' },
    ])
    expect(rows.map((r) => [r.idea.id, r.state])).toEqual([
      [b.id, { accepted: true, postId: 'p1' }],
      [c.id, null],
    ])
  })
})
