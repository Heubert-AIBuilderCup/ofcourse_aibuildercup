'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import type { Staff } from '@/shared/lib/auth/access'
import { postPath } from '../../lib/steps'
import { actionError, WORKFLOW_ERRORS } from '../../lib/workflow'
import { Control, reasonText, tag } from '../parts'
import { usePostAction } from '../usePostAction'
import type { WorkbenchActions, WorkbenchView } from '../Workbench'

const linkClass = 'font-heading underline-offset-4 hover:underline'

/**
 * A request id kept until the press it was made for succeeds, so a second press of the same
 * request is the same new post (the commands make it under this id), and a press after that
 * makes another.
 */
function useRequestId() {
  const id = useRef<string | null>(null)
  return {
    take: () => {
      id.current ??= crypto.randomUUID()
      return id.current
    },
    done: () => {
      id.current = null
    },
  }
}

export type PostBlogLinksProps = {
  view: WorkbenchView
  viewer: Staff
  actions: Pick<WorkbenchActions, 'makeBlogFromPostAction' | 'linkToBlogAction'>
}

/**
 * A feed post's blog (BR8): the blog it is linked to, opened from here, with "Unlink"; "Make a
 * blog", which starts a blog from the post's source and facts, links the post to it and opens
 * it; and "Link to an existing blog", a picker of the blogs, draft or live. Nothing links unless
 * the editor presses. A viewer who may not edit sees the linked blog only.
 */
export function PostBlogLinks({ view, viewer, actions }: PostBlogLinksProps) {
  const ids = useId()
  const router = useRouter()
  const { pending, run } = usePostAction()
  const request = useRequestId()
  const blogs = view.blogs ?? []
  const linked = view.linkedBlogId ?? null
  const [picked, setPicked] = useState('')
  const makeGate = actionError('makeBlogFromPost', viewer, view.stage)
  const linkGate = actionError('linkToBlog', viewer, view.stage)
  const canMake = makeGate !== WORKFLOW_ERRORS.notAuthorised
  const canLink = linkGate !== WORKFLOW_ERRORS.notAuthorised
  const linkedTitle = linked ? (blogs.find((b) => b.id === linked)?.title ?? 'A blog') : null
  const choices = blogs.filter((b) => b.id !== linked)

  const make = () => {
    const requestId = request.take()
    run(
      () => actions.makeBlogFromPostAction(view.id, view.version, { requestId }),
      'Blog made · the post is linked to it',
      (made) => {
        request.done()
        router.push(postPath(made.id))
      },
    )
  }
  const link = (blogId: string | null) =>
    run(
      () => actions.linkToBlogAction(view.id, view.version, { blogId }),
      blogId ? 'Linked to the blog' : 'Unlinked from the blog',
      () => setPicked(''),
    )

  if (!linked && !canMake && !canLink) return null
  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-4">
      <h3 id={`${ids}-heading`} className="text-h4">
        Blog
      </h3>
      {linked && linkedTitle && (
        <div className="flex flex-wrap items-center gap-3">
          <p>
            {'Linked to '}
            <Link href={postPath(linked)} className={linkClass}>
              {linkedTitle}
            </Link>
          </p>
          {canLink && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending || linkGate !== null}
              onClick={() => link(null)}
            >
              Unlink
            </Button>
          )}
        </div>
      )}
      {canMake && (
        <Control reason={makeGate}>
          <Button variant="outline" disabled={pending || makeGate !== null} onClick={make}>
            Make a blog
          </Button>
        </Control>
      )}
      {canLink && choices.length > 0 && (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${ids}-blog`}>Link to an existing blog</Label>
          <Control reason={linkGate}>
            <NativeSelect
              id={`${ids}-blog`}
              value={picked}
              disabled={pending || linkGate !== null}
              onChange={(e) => setPicked(e.target.value)}
            >
              <option value="">Choose a blog</option>
              {choices.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </NativeSelect>
            <Button
              variant="outline"
              disabled={pending || linkGate !== null || picked === ''}
              onClick={() => link(picked)}
            >
              Link
            </Button>
          </Control>
        </div>
      )}
    </section>
  )
}

export type BlogPostsProps = {
  view: WorkbenchView
  viewer: Staff
  actions: Pick<WorkbenchActions, 'makePostsFromBlogAction'>
}

/**
 * A blog's posts (BR6, BR7): each linked post, opened from here, marked "Live" while students see
 * it; and "Make posts from this blog", which starts a feed post from the blog as students read it,
 * linked to it, and opens it. Each press makes another post. It waits, with why, until the blog
 * is published. A viewer who may not edit sees the posts only.
 */
export function BlogPosts({ view, viewer, actions }: BlogPostsProps) {
  const ids = useId()
  const router = useRouter()
  const { pending, run } = usePostAction()
  const request = useRequestId()
  const posts = view.blogPosts ?? []
  const gate = actionError('makePostsFromBlog', viewer, view.stage)
  const shown = gate !== WORKFLOW_ERRORS.notAuthorised
  const reason = gate ?? (view.publishedApprovalId ? null : WORKFLOW_ERRORS.blogNotLive)

  const make = () => {
    const requestId = request.take()
    run(
      () => actions.makePostsFromBlogAction(view.id, view.version, { requestId }),
      'Post made from this blog',
      (made) => {
        request.done()
        router.push(postPath(made.id))
      },
    )
  }

  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-4">
      <h3 id={`${ids}-heading`} className="text-h4">
        Posts from this blog
      </h3>
      {posts.length === 0 ? (
        <p className={reasonText}>No posts yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {posts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2">
              <Link href={postPath(p.id)} className={linkClass}>
                {p.title}
              </Link>
              {p.live && <span className={tag}>Live</span>}
            </li>
          ))}
        </ul>
      )}
      {shown && (
        <Control reason={reason}>
          <Button disabled={pending || reason !== null} onClick={make}>
            Make posts from this blog
          </Button>
        </Control>
      )}
    </section>
  )
}
