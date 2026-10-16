import 'server-only'
import { z } from 'zod'
import { SITE_NAME } from '@/shared/lib/site'
import { splitParagraphs } from '../../ai/extract'
import type { LanguageId } from '../../languages'
import { blogUrl } from '../../lib/public-blog'
import { WORKFLOW_ERRORS } from '../../lib/workflow'
import { BODIES, type Body, emptyPointers, type SourcePart } from '../../model/artifacts'
import {
  insertPost,
  isBlog,
  type LiveBlog,
  linkedBlogOf,
  liveBlogById,
  putArtifact,
  savePointers,
  setLinkedBlog,
} from '../store'
import { type Actor, command, fail, Refused, type Saved, save } from './shared'
import { type Extras, ideasAfter, makePostFromBlog } from './source'

// Posts and blogs linked both ways (BR6–BR8). A live blog's sections become the source of a new
// feed post linked to it, as many times as the editor asks; a post's source and facts become a
// new blog, and the post is linked to it; a post is linked to an existing blog, or unlinked. Each
// link is the post's content_post.blog_id, and each change of it a blog_link record on the post,
// written in the same save. Only on the editor's press: nothing links by itself.

/** The longest post id a command reads: ids are UUIDs, so anything longer is not one. */
const POST_ID_MAX = 100

const RequestSchema = z.object({ requestId: z.uuid() })
const LinkSchema = z.object({ blogId: z.string().min(1).max(POST_ID_MAX).nullable() })

/**
 * The blog as a source (BR6): each section's body a part, its paragraphs numbered on from the
 * section before, every part at the blog's public address under its title, and the sections'
 * headings beside them for the idea cards, in the blog's language (GD37). A section with no text
 * gives no part.
 */
function blogSource(blog: LiveBlog, language: LanguageId): { text: string; extras: Extras } {
  const url = blogUrl(blog.slug)
  const paragraphs: string[] = []
  const parts: SourcePart[] = []
  const blogSections: string[] = []
  for (const section of blog.sections) {
    const own = splitParagraphs(section.body).map((p) => p.text)
    if (own.length === 0) continue
    const from = paragraphs.length + 1
    paragraphs.push(...own)
    parts.push({ url, site: SITE_NAME, title: blog.title, from, to: paragraphs.length })
    blogSections.push(section.heading)
  }
  const extras: Extras = {
    url,
    site: SITE_NAME,
    parts,
    blogSections,
    framing: null,
    notes: null,
    language,
  }
  return { text: paragraphs.join('\n\n'), extras }
}

/**
 * "Make posts from this blog" (BR6): a new feed post whose source is the blog as students read it
 * now, its published sections, cited at its public address; linked to the blog, with idea cards
 * drawn from the sections (one post per section, or one that sums it up). Each press makes
 * another post; the blog itself is not changed. Refused for a blog not published (it has no
 * address to cite) or expired, and on a feed post.
 */
export async function makePostsFromBlog(
  actor: Actor,
  blogId: string,
  version: number,
  input: { requestId: string },
): Promise<Saved> {
  return command('makePostsFromBlog', 'makePostsFromBlog', actor, blogId, version, async (blog) => {
    const parsed = RequestSchema.safeParse(input)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    const live = await liveBlogById(blog.id)
    if (!live) return fail(WORKFLOW_ERRORS.blogNotLive)
    // The post is written in the blog's language (GD37).
    const { text, extras } = blogSource(live, blog.current.source?.body.language ?? 'en')
    return makePostFromBlog(
      actor,
      { requestId: parsed.data.requestId, title: live.title, text, extras },
      blog.id,
    )
  })
}

/**
 * "Make a blog" (BR8): a new blog, under the request's id, with the post's source and facts as
 * they stand, at its angles (the idea cards for a blog, after the save); the post linked to it
 * with a blog_link record, in the same save, and otherwise where it was. Returns the blog. A
 * source made from another blog is no longer one: its sections are not carried.
 */
export async function makeBlogFromPost(
  actor: Actor,
  postId: string,
  version: number,
  input: { requestId: string },
): Promise<Saved> {
  return command('makeBlogFromPost', 'makeBlogFromPost', actor, postId, version, async (post) => {
    const parsed = RequestSchema.safeParse(input)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    const { source, facts } = post.current
    if (!source || !facts) return fail(WORKFLOW_ERRORS.movedOn)
    const blogId = parsed.data.requestId
    const { blogSections: _, ...sourceBody } = source.body
    let blogVersion = 0
    const saved = await save(post, version, actor, async (tx) => {
      await insertPost(tx, {
        id: blogId,
        kind: 'blog',
        parentId: null,
        title: post.title,
        stage: 'source',
        pointers: emptyPointers(),
        actorId: actor.id,
      })
      const sourceId = await putArtifact(tx, {
        kind: 'source',
        postId: blogId,
        actorId: actor.id,
        body: BODIES.source.parse(sourceBody),
      })
      const factsBody: Body<'facts'> = { ...facts.body, sourceId }
      const factsId = await putArtifact(tx, {
        kind: 'facts',
        postId: blogId,
        actorId: actor.id,
        body: factsBody,
      })
      const made = await savePointers(
        tx,
        blogId,
        1,
        { stage: 'structures', pointers: { ...emptyPointers(), sourceId, factsId } },
        actor.id,
      )
      if (!made.ok) throw new Refused(made.error)
      blogVersion = made.version
      await setLinkedBlog(tx, post.id, blogId)
      await putArtifact(tx, {
        kind: 'blog_link',
        postId: post.id,
        actorId: actor.id,
        body: { kind: 'linked', blogId, postId: post.id },
      })
      return { stage: post.stage, pointers: post.pointers }
    })
    if (!saved.ok) return saved
    return ideasAfter(actor, { id: blogId, version: blogVersion })
  })
}

/**
 * "Link to an existing blog" (BR8): the post linked to a blog, draft or live, or with none to no
 * blog, and a blog_link record of the change in the same save. The same blog again saves nothing.
 * The blog's id is only a claim until the database says it is a blog.
 */
export async function linkToBlog(
  actor: Actor,
  postId: string,
  version: number,
  input: { blogId: string | null },
): Promise<Saved> {
  return command('linkToBlog', 'linkToBlog', actor, postId, version, async (post) => {
    const parsed = LinkSchema.safeParse(input)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.notABlog)
    const { blogId } = parsed.data
    const linked = (await linkedBlogOf(post.id)) ?? null
    const body: Body<'blog_link'> | null =
      blogId !== null
        ? { kind: 'linked', blogId, postId: post.id }
        : linked !== null
          ? { kind: 'unlinked', blogId: linked, postId: post.id }
          : null
    if (body === null || blogId === linked) return { ok: true, id: post.id, version }
    if (blogId !== null && !(await isBlog(blogId))) return fail(WORKFLOW_ERRORS.notABlog)
    return save(post, version, actor, async (tx) => {
      await setLinkedBlog(tx, post.id, blogId)
      await putArtifact(tx, { kind: 'blog_link', postId: post.id, actorId: actor.id, body })
      return { stage: post.stage, pointers: post.pointers }
    })
  })
}
