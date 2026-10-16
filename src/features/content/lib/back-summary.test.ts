import { describe, expect, it } from 'bun:test'
import { editNote } from './back-summary'

describe('editNote (GD28)', () => {
  it('names what a text edit makes again: the pictures of changed slides on a look post', () => {
    expect(editNote({ from: 'rendered', to: 'structures', look: true })).toBe(
      'Text changed: the pictures of changed slides will be planned again',
    )
    expect(editNote({ from: 'approved', to: 'structures', look: false })).toBe(
      'Text changed: the slides will be rendered again',
    )
  })

  it('names what a changed source makes again, and what a changed scene asks for', () => {
    expect(editNote({ from: 'structures', to: 'source', look: true })).toBe(
      'Source changed: the facts and text versions will be made again',
    )
    expect(editNote({ from: 'in_review', to: 'rendered', look: true })).toBe(
      'Scene changed: draw it, then send the post to review again',
    )
  })

  it('says students keep the live version when the edit was made on a live post (116)', () => {
    expect(editNote({ from: 'live', to: 'structures', look: true })).toBe(
      'Text changed: the pictures of changed slides will be planned again · students keep the live version until it is published again',
    )
  })
})
