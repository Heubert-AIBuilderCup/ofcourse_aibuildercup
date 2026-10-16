/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { Staff } from '@/shared/lib/auth/access'
import { emptyPointers } from '../../model/artifacts'
import type { Saved } from '../../server/commands'

const push = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh: () => {} }),
}))

const { BlogPosts, PostBlogLinks } = await import('./BlogLinks')
type View = Parameters<typeof BlogPosts>[0]['view']

const BLOG_ID = '0b0c3a52-7f6c-4c6a-9d3e-1f0a5f5f4b11'
const OTHER_BLOG = '1c1d4b63-8a7d-4d7b-8e4f-2a1b6a6a5c22'

const VIEW: View = {
  id: 'p1',
  kind: 'feed',
  title: 'The 20-hour line',
  stage: 'live',
  version: 9,
  pointers: emptyPointers(),
  current: {} as View['current'],
  createdAt: '2026-10-05T09:12:00.000Z',
  running: [],
  draftChecks: [],
  publishedApprovalId: 'a1',
  linkedBlogId: null,
  blogs: [
    { id: BLOG_ID, title: 'Work hours, in full' },
    { id: OTHER_BLOG, title: 'Rent, explained' },
  ],
}

const made = (id: string) => async (): Promise<Saved> => ({ ok: true, id, version: 2 })
const actions = {
  makeBlogFromPostAction: mock(async (_id: unknown, _at: unknown, _input: unknown) =>
    made('new-blog')(),
  ),
  linkToBlogAction: mock(async (_id: unknown, _at: unknown, _input: unknown) => made('p1')()),
  makePostsFromBlogAction: mock(async (_id: unknown, _at: unknown, _input: unknown) =>
    made('new-post')(),
  ),
}

const EDITOR: Staff = { role: 'user', editor: true }
const REVIEWER: Staff = { role: 'user', reviewer: true }

afterEach(() => {
  cleanup()
  for (const action of Object.values(actions)) action.mockClear()
  push.mockClear()
})

describe('on a feed post (BR8)', () => {
  const links = (over: Partial<View> = {}, viewer: Staff = EDITOR) =>
    render(<PostBlogLinks view={{ ...VIEW, ...over }} viewer={viewer} actions={actions} />)

  it('makes a blog from the post under a new request id and opens it', async () => {
    links()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Make a blog' }))
    })
    const [id, at, input] = actions.makeBlogFromPostAction.mock.calls[0]
    expect([id, at]).toEqual(['p1', 9])
    expect((input as { requestId: string }).requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(push).toHaveBeenCalledWith('/admin/posts/new-blog')
  })

  it('links the post to the blog picked, and unlinks a linked one', async () => {
    links()
    fireEvent.change(screen.getByRole('combobox', { name: 'Link to an existing blog' }), {
      target: { value: OTHER_BLOG },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Link' }))
    })
    cleanup()
    links({ linkedBlogId: BLOG_ID })
    expect(screen.getByRole('link', { name: 'Work hours, in full' })).toHaveAttribute(
      'href',
      `/admin/posts/${BLOG_ID}`,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unlink' }))
    })
    expect(actions.linkToBlogAction.mock.calls.map((c) => c[2])).toEqual([
      { blogId: OTHER_BLOG },
      { blogId: null },
    ])
  })

  it('shows a viewer who may not edit the linked blog with no control', () => {
    links({ linkedBlogId: BLOG_ID }, REVIEWER)
    expect(screen.getByRole('link', { name: 'Work hours, in full' })).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
  })
})

describe('on a live blog (BR6)', () => {
  const BLOG: View = {
    ...VIEW,
    id: BLOG_ID,
    kind: 'blog',
    blogs: undefined,
    blogPosts: [
      { id: 'p1', title: 'The 20-hour line', live: true },
      { id: 'p2', title: 'Holiday hours', live: false },
    ],
  }
  const posts = (over: Partial<View> = {}, viewer: Staff = EDITOR) =>
    render(<BlogPosts view={{ ...BLOG, ...over }} viewer={viewer} actions={actions} />)

  it('lists its posts, and "Make posts from this blog" makes one and opens it', async () => {
    posts()
    expect(screen.getByRole('link', { name: 'Holiday hours' })).toHaveAttribute(
      'href',
      '/admin/posts/p2',
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Make posts from this blog' }))
    })
    const [id, at, input] = actions.makePostsFromBlogAction.mock.calls[0]
    expect([id, at]).toEqual([BLOG_ID, 9])
    expect((input as { requestId: string }).requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(push).toHaveBeenCalledWith('/admin/posts/new-post')
  })

  it('waits with the reason on a blog never published', () => {
    posts({ publishedApprovalId: null })
    expect(screen.getByRole('button', { name: 'Make posts from this blog' })).toBeDisabled()
    expect(screen.getByText('Publish the blog before making posts from it.')).toBeInTheDocument()
  })

  it('shows a viewer who may not edit its posts with no control', () => {
    posts({}, REVIEWER)
    expect(screen.getByRole('link', { name: 'The 20-hour line' })).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
