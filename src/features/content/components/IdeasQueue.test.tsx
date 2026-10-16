/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import { IDEAS, queueRows } from '../ideas-queue'

const push = mock((_href: string) => {})
const refresh = mock(() => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh }),
}))

const { IdeasQueue } = await import('./IdeasQueue')

afterEach(cleanup)

let answer: { ok: true; href: string | null } | { ok: false; error: string } = {
  ok: true,
  href: null,
}
const accept = mock(async (_id: unknown) => answer)
const dismiss = mock(async (_id: unknown) => answer)

beforeEach(() => {
  answer = { ok: true, href: null }
  accept.mockClear()
  dismiss.mockClear()
  push.mockClear()
  refresh.mockClear()
})

const [content, second] = IDEAS
const event = IDEAS.find((i) => i.kind === 'event')
if (!event) throw new Error('no event idea')

const queue = (editable: boolean, decisions: Parameters<typeof queueRows>[1] = []) =>
  render(
    <IdeasQueue
      rows={queueRows(IDEAS, decisions)}
      editable={editable}
      accept={accept}
      dismiss={dismiss}
    />,
  )

const rowOf = (title: string) => {
  const found = screen.getByRole('heading', { name: title }).closest('li')
  if (!found) throw new Error(`no row ${title}`)
  return within(found)
}

describe('IdeasQueue', () => {
  it('shows a reviewer every row read-only, with no Accept or Dismiss', () => {
    queue(false)
    expect(screen.getAllByRole('listitem', { name: /./ })).toHaveLength(IDEAS.length)
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
  })

  it('offers an editor Accept and Dismiss on each open row', () => {
    queue(true)
    expect(screen.getAllByRole('button', { name: 'Accept' })).toHaveLength(IDEAS.length)
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(IDEAS.length)
  })

  it('shows an accepted content idea with the link to its post, and one waiting for its post with the way to start it', () => {
    queue(true, [
      { ideaId: content.id, decision: 'accepted', postId: 'p1' },
      { ideaId: second.id, decision: 'accepted', postId: null },
    ])
    const done = rowOf(content.title)
    expect(done.getByText(/^Accepted/)).toBeInTheDocument()
    expect(done.getByRole('link', { name: 'Open the post' })).toHaveAttribute(
      'href',
      '/admin/posts/p1',
    )
    expect(done.queryByRole('button', { name: 'Accept' })).toBeNull()
    expect(rowOf(second.title).getByRole('link', { name: 'Start the post' })).toHaveAttribute(
      'href',
      expect.stringContaining(`ideaId=${second.id}`),
    )
  })

  it('shows an accepted expansion idea as passed to the team', () => {
    queue(true, [{ ideaId: event.id, decision: 'accepted', postId: null }])
    expect(rowOf(event.title).getByText('Accepted · passed to the team')).toBeInTheDocument()
  })

  it('accepting a content idea opens New post started from it; dismissing refreshes the queue', async () => {
    answer = { ok: true, href: '/admin/posts/new?idea=x' }
    queue(true)
    await act(async () => {
      fireEvent.click(rowOf(content.title).getByRole('button', { name: 'Accept' }))
    })
    expect(accept).toHaveBeenCalledWith(content.id)
    expect(push).toHaveBeenCalledWith('/admin/posts/new?idea=x')

    answer = { ok: true, href: null }
    await act(async () => {
      fireEvent.click(rowOf(second.title).getByRole('button', { name: 'Dismiss' }))
    })
    expect(dismiss).toHaveBeenCalledWith(second.id)
    expect(refresh).toHaveBeenCalled()
  })

  it('shows a refusal on the row', async () => {
    answer = { ok: false, error: 'You are not allowed to do that.' }
    queue(true)
    await act(async () => {
      fireEvent.click(rowOf(content.title).getByRole('button', { name: 'Dismiss' }))
    })
    expect(rowOf(content.title).getByRole('alert')).toHaveTextContent(
      'You are not allowed to do that.',
    )
  })
})
