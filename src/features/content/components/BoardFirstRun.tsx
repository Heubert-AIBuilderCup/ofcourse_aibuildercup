import { Plus } from 'lucide-react'
import Link from 'next/link'
import { Duck } from '@/shared/components/Duck'
import motion from '@/shared/components/motion.module.css'
import { SITE_NAME } from '@/shared/lib/site'
import { cn } from '@/shared/lib/utils'
import { nth } from '../lib/board'
import { COLUMNS } from '../model/stages'

/**
 * The board with no post at all: the blue band with the duck, a way to make the first post (an
 * editor's), and the six stages a post goes through. "Nothing matches these filters" is for a
 * board whose filters hide its posts.
 */
export function BoardFirstRun({ editable }: { editable: boolean }) {
  return (
    <section
      data-theme="light"
      aria-labelledby="board-first-run"
      className={cn(
        motion.grid,
        'relative flex flex-col items-center gap-3 overflow-hidden px-8 pt-16 pb-10 text-center text-panel-foreground @max-xl:px-5 @max-xl:pt-10 @max-xl:pb-8',
      )}
    >
      <Duck size="4.5rem" className="relative size-18 -scale-x-100 object-contain drop-shadow-md" />
      <h2
        id="board-first-run"
        className="relative mt-2 text-h1 leading-none font-semibold text-panel-foreground"
      >
        No posts yet.
      </h2>
      <p className="relative text-lead text-panel-foreground dark:text-panel-foreground/78">
        {`Paste a source or a link and ${SITE_NAME} makes the first post.`}
      </p>
      {editable && (
        <Link
          href="/admin/posts/new"
          className="relative mt-3 inline-flex min-h-11 items-center gap-2 bg-panel-foreground px-5 font-heading font-semibold text-panel no-underline hover:bg-accent-100 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-panel-foreground"
        >
          <Plus aria-hidden="true" strokeWidth={1.5} className="size-icon" />
          New feed post
        </Link>
      )}
      <ol
        aria-label="Where a post goes"
        className="relative mt-10 flex flex-wrap justify-center gap-2 @max-xl:mt-7"
      >
        {COLUMNS.map((c, i) => (
          <li
            key={c.id}
            className="inline-flex min-h-9 items-center gap-2 border border-panel-foreground/45 px-3 font-heading font-medium tracking-wide"
          >
            <span className="font-semibold opacity-70">{nth(i)}</span>
            {c.label}
          </li>
        ))}
      </ol>
    </section>
  )
}
