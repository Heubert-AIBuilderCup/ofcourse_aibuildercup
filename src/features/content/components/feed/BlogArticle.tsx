import Link from 'next/link'
import { useId } from 'react'
import { blogAspect } from '../../lib/blog-pictures'
import { blogBody, formatDay } from '../../lib/public-blog'
import type { LiveBlog } from '../../server/store'
import { PostSources } from './PostSources'
import { SlideStrip } from './SlideStrip'

/** The size a picture is drawn at for its shape, so the page keeps its place while it loads. */
const PICTURE_SIZE = { '16:9': { width: 1600, height: 900 }, '4:3': { width: 1200, height: 900 } }

type Picture = LiveBlog['pictures'][number]

function BlogPicture({ picture, href }: { picture: Picture; href: (assetId: string) => string }) {
  return (
    // The PNG is the stored, tinted picture: nothing to optimise.
    // biome-ignore lint/performance/noImgElement: next/image would re-encode the stored picture.
    <img
      src={href(picture.assetId)}
      alt={picture.alt}
      {...PICTURE_SIZE[blogAspect(picture.target)]}
      loading={picture.target === 'cover' ? undefined : 'lazy'}
      className="block h-auto w-full max-w-2xl border"
    />
  )
}

/**
 * A live blog as a reader reads it, on its public page and in the feed (BR9, BR11): the title,
 * the published and updated dates, the cover, the key takeaways, each section with its heading and
 * what sits after it (a picture, or a linked post's slides in its place), the FAQ, the sources
 * with their links, and its live posts under "From this guide" (BR7). Never its audience, layer or
 * why line. `pictureHref` and `slideHref` are the image routes the surface reads the blog's
 * pictures and the embedded posts' slides from; `postHref` is where the surface shows a post, or
 * null where it cannot.
 */
export function BlogArticle({
  blog,
  pictureHref,
  slideHref,
  postHref,
}: {
  blog: LiveBlog
  pictureHref: (assetId: string) => string
  slideHref: (assetId: string) => string
  postHref: (post: LiveBlog['posts'][number]) => string | null
}) {
  const takeawaysId = useId()
  const faqId = useId()
  const postsId = useId()
  const posts = blog.posts.flatMap((p) => {
    const href = postHref(p)
    return href ? [{ ...p, href }] : []
  })
  const body = blogBody(blog)
  return (
    // Marked as the language it is written in (GD40), so readers and search engines read it as one.
    <article lang={blog.language ?? 'en'} className="flex flex-col gap-section">
      <header className="flex max-w-prose flex-col gap-2">
        <h1 className="text-h1 font-semibold tracking-tight">{blog.title}</h1>
        <p className="text-caption text-muted-foreground">
          Published <time dateTime={blog.publishedAt}>{formatDay(blog.publishedAt)}</time>
          {' · '}
          Updated <time dateTime={blog.updatedAt}>{formatDay(blog.updatedAt)}</time>
        </p>
      </header>
      {body.cover && <BlogPicture picture={body.cover} href={pictureHref} />}
      {blog.takeaways.length > 0 && (
        <section aria-labelledby={takeawaysId} className="flex max-w-prose flex-col gap-2">
          <h2 id={takeawaysId} className="text-h3">
            Key takeaways
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {blog.takeaways.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      )}
      {body.sections.map((section, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a section is its place in the blog.
        <section key={i} className="flex flex-col gap-stack">
          <div className="flex max-w-prose flex-col gap-2">
            <h2 className="text-h3">{section.heading}</h2>
            <p className="whitespace-pre-line">{section.body}</p>
          </div>
          {section.after?.kind === 'picture' && (
            <BlogPicture picture={section.after.picture} href={pictureHref} />
          )}
          {section.after?.kind === 'slides' && (
            <figure className="flex flex-col gap-2">
              <SlideStrip slides={section.after.embed.slides} assetHref={slideHref} />
              <figcaption className="text-caption text-muted-foreground">
                {section.after.embed.title}
              </figcaption>
            </figure>
          )}
        </section>
      ))}
      {blog.faq.length > 0 && (
        <section aria-labelledby={faqId} className="flex max-w-prose flex-col gap-2">
          <h2 id={faqId} className="text-h3">
            FAQ
          </h2>
          <dl className="flex flex-col gap-stack">
            {blog.faq.map((f) => (
              <div key={f.q} className="flex flex-col gap-1">
                <dt className="font-heading">{f.q}</dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {blog.sources.length > 0 && <PostSources sources={blog.sources} />}
      {posts.length > 0 && (
        <section aria-labelledby={postsId} className="flex max-w-prose flex-col gap-2">
          <h2 id={postsId} className="text-h4">
            From this guide
          </h2>
          <ul className="flex flex-col gap-1">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={p.href} className="font-heading underline-offset-4 hover:underline">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}

/** Other live blogs under a blog (BR9), each linked to where the surface shows it; none, nothing. */
export function RelatedBlogs({
  blogs,
  href,
}: {
  blogs: readonly LiveBlog[]
  href: (blog: LiveBlog) => string
}) {
  const id = useId()
  if (blogs.length === 0) return null
  return (
    <section aria-labelledby={id} className="flex max-w-prose flex-col gap-2">
      <h2 id={id} className="text-h4">
        Related guides
      </h2>
      <ul className="flex flex-col gap-1">
        {blogs.map((b) => (
          <li key={b.id}>
            <Link href={href(b)} className="font-heading underline-offset-4 hover:underline">
              {b.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
